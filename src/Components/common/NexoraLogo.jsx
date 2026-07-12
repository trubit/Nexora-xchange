import { useId } from "react";

const NexoraLogo = ({ variant = "full", size = 32, className = "" }) => {
  const uid  = useId();
  const gId  = `nxg-${uid}`;
  const glId = `nxgl-${uid}`;

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        {/* Deep gold → brand gold → bright gold — bottom-left to top-right */}
        <linearGradient id={gId} x1="10" y1="36" x2="38" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#c8930a" />
          <stop offset="50%"  stopColor="#f0b90b" />
          <stop offset="100%" stopColor="#f8d33a" />
        </linearGradient>
        {/* Ambient glow behind the N */}
        <filter id={glId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
      </defs>

      {/* Hexagonal frame — pointed-top, standard crypto orientation */}
      <polygon
        points="24,2.5 43.4,13.25 43.4,34.75 24,45.5 4.6,34.75 4.6,13.25"
        fill="none"
        stroke={`url(#${gId})`}
        strokeWidth="1.5"
        opacity="0.65"
      />

      {/* N — gold glow layer (rendered behind main letter) */}
      <g filter={`url(#${glId})`} opacity="0.3">
        <path d="M10,12 L16,12 L16,36 L10,36 Z" fill="#f0b90b" />
        <path d="M16,12 L22,12 L32,36 L26,36 Z" fill="#f0b90b" />
        <path d="M32,12 L38,12 L38,36 L32,36 Z" fill="#f0b90b" />
      </g>

      {/* N — bold solid letterform with gradient fill
           Left bar  : x 10–16, y 12–36
           Diagonal  : parallelogram from top-left bar edge to bottom-right bar edge
           Right bar : x 32–38, y 12–36                                              */}
      <path d="M10,12 L16,12 L16,36 L10,36 Z" fill={`url(#${gId})`} />
      <path d="M16,12 L22,12 L32,36 L26,36 Z" fill={`url(#${gId})`} />
      <path d="M32,12 L38,12 L38,36 L32,36 Z" fill={`url(#${gId})`} />

      {/* Live-market indicator at the top-right hex vertex */}
      <circle cx="43.4" cy="13.25" r="5"   fill="#0ecb81" opacity="0.15" />
      <circle cx="43.4" cy="13.25" r="2.8" fill="#0ecb81" />
    </svg>
  );

  if (variant === "icon") return icon;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${Math.round(size * 0.33)}px`,
      }}
      role="img"
      aria-label="Nexora"
    >
      {icon}
      <span
        style={{
          fontFamily: "'Inter', 'Manrope', 'Segoe UI', system-ui, sans-serif",
          fontWeight: 900,
          fontSize: `${Math.round(size * 0.52)}px`,
          letterSpacing: "0.22em",
          background: "linear-gradient(135deg, #c8930a 0%, #f0b90b 50%, #f8d33a 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        NEXORA
      </span>
    </span>
  );
};

export default NexoraLogo;
