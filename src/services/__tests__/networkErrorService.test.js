import networkErrorService from '../networkErrorService';

describe('networkErrorService', () => {
  it('treats offline precheck errors as network errors', () => {
    expect(networkErrorService.isNetworkError({ isOfflineError: true })).toBe(true);
    expect(networkErrorService.isNetworkError({ offline: true })).toBe(true);
  });

  it('does not classify HTTP responses as pure network errors', () => {
    expect(networkErrorService.isNetworkError({
      response: { status: 400 },
      message: 'validation failed',
    })).toBe(false);
  });
});
