import Logo from './Logo.jsx';

// "**bold**" ko <strong> me badalta hai (chatbot ke answers me use hota hai)
export function RichText({ text }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

export function Header({ user, onLogout, subtitle, admin }) {
  return (
    <header className={`topbar ${admin ? 'topbar-admin' : ''}`}>
      <div className="brand">
        <Logo size={34} />
        <div>
          <div className="brand-name">Amity University</div>
          <div className="brand-sub">{subtitle}</div>
        </div>
      </div>
      <div className="userbox">
        <div className="usertext">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <div className={`avatar ${admin ? 'avatar-gold' : ''}`}>{user.name[0]}</div>
        <button className="btn-ghost" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <nav className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? 'tab active' : 'tab'}
          onClick={() => onChange(t.id)}
        >
          <span aria-hidden="true">{t.icon}</span> {t.label}
        </button>
      ))}
    </nav>
  );
}

export const Chip = ({ children, kind }) => (
  <span className={`chip chip-${(kind || String(children)).toLowerCase()}`}>{children}</span>
);

export const StatusPill = ({ status }) => (
  <span className={`pill pill-${status}`}>{status === 'open' ? 'Open' : 'Resolved'}</span>
);

export const Flash = ({ flash }) =>
  flash ? <div className={`flash flash-${flash.type}`} role="status">{flash.text}</div> : null;

export const Empty = ({ children }) => <p className="empty">{children}</p>;

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
