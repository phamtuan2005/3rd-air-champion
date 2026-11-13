// Vietnamese for TiBook's calendar screens — see index.ts.
// The guest is "bạn", and held (reserved, unpaid) nights say "giữ chỗ" so they
// never read as confirmed.
export const calendar: Record<string, string> = {
  // The bar over the calendar
  Today: "Hôm nay",
  Month: "Tháng",
  List: "Danh sách",
  "Show the calendar as": "Xem lịch theo",
  "Show the calendar as a month": "Xem lịch theo tháng",
  "Show the calendar as a list of days": "Xem lịch dạng danh sách ngày",
  "Request a Booking": "Gửi yêu cầu đặt phòng",
  "All rooms": "Tất cả các phòng",

  // Weekday header. The short keys are the forms on Vietnamese calendars
  // (CN, T2…T7). The full names keep "thứ" lowercase because they are mostly
  // read mid-sentence ("đêm thứ Ba và thứ Tư"); Chủ nhật is always capitalised.
  Sunday: "Chủ nhật",
  Monday: "thứ Hai",
  Tuesday: "thứ Ba",
  Wednesday: "thứ Tư",
  Thursday: "thứ Năm",
  Friday: "thứ Sáu",
  Saturday: "thứ Bảy",
  Sun: "CN",
  Mon: "T2",
  Tue: "T3",
  Wed: "T4",
  Thu: "T5",
  Fri: "T6",
  Sat: "T7",

  // A month tile. Held to the English widths by its words (SOLD_OUT_EMS and
  // LEFT_EMS in GuestCalendar): "hết phòng" would run out of a phone's tile,
  // where "đã kín" fits; "còn 3" is about as wide as "3 left".
  "{n} left": "còn {n}",
  "sold out": "đã kín",
  "Add to wish list": "Thêm vào danh sách yêu thích",
  "Remove from wish list": "Bỏ khỏi danh sách yêu thích",

  // The day-by-day list
  "{count} free": "Còn trống {count}",
  Free: "Còn trống",
  "no charge": "miễn phí",
  "family, no charge": "gia đình, miễn phí",
  "a night, your price": "một đêm, giá của bạn",
  "Sold out": "Đã kín",
  "Sold out · on your wish list": "Đã kín · có trong danh sách yêu thích",
  // U+2011 in the English key, as on screen.
  "Sold out · tap to wish‑list": "Đã kín · chạm để thêm vào yêu thích",
  "{n} night": "{n} đêm",
  "{n} nights": "{n} đêm",
  "Family — no charge": "Gia đình — miễn phí",
  "Paid ${amount}": "Đã thanh toán ${amount}",
  // Held for the guest but not yet paid — "giữ chỗ", never "đã đặt" or
  // "đã xác nhận", which would read as a confirmed booking.
  "⏳ Held for you": "⏳ Đang giữ chỗ cho bạn",
  "Your stay · {nights}": "Kỳ lưu trú của bạn · {nights}",
  "Your stay, continued": "Kỳ lưu trú của bạn (tiếp theo)",
  "Booking details, {room}, {date}": "Chi tiết đặt phòng, {room}, {date}",
  "Details ›": "Chi tiết ›",
  "Tap to pay": "Chạm để thanh toán",
  "Prices are yours, a night": "Giá của bạn, mỗi đêm",

  // US federal holidays, as a Vietnamese guest reads them. Days Vietnam also
  // keeps on another date (Labour Day is 1 May, Independence Day 2 September)
  // say "Mỹ", so nobody thinks the calendar is wrong. Lesser-known US days
  // keep the English name in brackets so they can be looked up.
  "{name} (observed)": "{name} (nghỉ bù)",
  "New Year's Day": "Tết Dương lịch",
  "Martin Luther King Jr. Day": "Ngày Martin Luther King Jr.",
  "Presidents' Day": "Ngày Tổng thống (Presidents' Day)",
  "Memorial Day": "Ngày Tưởng niệm (Memorial Day)",
  Juneteenth: "Juneteenth",
  "Independence Day": "Quốc khánh Mỹ",
  "Labor Day": "Ngày Lao động Mỹ",
  "Columbus Day": "Ngày Columbus",
  "Veterans Day": "Ngày Cựu chiến binh (Veterans Day)",
  Thanksgiving: "Lễ Tạ ơn",
  "Christmas Day": "Lễ Giáng sinh",
};
