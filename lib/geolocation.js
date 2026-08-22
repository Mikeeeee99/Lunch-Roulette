export const GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 60000,
});

const ERROR_MESSAGES = {
  insecure: "定位功能需要 HTTPS 安全连接，请使用正式网站地址后重试。",
  unsupported: "当前浏览器不支持定位，暂时无法寻找附近餐厅。",
  "policy-blocked": "当前页面环境禁止使用定位。请直接在 Safari 中打开正式网站后重试。",
  denied: "定位权限没有开启。Safari 可能已记住“不允许”，不会再次弹窗。请在地址栏的页面菜单 → 网站设置 → 位置中选择“询问”或“允许”；如仍失败，请在 iPhone 设置 → 隐私与安全性 → 定位服务中允许 Safari 网站使用位置。",
  unavailable: "暂时无法获取位置，请确认设备定位服务已开启。",
  timeout: "定位超时，请移动到信号更好的位置后重试。",
  "resolve-failed": "已经获得设备位置，但暂时无法完成地址解析，请稍后重试。",
};

export function createLocationError(code, cause) {
  const error = new Error(ERROR_MESSAGES[code] || "定位失败，请稍后重试。");
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function normalizeGeolocationError(error) {
  if (typeof error?.code === "string" && ERROR_MESSAGES[error.code]) return error;
  if (error?.code === 1) return createLocationError("denied", error);
  if (error?.code === 2) return createLocationError("unavailable", error);
  if (error?.code === 3) return createLocationError("timeout", error);
  return createLocationError("unavailable", error);
}

export function isGeolocationPolicyBlocked(documentObject) {
  const policy = documentObject?.permissionsPolicy || documentObject?.featurePolicy;
  if (typeof policy?.allowsFeature !== "function") return false;
  try {
    return policy.allowsFeature("geolocation") === false;
  } catch {
    return false;
  }
}

export function canReuseBrowserLocation(location, status) {
  return status === "ready" && location?.supported === true;
}

export function createLocationRequestTracker() {
  let currentId = 0;
  let pending = false;
  return {
    begin() {
      if (pending) return null;
      currentId += 1;
      pending = true;
      return currentId;
    },
    finish(requestId) {
      if (requestId !== currentId) return false;
      pending = false;
      return true;
    },
    invalidate() {
      currentId += 1;
      pending = false;
    },
    isCurrent(requestId) {
      return requestId === currentId;
    },
  };
}

export function requestBrowserPosition({
  windowObject = typeof window === "undefined" ? undefined : window,
  navigatorObject = typeof navigator === "undefined" ? undefined : navigator,
  documentObject = typeof document === "undefined" ? undefined : document,
  options = GEOLOCATION_OPTIONS,
} = {}) {
  if (!windowObject?.isSecureContext) return Promise.reject(createLocationError("insecure"));
  if (!navigatorObject?.geolocation) return Promise.reject(createLocationError("unsupported"));
  if (isGeolocationPolicyBlocked(documentObject)) return Promise.reject(createLocationError("policy-blocked"));

  return new Promise((resolve, reject) => {
    navigatorObject.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(normalizeGeolocationError(error)),
      options,
    );
  });
}

export function getLocationErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] || error?.message || "定位失败，请稍后重试。";
}
