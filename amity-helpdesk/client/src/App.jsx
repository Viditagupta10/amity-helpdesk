import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import StudentApp from './pages/StudentApp.jsx';
import AdminApp from './pages/AdminApp.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); // landing | login
  const [booting, setBooting] = useState(Boolean(getToken()));

  // Page refresh par token se user wapas pehchante hain
  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, []);

  // Token expire ho jaye to login par bhej do
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setView('login');
    };
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    setView('landing');
  };

  if (booting) return <div className="boot">Loading…</div>;
  if (user) {
    return user.role === 'admin' ? (
      <AdminApp user={user} onLogout={logout} />
    ) : (
      <StudentApp user={user} onLogout={logout} />
    );
  }
  if (view === 'login') return <Login onBack={() => setView('landing')} onLogin={setUser} />;
  return <Landing onEnter={() => setView('login')} />;
}
