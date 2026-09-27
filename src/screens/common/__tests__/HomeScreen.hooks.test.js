const path = require('path');
const { ESLint } = require('eslint');

test('HomeScreen has no exhaustive-deps errors', async () => {
  const eslint = new ESLint({
    cwd: path.resolve(__dirname, '../../../..'),
  });
  const [result] = await eslint.lintFiles([
    path.resolve(__dirname, '../HomeScreen.js'),
  ]);

  const hookErrors = result.messages.filter(
    ({ ruleId, severity }) => severity === 2 && ruleId === 'react-hooks/exhaustive-deps'
  );

  expect(hookErrors).toEqual([]);
});
