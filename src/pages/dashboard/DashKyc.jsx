import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { kycApi } from "../../services/api/kyc";
import "../../styles/kyc.css";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Personal Info",  icon: "bi-person-fill" },
  { n: 2, label: "Document",       icon: "bi-card-image" },
  { n: 3, label: "Selfie",         icon: "bi-camera-fill" },
  { n: 4, label: "Review",         icon: "bi-check2-circle" },
];

const DOC_TYPES = [
  { value: "passport",        label: "Passport",         icon: "bi-passport",          desc: "International travel document" },
  { value: "national_id",     label: "National ID",      icon: "bi-person-badge-fill", desc: "Government-issued identity card" },
  { value: "drivers_license", label: "Driver's License", icon: "bi-car-front-fill",    desc: "Official driving permit" },
];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Benin",
  "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Bulgaria","Burkina Faso",
  "Cambodia","Cameroon","Canada","Chad","Chile","China","Colombia","Congo",
  "Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Egypt",
  "Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala",
  "Guinea","Honduras","Hungary","India","Indonesia","Iran","Iraq","Ireland",
  "Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kosovo",
  "Kuwait","Kyrgyzstan","Latvia","Lebanon","Libya","Lithuania","Luxembourg",
  "Malaysia","Mali","Mexico","Moldova","Mongolia","Morocco","Mozambique",
  "Myanmar","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria",
  "North Korea","Norway","Oman","Pakistan","Palestine","Panama","Paraguay","Peru",
  "Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda",
  "Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore","Slovakia",
  "Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan",
  "Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand",
  "Tunisia","Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam",
  "Yemen","Zambia","Zimbabwe",
];

const STATUS_CONFIG = {
  pending:  { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: "bi-hourglass-split",    label: "Under Review" },
  approved: { color: "#0ecb81", bg: "rgba(14,203,129,0.10)", icon: "bi-patch-check-fill",   label: "Verified" },
  rejected: { color: "#f6465d", bg: "rgba(246,70,93,0.10)",  icon: "bi-x-octagon-fill",     label: "Rejected" },
};

const EMPTY_PERSONAL = {
  firstName: "", lastName: "", dateOfBirth: "",
  nationality: "", country: "", address: "",
  city: "", postalCode: "", phone: "",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const StepBar = ({ current }) => (
  <div className="kyc-stepbar">
    {STEPS.map((s, i) => (
      <div key={s.n} className="kyc-stepbar-item">
        <div className={`kyc-step-circle ${current === s.n ? "kyc-step-active" : current > s.n ? "kyc-step-done" : ""}`}>
          {current > s.n
            ? <i className="bi bi-check2" />
            : <i className={`bi ${s.icon}`} />}
        </div>
        <span className="kyc-step-label">{s.label}</span>
        {i < STEPS.length - 1 && (
          <div className={`kyc-step-line ${current > s.n ? "kyc-step-line-done" : ""}`} />
        )}
      </div>
    ))}
  </div>
);

const DocUploader = ({ side, label, hint, value, onChange, required }) => {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("File must be under 5 MB."); return; }
    setErr(""); setUploading(true);
    try {
      const res = await kycApi.uploadDocument(file);
      onChange({ side, url: res.url });
    } catch (e) {
      setErr(e?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [side, onChange]);

  const onInputChange = (e) => handleFile(e.target.files[0]);
  const onDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };
  const onDragOver = (e) => e.preventDefault();

  return (
    <div className="kyc-doc-uploader">
      <div className="kyc-doc-label">
        {label} {required && <span className="kyc-required">*</span>}
      </div>
      {hint && <div className="kyc-doc-hint">{hint}</div>}

      <div
        className={`kyc-dropzone ${value ? "kyc-dropzone--filled" : ""} ${uploading ? "kyc-dropzone--loading" : ""}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        {uploading ? (
          <div className="kyc-dropzone-inner">
            <div className="kyc-spinner" />
            <span>Uploading…</span>
          </div>
        ) : value ? (
          <div className="kyc-dropzone-preview">
            <img src={value} alt={label} className="kyc-doc-thumb" />
            <div className="kyc-doc-overlay">
              <i className="bi bi-arrow-repeat" /> Change
            </div>
          </div>
        ) : (
          <div className="kyc-dropzone-inner">
            <i className="bi bi-cloud-upload kyc-upload-icon" />
            <span className="kyc-upload-text">Click or drag to upload</span>
            <span className="kyc-upload-sub">JPG, PNG, WEBP — max 5 MB</span>
          </div>
        )}
      </div>

      {err && <div className="kyc-field-err"><i className="bi bi-exclamation-circle" /> {err}</div>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="kyc-hidden-input" onChange={onInputChange} />
    </div>
  );
};

// ── Status screen (shown when KYC already submitted) ──────────────────────────

const KycStatusScreen = ({ profile, onResubmit }) => {
  const cfg = STATUS_CONFIG[profile.status] || STATUS_CONFIG.pending;
  const pi  = profile.personalInfo || {};
  const docLabel = DOC_TYPES.find((d) => d.value === profile.documentType)?.label || profile.documentType;

  return (
    <div className="kyc-status-screen">
      <div className="kyc-status-badge" style={{ borderColor: `${cfg.color}40`, background: cfg.bg }}>
        <i className={`bi ${cfg.icon} kyc-status-icon`} style={{ color: cfg.color }} />
        <div>
          <div className="kyc-status-title" style={{ color: cfg.color }}>{cfg.label}</div>
          <div className="kyc-status-sub">
            {profile.status === "pending"  && "Your documents are under review. Usually takes 1–2 business days."}
            {profile.status === "approved" && "Your identity is verified. You now have full platform access."}
            {profile.status === "rejected" && "Your submission was rejected. Please re-submit with valid documents."}
          </div>
        </div>
      </div>

      {profile.reviewerNote && (
        <div className="kyc-reviewer-note">
          <i className="bi bi-chat-left-text" /> <strong>Reviewer note:</strong> {profile.reviewerNote}
        </div>
      )}

      <div className="kyc-summary-grid">
        <div className="kyc-summary-section">
          <h4 className="kyc-summary-heading"><i className="bi bi-person-fill" /> Personal Info</h4>
          <div className="kyc-summary-rows">
            <Row label="Full Name"    val={`${pi.firstName} ${pi.lastName}`} />
            <Row label="Date of Birth" val={pi.dateOfBirth} />
            <Row label="Nationality"  val={pi.nationality} />
            <Row label="Country"      val={pi.country} />
            <Row label="Address"      val={pi.address} />
            <Row label="City"         val={pi.city} />
            <Row label="Phone"        val={pi.phone} />
          </div>
        </div>

        <div className="kyc-summary-section">
          <h4 className="kyc-summary-heading"><i className="bi bi-card-image" /> Documents</h4>
          <div className="kyc-summary-rows">
            <Row label="Document Type" val={docLabel} />
          </div>
          <div className="kyc-doc-thumbs-row">
            {(profile.documents || []).map((doc) => (
              <div key={doc.side} className="kyc-doc-thumb-wrap">
                <img src={doc.url} alt={doc.side} className="kyc-doc-thumb" />
                <span className="kyc-doc-side-label">{doc.side}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="kyc-status-footer">
        {profile.status === "rejected" && (
          <button className="kyc-btn kyc-btn--gold" onClick={onResubmit}>
            <i className="bi bi-arrow-counterclockwise" /> Re-submit KYC
          </button>
        )}
        <Link to="/Dashboard/security" className="kyc-btn kyc-btn--ghost">
          <i className="bi bi-arrow-left" /> Back to Security Center
        </Link>
      </div>
    </div>
  );
};

const Row = ({ label, val }) => (
  <div className="kyc-row">
    <span className="kyc-row-label">{label}</span>
    <span className="kyc-row-val">{val || "—"}</span>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const DashKyc = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuthStore();

  const [pageLoading, setPageLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [step, setStep] = useState(1);
  const [personalInfo, setPersonalInfo] = useState(EMPTY_PERSONAL);
  const [docType, setDocType] = useState("passport");
  const [documents, setDocuments] = useState({});   // { front: url, back: url, selfie: url }
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");

  useEffect(() => {
    refreshUser();
    kycApi.getMyKyc()
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null))
      .finally(() => setPageLoading(false));
  }, []);

  const requiresBack = docType === "national_id" || docType === "drivers_license";

  // ── Validation ──────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    if (!personalInfo.firstName.trim())  e.firstName   = "Required";
    if (!personalInfo.lastName.trim())   e.lastName    = "Required";
    if (!personalInfo.dateOfBirth)       e.dateOfBirth = "Required";
    if (!personalInfo.nationality.trim()) e.nationality = "Required";
    if (!personalInfo.country)           e.country     = "Required";
    if (!personalInfo.address.trim())    e.address     = "Required";
    if (!personalInfo.city.trim())       e.city        = "Required";
    if (!personalInfo.phone.trim())      e.phone       = "Required";
    // Age must be 18+
    if (personalInfo.dateOfBirth) {
      const dob = new Date(personalInfo.dateOfBirth);
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 18) e.dateOfBirth = "You must be at least 18 years old";
    }
    return e;
  };

  const validateStep2 = () => {
    const e = {};
    if (!documents.front) e.front = "Front image is required";
    if (requiresBack && !documents.back) e.back = "Back image is required for this document type";
    return e;
  };

  const validateStep3 = () => {
    const e = {};
    if (!documents.selfie) e.selfie = "Selfie photo is required";
    return e;
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = () => {
    let e = {};
    if (step === 1) e = validateStep1();
    if (step === 2) e = validateStep2();
    if (step === 3) e = validateStep3();
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => s + 1);
  };

  const goBack = () => { setErrors({}); setStep((s) => s - 1); };

  // ── Document upload handler ──────────────────────────────────────────────────
  const handleDocChange = ({ side, url }) => {
    setDocuments((prev) => ({ ...prev, [side]: url }));
    setErrors((prev) => { const next = { ...prev }; delete next[side]; return next; });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitErr(""); setSubmitting(true);
    try {
      const docsArray = Object.entries(documents)
        .filter(([, url]) => url)
        .map(([side, url]) => ({ side, url }));

      const res = await kycApi.submitKyc({ personalInfo, documentType: docType, documents: docsArray });
      setProfile(res.profile);
      setShowForm(false);
      refreshUser();
    } catch (e) {
      setSubmitErr(e?.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="kyc-page">
        <div className="kyc-loading"><div className="kyc-spinner kyc-spinner--lg" /><span>Loading…</span></div>
      </div>
    );
  }

  if (profile && !showForm) {
    return (
      <div className="kyc-page">
        <div className="kyc-header">
          <Link to="/Dashboard/security" className="kyc-back-link"><i className="bi bi-arrow-left" /> Security Center</Link>
          <h1 className="kyc-title">Identity Verification</h1>
          <p className="kyc-subtitle">KYC status for your TrusonXchanger account</p>
        </div>
        <KycStatusScreen profile={profile} onResubmit={() => { setShowForm(true); setStep(1); setDocuments({}); setErrors({}); }} />
      </div>
    );
  }

  return (
    <div className="kyc-page">
      {/* Header */}
      <div className="kyc-header">
        <Link to="/Dashboard/security" className="kyc-back-link"><i className="bi bi-arrow-left" /> Security Center</Link>
        <h1 className="kyc-title">Identity Verification (KYC)</h1>
        <p className="kyc-subtitle">Complete verification to unlock full trading limits and platform features</p>
      </div>

      {/* Step bar */}
      <StepBar current={step} />

      {/* Card */}
      <div className="kyc-card">

        {/* ── STEP 1: Personal Information ─────────────────────────── */}
        {step === 1 && (
          <div className="kyc-form-step">
            <div className="kyc-step-head">
              <i className="bi bi-person-fill kyc-step-icon" />
              <div>
                <div className="kyc-step-title">Personal Information</div>
                <div className="kyc-step-desc">Enter your details exactly as they appear on your official ID.</div>
              </div>
            </div>

            <div className="kyc-field-grid">
              <Field label="First Name" required error={errors.firstName}>
                <input className="kyc-input" value={personalInfo.firstName}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="John" />
              </Field>
              <Field label="Last Name" required error={errors.lastName}>
                <input className="kyc-input" value={personalInfo.lastName}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Doe" />
              </Field>
              <Field label="Date of Birth" required error={errors.dateOfBirth}>
                <input className="kyc-input" type="date" value={personalInfo.dateOfBirth}
                  max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000).toISOString().split("T")[0]}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, dateOfBirth: e.target.value }))} />
              </Field>
              <Field label="Nationality" required error={errors.nationality}>
                <input className="kyc-input" value={personalInfo.nationality}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, nationality: e.target.value }))}
                  placeholder="e.g. Nigerian" />
              </Field>
              <Field label="Country of Residence" required error={errors.country}>
                <select className="kyc-input kyc-select" value={personalInfo.country}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, country: e.target.value }))}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Phone Number" required error={errors.phone}>
                <input className="kyc-input" value={personalInfo.phone}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 234 567 8900" />
              </Field>
              <Field label="Address" required error={errors.address} wide>
                <input className="kyc-input" value={personalInfo.address}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main Street" />
              </Field>
              <Field label="City" required error={errors.city}>
                <input className="kyc-input" value={personalInfo.city}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Lagos" />
              </Field>
              <Field label="Postal Code" error={errors.postalCode}>
                <input className="kyc-input" value={personalInfo.postalCode}
                  onChange={(e) => setPersonalInfo((p) => ({ ...p, postalCode: e.target.value }))}
                  placeholder="100001" />
              </Field>
            </div>
          </div>
        )}

        {/* ── STEP 2: Document Upload ───────────────────────────────── */}
        {step === 2 && (
          <div className="kyc-form-step">
            <div className="kyc-step-head">
              <i className="bi bi-card-image kyc-step-icon" />
              <div>
                <div className="kyc-step-title">Identity Document</div>
                <div className="kyc-step-desc">Choose your document type and upload clear photos. Ensure all text is readable.</div>
              </div>
            </div>

            <div className="kyc-doc-type-grid">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  className={`kyc-doc-type-card ${docType === dt.value ? "kyc-doc-type-card--active" : ""}`}
                  onClick={() => { setDocType(dt.value); setDocuments((d) => ({ selfie: d.selfie })); }}
                >
                  <i className={`bi ${dt.icon} kyc-doc-type-icon`} />
                  <div className="kyc-doc-type-name">{dt.label}</div>
                  <div className="kyc-doc-type-desc">{dt.desc}</div>
                </button>
              ))}
            </div>

            <div className="kyc-uploader-row">
              <DocUploader
                side="front"
                label={`Front of ${DOC_TYPES.find((d) => d.value === docType)?.label}`}
                hint="Clear photo showing your name, photo, and document number"
                value={documents.front}
                onChange={handleDocChange}
                required
              />
              {requiresBack && (
                <DocUploader
                  side="back"
                  label="Back of Document"
                  hint="Reverse side showing barcode or additional information"
                  value={documents.back}
                  onChange={handleDocChange}
                  required
                />
              )}
            </div>
            {errors.front && <div className="kyc-field-err"><i className="bi bi-exclamation-circle" /> {errors.front}</div>}
            {errors.back  && <div className="kyc-field-err"><i className="bi bi-exclamation-circle" /> {errors.back}</div>}
          </div>
        )}

        {/* ── STEP 3: Selfie ───────────────────────────────────────── */}
        {step === 3 && (
          <div className="kyc-form-step">
            <div className="kyc-step-head">
              <i className="bi bi-camera-fill kyc-step-icon" />
              <div>
                <div className="kyc-step-title">Selfie Verification</div>
                <div className="kyc-step-desc">Take a clear selfie holding your {DOC_TYPES.find((d) => d.value === docType)?.label}.</div>
              </div>
            </div>

            <div className="kyc-selfie-tips">
              {[
                { icon: "bi-brightness-high", text: "Good lighting — face and document must be clearly visible" },
                { icon: "bi-eye",             text: "Eyes open, face uncovered — no sunglasses or hat" },
                { icon: "bi-card-heading",    text: "Hold document so text is readable in the photo" },
                { icon: "bi-image",           text: "No blurry or edited photos — originals only" },
              ].map((tip) => (
                <div key={tip.icon} className="kyc-selfie-tip">
                  <i className={`bi ${tip.icon}`} />
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>

            <DocUploader
              side="selfie"
              label="Selfie holding your document"
              hint="Your face and document must both be visible and clear"
              value={documents.selfie}
              onChange={handleDocChange}
              required
            />
            {errors.selfie && <div className="kyc-field-err"><i className="bi bi-exclamation-circle" /> {errors.selfie}</div>}
          </div>
        )}

        {/* ── STEP 4: Review & Submit ───────────────────────────────── */}
        {step === 4 && (
          <div className="kyc-form-step">
            <div className="kyc-step-head">
              <i className="bi bi-check2-circle kyc-step-icon" />
              <div>
                <div className="kyc-step-title">Review & Submit</div>
                <div className="kyc-step-desc">Check that everything is correct before submitting. You can go back to make changes.</div>
              </div>
            </div>

            <div className="kyc-review-grid">
              <div className="kyc-review-section">
                <div className="kyc-review-section-title"><i className="bi bi-person-fill" /> Personal Information</div>
                {[
                  ["First Name",    personalInfo.firstName],
                  ["Last Name",     personalInfo.lastName],
                  ["Date of Birth", personalInfo.dateOfBirth],
                  ["Nationality",   personalInfo.nationality],
                  ["Country",       personalInfo.country],
                  ["Address",       personalInfo.address],
                  ["City",          personalInfo.city],
                  ["Postal Code",   personalInfo.postalCode || "—"],
                  ["Phone",         personalInfo.phone],
                ].map(([k, v]) => (
                  <div key={k} className="kyc-review-row">
                    <span className="kyc-review-key">{k}</span>
                    <span className="kyc-review-val">{v}</span>
                  </div>
                ))}
              </div>

              <div className="kyc-review-section">
                <div className="kyc-review-section-title"><i className="bi bi-card-image" /> Documents</div>
                <div className="kyc-review-row">
                  <span className="kyc-review-key">Document Type</span>
                  <span className="kyc-review-val">{DOC_TYPES.find((d) => d.value === docType)?.label}</span>
                </div>
                <div className="kyc-doc-thumbs-row">
                  {Object.entries(documents).filter(([, v]) => v).map(([side, url]) => (
                    <div key={side} className="kyc-doc-thumb-wrap">
                      <img src={url} alt={side} className="kyc-doc-thumb" />
                      <span className="kyc-doc-side-label">{side}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="kyc-consent">
              <i className="bi bi-shield-lock-fill kyc-consent-icon" />
              <p>
                By submitting, I confirm that all information provided is accurate and the documents are genuine.
                I consent to TrusonXchanger processing my data for identity verification purposes in accordance with applicable laws.
              </p>
            </div>

            {submitErr && (
              <div className="kyc-submit-err"><i className="bi bi-exclamation-triangle" /> {submitErr}</div>
            )}
          </div>
        )}

        {/* ── Step navigation buttons ─────────────────────────────── */}
        <div className="kyc-nav-buttons">
          {step > 1 && (
            <button type="button" className="kyc-btn kyc-btn--ghost" onClick={goBack} disabled={submitting}>
              <i className="bi bi-arrow-left" /> Back
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="kyc-btn kyc-btn--gold" onClick={goNext}>
              Continue <i className="bi bi-arrow-right" />
            </button>
          ) : (
            <button
              type="button"
              className="kyc-btn kyc-btn--gold kyc-btn--submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <><div className="kyc-spinner kyc-spinner--sm" /> Submitting…</>
                : <><i className="bi bi-send-fill" /> Submit KYC</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Field wrapper ──────────────────────────────────────────────────────────────
const Field = ({ label, required, error, wide, children }) => (
  <div className={`kyc-field${wide ? " kyc-field--wide" : ""}`}>
    <label className="kyc-label">
      {label} {required && <span className="kyc-required">*</span>}
    </label>
    {children}
    {error && <div className="kyc-field-err"><i className="bi bi-exclamation-circle" /> {error}</div>}
  </div>
);

export default DashKyc;
