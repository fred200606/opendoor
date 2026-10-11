// Text and voice for "Read aloud" (components/ReadAloud.jsx).

const BLOCK_TAGS = new Set([
  'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LEGEND', 'LI', 'OL', 'P', 'SECTION', 'TABLE', 'TH', 'TR', 'UL',
]);
// Controls, icons hidden from screen readers, passing messages, hidden parts and table data cells
// (a table is read by its caption and row headers, e.g. "Ramp (2 of 3 delivered)").
const SKIP = 'button, form, td, thead, [hidden], [aria-hidden="true"], [role="alert"], [role="status"], [data-read-aloud="skip"]';
// Chrome stops one long utterance after about 15 seconds, so text is spoken in short pieces.
const MAX_CHUNK = 200;

/** The readable text inside `root`, in page order, as short pieces (one block or a few sentences each). */
export function readableChunks(root) {
  const blocks = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const skipped = node.parentElement?.closest(SKIP);
    if (!node.parentElement || (skipped && root.contains(skipped))) continue;
    let block = node.parentElement;
    while (block !== root && !BLOCK_TAGS.has(block.tagName)) block = block.parentElement;
    const last = blocks.at(-1);
    if (last?.block === block) last.text += node.data;
    else blocks.push({ block, text: node.data });
  }

  // A term and its description are read together: "Category: Accounting".
  const chunks = [];
  let term = null;
  for (const { block, text } of blocks) {
    const pieces = splitText(text);
    if (term && block.tagName === 'DD' && pieces.length) pieces[0] = `${term}: ${pieces[0]}`;
    else if (term) chunks.push(term);
    term = block.tagName === 'DT' ? pieces.join(' ') || null : null;
    if (!term) chunks.push(...pieces);
  }
  if (term) chunks.push(term);
  return chunks;
}

function splitText(text) {
  const chunks = [];
  for (const paragraph of text.split(/\n+/)) {
    const clean = paragraph.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    let chunk = '';
    for (const piece of clean.split(/(?<=[.!?])\s+/).flatMap(shorten)) {
      if (chunk && chunk.length + 1 + piece.length > MAX_CHUNK) {
        chunks.push(chunk);
        chunk = piece;
      } else {
        chunk = chunk ? `${chunk} ${piece}` : piece;
      }
    }
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/** A sentence longer than MAX_CHUNK is cut after commas or semicolons, else between words. */
function shorten(sentence) {
  if (sentence.length <= MAX_CHUNK) return [sentence];
  const pieces = [];
  let piece = '';
  for (const word of sentence.split(' ')) {
    if (piece && piece.length + 1 + word.length > MAX_CHUNK) {
      pieces.push(piece);
      piece = word;
    } else {
      piece = piece ? `${piece} ${word}` : word;
      if (/[,;:]$/.test(word) && piece.length > MAX_CHUNK / 2) {
        pieces.push(piece);
        piece = '';
      }
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/** A voice on the device for the page language (the default one first); null = the browser's default. */
export function pickVoice(voices, lang) {
  const base = lang.split('-')[0].toLowerCase();
  const local = voices.filter((voice) => voice.localService && voice.lang.toLowerCase().startsWith(base));
  return local.find((voice) => voice.default) ?? local[0] ?? null;
}
