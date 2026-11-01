// ================================================================
// 🌟 HTML5 Canvas 原生 K 線圖與均線繪製引擎
// ================================================================

function drawProfessionalChart(canvasId, chartDataArray) {
    const canvas = document_select(canvasId); 
    if (!canvas || !chartDataArray || chartDataArray.length < 30) return;
    
    const ctx = canvas.getContext('2d'); 
    const drawDays = 30; 
    const startIndex = chartDataArray.length - drawDays; 
    const chartData = chartDataArray.slice(-drawDays);
    const width = canvas.width; 
    const height = canvas.height;
    const priceAreaHeight = height * 0.70; 
    const volAreaHeight = height * 0.25; 
    const padding = 5; 
    
    let maxPrice = -Infinity, minPrice = Infinity, maxVol = 0;
    chartData.forEach(d => {
        if (d.high > maxPrice) maxPrice = d.high; 
        if (d.low < minPrice) minPrice = d.low; 
        if (d.volume > maxVol) maxVol = d.volume;
    });
    
    const priceRange = maxPrice - minPrice || 1;
    const getScaleY = (price) => padding + priceAreaHeight - padding - ((price - minPrice) / priceRange) * (priceAreaHeight - padding);
    const getVolY = (vol) => height - (vol / maxVol) * volAreaHeight;
    const barWidth = width / drawDays; 
    const spacing = 1.5;

    // 計算 5MA 與 20MA
    const ma5Points = [], ma20Points = [];
    for(let i = 0; i < drawDays; i++) {
        const actualIndex = startIndex + i; 
        let sum5 = 0, sum20 = 0;
        for(let j = 0; j < 5; j++) sum5 += chartDataArray[actualIndex - j].close;
        for(let j = 0; j < 20; j++) sum20 += chartDataArray[actualIndex - j].close;
        const x = i * barWidth + barWidth / 2;
        ma5Points.push({ x: x, y: getScaleY(sum5 / 5) }); 
        ma20Points.push({ x: x, y: getScaleY(sum20 / 20) });
    }

    // 繪製蠟燭線與成交量
    chartData.forEach((d, i) => {
        const x = i * barWidth + barWidth / 2; 
        const isUp = d.close >= d.open; 
        const color = isUp ? '#ef4444' : '#22c55e';
        
        ctx.strokeStyle = color; 
        ctx.fillStyle = color;
        
        const volX = i * barWidth + spacing; 
        const volW = barWidth - (spacing * 2); 
        const volY = getVolY(d.volume);
        
        ctx.globalAlpha = 0.4; 
        ctx.fillRect(volX, volY, volW, height - volY); 
        ctx.globalAlpha = 1.0;
        
        ctx.lineWidth = 1; 
        ctx.beginPath(); 
        ctx.moveTo(x, getScaleY(d.high)); 
        ctx.lineTo(x, getScaleY(d.low)); 
        ctx.stroke();
        
        let boxH = Math.abs(getScaleY(d.open) - getScaleY(d.close)); 
        if (boxH < 1) boxH = 1;
        ctx.fillRect(volX, Math.min(getScaleY(d.open), getScaleY(d.close)), volW, boxH);
    });

    // 繪製均線
    const drawLine = (points, color) => {
        ctx.beginPath(); 
        ctx.strokeStyle = color; 
        ctx.lineWidth = 1.5;
        points.forEach((p, i) => { 
            if (i === 0) ctx.moveTo(p.x, p.y); 
            else ctx.lineTo(p.x, p.y); 
        }); 
        ctx.stroke();
    }; 
    drawLine(ma5Points, '#eab308'); 
    drawLine(ma20Points, '#3b82f6');
}