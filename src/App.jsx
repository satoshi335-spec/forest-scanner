import { useState, useEffect, useRef, useCallback } from "react";

// ===== 計算式 =====
function calcHeight2(dist, topDeg, botDeg, eyeH) {
  const top = Math.tan((topDeg * Math.PI) / 180);
  const bot = Math.tan((botDeg * Math.PI) / 180);
  return +(dist * (top - bot) + eyeH).toFixed(1);
}
function calcSpread(dist, leftDeg, rightDeg) {
  const l = Math.tan((Math.abs(leftDeg) * Math.PI) / 180);
  const r = Math.tan((Math.abs(rightDeg) * Math.PI) / 180);
  return +(dist * (l + r)).toFixed(1);
}

// ===== localStorage =====
function loadSaved() {
  try { return JSON.parse(localStorage.getItem("treeapp_profile") || "{}"); } catch { return {}; }
}
function saveProfile(obj) {
  try { localStorage.setItem("treeapp_profile", JSON.stringify(obj)); } catch {}
}

// ===== 共通スタイル =====
const GRN = "#7ecba1";
const box = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(126,203,161,0.2)", borderRadius: 14, padding: "18px", marginBottom: 12 };
const primaryBtn = { width: "100%", padding: "14px", background: "#1a3a2a", border: `1px solid ${GRN}`, borderRadius: 12, color: "#e0f0ea", fontSize: 15, cursor: "pointer", marginBottom: 8, fontFamily: "inherit", letterSpacing: 1 };
const ghostBtn = { width: "100%", padding: "12px", background: "transparent", border: "1px solid #4a7c5a", borderRadius: 12, color: "#a8d5b5", fontSize: 13, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" };
const inp = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(126,203,161,0.4)", borderRadius: 10, padding: "12px 14px", color: "#e0f0ea", fontSize: 20, outline: "none", fontFamily: "inherit" };
const tabS = (on) => ({ flex: 1, padding: "9px 6px", borderRadius: 8, cursor: "pointer", fontSize: 12, background: on ? "rgba(126,203,161,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${on ? GRN : "rgba(126,203,161,0.2)"}`, color: on ? GRN : "#4a9070", fontFamily: "inherit" });
const lbl = { fontSize: 12, color: "#a8d5b5", marginBottom: 6, display: "block" };
const smallBtn = (col) => ({ fontSize: 11, color: col, background: "none", border: `1px solid ${col}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", marginTop: 6 });

// ===== カメラ共通 =====
function useCameraAndSensor(onOrient) {
  const [sensorOn, setSensorOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => {
    window.removeEventListener("deviceorientation", onOrient);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, [onOrient]);

  const startAll = async () => {
    try {
      if (typeof DeviceOrientationEvent?.requestPermission === "function") {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== "granted") { alert("センサーが許可されませんでした"); return; }
      }
      window.addEventListener("deviceorientation", onOrient);
      setSensorOn(true);
    } catch { alert("センサーを起動できませんでした"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
    } catch { setCameraOn(false); }
  };

  const stopCamera = () => {
    window.removeEventListener("deviceorientation", onOrient);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraOn(false); setSensorOn(false);
  };

  return { sensorOn, cameraOn, videoRef, startAll, stopCamera };
}

// ===== 距離入力パネル =====
function DistPanel({ bodyH, setBodyH, eyeH, setEyeH, dist, setDist, distMode, setDistMode, stride, setStride, walkCount, setWalkCount, showEyeH }) {
  const [savedMsg, setSavedMsg] = useState(false);

  const onBodyH = (v) => {
    setBodyH(v); setStride(null);
    const h = parseFloat(v);
    if (h > 0) saveProfile({ ...loadSaved(), bodyH: v, stride: +(h * 0.45 / 100).toFixed(3) });
  };
  const onEyeH = (v) => { setEyeH(v); saveProfile({ ...loadSaved(), eyeH: v }); };
  const autoFill = () => {
    const h = parseFloat(bodyH); if (!h) return;
    const e = +(h * 0.93 / 100).toFixed(2) + "";
    const s = +(h * 0.45 / 100).toFixed(3);
    setEyeH(e); setStride(s);
    saveProfile({ bodyH, eyeH: e, stride: s });
    setSavedMsg(true); setTimeout(() => setSavedMsg(false), 2000);
  };
  const calcStride = () => {
    const h = parseFloat(bodyH); if (!h) return;
    const s = +(h * 0.45 / 100).toFixed(3); setStride(s);
    if (walkCount) setDist(+(parseFloat(walkCount) * s).toFixed(1) + "");
  };
  const handleWalk = (v) => {
    setWalkCount(v);
    if (stride && v) setDist(+(parseFloat(v) * stride).toFixed(1) + "");
  };

  return (
    <>
      <div style={box}>
        <p style={{ fontSize: 13, color: GRN, marginBottom: 14 }}>身長{showEyeH ? "・目の高さ" : ""}
          <span style={{ fontSize: 10, color: "#4a9070", marginLeft: 8 }}>※ 自動保存</span>
        </p>
        <span style={lbl}>身長（cm）：</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input style={inp} type="number" value={bodyH} onChange={e => onBodyH(e.target.value)} placeholder="例: 170" />
          <span style={{ color: GRN, minWidth: 24 }}>cm</span>
        </div>
        {bodyH && <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 11, color: GRN }}>
          推定歩幅：{Math.round(parseFloat(bodyH) * 0.45)} cm　／　目の高さ目安：{(parseFloat(bodyH) * 0.93 / 100).toFixed(2)} m
        </div>}
        {showEyeH && <>
          <span style={lbl}>目の高さ（m）：</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input style={inp} type="number" value={eyeH} onChange={e => onEyeH(e.target.value)} placeholder="1.5" />
            <span style={{ color: GRN, minWidth: 24 }}>m</span>
          </div>
        </>}
        {bodyH && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={autoFill} style={{ fontSize: 11, color: GRN, background: "rgba(126,203,161,0.1)", border: "1px solid rgba(126,203,161,0.3)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            身長から自動入力して保存
          </button>
          {savedMsg && <span style={{ fontSize: 11, color: "#ffd166" }}>✅ 保存</span>}
        </div>}
      </div>

      <div style={box}>
        <p style={{ fontSize: 13, color: GRN, marginBottom: 12 }}>木までの距離</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button style={tabS(distMode === 0)} onClick={() => setDistMode(0)}>📏 直接入力（m）</button>
          <button style={tabS(distMode === 1)} onClick={() => setDistMode(1)}>👣 歩数で入力</button>
        </div>
        {distMode === 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={inp} type="number" value={dist} onChange={e => setDist(e.target.value)} placeholder="例: 15" />
            <span style={{ color: GRN, minWidth: 24 }}>m</span>
          </div>
        )}
        {distMode === 1 && (
          <>
            {!stride
              ? <button style={{ ...primaryBtn, padding: "10px", fontSize: 12 }} onClick={calcStride} disabled={!bodyH}>👣 身長から歩幅を計算</button>
              : <div style={{ background: "rgba(126,203,161,0.1)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 12, color: GRN }}>推定歩幅：{(stride * 100).toFixed(0)} cm（保存済み）</div>
            }
            {!bodyH && <p style={{ fontSize: 11, color: "#4a7c5a" }}>※ 先に身長を入力してください</p>}
            <span style={lbl}>歩数：</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <input style={inp} type="number" value={walkCount} onChange={e => handleWalk(e.target.value)} placeholder="例: 20" />
              <span style={{ color: GRN, minWidth: 24 }}>歩</span>
            </div>
            {dist && stride && <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: GRN }}>
              {walkCount}歩 × {(stride * 100).toFixed(0)}cm ＝ 約 <strong>{dist} m</strong>
            </div>}
          </>
        )}
      </div>
    </>
  );
}

// ===== 樹高測定 =====
function HeightApp({ saved, onBack }) {
  const [page, setPage] = useState(0);
  const [dist, setDist] = useState("");
  const [eyeH, setEyeH] = useState(saved.eyeH || "1.5");
  const [bodyH, setBodyH] = useState(saved.bodyH || "");
  const [walkCount, setWalkCount] = useState("");
  const [stride, setStride] = useState(saved.stride || null);
  const [distMode, setDistMode] = useState(0);
  const [liveDeg, setLiveDeg] = useState(null);
  const [botLocked, setBotLocked] = useState(null);
  const [topLocked, setTopLocked] = useState(null);
  const [result, setResult] = useState(null);
  const liveRef = useRef(null);

  const onOrient = useCallback((e) => {
    if (e.beta == null) return;
    let v = +(e.beta - 90).toFixed(1);
    v = Math.max(-89, Math.min(89, v));
    liveRef.current = v; setLiveDeg(v);
  }, []);

  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(onOrient);

  const doCalc = () => {
    const d = parseFloat(dist), e = parseFloat(eyeH);
    if (!d || !e || botLocked === null || topLocked === null) return;
    stopCamera();
    setResult({ h: calcHeight2(d, topLocked, botLocked, e), d, e, topDeg: topLocked, botDeg: botLocked });
    setPage(3);
  };

  const reset = () => {
    stopCamera();
    setPage(0); setDist(""); setWalkCount("");
    setLiveDeg(null); setBotLocked(null); setTopLocked(null); setResult(null);
  };

  const shown = liveDeg ?? 0;
  const canCalc = botLocked !== null && topLocked !== null && !!dist && !!eyeH;

  return (
    <div>
      {page > 0 && page < 3 && (
        <div style={{ display: "flex", gap: 4, margin: "14px 0" }}>
          {["① 距離入力", "② 角度測定", "③ 結果"].map((l, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 3, borderRadius: 2, background: i < page ? GRN : "rgba(126,203,161,0.2)", marginBottom: 4 }} />
              <span style={{ fontSize: 10, color: i < page ? GRN : "#4a9070" }}>{l}</span>
            </div>
          ))}
        </div>
      )}

      {page === 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={box}>
            <p style={{ fontSize: 12, color: GRN, textAlign: "center", marginBottom: 12 }}>2点ロック方式（上下）</p>
            <svg viewBox="0 0 280 155" style={{ width: "100%", height: "auto", display: "block" }}>
              <line x1="20" y1="125" x2="260" y2="125" stroke="#4a9070" strokeWidth="1.5" />
              <line x1="220" y1="125" x2="220" y2="18" stroke={GRN} strokeWidth="3" />
              <ellipse cx="220" cy="18" rx="22" ry="14" fill="#2d6a4f" opacity="0.85" />
              <circle cx="50" cy="102" r="7" fill={GRN} opacity="0.85" />
              <line x1="50" y1="109" x2="50" y2="125" stroke={GRN} strokeWidth="2" />
              <line x1="50" y1="102" x2="220" y2="18" stroke="#ffd166" strokeWidth="1.5" strokeDasharray="5,3" />
              <line x1="50" y1="102" x2="220" y2="120" stroke="#74b3ce" strokeWidth="1.5" strokeDasharray="5,3" />
              <path d="M 76 102 A 26 26 0 0 1 67 81" fill="none" stroke="#ffd166" strokeWidth="1.5" />
              <text x="80" y="93" fill="#ffd166" fontSize="9">上角</text>
              <path d="M 76 102 A 16 16 0 0 0 90 108" fill="none" stroke="#74b3ce" strokeWidth="1.5" />
              <text x="84" y="120" fill="#74b3ce" fontSize="9">下角</text>
              <line x1="50" y1="137" x2="220" y2="137" stroke="#74b3ce" strokeWidth="1" strokeDasharray="4,3" />
              <text x="130" y="148" fill="#74b3ce" fontSize="9" textAnchor="middle">距離 d</text>
              <line x1="232" y1="18" x2="232" y2="125" stroke="#a8d5b5" strokeWidth="1" strokeDasharray="3,2" />
              <text x="246" y="75" fill="#a8d5b5" fontSize="9">樹高</text>
            </svg>
            <p style={{ fontSize: 11, color: "#a8d5b5", textAlign: "center", margin: "8px 0 0", lineHeight: 1.8 }}>
              ① 根元をロック → ② 梢をロック
            </p>
          </div>
          <button style={primaryBtn} onClick={() => setPage(1)}>📐　測定を開始する</button>
          <button style={ghostBtn} onClick={onBack}>← メニューに戻る</button>
        </div>
      )}

      {page === 1 && (
        <div>
          <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH={eyeH} setEyeH={setEyeH}
            dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode}
            stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH />
          <button style={primaryBtn} onClick={() => setPage(2)}>次へ → 角度を測定する</button>
          <button style={ghostBtn} onClick={() => setPage(0)}>← 戻る</button>
        </div>
      )}

      {page === 2 && (
        <div>
          {/* カメラビュー */}
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 12, background: "#000", aspectRatio: "4/3" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraOn ? "block" : "none" }} />
            {!cameraOn && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1a0a" }}>
              <p style={{ color: "#4a7c5a", fontSize: 13, textAlign: "center" }}>📷<br />カメラ起動後に映像が表示されます</p>
            </div>}
            {sensorOn && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <div style={{ position: "absolute", top: "50%", left: "8%", right: "8%", height: 1, background: "rgba(126,203,161,0.35)", transform: "translateY(-50%)" }} />
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 44, height: 44 }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: GRN, opacity: 0.85, transform: "translateY(-50%)" }} />
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: GRN, opacity: 0.85, transform: "translateX(-50%)" }} />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: GRN }} />
                </div>
                {botLocked !== null && (() => {
                  const px = Math.round((shown - botLocked) * 3);
                  return <div style={{ position: "absolute", top: `calc(50% + ${px}px)`, left: 0, right: 0, height: 2, background: "#74b3ce", opacity: 0.8, transform: "translateY(-50%)" }}>
                    <span style={{ position: "absolute", right: 8, top: -20, fontSize: 10, color: "#74b3ce", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4 }}>根元 {botLocked > 0 ? "+" : ""}{botLocked}°</span>
                  </div>;
                })()}
                {topLocked !== null && (() => {
                  const px = Math.round((shown - topLocked) * 3);
                  return <div style={{ position: "absolute", top: `calc(50% + ${px}px)`, left: 0, right: 0, height: 2, background: "#ffd166", opacity: 0.8, transform: "translateY(-50%)" }}>
                    <span style={{ position: "absolute", right: 8, top: -20, fontSize: 10, color: "#ffd166", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4 }}>梢 +{topLocked}°</span>
                  </div>;
                })()}
                <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: GRN, margin: 0 }}>現在の角度</p>
                  <p style={{ fontSize: 26, fontWeight: "bold", color: shown >= 0 ? GRN : "#74b3ce", margin: 0, lineHeight: 1 }}>{shown > 0 ? "+" : ""}{shown.toFixed(1)}°</p>
                </div>
                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ background: botLocked !== null ? "rgba(116,179,206,0.85)" : "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: botLocked !== null ? "#fff" : "#666" }}>
                    {botLocked !== null ? `✅ 根元 ${botLocked > 0 ? "+" : ""}${botLocked}°` : "① 根元未ロック"}
                  </div>
                  <div style={{ background: topLocked !== null ? "rgba(255,209,102,0.85)" : "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: topLocked !== null ? "#000" : "#666" }}>
                    {topLocked !== null ? `✅ 梢 +${topLocked}°` : "② 梢未ロック"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={box}>
            {!sensorOn ? (
              <button style={primaryBtn} onClick={startAll}>📱　カメラ＆センサーを起動する</button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  {botLocked === null
                    ? <button onClick={() => { if (liveRef.current != null) setBotLocked(+liveRef.current.toFixed(1)); }} style={{ width: "100%", padding: "18px 8px", borderRadius: 12, cursor: "pointer", background: "rgba(116,179,206,0.1)", border: "2px solid rgba(116,179,206,0.4)", color: "#a8d5b5", fontFamily: "inherit", textAlign: "center" }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🔒</div>
                        <div style={{ fontSize: 13, fontWeight: "bold" }}>根元をロック</div>
                        <div style={{ fontSize: 11, color: "#4a9070", marginTop: 2 }}>カメラを根元に向けて</div>
                      </button>
                    : <div style={{ padding: "14px 8px", borderRadius: 12, background: "rgba(116,179,206,0.2)", border: "2px solid #74b3ce", textAlign: "center" }}>
                        <div style={{ fontSize: 20 }}>✅</div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "#74b3ce" }}>根元済</div>
                        <div style={{ fontSize: 12, color: "#74b3ce" }}>{botLocked > 0 ? "+" : ""}{botLocked}°</div>
                        <button onClick={() => { setBotLocked(null); setTopLocked(null); }} style={smallBtn("#74b3ce")}>やり直す</button>
                      </div>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  {topLocked === null
                    ? <button onClick={() => { if (liveRef.current != null) setTopLocked(+liveRef.current.toFixed(1)); }} disabled={botLocked === null} style={{ width: "100%", padding: "18px 8px", borderRadius: 12, cursor: botLocked === null ? "not-allowed" : "pointer", background: botLocked !== null ? "rgba(255,209,102,0.1)" : "rgba(255,255,255,0.03)", border: `2px solid ${botLocked !== null ? "rgba(255,209,102,0.4)" : "rgba(255,255,255,0.1)"}`, color: botLocked !== null ? "#d4b060" : "#4a7c5a", fontFamily: "inherit", textAlign: "center", opacity: botLocked === null ? 0.5 : 1 }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🔒</div>
                        <div style={{ fontSize: 13, fontWeight: "bold" }}>梢をロック</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>{botLocked === null ? "根元ロック後に" : "カメラを梢に向けて"}</div>
                      </button>
                    : <div style={{ padding: "14px 8px", borderRadius: 12, background: "rgba(255,209,102,0.2)", border: "2px solid #ffd166", textAlign: "center" }}>
                        <div style={{ fontSize: 20 }}>✅</div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "#ffd166" }}>梢済</div>
                        <div style={{ fontSize: 12, color: "#ffd166" }}>+{topLocked}°</div>
                        <button onClick={() => setTopLocked(null)} style={smallBtn("#ffd166")}>やり直す</button>
                      </div>
                  }
                </div>
              </div>
            )}
          </div>

          <button onClick={doCalc} style={{ ...primaryBtn, background: canCalc ? "#2a4a1a" : "#1a2a1a", borderColor: canCalc ? "#ffd166" : "#4a7c5a", color: canCalc ? "#ffd166" : "#4a7c5a", cursor: canCalc ? "pointer" : "not-allowed" }}>
            📐　樹高を計算する {!canCalc && (botLocked === null ? "（根元をロック）" : topLocked === null ? "（梢をロック）" : "（距離を入力）")}
          </button>
          <button style={ghostBtn} onClick={() => { setPage(1); stopCamera(); }}>← 距離の入力に戻る</button>
        </div>
      )}

      {page === 3 && result && (
        <div style={{ marginTop: 8 }}>
          <div style={{ background: "linear-gradient(135deg,#1a3a2a99,#0a2a1a55)", border: "1px solid rgba(126,203,161,0.35)", borderRadius: 20, padding: "24px 20px", textAlign: "center", marginBottom: 14 }}>
            <div style={{ position: "relative", height: 100, width: 70, margin: "0 auto 12px" }}>
              <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 10, background: "linear-gradient(#5d4037,#8d6e63)", borderRadius: 3, height: Math.min(85, result.h * 4) }} />
              <div style={{ position: "absolute", bottom: Math.max(0, Math.min(85, result.h * 4) - 6), left: "50%", transform: "translateX(-50%)", width: 52, height: 52, borderRadius: "50% 50% 40% 40%", background: "radial-gradient(circle at 40% 40%,#52b788,#1b4332)" }} />
            </div>
            <p style={{ fontSize: 11, color: GRN, margin: "0 0 2px", letterSpacing: 2 }}>推定樹高</p>
            <p style={{ fontSize: 68, fontWeight: "bold", color: "#e0f0ea", margin: 0, lineHeight: 1, letterSpacing: -3 }}>{result.h}</p>
            <p style={{ fontSize: 18, color: GRN, margin: "4px 0 12px" }}>m</p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
              {[["🏠", "1階", 3], ["🏢", "3階", 10], ["🪝", "電柱", 12], ["🏬", "5階", 16]].map(([e, l, h]) => (
                <div key={l} style={{ background: result.h >= h ? "rgba(126,203,161,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${result.h >= h ? "rgba(126,203,161,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "4px 8px", fontSize: 11, color: result.h >= h ? GRN : "#4a7c5a" }}>
                  {e} {l}より{result.h >= h ? "高い" : "低い"}
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...box, padding: "14px 16px" }}>
            {[["水平距離", `${result.d} m`], ["根元", `${result.botDeg > 0 ? "+" : ""}${result.botDeg}°`], ["梢", `+${result.topDeg}°`], ["角度差", `${(result.topDeg - result.botDeg).toFixed(1)}°`], ["目の高さ", `${result.e} m`]].map(([l, v], i, arr) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: i < arr.length - 1 ? 7 : 0, marginBottom: i < arr.length - 1 ? 7 : 0, borderBottom: i < arr.length - 1 ? "1px solid rgba(126,203,161,0.1)" : "none" }}>
                <span style={{ fontSize: 11, color: "#4a9070" }}>{l}</span>
                <span style={{ fontSize: 13, color: "#e0f0ea" }}>{v}</span>
              </div>
            ))}
          </div>
          <button style={primaryBtn} onClick={reset}>📐　もう一度測定する</button>
          <button style={ghostBtn} onClick={onBack}>← メニューに戻る</button>
        </div>
      )}
    </div>
  );
}

// ===== 枝張り測定 =====
function SpreadApp({ saved, onBack }) {
  const [page, setPage] = useState(0);
  const [dist, setDist] = useState("");
  const [bodyH, setBodyH] = useState(saved.bodyH || "");
  const [walkCount, setWalkCount] = useState("");
  const [stride, setStride] = useState(saved.stride || null);
  const [distMode, setDistMode] = useState(0);
  const [liveGamma, setLiveGamma] = useState(null);
  const [leftLocked, setLeftLocked] = useState(null);
  const [rightLocked, setRightLocked] = useState(null);
  const [result, setResult] = useState(null);
  const gammaRef = useRef(null);

  const onOrient = useCallback((e) => {
    if (e.gamma == null) return;
    let v = +e.gamma.toFixed(1);
    v = Math.max(-89, Math.min(89, v));
    gammaRef.current = v; setLiveGamma(v);
  }, []);

  const { sensorOn, cameraOn, videoRef, startAll, stopCamera } = useCameraAndSensor(onOrient);

  const doCalc = () => {
    const d = parseFloat(dist);
    if (!d || leftLocked === null || rightLocked === null) return;
    stopCamera();
    const spread = calcSpread(d, leftLocked, rightLocked);
    const radius = +(spread / 2).toFixed(1);
    const area = +(Math.PI * radius * radius).toFixed(1);
    setResult({ spread, radius, area, d, leftDeg: leftLocked, rightDeg: rightLocked });
    setPage(3);
  };

  const reset = () => {
    stopCamera();
    setPage(0); setDist(""); setWalkCount("");
    setLiveGamma(null); setLeftLocked(null); setRightLocked(null); setResult(null);
  };

  const shown = liveGamma ?? 0;
  const canCalc = leftLocked !== null && rightLocked !== null && !!dist;

  return (
    <div>
      {page > 0 && page < 3 && (
        <div style={{ display: "flex", gap: 4, margin: "14px 0" }}>
          {["① 距離入力", "② 角度測定", "③ 結果"].map((l, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 3, borderRadius: 2, background: i < page ? GRN : "rgba(126,203,161,0.2)", marginBottom: 4 }} />
              <span style={{ fontSize: 10, color: i < page ? GRN : "#4a9070" }}>{l}</span>
            </div>
          ))}
        </div>
      )}

      {page === 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={box}>
            <p style={{ fontSize: 12, color: GRN, textAlign: "center", marginBottom: 12 }}>2点ロック方式（左右）</p>
            <svg viewBox="0 0 280 155" style={{ width: "100%", height: "auto", display: "block" }}>
              <line x1="20" y1="125" x2="260" y2="125" stroke="#4a9070" strokeWidth="1.5" />
              <line x1="140" y1="125" x2="140" y2="60" stroke={GRN} strokeWidth="3" />
              <ellipse cx="140" cy="50" rx="60" ry="28" fill="#2d6a4f" opacity="0.5" stroke={GRN} strokeWidth="1" />
              <circle cx="80" cy="50" r="5" fill="#74b3ce" />
              <circle cx="200" cy="50" r="5" fill="#ffd166" />
              <circle cx="140" cy="100" r="7" fill={GRN} opacity="0.85" />
              <line x1="140" y1="107" x2="140" y2="125" stroke={GRN} strokeWidth="2" />
              <line x1="140" y1="100" x2="80" y2="50" stroke="#74b3ce" strokeWidth="1.5" strokeDasharray="5,3" />
              <line x1="140" y1="100" x2="200" y2="50" stroke="#ffd166" strokeWidth="1.5" strokeDasharray="5,3" />
              <path d="M 120 100 A 20 20 0 0 0 112 86" fill="none" stroke="#74b3ce" strokeWidth="1.5" />
              <text x="98" y="97" fill="#74b3ce" fontSize="9">左角</text>
              <path d="M 160 100 A 20 20 0 0 1 168 86" fill="none" stroke="#ffd166" strokeWidth="1.5" />
              <text x="162" y="97" fill="#ffd166" fontSize="9">右角</text>
              <line x1="80" y1="137" x2="200" y2="137" stroke="#a8d5b5" strokeWidth="1" strokeDasharray="3,2" />
              <text x="140" y="149" fill="#a8d5b5" fontSize="9" textAnchor="middle">枝張り</text>
            </svg>
            <p style={{ fontSize: 11, color: "#a8d5b5", textAlign: "center", margin: "8px 0 0", lineHeight: 1.8 }}>
              ① 左端をロック → ② 右端をロック
            </p>
          </div>
          <button style={primaryBtn} onClick={() => setPage(1)}>🌿　測定を開始する</button>
          <button style={ghostBtn} onClick={onBack}>← メニューに戻る</button>
        </div>
      )}

      {page === 1 && (
        <div>
          <DistPanel bodyH={bodyH} setBodyH={setBodyH} eyeH="" setEyeH={() => {}}
            dist={dist} setDist={setDist} distMode={distMode} setDistMode={setDistMode}
            stride={stride} setStride={setStride} walkCount={walkCount} setWalkCount={setWalkCount} showEyeH={false} />
          <button style={primaryBtn} onClick={() => setPage(2)}>次へ → 角度を測定する</button>
          <button style={ghostBtn} onClick={() => setPage(0)}>← 戻る</button>
        </div>
      )}

      {page === 2 && (
        <div>
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 12, background: "#000", aspectRatio: "4/3" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraOn ? "block" : "none" }} />
            {!cameraOn && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1a0a" }}>
              <p style={{ color: "#4a7c5a", fontSize: 13, textAlign: "center" }}>📷<br />カメラ起動後に映像が表示されます</p>
            </div>}
            {sensorOn && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: "50%", top: "10%", bottom: "10%", width: 1, background: "rgba(126,203,161,0.35)", transform: "translateX(-50%)" }} />
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 44, height: 44 }}>
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2, background: GRN, opacity: 0.85, transform: "translateY(-50%)" }} />
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: GRN, opacity: 0.85, transform: "translateX(-50%)" }} />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: GRN }} />
                </div>
                {leftLocked !== null && (() => {
                  const px = Math.round((shown - leftLocked) * 3);
                  return <div style={{ position: "absolute", left: `calc(50% + ${px}px)`, top: 0, bottom: 0, width: 2, background: "#74b3ce", opacity: 0.8, transform: "translateX(-50%)" }}>
                    <span style={{ position: "absolute", top: 10, left: 6, fontSize: 10, color: "#74b3ce", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>左 {leftLocked}°</span>
                  </div>;
                })()}
                {rightLocked !== null && (() => {
                  const px = Math.round((shown - rightLocked) * 3);
                  return <div style={{ position: "absolute", left: `calc(50% + ${px}px)`, top: 0, bottom: 0, width: 2, background: "#ffd166", opacity: 0.8, transform: "translateX(-50%)" }}>
                    <span style={{ position: "absolute", top: 28, left: 6, fontSize: 10, color: "#ffd166", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>右 {rightLocked}°</span>
                  </div>;
                })()}
                <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: GRN, margin: 0 }}>左右の角度</p>
                  <p style={{ fontSize: 26, fontWeight: "bold", color: shown >= 0 ? "#ffd166" : "#74b3ce", margin: 0, lineHeight: 1 }}>{shown > 0 ? "+" : ""}{shown.toFixed(1)}°</p>
                  <p style={{ fontSize: 9, color: "#a8d5b5", margin: "2px 0 0" }}>{shown > 2 ? "→右" : shown < -2 ? "←左" : "↑正面"}</p>
                </div>
                <div style={{ position: "absolute", top: 10, left: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ background: leftLocked !== null ? "rgba(116,179,206,0.85)" : "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: leftLocked !== null ? "#fff" : "#666" }}>
                    {leftLocked !== null ? `✅ 左端 ${leftLocked}°` : "① 左端未ロック"}
                  </div>
                  <div style={{ background: rightLocked !== null ? "rgba(255,209,102,0.85)" : "rgba(0,0,0,0.55)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: rightLocked !== null ? "#000" : "#666" }}>
                    {rightLocked !== null ? `✅ 右端 ${rightLocked}°` : "② 右端未ロック"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={box}>
            {!sensorOn ? (
              <button style={primaryBtn} onClick={startAll}>📱　カメラ＆センサーを起動する</button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  {leftLocked === null
                    ? <button onClick={() => { if (gammaRef.current != null) setLeftLocked(+gammaRef.current.toFixed(1)); }} style={{ width: "100%", padding: "18px 8px", borderRadius: 12, cursor: "pointer", background: "rgba(116,179,206,0.1)", border: "2px solid rgba(116,179,206,0.4)", color: "#a8d5b5", fontFamily: "inherit", textAlign: "center" }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🔒</div>
                        <div style={{ fontSize: 13, fontWeight: "bold" }}>左端をロック</div>
                        <div style={{ fontSize: 11, color: "#4a9070", marginTop: 2 }}>←左に傾けて</div>
                      </button>
                    : <div style={{ padding: "14px 8px", borderRadius: 12, background: "rgba(116,179,206,0.2)", border: "2px solid #74b3ce", textAlign: "center" }}>
                        <div style={{ fontSize: 20 }}>✅</div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "#74b3ce" }}>左端済</div>
                        <div style={{ fontSize: 12, color: "#74b3ce" }}>{leftLocked}°</div>
                        <button onClick={() => { setLeftLocked(null); setRightLocked(null); }} style={smallBtn("#74b3ce")}>やり直す</button>
                      </div>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  {rightLocked === null
                    ? <button onClick={() => { if (gammaRef.current != null) setRightLocked(+gammaRef.current.toFixed(1)); }} disabled={leftLocked === null} style={{ width: "100%", padding: "18px 8px", borderRadius: 12, cursor: leftLocked === null ? "not-allowed" : "pointer", background: leftLocked !== null ? "rgba(255,209,102,0.1)" : "rgba(255,255,255,0.03)", border: `2px solid ${leftLocked !== null ? "rgba(255,209,102,0.4)" : "rgba(255,255,255,0.1)"}`, color: leftLocked !== null ? "#d4b060" : "#4a7c5a", fontFamily: "inherit", textAlign: "center", opacity: leftLocked === null ? 0.5 : 1 }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🔒</div>
                        <div style={{ fontSize: 13, fontWeight: "bold" }}>右端をロック</div>
                        <div style={{ fontSize: 11, marginTop: 2 }}>{leftLocked === null ? "左端ロック後に" : "→右に傾けて"}</div>
                      </button>
                    : <div style={{ padding: "14px 8px", borderRadius: 12, background: "rgba(255,209,102,0.2)", border: "2px solid #ffd166", textAlign: "center" }}>
                        <div style={{ fontSize: 20 }}>✅</div>
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "#ffd166" }}>右端済</div>
                        <div style={{ fontSize: 12, color: "#ffd166" }}>{rightLocked}°</div>
                        <button onClick={() => setRightLocked(null)} style={smallBtn("#ffd166")}>やり直す</button>
                      </div>
                  }
                </div>
              </div>
            )}
          </div>

          <button onClick={doCalc} style={{ ...primaryBtn, background: canCalc ? "#2a4a1a" : "#1a2a1a", borderColor: canCalc ? "#ffd166" : "#4a7c5a", color: canCalc ? "#ffd166" : "#4a7c5a", cursor: canCalc ? "pointer" : "not-allowed" }}>
            🌿　枝張りを計算する {!canCalc && (leftLocked === null ? "（左端をロック）" : rightLocked === null ? "（右端をロック）" : "（距離を入力）")}
          </button>
          <button style={ghostBtn} onClick={() => { setPage(1); stopCamera(); }}>← 距離の入力に戻る</button>
        </div>
      )}

      {page === 3 && result && (
        <div style={{ marginTop: 8 }}>
          <div style={{ background: "linear-gradient(135deg,#1a3a2a99,#0a2a1a55)", border: "1px solid rgba(126,203,161,0.35)", borderRadius: 20, padding: "24px 20px", textAlign: "center", marginBottom: 14 }}>
            <div style={{ margin: "0 auto 14px", width: 110, height: 70 }}>
              <svg viewBox="0 0 110 70" style={{ width: "100%", height: "auto" }}>
                <ellipse cx="55" cy="30" rx={Math.min(50, result.spread * 2.5)} ry="22" fill="rgba(126,203,161,0.15)" stroke={GRN} strokeWidth="1.5" strokeDasharray="4,2" />
                <line x1="55" y1="52" x2="55" y2="65" stroke={GRN} strokeWidth="3" />
                <circle cx="55" cy="30" r="4" fill="#2d6a4f" stroke={GRN} strokeWidth="1.5" />
              </svg>
            </div>
            <p style={{ fontSize: 11, color: GRN, margin: "0 0 2px", letterSpacing: 2 }}>枝張り（直径）</p>
            <p style={{ fontSize: 68, fontWeight: "bold", color: "#e0f0ea", margin: 0, lineHeight: 1, letterSpacing: -3 }}>{result.spread}</p>
            <p style={{ fontSize: 18, color: GRN, margin: "4px 0 14px" }}>m</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <div style={{ background: "rgba(126,203,161,0.12)", border: "1px solid rgba(126,203,161,0.3)", borderRadius: 12, padding: "10px 16px" }}>
                <p style={{ fontSize: 11, color: "#a8d5b5", margin: "0 0 2px" }}>片側半径</p>
                <p style={{ fontSize: 24, fontWeight: "bold", color: GRN, margin: 0 }}>{result.radius} m</p>
              </div>
              <div style={{ background: "rgba(126,203,161,0.12)", border: "1px solid rgba(126,203,161,0.3)", borderRadius: 12, padding: "10px 16px" }}>
                <p style={{ fontSize: 11, color: "#a8d5b5", margin: "0 0 2px" }}>樹冠面積</p>
                <p style={{ fontSize: 24, fontWeight: "bold", color: GRN, margin: 0 }}>{result.area} m²</p>
              </div>
            </div>
          </div>
          <div style={{ ...box, padding: "14px 16px" }}>
            {[["水平距離", `${result.d} m`], ["左端", `${result.leftDeg}°`], ["右端", `${result.rightDeg}°`], ["角度合計", `${(Math.abs(result.leftDeg) + Math.abs(result.rightDeg)).toFixed(1)}°`]].map(([l, v], i, arr) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: i < arr.length - 1 ? 7 : 0, marginBottom: i < arr.length - 1 ? 7 : 0, borderBottom: i < arr.length - 1 ? "1px solid rgba(126,203,161,0.1)" : "none" }}>
                <span style={{ fontSize: 11, color: "#4a9070" }}>{l}</span>
                <span style={{ fontSize: 13, color: "#e0f0ea" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(255,193,7,0.07)", border: "1px solid rgba(255,193,7,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: "#ffc107", margin: 0, lineHeight: 1.7 }}>⚠️ 南北・東西方向で別々に測定するとより正確です。</p>
          </div>
          <button style={primaryBtn} onClick={reset}>🌿　もう一度測定する</button>
          <button style={ghostBtn} onClick={onBack}>← メニューに戻る</button>
        </div>
      )}
    </div>
  );
}

// ===== メインアプリ =====
export default function App() {
  const [mode, setMode] = useState(null); // null=menu, 'height', 'spread'
  const saved = loadSaved();

  const menuBtn = (emoji, title, sub, onClick) => (
    <button onClick={onClick} style={{ width: "100%", padding: "20px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(126,203,161,0.25)", borderRadius: 14, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", gap: 16, fontFamily: "inherit", textAlign: "left" }}>
      <span style={{ fontSize: 36 }}>{emoji}</span>
      <div>
        <p style={{ fontSize: 16, fontWeight: "bold", color: GRN, margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: "#6aab7e", margin: "4px 0 0" }}>{sub}</p>
      </div>
      <span style={{ marginLeft: "auto", color: "#4a7c5a", fontSize: 18 }}>›</span>
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(170deg,#0c1820,#1a2e3a 50%,#0a1f14)", fontFamily: "'Georgia','Hiragino Mincho ProN',serif", color: "#e0f0ea" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "0 16px 48px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: 32, paddingBottom: 8 }}>
          <div style={{ fontSize: 40 }}>🌳</div>
          <h1 style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 3, color: GRN, margin: "4px 0 0" }}>樹木測定システム</h1>
          <p style={{ fontSize: 11, color: "#4a9070", letterSpacing: 2, margin: "4px 0 0" }}>TREE MEASUREMENT</p>
        </div>

        {/* メニュー */}
        {mode === null && (
          <div style={{ marginTop: 24 }}>
            {saved.bodyH && (
              <div style={{ background: "rgba(126,203,161,0.08)", border: "1px solid rgba(126,203,161,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: GRN, margin: 0 }}>✅ 保存済み設定：身長 {saved.bodyH} cm</p>
              </div>
            )}
            {menuBtn("📐", "樹高を測定する", "カメラで根元・梢を2点ロックして計算", () => setMode("height"))}
            {menuBtn("🌿", "枝張りを測定する", "カメラで左端・右端を2点ロックして計算", () => setMode("spread"))}
          </div>
        )}

        {mode === "height" && <HeightApp saved={saved} onBack={() => setMode(null)} />}
        {mode === "spread" && <SpreadApp saved={saved} onBack={() => setMode(null)} />}
      </div>
    </div>
  );
}
