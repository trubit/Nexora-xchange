import { Card, Row, Col, Table, Badge } from "react-bootstrap";
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";
import logoName from "../../assets/logoName.png";
import "../../styles/LiveCryptoHomePage.css";
import TrusonCoins from "./TrusonCoins";
import useLiveCryptoHomePage from "../../hooks/useLiveCryptoHomePage";
import { useAppContext } from "./AppContext";
import {
  formatCompactCurrencyAmount,
  formatPriceAmount,
} from "../../utils/currencyFormat";

// Live crypto dashboard section for the homepage.
const LiveCryptoHomePage = () => {
  const {
    marketCapUsd,
    tradingVolumeUsd,
    exchangeTickers,
    high24hUsd,
    priceUsd,
    volume24hUsd,
    low24hUsd,
    change24h,
    isPositive,
  } = useLiveCryptoHomePage();
  const { currency, rates } = useAppContext();

  return (
    <div className="bg-dark text-white min-vh-100 d-flex flex-column rounded-5">
      <div className="text-center mb-4">
        <img
          src={logoName}
          alt="Truson Exchange Logo"
          className="img-fluid img-style"
        />
      </div>

      <div
        className="container py-0 flex-grow-1 d-flex flex-column"
        style={{ marginTop: "-3rem" }}
      >
        <Card className="border-0 shadow-lg mb-4 p-1 rounded-3">
          <Row className="align-items-center g-3 text-center">
            <Col xs={12} md={2}>
              <Badge bg="dark" className="p-2 fs-5 fw-bold">
                SOL/USDT
              </Badge>
            </Col>
            <Col xs={6} md={2}>
              <small className="text-muted d-block">Best Ask Price</small>
              <h5 className="fw-bold text-success mb-0">
                {formatPriceAmount(priceUsd, currency, rates)}
              </h5>
            </Col>
            <Col xs={6} md={2}>
              <small className="text-muted d-block">24h Change</small>
              <h5 className={isPositive ? "text-success" : "text-danger"}>
                {change24h.toFixed(2)}% {isPositive ? "▲" : "▼"}
              </h5>
            </Col>
            <Col xs={6} md={2}>
              <small className="text-muted d-block">24h Volume</small>
              <h5>{formatCompactCurrencyAmount(volume24hUsd, currency, rates)}</h5>
            </Col>
            <Col xs={6} md={2}>
              <small className="text-muted d-block">High 24h</small>
              <h5>{formatPriceAmount(high24hUsd, currency, rates)}</h5>
            </Col>
            <Col xs={6} md={2}>
              <small className="text-muted d-block">Low 24h</small>
              <h5>{formatPriceAmount(low24hUsd, currency, rates)}</h5>
            </Col>
          </Row>
        </Card>

        <div className="flex-grow-1 d-flex flex-column">
          <Card
            className="bg-dark border-0 shadow-xl flex-grow-1 rounded-4 overflow-hidden"
            style={{ height: "25rem" }}
          >
            <Card.Body className="p-0 h-100">
              <div className="h-100 w-100">
                <AdvancedRealTimeChart
                  symbol="BINANCE:SOLUSDT"
                  theme="dark"
                  interval="1"
                  timezone="Etc/UTC"
                  style="1"
                  locale="en"
                  autosize
                  hide_side_toolbar={false}
                />
              </div>
            </Card.Body>
          </Card>
        </div>

        <Row className="g-4 mt-4">
          <Col xs={12} md={6}>
            <Card
              className="p-3 border-0 text-center shadow-sm rounded-3"
              style={{ background: "brown" }}
            >
              <small className="text-muted">Crypto Market CAP</small>
              <h4 className="fw-bold">
                {formatCompactCurrencyAmount(marketCapUsd, currency, rates)}
              </h4>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card className="p-3 border-0 text-center shadow-sm rounded-3">
              <small className="text-muted">24h Trading Volume</small>
              <h4 className="fw-bold">
                {formatCompactCurrencyAmount(tradingVolumeUsd, currency, rates)}
              </h4>
            </Card>
          </Col>
        </Row>

        <h5 className="text-white mt-4 mb-2">Live Trading - Top Coins</h5>
        <Table hover variant="dark" size="sm">
          <thead>
            <tr>
              <th>Coin</th>
              <th>Price</th>
              <th>24h Change</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            <TrusonCoins />
            {exchangeTickers.map((ticker, index) => (
              <tr key={index}>
                <td>{ticker.name.toUpperCase()}</td>
                <td>{formatPriceAmount(ticker.current_price, currency, rates)}</td>
                <td
                  className={
                    ticker.price_change_percentage_24h > 0
                      ? "text-success"
                      : "text-danger"
                  }
                >
                  {ticker.price_change_percentage_24h.toFixed(2)}%
                </td>
                <td>
                  {formatCompactCurrencyAmount(ticker.total_volume, currency, rates)}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="mt-2 text-center text-white small py-4">
          Powered by <span className="text-success fw-bold">Truson Exchange</span>
          {" • "}Live data
        </div>
      </div>
    </div>
  );
};

export default LiveCryptoHomePage;
