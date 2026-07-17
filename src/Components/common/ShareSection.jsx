const SHARE_LINKS = [
  {
    key: "twitter",
    icon: "bi-twitter-x",
    label: "Share on X",
    href: (url, title) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: "facebook",
    icon: "bi-facebook",
    label: "Share on Facebook",
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "linkedin",
    icon: "bi-linkedin",
    label: "Share on LinkedIn",
    href: (url, title) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    key: "telegram",
    icon: "bi-telegram",
    label: "Share on Telegram",
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
];

const ShareSection = ({ post }) => {
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const title = post?.title || "Check this out";

  return (
    <section className="crypto-sidebar-section">
      <p className="crypto-section-label">Share</p>
      <div className="crypto-share-icons">
        {SHARE_LINKS.map(({ key, icon, label, href }) => (
          <a
            key={key}
            href={href(pageUrl, title)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
          >
            <i className={`bi ${icon}`} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
};

export default ShareSection;
