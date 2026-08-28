export const DISTANCE_OPTIONS = [
  { minutes: 5, radius: 400 },
  { minutes: 10, radius: 800 },
  { minutes: 15, radius: 1200 },
];

export const BUDGET_OPTIONS = [30, 40, 50, null];

const MAINLAND_CHINA_BOUNDS = {
  minLongitude: 73.5,
  maxLongitude: 135.1,
  minLatitude: 18,
  maxLatitude: 53.6,
};

const RESTAURANT_COLORS = [
  "#FFD166",
  "#70C1A2",
  "#FF6B35",
  "#F78DA7",
  "#7F9CF5",
  "#A7D948",
  "#C5A3E6",
  "#E96B50",
];

const NON_MEAL_TYPE_CODE_PREFIXES = ["0505", "0506", "0507", "0508", "0509"];
const NON_MEAL_CATEGORY_PATTERN = /(咖啡厅|咖啡馆|茶艺馆|茶馆|冷饮店|饮品店|饮料店|奶茶店|果汁店|冰淇淋店|甜品店|糕饼店|蛋糕店|烘焙店|酒吧)/i;
const NON_MEAL_NAME_PATTERN = /(星巴克|瑞幸咖啡|MANNER\s*COFFEE|M\s*STAND|库迪咖啡|COTTI\s*COFFEE|咖啡|COFFEE|CAFÉ|CAFE|奶茶|茶饮|果汁|饮品|冰淇淋|甜品|蛋糕|糕点|烘焙|酒吧)/i;

function stableHash(value) {
  return [...String(value)].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
}

function categoryEmoji(category = "") {
  if (/面|粉|米线/.test(category)) return "🍜";
  if (/饺|馄饨|包子/.test(category)) return "🥟";
  if (/火锅|锅/.test(category)) return "🍲";
  if (/咖啡|茶|饮品/.test(category)) return "🥤";
  if (/快餐|小吃/.test(category)) return "🍱";
  if (/西餐|汉堡/.test(category)) return "🍔";
  return "🍽️";
}

function textValue(value) {
  if (typeof value === "string") return value.trim();
  return "";
}

export function radiusForMinutes(minutes) {
  return DISTANCE_OPTIONS.find((option) => option.minutes === Number(minutes))?.radius ?? null;
}

export function normalizeCost(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function isMainlandChinaCoordinate(longitude, latitude) {
  const lng = Number(longitude);
  const lat = Number(latitude);
  return Number.isFinite(lng)
    && Number.isFinite(lat)
    && lng >= MAINLAND_CHINA_BOUNDS.minLongitude
    && lng <= MAINLAND_CHINA_BOUNDS.maxLongitude
    && lat >= MAINLAND_CHINA_BOUNDS.minLatitude
    && lat <= MAINLAND_CHINA_BOUNDS.maxLatitude;
}

export function isMainlandChinaAdcode(adcode) {
  if (!/^\d{6}$/.test(String(adcode || ""))) return false;
  const provinceCode = Number(String(adcode).slice(0, 2));
  return provinceCode >= 11 && provinceCode <= 65;
}

export function isValidAmapCityCode(cityCode) {
  return /^\d{3,4}$/.test(String(cityCode || ""));
}

export function formatLocationRegion(location = {}) {
  const province = textValue(location.province);
  const city = textValue(location.city);
  if (province && city && province !== city) return `${province} · ${city}`;
  return city || province || "当前位置";
}

export function isLunchRestaurantPoi(poi) {
  if (!poi || typeof poi !== "object") return false;
  const name = textValue(poi.name);
  const category = textValue(poi.type);
  const typeCode = textValue(poi.typecode);
  if (!name) return false;
  if (NON_MEAL_TYPE_CODE_PREFIXES.some((prefix) => typeCode.startsWith(prefix))) return false;
  if (NON_MEAL_CATEGORY_PATTERN.test(category)) return false;
  if (NON_MEAL_NAME_PATTERN.test(name)) return false;
  return true;
}

export function normalizeAmapPoi(poi, expectedCityCode = "") {
  if (!poi || typeof poi !== "object") return null;
  const id = textValue(poi.id);
  const name = textValue(poi.name);
  const [longitudeText, latitudeText] = textValue(poi.location).split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
  const adcode = textValue(poi.adcode);
  const cityCode = textValue(poi.citycode);

  if (!id || !name || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (!isLunchRestaurantPoi(poi)) return null;
  if (adcode && !isMainlandChinaAdcode(adcode)) return null;
  if (!isMainlandChinaCoordinate(longitude, latitude)) return null;
  if (isValidAmapCityCode(expectedCityCode) && cityCode && cityCode !== expectedCityCode) return null;

  const typeParts = textValue(poi.type).split(";").filter(Boolean);
  const category = typeParts.at(-1) || "餐饮服务";
  const address = Array.isArray(poi.address) ? "" : textValue(poi.address);
  const distance = normalizeCost(poi.distance);
  const cost = normalizeCost(poi.biz_ext?.cost ?? poi.business?.cost);
  const color = RESTAURANT_COLORS[stableHash(id) % RESTAURANT_COLORS.length];

  return {
    id,
    name,
    category,
    address,
    latitude,
    longitude,
    distance,
    cost,
    source: "amap",
    enabled: true,
    emoji: categoryEmoji(`${poi.type || ""};${name}`),
    color,
  };
}

export function normalizeAmapPois(pois, expectedCityCode = "") {
  if (!Array.isArray(pois)) return [];
  const unique = new Map();
  for (const poi of pois) {
    const normalized = normalizeAmapPoi(poi, expectedCityCode);
    if (normalized && !unique.has(normalized.id)) unique.set(normalized.id, normalized);
  }
  return [...unique.values()];
}

export function filterByBudget(restaurants, maxCost) {
  if (!Array.isArray(restaurants)) return [];
  if (maxCost === null) return [...restaurants];
  const limit = Number(maxCost);
  if (!Number.isFinite(limit)) return [];
  return restaurants.filter((restaurant) => restaurant.cost !== null && restaurant.cost <= limit);
}

export function formatDistance(distance) {
  if (!Number.isFinite(Number(distance))) return "距离未知";
  const meters = Math.max(0, Math.round(Number(distance)));
  const minutes = Math.max(1, Math.round(meters / 80));
  return `${meters} 米 · 约步行 ${minutes} 分钟`;
}

export function formatCost(cost) {
  return cost === null || !Number.isFinite(Number(cost)) ? "价格未知" : `¥${Math.round(Number(cost))}/人`;
}
