-- =====================================================================
--  Amity Campus Helpdesk : database schema (SQLite, standard SQL)
--  Ye file server start hone par automatically run hoti hai.
--  "IF NOT EXISTS" ki wajah se dobara run karne par data delete nahi hota.
-- =====================================================================

-- 1) USERS : students aur admin dono isi table me, "role" se alag hote hain
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    TEXT UNIQUE,                       -- A2305 (admin ke liye NULL)
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                     -- bcrypt hash, plain password kabhi nahi
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2) TICKETS : student ki complaint / request
CREATE TABLE IF NOT EXISTS tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'General',
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  is_private  INTEGER NOT NULL DEFAULT 0,          -- 1 = sirf admin ke "Private" tab me dikhega
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- 3) NOTICES : notice board
CREATE TABLE IF NOT EXISTS notices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'General',
  notice_date TEXT NOT NULL,                       -- YYYY-MM-DD
  description TEXT NOT NULL
);

-- 4) DOCUMENTS : admin ne jo PDF / TXT upload ki (chatbot inhe padhta hai)
CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,                     -- disk par file ka naam (uploads/ folder me)
  size_bytes    INTEGER NOT NULL,
  text_content  TEXT,                              -- file se nikala hua text (chatbot search ke liye)
  uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5) FAQS : chatbot ki knowledge base
CREATE TABLE IF NOT EXISTS faqs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  keywords TEXT NOT NULL,                          -- "hostel curfew room warden"
  question TEXT NOT NULL,
  answer   TEXT NOT NULL,
  source   TEXT NOT NULL DEFAULT 'Amity.edu'       -- chat me chip ki tarah dikhta hai
);

-- 6) ESCALATIONS : jab chatbot ko answer nahi mila
CREATE TABLE IF NOT EXISTS escalations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  question   TEXT NOT NULL,
  confidence REAL NOT NULL,                        -- 0.0 se 1.0
  status     TEXT NOT NULL DEFAULT 'low_confidence' CHECK (status IN ('low_confidence','unresolved','resolved')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7) CHAT_MESSAGES : chat history (page refresh ke baad bhi dikhti hai)
CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','bot')),
  text       TEXT NOT NULL,
  source     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_user   ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_user      ON chat_messages(user_id);
