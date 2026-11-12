// Chinese for TiBook's booking screens — see index.ts.
//
// Some lines are pieces of a sentence the screen assembles (" — tap to add
// them" after a count). They are translated as the piece they are, so the
// Chinese still reads when the pieces are put together.
export const booking: Record<string, string> = {
  // ── Booking request: header and steps ──
  "Your Dates": "您的日期",
  "Your Booking": "您的预订",
  "About You": "关于您",
  "Pick your dates — just one more step after this": "选择日期，之后只差一步",
  "Check it over and send — we have the rest": "确认后发送，其余信息我们已有",
  "Last step — fill in your info and you're done": "最后一步：填写信息即可完成",
  "Step {step} of 2": "第{step}步，共2步",
  "All done!": "全部完成！",
  Close: "关闭",

  // ── Success screen ──
  "Request sent!": "申请已发送！",
  "We'll be in touch shortly to confirm your stay. Can't wait to host you!":
    "我们会尽快与您联系，确认您的住宿。期待您的到来！",
  "We'll let you know as soon as those dates open up!": "这些日期一有空房，我们会马上通知您！",
  "We'll also notify you if your wish list dates become available.":
    "如果心愿单上的日期有了空房，我们也会通知您。",
  "While you wait — our house rules": "等待期间，可以先看看我们的房屋守则",

  // ── Step 1: dates ──
  "Your dates include a US holiday": "您的日期包含一个美国节假日",
  "Your dates include {n} US holidays": "您的日期包含{n}个美国节假日",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay that night?":
    "连续选择多晚时，很容易误选节假日。您确定要住这一晚吗？",
  "Holidays are easy to pick by mistake with a run of nights. Do you mean to stay those nights?":
    "连续选择多晚时，很容易误选节假日。您确定要住这几晚吗？",
  "Choose one to continue.": "请选择一项以继续。",
  "Take it out": "移除",
  "Take them out": "移除",
  "Keep — I'll be staying": "保留，我要住",
  "Holiday night kept:": "已保留节假日这一晚：",
  "Holiday nights kept:": "已保留这些节假日：",
  "Dates picked from calendar": "从日历中选择的日期",
  "{n} night": "{n}晚",
  "{n} nights": "{n}晚",
  "{date} · 1 night": "{date} · 1晚",
  "{start} – {end} · {n} nights": "{start} – {end} · {n}晚",
  "Remove {what}?": "要移除 {what} 吗？",
  "Yes, remove": "是的，移除",
  Keep: "保留",
  Remove: "移除",
  "Calendar — tap to pick more dates": "日历：点按选择更多日期",
  "Tap here to browse the calendar": "点按这里浏览日历",
  "Pick your dates and come back to complete your request": "选好日期后回到这里，完成您的申请",
  "Sold-out dates (wish list)": "满房日期（心愿单）",
  "We'll notify you if these open up.": "这些日期一有空房，我们会通知您。",
  "and / or": "和/或",
  "Write your dates": "写下您的日期",
  // Chinese dates on purpose: parseDateText reads this exact form.
  "e.g. May 1, 3–5, 20–21 — or anything else you'd like us to know":
    "例如：5月1日、3–5日、20–21日，或有何特殊要求",
  "e.g. May 1, 3–5, 20–21\nor anything else you'd like us to know":
    "例如：5月1日、3–5日、20–21日\n或有何特殊要求",
  "Please pick dates on the calendar or write your dates below.":
    "请在日历上选择日期，或在下方写下您的日期。",
  "1 date read from what you wrote": "从您写的内容中读取到1个日期",
  "{n} dates read from what you wrote": "从您写的内容中读取到{n}个日期",
  " — tap to add them": "，点按即可添加",
  "{day} has already gone by": "{day} 已经过去了",
  "{n} of those nights have already gone by": "其中有{n}晚已经过去了",
  " — we've kept the rest.": "，其余的已为您保留。",
  "Next — Finalize your booking →": "下一步：完成预订 →",
  "Next — Tell us about you →": "下一步：告诉我们您的信息 →",

  // ── The write-your-dates sheet ──
  "We read this date": "我们读取到这个日期",
  "We read these {n} dates": "我们读取到这{n}个日期",
  "This night has already gone by": "这一晚已经过去了",
  "{n} of these nights have already gone by": "其中有{n}晚已经过去了",
  "We've left those out and kept the rest.": "这些已略去，其余的已保留。",
  "Nothing to add from this yet.": "目前没有可添加的日期。",
  "If you meant next year, add the year — \"{example}\" — and we'll pick it up.":
    "如果您指的是明年，请加上年份，比如“{example}”，我们就能读取。",
  "No need to book — that night is already yours.": "无需预订，这一晚已经是您的了。",
  "No need to book — those nights are already yours.": "无需预订，这几晚已经是您的了。",
  "{n} of these night is already booked in your name — nothing to do for it.":
    "其中{n}晚已以您的名字预订，无需再操作。",
  "{n} of these nights are already booked in your name — nothing to do for them.":
    "其中{n}晚已以您的名字预订，无需再操作。",
  "The crossed-out date is full tonight — we'll watch it for you and tell you the moment it opens up.":
    "划掉的日期目前已满，我们会替您留意，一有空房立刻通知您。",
  "The crossed-out dates are full tonight — we'll watch them for you and tell you the moment they open up.":
    "划掉的日期目前已满，我们会替您留意，一有空房立刻通知您。",
  "All of these are already in your request.": "这些日期都已在您的申请中。",
  "We'll pass this on too: \"{text}\"": "我们也会转达这段话：“{text}”",
  "Request {n} date, watch {m} more": "申请{n}天，再留意{m}天",
  "Request {n} dates, watch {m} more": "申请{n}天，再留意{m}天",
  "Add {n} date to my request": "把{n}天加入我的申请",
  "Add {n} dates to my request": "把{n}天加入我的申请",
  "Watch {n} full date for me": "替我留意{n}个满房日期",
  "Watch {n} full dates for me": "替我留意{n}个满房日期",
  Done: "完成",

  // ── Step 2: about you / your booking ──
  "Your phone number": "您的电话号码",
  "So we can reach you": "方便我们联系您",
  "Please enter your phone number": "请输入您的电话号码",
  "looking up...": "查询中…",
  "We'll sort out pricing together after your request.": "收到申请后，我们再一起确定价格。",
  "Your name": "您的姓名",
  "e.g. John Smith": "例如：张伟",
  "Please enter your name": "请输入您的姓名",
  "Room summary": "房间概览",
  "{n}n": "{n}晚",
  "~${amount} estimated": "约 ${amount}（估算）",
  "{n} separate stays — pick a room for each.": "{n}段独立的住宿，请为每段选择房间。",
  "No room free for these nights": "这几晚没有空房",
  "Select a room": "选择房间",
  "${rate}/night": "${rate}/晚",
  "~${total} ({n}n × ${rate}/night)": "约 ${total}（{n}晚 × ${rate}/晚）",
  "({n}n × ${rate}/night)": "（{n}晚 × ${rate}/晚）",
  "Total estimate": "预估总价",
  "Which room?": "哪间房？",
  "Checking availability...": "正在查询空房…",
  "No rooms available — try different dates.": "没有空房，试试其他日期吧。",
  "Please choose a room": "请选择房间",
  "Please pick a room for {stay}.": "请为 {stay} 选择房间。",
  "Wish list dates": "心愿单日期",
  "How many people?": "几位入住？",
  "{n} person": "{n}人",
  "{n} people": "{n}人",
  "Something went wrong — please try again.": "出了点问题，请再试一次。",
  "Hide ▴": "隐藏 ▴",
  "Details ▾": "详情 ▾",
  "Sending...": "发送中…",
  "Send My Request": "发送我的申请",

  // ── Cancellation policy ──
  "Free cancellation up to {days} days before check-in": "入住前{days}天可免费取消",
  "We fully understand your plans can change, and TT House will be flexible with that.":
    "我们完全理解行程可能会变，TT House 会灵活处理。",
  "Full refund if you cancel {full}+ days before check-in": "入住前至少{full}天取消，全额退款",
  "50% refund if {half}–{last} days before": "入住前{half}–{last}天取消，退款50%",
  "No refund within {half} days.": "入住前{half}天内取消，不予退款。",
  "Feel free to reach out to us anytime!": "欢迎随时联系我们！",

  // ── US holidays ──
  "{name} (observed)": "{name}（补假）",
  "{holiday} — a US holiday": "{holiday}，美国节假日",
  "Make sure you mean to stay this night before you add it.":
    "添加前请确认您确实要住这一晚。",
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

  // ── Room picker ──
  "Only 1 room left": "仅剩1间房",
  "Pick your room": "选择您的房间",
  "No other room is free for these dates.": "这些日期没有其他空房。",
  "Select ›": "选择 ›",
  "Any available room": "任意空房",

  // ── Held (reserved) bookings ──
  "the host": "房东",
  "No charge": "免费",
  "A booking is held for you": "已为您保留一个预订",
  "{n} bookings held for you": "已为您保留{n}个预订",
  "Pending payment": "待付款",
  "We're holding this booking just for you. To keep it, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "我们正在为您专门保留这个预订。如需保留，请尽快付款，未付款的预订可能会被释放给其他客人。🙏",
  "We're holding these bookings just for you. To keep them, please send your payment soon — unpaid holds may be released so other guests can book. 🙏":
    "我们正在为您专门保留这些预订。如需保留，请尽快付款，未付款的预订可能会被释放给其他客人。🙏",
  "You'd planned to send payment by {date} — no problem if you need a little longer, just let {host} know.":
    "您原计划在 {date} 前付款。如果需要多一点时间也没关系，告诉 {host} 一声就好。",
  "You said you'd send payment by {date} — thank you!": "您说会在 {date} 前付款，谢谢您！",
  "{amount} fees": "费用 {amount}",
  "{amount} loyalty discount applied": "已减免老客优惠 {amount}",
  Total: "总计",
  "Total to pay": "应付总额",
  "Message {host} to pay": "联系 {host} 付款",
  "Got it": "知道了",
  "Asked for one of these by mistake? Just let {host} know and it will be released.":
    "有哪个是误订的吗？告诉 {host} 一声，就会为您释放。",

  // ── Your stay ──
  "Staying now": "正在入住",
  "Check-in today": "今天入住",
  "in {n} day": "{n}天后",
  "in {n} days": "{n}天后",
  Completed: "已完成",
  "{n} guest": "{n}位客人",
  "{n} guests": "{n}位客人",
  Door: "大门",
  Room: "房间",
  "View full details": "查看完整详情",
  "This stay is complete — thank you for staying with us. 🏠": "这次住宿已结束，感谢您的入住。🏠",
  "Book another room for these dates": "为这些日期再订一间房",
  "Text {host} about this stay": "就这次住宿给 {host} 发短信",
};
