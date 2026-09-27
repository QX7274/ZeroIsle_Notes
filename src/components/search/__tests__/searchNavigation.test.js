import {
  shouldAutoNavigateSearch,
  shouldNavigateHomeSearch,
} from '../searchNavigation';

describe('search navigation policy', () => {
  test('keeps an empty home result visible in the search results empty state', () => {
    expect(shouldNavigateHomeSearch({ query: 'zzzzz' })).toBe(true);
  });

  test('does not navigate home when the query is blank', () => {
    expect(shouldNavigateHomeSearch({ query: '   ' })).toBe(false);
  });

  test('does not auto-navigate when the page owns the search callback', () => {
    expect(shouldAutoNavigateSearch({
      query: 'zzzzz',
      results: [],
      hasOnSearch: true,
      disableAutoNavigate: false,
    })).toBe(false);
  });
});
