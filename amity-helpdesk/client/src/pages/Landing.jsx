import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Logo from '../components/Logo.jsx';

const FACTS = [
  ['30,000+', 'Students'],
  ['175+', 'Programmes'],
  ['22+', 'Campuses'],
  ['NAAC A+', 'Accreditation'],
];

export default function Landing({ onEnter }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/public/stats').then(setStats).catch(() => {});
  }, []);

  return (
    <div className="landing">
      <section className="hero">
        {stats && (
          <>
            <div className="float-card fc-left">
              <small>Tickets resolved</small>
              <b>{stats.resolved}</b>
            </div>
            <div className="float-card fc-right">
              <small>AI responses this month</small>
              <b>{stats.aiResponses}<em>queries</em></b>
            </div>
          </>
        )}
        <div className="hero-inner">
          <div className="logo-wrap"><Logo size={84} /></div>
          <span className="badge">NAAC A+ ACCREDITED UNIVERSITY</span>
          <h1>Amity University</h1>
          <p className="tag">Where knowledge ignites ambition — shaping leaders across 22+ campuses since 2003.</p>
          <div className="rule" />
          <button className="cta" onClick={onEnter}>Access Campus Helpdesk →</button>
          <p className="hint">Sign in with your university credentials</p>
          <div className="stats">
            {FACTS.map(([n, l]) => (
              <div key={l}><b>{n}</b><span>{l}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <h2>About Amity University</h2>
        <p>
          Amity University is a multidisciplinary private university founded in 2003. Its programmes span engineering
          and technology, management, law, science, humanities, design and more, taught across a network of campuses
          and attended by tens of thousands of students.
        </p>
        <p>
          The campus helpdesk gives every student one place to get answers about fees, exams, hostel life, the library
          and placements, and to reach the administration when an answer is not enough.
        </p>
      </section>

      <section className="section">
        <h2>What you can do here</h2>
        <div className="how">
          <div>
            <h3>Ask the Campus AI Assistant</h3>
            <p>Get instant answers from official notices and university documents, with the source shown.</p>
          </div>
          <div>
            <h3>Read the latest notices</h3>
            <p>Fee deadlines, exam timetables, hostel reminders and placement sessions in one list.</p>
          </div>
          <div>
            <h3>Raise and track tickets</h3>
            <p>Report a problem, mark it private if it is sensitive, and follow its status until it is resolved.</p>
          </div>
        </div>
      </section>

      <footer className="footer">© Amity University Campus Helpdesk. Student project demo.</footer>
    </div>
  );
}
