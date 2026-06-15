// 蘇記豬肚雞 - 訂位系統 核心邏輯與資料管理

// 初始化預設設定
const DEFAULT_SETTINGS = {
  maxCapacity: 40, // 預設同時間最大客容量
  adminPassword: "admin888", // 預設管理者密碼
  lunchSlots: ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00"],
  dinnerSlots: ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"],
  // 2026 台灣主要國定假日
  holidays: [
    "2026-01-01", // 元旦
    "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", // 農曆春節連假 (除夕2/16)
    "2026-02-28", // 和平紀念日
    "2026-04-03", // 兒童節
    "2026-04-04", // 清明節
    "2026-06-19", // 端午節
    "2026-09-25", // 中秋節
    "2026-10-10"  // 國慶日
  ]
};

// 從 localStorage 讀取或寫入預設設定
function getSettings() {
  const settings = localStorage.getItem("suji_settings");
  if (!settings) {
    localStorage.setItem("suji_settings", JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }
  return JSON.parse(settings);
}

function saveSettings(settings) {
  localStorage.setItem("suji_settings", JSON.stringify(settings));
}

// 輔助函式：時間字串轉分鐘數 (例如 "18:30" -> 1110)
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

// 輔助函式：分鐘數轉時間字串 (例如 1110 -> "18:30")
function minutesToTime(mins) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// 判斷給定日期是否為週末（週六、日）或國定假日
function isWeekendOrHoliday(dateStr) {
  const settings = getSettings();
  if (settings.holidays.includes(dateStr)) {
    return true;
  }
  const date = new Date(dateStr);
  const day = date.getDay(); // 0 是週日，6 是週六
  return day === 0 || day === 6;
}

// 取得特定日期之可選預約時段
function getAvailableSlotsForDate(dateStr) {
  const settings = getSettings();
  if (isWeekendOrHoliday(dateStr)) {
    // 假日與週末：中午 11:00-14:00 及 晚上 17:00-22:00
    return {
      lunch: [...settings.lunchSlots],
      dinner: [...settings.dinnerSlots]
    };
  } else {
    // 平日：僅 晚上 17:00-22:00
    return {
      lunch: [],
      dinner: [...settings.dinnerSlots]
    };
  }
}

// 核心容量檢查：1.5 小時 (90 分鐘) 重疊計算
// 檢查在某日期的某時段，若預定 partySize 人，是否會超出 maxCapacity
function checkCapacityAvailable(dateStr, timeStr, partySize) {
  const settings = getSettings();
  const maxCapacity = settings.maxCapacity;
  const bookings = getBookings().filter(b => b.date === dateStr && b.status !== "Cancelled");
  
  const startMin = timeToMinutes(timeStr);
  const endMin = startMin + 90; // 用餐時間 1.5 小時
  
  // 檢查在 [startMin, endMin) 這 90 分鐘內的「每一分鐘」是否會超載
  // 建立當日每一分鐘的座位佔用計數器 (1440分鐘/天)
  const minuteOccupancy = new Array(1440).fill(0);
  
  // 遍歷所有當天已存在的訂位，將佔用人數加到對應的分鐘區間內
  bookings.forEach(booking => {
    const bStart = timeToMinutes(booking.time);
    const bEnd = bStart + 90;
    
    // 在已預訂的區間內，累加人數
    for (let m = bStart; m < bEnd; m++) {
      if (m >= 0 && m < 1440) {
        minuteOccupancy[m] += booking.totalGuests;
      }
    }
  });
  
  // 模擬加入這筆新的訂位，檢查在此 90 分鐘內，是否會有任何一分鐘超過 maxCapacity
  for (let m = startMin; m < endMin; m++) {
    if (m >= 0 && m < 1440) {
      if (minuteOccupancy[m] + partySize > maxCapacity) {
        // 傳回剩餘可用人數與是否可預約
        const currentUsed = minuteOccupancy[m];
        const remaining = maxCapacity - currentUsed;
        return {
          available: false,
          remaining: Math.max(0, remaining),
          peakUsed: currentUsed
        };
      }
    }
  }
  
  return {
    available: true,
    remaining: maxCapacity,
    peakUsed: 0
  };
}

// 取得訂位資料列表
function getBookings() {
  const bookings = localStorage.getItem("suji_bookings");
  if (!bookings) {
    const initialBookings = generateMockBookings();
    localStorage.setItem("suji_bookings", JSON.stringify(initialBookings));
    return initialBookings;
  }
  return JSON.parse(bookings);
}

// 儲存訂位資料列表
function saveBookings(bookings) {
  localStorage.setItem("suji_bookings", JSON.stringify(bookings));
}

// 新增訂位
function addBooking(bookingData) {
  const bookings = getBookings();
  const newBooking = {
    id: "BK" + Math.floor(100000 + Math.random() * 900000),
    createdAt: new Date().toISOString(),
    status: "Confirmed", // 預設直接確認
    ...bookingData
  };
  
  // 進行最後容量安全校驗
  const check = checkCapacityAvailable(newBooking.date, newBooking.time, newBooking.totalGuests);
  if (!check.available) {
    return { success: false, message: `該時段容量不足！僅剩 ${check.remaining} 個座位。` };
  }
  
  bookings.push(newBooking);
  saveBookings(bookings);
  return { success: true, booking: newBooking };
}

// 變更訂位狀態 (例如 Cancelled, Seated 等)
function updateBookingStatus(id, newStatus) {
  const bookings = getBookings();
  const index = bookings.findIndex(b => b.id === id);
  if (index !== -1) {
    bookings[index].status = newStatus;
    saveBookings(bookings);
    return true;
  }
  return false;
}

// 刪除訂位
function deleteBooking(id) {
  const bookings = getBookings();
  const filtered = bookings.filter(b => b.id !== id);
  saveBookings(filtered);
  return true;
}

// 用手機號碼查詢訂位
function lookupBookingsByPhone(phone) {
  const cleanPhone = phone.trim();
  return getBookings().filter(b => b.phone.includes(cleanPhone));
}

// 產生模擬資料，確保初次打開管理後台時有豐富的視覺效果
function generateMockBookings() {
  const list = [];
  const today = new Date();
  
  // 產生本週幾天內的模擬訂位
  const names = ["陳志明", "林秀琴", "張雅婷", "李冠宇", "王俊傑", "黃婷婷", "郭美玲", "曾怡君", "周杰倫", "蔡依林"];
  const phones = ["0912345678", "0923456789", "0934567890", "0945678901", "0956789012", "0967890123", "0978901234", "0989012345", "0911222333", "0922333444"];
  const emails = ["chen@gmail.com", "lin@gmail.com", "chang@gmail.com", "", "wang@yahoo.com.tw", "huang@gmail.com", "", "tseng@outlook.com", "jay@gmail.com", "jolin@gmail.com"];
  
  // 取得本週週一的日期
  const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMonday);
  
  // 填補本週每天的資料
  for (let i = 0; i < 7; i++) {
    const currentIterDate = new Date(monday);
    currentIterDate.setDate(monday.getDate() + i);
    const dateStr = currentIterDate.toISOString().split("T")[0];
    const isHoliday = isWeekendOrHoliday(dateStr);
    
    // 每天塞 1 到 3 筆訂位
    const numBookings = isHoliday ? 3 : 1;
    for (let k = 0; k < numBookings; k++) {
      // 隨機選時間
      let time = "18:00";
      if (isHoliday) {
        const times = ["11:30", "13:00", "17:30", "19:00", "20:00"];
        time = times[Math.floor(Math.random() * times.length)];
      } else {
        const times = ["17:30", "18:30", "19:00", "20:30"];
        time = times[Math.floor(Math.random() * times.length)];
      }
      
      const idx = Math.floor(Math.random() * names.length);
      const adults = Math.floor(Math.random() * 4) + 1; // 1-4 位大人
      const kids = Math.floor(Math.random() * 2); // 0-1 位小孩
      
      list.push({
        id: "BK" + Math.floor(100000 + Math.random() * 900000),
        name: names[idx],
        phone: phones[idx],
        email: emails[idx],
        date: dateStr,
        time: time,
        adults: adults,
        kids: kids,
        totalGuests: adults + kids,
        status: Math.random() > 0.15 ? "Confirmed" : "Seated",
        createdAt: new Date().toISOString(),
        notes: Math.random() > 0.7 ? "需要兒童安全椅" : (Math.random() > 0.85 ? "慶生用餐" : "")
      });
    }
  }
  
  return list;
}

// 取得給定日期所在那一週的「週一到週日」日期列表
function getWeekDays(dateObj) {
  const currentDay = dateObj.getDay();
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay; // 週日(0)回退6天到週一，其餘回退 (1-day) 天
  
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

// 格式化日期為 YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 格式化日期為中文顯示 (例如 "6月15日週一")
function formatDateChinese(dateStr) {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const weekDay = weekDays[date.getDay()];
  
  // 檢查是否為今日
  const todayStr = new Date().toISOString().split("T")[0];
  const suffix = (dateStr === todayStr) ? "（今日）" : "";
  
  return `${month}月${day}日 ${weekDay}${suffix}`;
}
