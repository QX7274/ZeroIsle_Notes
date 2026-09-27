const fs = require('fs');
const path = require('path');

describe('Android developer build contract', () => {
  test('keeps the debug variant debuggable for yarn android developer entry', () => {
    const buildGradle = fs.readFileSync(
      path.join(process.cwd(), 'android', 'app', 'build.gradle'),
      'utf8',
    );

    expect(buildGradle).toMatch(/debuggableVariants\s*=\s*\[\s*["']debug["']\s*\]/);
  });
});
