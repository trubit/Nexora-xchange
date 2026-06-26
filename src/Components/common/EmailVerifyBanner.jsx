import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { requestWithRetry } from "../../api/client";

const OTP_INPUT_STYLE = {
  width: 44, height: 48, textAlign: "center", fontFamily: "monospace",
  fontSize: "1.2rem", fontWeight: 700, letterSpacing: 0,
  background: "#0b0e11", border: "1.5px solid rgba(245,158,11,0.35)",
  borderRadius: 8, color: "#eaecef", outline: "none",
  caretColor: "#f0b90b",
};

const OTP_INPUT_FOCUS_STYLE = {
  border: "1.5px solid #f0b90b",
  boxShadow: "0 0 0 2px rgba(240,185,11,0.15)",
};

const SixDigitInput = ({ value, onChange }) => {
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      const next = digits.slice();
      if (next[i]) { next[i] = ""; onChange(next.join("").trimEnd()); }
      else if (i > 0) {
        next[i - 1] = ""; onChange(next.join("").trimEnd());
        document.getElementById(`ev-otp-${i - 1}`)?.focus();
      }
      return;
    }
    if (/^\d$/.test(e.key)) {
      const next = digits.slice();
      next[i] = e.key;
      onChange(next.join(""));
      if (i < 5) document.getElementById(`ev-otp-${i + 1}`)?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) { onChange(pasted); document.getElementById(`ev-otp-5`)?.focus(); }
    e.preventDefault();
  };

  return (
    <div style={{ display: "flex", gap: "0.4rem" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          id={`ev-otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          readOnly
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          onClick={() => document.getElementById(`ev-otp-${i}`)?.select()}
          style={OTP_INPUT_STYLE}
          onFocus={(e) => Object.assign(e.target.style, OTP_INPUT_FOCUS_STYLE)}
          onBlur={(e) => Object.assign(e.target.style, {
            border: "1.5px solid rgba(245,158,11,0.35)", boxShadow: "none",
          })}
        />
      ))}
    </div>
  );
};

const EmailVerifyBanner = () => {
  const { user, refreshUser } = useAuthStore();

  const [phase, setPhase]     = useState("banner"); // banner | sending | code | verifying | done | error
  const [code, setCode]       = useState("");
  const [msg, setMsg]         = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Google users and already-verified users don't see the banner
  if (!user || user.authProvider === "google" || user.emailVerified === true) return null;
  if (phase === "done") return null;

  const startCooldown = (secs = 60) => {
    setCooldown(secs);
    const tick = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(tick); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    setPhase("sending"); setMsg(""); setCode("");
    try {
      await requestWithRetry({ method: "post", url: "/api/auth/verify-email/resend-me" });
      setMsg(`Code sent to ${user.email}`);
      setPhase("code");
      startCooldown(60);
    } catch (e) {
      setMsg(e?.message || "Failed to send code. Try again.");
      setPhase("error");
    }
  };

  const verify = async () => {
    if (code.length < 6) { setMsg("Enter all 6 digits."); return; }
    setPhase("verifying"); setMsg("");
    try {
      await requestWithRetry({ method: "post", url: "/api/auth/verify-email", data: { code } });
      await refreshUser();
      setPhase("done");
    } catch (e) {
      setMsg(e?.message || "Invalid or expired code.");
      setPhase("code");
    }
  };

  const isSending   = phase === "sending";
  const isVerifying = phase === "verifying";
  const busy        = isSending || isVerifying;

  return (
    <div style={{
      background: "linear-gradient(90deg, rgba(245,158,11,0.12) 0%, rgba(240,185,11,0.07) 100%)",
      borderBottom: "1px solid rgba(245,158,11,0.25)",
    }}>
      {/* ── Banner strip ── */}
      {phase === "banner" && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.55rem 1.25rem", flexWrap: "wrap",
        }}>
          <i className="bi bi-envelope-exclamation-fill"
            style={{ color: "#f59e0b", fontSize: "1rem", flexShrink: 0 }} />
          <span style={{ fontSize: "0.83rem", color: "#d4a017", flex: 1, minWidth: 180 }}>
            <strong style={{ color: "#f0b90b" }}>Email not verified.</strong>
            {" "}Verify your email to fully secure your account.
          </span>
          <button
            onClick={sendCode}
            style={{
              background: "linear-gradient(135deg,#f0b90b,#f8d247)",
              color: "#0b0e11", border: "none", borderRadius: 7,
              padding: "0.35rem 1rem", fontWeight: 700,
              fontSize: "0.8rem", cursor: "pointer", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(240,185,11,0.25)",
            }}
          >
            <i className="bi bi-envelope-check" style={{ marginRight: 5 }} />
            Verify Now
          </button>
        </div>
      )}

      {/* ── Sending / verifying loader ── */}
      {(isSending || isVerifying) && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.65rem",
          padding: "0.55rem 1.25rem", color: "#f0b90b", fontSize: "0.83rem",
        }}>
          <span style={{
            width: 16, height: 16, border: "2px solid rgba(240,185,11,0.3)",
            borderTopColor: "#f0b90b", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", flexShrink: 0,
            display: "inline-block",
          }} />
          {isSending ? "Sending code to your email…" : "Verifying code…"}
        </div>
      )}

      {/* ── Code entry panel ── */}
      {phase === "code" && (
        <div style={{ padding: "0.85rem 1.25rem 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <i className="bi bi-envelope-check-fill" style={{ color: "#0ecb81", fontSize: "1rem" }} />
            <span style={{ fontSize: "0.83rem", color: "#eaecef" }}>
              {msg || `Code sent to ${user.email}`}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.85rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.74rem", color: "#848e9c", marginBottom: "0.4rem", fontWeight: 600 }}>
                ENTER 6-DIGIT CODE
              </div>
              <SixDigitInput value={code} onChange={setCode} />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", paddingBottom: 2 }}>
              <button
                onClick={verify}
                disabled={code.length < 6 || busy}
                style={{
                  background: code.length === 6
                    ? "linear-gradient(135deg,#f0b90b,#f8d247)"
                    : "rgba(240,185,11,0.15)",
                  color: code.length === 6 ? "#0b0e11" : "#848e9c",
                  border: "none", borderRadius: 8, padding: "0.55rem 1.1rem",
                  fontWeight: 700, fontSize: "0.85rem",
                  cursor: code.length === 6 ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                }}
              >
                <i className="bi bi-patch-check" style={{ marginRight: 5 }} />
                Confirm
              </button>
              <button
                onClick={sendCode}
                disabled={cooldown > 0 || busy}
                style={{
                  background: "none",
                  color: cooldown > 0 ? "#636d77" : "#f0b90b",
                  border: "1px solid rgba(240,185,11,0.25)",
                  borderRadius: 8, padding: "0.55rem 0.85rem",
                  fontSize: "0.8rem", cursor: cooldown > 0 ? "not-allowed" : "pointer",
                }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </div>

          {msg && phase === "code" && msg.includes("Invalid") && (
            <div style={{
              marginTop: "0.6rem", fontSize: "0.8rem", color: "#f6465d",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <i className="bi bi-exclamation-circle-fill" /> {msg}
            </div>
          )}
        </div>
      )}

      {/* ── Error state ── */}
      {phase === "error" && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.55rem 1.25rem", flexWrap: "wrap",
        }}>
          <i className="bi bi-exclamation-triangle-fill"
            style={{ color: "#f6465d", flexShrink: 0 }} />
          <span style={{ fontSize: "0.83rem", color: "#f6465d", flex: 1 }}>{msg}</span>
          <button
            onClick={() => setPhase("banner")}
            style={{
              background: "rgba(246,70,93,0.12)", color: "#f6465d",
              border: "1px solid rgba(246,70,93,0.3)", borderRadius: 7,
              padding: "0.3rem 0.85rem", fontSize: "0.8rem", cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default EmailVerifyBanner;
