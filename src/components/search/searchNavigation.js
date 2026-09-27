export const hasSearchQuery = (query) => (
  typeof query === 'string' && query.trim().length > 0
);

export const shouldNavigateHomeSearch = ({ query } = {}) => (
  hasSearchQuery(query)
);

export const shouldAutoNavigateSearch = ({
  query,
  results,
  hasOnSearch = false,
  disableAutoNavigate = false,
} = {}) => (
  !hasOnSearch
  && !disableAutoNavigate
  && hasSearchQuery(query)
  && Array.isArray(results)
);
