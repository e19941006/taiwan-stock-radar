// ================================================================
// 🌟 選擇權多空比 (PCR) 儀表板控制
// ================================================================

function togglePcr() {
    const content = document.getElementById('pcr-content');
    const icon = document.getElementById('pcr-toggle-icon');
    const header = document.querySelector('.pcr-header');
    if (content.style.display === 'none') {
        content.style.display = 'block'; 
        icon.innerText = '▼'; 
        header.style.borderBottom = '1px solid transparent';
    } else {
        content.style.display = 'none'; 
        icon.innerText = '▲'; 
        header.style.borderBottom = 'none';
    }
}

function applyManualPCR() {
    const inputVal = document.getElementById('pcr-manual-input').value;
    const ratio = parseFloat(inputVal);
    if (isNaN(ratio)) { 
        alert("請輸入有效的數字！"); 
        return; 
    }
    let dateStr = window.officialTradingDate || getTaiwanTradingDate();
    updatePCRUI(ratio, dateStr + " (手動更新)");
}

function initPCRGauge() {
    let fallbackDate = window.officialTradingDate || getTaiwanTradingDate();
    updatePCRUI(100.0, fallbackDate + " (請手動輸入)");
    document.getElementById('pcr-status-badge').innerText = "等待輸入...";
    document.getElementById('pcr-status-badge').style.backgroundColor = "#334155";
    document.getElementById('pcr-status-badge').style.color = "#cbd5e1";
}

function updatePCRUI(ratio, dateStr) {
    document.getElementById('pcr-value-text').innerText = `${ratio.toFixed(1)}%`;
    document.getElementById('pcr-date-text').innerText = `更新日期: ${dateStr}`;
    const badge = document.getElementById('pcr-status-badge');
    let color = '#cbd5e1', bg = '#334155', status = '多空平衡';

    if(ratio >= 120) { status = '極度樂觀 (過熱)'; color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.2)'; }
    else if(ratio >= 100) { status = '偏多佈局'; color = '#f97316'; bg = 'rgba(249, 115, 22, 0.2)'; }
    else if(ratio >= 80 && ratio < 100) { status = '偏空佈局'; color = '#22c55e'; bg = 'rgba(34, 197, 94, 0.2)'; }
    else if(ratio < 80) { status = '極度悲觀 (過冷)'; color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.2)'; }

    badge.innerText = status; 
    badge.style.color = color; 
    badge.style.backgroundColor = bg;
    
    let clampedRatio = Math.max(70, Math.min(130, ratio));
    let degree = ((clampedRatio - 70) / 60) * 180;
    document.getElementById('gauge-needle').style.transform = `rotate(${degree}deg)`;
}