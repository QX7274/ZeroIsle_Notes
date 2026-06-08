const normalizeCount = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
};

export const resolvePostDetailCommentStats = ({ post, commentsPagination, comments }) => {
  const totalCommentCount = normalizeCount(post?.comments ?? post?.comment_count);
  const topLevelCommentCount = normalizeCount(commentsPagination?.totalItems ?? comments?.length);

  return {
    totalCommentCount: Math.max(totalCommentCount, topLevelCommentCount),
    topLevelCommentCount,
  };
};

export default resolvePostDetailCommentStats;
