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
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    return `${m}分${s}秒`;
}

function setupDropdownListener() {
    document_select('history-select').addEventListener('change', async (e) => {
        const targetValue = e.target.value;
        document_select('grid').innerHTML = '';
        currentPool = []; 
        if (targetValue === 'live') {
            document_select('progress-area').style.display = 'block';
            await runHighSpeedScan();
        } else {
            document_select('progress-area').style.display = 'block';
            await loadAndCompareHistory(targetValue);
        }
    });
}

function setupSortListener() {
    document_select('sort-select').addEventListener('change', () => applySortAndRender());
    document_select('filter-select').addEventListener('change', () => applySortAndRender());
}

function refreshDropdown() {
    const select = document_select('history-select');
    const currentVal = select.value;
    select.innerHTML = '<option value="live">📡 執行今日即時掃描</option>';
    const db = memoryDB; 
    const savedDates = Object.keys(db).sort().reverse(); 
    savedDates.forEach(date => {
        const option = document.createElement('option'); 
        option.value = date;
        const count = Array.isArray(db[date]) ? db[date].length : 0;
        option.innerText = `📁 歷史覆盤 [${date}] (${count}檔)`; 
        select.appendChild(option);
    });
    if (currentVal && Array.from(select.options).some(opt => opt.value === currentVal)) {
        select.value = currentVal;
    }
}

function applySortAndRender() {
    const sortVal = document_select('sort-select').value;
    const filterMinFire = parseInt(document_select('filter-select').value, 10);
    
    let filtered = currentPool.filter(item => item.fireScore >= filterMinFire);
    
    if (sortVal !== 'none') {
        filtered.sort((a, b) => {
            const priceA = a.currentPrice !== null ? a.currentPrice : a.savedPrice;
            const priceB = b.currentPrice !== null ? b.currentPrice : b.savedPrice;
            if (sortVal === 'price-desc') return priceB - priceA;
            if (sortVal === 'price-asc') return priceA - priceB;
            if (sortVal === 'fire-desc') return b.fireScore - a.fireScore;
            if (sortVal === 'fire-asc') return a.fireScore - b.fireScore;
            return 0;
        });
    }
    
    document_select('grid').innerHTML = '';
    filtered.forEach(item => {
        renderCard(item.stock, item.savedPrice, item.currentPrice, item.signals, item.chartDataToDraw, item.isHistoryView, item.fireScore);
    });
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options; 
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id); 
        return response;
    } catch (e) { 
        clearTimeout(id); 
        throw e; 
    }
}

const getProxyList = (target) => {
    let list = [
        { type: 'raw', url: target }, 
        { type: 'json', url: `https://api.allorigins.win/get?url=${encodeURIComponent(target)}` },
        { type: 'raw', url: `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(target)}` },
        { type: 'raw', url: `https://corsproxy.io/?url=${encodeURIComponent(target)}` },
        { type: 'raw', url: `https://thingproxy.freeboard.io/fetch/${target}` },
        { type: 'raw', url: `https://yacdn.org/proxy/${target}` }
    ];
    
    if (activeFastProxy) {
        if (activeFastProxy !== 'DIRECT') {
            list.sort((a, b) => a.url.includes(activeFastProxy) ? -1 : b.url.includes(activeFastProxy) ? 1 : 0);
        }
    } else {
        const direct = list.shift();
        list.sort(() => Math.random() - 0.5);
        list.unshift(direct);
    }
    return list;
};

async function fetchFinMindFallback(stockIdStr) {
    try {
        const cleanId = stockIdStr.replace('.TW', '').replace('.TWO', '');
        let d = new Date(); 
        d.setMonth(d.getMonth() - 3);
        const startDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const fmUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${cleanId}&start_date=${startDate}`;
        
        const res = await fetchWithTimeout(fmUrl, { timeout: 6000 });
        if(res.ok) {
            const json = await res.json();
            if(json.msg === 'success' && json.data && json.data.length > 0) {
                let cleanData = [];
                json.data.forEach(item => {
                    cleanData.push({
                        date: item.date, open: item.open, high: item.max, low: item.min, close: item.close, volume: item.Trading_Volume
                    });
                });
                return cleanData;
            }
        }
    } catch(e) {}
    return null;
}

async function fetchStockData(stock, retries = 2, isFlipped = false) {
    const queryNode = Math.random() > 0.5 ? 'query1' : 'query2';
    const targetUrl = `https://${queryNode}.finance.yahoo.com/v8/finance/chart/${stock.id}?range=3mo&interval=1d`;
    const currentProxies = getProxyList(targetUrl);

    for (let proxy of currentProxies) {
        try {
            await new Promise(r => setTimeout(r, 150)); 
            const res = await fetchWithTimeout(proxy.url, { cache: 'no-store', timeout: 7000 }); 
            
            if (res.status === 404 && !isFlipped) {
                stock.id = stock.id.endsWith('.TW') ? stock.id.replace('.TW', '.TWO') : stock.id.replace('.TWO', '.TW');
                return fetchStockData(stock, retries, true);
            }

            if (!res.ok) continue; 
            
            let json;
            if (proxy.type === 'json') {
                const wrapper = await res.json();
                if(!wrapper.contents) continue;
                json = JSON.parse(wrapper.contents); 
            } else {
                json = await res.json();
            }

            if (!json.chart || !json.chart.result) continue;
            
            if (!activeFastProxy && proxy.url !== targetUrl) {
                activeFastProxy = proxy.url.split('?')[0]; 
            } else if (!activeFastProxy && proxy.url === targetUrl) {
                activeFastProxy = 'DIRECT'; 
            }

            const result = json.chart.result[0]; 
            const quote = result.indicators.quote[0];
            let cleanData = [];
            
            for(let j = 0; j < quote.close.length; j++) {
                if (quote.close[j] !== null && quote.open[j] !== null) {
                    const twTime = result.timestamp[j] * 1000 + (8 * 3600 * 1000);
                    const d = new Date(twTime);
                    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
                    cleanData.push({ 
                        date: dateStr, open: quote.open[j], high: quote.high[j], 
                        low: quote.low[j], close: quote.close[j], volume: quote.volume[j] 
                    });
                }
            }

            if (cleanData.length > 0 && result.meta && result.timestamp) {
                const meta = result.meta;
                const livePrice = meta.regularMarketPrice;
                const liveVol = meta.regularMarketVolume || 0;
                const metaTime = meta.regularMarketTime;
                const lastTime = result.timestamp[result.timestamp.length - 1];
                const prevClose = meta.chartPreviousClose || meta.previousClose || livePrice;

                if (metaTime && lastTime && (metaTime - lastTime > 43200)) {
                    const twTime = metaTime * 1000 + (8 * 3600 * 1000);
                    const d = new Date(twTime);
                    const stitchedDateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
                    cleanData.push({
                        date: stitchedDateStr, open: prevClose, high: Math.max(prevClose, livePrice), low: Math.min(prevClose, livePrice), close: livePrice, volume: liveVol
                    });
                } else {
                    let lastCandle = cleanData[cleanData.length - 1];
                    lastCandle.close = livePrice; 
                    lastCandle.high = Math.max(lastCandle.high, livePrice);
                    lastCandle.low = Math.min(lastCandle.low, livePrice); 
                    lastCandle.volume = Math.max(lastCandle.volume, liveVol);
                }
                
                if (!window.officialTradingDate) {
                    window.officialTradingDate = cleanData[cleanData.length - 1].date;
                }
            }
            if(cleanData.length > 0) return cleanData;
        } catch (err) {}
    }

    try {
        const fmData = await fetchFinMindFallback(stock.id);
        if (fmData && fmData.length > 0) {
            if (!window.officialTradingDate) window.officialTradingDate = fmData[fmData.length - 1].date;
            return fmData;
        }
    } catch(e) {}

    if (retries > 0) {
        activeFastProxy = null;
        await new Promise(r => setTimeout(r, 1500));
        return fetchStockData(stock, retries - 1, isFlipped);
    }
    throw new Error('流量冷卻中');
}

async function runHighSpeedScan() {
    liveScannedResults = []; 
    currentPool = []; 
    window.officialTradingDate = null; 
    activeFastProxy = null; 
    
    document_select('scan-icon').className = 'loader-icon'; 
    document_select('scan-icon').innerText = '';
    document_select('panel-status-title').innerText = `多頭主力雷達 (${masterPool.length}檔波段嚴選掃描中)...`;
    
    startTimer();
    const batchSize = 2; 
    const total = masterPool.length;
    
    for (let i = 0; i < total; i += batchSize) {
        if(document_select('history-select').value !== 'live') { 
            stopTimer(); 
            return; 
        }

        const batch = masterPool.slice(i, i + batchSize);
        const progressPercent = Math.round((i / total) * 100);
        document_select('progress').style.width = progressPercent + `%`;
        document_select('percentage').innerText = progressPercent + `%`;
        document_select('current-action').innerText = `巡航分析: ${batch.map(s => s.name).join(', ')} (邊掃邊存中...)`;

        await Promise.all(batch.map(async (stock) => {
            try {
                const data = await fetchStockData(stock);
                if (data && data.length >= 30) {
                    const todayNode = data[data.length - 1];
                    const todayPrice = todayNode.close; 
                    const todayVolume = todayNode.volume;
                    
                    if (todayPrice > 5 && todayPrice < 2000 && todayVolume >= 2000000) {
                        const signals = analyzeTrend(data);
                        if (signals.length > 0) {
                            const sliceData = data.slice(-50);
                            const fireScore = calculateFireScore(signals, sliceData);
                            
                            if (fireScore >= 5) {
                                const newItem = {
                                    stock: stock, savedPrice: todayPrice, currentPrice: todayPrice,
                                    signals: signals, chartDataToDraw: sliceData, isHistoryView: false, fireScore: fireScore
                                };
                                liveScannedResults.push(newItem); 
                                currentPool.push(newItem);
                                applySortAndRender(); 
                            }
                        }
                    }
                }
            } catch (err) { console.warn(`跳過 ${stock.name}`, err); }
        }));
        await new Promise(r => setTimeout(r, 1800)); 
        
        saveRadarData(false);
    }
    const totalTime = stopTimer();
    finishProgress(`全市場 ${masterPool.length} 檔主力股掃描完畢！(總耗時: ${totalTime})`, '今日雷達掃描任務完成');
    
    saveRadarData(true);
    applySortAndRender(); 
}

async function loadAndCompareHistory(dateStr) {
    document_select('scan-icon').className = 'loader-icon'; 
    document_select('scan-icon').innerText = '';
    document_select('panel-status-title').innerText = `正在回溯 [${dateStr}] 名單...`;
    const db = memoryDB; 
    const historyItems = Array.isArray(db[dateStr]) ? db[dateStr] : [];
    if(historyItems.length === 0) {
        document_select('grid').innerHTML = `<div style="color:#64748b; padding:20px;">當日無符合嚴格 5 星標準之股票。</div>`;
        finishProgress('比對結束', `歷史名單為空`); 
        return;
    }
    const total = historyItems.length; 
    currentPool = [];
    window.officialTradingDate = null; 
    activeFastProxy = null;
    startTimer();

    for (let i = 0; i < total; i++) {
        if(document_select('history-select').value !== dateStr) { 
            stopTimer(); 
            return; 
        }
        const item = historyItems[i];
        document_select('progress').style.width = Math.round(((i + 1) / total) * 100) + `%`;
        document_select('percentage').innerText = Math.round(((i + 1) / total) * 100) + `%`;
        document_select('current-action').innerText = `時空校正中: ${item.stock.name}`;
        
        try {
            const latestData = await fetchStockData(item.stock);
            let currentPrice = latestData ? latestData[latestData.length - 1].close : null;
            let chartDataToDraw = latestData ? latestData.slice(-50) : [];
            let correctedSavedPrice = item.savedPrice || item.price; 
            let newScore = calculateFireScore(item.signals || [], chartDataToDraw);
            
            if (newScore >= 5) {
                const newItem = {
                    stock: item.stock, savedPrice: correctedSavedPrice, currentPrice: currentPrice,
                    signals: item.signals, chartDataToDraw: chartDataToDraw, isHistoryView: true, fireScore: newScore
                };
                currentPool.push(newItem); 
                applySortAndRender();
            }
        } catch (err) { 
            let newScore = calculateFireScore(item.signals || [], []);
            if (newScore >= 5) {
                const newItem = {
                    stock: item.stock, savedPrice: item.savedPrice || item.price, currentPrice: null,
                    signals: item.signals, chartDataToDraw: [], isHistoryView: true, fireScore: newScore
                };
                currentPool.push(newItem); 
                applySortAndRender();
            }
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    const totalTime = stopTimer();
    finishProgress(`歷史名單 [${dateStr}] 價位精確對齊完成！(總耗時: ${totalTime})`, '覆盤績效與最新K線已更新');
    applySortAndRender();
}

function finishProgress(actionMsg, titleMsg) {
    document_select('progress').style.width = `100%`; 
    document_select('percentage').innerText = `100%`;
    document_select('current-action').innerText = actionMsg;
    document_select('scan-icon').className = ''; 
    document_select('scan-icon').innerText = '✅';
    document_select('panel-status-title').innerText = titleMsg;
    setTimeout(() => { document_select('progress-area').style.display = 'none'; }, 2000);
}

function renderCard(stock, savedPrice, currentPrice, signals, chartDataToDraw, isHistoryView, fireScore) {
    const grid = document_select('grid');
    const tagsHtml = signals.map(sig => `<div class="tag">${sig}</div>`).join('');
    const canvasId = `canvas-${stock.id.replace('.', '-')}-${Math.random().toString(36).substr(2, 9)}`;
    
    const cleanId = stock.id.replace('.TW', '').replace('.TWO', '');
    const dogUrl = `https://statementdog.com/analysis/${cleanId}`;
    
    const activeFires = '🔥'.repeat(fireScore); 
    const inactiveFires = '🔥'.repeat(10 - fireScore);
    
    let currentPriceHtml = '', returnHtml = '';

    if (currentPrice === null) {
        currentPriceHtml = `<span class="error-text">⚠️ 流量冷卻中</span>`;
        returnHtml = `<span class="comp-val-return" style="color: #64748b;">--</span>`;
    } else {
        const returnPercent = (((currentPrice - savedPrice) / savedPrice) * 100).toFixed(1);
        let returnColor = '#94a3b8'; 
        let returnSign = '';
        if (parseFloat(returnPercent) > 0) { 
            returnColor = '#ef4444'; 
            returnSign = '+'; 
        } else if (parseFloat(returnPercent) < 0) { 
            returnColor = '#22c55e'; 
        }

        currentPriceHtml = `<span class="comp-val-new" style="color: ${isHistoryView ? '#f8fafc' : '#a855f7'}">${isHistoryView ? currentPrice.toFixed(1) : '監測中'}</span>`;
        returnHtml = `<span class="comp-val-return" style="color: ${returnColor}">${returnSign}${returnPercent}%</span>`;
    }

    const cardHtml = `
        <div class="card">
            <div class="card-header">
                <div>
                    <h3 class="stock-name">${stock.name}<span class="sector-tag">${stock.sector || '台股'}</span></h3>
                    <span class="stock-id">${cleanId}</span>
                    <a href="${dogUrl}" target="_blank" class="dog-link" title="前往財報狗查看基本面">🐶 財報狗</a>
                </div>
                <div class="fire-rating-box"><div class="fire-rating-title">波段潛力 (滿分10星)</div><div class="fire-rating-icons"><span class="fire-active">${activeFires}</span><span class="fire-inactive">${inactiveFires}</span></div></div>
            </div>
            <div class="price-compare">
                <div class="comp-item"><span class="comp-label">${isHistoryView ? '入選日收盤' : '今日收盤'}</span><span class="comp-val-old">${savedPrice.toFixed(1)}</span></div>
                <div class="comp-item"><span class="comp-label">${isHistoryView ? '當前最新' : '狀態'}</span>${currentPriceHtml}</div>
                <div class="comp-item"><span class="comp-label">區間報酬</span>${returnHtml}</div>
            </div>
            <div class="chart-container">
                <div class="chart-legend"><span class="legend-5ma">一 5MA</span>  <span class="legend-20ma">一 20MA</span></div>
                <canvas id="${canvasId}" width="260" height="110"></canvas>
            </div>
            <div class="tags">${tagsHtml}</div>
        </div>`;
    grid.insertAdjacentHTML('beforeend', cardHtml); 
    drawProfessionalChart(canvasId, chartDataToDraw);
}

// 應用程式進入點
window.onload = async () => {
    await initDBFromSupabase();
    try { cleanUpGhostDates(); } catch (e) {}
    try { 
        refreshDropdown(); 
        setupDropdownListener(); 
        setupSortListener(); 
    } catch (e) {}
    
    initPCRGauge();
    document_select('panel-status-title').innerText = `多頭主力雷達 (${masterPool.length}檔防阻擋掃描中)...`;
    await runHighSpeedScan(); 
};