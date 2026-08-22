import assert from "node:assert/strict";
import test from "node:test";
import {
  GEOLOCATION_OPTIONS,
  canReuseBrowserLocation,
  createLocationError,
  createLocationRequestTracker,
  getLocationErrorMessage,
  isGeolocationPolicyBlocked,
  normalizeGeolocationError,
  requestBrowserPosition,
} from "../lib/geolocation.js";

function secureRuntime(getCurrentPosition, extras = {}) {
  return {
    windowObject: { isSecureContext: true },
    navigatorObject: { geolocation: { getCurrentPosition }, ...extras },
    documentObject: {},
  };
}

test("starts geolocation synchronously with Safari-friendly options", async () => {
  let called = false;
  let receivedOptions;
  const expected = { coords: { longitude: 121.47, latitude: 31.23 } };
  const promise = requestBrowserPosition(secureRuntime((success, _error, options) => {
    called = true;
    receivedOptions = options;
    success(expected);
  }));

  assert.equal(called, true);
  assert.deepEqual(receivedOptions, GEOLOCATION_OPTIONS);
  assert.equal(await promise, expected);
});

test("rejects insecure, unsupported, and policy-blocked contexts", async () => {
  await assert.rejects(requestBrowserPosition({ windowObject: { isSecureContext: false }, navigatorObject: {}, documentObject: {} }), { code: "insecure" });
  await assert.rejects(requestBrowserPosition({ windowObject: { isSecureContext: true }, navigatorObject: {}, documentObject: {} }), { code: "unsupported" });
  await assert.rejects(requestBrowserPosition({
    windowObject: { isSecureContext: true },
    navigatorObject: { geolocation: { getCurrentPosition() {} } },
    documentObject: { permissionsPolicy: { allowsFeature: () => false } },
  }), { code: "policy-blocked" });
});

test("maps browser geolocation failures to stable public error codes", () => {
  assert.equal(normalizeGeolocationError({ code: 1 }).code, "denied");
  assert.equal(normalizeGeolocationError({ code: 2 }).code, "unavailable");
  assert.equal(normalizeGeolocationError({ code: 3 }).code, "timeout");
  assert.equal(normalizeGeolocationError({ code: 99 }).code, "unavailable");
  const resolveError = createLocationError("resolve-failed");
  assert.equal(resolveError.code, "resolve-failed");
  assert.match(getLocationErrorMessage(resolveError), /地址解析/);
});

test("does not let the Permissions API gate the real location request", async () => {
  for (const permissions of [undefined, { query: () => { throw new Error("not supported"); } }, { query: async () => ({ state: "prompt" }) }]) {
    let calls = 0;
    const runtime = secureRuntime((success) => { calls += 1; success({ coords: {} }); }, permissions ? { permissions } : {});
    await requestBrowserPosition(runtime);
    assert.equal(calls, 1);
  }
});

test("ignores unsupported or throwing Permissions Policy implementations", () => {
  assert.equal(isGeolocationPolicyBlocked({}), false);
  assert.equal(isGeolocationPolicyBlocked({ featurePolicy: { allowsFeature: () => true } }), false);
  assert.equal(isGeolocationPolicyBlocked({ permissionsPolicy: { allowsFeature: () => false } }), true);
  assert.equal(isGeolocationPolicyBlocked({ permissionsPolicy: { allowsFeature: () => { throw new Error("unsupported"); } } }), false);
});

test("reuses only a ready supported location", () => {
  assert.equal(canReuseBrowserLocation({ supported: true }, "ready"), true);
  assert.equal(canReuseBrowserLocation({ supported: false }, "ready"), false);
  assert.equal(canReuseBrowserLocation({ supported: true }, "error"), false);
  assert.equal(canReuseBrowserLocation(null, "ready"), false);
});

test("prevents duplicate requests and rejects stale callbacks", () => {
  const tracker = createLocationRequestTracker();
  const first = tracker.begin();
  assert.equal(first, 1);
  assert.equal(tracker.begin(), null);
  assert.equal(tracker.isCurrent(first), true);
  tracker.invalidate();
  assert.equal(tracker.isCurrent(first), false);
  const second = tracker.begin();
  assert.equal(second, 3);
  assert.equal(tracker.finish(first), false);
  assert.equal(tracker.finish(second), true);
  assert.equal(tracker.begin(), 4);
});
