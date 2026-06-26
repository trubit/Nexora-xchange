import { useState, useMemo } from "react";
import { useCoinLogos } from "../../hooks/queries/useCoinLogos";

// Brand colors for every supported coin — used for the letter fallback badge.
const COIN_CLR = {
  BTC:"#f7931a", ETH:"#627eea", USDT:"#26a17b", USDC:"#2775ca",
  BNB:"#f3ba2f", SOL:"#9945ff", XRP:"#00aae4", ADA:"#0066ff",
  DOGE:"#c5a66a", AVAX:"#e84142", LINK:"#2a5ada", DOT:"#e6007a",
  MATIC:"#8247e5", TRX:"#ef0027", LTC:"#bfbbbb", UNI:"#ff007a",
  ATOM:"#6f7fb5", NEAR:"#00c1de", ARB:"#28a0f0", OP:"#ff0420",
  TRUSON:"#f0b90b", BCH:"#8dc351", XLM:"#08b5e5", XMR:"#ff6600",
  ETC:"#328332", VET:"#15bdff", ALGO:"#3d5ca8", APT:"#4a90d9",
  SUI:"#4da2ff", FTM:"#1969ff", HBAR:"#00aba9", AAVE:"#b6509e",
  MKR:"#1aab9b", INJ:"#00b2ff", SHIB:"#ffa409", PEPE:"#4caf50",
  DYDX:"#6966ff", GRT:"#6747ed", RNDR:"#e74c3c", SEI:"#9d1c1c",
  TIA:"#7b2cf7", STX:"#5546ff", ONE:"#00aee9", EGLD:"#1d4d9a",
  FLOW:"#00ef8b", KAVA:"#ff433e", ICP:"#29abe2", FIL:"#0090ff",
  THETA:"#2ab8e6", CRV:"#fd0000", LDO:"#f68a2d", SNX:"#00d1ff",
  COMP:"#00d395", FET:"#2f8ef4", WLD:"#1a1a1a", TAO:"#8aff8a",
  OCEAN:"#1a4c76", AXS:"#0055d5", SAND:"#04adef", MANA:"#ff2d55",
  GALA:"#f5c518", IMX:"#17b5cb", ENJ:"#624dbf", QNT:"#585db5",
  HNT:"#474dff", ROSE:"#0092f6", CHZ:"#cd0124", BAT:"#ff5000",
  FLOKI:"#f0b90b", BONK:"#f4a21b", WIF:"#c19a6b", PENDLE:"#3fcfcd",
  GMX:"#4faeec", JUP:"#c0b23b",
};

const PALETTE = ["#f7931a","#627eea","#26a17b","#2775ca","#f3ba2f","#9945ff",
  "#00aae4","#e84142","#0066ff","#c5a66a","#ff6b35","#4ecdc4","#f0b90b","#45b7d1"];

const brandColor = (sym) => {
  if (COIN_CLR[sym]) return COIN_CLR[sym];
  const h = [...(sym || "X")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[h % PALETTE.length];
};

// Strip localhost origin so Vite proxy can serve uploaded files regardless of port.
const resolveLogoUrl = (url) => {
  if (!url) return null;
  try {
    const p = new URL(url);
    if (p.hostname === "localhost" || p.hostname === "127.0.0.1")
      return p.pathname + p.search;
  } catch { /* already relative */ }
  return url;
};

// Public CDN with 1000+ coin icons — covers all major coins.
const cdnUrl = (sym) =>
  `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${sym.toLowerCase()}.png`;

const CoinLogo = ({ symbol = "", size = 36, style = {}, className = "" }) => {
  const { data: logoMap = {} } = useCoinLogos();
  const [errIdx, setErrIdx] = useState(0);

  const sym   = (symbol || "?").toUpperCase();
  const color = brandColor(sym);
  const fsz   = size < 30 ? "0.58rem" : size < 42 ? "0.68rem" : "0.8rem";

  // Build the ordered list of image sources to try.
  const sources = useMemo(() => {
    const list = [];
    const uploaded = resolveLogoUrl(logoMap[sym]);
    if (uploaded) list.push(uploaded);   // 1st priority: server-uploaded logo
    list.push(cdnUrl(sym));              // 2nd priority: public CDN icon
    return list;
  }, [logoMap, sym]);

  const imgSrc = errIdx < sources.length ? sources[errIdx] : null;

  const circle = {
    width: size, height: size, minWidth: size, borderRadius: "50%",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, overflow: "hidden",
    ...style,
  };

  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={sym}
        onError={() => setErrIdx(i => i + 1)}
        className={className}
        style={{
          ...circle,
          objectFit: "cover",
          border: `1.5px solid ${color}55`,
          background: `${color}10`,
        }}
      />
    );
  }

  // All image sources exhausted — show colored letter badge.
  return (
    <span
      className={`db-coin-badge ${className}`}
      style={{
        ...circle,
        background: `${color}1a`,
        border: `1.5px solid ${color}40`,
        color,
        fontSize: fsz,
        fontWeight: 800,
        letterSpacing: "-0.02em",
      }}
    >
      {sym.slice(0, 4)}
    </span>
  );
};

export default CoinLogo;
