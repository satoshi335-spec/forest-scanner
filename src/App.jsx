import { useState, useEffect } from "react";

export default function App() {
  const [beta, setBeta] = useState(null);
  const [gamma, setGamma] = useState(null);
  const [alpha, setAlpha] = useState(null);
  const [started, setStarted] = useState(false);

  const start = async () => {
    if (typeof DeviceOrientationEvent?.requestPermission === "function") {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== "granted") { alert("許可されませんでした"); return; }
    }
    window.addEventListener("deviceorientation", (e) => {
      setBeta(e.beta != null ? +e.beta.toFixed(2) : null);
      setGamma(e.gamma != null ? +e.gamma.toFixed(2) : null);
      setAlpha(e.alpha != null ? +e.alpha.toFixed(2) : null);
    });
    setStarted(true);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a1f14", color:"#e0f0ea", fontFamily:"monospace", padding:24 }}>
      <h2 style={{ color:"#7ecba1", marginBottom:24 }}>センサーデバッグ</h2>

      {!started && (
        <button onClick={start} style={{ padding:"14px 28px", background:"#1a3a2a", border:"1px solid #7ecba1", borderRadius:12, color:"#e0f0ea", fontSize:16, cursor:"pointer" }}>
          📱 センサー起動
        </button>
      )}

      {started && (
        <div>
          <p style={{ color:"#ffd166", marginBottom:20 }}>スマホを縦に持って上下に傾けてください</p>

          <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:12, padding:20, marginBottom:16 }}>
            <p style={{ fontSize:14, color:"#a8d5b5", margin:"0 0 8px" }}>beta（前後の傾き）</p>
            <p style={{ fontSize:72, fontWeight:"bold", color:"#7ecba1", margin:0, lineHeight:1 }}>{beta ?? "---"}</p>
            <p style={{ fontSize:12, color:"#4a9070", marginTop:8 }}>
              ・縦に立てて水平 → 約90<br/>
              ・上に傾ける → 値が？<br/>
              ・下に傾ける → 値が？
            </p>
          </div>

          <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:12, padding:16, marginBottom:16 }}>
            <p style={{ fontSize:13, color:"#a8d5b5", margin:"0 0 4px" }}>gamma（左右）: {gamma ?? "---"}</p>
            <p style={{ fontSize:13, color:"#a8d5b5", margin:0 }}>alpha（方位）: {alpha ?? "---"}</p>
          </div>

          <div style={{ background:"rgba(255,209,102,0.1)", border:"1px solid rgba(255,209,102,0.3)", borderRadius:12, padding:14 }}>
            <p style={{ fontSize:12, color:"#ffd166", margin:0, lineHeight:1.8 }}>
              📋 確認してほしいこと：<br/>
              上に傾けたとき beta は増える？減る？<br/>
              水平のとき beta は何度？<br/>
              この値をClaudeに教えてください！
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
