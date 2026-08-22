import { isShanghaiCoordinate, normalizeAmapPois } from "./discovery.js";

const ALLOWED_RADII = new Set([400, 800, 1200]);
const AMAP_PAGE_SIZE = 25;
const AMAP_MAX_PAGES = 2;
const AMAP_TIMEOUT_MS = 8000;
const AMAP_PROXY_PATHS = new Set([
  "/v3/assistant/coordinate/convert",
  "/v3/geocode/regeo",
]);

function jsonResponse(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function publicError(code, message, status) {
  return jsonResponse({ error: { code, message } }, status);
}

function isQuotaError(info = "", infocode = "") {
  return /LIMIT|QUOTA|DAILY_QUERY_OVER/i.test(info)
    || ["10003", "10004", "10020", "10021", "10044"].includes(String(infocode));
}

async function fetchWithTimeout(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AMAP_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAmapJson(url, fetchImpl) {
  const response = await fetchWithTimeout(url, fetchImpl);
  if (!response.ok) throw new Error("AMAP_UNAVAILABLE");

  const payload = await response.json();
  if (payload?.status !== "1") {
    if (isQuotaError(payload?.info, payload?.infocode)) throw new Error("AMAP_QUOTA_EXCEEDED");
    throw new Error("AMAP_REJECTED");
  }
  return payload;
}

async function fetchAmapPage({ key, longitude, latitude, radius, page, fetchImpl }) {
  const url = new URL("https://restapi.amap.com/v3/place/around");
  url.search = new URLSearchParams({
    key,
    location: `${longitude.toFixed(6)},${latitude.toFixed(6)}`,
    radius: String(radius),
    types: "050000",
    city: "上海",
    sortrule: "distance",
    offset: String(AMAP_PAGE_SIZE),
    page: String(page),
    extensions: "all",
    output: "JSON",
  }).toString();

  return fetchAmapJson(url, fetchImpl);
}

function parseCoordinatePair(value) {
  const [longitudeText, latitudeText] = String(value || "").split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { longitude, latitude };
}

function textValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeResolvedLocation(coordinate, regeocode = {}) {
  const component = regeocode.addressComponent || {};
  const province = textValue(component.province);
  const city = textValue(component.city);
  const district = textValue(component.district);
  const adcode = textValue(component.adcode);
  const road = textValue(regeocode.roads?.[0]?.name)
    || textValue(component.streetNumber?.street)
    || "当前位置";

  return {
    ...coordinate,
    province,
    city,
    district,
    adcode,
    road,
    formattedAddress: textValue(regeocode.formatted_address),
    supported: adcode.startsWith("31")
      || province === "上海市"
      || isShanghaiCoordinate(coordinate.longitude, coordinate.latitude),
  };
}

export async function handleResolveLocationRequest(request, bindings = {}, fetchImpl = fetch) {
  if (request.method !== "POST") return publicError("METHOD_NOT_ALLOWED", "仅支持 POST 请求。", 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return publicError("INVALID_REQUEST", "请求内容格式不正确。", 400);
  }

  const longitude = Number(body?.longitude);
  const latitude = Number(body?.latitude);
  if (body?.coordinateSystem !== "wgs84"
    || !Number.isFinite(longitude)
    || !Number.isFinite(latitude)
    || longitude < -180
    || longitude > 180
    || latitude < -90
    || latitude > 90) {
    return publicError("INVALID_REQUEST", "当前位置坐标格式不正确。", 400);
  }

  const key = bindings.AMAP_WEB_SERVICE_KEY;
  if (!key) return publicError("AMAP_NOT_CONFIGURED", "位置解析服务尚未配置。", 503);

  try {
    const convertUrl = new URL("https://restapi.amap.com/v3/assistant/coordinate/convert");
    convertUrl.search = new URLSearchParams({
      key,
      locations: `${longitude.toFixed(6)},${latitude.toFixed(6)}`,
      coordsys: "gps",
      output: "JSON",
    }).toString();
    const convertedPayload = await fetchAmapJson(convertUrl, fetchImpl);
    const coordinate = parseCoordinatePair(convertedPayload.locations);
    if (!coordinate) throw new Error("AMAP_REJECTED");

    const geocodeUrl = new URL("https://restapi.amap.com/v3/geocode/regeo");
    geocodeUrl.search = new URLSearchParams({
      key,
      location: `${coordinate.longitude.toFixed(6)},${coordinate.latitude.toFixed(6)}`,
      radius: "1000",
      extensions: "all",
      output: "JSON",
    }).toString();
    const geocodePayload = await fetchAmapJson(geocodeUrl, fetchImpl);
    const location = normalizeResolvedLocation(coordinate, geocodePayload.regeocode);
    return jsonResponse({ location });
  } catch (error) {
    if (error?.name === "AbortError") return publicError("AMAP_TIMEOUT", "位置解析超时，请稍后重试。", 504);
    if (error?.message === "AMAP_QUOTA_EXCEEDED") return publicError("AMAP_QUOTA_EXCEEDED", "今日地图免费额度可能已用完，请稍后再试。", 429);
    return publicError("AMAP_UNAVAILABLE", "暂时无法确认当前位置，请稍后重试。", 502);
  }
}

export async function handleNearbyRestaurantsRequest(request, bindings = {}, fetchImpl = fetch) {
  if (request.method !== "POST") return publicError("METHOD_NOT_ALLOWED", "仅支持 POST 请求。", 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return publicError("INVALID_REQUEST", "请求内容格式不正确。", 400);
  }

  const longitude = Number(body?.longitude);
  const latitude = Number(body?.latitude);
  const radius = Number(body?.radius);
  if (body?.coordinateSystem !== "gcj02"
    || !Number.isFinite(longitude)
    || !Number.isFinite(latitude)
    || !ALLOWED_RADII.has(radius)) {
    return publicError("INVALID_REQUEST", "位置或搜索范围不正确。", 400);
  }
  if (!isShanghaiCoordinate(longitude, latitude)) {
    return publicError("UNSUPPORTED_CITY", "V2 暂仅支持上海地区。", 403);
  }

  const key = bindings.AMAP_WEB_SERVICE_KEY;
  if (!key) return publicError("AMAP_NOT_CONFIGURED", "附近餐厅服务尚未配置。", 503);

  try {
    const firstPage = await fetchAmapPage({ key, longitude, latitude, radius, page: 1, fetchImpl });
    const rawPois = [...(Array.isArray(firstPage.pois) ? firstPage.pois : [])];
    const total = Number(firstPage.count) || rawPois.length;

    if (total > AMAP_PAGE_SIZE && AMAP_MAX_PAGES > 1) {
      const secondPage = await fetchAmapPage({ key, longitude, latitude, radius, page: 2, fetchImpl });
      rawPois.push(...(Array.isArray(secondPage.pois) ? secondPage.pois : []));
    }

    const restaurants = normalizeAmapPois(rawPois);
    return jsonResponse({
      restaurants,
      meta: {
        totalFetched: rawPois.length,
        returnedCount: restaurants.length,
        maxPages: AMAP_MAX_PAGES,
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") return publicError("AMAP_TIMEOUT", "附近餐厅搜索超时，请稍后重试。", 504);
    if (error?.message === "AMAP_QUOTA_EXCEEDED") return publicError("AMAP_QUOTA_EXCEEDED", "今日地图免费额度可能已用完，请稍后再试。", 429);
    return publicError("AMAP_UNAVAILABLE", "暂时无法获取附近餐厅，请稍后重试。", 502);
  }
}

export function handleAmapConfigRequest(bindings = {}) {
  const key = bindings.NEXT_PUBLIC_AMAP_JS_KEY;
  if (!key) return publicError("AMAP_NOT_CONFIGURED", "地图展示服务尚未配置。", 503);
  return jsonResponse({ key, serviceHost: "/_AMapService" });
}

export async function handleAmapSecurityProxy(request, bindings = {}, fetchImpl = fetch) {
  if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  const securityCode = bindings.AMAP_JS_SECURITY_CODE;
  if (!securityCode) return new Response("Map service is not configured", { status: 503 });

  const incoming = new URL(request.url);
  const upstreamPath = incoming.pathname.replace(/^\/_AMapService/, "");
  if (!AMAP_PROXY_PATHS.has(upstreamPath)) return new Response("Not Found", { status: 404 });

  const upstream = new URL(upstreamPath, "https://restapi.amap.com");
  incoming.searchParams.delete("jscode");
  for (const [name, value] of incoming.searchParams) upstream.searchParams.append(name, value);
  upstream.searchParams.set("jscode", securityCode);

  try {
    const response = await fetchWithTimeout(upstream, fetchImpl);
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Map service unavailable", { status: 502 });
  }
}
