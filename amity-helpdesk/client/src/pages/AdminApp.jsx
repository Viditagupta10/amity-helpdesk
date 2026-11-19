import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Chip, Empty, Flash, Header, StatusPill, Tabs, formatSize } from '../components/ui.jsx';

const TABS = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'tickets', icon: '🎫', label: 'Tickets' },
  { id: 'notices', icon: '📋', label: 'Notices' },
  { id: 'users', icon: '👥', label: 'Users' },
  { id: 'docs', icon: '📄', label: 'Docs' },
  { id: 'escalate', icon: '⚠️', label: 'Escalate' },
  { id: 'private', icon: '🔒', label: 'Private' },
];

// Har panel ek hi pattern follow karta hai: load -> dikhao -> action -> reload
function useLoad(path) {
  const [data, setData] = useState(null);
  const reload = useCallback(() => api.get(path).then(setData).catch(() => setData([])), [path]);
  useEffect(() => { reload(); }, [reload]);
  return [data, reload];
}

export default function AdminApp({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  return (
    <>
      <Header user={user} onLogout={onLogout} subtitle="Administrator Panel" admin />
      <main className="wrap wrap-wide">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'tickets' && <Tickets />}
        {tab === 'notices' && <Notices />}
        {tab === 'users' && <Users me={user} />}
        {tab === 'docs' && <Docs />}
        {tab === 'escalate' && <Escalations />}
        {tab === 'private' && <PrivateTickets />}
      </main>
    </>
  );
}

function Dashboard() {
  const [s] = useLoad('/admin/stats');
  if (!s) return <Empty>Loading…</Empty>;
  return (
    <>
      <h3 className="title">Dashboard</h3>
      <div className="stat-grid">
        <div className="stat"><b>{s.students}</b><span>Students</span></div>
        <div className="stat red"><b>{s.openTickets}</b><span>Open Tickets</span></div>
        <div className="stat green"><b>{s.resolvedTickets}</b><span>Resolved</span></div>
        <div className="stat gold"><b>{s.notices}</b><span>Notices</span></div>
      </div>
      <h3 className="title">Recent Tickets</h3>
      {s.recent.length === 0 ? <Empty>No tickets yet.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Issue</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {s.recent.map((t) => (
                <tr key={t.id}><td><strong>{t.studentName}</strong></td><td>{t.title}</td><td className="muted">{t.date}</td><td><StatusPill status={t.status} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Tickets() {
  const [rows, reload] = useLoad('/admin/tickets');
  const [flash, setFlash] = useState(null);
  async function setStatus(t, status) {
    try { await api.patch(`/admin/tickets/${t.id}/status`, { status }); reload(); }
    catch (err) { setFlash({ type: 'err', text: err.message }); }
  }
  if (!rows) return <Empty>Loading…</Empty>;
  const open = rows.filter((t) => t.status === 'open').length;
  return (
    <>
      <h3 className="title">Student Tickets</h3>
      <Flash flash={flash} />
      <div className="stat-grid" style={{ maxWidth: 420 }}>
        <div className="stat"><b>{rows.length}</b><span>Total</span></div>
        <div className="stat red"><b>{open}</b><span>Open</span></div>
        <div className="stat green"><b>{rows.length - open}</b><span>Resolved</span></div>
      </div>
      {rows.length === 0 ? <Empty>No public tickets. Private tickets are listed under Private.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Student</th><th>Category</th><th>Issue</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><strong style={{ color: 'var(--navy)' }}>{t.studentId}</strong></td>
                  <td>{t.studentName}</td>
                  <td><Chip>{t.category}</Chip></td>
                  <td title={t.description}>{t.title}</td>
                  <td className="muted">{t.date}</td>
                  <td><StatusPill status={t.status} /></td>
                  <td>
                    {t.status === 'open'
                      ? <button className="btn-sm btn-green" onClick={() => setStatus(t, 'resolved')}>Resolve</button>
                      : <button className="btn-sm btn-amber" onClick={() => setStatus(t, 'open')}>Reopen</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const NOTICE_CATS = ['General', 'Fees', 'Exam', 'Hostel', 'Placement'];
const today = () => new Date().toISOString().slice(0, 10);

function Notices() {
  const [items, reload] = useLoad('/notices');
  const empty = { title: '', category: 'General', date: today(), description: '' };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [flash, setFlash] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      if (editId) await api.put(`/notices/${editId}`, form); else await api.post('/notices', form);
      setFlash({ type: 'ok', text: editId ? 'Notice saved.' : 'Notice created.' });
      setForm(empty); setEditId(null); reload();
    } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }
  async function remove(n) {
    if (!window.confirm(`Delete "${n.title}"?`)) return;
    try { await api.del(`/notices/${n.id}`); reload(); } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }
  function edit(n) {
    setEditId(n.id);
    setForm({ title: n.title, category: n.category, date: n.date, description: n.description });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <div className="banner-navy"><h3>Notice Management</h3><p>Create, update, and delete campus notices.</p></div>
      <form className="card form" onSubmit={submit}>
        <h3 className="title">{editId ? 'Edit Notice' : 'Create Notice'}</h3>
        <Flash flash={flash} />
        <div className="form-row">
          <input type="text" placeholder="Title" value={form.title} onChange={set('title')} aria-label="Title" required />
          <select value={form.category} onChange={set('category')} aria-label="Category">{NOTICE_CATS.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="row-gap"><input type="date" value={form.date} onChange={set('date')} aria-label="Date" required /></div>
        <div className="row-gap"><textarea placeholder="Description" value={form.description} onChange={set('description')} aria-label="Description" required /></div>
        <div className="actions row-gap">
          <button className="btn">{editId ? 'Save changes' : 'Create notice'}</button>
          {editId && <button type="button" className="btn btn-outline" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</button>}
        </div>
      </form>
      <h3 className="title" style={{ marginTop: 22 }}>All Notices</h3>
      {!items ? <Empty>Loading…</Empty> : items.length === 0 ? <Empty>No notices yet. Create the first one above.</Empty> : (
        <div className="grid2">
          {items.map((n) => (
            <article key={n.id} className={`notice n-${n.category.toLowerCase()}`}>
              <Chip>{n.category}</Chip><h4>{n.title}</h4><time>{n.date}</time><p>{n.description}</p>
              <div className="row">
                <button className="btn-sm btn-blue" onClick={() => edit(n)}>Edit</button>
                <button className="btn-sm btn-red" onClick={() => remove(n)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Users({ me }) {
  const [users, reload] = useLoad('/admin/users');
  const empty = { name: '', email: '', studentId: '', password: '', role: 'student' };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [flash, setFlash] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      if (editId) await api.put(`/admin/users/${editId}`, form); else await api.post('/admin/users', form);
      setFlash({ type: 'ok', text: editId ? 'User saved.' : 'User created.' });
      setForm(empty); setEditId(null); reload();
    } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }
  async function remove(u) {
    if (!window.confirm(`Delete ${u.name}? Their tickets and chat history will be deleted too.`)) return;
    try { await api.del(`/admin/users/${u.id}`); reload(); } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }

  return (
    <>
      <h3 className="title">Manage Users</h3>
      <form className="card form" onSubmit={submit}>
        <h3 className="title">{editId ? 'Edit User' : 'Create User'}</h3>
        <Flash flash={flash} />
        <div className="form-row">
          <input type="text" placeholder="Full Name" value={form.name} onChange={set('name')} aria-label="Full name" required />
          <input type="email" placeholder="Email" value={form.email} onChange={set('email')} aria-label="Email" required />
        </div>
        <div className="form-row row-gap">
          <input type="text" placeholder="Student ID" value={form.studentId} onChange={set('studentId')} aria-label="Student ID" disabled={form.role === 'admin'} />
          <input type="password" placeholder={editId ? 'New password (leave blank to keep)' : 'Password'} value={form.password} onChange={set('password')} aria-label="Password" autoComplete="new-password" />
        </div>
        <div className="row-gap">
          <select value={form.role} onChange={set('role')} aria-label="Role"><option value="student">Student</option><option value="admin">Admin</option></select>
        </div>
        <div className="actions row-gap">
          <button className="btn">{editId ? 'Save changes' : 'Create user'}</button>
          {editId && <button type="button" className="btn btn-outline" onClick={() => { setEditId(null); setForm(empty); }}>Cancel</button>}
        </div>
      </form>
      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead><tr><th></th><th>Name</th><th>Email</th><th>Student ID</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td><div className={`table-avatar ${u.role}`}>{u.name[0]}</div></td>
                <td><strong>{u.name}</strong></td>
                <td className="muted">{u.email}</td>
                <td>{u.studentId || '–'}</td>
                <td><span className={`role-tag ${u.role}`}>{u.role}</span></td>
                <td>
                  <div className="actions">
                    <button className="btn-sm btn-blue" onClick={() => { setEditId(u.id); setForm({ name: u.name, email: u.email, studentId: u.studentId || '', password: '', role: u.role }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                    {u.id !== me.id && <button className="btn-sm btn-red" onClick={() => remove(u)}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Docs() {
  const [docs, reload] = useLoad('/admin/documents');
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setBusy(true); setFlash(null);
    try {
      const r = await api.upload('/admin/documents', form);
      setFlash({ type: 'ok', text: r.searchable ? `${file.name} uploaded. The assistant can now answer from it.` : `${file.name} uploaded, but no readable text was found (scanned PDF?), so the assistant cannot search it.` });
      reload();
    } catch (err) { setFlash({ type: 'err', text: err.message }); }
    finally { setBusy(false); }
  }
  async function remove(d) {
    if (!window.confirm(`Delete ${d.name}?`)) return;
    try { await api.del(`/admin/documents/${d.id}`); reload(); } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }
  async function download(d) {
    try { await api.download(`/admin/documents/${d.id}/download`, d.name); } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }

  return (
    <>
      <div className="panel-head">
        <h3>Manage Documents</h3>
        <button className="btn" onClick={() => input.current.click()} disabled={busy}>{busy ? 'Uploading…' : '+ Upload'}</button>
        <input ref={input} type="file" accept=".pdf,.txt,.md" hidden onChange={upload} />
      </div>
      <Flash flash={flash} />
      {!docs ? <Empty>Loading…</Empty> : docs.length === 0 ? <Empty>No documents yet. Upload a PDF or text file (syllabus, fee structure, hostel rules) and the assistant will use it to answer questions.</Empty> : (
        <div className="docs">
          {docs.map((d) => (
            <div key={d.id} className="doc">
              <div className="doc-icon">{d.name.split('.').pop().toUpperCase().slice(0, 4)}</div>
              <div className="doc-info">
                <strong title={d.name}>{d.name}</strong>
                <small>{d.date} · {formatSize(d.size)}</small>
                <small className={d.searchable ? 'ok' : ''}>{d.searchable ? 'Searchable by assistant' : 'Stored only'}</small>
              </div>
              <div className="actions">
                <button className="btn-sm btn-blue" onClick={() => download(d)}>Download</button>
                <button className="btn-sm btn-red" onClick={() => remove(d)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const ESC_LABEL = { low_confidence: 'Low Confidence', unresolved: 'Unresolved', resolved: 'Resolved' };
const ESC_TAG = { low_confidence: 'tag-low', unresolved: 'tag-unresolved', resolved: 'tag-resolved' };

function Escalations() {
  const [rows, reload] = useLoad('/admin/escalations');
  const [open, setOpen] = useState(null);
  const [answer, setAnswer] = useState('');
  const [flash, setFlash] = useState(null);

  async function save(r) {
    try {
      await api.post(`/admin/escalations/${r.id}/answer`, { answer });
      setFlash({ type: 'ok', text: 'Saved. The assistant will now answer this question on its own.' });
      setOpen(null); setAnswer(''); reload();
    } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }
  async function dismiss(r) {
    try { await api.del(`/admin/escalations/${r.id}`); reload(); } catch (err) { setFlash({ type: 'err', text: err.message }); }
  }

  return (
    <>
      <h3 className="title">Escalation Logs</h3>
      <p className="sub">Questions the assistant could not answer. Write an answer to teach it.</p>
      <Flash flash={flash} />
      {!rows ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>Nothing to review. Unanswered student questions will appear here.</Empty> :
        rows.map((r) => (
          <div key={r.id} className={`esc ${r.status === 'unresolved' ? 'unresolved' : r.status}`}>
            <div className="top"><span className={`tagpill ${ESC_TAG[r.status]}`}>{ESC_LABEL[r.status]}</span><time>{r.date}</time></div>
            <q>{r.question}</q>
            <small>Confidence: <span className="conf">{r.confidence}</span>{r.studentName ? ` · asked by ${r.studentName}` : ''}</small>
            {open === r.id ? (
              <>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type the answer the assistant should give…" aria-label="Answer" />
                <div className="actions">
                  <button className="btn-sm btn-green" onClick={() => save(r)}>Save answer</button>
                  <button className="btn-sm btn-outline" onClick={() => setOpen(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="actions">
                {r.status !== 'resolved' && <button className="btn-sm btn-blue" onClick={() => { setOpen(r.id); setAnswer(''); }}>Write answer</button>}
                <button className="btn-sm btn-red" onClick={() => dismiss(r)}>Dismiss</button>
              </div>
            )}
          </div>
        ))}
    </>
  );
}

function PrivateTickets() {
  const [rows, reload] = useLoad('/admin/tickets/private');
  async function setStatus(t, status) { await api.patch(`/admin/tickets/${t.id}/status`, { status }).catch(() => {}); reload(); }
  return (
    <>
      <div className="banner-red">🔒 Confidential. Only administrators can view these tickets.</div>
      <h3 className="title">Private Tickets</h3>
      {!rows ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>No private tickets.</Empty> : (
        <div className="table-wrap table-private">
          <table>
            <thead><tr><th>Student ID</th><th>Student</th><th>Category</th><th>Issue</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><strong style={{ color: 'var(--navy)' }}>{t.studentId}</strong></td>
                  <td>{t.studentName}</td>
                  <td><Chip>{t.category}</Chip></td>
                  <td title={t.description}>{t.title}</td>
                  <td className="muted">{t.date}</td>
                  <td><StatusPill status={t.status} /></td>
                  <td>{t.status === 'open'
                    ? <button className="btn-sm btn-green" onClick={() => setStatus(t, 'resolved')}>Resolve</button>
                    : <button className="btn-sm btn-amber" onClick={() => setStatus(t, 'open')}>Reopen</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
