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
  return restaurants.filter((restaurant) => restaurant.enabled && !excluded.has(restaurant.id));
}

export function pickRandomRestaurant(candidates, random = Math.random) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const index = Math.min(Math.floor(random() * candidates.length), candidates.length - 1);
  return candidates[index];
}
