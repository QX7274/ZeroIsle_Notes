jest.mock('../../api/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

jest.mock('../../analytics/analyticsService', () => ({
  __esModule: true,
  default: {
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  },
}));

const apiClient = require('../../api/apiClient').default;
const mindMapService = require('../mindMapService').default;
const textAnalysisService = require('../textAnalysis').default;

describe('AI services use the imported apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates a mind map through apiClient', async () => {
    apiClient.post.mockResolvedValue({ data: { id: 'mind-map-1' } });

    await expect(mindMapService.generateFromText('项目计划')).resolves.toEqual({ id: 'mind-map-1' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/mind-map/generator/generate/text/',
      expect.objectContaining({ text: '项目计划' }),
    );
  });

  test('extracts keywords through apiClient', async () => {
    apiClient.post.mockResolvedValue({ data: { keywords: ['项目'] } });

    await expect(textAnalysisService.extractKeywords('项目计划')).resolves.toEqual(['项目']);
    expect(apiClient.post).toHaveBeenCalledWith('/ai/text/keywords', {
      text: '项目计划',
      limit: 10,
    });
  });
});
