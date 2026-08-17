"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import restaurants from "../data/restaurants.json";
import { buildCandidatePool, formatDateKey, getRecentRestaurantIds, pickRandomRestaurant } from "../lib/roulette.js";

const STORAGE_KEY = "lunch-roulette-history-v1";

function Brand() {
  return (
    <div className="flex items-center gap-3 text-lg font-black tracking-tight">
      <span className="grid size-10 place-items-center rounded-full bg-[#ff6b35] text-xl shadow-[0_4px_0_#c73f16]">🍜</span>
      <span>Lunch Roulette</span>
    </div>
  );
}

function AppHeader({ step, onHome }) {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <button type="button" onClick={onHome} className="text-left" aria-label="返回首页"><Brand /></button>
      {step === "home" ? (
        <span className="hidden rounded-full border border-[#183d31]/10 bg-white/70 px-4 py-2 text-xs font-bold text-[#557068] sm:block">办公室午餐决策器</span>
      ) : (
        <div className="flex items-center gap-2" aria-label="当前步骤">
          {["select", "wheel"].map((item, index) => (
            <span key={item} className={`h-2.5 rounded-full transition-all ${step === item ? "w-8 bg-[#ff6b35]" : index === 0 && step === "wheel" ? "w-2.5 bg-[#70c1a2]" : "w-2.5 bg-[#d9ddd8]"}`} />
          ))}
        </div>
      )}
    </header>
  );
}

function DecorativeWheel() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[500px]" aria-hidden="true">
      <div className="absolute inset-2 rounded-full bg-[#183d31] shadow-[0_22px_60px_rgba(24,61,49,.2)]" />
      <div className="absolute inset-7 grid place-items-center rounded-full border-[14px] border-[#fffaf1] bg-[conic-gradient(#ff6b35_0deg_60deg,#ffd166_60deg_120deg,#70c1a2_120deg_180deg,#f78da7_180deg_240deg,#7f9cf5_240deg_300deg,#f3a952_300deg_360deg)]">
        <div className="grid size-28 place-items-center rounded-full border-8 border-[#fffaf1] bg-[#183d31] text-center text-sm font-black leading-5 text-white shadow-xl">午餐<br />转盘</div>
      </div>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 text-5xl drop-shadow-md">▼</div>
      <div className="absolute -right-1 top-14 rotate-6 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-lg sm:-right-4">🍚 {restaurants.length} 家餐厅</div>
      <div className="absolute -bottom-1 -left-1 -rotate-3 rounded-2xl bg-white px-4 py-3 text-sm font-black shadow-lg sm:-left-4">⏱ 5 秒决定</div>
    </div>
  );
}

function HomePage({ history, onStart, onClearHistory }) {
  const todayRecord = history.find((item) => item.date === formatDateKey());
  const recent = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-20 top-24 size-72 rounded-full bg-[#ffd166]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-1/3 size-80 rounded-full bg-[#70c1a2]/20 blur-3xl" />
      <section className="relative mx-auto grid min-h-[calc(100vh-82px)] max-w-6xl items-center gap-12 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pt-0">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#ffe2d7] px-4 py-2 text-sm font-bold text-[#b43f18]"><span>✦</span> 告别午餐选择困难</div>
          <h1 className="max-w-2xl text-5xl font-black leading-[1.08] tracking-[-0.04em] sm:text-6xl lg:text-7xl">今天中午，<span className="text-[#ff6b35]">吃什么？</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#557068]">排除不想吃的，避开最近吃过的。剩下的交给转盘，几秒钟决定今天的快乐。</p>
          {todayRecord && (
            <div className="mt-7 flex max-w-lg items-center gap-4 rounded-2xl border border-[#70c1a2]/30 bg-[#e9f7f0] p-4">
              <span className="text-3xl">{todayRecord.emoji}</span>
              <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#5a776e]">今天已经选过</p><p className="truncate font-black">{todayRecord.restaurantName}</p></div>
              <span className="text-xl">✓</span>
            </div>
          )}
          <button type="button" onClick={onStart} className="mt-9 rounded-2xl bg-[#183d31] px-8 py-4 text-base font-black text-white shadow-[0_7px_0_#0c251e] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_3px_0_#0c251e]">{todayRecord ? "再选一次" : "开始选择午餐"} <span className="ml-2">→</span></button>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#6e827b]"><span>✓ 两天不重复</span><span>✓ 无需登录</span><span>✓ 本地保存</span></div>
          {recent.length > 0 && (
            <div className="mt-9 border-t border-[#183d31]/10 pt-5">
              <div className="flex max-w-xl items-center justify-between"><p className="text-xs font-black uppercase tracking-[.16em] text-[#85958f]">最近记录</p><button type="button" onClick={onClearHistory} className="text-xs font-bold text-[#9b6a5a] underline decoration-dotted underline-offset-4">清空记录</button></div>
              <div className="mt-3 flex flex-wrap gap-3">{recent.map((item) => <div key={item.date} className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm shadow-sm"><span>{item.emoji}</span><span className="font-bold">{item.restaurantName}</span><span className="text-xs text-[#92a09b]">{item.date.slice(5)}</span></div>)}</div>
            </div>
          )}
        </div>
        <DecorativeWheel />
      </section>
    </main>
  );
}

function RestaurantCard({ restaurant, isRecent, isExcluded, onToggle }) {
  const selected = !isRecent && !isExcluded;
  return (
    <button type="button" onClick={() => !isRecent && onToggle(restaurant.id)} aria-pressed={selected} aria-label={`${restaurant.name}${isRecent ? "，最近吃过，已自动排除" : selected ? "，已加入候选" : "，今天不想吃"}`} className={`group relative flex min-h-40 flex-col rounded-3xl border-2 p-4 text-left transition sm:p-5 ${isRecent ? "cursor-not-allowed border-transparent bg-[#ecece8] opacity-65" : selected ? "border-[#183d31] bg-white shadow-[0_6px_0_#183d31] hover:-translate-y-1" : "border-transparent bg-white/65 opacity-60 hover:opacity-85"}`}>
      <div className="flex w-full items-start justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-2xl text-2xl" style={{ backgroundColor: `${restaurant.color}35` }}>{restaurant.emoji}</span>
        <span className={`grid size-7 place-items-center rounded-full border-2 text-sm font-black ${selected ? "border-[#183d31] bg-[#183d31] text-white" : "border-[#c5cbc7] text-transparent"}`}>✓</span>
      </div>
      <h3 className="mt-4 font-black leading-tight">{restaurant.name}</h3>
      <p className="mt-1 text-xs font-semibold text-[#71847d]">{restaurant.category}</p>
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs font-bold text-[#63766f]"><span>¥{restaurant.price}/人</span><span className="text-[#c4ccc8]">·</span><span>{restaurant.distance}</span></div>
      {isRecent && <span className="absolute inset-x-3 bottom-3 rounded-full bg-[#dddeda] px-2 py-1 text-center text-[11px] font-black text-[#6f7975]">最近吃过 · 自动排除</span>}
      {!isRecent && isExcluded && <span className="absolute right-4 top-4 rounded-full bg-[#ffe2d7] px-2 py-1 text-[11px] font-black text-[#b43f18]">今天不想吃</span>}
    </button>
  );
}

function SelectionPage({ history, manualExcluded, onToggle, onReset, onContinue }) {
  const recentIds = useMemo(() => getRecentRestaurantIds(history), [history]);
  const candidates = useMemo(() => buildCandidatePool(restaurants, recentIds, manualExcluded), [recentIds, manualExcluded]);
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-32 pt-6 sm:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-sm font-black text-[#ff6b35]">第一步</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">今天有什么不想吃？</h1><p className="mt-3 text-[#647871]">点击餐厅卡片即可排除；不挑食的话，直接进入转盘。</p></div>
        <div className="flex gap-3">
          <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm"><strong className="block text-xl text-[#ff6b35]">{recentIds.length}</strong><span className="text-[11px] font-bold text-[#80918b]">自动排除</span></div>
          <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm"><strong className="block text-xl text-[#183d31]">{candidates.length}</strong><span className="text-[11px] font-bold text-[#80918b]">最终候选</span></div>
        </div>
      </div>
      {recentIds.length > 0 && <div className="mt-7 flex items-start gap-3 rounded-2xl border border-[#d5e9df] bg-[#edf8f3] p-4 text-sm text-[#42695c]"><span className="text-lg">↻</span><p><strong>两天不重复已开启。</strong> 最近两个有记录的午餐日会自动排除。</p></div>}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {restaurants.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant} isRecent={recentIds.includes(restaurant.id)} isExcluded={manualExcluded.includes(restaurant.id)} onToggle={onToggle} />)}
      </div>
      {candidates.length === 0 && <p className="mt-6 rounded-2xl bg-[#ffe2d7] p-4 text-center text-sm font-bold text-[#a43d1b]">没有可选餐厅了，请恢复至少一家餐厅。</p>}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#183d31]/10 bg-[#f7f5ef]/90 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button type="button" onClick={onReset} disabled={manualExcluded.length === 0} className="rounded-xl px-3 py-3 text-sm font-black text-[#6b7e77] disabled:cursor-not-allowed disabled:opacity-35">重置选择</button>
          <button type="button" onClick={onContinue} disabled={candidates.length === 0} className="rounded-2xl bg-[#183d31] px-6 py-4 text-sm font-black text-white shadow-[0_5px_0_#0c251e] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:bg-[#9ca9a4] disabled:shadow-none sm:px-9">{manualExcluded.length === 0 ? "全部都可以，开始转盘" : `带着 ${candidates.length} 家去转盘`} →</button>
        </div>
      </div>
    </main>
  );
}

function RouletteWheel({ candidates, rotation, isSpinning }) {
  const slice = 360 / Math.max(candidates.length, 1);
  const background = candidates.length ? `conic-gradient(${candidates.map((restaurant, index) => `${restaurant.color} ${index * slice}deg ${(index + 1) * slice}deg`).join(",")})` : "#d8ddd9";
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-2 text-5xl text-[#183d31] drop-shadow-md">▼</div>
      <div className="absolute inset-0 rounded-full bg-[#183d31] p-3 shadow-[0_25px_70px_rgba(24,61,49,.25)] sm:p-4">
        <div className="relative size-full overflow-hidden rounded-full border-[9px] border-[#fffaf1] sm:border-[13px]" style={{ background, transform: `rotate(${rotation}deg)`, transition: isSpinning ? "transform 4.2s cubic-bezier(.12,.68,.12,1)" : "none" }}>
          {candidates.map((restaurant, index) => {
            const angle = index * slice + slice / 2;
            return <div key={restaurant.id} className="absolute left-1/2 top-1/2 z-10 text-center text-[11px] font-black text-[#183d31] drop-shadow-[0_1px_0_rgba(255,255,255,.55)] sm:text-sm" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(clamp(-170px, -34vw, -92px)) rotate(${-angle}deg)`, width: candidates.length > 8 ? "78px" : "100px" }}><span className="block text-xl sm:text-2xl">{restaurant.emoji}</span><span className="line-clamp-2">{restaurant.name}</span></div>;
          })}
          <div className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[7px] border-[#fffaf1] bg-[#183d31] text-xs font-black text-white shadow-xl sm:size-28 sm:border-8 sm:text-sm">{isSpinning ? "转动中…" : "午餐转盘"}</div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ restaurant, confirmed, onConfirm, onReroll, onHome }) {
  return (
    <div className="animate-result mx-auto mt-7 max-w-xl rounded-[2rem] border border-[#183d31]/10 bg-white p-5 text-center shadow-[0_18px_50px_rgba(24,61,49,.12)] sm:p-7">
      <p className={`text-sm font-black ${confirmed ? "text-[#3d8b70]" : "text-[#ff6b35]"}`}>{confirmed ? "✓ 今天的午餐已保存" : "🎉 转盘替你决定了"}</p>
      <div className="mx-auto mt-4 grid size-20 place-items-center rounded-3xl text-5xl" style={{ backgroundColor: `${restaurant.color}30` }}>{restaurant.emoji}</div>
      <h2 className="mt-4 text-3xl font-black tracking-tight">{restaurant.name}</h2>
      <p className="mt-2 text-sm font-semibold text-[#71847d]">{restaurant.category} · ¥{restaurant.price}/人 · {restaurant.distance}</p>
      <p className="mx-auto mt-4 max-w-md rounded-2xl bg-[#f7f5ef] px-4 py-3 text-sm leading-6 text-[#5f736c]">{confirmed ? "决定好了就出发吧，祝你午餐愉快！" : "这一刻别再纠结了——随机，也是认真生活的一种方式。"}</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {confirmed ? <button type="button" onClick={onHome} className="rounded-2xl bg-[#183d31] px-7 py-3.5 font-black text-white">返回首页</button> : <><button type="button" onClick={onReroll} className="rounded-2xl border-2 border-[#183d31]/15 px-6 py-3.5 font-black text-[#526a62]">换一家</button><button type="button" onClick={onConfirm} className="rounded-2xl bg-[#ff6b35] px-7 py-3.5 font-black text-white shadow-[0_5px_0_#c73f16] active:translate-y-1 active:shadow-none">就吃这家！</button></>}
      </div>
    </div>
  );
}

function WheelPage({ candidates, onBack, onSave, onHome }) {
  const [rerollExcluded, setRerollExcluded] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const timerRef = useRef(null);
  const available = useMemo(() => candidates.filter((restaurant) => !rerollExcluded.includes(restaurant.id)), [candidates, rerollExcluded]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function spin(exclusions = rerollExcluded) {
    const spinPool = candidates.filter((restaurant) => !exclusions.includes(restaurant.id));
    if (spinPool.length === 0 || isSpinning) return;
    const winner = pickRandomRestaurant(spinPool);
    const winnerIndex = spinPool.findIndex((item) => item.id === winner.id);
    const slice = 360 / spinPool.length;
    const targetOffset = (360 - (winnerIndex * slice + slice / 2)) % 360;
    const nextRotation = Math.ceil(rotation / 360) * 360 + 5 * 360 + targetOffset;
    setSelected(null); setConfirmed(false); setNotice(""); setIsSpinning(true);
    requestAnimationFrame(() => setRotation(nextRotation));
    timerRef.current = window.setTimeout(() => { setSelected(winner); setIsSpinning(false); }, 4300);
  }

  function reroll() {
    const nextExcluded = [...rerollExcluded, selected.id];
    if (candidates.every((item) => nextExcluded.includes(item.id))) {
      setRerollExcluded([]); setSelected(null); setNotice("所有候选都转过一遍了，已重新放回转盘。"); return;
    }
    setRerollExcluded(nextExcluded); setSelected(null);
    window.setTimeout(() => spin(nextExcluded), 80);
  }

  function confirm() { onSave(selected); setConfirmed(true); }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-4 sm:px-8">
      <div className="mb-6 flex items-center justify-between gap-4"><button type="button" onClick={onBack} disabled={isSpinning} className="rounded-xl px-2 py-2 text-sm font-black text-[#60746d] disabled:opacity-30">← 修改餐厅</button><div className="text-right"><p className="text-sm font-black text-[#ff6b35]">第二步</p><p className="text-xs font-bold text-[#81918b]">{available.length} 家候选餐厅</p></div></div>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-14">
        <RouletteWheel candidates={available} rotation={rotation} isSpinning={isSpinning} />
        <aside className="lg:sticky lg:top-6"><div className="rounded-[2rem] bg-white p-6 shadow-[0_15px_45px_rgba(24,61,49,.08)]"><span className="inline-flex rounded-full bg-[#ffe2d7] px-3 py-1 text-xs font-black text-[#b43f18]">准备好了</span><h1 className="mt-4 text-3xl font-black tracking-tight">命运转盘</h1><p className="mt-3 text-sm leading-6 text-[#667a73]">每家餐厅机会均等。点击按钮后，结果将在动画开始前随机确定。</p><div className="mt-5 flex flex-wrap gap-2">{available.map((item) => <span key={item.id} className="rounded-full bg-[#f4f3ef] px-3 py-1.5 text-xs font-bold text-[#5f736c]">{item.emoji} {item.name}</span>)}</div>{notice && <p className="mt-4 rounded-xl bg-[#fff4d6] p-3 text-xs font-bold text-[#8d6a12]">{notice}</p>}<button type="button" onClick={() => spin()} disabled={isSpinning || selected !== null} className="mt-6 w-full rounded-2xl bg-[#183d31] px-6 py-4 font-black text-white shadow-[0_6px_0_#0c251e] transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45">{isSpinning ? "转盘正在旋转…" : selected ? "本轮已完成" : "开始转动"}</button></div></aside>
      </div>
      {selected && <ResultCard restaurant={selected} confirmed={confirmed} onConfirm={confirm} onReroll={reroll} onHome={onHome} />}
    </main>
  );
}

export default function Home() {
  const [step, setStep] = useState("home");
  const [history, setHistory] = useState([]);
  const [manualExcluded, setManualExcluded] = useState([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]"); setHistory(Array.isArray(saved) ? saved : []); }
    catch { setHistory([]); }
    finally { setStorageReady(true); }
  }, []);

  const recentIds = useMemo(() => getRecentRestaurantIds(history), [history]);
  const candidates = useMemo(() => buildCandidatePool(restaurants, recentIds, manualExcluded), [recentIds, manualExcluded]);
  function goHome() { setStep("home"); setManualExcluded([]); }
  function start() { setManualExcluded([]); setStep("select"); }
  function toggleRestaurant(id) { setManualExcluded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function saveLunch(restaurant) {
    const today = formatDateKey();
    const record = { id: `${today}-${restaurant.id}`, date: today, restaurantId: restaurant.id, restaurantName: restaurant.name, category: restaurant.category, emoji: restaurant.emoji, selectedAt: new Date().toISOString() };
    const next = [record, ...history.filter((item) => item.date !== today)].sort((a, b) => b.date.localeCompare(a.date));
    setHistory(next); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  function clearHistory() { if (!window.confirm("确定清空这台设备上的午餐记录吗？")) return; window.localStorage.removeItem(STORAGE_KEY); setHistory([]); }

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#183d31]">
      <AppHeader step={step} onHome={goHome} />
      {!storageReady ? <main className="grid min-h-[70vh] place-items-center text-sm font-bold text-[#71847d]">正在准备你的午餐转盘…</main> : step === "home" ? <HomePage history={history} onStart={start} onClearHistory={clearHistory} /> : step === "select" ? <SelectionPage history={history} manualExcluded={manualExcluded} onToggle={toggleRestaurant} onReset={() => setManualExcluded([])} onContinue={() => setStep("wheel")} /> : <WheelPage candidates={candidates} onBack={() => setStep("select")} onSave={saveLunch} onHome={goHome} />}
    </div>
  );
}
