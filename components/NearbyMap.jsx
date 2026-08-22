"use client";

import { useEffect, useRef, useState } from "react";
import { loadAmap } from "../lib/amap-client.js";

export default function NearbyMap({ center, radius = 800, restaurants = [], selectedId = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const amapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!center || !containerRef.current) return undefined;
    let cancelled = false;
    setMapReady(false);

    loadAmap().then((AMap) => {
      if (cancelled || !containerRef.current) return;
      amapRef.current = AMap;
      mapRef.current?.destroy();
      mapRef.current = new AMap.Map(containerRef.current, {
        center: [center.longitude, center.latitude],
        zoom: radius <= 400 ? 16 : radius <= 800 ? 15 : 14,
        viewMode: "2D",
        resizeEnable: true,
        dragEnable: true,
        zoomEnable: true,
      });
      setError("");
      setMapReady(true);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message || "地图加载失败。");
    });

    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      amapRef.current = null;
    };
  }, [center?.latitude, center?.longitude, radius]);

  useEffect(() => {
    const AMap = amapRef.current;
    const map = mapRef.current;
    if (!AMap || !map || !center) return;

    if (overlaysRef.current.length) map.remove(overlaysRef.current);
    const userMarker = new AMap.Marker({
      position: [center.longitude, center.latitude],
      title: "你在这里",
      zIndex: 200,
      content: '<div style="width:20px;height:20px;border:4px solid white;border-radius:50%;background:#ff6b35;box-shadow:0 2px 8px rgba(0,0,0,.25)"></div>',
      offset: new AMap.Pixel(-10, -10),
    });
    const rangeCircle = new AMap.Circle({
      center: [center.longitude, center.latitude],
      radius,
      strokeColor: "#183D31",
      strokeWeight: 2,
      strokeOpacity: 0.65,
      fillColor: "#70C1A2",
      fillOpacity: 0.13,
      zIndex: 20,
    });
    const restaurantMarkers = restaurants.map((restaurant) => new AMap.Marker({
      position: [restaurant.longitude, restaurant.latitude],
      title: restaurant.name,
      zIndex: restaurant.id === selectedId ? 180 : 100,
      content: `<div aria-label="${restaurant.name.replace(/[<>&"]/g, "")}" style="display:grid;place-items:center;width:${restaurant.id === selectedId ? 34 : 26}px;height:${restaurant.id === selectedId ? 34 : 26}px;border:${restaurant.id === selectedId ? 4 : 3}px solid white;border-radius:50%;background:${restaurant.id === selectedId ? "#FF6B35" : "#183D31"};color:white;font-size:${restaurant.id === selectedId ? 17 : 13}px;box-shadow:0 3px 10px rgba(0,0,0,.25)">${restaurant.id === selectedId ? "★" : "•"}</div>`,
      offset: new AMap.Pixel(restaurant.id === selectedId ? -17 : -13, restaurant.id === selectedId ? -17 : -13),
    }));

    overlaysRef.current = [rangeCircle, userMarker, ...restaurantMarkers];
    map.add(overlaysRef.current);
    map.setCenter([center.longitude, center.latitude]);
  }, [center, radius, restaurants, selectedId, mapReady]);

  return (
    <div className="relative h-[220px] overflow-hidden rounded-[1.75rem] border border-[#183d31]/10 bg-[#e8eee9] sm:h-[260px]">
      <div ref={containerRef} className="size-full" aria-label="附近餐厅地图" />
      {!center && <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-bold text-[#71847d]">获取位置后，这里会显示附近地图。</div>}
      {error && <div className="absolute inset-0 grid place-items-center bg-[#f1f2ed] px-6 text-center text-sm font-bold text-[#8b5e50]">{error}</div>}
    </div>
  );
}
