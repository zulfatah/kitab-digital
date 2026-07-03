import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase, dbService, getDatabaseStatus } from './server/db';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_default_secret_jwt_key_987654';

// Use express.json with limit to handle large custom kitab / drafts uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// JWT Verification Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    uid: string;
    displayName: string;
  };
}

const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
      if (err) {
        return res.status(403).json({ error: 'Token tidak valid atau kedaluwarsa' });
      }
      req.user = decoded;
      next();
    });
  } else {
    res.status(401).json({ error: 'Token autentikasi tidak ditemukan' });
  }
};

const optionalAuthenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
      if (!err) {
        req.user = decoded;
      }
      next();
    });
  } else {
    next();
  }
};

async function startServer() {
  // Initialize Database Pool
  await initializeDatabase();

  // --- API ROUTES ---

  // Diagnostic Endpoint: Check Database Connection Status
  app.get('/api/db-status', (req: Request, res: Response) => {
    try {
      const status = getDatabaseStatus();
      res.json(status);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mendapatkan status database', details: e instanceof Error ? e.message : String(e) });
    }
  });

  // Diagnostic Endpoint: Retest Database Connection Status
  app.post('/api/db-test', async (req: Request, res: Response) => {
    try {
      await initializeDatabase();
      const status = getDatabaseStatus();
      res.json({ message: 'Tes koneksi database selesai dilakukan', status });
    } catch (e) {
      res.status(500).json({ error: 'Gagal melakukan tes ulang koneksi database', details: e instanceof Error ? e.message : String(e) });
    }
  });

  // Auth: Google Login Callback from Client
  app.post('/api/auth/google-login', async (req: Request, res: Response) => {
    try {
      const { email, displayName, photoURL, uid } = req.body;
      if (!email || !uid) {
        return res.status(400).json({ error: 'Email dan UID wajib diisi' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const cleanName = displayName || 'Pembaca Google';
      const cleanPhoto = photoURL || '';

      // Save/update user profile in MySQL/fallback database
      await dbService.saveUser({
        uid,
        email: trimmedEmail,
        displayName: cleanName,
        photoURL: cleanPhoto
      });

      // Sign JWT Token
      const token = jwt.sign(
        { email: trimmedEmail, uid, displayName: cleanName },
        JWT_SECRET,
        { expiresIn: '7d' } // Expires in 7 days
      );

      res.json({
        token,
        user: {
          email: trimmedEmail,
          displayName: cleanName,
          photoURL: cleanPhoto,
          uid
        }
      });
    } catch (e) {
      console.error('Error on google-login endpoint:', e);
      res.status(500).json({ error: 'Gagal memproses autentikasi Google' });
    }
  });

  // Preferences Endpoint
  app.get('/api/preferences', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const prefs = await dbService.getPreferences(email);
      res.json(prefs || { theme: 'light', arabicFontSize: 28, translationFontSize: 16, explanationFontSize: 14, arabicFontFamily: 'Amiri', lineSpacing: 'normal' });
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil preferensi' });
    }
  });

  app.post('/api/preferences', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const { theme, arabicFontSize, translationFontSize, explanationFontSize, arabicFontFamily, lineSpacing } = req.body;
      const prefs = { theme, arabicFontSize, translationFontSize, explanationFontSize, arabicFontFamily, lineSpacing };
      await dbService.savePreferences(email, prefs);
      res.json({ success: true, preferences: prefs });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan preferensi' });
    }
  });

  // Bookmarks Endpoint
  app.get('/api/bookmarks', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const bookmarks = await dbService.getBookmarks(email);
      res.json(bookmarks);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil penanda buku' });
    }
  });

  app.post('/api/bookmarks', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const { id, kitabId, chapterId, bookmarkedAt } = req.body;
      const bookmark = { id: id || `bm_${Date.now()}`, email, kitabId, chapterId, bookmarkedAt };
      await dbService.addBookmark(bookmark);
      res.json({ success: true, bookmark });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan penanda buku' });
    }
  });

  app.delete('/api/bookmarks', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const { kitabId, chapterId } = req.query;
      if (!kitabId || !chapterId) {
        return res.status(400).json({ error: 'KitabId dan ChapterId wajib disertakan' });
      }
      await dbService.deleteBookmark(email, kitabId as string, chapterId as string);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menghapus penanda buku' });
    }
  });

  // Annotations Endpoint
  app.get('/api/annotations', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const annotations = await dbService.getAnnotations(email);
      res.json(annotations);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil catatan sorotan' });
    }
  });

  app.post('/api/annotations', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const { id, kitabId, chapterId, paragraphId, highlightedText, note, color, createdAt } = req.body;
      const annotation = {
        id: id || `ann_${Date.now()}`,
        email,
        kitabId,
        chapterId,
        paragraphId,
        highlightedText,
        note,
        color: color || 'yellow',
        createdAt: createdAt || new Date().toISOString()
      };
      await dbService.saveAnnotation(annotation);
      res.json({ success: true, annotation });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan catatan' });
    }
  });

  app.delete('/api/annotations/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      await dbService.deleteAnnotation(id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menghapus catatan' });
    }
  });

  // Comments Endpoint
  app.get('/api/comments', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { kitabId, chapterId } = req.query;
      if (!kitabId || !chapterId) {
        return res.status(400).json({ error: 'kitabId dan chapterId diperlukan' });
      }
      const comments = await dbService.getComments(kitabId as string, chapterId as string);
      res.json(comments);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil komentar' });
    }
  });

  app.post('/api/comments', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const name = req.user!.displayName;
      const { id, kitabId, chapterId, content } = req.body;
      const comment = {
        id: id || `comm_${Date.now()}`,
        kitabId,
        chapterId,
        authorEmail: email,
        authorName: name,
        content,
        createdAt: new Date().toISOString()
      };
      await dbService.addComment(comment);
      res.json({ success: true, comment });
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengirim komentar' });
    }
  });

  app.delete('/api/comments/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      await dbService.deleteComment(id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menghapus komentar' });
    }
  });

  // Reading Schedules Endpoint
  app.get('/api/reading_schedules', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const schedule = await dbService.getReadingSchedule(email);
      res.json(schedule || { email, dailyGoalMinutes: 15, activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], reminderTime: '19:00', currentStreak: 0 });
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil target harian' });
    }
  });

  app.post('/api/reading_schedules', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const { id, dailyGoalMinutes, activeDays, reminderTime, currentStreak, lastReadDate } = req.body;
      const schedule = {
        id: id || `sched_${Date.now()}`,
        email,
        dailyGoalMinutes: dailyGoalMinutes || 15,
        activeDays: activeDays || [],
        reminderTime: reminderTime || '19:00',
        currentStreak: currentStreak || 0,
        lastReadDate
      };
      await dbService.saveReadingSchedule(schedule);
      res.json({ success: true, schedule });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan target harian' });
    }
  });

  // Custom Kitabs Endpoint
  app.get('/api/custom_kitabs', optionalAuthenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user?.email || "";
      const kitabs = await dbService.getCustomKitabs(email);
      res.json(kitabs);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil daftar kitab' });
    }
  });

  app.post('/api/custom_kitabs', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const { id, title, author, description, category, chapters, createdAt, isPublic, collaborators, type, content } = req.body;

      // Ambil daftar kitab kustom dan cek jika id sudah ada, pastikan pembuatnya adalah email yang sama
      const existingKitabs = await dbService.getCustomKitabs(email);
      const existingKitab = existingKitabs.find(k => k.id === id);
      if (existingKitab && existingKitab.createdBy !== email) {
        return res.status(403).json({ error: 'Anda tidak memiliki hak untuk mengedit kitab ini' });
      }

      const kitab = {
        id,
        createdBy: existingKitab ? existingKitab.createdBy : email,
        title,
        author: author || '',
        description: description || '',
        category: category || '',
        chapters: chapters || [],
        collaborators: collaborators || [],
        createdAt: createdAt || new Date().toISOString(),
        isPublic: isPublic === true || isPublic === 1 || isPublic === 'true',
        type: type || 'kitab',
        content: content || ''
      };
      await dbService.saveCustomKitab(kitab);
      res.json({ success: true, kitab });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan kitab' });
    }
  });

  app.delete('/api/custom_kitabs/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const email = req.user!.email;

      const existingKitabs = await dbService.getCustomKitabs(email);
      const existingKitab = existingKitabs.find(k => k.id === id);
      if (!existingKitab) {
        return res.status(404).json({ error: 'Kitab tidak ditemukan' });
      }
      if (existingKitab.createdBy !== email) {
        return res.status(403).json({ error: 'Anda tidak memiliki hak untuk menghapus kitab ini' });
      }

      await dbService.deleteCustomKitab(id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menghapus kitab kustom' });
    }
  });

  // User Profile Endpoint (Retrieve public user profile and list of public works)
  app.get('/api/users/profile/:email', optionalAuthenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.params.email.trim().toLowerCase();
      const user = await dbService.getUser(email);
      
      // Get all custom kitabs for the user
      const allKitabs = await dbService.getCustomKitabs(email);
      const requesterEmail = req.user?.email || "";
      
      const userKitabs = allKitabs.filter(k => {
        const isOwner = k.createdBy === email;
        const canSee = k.isPublic || (requesterEmail && requesterEmail === email);
        return isOwner && canSee;
      });

      if (!user) {
        if (userKitabs.length > 0) {
          const authorName = userKitabs[0].author || 'Penulis Kitab';
          return res.json({
            profile: {
              email,
              displayName: authorName,
              photoURL: '',
              createdAt: userKitabs[0].createdAt || new Date().toISOString(),
              lastLoginAt: userKitabs[0].createdAt || new Date().toISOString()
            },
            kitabs: userKitabs
          });
        }
        return res.status(404).json({ error: 'Profil pengguna tidak ditemukan' });
      }

      res.json({
        profile: user,
        kitabs: userKitabs
      });
    } catch (e) {
      console.error('Error fetching user profile:', e);
      res.status(500).json({ error: 'Gagal mengambil profil pengguna' });
    }
  });

  // --- COLLABORATIVE WRITING API ---
  app.get('/api/collab/drafts', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const drafts = await dbService.getCollabDrafts();
      res.json(drafts);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil naskah kolaborasi' });
    }
  });

  app.get('/api/collab/drafts/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const draft = await dbService.getCollabDraft(req.params.id);
      if (!draft) return res.status(404).json({ error: 'Naskah tidak ditemukan' });
      res.json(draft);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil naskah kolaborasi' });
    }
  });

  app.post('/api/collab/drafts', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const name = req.user!.displayName;
      const { id, kitabId, kitabTitle, title, chapters, status } = req.body;
      const draft = {
        id,
        kitabId,
        kitabTitle,
        title,
        authorEmail: email,
        authorName: name,
        chapters,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: status || 'open'
      };
      await dbService.saveCollabDraft(draft);
      res.json({ success: true, draft });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan naskah kolaborasi' });
    }
  });

  app.delete('/api/collab/drafts/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await dbService.deleteCollabDraft(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menghapus naskah kolaborasi' });
    }
  });

  app.get('/api/collab/merge_requests', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mrs = await dbService.getMergeRequests();
      res.json(mrs);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil permintaan penggabungan' });
    }
  });

  app.get('/api/collab/merge_requests/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mr = await dbService.getMergeRequest(req.params.id);
      if (!mr) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });
      res.json(mr);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil detail MR' });
    }
  });

  app.post('/api/collab/merge_requests', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const name = req.user!.displayName;
      const { id, draftId, kitabId, kitabTitle, title, description, status, diffs, reviewerEmail, reviewerName, reviewFeedback } = req.body;
      const mr = {
        id,
        draftId,
        kitabId,
        kitabTitle,
        title,
        description,
        authorEmail: email,
        authorName: name,
        status: status || 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        diffs: diffs || [],
        reviewerEmail,
        reviewerName,
        reviewFeedback
      };
      await dbService.saveMergeRequest(mr);
      res.json({ success: true, mr });
    } catch (e) {
      res.status(500).json({ error: 'Gagal menyimpan permintaan penggabungan' });
    }
  });

  app.get('/api/collab/history', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { kitabId } = req.query;
      if (!kitabId) return res.status(400).json({ error: 'kitabId diperlukan' });
      const history = await dbService.getCollabHistory(kitabId as string);
      res.json(history);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil riwayat kolaborasi' });
    }
  });

  app.post('/api/collab/history', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, kitabId, kitabTitle, userEmail, userName, message, timestamp, previousChapters, mergedChapters } = req.body;
      const history = {
        id,
        kitabId,
        kitabTitle,
        userEmail,
        userName,
        message,
        timestamp: timestamp || new Date().toISOString(),
        previousChapters,
        mergedChapters
      };
      await dbService.saveCollabHistory(history);
      res.json({ success: true, history });
    } catch (e) {
      res.status(500).json({ error: 'Gagal mencatat riwayat kolaborasi' });
    }
  });

  app.get('/api/collab/presence', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Auto purge stale presence (> 30s)
      const staleTime = new Date(Date.now() - 30 * 1000).toISOString();
      await dbService.clearStalePresence(staleTime);

      const presences = await dbService.getCollabPresence();
      res.json(presences);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil kehadiran' });
    }
  });

  app.post('/api/collab/presence', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const name = req.user!.displayName;
      const { activeKitabId, activeDraftId, editingParagraphId } = req.body;
      const presence = {
        id: email,
        userEmail: email,
        userName: name,
        activeKitabId,
        activeDraftId,
        editingParagraphId,
        lastActive: new Date().toISOString()
      };
      await dbService.updateCollabPresence(presence);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Gagal memperbarui kehadiran' });
    }
  });

  app.get('/api/collab/comments', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { kitabId } = req.query;
      if (!kitabId) return res.status(400).json({ error: 'kitabId diperlukan' });
      const comments = await dbService.getCollabComments(kitabId as string);
      res.json(comments);
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengambil komentar kolaborasi' });
    }
  });

  app.post('/api/collab/comments', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const name = req.user!.displayName;
      const { id, mrId, kitabId, draftId, chapterId, paragraphId, content, parentId } = req.body;
      const comment = {
        id: id || `cc_${Date.now()}`,
        mrId,
        kitabId,
        draftId,
        chapterId,
        paragraphId,
        authorEmail: email,
        authorName: name,
        content,
        parentId,
        createdAt: new Date().toISOString()
      };
      await dbService.addCollabComment(comment);
      res.json({ success: true, comment });
    } catch (e) {
      res.status(500).json({ error: 'Gagal mengirim komentar kolaborasi' });
    }
  });

  // --- DEV & ASSET ROUTING SETUP ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express full-stack server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error('Fatal server boot failure:', e);
});
