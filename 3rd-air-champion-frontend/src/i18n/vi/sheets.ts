// Vietnamese for TiBook's sheets screens — see index.ts.
// Your Bookings, the wish list (popup, modal, summary), the "usual stay" card
// for returning guests, and the chat with the host.
// The guest is always "bạn"; a stay is "kỳ lưu trú", as Airbnb Vietnam writes it.
export const sheets: Record<string, string> = {
  // ── Your Bookings (MyBookingsSheet) ──────────────────────────────────────
  "Check-in instructions": "Hướng dẫn nhận phòng",
  "Could not load bookings. Please try again.": "Chưa tải được đặt phòng. Bạn thử lại nhé.",
  Room: "Phòng",
  // The event in the guest's own phone calendar (.ics).
  "Stay at {room}": "Lưu trú tại {room}",
  "{n} night at {room}": "{n} đêm tại {room}",
  "{n} nights at {room}": "{n} đêm tại {room}",
  "Staying now": "Đang lưu trú",
  "Check-in today": "Nhận phòng hôm nay",
  Pending: "Đang chờ",
  Confirmed: "Đã xác nhận",
  // Held, not paid — "Đã đặt" would read as the same thing as Đã xác nhận.
  Reserved: "Đang giữ chỗ",
  "{n} night": "{n} đêm",
  "{n} nights": "{n} đêm",
  "Tomorrow!": "Ngày mai!",
  "in {n} days": "còn {n} ngày",
  "${rate}/night": "${rate}/đêm",
  " + ${sum} fees": " + ${sum} phí",
  Fee: "Phí",
  Discount: "Giảm giá",
  "${sum} off this stay": "Giảm ${sum} cho kỳ lưu trú này",
  "Address · tap for directions": "Địa chỉ · chạm để xem đường đi",
  "Room code": "Mã phòng",
  "Your Bookings": "Đặt phòng của bạn",
  "Loading your bookings…": "Đang tải đặt phòng của bạn…",
  "Your phone number": "Số điện thoại của bạn",
  Search: "Tìm",
  "Showing bookings for": "Đặt phòng của",
  "Not you?": "Không phải bạn?",
  "We couldn't find any bookings for this number. Please double-check the number you used when booking.":
    "Chúng tôi chưa tìm thấy đặt phòng nào với số này. Bạn kiểm tra lại số đã dùng khi đặt phòng nhé.",
  "No upcoming bookings. We look forward to having you again!":
    "Bạn chưa có đặt phòng sắp tới. Rất mong được đón bạn lần nữa!",
  Upcoming: "Sắp tới",
  "Add my stays to calendar": "Thêm kỳ lưu trú vào lịch",
  "House rules": "Nội quy nhà",
  "Wish list dates": "Ngày trong danh sách yêu thích",
  "Remove {date}?": "Bỏ {date}?",
  "Please search your bookings first so we can verify your identity.":
    "Bạn tìm đặt phòng của mình trước để chúng tôi xác nhận đúng là bạn nhé.",
  "Something went wrong. Please try again.": "Có lỗi xảy ra. Bạn thử lại nhé.",
  "Yes, remove": "Bỏ",
  Keep: "Giữ lại",
  "TiBook visitor numbers": "Lượt truy cập TiBook",
  "How many people are looking, and from where": "Bao nhiêu người đang xem, và từ đâu",

  // ── Wish list (WishListModal, WishListSummarySheet, WishListDatePopup) ────
  "Please enter your phone number and name.": "Nhập số điện thoại và tên của bạn.",
  "Remove from Wish List": "Bỏ khỏi danh sách yêu thích",
  "Add to Wish List": "Thêm vào danh sách yêu thích",
  "This date is on your wish list. Tap below to remove it.":
    "Ngày này đang có trong danh sách yêu thích của bạn. Chạm bên dưới để bỏ.",
  "Sold out for now — we'll keep this date saved for you.": "Hiện đã kín — chúng tôi sẽ lưu ngày này cho bạn.",
  "looking up...": "đang tìm...",
  "✓ found": "✓ đã tìm thấy",
  edit: "sửa",
  "Your name": "Tên của bạn",
  "Save to Wish List": "Lưu vào danh sách yêu thích",
  "No dates selected.": "Chưa chọn ngày nào.",
  "My Wish List — {n} date": "Danh sách yêu thích — {n} ngày",
  "My Wish List — {n} dates": "Danh sách yêu thích — {n} ngày",
  "No dates saved yet.": "Chưa lưu ngày nào.",
  "Sent ✓": "Đã gửi ✓",
  "Sending...": "Đang gửi...",
  "Send to host →": "Gửi cho chủ nhà →",
  "That didn't go through. Please try again.": "Chưa gửi được. Bạn thử lại nhé.",
  // Thrown by TiBook.tsx and shown by WishListDatePopup.
  "Open Your Bookings with your phone number first, then try again.":
    "Bạn mở “Đặt phòng của bạn” bằng số điện thoại trước, rồi thử lại nhé.",
  "On your wish list": "Trong danh sách yêu thích",
  Close: "Đóng",
  "This night is sold out, and it's saved on your wish list. We'll let you know as soon as a room opens up.":
    "Đêm này đã kín và đã được lưu vào danh sách yêu thích của bạn. Chúng tôi sẽ báo bạn ngay khi có phòng trống.",
  "Keep waiting": "Tiếp tục chờ",
  "Removing…": "Đang bỏ…",
  "Remove from wish list": "Bỏ khỏi danh sách yêu thích",

  // ── A wished-for night is free (WishFreeCard) ────────────────────────────
  "A night you wished for is free": "Một đêm bạn mong muốn đã có phòng trống",
  "Nights you wished for are free": "Những đêm bạn mong muốn đã có phòng trống",
  "Rooms go to whoever asks first. Book it puts these nights into your request — you check it and send it.":
    "Ai hỏi trước sẽ được phòng trước. Nút “Đặt ngay” sẽ đưa các đêm này vào yêu cầu của bạn — bạn chỉ cần xem lại và gửi.",
  "Book it": "Đặt ngay",

  // ── Chat with the host (HostChatSheet) ───────────────────────────────────
  "Could not load your messages just now.": "Hiện chưa tải được tin nhắn của bạn.",
  // "anh ấy" for the host himself — he is the one being described, not the
  // guest, so this does not break the "bạn" rule.
  "A phone number lets him write back — please add yours.":
    "Có số điện thoại thì anh ấy mới nhắn lại được — bạn thêm số của mình nhé.",
  "That did not send. Your message is still here — try again?":
    "Chưa gửi được. Tin nhắn của bạn vẫn còn đây — thử lại nhé?",
  "Your host. He reads these himself.": "Chủ nhà của bạn. Anh ấy tự đọc tin nhắn.",
  "Ask {host} anything about the house.": "Hỏi {host} bất cứ điều gì về ngôi nhà.",
  "Parking, the kitchen, a late arrival, what a room is really like — whatever you would like to know before you book. Your message goes straight to him and his reply comes back here.":
    "Chỗ đậu xe, nhà bếp, đến muộn, phòng thực tế trông thế nào — bất cứ điều gì bạn muốn biết trước khi đặt. Tin nhắn của bạn đến thẳng chỗ anh ấy và câu trả lời sẽ hiện ở đây.",
  You: "Bạn",
  "Your host": "Chủ nhà của bạn",
  "Sending…": "Đang gửi…",
  "Read by {host}": "{host} đã xem",
  Sent: "Đã gửi",
  "{host} is typing": "{host} đang nhập",
  "Your phone": "Số điện thoại của bạn",
  "Write to {host}…": "Nhắn cho {host}…",
  Send: "Gửi",
  "Show me when {host} has read my messages": "Cho tôi biết khi {host} đã xem tin nhắn",
  "In a hurry?": "Đang vội?",
  "Call {host}": "Gọi {host}",
  or: "hoặc",
  "text his phone": "nhắn tin vào điện thoại của anh ấy",

  // ── Returning guests (UsualStayCard) ─────────────────────────────────────
  // The same keys as calendar.ts, and this file is spread after it, so these
  // win: lowercase "thứ" to sit mid-sentence ("Tuần đó, thứ Ba đã kín").
  // "Chủ nhật" is always capitalised.
  Monday: "thứ Hai",
  Tuesday: "thứ Ba",
  Wednesday: "thứ Tư",
  Thursday: "thứ Năm",
  Friday: "thứ Sáu",
  Saturday: "thứ Bảy",
  Sunday: "Chủ nhật",
  " and ": " và ",
  " every other week": " cách tuần một lần",
  " every third week": " ba tuần một lần",
  " every fourth week": " bốn tuần một lần",
  // A no-break space, as in the English: "2 đêm" never splits over a line.
  ", {n} night": ", {n} đêm",
  ", {n} nights": ", {n} đêm",
  "Tap to open · drag to move": "Chạm để mở · kéo để di chuyển",
  // Two lines on screen: "TT có {n} kỳ lưu trú" / "đã sắp sẵn cho bạn".
  "TT has {n} stay": "TT có {n} kỳ lưu trú",
  "TT has {n} stays": "TT có {n} kỳ lưu trú",
  "lined up for you": "đã sắp sẵn cho bạn",
  "Stays to book ahead": "Kỳ lưu trú nên đặt trước",
  // "Chào mừng bạn trở lại" needs no guess at the guest's age or gender.
  "Welcome back, {name}": "Chào mừng {name} trở lại",
  "Welcome back": "Chào mừng bạn trở lại",
  Minimise: "Thu nhỏ",
  "Last time you stayed {nights}": "Lần trước bạn ở {nights}",
  "Want the same again? These are open in the coming weeks:":
    "Muốn ở như lần trước không? Những ngày này còn trống trong các tuần tới:",
  "TT noted that you usually stay {nights}": "TT để ý bạn thường ở {nights}",
  "You're booked up to {date}.": "Bạn đã đặt phòng đến {date}.",
  "TT can line up the next ones for you, to {month}": "TT có thể sắp sẵn các kỳ tiếp theo cho bạn, đến {month}",
  " — {room} is already booked {taken} of the next {known} weeks on those nights":
    " — {room} đã có người đặt vào những đêm đó trong {taken}/{known} tuần tới",
  "Untick any week you won't need.": "Bỏ chọn tuần nào bạn không cần.",
  "Request {n} stay": "Gửi yêu cầu {n} kỳ lưu trú",
  "Request {n} stays": "Gửi yêu cầu {n} kỳ lưu trú",
  "Request all {n} stay": "Gửi yêu cầu {n} kỳ lưu trú",
  "Request all {n} stays": "Gửi yêu cầu cả {n} kỳ lưu trú",
  "All selected": "Đã chọn tất cả",
  "None selected": "Chưa chọn gì",
  "{k} of {n} nights selected": "Đã chọn {k}/{n} đêm",
  "{dates} in {room}": "{dates} tại {room}",
  "the room": "phòng",
  "{days} is full that week": "Tuần đó, {days} đã kín",
  "{days} are full that week": "Tuần đó, {days} đã kín",
  "Done choosing": "Xong",
  "{k} of {n} nights — change": "{k}/{n} đêm — đổi",
  "Choose nights": "Chọn đêm",
  "adds to your {days} stay": "nối thêm vào kỳ lưu trú {days} của bạn",
  " — in {room}, as {theirs} is taken that night": " — ở {room}, vì {theirs} đã có người đặt đêm đó",
  "your room": "phòng của bạn",
  "You'll see the request before anything is sent — each stay goes to the host on its own.":
    "Bạn sẽ xem lại yêu cầu trước khi gửi — mỗi kỳ lưu trú được gửi riêng cho chủ nhà.",
  "Not now": "Để sau",
  Resize: "Đổi kích thước",
  "Stays TT lined up for you": "Kỳ lưu trú TT sắp sẵn cho bạn",
  "{n} stay": "{n} kỳ lưu trú",
  "{n} stays": "{n} kỳ lưu trú",
};
