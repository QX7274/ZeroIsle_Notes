/**
 * Local Highlighter component to replace react-native-highlight-words
 * Avoids deprecated Text.propTypes usage that breaks on modern RN.
 */
import React from 'react';
import { Text } from 'react-native';
import PropTypes from 'prop-types';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeWord = (word, sanitize) => {
  const baseWord = typeof word === 'string' ? word : String(word ?? '');
  return sanitize ? sanitize(baseWord) : baseWord;
};

const buildChunks = ({ textToHighlight, searchWords, sanitize, autoEscape }) => {
  const sourceText = typeof textToHighlight === 'string' ? textToHighlight : String(textToHighlight ?? '');
  const normalizedText = sanitize ? sanitize(sourceText) : sourceText;
  const activeWords = (searchWords || [])
    .map((word) => normalizeWord(word, sanitize))
    .filter(Boolean);

  if (!sourceText || activeWords.length === 0) {
    return [{ start: 0, end: sourceText.length, highlight: false }];
  }

  const matches = [];
  activeWords.forEach((word) => {
    const pattern = autoEscape ? escapeRegExp(word) : word;
    if (!pattern) {
      return;
    }

    let regex;
    try {
      regex = new RegExp(pattern, 'gi');
    } catch (error) {
      return;
    }

    let result = regex.exec(normalizedText);
    while (result) {
      const matchText = result[0];
      const start = result.index;
      const end = start + matchText.length;
      if (end > start) {
        matches.push({ start, end });
      }

      if (matchText.length === 0) {
        regex.lastIndex += 1;
      }
      result = regex.exec(normalizedText);
    }
  });

  if (matches.length === 0) {
    return [{ start: 0, end: sourceText.length, highlight: false }];
  }

  matches.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }
    return right.end - left.end;
  });

  const mergedMatches = [];
  matches.forEach((match) => {
    const lastMatch = mergedMatches[mergedMatches.length - 1];
    if (!lastMatch || match.start > lastMatch.end) {
      mergedMatches.push({ ...match });
      return;
    }
    lastMatch.end = Math.max(lastMatch.end, match.end);
  });

  const chunks = [];
  let cursor = 0;
  mergedMatches.forEach((match) => {
    if (match.start > cursor) {
      chunks.push({ start: cursor, end: match.start, highlight: false });
    }
    chunks.push({ start: match.start, end: match.end, highlight: true });
    cursor = match.end;
  });

  if (cursor < sourceText.length) {
    chunks.push({ start: cursor, end: sourceText.length, highlight: false });
  }

  return chunks;
};

const Highlighter = ({
  autoEscape = false,
  highlightStyle,
  searchWords,
  textToHighlight,
  sanitize,
  style,
  ...props
}) => {
  const chunks = buildChunks({ textToHighlight, searchWords, sanitize, autoEscape });

  return (
    <Text style={style} {...props}>
      {chunks.map((chunk, index) => {
        const text = textToHighlight.substring(chunk.start, chunk.end);
        if (!chunk.highlight) {return text;}
        return (
          <Text key={index} style={highlightStyle}>
            {text}
          </Text>
        );
      })}
    </Text>
  );
};

Highlighter.propTypes = {
  autoEscape: PropTypes.bool,
  highlightStyle: PropTypes.any,
  searchWords: PropTypes.arrayOf(PropTypes.string).isRequired,
  textToHighlight: PropTypes.string.isRequired,
  sanitize: PropTypes.func,
  style: PropTypes.any,
};

export default Highlighter;
