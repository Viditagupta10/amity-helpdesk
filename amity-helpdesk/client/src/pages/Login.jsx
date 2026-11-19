import { useState } from 'react';
import { api, setToken } from '../api.js';
import Logo from '../components/Logo.jsx';

const DEMO = [
  ['Student', 'vidhi@amity.edu', '1234'],
  ['Admin', 'admin@amity.edu', 'admin123'],
];

export default function Login({ onBack, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      setToken(data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <button type="button" className="link-back" onClick={onBack}>← Back</button>
        <div className="login-head">
          <Logo size={52} />
          <h2>Welcome Back</h2>
          <p>Sign in to Amity Campus Helpdesk</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="email">EMAIL</label>
          <div className="input-wrap">
            <input id="email" type="email" autoComplete="username" placeholder="yourname@amity.edu"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">PASSWORD</label>
          <div className="input-wrap">
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password"
              placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="show-btn" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>

        <div className="demo">
          <h4>DEMO CREDENTIALS (tap to fill)</h4>
          {DEMO.map(([role, e, p]) => (
            <button type="button" key={role} onClick={() => { setEmail(e); setPassword(p); }}>
              <span>{role}</span><strong>{e} / {p}</strong>
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
