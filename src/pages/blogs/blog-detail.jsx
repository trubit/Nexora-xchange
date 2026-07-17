import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container, Row, Col, Alert, Spinner } from "react-bootstrap";
import MiniHeader from "../../Components/layout/mini-header";
import MainPost from "../../Components/common/MainPost.jsx";
import Sidebar from "../../Components/layout/Sidebar.jsx";
import { getPost } from "../../services/api/posts";
import { queryKeys } from "../../api/queryKeys";

import "../../styles/blog-detail.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const BlogDetail = () => {
  const { id } = useParams();

  const { data: post, isLoading, error } = useQuery({
    queryKey: queryKeys.blogs.detail(id),
    queryFn: () => getPost(id),
    enabled: Boolean(id),
  });

  return (
    <>
      <MiniHeader />
      <section className="blog-detail-page">
        <Container fluid="xl">
          <Row className="g-4">
            <Col lg={8}>
              {isLoading && (
                <Alert variant="info" className="blog-alert">
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Loading blog post...
                </Alert>
              )}
              {error && (
                <Alert variant="danger" className="blog-alert">
                  {error.message || "Failed to load blog post."}
                </Alert>
              )}
              {post && <MainPost post={post} isFading={false} />}
            </Col>
            <Col lg={4}>
              <Sidebar postId={id} />
            </Col>
          </Row>
        </Container>
      </section>
    </>
  );
};

export default BlogDetail;
