/**
 * Analyzes the markdown content around the current selection to determine
 * which formatting options are active.
 * @param {string} content The full markdown content.
 * @param {{start: number, end: number}} selection The current selection range.
 * @returns {Set<string>} A set of active format keys (e.g., 'bold', 'italic').
 */
export const getActiveFormats = (content, selection) => {
  const activeFormats = new Set();
  if (!content || !selection) {return activeFormats;}

  const pos = selection.start;
  const line = content.substring(content.lastIndexOf('\n', pos - 1) + 1, content.indexOf('\n', pos));

  // Check for headers
  if (line.startsWith('# ')) {activeFormats.add('h1');}
  if (line.startsWith('## ')) {activeFormats.add('h2');}
  if (line.startsWith('### ')) {activeFormats.add('h3');}
  if (line.startsWith('#### ')) {activeFormats.add('h4');}

  // Check for lists
  if (line.match(/^\s*-\s/)) {activeFormats.add('bullet');}
  if (line.match(/^\s*\d+\.\s/)) {activeFormats.add('number');}
  if (line.match(/^\s*-\s\[[ x]\]\s/)) {activeFormats.add('task');}

  // Check for blockquote
  if (line.startsWith('> ')) {activeFormats.add('quote');}

  // This is a simplified check for inline styles. A robust solution would need a proper parser.
  // For now, we just check if the cursor is between the markers.
  const checkInline = (marker, format) => {
    const before = content.substring(0, pos);
    const after = content.substring(pos);
    if (before.split(marker).length % 2 !== 0 && after.split(marker).length % 2 !== 0) {
      activeFormats.add(format);
    }
  };

  checkInline('**', 'bold');
  checkInline('*', 'italic');
  checkInline('~~', 'strikethrough');
  checkInline('__', 'underline');
  checkInline('`', 'code');

  return activeFormats;
};

