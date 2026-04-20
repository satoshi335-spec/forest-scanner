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

// alpha角度差（0-360の最短経路）
function alphaDiff(a, b) {
  let diff = Math.abs(a - b);
  if (diff > 180) diff = 360 - diff;
  return diff;
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
function parseDate(s) { if (!s) return 0; const [y,m,d] = (s+"").split("/").map(Number); return new Date(y,m-1,d).getTime(); }
function sortNewest(arr) { return [...arr].sort((a,b) => parseDate(b.createdAt) - parseDate(a.createdAt)); }
function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem("fs_profile") || "{}");
    // 身長から自動計算モードの場合のみ再計算
    if (p.bodyH && p.strideMode !== "manual") {
      p.stride = +(parseFloat(p.bodyH) * 0.37 / 100).toFixed(3);
      saveProfile(p);
    }
    return p;
  } catch { return {}; }
}
function saveProfile(o) { try { localStorage.setItem("fs_profile", JSON.stringify(o)); } catch {} }
// ================================================================
// IndexedDB ストレージ
// ================================================================
const DB_NAME = "ookina_ki_db", DB_VER = 1, STORE = "trees";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadTreesDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

async function saveTreesDB(trees) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      // 全削除してから全追加
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        let done = 0;
        if (trees.length === 0) { resolve(); return; }
        trees.forEach(t => {
          const r = store.put(t);
          r.onsuccess = () => { done++; if (done === trees.length) resolve(); };
          r.onerror = () => { done++; if (done === trees.length) resolve(); };
        });
      };
      clearReq.onerror = () => resolve();
    });
  } catch(e) { console.warn("IndexedDB save error:", e); }
}

// 後方互換：localStorageからの移行
async function migrateFromLocalStorage() {
  try {
    const old = localStorage.getItem("fs_trees");
    if (!old) return;
    const trees = JSON.parse(old);
    if (trees.length > 0) {
      await saveTreesDB(trees);
      localStorage.removeItem("fs_trees");
      console.log(`✅ ${trees.length}本のデータをIndexedDBに移行しました`);
    }
  } catch(e) { console.warn("移行エラー:", e); }
}

// 後方互換用（同期呼び出し箇所のため空配列を返す）
function loadTrees() { return []; }
function saveTrees(t) { saveTreesDB(t); }


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
const CARD = { background: "rgba(255,255,255,0.97)", border: "1.5px solid rgba(45,106,79,0.2)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "0 2px 16px rgba(45,106,79,0.12)" };
const INP = { width: "100%", boxSizing: "border-box", background: "#ffffff", border: "2px solid rgba(45,106,79,0.35)", borderRadius: 10, padding: "13px 14px", color: "#0a1f0f", fontSize: 18, outline: "none", fontFamily: "inherit", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.06)" };
const LBL = { fontSize: 14, color: "#1a4a2a", marginBottom: 6, display: "block", fontWeight: "bold" };
const PRI = { width: "100%", padding: "16px", background: "linear-gradient(135deg,#1a5c3f,#2d7a55)", border: "none", borderRadius: 12, color: "#ffffff", fontSize: 17, cursor: "pointer", marginBottom: 10, fontFamily: "inherit", letterSpacing: 1, boxShadow: "0 4px 14px rgba(45,106,79,0.4)", fontWeight: "bold" };
const GHO = { width: "100%", padding: "13px", background: "rgba(255,255,255,0.97)", border: "2px solid rgba(45,106,79,0.4)", borderRadius: 12, color: "#1a4a2a", fontSize: 15, cursor: "pointer", marginBottom: 10, fontFamily: "inherit", fontWeight: "bold" };
const TAB = (on) => ({ flex: 1, padding: "11px 6px", borderRadius: 8, cursor: "pointer", fontSize: 14, background: on ? "#1a5c3f" : "rgba(255,255,255,0.97)", border: `2px solid ${on ? "#1a5c3f" : "rgba(45,106,79,0.3)"}`, color: on ? "#ffffff" : "#1a4a2a", fontFamily: "inherit", fontWeight: "bold" });
const SML = (c) => ({ fontSize: 11, color: c, background: "rgba(255,255,255,0.9)", border: `1.5px solid ${c}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", marginTop: 6 });

// 樹種別年間成長量（幹周りcm/年）
// 年間幹周成長量(cm/年)
// 参考：国土技術政策総合研究所・日本緑化センター・各研究資料
const GROWTH_RATE = {
  // ── 巨木・天然記念物に多い樹種 ──
  "クスノキ":     3.5,  // 成長速・日本最大の巨木多い
  "スギ":         2.0,  // 巨木本数1位(縄文杉など)
  "ケヤキ":       2.5,  // 巨木本数2位
  "イチョウ":     2.0,  // 巨木本数4位・神社仏閣に多い
  "シイノキ":     2.2,  // 巨木本数5位(ツブラジイ/スダジイ)
  "タブノキ":     2.8,  // 巨木本数6位・照葉樹林
  "カツラ":       3.0,  // 渓流沿いの巨木・多幹
  "トチノキ":     2.5,  // 山地の巨木
  "ムクノキ":     2.8,  // 社寺の巨木に多い
  "エノキ":       2.5,  // 里の巨木
  "ミズナラ":     2.0,  // 北日本の巨木
  "コナラ":       1.8,  // 雑木林
  "アラカシ":     2.0,  // 西日本の社寺
  "シラカシ":     2.5,  // 関東の社寺
  "アカガシ":     2.2,  // 西日本の照葉樹
  "ウラジロガシ": 2.0,  // 山地の大木
  // ── 社寺・神社の御神木に多い ──
  "サクラ":       3.0,  // エドヒガン・ヤマザクラなど
  "サワラ":       1.8,  // 神社の御神木
  "コウヤマキ":   1.2,  // 高野山など・成長遅
  "ビャクシン":   1.0,  // 神社・成長極遅・長寿
  "スダジイ":     2.2,  // 照葉樹林の巨木
  "ツブラジイ":   2.0,  // 西日本の照葉樹
  // ── 針葉樹 ──
  "ヒノキ":       1.8,
  "アスナロ":     1.5,  // ヒバとも呼ぶ
  "コウヤヒノキ": 1.5,
  "マツ":         1.5,  // アカマツ・クロマツ共通
  "アカマツ":     1.5,
  "クロマツ":     1.5,
  "カラマツ":     2.5,  // 成長速
  "トドマツ":     1.5,
  "エゾマツ":     1.5,
  "モミ":         1.8,
  "ウラジロモミ": 1.5,
  "ツガ":         1.5,
  // ── 街路樹・公園樹 ──
  "プラタナス":   4.0,  // 成長速
  "メタセコイア": 4.0,  // 成長速
  "ヒマラヤスギ": 3.5,
  "トウカエデ":   2.8,
  "ユリノキ":     3.5,  // 成長速
  "センダン":     3.5,  // 暖地・成長速
  "シンジュ":     5.0,  // ニワウルシ・成長極速
  "ポプラ":       5.0,  // 成長極速
  "ニレ":         2.5,
  "ハルニレ":     2.5,
  "アキニレ":     2.0,
  // ── その他自生種 ──
  "ホオノキ":     2.5,
  "コブシ":       2.0,
  "ハクモクレン": 2.5,
  "クヌギ":       2.2,
  "イヌシデ":     1.8,
  "アオシデ":     1.8,
  "サワグルミ":   3.0,
  "ハンノキ":     2.5,
  "カキノキ":     1.5,
  "クリ":         2.0,
  "その他":       2.5,
};
function estimateAge(trunkCm, species) {
  const rate = GROWTH_RATE[species] || 2.5;
  return Math.round(trunkCm / rate);
}

// 樹種リスト（カテゴリ分けで選びやすく）
const TREE_TYPES = [
  // 巨木・天然記念物に多い
  "クスノキ","スギ","ケヤキ","イチョウ","シイノキ","タブノキ",
  "カツラ","トチノキ","ムクノキ","エノキ","ミズナラ","コナラ",
  "アラカシ","シラカシ","アカガシ","ウラジロガシ",
  // 社寺・神社
  "サクラ","ビャクシン","コウヤマキ","サワラ","スダジイ","ツブラジイ",
  // 針葉樹
  "ヒノキ","マツ","アカマツ","クロマツ","カラマツ",
  "モミ","ツガ","トドマツ","エゾマツ","アスナロ",
  // 街路樹・公園
  "プラタナス","メタセコイア","ヒマラヤスギ","トウカエデ",
  "ユリノキ","センダン","ポプラ","ニレ","ハルニレ",
  // その他
  "ホオノキ","コブシ","クヌギ","サワグルミ","カキノキ","クリ",
  "その他",
];

// ================================================================
// CAMERA HOOK
// ================================================================
// カメラのFOVをiPhoneの焦点距離から自動取得
// 既存のストリームからFOVを推定（カメラを二重起動しない）
function estimateFOVFromStream(stream) {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return { hFov:60, vFov:45, source:"default" };
    const settings = track.getSettings();
    const w = settings.width || 1920, h = settings.height || 1080;
    const aspect = w / h;
    // iPhone 広角: 水平約69°、縦約54°
    const hFov = aspect > 1.5 ? 69 : 60;
    const vFov = Math.round(hFov / aspect);
    return { hFov, vFov, source:"estimated" };
  } catch {
    return { hFov:60, vFov:45, source:"default" };
  }
}

// FOVをlocalStorageにキャッシュ
function getCachedFOV() {
  try {
    const c = JSON.parse(localStorage.getItem("camera_fov") || "null");
    if (c && Date.now() - c.ts < 7 * 24 * 3600000) return c;
  } catch {}
  return null;
}
function setCachedFOV(fov) {
  try { localStorage.setItem("camera_fov", JSON.stringify({ ...fov, ts: Date.now() })); } catch {}
}

function useCameraAndSensor(onOrient) {
  const [sensorOn, setSensorOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [fov, setFov] = useState(getCachedFOV() || { hFov:60, vFov:45, source:"default" });
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
      // FOV推定（既存ストリームから・カメラを二重起動しない）
      if (!getCachedFOV()) {
        const detected = estimateFOVFromStream(s);
        setCachedFOV(detected);
        setFov(detected);
      }
    } catch { setCameraOn(false); }
  };
  const stopCamera = () => {
    window.removeEventListener("deviceorientation", onOrient);
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    setCameraOn(false); setSensorOn(false);
  };
  return { sensorOn, cameraOn, videoRef, startAll, stopCamera, fov };
}

// ================================================================
// DIST PANEL
// ================================================================
function DistPanel({ bodyH, setBodyH, eyeH, setEyeH, dist, setDist, distMode, setDistMode, stride, setStride, walkCount, setWalkCount, showEyeH }) {
  const prof = loadProfile();
  const [msg, setMsg] = useState(false);
  // 歩幅モード：auto（身長から）/ manual（実測入力）
  const [strideMode, setStrideModeLocal] = useState(prof.strideMode || "auto");
  const [manualStrideCm, setManualStrideCm] = useState(prof.manualStrideCm || "");

  const switchStrideMode = (mode) => {
    setStrideModeLocal(mode);
    saveProfile({ ...loadProfile(), strideMode: mode });
    if (mode === "auto" && bodyH) {
      const s = +(parseFloat(bodyH) * 0.37 / 100).toFixed(3);
      setStride(s);
      saveProfile({ ...loadProfile(), strideMode: mode, stride: s });
    }
    if (mode === "manual" && manualStrideCm) {
      const s = +(parseFloat(manualStrideCm) / 100).toFixed(3);
      setStride(s);
      saveProfile({ ...loadProfile(), strideMode: mode, stride: s });
    }
  };

  const onBodyH = v => {
    setBodyH(v);
    const h = parseFloat(v);
    if (h > 0 && strideMode === "auto") {
      const s = +(h * 0.37 / 100).toFixed(3);
      setStride(s);
      saveProfile({ ...loadProfile(), bodyH: v, stride: s });
    } else {
      saveProfile({ ...loadProfile(), bodyH: v });
    }
  };

  const onManualStride = v => {
    setManualStrideCm(v);
    if (v) {
      const s = +(parseFloat(v) / 100).toFixed(3);
      setStride(s);
      saveProfile({ ...loadProfile(), strideMode: "manual", manualStrideCm: v, stride: s });
    }
    if (walkCount && v) setDist(+(parseFloat(walkCount) * parseFloat(v) / 100).toFixed(1) + "");
  };

  const autoFill = () => {
    const h = parseFloat(bodyH); if (!h) return;
    const e = +(h*0.93/100).toFixed(2)+"";
    const s = +(h*0.37/100).toFixed(3);
    setEyeH(e); setStride(s);
    saveProfile({ ...loadProfile(), bodyH, eyeH: e, stride: s, strideMode: "auto" });
    setMsg(true); setTimeout(() => setMsg(false), 2000);
  };

  const hw = v => { setWalkCount(v); if (stride && v) setDist(+(parseFloat(v)*stride).toFixed(1)+""); };

  return (
    <>
      <div style={CARD}>
        <p style={{ fontSize: 15, color: "#1a4a2a", marginBottom: 12, fontWeight:"bold" }}>身長{showEyeH ? "・目の高さ" : ""} <span style={{ fontSize: 10, color: "#4a9070" }}>自動保存</span></p>
        <span style={LBL}>身長（cm）：</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input style={INP} type="number" value={bodyH} onChange={e => onBodyH(e.target.value)} placeholder="例: 170" />
          <span style={{ color: GRN, minWidth: 24 }}>cm</span>
        </div>
        {showEyeH && <>
          <span style={LBL}>目の高さ（m）：</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input style={INP} type="number" value={eyeH} onChange={e => { setEyeH(e.target.value); saveProfile({ ...loadProfile(), eyeH: e.target.value }); }} placeholder="1.5" />
            <span style={{ color: GRN, minWidth: 24 }}>m</span>
          </div>
        </>}
        {bodyH && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <button onClick={autoFill} style={{ fontSize: 11, color: GRN, background: "rgba(126,203,161,0.1)", border: "1px solid rgba(126,203,161,0.3)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>身長から自動入力</button>
          {msg && <span style={{ fontSize: 11, color: GRN }}>✅ 保存</span>}
        </div>}

        {/* 歩幅設定 */}
        <div style={{ borderTop: "1px solid rgba(126,203,161,0.2)", paddingTop: 12, marginTop: 4 }}>
          <p style={{ fontSize: 12, color: GRN, marginBottom: 8 }}>歩幅の設定</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button style={TAB(strideMode==="auto")} onClick={() => switchStrideMode("auto")}>🤖 身長から自動計算</button>
            <button style={TAB(strideMode==="manual")} onClick={() => switchStrideMode("manual")}>📏 実測値を入力</button>
          </div>
          {strideMode === "auto" && <>
            {bodyH
              ? <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: GRN }}>
                  歩幅：<strong>{Math.round(parseFloat(bodyH)*0.37)} cm</strong>
                  <span style={{ color: "#4a9070", marginLeft: 8 }}>（身長×0.37・慎重歩き）</span>
                </div>
              : <p style={{ fontSize: 11, color: "#4a9070" }}>先に身長を入力してください</p>
            }
          </>}
          {strideMode === "manual" && <>
            <span style={LBL}>実測歩幅（cm）：</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input style={INP} type="number" value={manualStrideCm} onChange={e => onManualStride(e.target.value)} placeholder="例: 60" />
              <span style={{ color: GRN, minWidth: 24 }}>cm</span>
            </div>
            <div style={{ background: "rgba(255,209,102,0.08)", border: "1px solid rgba(255,209,102,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: GRN, lineHeight: 1.7 }}>
              💡 測り方：10歩歩いた距離（cm）÷ 10<br/>
              例：600cm ÷ 10 = <strong>60cm</strong>
            </div>
            {manualStrideCm && <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "8px 12px", marginTop: 6, fontSize: 12, color: GRN }}>
              歩幅：<strong>{manualStrideCm} cm</strong>（実測値・保存済み）
            </div>}
          </>}
        </div>
      </div>

      <div style={CARD}>
        <p style={{ fontSize: 15, color: "#1a4a2a", marginBottom: 12, fontWeight:"bold" }}>木までの距離</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button style={TAB(distMode===0)} onClick={() => setDistMode(0)}>📏 直接入力（m）</button>
          <button style={TAB(distMode===1)} onClick={() => setDistMode(1)}>👣 歩数で入力</button>
        </div>
        {distMode === 0 && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><input style={INP} type="number" value={dist} onChange={e => setDist(e.target.value)} placeholder="例: 15" /><span style={{ color: GRN, minWidth: 24 }}>m</span></div>}
        {distMode === 1 && <>
          {!stride && <p style={{ fontSize: 11, color: "#4a9070", marginBottom: 8 }}>※ 上で歩幅を設定してください</p>}
          {stride && <div style={{ background: "rgba(126,203,161,0.1)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 12, color: GRN }}>
            使用する歩幅：<strong>{(stride*100).toFixed(0)} cm</strong>
            <span style={{ fontSize: 10, color: "#4a9070", marginLeft: 6 }}>（{strideMode==="manual"?"実測値":"身長から推定"}）</span>
          </div>}
          <span style={LBL}>歩数：</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input style={INP} type="number" value={walkCount} onChange={e => hw(e.target.value)} placeholder="例: 3" />
            <span style={{ color: GRN, minWidth: 24 }}>歩</span>
          </div>
          {dist && stride && <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: GRN }}>
            {walkCount}歩 × {(stride*100).toFixed(0)}cm ＝ 約 <strong>{dist} m</strong>
          </div>}
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
        {/* ロックしたライン：2本の角度差を画面上の相対位置で表示 */}
        {(() => {
          // 1本だけロック済み → 中央に固定
          // 2本ともロック済み → 角度差をピクセル変換して相対位置で表示
          const PPD = 4; // 1度あたりのピクセル数
          if (lock1 != null && lock2 == null) {
            // lock1のみ：中央
            return isVertical
              ? <div style={{ position:"absolute", top:"50%", left:0, right:0, height:2, background:color1, opacity:0.85, transform:"translateY(-50%)", boxShadow:`0 0 6px ${color1}` }}><span style={{ position:"absolute", right:8, top:-22, fontSize:10, color:color1, background:"rgba(0,0,0,0.7)", padding:"2px 8px", borderRadius:4, fontWeight:"bold" }}>✅ {label1} {lock1>0?"+":""}{lock1}°</span></div>
              : <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:2, background:color1, opacity:0.85, transform:"translateX(-50%)", boxShadow:`0 0 6px ${color1}` }}><span style={{ position:"absolute", top:10, left:6, fontSize:10, color:color1, background:"rgba(0,0,0,0.7)", padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap", fontWeight:"bold" }}>✅ {label1} {lock1}°</span></div>;
          }
          if (lock1 != null && lock2 != null) {
            // 2本とも：角度差を相対位置で表示、中間点を中央に
            const mid = (lock1 + lock2) / 2;
            let off1 = Math.round((lock1 - mid) * PPD);
            let off2 = Math.round((lock2 - mid) * PPD);
            // 最低でも40px離す（角度差が小さくてもラインが見える）
            if (Math.abs(off1 - off2) < 40) {
              const sign = off1 <= off2 ? -1 : 1;
              off1 = sign * 20;
              off2 = -sign * 20;
            }
            return <>
              {isVertical
                ? <div style={{ position:"absolute", top:`calc(50% + ${off1}px)`, left:0, right:0, height:2, background:color1, opacity:0.85, transform:"translateY(-50%)", boxShadow:`0 0 6px ${color1}` }}><span style={{ position:"absolute", right:8, top:-22, fontSize:10, color:color1, background:"rgba(0,0,0,0.7)", padding:"2px 8px", borderRadius:4, fontWeight:"bold" }}>✅ {label1} {lock1>0?"+":""}{lock1}°</span></div>
                : <div style={{ position:"absolute", left:`calc(50% + ${off1}px)`, top:0, bottom:0, width:2, background:color1, opacity:0.85, transform:"translateX(-50%)", boxShadow:`0 0 6px ${color1}` }}><span style={{ position:"absolute", top:10, left:6, fontSize:10, color:color1, background:"rgba(0,0,0,0.7)", padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap", fontWeight:"bold" }}>✅ {label1} {lock1}°</span></div>}
              {isVertical
                ? <div style={{ position:"absolute", top:`calc(50% + ${off2}px)`, left:0, right:0, height:2, background:color2, opacity:0.85, transform:"translateY(-50%)", boxShadow:`0 0 6px ${color2}` }}><span style={{ position:"absolute", right:8, top:-22, fontSize:10, color:color2, background:"rgba(0,0,0,0.7)", padding:"2px 8px", borderRadius:4, fontWeight:"bold" }}>✅ {label2} {lock2>0?"+":""}{lock2}°</span></div>
                : <div style={{ position:"absolute", left:`calc(50% + ${off2}px)`, top:0, bottom:0, width:2, background:color2, opacity:0.85, transform:"translateX(-50%)", boxShadow:`0 0 6px ${color2}` }}><span style={{ position:"absolute", top:28, left:6, fontSize:10, color:color2, background:"rgba(0,0,0,0.7)", padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap", fontWeight:"bold" }}>✅ {label2} {lock2}°</span></div>}
            </>;
          }
          return null;
        })()}
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
async function printPDF(targets) {
  // 写真をPDF用に400px幅にリサイズ（Safari タイムアウト防止）
  const resizeForPDF = (dataUrl) => new Promise(resolve => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const MAX = 400;
      const scale = Math.min(1, MAX / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

  // 全写真を事前リサイズ
  const resized = await Promise.all(targets.map(t => resizeForPDF(t.photo)));

  // 縦長カード・2列グリッド（写真を3:4比率で縦長表示）
  const cards = targets.map((t, idx) => {
    const m = t.measurements || {};
    const photo = resized[idx];
    return `
      <div class="card">
        <div class="photo-wrap">
          ${photo
            ? `<img src="${photo}" class="photo" />`
            : `<div class="no-photo">🌳</div>`}
        </div>
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
  });

  // 2本ずつページにまとめる
  const pages = [];
  for (let i = 0; i < cards.length; i += 2) {
    const group = cards.slice(i, i + 2).join("");
    pages.push(`<div class="page">${group}</div>`);
  }
  const pagedCards = pages.join("");

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
  <title>大きな木 測定レポート</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Hiragino Mincho ProN', Georgia, serif; background: #fff; color: #1a2a1a; padding: 16px; }
    header { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #2d6a4f; padding-bottom: 10px; margin-bottom: 6px; }
    header h1 { font-size: 20px; color: #2d6a4f; }
    .meta { font-size: 11px; color: #888; margin-bottom: 16px; }
    /* 1ページ2本・横レイアウト */
    .grid { display: block; }
    .page { display: flex; flex-direction: column; gap: 16px; height: 96vh; page-break-after: always; box-sizing: border-box; padding: 4px 0; }
    .page:last-child { page-break-after: auto; }
    .card { border: 1px solid #cde8d8; border-radius: 12px; overflow: hidden; display: flex; flex-direction: row; flex: 1; min-height: 0; }
    /* 写真エリア：左側・縦長 */
    .photo-wrap { width: 42%; flex-shrink: 0; overflow: hidden; background: #f0f7f0; }
    .photo { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
    .no-photo { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 52px; }
    .card-body { padding: 16px 18px; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
    .card-body h2 { font-size: 18px; color: #1a3a2a; font-weight: bold; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag { font-size: 11px; border-radius: 20px; padding: 3px 10px; }
    .tag.green { background: #e8f5ee; color: #2d6a4f; border: 1px solid #b0d8c0; }
    .tag.blue  { background: #e8f0f8; color: #2a4a6a; border: 1px solid #b0c8e0; }
    .gps { font-size: 11px; color: #2d6a4f; }
    .note { font-size: 12px; color: #555; line-height: 1.6; }
    .meas-grid { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .meas-item { background: #f0f7f0; border-radius: 8px; padding: 6px 10px; text-align: center; flex: 1; min-width: 52px; }
    .ml { font-size: 10px; color: #666; display: block; margin-bottom: 2px; }
    .mv { font-size: 20px; font-weight: bold; color: #2d6a4f; }
    .mv small { font-size: 11px; font-weight: normal; color: #888; margin-left: 2px; }
    .date { font-size: 11px; color: #aaa; margin-top: auto; padding-top: 6px; }
    @media print {
      body { padding: 8px; }
      .grid { gap: 10px; }
    }
  </style></head><body>
  <header><span style="font-size:24px;">🌳</span><h1>大きな木 測定レポート</h1></header>
  <p class="meta">出力日：${today()}　登録本数：${targets.length}本</p>
  <div class="grid">${pagedCards}</div>
  <p style="font-size:10px; color:#888; margin-top:28px; border-top:1px solid #e0e0e0; padding-top:12px; line-height:1.8;">
    ※ 推定樹齢は幹周り÷樹種別年間成長量による参考値です。実際の樹齢は立地・気候・管理条件により大きく異なります。<br>
    ※ 参考：国土技術政策総合研究所「公園樹木管理の高度化に関する研究」・日本緑化センター資料に基づく概算値。<br>
    ※ 正確な樹齢は年輪調査など専門的な手法による確認を推奨します。
  </p>
  <script>window.onload = () => setTimeout(() => window.print(), 500);<\/script>
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
          onClick={async () => { if (targets.length > 0) { onClose(); await printPDF(targets); } }}>
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
function HeightApp({ prof, trees, onSaveTree, onBack, pendingTreeId, pendingTreeName, onSaveAndMeasureSpread }) {
  const [pg, setPg] = useState(0);
  const [dist, setDist] = useState(""); const [eyeH, setEyeH] = useState(prof.eyeH||"1.5");
  const [bodyH, setBodyH] = useState(prof.bodyH||""); const [walkCount, setWalkCount] = useState("");
  const [stride, setStride] = useState(prof.stride||null); const [distMode, setDistMode] = useState(1);
  const [top, setTop] = useState(null); const [bot, setBot] = useState(null);
  const [result, setResult] = useState(null); const [showSave, setShowSave] = useState(false);
  const dummyOrient = useCallback(() => {}, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(dummyOrient);
  const canCalc = top!==null&&bot!==null&&!!dist&&!!eyeH;
  const doCalc = () => {
    if (!canCalc) return; stopCamera();
    const d = parseFloat(dist), e = parseFloat(eyeH);
    // タップ方式：Y座標比率から角度を計算（カメラFOV縦 約45°）
    const VFOV = fov?.vFov || 45;
    const topAngle = -(top - 0.5) * VFOV;   // 上タップ → 正の仰角
    const botAngle = -(bot - 0.5) * VFOV;   // 下タップ → 負の俯角
    const h = +(d * (Math.tan(topAngle * Math.PI/180) - Math.tan(botAngle * Math.PI/180)) + e).toFixed(1);
    setResult({ height: Math.max(0.1, h), d, e, topPct: top, botPct: bot, topAngle: +topAngle.toFixed(1), botAngle: +botAngle.toFixed(1) });
    setPg(3);
  };
  const reset = () => { stopCamera(); setPg(0); setDist(""); setWalkCount(""); setTop(null); setBot(null); setResult(null); setShowSave(false); };

  return (
    <div>
      {pg>0&&pg<3&&<div style={{ display:"flex", gap:4, margin:"14px 0" }}>{["① 距離入力","② タップ測定","③ 結果"].map((l,i)=><div key={i} style={{ flex:1, textAlign:"center" }}><div style={{ height:3, borderRadius:2, background:i<pg?"#2d6a4f":"rgba(45,106,79,0.2)", marginBottom:4 }}/><span style={{ fontSize:10, color:i<pg?"#1b4332":"#74a98a" }}>{l}</span></div>)}</div>}
      {pg===0&&<div style={{ marginTop:12 }}>
        <div style={CARD}><p style={{ fontSize:12, color:"#2d6a4f", textAlign:"center", marginBottom:10 }}>画面タップ方式（梢・根元）</p>
          <svg viewBox="0 0 280 160" style={{ width:"100%", height:"auto", display:"block" }}>
            {/* 地面 */}
            <line x1="20" y1="135" x2="260" y2="135" stroke="#4a9070" strokeWidth="1.5"/>
            {/* 幹 */}
            <line x1="170" y1="135" x2="170" y2="22" stroke={GRN} strokeWidth="4"/>
            {/* 樹冠 */}
            <ellipse cx="170" cy="18" rx="24" ry="14" fill="#2d6a4f" opacity="0.85"/>
            {/* 梢タップ */}
            <circle cx="170" cy="18" r="9" fill={GOLD} opacity="0.9"/>
            <text x="170" y="22" fill="#fff" fontSize="9" textAnchor="middle">👆</text>
            <text x="192" y="16" fill={GOLD} fontSize="9">梢</text>
            {/* 根元タップ */}
            <circle cx="170" cy="130" r="9" fill={BLUE} opacity="0.9"/>
            <text x="170" y="134" fill="#fff" fontSize="9" textAnchor="middle">👆</text>
            <text x="192" y="134" fill={BLUE} fontSize="9">根元</text>
            {/* 樹高ライン */}
            <line x1="204" y1="18" x2="204" y2="130" stroke="#a8d5b5" strokeWidth="1" strokeDasharray="3,2"/>
            <text x="218" y="78" fill="#a8d5b5" fontSize="9" textAnchor="middle">樹高</text>
            {/* 人 */}
            <circle cx="46" cy="106" r="8" fill={GRN} opacity="0.85"/>
            <line x1="46" y1="114" x2="46" y2="135" stroke={GRN} strokeWidth="2"/>
            {/* スマホ */}
            <rect x="34" y="78" width="14" height="22" rx="2" fill="#333" opacity="0.7"/>
            <rect x="36" y="80" width="10" height="16" rx="1" fill="#74b3ce" opacity="0.5"/>
            {/* 距離 */}
            <line x1="46" y1="148" x2="170" y2="148" stroke="#74b3ce" strokeWidth="1" strokeDasharray="4,3"/>
            <text x="108" y="158" fill="#74b3ce" fontSize="9" textAnchor="middle">距離 d</text>
          </svg>
          <p style={{ fontSize:15, color:"#1a3a2a", textAlign:"center", margin:"10px 0 0", lineHeight:2, fontWeight:"bold" }}>
            カメラ画面の梢 → 根元を順にタップ<br/>
            <span style={{ fontSize:13, color:"#2d6a4f", fontWeight:"normal" }}>画面上の高さと距離から樹高を計算</span>
          </p>
        </div>
        <div style={{ background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
          <p style={{ fontSize:12, color:"#2d6a4f", margin:0, lineHeight:1.7 }}>
            💡 木全体がカメラに収まる距離まで離れてから<br/>梢・根元の順にタップしてください
          </p>
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
        <HeightTapView videoRef={videoRef} cameraOn={cameraOn} startAll={startAll} sensorOn={sensorOn}
          top={top} bot={bot}
          onLockTop={v => setTop(v)} onLockBot={v => setBot(v)}
          onRedo={() => { setTop(null); setBot(null); }} />
        <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
          📐　樹高を計算する {!canCalc&&(top===null?"（梢をタップ）":bot===null?"（根元をタップ）":"（距離を入力）")}
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
          {[["水平距離",`${result.d} m`],["梢の仰角",`+${result.topAngle}°`],["根元の俯角",`${result.botAngle}°`],["角度差",`${(result.topAngle - result.botAngle).toFixed(1)}°`],["目の高さ",`${result.e} m`]].map(([l,v],i,a)=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", paddingBottom:i<a.length-1?7:0, marginBottom:i<a.length-1?7:0, borderBottom:i<a.length-1?"1px solid rgba(126,203,161,0.1)":"none" }}>
              <span style={{ fontSize:11, color:"#5a9070" }}>{l}</span><span style={{ fontSize:13, color:"#1a3a2a" }}>{v}</span>
            </div>
          ))}
        </div>
        {pendingTreeId
          ? <>
              <button style={{ ...PRI, background:"#1a3a2a", borderColor:GRN, color:GRN }} onClick={() => onSaveTree(null, pendingTreeId, { height: result.height+"" })}>
                💾　{pendingTreeName||"この木"}に保存する
              </button>
              {onSaveAndMeasureSpread && <button style={{ ...PRI, background:"#2a4a1a", borderColor:"#a8d5b5", color:"#a8d5b5" }} onClick={() => onSaveAndMeasureSpread(result.d+"", result.height+"")}>
                🌿　続けて枝張りを測定する
              </button>}
            </>
          : <button style={{ ...PRI, background:"#2a4a1a", borderColor:GRN, color:GRN }} onClick={() => setShowSave(true)}>💾　アルバムに保存する</button>
        }
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
function SpreadApp({ prof, trees, onSaveTree, onBack, pendingTreeId, pendingTreeName, initialDist }) {
  const [pg, setPg] = useState(0);
  const [dist, setDist] = useState(""); const [bodyH, setBodyH] = useState(prof.bodyH||"");
  const [walkCount, setWalkCount] = useState(""); const [stride, setStride] = useState(prof.stride||null);
  const [distMode, setDistMode] = useState(1);
  const [left, setLeft] = useState(null); const [right, setRight] = useState(null);
  const [result, setResult] = useState(null); const [showSave, setShowSave] = useState(false);
  const dummyOrient = useCallback(() => {}, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(dummyOrient);
  const canCalc = left!==null&&right!==null&&!!dist;
  // initialDist があれば距離入力をスキップしてpg=2から開始
  useEffect(() => { if (initialDist) { setDist(initialDist); setPg(2); } }, [initialDist]);
  const doCalc = () => {
    if (!canCalc) return; stopCamera();
    // タップ方式：画面上のX座標比率から角度を計算（FOV 60°）
    const FOV = 60;
    const leftAngle = (left - 0.5) * FOV;
    const rightAngle = (right - 0.5) * FOV;
    const lRad = Math.abs(leftAngle) * Math.PI / 180;
    const rRad = Math.abs(rightAngle) * Math.PI / 180;
    const s = +(parseFloat(dist) * (Math.tan(lRad) + Math.tan(rRad))).toFixed(1);
    setResult({ spread:s, radius:+(s/2).toFixed(1), area:+(Math.PI*(s/2)*(s/2)).toFixed(1), d:parseFloat(dist), leftPct:left, rightPct:right });
    setPg(3);
  };
  const reset = () => { stopCamera(); setPg(0); setDist(""); setWalkCount(""); setLeft(null); setRight(null); setResult(null); setShowSave(false); };

  return (
    <div>
      {pg>0&&pg<3&&<div style={{ display:"flex", gap:4, margin:"14px 0" }}>{["① 距離入力","② 角度測定","③ 結果"].map((l,i)=><div key={i} style={{ flex:1, textAlign:"center" }}><div style={{ height:3, borderRadius:2, background:i<pg?"#2d6a4f":"rgba(45,106,79,0.2)", marginBottom:4 }}/><span style={{ fontSize:10, color:i<pg?"#1b4332":"#74a98a" }}>{l}</span></div>)}</div>}
      {pg===0&&<div style={{ marginTop:12 }}>
        <div style={CARD}><p style={{ fontSize:12, color:"#2d6a4f", textAlign:"center", marginBottom:10 }}>画面タップ方式（枝の左端・右端）</p>
          <svg viewBox="0 0 280 160" style={{ width:"100%", height:"auto", display:"block" }}>
            {/* 地面 */}
            <line x1="20" y1="135" x2="260" y2="135" stroke="#4a9070" strokeWidth="1.5"/>
            {/* 幹 */}
            <line x1="150" y1="135" x2="150" y2="75" stroke={GRN} strokeWidth="3"/>
            {/* 樹冠 */}
            <ellipse cx="150" cy="62" rx="72" ry="30" fill="#2d6a4f" opacity="0.45" stroke={GRN} strokeWidth="1"/>
            {/* 枝左端タップ */}
            <circle cx="78" cy="62" r="9" fill={BLUE} opacity="0.9"/>
            <text x="78" y="66" fill="#fff" fontSize="9" textAnchor="middle">👆</text>
            <text x="64" y="50" fill={BLUE} fontSize="9">左端</text>
            {/* 枝右端タップ */}
            <circle cx="222" cy="62" r="9" fill={GOLD} opacity="0.9"/>
            <text x="222" y="66" fill="#fff" fontSize="9" textAnchor="middle">👆</text>
            <text x="208" y="50" fill={GOLD} fontSize="9">右端</text>
            {/* 枝張りライン */}
            <line x1="78" y1="100" x2="222" y2="100" stroke="#a8d5b5" strokeWidth="1.5" strokeDasharray="3,2"/>
            <text x="150" y="115" fill="#a8d5b5" fontSize="9" textAnchor="middle">枝張り</text>
            {/* 人 */}
            <circle cx="40" cy="108" r="8" fill={GRN} opacity="0.85"/>
            <line x1="40" y1="116" x2="40" y2="135" stroke={GRN} strokeWidth="2"/>
            {/* スマホ */}
            <rect x="28" y="80" width="14" height="22" rx="2" fill="#333" opacity="0.7"/>
            <rect x="30" y="82" width="10" height="16" rx="1" fill="#74b3ce" opacity="0.5"/>
            {/* 距離 */}
            <line x1="40" y1="148" x2="150" y2="148" stroke="#74b3ce" strokeWidth="1" strokeDasharray="4,3"/>
            <text x="95" y="158" fill="#74b3ce" fontSize="9" textAnchor="middle">距離 d</text>
          </svg>
          <p style={{ fontSize:15, color:"#1a3a2a", textAlign:"center", margin:"10px 0 0", lineHeight:2, fontWeight:"bold" }}>
            カメラ画面の枝左端 → 右端を順にタップ<br/>
            <span style={{ fontSize:13, color:"#2d6a4f", fontWeight:"normal" }}>画面上の幅と距離から枝張りを計算</span>
          </p>
        </div>
        <div style={{ background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
          <p style={{ fontSize:12, color:"#2d6a4f", margin:0, lineHeight:1.7 }}>
            💡 枝の広がりが画面に収まる距離まで離れてから<br/>左端・右端の順にタップしてください
          </p>
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
        <TrunkTapView videoRef={videoRef} cameraOn={cameraOn} startAll={startAll} sensorOn={sensorOn}
          left={left} right={right}
          onLockLeft={v => setLeft(v)} onLockRight={v => setRight(v)}
          onRedo={() => { setLeft(null); setRight(null); }}
          labelLeft="枝の左端" labelRight="枝の右端" />
        <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
          🌿　枝張りを計算する {!canCalc&&(left===null?"（左端をタップ）":right===null?"（右端をタップ）":"（距離を入力）")}
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
          {[["水平距離",`${result.d} m`],["枝張り",`${result.spread} m`],["片側半径",`${result.radius} m`],["樹冠面積",`${result.area} m²`]].map(([l,v],i,a)=>(
            <div key={l} style={{ display:"flex", justifyContent:"space-between", paddingBottom:i<a.length-1?7:0, marginBottom:i<a.length-1?7:0, borderBottom:i<a.length-1?"1px solid rgba(126,203,161,0.1)":"none" }}>
              <span style={{ fontSize:11, color:"#5a9070" }}>{l}</span><span style={{ fontSize:13, color:"#1a3a2a" }}>{v}</span>
            </div>
          ))}
        </div>
        {pendingTreeId
          ? <button style={{ ...PRI, background:"#1a3a2a", borderColor:GRN, color:GRN }} onClick={() => onSaveTree(null, pendingTreeId, { spread: result.spread+"" })}>
              💾　{pendingTreeName||"この木"}に保存する
            </button>
          : <button style={{ ...PRI, background:"#2a4a1a", borderColor:GRN, color:GRN }} onClick={() => setShowSave(true)}>💾　アルバムに保存する</button>
        }
        <button style={PRI} onClick={reset}>🌿　もう一度測定する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
        {showSave && <SaveModal measurement={{ spread: result.spread+"" }} trees={trees} onSave={(nt,eid) => { onSaveTree(nt,eid,{ spread: result.spread+"" }); setShowSave(false); }} onSkip={() => setShowSave(false)} />}
      </div>}
    </div>
  );
}



// ================================================================
// HEIGHT TAP VIEW（樹高：画面タップ方式・縦）
// ================================================================
function HeightTapView({ videoRef, cameraOn, startAll, sensorOn, top, bot, onLockTop, onLockBot, onRedo }) {
  const containerRef = useRef(null);
  const draggingRef = useRef(null); // "top" | "bot" | null

  const getY = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return Math.max(0, Math.min(1, +((clientY - rect.top) / rect.height).toFixed(3)));
  };

  const onTouchStart = (e) => {
    if (!cameraOn) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientY = e.touches[0].clientY;
    const yPx = clientY - rect.top;
    const SNAP = 28;
    const topPx = top !== null ? top * rect.height : null;
    const botPx = bot !== null ? bot * rect.height : null;
    if (topPx !== null && Math.abs(yPx - topPx) < SNAP) { draggingRef.current = "top"; return; }
    if (botPx !== null && Math.abs(yPx - botPx) < SNAP) { draggingRef.current = "bot"; return; }
    draggingRef.current = null;
  };

  const onTouchMove = (e) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const ratio = getY(e);
    if (draggingRef.current === "top") onLockTop(ratio);
    if (draggingRef.current === "bot") onLockBot(ratio);
  };

  const onTouchEnd = (e) => {
    if (draggingRef.current) { draggingRef.current = null; return; }
    if (!cameraOn) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientY = e.changedTouches[0].clientY;
    const ratio = Math.max(0, Math.min(1, +((clientY - rect.top) / rect.height).toFixed(3)));
    if (top === null) onLockTop(ratio);
    else if (bot === null) onLockBot(ratio);
  };

  const onMouseDown = (e) => {
    if (!cameraOn) return;
    const rect = containerRef.current.getBoundingClientRect();
    const yPx = e.clientY - rect.top;
    const SNAP = 28;
    const tPx = top !== null ? top * rect.height : null;
    const bPx = bot !== null ? bot * rect.height : null;
    if (tPx !== null && Math.abs(yPx - tPx) < SNAP) { draggingRef.current = "top"; return; }
    if (bPx !== null && Math.abs(yPx - bPx) < SNAP) { draggingRef.current = "bot"; return; }
    const ratio = Math.max(0, Math.min(1, +((yPx) / rect.height).toFixed(3)));
    if (top === null) onLockTop(ratio);
    else if (bot === null) onLockBot(ratio);
  };
  const onMouseMove = (e) => {
    if (!draggingRef.current) return;
    const ratio = getY(e);
    if (draggingRef.current === "top") onLockTop(ratio);
    if (draggingRef.current === "bot") onLockBot(ratio);
  };
  const onMouseUp = () => { draggingRef.current = null; };

  const H = containerRef.current ? containerRef.current.clientHeight : 0;
  const topPx = top !== null ? top * H : null;
  const botPx = bot !== null ? bot * H : null;
  const isDraggingTop = draggingRef.current === "top";
  const isDraggingBot = draggingRef.current === "bot";

  return (
    <div>
      <div ref={containerRef}
        style={{ position:"relative", borderRadius:16, overflow:"hidden", marginBottom:12, background:"#000", aspectRatio:"3/4", touchAction:"none" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:cameraOn?"block":"none" }} />
        {!cameraOn && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#f0f7f0" }}>
          <p style={{ color:"#5a8c6a", fontSize:13, textAlign:"center" }}>📷<br/>カメラ起動後に映像が表示されます</p>
        </div>}
        {cameraOn && <>
          {/* 中央の横ガイドライン */}
          <div style={{ position:"absolute", top:"50%", left:"5%", right:"5%", height:1, background:"rgba(45,106,79,0.3)", transform:"translateY(-50%)", pointerEvents:"none" }} />
          {/* 十字線 */}
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:44, height:44, pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:"50%", left:0, right:0, height:2, background:"#2d6a4f", opacity:0.7, transform:"translateY(-50%)" }} />
            <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:2, background:"#2d6a4f", opacity:0.7, transform:"translateX(-50%)" }} />
          </div>
          {/* 梢ライン（横・GOLD） */}
          {topPx !== null && <div style={{ position:"absolute", top:topPx, left:0, right:0, height:isDraggingTop?5:3, background:GOLD, opacity:isDraggingTop?1:0.95, transform:"translateY(-50%)", pointerEvents:"none", boxShadow:`0 0 ${isDraggingTop?18:10}px ${GOLD}`, transition:"height 0.1s" }}>
            <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", width:28, height:28, borderRadius:"50%", background:GOLD, border:"3px solid #fff", boxShadow:"0 2px 8px rgba(0,0,0,0.4)" }} />
            <span style={{ position:"absolute", right:10, top:6, fontSize:11, color:GRN, background:"rgba(0,0,0,0.75)", padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap", fontWeight:"bold" }}>✅ 梢</span>
          </div>}
          {/* 根元ライン（横・BLUE） */}
          {botPx !== null && <div style={{ position:"absolute", top:botPx, left:0, right:0, height:isDraggingBot?5:3, background:BLUE, opacity:isDraggingBot?1:0.95, transform:"translateY(-50%)", pointerEvents:"none", boxShadow:`0 0 ${isDraggingBot?18:10}px ${BLUE}`, transition:"height 0.1s" }}>
            <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", width:28, height:28, borderRadius:"50%", background:BLUE, border:"3px solid #fff", boxShadow:"0 2px 8px rgba(0,0,0,0.4)" }} />
            <span style={{ position:"absolute", right:10, bottom:6, fontSize:11, color:BLUE, background:"rgba(0,0,0,0.75)", padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap", fontWeight:"bold" }}>✅ 根元</span>
          </div>}
          {/* 2本ロック時：高さを示す帯 */}
          {topPx !== null && botPx !== null && <div style={{ position:"absolute", left:0, right:0, top:Math.min(topPx, botPx), height:Math.abs(botPx-topPx), background:"rgba(126,203,161,0.12)", pointerEvents:"none" }} />}
          {/* 指示テキスト */}
          <div style={{ position:"absolute", bottom:10, left:0, right:0, textAlign:"center", pointerEvents:"none" }}>
            <span style={{ fontSize:15, color:"#fff", background:"rgba(0,0,0,0.65)", padding:"8px 18px", borderRadius:20, fontFamily:"inherit", fontWeight:"bold" }}>
              {top===null ? "👆 梢（てっぺん）をタップ" : bot===null ? "👆 根元（地面）をタップ" : "↕ ドラッグで微調整できます"}
            </span>
          </div>
          {/* ロック状態 */}
          <div style={{ position:"absolute", top:10, left:10, display:"flex", flexDirection:"column", gap:4 }}>
            <div style={{ background:top!==null?`${GOLD}cc`:"rgba(0,0,0,0.55)", borderRadius:6, padding:"3px 8px", fontSize:11, color:top!==null?"#000":"#aaa" }}>{top!==null?"✅ 梢ロック済":"① 梢をタップ"}</div>
            <div style={{ background:bot!==null?`${BLUE}cc`:"rgba(0,0,0,0.55)", borderRadius:6, padding:"3px 8px", fontSize:11, color:bot!==null?"#fff":"#aaa" }}>{bot!==null?"✅ 根元ロック済":"② 根元をタップ"}</div>
          </div>
        </>}
      </div>
      <div style={CARD}>
        {!sensorOn
          ? <button style={PRI} onClick={startAll}>📷　カメラを起動する</button>
          : top !== null && <button onClick={onRedo} style={{ ...GHO, marginBottom:0 }}>🔄 やり直す</button>
        }
      </div>
    </div>
  );
}

// ================================================================
// TRUNK APP（幹周り測定）
// ================================================================

// ================================================================
// TRUNK TAP VIEW（幹周り：画面タップ方式）
// ================================================================
function TrunkTapView({ videoRef, cameraOn, startAll, sensorOn, left, right, onLockLeft, onLockRight, onRedo, labelLeft, labelRight }) {
  const containerRef = useRef(null);
  const draggingRef = useRef(null); // "left" | "right" | null

  const getX = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return Math.max(0, Math.min(1, +((clientX - rect.left) / rect.width).toFixed(3)));
  };

  // タップ開始：バーの近く（±20px）ならドラッグ、そうでなければ新規ロック
  const onTouchStart = (e) => {
    if (!cameraOn) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.touches[0].clientX;
    const xPx = clientX - rect.left;
    const SNAP = 24; // px
    const leftPx = left !== null ? left * rect.width : null;
    const rightPx = right !== null ? right * rect.width : null;
    if (leftPx !== null && Math.abs(xPx - leftPx) < SNAP) {
      draggingRef.current = "left"; return;
    }
    if (rightPx !== null && Math.abs(xPx - rightPx) < SNAP) {
      draggingRef.current = "right"; return;
    }
    draggingRef.current = null;
  };

  const onTouchMove = (e) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const ratio = getX(e);
    if (draggingRef.current === "left") onLockLeft(ratio);
    if (draggingRef.current === "right") onLockRight(ratio);
  };

  const onTouchEnd = (e) => {
    if (draggingRef.current) { draggingRef.current = null; return; }
    if (!cameraOn) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.changedTouches[0].clientX;
    const ratio = Math.max(0, Math.min(1, +((clientX - rect.left) / rect.width).toFixed(3)));
    if (left === null) onLockLeft(ratio);
    else if (right === null) onLockRight(ratio);
  };

  // PCマウス対応
  const onMouseDown = (e) => {
    if (!cameraOn) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const SNAP = 24;
    const lPx = left !== null ? left * rect.width : null;
    const rPx = right !== null ? right * rect.width : null;
    if (lPx !== null && Math.abs(xPx - lPx) < SNAP) { draggingRef.current = "left"; return; }
    if (rPx !== null && Math.abs(xPx - rPx) < SNAP) { draggingRef.current = "right"; return; }
    const ratio = Math.max(0, Math.min(1, +((xPx) / rect.width).toFixed(3)));
    if (left === null) onLockLeft(ratio);
    else if (right === null) onLockRight(ratio);
  };
  const onMouseMove = (e) => {
    if (!draggingRef.current) return;
    const ratio = getX(e);
    if (draggingRef.current === "left") onLockLeft(ratio);
    if (draggingRef.current === "right") onLockRight(ratio);
  };
  const onMouseUp = () => { draggingRef.current = null; };

  const W = containerRef.current ? containerRef.current.clientWidth : 0;
  const leftPx = left !== null ? left * W : null;
  const rightPx = right !== null ? right * W : null;
  const isDraggingLeft = draggingRef.current === "left";
  const isDraggingRight = draggingRef.current === "right";

  return (
    <div>
      <div ref={containerRef}
        style={{ position:"relative", borderRadius:16, overflow:"hidden", marginBottom:12, background:"#000", aspectRatio:"3/4", touchAction:"none" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", display:cameraOn?"block":"none" }} />
        {!cameraOn && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#f0f7f0" }}>
          <p style={{ color:"#5a8c6a", fontSize:13, textAlign:"center" }}>📷<br/>カメラ起動後に映像が表示されます</p>
        </div>}
        {cameraOn && <>
          {/* 中央ガイドライン */}
          <div style={{ position:"absolute", left:"50%", top:"5%", bottom:"5%", width:1, background:"rgba(45,106,79,0.3)", transform:"translateX(-50%)", pointerEvents:"none" }} />
          {/* 左端ライン（ドラッグハンドル付き） */}
          {leftPx !== null && <div style={{ position:"absolute", left:leftPx, top:0, bottom:0, width:isDraggingLeft?6:4, background:BLUE, opacity:isDraggingLeft?1:0.95, transform:"translateX(-50%)", pointerEvents:"none", boxShadow:`0 0 ${isDraggingLeft?20:12}px ${BLUE}`, transition:"width 0.1s, box-shadow 0.1s" }}>
            {/* ドラッグハンドル */}
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:28, height:28, borderRadius:"50%", background:BLUE, border:"3px solid #fff", boxShadow:`0 2px 8px rgba(0,0,0,0.4)` }} />
            <span style={{ position:"absolute", top:8, left:10, fontSize:11, color:BLUE, background:"rgba(0,0,0,0.75)", padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap", fontWeight:"bold" }}>← 左端 →</span>
          </div>}
          {/* 右端ライン（ドラッグハンドル付き） */}
          {rightPx !== null && <div style={{ position:"absolute", left:rightPx, top:0, bottom:0, width:isDraggingRight?6:4, background:GOLD, opacity:isDraggingRight?1:0.95, transform:"translateX(-50%)", pointerEvents:"none", boxShadow:`0 0 ${isDraggingRight?20:12}px ${GOLD}`, transition:"width 0.1s, box-shadow 0.1s" }}>
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:28, height:28, borderRadius:"50%", background:GOLD, border:"3px solid #fff", boxShadow:`0 2px 8px rgba(0,0,0,0.4)` }} />
            <span style={{ position:"absolute", top:36, left:10, fontSize:11, color:GRN, background:"rgba(0,0,0,0.75)", padding:"2px 8px", borderRadius:4, whiteSpace:"nowrap", fontWeight:"bold" }}>← 右端 →</span>
          </div>}
          {/* 帯 */}
          {leftPx !== null && rightPx !== null && <div style={{ position:"absolute", top:0, bottom:0, left:Math.min(leftPx, rightPx), width:Math.abs(rightPx-leftPx), background:"rgba(126,203,161,0.15)", pointerEvents:"none" }} />}
          {/* 指示テキスト */}
          <div style={{ position:"absolute", bottom:10, left:0, right:0, textAlign:"center", pointerEvents:"none" }}>
            <span style={{ fontSize:15, color:"#fff", background:"rgba(0,0,0,0.65)", padding:"8px 18px", borderRadius:20, fontFamily:"inherit", fontWeight:"bold" }}>
              {left===null ? `👆 ${labelLeft||"左端"}をタップ` : right===null ? `👆 ${labelRight||"右端"}をタップ` : "↔ ドラッグで微調整できます"}
            </span>
          </div>
          {/* ロック状態 */}
          <div style={{ position:"absolute", top:10, left:10, display:"flex", flexDirection:"column", gap:4 }}>
            <div style={{ background:left!==null?"rgba(116,179,206,0.85)":"rgba(0,0,0,0.55)", borderRadius:6, padding:"3px 8px", fontSize:11, color:left!==null?"#fff":"#aaa" }}>{left!==null?`✅ ${labelLeft||"左端"}ロック済`:`① ${labelLeft||"左端"}をタップ`}</div>
            <div style={{ background:right!==null?"rgba(255,209,102,0.85)":"rgba(0,0,0,0.55)", borderRadius:6, padding:"3px 8px", fontSize:11, color:right!==null?"#000":"#aaa" }}>{right!==null?`✅ ${labelRight||"右端"}ロック済`:`② ${labelRight||"右端"}をタップ`}</div>
          </div>
        </>}
      </div>
      <div style={CARD}>
        {!sensorOn
          ? <button style={PRI} onClick={startAll}>📷　カメラを起動する</button>
          : left !== null && <button onClick={onRedo} style={{ ...GHO, marginBottom:0 }}>🔄 やり直す</button>
        }
      </div>
    </div>
  );
}

function TrunkApp({ prof, trees, onSaveTree, onBack, pendingTreeId, pendingTreeName }) {
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
  const doCalc = () => {
    if (!canCalc) return; stopCamera();
    // left/right は画面上のX座標比率（0〜1）
    // カメラの水平視野角 約60度を想定
    const FOV = 60;
    const leftAngle = (left - 0.5) * FOV;
    const rightAngle = (right - 0.5) * FOV;
    const lRad = Math.abs(leftAngle) * Math.PI / 180;
    const rRad = Math.abs(rightAngle) * Math.PI / 180;
    const d = parseFloat(dist);
    const diamM = +(d * (Math.tan(lRad) + Math.tan(rRad))).toFixed(3);
    const diamCm = +(diamM * 100).toFixed(1);
    const circCm = +(diamCm * Math.PI).toFixed(1);
    setResult({ diam: diamCm, circ: circCm, d, leftPct: left, rightPct: right, leftAngle: +leftAngle.toFixed(1), rightAngle: +rightAngle.toFixed(1) });
    setPg(3);
  };
  const reset = () => { stopCamera(); setPg(0); setDist(""); setWalkCount(""); setLiveGamma(null); setLeft(null); setRight(null); setResult(null); setShowSave(false); };

  return (
    <div>
      {pg>0&&pg<3&&<div style={{ display:"flex", gap:4, margin:"14px 0" }}>{["① 距離入力","② 角度測定","③ 結果"].map((l,i)=><div key={i} style={{ flex:1, textAlign:"center" }}><div style={{ height:3, borderRadius:2, background:i<pg?"#2d6a4f":"rgba(45,106,79,0.2)", marginBottom:4 }}/><span style={{ fontSize:10, color:i<pg?"#1b4332":"#74a98a" }}>{l}</span></div>)}</div>}
      {pg===0&&<div style={{ marginTop:12 }}>
        <div style={CARD}><p style={{ fontSize:12, color:"#2d6a4f", textAlign:"center", marginBottom:10 }}>画面タップ方式（幹の左端・右端）</p>
          <svg viewBox="0 0 280 160" style={{ width:"100%", height:"auto", display:"block" }}>
            {/* 地面 */}
            <line x1="20" y1="130" x2="260" y2="130" stroke="#4a9070" strokeWidth="1.5"/>
            {/* 幹 */}
            <rect x="120" y="35" width="40" height="95" rx="6" fill="#5d4037" opacity="0.85"/>
            {/* 幹左端タップ */}
            <circle cx="120" cy="80" r="8" fill={BLUE} opacity="0.9"/>
            <text x="120" y="84" fill="#fff" fontSize="9" textAnchor="middle">👆</text>
            {/* 幹右端タップ */}
            <circle cx="160" cy="80" r="8" fill={GOLD} opacity="0.9"/>
            <text x="160" y="84" fill="#fff" fontSize="9" textAnchor="middle">👆</text>
            {/* 人 */}
            <circle cx="46" cy="100" r="8" fill={GRN} opacity="0.85"/>
            <line x1="46" y1="108" x2="46" y2="130" stroke={GRN} strokeWidth="2"/>
            {/* スマホ */}
            <rect x="34" y="72" width="14" height="22" rx="2" fill="#333" opacity="0.7"/>
            <rect x="36" y="74" width="10" height="16" rx="1" fill="#74b3ce" opacity="0.5"/>
            {/* 距離 */}
            <line x1="46" y1="144" x2="140" y2="144" stroke="#74b3ce" strokeWidth="1" strokeDasharray="4,3"/>
            <text x="93" y="155" fill="#74b3ce" fontSize="9" textAnchor="middle">距離 d</text>
            {/* 直径 */}
            <line x1="120" y1="26" x2="160" y2="26" stroke="#a8d5b5" strokeWidth="1.5"/>
            <text x="140" y="20" fill="#a8d5b5" fontSize="9" textAnchor="middle">直径</text>
            {/* ラベル */}
            <text x="108" y="70" fill={BLUE} fontSize="9" textAnchor="middle">左端</text>
            <text x="172" y="70" fill={GOLD} fontSize="9" textAnchor="middle">右端</text>
          </svg>
          <p style={{ fontSize:15, color:"#1a3a2a", textAlign:"center", margin:"10px 0 0", lineHeight:2, fontWeight:"bold" }}>
            カメラ画面の幹左端 → 右端を順にタップ<br/>
            <span style={{ fontSize:13, color:"#2d6a4f", fontWeight:"normal" }}>画面上の幅と距離から直径 → 幹周り（×π）を計算</span>
          </p>
        </div>
        <div style={{ background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
          <p style={{ fontSize:12, color:"#2d6a4f", margin:0, lineHeight:1.7 }}>
            💡 木から <strong>2〜5m</strong> 離れ、幹が画面に大きく映る状態でタップすると精度が上がります
          </p>
        </div>
        <button style={PRI} onClick={() => setPg(1)}>🌲　測定を開始する</button>
        <button style={GHO} onClick={onBack}>← メニューに戻る</button>
      </div>}
      {pg===1&&<div>
        <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH="" setEyeH={() => {}} dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode} stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH={false} />
        <div style={{ background:"rgba(45,106,79,0.08)", border:"1.5px solid rgba(45,106,79,0.25)", borderRadius:10, padding:"10px 14px", marginBottom:10 }}>
          <p style={{ fontSize:12, color:GRN, margin:0 }}>💡 幹周り測定は距離 <strong>2〜5m</strong> がおすすめです</p>
        </div>
        <button style={PRI} onClick={() => setPg(2)}>次へ → 角度を測定する</button>
        <button style={GHO} onClick={() => setPg(0)}>← 戻る</button>
      </div>}
      {pg===2&&<div>
        {/* タップ方式：カメラ映像上で幹の左端・右端を直接タップ */}
        <TrunkTapView videoRef={videoRef} cameraOn={cameraOn} startAll={startAll} sensorOn={sensorOn}
          left={left} right={right}
          onLockLeft={v => setLeft(v)} onLockRight={v => setRight(v)}
          onRedo={() => { setLeft(null); setRight(null); }} />
        <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
          🌲　幹周りを計算する {!canCalc&&(left===null?"（左端をタップ）":right===null?"（右端をタップ）":"（距離を入力）")}
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
        <div style={{ background:"rgba(45,106,79,0.06)", border:"1px solid rgba(255,193,7,0.2)", borderRadius:12, padding:"10px 14px", marginBottom:12 }}>
          <p style={{ fontSize:11, color:"#2d6a4f", margin:0, lineHeight:1.7 }}>⚠️ 地上1.3mの高さで測定すると標準的な幹周りになります。</p>
        </div>
        {pendingTreeId
          ? <button style={{ ...PRI, background:"#1a3a2a", borderColor:GRN, color:GRN }} onClick={() => onSaveTree(null, pendingTreeId, { trunk: result.circ+"" })}>
              💾　{pendingTreeName||"この木"}に保存する
            </button>
          : <button style={{ ...PRI, background:"#2a4a1a", borderColor:GRN, color:GRN }} onClick={() => setShowSave(true)}>💾　アルバムに保存する</button>
        }
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
// 新規登録ウィザード
// ================================================================
function RegisterWizard({ prof, trees, onComplete, onBack }) {
  // 新しい順番：幹周り(+GPS) → 写真 → 樹高 → 枝張り → 基本情報 → 確認
  const STEPS = ["📍 GPS取得", "🌲 幹周り", "📷 写真", "📐 樹高", "🌿 枝張り", "📝 基本情報", "✅ 確認"];
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [height, setHeight] = useState(null);
  const [spread, setSpread] = useState(null);
  const [trunk, setTrunk] = useState(null);
  const [age, setAge] = useState(null);
  const [ageAuto, setAgeAuto] = useState(false);
  const [measDist, setMeasDist] = useState(""); // 樹高→枝張り距離引き継ぎ
  const [trunkSteps, setTrunkSteps] = useState(""); // 幹周り測定までの歩数

  // 下書き自動保存
  const DRAFT_KEY = "wizard_draft";
  const saveDraft = (data) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() })); } catch {} };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch {} };

  // 起動時に下書きを復元
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d && Date.now() - d.savedAt < 24 * 3600000) { // 24時間以内
        if (window.confirm(`前回の入力途中のデータがあります。\n「${d.name || "名前未入力"}」\n\n復元しますか？`)) {
          if (d.name) setName(d.name);
          if (d.species) setSpecies(d.species);
          if (d.location) setLocation(d.location);
          if (d.note) setNote(d.note);
          if (d.step) setStep(d.step > 2 ? 2 : d.step); // 写真ステップから再開
        } else { clearDraft(); }
      }
    } catch {}
  }, []);
  const fileRef = useRef();

  const next = () => setStep(s => {
    const ns = Math.min(s + 1, STEPS.length - 1);
    saveDraft({ name, species, location, note, step: ns });
    return ns;
  });
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const onPhoto = async e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async ev => { const res = await resizePhoto(ev.target.result, 800); setPhoto(res); next(); };
    r.readAsDataURL(f);
  };

  const getGPSNow = async () => {
    setGpsLoading(true);
    try { const g = await getGPS(); setGps(g); } catch(e) { alert("GPS取得失敗: " + e); }
    setGpsLoading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { alert("木の名前を入力してください"); setStep(5); return; }
    const t = {
      id: newId(), name: name.trim(), species, location, note, photo, gps,
      measurements: { height: height||"", spread: spread||"", trunk: trunk||"", age: age||"" },
      createdAt: today(), updatedAt: today()
    };
    clearDraft();
    onComplete(t);
  };

  const stepBar = (
    <div style={{ display:"flex", gap:2, marginBottom:16 }}>
      {STEPS.map((l, i) => (
        <div key={i} style={{ flex:1, textAlign:"center" }}>
          <div style={{ height:3, borderRadius:2, background: i <= step ? "#2d6a4f" : "rgba(45,106,79,0.2)", marginBottom:3 }} />
          <span style={{ fontSize:9, color: i <= step ? "#2d6a4f" : "#74a98a", display:"block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l}</span>
        </div>
      ))}
    </div>
  );

  const hdr = (title, hint) => (
    <div style={{ paddingTop:8, marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: hint ? 6 : 0 }}>
        <button onClick={step===0?onBack:prev} style={{ background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.3)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ 戻る</button>
        <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>{title}</h2>
      </div>
      {hint && <div style={{ background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.2)", borderRadius:8, padding:"7px 12px", marginLeft:32 }}>
        <p style={{ fontSize:12, color:"#2d6a4f", margin:0 }}>{hint}</p>
      </div>}
    </div>
  );

  // STEP 0: GPS取得
  if (step === 0) return (
    <div>
      {hdr("位置情報を取得", null)}
      {stepBar}
      <div style={{ ...CARD, textAlign:"center", padding:"28px 20px" }}>
        <p style={{ fontSize:48, margin:"0 0 12px" }}>📍</p>
        <p style={{ fontSize:17, color:"#1a3a2a", fontWeight:"bold", margin:"0 0 8px" }}>まず木の横に立ってください</p>
        <p style={{ fontSize:14, color:"#2d6a4f", margin:"0 0 20px", lineHeight:1.7 }}>
          ここで取得した位置情報が<br/>地図に表示されます
        </p>
        <button onClick={getGPSNow} style={{ ...PRI, marginBottom:0 }}>
          {gpsLoading ? "📍 取得中…" : gps ? "✅ GPS取得済（再取得）" : "📍 現在地を取得する"}
        </button>
        {gps && <div style={{ background:"rgba(45,106,79,0.08)", borderRadius:10, padding:"10px 14px", marginTop:12 }}>
          <p style={{ fontSize:13, color:"#2d6a4f", margin:0 }}>✅ {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
        </div>}
      </div>
      <button style={PRI} onClick={next}>{gps ? "次へ → 幹周りを測定する" : "次へ（スキップ）"}</button>
      <button style={GHO} onClick={onBack}>← 戻る</button>
    </div>
  );

  // STEP 1: 幹周り
  if (step === 1) return (
    <div>
      {hdr("幹周りを測定", null)}
      {stepBar}
      <div style={{ ...CARD, background:"rgba(45,106,79,0.06)", border:"2px solid rgba(45,106,79,0.3)" }}>
        <p style={{ fontSize:17, color:"#1a3a2a", fontWeight:"bold", margin:"0 0 10px" }}>🌲 3〜5歩歩いてください</p>
        <p style={{ fontSize:15, color:"#2d6a4f", margin:0, lineHeight:1.8 }}>
          木の幹から3〜5歩離れた場所で<br/>幹周りを測定します<br/>
          <span style={{ fontSize:13, color:"#5a8c6a" }}>※ 幹周りから推定樹齢がわかります</span>
        </p>
      </div>
      <WizardMeasTrunk prof={prof} onMeasured={(circ, steps) => { setTrunk(circ); if(steps) setTrunkSteps(steps); next(); }} onSkip={next} />
    </div>
  );

  // STEP 2: 写真（15〜20歩離れて）
  if (step === 2) return (
    <div>
      {hdr("写真を撮影", null)}
      {stepBar}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={onPhoto} />

      {/* 幹周りと同スタイルの説明カード */}
      <div style={{ ...CARD, background:"rgba(45,106,79,0.06)", border:"2px solid rgba(45,106,79,0.3)" }}>
        <p style={{ fontSize:17, color:"#1a3a2a", fontWeight:"bold", margin:"0 0 10px" }}>📷 15〜20歩歩いてください</p>
        <p style={{ fontSize:15, color:"#2d6a4f", margin:"0 0 10px", lineHeight:1.8 }}>
          木全体がカメラに収まる距離まで<br/>離れて撮影します
        </p>
        {/* 歩数を覚えておくよう促す */}
        <div style={{ background:"rgba(45,106,79,0.1)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:10, padding:"10px 14px" }}>
          <p style={{ fontSize:15, color:"#1a3a2a", fontWeight:"bold", margin:"0 0 4px" }}>👣 歩いた歩数を覚えておいてください</p>
          <p style={{ fontSize:13, color:"#2d6a4f", margin:0 }}>次の樹高・枝張り測定時に距離の計算に使います</p>
        </div>
      </div>

      <div style={CARD}>
        {photo
          ? <div style={{ position:"relative", marginBottom:12 }}>
              <img src={photo} alt="" style={{ width:"100%", maxHeight:260, objectFit:"cover", borderRadius:10, display:"block" }} />
              <button onClick={() => fileRef.current.click()} style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.6)", border:"1px solid #fff", borderRadius:8, color:"#fff", fontSize:12, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>📷 撮り直す</button>
            </div>
          : <button onClick={() => fileRef.current.click()} style={{ width:"100%", padding:"36px 20px", background:"rgba(45,106,79,0.04)", border:"2px dashed rgba(45,106,79,0.3)", borderRadius:12, color:"#2d6a4f", fontSize:16, cursor:"pointer", fontFamily:"inherit", textAlign:"center", display:"block", fontWeight:"bold" }}>
              📷　写真を撮影 / ライブラリから選択
            </button>
        }
      </div>
      {photo && <button style={PRI} onClick={next}>次へ → 樹高を測定する</button>}
      <button style={GHO} onClick={next}>スキップ（写真なしで続ける）</button>
      <button style={GHO} onClick={prev}>← 戻る</button>
    </div>
  );

  // STEP 3: 樹高（同じ距離）
  if (step === 3) return (
    <div>
      {hdr("樹高を測定", "📐 同じ場所から木全体をタップして測定します")}
      {stepBar}
      <WizardMeasHeight prof={prof} trunkSteps={trunkSteps} onMeasured={(h, dist) => { setHeight(h); setMeasDist(dist); next(); }} onSkip={next} />
    </div>
  );

  // STEP 4: 枝張り（距離引き継ぎ）
  if (step === 4) return (
    <div>
      {hdr("枝張りを測定", "🌿 同じ場所から枝の左端・右端をタップします")}
      {stepBar}
      <WizardMeasSpread prof={prof} initialDist={measDist} onMeasured={s => { setSpread(s); next(); }} onSkip={next} />
    </div>
  );

  // STEP 5: 基本情報（落ち着いて入力）
  if (step === 5) return (
    <div>
      {hdr("基本情報を入力", "📝 木の名前・樹種・場所などを入力します")}
      {stepBar}
      <div style={CARD}>
        <span style={LBL}>木の名前（必須）：</span>
        <input style={{ ...INP, marginBottom:12, fontSize:16 }} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例: 住吉公園のせんだん" />
        <span style={LBL}>樹種：</span>
        <select value={species} onChange={e => {
          const s = e.target.value; setSpecies(s);
          // 樹種が選ばれたタイミングで推定樹齢を計算
          if (s && trunk) { setAge(estimateAge(parseFloat(trunk), s)+""); setAgeAuto(true); }
        }} style={{ ...INP, marginBottom:12, fontSize:14, appearance:"none" }}>
          <option value="">選択してください</option>
          {TREE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {trunk && species && age && <div style={{ background:"rgba(168,213,181,0.15)", border:"1px solid rgba(168,213,181,0.3)", borderRadius:8, padding:"7px 12px", marginBottom:12 }}>
          <p style={{ fontSize:12, color:"#5a9070", margin:0 }}>🤖 推定樹齢：<strong style={{ color:"#a8d5b5" }}>{age}年</strong>（幹周り{trunk}cmから自動計算）</p>
        </div>}
        <span style={LBL}>場所・区画：</span>
        <input style={{ ...INP, marginBottom:12, fontSize:16 }} type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="例: 大阪府・住吉公園" />
        <span style={LBL}>メモ：</span>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="樹形の特徴、感想など..." style={{ ...INP, resize:"vertical", minHeight:64, fontSize:14 }} />
        {/* GPS確認 */}
        {gps
          ? <div style={{ background:"rgba(45,106,79,0.06)", borderRadius:8, padding:"7px 12px", marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:11, color:"#2d6a4f" }}>📍 GPS取得済：{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
              <button onClick={() => setGps(null)} style={{ fontSize:11, color:"#ff8080", background:"none", border:"none", cursor:"pointer" }}>✕</button>
            </div>
          : <button onClick={getGPSNow} style={{ marginTop:8, width:"100%", padding:"9px", background:"rgba(45,106,79,0.06)", border:"1px solid rgba(45,106,79,0.2)", borderRadius:8, color:"#2d6a4f", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              {gpsLoading ? "取得中…" : "📍 位置情報を追加する（任意）"}
            </button>
        }
      </div>
      <button style={PRI} onClick={() => { if (!name.trim()) { alert("木の名前を入力してください"); return; } next(); }}>次へ → 確認・保存</button>
      <button style={GHO} onClick={prev}>← 戻る</button>
    </div>
  );

  // STEP 6: 確認・保存（→写真フォルダに自動保存）
  return (
    <div>
      {hdr("確認・保存")}
      {stepBar}
      {photo && <div style={{ borderRadius:12, overflow:"hidden", marginBottom:12 }}>
        <img src={photo} alt={name} style={{ width:"100%", maxHeight:200, objectFit:"cover", display:"block" }} />
      </div>}
      <div style={CARD}>
        <p style={{ fontSize:16, fontWeight:"bold", color:"#1a3a2a", marginBottom:8 }}>{name}</p>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
          {species && <span style={{ fontSize:12, background:"rgba(45,106,79,0.1)", borderRadius:20, padding:"3px 10px", color:"#2d6a4f" }}>{species}</span>}
          {location && <span style={{ fontSize:12, background:"rgba(116,179,206,0.12)", borderRadius:20, padding:"3px 10px", color:BLUE }}>{location}</span>}
          {gps && <span style={{ fontSize:12, background:"rgba(45,106,79,0.06)", borderRadius:20, padding:"3px 10px", color:"#2d6a4f" }}>📍 GPS取得済</span>}
        </div>
        {note && <p style={{ fontSize:13, color:"#5a8c6a", margin:0 }}>{note}</p>}
      </div>
      <div style={CARD}>
        <p style={{ fontSize:13, color:"#2d6a4f", marginBottom:10 }}>測定値</p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[["樹高", height, "m", GRN], ["枝張り", spread, "m", GOLD], ["幹周り", trunk, "cm", BLUE], ["推定樹齢", age, "年", "#a8d5b5"]].map(([l,v,u,c]) => (
            <div key={l} style={{ flex:1, minWidth:68, background:"rgba(255,255,255,0.7)", borderRadius:10, padding:"8px 10px", textAlign:"center", border:"1px solid rgba(45,106,79,0.15)" }}>
              <p style={{ fontSize:10, color:"#5a8c6a", margin:"0 0 2px" }}>{l}</p>
              <p style={{ fontSize:20, fontWeight:"bold", color: v ? c : "#ccc", margin:0 }}>{v || "―"}</p>
              {v && <p style={{ fontSize:10, color:"#5a8c6a", margin:0 }}>{u}</p>}
            </div>
          ))}
        </div>
        {ageAuto && <p style={{ fontSize:11, color:GRN, margin:"8px 0 0" }}>🤖 推定樹齢は幹周りと樹種から自動計算</p>}
      </div>
      {photo && (trunk||height||spread) && <div style={{ background:"rgba(45,106,79,0.06)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
        <p style={{ fontSize:12, color:"#2d6a4f", margin:0 }}>📸 登録後に記録画像が写真フォルダに自動保存されます</p>
      </div>}
      <button style={{ ...PRI, background:"#1a3a2a", borderColor:GRN, color:GRN }} onClick={handleSave}>
        🌳　この木を登録する
      </button>
      <button style={GHO} onClick={prev}>← 戻って修正する</button>
    </div>
  );
}

// ── ウィザード用：樹高測定 ──
function WizardMeasHeight({ prof, trunkSteps, onMeasured, onSkip }) {
  // trunkSteps: 木の横→幹周り測定位置までの歩数
  const [top, setTop] = useState(null);
  const [bot, setBot] = useState(null);
  const [dist, setDist] = useState("");
  const [walkFromTrunk, setWalkFromTrunk] = useState(""); // 幹周り測定位置→撮影位置
  const [bodyH, setBodyH] = useState(prof.bodyH||"");
  const [stride, setStride] = useState(prof.stride||null);
  const [eyeH, setEyeH] = useState(prof.eyeH||"1.5");
  const [showCam, setShowCam] = useState(false);
  const dummyOrient = useCallback(() => {}, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(dummyOrient);
  const canCalc = top!==null&&bot!==null&&!!dist&&!!eyeH;

  // 歩幅を取得
  const s = stride || (bodyH ? +(parseFloat(bodyH)*0.37/100).toFixed(3) : null);

  // 木からの総距離を計算
  const totalSteps = (parseInt(trunkSteps)||0) + (parseInt(walkFromTrunk)||0);
  const totalDist = s && totalSteps ? +(totalSteps * s).toFixed(1) : null;

  // walkFromTrunk変更時に dist を自動更新
  const onWalkChange = (v) => {
    setWalkFromTrunk(v);
    const total = (parseInt(trunkSteps)||0) + (parseInt(v)||0);
    if (s && total) setDist(+(total * s).toFixed(1)+"");
  };

  const doCalc = () => {
    if (!canCalc) return;
    const d = parseFloat(dist), e = parseFloat(eyeH);
    const VFOV = fov?.vFov || 45;
    const topA = -(top - 0.5) * VFOV;
    const botA = -(bot - 0.5) * VFOV;
    const h = +(d * (Math.tan(topA*Math.PI/180) - Math.tan(botA*Math.PI/180)) + e).toFixed(1);
    stopCamera();
    onMeasured(Math.max(0.1, h)+"", dist);
  };

  if (!showCam) return (
    <>
      {/* 身長・歩幅設定 */}
      <div style={CARD}>
        <p style={{ fontSize:15, color:"#1a4a2a", marginBottom:12, fontWeight:"bold" }}>身長 <span style={{ fontSize:12, color:"#5a8c6a", fontWeight:"normal" }}>自動保存</span></p>
        <span style={LBL}>身長（cm）：</span>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          <input style={INP} type="number" value={bodyH} onChange={e => { setBodyH(e.target.value); const h=parseFloat(e.target.value); if(h>0){const s=+(h*0.37/100).toFixed(3);setStride(s);saveProfile({...loadProfile(),bodyH:e.target.value,stride:s});}}} placeholder="例: 170" />
          <span style={{ color:"#2d6a4f", minWidth:24 }}>cm</span>
        </div>
        <span style={LBL}>目の高さ（m）：</span>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          <input style={INP} type="number" value={eyeH} onChange={e => { setEyeH(e.target.value); saveProfile({...loadProfile(), eyeH:e.target.value}); }} placeholder="1.5" />
          <span style={{ color:"#2d6a4f", minWidth:24 }}>m</span>
        </div>
        {s && <div style={{ background:"rgba(45,106,79,0.08)", borderRadius:8, padding:"8px 12px", fontSize:14, color:"#1a4a2a" }}>
          歩幅：<strong>{Math.round(s*100)} cm</strong>（身長×0.37）
        </div>}
      </div>

      {/* 歩数入力（積算方式） */}
      <div style={CARD}>
        <p style={{ fontSize:15, color:"#1a4a2a", marginBottom:14, fontWeight:"bold" }}>木までの距離</p>

        {/* ① 木の横→幹周り測定位置 */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, padding:"10px 12px", background:"rgba(45,106,79,0.06)", borderRadius:10 }}>
          <span style={{ fontSize:22 }}>🌲</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, color:"#5a8c6a", margin:"0 0 2px" }}>木の横 → 幹周り測定位置</p>
            <p style={{ fontSize:17, color:"#1a3a2a", fontWeight:"bold", margin:0 }}>
              {trunkSteps ? `${trunkSteps} 歩` : "―"}
              {s && trunkSteps ? <span style={{ fontSize:13, color:"#5a8c6a", marginLeft:8 }}>（{+(parseInt(trunkSteps)*s).toFixed(1)}m）</span> : null}
            </p>
          </div>
          <span style={{ fontSize:12, color:"#5a8c6a" }}>✅ 記録済</span>
        </div>

        {/* ② 幹周り測定位置→撮影位置 */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, padding:"10px 12px", background:"rgba(45,106,79,0.06)", borderRadius:10 }}>
          <span style={{ fontSize:22 }}>📷</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, color:"#5a8c6a", margin:"0 0 6px" }}>幹周り測定位置 → ここ（撮影位置）</p>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input style={{ ...INP, padding:"8px 12px" }} type="number" value={walkFromTrunk} onChange={e => onWalkChange(e.target.value)} placeholder="例: 20" />
              <span style={{ color:"#2d6a4f", whiteSpace:"nowrap", fontSize:15 }}>歩</span>
            </div>
          </div>
        </div>

        {/* ③ 木からの合計 */}
        <div style={{ background:"rgba(45,106,79,0.12)", border:"2px solid rgba(45,106,79,0.3)", borderRadius:10, padding:"12px 14px" }}>
          <p style={{ fontSize:13, color:"#5a8c6a", margin:"0 0 4px" }}>🌳 木からの合計距離</p>
          <p style={{ fontSize:22, fontWeight:"bold", color:"#1a3a2a", margin:0 }}>
            {totalSteps ? `${totalSteps} 歩` : "―"}
            {totalDist ? <span style={{ fontSize:17, color:"#2d6a4f", marginLeft:10 }}>= 約 {totalDist} m</span> : null}
          </p>
        </div>
      </div>

      <button style={PRI} onClick={() => setShowCam(true)} disabled={!dist}>次へ → カメラで測定する</button>
      <button style={GHO} onClick={onSkip}>スキップ（樹高なしで次へ）</button>
    </>
  );

  return (
    <>
      <HeightTapView videoRef={videoRef} cameraOn={cameraOn} startAll={startAll} sensorOn={sensorOn}
        top={top} bot={bot} onLockTop={setTop} onLockBot={setBot} onRedo={() => { setTop(null); setBot(null); }} />
      <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#1a5c3f":"#1a2a1a", cursor:canCalc?"pointer":"not-allowed" }}>
        📐　樹高を計算して次へ {!canCalc&&(top===null?"（梢をタップ）":bot===null?"（根元をタップ）":"")}
      </button>
      <button style={GHO} onClick={() => { stopCamera(); setShowCam(false); }}>← 距離入力に戻る</button>
      <button style={GHO} onClick={() => { stopCamera(); onSkip(); }}>スキップ</button>
    </>
  );
}

// ── ウィザード用：枝張り測定 ──
function WizardMeasSpread({ prof, initialDist, onMeasured, onSkip }) {
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [dist, setDist] = useState(initialDist||"");
  const [walkCount, setWalkCount] = useState("");
  const [bodyH, setBodyH] = useState(prof.bodyH||"");
  const [stride, setStride] = useState(prof.stride||null);
  const [distMode, setDistMode] = useState(1);
  const [showCam, setShowCam] = useState(!!initialDist);
  const dummyOrient = useCallback(() => {}, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(dummyOrient);
  const canCalc = left!==null&&right!==null&&!!dist;

  const doCalc = () => {
    if (!canCalc) return;
    const FOV = fov?.hFov || 60;
    const lA = (left - 0.5) * FOV;
    const rA = (right - 0.5) * FOV;
    const s = +(parseFloat(dist) * (Math.tan(Math.abs(lA)*Math.PI/180) + Math.tan(Math.abs(rA)*Math.PI/180))).toFixed(1);
    stopCamera();
    onMeasured(s+"");
  };

  if (!showCam) return (
    <>
      {initialDist && <div style={{ background:"rgba(45,106,79,0.08)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
        <p style={{ fontSize:12, color:"#2d6a4f", margin:0 }}>📏 樹高測定の距離 {initialDist}m を引き継いでいます</p>
      </div>}
      <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH="" setEyeH={() => {}} dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode} stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH={false} />
      <button style={PRI} onClick={() => setShowCam(true)} disabled={!dist}>次へ → カメラで測定する</button>
      <button style={GHO} onClick={onSkip}>スキップ（枝張りなしで次へ）</button>
    </>
  );

  return (
    <>
      <TrunkTapView videoRef={videoRef} cameraOn={cameraOn} startAll={startAll} sensorOn={sensorOn}
        left={left} right={right} onLockLeft={setLeft} onLockRight={setRight}
        onRedo={() => { setLeft(null); setRight(null); }}
        labelLeft="枝の左端" labelRight="枝の右端" />
      <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
        🌿　枝張りを計算して次へ {!canCalc&&"（左右をタップ）"}
      </button>
      <button style={GHO} onClick={() => { stopCamera(); setShowCam(false); }}>← 距離入力に戻る</button>
      <button style={GHO} onClick={() => { stopCamera(); onSkip(); }}>スキップ</button>
    </>
  );
}

// ── ウィザード用：幹周り測定 ──
function WizardMeasTrunk({ prof, onMeasured, onSkip }) {
  // onMeasured(circ, walkCount) で歩数も渡す
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [dist, setDist] = useState("");
  const [walkCount, setWalkCount] = useState("");
  const [bodyH, setBodyH] = useState(prof.bodyH||"");
  const [stride, setStride] = useState(prof.stride||null);
  const [distMode, setDistMode] = useState(1);
  const [showCam, setShowCam] = useState(false);
  const dummyOrient = useCallback(() => {}, []);
  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(dummyOrient);
  const canCalc = left!==null&&right!==null&&!!dist;

  const doCalc = () => {
    if (!canCalc) return;
    const FOV = fov?.hFov || 60;
    const lA = (left - 0.5) * FOV;
    const rA = (right - 0.5) * FOV;
    const diamM = +(parseFloat(dist) * (Math.tan(Math.abs(lA)*Math.PI/180) + Math.tan(Math.abs(rA)*Math.PI/180))).toFixed(3);
    const circ = +(diamM * 100 * Math.PI).toFixed(1);
    stopCamera();
    // 歩数モードの場合は walkCount を渡す（距離積算に使う）
    onMeasured(circ+"", distMode===1 ? walkCount : "");
  };

  if (!showCam) return (
    <>
      <div style={{ ...CARD, background:"rgba(45,106,79,0.08)", border:"1.5px solid rgba(45,106,79,0.25)" }}>
        <p style={{ fontSize:12, color:GRN, margin:0, lineHeight:1.7 }}>💡 木から <strong>2〜5m</strong> 離れて幹が大きく映る状態にしてください</p>
      </div>
      <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH="" setEyeH={() => {}} dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode} stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH={false} />
      <button style={PRI} onClick={() => setShowCam(true)} disabled={!dist}>次へ → カメラで測定する</button>
      <button style={GHO} onClick={onSkip}>スキップ（幹周りなしで次へ）</button>
    </>
  );

  return (
    <>
      <TrunkTapView videoRef={videoRef} cameraOn={cameraOn} startAll={startAll} sensorOn={sensorOn}
        left={left} right={right} onLockLeft={setLeft} onLockRight={setRight}
        onRedo={() => { setLeft(null); setRight(null); }}
        labelLeft="幹の左端" labelRight="幹の右端" />
      <button onClick={doCalc} style={{ ...PRI, background:canCalc?"#2a4a1a":"#1a2a1a", borderColor:canCalc?GOLD:"#4a7c5a", color:canCalc?GOLD:"#4a7c5a", cursor:canCalc?"pointer":"not-allowed" }}>
        🌲　幹周りを計算して次へ {!canCalc&&"（左右をタップ）"}
      </button>
      <button style={GHO} onClick={() => { stopCamera(); setShowCam(false); }}>← 距離入力に戻る</button>
      <button style={GHO} onClick={() => { stopCamera(); onSkip(); }}>スキップ</button>
    </>
  );
}

// ================================================================
// CARTE APP
// ================================================================
function CarteApp({ trees, mushrooms, onUpdate, onBack, onMeasureHeight, onMeasureSpread, onMeasureTrunk, initialSelectedId }) {
  const [view, setView] = useState(initialSelectedId ? "detail" : "list"); // list | detail | form | wizard
  const [selected, setSelected] = useState(initialSelectedId ? trees.find(t=>t.id===initialSelectedId)||null : null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("date_desc");
  const [showPdf, setShowPdf] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const importRef = useRef();
  const [previewImage, setPreviewImage] = useState(null); // 画像プレビュー
  const [osmModal, setOsmModal] = useState(null); // OSM登録モーダル
  const [visitModal, setVisitModal] = useState(false); // 再訪記録モーダル
  const [visitPhoto, setVisitPhoto] = useState(null);
  const [visitNote, setVisitNote] = useState("");
  const [visitTrunk, setVisitTrunk] = useState("");
  const [visitHeight, setVisitHeight] = useState("");
  const [visitCondition, setVisitCondition] = useState("良好");
  const visitPhotoRef = useRef();
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
  const doSave = async (opts = {}) => {
    if (!name.trim()) { alert("木の名前を入力してください"); return null; }
    const t = { id: editing?.id||newId(), name:name.trim(), species, location, note, photo, gps, measurements:{height,spread,trunk,age}, createdAt:editing?.createdAt||today(), updatedAt:today() };
    onUpdate(editing ? trees.map(x => x.id===t.id?t:x) : [t,...trees]);
    if (!opts.skipNav) { setSelected(t); setView("detail"); }
    return t; // 保存したtreeを返す
  };
  const doDelete = (id) => { if (!window.confirm("削除しますか？")) return; onUpdate(trees.filter(t=>t.id!==id)); setSelected(null); setView("list"); };
  const onPhoto = async e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const resized = await resizePhoto(ev.target.result, 800);
      setPhoto(resized);
    };
    reader.readAsDataURL(f);
  };
  const filtered = (() => {
    let list = trees.filter(t => !search||t.name.includes(search)||t.species?.includes(search)||t.location?.includes(search));
    if (sortKey==="date_desc") list = [...list].sort((a,b) => parseDate(b.createdAt)-parseDate(a.createdAt));
    else if (sortKey==="date_asc") list = [...list].sort((a,b) => parseDate(a.createdAt)-parseDate(b.createdAt));
    else if (sortKey==="height_desc") list = [...list].sort((a,b) => parseFloat(b.measurements?.height||0)-parseFloat(a.measurements?.height||0));
    else if (sortKey==="trunk_desc") list = [...list].sort((a,b) => parseFloat(b.measurements?.trunk||0)-parseFloat(a.measurements?.trunk||0));
    else if (sortKey==="name") list = [...list].sort((a,b) => a.name.localeCompare(b.name, "ja"));
    return list;
  })();
  const cur = selected && trees.find(t=>t.id===selected.id);

  return (
    <div>
      {/* LIST */}
      {view==="list"&&<>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:8, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ メニュー</button>
            <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>大きな木のアルバム</h2>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {trees.length>0&&<button onClick={() => setShowPdf(true)} style={{ fontSize:12, color:GRN, background:"rgba(45,106,79,0.08)", border:`1.5px solid rgba(45,106,79,0.3)`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontFamily:"inherit" }}>📄 PDF</button>}
            <button onClick={() => setShowExport(true)} style={{ fontSize:12, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:`1.5px solid rgba(45,106,79,0.3)`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontFamily:"inherit" }}>💾 バックアップ</button>

          </div>
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

          {/* 写真サムネ：横スクロール1列 */}
          {trees.filter(t=>t.photo).length>0&&<div style={{ overflowX:"auto", marginBottom:14, WebkitOverflowScrolling:"touch", scrollbarWidth:"none", msOverflowStyle:"none" }}>
            <div style={{ display:"flex", gap:8, paddingBottom:4, width:"max-content" }}>
              {sortNewest(trees).filter(t=>t.photo).map(t=>(
                <button key={t.id} onClick={() => { setSelected(t); setView("detail"); }}
                  style={{ padding:0, border:"2px solid rgba(126,203,161,0.25)", borderRadius:12, overflow:"hidden", cursor:"pointer", width:100, height:100, background:"#e8f5e9", position:"relative", flexShrink:0 }}>
                  <img src={t.photo} alt={t.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,0.55)", padding:"3px 5px" }}>
                    <p style={{ fontSize:9, color:"#fff", margin:0, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{t.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>}
        </>}

        {/* 登録ボタン（上部） */}
        <button style={{ ...PRI, marginBottom:14 }} onClick={() => setView("wizard")}>＋　新しい木を登録する</button>

        {trees.length>0&&<div style={{ position:"relative", marginBottom:12 }}>
          <input style={{ ...INP, paddingLeft:36, fontSize:14 }} type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="名前・樹種・場所で検索..." />
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16, color:"#5a8c6a" }}>🔍</span>
        </div>}

        {filtered.length>0 ? sortNewest(filtered).map(t=>(
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
                  {t.measurements?.age&&<span style={{ fontSize:11, color:"#5a8c6a" }}>樹齢 <strong style={{ color:GRN }}>{t.measurements.age}年</strong></span>}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", paddingRight:10, color:"#5a8c6a", fontSize:18 }}>›</div>
            </div>
          </button>
        )) : <div style={{ textAlign:"center", padding:"40px 20px" }}><p style={{ fontSize:36, marginBottom:12 }}>🌱</p><p style={{ fontSize:13, color:"#5a8c6a" }}>{search?"該当なし":"まだ登録されていません"}</p></div>}

        {showPdf && <PdfModal trees={trees} onClose={() => setShowPdf(false)} />}

        {/* バックアップ・エクスポートモーダル */}
        {showExport && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20, overflowY:"auto" }}>
          <div style={{ background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:360, margin:"auto" }}>
            <p style={{ fontSize:18, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 4px", textAlign:"center" }}>💾 バックアップ</p>
            <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 16px", textAlign:"center" }}>
              🌳 大きな木 {trees.length}本　🍄 きのこ図鑑 {mushrooms.length}種
            </p>

            {/* 一括JSONエクスポート */}
            <div style={{ background:"rgba(45,106,79,0.06)", border:"1.5px solid rgba(45,106,79,0.25)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
              <p style={{ fontSize:14, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 4px" }}>📦 完全バックアップ（おすすめ）</p>
              <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 12px", lineHeight:1.6 }}>大きな木＋きのこ図鑑を1ファイルにまとめてバックアップ。新しいiPhoneへの移行に使えます。</p>
              <button onClick={async () => {
                const km = await loadMushroomsDB();
                const data = { trees, mushrooms: km, exportedAt: today(), version: "1.0" };
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type:"application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `ookina-ki-backup-${today()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                try { localStorage.setItem("last_backup_date", new Date().toISOString()); } catch {}
              }} style={{ width:"100%", padding:"11px", background:"#1a5c3f", border:"none", borderRadius:10, color:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>
                📦 まとめてダウンロード
              </button>
            </div>

            {/* CSVエクスポート */}
            <div style={{ background:"rgba(116,179,206,0.08)", border:"1.5px solid rgba(116,179,206,0.3)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
              <p style={{ fontSize:14, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 4px" }}>📊 CSV（大きな木・表計算用）</p>
              <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 12px", lineHeight:1.6 }}>Excelで開ける形式。報告書・データ集計に。写真は含まれません。</p>
              <button onClick={() => {
                const header = ["名前","樹種","場所","樹高(m)","幹周り(cm)","枝張り(m)","推定樹齢(年)","緯度","経度","メモ","登録日","更新日"];
                const rows = trees.map(t => [
                  t.name, t.species||"", t.location||"",
                  t.measurements?.height||"", t.measurements?.trunk||"",
                  t.measurements?.spread||"", t.measurements?.age||"",
                  t.gps?.lat||"", t.gps?.lng||"",
                  (t.note||"").replace(/,/g,"、"),
                  t.createdAt||"", t.updatedAt||""
                ]);
                const csv = [header, ...rows].map(r => r.join(",")).join("\n");
                const bom = "\uFEFF";
                const blob = new Blob([bom + csv], { type:"text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `ookina-ki-${today()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ width:"100%", padding:"11px", background:"#2a4a7a", border:"none", borderRadius:10, color:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>
                📊 大きな木CSVをダウンロード
              </button>
            </div>

            {/* JSONインポート（一括復元） */}
            <div style={{ background:"rgba(255,255,255,0.8)", border:"1.5px solid rgba(45,106,79,0.2)", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
              <p style={{ fontSize:14, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 4px" }}>📂 JSONインポート（データ復元）</p>
              <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 12px", lineHeight:1.6 }}>バックアップJSONから復元。大きな木＋きのこ図鑑をまとめて復元できます。</p>
              <input ref={importRef} type="file" accept=".json" style={{ display:"none" }} onChange={async e => {
                const f = e.target.files[0]; if (!f) return;
                try {
                  const text = await f.text();
                  const data = JSON.parse(text);
                  if (data.trees && data.mushrooms) {
                    const tc = data.trees.length, kc = data.mushrooms.length;
                    if (!window.confirm(`大きな木 ${tc}本・きのこ図鑑 ${kc}種をインポートしますか？\n既存データと合わせて保存されます。`)) return;
                    const mergedTrees = [...data.trees, ...trees.filter(t => !data.trees.find(d => d.id===t.id))];
                    onUpdate(mergedTrees);
                    const km = await loadMushroomsDB();
                    const mergedKm = [...data.mushrooms, ...km.filter(m => !data.mushrooms.find(d => d.id===m.id))];
                    await saveMushroomsDB(mergedKm);
                    alert(`✅ 大きな木 ${tc}本・きのこ図鑑 ${kc}種をインポートしました`);
                  } else if (Array.isArray(data)) {
                    if (!window.confirm(`${data.length}本のデータをインポートしますか？`)) return;
                    const merged = [...data, ...trees.filter(t => !data.find(d => d.id===t.id))];
                    onUpdate(merged);
                    alert(`✅ ${data.length}本をインポートしました`);
                  } else { throw new Error("形式エラー"); }
                } catch(err) {
                  alert("❌ インポート失敗: ファイルの形式が正しくありません");
                }
                e.target.value = "";
              }} />
              <button onClick={() => { setShowExport(false); setTimeout(()=>importRef.current?.click(), 100); }}
                style={{ width:"100%", padding:"11px", background:"rgba(45,106,79,0.1)", border:"1.5px solid rgba(45,106,79,0.3)", borderRadius:10, color:"#1a3a2a", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>
                📂 JSONを読み込む
              </button>
            </div>

            <button onClick={() => setShowExport(false)}
              style={{ width:"100%", padding:"11px", background:"none", border:"1.5px solid rgba(45,106,79,0.25)", borderRadius:10, color:"#2d6a4f", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              閉じる
            </button>
          </div>
        </div>}

      </>}

      {/* WIZARD */}
      {view==="wizard"&&<RegisterWizard
        prof={loadProfile()}
        trees={trees}
        onComplete={(t) => {
          onUpdate([t, ...trees]);
          setSelected(t);
          setView("detail");
        }}
        onBack={() => setView("list")}
      />}

      {/* FORM */}
      {view==="form"&&<>
        <div style={{ display:"flex", alignItems:"center", gap:12, paddingTop:8, marginBottom:14 }}>
          <button onClick={()=>setView(editing?"detail":"list")} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ {editing?"記録へ":"一覧へ"}</button>
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
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <p style={{ fontSize:13, color:"#2d6a4f", margin:0, fontWeight:"bold" }}>測定値</p>
            <span style={{ fontSize:11, color:"#5a9070" }}>空欄でも可</span>
          </div>
          {/* 案内板からの転記ヒント */}
          <div style={{ background:"rgba(45,106,79,0.06)", border:"1.5px solid rgba(45,106,79,0.2)", borderRadius:10, padding:"10px 12px", marginBottom:14 }}>
            <p style={{ fontSize:13, color:"#2d6a4f", margin:0, lineHeight:1.8, fontWeight:"bold" }}>
              📋 案内板がある場合はそのまま入力できます
            </p>
            <p style={{ fontSize:12, color:"#5a8c6a", margin:"4px 0 0", lineHeight:1.7 }}>
              幹周り・樹齢・樹高などが案内板に書かれている場合は直接入力してください。カメラ測定との併用も可能です。
            </p>
          </div>

          {/* 樹高 */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>樹高（m）：<span style={{ fontSize:11, color:"#5a9070", fontWeight:"normal" }}>　直接入力 or カメラ測定</span></span>
              <button onClick={async () => { const saved = await doSave({ skipNav: true }); if (saved) onMeasureHeight(saved.id); }} style={{ fontSize:11, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>📐 今すぐ測定</button>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}><input style={{ ...INP, fontSize:20 }} type="number" value={height} onChange={e=>setHeight(e.target.value)} placeholder="未測定" /><span style={{ color:"#2d6a4f", minWidth:24, fontSize:13 }}>m</span></div>
          </div>

          {/* 枝張り */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>枝張り（m）：<span style={{ fontSize:11, color:"#5a9070", fontWeight:"normal" }}>　直接入力 or カメラ測定</span></span>
              <button onClick={async () => { const saved = await doSave({ skipNav: true }); if (saved) onMeasureSpread(saved.id); }} style={{ fontSize:11, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>🌿 今すぐ測定</button>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}><input style={{ ...INP, fontSize:20 }} type="number" value={spread} onChange={e=>setSpread(e.target.value)} placeholder="未測定" /><span style={{ color:"#2d6a4f", minWidth:24, fontSize:13 }}>m</span></div>
          </div>

          {/* 幹周り */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>幹周り（cm・地上1.3m）：<span style={{ fontSize:11, color:"#5a9070", fontWeight:"normal" }}>　直接入力 or カメラ測定</span></span>
              <button onClick={async () => { const saved = await doSave({ skipNav: true }); if (saved) onMeasureTrunk(saved.id); }} style={{ fontSize:11, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>🌲 今すぐ測定</button>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}><input style={{ ...INP, fontSize:20 }} type="number" value={trunk} onChange={e=>{
              setTrunk(e.target.value);
              if (e.target.value && species) { setAge(estimateAge(parseFloat(e.target.value), species)+""); setAgeAuto(true); }
              else if (!e.target.value) { if (ageAuto) setAge(""); setAgeAuto(false); }
            }} placeholder="例: 250" /><span style={{ color:"#2d6a4f", minWidth:28, fontSize:13 }}>cm</span></div>
            <p style={{ fontSize:11, color:"#5a8c6a", margin:"4px 0 0" }}>※ 案内板の幹周り・胸高周囲をそのまま入力。メジャー実測値も可。（例：300cm）</p>
          </div>
          {/* 推定樹齢 */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
              <span style={{ ...LBL, marginBottom:0 }}>樹齢（年）：<span style={{ fontSize:11, color:"#5a9070", fontWeight:"normal" }}>　案内板・自動推定・直接入力</span></span>
              {ageAuto && <span style={{ fontSize:11, color:GRN, borderRadius:20, padding:"2px 8px", background:"rgba(45,106,79,0.1)", border:"1px solid rgba(45,106,79,0.2)" }}>🤖 自動推定</span>}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
              <input style={{ ...INP, fontSize:20 }}
                type="number" value={age}
                onChange={e=>{ setAge(e.target.value); setAgeAuto(false); }}
                placeholder="例: 300（案内板の数字をそのまま）" />
              <span style={{ color:"#2d6a4f", minWidth:28, fontSize:13 }}>年</span>
            </div>
            {ageAuto && trunk && species && <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 6px" }}>
              {trunk}cm ÷ {GROWTH_RATE[species]}cm/年（{species}）＝ 約{age}年
            </p>}
            <div style={{ background:"rgba(45,106,79,0.06)", border:"1px solid rgba(255,193,7,0.18)", borderRadius:8, padding:"8px 12px", marginTop:6 }}>
              <p style={{ fontSize:11, color:"#2d6a4f", margin:0, lineHeight:1.7 }}>
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
            <button onClick={()=>setView("list")} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ 一覧へ</button>
            <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>{cur.name}</h2>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={async ()=>{ await printPDF([cur]); }} style={{ fontSize:12, color:GRN, background:"rgba(45,106,79,0.08)", border:`1px solid rgba(255,209,102,0.3)`, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontFamily:"inherit" }}>📄</button>
            <button onClick={()=>openEdit(cur)} style={{ fontSize:12, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontFamily:"inherit" }}>✏️ 編集</button>
            <button onClick={()=>doDelete(cur.id)} style={{ fontSize:12, color:"#ff8080", background:"rgba(220,50,50,0.1)", border:"1px solid rgba(220,50,50,0.4)", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontFamily:"inherit" }}>🗑️</button>
          </div>
        </div>
        {/* 詳細画面の写真エリア */}
        <input ref={detailPhotoRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
          onChange={async e => {
            const f = e.target.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = async ev => {
              const resized = await resizePhoto(ev.target.result, 800);
              const updated = { ...cur, photo: resized, updatedAt: today() };
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
        {/* 測定値カード */}
        {(cur.measurements?.height||cur.measurements?.spread||cur.measurements?.trunk||cur.measurements?.age)&&<div style={{ background:"linear-gradient(135deg,rgba(45,106,79,0.1),rgba(45,106,79,0.04))", border:"1px solid rgba(126,203,161,0.3)", borderRadius:16, padding:"18px 16px", marginBottom:12 }}>
          <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 14px", letterSpacing:2 }}>測定値</p>
          {/* 樹高・枝張り・幹周り：横3列 */}
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            {[["樹高",cur.measurements?.height,"m",GRN,"📐"],["枝張り",cur.measurements?.spread,"m",GOLD,"🌿"],["幹周り",cur.measurements?.trunk,"cm",BLUE,"🌲"]].map(([l,v,u,c,e])=>(
              <div key={l} style={{ flex:1, background:"rgba(255,255,255,0.85)", borderRadius:12, padding:"12px 8px", textAlign:"center", border:`1.5px solid ${v ? c+"55" : "rgba(200,200,200,0.3)"}` }}>
                <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 4px" }}>{e} {l}</p>
                <p style={{ fontSize:v ? 28 : 20, fontWeight:"bold", color: v ? c : "#ccc", margin:0, lineHeight:1.1, letterSpacing:-1 }}>{v || "―"}</p>
                {v && <p style={{ fontSize:11, color:"#5a8c6a", margin:"2px 0 0" }}>{u}</p>}
              </div>
            ))}
          </div>
          {/* 推定樹齢：1行大きく */}
          {cur.measurements?.age && <div style={{ background:"rgba(168,213,181,0.15)", border:"1px solid rgba(168,213,181,0.4)", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ fontSize:11, color:"#5a8c6a", margin:"0 0 2px" }}>🌱 推定樹齢</p>
              <p style={{ fontSize:11, color:"rgba(255,193,7,0.7)", margin:0 }}>⚠️ 参考値（気候・立地により異なります）</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <span style={{ fontSize:42, fontWeight:"bold", color:"#a8d5b5", letterSpacing:-2 }}>{cur.measurements.age}</span>
              <span style={{ fontSize:16, color:"#5a8c6a", marginLeft:4 }}>年</span>
            </div>
          </div>}
        </div>}
        {/* 記録画像 & 測定ボタン */}
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <button onClick={async () => { const d = await saveTreeImage(cur); if (d) setPreviewImage(d); }}
            style={{ flex:1, padding:"13px 6px", background:"rgba(126,203,161,0.15)", border:`1.5px solid ${GRN}`, borderRadius:12, color:GRN, fontSize:13, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>
            📸 記録画像
          </button>
          <button onClick={() => onMeasureHeight(cur.id)} style={{ flex:1, padding:"13px 6px", background:"rgba(116,179,206,0.1)", border:`1.5px solid ${BLUE}`, borderRadius:12, color:BLUE, fontSize:13, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>📐 樹高</button>
          <button onClick={() => onMeasureSpread(cur.id)} style={{ flex:1, padding:"13px 6px", background:"rgba(45,106,79,0.08)", border:`1.5px solid ${GRN}`, borderRadius:12, color:GRN, fontSize:13, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>🌿 枝張り</button>
          <button onClick={() => onMeasureTrunk(cur.id)} style={{ flex:1, padding:"13px 6px", background:"rgba(168,213,181,0.1)", border:"1.5px solid #a8d5b5", borderRadius:12, color:"#a8d5b5", fontSize:13, cursor:"pointer", fontFamily:"inherit", textAlign:"center" }}>🌲 幹周り</button>
        </div>
        {/* OSM登録ボタン */}
        <button onClick={() => { const r = openOSMEditor(cur); if (r) setOsmModal(r); }}
          style={{ width:"100%", padding:"13px", background:"rgba(116,179,206,0.12)", border:"1.5px solid #74b3ce", borderRadius:12, color:"#2a4a7a", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          🗺️　OpenStreetMapに登録する
        </button>
        {/* 再訪記録ボタン */}
        <button onClick={() => { setVisitPhoto(null); setVisitNote(""); setVisitTrunk(""); setVisitHeight(""); setVisitCondition("良好"); setVisitModal(true); }}
          style={{ width:"100%", padding:"13px", background:"rgba(45,106,79,0.08)", border:"1.5px solid rgba(45,106,79,0.3)", borderRadius:12, color:"#2d6a4f", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          📅　再訪を記録する
        </button>
        {/* 過去の訪問記録一覧 */}
        {cur.visits && cur.visits.length > 0 && <div style={CARD}>
          <p style={{ fontSize:13, color:"#2d6a4f", fontWeight:"bold", marginBottom:10 }}>📅 訪問記録（{cur.visits.length}回）</p>
          {[...cur.visits].reverse().map((v, i) => (
            <div key={i} style={{ borderBottom:"1px solid rgba(45,106,79,0.1)", paddingBottom:12, marginBottom:12 }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                {v.photo && <img src={v.photo} alt="" style={{ width:72, height:72, objectFit:"cover", borderRadius:8, flexShrink:0 }}/>}
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <p style={{ fontSize:13, fontWeight:"bold", color:"#1a3a2a", margin:0 }}>{v.date}</p>
                    <span style={{ fontSize:12, padding:"2px 8px", borderRadius:20, background:
                      v.condition==="良好"?"rgba(45,106,79,0.12)":
                      v.condition==="注意"?"rgba(255,165,0,0.12)":
                      "rgba(192,57,43,0.12)",
                      color:v.condition==="良好"?"#2d6a4f":v.condition==="注意"?"#b8860b":"#c0392b"
                    }}>{v.condition}</span>
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:4 }}>
                    {v.trunk && <span style={{ fontSize:12, color:BLUE }}>幹周り {v.trunk}cm</span>}
                    {v.height && <span style={{ fontSize:12, color:GRN }}>樹高 {v.height}m</span>}
                  </div>
                  {v.note && <p style={{ fontSize:13, color:"#333", margin:0, lineHeight:1.7 }}>{v.note}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>}
        {/* OSM登録モーダル */}
        {osmModal && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:360 }}>
            <p style={{ fontSize:18, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 16px", textAlign:"center" }}>🗺️ OSMに登録する</p>

            {/* 登録内容の確認 */}
            <div style={{ background:"#f0f7f0", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
              <p style={{ fontSize:13, color:"#2d6a4f", fontWeight:"bold", margin:"0 0 8px" }}>登録される情報：</p>
              {Object.entries(osmModal.tags).map(([k,v]) => (
                <div key={k} style={{ display:"flex", gap:8, fontSize:12, color:"#333", marginBottom:3 }}>
                  <span style={{ color:"#5a8c6a", minWidth:100 }}>{k}</span>
                  <span>=</span>
                  <span style={{ color:"#1a3a2a", fontWeight:"bold" }}>{v}</span>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, fontSize:12, color:"#333", marginTop:4 }}>
                <span style={{ color:"#5a8c6a", minWidth:100 }}>座標</span>
                <span>=</span>
                <span style={{ color:"#1a3a2a", fontWeight:"bold" }}>{osmModal.lat.toFixed(5)}, {osmModal.lng.toFixed(5)}</span>
              </div>
            </div>

            <div style={{ background:"rgba(45,106,79,0.08)", borderRadius:8, padding:"10px 12px", marginBottom:16 }}>
              <p style={{ fontSize:12, color:"#2d6a4f", margin:0, lineHeight:1.7 }}>
                ① 「OSMを開く」をタップ<br/>
                ② SafariでOSMが開きます<br/>
                ③ ログイン済みなら「ノードを追加」で木を登録<br/>
                ④ 上のタグ情報を入力して保存
              </p>
            </div>

            <button onClick={() => { window.open(osmModal.url, "_blank"); setOsmModal(null); }}
              style={{ width:"100%", padding:"14px", background:"#2d5fa8", border:"none", borderRadius:12, color:"#fff", fontSize:16, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold", marginBottom:10 }}>
              🗺️　OSMを開く
            </button>
            <button onClick={() => setOsmModal(null)}
              style={{ width:"100%", padding:"12px", background:"none", border:"1.5px solid rgba(45,106,79,0.3)", borderRadius:12, color:"#2d6a4f", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              キャンセル
            </button>
          </div>
        </div>}

        {/* 再訪記録モーダル */}
        <input ref={visitPhotoRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={async e => {
          const f = e.target.files[0]; if (!f) return;
          const r = new FileReader();
          r.onload = async ev => { const res = await resizePhoto(ev.target.result, 800); setVisitPhoto(res); };
          r.readAsDataURL(f);
        }}/>
        {visitModal && cur && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
          <div style={{ background:"#fff", borderRadius:16, padding:20, width:"100%", maxWidth:380, margin:"auto" }}>
            <p style={{ fontSize:17, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 4px", textAlign:"center" }}>📅 再訪を記録する</p>
            <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 14px", textAlign:"center" }}>{cur.name}　{today()}</p>

            {/* 写真 */}
            {visitPhoto
              ? <div style={{ position:"relative", marginBottom:12 }}>
                  <img src={visitPhoto} alt="" style={{ width:"100%", maxHeight:200, objectFit:"cover", borderRadius:10, display:"block" }}/>
                  <button onClick={() => setVisitPhoto(null)} style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.6)", border:"none", borderRadius:6, color:"#fff", fontSize:12, padding:"4px 8px", cursor:"pointer" }}>✕</button>
                </div>
              : <button onClick={() => visitPhotoRef.current?.click()} style={{ width:"100%", padding:"20px", background:"rgba(45,106,79,0.04)", border:"2px dashed rgba(45,106,79,0.3)", borderRadius:10, color:"#2d6a4f", fontSize:14, cursor:"pointer", fontFamily:"inherit", marginBottom:12, display:"block", textAlign:"center", fontWeight:"bold" }}>
                  📷　写真を追加（任意）
                </button>
            }

            {/* 樹勢 */}
            <p style={{ ...LBL, marginBottom:8 }}>樹勢（状態）：</p>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              {[["良好","#2d6a4f"],["注意","#b8860b"],["衰退","#c0392b"]].map(([c, col]) => (
                <button key={c} onClick={() => setVisitCondition(c)}
                  style={{ flex:1, padding:"10px", borderRadius:10, border:`2px solid ${visitCondition===c?col:"rgba(45,106,79,0.2)"}`, background:visitCondition===c?`${col}15`:"transparent", color:visitCondition===c?col:"#5a8c6a", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:visitCondition===c?"bold":"normal" }}>
                  {c}
                </button>
              ))}
            </div>

            {/* 測定値（任意） */}
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <p style={LBL}>幹周り（cm）</p>
                <input style={{ ...INP, fontSize:16 }} type="number" value={visitTrunk} onChange={e=>setVisitTrunk(e.target.value)} placeholder="例: 315"/>
              </div>
              <div style={{ flex:1 }}>
                <p style={LBL}>樹高（m）</p>
                <input style={{ ...INP, fontSize:16 }} type="number" value={visitHeight} onChange={e=>setVisitHeight(e.target.value)} placeholder="例: 20"/>
              </div>
            </div>

            {/* メモ */}
            <p style={LBL}>メモ・観察内容：</p>
            <textarea value={visitNote} onChange={e=>setVisitNote(e.target.value)}
              placeholder="樹勢の変化・病害虫・損傷・開花状況など..."
              style={{ ...INP, resize:"vertical", minHeight:80, fontSize:14, marginBottom:14 }}/>

            {/* 保存 */}
            <button onClick={() => {
              const visit = { date:today(), photo:visitPhoto, condition:visitCondition, trunk:visitTrunk, height:visitHeight, note:visitNote };
              const updated = { ...cur, visits:[...(cur.visits||[]), visit], updatedAt:today() };
              onUpdate(trees.map(t => t.id===cur.id ? updated : t));
              setSelected(updated);
              setVisitModal(false);
            }} style={{ ...PRI, marginBottom:8 }}>
              📅　記録を保存する
            </button>
            <button onClick={() => setVisitModal(false)} style={GHO}>キャンセル</button>
          </div>
        </div>}

        {/* 画像プレビューモーダル */}
        {previewImage && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
          <p style={{ color:"rgba(255,255,255,0.55)", fontSize:12, margin:"0 0 10px", textAlign:"center" }}>
            下の「写真に保存」ボタン、または画像を長押しして保存してください
          </p>
          <img src={previewImage} alt="記録画像" style={{ maxWidth:"100%", maxHeight:"55vh", borderRadius:12, display:"block" }} />
          {/* Web Share API で直接保存 or 長押しガイド */}
          <button onClick={async () => {
            try {
              // DataURLをBlobに変換
              const res = await fetch(previewImage);
              const blob = await res.blob();
              const file = new File([blob], (cur?.name||"tree")+"_記録.png", { type:"image/png" });
              if (navigator.canShare && navigator.canShare({ files:[file] })) {
                await navigator.share({ files:[file], title: cur?.name||"大きな木" });
              } else {
                alert("長押しして「写真に保存」を選んでください");
              }
            } catch(e) {
              if (e.name !== "AbortError") alert("長押しして「写真に保存」を選んでください");
            }
          }} style={{ marginTop:14, padding:"14px 0", width:"100%", maxWidth:280, background:"#2d6a4f", border:"none", borderRadius:12, color:"#fff", fontSize:16, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>
            📷　写真に保存する
          </button>
          <p style={{ color:"rgba(126,203,161,0.7)", fontSize:11, margin:"8px 0 4px", textAlign:"center" }}>
            または画像を長押し →「写真に保存」
          </p>
          <button onClick={() => setPreviewImage(null)} style={{ marginTop:6, padding:"11px 40px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"rgba(255,255,255,0.6)", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
            閉じる
          </button>
        </div>}
      </>}
    </div>
  );
}



// ================================================================
// 画像保存（Canvas合成）
// ================================================================

// ================================================================
// 写真リサイズ（localStorage保存用・最大幅800px）
// ================================================================
function resizePhoto(dataUrl, maxW = 800) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function saveTreeImage(tree) {
  const m = tree.measurements || {};

  // iPhoneの写真比率 3:4（縦長）
  const W = 1080, H = 1440;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ── 背景：写真を全面に表示（加工なし）──
  if (tree.photo) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        // cover fit（全面）
        const scale = Math.max(W / img.width, H / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        const sx = (W - sw) / 2, sy = (H - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);
        resolve();
      };
      img.onerror = resolve;
      img.src = tree.photo;
    });
  } else {
    // 写真なし：グラデーション背景
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c1820");
    bg.addColorStop(1, "#0a2a14");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.font = "220px serif";
    ctx.textAlign = "center";
    ctx.fillText("🌳", W / 2, H * 0.45);
  }

  // ── 測定値（右上・グラデーション背景付き） ──
  const measItems = [
    m.height ? { label: "樹高",    value: m.height, unit: "m",  color: "#7ecba1" } : null,
    m.trunk  ? { label: "幹周り",  value: m.trunk,  unit: "cm", color: "#74b3ce" } : null,
    m.spread ? { label: "枝張り",  value: m.spread, unit: "m",  color: "#7ecba1" } : null,
    m.age    ? { label: "推定樹齢",value: m.age,    unit: "年", color: "#d4b896" } : null,
  ].filter(Boolean);

  if (measItems.length > 0) {
    const rowH = 80;
    const panelW = W * 0.46;
    const panelH = measItems.length * rowH + 32;
    const panelX = W - panelW;
    const panelY = 0;

    // 背景なし・影だけで視認性を確保

    const MFONT = "'Hiragino Mincho ProN', Georgia, serif";
    const RX = W - 20;
    let MY = panelY + 36;
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowBlur = 14;

    measItems.forEach(item => {
      ctx.font = `22px ${MFONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(item.label, RX, MY);
      MY += 30;
      ctx.font = `bold 48px ${MFONT}`;
      ctx.fillStyle = item.color;
      ctx.fillText(item.value, RX - 34, MY);
      ctx.font = `22px ${MFONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(item.unit, RX, MY);
      MY += rowH - 30;
    });
    ctx.shadowBlur = 0;
  }

  // ── 左下グラデーション（木の名前エリアのみ）──
  // 文字が入る左端〜全体幅の40%、下から積み上がる高さ分だけ
  {
    const chars = Array.from(tree.name);
    const totalTextH = chars.length * 40 + 100; // おおよその高さ
    const gradTop = Math.max(H * 0.5, H - totalTextH);
    // 背景なし
  }

  // ── 木の名前（右下・縦並び・控えめ・バラバラサイズ） ──
  const FONT = "'Hiragino Mincho ProN', 'Yu Mincho', Georgia, serif";
  const chars = Array.from(tree.name);
  const BASE = 32;
  const VARIANCE = 14;

  // シード値（木の名前から決定的なランダム）
  const seed = chars.reduce((s, c) => s + c.charCodeAt(0), 0);
  const rng = (i) => {
    const x = Math.sin(seed * 9301 + i * 49297 + 233720) * 10000;
    return x - Math.floor(x);
  };
  const sizes = chars.map((_, i) => Math.round(BASE - VARIANCE/2 + rng(i) * VARIANCE));

  // 左縦書き（下から上へ・左下スタイル）
  ctx.shadowColor = "rgba(0,0,0,1)";
  ctx.shadowBlur = 16;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.82)";

  // 全文字の合計高さを先に計算
  const leftX = 48;
  const totalH = chars.reduce((sum, _, i) => sum + sizes[i] + 6, 0);

  // 記録日の上から開始（下から積み上げ）
  const bottomAnchor = H - 90; // 「記録日」の上
  let startY = bottomAnchor - totalH;
  // 最低でも画面上端から80px以上下から始まるよう調整
  if (startY < 80) startY = 80;

  let curY = startY;
  chars.forEach((ch, i) => {
    const s = sizes[i];
    ctx.font = `${s}px ${FONT}`;
    ctx.fillText(ch, leftX, curY);
    curY += s + 6;
    if (curY > bottomAnchor) return;
  });

  // 記録日・アプリ名（最下部）
  ctx.shadowColor = "rgba(0,0,0,1)";
  ctx.shadowBlur = 12;
  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textAlign = "left";
  ctx.fillText(tree.updatedAt, 52, H - 48);
  ctx.textAlign = "right";
  ctx.fillText("大きな木", W - 52, H - 48);
  ctx.shadowBlur = 0;

  // ── DataURL を返す（表示用）──
  return canvas.toDataURL("image/png");
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
// OSM登録（iDエディタにデータを引き継いで開く）
// ================================================================
function openOSMEditor(tree) {
  const m = tree.measurements || {};
  if (!tree.gps?.lat || !tree.gps?.lng) {
    alert("GPS情報がありません。\nカルテ編集でGPSを取得してから登録してください。");
    return null;
  }
  const lat = tree.gps.lat;
  const lng = tree.gps.lng;
  const tags = { "natural": "tree" };
  if (tree.name)    tags["name"] = tree.name;
  if (tree.species) {
    const speciesMap = {
      "クスノキ":"Cinnamomum camphora","ケヤキ":"Zelkova serrata",
      "イチョウ":"Ginkgo biloba","サクラ":"Prunus","マツ":"Pinus",
      "スギ":"Cryptomeria japonica","ヒノキ":"Chamaecyparis obtusa",
      "プラタナス":"Platanus","メタセコイア":"Metasequoia glyptostroboides",
      "ヒマラヤスギ":"Cedrus deodara","シラカシ":"Quercus myrsinifolia",
      "トウカエデ":"Acer buergerianum","ビャクシン":"Juniperus chinensis",
    };
    tags["species:ja"] = tree.species;
    if (speciesMap[tree.species]) tags["species"] = speciesMap[tree.species];
  }
  if (m.trunk)  tags["circumference"] = +(parseFloat(m.trunk) / 100).toFixed(2)+"";
  if (m.height) tags["height"] = m.height;
  if (tree.location) tags["description"] = tree.location + (tree.note ? " " + tree.note : "");
  const zoom = 19;
  const comment = encodeURIComponent(`大きな木アプリで記録: ${tree.name}`);
  const url = `https://www.openstreetmap.org/edit?editor=id#map=${zoom}/${lat}/${lng}&comment=${comment}`;
  return { url, tags, lat, lng };
}


// ================================================================
// MY きのこ図鑑
// ================================================================

const MUSHROOM_TYPES = [
  "アイカワタケ","アオゾメタケ","アズマタケ","アナタケ","アミタケ","アラゲキクラゲ","アンズタケ","ウサギタケ",
  "ウスバタケ","ウズラタケ","ウラベニホテイシメジ","エノキタケ","オオチリメンタケ","オオミコブタケ","オニカワウソタケ","オニフスベ",
  "カイガラタケ","カイメンタケ","カキシメジ","カシサルノコシカケ（コブサルノコシカケ）","カタオシロイタケ","カワウソタケ","カワラタケ","カワリハツ",
  "カンゾウタケ","カンバタケ","キクラゲ","キコブタケ","キシメジ","クサウラベニタケ","クジラタケ","クリタケ",
  "クロサルノコシカケ","コガネコウヤクタケ","コフキサルノコシカケ","コフキタケ","コブサルノコシカケモドキ","コムラサキシメジ","コルクタケ","サガリハリタケ",
  "サクラシメジ","サビアナタケ","サンゴハリタケ","シイサルノコシカケ","シイタケ","シハイタケ","シマサルノコシカケ","シロアミタケ",
  "シロアメタケ","シロカイメンタケ","シロキクラゲ","スエヒロタケ","タマゴタケ","チチタケ","チヂレタケ","チャアナタケ",
  "チャアナタケモドキ","チャカイガラタケ","チャナメツムタケ","ツガサルノコシカケ","ツキヨタケ","ツチグリ","ツリガネタケ","ツリバリサルノコシカケ",
  "テングタケ","トリュフ","ドクツルタケ","ナメコ","ナラタケ","ナラタケモドキ","ニカワジョウゴタケ","ニクウスバタケ",
  "ニレサルノコシカケ","ヌメリスギタケモドキ","ネンドタケ","ノウタケ","ハカワラタケ","ハナイグチ","バライロサルノコシカケ","ヒイロタケ",
  "ヒトクチタケ","ヒラタケ","ブナシメジ","ベッコウタケ","ベニテングタケ","ホウキタケ","ホウロクタケ","ポルチーニ",
  "マイタケ","マスタケ","マツオウジ","マッシュルーム","マンネンタケ","ミダレアミタケ","ムキタケ","ムサシタケ",
  "モミサルノコシカケ","モリノカレバタケ","ヤグラタケ","ヤケコゲタケ","ヤナギマツタケ","ヤニタケ","その他（不明）"
];

const EDIBILITY = [
  { value:"edible",   label:"食べられる", emoji:"✅", color:"#2d6a4f" },
  { value:"toxic",    label:"毒",         emoji:"☠️", color:"#c0392b" },
  { value:"unknown",  label:"不明",       emoji:"❓", color:"#7f8c8d" },
  { value:"inedible", label:"食不適",     emoji:"⚠️", color:"#e67e22" },
];

const MUSHROOM_DB_NAME = "kinoko_db";
const MUSHROOM_STORE   = "mushrooms";

async function loadMushroomsDB() {
  return new Promise(resolve => {
    const req = indexedDB.open(MUSHROOM_DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(MUSHROOM_STORE, { keyPath:"id" });
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction(MUSHROOM_STORE, "readonly");
      const all = []; tx.objectStore(MUSHROOM_STORE).openCursor().onsuccess = ev => {
        const cur = ev.target.result; if (cur) { all.push(cur.value); cur.continue(); }
        else resolve(all);
      };
    };
    req.onerror = () => resolve([]);
  });
}

async function saveMushroomsDB(items) {
  return new Promise(resolve => {
    const req = indexedDB.open(MUSHROOM_DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(MUSHROOM_STORE, { keyPath:"id" });
    req.onsuccess = e => {
      const db = e.target.result;
      const tx = db.transaction(MUSHROOM_STORE, "readwrite");
      const store = tx.objectStore(MUSHROOM_STORE);
      store.clear();
      items.forEach(item => store.put(item));
      tx.oncomplete = resolve;
    };
  });
}


// ================================================================
// きのこ記録画像生成
// ================================================================
async function saveKinokoImage(mushroom) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const FONT = "'Hiragino Mincho ProN','Yu Mincho',Georgia,serif";
  const ed = EDIBILITY.find(e => e.value === (mushroom.edibility||"unknown")) || EDIBILITY[2];

  // 背景（写真 or グラデ）
  if (mushroom.photo) {
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(W/img.width, H/img.height);
        const sw = img.width*scale, sh = img.height*scale;
        ctx.drawImage(img, (W-sw)/2, (H-sh)/2, sw, sh);
        resolve();
      };
      img.onerror = resolve;
      img.src = mushroom.photo;
    });
  } else {
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#1a2a1a"); bg.addColorStop(1,"#0a1f0a");
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    ctx.font = `280px serif`; ctx.textAlign="center";
    ctx.fillText("🍄", W/2, H*0.45);
  }

  // 下部グラデ
  const grad = ctx.createLinearGradient(0, H*0.55, 0, H);
  grad.addColorStop(0,"rgba(0,0,0,0)");
  grad.addColorStop(0.5,"rgba(0,0,0,0.55)");
  grad.addColorStop(1,"rgba(0,0,0,0.85)");
  ctx.fillStyle = grad; ctx.fillRect(0, H*0.55, W, H*0.45);

  // 食毒バッジ（右上）
  ctx.shadowColor="rgba(0,0,0,0.8)"; ctx.shadowBlur=12;
  ctx.font = `bold 52px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillStyle = ed.color==="unknown"?"rgba(255,255,255,0.9)":ed.color;
  ctx.fillText(`${ed.emoji} ${ed.label}`, W-48, 90);
  ctx.shadowBlur = 0;

  // 名前（下部大きく）
  ctx.shadowColor="rgba(0,0,0,1)"; ctx.shadowBlur=18;
  ctx.textAlign = "left";
  ctx.font = `bold 88px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  // 長い名前は折り返し
  const nameChars = Array.from(mushroom.name);
  const maxW = W - 96;
  let line = "", lines = [];
  for (const ch of nameChars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW) { lines.push(line); line = ch; }
    else line = test;
  }
  lines.push(line);
  let nameY = H - 220 - (lines.length-1)*100;
  lines.forEach(l => { ctx.fillText(l, 48, nameY); nameY += 100; });

  // 種類・場所
  ctx.font = `44px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  if (mushroom.species) ctx.fillText(`🍄 ${mushroom.species}`, 48, H-150);
  if (mushroom.location) ctx.fillText(`📍 ${mushroom.location}`, 48, H-96);

  // 日付・アプリ名
  ctx.font = `32px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(mushroom.createdAt, 48, H-44);
  ctx.textAlign = "right";
  ctx.fillText("大きな木 Myきのこ図鑑", W-48, H-44);
  ctx.shadowBlur = 0;

  return canvas.toDataURL("image/png");
}

function KinokoApp({ onBack }) {
  const [mushrooms, setMushrooms] = useState([]);
  const [view, setView]       = useState("list"); // list | detail | form
  const [selected, setSelected] = useState(null);
  const [search, setSearch]   = useState("");
  const [filterEd, setFilterEd] = useState("all");
  // form state
  const [editId, setEditId]   = useState(null);
  const [kinokoPreview, setKinokoPreview] = useState(null);
  const [photo, setPhoto]     = useState(null);
  const [name, setName]       = useState("");
  const [species, setSpecies] = useState("");
  const [edibility, setEdibility] = useState("unknown");
  const [location, setLocation] = useState("");
  const [note, setNote]       = useState("");
  const [gps, setGps]         = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const fileRef = useRef();

  useEffect(() => { loadMushroomsDB().then(d => setMushrooms(d.sort((a,b)=>parseDate(b.createdAt)-parseDate(a.createdAt)))); }, []);

  const save = (next) => { setMushrooms(next); saveMushroomsDB(next); };

  const openNew = () => { setEditId(null); setPhoto(null); setName(""); setSpecies(""); setEdibility("unknown"); setLocation(""); setNote(""); setGps(null); setView("form"); };
  const openEdit = (m) => { setEditId(m.id); setPhoto(m.photo); setName(m.name); setSpecies(m.species||""); setEdibility(m.edibility||"unknown"); setLocation(m.location||""); setNote(m.note||""); setGps(m.gps||null); setView("form"); };

  const doSave = () => {
    if (!name.trim()) { alert("きのこの名前を入力してください"); return; }
    const item = { id: editId||newId(), name:name.trim(), species, edibility, location, note, photo, gps, createdAt: editId ? mushrooms.find(m=>m.id===editId)?.createdAt||today() : today(), updatedAt:today() };
    const next = editId ? mushrooms.map(m => m.id===editId?item:m) : [item,...mushrooms];
    save(next); setSelected(item); setView("detail");
  };

  const doDelete = (id) => { if (!window.confirm("削除しますか？")) return; save(mushrooms.filter(m=>m.id!==id)); setSelected(null); setView("list"); };

  const onPhoto = async e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async ev => { const res = await resizePhoto(ev.target.result, 800); setPhoto(res); };
    r.readAsDataURL(f);
  };

  const getGPSNow = async () => {
    setGpsLoading(true);
    try { const g = await getGPS(); setGps(g); } catch(e) { alert("GPS取得失敗"); }
    setGpsLoading(false);
  };

  const filtered = mushrooms.filter(m =>
    (filterEd==="all" || m.edibility===filterEd) &&
    (!search || m.name.includes(search) || m.species?.includes(search) || m.location?.includes(search))
  );

  const cur = selected && mushrooms.find(m=>m.id===selected.id);
  const edInfo = (val) => EDIBILITY.find(e=>e.value===val) || EDIBILITY[2];

  // ── LIST ──
  if (view==="list") return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:8, marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ メニュー</button>
          <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>🍄 Myきのこ図鑑</h2>
        </div>
        <button onClick={openNew} style={{ padding:"8px 14px", background:"#2d6a4f", border:"none", borderRadius:20, color:"#fff", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>＋ 追加</button>
      </div>

      {/* 統計 */}
      {mushrooms.length>0 && <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {[["発見",`${mushrooms.length}種`,"#2d6a4f"],["食べられる",`${mushrooms.filter(m=>m.edibility==="edible").length}種`,"#2d6a4f"],["毒",`${mushrooms.filter(m=>m.edibility==="toxic").length}種`,"#c0392b"]].map(([l,v,c])=>(
          <div key={l} style={{ flex:1, background:"rgba(255,255,255,0.95)", border:"1px solid rgba(45,106,79,0.15)", borderRadius:10, padding:"8px", textAlign:"center" }}>
            <p style={{ fontSize:10, color:"#5a8c6a", margin:"0 0 2px" }}>{l}</p>
            <p style={{ fontSize:18, fontWeight:"bold", color:c, margin:0 }}>{v}</p>
          </div>
        ))}
      </div>}

      {/* 検索・フィルター */}
      <div style={{ display:"flex", gap:6, marginBottom:10 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 名前・場所で検索" style={{ ...INP, flex:1, padding:"10px 12px", fontSize:14 }} />
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto" }}>
        {[["all","すべて","#2d6a4f"],...EDIBILITY.map(e=>[e.value, e.emoji+" "+e.label, e.color])].map(([val,label,color])=>(
          <button key={val} onClick={()=>setFilterEd(val)}
            style={{ padding:"6px 12px", borderRadius:20, border:`1.5px solid ${filterEd===val?color:"rgba(45,106,79,0.2)"}`, background:filterEd===val?color:"transparent", color:filterEd===val?"#fff":color, fontSize:12, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", fontWeight:filterEd===val?"bold":"normal" }}>
            {label}
          </button>
        ))}
      </div>

      {/* 一覧 */}
      {filtered.length>0 ? filtered.map(m => {
        const ed = edInfo(m.edibility);
        return (
          <button key={m.id} onClick={()=>{ setSelected(m); setView("detail"); }}
            style={{ width:"100%", display:"flex", gap:12, alignItems:"center", background:"rgba(255,255,255,0.97)", border:"1.5px solid rgba(45,106,79,0.12)", borderRadius:14, padding:"10px 12px", marginBottom:8, cursor:"pointer", fontFamily:"inherit", textAlign:"left", boxShadow:"0 2px 8px rgba(45,106,79,0.08)" }}>
            {/* サムネ */}
            <div style={{ width:64, height:64, borderRadius:10, overflow:"hidden", flexShrink:0, background:"rgba(45,106,79,0.08)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {m.photo ? <img src={m.photo} alt={m.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:32 }}>🍄</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <p style={{ fontSize:15, fontWeight:"bold", color:"#1a3a2a", margin:0 }}>{m.name}</p>
                <span style={{ fontSize:13 }}>{ed.emoji}</span>
              </div>
              {m.species && <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 2px" }}>{m.species}</p>}
              <p style={{ fontSize:11, color:"#aaa", margin:0 }}>{m.location||""}{m.location&&m.createdAt?" ・ ":""}{m.createdAt}</p>
            </div>
            <span style={{ color:"#5a8c6a", fontSize:18 }}>›</span>
          </button>
        );
      }) : (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <p style={{ fontSize:48, marginBottom:12 }}>🍄</p>
          <p style={{ fontSize:15, color:"#5a8c6a", marginBottom:6 }}>{search||filterEd!=="all"?"該当なし":"まだ記録がありません"}</p>
          <p style={{ fontSize:13, color:"#aaa" }}>見つけたきのこを追加してみよう</p>
        </div>
      )}
    </div>
  );

  // ── DETAIL ──
  if (view==="detail" && cur) {
    const ed = edInfo(cur.edibility);
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:8, marginBottom:12 }}>
          <button onClick={()=>setView("list")} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ 一覧へ</button>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>openEdit(cur)} style={{ padding:"7px 14px", background:"rgba(45,106,79,0.1)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:20, color:"#2d6a4f", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>編集</button>
            <button onClick={()=>doDelete(cur.id)} style={{ padding:"7px 14px", background:"rgba(192,57,43,0.1)", border:"1px solid rgba(192,57,43,0.3)", borderRadius:20, color:"#c0392b", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>削除</button>
          </div>
        </div>

        {cur.photo && <div style={{ borderRadius:14, overflow:"hidden", marginBottom:12 }}>
          <img src={cur.photo} alt={cur.name} style={{ width:"100%", maxHeight:280, objectFit:"cover", display:"block" }}/>
        </div>}

        <div style={CARD}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <p style={{ fontSize:20, fontWeight:"bold", color:"#1a3a2a", margin:0, flex:1 }}>{cur.name}</p>
            <span style={{ fontSize:24 }}>{ed.emoji}</span>
            <span style={{ fontSize:13, fontWeight:"bold", color:ed.color, background:`${ed.color}18`, borderRadius:20, padding:"4px 12px" }}>{ed.label}</span>
          </div>
          {cur.species && <p style={{ fontSize:14, color:"#5a8c6a", margin:"0 0 6px" }}>🍄 {cur.species}</p>}
          {cur.location && <p style={{ fontSize:13, color:"#2d6a4f", margin:"0 0 4px" }}>📍 {cur.location}</p>}
          {cur.gps && <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 4px" }}>🛰 {cur.gps.lat.toFixed(5)}, {cur.gps.lng.toFixed(5)}</p>}
          {cur.note && <p style={{ fontSize:14, color:"#333", margin:"8px 0 0", lineHeight:1.7 }}>{cur.note}</p>}
          <p style={{ fontSize:11, color:"#aaa", margin:"8px 0 0" }}>登録：{cur.createdAt}　更新：{cur.updatedAt}</p>
        </div>

        {/* 記録画像保存ボタン */}
        <button onClick={async () => { const d = await saveKinokoImage(cur); setKinokoPreview(d); }}
          style={{ width:"100%", padding:"13px", background:"rgba(45,106,79,0.08)", border:"1.5px solid rgba(45,106,79,0.3)", borderRadius:12, color:"#2d6a4f", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          📸　記録画像を保存する
        </button>

        {/* 食毒注意 */}
        {(cur.edibility==="toxic"||cur.edibility==="unknown"||cur.edibility==="inedible") && <div style={{ background:"rgba(192,57,43,0.06)", border:"1.5px solid rgba(192,57,43,0.25)", borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
          <p style={{ fontSize:14, color:"#c0392b", margin:0, lineHeight:1.7, fontWeight:"bold" }}>
            ⚠️ 食毒の最終判断は必ず専門家にご確認ください。<br/>
            <span style={{ fontSize:12, fontWeight:"normal" }}>このアプリの情報は参考値です。</span>
          </p>
        </div>}

        {/* 記録画像プレビューモーダル */}
        {kinokoPreview && <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
          <p style={{ color:"rgba(255,255,255,0.55)", fontSize:12, margin:"0 0 10px", textAlign:"center" }}>
            下の「写真に保存」ボタン、または画像を長押しして保存してください
          </p>
          <img src={kinokoPreview} alt="きのこ記録" style={{ maxWidth:"100%", maxHeight:"55vh", borderRadius:12, display:"block" }}/>
          <button onClick={async () => {
            try {
              const res = await fetch(kinokoPreview);
              const blob = await res.blob();
              const file = new File([blob], (cur?.name||"kinoko")+"_記録.png", { type:"image/png" });
              if (navigator.canShare && navigator.canShare({ files:[file] })) {
                await navigator.share({ files:[file], title: cur?.name||"きのこ" });
              } else {
                alert("長押しして「写真に保存」を選んでください");
              }
            } catch(e) {
              if (e.name !== "AbortError") alert("長押しして「写真に保存」を選んでください");
            }
          }} style={{ marginTop:14, padding:"14px 0", width:"100%", maxWidth:280, background:"#2d6a4f", border:"none", borderRadius:12, color:"#fff", fontSize:16, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold" }}>
            📷　写真に保存する
          </button>
          <p style={{ color:"rgba(126,203,161,0.7)", fontSize:11, margin:"8px 0 4px", textAlign:"center" }}>
            または画像を長押し →「写真に保存」
          </p>
          <button onClick={() => setKinokoPreview(null)} style={{ marginTop:6, padding:"11px 40px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:12, color:"rgba(255,255,255,0.6)", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
            閉じる
          </button>
        </div>}
      </div>
    );
  }

  // ── FORM ──
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:8, marginBottom:14 }}>
        <button onClick={()=>setView(editId?"detail":"list")} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ 戻る</button>
        <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>{editId?"きのこを編集":"きのこを追加"}</h2>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={onPhoto}/>

      <div style={CARD}>
        {/* 写真 */}
        {photo
          ? <div style={{ position:"relative", marginBottom:14 }}>
              <img src={photo} alt="" style={{ width:"100%", maxHeight:240, objectFit:"cover", borderRadius:10, display:"block" }}/>
              <button onClick={()=>fileRef.current.click()} style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.6)", border:"1px solid #fff", borderRadius:8, color:"#fff", fontSize:12, padding:"5px 10px", cursor:"pointer", fontFamily:"inherit" }}>📷 撮り直す</button>
            </div>
          : <button onClick={()=>fileRef.current.click()} style={{ width:"100%", padding:"32px", background:"rgba(45,106,79,0.04)", border:"2px dashed rgba(45,106,79,0.3)", borderRadius:12, color:"#2d6a4f", fontSize:15, cursor:"pointer", fontFamily:"inherit", textAlign:"center", display:"block", marginBottom:14, fontWeight:"bold" }}>
              📷　写真を撮影 / ライブラリから選択
            </button>
        }

        <span style={LBL}>きのこの名前（必須）：</span>
        <input style={{ ...INP, marginBottom:8 }} type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="例: シイタケ、名前不明のきのこ"/>
        {/* Google検索ボタン */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button onClick={() => window.open("https://www.google.com/search?q=きのこ+同定+見分け方", "_blank")}
            style={{ flex:1, padding:"9px 8px", background:"rgba(66,133,244,0.08)", border:"1.5px solid rgba(66,133,244,0.3)", borderRadius:10, color:"#4285f4", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            🔍 Googleで検索
          </button>
          {photo && <button onClick={() => {
            const msg = "①Googleアプリを開く\n②カメラアイコン（Googleレンズ）をタップ\n③この写真を選んで検索してください\n\nGoogleレンズのページを開きますか？";
            if (window.confirm(msg)) {
              window.open("https://lens.google.com", "_blank");
            }
          }} style={{ flex:1, padding:"9px 8px", background:"rgba(234,67,53,0.08)", border:"1.5px solid rgba(234,67,53,0.3)", borderRadius:10, color:"#ea4335", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:"bold", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            📷 Googleレンズで調べる
          </button>}
        </div>

        <span style={LBL}>種類（わかる場合）：</span>
        <select value={species} onChange={e=>setSpecies(e.target.value)} style={{ ...INP, marginBottom:12, fontSize:14, appearance:"none" }}>
          <option value="">選択してください</option>
          {MUSHROOM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>

        <span style={LBL}>食毒：</span>
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          {EDIBILITY.map(e=>(
            <button key={e.value} onClick={()=>setEdibility(e.value)}
              style={{ flex:1, minWidth:80, padding:"10px 6px", borderRadius:10, border:`2px solid ${edibility===e.value?e.color:"rgba(45,106,79,0.2)"}`, background:edibility===e.value?`${e.color}18`:"transparent", color:edibility===e.value?e.color:"#5a8c6a", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:edibility===e.value?"bold":"normal", textAlign:"center" }}>
              {e.emoji}<br/>{e.label}
            </button>
          ))}
        </div>

        <span style={LBL}>発見場所：</span>
        <input style={{ ...INP, marginBottom:12 }} type="text" value={location} onChange={e=>setLocation(e.target.value)} placeholder="例: 住吉公園の松林"/>

        {/* GPS */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: gps?6:12 }}>
          <span style={{ ...LBL, marginBottom:0, flex:1 }}>📍 位置情報：</span>
          <button onClick={getGPSNow} style={{ fontSize:12, color:"#2d6a4f", background:"rgba(45,106,79,0.08)", border:"1px solid rgba(45,106,79,0.25)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit" }}>
            {gpsLoading?"取得中...":gps?"📍 再取得":"📍 現在地を取得"}
          </button>
        </div>
        {gps && <div style={{ background:"rgba(45,106,79,0.06)", borderRadius:8, padding:"6px 12px", marginBottom:12, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:11, color:"#2d6a4f" }}>✅ {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
          <button onClick={()=>setGps(null)} style={{ fontSize:11, color:"#ff8080", background:"none", border:"none", cursor:"pointer" }}>✕</button>
        </div>}

        <span style={LBL}>メモ：</span>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="色・形・香り・発見状況など..." style={{ ...INP, resize:"vertical", minHeight:80, fontSize:14 }}/>
      </div>

      <div style={{ background:"rgba(192,57,43,0.06)", border:"1.5px solid rgba(192,57,43,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
        <p style={{ fontSize:12, color:"#c0392b", margin:0, lineHeight:1.7 }}>⚠️ 食毒の最終判断は必ず専門家にご確認ください</p>
      </div>

      <button style={PRI} onClick={doSave}>🍄　{editId?"変更を保存する":"図鑑に追加する"}</button>
      <button style={GHO} onClick={()=>setView(editId?"detail":"list")}>← 戻る</button>
    </div>
  );
}

// ================================================================
// HELP & TERMS APP
// ================================================================
function HelpApp({ onBack }) {
  const [tab, setTab] = useState("usage");

  const Section = ({ emoji, title, children }) => (
    <div style={{ marginBottom:20 }}>
      <p style={{ fontSize:15, fontWeight:"bold", color:"#1a3a2a", margin:"0 0 8px", display:"flex", alignItems:"center", gap:6 }}>
        <span>{emoji}</span>{title}
      </p>
      <div style={{ fontSize:14, color:"#2d4a2d", lineHeight:1.9 }}>{children}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:8, marginBottom:16 }}>
        <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ メニュー</button>
        <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>使い方・利用規約</h2>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={() => setTab("usage")} style={{ ...TAB(tab==="usage"), flex:1, fontSize:14, padding:"11px" }}>📖 使い方</button>
        <button onClick={() => setTab("terms")} style={{ ...TAB(tab==="terms"), flex:1, fontSize:14, padding:"11px" }}>📋 利用規約</button>
      </div>

      {tab === "usage" && <div style={CARD}>
        <Section emoji="🌳" title="大きな木とは">
          樹高・幹周り・枝張りをスマホカメラでタップ測定し、写真とともに記録・管理するアプリです。インストール不要・完全無料でご利用いただけます。
        </Section>

        <Section emoji="📍" title="基本的な使い方">
          <div style={{ background:"rgba(45,106,79,0.05)", borderRadius:10, padding:"12px 14px" }}>
            {[
              ["①","木の真横に立つ","GPS位置情報を取得（地図に表示されます）"],
              ["②","3〜5歩離れて幹周り測定","カメラに幹を映してタップ"],
              ["③","15〜20歩離れて写真撮影","歩数を覚えておく"],
              ["④","樹高・枝張りを測定","歩数から距離を自動計算"],
              ["⑤","基本情報を入力","木の名前・樹種・場所・メモ"],
              ["⑥","登録・保存","記録画像を写真フォルダに保存"],
            ].map(([num, t, desc]) => (
              <div key={num} style={{ display:"flex", gap:10, marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:"bold", color:"#2d6a4f", minWidth:20 }}>{num}</span>
                <div>
                  <p style={{ fontSize:14, fontWeight:"bold", color:"#1a3a2a", margin:0 }}>{t}</p>
                  <p style={{ fontSize:12, color:"#5a8c6a", margin:"2px 0 0" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section emoji="📐" title="測定精度について">
          本アプリの測定値はカメラ画像のタップ方式による参考値です。視野角・距離・タップのズレにより<strong>±10〜20%程度の誤差</strong>が生じる場合があります。正式な診断書・報告書への記載には専門機器による測定値をご使用ください。
        </Section>

        <Section emoji="🌱" title="推定樹齢について">
          推定樹齢は「幹周り ÷ 樹種別年間成長量」による参考値です。立地・気候・剪定履歴・土壌条件によって実際の樹齢は大きく異なります。参考情報としてのみご活用ください。
        </Section>

        <Section emoji="💾" title="データの保存">
          記録データはお使いのiPhone本体に保存されます。クラウドへの自動同期はありません。機種変更・端末故障に備えて、定期的にアルバム画面の「💾 バックアップ」からJSONエクスポートを行ってください。
        </Section>

        <Section emoji="🗺️" title="OpenStreetMapへの登録">
          カルテ詳細画面から測定データをOpenStreetMap（OSM）に登録できます。登録した情報は世界中に公開されます。天然記念物など保護が必要な木の正確な場所を登録する際はご注意ください。OSMへの登録にはOSMアカウントが必要です。
        </Section>

        <Section emoji="📱" title="ホーム画面への追加">
          Safariでこのページを開き、共有ボタン →「ホーム画面に追加」でアプリのように使えます。オフラインでも基本機能が利用できます。
        </Section>
      </div>}

      {tab === "terms" && <div style={CARD}>
        <p style={{ fontSize:12, color:"#5a8c6a", margin:"0 0 16px" }}>最終更新：2026年3月</p>

        <Section emoji="1️⃣" title="サービスの目的">
          本アプリ「大きな木 / My Tree Diary」は、旅先で出会った大きな木、おじいちゃんちの大きな木、近所の公園にある大きな木など、身近な木との出会いを誰でも簡単に記録・残せるアプリです。専門知識は不要です。スマホのカメラだけで、写真・測定・場所をまとめて記録できます。
        </Section>

        <Section emoji="2️⃣" title="測定値の取り扱い">
          本アプリが提供する樹高・幹周り・枝張り・推定樹齢はすべて参考値です。これらの値を根拠とした公的な診断・申請・契約等に利用した場合の損害について、開発者は一切の責任を負いません。
        </Section>

        <Section emoji="3️⃣" title="データの管理">
          記録データはユーザーの端末内に保存されます。開発者はユーザーのデータを収集・閲覧・第三者提供しません。端末の故障・初期化・OSアップデートによるデータ消失について、開発者は責任を負いません。定期的なバックアップを推奨します。
        </Section>

        <Section emoji="4️⃣" title="禁止事項">
          <div>以下の行為を禁止します。</div>
          <div style={{ marginTop:6 }}>
            {["本アプリを商業目的で無断使用すること","第三者の土地に無断で立ち入り測定を行うこと","測定値を意図的に改ざんして報告書等に使用すること","OpenStreetMapへの虚偽・誤った情報の登録"].map((item, i) => (
              <div key={i} style={{ display:"flex", gap:8, margin:"4px 0", fontSize:13 }}>
                <span style={{ color:"#2d6a4f" }}>・</span><span>{item}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section emoji="5️⃣" title="免責事項">
          本アプリは現状提供（as-is）です。動作の継続性・正確性・完全性を保証しません。Vercelのサービス停止・仕様変更等により予告なくサービスが終了する場合があります。
        </Section>

        <Section emoji="6️⃣" title="著作権">
          本アプリのデザイン・コードの著作権は開発者に帰属します。ユーザーが登録した写真・記録データの著作権はユーザー自身に帰属します。
        </Section>

        <Section emoji="7️⃣" title="利用規約の変更">
          利用規約は予告なく変更される場合があります。変更後も継続してご利用いただいた場合、変更後の規約に同意したものとみなします。
        </Section>

        <div style={{ background:"rgba(45,106,79,0.06)", borderRadius:10, padding:"12px 14px", marginTop:8 }}>
          <p style={{ fontSize:12, color:"#2d6a4f", margin:0, lineHeight:1.8 }}>
            本アプリはOpenStreetMap・Overpass API・Leaflet.jsを使用しています。
          </p>
          <div style={{ borderTop:"1px solid rgba(45,106,79,0.15)", marginTop:10, paddingTop:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <p style={{ fontSize:15, fontWeight:"bold", color:"#1a3a2a", margin:0 }}>
                大きな木　<span style={{ color:"#2d6a4f" }}>Satoshi</span> <span style={{ fontSize:13, color:"#5a8c6a", fontWeight:"normal" }}>(tree doctor)</span>
              </p>
            </div>
            <div style={{ fontSize:28 }}>🌳</div>
          </div>
        </div>
      </div>}
    </div>
  );
}

// ================================================================
// MAP APP（地図表示）
// ================================================================
function MapApp({ trees, onSelectTree, onBack }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [nearbyTrees, setNearbyTrees] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [searchRadius, setSearchRadius] = useState(5); // km
  const treesWithGPS = trees.filter(t => t.gps?.lat && t.gps?.lng);

  // Overpass API で近くの巨木を検索
  const searchNearby = async (lat, lng, radiusKm) => {
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const r = radiusKm * 1000;
      // natural=tree かつ circumference や diameter が登録されているものを検索
      const query = `[out:json][timeout:15];
(
  node["natural"="tree"]["circumference"](around:${r},${lat},${lng});
  node["natural"="tree"]["diameter"](around:${r},${lat},${lng});
  node["natural"="tree"]["name"](around:${r},${lat},${lng});
);
out body 50;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query
      });
      if (!res.ok) throw new Error("検索失敗");
      const data = await res.json();
      const results = (data.elements || []).map(el => ({
        id: el.id,
        lat: el.lat,
        lng: el.lon,
        name: el.tags?.name || el.tags?.species || "名前不明の木",
        species: el.tags?.species || el.tags?.["species:ja"] || "",
        circumference: el.tags?.circumference ? Math.round(parseFloat(el.tags.circumference) * 100) + "cm" : null,
        diameter: el.tags?.diameter ? parseFloat(el.tags.diameter).toFixed(1) + "m" : null,
        height: el.tags?.height ? parseFloat(el.tags.height).toFixed(1) + "m" : null,
        dist: Math.round(Math.sqrt((el.lat-lat)**2 + (el.lon-lng)**2) * 111000),
      })).sort((a,b) => a.dist - b.dist);
      setNearbyTrees(results);
      // 地図にマーカー追加
      if (mapInstanceRef.current && window.L) {
        addNearbyMarkers(results, lat, lng);
      }
    } catch(e) {
      setNearbyError("近くの巨木を検索できませんでした。ネットワークを確認してください。");
    }
    setNearbyLoading(false);
  };

  const getNearby = async () => {
    try {
      const pos = await getGPS();
      setUserPos(pos);
      await searchNearby(pos.lat, pos.lng, searchRadius);
      // 地図を現在地に移動
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([pos.lat, pos.lng], 13);
      }
    } catch(e) {
      setNearbyError("位置情報を取得できませんでした。");
    }
  };

  const addNearbyMarkers = (results, userLat, userLng) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;
    // 現在地マーカー
    const userIcon = L.divIcon({
      className: "",
      html: `<div style="background:#ff6b6b;border:3px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8]
    });
    L.marker([userLat, userLng], { icon: userIcon }).addTo(map).bindPopup("📍 現在地");
    // 巨木マーカー（緑の円）
    const nearbyIcon = L.divIcon({
      className: "",
      html: `<div style="background:rgba(45,106,79,0.85);border:2px solid #7ecba1;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🌲</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14]
    });
    results.slice(0, 30).forEach(t => {
      const info = [
        t.circumference ? `幹周り ${t.circumference}` : null,
        t.diameter ? `直径 ${t.diameter}` : null,
        t.height ? `樹高 ${t.height}` : null,
        t.species ? `樹種: ${t.species}` : null,
      ].filter(Boolean).join("<br>");
      L.marker([t.lat, t.lng], { icon: nearbyIcon })
        .addTo(map)
        .bindPopup(`<div style="font-family:serif;min-width:140px;">
          <b style="color:#1a3a2a;">${t.name}</b><br>
          <span style="font-size:11px;color:#5a8c6a;">${info || "情報なし"}</span><br>
          <span style="font-size:10px;color:#aaa;">約${t.dist}m先</span>
        </div>`);
    });
  };

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
        <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ メニュー</button>
        <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>大きな木の地図</h2>
      </div>
      {/* 近くの巨木検索 */}
      <div style={{ ...CARD, marginBottom:12 }}>
        <p style={{ fontSize:13, color:"#2d6a4f", marginBottom:10, fontWeight:"bold" }}>🌲 近くの巨木を探す</p>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
          <select value={searchRadius} onChange={e => setSearchRadius(+e.target.value)}
            style={{ ...INP, flex:1, fontSize:13, appearance:"none" }}>
            <option value={1}>半径1km</option>
            <option value={3}>半径3km</option>
            <option value={5}>半径5km</option>
            <option value={10}>半径10km</option>
          </select>
          <button onClick={getNearby} disabled={nearbyLoading}
            style={{ padding:"10px 16px", background:"#1a3a2a", border:"1px solid #7ecba1", borderRadius:10, color:"#7ecba1", fontSize:13, cursor:nearbyLoading?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            {nearbyLoading ? "検索中…" : "📍 現在地から検索"}
          </button>
        </div>
        {nearbyError && <p style={{ fontSize:12, color:"#ff8080", margin:0 }}>{nearbyError}</p>}
        {nearbyTrees.length > 0 && <p style={{ fontSize:11, color:"#5a9070", margin:0 }}>{nearbyTrees.length}本見つかりました（地図上の🌲）</p>}
        {nearbyTrees.length === 0 && !nearbyLoading && !nearbyError && (
          <p style={{ fontSize:11, color:"#5a9070", margin:0 }}>OpenStreetMapに登録されている巨木を検索します</p>
        )}
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
          <p style={{ fontSize:12, color:"#2d6a4f", marginBottom:10 }}>🌳 登録済みの木</p>
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

      {/* 近くの巨木リスト */}
      {nearbyTrees.length > 0 && (
        <div style={CARD}>
          <p style={{ fontSize:12, color:"#2d6a4f", marginBottom:10 }}>🌲 近くの巨木（OpenStreetMap）</p>
          {nearbyTrees.slice(0, 20).map(t => (
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(126,203,161,0.1)" }}>
              <span style={{ fontSize:20 }}>🌲</span>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, color:"#1a3a2a", margin:0, fontWeight:"bold" }}>{t.name}</p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:2 }}>
                  {t.circumference && <span style={{ fontSize:11, color:BLUE }}>幹周り {t.circumference}</span>}
                  {t.height && <span style={{ fontSize:11, color:GRN }}>樹高 {t.height}</span>}
                  {t.species && <span style={{ fontSize:11, color:"#5a9070" }}>{t.species}</span>}
                </div>
              </div>
              <span style={{ fontSize:11, color:"#aaa", whiteSpace:"nowrap" }}>約{t.dist}m</span>
            </div>
          ))}
          <p style={{ fontSize:10, color:"#aaa", marginTop:8, lineHeight:1.6 }}>
            出典：OpenStreetMap contributors<br/>
            ※ 環境省巨樹データベースとは異なります
          </p>
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
  const [trees, setTrees] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const [pendingTreeId, setPendingTreeId] = useState(null);
  const [pendingTreeName, setPendingTreeName] = useState(null);
  const [pendingDist, setPendingDist] = useState(null); // 樹高→枝張り距離引き継ぎ
  const [mapSelectedId, setMapSelectedId] = useState(null);
  const [mushrooms, setMushrooms] = useState([]);
  const prof = loadProfile();

  // IndexedDB から読み込み（起動時）
  useEffect(() => {
    // PWA manifest & アイコン設定
    const setHead = () => {
      if (!document.querySelector('link[rel="manifest"]')) {
        const m = document.createElement('link');
        m.rel = 'manifest'; m.href = '/manifest.json';
        document.head.appendChild(m);
      }
      if (!document.querySelector('link[rel="apple-touch-icon"]')) {
        const i = document.createElement('link');
        i.rel = 'apple-touch-icon'; i.href = '/icon-180.png';
        document.head.appendChild(i);
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        const t = document.createElement('meta');
        t.name = 'theme-color'; t.content = '#2d6a4f';
        document.head.appendChild(t);
      }
    };
    setHead();
  }, []);

  useEffect(() => {
    // バックアップリマインド（30日以上経過で警告）
    try {
      const lastBackup = localStorage.getItem("last_backup_date");
      if (lastBackup) {
        const days = Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24));
        if (days >= 30) {
          setTimeout(() => alert(`⚠️ バックアップのお知らせ\n最後のバックアップから${days}日経過しています。\nアルバム画面の「💾 バックアップ」からJSONエクスポートを行ってください。`), 2000);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await migrateFromLocalStorage();
      const loaded = await loadTreesDB();
      loaded.sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
      setTrees(loaded);
      const km = await loadMushroomsDB();
      km.sort((a,b)=>parseDate(b.createdAt)-parseDate(a.createdAt));
      setMushrooms(km);
      setDbReady(true);
    })();
  }, []);

  const updateTrees = (next) => { setTrees(next); saveTreesDB(next); };

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
  const onMeasureHeight = (treeId) => { setPendingTreeId(treeId); setPendingTreeName(trees.find(t=>t.id===treeId)?.name||null); setMode("height"); };
  const onMeasureSpread = (treeId) => { setPendingTreeId(treeId); setPendingTreeName(trees.find(t=>t.id===treeId)?.name||null); setMode("spread"); };
  const onMeasureTrunk  = (treeId) => { setPendingTreeId(treeId); setPendingTreeName(trees.find(t=>t.id===treeId)?.name||null); setMode("trunk"); };

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
          {dbReady && <>
          {menuBtn("📋","大きな木のアルバム","写真・測定値を記録・管理・PDF出力",trees.length>0?`${trees.length}本`:null,()=>setMode("carte"))}
          {menuBtn("🗺️","大きな木の地図","記録した木の場所を地図で確認",trees.filter(t=>t.gps).length>0?`${trees.filter(t=>t.gps).length}本`:null,()=>setMode("map"))}
          {menuBtn("📏","木の大きさを測る","樹高・枝張り・幹周りを測定する",null,()=>setMode("measure"))}
          {menuBtn("🍄","Myきのこ図鑑","見つけたきのこを記録・コレクション",mushrooms.length>0?`${mushrooms.length}種`:null,()=>setMode("kinoko"))}
          {menuBtn("📖","使い方・利用規約","測定方法・データ管理・免責事項",null,()=>setMode("help"))}
          </>}
        </div>}

        {mode==="measure"&&<div>
          <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:8, marginBottom:20 }}>
            <button onClick={()=>setMode(null)} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(45,106,79,0.12)", border:"1.5px solid rgba(45,106,79,0.35)", borderRadius:20, color:"#1a4a2a", fontSize:16, cursor:"pointer", padding:"10px 18px", fontFamily:"inherit", fontWeight:"bold" }}>‹ メニュー</button>
            <h2 style={{ fontSize:17, color:"#2d6a4f", margin:0 }}>📏 木の大きさを測る</h2>
          </div>
          <div style={{ ...CARD, marginBottom:14 }}>
            <p style={{ fontSize:13, color:"#5a8c6a", margin:"0 0 14px", lineHeight:1.8 }}>
              測定したい項目を選んでください。<br/>
              新しく木を登録する場合は「大きな木のアルバム」から「＋ 新しい木を登録」をお使いください。
            </p>
          </div>
          <button onClick={()=>{ setPendingTreeId(null); setMode("height"); }} style={{ width:"100%", padding:"20px 16px", background:"rgba(255,255,255,0.97)", border:"1.5px solid rgba(45,106,79,0.15)", borderRadius:16, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", gap:14, fontFamily:"inherit", textAlign:"left", boxShadow:"0 3px 12px rgba(45,106,79,0.1)" }}>
            <span style={{ fontSize:34 }}>📐</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:15, fontWeight:"bold", color:"#1b4332", margin:0 }}>樹高を測定する</p>
              <p style={{ fontSize:12, color:"#52b788", margin:"3px 0 0" }}>カメラで梢・根元を2点タップ</p>
            </div>
            <span style={{ color:"#2d6a4f", fontSize:20, fontWeight:"bold" }}>›</span>
          </button>
          <button onClick={()=>{ setPendingTreeId(null); setMode("spread"); }} style={{ width:"100%", padding:"20px 16px", background:"rgba(255,255,255,0.97)", border:"1.5px solid rgba(45,106,79,0.15)", borderRadius:16, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", gap:14, fontFamily:"inherit", textAlign:"left", boxShadow:"0 3px 12px rgba(45,106,79,0.1)" }}>
            <span style={{ fontSize:34 }}>🌿</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:15, fontWeight:"bold", color:"#1b4332", margin:0 }}>枝張りを測定する</p>
              <p style={{ fontSize:12, color:"#52b788", margin:"3px 0 0" }}>カメラで枝の左端・右端を2点タップ</p>
            </div>
            <span style={{ color:"#2d6a4f", fontSize:20, fontWeight:"bold" }}>›</span>
          </button>
          <button onClick={()=>{ setPendingTreeId(null); setMode("trunk"); }} style={{ width:"100%", padding:"20px 16px", background:"rgba(255,255,255,0.97)", border:"1.5px solid rgba(45,106,79,0.15)", borderRadius:16, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", gap:14, fontFamily:"inherit", textAlign:"left", boxShadow:"0 3px 12px rgba(45,106,79,0.1)" }}>
            <span style={{ fontSize:34 }}>🌲</span>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:15, fontWeight:"bold", color:"#1b4332", margin:0 }}>幹周りを測定する</p>
              <p style={{ fontSize:12, color:"#52b788", margin:"3px 0 0" }}>カメラで幹の左端・右端を2点タップ</p>
            </div>
            <span style={{ color:"#2d6a4f", fontSize:20, fontWeight:"bold" }}>›</span>
          </button>
        </div>}
        {mode==="height"&&<HeightApp prof={prof} trees={trees} pendingTreeId={pendingTreeId} pendingTreeName={pendingTreeName}
          onSaveTree={(nt,eid,meas) => { if (pendingTreeId) { updateTrees(trees.map(t => t.id===pendingTreeId ? { ...t, measurements:{ ...t.measurements, ...meas }, updatedAt:today() } : t)); setPendingTreeId(null); setPendingTreeName(null); setMode("carte"); } else { onSaveTree(nt,eid,meas); } }}
          onSaveAndMeasureSpread={pendingTreeId ? (distStr, heightStr) => {
            // 樹高を保存して距離を引き継いで枝張り測定へ
            updateTrees(trees.map(t => t.id===pendingTreeId ? { ...t, measurements:{ ...t.measurements, height: heightStr }, updatedAt:today() } : t));
            setPendingDist(distStr);
            setMode("spread");
          } : null}
          onBack={()=>setMode(null)}/>}
        {mode==="spread"&&<SpreadApp prof={prof} trees={trees} pendingTreeId={pendingTreeId} pendingTreeName={pendingTreeName} initialDist={pendingDist}
          onSaveTree={(nt,eid,meas) => { if (pendingTreeId) { updateTrees(trees.map(t => t.id===pendingTreeId ? { ...t, measurements:{ ...t.measurements, ...meas }, updatedAt:today() } : t)); setPendingTreeId(null); setPendingTreeName(null); setPendingDist(null); setMode("carte"); } else { onSaveTree(nt,eid,meas); } }}
          onBack={()=>{ setPendingDist(null); setMode(null); }}/>}
        {mode==="trunk"&&<TrunkApp prof={prof} trees={trees} pendingTreeId={pendingTreeId} pendingTreeName={pendingTreeName} onSaveTree={(nt,eid,meas) => { if (pendingTreeId) { updateTrees(trees.map(t => t.id===pendingTreeId ? { ...t, measurements:{ ...t.measurements, ...meas }, updatedAt:today() } : t)); setPendingTreeId(null); setPendingTreeName(null); setMode("carte"); } else { onSaveTree(nt,eid,meas); } }} onBack={()=>setMode(null)}/>}
        {mode==="carte"&&<CarteApp trees={trees} mushrooms={mushrooms} onUpdate={updateTrees} onBack={()=>{ setMapSelectedId(null); setMode(null); }} onMeasureHeight={onMeasureHeight} onMeasureSpread={onMeasureSpread} onMeasureTrunk={onMeasureTrunk} initialSelectedId={mapSelectedId}/>}
        {mode==="map"&&<MapApp trees={trees} onSelectTree={onSelectTree} onBack={()=>setMode(null)}/>}
        {mode==="kinoko"&&<KinokoApp onBack={()=>setMode(null)}/>}
        {mode==="help"&&<HelpApp onBack={()=>setMode(null)}/>}
      </div>
    </div>
  );
}
