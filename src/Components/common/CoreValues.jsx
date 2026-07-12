import { Col, Container, Row } from "react-bootstrap";
import allImg from "../../assets/all.png";
import customerServiceImg from "../../assets/customer service.png";
import focusImg from "../../assets/focus.png";
import secureImg from "../../assets/scure.png";
import transparentImg from "../../assets/transparent.png";
import userImg from "../../assets/user.png";

const values = [
  {
    icon: userImg,
    title: "User-Centric",
    description:
      "Our platform is built for users — every feature is designed to empower, simplify, and enhance the digital asset experience.",
  },
  {
    icon: focusImg,
    title: "Future-Focused Innovation",
    description:
      "We continuously introduce modern trading tools, automation, and AI-driven insights to stay ahead in a rapidly evolving financial landscape.",
  },
  {
    icon: transparentImg,
    title: "Transparent By Design",
    description:
      "We believe in open operations. Clear fee structures, verifiable transactions, and real-time insights build trust across our ecosystem.",
  },
  {
    icon: secureImg,
    title: "Trustworthy & Secure",
    description:
      "We uphold military-grade security standards and real-time support to ensure your funds, data, and identity are always protected.",
  },
  {
    icon: allImg,
    title: "Inclusive For All",
    description:
      "Whether you're a first-time crypto user or a pro trader, Nexora offers intuitive tools and support for every journey.",
  },
  {
    icon: customerServiceImg,
    title: "24/7 Customer Service",
    description:
      "Our support team is available 24/7 to assist you. Email us at support@nexora.io anytime. For instant help, use our live chat widget.",
  },
];

const CoreValues = () => {
  return (
    <section className="core-values">
      <Container fluid="xxl" className="core-values__container">
        <h2 className="core-values__title">Nexora Core Values</h2>
        <Row className="core-values__grid g-4">
          {values.map((value) => (
            <Col key={value.title} xs={12} md={6} xl={4}>
              <article className="core-values__item">
                <img
                  src={value.icon}
                  alt=""
                  aria-hidden="true"
                  className="core-values__icon"
                />
                <div className="core-values__copy">
                  <h3 className="core-values__item-title">{value.title}</h3>
                  <p className="core-values__item-text">{value.description}</p>
                </div>
              </article>
            </Col>
          ))}
        </Row>
      </Container>
    </section>
  );
};

export default CoreValues;
