/**
 * Parses a search query to separate the main query text from advanced operators.
 * Supported operators: tag:#<tag>, is:<type>, linked-to:[[<note title>]]
 *
 * @param {string} query The full search query.
 * @returns {{mainQuery: string, operators: {tag?: string, is?: string, linkedTo?: string}}}
 */
export const parseSearchQuery = (query) => {
  const operators = {};
  let mainQuery = query;

  // Regex to find operators
  const operatorRegex = /(tag:#(\S+)|is:(\S+)|linked-to:\[\[(.*?)\]\])/g;

  let match;
  while ((match = operatorRegex.exec(query)) !== null) {
    const fullMatch = match[0];
    if (match[2]) { // tag:#<tag>
      operators.tag = match[2];
    } else if (match[3]) { // is:<type>
      operators.is = match[3];
    } else if (match[4]) { // linked-to:[[<note title>]]
      operators.linkedTo = match[4];
    }
    // Remove the operator from the main query string
    mainQuery = mainQuery.replace(fullMatch, '').trim();
  }

  return { mainQuery, operators };
};

