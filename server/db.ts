import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env variables
dotenv.config();

// Load env variables
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

let pool: mysql.Pool | null = null;
let isFallbackMode = true;
let lastConnectionError: string | null = null;

export function getDatabaseStatus() {
  return {
    isFallbackMode,
    host: DB_HOST || null,
    port: DB_PORT,
    user: DB_USER || null,
    database: DB_NAME || null,
    error: lastConnectionError,
    hasCredentials: !!(DB_HOST && DB_USER && DB_NAME)
  };
}
const FALLBACK_FILE_PATH = path.join(process.cwd(), 'data', 'mysql_fallback.json');

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Fallback JSON Structure
interface FallbackDB {
  users: any[];
  user_preferences: any[];
  bookmarks: any[];
  annotations: any[];
  comments: any[];
  reading_schedules: any[];
  custom_kitabs: any[];
  collab_drafts: any[];
  collab_merge_requests: any[];
  collab_history: any[];
  collab_presence: any[];
  collab_comments: any[];
}

const emptyFallbackDB: FallbackDB = {
  users: [],
  user_preferences: [],
  bookmarks: [],
  annotations: [],
  comments: [],
  reading_schedules: [],
  custom_kitabs: [],
  collab_drafts: [],
  collab_merge_requests: [],
  collab_history: [],
  collab_presence: [],
  collab_comments: []
};

// Load or initialize fallback DB
function loadFallbackDB(): FallbackDB {
  try {
    if (fs.existsSync(FALLBACK_FILE_PATH)) {
      const data = fs.readFileSync(FALLBACK_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read fallback DB, resetting to empty:', e);
  }
  saveFallbackDB(emptyFallbackDB);
  return emptyFallbackDB;
}

function saveFallbackDB(db: FallbackDB) {
  try {
    fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save fallback DB:', e);
  }
}

// Try to initialize MySQL Pool
export async function initializeDatabase() {
  if (DB_HOST && DB_USER && DB_NAME) {
    try {
      console.log(`Attempting to connect to MySQL database at ${DB_HOST}:${DB_PORT}...`);
      pool = mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 2000 // fail fast (2 seconds) if MySQL is unreachable
      });

      // Test connection
      const connection = await pool.getConnection();
      console.log('Successfully connected to MySQL database!');
      connection.release();
      isFallbackMode = false;
      lastConnectionError = null;

      // Initialize Tables
      await runSchemaInitialization();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.warn('MySQL connection failed or credentials missing. Falling back to robust local file-based JSON storage.');
      console.warn('Error details:', errMsg);
      isFallbackMode = true;
      lastConnectionError = errMsg;
    }
  } else {
    console.info('No MySQL credentials found in environment variables. Using robust local file-based JSON storage.');
    isFallbackMode = true;
    lastConnectionError = 'No credentials provided in env variables';
  }
}

// Create MySQL Tables automatically if running with a real DB
async function runSchemaInitialization() {
  if (!pool) return;
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      uid VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      displayName VARCHAR(255) DEFAULT NULL,
      photoURL TEXT DEFAULT NULL,
      lastLoginAt VARCHAR(64) DEFAULT NULL,
      createdAt VARCHAR(64) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS user_preferences (
      email VARCHAR(255) PRIMARY KEY,
      theme VARCHAR(32) DEFAULT 'light',
      arabicFontSize INT DEFAULT 28,
      translationFontSize INT DEFAULT 16,
      explanationFontSize INT DEFAULT 14,
      arabicFontFamily VARCHAR(128) DEFAULT 'Amiri',
      lineSpacing VARCHAR(32) DEFAULT 'normal'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS bookmarks (
      id VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      kitabId VARCHAR(128) NOT NULL,
      chapterId VARCHAR(128) NOT NULL,
      bookmarkedAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS annotations (
      id VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      kitabId VARCHAR(128) NOT NULL,
      chapterId VARCHAR(128) NOT NULL,
      paragraphId VARCHAR(128) NOT NULL,
      highlightedText TEXT NOT NULL,
      note TEXT DEFAULT NULL,
      color VARCHAR(32) DEFAULT 'yellow',
      createdAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS comments (
      id VARCHAR(128) PRIMARY KEY,
      kitabId VARCHAR(128) NOT NULL,
      chapterId VARCHAR(128) NOT NULL,
      authorName VARCHAR(255) NOT NULL,
      authorEmail VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      createdAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS reading_schedules (
      id VARCHAR(128) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      dailyGoalMinutes INT DEFAULT 15,
      activeDaysJson TEXT,
      reminderTime VARCHAR(32),
      currentStreak INT DEFAULT 0,
      lastReadDate VARCHAR(32)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS custom_kitabs (
      id VARCHAR(128) PRIMARY KEY,
      createdBy VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) DEFAULT '',
      description TEXT,
      category VARCHAR(255) DEFAULT '',
      chaptersJson LONGTEXT NOT NULL,
      createdAt VARCHAR(64) NOT NULL,
      isPublic TINYINT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS collab_drafts (
      id VARCHAR(128) PRIMARY KEY,
      kitabId VARCHAR(128) NOT NULL,
      kitabTitle VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      authorEmail VARCHAR(255) NOT NULL,
      authorName VARCHAR(255) NOT NULL,
      chaptersJson LONGTEXT NOT NULL,
      createdAt VARCHAR(64) NOT NULL,
      updatedAt VARCHAR(64) NOT NULL,
      status VARCHAR(32) DEFAULT 'open'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS collab_merge_requests (
      id VARCHAR(128) PRIMARY KEY,
      draftId VARCHAR(128) NOT NULL,
      kitabId VARCHAR(128) NOT NULL,
      kitabTitle VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      authorEmail VARCHAR(255) NOT NULL,
      authorName VARCHAR(255) NOT NULL,
      status VARCHAR(32) DEFAULT 'open',
      createdAt VARCHAR(64) NOT NULL,
      updatedAt VARCHAR(64) NOT NULL,
      diffsJson LONGTEXT NOT NULL,
      reviewerEmail VARCHAR(255) DEFAULT NULL,
      reviewerName VARCHAR(255) DEFAULT NULL,
      reviewFeedback TEXT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS collab_history (
      id VARCHAR(128) PRIMARY KEY,
      kitabId VARCHAR(128) NOT NULL,
      kitabTitle VARCHAR(255) NOT NULL,
      userEmail VARCHAR(255) NOT NULL,
      userName VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      timestamp VARCHAR(64) NOT NULL,
      previousChaptersJson LONGTEXT,
      mergedChaptersJson LONGTEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS collab_presence (
      id VARCHAR(255) PRIMARY KEY,
      userEmail VARCHAR(255) NOT NULL,
      userName VARCHAR(255) NOT NULL,
      activeKitabId VARCHAR(128),
      activeDraftId VARCHAR(128),
      editingParagraphId VARCHAR(128),
      lastActive VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS collab_comments (
      id VARCHAR(128) PRIMARY KEY,
      mrId VARCHAR(128),
      kitabId VARCHAR(128) NOT NULL,
      draftId VARCHAR(128),
      chapterId VARCHAR(128),
      paragraphId VARCHAR(128),
      authorEmail VARCHAR(255) NOT NULL,
      authorName VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      parentId VARCHAR(128),
      createdAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
    } catch (err) {
      console.error('Error running setup query:', err);
    }
  }

  // Column alteration migration
  try {
    await pool.query('ALTER TABLE custom_kitabs ADD COLUMN isPublic TINYINT DEFAULT 0');
  } catch (err) {
    // Column already exists or table does not exist yet (fallback is handled)
  }
  try {
    await pool.query('ALTER TABLE user_preferences ADD COLUMN explanationFontSize INT DEFAULT 14');
  } catch (err) {
    // Column already exists or table does not exist yet
  }
}

// Core DB Access Operations
export const dbService = {
  // --- USERS ---
  async saveUser(user: { uid: string; email: string; displayName: string; photoURL: string }) {
    const lastLogin = new Date().toISOString();
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO users (uid, email, displayName, photoURL, lastLoginAt, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE displayName = ?, photoURL = ?, lastLoginAt = ?`;
      await pool.query(q, [user.uid, user.email, user.displayName, user.photoURL, lastLogin, lastLogin, user.displayName, user.photoURL, lastLogin]);
    } else {
      const db = loadFallbackDB();
      const idx = db.users.findIndex(u => u.email === user.email);
      if (idx > -1) {
        db.users[idx] = { ...db.users[idx], displayName: user.displayName, photoURL: user.photoURL, lastLoginAt: lastLogin };
      } else {
        db.users.push({ ...user, lastLoginAt: lastLogin, createdAt: lastLogin });
      }
      saveFallbackDB(db);
    }
  },

  async getUser(email: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0] || null;
    } else {
      const db = loadFallbackDB();
      return db.users.find(u => u.email === email) || null;
    }
  },

  // --- PREFERENCES ---
  async savePreferences(email: string, prefs: any) {
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO user_preferences (email, theme, arabicFontSize, translationFontSize, explanationFontSize, arabicFontFamily, lineSpacing)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE theme = ?, arabicFontSize = ?, translationFontSize = ?, explanationFontSize = ?, arabicFontFamily = ?, lineSpacing = ?`;
      await pool.query(q, [
        email, 
        prefs.theme, 
        prefs.arabicFontSize, 
        prefs.translationFontSize, 
        prefs.explanationFontSize || 14, 
        prefs.arabicFontFamily, 
        prefs.lineSpacing, 
        prefs.theme, 
        prefs.arabicFontSize, 
        prefs.translationFontSize, 
        prefs.explanationFontSize || 14, 
        prefs.arabicFontFamily, 
        prefs.lineSpacing
      ]);
    } else {
      const db = loadFallbackDB();
      const idx = db.user_preferences.findIndex(p => p.email === email);
      if (idx > -1) {
        db.user_preferences[idx] = { ...db.user_preferences[idx], ...prefs };
      } else {
        db.user_preferences.push({ email, ...prefs });
      }
      saveFallbackDB(db);
    }
  },

  async getPreferences(email: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM user_preferences WHERE email = ?', [email]);
      return rows[0] || null;
    } else {
      const db = loadFallbackDB();
      return db.user_preferences.find(p => p.email === email) || null;
    }
  },

  // --- BOOKMARKS ---
  async getBookmarks(email: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM bookmarks WHERE email = ?', [email]);
      return rows;
    } else {
      const db = loadFallbackDB();
      return db.bookmarks.filter(b => b.email === email);
    }
  },

  async addBookmark(bookmark: any) {
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO bookmarks (id, email, kitabId, chapterId, bookmarkedAt) VALUES (?, ?, ?, ?, ?)`;
      await pool.query(q, [bookmark.id, bookmark.email, bookmark.kitabId, bookmark.chapterId, bookmark.bookmarkedAt]);
    } else {
      const db = loadFallbackDB();
      db.bookmarks.push(bookmark);
      saveFallbackDB(db);
    }
  },

  async deleteBookmark(email: string, kitabId: string, chapterId: string) {
    if (!isFallbackMode && pool) {
      await pool.query('DELETE FROM bookmarks WHERE email = ? AND kitabId = ? AND chapterId = ?', [email, kitabId, chapterId]);
    } else {
      const db = loadFallbackDB();
      db.bookmarks = db.bookmarks.filter(b => !(b.email === email && b.kitabId === kitabId && b.chapterId === chapterId));
      saveFallbackDB(db);
    }
  },

  // --- ANNOTATIONS ---
  async getAnnotations(email: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM annotations WHERE email = ?', [email]);
      return rows;
    } else {
      const db = loadFallbackDB();
      return db.annotations.filter(a => a.email === email);
    }
  },

  async saveAnnotation(annotation: any) {
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO annotations (id, email, kitabId, chapterId, paragraphId, highlightedText, note, color, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE note = ?, color = ?, createdAt = ?`;
      await pool.query(q, [annotation.id, annotation.email, annotation.kitabId, annotation.chapterId, annotation.paragraphId, annotation.highlightedText, annotation.note, annotation.color, annotation.createdAt, annotation.note, annotation.color, annotation.createdAt]);
    } else {
      const db = loadFallbackDB();
      const idx = db.annotations.findIndex(a => a.id === annotation.id);
      if (idx > -1) {
        db.annotations[idx] = { ...db.annotations[idx], ...annotation };
      } else {
        db.annotations.push(annotation);
      }
      saveFallbackDB(db);
    }
  },

  async deleteAnnotation(id: string) {
    if (!isFallbackMode && pool) {
      await pool.query('DELETE FROM annotations WHERE id = ?', [id]);
    } else {
      const db = loadFallbackDB();
      db.annotations = db.annotations.filter(a => a.id !== id);
      saveFallbackDB(db);
    }
  },

  // --- COMMENTS ---
  async getComments(kitabId: string, chapterId: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM comments WHERE kitabId = ? AND chapterId = ? ORDER BY createdAt ASC', [kitabId, chapterId]);
      return rows;
    } else {
      const db = loadFallbackDB();
      return db.comments.filter(c => c.kitabId === kitabId && c.chapterId === chapterId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
  },

  async addComment(comment: any) {
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO comments (id, kitabId, chapterId, authorName, authorEmail, content, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      await pool.query(q, [comment.id, comment.kitabId, comment.chapterId, comment.authorName, comment.authorEmail, comment.content, comment.createdAt]);
    } else {
      const db = loadFallbackDB();
      db.comments.push(comment);
      saveFallbackDB(db);
    }
  },

  async deleteComment(id: string) {
    if (!isFallbackMode && pool) {
      await pool.query('DELETE FROM comments WHERE id = ?', [id]);
    } else {
      const db = loadFallbackDB();
      db.comments = db.comments.filter(c => c.id !== id);
      saveFallbackDB(db);
    }
  },

  // --- READING SCHEDULES ---
  async getReadingSchedule(email: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM reading_schedules WHERE email = ?', [email]);
      if (rows[0]) {
        return {
          ...rows[0],
          activeDays: rows[0].activeDaysJson ? JSON.parse(rows[0].activeDaysJson) : []
        };
      }
      return null;
    } else {
      const db = loadFallbackDB();
      return db.reading_schedules.find(s => s.email === email) || null;
    }
  },

  async saveReadingSchedule(schedule: any) {
    const activeDaysJson = JSON.stringify(schedule.activeDays || []);
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO reading_schedules (id, email, dailyGoalMinutes, activeDaysJson, reminderTime, currentStreak, lastReadDate)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE dailyGoalMinutes = ?, activeDaysJson = ?, reminderTime = ?, currentStreak = ?, lastReadDate = ?`;
      await pool.query(q, [schedule.id, schedule.email, schedule.dailyGoalMinutes, activeDaysJson, schedule.reminderTime, schedule.currentStreak, schedule.lastReadDate, schedule.dailyGoalMinutes, activeDaysJson, schedule.reminderTime, schedule.currentStreak, schedule.lastReadDate]);
    } else {
      const db = loadFallbackDB();
      const idx = db.reading_schedules.findIndex(s => s.email === schedule.email);
      const row = {
        id: schedule.id,
        email: schedule.email,
        dailyGoalMinutes: schedule.dailyGoalMinutes,
        activeDays: schedule.activeDays || [],
        reminderTime: schedule.reminderTime,
        currentStreak: schedule.currentStreak,
        lastReadDate: schedule.lastReadDate
      };
      if (idx > -1) {
        db.reading_schedules[idx] = row;
      } else {
        db.reading_schedules.push(row);
      }
      saveFallbackDB(db);
    }
  },

  // --- CUSTOM KITABS ---
  async getCustomKitabs(email: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM custom_kitabs WHERE createdBy = ? OR createdBy = "" OR isPublic = 1', [email]);
      return rows.map((r: any) => {
        let chapters = [];
        let collaborators = [];
        try {
          const parsed = JSON.parse(r.chaptersJson);
          if (parsed && !Array.isArray(parsed) && parsed.chapters) {
            chapters = parsed.chapters;
            collaborators = parsed.collaborators || [];
          } else {
            chapters = parsed || [];
          }
        } catch (e) {
          chapters = [];
        }
        return {
          ...r,
          isPublic: r.isPublic === 1 || r.isPublic === true,
          chapters,
          collaborators
        };
      });
    } else {
      const db = loadFallbackDB();
      return db.custom_kitabs.map((k: any) => {
        let chapters = k.chapters || [];
        let collaborators = k.collaborators || [];
        if (k.chaptersJson) {
          try {
            const parsed = JSON.parse(k.chaptersJson);
            if (parsed && !Array.isArray(parsed) && parsed.chapters) {
              chapters = parsed.chapters;
              collaborators = parsed.collaborators || [];
            } else {
              chapters = parsed || [];
            }
          } catch (e) {}
        }
        return {
          ...k,
          isPublic: k.isPublic === 1 || k.isPublic === true,
          chapters,
          collaborators
        };
      }).filter(k => k.createdBy === email || k.createdBy === '' || k.isPublic === true);
    }
  },

  async saveCustomKitab(kitab: any) {
    const payload = {
      chapters: kitab.chapters || [],
      collaborators: kitab.collaborators || []
    };
    const chaptersJson = JSON.stringify(payload);
    const isPublicVal = kitab.isPublic ? 1 : 0;
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO custom_kitabs (id, createdBy, title, author, description, category, chaptersJson, createdAt, isPublic)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE title = ?, author = ?, description = ?, category = ?, chaptersJson = ?, isPublic = ?`;
      await pool.query(q, [
        kitab.id,
        kitab.createdBy,
        kitab.title,
        kitab.author,
        kitab.description,
        kitab.category,
        chaptersJson,
        kitab.createdAt,
        isPublicVal,
        kitab.title,
        kitab.author,
        kitab.description,
        kitab.category,
        chaptersJson,
        isPublicVal
      ]);
    } else {
      const db = loadFallbackDB();
      const idx = db.custom_kitabs.findIndex(k => k.id === kitab.id);
      const entry = {
        ...kitab,
        chaptersJson, // Keep synchronized
        chapters: kitab.chapters || [],
        collaborators: kitab.collaborators || [],
        isPublic: isPublicVal === 1
      };
      if (idx > -1) {
        db.custom_kitabs[idx] = entry;
      } else {
        db.custom_kitabs.push(entry);
      }
      saveFallbackDB(db);
    }
  },

  async deleteCustomKitab(id: string) {
    if (!isFallbackMode && pool) {
      await pool.query('DELETE FROM custom_kitabs WHERE id = ?', [id]);
    } else {
      const db = loadFallbackDB();
      db.custom_kitabs = db.custom_kitabs.filter(k => k.id !== id);
      saveFallbackDB(db);
    }
  },

  // --- COLLAB DRAFTS ---
  async getCollabDrafts() {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM collab_drafts ORDER BY updatedAt DESC');
      return rows.map((r: any) => ({
        ...r,
        chapters: JSON.parse(r.chaptersJson)
      }));
    } else {
      const db = loadFallbackDB();
      return db.collab_drafts;
    }
  },

  async getCollabDraft(id: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM collab_drafts WHERE id = ?', [id]);
      if (rows[0]) {
        return {
          ...rows[0],
          chapters: JSON.parse(rows[0].chaptersJson)
        };
      }
      return null;
    } else {
      const db = loadFallbackDB();
      return db.collab_drafts.find(d => d.id === id) || null;
    }
  },

  async saveCollabDraft(draft: any) {
    const chaptersJson = JSON.stringify(draft.chapters);
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO collab_drafts (id, kitabId, kitabTitle, title, authorEmail, authorName, chaptersJson, createdAt, updatedAt, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE title = ?, chaptersJson = ?, updatedAt = ?, status = ?`;
      await pool.query(q, [draft.id, draft.kitabId, draft.kitabTitle, draft.title, draft.authorEmail, draft.authorName, chaptersJson, draft.createdAt, draft.updatedAt, draft.status, draft.title, chaptersJson, draft.updatedAt, draft.status]);
    } else {
      const db = loadFallbackDB();
      const idx = db.collab_drafts.findIndex(d => d.id === draft.id);
      if (idx > -1) {
        db.collab_drafts[idx] = draft;
      } else {
        db.collab_drafts.push(draft);
      }
      saveFallbackDB(db);
    }
  },

  async deleteCollabDraft(id: string) {
    if (!isFallbackMode && pool) {
      await pool.query('DELETE FROM collab_drafts WHERE id = ?', [id]);
    } else {
      const db = loadFallbackDB();
      db.collab_drafts = db.collab_drafts.filter(d => d.id !== id);
      saveFallbackDB(db);
    }
  },

  // --- COLLAB MERGE REQUESTS ---
  async getMergeRequests() {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM collab_merge_requests ORDER BY updatedAt DESC');
      return rows.map((r: any) => ({
        ...r,
        diffs: JSON.parse(r.diffsJson)
      }));
    } else {
      const db = loadFallbackDB();
      return db.collab_merge_requests;
    }
  },

  async getMergeRequest(id: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM collab_merge_requests WHERE id = ?', [id]);
      if (rows[0]) {
        return {
          ...rows[0],
          diffs: JSON.parse(rows[0].diffsJson)
        };
      }
      return null;
    } else {
      const db = loadFallbackDB();
      return db.collab_merge_requests.find(mr => mr.id === id) || null;
    }
  },

  async saveMergeRequest(mr: any) {
    const diffsJson = JSON.stringify(mr.diffs || []);
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO collab_merge_requests (id, draftId, kitabId, kitabTitle, title, description, authorEmail, authorName, status, createdAt, updatedAt, diffsJson, reviewerEmail, reviewerName, reviewFeedback)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = ?, updatedAt = ?, reviewerEmail = ?, reviewerName = ?, reviewFeedback = ?`;
      await pool.query(q, [mr.id, mr.draftId, mr.kitabId, mr.kitabTitle, mr.title, mr.description, mr.authorEmail, mr.authorName, mr.status, mr.createdAt, mr.updatedAt, diffsJson, mr.reviewerEmail || null, mr.reviewerName || null, mr.reviewFeedback || null, mr.status, mr.updatedAt, mr.reviewerEmail || null, mr.reviewerName || null, mr.reviewFeedback || null]);
    } else {
      const db = loadFallbackDB();
      const idx = db.collab_merge_requests.findIndex(m => m.id === mr.id);
      if (idx > -1) {
        db.collab_merge_requests[idx] = mr;
      } else {
        db.collab_merge_requests.push(mr);
      }
      saveFallbackDB(db);
    }
  },

  // --- COLLAB HISTORY ---
  async getCollabHistory(kitabId: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM collab_history WHERE kitabId = ? ORDER BY timestamp DESC', [kitabId]);
      return rows.map((r: any) => ({
        ...r,
        previousChapters: r.previousChaptersJson ? JSON.parse(r.previousChaptersJson) : [],
        mergedChapters: r.mergedChaptersJson ? JSON.parse(r.mergedChaptersJson) : []
      }));
    } else {
      const db = loadFallbackDB();
      return db.collab_history.filter(h => h.kitabId === kitabId).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
  },

  async saveCollabHistory(history: any) {
    const prevChaptersJson = JSON.stringify(history.previousChapters || []);
    const mergedChaptersJson = JSON.stringify(history.mergedChapters || []);
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO collab_history (id, kitabId, kitabTitle, userEmail, userName, message, timestamp, previousChaptersJson, mergedChaptersJson)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      await pool.query(q, [history.id, history.kitabId, history.kitabTitle, history.userEmail, history.userName, history.message, history.timestamp, prevChaptersJson, mergedChaptersJson]);
    } else {
      const db = loadFallbackDB();
      db.collab_history.push(history);
      saveFallbackDB(db);
    }
  },

  // --- COLLAB PRESENCE ---
  async getCollabPresence() {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM collab_presence');
      return rows;
    } else {
      const db = loadFallbackDB();
      return db.collab_presence;
    }
  },

  async updateCollabPresence(presence: any) {
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO collab_presence (id, userEmail, userName, activeKitabId, activeDraftId, editingParagraphId, lastActive)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE activeKitabId = ?, activeDraftId = ?, editingParagraphId = ?, lastActive = ?`;
      await pool.query(q, [presence.id, presence.userEmail, presence.userName, presence.activeKitabId || null, presence.activeDraftId || null, presence.editingParagraphId || null, presence.lastActive, presence.activeKitabId || null, presence.activeDraftId || null, presence.editingParagraphId || null, presence.lastActive]);
    } else {
      const db = loadFallbackDB();
      const idx = db.collab_presence.findIndex(p => p.id === presence.id);
      if (idx > -1) {
        db.collab_presence[idx] = presence;
      } else {
        db.collab_presence.push(presence);
      }
      saveFallbackDB(db);
    }
  },

  async clearStalePresence(staleTimeISO: string) {
    if (!isFallbackMode && pool) {
      await pool.query('DELETE FROM collab_presence WHERE lastActive < ?', [staleTimeISO]);
    } else {
      const db = loadFallbackDB();
      db.collab_presence = db.collab_presence.filter(p => p.lastActive >= staleTimeISO);
      saveFallbackDB(db);
    }
  },

  // --- COLLAB COMMENTS ---
  async getCollabComments(kitabId: string) {
    if (!isFallbackMode && pool) {
      const [rows]: any = await pool.query('SELECT * FROM collab_comments WHERE kitabId = ? ORDER BY createdAt ASC', [kitabId]);
      return rows;
    } else {
      const db = loadFallbackDB();
      return db.collab_comments.filter(c => c.kitabId === kitabId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
  },

  async addCollabComment(comment: any) {
    if (!isFallbackMode && pool) {
      const q = `INSERT INTO collab_comments (id, mrId, kitabId, draftId, chapterId, paragraphId, authorEmail, authorName, content, parentId, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      await pool.query(q, [comment.id, comment.mrId || null, comment.kitabId, comment.draftId || null, comment.chapterId || null, comment.paragraphId || null, comment.authorEmail, comment.authorName, comment.content, comment.parentId || null, comment.createdAt]);
    } else {
      const db = loadFallbackDB();
      db.collab_comments.push(comment);
      saveFallbackDB(db);
    }
  }
};
