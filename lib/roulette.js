export function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getRecentRestaurantIds(history, today = formatDateKey(), dayCount = 2) {
  const recentDates = [...new Set(history.filter((record) => record.date < today).map((record) => record.date))].sort((a, b) => b.localeCompare(a)).slice(0, dayCount);
  return [...new Set(history.filter((record) => recentDates.includes(record.date)).map((record) => record.restaurantId))];
}

export function buildCandidatePool(restaurants, recentIds = [], manualExcludedIds = [], rerollExcludedIds = []) {
  const excluded = new Set([...recentIds, ...manualExcludedIds, ...rerollExcludedIds]);
  return restaurants.filter((restaurant) => restaurant.enabled !== false && !excluded.has(restaurant.id));
}

export function pickRandomRestaurant(candidates, random = Math.random) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const index = Math.min(Math.floor(random() * candidates.length), candidates.length - 1);
  return candidates[index];
}

export function pickDifferentMessage(messages, currentMessage = "", random = Math.random) {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  const choices = messages.length > 1 ? messages.filter((message) => message !== currentMessage) : messages;
  const index = Math.min(Math.floor(random() * choices.length), choices.length - 1);
  return choices[index];
}

export function sampleCandidates(candidates, limit = 30, random = Math.random) {
  if (!Array.isArray(candidates) || limit <= 0) return [];
  if (candidates.length <= limit) return [...candidates];

  const shuffled = [...candidates];
  for (let index = 0; index < limit; index += 1) {
    const swapIndex = index + Math.min(
      Math.floor(random() * (shuffled.length - index)),
      shuffled.length - index - 1,
    );
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}

const WHEEL_SECTOR_COLORS = [
  "#FFD166", "#70C1A2", "#FF6B35", "#F78DA7", "#7F9CF5",
  "#A7D948", "#C5A3E6", "#E96B50", "#66C7C0", "#F5B74C",
  "#90A4F4", "#EC8FB6", "#82C96F", "#F28C5B", "#A98AD6",
  "#5FC3E4", "#E9C46A", "#8AC6A7", "#F49E9E", "#B8D96B",
  "#79A9E8", "#D8A0D8", "#F7C06A", "#65C2A5", "#EE7D68",
  "#9CBF63", "#92A8E8", "#ECA0B8", "#76C9D4", "#C6A1E8",
];

export function getWheelSectorColors(count) {
  const safeCount = Math.max(0, Math.min(Math.floor(Number(count) || 0), WHEEL_SECTOR_COLORS.length));
  return WHEEL_SECTOR_COLORS.slice(0, safeCount);
}

export function getWheelLabelLayout(index, count) {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const slice = 360 / safeCount;
  const angle = Number(index) * slice + slice / 2;
  const normalizedAngle = ((angle % 360) + 360) % 360;
  const flipped = normalizedAngle <= 180;

  return {
    angle,
    flipped,
    labelRotation: flipped ? 270 : 90,
  };
}

const FOOD_SUFFIXES = [
  "海鲜牛肉冒菜",
  "兰州牛肉面",
  "黄焖鸡米饭",
  "麻辣拌",
  "麻辣烫",
  "鸡公煲",
  "牛肉面",
  "牛肉汤",
  "骨头汤",
  "茶餐厅",
  "馄饨铺",
  "馄饨",
  "水饺",
  "米线",
  "米粉",
  "面馆",
  "食堂",
  "餐厅",
  "饼店",
  "粥铺",
];

export function getWheelLabel(name, maxLength = 6) {
  if (typeof name !== "string" || maxLength <= 0) return "餐厅";
  const cleaned = name
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "餐厅";

  const primaryName = cleaned.split(/[·•|｜]/).map((part) => part.trim()).find(Boolean) || cleaned;
  if ([...primaryName].length <= maxLength) return primaryName;

  const suffix = FOOD_SUFFIXES.find((item) => primaryName.endsWith(item) && [...item].length < maxLength);
  if (suffix) {
    const prefixLength = maxLength - [...suffix].length;
    return `${[...primaryName].slice(0, prefixLength).join("")}${suffix}`;
  }
  return [...primaryName].slice(0, maxLength).join("");
}
