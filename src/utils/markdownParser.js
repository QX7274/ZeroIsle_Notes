/**
 * Comprehensive Markdown Parser Utility
 * Handles all standard markdown syntax with proper parsing and validation
 */

/**
 * Parse and validate markdown syntax
 * @param {string} markdown - Raw markdown text
 * @returns {object} Parsed markdown structure
 */
export const parseMarkdown = (markdown) => {
  const lines = markdown.split('\n');
  const parsed = {
    elements: [],
    metadata: {
      headings: [],
      links: [],
      images: [],
      codeBlocks: [],
      tables: [],
      taskLists: [],
    },
  };

  let currentElement = null;
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let inTable = false;
  let tableHeaders = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        // Start code block
        inCodeBlock = true;
        codeBlockLanguage = trimmedLine.substring(3).trim();
        currentElement = {
          type: 'codeBlock',
          language: codeBlockLanguage,
          content: '',
          startLine: i,
        };
      } else {
        // End code block
        inCodeBlock = false;
        currentElement.endLine = i;
        parsed.elements.push(currentElement);
        parsed.metadata.codeBlocks.push(currentElement);
        currentElement = null;
      }
      continue;
    }

    // Inside code block
    if (inCodeBlock) {
      currentElement.content += line + '\n';
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const element = {
        type: 'header',
        level,
        text,
        line: i,
        id: generateHeaderId(text),
      };
      parsed.elements.push(element);
      parsed.metadata.headings.push(element);
      continue;
    }

    // Horizontal rules
    if (/^(---|\*\*\*|___)$/.test(trimmedLine)) {
      parsed.elements.push({
        type: 'horizontalRule',
        line: i,
      });
      continue;
    }

    // Tables
    if (trimmedLine.includes('|') && trimmedLine.length > 1) {
      if (!inTable) {
        inTable = true;
        tableHeaders = parseTableRow(trimmedLine);
        currentElement = {
          type: 'table',
          headers: tableHeaders,
          rows: [],
          startLine: i,
        };
      } else {
        // Check if it's a separator row
        if (/^\|?[\s]*:?-+:?[\s]*(\|[\s]*:?-+:?[\s]*)*\|?$/.test(trimmedLine)) {
          // Skip separator row
          continue;
        }
        // Add data row
        const rowData = parseTableRow(trimmedLine);
        currentElement.rows.push(rowData);
      }
      continue;
    } else if (inTable) {
      // End table
      inTable = false;
      currentElement.endLine = i - 1;
      parsed.elements.push(currentElement);
      parsed.metadata.tables.push(currentElement);
      currentElement = null;
    }

    // Lists and task lists
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const marker = listMatch[2];
      const content = listMatch[3];

      // Check for task list
      const taskMatch = content.match(/^\[([ x])\]\s+(.+)$/);
      if (taskMatch) {
        const checked = taskMatch[1] === 'x';
        const taskText = taskMatch[2];
        const element = {
          type: 'taskItem',
          checked,
          text: taskText,
          indent,
          line: i,
        };
        parsed.elements.push(element);
        parsed.metadata.taskLists.push(element);
      } else {
        parsed.elements.push({
          type: marker.match(/\d+\./) ? 'orderedListItem' : 'unorderedListItem',
          text: content,
          indent,
          line: i,
        });
      }
      continue;
    }

    // Blockquotes
    if (line.match(/^>\s+/)) {
      const content = line.substring(line.indexOf('>') + 1).trim();
      parsed.elements.push({
        type: 'blockquote',
        text: content,
        line: i,
      });
      continue;
    }

    // Regular paragraph with inline elements
    if (trimmedLine.length > 0) {
      const inlineElements = parseInlineElements(line);
      parsed.elements.push({
        type: 'paragraph',
        text: line,
        inlineElements,
        line: i,
      });

      // Extract metadata from inline elements
      inlineElements.forEach(element => {
        if (element.type === 'link') {
          parsed.metadata.links.push(element);
        } else if (element.type === 'image') {
          parsed.metadata.images.push(element);
        }
      });
    }
  }

  // Close any remaining open elements
  if (inTable && currentElement) {
    currentElement.endLine = lines.length - 1;
    parsed.elements.push(currentElement);
    parsed.metadata.tables.push(currentElement);
  }

  return parsed;
};

/**
 * Parse inline markdown elements (links, images, formatting)
 * @param {string} text - Text to parse
 * @returns {array} Array of inline elements
 */
export const parseInlineElements = (text) => {
  const elements = [];
  let currentPos = 0;

  // Patterns for inline elements
  const patterns = [
    // Images: ![alt](src)
    {
      regex: /!\[([^\]]*)\]\(([^)]+)\)/g,
      type: 'image',
      parse: (match) => ({
        type: 'image',
        alt: match[1],
        src: match[2],
        raw: match[0],
      }),
    },
    // Links: [text](url)
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/g,
      type: 'link',
      parse: (match) => ({
        type: 'link',
        text: match[1],
        url: match[2],
        raw: match[0],
      }),
    },
    // Bold: **text** or __text__
    {
      regex: /(\*\*|__)(.*?)\1/g,
      type: 'bold',
      parse: (match) => ({
        type: 'bold',
        text: match[2],
        raw: match[0],
      }),
    },
    // Italic: *text* or _text_
    {
      regex: /(\*|_)(.*?)\1/g,
      type: 'italic',
      parse: (match) => ({
        type: 'italic',
        text: match[2],
        raw: match[0],
      }),
    },
    // Strikethrough: ~~text~~
    {
      regex: /~~(.*?)~~/g,
      type: 'strikethrough',
      parse: (match) => ({
        type: 'strikethrough',
        text: match[1],
        raw: match[0],
      }),
    },
    // Inline code: `code`
    {
      regex: /`([^`]+)`/g,
      type: 'code',
      parse: (match) => ({
        type: 'code',
        text: match[1],
        raw: match[0],
      }),
    },
  ];

  // Find all matches
  const allMatches = [];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      allMatches.push({
        ...pattern.parse(match),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  });

  // Sort by position
  allMatches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (prefer earlier ones)
  const filteredMatches = [];
  let lastEnd = 0;
  allMatches.forEach(match => {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  });

  return filteredMatches;
};

/**
 * Parse table row
 * @param {string} row - Table row text
 * @returns {array} Array of cell contents
 */
const parseTableRow = (row) => {
  return row
    .split('|')
    .map(cell => cell.trim())
    .filter((cell, index, array) => {
      // Remove empty cells at start and end
      return !(index === 0 && cell === '') && !(index === array.length - 1 && cell === '');
    });
};

/**
 * Generate header ID for anchor links
 * @param {string} text - Header text
 * @returns {string} Generated ID
 */
const generateHeaderId = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Validate markdown syntax
 * @param {string} markdown - Markdown text
 * @returns {object} Validation result
 */
export const validateMarkdown = (markdown) => {
  const errors = [];
  const warnings = [];
  const lines = markdown.split('\n');

  let inCodeBlock = false;
  let codeBlockStart = -1;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check for unclosed code blocks
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = lineNumber;
      } else {
        inCodeBlock = false;
        codeBlockStart = -1;
      }
    }

    // Check for malformed links
    const linkMatches = line.match(/\[([^\]]*)\]\(([^)]*)\)/g);
    if (linkMatches) {
      linkMatches.forEach(match => {
        const urlMatch = match.match(/\]\(([^)]*)\)/);
        if (urlMatch && !urlMatch[1].trim()) {
          warnings.push({
            line: lineNumber,
            message: 'Link has empty URL',
            type: 'warning',
          });
        }
      });
    }

    // Check for malformed images
    const imageMatches = line.match(/!\[([^\]]*)\]\(([^)]*)\)/g);
    if (imageMatches) {
      imageMatches.forEach(match => {
        const srcMatch = match.match(/\]\(([^)]*)\)/);
        if (srcMatch && !srcMatch[1].trim()) {
          errors.push({
            line: lineNumber,
            message: 'Image has empty source',
            type: 'error',
          });
        }
      });
    }

    // Check for unmatched formatting
    const boldCount = (line.match(/\*\*/g) || []).length;
    const italicCount = (line.match(/(?<!\*)\*(?!\*)/g) || []).length;
    const codeCount = (line.match(/`/g) || []).length;

    if (boldCount % 2 !== 0) {
      warnings.push({
        line: lineNumber,
        message: 'Unmatched bold formatting (**)',
        type: 'warning',
      });
    }

    if (italicCount % 2 !== 0) {
      warnings.push({
        line: lineNumber,
        message: 'Unmatched italic formatting (*)',
        type: 'warning',
      });
    }

    if (codeCount % 2 !== 0) {
      warnings.push({
        line: lineNumber,
        message: 'Unmatched inline code formatting (`)',
        type: 'warning',
      });
    }
  });

  // Check for unclosed code block at end
  if (inCodeBlock) {
    errors.push({
      line: codeBlockStart,
      message: 'Unclosed code block',
      type: 'error',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Generate table of contents from parsed markdown
 * @param {object} parsed - Parsed markdown object
 * @returns {array} Table of contents
 */
export const generateTableOfContents = (parsed) => {
  return parsed.metadata.headings.map(heading => ({
    id: heading.id,
    text: heading.text,
    level: heading.level,
    line: heading.line,
  }));
};

/**
 * Extract all links from markdown
 * @param {object} parsed - Parsed markdown object
 * @returns {array} All links found
 */
export const extractLinks = (parsed) => {
  return parsed.metadata.links.map(link => ({
    text: link.text,
    url: link.url,
    type: 'link',
  }));
};

/**
 * Extract all images from markdown
 * @param {object} parsed - Parsed markdown object
 * @returns {array} All images found
 */
export const extractImages = (parsed) => {
  return parsed.metadata.images.map(image => ({
    alt: image.alt,
    src: image.src,
    type: 'image',
  }));
};

/**
 * Get markdown statistics
 * @param {string} markdown - Markdown text
 * @returns {object} Statistics
 */
export const getMarkdownStats = (markdown) => {
  const parsed = parseMarkdown(markdown);
  const lines = markdown.split('\n');

  return {
    lines: lines.length,
    characters: markdown.length,
    words: markdown.split(/\s+/).filter(word => word.length > 0).length,
    headings: parsed.metadata.headings.length,
    links: parsed.metadata.links.length,
    images: parsed.metadata.images.length,
    codeBlocks: parsed.metadata.codeBlocks.length,
    tables: parsed.metadata.tables.length,
    taskLists: parsed.metadata.taskLists.length,
  };
};
