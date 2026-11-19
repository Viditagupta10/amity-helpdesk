// "npm run reset-db" : database + uploads delete karke fresh demo data banata hai.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.rmSync(path.join(__dirname, 'data'), { recursive: true, force: true });
fs.rmSync(path.join(__dirname, 'uploads'), { recursive: true, force: true });
console.log('Database and uploads cleared. Run "npm start" to create fresh demo data.');
