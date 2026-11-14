// Vietnamese for TiBook's shell screens — see index.ts.
// The guest is always "bạn" and the house is "chúng tôi", the warm, plain voice
// Airbnb uses in Vietnamese: chủ nhà, khách, đặt phòng, danh sách yêu thích.
export const shell: Record<string, string> = {
  Language: "Ngôn ngữ",

  // House facts strip
  "Stay with {name}, an engineer living here": "Ở cùng {name}, một kỹ sư sống ngay tại đây",
  "your host": "chủ nhà của bạn",
  "Smart toilet, warm seat, bidet, all bathrooms": "Bồn cầu thông minh, bệ ngồi ấm, vòi rửa ở mọi phòng tắm",

  // Remember-me question
  // "If you say yes, we'll keep" is followed by the phone number, then the
  // long line starting "and your name…", so the three read as one sentence.
  "Save your number on this device?": "Lưu số điện thoại của bạn trên thiết bị này?",
  "So you don't have to type it again": "Để lần sau bạn không phải nhập lại",
  "If you say yes, we'll keep": "Nếu bạn đồng ý, chúng tôi sẽ lưu",
  "and your name in this browser's storage on your own phone or computer. Next time you open TiBook, your stays, your wish list and your rate are already here.":
    "và tên của bạn trong bộ nhớ của trình duyệt này, ngay trên điện thoại hoặc máy tính của bạn. Lần sau mở TiBook, các kỳ lưu trú, danh sách yêu thích và giá của bạn đã có sẵn ở đây.",
  "It stays on this device — it isn't a tracking cookie and no one else can read it.":
    "Thông tin chỉ nằm trên thiết bị này — đây không phải cookie theo dõi và không ai khác đọc được.",
  "Your booking request reaches the house either way — this is only about saving you the typing next visit.":
    "Dù chọn thế nào, yêu cầu đặt phòng của bạn vẫn đến được với chúng tôi — việc này chỉ giúp bạn khỏi phải nhập lại vào lần sau.",
  "Change your mind whenever you like: \"Not you?\" in Your Bookings clears your number and this choice from this device, and we'll ask again next time.":
    "Bạn có thể đổi ý bất cứ lúc nào: nút \"Không phải bạn?\" trong Đặt phòng của bạn sẽ xóa số điện thoại và lựa chọn này khỏi thiết bị, và lần sau chúng tôi sẽ hỏi lại.",
  "Yes, remember me": "Có, hãy nhớ tôi",
  "No, just for this visit": "Không, chỉ lần này thôi",

  // Loyalty welcome
  "Hi {name}! Welcome back": "Chào {name}! Mừng bạn quay lại",
  "Cherished Guest": "Khách thân thương",
  "Valued Guest": "Khách quý",
  "Loyal Guest": "Khách thân thiết",
  "Returning Guest": "Khách quay lại",
  // Vietnamese nouns don't change for plural, so the one- and many- forms match.
  "{n} stay": "{n} kỳ lưu trú",
  "{n} stays": "{n} kỳ lưu trú",
  "{n} night": "{n} đêm",
  "{n} nights": "{n} đêm",
  "with us since {date}": "đồng hành cùng chúng tôi từ {date}",
  "Thank you — you have ${amount} off every night": "Cảm ơn bạn — bạn được giảm ${amount} mỗi đêm",
  "It is already taken off the totals below. Our way of saying we are glad you keep coming back.":
    "Khoản giảm đã được trừ vào tổng tiền bên dưới. Đó là cách chúng tôi cảm ơn bạn đã luôn quay lại.",
  "You are not just a guest, you are part of the TT House family. We hold every single one of those nights close to our hearts, and your trust in us means everything. Thank you for being so wonderfully you.":
    "Bạn không chỉ là khách, bạn là một phần của gia đình TT House. Chúng tôi trân trọng từng đêm bạn ở đây, và sự tin tưởng của bạn có ý nghĩa vô cùng lớn với chúng tôi. Cảm ơn bạn vì đã luôn là chính bạn tuyệt vời như thế.",
  "You have truly made TT House your home away from home. We are so grateful you keep choosing us, and we will always do our best to deserve that trust.":
    "TT House đã thật sự trở thành ngôi nhà thứ hai của bạn. Chúng tôi rất biết ơn vì bạn vẫn luôn chọn chúng tôi, và sẽ luôn cố gắng hết sức để xứng đáng với sự tin tưởng đó.",
  "Every time you come back, it genuinely warms our hearts. You are a true friend of TT House, and we look forward to many more stays together.":
    "Mỗi lần bạn quay lại, chúng tôi đều thấy thật ấm lòng. Bạn là người bạn thật sự của TT House, và chúng tôi mong được đón bạn thêm nhiều lần nữa.",
  "It means so much to have you back! We hope every stay with us feels like a little retreat — comfortable, warm, and just right. See you again soon!":
    "Thật vui khi được đón bạn trở lại! Mong mỗi kỳ lưu trú ở đây là một chốn nghỉ ngơi nhỏ cho bạn — thoải mái, ấm áp và vừa vặn. Hẹn sớm gặp lại bạn!",
  // The last line paraphrases the motto, so it is said as the house's promise
  // to the guest rather than left as a bare slogan.
  "Welcome to TT House! We are so happy you are here, and we hope this stay is the first of many. Your comfort is truly our mission.":
    "Chào mừng bạn đến TT House! Chúng tôi rất vui khi có bạn ở đây, và mong đây là kỳ lưu trú đầu tiên trong nhiều lần nữa. Chúng tôi hứa với bạn: sự thoải mái của bạn là sứ mệnh của chúng tôi.",

  // Host contact button
  // "Ask TT" as a whole is a name and stays English elsewhere; here {name} is
  // the host's name inside an ordinary sentence, so the verb is translated.
  "Ask {name}": "Hỏi {name}",
  "Anything at all — he answers these himself.": "Hỏi gì cũng được — anh ấy sẽ tự trả lời bạn.",
  "Chat here": "Nhắn tin tại đây",
  "Stays in TiBook. {name} replies on this screen.": "Ngay trong TiBook. {name} sẽ trả lời trên màn hình này.",
  "Text his phone": "Nhắn tin SMS cho anh ấy",
  "Opens your messages, ready to send.": "Mở ứng dụng tin nhắn, sẵn sàng để gửi.",
  "Call him": "Gọi cho anh ấy",
  "Rings his phone now.": "Gọi đến điện thoại của anh ấy ngay.",
  "Chat is the quickest way to reach him today.": "Hôm nay, nhắn tin là cách nhanh nhất để liên lạc với anh ấy.",
  "Ask {name} — drag me anywhere": "Hỏi {name} — kéo nút này đi đâu cũng được",
  "Contact {name}. Drag to move this button.": "Liên hệ {name}. Kéo để di chuyển nút này.",

  // Host banner
  // The motto stays in English inside its quotes and is named as TT House's
  // promise to the guest, so it never reads as a promise to whoever is reading.
  "Verified": "Đã xác minh",
  "Superhost": "Chủ nhà siêu cấp",
  "Superhosts": "Chủ nhà siêu cấp",
  "Your Comfort. Our Mission.": "“Your Comfort. Our Mission.” — lời hứa của TT House dành cho bạn",
  "{n} reviews": "{n} đánh giá",
  // Highlight pills the host types in TiMag, in English. Kept chip-short.
  // "Kaiser" alone means little to a Vietnamese guest; it is Kaiser
  // Permanente's hospital in Santa Clara, so say so.
  "Near big techs": "Gần các công ty công nghệ lớn",
  "Modern design": "Thiết kế hiện đại",
  "Safe neighborhoods": "Khu dân cư an toàn",
  "Clean & Comfortable": "Sạch sẽ & thoải mái",
  "Near Kaiser": "Gần bệnh viện Kaiser",
  "Near Levi's Stadium": "Gần sân vận động Levi's",
  "Sunset view": "Ngắm hoàng hôn",

  // Room cards
  "Family — no charge": "Gia đình — miễn phí",
  "/night": "/đêm",
  "View {room} on AirBnB": "Xem {room} trên AirBnB",
  "the host": "chủ nhà",
  "All": "Tất cả",
  "Show room photos": "Xem ảnh phòng",
  "Photos": "Ảnh",
  "Our Rooms": "Các phòng của chúng tôi",
  "tap on room name to select": "chạm vào tên phòng để chọn",
  "Every price is agreed between you and {name}. Open a room to ask.": "Mọi mức giá đều do bạn và {name} thống nhất. Mở một phòng để hỏi giá.",
  // Nightly price ranges for a guest with no agreed rate (util/priceRange).
  // "linh hoạt" (flexible), not "thương lượng" (negotiable), to match the English.
  "Prices are flexible nightly ranges. Open a room to find one that works for you and {name}.": "Giá mỗi đêm là khoảng giá linh hoạt. Mở một phòng để cùng {name} tìm mức giá hợp với cả hai.",
  "Your agreed prices are shown; the others are ranges. Open a room to ask {name}.": "Đây là giá bạn đã thống nhất; các phòng khác hiện khoảng giá. Mở một phòng để hỏi {name}.",
  "/ night · flexible": "/ đêm · linh hoạt",
  "This room is {range} a night. Tell {name} your dates and you'll find a price that works for you both.": "Phòng này có giá {range} một đêm. Hãy cho {name} biết ngày bạn ở, hai bên sẽ tìm được mức giá hợp với cả hai.",
  "These are your prices, agreed with {name}.": "Đây là giá của bạn, đã thống nhất với {name}.",
  "Your agreed prices are shown. Open a room without one to ask {name}.": "Đây là giá bạn đã thống nhất. Mở một phòng chưa có giá để hỏi {name}.",
  "Hide room photos": "Ẩn ảnh phòng",
  "Hide": "Ẩn",
  "All Rooms": "Tất cả các phòng",

  // Room gallery
  // "for this room, agreed with {name}." follows "Family — no charge", and
  // "Your price for this room is" is followed by the price, then
  // " with your loyalty discount", then ", agreed with {name}." — one sentence.
  "Close": "Đóng",
  "Enlarge this picture": "Phóng to ảnh này",
  "Enlarge": "Phóng to",
  "See more on AirBnB": "Xem thêm trên AirBnB",
  "Accommodates up to {n}": "Tối đa {n} khách",
  "The price here is something you can settle with {name} directly.": "Giá phòng này bạn có thể thỏa thuận trực tiếp với {name}.",
  "for this room, agreed with {name}.": "cho phòng này, đã thống nhất với {name}.",
  "Your price for this room is": "Giá phòng này của bạn là",
  " with your loyalty discount": " đã gồm giảm giá khách thân thiết",
  ", agreed with {name}.": ", đã thống nhất với {name}.",
  "Chat here in TiBook": "Nhắn tin ngay trong TiBook",
  "Works from any country, on any phone — {name} replies on this screen.": "Dùng được ở mọi quốc gia, trên mọi điện thoại — {name} sẽ trả lời trên màn hình này.",
  "Text {name}": "Nhắn tin SMS cho {name}",
  "Ask {name} about the price": "Hỏi {name} về giá",
  "Back to the room": "Quay lại phòng",
  "Previous picture": "Ảnh trước",
  "Next picture": "Ảnh sau",
  "Tap twice to go back": "Chạm hai lần để quay lại",

  // Room facts (src/util/roomFacts.ts) — the English stays the source there,
  // because askTT reads it; these are only how the gallery draws it. The two
  // bathroom keys hold a no-break space before the dash, as roomFacts does.
  "1 queen bed": "1 giường queen",
  "1 sofa bed": "1 giường sofa",
  "1 double bed": "1 giường đôi",
  "Private attached bathroom, with a smart toilet — warm seat and built-in bidet":
    "Phòng tắm riêng trong phòng, có bồn cầu thông minh — bệ ngồi ấm và vòi rửa tích hợp",
  "Shared bathroom, with a bathtub, hot water and a smart toilet — warm seat and built-in bidet":
    "Phòng tắm chung, có bồn tắm, nước nóng và bồn cầu thông minh — bệ ngồi ấm và vòi rửa tích hợp",
  "Your own room, with a lock on the door": "Phòng riêng của bạn, cửa có khóa",
  "Your own room and private balcony, with a lock on the door": "Phòng riêng của bạn có ban công riêng, cửa có khóa",
  "Wifi": "Wifi",
  "Air conditioning": "Máy lạnh",
  "Central air conditioning": "Máy lạnh trung tâm",
  "Heating": "Máy sưởi",
  "Dedicated workspace": "Góc làm việc riêng",
  "65-inch QLED AI smart TV": "Smart TV QLED AI 65 inch",
  "43-inch smart TV": "Smart TV 43 inch",
  "Mini fridge": "Tủ lạnh mini",
  "Microwave": "Lò vi sóng",
  "Coffee maker": "Máy pha cà phê",
  "Backyard": "Sân sau",
  "Portable fans": "Quạt di động",
  "Towels and bed linen": "Khăn tắm và ga gối",
  "Free street parking": "Chỗ đậu xe miễn phí trên đường",
  "Self check-in": "Tự nhận phòng",
  "Free, safe street parking outside": "Chỗ đậu xe miễn phí, an toàn ngay trên đường trước nhà",
  "Shared kitchen, open to every guest in the house": "Bếp chung, mọi khách trong nhà đều dùng được",

  // Nav bar and Look menu
  // "Look" sits in a narrow header button; "Giao diện" is the word Vietnamese
  // apps use for it. The tier badges are chip-short too.
  "TT House Logo": "Logo TT House",
  "Book with TT House": "Đặt phòng tại TT House",
  "Your bookings": "Đặt phòng của bạn",
  "Cherished": "Thân thương",
  "Valued": "Khách quý",
  "Loyal": "Thân thiết",
  "Returning": "Quay lại",
  "Home": "Trang chủ",
  "Change how TiBook looks": "Đổi giao diện TiBook",
  "Look": "Giao diện",
  "Welcome back.": "Mừng bạn quay lại.",
  "We put the rooms first this time. Tap here for Classic, or any look you like.":
    "Lần này chúng tôi đưa các phòng lên trước. Chạm vào đây để chọn Classic, hoặc giao diện bạn thích.",
  "Make it yours.": "Tùy chỉnh theo ý bạn.",
  "Tap here for Classic, Neon or Hero, in the colour you like.": "Chạm vào đây để chọn Classic, Neon hoặc Hero, với màu bạn thích.",
  "Dismiss": "Đóng",
  "Show me": "Cho tôi xem",
  "Light and calm": "Sáng và dịu nhẹ",
  "Dark and bright": "Tối và rực rỡ",
  "Neon, rooms first": "Neon, phòng lên trước",
  "Colour": "Màu",
  "{name} colour": "Màu {name}",
  "green": "xanh lá",
  "amber": "hổ phách",
  "teal": "xanh mòng két",
  "rose": "hồng",
  "indigo": "chàm",

  // Hero layout
  // "còn trống" is the glossary word for free; kept short so these lines stay
  // on one line under the photo.
  "{room} is free {n} night": "{room} còn trống {n} đêm",
  "{room} is free {n} nights": "{room} còn trống {n} đêm",
  "{rooms} · {n} night open": "{rooms} · còn trống {n} đêm",
  "{rooms} · {n} nights open": "{rooms} · còn trống {n} đêm",
  "{n} night open": "Còn trống {n} đêm",
  "{n} nights open": "Còn trống {n} đêm",
  " or ": " hoặc ",
  "About {name} and its hosts": "Về {name} và các chủ nhà",
  "About {name}": "Về {name}",
  "{n} rooms picked · swipe to see each": "Đã chọn {n} phòng · vuốt để xem từng phòng",
  "Room {i} of {n} · swipe for more": "Phòng {i}/{n} · vuốt để xem thêm",
  "Any room · swipe through all {n}": "Phòng nào cũng được · vuốt xem cả {n} phòng",
  "/ night · your rate": "/ đêm · giá của bạn",
  "Your price is agreed with {name}": "Giá của bạn do bạn và {name} thống nhất",
  "{n} photos": "{n} ảnh",
  "Details": "Chi tiết",
  "Any room is fine": "Phòng nào cũng được",
  "{name} picks the room and agrees your price. Same house, same bathrooms.":
    "{name} sẽ chọn phòng và thống nhất giá với bạn. Cùng một ngôi nhà, cùng các phòng tắm.",
  "Your host": "Chủ nhà của bạn",
  "Rooms to show in the month": "Phòng hiển thị trong tháng",
  "Any room": "Phòng bất kỳ",
  // "held" = a reserved, unpaid stay the host is keeping for the guest, so
  // "giữ chỗ" — never "đã xác nhận", which would read as confirmed and paid.
  "{n} booking held for you — tap to review & pay": "{n} đặt phòng đang giữ chỗ cho bạn — chạm để xem & thanh toán",
  "{n} bookings held for you — tap to review & pay": "{n} đặt phòng đang giữ chỗ cho bạn — chạm để xem & thanh toán",
  "Stays TT lined up for you": "Các kỳ lưu trú TT đã chuẩn bị cho bạn",
  "stay": "kỳ lưu trú",
  "stays": "kỳ lưu trú",
  "Request a Booking": "Gửi yêu cầu đặt phòng",
  // Fallback for the guest's first name in a narrow chip, and the label on
  // the guest's own chat bubbles.
  "You": "Bạn",

  // TiBook page
  "{n} date · ★ {w} wish list": "{n} ngày · ★ {w} yêu thích",
  "{n} dates · ★ {w} wish list": "{n} ngày · ★ {w} yêu thích",
  "{n} date selected": "Đã chọn {n} ngày",
  "{n} dates selected": "Đã chọn {n} ngày",
  "★ {n} wish list date": "★ {n} ngày trong danh sách yêu thích",
  "★ {n} wish list dates": "★ {n} ngày trong danh sách yêu thích",
  "Loading…": "Đang tải…",
  "Loading...": "Đang tải…",
  "Show the rooms": "Xem các phòng",
  "Open the calendar": "Mở lịch",
  "No host selected": "Chưa chọn chủ nhà",
  "Review Request": "Xem lại yêu cầu",
  "Book another room": "Đặt thêm phòng khác",
  "Open Your Bookings with your phone number first, then try again.":
    "Hãy mở Đặt phòng của bạn bằng số điện thoại trước, rồi thử lại nhé.",
  "{date} removed from your wish list": "Đã bỏ {date} khỏi danh sách yêu thích",
  "Undo": "Hoàn tác",
  "Add this holiday night?": "Thêm đêm ngày lễ này?",
};
