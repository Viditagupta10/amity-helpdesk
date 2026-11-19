// Uploaded file se text nikalta hai taaki chatbot usme search kar sake.
import fs from 'fs';

const MAX_CHARS = 200000;

export async function extractText(filePath, ext) {
  try {
    if (ext === '.txt' || ext === '.md') {
      return fs.readFileSync(filePath, 'utf8').slice(0, MAX_CHARS);
    }
    if (ext === '.pdf') {
      // pdf-parse ki main file import karte hain (index.js me test code chalne ka bug hai)
      const mod = await import('pdf-parse/lib/pdf-parse.js');
      const parse = mod.default;
      const data = await parse(fs.readFileSync(filePath));
      return (data.text || '').slice(0, MAX_CHARS);
    }
  } catch (err) {
    console.warn('Text extraction failed for', filePath, '-', err.message);
  }
  return ''; // scanned PDF / unsupported: file save ho jayegi, bas chatbot ise search nahi karega
}
