# Amity Campus Helpdesk (full-stack)

React (Vite) + Node/Express + SQLite. Student aur Admin dono panels, AI chatbot, tickets, notices, user management, file upload, escalation.

## 1. Chalane ka tarika

Node.js 18+ chahiye (`node -v` se check karo). Do terminals kholo.

**One command (recommended):** Agar terminal `amity-helpdesk` folder ke andar hai (jahan `client` aur `server` folders hain), ek level bahar jaakar `npm run dev` chalao. Ye frontend aur backend dono start karega; browser me `http://localhost:5173` kholo.

**Terminal 1 (backend)**
```bash
cd server
npm install
npm start          # http://localhost:4000
```

**Terminal 2 (frontend)**
```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

Browser me `http://localhost:5173` kholo.

| Role    | Email              | Password   |
|---------|--------------------|------------|
| Student | vidhi@amity.edu    | 1234       |
| Admin   | admin@amity.edu    | admin123   |
| Student | keshav@amity.edu   | 1234       |

Database apne aap ban jata hai (`server/data/helpdesk.db`) aur demo data bhar jata hai. Fresh start ke liye `npm run reset-db` (server folder me).

**Official logo:** `client/public/amity-logo.png` naam se rakh do (details `PUT-LOGO-HERE.txt` me).

**Ek hi server par deploy:** `cd client && npm run build`, phir `cd ../server && npm start`. Backend `client/dist` ko khud serve karta hai (port 4000). Deploy se pehle `JWT_SECRET` environment variable zaroor set karo.

## 2. Folder map

```
server/
  schema.sql    -> saari SQL tables (yahi "SQL database" wali cheez hai)
  seed.js       -> demo users / tickets / notices / FAQs
  db.js         -> database connection + schema + seed run karta hai
  chatbot.js    -> AI assistant ka search logic
  extract.js    -> uploaded PDF/TXT se text nikalta hai
  index.js      -> saare API routes (login, tickets, notices, users, docs, chat...)
client/src/
  api.js        -> backend ko call karne ka ek hi function (token ke saath)
  App.jsx       -> kaun sa page dikhana hai (landing / login / student / admin)
  pages/        -> Landing, Login, StudentApp, AdminApp
  components/   -> Logo, Header, Tabs, chips (shared UI)
  styles.css    -> poora design
```

## 3. Ek request ka safar (samajhne ke liye)

**Login:**
1. Login form `POST /api/auth/login` bhejta hai (email + password).
2. `index.js` DB se user nikalta hai, `bcrypt.compareSync` se password match karta hai.
3. Sahi hone par server ek **JWT token** banata hai (8 ghante valid) aur wapas bhejta hai.
4. Frontend token `localStorage` me rakhta hai. Ab har request ke header me `Authorization: Bearer <token>` jata hai (`api.js`).
5. Server ka `auth` middleware har protected route par token check karta hai. `adminOnly` middleware check karta hai ki role `admin` hai. Student koi admin route khol hi nahi sakta (403).

**Chat:** `POST /api/chat` -> `askBot()` chalta hai -> answer + source wapas -> dono messages `chat_messages` table me save (isliye refresh ke baad history dikhti hai).

**File upload:** Admin file chunta hai -> `FormData` ke through `POST /api/admin/documents` -> `multer` file ko `server/uploads/` me save karta hai -> `extract.js` text nikalta hai -> metadata + text `documents` table me. Ab chatbot is text me bhi search karta hai.

## 4. Database (SQL) tables

| Table | Kya store karta hai |
|---|---|
| `users` | student + admin (`role` column), password sirf **hash** me |
| `tickets` | complaints. `is_private=1` wale sirf admin ke Private tab me |
| `notices` | notice board |
| `documents` | upload hui files ka naam, size, nikala hua text |
| `faqs` | chatbot ki knowledge base (keywords + answer + source) |
| `escalations` | jo sawal chatbot ko nahi aaye |
| `chat_messages` | chat history |

Relations: `tickets.user_id -> users.id` (foreign key). User delete karne par uske tickets aur chat apne aap delete (`ON DELETE CASCADE`). Escalation me user delete hone par sawal bacha rehta hai (`SET NULL`). `CHECK` constraints galat role/status ko DB level par hi rok dete hain.

Useful SQL (viva me bol sakti ho):
```sql
-- har student ke kitne tickets
SELECT u.name, COUNT(t.id) FROM users u LEFT JOIN tickets t ON t.user_id = u.id GROUP BY u.id;
-- sirf public open tickets
SELECT * FROM tickets WHERE status='open' AND is_private=0;
```

## 5. Chatbot kaise sochta hai

Koi paid AI API nahi lagti. Ye **knowledge-base search** hai:
1. Sawal se faltu words (is, the, what...) hata kar important words (tokens) bachte hain: "What is the hostel curfew?" -> `hostel, curfew`.
2. Teen jagah match karta hai: FAQs, Notices, aur uploaded documents ke tukde.
3. `confidence = sawal ke kitne words mile / sawal ke total words`.
4. `confidence >= 0.4` -> answer + source chip. Warna -> "escalation" table me sawal save, student ko bola jata hai ki ticket raise kare.
5. **Loop band hota hai:** Admin ke Escalate tab me "Write answer" dabao -> answer FAQ ban jata hai -> agli baar chatbot khud jawab dega. Ya fir MCA syllabus ki PDF upload kar do.

Limitation (honestly): ye keyword matching hai, meaning nahi samajhta ("hostel timing" aur "hostel curfew" tab milenge jab FAQ keywords me dono ho). Next step: Claude/OpenAI API ya embeddings lagana. `askBot()` ek hi function hai, usse replace karna aasaan hai.

## 6. Security jo laga hai
- Passwords bcrypt hash; JWT auth; role-based access (admin routes server par block).
- SQL injection se bachav: saari queries `?` placeholders ke saath (prepared statements).
- File upload: sirf PDF/TXT/MD, max 10 MB, random file name.
- Private tickets student ke alawa sirf admin ko dikhte hain.

## 7. Aage badhane ke ideas
Email notification on ticket resolve, ticket par admin reply/comments, password change, pagination, MySQL/PostgreSQL migration (SQL standard hai, `schema.sql` thoda badal kar chal jayegi), LLM-based chatbot.
