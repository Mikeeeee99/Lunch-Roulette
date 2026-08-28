"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NearbyMap from "../components/NearbyMap.jsx";
import { resolveBrowserLocation } from "../lib/amap-client.js";
import {
  canReuseBrowserLocation,
  createLocationError,
  createLocationRequestTracker,
  getLocationErrorMessage,
  requestBrowserPosition,
} from "../lib/geolocation.js";
import {
  BUDGET_OPTIONS,
  DISTANCE_OPTIONS,
  filterByBudget,
  formatCost,
  formatDistance,
  formatLocationRegion,
  isLunchRestaurantPoi,
  radiusForMinutes,
} from "../lib/discovery.js";
import {
  buildCandidatePool,
  formatDateKey,
  getRecentRestaurantIds,
  getWheelLabel,
  getWheelLabelLayout,
  getWheelSectorColors,
  pickDifferentMessage,
  pickRandomRestaurant,
  sampleCandidates,
} from "../lib/roulette.js";

const STORAGE_KEY = "lunch-roulette-history-v1";
const RESULT_MESSAGES = [
  "命运都把店名端上来了，再转就是对午休的不尊重。",
  "都转到它了，就给这段缘分一个午饭的机会。",
  "转盘已经拍板，你只负责带上胃准时出席。",
  "别让命运开第二次会，这家就挺好。",
  "它能从候选里脱颖而出，今天多少有点主角光环。",
  "接受吧，再转一次可能只是把纠结重新加热。",
  "胃已经举手通过，请不要申请重新表决。",
  "宇宙费这么大劲指到它，不去吃多少有点不给面子。",
  "就它了，果断是午休最省时间的调味料。",
  "转盘选得很认真，给它一次证明眼光的机会。",
  "这家不是偶然，是你和午餐之间的命中注定。",
  "先吃了再说，重新选择的机会留给明天。",
];

function Brand() {
  return <div className="flex items-center gap-3 text-lg font-black tracking-tight"><span className="grid size-10 place-items-center rounded-full bg-[#ff6b35] text-xl shadow-[0_4px_0_#c73f16]">🍜</span><span>Lunch Roulette</span></div>;
}

function AppHeader({ step, onHome }) {
  const steps = ["discover", "select", "wheel"];
  const currentIndex = steps.indexOf(step);
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <button type="button" onClick={onHome} className="text-left" aria-label="返回首页"><Brand /></button>
      {step === "home" ? <span className="hidden rounded-full border border-[#183d31]/10 bg-white/70 px-4 py-2 text-xs font-bold text-[#557068] sm:block">全国办公室午餐决策器</span> : <div className="flex items-center gap-2" aria-label="当前步骤">{steps.map((item, index) => <span key={item} className={`h-2.5 rounded-full transition-all ${step === item ? "w-8 bg-[#ff6b35]" : index < currentIndex ? "w-2.5 bg-[#70c1a2]" : "w-2.5 bg-[#d9ddd8]"}`} />)}</div>}
    </header>
  );
}

function DecorativeWheel() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[500px]" aria-hidden="true">
      <div className="absolute inset-2 rounded-full bg-[#183d31] shadow-[0_22px_60px_rgba(24,61,49,.2)]" />
      <div className="absolute inset-7 grid place-items-center rounded-full border-[14px] border-[#fffaf1] bg-[conic-gradient(#ff6b35_0deg_60deg,#ffd166_60deg_120deg,#70c1a2_120deg_180deg,#f78da7_180deg_240deg,#7f9cf5_240deg_300deg,#f3a952_300deg_360deg)]"><div className="grid size-28 place-items-center rounded-full border-8 border-[#fffaf1] bg-[#183d31] text-center text-sm font-black leading-5 text-white shadow-xl">附近<br />午餐</div></div>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 text-5xl drop-shadow-md">▼</div>
      <div className="absolute -right-1 top-14 rotate-6 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-lg sm:-right-4">📍 全国附近餐厅</div>
      <div className="absolute -bottom-1 -left-1 -rotate-3 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-lg sm:-left-4">🎯 最多 30 家</div>
    </div>
  );
}

function HomePage({ history, onStart, onClearHistory }) {
  const todayRecord = history.find((item) => item.date === formatDateKey());
  const recent = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-20 top-24 size-72 rounded-full bg-[#ffd166]/20 blur-3xl" /><div className="pointer-events-none absolute -right-16 top-1/3 size-80 rounded-full bg-[#70c1a2]/20 blur-3xl" />
      <section className="relative mx-auto grid min-h-[calc(100vh-82px)] max-w-6xl items-center gap-12 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pt-0">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#ffe2d7] px-4 py-2 text-sm font-bold text-[#b43f18]"><span>✦</span> V2 · 发现附近真实餐厅</div>
          <h1 className="max-w-2xl text-5xl font-black leading-[1.08] tracking-[-0.04em] sm:text-6xl lg:text-7xl">今天中午，<span className="text-[#ff6b35]">吃什么？</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#557068]">定位中国大陆附近餐厅，按步行范围和预算筛选。剩下的交给转盘，几秒钟结束午餐纠结。</p>
          {todayRecord && <div className="mt-7 flex max-w-lg items-center gap-4 rounded-2xl border border-[#70c1a2]/30 bg-[#e9f7f0] p-4"><span className="text-3xl">{todayRecord.emoji || "🍽️"}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#5a776e]">今天已经选过</p><p className="truncate font-black">{todayRecord.restaurantName}</p></div><span className="text-xl">✓</span></div>}
          <button type="button" onClick={onStart} className="mt-9 rounded-2xl bg-[#183d31] px-8 py-4 text-base font-black text-white shadow-[0_7px_0_#0c251e] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_3px_0_#0c251e]">{todayRecord ? "再选一次" : "寻找附近午餐"} <span className="ml-2">→</span></button>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#6e827b]"><span>✓ 两天不重复</span><span>✓ 最多 30 家</span><span>✓ 本地保存</span></div>
          {recent.length > 0 && <div className="mt-9 border-t border-[#183d31]/10 pt-5"><div className="flex max-w-xl items-center justify-between"><p className="text-xs font-black uppercase tracking-[.16em] text-[#85958f]">最近记录</p><button type="button" onClick={onClearHistory} className="text-xs font-bold text-[#9b6a5a] underline decoration-dotted underline-offset-4">清空记录</button></div><div className="mt-3 flex flex-wrap gap-3">{recent.map((item) => <div key={item.date} className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm shadow-sm"><span>{item.emoji || "🍽️"}</span><span className="font-bold">{item.restaurantName}</span><span className="text-xs text-[#92a09b]">{item.date.slice(5)}</span></div>)}</div></div>}
        </div>
        <DecorativeWheel />
      </section>
    </main>
  );
}

function DiscoverPage({ location, locationStatus, locationError, locationErrorCode, locationRevision, onLocate, searchResults, onSearchResultsChange, distanceMinutes, onDistanceChange, budget, onBudgetChange, searchCache, onContinue }) {
  const radius = radiusForMinutes(distanceMinutes);
  const [searchStatus, setSearchStatus] = useState(searchResults.length ? "ready" : "idle");
  const [searchError, setSearchError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const activeRequestRef = useRef(0);
  const lunchRestaurants = useMemo(() => searchResults.filter(isLunchRestaurantPoi), [searchResults]);
  const filteredRestaurants = useMemo(() => filterByBudget(lunchRestaurants, budget), [lunchRestaurants, budget]);

  useEffect(() => {
    if (locationStatus !== "ready" || !location?.supported || !radius) return undefined;
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const controller = new AbortController();
    const cacheKey = `${location.adcode}:${location.longitude.toFixed(4)}:${location.latitude.toFixed(4)}:${radius}`;
    const cached = searchCache.current.get(cacheKey);
    setSearchError("");
    if (cached) {
      onSearchResultsChange(cached);
      setSearchStatus("ready");
      return () => controller.abort();
    }

    setSearchStatus("loading");
    onSearchResultsChange([]);
    fetch("/api/nearby-restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ longitude: location.longitude, latitude: location.latitude, radius, coordinateSystem: "gcj02", adcode: location.adcode, cityCode: location.cityCode }),
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || "暂时无法获取附近餐厅。");
      return Array.isArray(payload.restaurants) ? payload.restaurants : [];
    }).then((restaurants) => {
      if (activeRequestRef.current !== requestId) return;
      searchCache.current.set(cacheKey, restaurants);
      onSearchResultsChange(restaurants);
      setSearchStatus("ready");
    }).catch((error) => {
      if (controller.signal.aborted || activeRequestRef.current !== requestId) return;
      setSearchStatus("error");
      setSearchError(error.message || "暂时无法获取附近餐厅，请稍后重试。");
    });

    return () => controller.abort();
  }, [location?.adcode, location?.cityCode, location?.latitude, location?.longitude, location?.supported, locationRevision, locationStatus, onSearchResultsChange, radius, retryToken, searchCache]);

  const locationLabel = locationStatus === "loading"
    ? "正在请求定位权限…"
    : locationStatus === "error" || locationStatus === "unsupported"
      ? "暂时无法确认当前位置"
      : location
        ? [formatLocationRegion(location), location.district, location.road && `${location.road}附近`].filter(Boolean).join(" · ")
        : "等待获取你的位置";
  const canContinue = locationStatus === "ready" && searchStatus === "ready" && filteredRestaurants.length > 0;
  const primaryDisabled = locationStatus !== "ready" || !location?.supported || searchStatus === "idle" || searchStatus === "loading" || (searchStatus === "ready" && filteredRestaurants.length === 0);
  const primaryLabel = searchStatus === "loading"
    ? "正在搜索附近午餐…"
    : searchStatus === "error"
      ? "重新搜索附近餐厅"
      : "搜索附近餐厅并可以排除不想吃的 →";

  function handlePrimaryAction() {
    if (searchStatus === "error") {
      setRetryToken((current) => current + 1);
      return;
    }
    if (canContinue) onContinue(filteredRestaurants);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-4 sm:px-8">
      <section>
        <p className="text-sm font-black text-[#ff6b35]">第一步 · 发现附近</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">午休能走多远？</h1><p className="mt-4 max-w-2xl leading-7 text-[#647871]">选好步行范围和人均预算，再去看看附近有哪些午餐值得进入转盘。</p>
        <div className="mt-7 rounded-[1.75rem] bg-white p-5 shadow-[0_12px_35px_rgba(24,61,49,.08)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#8a9994]">当前位置</p><p className="mt-2 font-black">{locationLabel}</p>{locationStatus === "ready" && location?.formattedAddress && <p className="mt-1 text-xs leading-5 text-[#71847d]">{location.formattedAddress}</p>}</div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#ffe2d7] text-xl">📍</span></div>{locationError && <p className="mt-4 rounded-xl bg-[#fff0ea] p-3 text-sm font-bold leading-6 text-[#a54525]">{locationError}</p>}<button type="button" onClick={onLocate} disabled={locationStatus === "loading"} className="mt-4 text-sm font-black text-[#416f60] underline decoration-dotted underline-offset-4 disabled:opacity-40">{locationStatus === "loading" ? "正在获取位置" : locationErrorCode === "denied" ? "我已开启权限，重新定位" : location ? "重新定位" : "允许定位"}</button></div>
        <div className="mt-6"><p className="text-sm font-black">步行范围</p><div className="mt-3 grid grid-cols-3 gap-2">{DISTANCE_OPTIONS.map((option) => <button key={option.minutes} type="button" onClick={() => onDistanceChange(option.minutes)} aria-pressed={distanceMinutes === option.minutes} className={`rounded-2xl border-2 px-3 py-3 text-sm font-black transition ${distanceMinutes === option.minutes ? "border-[#183d31] bg-[#183d31] text-white" : "border-[#183d31]/10 bg-white text-[#526a62]"}`}>{option.minutes} 分钟</button>)}</div><p className="mt-2 text-xs leading-5 text-[#84938e]">按直线距离估算，不代表实际路线耗时；15 分钟是工作日午餐上限。</p></div>
        <div className="mt-6"><p className="text-sm font-black">人均预算</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{BUDGET_OPTIONS.map((option) => <button key={option ?? "unlimited"} type="button" onClick={() => onBudgetChange(option)} aria-pressed={budget === option} className={`rounded-2xl border-2 px-3 py-3 text-sm font-black transition ${budget === option ? "border-[#ff6b35] bg-[#ffe2d7] text-[#ad3e1b]" : "border-[#183d31]/10 bg-white text-[#526a62]"}`}>{option === null ? "不限预算" : `¥${option} 内`}</button>)}</div><p className="mt-2 text-xs leading-5 text-[#84938e]">有限预算会排除高德未提供人均消费的餐厅；不限预算时会保留。</p></div>
        <button type="button" onClick={() => setMapExpanded((current) => !current)} disabled={locationStatus !== "ready" || !location?.supported} aria-expanded={mapExpanded && locationStatus === "ready"} aria-controls="nearby-map-panel" className="mt-7 flex w-full items-center justify-between rounded-2xl border border-[#183d31]/10 bg-white px-5 py-3 text-left text-sm font-black text-[#41695c] shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><span>🗺️ 附近地图</span><span>{mapExpanded && locationStatus === "ready" ? "收起地图 ↑" : locationStatus === "ready" && location?.supported ? "查看地图 ↓" : "定位后可查看"}</span></button>
        {mapExpanded && locationStatus === "ready" && <div id="nearby-map-panel" className="mt-4"><NearbyMap center={location?.supported ? location : null} radius={radius} restaurants={filteredRestaurants} /></div>}
        {locationStatus === "ready" && searchError && <p className="mt-5 rounded-xl bg-[#fff0ea] p-3 text-sm font-bold leading-6 text-[#a54525]">{searchError}</p>}
        {locationStatus === "ready" && searchStatus === "ready" && lunchRestaurants.length > 0 && filteredRestaurants.length === 0 && <p className="mt-5 rounded-xl bg-[#fff4d6] p-3 text-sm font-bold leading-6 text-[#8d6a12]">当前预算下没有可选餐厅，可以提高预算或选择不限预算。</p>}
        {locationStatus === "ready" && searchStatus === "ready" && lunchRestaurants.length === 0 && <p className="mt-5 rounded-xl bg-[#f1f2ed] p-3 text-sm font-bold leading-6 text-[#71847d]">当前范围内没有找到适合午餐的餐厅，可以扩大步行范围。</p>}
        <button type="button" onClick={handlePrimaryAction} disabled={primaryDisabled} className="mt-6 w-full rounded-2xl bg-[#ff6b35] px-6 py-4 font-black text-white shadow-[0_5px_0_#c73f16] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:bg-[#9ca9a4] disabled:shadow-none">{primaryLabel}</button>
        <p className="mt-4 text-center text-[11px] text-[#96a29e]">餐厅与消费数据来自高德地图 · 当前仅用于非商业测试</p>
      </section>
    </main>
  );
}

function RestaurantCard({ restaurant, isRecent, isExcluded, onToggle }) {
  const selected = !isRecent && !isExcluded;
  return (
    <button type="button" onClick={() => !isRecent && onToggle(restaurant.id)} aria-pressed={selected} aria-label={`${restaurant.name}${isRecent ? "，最近吃过，已自动排除" : selected ? "，已加入候选" : "，今天不想吃"}`} className={`group relative flex min-h-44 flex-col rounded-3xl border-2 p-4 text-left transition sm:p-5 ${isRecent ? "cursor-not-allowed border-transparent bg-[#ecece8] opacity-65" : selected ? "border-[#183d31] bg-white shadow-[0_6px_0_#183d31] hover:-translate-y-1" : "border-transparent bg-white/65 opacity-60 hover:opacity-85"}`}>
      <div className="flex w-full items-start justify-between gap-3"><span className="grid size-12 place-items-center rounded-2xl text-2xl" style={{ backgroundColor: `${restaurant.color}35` }}>{restaurant.emoji}</span><span className={`grid size-7 place-items-center rounded-full border-2 text-sm font-black ${selected ? "border-[#183d31] bg-[#183d31] text-white" : "border-[#c5cbc7] text-transparent"}`}>✓</span></div>
      <h3 className="mt-4 font-black leading-tight">{restaurant.name}</h3><p className="mt-1 line-clamp-1 text-xs font-semibold text-[#71847d]">{restaurant.category || "餐饮服务"}</p><div className="mt-auto pt-4 text-xs font-bold leading-5 text-[#63766f]"><p>{formatCost(restaurant.cost)}</p><p>{formatDistance(restaurant.distance)}</p></div>
      {isRecent && <span className="absolute inset-x-3 bottom-3 rounded-full bg-[#dddeda] px-2 py-1 text-center text-[11px] font-black text-[#6f7975]">最近吃过 · 自动排除</span>}{!isRecent && isExcluded && <span className="absolute right-4 top-4 rounded-full bg-[#ffe2d7] px-2 py-1 text-[11px] font-black text-[#b43f18]">今天不想吃</span>}
    </button>
  );
}

function SelectionPage({ restaurants, history, manualExcluded, onToggle, onReset, onBack, onContinue }) {
  const recentIds = useMemo(() => getRecentRestaurantIds(history), [history]);
  const candidates = useMemo(() => buildCandidatePool(restaurants, recentIds, manualExcluded), [restaurants, recentIds, manualExcluded]);
  const recentCount = recentIds.filter((id) => restaurants.some((item) => item.id === id)).length;
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-32 pt-4 sm:px-8">
      <button type="button" onClick={onBack} className="mb-5 rounded-xl px-1 py-2 text-sm font-black text-[#60746d]">← 修改距离和预算</button>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-black text-[#ff6b35]">第二步 · 做排除</p><h1 className="mt-2 flex flex-wrap items-center gap-1 text-3xl font-black tracking-tight sm:text-4xl"><span>今天有什么</span><span className="inline-block -rotate-1 rounded-xl bg-[#ffe2d7] px-2.5 py-1 text-[#d94d20] shadow-[inset_0_-3px_0_#ffb69b]">不想吃</span><span>？</span></h1><p className="mt-3 text-[#647871]">点击不想吃的餐厅卡片即可排除；超过 30 家时，进入转盘前会等概率抽取 30 家。</p></div><div className="flex gap-3"><div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm"><strong className="block text-xl text-[#ff6b35]">{recentCount}</strong><span className="text-[11px] font-bold text-[#80918b]">自动排除</span></div><div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm"><strong className="block text-xl text-[#183d31]">{candidates.length}</strong><span className="text-[11px] font-bold text-[#80918b]">当前可选</span></div></div></div>
      {recentCount > 0 && <div className="mt-7 flex items-start gap-3 rounded-2xl border border-[#d5e9df] bg-[#edf8f3] p-4 text-sm text-[#42695c]"><span className="text-lg">↻</span><p><strong>两天不重复已开启。</strong> 最近两个有记录的午餐日会自动排除。</p></div>}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} isRecent={recentIds.includes(restaurant.id)} isExcluded={manualExcluded.includes(restaurant.id)} onToggle={onToggle} />)}</div>
      {candidates.length === 0 && <p className="mt-6 rounded-2xl bg-[#ffe2d7] p-4 text-center text-sm font-bold text-[#a43d1b]">没有可选餐厅了，请恢复至少一家，或返回调整距离和预算。</p>}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#183d31]/10 bg-[#f7f5ef]/90 px-5 py-4 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><button type="button" onClick={onReset} disabled={manualExcluded.length === 0} className="rounded-xl px-3 py-3 text-sm font-black text-[#6b7e77] disabled:cursor-not-allowed disabled:opacity-35">重置选择</button><button type="button" onClick={() => onContinue(candidates)} disabled={candidates.length === 0} className="rounded-2xl bg-[#183d31] px-5 py-4 text-sm font-black text-white shadow-[0_5px_0_#0c251e] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:bg-[#9ca9a4] disabled:shadow-none sm:px-9">{candidates.length > 30 ? "随机带 30 家去转盘" : `带着 ${candidates.length} 家去转盘`} →</button></div></div>
    </main>
  );
}

function RouletteWheel({ candidates, rotation, isSpinning, selected, onSpin }) {
  const slice = 360 / Math.max(candidates.length, 1);
  const sectorColors = getWheelSectorColors(candidates.length);
  const background = candidates.length ? `conic-gradient(${candidates.map((restaurant, index) => `${sectorColors[index]} ${index * slice}deg ${(index + 1) * slice}deg`).join(",")})` : "#d8ddd9";
  const dense = candidates.length > 20; const medium = candidates.length > 12;
  const wheelSize = "min(900px, calc(100vw - 2.5rem), calc(100dvh - 11rem))";
  return (
    <div className="relative mx-auto aspect-square" style={{ width: wheelSize }}>
      <div className="absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-2 text-5xl text-[#183d31] drop-shadow-md">▼</div>
      <div className="absolute inset-0 rounded-full bg-[#183d31] p-3 shadow-[0_25px_70px_rgba(24,61,49,.25)] sm:p-4">
        <div className="relative size-full overflow-hidden rounded-full border-[9px] border-[#fffaf1] sm:border-[13px]" style={{ background, transform: `rotate(${rotation}deg)`, transition: isSpinning ? "transform 4.2s cubic-bezier(.12,.68,.12,1)" : "none" }}>
          {candidates.map((restaurant, index) => { const { angle, labelRotation } = getWheelLabelLayout(index, candidates.length); const label = getWheelLabel(restaurant.name, dense ? 5 : medium ? 6 : 10); return <div key={restaurant.id} className="absolute left-1/2 top-1/2 z-10 h-1/2 w-px origin-top" style={{ transform: `rotate(${angle}deg)` }}><span title={restaurant.name} aria-label={restaurant.name} className={`absolute inline-flex max-w-[150px] items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-white/75 px-1.5 py-1 text-center font-black leading-none text-[#183d31] shadow-[0_1px_3px_rgba(24,61,49,.16)] ${dense ? "text-[8px] sm:text-[10px]" : medium ? "text-[9px] sm:text-[11px]" : "text-[11px] sm:text-sm"}`} style={{ left: "50%", top: "-70%", transform: `translate(-50%, -50%) rotate(${labelRotation}deg)` }}>{!dense && <span className={medium ? "text-sm sm:text-base" : "text-lg sm:text-xl"}>{restaurant.emoji}</span>}<span>{label}</span></span></div>; })}
        </div>
      </div>
      <button type="button" onClick={onSpin} disabled={isSpinning || selected !== null} aria-label={isSpinning ? "转盘正在转动" : "开始转动午餐转盘"} className="absolute left-1/2 top-1/2 z-30 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[7px] border-[#fffaf1] bg-[#183d31] px-3 text-center text-xs font-black leading-5 text-white shadow-xl transition hover:scale-105 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#ff6b35] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 sm:border-8 sm:text-base" style={{ width: "clamp(5rem, 14vw, 8rem)", height: "clamp(5rem, 14vw, 8rem)" }}>{isSpinning ? "转动中…" : selected ? "本轮已完成" : "开始转动"}</button>
    </div>
  );
}

function ResultModal({ restaurant, message, confirmed, onConfirm, onReroll, onHome, location, candidates }) {
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";

    function trapFocus(event) {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trapFocus);
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => primaryActionRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [confirmed]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#183d31]/50 p-3 backdrop-blur-sm sm:p-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="result-dialog-title" aria-describedby="result-dialog-message" className="animate-result max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[#183d31]/10 bg-white p-5 text-center shadow-[0_28px_90px_rgba(12,37,30,.35)] sm:max-h-[calc(100vh-3rem)] sm:p-7">
        <p className={`text-sm font-black ${confirmed ? "text-[#3d8b70]" : "text-[#ff6b35]"}`}>{confirmed ? "✓ 今天的午餐已保存" : "🎉 转盘替你决定了"}</p><div className="mx-auto mt-4 grid size-20 place-items-center rounded-3xl text-5xl" style={{ backgroundColor: `${restaurant.color}30` }}>{restaurant.emoji}</div><h2 id="result-dialog-title" className="mt-4 text-3xl font-black tracking-tight">{restaurant.name}</h2><p className="mt-2 text-sm font-semibold text-[#71847d]">{restaurant.category || "餐饮服务"} · {formatCost(restaurant.cost)}</p><p className="mt-1 text-sm font-semibold text-[#71847d]">{formatDistance(restaurant.distance)}</p>{restaurant.address && <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#87958f]">{restaurant.address}</p>}<p id="result-dialog-message" className="mx-auto mt-4 max-w-md rounded-2xl bg-[#f7f5ef] px-4 py-3 text-sm leading-6 text-[#5f736c]">{confirmed ? "决定好了就出发吧，祝你午餐愉快！" : message}</p>
        {location && <div className="mx-auto mt-5 max-w-xl text-left"><NearbyMap center={location} radius={Math.max(400, restaurant.distance || 400)} restaurants={candidates} selectedId={restaurant.id} /></div>}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{confirmed ? <button ref={primaryActionRef} type="button" onClick={onHome} className="rounded-2xl bg-[#183d31] px-7 py-3.5 font-black text-white">返回首页</button> : <><button type="button" onClick={onReroll} className="rounded-2xl border-2 border-[#183d31]/15 px-6 py-3.5 font-black text-[#526a62]">换一家</button><button ref={primaryActionRef} type="button" onClick={onConfirm} className="rounded-2xl bg-[#ff6b35] px-7 py-3.5 font-black text-white shadow-[0_5px_0_#c73f16] active:translate-y-1 active:shadow-none">就吃这家！</button></>}</div>
      </div>
    </div>
  );
}

function WheelPage({ candidates, location, onBack, onSave, onHome }) {
  const [rerollExcluded, setRerollExcluded] = useState([]); const [rotation, setRotation] = useState(0); const [isSpinning, setIsSpinning] = useState(false); const [selected, setSelected] = useState(null); const [confirmed, setConfirmed] = useState(false); const [notice, setNotice] = useState(""); const [resultMessage, setResultMessage] = useState(""); const timerRef = useRef(null);
  const available = useMemo(() => candidates.filter((restaurant) => !rerollExcluded.includes(restaurant.id)), [candidates, rerollExcluded]);
  const wheelLabelLength = available.length > 20 ? 5 : available.length > 12 ? 6 : 10;
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  function spin(exclusions = rerollExcluded) { const spinPool = candidates.filter((restaurant) => !exclusions.includes(restaurant.id)); if (spinPool.length === 0 || isSpinning) return; const winner = pickRandomRestaurant(spinPool); const winnerIndex = spinPool.findIndex((item) => item.id === winner.id); const slice = 360 / spinPool.length; const targetOffset = (360 - (winnerIndex * slice + slice / 2)) % 360; const nextRotation = Math.ceil(rotation / 360) * 360 + 5 * 360 + targetOffset; const nextMessage = pickDifferentMessage(RESULT_MESSAGES, resultMessage); setSelected(null); setConfirmed(false); setNotice(""); setIsSpinning(true); setResultMessage(nextMessage); requestAnimationFrame(() => setRotation(nextRotation)); timerRef.current = window.setTimeout(() => { setSelected(winner); setIsSpinning(false); }, 4300); }
  function reroll() { const nextExcluded = [...rerollExcluded, selected.id]; if (candidates.every((item) => nextExcluded.includes(item.id))) { setRerollExcluded([]); setSelected(null); setNotice("所有候选都转过一遍了，已重新放回转盘。"); return; } setRerollExcluded(nextExcluded); setSelected(null); window.setTimeout(() => spin(nextExcluded), 80); }
  function confirm() { onSave(selected); setConfirmed(true); }
  return (
    <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-4 sm:px-8">
      <div className="mb-6 flex items-center justify-between gap-4"><button type="button" onClick={onBack} disabled={isSpinning} className="rounded-xl px-2 py-2 text-sm font-black text-[#60746d] disabled:opacity-30">← 修改餐厅</button><div className="text-right"><p className="text-sm font-black text-[#ff6b35]">第三步 · 命运决定</p><p className="text-xs font-bold text-[#81918b]">{available.length} 家候选餐厅</p></div></div>
      <RouletteWheel candidates={available} rotation={rotation} isSpinning={isSpinning} selected={selected} onSpin={() => spin()} />
      <aside className="mx-auto mt-10 w-full max-w-5xl"><div className="rounded-[2rem] bg-white p-6 shadow-[0_15px_45px_rgba(24,61,49,.08)] sm:p-8"><span className="inline-flex rounded-full bg-[#ffe2d7] px-3 py-1 text-xs font-black text-[#b43f18]">准备好了</span><div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-black tracking-tight">命运转盘</h1><p className="mt-3 text-sm leading-6 text-[#667a73]">每家餐厅机会均等。点击转盘中心开始，指针会准确停到结果扇区。</p></div><p className="shrink-0 text-sm font-black text-[#ff6b35]">{available.length} 家候选</p></div><div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{available.map((item) => <span key={item.id} title={item.name} aria-label={item.name} className="min-w-0 rounded-2xl bg-[#f4f3ef] px-3 py-2 text-xs font-bold leading-5 text-[#5f736c] break-words">{item.emoji} {getWheelLabel(item.name, wheelLabelLength)}</span>)}</div>{notice && <p className="mt-5 rounded-xl bg-[#fff4d6] p-3 text-xs font-bold text-[#8d6a12]">{notice}</p>}</div></aside>
      {selected && <ResultModal restaurant={selected} message={resultMessage} confirmed={confirmed} onConfirm={confirm} onReroll={reroll} onHome={onHome} location={location} candidates={candidates} />}
    </main>
  );
}

export default function Home() {
  const [step, setStep] = useState("home"); const [history, setHistory] = useState([]); const [storageReady, setStorageReady] = useState(false); const [location, setLocation] = useState(null); const [locationStatus, setLocationStatus] = useState("idle"); const [locationError, setLocationError] = useState(""); const [locationErrorCode, setLocationErrorCode] = useState(""); const [locationRevision, setLocationRevision] = useState(0); const [searchResults, setSearchResults] = useState([]); const [selectionRestaurants, setSelectionRestaurants] = useState([]); const [distanceMinutes, setDistanceMinutes] = useState(10); const [budget, setBudget] = useState(40); const [manualExcluded, setManualExcluded] = useState([]); const [wheelCandidates, setWheelCandidates] = useState([]); const searchCache = useRef(new Map()); const locationRequestRef = useRef(createLocationRequestTracker());
  useEffect(() => { try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"); setHistory(Array.isArray(saved) ? saved : []); } catch { setHistory([]); } finally { setStorageReady(true); } }, []);
  function goHome() { locationRequestRef.current.invalidate(); if (locationStatus === "loading") { setLocationStatus(canReuseBrowserLocation(location, "ready") ? "ready" : "idle"); setLocationError(""); setLocationErrorCode(""); } setStep("home"); setManualExcluded([]); setWheelCandidates([]); }
  async function locate() {
    const requestId = locationRequestRef.current.begin();
    if (requestId === null) return;
    setLocationStatus("loading"); setLocationError(""); setLocationErrorCode(""); setSearchResults([]);
    try {
      const browserPosition = await requestBrowserPosition();
      let resolved;
      try {
        resolved = await resolveBrowserLocation(browserPosition.coords.longitude, browserPosition.coords.latitude);
      } catch (error) {
        throw createLocationError("resolve-failed", error);
      }
      if (!locationRequestRef.current.isCurrent(requestId)) return;
      setLocation(resolved); setLocationRevision((current) => current + 1);
      if (resolved.supported) {
        setLocationStatus("ready");
      } else {
        setLocationStatus("unsupported"); setLocationErrorCode("outside-mainland-china"); setLocationError("目前仅支持中国大陆地区，当前位置还不能搜索餐厅。");
      }
    } catch (error) {
      if (!locationRequestRef.current.isCurrent(requestId)) return;
      setLocationStatus(error?.code === "unsupported" ? "unsupported" : "error"); setLocationErrorCode(error?.code || "unknown"); setLocationError(getLocationErrorMessage(error));
    } finally {
      locationRequestRef.current.finish(requestId);
    }
  }
  function start() { setManualExcluded([]); setWheelCandidates([]); if (!canReuseBrowserLocation(location, locationStatus)) void locate(); setStep("discover"); }
  function continueToSelection(restaurants) { setSelectionRestaurants(restaurants); setManualExcluded([]); setWheelCandidates([]); setStep("select"); }
  function toggleRestaurant(id) { setManualExcluded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function continueToWheel(candidates) { setWheelCandidates(sampleCandidates(candidates, 30)); setStep("wheel"); }
  function saveLunch(restaurant) { const today = formatDateKey(); const record = { id: `${today}-${restaurant.id}`, date: today, restaurantId: restaurant.id, restaurantName: restaurant.name, category: restaurant.category, emoji: restaurant.emoji, cost: restaurant.cost, distance: restaurant.distance, address: restaurant.address, source: restaurant.source || "local", selectedAt: new Date().toISOString() }; const next = [record, ...history.filter((item) => item.date !== today)].sort((a, b) => b.date.localeCompare(a.date)); setHistory(next); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  function clearHistory() { if (!window.confirm("确定清空这台设备上的午餐记录吗？")) return; window.localStorage.removeItem(STORAGE_KEY); setHistory([]); }
  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#183d31]"><AppHeader step={step} onHome={goHome} />{!storageReady ? <main className="grid min-h-[70vh] place-items-center text-sm font-bold text-[#71847d]">正在准备你的午餐转盘…</main> : step === "home" ? <HomePage history={history} onStart={start} onClearHistory={clearHistory} /> : step === "discover" ? <DiscoverPage location={location} locationStatus={locationStatus} locationError={locationError} locationErrorCode={locationErrorCode} locationRevision={locationRevision} onLocate={locate} searchResults={searchResults} onSearchResultsChange={setSearchResults} distanceMinutes={distanceMinutes} onDistanceChange={setDistanceMinutes} budget={budget} onBudgetChange={setBudget} searchCache={searchCache} onContinue={continueToSelection} /> : step === "select" ? <SelectionPage restaurants={selectionRestaurants} history={history} manualExcluded={manualExcluded} onToggle={toggleRestaurant} onReset={() => setManualExcluded([])} onBack={() => setStep("discover")} onContinue={continueToWheel} /> : <WheelPage candidates={wheelCandidates} location={location} onBack={() => setStep("select")} onSave={saveLunch} onHome={goHome} />}</div>
  );
}
