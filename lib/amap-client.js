let amapPromise;

async function getAmapConfig() {
  const response = await fetch("/api/amap-config", { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.key) {
    const error = new Error(payload?.error?.message || "地图展示服务尚未配置。");
    error.code = payload?.error?.code || "AMAP_NOT_CONFIGURED";
    throw error;
  }
  return payload;
}

export function loadAmap() {
  if (typeof window === "undefined") return Promise.reject(new Error("地图只能在浏览器中加载。"));
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapPromise) return amapPromise;

  amapPromise = getAmapConfig().then((config) => new Promise((resolve, reject) => {
    window._AMapSecurityConfig = {
      serviceHost: new URL(config.serviceHost, window.location.origin).toString().replace(/\/$/, ""),
    };
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}`;
    script.async = true;
    script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error("地图加载失败，请稍后重试。"));
    script.onerror = () => reject(new Error("地图加载失败，请检查网络。"));
    document.head.appendChild(script);
  })).catch((error) => {
    amapPromise = undefined;
    throw error;
  });

  return amapPromise;
}

export async function resolveBrowserLocation(longitude, latitude) {
  const response = await fetch("/api/resolve-location", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ longitude, latitude, coordinateSystem: "wgs84" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.location) {
    const error = new Error(payload?.error?.message || "暂时无法确认当前位置，请稍后重试。");
    error.code = payload?.error?.code || "AMAP_UNAVAILABLE";
    throw error;
  }
  return payload.location;
}
