// ================================================================
// 🌟 資料儲存與 Supabase / LocalStorage 同步模組
// ================================================================

function safeGetItem(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
function safeSetItem(key, value) { try { localStorage.setItem(key, value); } catch(e) {} }
function safeRemoveItem(key) { try { localStorage.removeItem(key); } catch(e) {} }

function getLocalDB() {
    try {
        const data = safeGetItem(STORAGE_KEY);
        if (!data) return {};
        const parsed = JSON.parse(data);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        return parsed;
    } catch (e) { safeRemoveItem(STORAGE_KEY); return {}; }
}

function getDB() {
    return memoryDB;
}

async function initDBFromSupabase() {
    memoryDB = getLocalDB();
    if (!supabaseClient) return memoryDB;
    
    try {
        const { data, error } = await supabaseClient
            .from('radar_history')
            .select('trade_date, records');
        
        if (error) {
            console.warn('Supabase 讀取失敗，使用本機暫存:', error.message);
            return memoryDB;
        }
        
        if (data && Array.isArray(data)) {
            data.forEach(row => {
                memoryDB[row.trade_date] = row.records;
            });
            safeSetItem(STORAGE_KEY, JSON.stringify(memoryDB));
        }
    } catch (err) {
        console.warn('連線 Supabase 異常:', err);
    }
    return memoryDB;
}

function cleanUpGhostDates() {
    try {
        const db = memoryDB; 
        let changed = false;
        Object.keys(db).forEach(dateStr => {
            const d = new Date(dateStr);
            let dateMatchedHoliday = TWSE_HOLIDAYS.includes(dateStr);
            if(dateStr.includes("06-19")) dateMatchedHoliday = true;

            if (isNaN(d.getTime()) || d.getDay() === 0 || d.getDay() === 6 || dateMatchedHoliday) { 
                delete db[dateStr]; 
                changed = true; 
            } else if (Array.isArray(db[dateStr])) {
                const originalLen = db[dateStr].length;
                db[dateStr] = db[dateStr].filter(item => {
                    if (!item.signals) return false;
                    let score = 0; 
                    let hasMain = false;
                    if (item.signals.includes('🚀 帶量突破月線')) { score += 4; hasMain = true; }
                    else if (item.signals.includes('🚀 帶量月線上攻')) score += 2;
                    if (item.signals.includes('✨ 5日/20日金叉')) { score += 4; hasMain = true; }
                    if (item.signals.includes('📊 MACD 綠轉紅')) { score += 3; hasMain = true; }
                    else if (item.signals.includes('📈 MACD 紅柱擴大')) score += 1;
                    if (item.signals.includes('📈 連 3 日收紅K')) score += 1;
                    if (item.signals.includes('🔥 轉折強勢紅K')) score += 1;
                    if (item.signals.includes('💥 量增兩倍')) score += 1;
                    
                    if (!hasMain && score >= 5) score = 4;
                    item.fireScore = score > 10 ? 10 : score;
                    return item.fireScore >= 5;
                });
                
                if (db[dateStr].length !== originalLen) changed = true;
                
                const todayStr = getTaiwanTradingDate(new Date());
                if (db[dateStr].length === 0 && dateStr !== todayStr) {
                    delete db[dateStr]; 
                    changed = true; 
                }
            }
        });
        if(changed) safeSetItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) { safeRemoveItem(STORAGE_KEY); }
}

function getTaiwanTradingDate(dateObj) {
    let d = dateObj ? new Date(dateObj) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    let localD = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    while (true) {
        let day = localD.getDay();
        let dateStr = `${localD.getFullYear()}-${String(localD.getMonth() + 1).padStart(2, '0')}-${String(localD.getDate()).padStart(2, '0')}`;
        
        let dateMatchedHoliday = TWSE_HOLIDAYS.includes(dateStr);
        if (dateStr.includes('06-19')) dateMatchedHoliday = true;

        if (day === 0 || day === 6 || dateMatchedHoliday) {
            localD.setDate(localD.getDate() - 1);
        } else {
            return dateStr;
        }
    }
}

let supabaseDebounceTimer = null;
async function saveRadarData(syncToSupabaseImmediately = false) {
    try {
        let rawDate = window.officialTradingDate || new Date();
        const safeDateStr = getTaiwanTradingDate(rawDate);
        
        const minimalResults = liveScannedResults.map(item => ({
            stock: {
                id: item.stock.id,
                name: item.stock.name,
                sector: item.stock.sector || '台股'
            },
            savedPrice: item.savedPrice, 
            signals: item.signals, 
            fireScore: item.fireScore
        }));
        
        memoryDB[safeDateStr] = minimalResults;
        const sortedDates = Object.keys(memoryDB).sort();
        if (sortedDates.length > 30) { 
            for(let i = 0; i < sortedDates.length - 30; i++) delete memoryDB[sortedDates[i]]; 
        }
        safeSetItem(STORAGE_KEY, JSON.stringify(memoryDB)); 
        refreshDropdown(); 

        if (supabaseClient) {
            if (syncToSupabaseImmediately) {
                if (supabaseDebounceTimer) clearTimeout(supabaseDebounceTimer);
                await supabaseClient
                    .from('radar_history')
                    .upsert({
                        trade_date: safeDateStr,
                        records: minimalResults
                    }, { onConflict: 'trade_date' });
                console.log('✅ Supabase 雲端資料同步完成:', safeDateStr);
            } else {
                if (supabaseDebounceTimer) clearTimeout(supabaseDebounceTimer);
                supabaseDebounceTimer = setTimeout(async () => {
                    try {
                        await supabaseClient
                            .from('radar_history')
                            .upsert({
                                trade_date: safeDateStr,
                                records: minimalResults
                            }, { onConflict: 'trade_date' });
                    } catch (err) { console.warn('Supabase 背景同步略過:', err); }
                }, 5000);
            }
        }
    } catch (e) { console.error('儲存紀錄失敗:', e); }
}