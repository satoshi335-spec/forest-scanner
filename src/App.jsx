import { useState, useEffect, useRef, useCallback } from "react";

// ================================================================
// UTILS
// ================================================================
function calcHeight2(dist, topDeg, botDeg, eyeH) {
  return +(dist * (Math.tan(topDeg * Math.PI / 180) - Math.tan(botDeg * Math.PI / 180)) + eyeH).toFixed(1);
}
function calcSpread(dist, leftDeg, rightDeg) {
  return +(dist * (Math.tan(Math.abs(leftDeg) * Math.PI / 180) + Math.tan(Math.abs(rightDeg) * Math.PI / 180))).toFixed(1);
}

// 幹周り: 直径=距離×(tan左+tan右)、幹周り=直径×π
function calcTrunk(dist, leftDeg, rightDeg) {
  const diamM = +(dist * (Math.tan(Math.abs(leftDeg) * Math.PI / 180) + Math.tan(Math.abs(rightDeg) * Math.PI / 180))).toFixed(3);
  const diamCm = +(diamM * 100).toFixed(1); // m → cm
  const circCm = +(diamCm * Math.PI).toFixed(1); // 幹周り cm
  return { diam: diamCm, circ: circCm }; // どちらもcm単位
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { const d = new Date(); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`; }
function loadProfile() { try { return JSON.parse(localStorage.getItem("fs_profile") || "{}"); } catch { return {}; } }
function saveProfile(o) { try { localStorage.setItem("fs_profile", JSON.stringify(o)); } catch {} }
function loadTrees() { try { return JSON.parse(localStorage.getItem("fs_trees") || "[]"); } catch { return []; } }
function saveTrees(t) { try { localStorage.setItem("fs_trees", JSON.stringify(t)); } catch {} }


// GPS取得
function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject("非対応"); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      e => reject(e.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
// ================================================================
// STYLES
// ================================================================
const GRN = "#7ecba1", GOLD = "#ffd166", BLUE = "#74b3ce";
const BG = { minHeight: "100vh", background: "linear-gradient(160deg,#e8f5e9 0%,#f1f8e9 40%,#e0f2f1 100%)", fontFamily: "'Georgia','Hiragino Mincho ProN',serif", color: "#1a3a2a" };
const INNER = { maxWidth: 440, margin: "0 auto", padding: "0 16px 48px" };
const CARD = { background: "rgba(255,255,255,0.85)", border: "1px solid rgba(45,106,79,0.15)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "0 2px 12px rgba(45,106,79,0.08)" };
const INP = { width: "100%", boxSizing: "border-box", background: "#ffffff", border: "1.5px solid rgba(45,106,79,0.25)", borderRadius: 10, padding: "12px 14px", color: "#1a3a2a", fontSize: 18, outline: "none", fontFamily: "inherit", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.05)" };
const LBL = { fontSize: 12, color: "#4a7c5a", marginBottom: 5, display: "block", fontWeight: "bold" };
const PRI = { width: "100%", padding: "14px", background: "linear-gradient(135deg,#2d6a4f,#40916c)", border: "none", borderRadius: 12, color: "#ffffff", fontSize: 15, cursor: "pointer", marginBottom: 8, fontFamily: "inherit", letterSpacing: 1, boxShadow: "0 3px 10px rgba(45,106,79,0.3)" };
const GHO = { width: "100%", padding: "11px", background: "rgba(255,255,255,0.8)", border: "1.5px solid rgba(45,106,79,0.3)", borderRadius: 12, color: "#2d6a4f", fontSize: 13, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" };
const TAB = (on) => ({ flex: 1, padding: "9px 6px", borderRadius: 8, cursor: "pointer", fontSize: 12, background: on ? "#2d6a4f" : "rgba(255,255,255,0.8)", border: `1.5px solid ${on ? "#2d6a4f" : "rgba(45,106,79,0.2)"}`, color: on ? "#ffffff" : "#4a7c5a", fontFamily: "inherit", fontWeight: on ? "bold" : "normal" });
const SML = (c) => ({ fontSize: 11, color: c, background: "rgba(255,255,255,0.9)", border: `1.5px solid ${c}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", marginTop: 6 });

// 樹種別年間成長量（幹周りcm/年）
const GROWTH_RATE = {
  "クスノキ": 3.5, "ケヤキ": 2.5, "イチョウ": 2.0,
  "サクラ": 3.0, "マツ": 1.5, "スギ": 2.0,
  "ヒノキ": 1.8, "プラタナス": 4.0, "メタセコイア": 4.0,
  "ヒマラヤスギ": 3.5, "シラカシ": 2.5, "トウカエデ": 2.8,
  "その他": 2.5,
};
function estimateAge(trunkCm, species) {
  const rate = GROWTH_RATE[species] || 2.5;
  return Math.round(trunkCm / rate);
}
const TREE_TYPES = ["クスノキ","ケヤキ","イチョウ","サクラ","マツ","スギ","ヒノキ","プラタナス","メタセコイア","ヒマラヤスギ","シラカシ","トウカエデ","その他"];

// ================================================================
// CAMERA HOOK
// ================================================================
function useCameraAndSensor(onOrient) {
  const [sensorOn, setSensorOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  useEffect(() => () => { window.removeEventListener("deviceorientation", onOrient); stopCamera(); }, [onOrient]);
  const startAll = async () => {
    try {
      if (typeof DeviceOrientationEvent?.requestPermission === "function") {
        if (await DeviceOrientationEvent.requestPermission() !== "granted") { alert("センサーが許可されませんでした"); return; }
      }
      window.addEventListener("deviceorientation", onOrient);
      setSensorOn(true);
    } catch { alert("センサーを起動できませんでした"); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
      setCameraOn(true);
    } catch { setCameraOn(false); }
  };
  const stopCamera = () => {
    window.removeEventListener("deviceorientation", onOrient);
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    setCameraOn(false); setSensorOn(false);
  };
  return { sensorOn, cameraOn, videoRef, startAll, stopCamera };
}

// ================================================================
// DIST PANEL
// ================================================================
function DistPanel({ bodyH, setBodyH, eyeH, setEyeH, dist, setDist, distMode, setDistMode, stride, setStride, walkCount, setWalkCount, showEyeH }) {
  const [msg, setMsg] = useState(false);
  const onBodyH = v => { setBodyH(v); setStride(null); const h = parseFloat(v); if (h > 0) saveProfile({ ...loadProfile(), bodyH: v, stride: +(h*0.45/100).toFixed(3) }); };
  const autoFill = () => { const h = parseFloat(bodyH); if (!h) return; const e = +(h*0.93/100).toFixed(2)+""; const s = +(h*0.45/100).toFixed(3); setEyeH(e); setStride(s); saveProfile({ ...loadProfile(), bodyH, eyeH: e, stride: s }); setMsg(true); setTimeout(() => setMsg(false), 2000); };
  const cs = () => { const h = parseFloat(bodyH); if (!h) return; const s = +(h*0.45/100).toFixed(3); setStride(s); if (walkCount) setDist(+(parseFloat(walkCount)*s).toFixed(1)+""); };
  const hw = v => { setWalkCount(v); if (stride && v) setDist(+(parseFloat(v)*stride).toFixed(1)+""); };
  return (
    <>
      <div style={CARD}>
        <p style={{ fontSize: 13, color: GRN, marginBottom: 12 }}>身長{showEyeH ? "・目の高さ" : ""} <span style={{ fontSize: 10, color: "#4a9070" }}>自動保存</span></p>
        <span style={LBL}>身長（cm）：</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input style={INP} type="number" value={bodyH} onChange={e => onBodyH(e.target.value)} placeholder="例: 170" />
          <span style={{ color: GRN, minWidth: 24 }}>cm</span>
        </div>
        {bodyH && <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 11, color: GRN }}>
          推定歩幅：{Math.round(parseFloat(bodyH)*0.45)} cm　目の高さ：{(parseFloat(bodyH)*0.93/100).toFixed(2)} m
        </div>}
        {showEyeH && <>
          <span style={LBL}>目の高さ（m）：</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input style={INP} type="number" value={eyeH} onChange={e => { setEyeH(e.target.value); saveProfile({ ...loadProfile(), eyeH: e.target.value }); }} placeholder="1.5" />
            <span style={{ color: GRN, minWidth: 24 }}>m</span>
          </div>
        </>}
        {bodyH && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={autoFill} style={{ fontSize: 11, color: GRN, background: "rgba(126,203,161,0.1)", border: "1px solid rgba(126,203,161,0.3)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>身長から自動入力</button>
          {msg && <span style={{ fontSize: 11, color: GOLD }}>✅ 保存</span>}
        </div>}
      </div>
      <div style={CARD}>
        <p style={{ fontSize: 13, color: GRN, marginBottom: 12 }}>木までの距離</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button style={TAB(distMode===0)} onClick={() => setDistMode(0)}>📏 直接入力（m）</button>
          <button style={TAB(distMode===1)} onClick={() => setDistMode(1)}>👣 歩数で入力</button>
        </div>
        {distMode === 0 && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><input style={INP} type="number" value={dist} onChange={e => setDist(e.target.value)} placeholder="例: 15" /><span style={{ color: GRN, minWidth: 24 }}>m</span></div>}
        {distMode === 1 && <>
          {!stride ? <button style={{ ...PRI, padding: "10px", fontSize: 12 }} onClick={cs} disabled={!bodyH}>👣 身長から歩幅を計算</button>
                   : <div style={{ background: "rgba(126,203,161,0.1)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 12, color: GRN }}>歩幅：{(stride*100).toFixed(0)} cm（保存済み）</div>}
          {!bodyH && <p style={{ fontSize: 11, color: "#4a7c5a" }}>※ 先に身長を入力してください</p>}
          <span style={LBL}>歩数：</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}><input style={INP} type="number" value={walkCount} onChange={e => hw(e.target.value)} placeholder="例: 20" /><span style={{ color: GRN, minWidth: 24 }}>歩</span></div>
          {dist && stride && <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: GRN }}>{walkCount}歩 × {(stride*100).toFixed(0)}cm ＝ 約 <strong>{dist} m</strong></div>}
        </>}
      </div>
    </>
  );
}

// ================================================================
// CAMERA VIEW
// ================================================================
function CameraView({ videoRef, cameraOn, sensorOn, shown, lock1, lock2, label1, label2, color1, color2, isVertical }) {
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 12, background: "#000", aspectRatio: "4/3" }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraOn ? "block" : "none" }} />
      {!cameraOn && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1a0a" }}><p style={{ color: "#4a7c5a", fontSize: 13, textAlign: "center" }}>📷<br />カメラ起動後に映像が表示されます</p></div>}
      {sensorOn && <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {isVertical
          ? <div style={{ position: "absolute", top: "50%", left: "8%", right: "8%", height: 1, background: "rgba(126,203,161,0.3)", transform: "translateY(-50%)" }} />
          : <div style={{ position: "absolute", left: "50%", top: "8%", bottom: "8%", width: 1, background: "rgba(126,203,161,0.3)", transform: "translateX(-50%)" }} />}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 44, height: 44 }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: GRN, opacity: 0.85, transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: GRN, opacity: 0.85, transform: "translateX(-50%)" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: GRN }} />
        </div>
        {lock1 != null && (() => { const px = Math.round((shown - lock1)*3); return isVertical
          ? <div style={{ position: "absolute", top: `calc(50% + ${px}px)`, left: 0, right: 0, height: 2, background: color1, opacity: 0.8, transform: "translateY(-50%)" }}><span style={{ position: "absolute", right: 8, top: -20, fontSize: 10, color: color1, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4 }}>{label1} {lock1 > 0 ? "+" : ""}{lock1}°</span></div>
          : <div style={{ position: "absolute", left: `calc(50% + ${px}px)`, top: 0, bottom: 0, width: 2, background: color1, opacity: 0.8, transform: "translateX(-50%)" }}><span style={{ position: "absolute", top: 10, left: 6, fontSize: 10, color: color1, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{label1} {lock1}°</span></div>; })()}
        {lock2 != null && (() => { const px = Math.round((shown - lock2)*3); return isVertical
          ? <div style={{ position: "absolute", top: `calc(50% + ${px}px)`, left: 0, right: 0, height: 2, background: color2, opacity: 0.8, transform: "translateY(-50%)" }}><span style={{ position: "absolute", right: 8, top: -20, fontSize: 10, color: color2, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4 }}>{label2} {lock2 > 0 ? "+" : ""}{lock2}°</span></div>
          : <div style={{ position: "absolute", left: `calc(50% + ${px}px)`, top: 0, bottom: 0, width: 2, background: color2, opacity: 0.8, transform: "translateX(-50%)" }}><span style={{ position: "absolute", top: 28, left: 6, fontSize: 10, color: color2, background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>{label2} {lock2}°</span></div>; })()}
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
          <p style={{ fontSize: 9, color: GRN, margin: 0 }}>現在の角度</p>
          <p style={{ fontSize: 26, fontWeight: "bold", color: shown >= 0 ? GRN : BLUE, margin: 0, lineHeight: 1 }}>{shown > 0 ? "+" : ""}{shown.toFixed(1)}°</p>
        </div>
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ background: lock1 != null ? `${color1}cc` : "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: lock1 != null ? "#fff" : "#aaa" }}>{lock1 != null ? `✅ ${label1} ${lock1 > 0 ? "+" : ""}${lock1}°` : `① ${label1}未ロック`}</div>
          <div style={{ background: lock2 != null ? `${color2}cc` : "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: lock2 != null ? (color2 === GOLD ? "#000" : "#fff") : "#aaa" }}>{lock2 != null ? `✅ ${label2} ${lock2 > 0 ? "+" : ""}${lock2}°` : `② ${label2}未ロック`}</div>
        </div>
      </div>}
    </div>
  );
}

// ================================================================
// LOCK BUTTONS
// ================================================================
function LockButtons({ sensorOn, startAll, lock1, lock2, onLock1, onLock2, onRedo1, onRedo2, label1, label2, color1, color2, hint1, hint2 }) {
  const lockedStyle = (c) => ({ padding: "14px 8px", borderRadius: 12, background: `${c}33`, border: `2px solid ${c}`, textAlign: "center" });
  const unlockedStyle = (c, disabled) => ({ width: "100%", padding: "18px 8px", borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer", background: disabled ? "rgba(255,255,255,0.03)" : `${c}1a`, border: `2px solid ${disabled ? "rgba(255,255,255,0.1)" : c+"66"}`, color: disabled ? "#4a7c5a" : c, fontFamily: "inherit", textAlign: "center", opacity: disabled ? 0.5 : 1 });
  return (
    <div style={CARD}>
      {!sensorOn ? <button style={PRI} onClick={startAll}>📱　カメラ＆センサーを起動する</button>
      : <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            {lock1 == null ? <button onClick={onLock1} style={unlockedStyle(color1, false)}><div style={{ fontSize: 24, marginBottom: 4 }}>🔒</div><div style={{ fontSize: 13, fontWeight: "bold" }}>{label1}をロック</div><div style={{ fontSize: 11, marginTop: 2 }}>{hint1}</div></button>
            : <div style={lockedStyle(color1)}><div style={{ fontSize: 20 }}>✅</div><div style={{ fontSize: 13, fontWeight: "bold", color: color1 }}>{label1}済</div><div style={{ fontSize: 12, color: color1 }}>{lock1 > 0 ? "+" : ""}{lock1}°</div><button onClick={onRedo1} style={SML(color1)}>やり直す</button></div>}
          </div>
          <div style={{ flex: 1 }}>
            {lock2 == null ? <button onClick={onLock2} disabled={lock1 == null} style={unlockedStyle(color2, lock1 == null)}><div style={{ fontSize: 24, marginBottom: 4 }}>🔒</div><div style={{ fontSize: 13, fontWeight: "bold" }}>{label2}をロック</div><div style={{ fontSize: 11, marginTop: 2 }}>{lock1 == null ? `${label1}ロック後に` : hint2}</div></button>
            : <div style={lockedStyle(color2)}><div style={{ fontSize: 20 }}>✅</div><div style={{ fontSize: 13, fontWeight: "bold", color: color2 }}>{label2}済</div><div style={{ fontSize: 12, color: color2 }}>{lock2 > 0 ? "+" : ""}{lock2}°</div><button onClick={onRedo2} style={SML(color2)}>やり直す</button></div>}
          </div>
        </div>}
    </div>
  );
}

// ================================================================
// SAVE MODAL
// ================================================================
function SaveModal({ measurement, trees, onSave, onSkip }) {
  const [mode, setMode] = useState("new");
  const [name, setName] = useState(""); const [species, setSpecies] = useState("");
  const [location, setLocation] = useState(""); const [selectedId, setSelectedId] = useState("");
  const doSave = () => {
    if (mode === "new") {
      if (!name.trim()) { alert("木の名前を入力してください"); return; }
      onSave({ id: newId(), name: name.trim(), species, location, note: "", photo: null, measurements: measurement, createdAt: today(), updatedAt: today() }, null);
    } else {
      if (!selectedId) { alert("木を選択してください"); return; }
      onSave(null, selectedId);
    }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#1a2e3a", borderRadius: "20px 20px 0 0", padding: "20px 16px 40px", maxHeight: "80vh", overflowY: "auto" }}>
        <p style={{ fontSize: 16, color: GRN, fontWeight: "bold", marginBottom: 16, textAlign: "center" }}>💾 アルバムに保存する</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button style={TAB(mode==="new")} onClick={() => setMode("new")}>新しく登録</button>
          {trees.length > 0 && <button style={TAB(mode==="existing")} onClick={() => setMode("existing")}>既存の木に追加</button>}
        </div>
        {mode === "new" && <>
          <span style={LBL}>木の名前（必須）：</span>
          <input style={{ ...INP, marginBottom: 10, fontSize: 16 }} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: おじいちゃんの家のクスノキ" />
          <span style={LBL}>樹種：</span>
          <select value={species} onChange={e => setSpecies(e.target.value)} style={{ ...INP, marginBottom: 10, fontSize: 14, appearance: "none" }}>
            <option value="">選択してください</option>
            {TREE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span style={LBL}>場所・区画：</span>
          <input style={{ ...INP, marginBottom: 16, fontSize: 16 }} type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="例: 大阪府・天王寺公園" />
        </>}
        {mode === "existing" && <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {trees.map(t => <button key={t.id} onClick={() => setSelectedId(t.id)} style={{ padding: "12px 14px", borderRadius: 10, background: selectedId===t.id ? "rgba(126,203,161,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${selectedId===t.id ? GRN : "rgba(126,203,161,0.2)"}`, color: "#e0f0ea", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: "bold" }}>{t.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6aab7e" }}>{t.species} {t.location}</p>
          </button>)}
        </div>}
        <button style={PRI} onClick={doSave}>💾 保存する</button>
        <button style={GHO} onClick={onSkip}>スキップ</button>
      </div>
    </div>
  );
}

// ================================================================
// PDF 出力
// ================================================================
function printPDF(targets) {
  // 2列×2行グリッド（4本ずつ1ページ）
  const cards = targets.map(t => {
    const m = t.measurements || {};
    return `
      <div class="card">
        ${t.photo
          ? `<img src="${t.photo}" class="photo" />`
          : `<div class="no-photo">🌳</div>`}
        <div class="card-body">
          <h2>${t.name}</h2>
          <div class="tags">
            ${t.species ? `<span class="tag green">${t.species}</span>` : ""}
            ${t.location ? `<span class="tag blue">${t.location}</span>` : ""}
          </div>
          ${t.gps ? `<p class="gps">📍 ${t.gps.lat}, ${t.gps.lng}</p>` : ""}
          ${t.note ? `<p class="note">${t.note}</p>` : ""}
          <div class="meas-grid">
            ${m.height ? `<div class="meas-item"><span class="ml">樹高</span><span class="mv">${m.height}<small>m</small></span></div>` : ""}
            ${m.spread ? `<div class="meas-item"><span class="ml">枝張り</span><span class="mv">${m.spread}<small>m</small></span></div>` : ""}
            ${m.trunk  ? `<div class="meas-item"><span class="ml">幹周り</span><span class="mv">${m.trunk}<small>cm</small></span></div>` : ""}
            ${m.age    ? `<div class="meas-item"><span class="ml">推定樹齢</span><span class="mv">${m.age}<small>年</small></span></div>` : ""}
          </div>
          <p class="date">登録：${t.createdAt}</p>
        </div>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
  <title>大きな木 測定レポート</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Hiragino Mincho ProN', Georgia, serif; background: #fff; color: #1a2a1a; padding: 16px; }
    header { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #2d6a4f; padding-bottom: 10px; margin-bottom: 6px; }
    header h1 { font-size: 20px; color: #2d6a4f; }
    .meta { font-size: 11px; color: #888; margin-bottom: 16px; }
    /* 2列グリッド */
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .card { border: 1px solid #cde8d8; border-radius: 12px; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column; }
    .photo { width: 100%; height: 180px; object-fit: cover; display: block; }
    .no-photo { width: 100%; height: 180px; background: #f0f7f0; display: flex; align-items: center; justify-content: center; font-size: 52px; }
    .card-body { padding: 10px 12px 12px; flex: 1; display: flex; flex-direction: column; gap: 5px; }
    .card-body h2 { font-size: 15px; color: #1a3a2a; font-weight: bold; }
    .tags { display: flex; gap: 5px; flex-wrap: wrap; }
    .tag { font-size: 10px; border-radius: 20px; padding: 2px 8px; }
    .tag.green { background: #e8f5ee; color: #2d6a4f; border: 1px solid #b0d8c0; }
    .tag.blue  { background: #e8f0f8; color: #2a4a6a; border: 1px solid #b0c8e0; }
    .gps { font-size: 10px; color: #2d6a4f; }
    .note { font-size: 11px; color: #555; line-height: 1.5; }
    .meas-grid { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
    .meas-item { background: #f0f7f0; border-radius: 6px; padding: 5px 8px; text-align: center; flex: 1; min-width: 52px; }
    .ml { font-size: 9px; color: #666; display: block; margin-bottom: 1px; }
    .mv { font-size: 17px; font-weight: bold; color: #2d6a4f; }
    .mv small { font-size: 10px; font-weight: normal; color: #888; margin-left: 1px; }
    .date { font-size: 10px; color: #aaa; margin-top: auto; padding-top: 4px; }
    @media print {
      body { padding: 8px; }
      .grid { gap: 10px; }
    }
  </style></head><body>
  <header><span style="font-size:24px;">🌳</span><h1>大きな木 測定レポート</h1></header>
  <p class="meta">出力日：${today()}　登録本数：${targets.length}本</p>
  <div class="grid">${cards}</div>
  <p style="font-size:10px; color:#888; margin-top:28px; border-top:1px solid #e0e0e0; padding-top:12px; line-height:1.8;">
    ※ 推定樹齢は幹周り÷樹種別年間成長量による参考値です。実際の樹齢は立地・気候・管理条件により大きく異なります。<br>
    ※ 参考：国土技術政策総合研究所「公園樹木管理の高度化に関する研究」・日本緑化センター資料に基づく概算値。<br>
    ※ 正確な樹齢は年輪調査など専門的な手法による確認を推奨します。
  </p>
  <script>window.onload = () => window.print();<\/script>
  </body></html>`;

  // Blob URLで確実に新タブで開く（ポップアップブロック回避）
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 少し待ってからURLを解放
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ================================================================
// PDF MODAL（個別 or 選択）
// ================================================================
function PdfModal({ trees, onClose }) {
  const [selected, setSelected] = useState(new Set(trees.map(t => t.id)));
  const toggle = (id) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const allOn = selected.size === trees.length;
  const targets = trees.filter(t => selected.has(t.id));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#1a2e3a", borderRadius: "20px 20px 0 0", padding: "20px 16px 40px", maxHeight: "80vh", overflowY: "auto" }}>
        <p style={{ fontSize: 16, color: GRN, fontWeight: "bold", marginBottom: 6, textAlign: "center" }}>📄 PDF出力</p>
        <p style={{ fontSize: 12, color: "#6aab7e", textAlign: "center", marginBottom: 14 }}>出力する木を選んでください</p>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => setSelected(new Set(trees.map(t => t.id)))} style={{ fontSize: 12, color: GRN, background: "rgba(126,203,161,0.1)", border: "1px solid rgba(126,203,161,0.3)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>全て選択</button>
          <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: "#a8d5b5", background: "rgba(255,255,255,0.05)", border: "1px solid #4a7c5a", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>全て解除</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {trees.map(t => (
            <button key={t.id} onClick={() => toggle(t.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: selected.has(t.id) ? "rgba(126,203,161,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${selected.has(t.id) ? GRN : "rgba(126,203,161,0.2)"}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "#0a1a0a" }}>
                {t.photo ? <img src={t.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🌳</div>}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#e0f0ea", fontWeight: "bold" }}>{t.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6aab7e" }}>{t.species} {t.location}</p>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: selected.has(t.id) ? GRN : "rgba(255,255,255,0.1)", border: `2px solid ${selected.has(t.id) ? GRN : "#4a7c5a"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#1a2a1a", flexShrink: 0 }}>
                {selected.has(t.id) ? "✓" : ""}
              </div>
            </button>
          ))}
        </div>
        <button style={{ ...PRI, background: targets.length > 0 ? "#2a4a1a" : "#1a2a1a", borderColor: targets.length > 0 ? GOLD : "#4a7c5a", color: targets.length > 0 ? GOLD : "#4a7c5a", cursor: targets.length > 0 ? "pointer" : "not-allowed" }}
          onClick={() => { if (targets.length > 0) { onClose(); setTimeout(() => printPDF(targets), 100); } }}>
          📄　{targets.length}本のレポートを出力する
        </button>
        <button style={GHO} onClick={onClose}>キャンセル</button>
      </div>
    </div>
  );
}

// ================================================================
// HEIGHT APP
// ================================================================
function HeightApp({ prof, trees, onSaveTree, onBack }) {
  const [pg, setPg] = useState(0);
  const [dist, setDist] = useState(""); const [eyeH, setEyeH] = useState(prof.eyeH||"1.5");
  const [bodyH, setBodyH] = useState(prof.bodyH||""); const [walkCount, setWalkCount] = useState("");
  const [stride, setStride] = useState(prof.stride||null); const [distMode, setDistMode] = useState(1);
  const [liveDeg, setLiveDeg] = useState(null); const [bot, setBot] = useState(null); const [top, setTop] = useState(null);
  const [result, setResult] = useState(null); const [showSave, setShowSave] = useState(false);
  const liveRef = useRef(null);
  const onOrient = useCallback(e => { if (e.beta==null) return; let v = +(e.beta-90).toFixed(1); v = Math.max(-89,Math.min(89,v)); liveRef.current=v; setLiveDeg(v); }, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(onOrient);
  const shown = liveDeg??0; const canCalc = bot!==null&&top!==null&&!!dist&&!!eyeH;
  const doCalc = () => { if (!canCalc) return; stopCamera(); setResult({ height: calcHeight2(parseFloat(dist),top,bot,parseFloat(eyeH)), d: parseFloat(dist), e: parseFloat(eyeH), topDeg: top, botDeg: bot }); setPg(3); };
  const reset = () => { stopCamera(); setPg(0); setDist(""); setWalkCount(""); setLiveDeg(null); setBot(null); setTop(null); setResult(null); setShowSave(false); };

  return (
    <div>
      {pg>0&&pg<3&&<div style={{ display:"flex", gap:4, margin:"14px 0" }}>{["① 距離入力","② 角度測定","③ 結果"].map((l,i)=><div key={i} style={{ flex:1, textAlign:"center" }}><div style={{ height:3, borderRadius:2, background:i<pg?"#2d6a4f":"rgba(45,106,79,0.2)", marginBottom:4 }}/><span style={{ fontSize:10, color:i<pg?"#1b4332":"#74a98a" }}>{l}</span></div>)}</div>}
      {pg===0&&<div style={{ marginTop:12 }}>
        <div style={CARD}><p style={{ fontSize:12, color:"#2d6a4f", textAlign:"center", marginBottom:10 }}>2点ロック方式（上下）</p>
          <svg viewBox="0 0 280 150" style={{ width:"100%", height:"auto", display:"block" }}>
            <line x1="20" y1="125" x2="260" y2="125" stroke="#4a9070" strokeWidth="1.5"/>
            <line x1="220" y1="125" x2="220" y2="18" stroke={GRN} strokeWidth="3"/>
            <ellipse cx="220" cy="18" rx="22" ry="14" fill="#2d6a4f" opacity="0.85"/>
            <circle cx="50" cy="100" r="7" fill={GRN} opacity="0.85"/>
            <line x1="50" y1="107" x2="50" y2="125" stroke={GRN} strokeWidth="2"/>
            <line x1="50" y1="100" x2="220" y2="18" stroke={GOLD} strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="50" y1="100" x2="220" y2="120" stroke={BLUE} strokeWidth="1.5" strokeDasharray="5,3"/>
            <text x="72" y="88" fill={GOLD} fontSize="9">上角</text>
            <text x="72" y="115" fill={BLUE} fontSize="9">下角</text>
            <line x1="232" y1="18" x2="232" y2="125" stroke="#a8d5b5" strokeWidth="1" strokeDasharray="3,2"/>
            <text x="246" y="75" fill="#a8d5b5" fontSize="9">樹高</text>
          </svg>
          <p style={{ fontSize:11, color:"#5a8c6a", textAlign:"center", margin:"8px 0 0", lineHeight:1.8 }}>① 根元をロック → ② 梢をロック</p>
        </div>
        <button style={PRI} onClick={() => setPg(1)}>📐　測定を開始する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
      </div>}
      {pg===1&&<div>
        <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH={eyeH} setEyeH={setEyeH} dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode} stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH />
        <button style={PRI} onClick={() => setPg(2)}>次へ → 角度を測定する</button>
        <button style={GHO} onClick={() => setPg(0)}>← 戻る</button>
      </div>}
      {pg===2&&<div>
        <CameraView videoRef={videoRef} cameraOn={cameraOn} sensorOn={sensorOn} shown={shown} lock1={bot} lock2={top} label1="根元" label2="梢" color1={BLUE} color2={GOLD} isVertical />
        <LockButtons sensorOn={sensorOn} startAll={startAll} lock1={bot} lock2={top}
          onLock1={() => { if (liveRef.current!=null) setBot(+liveRef.current.toFixed(1)); }}
          onLock2={() => { if (liveRef.current!=null) setTop(+liveRef.current.toFixed(1)); }}
          onRedo1={() => { setBot(null); setTop(null); }} onRedo2={() => setTop(null)}
          label1="根元" label2="梢" color1={BLUE} color2={GOLD} hint1="カメラを根元に向けて" hint2="カメラを梢に向けて" />
        <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
          📐　樹高を計算する {!canCalc&&(bot===null?"（根元をロック）":top===null?"（梢をロック）":"（距離を入力）")}
        </button>
        <button style={GHO} onClick={() => { setPg(1); stopCamera(); }}>← 距離の入力に戻る</button>
      </div>}
      {pg===3&&result&&<div style={{ marginTop:8 }}>
        <div style={{ background:"linear-gradient(135deg,rgba(45,106,79,0.12),rgba(45,106,79,0.05))", border:"1px solid rgba(126,203,161,0.35)", borderRadius:20, padding:"24px 20px", textAlign:"center", marginBottom:14 }}>
          <div style={{ position:"relative", height:100, width:70, margin:"0 auto 12px" }}>
            <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:10, background:"linear-gradient(#5d4037,#8d6e63)", borderRadius:3, height:Math.min(85,result.height*4) }}/>
            <div style={{ position:"absolute", bottom:Math.max(0,Math.min(85,result.height*4)-6), left:"50%", transform:"translateX(-50%)", width:52, height:52, borderRadius:"50% 50% 40% 40%", background:"radial-gradient(circle at 40% 40%,#52b788,#1b4332)" }}/>
          </div>
          <p style={{ fontSize:11, color:"#2d6a4f", margin:"0 0 2px", letterSpacing:2 }}>推定樹高</p>
          <p style={{ fontSize:64, fontWeight:"bold", color:"#1a3a2a", margin:0, lineHeight:1, letterSpacing:-3 }}>{result.height}</p>
          <p style={{ fontSize:18, color:"#2d6a4f", margin:"4px 0 12px" }}>m</p>
          <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" }}>
            {[["🏠","1階",3],["🏢","3階",10],["🪝","電柱",12],["🏬","5階",16]].map(([e,l,h])=>(
              <div key={l} style={{ background:result.height>=h?"rgba(126,203,161,0.2)":"rgba(255,255,255,0.05)", border:`1px solid ${result.height>=h?"rgba(126,203,161,0.4)":"rgba(255,255,255,0.1)"}`, borderRadius:8, padding:"4px 8px", fontSize:11, color:result.height>=h?GRN:"#4a7c5a" }}>{e} {l}より{result.height>=h?"高い":"低い"}</div>
            ))}
          </div>
        </div>
        <div style={{ ...CARD, padding:"14px 16px" }}>
          {[["水平距離",`${result.d} m`],["根元",`${result.botDeg>0?"+":""}${result.botDeg}°`],["梢",`+${result.topDeg}°`],["角度差",`${(result.topDeg-result.botDeg).toFixed(1)}°`],["目の高さ",`${result.e} m`]].map(([l,v],i,a)=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", paddingBottom:i<a.length-1?7:0, marginBottom:i<a.length-1?7:0, borderBottom:i<a.length-1?"1px solid rgba(126,203,161,0.1)":"none" }}>
              <span style={{ fontSize:11, color:"#5a9070" }}>{l}</span><span style={{ fontSize:13, color:"#1a3a2a" }}>{v}</span>
            </div>
          ))}
        </div>
        <button style={{ ...PRI, background:"#2a4a1a", borderColor:GOLD, color:GOLD }} onClick={() => setShowSave(true)}>💾　アルバムに保存する</button>
        <button style={PRI} onClick={reset}>📐　もう一度測定する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
        {showSave && <SaveModal measurement={{ height: result.height+"" }} trees={trees} onSave={(nt,eid) => { onSaveTree(nt,eid,{ height: result.height+"" }); setShowSave(false); }} onSkip={() => setShowSave(false)} />}
      </div>}
    </div>
  );
}

// ================================================================
// SPREAD APP
// ================================================================
function SpreadApp({ prof, trees, onSaveTree, onBack }) {
  const [pg, setPg] = useState(0);
  const [dist, setDist] = useState(""); const [bodyH, setBodyH] = useState(prof.bodyH||"");
  const [walkCount, setWalkCount] = useState(""); const [stride, setStride] = useState(prof.stride||null);
  const [distMode, setDistMode] = useState(1); const [liveGamma, setLiveGamma] = useState(null);
  const [left, setLeft] = useState(null); const [right, setRight] = useState(null);
  const [result, setResult] = useState(null); const [showSave, setShowSave] = useState(false);
  const gammaRef = useRef(null);
  const onOrient = useCallback(e => { if (e.gamma==null) return; let v = +e.gamma.toFixed(1); v = Math.max(-89,Math.min(89,v)); gammaRef.current=v; setLiveGamma(v); }, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(onOrient);
  const shown = liveGamma??0; const canCalc = left!==null&&right!==null&&!!dist;
  const doCalc = () => { if (!canCalc) return; stopCamera(); const s = calcSpread(parseFloat(dist),left,right); setResult({ spread:s, radius:+(s/2).toFixed(1), area:+(Math.PI*(s/2)*(s/2)).toFixed(1), d:parseFloat(dist), leftDeg:left, rightDeg:right }); setPg(3); };
  const reset = () => { stopCamera(); setPg(0); setDist(""); setWalkCount(""); setLiveGamma(null); setLeft(null); setRight(null); setResult(null); setShowSave(false); };

  return (
    <div>
      {pg>0&&pg<3&&<div style={{ display:"flex", gap:4, margin:"14px 0" }}>{["① 距離入力","② 角度測定","③ 結果"].map((l,i)=><div key={i} style={{ flex:1, textAlign:"center" }}><div style={{ height:3, borderRadius:2, background:i<pg?"#2d6a4f":"rgba(45,106,79,0.2)", marginBottom:4 }}/><span style={{ fontSize:10, color:i<pg?"#1b4332":"#74a98a" }}>{l}</span></div>)}</div>}
      {pg===0&&<div style={{ marginTop:12 }}>
        <div style={CARD}><p style={{ fontSize:12, color:"#2d6a4f", textAlign:"center", marginBottom:10 }}>2点ロック方式（左右）</p>
          <svg viewBox="0 0 280 150" style={{ width:"100%", height:"auto", display:"block" }}>
            <line x1="20" y1="125" x2="260" y2="125" stroke="#4a9070" strokeWidth="1.5"/>
            <line x1="140" y1="125" x2="140" y2="62" stroke={GRN} strokeWidth="3"/>
            <ellipse cx="140" cy="52" rx="58" ry="26" fill="#2d6a4f" opacity="0.5" stroke={GRN} strokeWidth="1"/>
            <circle cx="82" cy="52" r="5" fill={BLUE}/>
            <circle cx="198" cy="52" r="5" fill={GOLD}/>
            <circle cx="140" cy="96" r="7" fill={GRN} opacity="0.85"/>
            <line x1="140" y1="103" x2="140" y2="125" stroke={GRN} strokeWidth="2"/>
            <line x1="140" y1="96" x2="82" y2="52" stroke={BLUE} strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="140" y1="96" x2="198" y2="52" stroke={GOLD} strokeWidth="1.5" strokeDasharray="5,3"/>
            <text x="96" y="92" fill={BLUE} fontSize="9">左角</text>
            <text x="160" y="92" fill={GOLD} fontSize="9">右角</text>
            <line x1="82" y1="137" x2="198" y2="137" stroke="#a8d5b5" strokeWidth="1" strokeDasharray="3,2"/>
            <text x="140" y="148" fill="#a8d5b5" fontSize="9" textAnchor="middle">枝張り</text>
          </svg>
          <p style={{ fontSize:11, color:"#5a8c6a", textAlign:"center", margin:"8px 0 0", lineHeight:1.8 }}>① 左端をロック → ② 右端をロック</p>
        </div>
        <button style={PRI} onClick={() => setPg(1)}>🌿　測定を開始する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
      </div>}
      {pg===1&&<div>
        <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH="" setEyeH={() => {}} dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode} stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH={false} />
        <button style={PRI} onClick={() => setPg(2)}>次へ → 角度を測定する</button>
        <button style={GHO} onClick={() => setPg(0)}>← 戻る</button>
      </div>}
      {pg===2&&<div>
        <CameraView videoRef={videoRef} cameraOn={cameraOn} sensorOn={sensorOn} shown={shown} lock1={left} lock2={right} label1="左端" label2="右端" color1={BLUE} color2={GOLD} isVertical={false} />
        <LockButtons sensorOn={sensorOn} startAll={startAll} lock1={left} lock2={right}
          onLock1={() => { if (gammaRef.current!=null) setLeft(+gammaRef.current.toFixed(1)); }}
          onLock2={() => { if (gammaRef.current!=null) setRight(+gammaRef.current.toFixed(1)); }}
          onRedo1={() => { setLeft(null); setRight(null); }} onRedo2={() => setRight(null)}
          label1="左端" label2="右端" color1={BLUE} color2={GOLD} hint1="←スマホを左に傾けて" hint2="→スマホを右に傾けて" />
        <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
          🌿　枝張りを計算する {!canCalc&&(left===null?"（左端をロック）":right===null?"（右端をロック）":"（距離を入力）")}
        </button>
        <button style={GHO} onClick={() => { setPg(1); stopCamera(); }}>← 距離の入力に戻る</button>
      </div>}
      {pg===3&&result&&<div style={{ marginTop:8 }}>
        <div style={{ background:"linear-gradient(135deg,rgba(45,106,79,0.12),rgba(45,106,79,0.05))", border:"1px solid rgba(126,203,161,0.35)", borderRadius:20, padding:"24px 20px", textAlign:"center", marginBottom:14 }}>
          <p style={{ fontSize:11, color:"#2d6a4f", margin:"0 0 2px", letterSpacing:2 }}>枝張り（直径）</p>
          <p style={{ fontSize:64, fontWeight:"bold", color:"#1a3a2a", margin:0, lineHeight:1, letterSpacing:-3 }}>{result.spread}</p>
          <p style={{ fontSize:18, color:"#2d6a4f", margin:"4px 0 14px" }}>m</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <div style={{ background:"rgba(45,106,79,0.1)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:12, padding:"10px 16px" }}>
              <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 2px" }}>片側半径</p>
              <p style={{ fontSize:24, fontWeight:"bold", color:"#2d6a4f", margin:0 }}>{result.radius} m</p>
            </div>
            <div style={{ background:"rgba(45,106,79,0.1)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:12, padding:"10px 16px" }}>
              <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 2px" }}>樹冠面積</p>
              <p style={{ fontSize:24, fontWeight:"bold", color:"#2d6a4f", margin:0 }}>{result.area} m²</p>
            </div>
          </div>
        </div>
        <div style={{ ...CARD, padding:"14px 16px" }}>
          {[["水平距離",`${result.d} m`],["左端",`${result.leftDeg}°`],["右端",`${result.rightDeg}°`],["角度合計",`${(Math.abs(result.leftDeg)+Math.abs(result.rightDeg)).toFixed(1)}°`]].map(([l,v],i,a)=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", paddingBottom:i<a.length-1?7:0, marginBottom:i<a.length-1?7:0, borderBottom:i<a.length-1?"1px solid rgba(126,203,161,0.1)":"none" }}>
              <span style={{ fontSize:11, color:"#5a9070" }}>{l}</span><span style={{ fontSize:13, color:"#1a3a2a" }}>{v}</span>
            </div>
          ))}
        </div>
        <button style={{ ...PRI, background:"#2a4a1a", borderColor:GOLD, color:GOLD }} onClick={() => setShowSave(true)}>💾　アルバムに保存する</button>
        <button style={PRI} onClick={reset}>🌿　もう一度測定する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
        {showSave && <SaveModal measurement={{ spread: result.spread+"" }} trees={trees} onSave={(nt,eid) => { onSaveTree(nt,eid,{ spread: result.spread+"" }); setShowSave(false); }} onSkip={() => setShowSave(false)} />}
      </div>}
    </div>
  );
}


// ================================================================
// TRUNK APP（幹周り測定）
// ================================================================
function TrunkApp({ prof, trees, onSaveTree, onBack }) {
  const [pg, setPg] = useState(0);
  const [dist, setDist] = useState(""); const [bodyH, setBodyH] = useState(prof.bodyH||"");
  const [walkCount, setWalkCount] = useState(""); const [stride, setStride] = useState(prof.stride||null);
  const [distMode, setDistMode] = useState(1); const [liveGamma, setLiveGamma] = useState(null);
  const [left, setLeft] = useState(null); const [right, setRight] = useState(null);
  const [result, setResult] = useState(null); const [showSave, setShowSave] = useState(false);
  const gammaRef = useRef(null);
  const onOrient = useCallback(e => { if (e.gamma==null) return; let v = +e.gamma.toFixed(1); v = Math.max(-89,Math.min(89,v)); gammaRef.current=v; setLiveGamma(v); }, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(onOrient);
  const shown = liveGamma??0; const canCalc = left!==null&&right!==null&&!!dist;
  const doCalc = () => { if (!canCalc) return; stopCamera(); const r = calcTrunk(parseFloat(dist),left,right); setResult({ ...r, d:parseFloat(dist), leftDeg:left, rightDeg:right }); setPg(3); };
  const reset = () => { stopCamera(); setPg(0); setDist(""); setWalkCount(""); setLiveGamma(null); setLeft(null); setRight(null); setResult(null); setShowSave(false); };

  return (
    <div>
      {pg>0&&pg<3&&<div style={{ display:"flex", gap:4, margin:"14px 0" }}>{["① 距離入力","② 角度測定","③ 結果"].map((l,i)=><div key={i} style={{ flex:1, textAlign:"center" }}><div style={{ height:3, borderRadius:2, background:i<pg?"#2d6a4f":"rgba(45,106,79,0.2)", marginBottom:4 }}/><span style={{ fontSize:10, color:i<pg?"#1b4332":"#74a98a" }}>{l}</span></div>)}</div>}
      {pg===0&&<div style={{ marginTop:12 }}>
        <div style={CARD}><p style={{ fontSize:12, color:"#2d6a4f", textAlign:"center", marginBottom:10 }}>2点ロック方式（幹の左右）</p>
          <svg viewBox="0 0 280 150" style={{ width:"100%", height:"auto", display:"block" }}>
            <line x1="20" y1="125" x2="260" y2="125" stroke="#4a9070" strokeWidth="1.5"/>
            {/* 幹（太い） */}
            <rect x="125" y="40" width="30" height="85" rx="4" fill="#5d4037" opacity="0.8"/>
            <line x1="125" y1="40" x2="125" y2="125" stroke="#8d6e63" strokeWidth="1"/>
            <line x1="155" y1="40" x2="155" y2="125" stroke="#8d6e63" strokeWidth="1"/>
            {/* 幹左端 */}
            <circle cx="125" cy="82" r="5" fill={BLUE}/>
            {/* 幹右端 */}
            <circle cx="155" cy="82" r="5" fill={GOLD}/>
            {/* 人 */}
            <circle cx="50" cy="96" r="7" fill={GRN} opacity="0.85"/>
            <line x1="50" y1="103" x2="50" y2="125" stroke={GRN} strokeWidth="2"/>
            {/* 視線 */}
            <line x1="50" y1="96" x2="125" y2="82" stroke={BLUE} strokeWidth="1.5" strokeDasharray="5,3"/>
            <line x1="50" y1="96" x2="155" y2="82" stroke={GOLD} strokeWidth="1.5" strokeDasharray="5,3"/>
            <text x="68" y="85" fill={BLUE} fontSize="9">左角</text>
            <text x="86" y="100" fill={GOLD} fontSize="9">右角</text>
            {/* 距離 */}
            <line x1="50" y1="137" x2="140" y2="137" stroke="#74b3ce" strokeWidth="1" strokeDasharray="4,3"/>
            <text x="90" y="148" fill="#74b3ce" fontSize="9" textAnchor="middle">距離 d</text>
            {/* 直径 */}
            <line x1="125" y1="32" x2="155" y2="32" stroke="#a8d5b5" strokeWidth="1.5"/>
            <text x="140" y="26" fill="#a8d5b5" fontSize="9" textAnchor="middle">直径</text>
          </svg>
          <p style={{ fontSize:11, color:"#5a8c6a", textAlign:"center", margin:"8px 0 0", lineHeight:1.8 }}>
            木の正面に立ち幹の左端・右端をロック<br/>
            直径 → 幹周り（×π）を計算
          </p>
        </div>
        <div style={{ background:"rgba(255,209,102,0.08)", border:"1px solid rgba(255,209,102,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
          <p style={{ fontSize:12, color:GOLD, margin:0, lineHeight:1.7 }}>
            💡 木から <strong>2〜5m</strong> 離れると測定しやすいです。<br/>
            幹の中心の高さ（地上1.3m付近）に照準を合わせてください。
          </p>
        </div>
        <button style={PRI} onClick={() => setPg(1)}>🌲　測定を開始する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
      </div>}
      {pg===1&&<div>
        <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH="" setEyeH={() => {}} dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode} stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH={false} />
        <div style={{ background:"rgba(255,209,102,0.08)", border:"1px solid rgba(255,209,102,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:10 }}>
          <p style={{ fontSize:12, color:GOLD, margin:0 }}>💡 幹周り測定は距離 <strong>2〜5m</strong> がおすすめです</p>
        </div>
        <button style={PRI} onClick={() => setPg(2)}>次へ → 角度を測定する</button>
        <button style={GHO} onClick={() => setPg(0)}>← 戻る</button>
      </div>}
      {pg===2&&<div>
        <CameraView videoRef={videoRef} cameraOn={cameraOn} sensorOn={sensorOn} shown={shown} lock1={left} lock2={right} label1="幹左" label2="幹右" color1={BLUE} color2={GOLD} isVertical={false} />
        <LockButtons sensorOn={sensorOn} startAll={startAll} lock1={left} lock2={right}
          onLock1={() => { if (gammaRef.current!=null) setLeft(+gammaRef.current.toFixed(1)); }}
          onLock2={() => { if (gammaRef.current!=null) setRight(+gammaRef.current.toFixed(1)); }}
          onRedo1={() => { setLeft(null); setRight(null); }} onRedo2={() => setRight(null)}
          label1="幹左端" label2="幹右端" color1={BLUE} color2={GOLD} hint1="←幹の左端に向けて" hint2="→幹の右端に向けて" />
        <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
          🌲　幹周りを計算する {!canCalc&&(left===null?"（左端をロック）":right===null?"（右端をロック）":"（距離を入力）")}
        </button>
        <button style={GHO} onClick={() => { setPg(1); stopCamera(); }}>← 距離の入力に戻る</button>
      </div>}
      {pg===3&&result&&<div style={{ marginTop:8 }}>
        <div style={{ background:"linear-gradient(135deg,rgba(45,106,79,0.12),rgba(45,106,79,0.05))", border:"1px solid rgba(126,203,161,0.35)", borderRadius:20, padding:"24px 20px", textAlign:"center", marginBottom:14 }}>
          {/* 幹断面ビジュアル */}
          <div style={{ margin:"0 auto 14px", width:100, height:100, position:"relative" }}>
            <svg viewBox="0 0 100 100" style={{ width:"100%", height:"auto" }}>
              <circle cx="50" cy="50" r="44" fill="rgba(93,64,55,0.3)" stroke="#8d6e63" strokeWidth="2"/>
              {[38,30,22,14,6].map((r,i)=><circle key={i} cx="50" cy="50" r={r} fill="none" stroke="rgba(141,110,99,0.4)" strokeWidth="1"/>)}
              <line x1="6" y1="50" x2="94" y2="50" stroke={GRN} strokeWidth="1.5" strokeDasharray="3,2"/>
              <text x="50" y="54" fill={GRN} fontSize="10" textAnchor="middle" fontWeight="bold">{result.diam}cm</text>
            </svg>
          </div>
          <p style={{ fontSize:11, color:"#2d6a4f", margin:"0 0 2px", letterSpacing:2 }}>幹周り</p>
          <p style={{ fontSize:64, fontWeight:"bold", color:"#1a3a2a", margin:0, lineHeight:1, letterSpacing:-3 }}>{result.circ}</p>
          <p style={{ fontSize:18, color:"#2d6a4f", margin:"4px 0 14px" }}>cm</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <div style={{ background:"rgba(45,106,79,0.1)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:12, padding:"10px 16px" }}>
              <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 2px" }}>幹の直径</p>
              <p style={{ fontSize:24, fontWeight:"bold", color:"#2d6a4f", margin:0 }}>{result.diam} cm</p>
            </div>
            <div style={{ background:"rgba(45,106,79,0.1)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:12, padding:"10px 16px" }}>
              <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 2px" }}>太さの目安</p>
              <p style={{ fontSize:20, fontWeight:"bold", color:result.circ>=300?GOLD:GRN, margin:0 }}>
                {result.circ>=500?"巨木":result.circ>=300?"大木":result.circ>=150?"成木":"若木"}
              </p>
            </div>
          </div>
        </div>
        <div style={{ ...CARD, padding:"14px 16px" }}>
          {[["水平距離",`${result.d} m`],["幹左端",`${result.leftDeg}°`],["幹右端",`${result.rightDeg}°`],["角度合計",`${(Math.abs(result.leftDeg)+Math.abs(result.rightDeg)).toFixed(1)}°`],["幹直径",`${result.diam} cm`]].map(([l,v],i,a)=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", paddingBottom:i<a.length-1?7:0, marginBottom:i<a.length-1?7:0, borderBottom:i<a.length-1?"1px solid rgba(126,203,161,0.1)":"none" }}>
              <span style={{ fontSize:11, color:"#5a9070" }}>{l}</span><span style={{ fontSize:13, color:"#1a3a2a" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background:"rgba(255,193,7,0.07)", border:"1px solid rgba(255,193,7,0.2)", borderRadius:12, padding:"10px 14px", marginBottom:12 }}>
          <p style={{ fontSize:11, color:"#ffc107", margin:0, lineHeight:1.7 }}>⚠️ 地上1.3mの高さで測定すると標準的な幹周りになります。</p>
        </div>
        <button style={{ ...PRI, background:"#2a4a1a", borderColor:GOLD, color:GOLD }} onClick={() => setShowSave(true)}>💾　アルバムに保存する</button>
        <button style={PRI} onClick={reset}>🌲　もう一度測定する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
        {showSave && <SaveModal measurement={{ trunk: result.circ+"" }} trees={trees} onSave={(nt,eid,sel) => {
          // 既存の木に追加する場合、樹種がわかれば樹齢も自動推定
          const existTree = eid ? trees.find(t=>t.id===eid) : null;
          const sp = existTree?.species || "";
          const autoAge = sp ? estimateAge(result.circ, sp)+"" : "";
          const meas = { trunk: result.circ+"", ...(autoAge ? { age: autoAge } : {}) };
          onSaveTree(nt ? { ...nt, measurements:{ ...nt.measurements, trunk:result.circ+"" } } : null, eid, meas);
          setShowSave(false);
        }} onSkip={() => setShowSave(false)} />}
      </div>}
    </div>
  );
}

// ================================================================
// CARTE APP
// ================================================================
function CarteApp({ trees, onUpdate, onBack, onMeasureHeight, onMeasureSpread, onMeasureTrunk, initialSelectedId }) {
  const [view, setView] = useState(initialSelectedId ? "detail" : "list");
  const [selected, setSelected] = useState(initialSelectedId ? trees.find(t=>t.id===initialSelectedId)||null : null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const fileRef = useRef();
  const detailPhotoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState(""); const [species, setSpecies] = useState("");
  const [location, setLocation] = useState(""); const [note, setNote] = useState("");
  const [height, setHeight] = useState(""); const [spread, setSpread] = useState("");
  const [trunk, setTrunk] = useState(""); const [age, setAge] = useState("");
  const [ageAuto, setAgeAuto] = useState(false); // 自動推定フラグ
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const openNew = () => { setEditing(null); setPhoto(null); setName(""); setSpecies(""); setLocation(""); setNote(""); setHeight(""); setSpread(""); setTrunk(""); setAge(""); setAgeAuto(false); setGps(null); setView("form"); };
  const openEdit = (t) => { setEditing(t); setPhoto(t.photo); setName(t.name); setSpecies(t.species||""); setLocation(t.location||""); setNote(t.note||""); setHeight(t.measurements?.height||""); setSpread(t.measurements?.spread||""); setTrunk(t.measurements?.trunk||""); setAge(t.measurements?.age||""); setAgeAuto(false); setGps(t.gps||null); setView("form"); };
  const doSave = () => {
    if (!name.trim()) { alert("木の名前を入力してください"); return; }
    const t = { id: editing?.id||newId(), name:name.trim(), species, location, note, photo, gps, measurements:{height,spread,trunk,age}, createdAt:editing?.createdAt||today(), updatedAt:today() };
    onUpdate(editing ? trees.map(x => x.id===t.id?t:x) : [t,...trees]);
    setSelected(t); setView("detail");
  };
  const doDelete = (id) => { if (!window.confirm("削除しますか？")) return; onUpdate(trees.filter(t=>t.id!==id)); setSelected(null); setView("list"); };
  const onPhoto = e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setPhoto(ev.target.result); r.readAsDataURL(f); };
  const filtered = trees.filter(t => !search||t.name.includes(search)||t.species?.includes(search)||t.location?.includes(search));
  const cur = selected && trees.find(t=>t.id===selected.id);

  return (
    <div>
      {/* LIST */}
      {view==="list"&&<>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:8, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={{ background:"none", border:"none", color:"#2d6a4f", fontSize:22, cursor:"pointer", padding:0 }}>‹</button>
            <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>大きな木のアルバム</h2>
          </div>
          {trees.length>0&&<button onClick={() => setShowPdf(true)} style={{ fontSize:12, color:GOLD, background:"rgba(255,209,102,0.1)", border:`1px solid rgba(255,209,102,0.35)`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>📄 PDF出力</button>}
        </div>

        {/* サムネグリッド統計 */}
        {trees.length>0&&<>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {[["登録",`${trees.length}本`,GRN],["測定済",`${trees.filter(t=>t.measurements?.height).length}本`,GOLD],["写真",`${trees.filter(t=>t.photo).length}本`,BLUE]].map(([l,v,c])=>(
              <div key={l} style={{ flex:1, background:"rgba(255,255,255,0.9)", border:"1px solid rgba(45,106,79,0.18)", borderRadius:10, padding:"8px", textAlign:"center" }}>
                <p style={{ fontSize:10, color:"#5a8c6a", margin:"0 0 2px" }}>{l}</p>
                <p style={{ fontSize:18, fontWeight:"bold", color:c, margin:0 }}>{v}</p>
              </div>
            ))}
          </div>

          {/* 写真サムネグリッド */}
          {trees.filter(t=>t.photo).length>0&&<div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:14 }}>
            {trees.filter(t=>t.photo).slice(0,8).map(t=>(
              <button key={t.id} onClick={() => { setSelected(t); setView("detail"); }} style={{ padding:0, border:"2px solid rgba(126,203,161,0.2)", borderRadius:8, overflow:"hidden", cursor:"pointer", aspectRatio:"1", background:"#e8f5e9", position:"relative" }}>
                <img src={t.photo} alt={t.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,0.6)", padding:"3px 4px" }}>
                  <p style={{ fontSize:9, color:"#1a3a2a", margin:0, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{t.name}</p>
                </div>
              </button>
            ))}
          </div>}
        </>}

        {trees.length>0&&<div style={{ position:"relative", marginBottom:12 }}>
          <input style={{ ...INP, paddingLeft:36, fontSize:14 }} type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・樹種・場所で検索..." />
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16, color:"#5a8c6a" }}>🔍</span>
        </div>}

        {filtered.length>0 ? filtered.map(t=>(
          <button key={t.id} onClick={()=>{setSelected(t);setView("detail");}} style={{ width:"100%", background:"rgba(255,255,255,0.9)", border:"1px solid rgba(45,106,79,0.18)", borderRadius:14, padding:0, cursor:"pointer", marginBottom:10, textAlign:"left", overflow:"hidden", fontFamily:"inherit" }}>
            <div style={{ display:"flex" }}>
              <div style={{ width:90, minHeight:90, background:"#e8f5e9", flexShrink:0 }}>
                {t.photo?<img src={t.photo} alt={t.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30 }}>🌳</div>}
              </div>
              <div style={{ flex:1, padding:"10px 12px" }}>
                <p style={{ fontSize:14, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 4px" }}>{t.name}</p>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:5 }}>
                  {t.species&&<span style={{ fontSize:11, color:"#2d6a4f", background:"rgba(45,106,79,0.1)", borderRadius:10, padding:"1px 8px" }}>{t.species}</span>}
                  {t.location&&<span style={{ fontSize:11, color:BLUE, background:"rgba(116,179,206,0.12)", borderRadius:10, padding:"1px 8px" }}>{t.location}</span>}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {t.measurements?.height&&<span style={{ fontSize:11, color:"#5a8c6a" }}>樹高 <strong style={{ color:"#2d6a4f" }}>{t.measurements.height}m</strong></span>}
                  {t.measurements?.trunk&&<span style={{ fontSize:11, color:"#5a8c6a" }}>幹周 <strong style={{ color:BLUE }}>{t.measurements.trunk}cm</strong></span>}
                  {t.measurements?.age&&<span style={{ fontSize:11, color:"#5a8c6a" }}>樹齢 <strong style={{ color:GOLD }}>{t.measurements.age}年</strong></span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", paddingRight:10, color:"#5a8c6a", fontSize:18 }}>›</div>
            </div>
          </button>
        )) : <div style={{ textAlign:"center", padding:"40px 20px" }}><p style={{ fontSize:36, marginBottom:12 }}>🌱</p><p style={{ fontSize:13, color:"#5a8c6a" }}>{search?"該当なし":"まだ登録されていません"}</p></div>}

        <button style={{ ...PRI, marginTop:8 }} onClick={openNew}>＋　新しい木を登録する</button>
        {showPdf && <PdfModal trees={trees} onClose={() => setShowPdf(false)} />}
      </>}

      {/* FORM */}
      {view==="form"&&<>
        <div style={{ display:"flex", alignItems:"center", gap:12, paddingTop:8, marginBottom:14 }}>
          <button onClick={()=>setView(editing?"detail":"list")} style={{ background:"none", border:"none", color:"#2d6a4f", fontSize:22, cursor:"pointer", padding:0 }}>‹</button>
          <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>{editing?"記録を編集":"新しい木を登録"}</h2>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={onPhoto} />
        <div style={{ ...CARD, padding:"12px" }}>
          {photo ? <div style={{ position:"relative" }}><img src={photo} alt="" style={{ width:"100%", maxHeight:200, objectFit:"cover", borderRadius:10, display:"block" }}/><button onClick={()=>fileRef.current.click()} style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.6)", border:`1px solid ${GRN}`, borderRadius:8, color:"#2d6a4f", fontSize:12, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>📷 撮り直す</button></div>
          : <button onClick={()=>fileRef.current.click()} style={{ width:"100%", padding:"24px", background:"rgba(126,203,161,0.06)", border:`2px dashed rgba(126,203,161,0.3)`, borderRadius:10, color:"#3a7a5a", fontSize:14, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>📷　写真を撮影 / 選択</button>}
        </div>
        <div style={CARD}>
          <p style={{ fontSize:13, color:"#2d6a4f", marginBottom:12 }}>基本情報</p>
          <span style={LBL}>木の名前（必須）：</span><input style={{ ...INP, marginBottom:10, fontSize:16 }} type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="例: おじいちゃんの家のクスノキ" />
          <span style={LBL}>樹種：</span>
          <select value={species} onChange={e=>{
            setSpecies(e.target.value);
            if (trunk && e.target.value) { setAge(estimateAge(parseFloat(trunk), e.target.value)+""); setAgeAuto(true); }
          }} style={{ ...INP, marginBottom:10, fontSize:14, appearance:"none" }}>
            <option value="">選択してください</option>
            {TREE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <span style={LBL}>場所・区画：</span><input style={{ ...INP, marginBottom:10, fontSize:16 }} type="text" value={location} onChange={e=>setLocation(e.target.value)} placeholder="例: 大阪府・天王寺公園" />

          {/* GPS */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <span style={{ ...LBL, marginBottom:0, flex:1 }}>📍 位置情報：</span>
            <button onClick={async () => {
              setGpsLoading(true);
              try { const g = await getGPS(); setGps(g); } catch(e) { alert("GPS取得失敗: " + e); }
              setGpsLoading(false);
            }} style={{ fontSize:12, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit" }}>
              {gpsLoading ? "取得中..." : gps ? "📍 再取得" : "📍 現在地を取得"}
            </button>
          </div>
          {gps ? (
            <div style={{ background:"rgba(45,106,79,0.06)", border:"1px solid rgba(45,106,79,0.18)", borderRadius:8, padding:"8px 12px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <p style={{ fontSize:12, color:"#2d6a4f", margin:0 }}>✅ {gps.lat}, {gps.lng}</p>
              <button onClick={() => setGps(null)} style={{ fontSize:11, color:"#ff8080", background:"none", border:"none", cursor:"pointer" }}>✕</button>
            </div>
          ) : (
            <p style={{ fontSize:11, color:"#5a8c6a", marginBottom:10 }}>※ 登録時に現在地を取得すると地図に表示できます</p>
          )}
          <span style={LBL}>メモ：</span><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="この木の特徴・感想など..." style={{ ...INP, resize:"vertical", minHeight:64, fontSize:14 }} />
        </div>
        <div style={CARD}>
          <p style={{ fontSize:13, color:"#2d6a4f", marginBottom:12 }}>測定値 <span style={{ fontSize:10, color:"#5a9070" }}>（空欄でも可）</span></p>

          {/* 樹高 */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>樹高（m）：</span>
              <button onClick={() => { doSave(); onMeasureHeight(editing?.id || null); }} style={{ fontSize:11, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>📐 今すぐ測定</button>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}><input style={{ ...INP, fontSize:20 }} type="number" value={height} onChange={e=>setHeight(e.target.value)} placeholder="未測定" /><span style={{ color:"#2d6a4f", minWidth:24, fontSize:13 }}>m</span></div>
          </div>

          {/* 枝張り */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>枝張り・直径（m）：</span>
              <button onClick={() => { doSave(); onMeasureSpread(editing?.id || null); }} style={{ fontSize:11, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>🌿 今すぐ測定</button>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}><input style={{ ...INP, fontSize:20 }} type="number" value={spread} onChange={e=>setSpread(e.target.value)} placeholder="未測定" /><span style={{ color:"#2d6a4f", minWidth:24, fontSize:13 }}>m</span></div>
          </div>

          {/* 幹周り */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>幹周り（cm・地上1.3m）：</span>
              <button onClick={() => { doSave(); onMeasureTrunk(editing?.id || null); }} style={{ fontSize:11, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>🌲 今すぐ測定</button>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}><input style={{ ...INP, fontSize:20 }} type="number" value={trunk} onChange={e=>{
              setTrunk(e.target.value);
              if (e.target.value && species) { setAge(estimateAge(parseFloat(e.target.value), species)+""); setAgeAuto(true); }
              else if (!e.target.value) { if (ageAuto) setAge(""); setAgeAuto(false); }
            }} placeholder="例: 250" /><span style={{ color:"#2d6a4f", minWidth:28, fontSize:13 }}>cm</span></div>
            <p style={{ fontSize:11, color:"#5a8c6a", margin:"4px 0 0" }}>※ メジャーで測った幹の周囲の長さをcmで入力（例：大きな木は100〜500cm）</p>
          </div>
          {/* 推定樹齢 */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>推定樹齢：</span>
              {ageAuto && <span style={{ fontSize:11, color:GOLD, background:"rgba(255,209,102,0.15)", border:"1px solid rgba(255,209,102,0.3)", borderRadius:20, padding:"2px 8px" }}>🤖 自動推定</span>}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
              <input style={{ ...INP, fontSize:20, borderColor: ageAuto ? "rgba(255,209,102,0.5)" : "rgba(126,203,161,0.4)" }}
                type="number" value={age}
                onChange={e=>{ setAge(e.target.value); setAgeAuto(false); }}
                placeholder="未測定（直接入力可）" />
              <span style={{ color:"#2d6a4f", minWidth:28, fontSize:13 }}>年</span>
            </div>
            {ageAuto && trunk && species && <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 6px" }}>
              {trunk}cm ÷ {GROWTH_RATE[species]}cm/年（{species}）＝ 約{age}年
            </p>}
            <div style={{ background:"rgba(255,193,7,0.07)", border:"1px solid rgba(255,193,7,0.18)", borderRadius:8, padding:"8px 12px", marginTop:6 }}>
              <p style={{ fontSize:11, color:"#ffc107", margin:0, lineHeight:1.7 }}>
                ⚠️ 樹齢は参考値です。成長速度は立地・気候・管理条件により大きく異なります。年輪調査など専門的手法による確認を推奨します。
              </p>
            </div>
          </div>
        </div>
        <button style={PRI} onClick={doSave}>💾　{editing?"保存する":"登録する"}</button>
        <button style={GHO} onClick={()=>setView(editing?"detail":"list")}>キャンセル</button>
      </>}

      {/* DETAIL */}
      {view==="detail"&&cur&&<>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:8, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>setView("list")} style={{ background:"none", border:"none", color:"#2d6a4f", fontSize:22, cursor:"pointer", padding:0 }}>‹</button>
            <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>{cur.name}</h2>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>{ printPDF([cur]); }} style={{ fontSize:12, color:GOLD, background:"rgba(255,209,102,0.1)", border:`1px solid rgba(255,209,102,0.3)`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontFamily:"inherit" }}>📄</button>
            <button onClick={()=>openEdit(cur)} style={{ fontSize:12, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>✏️ 編集</button>
            <button onClick={()=>doDelete(cur.id)} style={{ fontSize:12, color:"#ff8080", background:"rgba(220,50,50,0.1)", border:"1px solid rgba(220,50,50,0.4)", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontFamily:"inherit" }}>🗑️</button>
          </div>
        </div>
        {/* 詳細画面の写真エリア */}
        <input ref={detailPhotoRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
          onChange={e => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = ev => {
              const updated = { ...cur, photo: ev.target.result, updatedAt: today() };
              onUpdate(trees.map(t => t.id === cur.id ? updated : t));
              setSelected(updated);
            };
            r.readAsDataURL(f);
          }} />
        {cur.photo
          ? <div style={{ position:"relative", borderRadius:14, overflow:"hidden", marginBottom:12 }}>
              <img src={cur.photo} alt={cur.name} style={{ width:"100%", maxHeight:240, objectFit:"cover", display:"block" }}/>
              <button onClick={() => detailPhotoRef.current.click()}
                style={{ position:"absolute", bottom:10, right:10, background:"rgba(0,0,0,0.55)", border:"1px solid rgba(255,255,255,0.4)", borderRadius:8, color:"#fff", fontSize:12, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>
                📷 写真を変更
              </button>
            </div>
          : <button onClick={() => detailPhotoRef.current.click()}
              style={{ width:"100%", padding:"22px", background:"rgba(45,106,79,0.06)", border:"2px dashed rgba(45,106,79,0.3)", borderRadius:14, color:"#5a8c6a", fontSize:14, cursor:"pointer", fontFamily:"inherit", textAlign:"center", marginBottom:12, display:"block" }}>
              📷　写真を追加する
            </button>
        }
        <div style={CARD}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            {cur.species&&<span style={{ fontSize:12, background:"rgba(45,106,79,0.12)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:20, padding:"3px 12px", color:"#2d6a4f" }}>{cur.species}</span>}
            {cur.location&&<span style={{ fontSize:12, background:"rgba(116,179,206,0.15)", border:"1px solid rgba(116,179,206,0.3)", borderRadius:20, padding:"3px 12px", color:BLUE }}>{cur.location}</span>}
          </div>
          {cur.note&&<p style={{ fontSize:13, color:"#5a8c6a", lineHeight:1.7, margin:"0 0 8px" }}>{cur.note}</p>}
          {cur.gps && <p style={{ fontSize:11, color:"#2d6a4f", margin:"0 0 4px" }}>📍 {cur.gps.lat}, {cur.gps.lng}</p>}
          <p style={{ fontSize:11, color:"#5a8c6a", margin:0 }}>登録：{cur.createdAt}　更新：{cur.updatedAt}</p>
        </div>
        {(cur.measurements?.height||cur.measurements?.spread||cur.measurements?.trunk||cur.measurements?.age)&&<div style={CARD}>
          <p style={{ fontSize:13, color:"#2d6a4f", marginBottom:12 }}>測定値</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom: cur.measurements?.age ? 10 : 0 }}>
            {[["樹高",cur.measurements?.height,"m",GRN],["枝張り",cur.measurements?.spread,"m",GOLD],["幹周り",cur.measurements?.trunk,"cm",BLUE],["推定樹齢",cur.measurements?.age,"年","#a8d5b5"]].map(([l,v,u,c])=>v&&(
              <div key={l} style={{ flex:1, background:"rgba(255,255,255,0.9)", borderRadius:10, padding:"10px 12px", textAlign:"center", minWidth:68 }}>
                <p style={{ fontSize:10, color:"#5a8c6a", margin:"0 0 2px" }}>{l}</p>
                <p style={{ fontSize:22, fontWeight:"bold", color:c, margin:0, lineHeight:1 }}>{v}</p>
                <p style={{ fontSize:11, color:"#5a8c6a", margin:0 }}>{u}</p>
              </div>
            ))}
          </div>
          {cur.measurements?.age && <div style={{ background:"rgba(255,193,7,0.07)", border:"1px solid rgba(255,193,7,0.18)", borderRadius:8, padding:"8px 12px" }}>
            <p style={{ fontSize:11, color:"#ffc107", margin:0, lineHeight:1.7 }}>
              ⚠️ 推定樹齢は参考値です。成長速度は立地・気候・管理条件により大きく異なります。
            </p>
          </div>}
        </div>}
        {/* 画像保存ボタン */}
        <button onClick={() => saveTreeImage(cur)}
          style={{ width:"100%", padding:"13px", background:"rgba(126,203,161,0.15)", border:`1px solid ${GRN}`, borderRadius:12, color:GRN, fontSize:14, cursor:"pointer", marginBottom:8, fontFamily:"inherit", letterSpacing:1 }}>
          📸　写真アルバムに保存する
        </button>
        {/* 詳細画面からも測定ボタン */}
        <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
          <button onClick={() => onMeasureHeight(cur.id)} style={{ flex:1, padding:"11px 6px", background:"rgba(116,179,206,0.1)", border:`1px solid ${BLUE}`, borderRadius:12, color:BLUE, fontSize:12, cursor:"pointer", fontFamily:"inherit", minWidth:80 }}>📐 樹高</button>
          <button onClick={() => onMeasureSpread(cur.id)} style={{ flex:1, padding:"11px 6px", background:"rgba(255,209,102,0.1)", border:`1px solid ${GOLD}`, borderRadius:12, color:GOLD, fontSize:12, cursor:"pointer", fontFamily:"inherit", minWidth:80 }}>🌿 枝張り</button>
          <button onClick={() => onMeasureTrunk(cur.id)} style={{ flex:1, padding:"11px 6px", background:"rgba(141,110,99,0.1)", border:"1px solid #8d6e63", borderRadius:12, color:"#c4a882", fontSize:12, cursor:"pointer", fontFamily:"inherit", minWidth:80 }}>🌲 幹周り</button>
        </div>
      </>}
    </div>
  );
}



// ================================================================
// 画像保存（Canvas合成）
// ================================================================
async function saveTreeImage(tree) {
  const m = tree.measurements || {};

  const canvas = document.createElement("canvas");
  const W = 1080, H = 1350; // 4:5 縦長（Instagram風）
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // 背景グラデーション
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c1820");
  bg.addColorStop(0.5, "#1a2e3a");
  bg.addColorStop(1, "#0a1f14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 写真を描画
  if (tree.photo) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const ph = H * 0.52;
        // cover fit
        const scale = Math.max(W / img.width, ph / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        const sx = (W - sw) / 2, sy = (ph - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);
        // 写真下部グラデーションオーバーレイ
        const ov = ctx.createLinearGradient(0, ph * 0.5, 0, ph);
        ov.addColorStop(0, "rgba(10,31,20,0)");
        ov.addColorStop(1, "rgba(10,31,20,0.9)");
        ctx.fillStyle = ov;
        ctx.fillRect(0, 0, W, ph);
        resolve();
      };
      img.onerror = resolve;
      img.src = tree.photo;
    });
  } else {
    // 写真なし：緑の背景に絵文字
    ctx.fillStyle = "rgba(45,106,79,0.3)";
    ctx.fillRect(0, 0, W, H * 0.52);
    ctx.font = "200px serif";
    ctx.textAlign = "center";
    ctx.fillText("🌳", W / 2, H * 0.28);
  }

  const PH = H * 0.52; // 写真エリア高さ

  // アプリ名（左上）
  ctx.font = "bold 36px 'Hiragino Mincho ProN', Georgia, serif";
  ctx.fillStyle = "rgba(126,203,161,0.9)";
  ctx.textAlign = "left";
  ctx.fillText("大きな木", 48, 56);

  // 木の名前（写真下部）
  ctx.font = "bold 72px 'Hiragino Mincho ProN', Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 12;
  // 長い名前は折り返し
  const nameWords = tree.name;
  if (ctx.measureText(nameWords).width > W - 96) {
    ctx.font = "bold 54px 'Hiragino Mincho ProN', Georgia, serif";
  }
  ctx.fillText(nameWords, 48, PH - 80);
  ctx.shadowBlur = 0;

  // 樹種・場所タグ
  ctx.font = "32px 'Hiragino Mincho ProN', Georgia, serif";
  ctx.fillStyle = "#7ecba1";
  ctx.textAlign = "left";
  let tagX = 48;
  if (tree.species) {
    ctx.fillText("🌿 " + tree.species, tagX, PH - 34);
    tagX += ctx.measureText("🌿 " + tree.species).width + 24;
  }
  if (tree.location) {
    ctx.fillStyle = "#74b3ce";
    ctx.fillText("📍 " + tree.location, tagX, PH - 34);
  }

  // 区切り線
  ctx.strokeStyle = "rgba(126,203,161,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, PH + 20);
  ctx.lineTo(W - 48, PH + 20);
  ctx.stroke();

  // 測定値グリッド
  const measItems = [
    m.height ? { label: "樹　高", value: m.height, unit: "m", color: "#7ecba1" } : null,
    m.spread ? { label: "枝張り", value: m.spread, unit: "m", color: "#ffd166" } : null,
    m.trunk  ? { label: "幹周り", value: m.trunk,  unit: "cm", color: "#74b3ce" } : null,
    m.age    ? { label: "推定樹齢", value: m.age,  unit: "年", color: "#c4a882" } : null,
  ].filter(Boolean);

  if (measItems.length > 0) {
    const cols = Math.min(measItems.length, 2);
    const rows = Math.ceil(measItems.length / cols);
    const cellW = (W - 96 - (cols - 1) * 24) / cols;
    const cellH = 160;
    const startY = PH + 44;

    measItems.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 48 + col * (cellW + 24);
      const y = startY + row * (cellH + 16);

      // セル背景
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      roundRect(ctx, x, y, cellW, cellH, 16);
      ctx.fill();
      ctx.strokeStyle = "rgba(126,203,161,0.2)";
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, cellW, cellH, 16);
      ctx.stroke();

      // ラベル
      ctx.font = "28px 'Hiragino Mincho ProN', Georgia, serif";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.textAlign = "center";
      ctx.fillText(item.label, x + cellW / 2, y + 42);

      // 値
      ctx.font = "bold 80px 'Hiragino Mincho ProN', Georgia, serif";
      ctx.fillStyle = item.color;
      ctx.textAlign = "center";
      ctx.fillText(item.value, x + cellW / 2, y + 120);

      // 単位
      ctx.font = "28px 'Hiragino Mincho ProN', Georgia, serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      const vw = ctx.measureText(item.value).width;
      ctx.font = "bold 80px 'Hiragino Mincho ProN', Georgia, serif";
      const vw2 = ctx.measureText(item.value).width;
      ctx.font = "28px sans-serif";
      ctx.fillText(item.unit, x + cellW / 2 + vw2 / 2 + 10, y + 116);
    });
  }

  // 日付・出典
  const bottomY = H - 48;
  ctx.font = "26px 'Hiragino Mincho ProN', Georgia, serif";
  ctx.fillStyle = "rgba(126,203,161,0.5)";
  ctx.textAlign = "left";
  ctx.fillText("記録日：" + tree.updatedAt, 48, bottomY);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(126,203,161,0.35)";
  ctx.fillText("大きな木 App", W - 48, bottomY);

  // PNG ダウンロード
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (tree.name || "tree") + "_記録.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ================================================================
// MAP APP（地図表示）
// ================================================================
function MapApp({ trees, onSelectTree, onBack }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const treesWithGPS = trees.filter(t => t.gps?.lat && t.gps?.lng);

  useEffect(() => {
    // Leaflet CSS + JS を動的に読み込む
    if (document.getElementById("leaflet-css")) { initMap(); return; }
    const css = document.createElement("link");
    css.id = "leaflet-css";
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);

    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = () => initMap();
    js.onerror = () => setLoadError(true);
    document.head.appendChild(js);

    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    // 中心座標：GPSデータがあれば平均、なければ日本中心
    let center = [36.5, 137.0]; let zoom = 5;
    if (treesWithGPS.length > 0) {
      const avgLat = treesWithGPS.reduce((s,t) => s + t.gps.lat, 0) / treesWithGPS.length;
      const avgLng = treesWithGPS.reduce((s,t) => s + t.gps.lng, 0) / treesWithGPS.length;
      center = [avgLat, avgLng]; zoom = treesWithGPS.length === 1 ? 14 : 10;
    }

    const map = L.map(mapRef.current, { center, zoom, zoomControl: true });
    mapInstanceRef.current = map;

    // OpenStreetMap タイル
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // カスタムアイコン
    const treeIcon = L.divIcon({
      className: "",
      html: `<div style="background:#1a3a2a;border:2px solid #7ecba1;border-radius:50% 50% 50% 0;width:32px;height:32px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
               <span style="transform:rotate(45deg);font-size:16px;">🌳</span>
             </div>`,
      iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34]
    });

    // マーカー追加
    treesWithGPS.forEach(t => {
      const popup = `
        <div style="font-family:serif;min-width:160px;">
          ${t.photo ? `<img src="${t.photo}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;">` : ""}
          <b style="font-size:14px;color:#1a3a2a;">${t.name}</b><br>
          ${t.species ? `<span style="font-size:11px;color:#2d6a4f;">🌿 ${t.species}</span><br>` : ""}
          ${t.measurements?.height ? `<span style="font-size:11px;">樹高 <b>${t.measurements.height}m</b></span>　` : ""}
          ${t.measurements?.trunk ? `<span style="font-size:11px;">幹周 <b>${t.measurements.trunk}cm</b></span>` : ""}
          <br><button onclick="window.__treeSelect('${t.id}')"
            style="margin-top:8px;padding:5px 12px;background:#1a3a2a;border:1px solid #7ecba1;border-radius:6px;color:#7ecba1;font-size:12px;cursor:pointer;width:100%;">
            記録を見る
          </button>
        </div>`;
      L.marker([t.gps.lat, t.gps.lng], { icon: treeIcon })
        .addTo(map)
        .bindPopup(popup);
    });

    // グローバルコールバック
    window.__treeSelect = (id) => { onSelectTree(id); };
    setMapReady(true);
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:8, marginBottom:12 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#2d6a4f", fontSize:22, cursor:"pointer", padding:0 }}>‹</button>
        <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>大きな木の地図</h2>
        <span style={{ fontSize:12, color:"#5a9070", marginLeft:4 }}>{treesWithGPS.length}本表示</span>
      </div>

      {loadError && (
        <div style={{ ...CARD, textAlign:"center", padding:"24px" }}>
          <p style={{ fontSize:13, color:"#ff8080" }}>地図の読み込みに失敗しました。<br/>ネットワーク接続を確認してください。</p>
        </div>
      )}

      {!loadError && (
        <div style={{ borderRadius:16, overflow:"hidden", marginBottom:12, border:"1px solid rgba(45,106,79,0.25)" }}>
          <div ref={mapRef} style={{ height:400, width:"100%", background:"#f0f7f2" }} />
        </div>
      )}

      {treesWithGPS.length === 0 && (
        <div style={{ ...CARD, textAlign:"center", padding:"20px" }}>
          <p style={{ fontSize:32, marginBottom:8 }}>📍</p>
          <p style={{ fontSize:13, color:"#5a8c6a", lineHeight:1.8 }}>
            GPS情報のある木がありません。<br/>
            アルバム登録時に「📍 現在地を取得」を<br/>タップしてください。
          </p>
        </div>
      )}

      {treesWithGPS.length > 0 && (
        <div style={CARD}>
          <p style={{ fontSize:12, color:"#2d6a4f", marginBottom:10 }}>📍 登録済みの木</p>
          {treesWithGPS.map(t => (
            <button key={t.id} onClick={() => onSelectTree(t.id)}
              style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 0", background:"none", border:"none", borderBottom:"1px solid rgba(126,203,161,0.1)", cursor:"pointer", fontFamily:"inherit", textAlign:"left" }}>
              <span style={{ fontSize:18 }}>🌳</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, color:"#1a3a2a", margin:0, fontWeight:"bold" }}>{t.name}</p>
                <p style={{ fontSize:11, color:"#5a9070", margin:"2px 0 0" }}>
                  {t.gps.lat.toFixed(4)}, {t.gps.lng.toFixed(4)}
                  {t.species ? ` ・ ${t.species}` : ""}
                </p>
              </div>
              <span style={{ color:"#5a8c6a", fontSize:14 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================
// MAIN APP
// ================================================================
export default function App() {
  const [mode, setMode] = useState(null);
  const [trees, setTrees] = useState(loadTrees);
  const [pendingTreeId, setPendingTreeId] = useState(null);
  const [mapSelectedId, setMapSelectedId] = useState(null);
  const prof = loadProfile();

  const updateTrees = (next) => { setTrees(next); saveTrees(next); };

  const onSaveTree = (newTree, existingId, measurement) => {
    let next;
    if (newTree) {
      next = [newTree, ...trees];
    } else {
      next = trees.map(t => t.id === existingId ? { ...t, measurements: { ...t.measurements, ...measurement }, updatedAt: today() } : t);
    }
    updateTrees(next);
    setMode("carte");
  };

  // 地図から詳細へ
  const onSelectTree = (id) => { setMapSelectedId(id); setMode("carte"); };

  // アルバム編集画面から測定へ
  const onMeasureHeight = (treeId) => { setPendingTreeId(treeId); setMode("height"); };
  const onMeasureSpread = (treeId) => { setPendingTreeId(treeId); setMode("spread"); };
  const onMeasureTrunk  = (treeId) => { setPendingTreeId(treeId); setMode("trunk"); };

  const menuBtn = (emoji, title, sub, badge, onClick) => (
    <button onClick={onClick} style={{ width:"100%", padding:"18px 16px", background:"rgba(255,255,255,0.92)", border:"1.5px solid rgba(45,106,79,0.15)", borderRadius:16, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", gap:14, fontFamily:"inherit", textAlign:"left", boxShadow:"0 3px 12px rgba(45,106,79,0.1)" }}>
      <span style={{ fontSize:34 }}>{emoji}</span>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:15, fontWeight:"bold", color:"#1b4332", margin:0 }}>{title}</p>
        <p style={{ fontSize:12, color:"#52b788", margin:"3px 0 0" }}>{sub}</p>
      </div>
      {badge&&<span style={{ fontSize:12, background:"rgba(45,106,79,0.12)", color:"#2d6a4f", borderRadius:20, padding:"3px 10px" }}>{badge}</span>}
      <span style={{ color:"#2d6a4f", fontSize:20, fontWeight:"bold" }}>›</span>
    </button>
  );

  return (
    <div style={BG}>
      <div style={INNER}>
        <div style={{ textAlign:"center", paddingTop:36, paddingBottom:16 }}>
          <div style={{ fontSize:56, filter:"drop-shadow(0 4px 8px rgba(45,106,79,0.3))", marginBottom:8 }}>🌳</div>
          <h1 style={{ fontSize:28, fontWeight:"bold", letterSpacing:2, color:"#1b4332", margin:0, textShadow:"0 1px 2px rgba(45,106,79,0.2)" }}>大きな木</h1>
          <p style={{ fontSize:13, color:"#52b788", letterSpacing:3, margin:"6px 0 0", fontStyle:"italic" }}>My Tree Diary</p>
        </div>

        {mode===null&&<div style={{ marginTop:20 }}>
          {trees.length>0&&<div style={{ background:"rgba(255,255,255,0.9)", border:"1px solid rgba(45,106,79,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:16, boxShadow:"0 2px 8px rgba(45,106,79,0.08)" }}>
            <p style={{ fontSize:12, color:"#2d6a4f", margin:0, fontWeight:"bold" }}>📋 アルバム登録：{trees.length}本　測定済み：{trees.filter(t=>t.measurements?.height).length}本</p>
          </div>}
          {menuBtn("📋","大きな木のアルバム","写真・測定値を記録・管理・PDF出力",trees.length>0?`${trees.length}本`:null,()=>setMode("carte"))}
          {menuBtn("🗺️","大きな木の地図","記録した木の場所を地図で確認",trees.filter(t=>t.gps).length>0?`${trees.filter(t=>t.gps).length}本`:null,()=>setMode("map"))}
          {menuBtn("📐","樹高を測定する","カメラで根元・梢を2点ロック",null,()=>{ setPendingTreeId(null); setMode("height"); })}
          {menuBtn("🌿","枝張りを測定する","カメラで左端・右端を2点ロック",null,()=>{ setPendingTreeId(null); setMode("spread"); })}
          {menuBtn("🌲","幹周りを測定する","カメラで幹の左右を2点ロック",null,()=>{ setPendingTreeId(null); setMode("trunk"); })}
        </div>}

        {mode==="height"&&<HeightApp prof={prof} trees={trees} onSaveTree={(nt,eid,meas) => { if (pendingTreeId) { updateTrees(trees.map(t => t.id===pendingTreeId ? { ...t, measurements:{ ...t.measurements, ...meas }, updatedAt:today() } : t)); setMode("carte"); } else { onSaveTree(nt,eid,meas); } }} onBack={()=>setMode(null)}/>}
        {mode==="spread"&&<SpreadApp prof={prof} trees={trees} onSaveTree={(nt,eid,meas) => { if (pendingTreeId) { updateTrees(trees.map(t => t.id===pendingTreeId ? { ...t, measurements:{ ...t.measurements, ...meas }, updatedAt:today() } : t)); setMode("carte"); } else { onSaveTree(nt,eid,meas); } }} onBack={()=>setMode(null)}/>}
        {mode==="trunk"&&<TrunkApp prof={prof} trees={trees} onSaveTree={(nt,eid,meas) => { if (pendingTreeId) { updateTrees(trees.map(t => t.id===pendingTreeId ? { ...t, measurements:{ ...t.measurements, ...meas }, updatedAt:today() } : t)); setMode("carte"); } else { onSaveTree(nt,eid,meas); } }} onBack={()=>setMode(null)}/>}
        {mode==="carte"&&<CarteApp trees={trees} onUpdate={updateTrees} onBack={()=>{ setMapSelectedId(null); setMode(null); }} onMeasureHeight={onMeasureHeight} onMeasureSpread={onMeasureSpread} onMeasureTrunk={onMeasureTrunk} initialSelectedId={mapSelectedId}/>}
        {mode==="map"&&<MapApp trees={trees} onSelectTree={onSelectTree} onBack={()=>setMode(null)}/>}
      </div>
    </div>
  );
}
