// Lightweight local search for personal KB without extra deps
// Strategy: simple CJK+word token overlap scoring on title+description/full_content
// Returns topK snippet objects: { text, source: { type, title, anchor } }

const normalize = (s = '') =>
  (s || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (s = '') => {
  // very naive tokenizer: split by non-CJK/non-word, keep single CJK chars
  const tokens = [];
  const cleaned = s.toLowerCase();
  let buf = '';
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const code = ch.charCodeAt(0);
    const isAsciiWord = /[a-z0-9_]/.test(ch);
    const isCJK = (code >= 0x4e00 && code <= 0x9fff);
    if (isAsciiWord) {
      buf += ch;
    } else {
      if (buf) {
        tokens.push(buf);
        buf = '';
      }
      if (isCJK) {tokens.push(ch);} // single CJK char token
    }
  }
  if (buf) {tokens.push(buf);}
  return tokens.filter(Boolean);
};

// Build a simple in-memory index from nodes
// nodes: [{ id, title, description, properties? }]
export const buildSimpleDocsFromNodes = (nodes = []) => {
  return nodes.map((n) => {
    const title = normalize(n.title || '');
    const desc = normalize(n.description || '');
    const full = normalize(n.properties?.full_content || '');
    const text = full || desc || title;
    const anchor = n.properties?.anchor || n.properties?.page ? `#p${n.properties.page}` : '';
    return {
      id: String(n.id || n._id || ''),
      title,
      text,
      source: {
        type: n.properties?.type || 'node',
        title: title || '未命名',
        anchor,
      },
      _tokens: {
        title: tokenize(title),
        text: tokenize(text),
      },
    };
  });
};

const scoreDoc = (doc, qTokens) => {
  // overlap score with small weight for title
  const tSet = new Set(doc._tokens.text);
  const titleSet = new Set(doc._tokens.title);
  let overlap = 0;
  let titleBoost = 0;
  for (const tk of qTokens) {
    if (tSet.has(tk)) {overlap += 1;}
    if (titleSet.has(tk)) {titleBoost += 0.5;}
  }
  // length normalization
  const lenNorm = Math.log(1 + doc._tokens.text.length);
  return (overlap + titleBoost) / Math.max(1, lenNorm);
};

export const searchTopSnippets = (docs, query, k = 5) => {
  const q = normalize(query);
  if (!q) {return [];}
  const qTokens = tokenize(q);
  const scored = docs
    .map((d) => ({ d, s: scoreDoc(d, qTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(({ d }) => ({ text: d.text.slice(0, 800), source: d.source }));
  return scored;
};

export default { buildSimpleDocsFromNodes, searchTopSnippets };

