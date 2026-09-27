jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        text: '#111827',
        border: '#D1D5DB',
        primary: '#2563EB',
        secondary: '#7C3AED',
      },
      dimensions: {
        FONT_SIZE: { MEDIUM: 16, SMALL: 12, LARGE: 18, XLARGE: 22, XSMALL: 10 },
        LINE_HEIGHT: { MEDIUM: 24 },
        SPACING: { XSMALL: 2, SMALL: 4, MEDIUM: 8, LARGE: 16 },
        BORDER_RADIUS: { SMALL: 4, MEDIUM: 8 },
      },
    },
  }),
}));

jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ children }) => React.createElement(Text, null, children);
});

const React = require('react');
const { render } = require('@testing-library/react-native');
const MarkdownPreview = require('../MarkdownPreview').default;

describe('MarkdownPreview', () => {
  test('renders an explicit empty state when content is empty', () => {
    const { getByText } = render(React.createElement(MarkdownPreview, { content: '' }));

    expect(getByText('没有内容')).toBeTruthy();
  });
});
