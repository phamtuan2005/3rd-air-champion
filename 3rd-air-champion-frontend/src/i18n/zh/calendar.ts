// Chinese for TiBook's calendar screens — see index.ts.
export const calendar: Record<string, string> = {
  // The bar over the calendar
  Today: "今天",
  Month: "月",
  List: "列表",
  "Show the calendar as": "日历显示方式",
  "Show the calendar as a month": "按月显示日历",
  "Show the calendar as a list of days": "按天列表显示日历",
  "Request a Booking": "申请预订",
  "All rooms": "所有房间",

  // Weekday header. Every full name begins 星期, so the narrow header on a phone
  // takes the LAST character (日 一 二 …; see CalendarNavigatorDesktop).
  Sunday: "星期日",
  Monday: "星期一",
  Tuesday: "星期二",
  Wednesday: "星期三",
  Thursday: "星期四",
  Friday: "星期五",
  Saturday: "星期六",
  Sun: "周日",
  Mon: "周一",
  Tue: "周二",
  Wed: "周三",
  Thu: "周四",
  Fri: "周五",
  Sat: "周六",

  // A month tile. Held to the English widths by their words (SOLD_OUT_EMS and
  // LEFT_EMS in GuestCalendar), so "已全部订满" would run out of a phone's tile
  // where "满房" fits. Two characters are 2em against the English 3.75em.
  "{n} left": "剩{n}",
  "sold out": "满房",
  "Add to wish list": "加入心愿单",
  "Remove from wish list": "从心愿单移除",

  // The day-by-day list
  "{count} free": "{count}间有空",
  Free: "有空",
  "no charge": "免费",
  "family, no charge": "家人，免费",
  "a night, your price": "每晚，您的价格",
  "Sold out": "满房",
  "Sold out · on your wish list": "满房 · 已在您的心愿单",
  // U+2011 in the English key, as on screen.
  "Sold out · tap to wish‑list": "满房 · 点按加入心愿单",
  "{n} night": "{n}晚",
  "{n} nights": "{n}晚",
  "Family — no charge": "家人，免费",
  "Paid ${amount}": "已付 ${amount}",
  "⏳ Held for you": "⏳ 已为您保留",
  "Your stay · {nights}": "您的住宿 · {nights}",
  "Your stay, continued": "您的住宿（续）",
  "Booking details, {room}, {date}": "预订详情，{room}，{date}",
  "Details ›": "详情 ›",
  "Tap to pay": "点按付款",
  "Prices are yours, a night": "您的价格，每晚",

  // US federal holidays, as a Chinese guest reads them: the names Chinese
  // newspapers use, with 美国 where the day exists at home too.
  "{name} (observed)": "{name}（补假）",
  "New Year's Day": "元旦",
  "Martin Luther King Jr. Day": "马丁·路德·金纪念日",
  "Presidents' Day": "总统日",
  "Memorial Day": "阵亡将士纪念日",
  Juneteenth: "六月节",
  "Independence Day": "美国独立日",
  "Labor Day": "美国劳动节",
  "Columbus Day": "哥伦布日",
  "Veterans Day": "退伍军人节",
  Thanksgiving: "感恩节",
  "Christmas Day": "圣诞节",
};
