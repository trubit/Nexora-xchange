import { Button } from "react-bootstrap";
import { EmptyState, Skeleton } from "./DashShared";
import { fmtCrypto, fmtUsd } from "./dashUtils";
import CoinLogo from "../common/CoinLogo";

const DashWallets = ({ isLoading, wallets, onRefetch, onTrade }) => (
  <>
    <div className="dash-section-head">
      <span className="dash-section-title">Asset Balances</span>
      <button className="dash-refresh-btn" onClick={onRefetch}>
        <i className="bi bi-arrow-clockwise" /> Refresh
      </button>
    </div>

    {isLoading ? (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {[0, 1, 2].map((k) => <Skeleton key={k} />)}
      </div>
    ) : wallets.length === 0 ? (
      <EmptyState
        icon="wallet2"
        text="No wallets yet. Make a trade to create your first asset wallet."
        action={
          <Button variant="warning" size="sm" style={{ background: "#f0b90b", border: "none", color: "#000", fontWeight: 700 }} onClick={onTrade}>
            Start Trading
          </Button>
        }
      />
    ) : (
      <div className="dash-asset-table-wrap">
        <table className="dash-asset-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Total Balance</th>
              <th>Available</th>
              <th>In Order</th>
              <th>USD Value</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((w) => (
              <tr key={w._id}>
                <td>
                  <div className="dash-asset-coin">
                    <CoinLogo symbol={w.asset || "?"} size={36} />
                    <div>
                      <div className="dash-asset-name">{w.asset}</div>
                      <div className="dash-asset-full">{w.assetName || w.asset}</div>
                    </div>
                  </div>
                </td>
                <td className="dash-asset-bal">{fmtCrypto(w.balance)}</td>
                <td className="dash-asset-muted">{fmtCrypto(w.available)}</td>
                <td className="dash-asset-muted">{fmtCrypto(w.locked)}</td>
                <td className="dash-asset-usd">{fmtUsd(w.balanceUsdt)}</td>
                <td>
                  <button className="dash-trade-link" onClick={onTrade}>Trade</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </>
);

export default DashWallets;
