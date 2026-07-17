const LikeButton = ({ likes, onLike, loading, error }) => (
  <section className="crypto-sidebar-section crypto-like-section">
    <button
      type="button"
      className="crypto-like-button"
      onClick={onLike}
      disabled={loading}
      aria-label={`Like this post (${likes} likes)`}
    >
      <i className="bi bi-heart-fill" aria-hidden="true" />
    </button>
    <p className="crypto-like-count">
      {likes} {likes === 1 ? "like" : "likes"}
    </p>
    {error ? <p className="crypto-inline-error">{error}</p> : null}
  </section>
);

export default LikeButton;
