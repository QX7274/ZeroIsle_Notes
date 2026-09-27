import crypto from 'crypto-js';

const NOTE_HASH_FIELDS = [
  'title',
  'content',
  'type',
  'strokeData',
  'viewport',
  'pdfAnnotations',
  'audioTranscription',
  'wordContent',
  'pages',
];

const normalizeNoteHashData = note => NOTE_HASH_FIELDS.reduce((hashData, field) => {
  hashData[field] = note?.[field] ?? null;
  return hashData;
}, {});

const generateNoteDataHash = note => {
  const hashString = JSON.stringify(normalizeNoteHashData(note));
  return crypto.SHA256(hashString).toString();
};

export { NOTE_HASH_FIELDS, normalizeNoteHashData, generateNoteDataHash };
