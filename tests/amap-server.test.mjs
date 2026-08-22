import assert from "node:assert/strict";
import test from "node:test";
import {
  handleAmapConfigRequest,
  handleAmapSecurityProxy,
  handleNearbyRestaurantsRequest,
  handleResolveLocationRequest,
} from "../lib/amap-server.js";

const validBody = {
  longitude: 121.4737,
  latitude: 31.2304,
  radius: 800,
  coordinateSystem: "gcj02",
};

function request(body = validBody) {
  return new Request("http://localhost/api/nearby-restaurants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function locationRequest(body = {
  longitude: 121.4737,
  latitude: 31.2304,
  coordinateSystem: "wgs84",
}) {
  return new Request("http://localhost/api/resolve-location", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function amapPayload(page, count = "26") {
  return {
    status: "1",
    count,
    pois: [{
      id: `B00${page}`,
      name: `测试餐厅 ${page}`,
      location: `121.47${page}7,31.2304`,
      adcode: "310104",
      type: "餐饮服务;中餐厅",
      distance: String(page * 100),
      biz_ext: { cost: "38" },
    }],
  };
}

test("rejects invalid radiuses and non-Shanghai coordinates", async () => {
  const invalidRadius = await handleNearbyRestaurantsRequest(request({ ...validBody, radius: 1600 }), { AMAP_WEB_SERVICE_KEY: "secret" });
  assert.equal(invalidRadius.status, 400);

  const outsideShanghai = await handleNearbyRestaurantsRequest(request({ ...validBody, longitude: 116.4074, latitude: 39.9042 }), { AMAP_WEB_SERVICE_KEY: "secret" });
  assert.equal(outsideShanghai.status, 403);
});

test("requires the Web Service key without exposing its name or value", async () => {
  const response = await handleNearbyRestaurantsRequest(request(), {});
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.doesNotMatch(text, /AMAP_WEB_SERVICE_KEY|secret-value/);
});

test("public map config returns only the browser key and same-origin service host", async () => {
  const response = handleAmapConfigRequest({ NEXT_PUBLIC_AMAP_JS_KEY: "public-browser-key", AMAP_JS_SECURITY_CODE: "private-code" });
  assert.deepEqual(await response.json(), { key: "public-browser-key", serviceHost: "/_AMapService" });
});

test("resolves browser GPS coordinates and address with the Web Service key", async () => {
  const urls = [];
  const fetchMock = async (url) => {
    urls.push(new URL(url));
    if (new URL(url).pathname.endsWith("/coordinate/convert")) {
      return Response.json({ status: "1", locations: "121.478223,31.228034" });
    }
    return Response.json({
      status: "1",
      regeocode: {
        formatted_address: "上海市黄浦区测试路1号",
        addressComponent: {
          province: "上海市",
          city: [],
          district: "黄浦区",
          adcode: "310101",
          streetNumber: { street: "测试路" },
        },
        roads: [{ name: "测试路" }],
      },
    });
  };

  const response = await handleResolveLocationRequest(
    locationRequest(),
    { AMAP_WEB_SERVICE_KEY: "web-service-secret" },
    fetchMock,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.location.longitude, 121.478223);
  assert.equal(payload.location.district, "黄浦区");
  assert.equal(payload.location.road, "测试路");
  assert.equal(payload.location.supported, true);
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => url.searchParams.get("key") === "web-service-secret"));
  assert.equal(urls[0].searchParams.get("coordsys"), "gps");
});

test("validates location requests and does not expose the Web Service key", async () => {
  const invalid = await handleResolveLocationRequest(locationRequest({
    longitude: 181,
    latitude: 31.2304,
    coordinateSystem: "wgs84",
  }), { AMAP_WEB_SERVICE_KEY: "web-service-secret" });
  assert.equal(invalid.status, 400);

  const missingKey = await handleResolveLocationRequest(locationRequest(), {});
  assert.equal(missingKey.status, 503);
  assert.doesNotMatch(await missingKey.text(), /AMAP_WEB_SERVICE_KEY|web-service-secret/);
});

test("normalizes location resolution failures without exposing upstream details", async () => {
  const response = await handleResolveLocationRequest(
    locationRequest(),
    { AMAP_WEB_SERVICE_KEY: "web-service-secret" },
    async () => Response.json({
      status: "0",
      info: "USERKEY_PLAT_NOMATCH",
      infocode: "10009",
      key: "web-service-secret",
    }),
  );
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.doesNotMatch(text, /USERKEY_PLAT_NOMATCH|10009|web-service-secret/);
});

test("fetches at most two pages and returns normalized restaurants", async () => {
  const urls = [];
  const fetchMock = async (url) => {
    urls.push(String(url));
    const page = new URL(url).searchParams.get("page");
    return Response.json(amapPayload(page));
  };
  const response = await handleNearbyRestaurantsRequest(request(), { AMAP_WEB_SERVICE_KEY: "secret-value" }, fetchMock);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(urls.length, 2);
  assert.equal(payload.restaurants.length, 2);
  assert.equal("rating" in payload.restaurants[0], false);
  assert.equal(payload.restaurants[0].cost, 38);
});

test("nearby restaurant responses exclude beverage and dessert POIs", async () => {
  const base = {
    location: "121.4737,31.2304",
    adcode: "310104",
    distance: "200",
    biz_ext: { cost: "32" },
  };
  const fetchMock = async () => Response.json({
    status: "1",
    count: "3",
    pois: [
      { ...base, id: "meal", name: "测试面馆", type: "餐饮服务;中餐厅;面馆", typecode: "050100" },
      { ...base, id: "coffee", name: "测试咖啡店", type: "餐饮服务;咖啡厅", typecode: "050500" },
      { ...base, id: "dessert", name: "测试甜品店", type: "餐饮服务;甜品店", typecode: "050900" },
    ],
  });
  const response = await handleNearbyRestaurantsRequest(
    request(),
    { AMAP_WEB_SERVICE_KEY: "secret-value" },
    fetchMock,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.restaurants.map((item) => item.id), ["meal"]);
});

test("returns a public quota error without leaking the upstream response", async () => {
  const fetchMock = async () => Response.json({ status: "0", info: "DAILY_QUERY_OVER_LIMIT", infocode: "10003", key: "secret-value" });
  const response = await handleNearbyRestaurantsRequest(request(), { AMAP_WEB_SERVICE_KEY: "secret-value" }, fetchMock);
  assert.equal(response.status, 429);
  const text = await response.text();
  assert.doesNotMatch(text, /secret-value|DAILY_QUERY_OVER_LIMIT/);
});

test("security proxy only permits required Amap paths and injects the secret server-side", async () => {
  const denied = await handleAmapSecurityProxy(
    new Request("http://localhost/_AMapService/v3/place/around?key=public"),
    { AMAP_JS_SECURITY_CODE: "js-secret" },
  );
  assert.equal(denied.status, 404);

  let upstreamUrl = "";
  const allowed = await handleAmapSecurityProxy(
    new Request("http://localhost/_AMapService/v3/geocode/regeo?location=121.47%2C31.23&jscode=attacker"),
    { AMAP_JS_SECURITY_CODE: "js-secret" },
    async (url) => {
      upstreamUrl = String(url);
      return Response.json({ status: "1" });
    },
  );
  assert.equal(allowed.status, 200);
  assert.match(upstreamUrl, /jscode=js-secret/);
  assert.doesNotMatch(upstreamUrl, /attacker/);
});
