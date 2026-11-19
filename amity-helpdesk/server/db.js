// SQLite database connection. File: server/data/helpdesk.db
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedIfEmpty } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'helpdesk.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON'); // SQLite me foreign keys default OFF hoti hain

db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
seedIfEmpty(db);

export default db;
