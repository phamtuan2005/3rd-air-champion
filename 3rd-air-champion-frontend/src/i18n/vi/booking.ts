// Vietnamese for TiBook's booking screens — see index.ts.
//
// Warm, everyday Vietnamese the way Airbnb Vietnam writes to guests. The guest
// is always "bạn" (never "quý khách" or "anh/chị", which guess age and gender),
// and the house speaks as "chúng tôi".
//
// Some lines are pieces of a sentence the screen assembles (" — tap to add
// them" after a count). They are translated as the piece they are, so the
// Vietnamese still reads when the pieces are put together.
export const booking: Record<string, string> = {
  // ── Booking request: header and steps ──
  "Your Dates": "Ngày của bạn",
  "Your Booking": "Đặt phòng của bạn",
  "About You": "Về bạn",
  "Pick your dates — just one more step after this": "Chọn ngày — xong bước này chỉ còn một bước nữa",
  "Check it over and send — we have the rest": "Xem lại rồi gửi — phần còn lại để chúng tôi lo",
  "Last step — fill in your info and you're done": "Bước cuối — điền thông tin của bạn là xong",
  "Step {step} of 2": "Bước {step}/2",
  "All done!": "Xong rồi!",
  Close: "Đóng",

  // ── Success screen ──
  "Request sent!": "Đã gửi yêu cầu!",
  "We'll be in touch shortly to confirm your stay. Can't wait to host you!":
    "Chúng tôi sẽ sớm liên hệ để xác nhận kỳ lưu trú của bạn. Rất mong được đón bạn!",
  "We'll let you know as soon as those dates open up!": "Chúng tôi sẽ báo bạn ngay khi những ngày đó còn trống!",
  "We'll also notify you if your wish list dates become available.":
    "Chúng tôi cũng sẽ báo bạn nếu những ngày trong danh sách yêu thích còn trống.",
  "While you wait — our house rules": "Trong lúc chờ — nội quy nhà của chúng tôi",

  // ── Step 1: dates ──
  "Your dates include a US holiday": "Ngày bạn chọn có một ngày lễ của Mỹ",
  "Your dates include {n} US holidays": "Ngày bạn chọn có {n} ngày lễ của Mỹ",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay that night?":
    "Khi chọn nhiều đêm liền nhau, rất dễ chọn nhầm cả ngày lễ. Bạn có định ở đêm đó không?",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay those nights?":
    "Khi chọn nhiều đêm liền nhau, rất dễ chọn nhầm cả ngày lễ. Bạn có định ở những đêm đó không?",
  "Choose one to continue.": "Chọn một lựa chọn để tiếp tục.",
  "Take it out": "Bỏ đêm này",
  "Take them out": "Bỏ các đêm này",
  "Keep — I'll be staying": "Giữ — tôi sẽ ở",
  "Holiday night kept:": "Đêm lễ bạn giữ lại:",
  "Holiday nights kept:": "Các đêm lễ bạn giữ lại:",
  "Dates picked from calendar": "Ngày chọn trên lịch",
  "{n} night": "{n} đêm",
  "{n} nights": "{n} đêm",
  "{date} · 1 night": "{date} · 1 đêm",
  "{start} – {end} · {n} nights": "{start} – {end} · {n} đêm",
  "Remove {what}?": "Bỏ {what}?",
  "Yes, remove": "Bỏ",
  Keep: "Giữ lại",
  Remove: "Bỏ",
  "Calendar — tap to pick more dates": "Lịch — chạm để chọn thêm ngày",
  "Tap here to browse the calendar": "Chạm vào đây để xem lịch",
  "Pick your dates and come back to complete your request": "Chọn ngày rồi quay lại để hoàn tất yêu cầu",
  "Sold-out dates (wish list)": "Ngày đã kín (danh sách yêu thích)",
  "We'll notify you if these open up.": "Chúng tôi sẽ báo bạn nếu những ngày này còn trống.",
  "and / or": "và / hoặc",
  "Write your dates": "Viết ngày của bạn",
  // Vietnamese dates on purpose, as Chinese and Korean do: this is the form to
  // type for the date box to pick the dates up — day before month, the month
  // said once at the end ("1, 3–5 và 20–21 tháng 5").
  "e.g. May 1, 3–5, 20–21 — or anything else you'd like us to know":
    "VD: 1, 3–5 và 20–21 tháng 5 — hoặc bất cứ điều gì bạn muốn cho chúng tôi biết",
  "e.g. May 1, 3–5, 20–21\nor anything else you'd like us to know":
    "VD: 1, 3–5 và 20–21 tháng 5\nhoặc bất cứ điều gì bạn muốn cho chúng tôi biết",
  "Please pick dates on the calendar or write your dates below.":
    "Chọn ngày trên lịch hoặc viết ngày của bạn bên dưới.",
  "1 date read from what you wrote": "Đọc được 1 ngày từ những gì bạn viết",
  "{n} dates read from what you wrote": "Đọc được {n} ngày từ những gì bạn viết",
  " — tap to add them": " — chạm để thêm vào",
  "{day} has already gone by": "{day} đã qua rồi",
  "{n} of those nights have already gone by": "{n} trong số các đêm đó đã qua rồi",
  " — we've kept the rest.": " — chúng tôi đã giữ lại các đêm còn lại.",
  "Next — Finalize your booking →": "Tiếp — Hoàn tất đặt phòng →",
  "Next — Tell us about you →": "Tiếp — Cho chúng tôi biết về bạn →",

  // ── The write-your-dates sheet ──
  "We read this date": "Chúng tôi đọc được ngày này",
  "We read these {n} dates": "Chúng tôi đọc được {n} ngày này",
  "This night has already gone by": "Đêm này đã qua rồi",
  "{n} of these nights have already gone by": "{n} trong số các đêm này đã qua rồi",
  "We've left those out and kept the rest.": "Chúng tôi đã bỏ các đêm đó và giữ lại phần còn lại.",
  "Nothing to add from this yet.": "Chưa có ngày nào để thêm.",
  "If you meant next year, add the year — \"{example}\" — and we'll pick it up.":
    "Nếu ý bạn là năm sau, hãy thêm năm vào — “{example}” — chúng tôi sẽ hiểu ngay.",
  "No need to book — that night is already yours.": "Không cần đặt nữa — đêm đó đã là của bạn rồi.",
  "No need to book — those nights are already yours.": "Không cần đặt nữa — những đêm đó đã là của bạn rồi.",
  "{n} of these night is already booked in your name — nothing to do for it.":
    "{n} đêm trong số này đã được đặt dưới tên bạn — bạn không cần làm gì thêm.",
  "{n} of these nights are already booked in your name — nothing to do for them.":
    "{n} đêm trong số này đã được đặt dưới tên bạn — bạn không cần làm gì thêm.",
  "The crossed-out date is full tonight — we'll watch it for you and tell you the moment it opens up.":
    "Ngày bị gạch hiện đã kín — chúng tôi sẽ theo dõi giúp bạn và báo ngay khi có phòng trống.",
  "The crossed-out dates are full tonight — we'll watch them for you and tell you the moment they open up.":
    "Những ngày bị gạch hiện đã kín — chúng tôi sẽ theo dõi giúp bạn và báo ngay khi có phòng trống.",
  "All of these are already in your request.": "Tất cả các ngày này đã có trong yêu cầu của bạn.",
  "We'll pass this on too: \"{text}\"": "Chúng tôi cũng sẽ chuyển lời này: “{text}”",
  "Request {n} date, watch {m} more": "Gửi yêu cầu {n} ngày, theo dõi thêm {m} ngày",
  "Request {n} dates, watch {m} more": "Gửi yêu cầu {n} ngày, theo dõi thêm {m} ngày",
  "Add {n} date to my request": "Thêm {n} ngày vào yêu cầu",
  "Add {n} dates to my request": "Thêm {n} ngày vào yêu cầu",
  "Watch {n} full date for me": "Theo dõi giúp {n} ngày đã kín",
  "Watch {n} full dates for me": "Theo dõi giúp {n} ngày đã kín",
  Done: "Xong",

  // ── Step 2: about you / your booking ──
  "Your phone number": "Số điện thoại của bạn",
  "So we can reach you": "Để chúng tôi liên lạc với bạn",
  "Please enter your phone number": "Nhập số điện thoại của bạn",
  "looking up...": "đang tìm...",
  "We'll sort out pricing together after your request.": "Sau khi bạn gửi yêu cầu, chúng ta sẽ cùng thống nhất giá.",
  "Your name": "Tên của bạn",
  // A common Vietnamese placeholder name, as the other languages use one of
  // their own.
  "e.g. John Smith": "VD: Nguyễn Văn An",
  "Please enter your name": "Nhập tên của bạn",
  "Room summary": "Tóm tắt phòng",
  // Kept short: it sits beside a price in a tight row. Vietnamese has no
  // plural, and "đêm" is already short enough to fit.
  "{n}n": "{n} đêm",
  "~${amount} estimated": "~${amount} (ước tính)",
  "{n} separate stays — pick a room for each.": "{n} kỳ lưu trú riêng — chọn phòng cho từng kỳ.",
  "No room free for these nights": "Không còn phòng trống cho những đêm này",
  "Select a room": "Chọn phòng",
  "${rate}/night": "${rate}/đêm",
  "~${total} ({n}n × ${rate}/night)": "~${total} ({n} đêm × ${rate}/đêm)",
  "({n}n × ${rate}/night)": "({n} đêm × ${rate}/đêm)",
  "Total estimate": "Tổng ước tính",
  "Which room?": "Phòng nào?",
  "Checking availability...": "Đang kiểm tra phòng trống...",
  "No rooms available — try different dates.": "Không còn phòng trống — thử chọn ngày khác nhé.",
  "Please choose a room": "Chọn một phòng",
  "Please pick a room for {stay}.": "Chọn phòng cho {stay}.",
  "Wish list dates": "Ngày trong danh sách yêu thích",
  "How many people?": "Mấy người?",
  "{n} person": "{n} người",
  "{n} people": "{n} người",
  "Something went wrong — please try again.": "Có lỗi xảy ra — bạn thử lại nhé.",
  "Hide ▴": "Ẩn ▴",
  "Details ▾": "Chi tiết ▾",
  "Sending...": "Đang gửi...",
  "Send My Request": "Gửi yêu cầu",

  // ── Cancellation policy ──
  "Free cancellation up to {days} days before check-in": "Hủy miễn phí trước ngày nhận phòng {days} ngày",
  "We fully understand your plans can change, and TT House will be flexible with that.":
    "Chúng tôi hiểu kế hoạch của bạn có thể thay đổi, và TT House sẽ linh động với bạn.",
  "Full refund if you cancel {full}+ days before check-in": "Hoàn tiền toàn bộ nếu bạn hủy từ {full} ngày trở lên trước ngày nhận phòng",
  "50% refund if {half}–{last} days before": "Hoàn 50% nếu hủy trước {half}–{last} ngày",
  "No refund within {half} days.": "Không hoàn tiền nếu hủy trong vòng {half} ngày trước ngày nhận phòng.",
  "Feel free to reach out to us anytime!": "Bạn cứ liên hệ với chúng tôi bất cứ lúc nào!",

  // ── US holidays ──
  "{name} (observed)": "{name} (ngày nghỉ bù)",
  "{holiday} — a US holiday": "{holiday} — ngày lễ của Mỹ",
  "Make sure you mean to stay this night before you add it.":
    "Trước khi thêm, bạn kiểm tra lại xem có định ở đêm này không nhé.",
  "New Year's Day": "Tết Dương lịch",
  "Martin Luther King Jr. Day": "Ngày Martin Luther King Jr.",
  "Presidents' Day": "Ngày Tổng thống",
  "Memorial Day": "Ngày Tưởng niệm (Memorial Day)",
  Juneteenth: "Juneteenth",
  // "của Mỹ" so these are not read as Vietnam's own 2 September and 1 May.
  "Independence Day": "Ngày Độc lập của Mỹ",
  "Labor Day": "Ngày Lao động của Mỹ",
  "Columbus Day": "Ngày Columbus",
  "Veterans Day": "Ngày Cựu chiến binh",
  Thanksgiving: "Lễ Tạ ơn",
  "Christmas Day": "Lễ Giáng sinh",

  // ── Room picker ──
  "Only 1 room left": "Chỉ còn 1 phòng",
  "Pick your room": "Chọn phòng của bạn",
  "No other room is free for these dates.": "Không còn phòng nào khác trống vào những ngày này.",
  "Select ›": "Chọn ›",
  "Any available room": "Phòng nào còn trống cũng được",

  // ── Held (reserved) bookings ──
  // Stands in for the host's first name in {host} ("nhắn cho {host}").
  "the host": "chủ nhà",
  "No charge": "Miễn phí",
  // Held, not confirmed: "đang giữ chỗ" so an unpaid hold never reads as a
  // done deal.
  "A booking is held for you": "Có một đặt phòng đang giữ chỗ cho bạn",
  "{n} bookings held for you": "Có {n} đặt phòng đang giữ chỗ cho bạn",
  "Pending payment": "Chờ thanh toán",
  "We're holding this booking just for you. To keep it, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "Chúng tôi đang giữ chỗ đặt phòng này riêng cho bạn. Để giữ phòng, bạn vui lòng thanh toán sớm — chỗ giữ chưa thanh toán có thể được nhường cho khách khác. 🙏",
  "We're holding these bookings just for you. To keep them, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "Chúng tôi đang giữ chỗ các đặt phòng này riêng cho bạn. Để giữ phòng, bạn vui lòng thanh toán sớm — chỗ giữ chưa thanh toán có thể được nhường cho khách khác. 🙏",
  "You'd planned to send payment by {date} — no problem if you need a little longer, just let {host} know.":
    "Bạn định thanh toán trước {date} — nếu cần thêm chút thời gian cũng không sao, chỉ cần báo {host} là được.",
  "You said you'd send payment by {date} — thank you!": "Bạn đã hẹn thanh toán trước {date} — cảm ơn bạn!",
  "{amount} fees": "Phí {amount}",
  "{amount} loyalty discount applied": "Đã áp dụng giảm giá khách quen {amount}",
  Total: "Tổng",
  "Total to pay": "Tổng cần thanh toán",
  "Message {host} to pay": "Nhắn {host} để thanh toán",
  "Got it": "Đã hiểu",
  "Asked for one of these by mistake? Just let {host} know and it will be released.":
    "Lỡ đặt nhầm một trong số này? Chỉ cần báo {host}, chỗ đó sẽ được hủy giữ.",

  // ── Your stay ──
  "Staying now": "Đang lưu trú",
  "Check-in today": "Nhận phòng hôm nay",
  "in {n} day": "còn {n} ngày",
  "in {n} days": "còn {n} ngày",
  Completed: "Đã hoàn thành",
  "{n} guest": "{n} khách",
  "{n} guests": "{n} khách",
  Door: "Cửa",
  Room: "Phòng",
  "View full details": "Xem đầy đủ chi tiết",
  "This stay is complete — thank you for staying with us. 🏠": "Kỳ lưu trú đã kết thúc — cảm ơn bạn đã ở cùng chúng tôi. 🏠",
  "Book another room for these dates": "Đặt thêm phòng cho những ngày này",
  "Text {host} about this stay": "Nhắn {host} về kỳ lưu trú này",
};
