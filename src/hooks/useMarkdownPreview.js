/**
 * Custom hook for real-time markdown preview functionality
 * Handles debounced updates, performance optimization, and preview state management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { parseMarkdown, validateMarkdown } from '../utils/markdownParser';

/**
 * Custom hook for markdown preview with real-time updates
 * @param {string} content - Markdown content
 * @param {object} options - Configuration options
 * @returns {object} Preview state and methods
 */
export const useMarkdownPreview = (content = '', options = {}) => {
  const {
    debounceDelay = 300,
    enableValidation = true,
    enableStats = true,
    onContentChange,
    onValidationChange,
  } = options;

  const [previewContent, setPreviewContent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [parsedMarkdown, setParsedMarkdown] = useState(null);
  const [validation, setValidation] = useState({ isValid: true, errors: [], warnings: [] });
  const [stats, setStats] = useState({
    lines: 0,
    characters: 0,
    words: 0,
    headings: 0,
    links: 0,
    images: 0,
    codeBlocks: 0,
    tables: 0,
    taskLists: 0,
  });

  const updateTimeoutRef = useRef(null);
  const lastContentRef = useRef('');

  // Debounced update function
  const debouncedUpdate = useCallback(
    debounce(async (newContent) => {
      if (newContent === lastContentRef.current) {
        return; // No change, skip update
      }

      setIsUpdating(true);
      lastContentRef.current = newContent;

      try {
        // Parse markdown
        const parsed = parseMarkdown(newContent);
        setParsedMarkdown(parsed);

        // Generate HTML content
        const htmlContent = await generateHtmlContent(newContent, parsed);
        setPreviewContent(htmlContent);

        // Validate if enabled
        if (enableValidation) {
          const validationResult = validateMarkdown(newContent);
          setValidation(validationResult);

          if (onValidationChange) {
            onValidationChange(validationResult);
          }
        }

        // Calculate stats if enabled
        if (enableStats) {
          const newStats = calculateStats(newContent, parsed);
          setStats(newStats);
        }

        // Notify content change
        if (onContentChange) {
          onContentChange({
            content: newContent,
            parsed,
            validation: enableValidation ? validation : null,
            stats: enableStats ? stats : null,
          });
        }
      } catch (error) {
        console.error('Error updating markdown preview:', error);
      } finally {
        setIsUpdating(false);
      }
    }, debounceDelay),
    [debounceDelay, enableValidation, enableStats, onContentChange, onValidationChange]
  );

  // Update preview when content changes
  useEffect(() => {
    if (content !== lastContentRef.current) {
      debouncedUpdate(content);
    }
  }, [content, debouncedUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  // Force immediate update
  const forceUpdate = useCallback(() => {
    debouncedUpdate.cancel();
    debouncedUpdate(content);
  }, [content, debouncedUpdate]);

  // Get table of contents
  const getTableOfContents = useCallback(() => {
    if (!parsedMarkdown) {return [];}

    return parsedMarkdown.metadata.headings.map(heading => ({
      id: heading.id,
      text: heading.text,
      level: heading.level,
      line: heading.line,
    }));
  }, [parsedMarkdown]);

  // Get all links
  const getLinks = useCallback(() => {
    if (!parsedMarkdown) {return [];}

    return parsedMarkdown.metadata.links;
  }, [parsedMarkdown]);

  // Get all images
  const getImages = useCallback(() => {
    if (!parsedMarkdown) {return [];}

    return parsedMarkdown.metadata.images;
  }, [parsedMarkdown]);

  return {
    // State
    previewContent,
    isUpdating,
    parsedMarkdown,
    validation,
    stats,

    // Methods
    forceUpdate,
    getTableOfContents,
    getLinks,
    getImages,

    // Computed properties
    hasErrors: validation.errors.length > 0,
    hasWarnings: validation.warnings.length > 0,
    isEmpty: !content.trim(),
  };
};

/**
 * Generate HTML content from markdown
 * @param {string} markdown - Raw markdown content
 * @param {object} parsed - Parsed markdown structure
 * @returns {string} HTML content
 */
const generateHtmlContent = async (markdown, parsed) => {
  if (!markdown.trim()) {
    return getEmptyStateHtml();
  }

  let html = markdown;

  // Escape HTML entities
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');

  // Process headers with anchor links
  html = html.replace(/^(#{1,6})\s+(.*)$/gm, (match, hashes, text) => {
    const level = hashes.length;
    const id = generateHeaderId(text);
    return `<h${level} id="${id}">${text}</h${level}>`;
  });

  // Process code blocks with syntax highlighting
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text';
    const highlightedCode = highlightCode(code.trim(), language);
    return `<pre class="code-block"><code class="language-${language}">${highlightedCode}</code></pre>`;
  });

  // Process inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

  // Process mathematical expressions
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math-block">$1</div>');
  html = html.replace(/\$([^$\n]+)\$/g, '<span class="math-inline">$1</span>');

  // Process text formatting
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.*?)__/g, '<u>$1</u>');
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Process links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const isExternal = url.startsWith('http') || url.startsWith('https');
    return `<a href="${url}" class="markdown-link" ${isExternal ? 'target="_blank"' : ''}>${text}</a>`;
  });

  // Process images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    return `<img src="${src}" alt="${alt}" class="markdown-image" loading="lazy" onerror="this.style.display='none'" />`;
  });

  // Process tables
  html = processMarkdownTables(html);

  // Process task lists
  let taskIndex = 0;
  html = html.replace(/^(\s*)- \[([ x])\]\s+(.*)$/gm, (match, indent, checked, text) => {
    const isChecked = checked === 'x';
    const taskId = `task-${++taskIndex}`;
    return `${indent}<li class="task-item"><input type="checkbox" ${isChecked ? 'checked' : ''} id="${taskId}" onchange="handleTaskToggle('${taskId}', this.checked)"> <label for="${taskId}">${text}</label></li>`;
  });

  // Process regular lists
  html = html.replace(/^(\s*)[-*+]\s+(.*)$/gm, '$1<li>$2</li>');
  html = html.replace(/^(\s*)(\d+)\.\s+(.*)$/gm, '$1<li>$3</li>');

  // Wrap consecutive list items
  html = wrapListItems(html);

  // Process blockquotes
  html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/(<\/blockquote>\s*<blockquote>)/g, '\n');

  // Process horizontal rules
  html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr class="markdown-hr">');

  // Process paragraphs and line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6])/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr)/g, '$1');
  html = html.replace(/(<\/hr>)<\/p>/g, '$1');

  return html;
};

/**
 * Calculate markdown statistics
 * @param {string} content - Markdown content
 * @param {object} parsed - Parsed markdown structure
 * @returns {object} Statistics
 */
const calculateStats = (content, parsed) => {
  const lines = content.split('\n');
  const words = content.split(/\s+/).filter(word => word.length > 0);

  return {
    lines: lines.length,
    characters: content.length,
    words: words.length,
    headings: parsed.metadata.headings.length,
    links: parsed.metadata.links.length,
    images: parsed.metadata.images.length,
    codeBlocks: parsed.metadata.codeBlocks.length,
    tables: parsed.metadata.tables.length,
    taskLists: parsed.metadata.taskLists.length,
  };
};

/**
 * Simple syntax highlighting for code blocks
 * @param {string} code - Code content
 * @param {string} language - Programming language
 * @returns {string} Highlighted code
 */
const highlightCode = (code, language) => {
  const keywords = {
    javascript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export'],
    python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'return', 'try', 'except'],
    java: ['public', 'private', 'class', 'interface', 'if', 'else', 'for', 'while', 'return', 'import', 'package'],
    css: ['color', 'background', 'margin', 'padding', 'border', 'width', 'height', 'display', 'position'],
  };

  let highlighted = code;
  const langKeywords = keywords[language.toLowerCase()] || [];

  // Highlight keywords
  langKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
  });

  // Highlight strings
  highlighted = highlighted.replace(/(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g, '<span class="string">$1$2$3</span>');

  // Highlight comments
  highlighted = highlighted.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span class="comment">$1</span>');

  return highlighted;
};

/**
 * Process markdown tables
 * @param {string} html - HTML content
 * @returns {string} Processed HTML with tables
 */
const processMarkdownTables = (html) => {
  const tableRegex = /(\|.*\|[\r\n]+)+/g;
  return html.replace(tableRegex, (match) => {
    const rows = match.trim().split(/[\r\n]+/);
    if (rows.length < 2) {return match;}

    let tableHtml = '<table class="markdown-table">';

    // Header row
    const headerCells = rows[0].split('|').slice(1, -1).map(cell => cell.trim());
    tableHtml += '<thead><tr>';
    headerCells.forEach(cell => {
      tableHtml += `<th>${cell}</th>`;
    });
    tableHtml += '</tr></thead>';

    // Skip separator row and process data rows
    if (rows.length > 2) {
      tableHtml += '<tbody>';
      for (let i = 2; i < rows.length; i++) {
        const dataCells = rows[i].split('|').slice(1, -1).map(cell => cell.trim());
        tableHtml += '<tr>';
        dataCells.forEach(cell => {
          tableHtml += `<td>${cell}</td>`;
        });
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody>';
    }

    tableHtml += '</table>';
    return tableHtml;
  });
};

/**
 * Wrap consecutive list items in ul/ol tags
 * @param {string} html - HTML content
 * @returns {string} Processed HTML with wrapped lists
 */
const wrapListItems = (html) => {
  html = html.replace(/(<li>(?:(?!<li>|<\/li>)[\s\S])*<\/li>[\s\S]*?)+/g, (match) => {
    if (match.includes('task-item')) {
      return `<ul class="task-list">${match}</ul>`;
    }
    return `<ul>${match}</ul>`;
  });

  return html;
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
 * Get empty state HTML
 * @returns {string} Empty state HTML
 */
const getEmptyStateHtml = () => {
  return `
    <div style="text-align: center; color: #8E8E93; margin-top: 50px;">
      <h3>📝 Markdown 预览</h3>
      <p>开始输入 Markdown 内容以查看实时预览</p>
      <small>支持标题、列表、代码块、表格、数学公式等</small>
    </div>
  `;
};

export default useMarkdownPreview;
