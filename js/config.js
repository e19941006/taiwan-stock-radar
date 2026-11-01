// ================================================================
// 🌟 Supabase 雲端資料庫與全域常數設定
// ================================================================
const SUPABASE_URL = 'https://dyunjwlwrpudhvfgzoyy.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // 請填入你的 anon public key

// 判斷是否正確填寫金鑰
const isSupabaseConfigured = SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co' && !SUPABASE_URL.includes('YOUR_PROJECT_ID');
const supabaseClient = (isSupabaseConfigured && typeof supabase !== 'undefined')
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const TODAY_PCR_VALUE = 114.67; 
const TODAY_PCR_DATE  = "本期最新"; 

const TWSE_HOLIDAYS = [
    "2026-01-01", "2026-01-02", 
    "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", 
    "2026-02-27", "2026-03-02", 
    "2026-04-03", "2026-04-06", 
    "2026-05-01", 
    "2026-06-19", 
    "2026-09-25", 
    "2026-10-09", "2026-10-10"
];

const STORAGE_KEY = 'taiwan_stock_radar_db';

// 全域狀態變數
let liveScannedResults = []; 
let currentPool = []; 
let memoryDB = {}; 
window.officialTradingDate = null; 
let activeFastProxy = null; 

// DOM 選取器捷徑
function document_select(id) { 
    return document.getElementById(id); 
}