import { Container } from "react-bootstrap";
import MiniHeader from "../../Components/layout/mini-header";
import { BlogCarousel, BlogGrid } from "../../Components/common/BlogCards";
import { useBlogPosts } from "../../hooks/useBlogPosts";
import { useBlogs } from "../../hooks/useBlogs";

import "bootstrap-icons/font/bootstrap-icons.css";
import "../../styles/mini-header.css";
import "../../styles/blogs.css";

const Blogs = () => {
  const { visiblePosts, loading, error } = useBlogPosts();
  const carouselPosts = visiblePosts.slice(0, 4);
  const { activeIndex, setActiveIndex } = useBlogs(carouselPosts);

  return (
    <>
      <MiniHeader showBreadcrumb={false} />
      <section className="blogs-page">
        <div className="blogs-hero">
          <Container fluid="xl">
            {loading && (
              <div className="blogs-admin-note">Loading blog posts...</div>
            )}
            {!loading && error && (
              <div className="blogs-admin-note">{error}</div>
            )}
            {!loading && !error && visiblePosts.length === 0 && (
              <div className="blogs-admin-note">No blog posts yet.</div>
            )}
            {!loading && !error && visiblePosts.length > 0 && (
              <>
                <BlogCarousel
                  posts={carouselPosts}
                  activeIndex={activeIndex}
                  onSelectIndex={setActiveIndex}
                />
                <div className="blogs-update-preview">
                  <BlogGrid posts={visiblePosts} />
                </div>
              </>
            )}
          </Container>
        </div>
      </section>
    </>
  );
};

export default Blogs;
