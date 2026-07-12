import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../api/queryKeys";
import { listBlogs } from "../../services/api/blogs";

const getTimestamp = (value) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getSortValue = (post) => {
  if (typeof post?.updatedAt === "number") return post.updatedAt;
  return getTimestamp(post?.updatedAt || post?.createdAt || post?.date);
};

export const getVisiblePosts = (posts = []) => {
  const blockedTitles = new Set(
    [
      "Arbitrage Bot: Never Miss a Risk-Free Spread Again",
      "Nexora Golden XBot: Powering Smarter Trades with 50+ Trading Pair Signals",
    ].map((title) => title.toLowerCase()),
  );

  const filtered = posts.filter(
    (post) =>
      post &&
      post.title &&
      post.title.trim() &&
      !blockedTitles.has(post.title.toLowerCase()) &&
      post.description &&
      post.description.trim(),
  );

  return [...filtered].sort((a, b) => getSortValue(b) - getSortValue(a));
};

export const useBlogPostsQuery = (params = { limit: 50, sort: "-updatedAt" }) => {
  const query = useQuery({
    queryKey: queryKeys.blogs.list(params),
    queryFn: async () => {
      const payload = await listBlogs(params);
      return payload?.posts || [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    ...query,
    posts: query.data || [],
    visiblePosts: getVisiblePosts(query.data || []),
  };
};

