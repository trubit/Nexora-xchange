/**
 * Region Registry
 *
 * Single source of truth for all regional cluster definitions.
 * Each region owns a slice of the IP space (via continent codes) and
 * a set of market pairs whose matching engine lives in that region.
 *
 * Market ownership rule: each symbol is pinned to exactly ONE region.
 * Orders arriving in a non-owning region are forwarded to the owner.
 */

export const REGIONS = {
  "us-east": {
    id: "us-east",
    label: "US East (Virginia)",
    continents: ["NA"],                        // North America
    countries: ["US", "CA", "MX", "BR", "AR"],
    apiUrl: process.env.REGION_US_EAST_URL   || "http://api-us-east:4000",
    internalUrl: process.env.REGION_US_EAST_INTERNAL || "http://api-us-east:4001",
    wsUrl: process.env.REGION_US_EAST_WS     || "ws://api-us-east:4000",
    dbUri: process.env.MONGO_US_EAST         || process.env.MONGO_URI,
    redisUrl: process.env.REDIS_US_EAST      || process.env.REDIS_URL,
    primaryMarkets: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT"],
    priority: 1,
  },
  "eu-west": {
    id: "eu-west",
    label: "EU West (Frankfurt)",
    continents: ["EU"],
    countries: ["GB", "DE", "FR", "NL", "ES", "IT", "SE", "NO", "CH", "PL"],
    apiUrl: process.env.REGION_EU_WEST_URL   || "http://api-eu-west:4000",
    internalUrl: process.env.REGION_EU_WEST_INTERNAL || "http://api-eu-west:4001",
    wsUrl: process.env.REGION_EU_WEST_WS     || "ws://api-eu-west:4000",
    dbUri: process.env.MONGO_EU_WEST         || process.env.MONGO_URI,
    redisUrl: process.env.REDIS_EU_WEST      || process.env.REDIS_URL,
    primaryMarkets: ["XRPUSDT", "DOTUSDT", "LINKUSDT", "AVAXUSDT", "MATICUSDT"],
    priority: 2,
  },
  "af-south": {
    id: "af-south",
    label: "Africa South (Johannesburg)",
    continents: ["AF"],
    countries: ["ZA", "NG", "KE", "GH", "ET", "TZ", "UG", "SN", "CM"],
    apiUrl: process.env.REGION_AF_SOUTH_URL  || "http://api-af-south:4000",
    internalUrl: process.env.REGION_AF_SOUTH_INTERNAL || "http://api-af-south:4001",
    wsUrl: process.env.REGION_AF_SOUTH_WS    || "ws://api-af-south:4000",
    dbUri: process.env.MONGO_AF_SOUTH        || process.env.MONGO_URI,
    redisUrl: process.env.REDIS_AF_SOUTH     || process.env.REDIS_URL,
    primaryMarkets: ["USDTNGN", "USDTZAR", "USDTKES", "TRXUSDT", "LTCUSDT"],
    priority: 3,
  },
  "ap-southeast": {
    id: "ap-southeast",
    label: "Asia Pacific (Singapore)",
    continents: ["AS", "OC"],
    countries: ["SG", "JP", "KR", "IN", "AU", "TH", "VN", "ID", "MY", "PH", "CN", "HK"],
    apiUrl: process.env.REGION_AP_SE_URL     || "http://api-ap-southeast:4000",
    internalUrl: process.env.REGION_AP_SE_INTERNAL || "http://api-ap-southeast:4001",
    wsUrl: process.env.REGION_AP_SE_WS       || "ws://api-ap-southeast:4000",
    dbUri: process.env.MONGO_AP_SE           || process.env.MONGO_URI,
    redisUrl: process.env.REDIS_AP_SE        || process.env.REDIS_URL,
    primaryMarkets: ["SHIBUSDT", "DOGEUSDT", "UNIUSDT", "ATOMUSDT", "NEARUSDT"],
    priority: 4,
  },
};

// Flat map: symbol → owning region id
export const MARKET_REGION_MAP = Object.entries(REGIONS).reduce(
  (acc, [regionId, cfg]) => {
    for (const sym of cfg.primaryMarkets) acc[sym] = regionId;
    return acc;
  },
  {}
);

// Continent → region id (first match wins)
export const CONTINENT_REGION_MAP = Object.entries(REGIONS).reduce(
  (acc, [regionId, cfg]) => {
    for (const c of cfg.continents) if (!acc[c]) acc[c] = regionId;
    return acc;
  },
  {}
);

// Country → region id
export const COUNTRY_REGION_MAP = Object.entries(REGIONS).reduce(
  (acc, [regionId, cfg]) => {
    for (const c of cfg.countries) if (!acc[c]) acc[c] = regionId;
    return acc;
  },
  {}
);

export const DEFAULT_REGION = "us-east";

export const getRegion = (id) => REGIONS[id] ?? REGIONS[DEFAULT_REGION];
export const listRegions = () => Object.values(REGIONS);
