import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

const FALLBACK_FILE_PATH = path.join(process.cwd(), 'data', 'mysql_fallback.json');

async function main() {
  console.log('====================================================');
  console.log('   MIGRASI DATA FALLBACK JSON KE DATABASE MYSQL     ');
  console.log('====================================================');

  // 1. Verifikasi File Fallback
  if (!fs.existsSync(FALLBACK_FILE_PATH)) {
    console.error(`❌ File fallback tidak ditemukan di: ${FALLBACK_FILE_PATH}`);
    console.log('Pastikan ada data lokal yang tersimpan terlebih dahulu.');
    process.exit(1);
  }

  const fallbackData = JSON.parse(fs.readFileSync(FALLBACK_FILE_PATH, 'utf8'));
  console.log('✅ File fallback berhasil dibaca!');

  // 2. Verifikasi Kredensial Database
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error('❌ Kredensial database MySQL tidak lengkap di .env!');
    console.log('Silakan atur variabel berikut di file .env Anda atau environment deployment:');
    console.log(`- DB_HOST: ${DB_HOST || '(belum diatur)'}`);
    console.log(`- DB_USER: ${DB_USER || '(belum diatur)'}`);
    console.log(`- DB_NAME: ${DB_NAME || '(belum diatur)'}`);
    console.log(`- DB_PORT: ${DB_PORT}`);
    process.exit(1);
  }

  console.log(`Connecting to MySQL database at ${DB_HOST}:${DB_PORT} (User: ${DB_USER}, DB: ${DB_NAME})...`);

  let pool: mysql.Pool;
  try {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 5
    });

    // Test connection
    const conn = await pool.getConnection();
    console.log('✅ Berhasil terhubung ke database MySQL!');
    conn.release();
  } catch (err: any) {
    console.error('❌ Gagal terhubung ke database MySQL:', err.message);
    console.log('\nAnalisis Penyebab:');
    console.log('1. Pastikan server MySQL Anda aktif.');
    console.log('2. Pastikan port 3306 terbuka dan dapat diakses dari luar (jika di-deploy).');
    console.log('3. Periksa kembali kecocokan Host, User, Password, dan Nama Database.');
    process.exit(1);
  }

  // 3. Inisialisasi Skema Tabel
  console.log('\nMembuat tabel jika belum ada...');
  const initQueries = [
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

  for (const q of initQueries) {
    await pool.query(q);
  }
  console.log('✅ Skema tabel berhasil diverifikasi/dibuat.');

  // 4. Migrasi Data Per Tabel
  console.log('\nMemulai proses migrasi data...');

  // --- USERS ---
  if (Array.isArray(fallbackData.users) && fallbackData.users.length > 0) {
    let count = 0;
    for (const u of fallbackData.users) {
      await pool.query(
        `INSERT INTO users (uid, email, displayName, photoURL, lastLoginAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE displayName = VALUES(displayName), photoURL = VALUES(photoURL), lastLoginAt = VALUES(lastLoginAt)`,
        [u.uid, u.email, u.displayName, u.photoURL, u.lastLoginAt, u.createdAt]
      );
      count++;
    }
    console.log(`🔹 Tabel [users]: Berhasil memigrasi ${count} baris.`);
  }

  // --- USER PREFERENCES ---
  if (Array.isArray(fallbackData.user_preferences) && fallbackData.user_preferences.length > 0) {
    let count = 0;
    for (const p of fallbackData.user_preferences) {
      await pool.query(
        `INSERT INTO user_preferences (email, theme, arabicFontSize, translationFontSize, explanationFontSize, arabicFontFamily, lineSpacing)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE theme = VALUES(theme), arabicFontSize = VALUES(arabicFontSize), translationFontSize = VALUES(translationFontSize), explanationFontSize = VALUES(explanationFontSize), arabicFontFamily = VALUES(arabicFontFamily), lineSpacing = VALUES(lineSpacing)`,
        [p.email, p.theme, p.arabicFontSize, p.translationFontSize, p.explanationFontSize, p.arabicFontFamily, p.lineSpacing]
      );
      count++;
    }
    console.log(`🔹 Tabel [user_preferences]: Berhasil memigrasi ${count} baris.`);
  }

  // --- BOOKMARKS ---
  if (Array.isArray(fallbackData.bookmarks) && fallbackData.bookmarks.length > 0) {
    let count = 0;
    for (const b of fallbackData.bookmarks) {
      await pool.query(
        `INSERT INTO bookmarks (id, email, kitabId, chapterId, bookmarkedAt)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email = VALUES(email), bookmarkedAt = VALUES(bookmarkedAt)`,
        [b.id, b.email, b.kitabId, b.chapterId, b.bookmarkedAt]
      );
      count++;
    }
    console.log(`🔹 Tabel [bookmarks]: Berhasil memigrasi ${count} baris.`);
  }

  // --- ANNOTATIONS ---
  if (Array.isArray(fallbackData.annotations) && fallbackData.annotations.length > 0) {
    let count = 0;
    for (const a of fallbackData.annotations) {
      await pool.query(
        `INSERT INTO annotations (id, email, kitabId, chapterId, paragraphId, highlightedText, note, color, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE note = VALUES(note), color = VALUES(color)`,
        [a.id, a.email, a.kitabId, a.chapterId, a.paragraphId, a.highlightedText, a.note, a.color, a.createdAt]
      );
      count++;
    }
    console.log(`🔹 Tabel [annotations]: Berhasil memigrasi ${count} baris.`);
  }

  // --- COMMENTS ---
  if (Array.isArray(fallbackData.comments) && fallbackData.comments.length > 0) {
    let count = 0;
    for (const c of fallbackData.comments) {
      await pool.query(
        `INSERT INTO comments (id, kitabId, chapterId, authorName, authorEmail, content, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE content = VALUES(content)`,
        [c.id, c.kitabId, c.chapterId, c.authorName, c.authorEmail, c.content, c.createdAt]
      );
      count++;
    }
    console.log(`🔹 Tabel [comments]: Berhasil memigrasi ${count} baris.`);
  }

  // --- READING SCHEDULES ---
  if (Array.isArray(fallbackData.reading_schedules) && fallbackData.reading_schedules.length > 0) {
    let count = 0;
    for (const s of fallbackData.reading_schedules) {
      await pool.query(
        `INSERT INTO reading_schedules (id, email, dailyGoalMinutes, activeDaysJson, reminderTime, currentStreak, lastReadDate)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE dailyGoalMinutes = VALUES(dailyGoalMinutes), activeDaysJson = VALUES(activeDaysJson), reminderTime = VALUES(reminderTime), currentStreak = VALUES(currentStreak), lastReadDate = VALUES(lastReadDate)`,
        [s.id, s.email, s.dailyGoalMinutes, s.activeDaysJson, s.reminderTime, s.currentStreak, s.lastReadDate]
      );
      count++;
    }
    console.log(`🔹 Tabel [reading_schedules]: Berhasil memigrasi ${count} baris.`);
  }

  // --- CUSTOM KITABS ---
  if (Array.isArray(fallbackData.custom_kitabs) && fallbackData.custom_kitabs.length > 0) {
    let count = 0;
    for (const k of fallbackData.custom_kitabs) {
      await pool.query(
        `INSERT INTO custom_kitabs (id, createdBy, title, author, description, category, chaptersJson, createdAt, isPublic)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), author = VALUES(author), description = VALUES(description), category = VALUES(category), chaptersJson = VALUES(chaptersJson), isPublic = VALUES(isPublic)`,
        [k.id, k.createdBy, k.title, k.author, k.description, k.category, typeof k.chaptersJson === 'string' ? k.chaptersJson : JSON.stringify(k.chaptersJson), k.createdAt, k.isPublic ? 1 : 0]
      );
      count++;
    }
    console.log(`🔹 Tabel [custom_kitabs]: Berhasil memigrasi ${count} baris.`);
  }

  // --- COLLAB DRAFTS ---
  if (Array.isArray(fallbackData.collab_drafts) && fallbackData.collab_drafts.length > 0) {
    let count = 0;
    for (const d of fallbackData.collab_drafts) {
      await pool.query(
        `INSERT INTO collab_drafts (id, kitabId, kitabTitle, title, authorEmail, authorName, chaptersJson, createdAt, updatedAt, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), chaptersJson = VALUES(chaptersJson), updatedAt = VALUES(updatedAt), status = VALUES(status)`,
        [d.id, d.kitabId, d.kitabTitle, d.title, d.authorEmail, d.authorName, typeof d.chaptersJson === 'string' ? d.chaptersJson : JSON.stringify(d.chaptersJson), d.createdAt, d.updatedAt, d.status]
      );
      count++;
    }
    console.log(`🔹 Tabel [collab_drafts]: Berhasil memigrasi ${count} baris.`);
  }

  // --- COLLAB MERGE REQUESTS ---
  if (Array.isArray(fallbackData.collab_merge_requests) && fallbackData.collab_merge_requests.length > 0) {
    let count = 0;
    for (const r of fallbackData.collab_merge_requests) {
      await pool.query(
        `INSERT INTO collab_merge_requests (id, draftId, kitabId, kitabTitle, title, description, authorEmail, authorName, status, createdAt, updatedAt, diffsJson, reviewerEmail, reviewerName, reviewFeedback)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), updatedAt = VALUES(updatedAt), diffsJson = VALUES(diffsJson), reviewerEmail = VALUES(reviewerEmail), reviewerName = VALUES(reviewerName), reviewFeedback = VALUES(reviewFeedback)`,
        [r.id, r.draftId, r.kitabId, r.kitabTitle, r.title, r.description, r.authorEmail, r.authorName, r.status, r.createdAt, r.updatedAt, typeof r.diffsJson === 'string' ? r.diffsJson : JSON.stringify(r.diffsJson), r.reviewerEmail, r.reviewerName, r.reviewFeedback]
      );
      count++;
    }
    console.log(`🔹 Tabel [collab_merge_requests]: Berhasil memigrasi ${count} baris.`);
  }

  // --- COLLAB HISTORY ---
  if (Array.isArray(fallbackData.collab_history) && fallbackData.collab_history.length > 0) {
    let count = 0;
    for (const h of fallbackData.collab_history) {
      await pool.query(
        `INSERT INTO collab_history (id, kitabId, kitabTitle, userEmail, userName, message, timestamp, previousChaptersJson, mergedChaptersJson)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE message = VALUES(message)`,
        [h.id, h.kitabId, h.kitabTitle, h.userEmail, h.userName, h.message, h.timestamp, typeof h.previousChaptersJson === 'string' ? h.previousChaptersJson : JSON.stringify(h.previousChaptersJson), typeof h.mergedChaptersJson === 'string' ? h.mergedChaptersJson : JSON.stringify(h.mergedChaptersJson)]
      );
      count++;
    }
    console.log(`🔹 Tabel [collab_history]: Berhasil memigrasi ${count} baris.`);
  }

  // --- COLLAB COMMENTS ---
  if (Array.isArray(fallbackData.collab_comments) && fallbackData.collab_comments.length > 0) {
    let count = 0;
    for (const cc of fallbackData.collab_comments) {
      await pool.query(
        `INSERT INTO collab_comments (id, mrId, kitabId, draftId, chapterId, paragraphId, authorEmail, authorName, content, parentId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE content = VALUES(content)`,
        [cc.id, cc.mrId, cc.kitabId, cc.draftId, cc.chapterId, cc.paragraphId, cc.authorEmail, cc.authorName, cc.content, cc.parentId, cc.createdAt]
      );
      count++;
    }
    console.log(`🔹 Tabel [collab_comments]: Berhasil memigrasi ${count} baris.`);
  }

  console.log('\n====================================================');
  console.log('🎉 MIGRASI SELESAI DENGAN SUKSES!');
  console.log('Semua data dari local fallback JSON berhasil disalin');
  console.log('dan disinkronkan ke database MySQL Anda.');
  console.log('====================================================');

  await pool.end();
}

main().catch((err) => {
  console.error('\n❌ Terjadi kesalahan fatal selama migrasi:', err);
  process.exit(1);
});
