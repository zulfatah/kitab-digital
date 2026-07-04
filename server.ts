import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeDatabase, dbService, getDatabaseStatus } from './server/db';
import { getVapidPublicKey, sendPushToUser } from './server/push-service';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
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

function startScheduleChecker() {
  console.log('Initiating reading schedule background checker (30-second interval)...');
  
  // Track notifications sent in the current minute to prevent duplicate sends
  // Key format: `${email}_${dateString}_${hour}:${minute}`
  const sentCache = new Set<string>();

  setInterval(async () => {
    try {
      // Clear cache if it gets too large
      if (sentCache.size > 1000) {
        sentCache.clear();
      }

      const schedules = await dbService.getAllReadingSchedules();
      if (!schedules || schedules.length === 0) return;

      const now = new Date();
      // Translate to standard day names stored in schedule (supporting both English and Indonesian)
      const daysEng = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const todayNameEng = daysEng[now.getDay()];
      const todayNameIndo = daysIndo[now.getDay()];

      // Format HH:MM
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMinute = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHour}:${currentMinute}`;
      const todayDateStr = now.toDateString();

      for (const schedule of schedules) {
        const { email, activeDays, reminderTime } = schedule;
        if (!email || !activeDays || !reminderTime) continue;

        // Check if today matches activeDays (English or Indonesian) and time matches reminderTime
        const matchesDay = activeDays.includes(todayNameEng) || activeDays.includes(todayNameIndo);
        const matchesTime = reminderTime === currentTimeStr;

        if (matchesDay && matchesTime) {
          const cacheKey = `${email}_${todayDateStr}_${currentTimeStr}`;
          if (!sentCache.has(cacheKey)) {
            sentCache.add(cacheKey);
            console.log(`[SCHEDULE REMINDER] Sending reminder notification to ${email}...`);
            await sendPushToUser(email, {
              title: 'Waktunya Membaca! 📖',
              body: `Saatnya meluangkan waktu untuk mencapai target harian membaca ${schedule.dailyGoalMinutes || 15} menit hari ini.`,
              url: '/'
            });
          }
        }
      }
    } catch (err) {
      console.error('Error running reading schedule checker:', err);
    }
  }, 30000); // Check every 30 seconds
}

async function startServer() {
  // Initialize Database Pool
  await initializeDatabase();

  // --- API ROUTES ---
  
  // Gemini AI text correction endpoint
  app.post('/api/gemini/fix-text', async (req: Request, res: Response) => {
    try {
      const { text, instruction, mode } = req.body;
      if (!text && !instruction) {
        return res.status(400).json({ error: 'Teks atau instruksi tidak boleh kosong' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: 'Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi di server. Silakan hubungi administrator atau tambahkan kunci di menu Settings > Secrets.' 
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let systemInstruction = 'Anda adalah editor, asisten penulisan, dan penyunting profesional bahasa Indonesia untuk platform Khazanah Digital.\n' +
        'Tugas Anda adalah memproses teks input agar tampak sangat rapi, memiliki tanda baca yang benar, tata bahasa yang sempurna, spasi yang presisi, dan struktur kalimat yang mengalir profesional.\n' +
        'PENTING: Hasilkan teks yang padat dan rapat. JANGAN menambahkan spasi berlebihan antar paragraf. Hindari penggunaan tag <br> ganda (<br><br>) atau baris kosong yang tidak perlu. Gunakan struktur HTML yang efisien dan rapat.\n' +
        'Teks input mungkin memiliki tag HTML (seperti <b>, <i>, <u>, <div>, <p>, <br>, <ul>, <li>, dll.). Anda WAJIB mempertahankan semua tag HTML dan strukturnya, atau menghasilkan output berformat HTML yang rapi jika diperintahkan membuat struktur baru.\n' +
        'Kembalikan HANYA hasil teks akhir yang siap digunakan langsung di editor kaya teks. Jangan menyertakan kata pengantar, penjelasan tambahan, penutup, atau pembungkus kode seperti ```html atau ```.';

      if (instruction) {
        systemInstruction += `\n\nPERINTAH KHUSUS PENGGUNA:\nAnda harus mengikuti perintah tambahan dari penulis ini dengan teliti: "${instruction}". Lakukan modifikasi atau penambahan pada teks yang diberikan sesuai perintah tersebut dengan profesional, namun tetap pertahankan gaya bahasa yang indah dan format HTML yang sesuai.`;
      } else if (mode === 'structure') {
        systemInstruction += '\n\nFOKUS UTAMA: Buat struktur tulisan yang rapi, buat paragraf terstruktur, tata tanda baca yang benar, tata letak yang profesional, dan pastikan keterbacaannya tinggi.';
      }

      const prompt = `Berikut adalah teks editor yang perlu diproses:\n\n--- MULAI TEKS ---\n${text || ''}\n--- AKHIR TEKS ---\n\n${instruction ? `Instruksi tambahan dari penulis: ${instruction}` : ''}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
        }
      });

      const fixedText = (response.text || '').replace(/^```html\s*/i, '').replace(/```$/, '').trim();
      res.json({ fixedText });
    } catch (e) {
      console.error('Error with Gemini API text fix:', e);
      res.status(500).json({ error: 'Gagal memproses teks dengan AI', details: e instanceof Error ? e.message : String(e) });
    }
  });

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

  // --- NATIVE WEB PUSH NOTIFICATION ENDPOINTS ---
  app.get('/api/notifications/vapid-public-key', (req: Request, res: Response) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.post('/api/notifications/subscribe', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const { subscription } = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Data subscription tidak valid' });
      }

      const p256dh = subscription.keys?.p256dh || '';
      const auth = subscription.keys?.auth || '';

      await dbService.savePushSubscription(email, subscription.endpoint, p256dh, auth);
      res.json({ success: true });
    } catch (e: any) {
      console.error('Error saving subscription:', e);
      res.status(500).json({ error: 'Gagal mendaftarkan perangkat notifikasi' });
    }
  });

  app.post('/api/notifications/test', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const email = req.user!.email;
      const result = await sendPushToUser(email, {
        title: 'Tes Notifikasi Sukses! 🎉',
        body: 'Khazanah Digital berhasil terhubung dengan sistem Web Push perangkat Anda.',
        url: '/'
      });
      res.json({ success: true, result });
    } catch (e: any) {
      console.error('Error sending test notification:', e);
      res.status(500).json({ error: 'Gagal mengirimkan notifikasi uji coba' });
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

      const followers = await dbService.getFollowers(email);
      const following = await dbService.getFollowing(email);

      if (!user) {
        if (userKitabs.length > 0) {
          const authorName = userKitabs[0].author || 'Penulis Kitab';
          return res.json({
            profile: {
              email,
              displayName: authorName,
              photoURL: '',
              bio: '',
              createdAt: userKitabs[0].createdAt || new Date().toISOString(),
              lastLoginAt: userKitabs[0].createdAt || new Date().toISOString(),
              followers,
              following
            },
            kitabs: userKitabs
          });
        }
        return res.status(404).json({ error: 'Profil pengguna tidak ditemukan' });
      }

      res.json({
        profile: {
          ...user,
          followers,
          following
        },
        kitabs: userKitabs
      });
    } catch (e) {
      console.error('Error fetching user profile:', e);
      res.status(500).json({ error: 'Gagal mengambil profil pengguna' });
    }
  });

  // Update profile endpoint
  app.post('/api/users/profile/update', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { displayName, bio } = req.body;
      const email = req.user?.email;
      if (!email) {
        return res.status(401).json({ error: 'Tidak diizinkan' });
      }
      if (!displayName || displayName.trim().length === 0) {
        return res.status(400).json({ error: 'Nama tampilan tidak boleh kosong' });
      }

      await dbService.updateUserProfile(email, displayName.trim(), (bio || '').trim());
      res.json({ success: true });
    } catch (e) {
      console.error('Error updating user profile:', e);
      res.status(500).json({ error: 'Gagal memperbarui profil' });
    }
  });

  // Follow user endpoint
  app.post('/api/users/follow/:email', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const followerEmail = req.user?.email;
      const followingEmail = req.params.email.trim().toLowerCase();

      if (!followerEmail) {
        return res.status(401).json({ error: 'Tidak diizinkan' });
      }
      if (followerEmail.toLowerCase() === followingEmail.toLowerCase()) {
        return res.status(400).json({ error: 'Anda tidak dapat mengikuti diri sendiri' });
      }

      await dbService.followUser(followerEmail, followingEmail);
      
      // Send real-time push notification
      try {
        const followerProfile = await dbService.getUser(followerEmail);
        const followerName = followerProfile?.displayName || followerEmail;
        await sendPushToUser(followingEmail, {
          title: 'Pengikut Baru! 👥',
          body: `${followerName} sekarang mengikuti Anda di Khazanah Digital.`,
          url: '/'
        });
      } catch (pushErr) {
        console.error('Error sending follow push notification:', pushErr);
      }

      res.json({ success: true });
    } catch (e) {
      console.error('Error following user:', e);
      res.status(500).json({ error: 'Gagal mengikuti pengguna' });
    }
  });

  // Unfollow user endpoint
  app.post('/api/users/unfollow/:email', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const followerEmail = req.user?.email;
      const followingEmail = req.params.email.trim().toLowerCase();

      if (!followerEmail) {
        return res.status(401).json({ error: 'Tidak diizinkan' });
      }

      await dbService.unfollowUser(followerEmail, followingEmail);
      res.json({ success: true });
    } catch (e) {
      console.error('Error unfollowing user:', e);
      res.status(500).json({ error: 'Gagal batal mengikuti pengguna' });
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
      const { id, kitabId, kitabTitle, title, chapters, status, type, content, createdAt } = req.body;
      const draft = {
        id,
        kitabId,
        kitabTitle,
        title,
        authorEmail: email,
        authorName: name,
        chapters,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: status || 'open',
        type: type || 'kitab',
        content: content || ''
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
    app.get('*', async (req: Request, res: Response) => {
      const distPath = path.join(process.cwd(), 'dist');
      let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
      
      const host = req.get('host') || 'khazanah.zoeldev.my.id';
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const baseUrl = `${protocol}://${host}`;
      const fullUrl = `${baseUrl}${req.originalUrl}`;

      // Helper function to inject metadata robustly (even across multi-line tags in index.html)
      const injectDynamicMetaTags = (htmlString: string, options: { title: string; description: string; url: string }) => {
        const { title, description, url } = options;
        const escapedTitle = title.replace(/"/g, '&quot;');
        const escapedDesc = description.replace(/"/g, '&quot;');
        const escapedUrl = url.replace(/"/g, '&quot;');

        // Replace tab title
        let updatedHtml = htmlString.replace(/<title>[\s\S]*?<\/title>/gi, `<title>${escapedTitle}</title>`);

        // Replace content attribute inside specific meta tags (handles spaces and newlines safely)
        const replaceContentAttr = (tempHtml: string, attributeName: string, attributeValue: string, newContent: string) => {
          const regex = new RegExp(`<meta\\s+[^>]*?${attributeName}="${attributeValue}"[^>]*?>`, 'gi');
          return tempHtml.replace(regex, (match) => {
            return match.replace(/content="[\s\S]*?"/gi, `content="${newContent}"`);
          });
        };

        updatedHtml = replaceContentAttr(updatedHtml, 'property', 'og:title', escapedTitle);
        updatedHtml = replaceContentAttr(updatedHtml, 'property', 'og:description', escapedDesc);
        updatedHtml = replaceContentAttr(updatedHtml, 'property', 'og:url', escapedUrl);
        updatedHtml = replaceContentAttr(updatedHtml, 'name', 'twitter:title', escapedTitle);
        updatedHtml = replaceContentAttr(updatedHtml, 'name', 'twitter:description', escapedDesc);
        updatedHtml = replaceContentAttr(updatedHtml, 'name', 'title', escapedTitle);
        updatedHtml = replaceContentAttr(updatedHtml, 'name', 'description', escapedDesc);

        // Replace canonical href
        updatedHtml = updatedHtml.replace(/<link\s+[^>]*?rel="canonical"[^>]*?>/gi, (match) => {
          return match.replace(/href="[\s\S]*?"/gi, `href="${escapedUrl}"`);
        });

        return updatedHtml;
      };

      // Dynamic OG tags for kitab/article/book sharing
      const kitabId = req.query.kitabId as string;
      if (kitabId) {
        try {
          const kitabs = await dbService.getCustomKitabs("");
          const kitab = kitabs.find(k => k.id === kitabId);
          if (kitab) {
            const title = `${kitab.title} - Khazanah Digital`;
            const rawDesc = kitab.description || '';
            const description = rawDesc.trim()
              ? `${rawDesc.substring(0, 155)}${rawDesc.length > 155 ? '...' : ''}`
              : `Baca ${kitab.type || 'buku'} "${kitab.title}" karya ${kitab.author || 'Penulis'} secara lengkap dan gratis di Khazanah Digital.`;
            
            html = injectDynamicMetaTags(html, {
              title,
              description,
              url: fullUrl
            });
          } else {
            html = injectDynamicMetaTags(html, {
              title: 'Khazanah Digital - Platform Menulis, Membaca, dan Berbagi Karya',
              description: 'Menulis karya, kitab, buku, manuskrip, dan artikel ilmiah dengan struktur hierarki tanpa batas. Gratis untuk semua penulis.',
              url: fullUrl
            });
          }
        } catch (e) {
          console.error('Error generating dynamic OG tags:', e);
          html = injectDynamicMetaTags(html, {
            title: 'Khazanah Digital - Platform Menulis, Membaca, dan Berbagi Karya',
            description: 'Menulis karya, kitab, buku, manuskrip, dan artikel ilmiah dengan struktur hierarki tanpa batas. Gratis untuk semua penulis.',
            url: fullUrl
          });
        }
      } else {
        html = injectDynamicMetaTags(html, {
          title: 'Khazanah Digital - Platform Menulis, Membaca, dan Berbagi Karya',
          description: 'Menulis karya, kitab, buku, manuskrip, dan artikel ilmiah dengan struktur hierarki tanpa batas. Gratis untuk semua penulis.',
          url: fullUrl
        });
      }

      // Replace hardcoded custom domains with the actual requested base URL dynamically
      // This ensures WhatsApp, Telegram, etc. can fetch absolute URL assets correctly
      html = html.replace(/https:\/\/khazanah\.zoeldev\.my\.id/g, baseUrl);
      html = html.replace(/https:\/\/kitab\.zoeldev\.my\.id/g, baseUrl);

      res.send(html);
    });
  }

  // Start background reading schedule checker
  startScheduleChecker();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express full-stack server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error('Fatal server boot failure:', e);
});
