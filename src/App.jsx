import { useState, useEffect, useRef, useCallback } from "react";

function calcHeight(dist, deg, eyeH) {
  return +(dist * Math.tan((deg * Math.PI) / 180) + eyeH).toFixed(1);
}

// センサーが使える環境かチェック
const SENSOR_AVAILABLE = typeof window !== "undefined" && "DeviceOrientationEvent" in window;

export default function App() {
  const [page, setPage] = useState(0);
  const [dist, setDist] = useState("");
  const [eyeH, setEyeH] = useState("1.5");
  const [bodyH, setBodyH] = useState("");
  const [walkCount, setWalkCount] = useState("");
  const [stride, setStride] = useState(null);
  const [distMode, setDistMode] = useState(0);
  const [manualDeg, setManualDeg] = useState("");
  const [liveDeg, setLiveDeg] = useState(null);
  const [lockedDeg, setLockedDeg] = useState(null);
  const [sensorOn, setSensorOn] = useState(false);
  const [angleMode, setAngleMode] = useState(1); // デフォルトを手動入力に
  const [result, setResult] = useState(null);
  const liveRef = useRef(null);

  const onOrient = useCallback((e) => {
    if (e.beta == null) return;
    let v = +(90 - Math.abs(e.beta)).toFixed(1);
    v = Math.max(0, Math.min(89, v));
    liveRef.current = v;
    setLiveDeg(v);
  }, []);

  useEffect(() => () => window.removeEventListener("deviceorientation", onOrient), [onOrient]);

  const startSensor = async () => {
    try {
      if (typeof DeviceOrientationEvent?.requestPermission === "function") {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== "granted") { alert("センサーが許可されませんでした。手動入力をお使いください。"); return; }
      }
      window.addEventListener("deviceorientation", onOrient);
      setSensorOn(true);
    } catch { alert("センサーを起動できませんでした。手動入力をお使いください。"); }
  };

  const calcStrideAndDist = () => {
    const h = parseFloat(bodyH);
    if (!h) return;
    const s = +(h * 0.45 / 100).toFixed(3);
    setStride(s);
    const w = parseFloat(walkCount);
    if (w) setDist(+(w * s).toFixed(1) + "");
  };

  const handleWalk = (v) => {
    setWalkCount(v);
    if (stride && v) setDist(+(parseFloat(v) * stride).toFixed(1) + "");
  };

  const lockAngle = () => {
    const a = angleMode === 0 ? liveRef.current : parseFloat(manualDeg);
    if (a == null || isNaN(a) || a <= 0) return;
    setLockedDeg(+a.toFixed(1));
  };

  const doCalc = () => {
    const d = parseFloat(dist), e = parseFloat(eyeH), a = lockedDeg;
    if (!d || !e || a == null) return;
    setResult({ h: calcHeight(d, a, e), d, a, e });
    setPage(3);
  };

  const reset = () => {
    setPage(0); setDist(""); setEyeH("1.5"); setBodyH(""); setWalkCount("");
    setStride(null); setDistMode(0); setManualDeg(""); setLiveDeg(null);
    setLockedDeg(null); setSensorOn(false); setAngleMode(1); setResult(null);
    window.removeEventListener("deviceorientation", onOrient);
  };

  const shown = lockedDeg ?? (angleMode === 0 ? (liveDeg ?? 0) : (parseFloat(manualDeg) || 0));

  const GRN = "#7ecba1";
  const box = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(126,203,161,0.2)", borderRadius: 14, padding: "18px", marginBottom: 12 };
  const primaryBtn = { width: "100%", padding: "14px", background: "#1a3a2a", border: `1px solid ${GRN}`, borderRadius: 12, color: "#e0f0ea", fontSize: 15, cursor: "pointer", marginBottom: 8, fontFamily: "inherit", letterSpacing: 1 };
  const yellowBtn = { width: "100%", padding: "14px", background: "#2a3a10", border: "1px solid #ffd166", borderRadius: 12, color: "#ffd166", fontSize: 15, cursor: "pointer", marginBottom: 8, fontFamily: "inherit", letterSpacing: 1 };
  const ghostBtn = { width: "100%", padding: "12px", background: "transparent", border: "1px solid #4a7c5a", borderRadius: 12, color: "#a8d5b5", fontSize: 13, cursor: "pointer", marginBottom: 8, fontFamily: "inherit" };
  const inp = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(126,203,161,0.4)", borderRadius: 10, padding: "12px 14px", color: "#e0f0ea", fontSize: 20, outline: "none", fontFamily: "inherit" };
  const tab = (on) => ({ flex: 1, padding: "9px 6px", borderRadius: 8, cursor: "pointer", fontSize: 12, background: on ? "rgba(126,203,161,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${on ? GRN : "rgba(126,203,161,0.2)"}`, color: on ? GRN : "#4a9070", fontFamily: "inherit" });
  const lbl = { fontSize: 12, color: "#a8d5b5", marginBottom: 6, display: "block" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(170deg,#0c1820,#1a2e3a 50%,#0a1f14)", fontFamily: "'Georgia','Hiragino Mincho ProN',serif", color: "#e0f0ea" }}>
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "0 16px 48px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", paddingTop: 32, paddingBottom: 8 }}>
          <div style={{ fontSize: 40 }}>📐</div>
          <h1 style={{ fontSize: 20, fontWeight: "bold", letterSpacing: 3, color: GRN, margin: "4px 0 0" }}>樹高測定システム</h1>
          <p style={{ fontSize: 11, color: "#4a9070", letterSpacing: 2, margin: "4px 0 0" }}>TREE HEIGHT METER</p>
        </div>

        {/* Step bar */}
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

        {/* ── PAGE 0: INTRO ── */}
        {page === 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={box}>
              <svg viewBox="0 0 280 130" style={{ width: "100%", height: "auto", display: "block" }}>
                <line x1="20" y1="110" x2="260" y2="110" stroke="#4a9070" strokeWidth="1.5" />
                <line x1="220" y1="110" x2="220" y2="18" stroke={GRN} strokeWidth="3" />
                <ellipse cx="220" cy="18" rx="22" ry="14" fill="#2d6a4f" opacity="0.85" />
                <circle cx="50" cy="87" r="7" fill={GRN} opacity="0.85" />
                <line x1="50" y1="94" x2="50" y2="110" stroke={GRN} strokeWidth="2" />
                <line x1="50" y1="87" x2="220" y2="18" stroke="#ffd166" strokeWidth="1.5" strokeDasharray="5,3" />
                <path d="M 78 87 A 28 28 0 0 1 67 65" fill="none" stroke="#ffd166" strokeWidth="1.5" />
                <text x="82" y="78" fill="#ffd166" fontSize="11">θ</text>
                <line x1="50" y1="120" x2="220" y2="120" stroke="#74b3ce" strokeWidth="1" strokeDasharray="4,3" />
                <text x="130" y="130" fill="#74b3ce" fontSize="9" textAnchor="middle">距離 d</text>
                <line x1="232" y1="18" x2="232" y2="110" stroke="#a8d5b5" strokeWidth="1" strokeDasharray="3,2" />
                <text x="244" y="68" fill="#a8d5b5" fontSize="9">樹高</text>
              </svg>
              <p style={{ fontSize: 12, color: "#a8d5b5", textAlign: "center", margin: "10px 0 0", lineHeight: 1.8 }}>
                樹高 ＝ 距離 × tan(仰角) ＋ 目の高さ
              </p>
            </div>

            <div style={{ ...box, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: GRN, margin: "0 0 8px" }}>測定手順</p>
              {["① 木から10〜30m離れる", "② 距離と身長を入力", "③ 仰角を入力（スマホ傾き or 目測）", "④ 樹高を自動計算"].map((t, i) => (
                <p key={i} style={{ fontSize: 12, color: "#a8d5b5", margin: "5px 0", lineHeight: 1.6 }}>{t}</p>
              ))}
            </div>

            <div style={{ background: "rgba(126,203,161,0.07)", border: "1px solid rgba(126,203,161,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: GRN, margin: 0, lineHeight: 1.7 }}>
                💡 センサー自動計測はVercelにデプロイ後、実機のiPhoneで利用できます。このプレビューでは手動入力で動作します。
              </p>
            </div>

            <button style={primaryBtn} onClick={() => setPage(1)}>🌲　測定を開始する</button>
          </div>
        )}

        {/* ── PAGE 1: DISTANCE ── */}
        {page === 1 && (
          <div>
            <div style={box}>
              <p style={{ fontSize: 13, color: GRN, marginBottom: 14 }}>身長・目の高さ</p>
              <span style={lbl}>身長（cm）：</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input style={inp} type="number" value={bodyH} onChange={e => { setBodyH(e.target.value); setStride(null); }} placeholder="例: 170" />
                <span style={{ color: GRN, minWidth: 24 }}>cm</span>
              </div>
              {bodyH && (
                <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 11, color: GRN }}>
                  推定歩幅：{Math.round(parseFloat(bodyH) * 0.45)} cm　／　目の高さ目安：{(parseFloat(bodyH) * 0.93 / 100).toFixed(2)} m
                </div>
              )}
              <span style={lbl}>目の高さ（m）：</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input style={inp} type="number" value={eyeH} onChange={e => setEyeH(e.target.value)} placeholder="1.5" />
                <span style={{ color: GRN, minWidth: 24 }}>m</span>
              </div>
              {bodyH && (
                <button onClick={() => setEyeH((parseFloat(bodyH) * 0.93 / 100).toFixed(2))}
                  style={{ fontSize: 11, color: GRN, background: "rgba(126,203,161,0.1)", border: "1px solid rgba(126,203,161,0.3)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                  身長から自動入力
                </button>
              )}
            </div>

            <div style={box}>
              <p style={{ fontSize: 13, color: GRN, marginBottom: 12 }}>木までの距離</p>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <button style={tab(distMode === 0)} onClick={() => setDistMode(0)}>📏 直接入力（m）</button>
                <button style={tab(distMode === 1)} onClick={() => setDistMode(1)}>👣 歩数で入力</button>
              </div>
              {distMode === 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input style={inp} type="number" value={dist} onChange={e => setDist(e.target.value)} placeholder="例: 15" />
                  <span style={{ color: GRN, minWidth: 24 }}>m</span>
                </div>
              )}
              {distMode === 1 && (
                <>
                  <button style={{ ...primaryBtn, padding: "10px", fontSize: 12 }} onClick={calcStrideAndDist} disabled={!bodyH}>
                    👣 身長から歩幅を計算
                  </button>
                  {!bodyH && <p style={{ fontSize: 11, color: "#4a7c5a", margin: "0 0 8px" }}>※ 先に身長を入力してください</p>}
                  {stride && <div style={{ background: "rgba(126,203,161,0.1)", borderRadius: 8, padding: "7px 12px", marginBottom: 10, fontSize: 12, color: GRN }}>推定歩幅：{(stride * 100).toFixed(0)} cm</div>}
                  <span style={lbl}>歩数：</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <input style={inp} type="number" value={walkCount} onChange={e => handleWalk(e.target.value)} placeholder="例: 20" />
                    <span style={{ color: GRN, minWidth: 24 }}>歩</span>
                  </div>
                  {dist && stride && (
                    <div style={{ background: "rgba(126,203,161,0.08)", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: GRN }}>
                      {walkCount}歩 × {(stride * 100).toFixed(0)}cm ＝ 約 <strong>{dist} m</strong>
                    </div>
                  )}
                </>
              )}
            </div>

            <button style={primaryBtn} onClick={() => setPage(2)}>次へ → 角度を測定する</button>
            <button style={ghostBtn} onClick={reset}>← 最初に戻る</button>
          </div>
        )}

        {/* ── PAGE 2: ANGLE ── */}
        {page === 2 && (
          <div>
            <div style={box}>
              <p style={{ fontSize: 13, color: GRN, marginBottom: 12 }}>仰角を入力する</p>

              {/* タブ */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                <button style={tab(angleMode === 1)} onClick={() => setAngleMode(1)}>✏️ 手動入力</button>
                <button style={tab(angleMode === 0)} onClick={() => { setAngleMode(0); if (!sensorOn) startSensor(); }}>📱 センサー（実機）</button>
              </div>

              {/* 分度器 */}
              <svg viewBox="0 0 200 110" style={{ width: "100%", maxWidth: 220, display: "block", margin: "0 auto 14px" }}>
                <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="rgba(126,203,161,0.25)" strokeWidth="2" />
                {[0, 15, 30, 45, 60, 75, 90].map(d => {
                  const r = (180 - d) * Math.PI / 180;
                  return <g key={d}>
                    <line x1={100 + 85 * Math.cos(r)} y1={100 - 85 * Math.sin(r)} x2={100 + 74 * Math.cos(r)} y2={100 - 74 * Math.sin(r)} stroke="rgba(126,203,161,0.4)" strokeWidth="1.5" />
                    <text x={100 + 62 * Math.cos(r)} y={100 - 62 * Math.sin(r) + 3} fill="rgba(126,203,161,0.6)" fontSize="8" textAnchor="middle">{d}°</text>
                  </g>;
                })}
                {(() => {
                  const r = (180 - shown) * Math.PI / 180;
                  const col = lockedDeg != null ? "#ffd166" : GRN;
                  return <g>
                    <line x1="100" y1="100" x2={100 + 80 * Math.cos(r)} y2={100 - 80 * Math.sin(r)} stroke={col} strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="100" cy="100" r="5" fill={col} />
                  </g>;
                })()}
              </svg>

              {/* 角度表示 */}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 64, fontWeight: "bold", color: lockedDeg != null ? "#ffd166" : GRN, margin: 0, lineHeight: 1 }}>{shown.toFixed(1)}</p>
                <p style={{ fontSize: 13, color: "#a8d5b5", margin: "4px 0 0" }}>度（仰角）</p>
                {lockedDeg != null && <p style={{ fontSize: 13, color: "#ffd166", margin: "8px 0 0" }}>✅ {lockedDeg}° でロック済み</p>}
              </div>

              {/* 手動入力 */}
              {angleMode === 1 && lockedDeg == null && (
                <>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(126,203,161,0.15)", borderRadius: 10, padding: "12px", marginBottom: 14 }}>
                    <p style={{ fontSize: 11, color: "#6aab7e", margin: "0 0 8px" }}>仰角の目安：</p>
                    {[["低木（〜5m）", "15〜25°"], ["中木（5〜15m）", "25〜45°"], ["高木（15m〜）", "45〜60°"]].map(([a, b]) => (
                      <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6aab7e", marginBottom: 4 }}>
                        <span>{a}</span><span style={{ color: GRN, fontWeight: "bold" }}>{b}</span>
                      </div>
                    ))}
                  </div>
                  <span style={lbl}>仰角を入力（0〜89度）：</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <input style={inp} type="number" value={manualDeg} onChange={e => setManualDeg(e.target.value)} placeholder="例: 35" min="0" max="89" />
                    <span style={{ color: GRN, minWidth: 24 }}>度</span>
                  </div>
                  <button style={yellowBtn} onClick={lockAngle} disabled={!manualDeg || parseFloat(manualDeg) <= 0}>
                    🎯　この角度でロックする
                  </button>
                </>
              )}

              {/* センサー */}
              {angleMode === 0 && lockedDeg == null && (
                <>
                  {!sensorOn
                    ? <button style={primaryBtn} onClick={startSensor}>📱 センサーを起動する</button>
                    : <>
                        <p style={{ fontSize: 12, color: GRN, textAlign: "center", marginBottom: 10 }}>📡 スマホを木のてっぺんに向けてください</p>
                        <button style={yellowBtn} onClick={lockAngle}>🎯 この角度でロックする</button>
                      </>
                  }
                </>
              )}

              {lockedDeg != null && (
                <button style={ghostBtn} onClick={() => setLockedDeg(null)}>🔄 やり直す</button>
              )}
            </div>

            {lockedDeg != null && (
              <button style={yellowBtn} onClick={doCalc}>🌲　樹高を計算する</button>
            )}
            <button style={ghostBtn} onClick={() => setPage(1)}>← 距離の入力に戻る</button>
          </div>
        )}

        {/* ── PAGE 3: RESULT ── */}
        {page === 3 && result && (
          <div style={{ marginTop: 8 }}>
            <div style={{ background: "linear-gradient(135deg,#1a3a2a99,#0a2a1a55)", border: "1px solid rgba(126,203,161,0.35)", borderRadius: 20, padding: "24px 20px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ position: "relative", height: 110, width: 80, margin: "0 auto 14px" }}>
                <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 12, background: "linear-gradient(#5d4037,#8d6e63)", borderRadius: 4, height: Math.min(95, result.h * 4) }} />
                <div style={{ position: "absolute", bottom: Math.max(0, Math.min(95, result.h * 4) - 8), left: "50%", transform: "translateX(-50%)", width: 58, height: 58, borderRadius: "50% 50% 40% 40%", background: "radial-gradient(circle at 40% 40%,#52b788,#1b4332)" }} />
              </div>
              <p style={{ fontSize: 11, color: GRN, margin: "0 0 2px", letterSpacing: 2 }}>推定樹高</p>
              <p style={{ fontSize: 68, fontWeight: "bold", color: "#e0f0ea", margin: 0, lineHeight: 1, letterSpacing: -3 }}>{result.h}</p>
              <p style={{ fontSize: 18, color: GRN, margin: "4px 0 14px" }}>m</p>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                {[["🏠", "1階建て", 3], ["🏢", "3階建て", 10], ["🪝", "電柱", 12], ["🏬", "5階建て", 16]].map(([e, l, h]) => (
                  <div key={l} style={{ background: result.h >= h ? "rgba(126,203,161,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${result.h >= h ? "rgba(126,203,161,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "5px 9px", fontSize: 11, color: result.h >= h ? GRN : "#4a7c5a" }}>
                    {e} {l}より{result.h >= h ? "高い" : "低い"}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...box, padding: "14px 16px" }}>
              {[["水平距離", `${result.d} m`], ["仰角", `${result.a}°`], ["目の高さ", `${result.e} m`], ["計算式", `${result.d}×tan(${result.a}°)+${result.e}`]].map(([l, v], i, arr) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: i < arr.length - 1 ? 8 : 0, marginBottom: i < arr.length - 1 ? 8 : 0, borderBottom: i < arr.length - 1 ? "1px solid rgba(126,203,161,0.1)" : "none" }}>
                  <span style={{ fontSize: 11, color: "#4a9070" }}>{l}</span>
                  <span style={{ fontSize: 13, color: "#e0f0ea" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "rgba(255,193,7,0.07)", border: "1px solid rgba(255,193,7,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: "#ffc107", margin: 0, lineHeight: 1.7 }}>⚠️ 地面の傾斜や距離の誤差により、実際の樹高と異なる場合があります。</p>
            </div>
            <button style={primaryBtn} onClick={reset}>📐　もう一度測定する</button>
          </div>
        )}
      </div>
    </div>
  );
}
