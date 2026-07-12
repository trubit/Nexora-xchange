import { useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { QuestionCircle, ChevronDown } from "react-bootstrap-icons";
import "../../styles/FAQSection.css";

const faqData = [
  {
    question: "What is Nexora.io?",
    answer:
      "Nexora is a modern cryptocurrency trading platform designed to help users buy, sell, and manage digital assets efficiently. It provides advanced trading tools, real-time market data, and seamless execution across multiple exchanges.",
  },
  {
    question: "What fees should I expect on a cryptocurrency exchange?",
    answer:
      "Nexora offers competitive and transparent fees, including low trading fees, minimal withdrawal charges, and no hidden costs. Fees may vary slightly depending on the transaction type and market conditions.",
  },
  {
    question: "How do I deposit and withdraw funds?",
    answer:
      "You can deposit funds using bank transfers, cards, or supported crypto wallets. Withdrawals are processed securely to your selected wallet or account with a simple request process through your dashboard.",
  },
  {
    question: "How quickly are transactions processed on the exchange?",
    answer:
      "Transactions on Nexora are processed in real-time or near-instantly, depending on network conditions and the selected asset. The platform is optimised for speed and efficiency.",
  },
  {
    question: "Does Nexora offer customer support?",
    answer:
      "Yes, Nexora provides reliable customer support through multiple channels, including live chat and email, ensuring quick resolution of user issues and inquiries.",
  },
  {
    question: "What types of cryptocurrencies can I trade on Nexora?",
    answer:
      "Nexora supports a wide range of cryptocurrencies, including major coins like Bitcoin (BTC), Ethereum (ETH), and stablecoins, along with a growing list of altcoins.",
  },
  {
    question: "How do I ensure the security of my funds on the exchange?",
    answer:
      "Nexora uses advanced security measures such as encryption, secure wallets, and authentication systems to protect user funds and data. Users are also encouraged to enable additional security features.",
  },
  {
    question: "What should I do if I have issues with my account?",
    answer:
      "If you encounter any issues, you can contact the Nexora support team directly through the platform. The support team is available to assist with account access, transactions, and technical concerns.",
  },
  {
    question: "Are there trading limits on Nexora?",
    answer:
      "Trading limits may vary based on account level and verification status. Higher limits are available for verified users to support larger transactions.",
  },
  {
    question: "Can I use Nexora from any country?",
    answer:
      "Nexora is accessible in many regions worldwide. However, availability may vary depending on local regulations and compliance requirements.",
  },
];

const leftItems = faqData.slice(0, 5);
const rightItems = faqData.slice(5, 10);

const FAQItem = ({ item, isOpen, onToggle }) => (
  <div className={`faq-item ${isOpen ? "faq-open" : ""}`}>
    <button
      className="faq-question"
      onClick={onToggle}
      aria-expanded={isOpen}
      type="button"
    >
      <span className="faq-qicon" aria-hidden="true">
        <QuestionCircle />
      </span>
      <span className="faq-qtext">{item.question}</span>
      <span className="faq-arrow" aria-hidden="true">
        <ChevronDown />
      </span>
    </button>
    <div
      className="faq-answer"
      style={{
        maxHeight: isOpen ? "400px" : "0px",
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div className="faq-answer-inner">{item.answer}</div>
    </div>
  </div>
);

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const handleToggle = (index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="faq-section" id="faqs">
      <Container className="faq-container">
        <div className="faq-shell">
          <div className="faq-header">
            <div className="faq-label">FAQ</div>
            <h2 className="faq-heading">Frequently asked question</h2>
          </div>

          <Row className="g-4">
            <Col xs={12} lg={6}>
              <div className="faq-col">
                {leftItems.map((item, i) => (
                  <FAQItem
                    key={i}
                    item={item}
                    isOpen={openIndex === i}
                    onToggle={() => handleToggle(i)}
                  />
                ))}
              </div>
            </Col>
            <Col xs={12} lg={6}>
              <div className="faq-col">
                {rightItems.map((item, i) => (
                  <FAQItem
                    key={i + 5}
                    item={item}
                    isOpen={openIndex === i + 5}
                    onToggle={() => handleToggle(i + 5)}
                  />
                ))}
              </div>
            </Col>
          </Row>
        </div>
      </Container>
    </section>
  );
};

export default FAQSection;
