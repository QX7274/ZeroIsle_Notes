jest.mock('../../../services/api/communityApi', () => ({
  __esModule: true,
  default: {
    getPosts: jest.fn(),
    getPostDetail: jest.fn(),
    getPostComments: jest.fn(),
    togglePostLike: jest.fn(),
    addComment: jest.fn(),
    createPost: jest.fn(),
    toggleFollow: jest.fn(),
    toggleCommentLike: jest.fn(),
    getUserFollowers: jest.fn(),
    getUserFollowing: jest.fn(),
    getUserNotifications: jest.fn(),
    markNotificationAsRead: jest.fn(),
    markAllNotificationsAsRead: jest.fn(),
    getActivityStream: jest.fn(),
  },
}));

import reducer, {
  fetchPosts,
  likePost,
  toggleBookmark,
  clearError,
} from '../communitySlice';

describe('communitySlice basic regressions', () => {
  it('writes posts and pagination on fetchPosts.fulfilled', () => {
    const payload = {
      posts: [{ id: 1, title: 'Post A', likes: 0, comments: 0 }],
      pagination: { page: 1, totalPages: 3, totalItems: 25 },
    };
    const next = reducer(undefined, fetchPosts.fulfilled(payload, 'req-1'));
    expect(next.posts).toEqual(payload.posts);
    expect(next.pagination).toEqual(payload.pagination);
    expect(next.isLoading).toBe(false);
  });

  it('optimistically updates and then rolls back likes on likePost.rejected', () => {
    const withPosts = reducer(
      undefined,
      fetchPosts.fulfilled(
        {
          posts: [{ id: 10, title: 'P', likes: 2, comments: 0 }],
          pagination: { page: 1, totalPages: 1, totalItems: 1 },
        },
        'req-seed'
      )
    );

    const pending = reducer(withPosts, likePost.pending('req-like', { postId: 10, liked: true }));
    expect(pending.likedPosts[10]).toBe(true);
    expect(pending.posts[0].likes).toBe(3);

    const rolledBack = reducer(
      pending,
      likePost.rejected(null, 'req-like', { postId: 10, liked: true }, 'network fail')
    );
    expect(rolledBack.likedPosts[10]).toBe(false);
    expect(rolledBack.posts[0].likes).toBe(2);
    expect(rolledBack.error).toBe('network fail');
  });

  it('toggles bookmark and clears error via reducers', () => {
    const withBookmark = reducer(undefined, toggleBookmark(9));
    expect(withBookmark.bookmarkedPosts[9]).toBe(true);

    const withError = { ...withBookmark, error: 'x' };
    const cleared = reducer(withError, clearError());
    expect(cleared.error).toBeNull();
  });
});
