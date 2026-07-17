import { NavLink } from "react-router-dom";
import NexoraBot from "../../assets/truson-x-bot.png";

// Blog display variants used on the blogs page.
export const BlogCarousel = ({ posts, activeIndex, onSelectIndex }) => {
  if (!posts.length) {
    return <div className="blogs-admin-note">No blog posts yet.</div>;
  }

  return (
    <div className="blogs-carousel">
      <div
        className="blogs-track"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {posts.map((post) => {
          const slugOrId = post?.slug || post?.id || post?._id;
          const detailLink = slugOrId ? `/blogs/${slugOrId}` : post.link;
          
          return (
            <div className="blogs-slide" key={post.id || slugOrId}>
              <NavLink
                to={detailLink || "/blogs"}
                className="blogs-feature-link"
                aria-label={`Open ${post.title}`}
              >
                <article className="blogs-feature-card">
                  <div
                    className="blogs-feature-media"
                    style={{ "--media-image": `url(${post.image || NexoraBot})` }}
                  />
                  <div className="blogs-feature-body">
                    {post.tag ? (
                      <span className="blogs-feature-tag">{post.tag}</span>
                    ) : null}
                    <h3 className="blogs-feature-title">{post.title}</h3>
                    <p className="blogs-feature-description">
                      {post.description}
                    </p>
                    {post.date ? (
                      <p className="blogs-feature-date">{post.date}</p>
                    ) : null}
                  </div>
                </article>
              </NavLink>
            </div>
          );
        })}
      </div>

      <div className="blogs-dots">
        {posts.map((post, index) => (
          <button
            key={post.id || index}
            type="button"
            className={`blogs-dot ${index === activeIndex ? "active" : ""}`}
            onClick={() => onSelectIndex?.(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export const BlogGrid = ({ posts }) => {
  if (!posts.length) {
    return <div className="blogs-admin-note">No blog posts yet.</div>;
  }

  return (
    <div className="blogs-grid">
      {posts.map((post) => {
        const slugOrId = post?.slug || post?.id || post?._id;
        const detailLink = slugOrId ? `/blogs/${slugOrId}` : post.link;

        return (
        <NavLink
          to={detailLink || "/blogs"}
          className="blogs-grid-link"
          aria-label={`Open ${post.title}`}
          key={post.id || slugOrId}
        >
          <article className="blogs-grid-card">
            <div
              className="blogs-grid-media"
              style={{ "--media-image": `url(${post.image || NexoraBot})` }}
            >
              {post.tag ? (
                <span className="blogs-grid-tag">{post.tag}</span>
              ) : null}
            </div>
            <div className="blogs-grid-body">
              <h3 className="blogs-grid-title">{post.title}</h3>
              <p className="blogs-grid-description">{post.description}</p>
              {post.date ? <p className="blogs-date">{post.date}</p> : null}
            </div>
          </article>
        </NavLink>
        );
      })}
    </div>
  );
};
