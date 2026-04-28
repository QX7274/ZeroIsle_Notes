/**
 * Advanced Markdown Preview Component
 * Enhanced version with comprehensive markdown support including:
 * - Syntax highlighting for code blocks
 * - Mathematical expressions
 * - Tables with proper formatting
 * - Task lists with interactive checkboxes
 * - Improved styling and performance
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';

/**
 * Advanced Markdown Preview Component
 * @param {string} content - Markdown content to render
 * @param {object} style - Custom styles
 * @param {boolean} scrollEnabled - Enable scrolling
 * @param {function} onLinkPress - Link press handler
 * @param {function} onTaskToggle - Task checkbox toggle handler
 * @param {boolean} enableMath - Enable mathematical expressions
 * @param {boolean} enableSyntaxHighlighting - Enable code syntax highlighting
 */
const AdvancedMarkdownPreview = ({
  content = '',
  style,
  scrollEnabled = true,
  onLinkPress,
  onTaskToggle,
  onWikiLinkPress,
  onBlockReferencePress,
  enableMath = true,
  enableSyntaxHighlighting = true,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // Convert markdown to HTML with advanced features
  const convertToHtml = useCallback((markdown) => {
    if (!markdown.trim()) {
      return getEmptyStateHtml();
    }

    let html = markdown;

    // Escape HTML entities first
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Headers with anchor links
    html = html.replace(/^(#{1,6})\s+(.*)$/gm, (match, hashes, text) => {
      const level = hashes.length;
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      return `<h${level} id="${id}">${text}</h${level}>`;
    });

    // Code blocks with syntax highlighting
    if (enableSyntaxHighlighting) {
      html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'text';
        const highlightedCode = highlightCode(code.trim(), language);
        return `<pre class="code-block"><code class="language-${language}">${highlightedCode}</code></pre>`;
      });
    } else {
      html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre class="code-block"><code>${code.trim()}</code></pre>`;
      });
    }

    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

    // Mathematical expressions (LaTeX-style)
    if (enableMath) {
      // Block math
      html = html.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math-block">$1</div>');
      // Inline math
      html = html.replace(/\$([^$\n]+)\$/g, '<span class="math-inline">$1</span>');
    }

    // Bold, italic, strikethrough
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Links with improved handling
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const isExternal = url.startsWith('http') || url.startsWith('https');
      return `<a href="${url}" class="markdown-link" ${isExternal ? 'target="_blank"' : ''}>${text}</a>`;
    });

    // Wiki-style links
    html = html.replace(/\[\[([^\]]+)\]\]/g, (match, text) => {
      return `<a href="#" class="wiki-link" data-wiki-link="${text}">${text}</a>`;
    });

    // Block References
    html = html.replace(/\(\(\^([a-zA-Z0-9]+)\)\)/g, (match, blockId) => {
      return `<span class="block-reference" data-block-ref="${blockId}">${match}</span>`;
    });

    // Images with lazy loading and error handling
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      return `<img src="${src}" alt="${alt}" class="markdown-image" loading="lazy" onerror="this.style.display='none'" />`;
    });

    // Tables with enhanced formatting
    html = processMarkdownTables(html);

    // Task lists with interactive checkboxes
    let taskIndex = 0;
    html = html.replace(/^(\s*)- \[([ x])\]\s+(.*)$/gm, (match, indent, checked, text) => {
      const isChecked = checked === 'x';
      const taskId = `task-${++taskIndex}`;
      return `${indent}<li class="task-item"><input type="checkbox" ${isChecked ? 'checked' : ''} id="${taskId}" onchange="handleTaskToggle('${taskId}', this.checked)"> <label for="${taskId}">${text}</label></li>`;
    });

    // Regular lists
    html = html.replace(/^(\s*)[-*+]\s+(.*)$/gm, '$1<li>$2</li>');
    html = html.replace(/^(\s*)(\d+)\.\s+(.*)$/gm, '$1<li>$3</li>');

    // Wrap consecutive list items
    html = wrapListItems(html);

    // Blockquotes with nesting support
    html = html.replace(/^>\s+(.*)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/(<\/blockquote>\s*<blockquote>)/g, '\n');

    // Horizontal rules
    html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr class="markdown-hr">');

    // Paragraphs and line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6])/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr)/g, '$1');
    html = html.replace(/(<\/hr>)<\/p>/g, '$1');

    return getStyledHtml(html);
  }, [colors, enableMath, enableSyntaxHighlighting]);

  // Simple syntax highlighting
  const highlightCode = useCallback((code, language) => {
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
  }, []);

  // Process markdown tables
  const processMarkdownTables = useCallback((html) => {
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

      // Skip separator row (index 1) and process data rows
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
  }, []);

  // Wrap consecutive list items in ul/ol tags
  const wrapListItems = useCallback((html) => {
    // Wrap unordered list items
    html = html.replace(/(<li>(?:(?!<li>|<\/li>)[\s\S])*<\/li>[\s\S]*?)+/g, (match) => {
      if (match.includes('task-item')) {
        return `<ul class="task-list">${match}</ul>`;
      }
      return `<ul>${match}</ul>`;
    });

    return html;
  }, []);

  // Get styled HTML with comprehensive CSS
  const getStyledHtml = useCallback((content) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: ${colors.text};
            background-color: ${colors.background};
            margin: 0;
            padding: 16px;
            font-size: 16px;
            word-wrap: break-word;
          }

          /* Headers */
          h1, h2, h3, h4, h5, h6 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
          }
          h1 { font-size: 2em; border-bottom: 1px solid ${colors.border}; padding-bottom: 8px; }
          h2 { font-size: 1.5em; }
          h3 { font-size: 1.25em; }
          h4 { font-size: 1em; }
          h5 { font-size: 0.875em; }
          h6 { font-size: 0.85em; color: ${colors.textSecondary}; }

          /* Text formatting */
          p { margin-bottom: 16px; }
          strong { font-weight: 600; }
          em { font-style: italic; }
          del { text-decoration: line-through; opacity: 0.7; }
          u { text-decoration: underline; }

          /* Code */
          .inline-code {
            background-color: ${colors.card};
            color: ${colors.primary};
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 0.9em;
          }
          .code-block {
            background-color: ${colors.card};
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 16px 0;
            border: 1px solid ${colors.border};
          }
          .code-block code {
            background: none;
            padding: 0;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 0.9em;
            line-height: 1.4;
          }

          /* Syntax highlighting */
          .keyword { color: #d73a49; font-weight: 600; }
          .string { color: #032f62; }
          .comment { color: #6a737d; font-style: italic; }

          /* Math */
          .math-block {
            background-color: ${colors.card};
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
            text-align: center;
            font-family: 'Times New Roman', serif;
            border: 1px solid ${colors.border};
          }
          .math-inline {
            font-family: 'Times New Roman', serif;
            background-color: ${colors.card};
            padding: 2px 4px;
            border-radius: 3px;
          }

          /* Lists */
          ul, ol {
            padding-left: 24px;
            margin: 16px 0;
          }
          li {
            margin: 6px 0;
          }
          .task-list {
            list-style: none;
            padding-left: 0;
          }
          .task-item {
            margin: 8px 0;
            display: flex;
            align-items: flex-start;
          }
          .task-item input[type="checkbox"] {
            margin-right: 8px;
            margin-top: 2px;
          }
          .task-item label {
            flex: 1;
            cursor: pointer;
          }

          /* Tables */
          .markdown-table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
            border: 1px solid ${colors.border};
            border-radius: 8px;
            overflow: hidden;
          }
          .markdown-table th,
          .markdown-table td {
            border: 1px solid ${colors.border};
            padding: 12px;
            text-align: left;
          }
          .markdown-table th {
            background-color: ${colors.card};
            font-weight: 600;
          }
          .markdown-table tbody tr:nth-child(even) {
            background-color: ${colors.background}f0;
          }

          /* Blockquotes */
          blockquote {
            border-left: 4px solid ${colors.primary};
            padding-left: 16px;
            margin: 16px 0;
            background-color: ${colors.card};
            padding: 16px;
            border-radius: 0 8px 8px 0;
            font-style: italic;
          }

          /* Horizontal rules */
          .markdown-hr {
            border: none;
            border-top: 2px solid ${colors.border};
            margin: 32px 0;
          }

          /* Links */
          .markdown-link {
            color: ${colors.primary};
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s ease;
          }
          .markdown-link:hover {
            border-bottom-color: ${colors.primary};
          }

          /* Wiki-links */
          .wiki-link {
            color: ${colors.secondary};
            text-decoration: none;
            border-bottom: 1px dashed ${colors.secondary};
            transition: background-color 0.2s ease;
          }
          .wiki-link:hover {
            background-color: ${colors.secondary}20;
          }

          /* Block References */
          .block-reference {
            background-color: ${colors.card};
            border: 1px solid ${colors.border};
            border-radius: 4px;
            padding: 0 4px;
            cursor: pointer;
            transition: background-color 0.2s ease;
          }
          .block-reference:hover {
            background-color: ${colors.primary}20;
          }

          /* Images */
          .markdown-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 16px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }

          /* Responsive design */
          @media (max-width: 768px) {
            body { padding: 12px; font-size: 14px; }
            h1 { font-size: 1.8em; }
            h2 { font-size: 1.4em; }
            .code-block { padding: 12px; }
            .markdown-table th,
            .markdown-table td { padding: 8px; }
          }
        </style>
        <script>
          function handleTaskToggle(taskId, checked) {
            // Send message to React Native
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'taskToggle', taskId, checked })
            );
          }
          
          function handleLinkClick(url) {
            // Send message to React Native
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'linkPress', url })
            );
            return false;
          }
          
          // Override link clicks
          document.addEventListener('DOMContentLoaded', function() {
            // Handle regular links
            document.querySelectorAll('.markdown-link').forEach(link => {
              link.addEventListener('click', function(e) {
                e.preventDefault();
                handleLinkClick(this.href);
              });
            });

            // Handle wiki-links
            document.querySelectorAll('.wiki-link').forEach(link => {
              link.addEventListener('click', function(e) {
                e.preventDefault();
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'wikiLinkPress', title: this.dataset.wikiLink })
                );
              });
            });

            // Handle block references
            document.querySelectorAll('.block-reference').forEach(link => {
              link.addEventListener('click', function(e) {
                e.preventDefault();
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
                  JSON.stringify({ type: 'blockReferencePress', blockId: this.dataset.blockRef })
                );
              });
            });
          });
        </script>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  }, [colors]);

  // Get empty state HTML
  const getEmptyStateHtml = useCallback(() => {
    return getStyledHtml(`
      <div style="text-align: center; color: ${colors.textSecondary}; margin-top: 50px;">
        <h3>📝 Markdown 预览</h3>
        <p>开始输入 Markdown 内容以查看实时预览</p>
        <small>支持标题、列表、代码块、表格、数学公式等</small>
      </div>
    `);
  }, [colors, getStyledHtml]);

  // Handle WebView messages
  const handleWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'taskToggle' && onTaskToggle) {
        onTaskToggle(data.taskId, data.checked);
      } else if (data.type === 'linkPress' && onLinkPress) {
        onLinkPress(data.url);
      } else if (data.type === 'wikiLinkPress' && onWikiLinkPress) {
        onWikiLinkPress(data.title);
      } else if (data.type === 'blockReferencePress' && onBlockReferencePress) {
        onBlockReferencePress(data.blockId);
      }
    } catch (error) {
      console.warn('Failed to parse WebView message:', error);
    }
  }, [onTaskToggle, onLinkPress]);

  // Memoize HTML content
  const htmlContent = useMemo(() => {
    return convertToHtml(content);
  }, [content, convertToHtml]);

  const styles = getStyles(colors);

  if (scrollEnabled) {
    return (
      <ScrollView style={[styles.container, style]} contentContainerStyle={styles.scrollContent}>
        <WebView
          source={{ html: htmlContent }}
          style={styles.webView}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          nestedScrollEnabled={false}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webView}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

// Styles
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default AdvancedMarkdownPreview;
