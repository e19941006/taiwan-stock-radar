// ================================================================
// 🌟 技術分析與多頭嚴選評分引擎
// ================================================================

function analyzeTrend(data) {
    if (data.length < 30) return [];
    const signals = [];
    const tIndex = data.length - 1;
    const yIndex = data.length - 2;

    const getMA = (dataArray, period, index, key = 'close') => {
        if (index < period - 1) return null;
        let sum = 0;
        for (let i = 0; i < period; i++) sum += dataArray[index - i][key];
        return sum / period;
    };

    const ma20_t = getMA(data, 20, tIndex);
    const ma20_y = getMA(data, 20, yIndex);
    const ma5_t = getMA(data, 5, tIndex);
    const ma5_y = getMA(data, 5, yIndex);
    const vMA5_t = getMA(data, 5, tIndex, 'volume');

    const today = data[tIndex];
    const yesterday = data[yIndex];

    // 1. 帶量突破關鍵均線
    if (ma20_t && ma20_y && vMA5_t) {
        if (yesterday.close <= ma20_y && today.close > ma20_t && today.volume > vMA5_t) {
            signals.push('🚀 帶量突破月線');
        } else if (today.close > ma20_t && today.volume > vMA5_t && today.close > today.open) {
            signals.push('🚀 帶量月線上攻');
        }
    }

    // 2. 均線黃金交叉
    if (ma5_y !== null && ma20_y !== null && ma5_t !== null && ma20_t !== null) {
        if (ma5_y <= ma20_y && ma5_t > ma20_t) {
            signals.push('✨ 5日/20日金叉');
        }
    }

    // 3. MACD 柱狀圖翻紅 或 持續擴大
    const calcEMA = (dataArray, period) => {
        const k = 2 / (period + 1);
        let ema = [dataArray[0].close];
        for (let i = 1; i < dataArray.length; i++) {
            ema.push(dataArray[i].close * k + ema[i - 1] * (1 - k));
        }
        return ema;
    };
    const ema12 = calcEMA(data, 12);
    const ema26 = calcEMA(data, 26);
    const dif = ema12.map((v, i) => v - ema26[i]);
    
    let dem = [dif[0]];
    const k9 = 2 / 10; 
    for (let i = 1; i < dif.length; i++) {
        dem.push(dif[i] * k9 + dem[i - 1] * (1 - k9));
    }
    const osc = dif.map((v, i) => v - dem[i]);
    
    const osc_t = osc[tIndex];
    const osc_y = osc[yIndex];

    if (osc_t !== undefined && osc_y !== undefined) {
        if (osc_t > 0 && osc_y <= 0) {
            signals.push('📊 MACD 綠轉紅');
        } else if (osc_t > 0 && osc_t > osc_y) {
            signals.push('📈 MACD 紅柱擴大');
        }
    }

    // 4. K 線型態輔助
    if (tIndex >= 2) {
        const day3 = data[tIndex - 2];
        if (today.close > today.open && yesterday.close > yesterday.open && day3.close > day3.open) { 
            signals.push('📈 連 3 日收紅K'); 
        }
        if (today.close > today.open && today.close > yesterday.close && yesterday.close <= yesterday.open) { 
            signals.push('🔥 轉折強勢紅K'); 
        }
    }

    return signals;
}

function calculateFireScore(signals, chartDataToDraw) {
    let score = 0; 
    let hasMain = false; 
    
    if (signals.includes('🚀 帶量突破月線')) { score += 4; hasMain = true; }
    else if (signals.includes('🚀 帶量月線上攻')) score += 2;

    if (signals.includes('✨ 5日/20日金叉')) { score += 4; hasMain = true; }
    
    if (signals.includes('📊 MACD 綠轉紅')) { score += 3; hasMain = true; }
    else if (signals.includes('📈 MACD 紅柱擴大')) score += 1;

    if (signals.includes('📈 連 3 日收紅K')) score += 1;
    if (signals.includes('🔥 轉折強勢紅K')) score += 1;
    
    if (chartDataToDraw && chartDataToDraw.length >= 2) {
        const latestD = chartDataToDraw[chartDataToDraw.length - 1];
        const prevD = chartDataToDraw[chartDataToDraw.length - 2];
        if (latestD.volume > prevD.volume * 2) {
            score += 1;
            if (!signals.includes('💥 量增兩倍')) signals.push('💥 量增兩倍');
        }
    }
    
    if (!hasMain && score >= 5) {
        score = 4;
    }
    
    return score > 10 ? 10 : score;
}