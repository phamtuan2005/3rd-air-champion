// Korean for TiBook's booking screens — see index.ts.
//
// Some lines are pieces of a sentence the screen assembles (" — tap to add
// them" after a count). They are translated as the piece they are, so the
// Korean still reads when the pieces are put together.
export const booking: Record<string, string> = {
  // ── Booking request: header and steps ──
  "Your Dates": "날짜",
  "Your Booking": "내 예약",
  "About You": "게스트 정보",
  "Pick your dates — just one more step after this": "날짜를 선택하세요. 이다음 한 단계만 남았어요",
  "Check it over and send — we have the rest": "확인하고 보내 주세요. 나머지 정보는 이미 있어요",
  "Last step — fill in your info and you're done": "마지막 단계예요. 정보만 입력하면 끝나요",
  "Step {step} of 2": "2단계 중 {step}단계",
  "All done!": "모두 완료됐어요!",
  Close: "닫기",

  // ── Success screen ──
  "Request sent!": "요청을 보냈어요!",
  "We'll be in touch shortly to confirm your stay. Can't wait to host you!":
    "숙박을 확정하기 위해 곧 연락드릴게요. 곧 뵙기를 기다릴게요!",
  "We'll let you know as soon as those dates open up!": "해당 날짜에 빈 객실이 생기면 바로 알려 드릴게요!",
  "We'll also notify you if your wish list dates become available.":
    "위시리스트 날짜에 빈 객실이 생겨도 알려 드릴게요.",
  "While you wait — our house rules": "기다리시는 동안 숙소 이용 규칙을 확인해 보세요",

  // ── Step 1: dates ──
  "Your dates include a US holiday": "선택한 날짜에 미국 공휴일이 포함되어 있어요",
  "Your dates include {n} US holidays": "선택한 날짜에 미국 공휴일이 {n}일 포함되어 있어요",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay that night?":
    "여러 밤을 이어서 고르다 보면 공휴일이 실수로 포함되기 쉬워요. 그날 밤에도 묵으실 건가요?",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay those nights?":
    "여러 밤을 이어서 고르다 보면 공휴일이 실수로 포함되기 쉬워요. 그날 밤들에도 묵으실 건가요?",
  "Choose one to continue.": "계속하려면 하나를 선택하세요.",
  "Take it out": "빼기",
  "Take them out": "빼기",
  "Keep — I'll be staying": "유지 — 묵을 거예요",
  "Holiday night kept:": "유지한 공휴일 밤:",
  "Holiday nights kept:": "유지한 공휴일 밤:",
  "Dates picked from calendar": "캘린더에서 고른 날짜",
  "{n} night": "{n}박",
  "{n} nights": "{n}박",
  "{date} · 1 night": "{date} · 1박",
  "{start} – {end} · {n} nights": "{start} – {end} · {n}박",
  "Remove {what}?": "{what} 항목을 삭제할까요?",
  "Yes, remove": "네, 삭제할게요",
  Keep: "유지",
  Remove: "삭제",
  "Calendar — tap to pick more dates": "캘린더 — 탭해서 날짜를 더 고르세요",
  "Tap here to browse the calendar": "여기를 탭해서 캘린더를 보세요",
  "Pick your dates and come back to complete your request": "날짜를 고른 다음 돌아와서 요청을 마무리하세요",
  "Sold-out dates (wish list)": "만실인 날짜 (위시리스트)",
  "We'll notify you if these open up.": "빈 객실이 생기면 알려 드릴게요.",
  "and / or": "그리고/또는",
  "Write your dates": "날짜 직접 입력",
  // Korean dates on purpose: parseDateText reads this exact form.
  "e.g. May 1, 3–5, 20–21 — or anything else you'd like us to know":
    "예: 5월 1일, 3–5일, 20–21일 — 또는 저희에게 알려 주고 싶은 내용",
  "e.g. May 1, 3–5, 20–21\nor anything else you'd like us to know":
    "예: 5월 1일, 3–5일, 20–21일\n또는 저희에게 알려 주고 싶은 내용",
  "Please pick dates on the calendar or write your dates below.":
    "캘린더에서 날짜를 고르거나 아래에 날짜를 입력해 주세요.",
  "1 date read from what you wrote": "입력하신 내용에서 날짜 1개를 찾았어요",
  "{n} dates read from what you wrote": "입력하신 내용에서 날짜 {n}개를 찾았어요",
  " — tap to add them": " — 탭해서 추가하세요",
  "{day} has already gone by": "{day}: 이미 지난 날짜예요",
  "{n} of those nights have already gone by": "그중 {n}박은 이미 지났어요",
  " — we've kept the rest.": " — 나머지는 그대로 두었어요.",
  "Next — Finalize your booking →": "다음 — 예약 마무리하기 →",
  "Next — Tell us about you →": "다음 — 게스트 정보 입력 →",

  // ── The write-your-dates sheet ──
  "We read this date": "이 날짜를 찾았어요",
  "We read these {n} dates": "날짜 {n}개를 찾았어요",
  "This night has already gone by": "이미 지난 밤이에요",
  "{n} of these nights have already gone by": "그중 {n}박은 이미 지났어요",
  "We've left those out and kept the rest.": "지난 날짜는 빼고 나머지는 그대로 두었어요.",
  "Nothing to add from this yet.": "아직 추가할 날짜가 없어요.",
  "If you meant next year, add the year — \"{example}\" — and we'll pick it up.":
    "내년을 말씀하신 거라면 “{example}”처럼 연도를 함께 적어 주세요. 그러면 알아들을게요.",
  "No need to book — that night is already yours.": "예약하지 않으셔도 돼요. 이미 고객님의 숙박이에요.",
  "No need to book — those nights are already yours.": "예약하지 않으셔도 돼요. 이미 고객님의 숙박이에요.",
  "{n} of these night is already booked in your name — nothing to do for it.":
    "그중 {n}박은 이미 고객님 이름으로 예약되어 있어요. 따로 하실 일은 없어요.",
  "{n} of these nights are already booked in your name — nothing to do for them.":
    "그중 {n}박은 이미 고객님 이름으로 예약되어 있어요. 따로 하실 일은 없어요.",
  "The crossed-out date is full tonight — we'll watch it for you and tell you the moment it opens up.":
    "줄이 그어진 날짜는 지금 만실이에요. 대신 지켜보다가 빈 객실이 생기는 즉시 알려 드릴게요.",
  "The crossed-out dates are full tonight — we'll watch them for you and tell you the moment they open up.":
    "줄이 그어진 날짜는 지금 만실이에요. 대신 지켜보다가 빈 객실이 생기는 즉시 알려 드릴게요.",
  "All of these are already in your request.": "모두 이미 요청에 들어 있어요.",
  "We'll pass this on too: \"{text}\"": "이 내용도 함께 전달할게요: “{text}”",
  "Request {n} date, watch {m} more": "{n}일 요청하고 {m}일 더 지켜보기",
  "Request {n} dates, watch {m} more": "{n}일 요청하고 {m}일 더 지켜보기",
  "Add {n} date to my request": "요청에 {n}일 추가",
  "Add {n} dates to my request": "요청에 {n}일 추가",
  "Watch {n} full date for me": "만실인 날짜 {n}일 지켜봐 주세요",
  "Watch {n} full dates for me": "만실인 날짜 {n}일 지켜봐 주세요",
  Done: "완료",

  // ── Step 2: about you / your booking ──
  "Your phone number": "전화번호",
  "So we can reach you": "연락드릴 수 있도록",
  "Please enter your phone number": "전화번호를 입력해 주세요",
  "looking up...": "찾는 중...",
  "We'll sort out pricing together after your request.": "요금은 요청을 받은 뒤 함께 정해요.",
  "Your name": "이름",
  "e.g. John Smith": "예: 김민준",
  "Please enter your name": "이름을 입력해 주세요",
  "Room summary": "객실 요약",
  "{n}n": "{n}박",
  "~${amount} estimated": "약 ${amount} (예상)",
  "{n} separate stays — pick a room for each.": "따로 떨어진 숙박 {n}건이에요. 각각 객실을 골라 주세요.",
  "No room free for these nights": "이 날짜에는 빈 객실이 없어요",
  "Select a room": "객실 선택",
  "${rate}/night": "${rate}/박",
  "~${total} ({n}n × ${rate}/night)": "약 ${total} ({n}박 × ${rate}/박)",
  "({n}n × ${rate}/night)": "({n}박 × ${rate}/박)",
  "Total estimate": "예상 총액",
  "Which room?": "어느 객실인가요?",
  "Checking availability...": "빈 객실 확인 중...",
  "No rooms available — try different dates.": "빈 객실이 없어요. 다른 날짜를 골라 보세요.",
  "Please choose a room": "객실을 골라 주세요",
  "Please pick a room for {stay}.": "{stay} 숙박의 객실을 골라 주세요.",
  "Wish list dates": "위시리스트 날짜",
  "How many people?": "몇 명이 묵으시나요?",
  "{n} person": "{n}명",
  "{n} people": "{n}명",
  "Something went wrong — please try again.": "문제가 생겼어요. 다시 시도해 주세요.",
  "Hide ▴": "숨기기 ▴",
  "Details ▾": "자세히 ▾",
  "Sending...": "보내는 중...",
  "Send My Request": "요청 보내기",

  // ── Cancellation policy ──
  "Free cancellation up to {days} days before check-in": "체크인 {days}일 전까지 무료 취소",
  "We fully understand your plans can change, and TT House will be flexible with that.":
    "일정은 바뀔 수 있다는 걸 잘 알아요. TT House는 유연하게 맞춰 드릴게요.",
  "Full refund if you cancel {full}+ days before check-in": "체크인 {full}일 이상 전에 취소하면 전액 환불",
  "50% refund if {half}–{last} days before": "체크인 {half}–{last}일 전에 취소하면 50% 환불",
  "No refund within {half} days.": "체크인 {half}일 이내에는 환불되지 않아요.",
  "Feel free to reach out to us anytime!": "언제든 편하게 연락 주세요!",

  // ── US holidays ──
  "{name} (observed)": "{name} (대체 공휴일)",
  "{holiday} — a US holiday": "{holiday} — 미국 공휴일",
  "Make sure you mean to stay this night before you add it.":
    "추가하기 전에 이 밤에 묵으실 건지 확인해 주세요.",
  "New Year's Day": "새해 첫날",
  "Martin Luther King Jr. Day": "마틴 루터 킹 주니어의 날",
  "Presidents' Day": "대통령의 날",
  "Memorial Day": "메모리얼 데이",
  Juneteenth: "준틴스",
  "Independence Day": "독립기념일",
  "Labor Day": "노동절",
  "Columbus Day": "콜럼버스의 날",
  "Veterans Day": "재향군인의 날",
  Thanksgiving: "추수감사절",
  "Christmas Day": "크리스마스",

  // ── Room picker ──
  "Only 1 room left": "객실 1개 남음",
  "Pick your room": "객실 선택",
  "No other room is free for these dates.": "이 날짜에 비어 있는 다른 객실이 없어요.",
  "Select ›": "선택 ›",
  "Any available room": "빈 객실 아무거나",

  // ── Held (reserved) bookings ──
  "the host": "호스트",
  "No charge": "무료",
  "A booking is held for you": "고객님을 위해 임시 예약을 잡아 두었어요",
  "{n} bookings held for you": "고객님을 위해 임시 예약 {n}건을 잡아 두었어요",
  "Pending payment": "결제 대기 중",
  "We're holding this booking just for you. To keep it, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "이 예약을 고객님만을 위해 잡아 두고 있어요. 유지하시려면 곧 결제해 주세요. 결제되지 않은 임시 예약은 다른 게스트가 예약할 수 있도록 해제될 수 있어요. 🙏",
  "We're holding these bookings just for you. To keep them, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "이 예약들을 고객님만을 위해 잡아 두고 있어요. 유지하시려면 곧 결제해 주세요. 결제되지 않은 임시 예약은 다른 게스트가 예약할 수 있도록 해제될 수 있어요. 🙏",
  "You'd planned to send payment by {date} — no problem if you need a little longer, just let {host} know.":
    "{date}까지 결제하실 예정이었어요. 시간이 조금 더 필요하셔도 괜찮아요. {host} 님께 알려 주세요.",
  "You said you'd send payment by {date} — thank you!": "{date}까지 결제해 주신다고 하셨죠. 감사해요!",
  "{amount} fees": "수수료 {amount}",
  "{amount} loyalty discount applied": "단골 할인 {amount} 적용",
  Total: "합계",
  "Total to pay": "결제할 총액",
  "Message {host} to pay": "{host} 님께 메시지로 결제하기",
  "Got it": "알겠어요",
  "Asked for one of these by mistake? Just let {host} know and it will be released.":
    "실수로 요청하신 예약이 있나요? {host} 님께 알려 주시면 해제해 드릴게요.",

  // ── Your stay ──
  "Staying now": "숙박 중",
  "Check-in today": "오늘 체크인",
  "in {n} day": "{n}일 후",
  "in {n} days": "{n}일 후",
  Completed: "완료",
  "{n} guest": "게스트 {n}명",
  "{n} guests": "게스트 {n}명",
  Door: "현관",
  Room: "객실",
  "View full details": "전체 내용 보기",
  "This stay is complete — thank you for staying with us. 🏠": "숙박이 끝났어요. 함께해 주셔서 감사해요. 🏠",
  "Book another room for these dates": "이 날짜에 객실 하나 더 예약하기",
  "Text {host} about this stay": "이 숙박에 대해 {host} 님께 문자 보내기",
};
