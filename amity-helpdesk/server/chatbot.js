// =====================================================================
//  Campus AI Assistant : knowledge-base search (no external AI API needed)
//
//  Kaam kaise karta hai:
//   1. Question ko tokens (important words) me todte hain: "What is hostel curfew?" -> [hostel, curfew]
//   2. FAQs + Notices + uploaded Documents se tokens match karte hain
//   3. confidence = (question ke kitne words mile) / (question ke total words)
//   4. confidence >= 0.4  -> answer + source chip
//      confidence <  0.4  -> "escalation" table me save, admin ko dikhega
// =====================================================================

export const CONFIDENCE_THRESHOLD = 0.4;

const STOP = new Set(
  ('a an the is are was were be been am i me my we our you your it its of to in on at for from by with about ' +
   'and or but if then so do does did can could should would will shall may might please tell give show ' +
   'what when where which who whom how why any some there here this that these those into as not no yes ' +
   'hi hello hey kindly want need know').split(' ')
);

function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

function score(queryTokens, candidateText) {
  const cand = new Set(tokenize(candidateText));
  let matched = 0;
  for (const t of queryTokens) if (cand.has(t)) matched++;
  return { matched, confidence: queryTokens.size ? matched / queryTokens.size : 0 };
}

// Lambe document ko ~500 character ke tukdon (chunks) me todte hain.
// Chhote paragraphs (jaise heading) ko aage wale paragraph ke saath jod dete hain.
function chunkText(text) {
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if (cur && (cur + ' ' + p).length > 500) {
      chunks.push(cur);
      cur = '';
    }
    cur = cur ? cur + ' ' + p : p;
    while (cur.length > 700) {
      chunks.push(cur.slice(0, 600));
      cur = cur.slice(600);
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

const SMALL_TALK = [
  { re: /^(hi|hello|hey|hii+|namaste|good (morning|afternoon|evening))\b/i,
    reply: 'Hello! I can help with fees, exams, hostel, library, placements and more. What would you like to know?' },
  { re: /^(thanks|thank you|thx|ok thanks|okay thanks)\b/i,
    reply: 'You are welcome! Ask me anything else, or raise a ticket if you need the team to step in.' },
];

/**
 * db       : better-sqlite3 database
 * question : student ka message
 * returns  : { answer, source, confidence, escalated }
 */
export function askBot(db, question) {
  const q = question.trim();

  for (const s of SMALL_TALK) {
    if (s.re.test(q) && q.split(/\s+/).length <= 4) {
      return { answer: s.reply, source: null, confidence: 1, escalated: false };
    }
  }

  const queryTokens = new Set(tokenize(q));
  let best = { confidence: 0, matched: 0, answer: null, source: null };

  const consider = (cand) => {
    if (
      cand.confidence > best.confidence ||
      (cand.confidence === best.confidence && cand.matched > best.matched)
    ) best = cand;
  };

  // 1) FAQs (sabse trusted, isliye +0.02 bonus)
  for (const f of db.prepare('SELECT * FROM faqs').all()) {
    const s = score(queryTokens, `${f.keywords} ${f.question}`);
    if (s.matched) consider({ ...s, confidence: Math.min(1, s.confidence + 0.02), answer: f.answer, source: f.source });
  }

  // 2) Notices
  for (const n of db.prepare('SELECT * FROM notices').all()) {
    const s = score(queryTokens, `${n.title} ${n.category} ${n.description}`);
    if (s.matched) {
      consider({
        ...s,
        answer: `**${n.title}** (${n.notice_date}): ${n.description}`,
        source: `Notice Board · Amity.edu`,
      });
    }
  }

  // 3) Uploaded documents
  for (const d of db.prepare('SELECT original_name, text_content FROM documents WHERE text_content IS NOT NULL').all()) {
    for (const chunk of chunkText(d.text_content || '')) {
      const s = score(queryTokens, chunk);
      if (s.matched) {
        consider({
          ...s,
          confidence: Math.min(1, s.confidence * 0.95), // doc chunk thoda kam trusted
          answer: `From **${d.original_name}**: ${chunk.length > 450 ? chunk.slice(0, 450) + '…' : chunk}`,
          source: `${d.original_name}`,
        });
      }
    }
  }

  const confidence = Math.round(best.confidence * 100) / 100;

  if (best.answer && confidence >= CONFIDENCE_THRESHOLD) {
    return { answer: best.answer, source: best.source, confidence, escalated: false };
  }

  return {
    answer:
      "I couldn't find a reliable answer to that in the knowledge base. I've passed your question to the helpdesk team. " +
      'You can also raise a ticket from the Raise Ticket tab for a personal reply.',
    source: null,
    confidence,
    escalated: true,
  };
}
