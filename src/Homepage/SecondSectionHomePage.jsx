import { Container } from "react-bootstrap";
import "../styles/SecondSectionHomePage.css";
import { Link } from "react-router-dom";
import { useBlogPosts } from "../hooksJavascript/useBlogPosts";
import TrusonXBot from "../assets/truson-x-bot.png";

// Optional backend fetch (uncomment when ready)
// import { useEffect, useState } from "react";

// Homepage section showing the latest blog updates.
const SecondSectionHomePage = () => {
  const { visiblePosts } = useBlogPosts();
  const latestPosts = visiblePosts.slice(0, 4);

  // Optional backend fetch (uncomment when ready)
  // const [apiPosts, setApiPosts] = useState([]);
  // const BLOGS_API_URL = `${
  //   import.meta.env.VITE_TRUSON_API_URL
  // }/api/blogs?limit=4&sort=-updatedAt`;
  //
  // useEffect(() => {
  //   const controller = new AbortController();
  //
  //   const loadPosts = async () => {
  //     try {
  //       const response = await fetch(BLOGS_API_URL, {
  //         signal: controller.signal,
  //       });
  //       if (!response.ok) {
  //         return;
  //       }
  //       const data = await response.json();
  //       const posts = Array.isArray(data?.posts) ? data.posts : data;
  //       setApiPosts(Array.isArray(posts) ? posts.slice(0, 4) : []);
  //     } catch (error) {
  //       if (error.name !== "AbortError") {
  //         // ignore fetch errors for now
  //       }
  //     }
  //   };
  //
  //   loadPosts();
  //   return () => controller.abort();
  // }, []);
  //
  // const latestPosts = apiPosts.length ? apiPosts : visiblePosts.slice(0, 4);

  return (
    <div className="recent-updates-section">
      <Container fluid="xxl">
        <div className="updates-header">
          <div>
            <p className="transform-text">TRANSFORM YOUR CRYPTO INVESTMENTS</p>
            <h2 className="updates-title">Recent Updates</h2>
            <p className="updates-subtitle">
              Stay current with the latest product improvements, compliance
              wins, and trading upgrades from TrusonXchanger.
            </p>
          </div>
          <Link to="/Blogs" className="updates-link">
            View all updates
          </Link>
        </div>

        <div className="updates-grid">
          {latestPosts.map((post, index) => {
            const imageSource = post.image || TrusonXBot;
            const imageAlt =
              post.imageAlt || post.title || `Update ${index + 1}`;

            return (
              <Link
                key={post.id}
                to={post.link}
                className="updates-card"
                style={{ "--card-image": `url(${imageSource})` }}
              >
                <div className="updates-card-media" aria-hidden="true">
                  <span className="updates-tag">
                    {post.tag || "Update"}
                  </span>
                </div>
                <div className="updates-card-body">
                  <h3 className="updates-card-title">{post.title}</h3>
                  <p className="updates-card-description">
                    {post.description}
                  </p>
                  <span className="updates-card-date">
                    {post.date || "Latest update"}
                  </span>
                </div>
                <span className="visually-hidden">{imageAlt}</span>
              </Link>
            );
          })}
        </div>
      </Container>
    </div>
  );
};

export default SecondSectionHomePage;
