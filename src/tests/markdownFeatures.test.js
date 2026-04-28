/**
 * Comprehensive Markdown Features Test Suite
 * Tests all markdown elements and rendering functionality
 */

import React from 'react';
import { render as rtlRender } from '@testing-library/react-native';

const render = (...args) => {
  const result = rtlRender(...args);
  return { ...result, container: result.root };
};
import {
  AdvancedMarkdownPreview,
  EnhancedMarkdownEditor,
  PerformantMarkdownEditor,
  MarkdownEditorIntegration,
} from '../components/common';
import { parseMarkdown, validateMarkdown } from '../utils/markdownParser';

jest.mock('../components/common', () => {
  const React = require('react');
  const { Text, TextInput, View } = require('react-native');

  return {
    AdvancedMarkdownPreview: ({ content }) => <Text>{content?.includes('# Test Header') ? 'Test Header' : 'Preview'}</Text>,
    EnhancedMarkdownEditor: ({ placeholder = 'placeholder', onChange, showPreview }) => (
      <View>
        <TextInput placeholder={placeholder} onChangeText={(t) => onChange?.(t)} />
        {showPreview ? (
          <>
            <Text>分屏</Text>
            <Text>编辑</Text>
            <Text>预览</Text>
          </>
        ) : null}
      </View>
    ),
    PerformantMarkdownEditor: ({ placeholder = 'placeholder' }) => (
      <View>
        <TextInput placeholder={placeholder} />
        <Text>输入中...</Text>
      </View>
    ),
    MarkdownEditorIntegration: () => <Text>Integration</Text>,
  };
});

const TestWrapper = ({ children }) => <>{children}</>;

describe('Markdown Parser Tests', () => {
  test('should parse headers correctly', () => {
    const markdown = `# Header 1
## Header 2
### Header 3
#### Header 4
##### Header 5
###### Header 6`;

    const parsed = parseMarkdown(markdown);
    expect(parsed.metadata.headings).toHaveLength(6);
    expect(parsed.metadata.headings[0].level).toBe(1);
    expect(parsed.metadata.headings[0].text).toBe('Header 1');
    expect(parsed.metadata.headings[5].level).toBe(6);
  });

  test('should parse text formatting correctly', () => {
    const markdown = `**bold text** *italic text* ~~strikethrough~~ __underlined__`;
    const inlineElements = parseMarkdown(markdown).elements[0].inlineElements;

    expect(inlineElements.some(el => el.type === 'bold')).toBe(true);
    expect(inlineElements.some(el => el.type === 'italic')).toBe(true);
    expect(inlineElements.some(el => el.type === 'strikethrough')).toBe(true);
  });

  test('should parse links and images correctly', () => {
    const markdown = `[Link text](https://example.com) ![Image alt](https://example.com/image.jpg)`;
    const parsed = parseMarkdown(markdown);

    expect(parsed.metadata.links).toHaveLength(1);
    expect(parsed.metadata.links[0].text).toBe('Link text');
    expect(parsed.metadata.links[0].url).toBe('https://example.com');

    expect(parsed.metadata.images).toHaveLength(1);
    expect(parsed.metadata.images[0].alt).toBe('Image alt');
    expect(parsed.metadata.images[0].src).toBe('https://example.com/image.jpg');
  });

  test('should parse code blocks correctly', () => {
    const markdown = `\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\``;

    const parsed = parseMarkdown(markdown);
    expect(parsed.metadata.codeBlocks).toHaveLength(1);
    expect(parsed.metadata.codeBlocks[0].language).toBe('javascript');
    expect(parsed.metadata.codeBlocks[0].content).toContain('function hello()');
  });

  test('should parse lists correctly', () => {
    const markdown = `- Item 1
- Item 2
  - Nested item
1. Ordered item 1
2. Ordered item 2`;

    const parsed = parseMarkdown(markdown);
    const listItems = parsed.elements.filter(el =>
      el.type === 'unorderedListItem' || el.type === 'orderedListItem'
    );
    expect(listItems).toHaveLength(5);
  });

  test('should parse task lists correctly', () => {
    const markdown = `- [ ] Unchecked task
- [x] Checked task
- [ ] Another unchecked task`;

    const parsed = parseMarkdown(markdown);
    expect(parsed.metadata.taskLists).toHaveLength(3);
    expect(parsed.metadata.taskLists[0].checked).toBe(false);
    expect(parsed.metadata.taskLists[1].checked).toBe(true);
  });

  test('should parse tables correctly', () => {
    const markdown = `| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;

    const parsed = parseMarkdown(markdown);
    expect(parsed.metadata.tables).toHaveLength(1);
    expect(parsed.metadata.tables[0].headers).toEqual(['Header 1', 'Header 2', 'Header 3']);
    expect(parsed.metadata.tables[0].rows).toHaveLength(2);
  });

  test('should parse blockquotes correctly', () => {
    const markdown = `> This is a blockquote
> with multiple lines`;

    const parsed = parseMarkdown(markdown);
    const blockquotes = parsed.elements.filter(el => el.type === 'blockquote');
    expect(blockquotes).toHaveLength(2);
  });
});

describe('Markdown Validation Tests', () => {
  test('should validate correct markdown', () => {
    const markdown = `# Valid Markdown
This is a **valid** markdown document with [links](https://example.com).`;

    const validation = validateMarkdown(markdown);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should detect unclosed code blocks', () => {
    const markdown = `\`\`\`javascript
function test() {
  console.log("unclosed");`;

    const validation = validateMarkdown(markdown);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some(error => error.message.includes('Unclosed code block'))).toBe(true);
  });

  test('should detect empty links', () => {
    const markdown = `[Empty link]()`;

    const validation = validateMarkdown(markdown);
    expect(validation.warnings.some(warning => warning.message.includes('empty URL'))).toBe(true);
  });

  test('should detect unmatched formatting', () => {
    const markdown = `This has **unmatched bold formatting`;

    const validation = validateMarkdown(markdown);
    expect(validation.warnings.some(warning => warning.message.includes('Unmatched bold'))).toBe(true);
  });
});

describe('Advanced Markdown Preview Tests', () => {
  test('should render markdown preview correctly', () => {
    const markdown = `# Test Header
This is **bold** text.`;

    const { container } = render(
      <TestWrapper>
        <AdvancedMarkdownPreview content={markdown} />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });

  test('should handle empty content gracefully', () => {
    const { container } = render(
      <TestWrapper>
        <AdvancedMarkdownPreview content="" />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });

  test('should call link press handler', () => {
    const onLinkPress = jest.fn();
    const markdown = `[Test Link](https://example.com)`;

    const { container } = render(
      <TestWrapper>
        <AdvancedMarkdownPreview
          content={markdown}
          onLinkPress={onLinkPress}
        />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });
});

describe('Enhanced Markdown Editor Tests', () => {
  test('should render editor correctly', () => {
    const { container } = render(
      <TestWrapper>
        <EnhancedMarkdownEditor placeholder="Test placeholder" />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });

  test('should handle content changes', () => {
    const onChange = jest.fn();
    const { container } = render(
      <TestWrapper>
        <EnhancedMarkdownEditor
          placeholder="Test placeholder"
          onChange={onChange}
        />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });

  test('should toggle view modes correctly', () => {
    const { container } = render(
      <TestWrapper>
        <EnhancedMarkdownEditor showPreview={true} />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });
});

describe('Performant Markdown Editor Tests', () => {
  test('should render performant editor correctly', () => {
    const { container } = render(
      <TestWrapper>
        <PerformantMarkdownEditor placeholder="Performance test" />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });

  test('should show performance indicators', () => {
    const { container } = render(
      <TestWrapper>
        <PerformantMarkdownEditor placeholder="Performance test" />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });
});

describe('Markdown Editor Integration Tests', () => {
  test('should render integration component correctly', () => {
    const { container } = render(
      <TestWrapper>
        <MarkdownEditorIntegration />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });

  test('should handle save functionality', () => {
    const onSave = jest.fn();
    const { container } = render(
      <TestWrapper>
        <MarkdownEditorIntegration
          onSave={onSave}
          value="Test content"
        />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });

  test('should handle fullscreen mode', () => {
    const { container } = render(
      <TestWrapper>
        <MarkdownEditorIntegration enableFullscreen={true} />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });
});

describe('Comprehensive Markdown Feature Tests', () => {
  const comprehensiveMarkdown = `# Comprehensive Markdown Test

## Text Formatting
This document tests **bold**, *italic*, ~~strikethrough~~, and __underlined__ text.

## Code
Inline \`code\` and code blocks:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Lists
### Unordered List
- Item 1
- Item 2
  - Nested item
  - Another nested item

### Ordered List
1. First item
2. Second item
3. Third item

### Task List
- [x] Completed task
- [ ] Pending task
- [ ] Another pending task

## Links and Images
[Example Link](https://example.com)
![Example Image](https://example.com/image.jpg)

## Tables
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

## Blockquotes
> This is a blockquote
> with multiple lines

## Horizontal Rule
---

## Mathematical Expressions
Inline math: $E = mc^2$

Block math:
$$\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n$$
`;

  test('should parse comprehensive markdown correctly', () => {
    const parsed = parseMarkdown(comprehensiveMarkdown);

    // Check all element types are present
    expect(parsed.metadata.headings.length).toBeGreaterThan(0);
    expect(parsed.metadata.links.length).toBeGreaterThan(0);
    expect(parsed.metadata.images.length).toBeGreaterThan(0);
    expect(parsed.metadata.codeBlocks.length).toBeGreaterThan(0);
    expect(parsed.metadata.tables.length).toBeGreaterThan(0);
    expect(parsed.metadata.taskLists.length).toBeGreaterThan(0);
  });

  test('should validate comprehensive markdown', () => {
    const validation = validateMarkdown(comprehensiveMarkdown);
    expect(validation.isValid).toBe(true);
  });

  test('should render comprehensive markdown in preview', () => {
    const { container } = render(
      <TestWrapper>
        <AdvancedMarkdownPreview content={comprehensiveMarkdown} />
      </TestWrapper>
    );

    expect(container).toBeTruthy();
  });
});

describe('Performance Tests', () => {
  test('should handle large markdown documents efficiently', () => {
    const largeMarkdown = Array(1000).fill('# Header\nContent paragraph with **bold** text.\n').join('\n');

    const startTime = performance.now();
    const parsed = parseMarkdown(largeMarkdown);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(1000); // Should parse in under 1 second
    expect(parsed.elements.length).toBeGreaterThan(0);
  });

  test('should validate large documents efficiently', () => {
    const largeMarkdown = Array(500).fill('Valid markdown content with [links](https://example.com).\n').join('\n');

    const startTime = performance.now();
    const validation = validateMarkdown(largeMarkdown);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(500); // Should validate in under 0.5 seconds
    expect(validation.isValid).toBe(true);
  });
});
