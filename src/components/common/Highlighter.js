/**
 * Local Highlighter component to replace react-native-highlight-words
 * Avoids deprecated Text.propTypes usage that breaks on modern RN.
 */
import React from 'react';
import { Text } from 'react-native';
import PropTypes from 'prop-types';
import { findAll } from 'highlight-words-core';

const Highlighter = ({
  autoEscape = false,
  highlightStyle,
  searchWords,
  textToHighlight,
  sanitize,
  style,
  ...props
}) => {
  const chunks = findAll({ textToHighlight, searchWords, sanitize, autoEscape });

  return (
    <Text style={style} {...props}>
      {chunks.map((chunk, index) => {
        const text = textToHighlight.substr(chunk.start, chunk.end - chunk.start);
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

