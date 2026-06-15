// 蘇記嘀兜雞 - 訂位系統 核心邏輯與 Supabase 資料庫管理

// 預設本地備用設定 (當 Supabase 還沒連線時使用)
const DEFAULT_SETTINGS = {
  maxCapacity: 40,
  adminPassword: "admin888",
  lunchSlots: ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00"],
  dinnerSlots: ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"],
  holidays: [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20",
    "2026-02-28", "2026-04-03", "2026-04-04", "2026-06-19", "2026-09-25", "2026-10-10"
  ]
};

// 1. 初始化 Supabase 用戶端 (安全地從 localStorage 讀取，並設定您的專案為預設值)
const supabaseUrl = localStorage.getItem("suji_supabase_url") || "https://veoklrkrucgejbscmivy.supabase.co";
const supabaseKey = localStorage.getItem("suji_supabase_key") || "sb_publishable_DPg8x_cU4HENRis8v4GpYA_yw6FFmSl";
let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    // 優先檢查由 CDN 載入的 window.supabase
    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    }
  } catch (e) {
    console.error("Supabase 初始化錯誤:", e);
  }
}

// 2. 自動偵測並注入資料庫連線設定 UI (防硬編碼金鑰上傳 GitHub)
window.addEventListener("DOMContentLoaded", () => {
  // 自動檢查連線參數是否存在
  if (!supabaseUrl || !supabaseKey) {
    injectSupabaseSetupModal();
  }
});

function injectSupabaseSetupModal() {
  // 建立設定 Modal HTML
  const modal = document.createElement("div");
  modal.id = "supabaseSetupOverlay";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0,0,0,0.85)";
  modal.style.zIndex = "99999";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.fontFamily = "'Noto Sans TC', sans-serif";
  modal.style.padding = "20px";

  modal.innerHTML = `
    <div style="background-color: white; border-radius: 12px; padding: 30px; width: 100%; max-width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.25);">
      <h2 style="font-size:20px; font-weight:700; margin-bottom: 8px; color:#1c1917; text-align:center;">🔌 串接 Supabase 雲端資料庫</h2>
      <p style="font-size:13px; color:#78716c; margin-bottom: 20px; text-align:center; line-height:1.4;">
        本系統已升級雲端版！請輸入您的專案 API 金鑰，這將會安全地儲存在此瀏覽器中（不會寫入原始碼上傳至 GitHub）。
      </p>
      
      <div style="margin-bottom:15px;">
        <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px; color:#1c1917;">Project URL (專案網址)</label>
        <input type="text" id="setupDbUrl" placeholder="https://xxxxxx.supabase.co" style="width:100%; padding:10px 12px; border:1px solid #e7e5e4; border-radius:6px; font-size:14px; outline:none;">
      </div>
      
      <div style="margin-bottom:20px;">
        <label style="font-size:13px; font-weight:600; display:block; margin-bottom:6px; color:#1c1917;">API Key (anon/public 金鑰)</label>
        <input type="password" id="setupDbKey" placeholder="eyJhbGciOi..." style="width:100%; padding:10px 12px; border:1px solid #e7e5e4; border-radius:6px; font-size:14px; outline:none;">
      </div>

      <div style="background-color:#faf9f8; border-radius:6px; padding:12px; font-size:12px; color:#b45309; margin-bottom: 20px; line-height:1.4;">
        ⚠️ 注意：送出前，請確保您已於 Supabase SQL Editor 中運行完畢建表 SQL 腳本（請參閱專案開發計畫）。
      </div>

      <button id="setupDbSubmitBtn" style="width:100%; padding:12px; background-color:#c59b27; color:white; border:none; border-radius:6px; font-size:15px; font-weight:700; cursor:pointer;">
        儲存設定並載入系統
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // 點擊儲存按鈕
  document.getElementById("setupDbSubmitBtn").onclick = () => {
    const url = document.getElementById("setupDbUrl").value.trim();
    const key = document.getElementById("setupDbKey").value.trim();

    if (!url || !key) {
      alert("請完整輸入兩個欄位！");
      return;
    }

    localStorage.setItem("suji_supabase_url", url);
    localStorage.setItem("suji_supabase_key", key);

    alert("資料庫參數設定成功，將自動重整載入網頁！");
    window.location.reload();
  };
}

// 清除連線參數（用於切換或除錯）
function resetSupabaseConfig() {
  localStorage.removeItem("suji_supabase_url");
  localStorage.removeItem("suji_supabase_key");
  window.location.reload();
}

// ---------------------------------------------------------
// 3. 非同步資料讀寫核心邏輯 (Supabase API 改寫)
// ---------------------------------------------------------

// 取得雲端設定值
async function getSettings() {
  if (!supabase) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error || !data || data.length === 0) {
      console.warn("未能讀取雲端設定，使用預設值:", error);
      return DEFAULT_SETTINGS;
    }
    
    // 將 row 陣列轉為物件形式
    const settingsObj = {};
    data.forEach(row => {
      settingsObj[row.key] = row.value;
    });

    // 補齊可能缺失的設定欄位
    for (const key in DEFAULT_SETTINGS) {
      if (!(key in settingsObj)) {
        settingsObj[key] = DEFAULT_SETTINGS[key];
      }
    }
    return settingsObj;
  } catch(e) {
    console.error("讀取雲端設定例外情況:", e);
    return DEFAULT_SETTINGS;
  }
}

// 儲存單項雲端設定值 (Upsert)
async function updateSetting(key, value) {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value });
    if (error) {
      console.error(`儲存設定 ${key} 失敗:`, error);
      return false;
    }
    return true;
  } catch(e) {
    console.error("更新設定例外:", e);
    return false;
  }
}

// 取得所有訂位列表 (排除 Cancelled 可以在 UI 端過濾，此處全部拉取以供後台使用)
async function getBookings() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*');
    
    if (error) {
      console.error("獲取訂位清單失敗:", error);
      return [];
    }
    
    // 資料欄位名稱轉換 (資料庫為底線，前端為駝峰字)
    return data.map(b => ({
      id: b.id,
      name: b.name,
      phone: b.phone,
      email: b.email,
      date: b.date,
      time: b.time,
      adults: b.adults,
      kids: b.kids,
      totalGuests: b.total_guests,
      status: b.status,
      createdAt: b.created_at,
      notes: b.notes
    }));
  } catch(e) {
    console.error("獲取訂位清單例外:", e);
    return [];
  }
}

// 新增訂位 (非同步檢查容量並寫入)
async function addBooking(bookingData) {
  if (!supabase) {
    return { success: false, message: "雲端資料庫尚未連接，無法預約。" };
  }
  
  const newBooking = {
    id: "BK" + Math.floor(100000 + Math.random() * 900000),
    name: bookingData.name,
    phone: bookingData.phone,
    email: bookingData.email || "",
    date: bookingData.date,
    time: bookingData.time,
    adults: bookingData.adults,
    kids: bookingData.kids,
    total_guests: bookingData.totalGuests,
    notes: bookingData.notes || "",
    status: "Confirmed"
  };

  // 1. 容量檢查
  const check = await checkCapacityAvailable(newBooking.date, newBooking.time, newBooking.total_guests);
  if (!check.available) {
    return { success: false, message: `該時段容量不足！僅剩 ${check.remaining} 個座位。` };
  }

  try {
    // 2. 寫入 Supabase
    const { error } = await supabase
      .from('bookings')
      .insert([newBooking]);
      
    if (error) {
      console.error("Supabase 寫入訂位失敗:", error);
      return { success: false, message: "資料庫寫入失敗，請稍後再試。" };
    }

    return { 
      success: true, 
      booking: {
        ...newBooking,
        totalGuests: newBooking.total_guests,
        createdAt: new Date().toISOString()
      } 
    };
  } catch (e) {
    console.error("建立訂位例外:", e);
    return { success: false, message: "伺服器例外錯誤，請重試。" };
  }
}

// 變更訂位狀態 (例如 Seated、Cancelled 等)
async function updateBookingStatus(id, newStatus) {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (error) {
      console.error(`變更訂位狀態失敗 (${id}):`, error);
      return false;
    }
    return true;
  } catch(e) {
    console.error("更新狀態例外:", e);
    return false;
  }
}

// 徹底刪除訂位
async function deleteBooking(id) {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error(`刪除訂位失敗 (${id}):`, error);
      return false;
    }
    return true;
  } catch(e) {
    console.error("刪除訂位例外:", e);
    return false;
  }
}

// 依手機號碼模糊查詢訂位列表
async function lookupBookingsByPhone(phone) {
  if (!supabase) return [];
  try {
    const cleanPhone = phone.trim();
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .like('phone', `%${cleanPhone}%`);
      
    if (error) {
      console.error("查詢手機訂位失敗:", error);
      return [];
    }
    
    return data.map(b => ({
      id: b.id,
      name: b.name,
      phone: b.phone,
      email: b.email,
      date: b.date,
      time: b.time,
      adults: b.adults,
      kids: b.kids,
      totalGuests: b.total_guests,
      status: b.status,
      createdAt: b.created_at,
      notes: b.notes
    }));
  } catch(e) {
    console.error("查詢手機例外:", e);
    return [];
  }
}

// 核心容量檢查：1.5 小時 (90 分鐘) 重疊計算 (非同步版)
async function checkCapacityAvailable(dateStr, timeStr, partySize) {
  const settings = await getSettings();
  const maxCapacity = settings.maxCapacity;

  if (!supabase) {
    return { available: true, remaining: maxCapacity, peakUsed: 0 };
  }

  try {
    // 抓取雲端該日期所有非取消的 bookings
    const { data, error } = await supabase
      .from('bookings')
      .select('time, total_guests')
      .eq('date', dateStr)
      .not('status', 'eq', 'Cancelled');

    if (error) {
      console.error("讀取容量重疊資料失敗:", error);
      return { available: false, remaining: 0, peakUsed: 0 };
    }

    const startMin = timeToMinutes(timeStr);
    const endMin = startMin + 90; // 用餐 90 分鐘
    
    // 建立 1440 分鐘的計數陣列
    const minuteOccupancy = new Array(1440).fill(0);

    data.forEach(booking => {
      const bStart = timeToMinutes(booking.time);
      const bEnd = bStart + 90;
      
      for (let m = bStart; m < bEnd; m++) {
        if (m >= 0 && m < 1440) {
          minuteOccupancy[m] += booking.total_guests;
        }
      }
    });

    // 檢查在預定區間內，是否會超出 maxCapacity
    let maxUsed = 0;
    for (let m = startMin; m < endMin; m++) {
      if (m >= 0 && m < 1440) {
        maxUsed = Math.max(maxUsed, minuteOccupancy[m]);
        if (minuteOccupancy[m] + partySize > maxCapacity) {
          return {
            available: false,
            remaining: Math.max(0, maxCapacity - minuteOccupancy[m]),
            peakUsed: minuteOccupancy[m]
          };
        }
      }
    }

    return {
      available: true,
      remaining: maxCapacity - maxUsed,
      peakUsed: maxUsed
    };
  } catch(e) {
    console.error("檢查容量安全例外:", e);
    return { available: false, remaining: 0, peakUsed: 0 };
  }
}

// ---------------------------------------------------------
// 4. 時段與日期判斷相關輔助函式
// ---------------------------------------------------------

// 輔助：時間轉分鐘
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

// 輔助：分鐘轉時間
function minutesToTime(mins) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// 判斷給定日期是否為週末（週六、日）或國定假日
async function isWeekendOrHoliday(dateStr) {
  const settings = await getSettings();
  if (settings.holidays.includes(dateStr)) {
    return true;
  }
  const date = new Date(dateStr);
  const day = date.getDay(); // 0 是週日，6 是週六
  return day === 0 || day === 6;
}

// 取得特定日期之可選預約時段
async function getAvailableSlotsForDate(dateStr) {
  const settings = await getSettings();
  const isHoliday = await isWeekendOrHoliday(dateStr);
  
  if (isHoliday) {
    // 假日與週末：開放中午與晚上
    return {
      lunch: [...settings.lunchSlots],
      dinner: [...settings.dinnerSlots]
    };
  } else {
    // 平日：僅開放晚上
    return {
      lunch: [],
      dinner: [...settings.dinnerSlots]
    };
  }
}

// 取得給定日期所在那一週的「週一到週日」日期列表
function getWeekDays(dateObj) {
  const currentDay = dateObj.getDay();
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  
  const monday = new Date(dateObj);
  monday.setDate(dateObj.getDate() + distanceToMonday);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day);
  }
  return days;
}

// 格式化為 YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 格式化為中文 (例 "6月15日 週一")
function formatDateChinese(dateStr) {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const weekDay = weekDays[date.getDay()];
  
  const todayStr = new Date().toISOString().split("T")[0];
  const suffix = (dateStr === todayStr) ? "（今日）" : "";
  
  return `${month}月${day}日 ${weekDay}${suffix}`;
}
