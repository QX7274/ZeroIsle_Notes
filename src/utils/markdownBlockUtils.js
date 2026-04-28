import realmService from '../services/database/realmService';


/**
 * Generates a short, random, and URL-friendly unique ID.
 * @returns {string} A unique block ID.
 */
const generateBlockId = () => {
  return `^${realmService.createObjectId().slice(0, 6)}`;
};

/**
 * Processes Markdown content to ensure every block has a unique ID.
 * A block is typically a paragraph, a list item, a heading, etc., separated by newlines.
 * It appends a unique ID (e.g., ^a1b2c3) to blocks that don't have one.
 *
 * @param {string} markdownContent The original Markdown content.
 * @returns {string} The processed Markdown content with block IDs.
 */
export const addBlockIdsToMarkdown = (markdownContent) => {
  if (!markdownContent || typeof markdownContent !== 'string') {
    return '';
  }

  const lines = markdownContent.split('\n');
  const processedLines = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Toggle code block state
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(line);
      continue;
    }

    // Don't add IDs inside code blocks or to empty lines
    if (inCodeBlock || line.trim() === '') {
      processedLines.push(line);
      continue;
    }

    // Check if the block already has an ID
    const hasBlockId = /\s\^([a-zA-Z0-9]+)$/.test(line.trim());

    if (!hasBlockId) {
      // Check if the next line is a block ID, to handle multiline blocks
      const nextLineIsBlockId = i + 1 < lines.length && /^\^([a-zA-Z0-9]+)$/.test(lines[i + 1].trim());
      if (!nextLineIsBlockId) {
        processedLines.push(`${line} ${generateBlockId()}`);
      } else {
        processedLines.push(line);
      }
    } else {
      processedLines.push(line);
    }
  }

  return processedLines.join('\n');
};

