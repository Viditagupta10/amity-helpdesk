import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Chip, Empty, Flash, Header, RichText, StatusPill, Tabs } from '../components/ui.jsx';

const TABS = [
  { id: 'chat', icon: '💬', label: 'AI Chat' },
  { id: 'notices', icon: '📋', label: 'Notices' },
  { id: 'raise', icon: '🎫', label: 'Raise Ticket' },
  { id: 'tickets', icon: '📁', label: 'My Tickets' },
];
const CATEGORIES = ['General', 'Fees', 'Exam', 'Hostel', 'Library', 'Placement', 'IT'];

export default function StudentApp({ user, onLogout }) {
  const [tab, setTab] = useState('chat');
  const [tickets, setTickets] = useState([]);

  const loadTickets = useCallback(() => api.get('/tickets/mine').then(setTickets).catch(() => {}), []);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  return (
    <>
      <Header user={user} onLogout={onLogout} subtitle="Campus Helpdesk" />
      <main className="wrap">
        <section className="welcome">
          <div>
            <h2>Welcome back, {user.name}!</h2>
            <p>ID: {user.studentId} · {user.email}</p>
          </div>
          <div className="count">My Tickets<b>{tickets.length}</b></div>
        </section>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        {tab === 'chat' && <Chat user={user} />}
        {tab === 'notices' && <Notices />}
        {tab === 'raise' && <RaiseTicket user={user} onCreated={() => { loadTickets(); setTab('tickets'); }} />}
        {tab === 'tickets' && <MyTickets tickets={tickets} />}
      </main>
    </>
  );
}

function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    api.get('/chat/history').then(setMessages).catch(() => {});
  }, []);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, busy]);

  async function send(e) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    setMessages((m) => [...m, { id: 'u' + Date.now(), role: 'user', text: q }]);
    setBusy(true);
    try {
      const r = await api.post('/chat', { message: q });
      setMessages((m) => [...m, { id: 'b' + Date.now(), role: 'bot', text: r.answer, source: r.source }]);
    } catch (err) {
      setMessages((m) => [...m, { id: 'e' + Date.now(), role: 'bot', text: err.message }]);
    } finally {
      setBusy(false);
    }
  }

  const greeting = `Hello ${user.name}! I'm your Campus AI Assistant. Ask about fees, exams, hostel, library, and more.`;
  return (
    <div className="card chat">
      <div className="chat-head">
        <div className="avatar">AI</div>
        <div><strong>Campus AI Assistant</strong><small>Amity Helpdesk Knowledge Base</small></div>
        <span className="online">Online</span>
      </div>
      <div className="chat-body" ref={bodyRef} aria-live="polite">
        <Bubble role="bot" text={greeting} />
        {messages.map((m) => <Bubble key={m.id} role={m.role} text={m.text} source={m.source} initial={user.name[0]} />)}
        {busy && <div className="typing">Assistant is typing…</div>}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about fees, exams, hostel…" maxLength={500} aria-label="Your question" />
        <button className="btn" disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

function Bubble({ role, text, source, initial }) {
  return (
    <div className={`msg ${role}`}>
      <div className="avatar">{role === 'bot' ? 'AI' : initial}</div>
      <div>
        <div className="bubble"><RichText text={text} /></div>
        {source && <span className="src">📌 {source}</span>}
      </div>
    </div>
  );
}

function Notices() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/notices').then(setItems).catch(() => setItems([])); }, []);
  if (!items) return <Empty>Loading notices…</Empty>;
  return (
    <>
      <h3 className="title">Latest Notices</h3>
      {items.length === 0 ? <Empty>No notices yet. New announcements will appear here.</Empty> : (
        <div className="grid2">
          {items.map((n) => (
            <article key={n.id} className={`notice n-${n.category.toLowerCase()}`}>
              <Chip>{n.category}</Chip>
              <h4>{n.title}</h4>
              <time>{n.date}</time>
              <p>{n.description}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function RaiseTicket({ user, onCreated }) {
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setFlash(null);
    setBusy(true);
    try {
      await api.post('/tickets', { category, description, isPrivate });
      onCreated();
    } catch (err) {
      setFlash({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3 className="title">Raise a Support Ticket</h3>
      <p className="sub">ID: {user.studentId} · {user.email}</p>
      <Flash flash={flash} />
      <label htmlFor="cat">CATEGORY</label>
      <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      <label htmlFor="desc">DESCRIBE YOUR ISSUE</label>
      <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your issue in detail…" required />
      <label className="private-box" style={{ letterSpacing: 0 }}>
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        Mark as Private — only admin can view
      </label>
      <button className="btn btn-block" disabled={busy}>{busy ? 'Submitting…' : 'Submit Ticket'}</button>
    </form>
  );
}

function MyTickets({ tickets }) {
  return (
    <>
      <h3 className="title">My Tickets</h3>
      {tickets.length === 0 ? <Empty>You have not raised any tickets yet. Use Raise Ticket when the assistant cannot help.</Empty> :
        tickets.map((t) => (
          <div key={t.id} className={`ticket ${t.status === 'resolved' ? 'is-resolved' : ''}`}>
            <div>
              <div className="chips">
                <Chip>{t.category}</Chip>
                {t.isPrivate ? <Chip kind="private">Private</Chip> : null}
              </div>
              <h4>{t.title}</h4>
              <small>Submitted: {t.date}</small>
            </div>
            <StatusPill status={t.status} />
          </div>
        ))}
    </>
  );
}
