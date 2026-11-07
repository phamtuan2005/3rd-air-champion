// Korean for TiBook's calendar screens — see index.ts.
export const calendar: Record<string, string> = {
  // The bar over the calendar
  Today: "오늘",
  Month: "월",
  List: "목록",
  "Show the calendar as": "캘린더 보기 방식",
  "Show the calendar as a month": "캘린더를 월별로 보기",
  "Show the calendar as a list of days": "캘린더를 날짜별 목록으로 보기",
  "Request a Booking": "예약 요청하기",
  "All rooms": "모든 객실",

  // Weekday header. The narrow header on a phone takes the FIRST character of
  // the full name (일 월 화 …; see CalendarNavigatorDesktop).
  Sunday: "일요일",
  Monday: "월요일",
  Tuesday: "화요일",
  Wednesday: "수요일",
  Thursday: "목요일",
  Friday: "금요일",
  Saturday: "토요일",
  Sun: "일",
  Mon: "월",
  Tue: "화",
  Wed: "수",
  Thu: "목",
  Fri: "금",
  Sat: "토",

  // A month tile. Held to the English widths by their words (SOLD_OUT_EMS and
  // LEFT_EMS in GuestCalendar): "만실" is two syllables, 2em against the
  // English 3.75em, and "잔여 {n}" stays inside a phone's tile.
  "{n} left": "잔여 {n}",
  "sold out": "만실",
  "Add to wish list": "위시리스트에 추가",
  "Remove from wish list": "위시리스트에서 삭제",

  // The day-by-day list
  "{count} free": "{count}개 객실 예약 가능",
  Free: "예약 가능",
  "no charge": "무료",
  "family, no charge": "가족, 무료",
  "a night, your price": "1박, 고객님 요금",
  "Sold out": "만실",
  "Sold out · on your wish list": "만실 · 위시리스트에 있음",
  // U+2011 in the English key, as on screen.
  "Sold out · tap to wish‑list": "만실 · 탭하여 위시리스트에 추가",
  "{n} night": "{n}박",
  "{n} nights": "{n}박",
  "Family — no charge": "가족 — 무료",
  "Paid ${amount}": "결제 완료 ${amount}",
  "⏳ Held for you": "⏳ 임시 예약됨",
  "Your stay · {nights}": "내 숙박 · {nights}",
  "Your stay, continued": "내 숙박 (계속)",
  "Booking details, {room}, {date}": "예약 상세 정보, {room}, {date}",
  "Details ›": "상세 정보 ›",
  "Tap to pay": "탭하여 결제",
  "Prices are yours, a night": "고객님 요금, 1박 기준",

  // US federal holidays, as a Korean guest reads them: the names Korean
  // newspapers use, with 미국 where the day exists at home too.
  "{name} (observed)": "{name} (대체 휴일)",
  "New Year's Day": "새해 첫날",
  "Martin Luther King Jr. Day": "마틴 루서 킹 데이",
  "Presidents' Day": "대통령의 날",
  "Memorial Day": "메모리얼 데이",
  Juneteenth: "준틴스",
  "Independence Day": "미국 독립기념일",
  "Labor Day": "미국 노동절",
  "Columbus Day": "콜럼버스 데이",
  "Veterans Day": "재향군인의 날",
  Thanksgiving: "추수감사절",
  "Christmas Day": "크리스마스",
};
