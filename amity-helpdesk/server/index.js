// =====================================================================
//  Amity Campus Helpdesk : Express API server
//  Run:  npm start   (default http://localhost:4000)
// =====================================================================
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import db from './db.js';
import { askBot, tokenize } from './chatbot.js';
import { extractText } from './extract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn('[warn] JWT_SECRET not set - using a dev secret. Set it before deploying.');
}

const CATEGORIES = ['General', 'Fees', 'Exam', 'Hostel', 'Library', 'Placement', 'IT'];
const NOTICE_CATEGORIES = ['General', 'Fees', 'Exam', 'Hostel', 'Placement'];
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------- helpers
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const publicUser = (u) => ({ id: u.id, studentId: u.student_id, name: u.name, email: u.email, role: u.role });

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return bad(res, 'Please sign in to continue.', 401);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, student_id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return bad(res, 'Account not found. Please sign in again.', 401);
    req.user = user;
    next();
  } catch {
    bad(res, 'Your session has expired. Please sign in again.', 401);
  }
}
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : bad(res, 'This action is for administrators only.', 403);

const TICKET_SELECT = `
  SELECT t.id, t.category, t.title, t.description, t.is_private AS isPrivate, t.status,
         substr(t.created_at, 1, 10) AS date, u.name AS studentName, u.student_id AS studentId
  FROM tickets t JOIN users u ON u.id = t.user_id`;

// ---------------------------------------------------------------- public
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/public/stats', (_req, res) => {
  const resolved = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status = 'resolved'").get().n;
  const aiResponses = db
    .prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE role = 'bot' AND created_at >= date('now','start of month')")
    .get().n;
  res.json({ resolved, aiResponses });
});

// ---------------------------------------------------------------- auth
app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return bad(res, 'Enter your university email and password.');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return bad(res, 'Email or password is incorrect.', 401);
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------------------------------------------------------------- notices
app.get('/api/notices', auth, (_req, res) => {
  res.json(
    db.prepare('SELECT id, title, category, notice_date AS date, description FROM notices ORDER BY notice_date DESC, id DESC').all()
  );
});

function readNotice(body) {
  const n = {
    title: clean(body?.title),
    category: clean(body?.category) || 'General',
    date: clean(body?.date),
    description: clean(body?.description),
  };
  if (!n.title || !n.description) return { error: 'Title and description are required.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date)) return { error: 'Pick a valid date.' };
  if (!NOTICE_CATEGORIES.includes(n.category)) return { error: 'Unknown notice category.' };
  return { n };
}

app.post('/api/notices', auth, adminOnly, (req, res) => {
  const { n, error } = readNotice(req.body);
  if (error) return bad(res, error);
  const info = db
    .prepare('INSERT INTO notices (title, category, notice_date, description) VALUES (?, ?, ?, ?)')
    .run(n.title, n.category, n.date, n.description);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/notices/:id', auth, adminOnly, (req, res) => {
  const { n, error } = readNotice(req.body);
  if (error) return bad(res, error);
  const info = db
    .prepare('UPDATE notices SET title = ?, category = ?, notice_date = ?, description = ? WHERE id = ?')
    .run(n.title, n.category, n.date, n.description, req.params.id);
  if (!info.changes) return bad(res, 'Notice not found.', 404);
  res.json({ ok: true });
});

app.delete('/api/notices/:id', auth, adminOnly, (req, res) => {
  const info = db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
  if (!info.changes) return bad(res, 'Notice not found.', 404);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- tickets (student)
app.get('/api/tickets/mine', auth, (req, res) => {
  res.json(db.prepare(`${TICKET_SELECT} WHERE t.user_id = ? ORDER BY t.created_at DESC, t.id DESC`).all(req.user.id));
});

app.post('/api/tickets', auth, (req, res) => {
  const category = clean(req.body?.category) || 'General';
  const description = clean(req.body?.description);
  const isPrivate = req.body?.isPrivate ? 1 : 0;
  if (!CATEGORIES.includes(category)) return bad(res, 'Choose a valid category.');
  if (description.length < 10) return bad(res, 'Describe your issue in at least 10 characters.');
  const title = description.length > 60 ? description.slice(0, 57).trimEnd() + '...' : description;
  const info = db
    .prepare('INSERT INTO tickets (user_id, category, title, description, is_private) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, category, title, description, isPrivate);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

// ---------------------------------------------------------------- tickets (admin)
app.get('/api/admin/tickets', auth, adminOnly, (_req, res) => {
  res.json(db.prepare(`${TICKET_SELECT} WHERE t.is_private = 0 ORDER BY t.created_at DESC, t.id DESC`).all());
});

app.get('/api/admin/tickets/private', auth, adminOnly, (_req, res) => {
  res.json(db.prepare(`${TICKET_SELECT} WHERE t.is_private = 1 ORDER BY t.created_at DESC, t.id DESC`).all());
});

app.patch('/api/admin/tickets/:id/status', auth, adminOnly, (req, res) => {
  const status = req.body?.status;
  if (!['open', 'resolved'].includes(status)) return bad(res, 'Status must be open or resolved.');
  const info = db
    .prepare("UPDATE tickets SET status = ?, resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE NULL END WHERE id = ?")
    .run(status, status, req.params.id);
  if (!info.changes) return bad(res, 'Ticket not found.', 404);
  res.json({ ok: true });
});

app.get('/api/admin/stats', auth, adminOnly, (_req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  res.json({
    students: one("SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),
    openTickets: one("SELECT COUNT(*) AS n FROM tickets WHERE status = 'open' AND is_private = 0"),
    resolvedTickets: one("SELECT COUNT(*) AS n FROM tickets WHERE status = 'resolved' AND is_private = 0"),
    notices: one('SELECT COUNT(*) AS n FROM notices'),
    recent: db.prepare(`${TICKET_SELECT} WHERE t.is_private = 0 ORDER BY t.created_at DESC, t.id DESC LIMIT 5`).all(),
  });
});

// ---------------------------------------------------------------- users (admin)
app.get('/api/admin/users', auth, adminOnly, (_req, res) => {
  res.json(
    db.prepare('SELECT id, student_id AS studentId, name, email, role FROM users ORDER BY role DESC, id').all()
  );
});

function readUser(body, { creating }) {
  const u = {
    name: clean(body?.name),
    email: clean(body?.email).toLowerCase(),
    studentId: clean(body?.studentId).toUpperCase() || null,
    role: clean(body?.role) || 'student',
    password: typeof body?.password === 'string' ? body.password : '',
  };
  if (!u.name) return { error: 'Full name is required.' };
  if (!/^\S+@\S+\.\S+$/.test(u.email)) return { error: 'Enter a valid email address.' };
  if (!['student', 'admin'].includes(u.role)) return { error: 'Role must be student or admin.' };
  if (u.role === 'student' && !u.studentId) return { error: 'Student ID is required for students.' };
  if (u.role === 'admin') u.studentId = null;
  if (creating && u.password.length < 4) return { error: 'Password must be at least 4 characters.' };
  if (!creating && u.password && u.password.length < 4) return { error: 'Password must be at least 4 characters.' };
  return { u };
}

const uniqueMsg = (err) =>
  /UNIQUE/.test(err.message) ? 'That email or student ID is already in use.' : null;

app.post('/api/admin/users', auth, adminOnly, (req, res) => {
  const { u, error } = readUser(req.body, { creating: true });
  if (error) return bad(res, error);
  try {
    const info = db
      .prepare('INSERT INTO users (student_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(u.studentId, u.name, u.email, bcrypt.hashSync(u.password, 10), u.role);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  } catch (err) {
    bad(res, uniqueMsg(err) || 'Could not create user.', uniqueMsg(err) ? 409 : 500);
  }
});

app.put('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const { u, error } = readUser(req.body, { creating: false });
  if (error) return bad(res, error);
  if (Number(req.params.id) === req.user.id && u.role !== 'admin') {
    return bad(res, 'You cannot remove your own admin access.');
  }
  try {
    const info = db
      .prepare('UPDATE users SET student_id = ?, name = ?, email = ?, role = ? WHERE id = ?')
      .run(u.studentId, u.name, u.email, u.role, req.params.id);
    if (!info.changes) return bad(res, 'User not found.', 404);
    if (u.password) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(u.password, 10), req.params.id);
    }
    res.json({ ok: true });
  } catch (err) {
    bad(res, uniqueMsg(err) || 'Could not update user.', uniqueMsg(err) ? 409 : 500);
  }
});

app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  if (Number(req.params.id) === req.user.id) return bad(res, 'You cannot delete your own account.');
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (!info.changes) return bad(res, 'User not found.', 404);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- documents (admin)
const ALLOWED_EXT = ['.pdf', '.txt', '.md'];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_EXT.includes(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Only PDF, TXT or MD files are allowed.'));
  },
});

app.get('/api/admin/documents', auth, adminOnly, (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT id, original_name AS name, size_bytes AS size, substr(uploaded_at,1,10) AS date,
                (text_content IS NOT NULL AND length(text_content) > 0) AS searchable
         FROM documents ORDER BY id DESC`
      )
      .all()
  );
});

app.post('/api/admin/documents', auth, adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return bad(res, 'Choose a file to upload.');
  const ext = path.extname(req.file.originalname).toLowerCase();
  const text = await extractText(req.file.path, ext);
  const info = db
    .prepare('INSERT INTO documents (original_name, stored_name, size_bytes, text_content) VALUES (?, ?, ?, ?)')
    .run(req.file.originalname, req.file.filename, req.file.size, text || null);
  res.status(201).json({ id: Number(info.lastInsertRowid), searchable: Boolean(text) });
});

app.get('/api/admin/documents/:id/download', auth, adminOnly, (req, res) => {
  const d = db.prepare('SELECT original_name, stored_name FROM documents WHERE id = ?').get(req.params.id);
  const file = d && path.join(UPLOAD_DIR, d.stored_name);
  if (!d || !fs.existsSync(file)) return bad(res, 'File not found.', 404);
  res.download(file, d.original_name);
});

app.delete('/api/admin/documents/:id', auth, adminOnly, (req, res) => {
  const d = db.prepare('SELECT stored_name FROM documents WHERE id = ?').get(req.params.id);
  if (!d) return bad(res, 'Document not found.', 404);
  fs.rmSync(path.join(UPLOAD_DIR, d.stored_name), { force: true });
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- chatbot
app.get('/api/chat/history', auth, (req, res) => {
  res.json(
    db
      .prepare('SELECT id, role, text, source FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 50')
      .all(req.user.id)
      .reverse()
  );
});

app.post('/api/chat', auth, (req, res) => {
  const message = clean(req.body?.message);
  if (!message) return bad(res, 'Type a question first.');
  if (message.length > 500) return bad(res, 'Keep your question under 500 characters.');

  const result = askBot(db, message);

  const save = db.prepare('INSERT INTO chat_messages (user_id, role, text, source) VALUES (?, ?, ?, ?)');
  save.run(req.user.id, 'user', message, null);
  save.run(req.user.id, 'bot', result.answer, result.source);

  if (result.escalated) {
    db.prepare('INSERT INTO escalations (user_id, question, confidence, status) VALUES (?, ?, ?, ?)').run(
      req.user.id,
      message,
      result.confidence,
      result.confidence < 0.15 ? 'unresolved' : 'low_confidence'
    );
  }
  res.json({ answer: result.answer, source: result.source, escalated: result.escalated });
});

// ---------------------------------------------------------------- escalations (admin)
app.get('/api/admin/escalations', auth, adminOnly, (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT e.id, e.question, e.confidence, e.status, substr(e.created_at,1,10) AS date, u.name AS studentName
         FROM escalations e LEFT JOIN users u ON u.id = e.user_id
         ORDER BY (e.status = 'resolved'), e.created_at DESC, e.id DESC`
      )
      .all()
  );
});

// Admin answer likhta hai -> FAQ ban jata hai -> chatbot ab khud jawab dega
app.post('/api/admin/escalations/:id/answer', auth, adminOnly, (req, res) => {
  const answer = clean(req.body?.answer);
  if (answer.length < 5) return bad(res, 'Write the answer the assistant should give.');
  const esc = db.prepare('SELECT * FROM escalations WHERE id = ?').get(req.params.id);
  if (!esc) return bad(res, 'Escalation not found.', 404);

  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO faqs (keywords, question, answer, source) VALUES (?, ?, ?, ?)').run(
      [...new Set(tokenize(esc.question))].join(' '),
      esc.question,
      answer,
      'Helpdesk Team · Amity.edu'
    );
    db.prepare("UPDATE escalations SET status = 'resolved' WHERE id = ?").run(esc.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return bad(res, 'Could not save the answer.', 500);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/escalations/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM escalations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- serve built frontend (production)
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// ---------------------------------------------------------------- errors
app.use('/api', (_req, res) => bad(res, 'Route not found.', 404));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return bad(res, err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB.' : err.message);
  }
  console.error(err);
  bad(res, err.message || 'Server error.', 500);
});

app.listen(PORT, () => console.log(`Amity Helpdesk API running on http://localhost:${PORT}`));
