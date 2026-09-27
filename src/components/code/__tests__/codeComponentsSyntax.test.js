const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const componentFiles = ['CodeEditor.js', 'CodeRunner.js'];

describe('code components remain parseable', () => {
  test.each(componentFiles)('%s has valid JSX and JavaScript syntax', (fileName) => {
    const filePath = path.join(__dirname, '..', fileName);
    const source = fs.readFileSync(filePath, 'utf8');

    expect(() => {
      parser.parse(source, {
        sourceType: 'module',
        plugins: ['jsx'],
      });
    }).not.toThrow();
  });
});
