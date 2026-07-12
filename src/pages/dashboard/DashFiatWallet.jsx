import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useFiatStore } from "../../store/fiatStore";
import {
  useFiatWalletQuery,
  useBankAccountsQuery,
  useFiatTransactionsQuery,
  useInitiateDepositMutation,
  useConfirmDepositMutation,
  useWithdrawMutation,
  useWithdrawalFeeQuery,
  useLinkBankAccountMutation,
  useSetPrimaryBankAccountMutation,
  useDeleteBankAccountMutation,
} from "../../api/fiat";
import DashNavbar from "../../Components/layout/DashNavbar";
import DashSidebar from "../../Components/dashboard/DashSidebar";
import "../../styles/dashboard.css";
import "../../styles/fiat.css";

// ── Currency meta ─────────────────────────────────────────────────────────────

const CUR_META = {
  USD: { flag: "🇺🇸", label: "US Dollar",       symbol: "$"  },
  EUR: { flag: "🇪🇺", label: "Euro",             symbol: "€"  },
  NGN: { flag: "🇳🇬", label: "Nigerian Naira",   symbol: "₦"  },
};

const fmt = (currency, amount) => {
  const sym  = CUR_META[currency]?.symbol ?? "";
  const num  = Number(amount ?? 0);
  return `${sym}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const STATUS_ICON = {
  completed:  "bi-check-circle-fill",
  pending:    "bi-clock-fill",
  processing: "bi-arrow-repeat",
  failed:     "bi-x-circle-fill",
  cancelled:  "bi-slash-circle-fill",
  reversed:   "bi-arrow-counterclockwise",
};

// ── Balance cards ─────────────────────────────────────────────────────────────

const BalanceCards = ({ walletData, selectedCurrency, onSelect, frozen }) => (
  <div className="fw-balances">
    {["USD", "EUR", "NGN"].map((cur) => {
      const meta    = CUR_META[cur];
      const balance = walletData?.wallet?.balances?.[cur] ?? 0;
      return (
        <button
          key={cur}
          className={`fw-bal-card${selectedCurrency === cur ? " fw-bal-card--active" : ""}`}
          onClick={() => onSelect(cur)}
        >
          <div className="fw-bal-flag">{meta.flag}</div>
          <div className="fw-bal-label">{meta.label}</div>
          <div className="fw-bal-amount">
            <span className="fw-bal-symbol">{meta.symbol}</span>
            {Number(balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {frozen && (
            <div className="fw-bal-frozen">
              <i className="bi bi-lock-fill" /> Frozen
            </div>
          )}
        </button>
      );
    })}
  </div>
);

// ── Deposit panel ─────────────────────────────────────────────────────────────

const DepositPanel = ({ onClose, selectedCurrency, config }) => {
  const [currency, setCurrency] = useState(selectedCurrency);
  const [amount, setAmount]     = useState("");
  const [status, setStatus]     = useState(null);

  const { pendingDeposit, setPendingDeposit, clearPendingDeposit } = useFiatStore();
  const initiate = useInitiateDepositMutation();
  const confirm  = useConfirmDepositMutation();

  const cfg = config?.[currency];

  const handleInitiate = async (e) => {
    e.preventDefault();
    setStatus(null);
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return setStatus({ t: "err", msg: "Enter a valid amount." });
    try {
      const res = await initiate.mutateAsync({ currency, amount: parsed });
      setPendingDeposit(res);
    } catch (err) {
      setStatus({ t: "err", msg: err?.message || "Failed to initiate deposit." });
    }
  };

  const handleConfirm = async () => {
    setStatus(null);
    try {
      await confirm.mutateAsync(pendingDeposit.txId);
      clearPendingDeposit();
      setAmount("");
      setStatus({ t: "ok", msg: `Deposit of ${fmt(currency, pendingDeposit.amount)} confirmed and credited!` });
    } catch (err) {
      setStatus({ t: "err", msg: err?.message || "Failed to confirm deposit." });
    }
  };

  const handleCancel = () => {
    clearPendingDeposit();
    setAmount("");
    setStatus(null);
  };

  const bankDetails = pendingDeposit?.bankDetails;

  return (
    <div className="fw-panel">
      <div className="fw-panel-head">
        <span className="fw-panel-title">
          <i className="bi bi-bank2" style={{ color: "#f0b90b" }} /> Deposit Fiat
        </span>
        <button className="fw-panel-close" onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      {status && (
        <div className={`fw-alert fw-alert--${status.t === "ok" ? "ok" : "err"}`}>
          <i className={`bi bi-${status.t === "ok" ? "check-circle-fill" : "exclamation-circle-fill"}`} />
          {status.msg}
        </div>
      )}

      {!pendingDeposit ? (
        <form onSubmit={handleInitiate}>
          <div className="fw-field-row">
            <div className="fw-field">
              <label htmlFor="dep-currency">Currency</label>
              <select id="dep-currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">🇺🇸 USD — US Dollar</option>
                <option value="EUR">🇪🇺 EUR — Euro</option>
                <option value="NGN">🇳🇬 NGN — Nigerian Naira</option>
              </select>
            </div>
            <div className="fw-field">
              <label htmlFor="dep-amount">Amount</label>
              <input
                id="dep-amount"
                name="amount"
                type="number"
                step="0.01"
                min={cfg?.minDeposit || 0}
                placeholder={cfg ? `Min ${CUR_META[currency].symbol}${cfg.minDeposit}` : "Amount"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          {cfg && (
            <div className="fw-fee-note">
              <i className="bi bi-info-circle" />
              Deposit fee: <b>Free</b> &nbsp;|&nbsp; Max: {fmt(currency, cfg.maxDeposit)}
            </div>
          )}
          <div style={{ marginTop: "1rem" }}>
            <button
              className="fw-btn fw-btn--primary"
              type="submit"
              disabled={initiate.isPending}
            >
              {initiate.isPending ? (
                <><i className="bi bi-arrow-repeat" style={{ animation: "spin 1s linear infinite" }} /> Processing…</>
              ) : (
                <><i className="bi bi-arrow-right-circle" /> Get Bank Details</>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div className="fw-deposit-card">
            <h4>
              <i className="bi bi-bank" /> Transfer to this account
            </h4>
            {bankDetails && Object.entries(bankDetails).map(([k, v]) => (
              <div className="fw-deposit-row" key={k}>
                <span className="fw-deposit-key">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="fw-deposit-val">{v}</span>
              </div>
            ))}
            <div className="fw-deposit-row">
              <span className="fw-deposit-key">Amount</span>
              <span className="fw-deposit-val fw-deposit-val--amount">
                {fmt(pendingDeposit.currency, pendingDeposit.amount)}
              </span>
            </div>
            <div className="fw-deposit-row">
              <span className="fw-deposit-key">Reference</span>
              <span className="fw-deposit-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                {pendingDeposit.reference}
              </span>
            </div>
            <p className="fw-deposit-note">
              {pendingDeposit.instruction} Use the exact reference number above so your payment is matched automatically.
            </p>
            <div className="fw-deposit-expires">
              <i className="bi bi-clock" /> Expires in {pendingDeposit.expiresInMinutes} minutes
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <button
              className="fw-btn fw-btn--primary"
              onClick={handleConfirm}
              disabled={confirm.isPending}
            >
              {confirm.isPending ? (
                <><i className="bi bi-arrow-repeat" style={{ animation: "spin 1s linear infinite" }} /> Confirming…</>
              ) : (
                <><i className="bi bi-check-circle" /> I've Made the Transfer</>
              )}
            </button>
            <button className="fw-btn fw-btn--ghost" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Withdraw panel ────────────────────────────────────────────────────────────

const WithdrawPanel = ({ onClose, selectedCurrency, bankAccounts, config }) => {
  const [currency, setCurrency]       = useState(selectedCurrency);
  const [amount, setAmount]           = useState("");
  const [bankAccountId, setBankId]    = useState("");
  const [status, setStatus]           = useState(null);

  const withdraw = useWithdrawMutation();
  const { data: feeData } = useWithdrawalFeeQuery(currency, Number(amount) || 0);

  const verified = (bankAccounts ?? []).filter(
    (b) => b.status === "verified" && b.currency === currency,
  );
  const cfg = config?.[currency];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!bankAccountId) return setStatus({ t: "err", msg: "Select a bank account." });
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return setStatus({ t: "err", msg: "Enter a valid amount." });
    try {
      const res = await withdraw.mutateAsync({ bankAccountId, currency, amount: parsed });
      setStatus({
        t: "ok",
        msg: `Withdrawal of ${fmt(currency, res.transaction?.amount)} processed! Ref: ${res.transaction?.txId}`,
      });
      setAmount(""); setBankId("");
    } catch (err) {
      setStatus({ t: "err", msg: err?.message || "Withdrawal failed." });
    }
  };

  return (
    <div className="fw-panel">
      <div className="fw-panel-head">
        <span className="fw-panel-title">
          <i className="bi bi-send-fill" style={{ color: "#f0b90b" }} /> Withdraw Fiat
        </span>
        <button className="fw-panel-close" onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      {status && (
        <div className={`fw-alert fw-alert--${status.t === "ok" ? "ok" : "err"}`}>
          <i className={`bi bi-${status.t === "ok" ? "check-circle-fill" : "exclamation-circle-fill"}`} />
          {status.msg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="fw-field-row">
          <div className="fw-field">
            <label htmlFor="wd-currency">Currency</label>
            <select id="wd-currency" name="currency" value={currency} onChange={(e) => { setCurrency(e.target.value); setBankId(""); }}>
              <option value="USD">🇺🇸 USD — US Dollar</option>
              <option value="EUR">🇪🇺 EUR — Euro</option>
              <option value="NGN">🇳🇬 NGN — Nigerian Naira</option>
            </select>
          </div>
          <div className="fw-field">
            <label htmlFor="wd-amount">Amount</label>
            <input
              id="wd-amount"
              name="amount"
              type="number"
              step="0.01"
              min={cfg?.minWithdrawal || 0}
              placeholder={cfg ? `Min ${CUR_META[currency].symbol}${cfg.minWithdrawal}` : "Amount"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="fw-field">
          <label htmlFor="wd-bank">Destination Bank Account</label>
          {verified.length === 0 ? (
            <div className="fw-alert fw-alert--info" style={{ marginBottom: 0 }}>
              <i className="bi bi-info-circle-fill" />
              No verified {currency} bank accounts. Link one below first.
            </div>
          ) : (
            <select id="wd-bank" name="bankAccountId" value={bankAccountId} onChange={(e) => setBankId(e.target.value)}>
              <option value="">— Select bank account —</option>
              {verified.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} — {b.accountNumberMasked} ({b.accountName})
                  {b.isPrimary ? " ★ Primary" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {feeData && Number(amount) > 0 && (
          <div className="fw-fee-note">
            <i className="bi bi-receipt" />
            Fee: <b>{fmt(currency, feeData.fee)}</b> &nbsp;|&nbsp;
            You receive: <b style={{ color: "#0ecb81" }}>{fmt(currency, feeData.netAmount)}</b>
          </div>
        )}

        <div style={{ marginTop: "1rem" }}>
          <button
            className="fw-btn fw-btn--primary"
            type="submit"
            disabled={withdraw.isPending || verified.length === 0}
          >
            {withdraw.isPending ? (
              <><i className="bi bi-arrow-repeat" style={{ animation: "spin 1s linear infinite" }} /> Processing…</>
            ) : (
              <><i className="bi bi-send" /> Withdraw</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Add bank account modal ────────────────────────────────────────────────────

const AddBankModal = ({ onClose }) => {
  const [form, setForm] = useState({
    accountName: "", accountNumber: "", bankName: "",
    bankCode: "", routingReference: "", currency: "USD", country: "US",
  });
  const [status, setStatus] = useState(null);
  const link = useLinkBankAccountMutation();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    try {
      await link.mutateAsync(form);
      setStatus({ t: "ok", msg: "Bank account linked and auto-verified." });
      setTimeout(onClose, 1200);
    } catch (err) {
      setStatus({ t: "err", msg: err?.message || "Failed to link bank account." });
    }
  };

  return (
    <div className="fw-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fw-modal">
        <div className="fw-modal-head">
          <span className="fw-modal-title">
            <i className="bi bi-plus-circle" style={{ color: "#f0b90b", marginRight: 6 }} />
            Link Bank Account
          </span>
          <button className="fw-panel-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {status && (
          <div className={`fw-alert fw-alert--${status.t === "ok" ? "ok" : "err"}`}>
            <i className={`bi bi-${status.t === "ok" ? "check-circle-fill" : "exclamation-circle-fill"}`} />
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="fw-field">
            <label htmlFor="ab-currency">Currency</label>
            <select id="ab-currency" name="currency" value={form.currency} onChange={(e) => setForm((f) => ({
              ...f,
              currency: e.target.value,
              country: { USD: "US", EUR: "EU", NGN: "NG" }[e.target.value] || "NG",
            }))}>
              <option value="USD">🇺🇸 USD — US Dollar</option>
              <option value="EUR">🇪🇺 EUR — Euro</option>
              <option value="NGN">🇳🇬 NGN — Nigerian Naira</option>
            </select>
          </div>

          <div className="fw-field">
            <label htmlFor="ab-account-name">Account Holder Name</label>
            <input
              id="ab-account-name"
              name="accountName"
              placeholder="Full name on account"
              value={form.accountName}
              onChange={set("accountName")}
              required
            />
          </div>

          <div className="fw-field-row">
            <div className="fw-field">
              <label htmlFor="ab-account-number">Account Number</label>
              <input
                id="ab-account-number"
                name="accountNumber"
                placeholder={form.currency === "EUR" ? "IBAN" : "Account number"}
                value={form.accountNumber}
                onChange={set("accountNumber")}
                required
              />
            </div>
            <div className="fw-field">
              <label htmlFor="ab-bank-name">Bank Name</label>
              <input
                id="ab-bank-name"
                name="bankName"
                placeholder="e.g. Chase Bank"
                value={form.bankName}
                onChange={set("bankName")}
                required
              />
            </div>
          </div>

          <div className="fw-field-row">
            <div className="fw-field">
              <label htmlFor="ab-bank-code">
                {form.currency === "USD" ? "Routing Number" :
                 form.currency === "EUR" ? "BIC / SWIFT" : "Bank Code"}
              </label>
              <input
                id="ab-bank-code"
                name="bankCode"
                placeholder="Optional"
                value={form.bankCode}
                onChange={set("bankCode")}
              />
            </div>
            <div className="fw-field">
              <label htmlFor="ab-country">Country Code</label>
              <input
                id="ab-country"
                name="country"
                placeholder="e.g. US, GB, NG"
                maxLength={3}
                value={form.country}
                onChange={set("country")}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
            <button className="fw-btn fw-btn--primary" type="submit" disabled={link.isPending}>
              {link.isPending ? "Saving…" : <><i className="bi bi-check-lg" /> Save Account</>}
            </button>
            <button className="fw-btn fw-btn--ghost" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Bank accounts section ─────────────────────────────────────────────────────

const BankAccountsSection = () => {
  const { addBankOpen, setAddBankOpen } = useFiatStore();
  const { data, isLoading } = useBankAccountsQuery();
  const setPrimary = useSetPrimaryBankAccountMutation();
  const remove     = useDeleteBankAccountMutation();

  const accounts = data?.bankAccounts ?? [];

  return (
    <div className="fw-section">
      <div className="fw-section-head">
        <span className="fw-section-title">
          <i className="bi bi-credit-card-2-front-fill" style={{ color: "#f0b90b" }} />
          Linked Bank Accounts
        </span>
        <button className="fw-btn fw-btn--outline fw-btn--sm" onClick={() => setAddBankOpen(true)}>
          <i className="bi bi-plus-lg" /> Add Account
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", gap: "0.85rem" }}>
          {[1, 2].map((i) => (
            <div key={i} className="fw-skeleton" style={{ height: 110, flex: 1, borderRadius: 10 }} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="fw-empty">
          <i className="bi bi-bank" />
          No bank accounts linked yet. Add one to enable withdrawals.
        </div>
      ) : (
        <div className="fw-banks-grid">
          {accounts.map((acct) => (
            <div
              key={acct.id}
              className={`fw-bank-card${acct.isPrimary ? " fw-bank-card--primary" : ""}`}
            >
              {acct.isPrimary && <span className="fw-bank-badge">Primary</span>}
              <div className="fw-bank-name">{acct.bankName}</div>
              <div className="fw-bank-acct">{acct.accountNumberMasked} — {acct.accountName}</div>
              <span className="fw-bank-currency">{acct.currency}</span>
              <div className={`fw-bank-status fw-bank-status--${acct.status}`}>
                <i className={`bi bi-${acct.status === "verified" ? "check-circle-fill" : acct.status === "pending" ? "clock" : "x-circle-fill"}`} />
                {acct.status.charAt(0).toUpperCase() + acct.status.slice(1)}
              </div>
              <div className="fw-bank-actions">
                {!acct.isPrimary && acct.status === "verified" && (
                  <button
                    className="fw-btn fw-btn--ghost fw-btn--sm"
                    onClick={() => setPrimary.mutate(acct.id)}
                    disabled={setPrimary.isPending}
                  >
                    Set Primary
                  </button>
                )}
                <button
                  className="fw-btn fw-btn--danger fw-btn--sm"
                  onClick={() => {
                    if (window.confirm("Remove this bank account?")) remove.mutate(acct.id);
                  }}
                  disabled={remove.isPending}
                >
                  <i className="bi bi-trash3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {addBankOpen && <AddBankModal onClose={() => setAddBankOpen(false)} />}
    </div>
  );
};

// ── Transaction history ───────────────────────────────────────────────────────

const TxHistory = () => {
  const { txFilter, setTxFilter, setTxPage } = useFiatStore();
  const { data, isLoading } = useFiatTransactionsQuery({
    page:     txFilter.page,
    limit:    15,
    type:     txFilter.type     || undefined,
    currency: txFilter.currency || undefined,
    status:   txFilter.status   || undefined,
  });

  const txns  = data?.transactions ?? [];
  const pages = data?.pagination?.pages ?? 1;
  const page  = txFilter.page;

  return (
    <div className="fw-section">
      <div className="fw-section-head">
        <span className="fw-section-title">
          <i className="bi bi-receipt-cutoff" style={{ color: "#f0b90b" }} />
          Transaction History
        </span>
      </div>

      <div className="fw-tx-filters">
        <select id="tx-type" name="type" aria-label="Filter by type" value={txFilter.type} onChange={(e) => setTxFilter({ type: e.target.value })}>
          <option value="">All types</option>
          <option value="deposit">Deposit</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="adjustment">Adjustment</option>
          <option value="reversal">Reversal</option>
        </select>
        <select id="tx-currency" name="currency" aria-label="Filter by currency" value={txFilter.currency} onChange={(e) => setTxFilter({ currency: e.target.value })}>
          <option value="">All currencies</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="NGN">NGN</option>
        </select>
        <select id="tx-status" name="status" aria-label="Filter by status" value={txFilter.status} onChange={(e) => setTxFilter({ status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="fw-skeleton" style={{ height: 180, borderRadius: 10 }} />
      ) : txns.length === 0 ? (
        <div className="fw-empty">
          <i className="bi bi-journal-x" />
          No transactions found.
        </div>
      ) : (
        <>
          <div className="fw-tx-table-wrap">
            <table className="fw-tx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Currency</th>
                  <th>Amount</th>
                  <th>Fee</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((tx) => (
                  <tr key={tx.id ?? tx.txId}>
                    <td style={{ color: "#848e9c" }}>{fmtDate(tx.createdAt)}</td>
                    <td>
                      <span className={`fw-tx-type fw-tx-dir--${tx.direction}`}>
                        <i className={`bi bi-${tx.direction === "credit" ? "arrow-down-circle-fill" : "arrow-up-circle-fill"}`} />
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{tx.currency}</td>
                    <td className={`fw-tx-amount fw-tx-dir--${tx.direction}`}>
                      {tx.direction === "credit" ? "+" : "-"}{fmt(tx.currency, tx.amount)}
                    </td>
                    <td style={{ color: "#848e9c" }}>
                      {tx.fee > 0 ? fmt(tx.currency, tx.fee) : "—"}
                    </td>
                    <td className="fw-tx-amount" style={{ color: "#eaecef" }}>
                      {fmt(tx.currency, tx.netAmount)}
                    </td>
                    <td>
                      <span className={`fw-tx-status fw-tx-status--${tx.status}`}>
                        <i className={`bi ${STATUS_ICON[tx.status] ?? "bi-circle"}`} />
                        {tx.status}
                      </span>
                    </td>
                    <td className="fw-tx-ref" title={tx.txId}>{tx.txId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="fw-pagination">
              <button
                className="fw-page-btn"
                onClick={() => setTxPage(page - 1)}
                disabled={page <= 1}
              >
                <i className="bi bi-chevron-left" />
              </button>
              <span className="fw-page-info">Page {page} of {pages}</span>
              <button
                className="fw-page-btn"
                onClick={() => setTxPage(page + 1)}
                disabled={page >= pages}
              >
                <i className="bi bi-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const DashFiatWallet = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    activePanel, setActivePanel,
    selectedCurrency, setSelectedCurrency,
  } = useFiatStore();

  // Hooks must run before any early return
  const { data: walletData, isLoading: walletLoading } = useFiatWalletQuery();
  const { data: bankData }                              = useBankAccountsQuery();

  // Auth guard — same localStorage fallback used across all dash pages
  const tok = localStorage.getItem("token");
  let usr = null;
  try {
    const r = localStorage.getItem("user");
    usr = r && r !== "null" ? JSON.parse(r) : null;
  } catch {} // intentional
  if (!isAuthenticated && !(tok && usr && typeof usr === "object")) {
    return <Navigate to="/login" replace />;
  }

  const bankAccounts = bankData?.bankAccounts ?? [];
  const config       = walletData?.config;
  const frozen       = Boolean(walletData?.wallet?.status && walletData.wallet.status !== "active");

  return (
    <div className="dash-root">
      <DashNavbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="dash-body">
        <DashSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => {
            useAuthStore.getState().logout();
            navigate("/login");
          }}
        />

        <main className="dash-main fw-main">
          <h1 className="fw-heading">
            <i className="bi bi-cash-stack" style={{ color: "#f0b90b", marginRight: 8 }} />
            Fiat Wallet
          </h1>
          <p className="fw-subhead">
            Manage your real-world money — deposit, withdraw, and track transactions in USD, EUR &amp; NGN.
          </p>

          {/* Balance cards */}
          {walletLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.75rem" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="fw-skeleton" style={{ height: 110, borderRadius: 12 }} />
              ))}
            </div>
          ) : (
            <BalanceCards
              walletData={walletData}
              selectedCurrency={selectedCurrency}
              onSelect={setSelectedCurrency}
              frozen={frozen}
            />
          )}

          {/* Action buttons */}
          <div className="fw-actions">
            <button
              className="fw-btn fw-btn--primary"
              onClick={() => setActivePanel(activePanel === "deposit" ? null : "deposit")}
              disabled={frozen}
            >
              <i className="bi bi-arrow-down-circle-fill" />
              {activePanel === "deposit" ? "Close Deposit" : "Deposit"}
            </button>
            <button
              className="fw-btn fw-btn--outline"
              onClick={() => setActivePanel(activePanel === "withdraw" ? null : "withdraw")}
              disabled={frozen}
            >
              <i className="bi bi-arrow-up-circle-fill" />
              {activePanel === "withdraw" ? "Close Withdraw" : "Withdraw"}
            </button>
            {frozen && (
              <div className="fw-alert fw-alert--err" style={{ margin: 0, flex: 1 }}>
                <i className="bi bi-lock-fill" />
                Your fiat wallet is {walletData?.wallet?.status}. Contact support.
              </div>
            )}
          </div>

          {/* Deposit panel */}
          {activePanel === "deposit" && (
            <DepositPanel
              onClose={() => setActivePanel(null)}
              selectedCurrency={selectedCurrency}
              config={config}
            />
          )}

          {/* Withdraw panel */}
          {activePanel === "withdraw" && (
            <WithdrawPanel
              onClose={() => setActivePanel(null)}
              selectedCurrency={selectedCurrency}
              bankAccounts={bankAccounts}
              config={config}
            />
          )}

          {/* Bank accounts */}
          <BankAccountsSection />

          {/* Transaction history */}
          <TxHistory />
        </main>
      </div>
    </div>
  );
};

export default DashFiatWallet;
