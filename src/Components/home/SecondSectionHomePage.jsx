import { Container } from "react-bootstrap";
import ExchangesSection from "../common/ExchangesSection";
import "../../styles/SecondSectionHomePage.css";
import { Link } from "react-router-dom";
import { useBlogPosts } from "../../hooks/useBlogPosts";
import NexoraBot from "../../assets/truson-x-bot.png";

const stripHtml = (value) =>
  (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const createExcerpt = (value, limit = 120) => {
  const plain = stripHtml(value);
  if (!plain) return "";
  if (plain.length <= limit) return plain;
  return `${plain.slice(0, limit).trim()}...`;
};

// Homepage section showing the latest blog updates.
const SecondSectionHomePage = () => {
  const { visiblePosts } = useBlogPosts();
  const latestPosts = visiblePosts.slice(0, 4);

  return (
    <>
      <div className="recent-updates-section">
        <Container fluid="xxl">
          <div className="updates-shell">
            <div className="updates-header">
              <div>
                <p className="transform-text">Transform your crypto investments</p>
                <h2 className="updates-title">Recent Updates</h2>
                <p className="updates-subtitle">
                  Stay current with the latest product improvements, compliance
                  wins, and trading upgrades from Nexora.
                </p>
              </div>
              <Link to="/Blogs" className="updates-link">
                Explore all updates
              </Link>
            </div>

            <div className="updates-grid">
              {latestPosts.map((post, index) => {
                const slugOrId = post?.slug || post?.id || post?._id;
                const detailLink = slugOrId ? `/blogs/${slugOrId}` : post.link;
                const imageSource = post.image || NexoraBot;
                const imageAlt =
                  post.imageAlt || post.title || `Update ${index + 1}`;
                const excerpt = post.excerpt || createExcerpt(post.description);
                const displayDate = post.date || "Latest update";

                return (
                  <Link
                    key={slugOrId || index}
                    to={detailLink || "/blogs"}
                    className="updates-card"
                    style={{ "--card-image": `url(${imageSource})` }}
                  >
                    <div className="updates-card-media" aria-hidden="true">
                      <span className="updates-tag">{post.tag || "Update"}</span>
                    </div>
                    <div className="updates-card-body">
                      <h3 className="updates-card-title">{post.title}</h3>
                      <p className="updates-card-description">{excerpt}</p>
                      <div className="updates-card-footer">
                        <span className="updates-card-date">{displayDate}</span>
                        <span className="updates-card-cta">Read update</span>
                      </div>
                    </div>
                    <span className="visually-hidden">{imageAlt}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </Container>
      </div>
      <ExchangesSection />
    </>
  );
};

export default SecondSectionHomePage;
