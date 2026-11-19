// Pehli baar server chalne par demo data daalta hai (sirf jab users table khali ho).
import bcrypt from 'bcryptjs';

export function seedIfEmpty(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return;

  const hash = (p) => bcrypt.hashSync(p, 10);

  const addUser = db.prepare(
    'INSERT INTO users (student_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  );
  addUser.run('A2305', 'Vidhi Gupta', 'vidhi@amity.edu', hash('1234'), 'student');
  addUser.run('A2306', 'Keshav Sharma', 'keshav@amity.edu', hash('1234'), 'student');
  addUser.run(null, 'Admin', 'admin@amity.edu', hash('admin123'), 'admin');

  const addTicket = db.prepare(
    `INSERT INTO tickets (user_id, category, title, description, is_private, status, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  addTicket.run(1, 'Fees', 'Fee receipt not generated',
    'I paid the semester fee online but the receipt is not generated.', 0, 'open', '2026-06-12 10:00:00', null);
  addTicket.run(1, 'Hostel', 'Hostel room maintenance issue',
    'The fan and light in my hostel room are not working.', 1, 'open', '2026-06-11 18:30:00', null);
  addTicket.run(2, 'General', 'Library card not issued',
    'My library card has not been issued yet.', 0, 'resolved', '2026-06-10 09:15:00', '2026-06-11 12:00:00');

  const addNotice = db.prepare(
    'INSERT INTO notices (title, category, notice_date, description) VALUES (?, ?, ?, ?)'
  );
  addNotice.run('Fee Submission Deadline', 'Fees', '2026-06-15',
    'Last date to submit semester fees is 15th June 2026. Late fine applicable after due date.');
  addNotice.run('End Semester Exam Timetable', 'Exam', '2026-06-10',
    'End semester examination timetable has been released. Check the Examination Portal.');
  addNotice.run('Hostel Curfew Reminder', 'Hostel', '2026-06-08',
    'All hostel students must return by 10:00 PM. Strict action against violators.');
  addNotice.run('Placement Orientation Session', 'Placement', '2026-06-13',
    'Orientation for final-year students. Attendance recommended.');

  const addFaq = db.prepare('INSERT INTO faqs (keywords, question, answer, source) VALUES (?, ?, ?, ?)');
  addFaq.run('hostel curfew room maintenance warden',
    'What is the hostel curfew?',
    'Hostel curfew is **10:00 PM** daily. For room maintenance, raise a helpdesk ticket - response within 48 hrs.',
    'Hostel Administration Notice · Amity.edu');
  addFaq.run('exam examination timetable datesheet schedule result',
    'Where is the exam timetable?',
    'The **End Semester Examination timetable** has been released. Check the Examination Portal under your department.',
    'Examination Cell Circular · Amity.edu');
  addFaq.run('fee fees payment receipt deadline late fine',
    'How do I pay fees?',
    'Semester fees can be paid online. The last date is **15th June 2026**; a late fine applies after that. If your receipt is not generated, raise a Fees ticket.',
    'Accounts Office Notice · Amity.edu');
  addFaq.run('library book card issue return',
    'How do I get a library card?',
    'Library cards are issued by the central library on request. If yours is delayed, raise a General ticket with your student ID.',
    'Central Library · Amity.edu');
  addFaq.run('placement orientation internship job campus recruitment',
    'Tell me about placements',
    'A **Placement Orientation Session** is scheduled for final-year students. Attendance is recommended. Watch the Notices tab for company visit updates.',
    'Training & Placement Cell · Amity.edu');
}
