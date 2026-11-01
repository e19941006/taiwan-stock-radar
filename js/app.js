// ================================================================
// 🌟 主應用程式協調器 (行情抓取、雷達掃描、卡片渲染與事件綁定)
// ================================================================

let timerInterval = null; 
let scanStartTime = null;

function startTimer() {
    scanStartTime = Date.now();
    document_select('timer-display').innerText = `⏱️ 00:00`;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        document_select('timer-display').innerText = `⏱️ ${m}:${s}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (!scanStartTime) return "00分00秒";
    const elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
    const m = String(Math.floor(