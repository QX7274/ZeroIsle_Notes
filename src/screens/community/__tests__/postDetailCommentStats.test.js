import { resolvePostDetailCommentStats } from '../postDetailCommentStats';

describe('resolvePostDetailCommentStats', () => {
  it('prefers the post total comment count when it is larger than the top-level comment page total', () => {
    const result = resolvePostDetailCommentStats({
      post: {
        comments: 14,
      },
      commentsPagination: {
        totalItems: 12,
      },
      comments: new Array(10).fill(null),
    });

    expect(result).toEqual({
      totalCommentCount: 14,
      topLevelCommentCount: 12,
    });
  });

  it('falls back to the fetched top-level comment total when post detail is missing the comment count', () => {
    const result = resolvePostDetailCommentStats({
      post: null,
      commentsPagination: {
        totalItems: 6,
      },
      comments: new Array(6).fill(null),
    });

    expect(result).toEqual({
      totalCommentCount: 6,
      topLevelCommentCount: 6,
    });
  });
});
