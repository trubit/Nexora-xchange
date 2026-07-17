const RelatedPosts = ({ posts, loading, error, activeId, onSelect }) => {
  if (loading) {
    return (
      <section className="crypto-sidebar-section">
        <p className="crypto-section-label">Related Posts</p>
        <p className="crypto-inline-note">Loading…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="crypto-sidebar-section">
        <p className="crypto-section-label">Related Posts</p>
        <p className="crypto-inline-error">{error}</p>
      </section>
    );
  }

  if (!posts.length) return null;

  return (
    <section className="crypto-sidebar-section">
      <p className="crypto-section-label crypto-related-header">Related Posts</p>
      <div className="crypto-related-list">
        {posts.map((post) => {
          const id = post?.slug || post?.id || post?._id;
          const isActive = String(id) === String(activeId);
          const imgSrc = post?.imageUrl || post?.image || "";

          return (
            <article
              key={id}
              className={`crypto-post-card${isActive ? " is-active" : ""}`}
              onClick={() => onSelect?.(post)}
              role="button"
              tabIndex={0}
              aria-label={`Read: ${post.title}`}
              onKeyDown={(e) => e.key === "Enter" && onSelect?.(post)}
            >
              <div className="crypto-post-visual">
                {imgSrc ? (
                  <img src={imgSrc} alt={post.imageAlt || post.title} />
                ) : (
                  <div className="crypto-post-fallback" />
                )}
                {post.tag ? (
                  <span className="crypto-post-tag">{post.tag}</span>
                ) : null}
              </div>
              <div className="crypto-post-content">
                <h4>{post.title}</h4>
                <p>{post.excerpt || post.description}</p>
                {post.displayDate ? (
                  <span className="crypto-post-meta">{post.displayDate}</span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RelatedPosts;
