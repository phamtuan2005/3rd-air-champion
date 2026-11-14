import { addDays, format, parseISO } from "date-fns";
import { roomType } from "./types/roomType";
import { parseDateText, ZH_NUM, zhNumber } from "./dateText";
import { getRoomFacts, houseBathrooms, houseKitchen, houseParking } from "./roomFacts";
import { cancellationHeadline, formatCancellationPolicy } from "./cancellationPolicy";
import { holidayLabelForGuest, usHolidayOn } from "./usHolidays";
import { PriceRange, priceRangeOf, priceRangeText } from "./priceRange";
import { checkoutReading, chooseRoom, maxGuestsOf, monthAsked, readStay, stayLine, wantsToBook } from "./ttBooking";
// What TT SAYS goes through t() and fmtDate — in TiBook's language, and English
// in the tests, which run without the provider. What TT READS does not: the
// questions are still matched in English, and the few German and Chinese words
// below sit beside the English ones.
import { currentLang, fmtDate, t } from "../contexts/TiBookLanguageContext";
import type { LangName } from "../contexts/TiBookLanguageContext";
import { languageAsked, SWITCHED } from "./ttLanguage";

// TT, answering a GUEST.
//
// TiMag's Ask TT is a search box the host types into. TiBook's is the same
// name and the same badge talking to somebody else: a guest who wants to know
// whether a room is free on their dates, where to park, or what the bathroom is
// like — the questions the host otherwise answers by text, one guest at a time.
//
// Deliberately NOT a model, for the reason dateText.ts gives: no network, no
// cost, and no way for a public text box to spend anybody's money or say
// something the house never said. Every answer is assembled from what TiBook
// already shows — the availability rule, the room facts, the cancellation
// policy, the guest's own rate — so TT cannot disagree with the screen behind
// it. Anything it does not recognise goes to the host, by name, rather than
// being guessed at.
//
// The answer still needs no network. What IS sent, afterwards and without the
// guest waiting on it, is the question itself — scrubbed (layer 3 below) —
// with the topic it landed in and whether TT could answer (`category`,
// `answered`). The host asked for that log to see what TT should learn next;
// it is ttQuestionLog.ts, and only the host and cohosts can read it.
//
// ── Privacy, in three layers ────────────────────────────────────────────────
//
// TT is a text box on a PUBLIC page, so somebody will ask it who is staying in
// King, what the door code is, or what the API key is. None of those may ever
// get an answer, and "TT happens not to have a branch for that" is not a
// guarantee. So:
//
//  1. TT never HOLDS anything secret. A room reaches it as `TTRoom` — id, name
//     and listing link — stripped by `toTTRoom` at the boundary, so the door
//     code (`roomCode`, which the room record carries), the list price and the
//     check-in instructions are not in memory for any answer to reach. It is
//     handed "which rooms are free that night", never the day records, which
//     carry every guest's name, phone and email (see the stayPaid stopgap).
//     Of people it knows only the host's FIRST name and this guest's own
//     first name, usual room, wish list and agreed rates.
//  2. `privacyRefusal` turns down, before anything else is read, questions
//     about other people, codes and passwords, the system behind the page,
//     and attempts to talk TT out of its rules. A refusal says what TT CAN do
//     instead (TiBook's tone) and never repeats back what was asked for.
//  3. `scrub` runs over every line and label that leaves `askTT`, and removes
//     anything shaped like a door code, phone number, email, URL or IP
//     address — the backstop for house rules the host typed, and for any
//     future branch that forgets layer 1.

// The only parts of a room TT may see. Add a field here only if every guest
// may read it.
//
// `priceRange` passes that test since 2026-11: every guest now sees each
// room's nightly range on the cards (util/priceRange), so TT may say it too.
// It is the range, worked out here at the boundary, never the room record's
// price field itself.
export type TTRoom = Pick<roomType, "id" | "name" | "airbnbUrl"> & { priceRange?: PriceRange | null };

// Copies ONLY the safe fields. A type alone would still let the whole room
// object — door code included — ride along at runtime.
export const toTTRoom = (r: roomType): TTRoom => ({ id: r.id, name: r.name, airbnbUrl: r.airbnbUrl, priceRange: priceRangeOf(r.price) });

export type TTAction =
  // Put these nights in the guest's selection, in this room or (null) any room.
  // `review` goes on to Review Request with them, for a returning guest who
  // knows how this works and came to book (see `pick` below).
  | { kind: "pick"; label: string; dates: string[]; roomId: string | null; review?: boolean }
  // Star nights that are sold out, so the house hears that they were wanted.
  | { kind: "wish"; label: string; dates: string[] }
  // Narrow the calendar to one room.
  | { kind: "room"; label: string; roomId: string }
  | { kind: "photos"; label: string; roomId: string }
  | { kind: "chat"; label: string }
  // Ring or text the host. TiBook holds the number; the action carries none.
  | { kind: "call"; label: string }
  | { kind: "text"; label: string }
  | { kind: "bookings"; label: string }
  | { kind: "request"; label: string }
  // A follow-up question, asked as if typed.
  | { kind: "ask"; label: string; query: string }
  // Book these nights in this room, here in the conversation (ttBooking.ts).
  // Handled by the sheet like "ask", never by TiBook: nothing is sent until the
  // guest has read the request back and said send.
  | { kind: "book"; label: string; dates: string[]; roomId: string; party: number | null; alt?: string[] }
  // A step inside a booking already under way — a party size, "Send", "Start
  // over". Also the sheet's own, and only live on the latest message.
  | { kind: "booking"; label: string; step: TTBookingAction };

export type TTBookingAction =
  | { do: "party"; n: number }
  | { do: "keepHolidays" }
  | { do: "dropHolidays" }
  | { do: "alt" }
  | { do: "notMe" }
  | { do: "send" }
  | { do: "form" }
  | { do: "cancel" };

// A booking TT can start straight away: the guest asked to book, and one room
// is free for the whole stay. The sheet opens the draft without another tap.
export interface TTBookingStart {
  roomId: string;
  dates: string[];
  party: number | null;
  alt?: string[];
}

// Which of TT's topics a question landed in. Logged with every question
// (ttQuestionLog) so the host can see what guests ask about; the backend keeps
// the same list (util/ttQuestions.ts) and files anything else under "other".
export type TTCategory =
  | "availability"
  | "wishList"
  | "rooms"
  | "reviews"
  | "checkIn"
  | "parking"
  | "cancellation"
  | "price"
  | "kitchen"
  | "bathroom"
  | "amenities"
  | "houseRules"
  | "location"
  | "contactHost"
  | "booking"
  | "myBookings"
  | "greeting"
  | "thanks"
  | "privacy"
  | "other";

// What a branch below hands back. `answered` is false when TT had nothing
// real to say and passed the guest to the host — the questions the host
// wants to see, so TT can be taught them. Left out, it means answered.
interface TTReply {
  lines: string[];
  actions: TTAction[];
  answered?: boolean;
  book?: TTBookingStart;
}

export interface TTAnswer {
  lines: string[];
  actions: TTAction[];
  category: TTCategory;
  // A privacy refusal counts as answered: TT did what it should.
  answered: boolean;
  book?: TTBookingStart;
  // The guest asked for TiBook in another language (ttLanguage.ts). The sheet
  // switches the page; the lines are already in the new language.
  switchLang?: LangName;
}

const as = (category: TTCategory, r: TTReply): TTAnswer => ({
  lines: r.lines,
  actions: r.actions,
  category,
  answered: r.answered ?? true,
  ...(r.book ? { book: r.book } : {}),
});

export interface AskTTContext {
  today: Date;
  // Active rooms only.
  rooms: TTRoom[];
  // Rooms free on a yyyy-MM-dd night across the whole house — bookings,
  // reserved holds and per-room blocks all subtracted. TiBook.tsx's rule,
  // passed in, so there is still only one.
  freeRoomsOn: (key: string) => TTRoom[];
  // This guest's agreed rate per room id. Empty for a stranger.
  myRates: Map<string, number>;
  hostFirstName: string;
  // Whether the host has a phone TiBook can ring — "Call Anh-Tuan" is offered
  // only then. The number itself never enters TT (layer 1: TT cannot say
  // what it does not hold); TiBook dials it.
  hostCanCall?: boolean;
  // Replies from the host the guest has not opened, said on the chat button.
  hostUnread?: number;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
  houseRules?: string;
  // A guest TiBook already knows — by the phone they gave on this device.
  // Absent for somebody new. Only ever THEIR OWN stays and wish list.
  guest?: ReturningGuest;
  // What guests say, as the host PUBLISHED it in TiMag (Guest reviews): a
  // summary for the house and one per room id, drafted from the AirBnB
  // reviews and read by the host before any guest sees it. Absent until the
  // host publishes, and TT says so rather than making anything up.
  reviews?: TTReviews;
}

export interface TTReviews {
  house: string;
  rooms: Record<string, string>;
  // Each room's NEWEST review, summarised on its own and published with the
  // rest, by room id. Its month and stars come from the review on record.
  latest?: Record<string, TTLatestReview>;
  // The AirBnB figures the host already shows in the banner.
  rating?: number;
  count?: number;
}

export interface TTLatestReview {
  summary: string;
  month: string; // yyyy-MM
  stars?: number;
  // The reviewer's first name, as AirBnB shows it beside the review.
  guest?: string;
  // yyyy-MM-dd, the night the stay began, once it is on record.
  stayDate?: string;
}

export interface ReturningGuest {
  firstName: string;
  // The room they have spent the most nights in, if it is still let.
  usualRoomId?: string;
  // Every room they stay in, most-used first — the SAME list, in the same order,
  // the usual-stay popup names, so TT and the popup never describe a guest two
  // ways ("King, your usual room" beside "King, Cute, Queen and Chill" — host,
  // 2026-10-07). usualRoomId is its first. For a guest with no pattern yet it
  // is the room of their last stay alone, and `roomsAre` says so.
  usualRoomIds?: string[];
  roomsAre?: "usual" | "last";
  // Their wish-list nights still to come, and not already booked.
  wishList: string[];
}

// The room a returning guest has spent the most nights in. Nights, not stays:
// one month in Chill says more about a guest than two weekends in King.
export const usualRoomOf = (stays: { roomId: string; nights: number }[], rooms: TTRoom[]): string | undefined => {
  const nights = new Map<string, number>();
  stays.forEach((s) => nights.set(s.roomId, (nights.get(s.roomId) ?? 0) + s.nights));
  const live = [...nights.entries()].filter(([id]) => rooms.some((r) => r.id === id));
  live.sort((a, b) => b[1] - a[1]);
  return live[0]?.[0];
};

const WEEKDAY_NUM: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

// The most nights TT lists one by one. Past that a guest is better served by
// the calendar than by a paragraph.
const MAX_NIGHTS = 31;

const keyOf = (d: Date) => format(d, "yyyy-MM-dd");
// The year only when it is not this one: dateText reads a day already gone
// ("Oct 1" on the 2nd) as next year's, and the guest must see that it did.
// "EEE MMM d, yyyy" has no German twin in fmtDate's table, so German's own
// order is given here rather than letting the English order through in
// German words ("Sa. Okt. 10, 2026").
const niceDay = (key: string, today: Date) =>
  fmtDate(
    parseISO(key),
    parseISO(key).getFullYear() === today.getFullYear() ? "EEE MMM d" : currentLang() === "de" ? "EEE d. MMM yyyy" : "EEE MMM d, yyyy",
  );
// The key is the English with its "s" — "{n} night" / "{n} nights" — so
// German, which does not plural with an "s", gets a line of its own for each.
const plural = (n: number, word: string) => t(n === 1 ? `{n} ${word}` : `{n} ${word}s`, { n });
const names = (rooms: TTRoom[]) => rooms.map((r) => r.name).join(", ");

// A Chinese word has no \b to start from: JavaScript's \b only knows Latin
// letters and digits, so "\b停车" never matches anything, anywhere. Korean is
// the same: \b sees no word edge beside Hangul either.
// And a word that begins with an accented letter \u2014 Vietnamese "\u0111\u1eb7t", "\u1edf",
// "\u1ed3n" \u2014 never starts at \b, which JavaScript only puts beside ASCII letters,
// so it starts after anything that is not a letter instead.
const LETTER = "a-z\\u00c0-\\u024f\\u1e00-\\u1eff";
const has = (q: string, ...words: string[]) =>
  words.some((w) =>
    new RegExp(/^[\u4e00-\u9fff\uac00-\ud7a3]/.test(w) ? w : /^[^\x00-\x7f]/.test(w) ? `(?<![${LETTER}])${w}` : `\\b${w}`, "i").test(q),
  );

// A few German words for the topics, now that TiBook answers German guests
// in German. Only ADDED beside the English, never instead: the topic order
// below is unchanged, and dates are still read in English (dateText.ts). Like
// the English, each matches from the start of a word; a short one that is
// also the start of an English word ends in \b ("hund" is in "hundred",
// "bett" in "better").
const DE_ASKED = {
  extend: ["verlänger"],
  cancel: ["stornier", "absagen", "erstattung"],
  myBookings: ["meine buchung", "meine reservierung"],
  luggage: ["gepäck", "koffer"],
  checkIn: ["anreise", "abreise", "ankunft", "einchecken", "auschecken", "schlüssel"],
  // Not "bezahlen" alone: "wie viel muss ich bezahlen" asks the price, as
  // "how much do I pay" does in English.
  payment: ["wie (?:kann|soll) ich (?:be)?zahlen", "bezahlung", "zahlungs", "kreditkarte", "kaution", "gebühr", "rechnung", "überweisung"],
  longStay: ["monatlich", "langzeit", "eine woche"],
  price: ["preis", "kosten", "kostet", "wie viel\\b", "wieviel\\b", "günstig", "rabatt"],
  kitchen: ["küche", "kochen", "kühlschrank", "mikrowelle", "kaffee", "essen\\b"],
  bathroom: ["badezimmer", "dusche", "toilette", "warmwasser", "warmes wasser"],
  houseRules: ["haustier", "hund\\b", "hunde\\b", "katze", "rauchen", "raucher", "lärm", "laut\\b", "regeln", "besuch", "kinder"],
  location: ["wo\\b", "adresse", "lage\\b", "flughafen", "bahnhof", "entfernung", "wie weit", "in der nähe", "gegend", "abholen"],
  photos: ["foto", "bilder", "bild\\b", "aussehen"],
  host: ["gastgeber", "anrufen", "nachricht", "sprechen", "kontaktieren"],
  booking: ["buchen", "buchung", "reservieren"],
  rooms: ["zimmer", "bett\\b", "betten", "schlafen", "wie viele"],
  greeting: ["hallo", "guten tag", "guten morgen", "guten abend", "moin", "servus", "grüß"],
  thanks: ["danke", "vielen dank"],
  wish: ["wunschliste"],
};

// The same topics in Chinese. Beside the English and the German, never instead,
// so the topic order below decides for all three. A sentence has no spaces to
// find words by, so each of these is matched anywhere in it: keep them specific
// enough not to turn up inside another word.
const ZH_ASKED = {
  extend: ["续住", "延长", "多住", "再住", "加住"],
  cancel: ["取消", "退款", "退钱", "改期", "改日期"],
  myBookings: ["我的预订", "我的预定", "我的订单", "我的住宿", "已预订", "已经订", "订好了"],
  luggage: ["行李", "寄存"],
  checkIn: ["入住", "退房", "到达", "抵达", "晚到", "早到", "钥匙", "进门"],
  askingTime: ["几点", "什么时候", "时间"],
  charger: ["充电", "电动车", "特斯拉"],
  parking: ["停车", "车位", "车库", "开车", "泊车"],
  payment: ["怎么付", "如何付", "付款", "支付", "押金", "现金", "信用卡", "银行卡", "发票", "收据", "清洁费", "手续费"],
  longStay: ["长住", "长租", "月租", "包月", "一个月", "住一周", "住一个星期"],
  minimum: ["最少", "至少", "最短", "最长", "只住一晚"],
  price: ["价格", "价钱", "多少钱", "房价", "费用", "便宜", "折扣", "优惠", "收费"],
  kitchen: ["厨房", "做饭", "冰箱", "微波炉", "咖啡", "烧水", "吃饭"],
  bathroom: ["浴室", "卫生间", "洗手间", "厕所", "马桶", "淋浴", "洗澡", "热水"],
  houseRules: ["宠物", "狗", "猫", "抽烟", "吸烟", "派对", "聚会", "安静", "噪音", "规定", "规则", "守则", "访客", "朋友", "小孩", "孩子", "儿童", "婴儿", "宝宝"],
  location: ["在哪", "哪里", "哪儿", "地址", "位置", "附近", "机场", "火车", "地铁", "公交", "多远", "距离", "接机", "接送", "斯坦福", "谷歌", "苹果", "市中心", "安全", "治安", "周边"],
  // What TT has no map for: the area, as opposed to where the house is.
  area: ["附近", "多远", "距离", "接机", "接送", "火车", "地铁", "公交", "斯坦福", "谷歌", "苹果", "市中心", "安全", "治安", "周边"],
  photos: ["照片", "图片", "相片", "长什么样", "看看房间"],
  host: ["房东", "联系", "打电话", "发消息", "人工"],
  booking: ["预订", "预定", "订房", "订一间", "想订", "要订", "帮我订"],
  rooms: ["房间", "客房", "几间", "床", "能住", "多少人", "几个人"],
  greeting: ["你好", "您好", "嗨", "哈喽", "早上好", "下午好", "晚上好", "在吗"],
  thanks: ["谢谢", "多谢", "感谢", "太好了", "太棒了"],
  wish: ["心愿单", "愿望单", "心愿"],
  usualRoom: ["常住", "老房间", "同一间", "上次那间", "和上次一样"],
  available: ["有空", "空房", "有房", "可以订", "能订", "预订", "住"],
};

// The amenities in Chinese, by the same label AMENITIES finds them under.
const ZH_AMENITY: Record<string, RegExp> = {
  "wifi": /无线网|网络|上网|网速/,
  "air conditioning": /空调|冷气/,
  "heating": /暖气|供暖/,
  "a TV": /电视/,
  "a dedicated workspace": /办公|书桌|工作区/,
  "a fan": /风扇/,
  "a lock on the door": /门锁|锁门|上锁/,
  "outdoor space": /阳台|后院|花园|户外/,
  "towels and bed linen": /毛巾|床单|床品|被套/,
  "a hair dryer": /吹风机|电吹风/,
  "toiletries": /洗发水|护发素|沐浴露|肥皂|牙刷|牙膏|洗漱/,
  "a washer or dryer": /洗衣|烘干/,
  "an iron": /熨斗/,
  "extra blankets and pillows": /毯子|枕头|被子/,
  "a closet": /衣柜|衣架|抽屉/,
  "blackout curtains": /窗帘|遮光/,
  "a window": /窗户/,
  "a crib": /婴儿床|儿童床|高脚椅/,
  "a gym": /健身/,
  "a pool or hot tub": /泳池|游泳|按摩浴缸|桑拿/,
  "breakfast": /早餐|早饭/,
  "step-free access": /电梯|楼梯|轮椅|无障碍/,
};

// The same topics in Korean, beside the others and never instead. Korean has
// spaces, but its particles and endings attach to the word ("주차는", "주차할
// 수"), so like Chinese each word matches anywhere — keep each one specific.
// A few carry a lookahead because they begin a common unrelated word: 방 (room)
// begins 방법 (method) and 방문 (visit); 아이 (child) begins 아이폰 and 아이디.
const KO_ASKED: Record<keyof typeof ZH_ASKED, string[]> = {
  extend: ["연장", "더 묵", "더 머물", "하루 더", "며칠 더", "하룻밤 더"],
  cancel: ["취소", "환불", "날짜 변경", "일정 변경"],
  myBookings: ["내 예약", "제 예약", "예약 확인", "예약했", "예약한 "],
  luggage: ["짐(?!작)", "캐리어", "가방", "수하물"],
  checkIn: ["체크인", "체크 인", "체크아웃", "체크 아웃", "입실", "퇴실", "도착", "일찍", "열쇠", "어떻게 들어가"],
  askingTime: ["몇 ?시", "언제", "시간"],
  charger: ["충전", "전기차", "테슬라"],
  parking: ["주차", "차고", "운전", "차를", "자동차", "렌터카"],
  payment: ["결제", "지불", "보증금", "디파짓", "현금", "신용카드", "카드", "영수증", "청소비", "수수료", "계좌", "송금"],
  longStay: ["장기", "한 ?달", "월세", "\\d+개월", "일주일", "\\d+주일"],
  minimum: ["최소", "최대", "최단", "최장", "1박만", "하룻밤만", "하루만"],
  // 얼마 is "how much", but 얼마나 멀어요 / 얼마나 걸려요 asks how far or how long.
  price: ["가격", "요금", "얼마(?!나 ?(?:멀|걸))", "비용", "할인", "저렴", "싼 ", "숙박비"],
  kitchen: ["주방", "부엌", "요리", "냉장고", "전자레인지", "커피", "포트", "음식"],
  bathroom: ["화장실", "욕실", "샤워", "목욕", "욕조", "변기", "온수", "뜨거운 물", "비데"],
  houseRules: ["반려", "애완", "강아지", "개를", "고양이", "흡연", "담배", "파티", "모임", "조용", "소음", "시끄", "규칙", "규정", "방문객", "친구", "아이(?!폰|디|패드)", "어린이", "아기", "유아"],
  location: ["어디", "주소", "위치", "근처", "공항", "기차", "지하철", "버스", "얼마나 멀", "거리", "픽업", "셔틀", "스탠[퍼포]드", "구글", "애플", "시내", "다운타운", "안전", "치안", "동네", "주변"],
  // What TT has no map for: the area, as opposed to where the house is.
  area: ["근처", "공항", "기차", "지하철", "버스", "얼마나 멀", "거리", "픽업", "셔틀", "스탠[퍼포]드", "구글", "애플", "시내", "다운타운", "안전", "치안", "동네", "주변"],
  photos: ["사진", "이미지", "어떻게 생겼", "방 보여", "객실 보여"],
  host: ["호스트", "연락", "전화", "메시지", "문자", "상담"],
  booking: ["예약하", "예약 신청", "예약해", "예약할", "방 잡"],
  rooms: ["객실", "방(?!법|문)", "침대", "몇 ?명", "인원", "잘 수"],
  greeting: ["안녕", "반갑", "여보세요", "좋은 아침"],
  thanks: ["감사", "고마", "고맙", "최고"],
  wish: ["위시 ?리스트", "찜"],
  usualRoom: ["늘 묵던", "항상 묵던", "같은 방", "같은 객실", "지난번 방", "지난번이랑 같은", "전에 묵었던"],
  available: ["빈 ?방", "방 있", "객실 있", "예약 가능", "가능한", "비어", "묵을 수", "자리 있"],
};

// The amenities in Korean, by the same label AMENITIES finds them under.
const KO_AMENITY: Record<string, RegExp> = {
  "wifi": /와이파이|인터넷/,
  "air conditioning": /에어컨|냉방/,
  "heating": /난방|히터/,
  "a TV": /티비|텔레비전/,
  "a dedicated workspace": /업무 ?공간|작업 ?공간|책상/,
  "a fan": /선풍기/,
  "a lock on the door": /잠금|자물쇠|문 ?잠/,
  "outdoor space": /발코니|베란다|마당|정원|야외|테라스/,
  "towels and bed linen": /수건|타월|침구|시트/,
  "a hair dryer": /드라이기|헤어 ?드라이어/,
  "toiletries": /샴푸|린스|컨디셔너|바디워시|비누|칫솔|치약|세면도구|어메니티/,
  "a washer or dryer": /세탁|건조기/,
  "an iron": /다리미/,
  "extra blankets and pillows": /담요|베개|이불/,
  "a closet": /옷장|옷걸이|서랍/,
  "blackout curtains": /커튼|암막/,
  "a window": /창문/,
  "a crib": /아기 ?침대|유아 ?침대|하이체어/,
  "a gym": /헬스|피트니스/,
  "a pool or hot tub": /수영|자쿠지|사우나/,
  "breakfast": /아침 ?식사|조식|아침밥/,
  "step-free access": /엘리베이터|계단|휠체어/,
};

// The same topics in Spanish, beside the others and never instead. Spanish has
// Latin letters, so like the English each word matches from the start of a
// word; a short one that begins an English word ends in \b ("cama" begins
// "camera"). None may begin with an accented letter: \b does not see one.
// Some words are left out on purpose — "tarde" would send "buenas tardes" to
// check-in, and "estación" a train station to parking.
const ES_ASKED: Record<keyof typeof ZH_ASKED, string[]> = {
  extend: ["extender", "quedarme m[aá]s", "quedarnos m[aá]s", "otra noche", "una noche m[aá]s", "m[aá]s noches"],
  cancel: ["cancelar", "reembols", "devoluci[oó]n", "cambiar (?:la|mi|las) fecha"],
  myBookings: ["mis? reservas?\\b", "mis? reservaci", "ya reserv"],
  luggage: ["equipaje", "maletas?\\b", "valijas?\\b"],
  checkIn: ["llegada", "llegar\\b", "llego\\b", "salida", "entrar\\b", "llaves?\\b", "temprano"],
  askingTime: ["qu[eé] hora", "cu[aá]ndo", "hora\\b", "horario"],
  charger: ["cargador", "carro el[eé]ctrico", "auto el[eé]ctrico", "coche el[eé]ctrico"],
  parking: ["estacionamiento", "estacionar", "parqueo", "parquear", "aparcar", "garaje", "cochera", "carro\\b", "coche\\b"],
  payment: ["c[oó]mo (?:puedo |se |debo )?pag", "pago\\b", "efectivo", "tarjeta", "dep[oó]sito", "tarifa de limpieza", "recibo", "factura"],
  longStay: ["mensual", "por mes", "un mes\\b", "largo plazo", "una semana", "semanal"],
  minimum: ["m[ií]nimo", "m[aá]ximo", "s[oó]lo una noche", "una sola noche"],
  price: ["precio", "cu[aá]nto (?:cuesta|cobran|es|sale|vale)", "cuesta\\b", "costo", "tarifa", "barato", "descuento"],
  kitchen: ["cocina", "cocinar", "refri", "nevera", "microondas", "caf[eé]\\b", "comida", "comer\\b"],
  bathroom: ["ba[ñn]os?\\b", "ducha", "regadera", "inodoro", "agua caliente"],
  houseRules: ["mascota", "perros?\\b", "gatos?\\b", "fumar", "fiesta", "ruido", "silencio", "reglas", "normas", "visitas\\b", "visitantes", "amigos?\\b", "ni[ñn]os?\\b", "ni[ñn]as?\\b", "beb[eé]s?\\b"],
  location: ["d[oó]nde", "direcci[oó]n", "ubicaci[oó]n", "cerca\\b", "aeropuerto", "tren\\b", "autob[uú]s", "qu[eé] tan lejos", "distancia", "barrio", "zona\\b", "recoger", "es seguro"],
  // What TT has no map for: the area, as opposed to where the house is.
  area: ["cerca\\b", "aeropuerto", "tren\\b", "autob[uú]s", "qu[eé] tan lejos", "distancia", "barrio", "zona\\b", "recoger", "es seguro"],
  photos: ["fotos?\\b", "im[aá]genes", "c[oó]mo (?:es|se ve) (?:la|el)"],
  host: ["anfitri", "hablar con", "llamar", "contactar", "mensaje"],
  booking: ["reservar", "apartar"],
  rooms: ["habitaci", "cuartos?\\b", "camas?\\b", "dormir", "cu[aá]ntas personas", "caben"],
  greeting: ["hola", "buenos d[ií]as", "buenas tardes", "buenas noches", "buenas\\b", "qu[eé] tal"],
  thanks: ["gracias", "genial", "excelente"],
  wish: ["lista de deseos"],
  usualRoom: ["la misma habitaci", "el mismo cuarto", "de siempre", "como la [uú]ltima vez", "mi habitaci"],
  available: ["disponib", "libres?\\b", "hay (?:algo|habitaci|cuarto|lugar)", "vac[aá]n"],
};

// The amenities in Spanish, by the same label AMENITIES finds them under.
const ES_AMENITY: Record<string, RegExp> = {
  "wifi": /\b(?:internet|se[ñn]al)/i,
  "air conditioning": /\b(?:aire acondicionado|aire\b|clima\b)/i,
  "heating": /\b(?:calefacci|calentador)/i,
  "a TV": /\b(?:tele\b|televis)/i,
  "a dedicated workspace": /\b(?:escritorio|espacio de trabajo|para trabajar)/i,
  "a fan": /\bventilador/i,
  "a lock on the door": /\b(?:cerradura|candado|cerrar con llave|seguro en la puerta)/i,
  "outdoor space": /\b(?:patio|jard[ií]n|balc[oó]n|terraza|al aire libre)/i,
  "towels and bed linen": /\b(?:toallas?|s[aá]banas|ropa de cama)/i,
  "a hair dryer": /\b(?:secadora de (?:pelo|cabello)|secador)/i,
  "toiletries": /\b(?:champ[uú]|jab[oó]n|acondicionador|cepillo de dientes|pasta de dientes|art[ií]culos de (?:aseo|higiene))/i,
  "a washer or dryer": /\b(?:lavadora|secadora(?! de (?:pelo|cabello))|lavander[ií]a|lavar (?:la )?ropa)/i,
  "an iron": /\bplancha/i,
  "extra blankets and pillows": /\b(?:cobijas?|mantas?\b|almohadas?|frazadas?)/i,
  "a closet": /\b(?:cl[oó]set|armario|ganchos?|perchas?|cajones)/i,
  "blackout curtains": /\b(?:cortinas?|persianas?)/i,
  "a window": /\bventana/i,
  "a crib": /\b(?:cuna\b|silla alta|periquera)/i,
  "a gym": /\bgimnasio/i,
  "a pool or hot tub": /\b(?:piscina|alberca|jacuzzi|sauna|tina de hidromasaje)/i,
  "breakfast": /\bdesayun/i,
  "step-free access": /\b(?:escaleras?|elevador|ascensor|silla de ruedas)/i,
};

// The same topics in Vietnamese. Vietnamese writes a space between every
// syllable, so most topics are two-syllable phrases: "phòng" alone is any
// room, "phòng tắm" the bathroom. A short word that begins longer ones ends in
// VE, the letter-aware \b: "chó" (dog) must not match "chóng" (quick), nor
// "giá" (price) "giác". Left out on purpose: "sân" alone (sân bay is
// the airport), "hình" alone ("hình như" is "it seems"), "tủ" alone (tủ lạnh
// is the fridge), and "vợ chồng" as anything but a party: "can a couple
// stay" is a question about rooms, not the host's marriage.
const VE = `(?![${LETTER}])`;
const VI_ASKED: Record<keyof typeof ZH_ASKED, string[]> = {
  extend: ["ở thêm", "thêm (?:một |1 )?đêm", "gia hạn", "kéo dài"],
  cancel: ["hủy", "huỷ", "hoàn tiền", "đổi ngày", "dời ngày"],
  myBookings: ["đặt phòng của (?:tôi|em|mình)", "đã đặt", "yêu cầu của (?:tôi|em|mình)", "kỳ lưu trú của (?:tôi|em|mình)"],
  luggage: ["hành lý", "hành lí", "vali", "va li", "gửi đồ"],
  checkIn: ["nhận phòng", "trả phòng", "đến sớm", "đến muộn", "đến trễ", "về muộn", "chìa khóa", "chìa khoá", "vào nhà", "vào phòng", `sớm${VE}`, `muộn${VE}`, `trễ${VE}`],
  askingTime: ["mấy giờ", "lúc nào", "khi nào", "bao giờ", `giờ${VE}`],
  charger: ["sạc", "xe điện"],
  parking: ["đỗ xe", "đậu xe", "bãi xe", "chỗ để xe", "gửi xe", "ô tô", "xe hơi", "gara"],
  payment: ["thanh toán", "trả tiền", "tiền mặt", "chuyển khoản", `thẻ${VE}`, "đặt cọc", "tiền cọc", "phí dọn", "hóa đơn", "hoá đơn", "biên lai"],
  longStay: ["theo tháng", "hàng tháng", "một tháng", "1 tháng", "dài hạn", "lâu dài", "theo tuần", "hàng tuần", "một tuần", "1 tuần"],
  minimum: ["tối thiểu", "tối đa", "ít nhất", "chỉ (?:một|1) đêm"],
  price: [`giá${VE}`, "bao nhiêu tiền", "chi phí", `rẻ${VE}`, "giảm giá", "mất bao nhiêu"],
  kitchen: ["bếp", "nấu", "tủ lạnh", "lò vi sóng", "cà phê", "ăn uống", "đồ ăn", "ấm đun"],
  bathroom: ["phòng tắm", "nhà tắm", "nhà vệ sinh", "vòi sen", "nước nóng", `tắm${VE}`, `wc${VE}`],
  houseRules: ["thú cưng", `chó${VE}`, `mèo${VE}`, "hút thuốc", `tiệc${VE}`, `ồn${VE}`, "yên tĩnh", "nội quy", "quy định", "bạn bè", "trẻ em", "trẻ con", "em bé", "con nhỏ", "dẫn bạn", "khách đến chơi"],
  location: ["ở đâu", "địa chỉ", "vị trí", `gần${VE}`, "sân bay", `tàu${VE}`, "xe buýt", "xe bus", "bao xa", "khoảng cách", "khu vực", "khu này", "đón", "an toàn"],
  // What TT has no map for: the area, as opposed to where the house is.
  area: [`gần${VE}`, "sân bay", `tàu${VE}`, "xe buýt", "xe bus", "bao xa", "khoảng cách", "khu vực", "khu này", "đón", "an toàn"],
  photos: ["hình ảnh", "hình phòng", `ảnh${VE}`, "trông (?:như )?thế nào", "xem phòng"],
  host: ["chủ nhà", "nói chuyện", `gọi${VE}`, "liên hệ", "nhắn tin", "người thật"],
  booking: ["đặt phòng", "đặt chỗ", "giữ chỗ", "thuê phòng", `đặt${VE}`],
  rooms: [`phòng${VE}`, "giường", `ngủ${VE}`, "bao nhiêu người", "mấy người", "sức chứa", "ở được"],
  greeting: ["xin chào", "chào", `alo${VE}`],
  thanks: ["cảm ơn", "cám ơn", "tuyệt", "tốt quá", "hay quá"],
  wish: ["danh sách yêu thích", "yêu thích"],
  usualRoom: ["phòng cũ", "như lần trước", "lần trước", "phòng quen", "phòng của (?:tôi|em|mình)", "phòng mọi khi", "như mọi khi"],
  available: ["còn trống", `trống${VE}`, "còn phòng", "hết phòng", "có phòng"],
};

// The amenities in Vietnamese, by the same label AMENITIES finds them under.
// "máy lạnh" is the South's word for air conditioning and "điều hòa" the
// North's; both are here, as "bàn ủi" and "bàn là" (an iron) are.
const vi = (words: string) => new RegExp(`(?<![${LETTER}])(?:${words})`, "i");
const VI_AMENITY: Record<string, RegExp> = {
  "wifi": vi(`mạng${VE}|internet|wi-?fi`),
  "air conditioning": vi("máy lạnh|điều hòa|điều hoà"),
  "heating": vi("sưởi"),
  "a TV": vi("tivi|ti vi|truyền hình"),
  "a dedicated workspace": vi("bàn làm việc|chỗ làm việc|góc làm việc"),
  "a fan": vi("quạt"),
  "a lock on the door": vi("khóa cửa|khoá cửa|ổ khóa|ổ khoá|khóa phòng|khoá phòng"),
  "outdoor space": vi(`sân${VE}(?! bay)|vườn|ban công|ngoài trời`),
  "towels and bed linen": vi("khăn|ga giường|drap|chăn ga"),
  "a hair dryer": vi("máy sấy tóc|sấy tóc"),
  "toiletries": vi("dầu gội|xà phòng|xà bông|sữa tắm|bàn chải|kem đánh răng|đồ vệ sinh cá nhân"),
  "a washer or dryer": vi("máy giặt|giặt đồ|giặt quần áo|máy sấy quần áo|sấy đồ"),
  "an iron": vi("bàn ủi|bàn là"),
  "extra blankets and pillows": vi(`chăn${VE}|mền${VE}|gối${VE}`),
  "a closet": vi("tủ quần áo|tủ đồ|móc áo|móc treo"),
  "blackout curtains": vi("rèm|màn cửa"),
  "a window": vi("cửa sổ"),
  "a crib": vi(`cũi${VE}|nôi${VE}|ghế ăn trẻ em`),
  "a gym": vi("phòng gym|phòng tập|gym"),
  "a pool or hot tub": vi("hồ bơi|bể bơi|bồn tắm nước nóng|xông hơi"),
  "breakfast": vi("bữa sáng|ăn sáng"),
  "step-free access": vi("cầu thang|thang máy|xe lăn"),
};

// Runs of consecutive nights, each one stay as the guest would describe it.
const runsOf = (keys: string[]): string[][] => {
  const runs: string[][] = [];
  for (const k of keys) {
    const last = runs[runs.length - 1];
    if (last && keyOf(addDays(parseISO(last[last.length - 1]), 1)) === k) last.push(k);
    else runs.push([k]);
  }
  return runs;
};

// The dates a guest means, beyond what dateText reads: "this weekend", and a
// weekday on its own ("Friday"). dateText reads a weekday only after a month,
// where it means every such day; on its own a guest means the coming one.
export const datesAsked = (query: string, today: Date): { dates: string[]; past: string[] } => {
  const parsed = parseDateText(query, today, { lang: currentLang() });
  if (parsed.dates.length > 0 || parsed.past.length > 0) return parsed;

  // Vietnamese numbers its weekdays — thứ Hai (Monday) is "day two" — and
  // guests write them as words, digits or "T2". "tuần sau"/"tuần tới" after
  // one is the Friday of next week, a Vietnamese week starting on Monday, as
  // 下周五 is. "cuối tuần" (weekend) is handled with the others below.
  // Not "lần thứ hai" or "phòng thứ hai" — the second time, the second room.
  const viQ = query.normalize("NFC").toLowerCase();
  const viDay = viQ.match(
    /(?<![\p{L}\p{M}])(?<!(?:lần|người|phòng|tầng|cái)\s+)(?:th[uứ]\s*(hai|ba|t[uư]|năm|nam|sáu|sau|bảy|bay|[2-7])|t([2-7])|(ch[uủ]\s*nh[aậ]t|cn))(?![\p{L}\p{M}\d])(\s+(?:tuần\s+(?:sau|tới)|tới))?/u,
  );
  if (viDay) {
    const NUM: Record<string, number> = { hai: 1, ba: 2, tư: 3, tu: 3, năm: 4, nam: 4, sáu: 5, sau: 5, bảy: 6, bay: 6 };
    const w = viDay[1] ?? viDay[2];
    const want = viDay[3] ? 0 : /^\d$/.test(w) ? Number(w) - 1 : NUM[w];
    const inMonth = monthAsked(viQ, today);
    if (inMonth) return { dates: inMonth.filter((k) => parseISO(k).getDay() === want), past: [] };
    const todayNum = today.getDay();
    const toNextMonday = (1 - todayNum + 7) % 7 || 7;
    const ahead = /tuần/.test(viDay[4] ?? "") ? toNextMonday + (want + 6) % 7 : (want - todayNum + 7) % 7;
    return { dates: [keyOf(addDays(today, ahead))], past: [] };
  }

  // 周末 and 下周末 become the English words, so one rule decides what a weekend
  // is. 本周末 and 这个周末 are this weekend, which is what "weekend" alone means.
  // Korean the same way: 다음 주말 is next weekend, 이번 주말 and 주말 this one.
  const q = query
    .normalize("NFC")
    .toLowerCase()
    // Vietnamese: "cuối tuần sau/tới" is next weekend, "cuối tuần (này)" this.
    .replace(/cuối\s+tuần\s+(?:sau|tới)/g, " next weekend ")
    .replace(/cuối\s+tuần/g, " weekend ")
    .replace(/下个?(?:周末|週末)/g, " next weekend ")
    .replace(/周末|週末/g, " weekend ")
    .replace(/다음\s*주\s*주말|다음\s*주말/g, " next weekend ")
    .replace(/주말/g, " weekend ")
    // Spanish: "el próximo fin de semana" and "el fin de semana que viene" are
    // next weekend; "este fin de semana" and "el fin de semana" this one.
    .replace(/pr[oó]ximo\s+fin\s+de\s+semana|fin\s+de\s+semana\s+que\s+viene/g, " next weekend ")
    .replace(/fin\s+de\s+semana/g, " weekend ");
  const todayNum = today.getDay();
  // A weekend is two NIGHTS, Friday and Saturday — the nights a room is booked
  // for, which is what a guest asking about "the weekend" is asking about.
  if (/\bweekend\b/.test(q)) {
    const toFri = (5 - todayNum + 7) % 7;
    // Saturday: this weekend is tonight alone; Sunday: it has gone, so the next.
    let start = todayNum === 6 ? today : addDays(today, toFri);
    if (/\bnext weekend\b/.test(q)) start = addDays(start, todayNum === 6 ? 6 : 7);
    const nights = todayNum === 6 && !/\bnext weekend\b/.test(q) ? [start] : [start, addDays(start, 1)];
    return { dates: nights.map(keyOf), past: [] };
  }
  // 周五 is the coming Friday, as "Friday" is. 下周五 is not "next friday" as TT
  // reads that, which only moves on when today IS Friday: it is the Friday of
  // next week, and a Chinese week starts on Monday.
  const zhDay = q.match(/(下个?)?(?:周|週|星期|礼拜)([一二三四五六日天])/);
  if (zhDay) {
    const want = "日一二三四五六".indexOf(zhDay[2] === "天" ? "日" : zhDay[2]);
    const inMonth = monthAsked(q, today);
    if (inMonth) return { dates: inMonth.filter((k) => parseISO(k).getDay() === want), past: [] };
    const toNextMonday = (1 - todayNum + 7) % 7 || 7;
    const ahead = zhDay[1] ? toNextMonday + (want + 6) % 7 : (want - todayNum + 7) % 7;
    return { dates: [keyOf(addDays(today, ahead))], past: [] };
  }
  // 금요일 likewise, and 다음 주 금요일 is the Friday of next week — a Korean
  // week starts on Monday too. "11월 월요일" is every Monday in November.
  const koDay = q.match(/(다음\s*주\s*)?([일월화수목금토])요일/);
  if (koDay) {
    const want = "일월화수목금토".indexOf(koDay[2]);
    const inMonth = monthAsked(q, today);
    if (inMonth) return { dates: inMonth.filter((k) => parseISO(k).getDay() === want), past: [] };
    const toNextMonday = (1 - todayNum + 7) % 7 || 7;
    const ahead = koDay[1] ? toNextMonday + (want + 6) % 7 : (want - todayNum + 7) % 7;
    return { dates: [keyOf(addDays(today, ahead))], past: [] };
  }
  // Spanish: "el viernes" is the coming Friday; "el próximo viernes" moves on a
  // week only when today IS Friday, as "next friday" does. "los lunes de
  // noviembre" is every Monday in November.
  const esDay = q.match(/(?<!\p{L})(pr[oó]ximo\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)s?(?!\p{L})/u);
  if (esDay) {
    const want = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"].indexOf(esDay[2].normalize("NFD").replace(/\p{M}/gu, ""));
    const inMonth = monthAsked(q, today);
    if (inMonth) return { dates: inMonth.filter((k) => parseISO(k).getDay() === want), past: [] };
    let ahead = (want - todayNum + 7) % 7;
    if (esDay[1] && ahead === 0) ahead = 7;
    return { dates: [keyOf(addDays(today, ahead))], past: [] };
  }
  const day = q.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/);
  // A weekday WITH a month — "Tuesday Jan 2027", "a Friday in March" — is that
  // weekday in that month: every one of them still ahead, as "Jan Tuesday"
  // already reads, so the guest picks the night. It used to be read as the
  // weekday alone, which is the coming one: asked about a Tuesday in January
  // 2027, TT kept offering a Tuesday in October 2026 (host, 2026-10-07).
  const inMonth = day ? monthAsked(q, today) : null;
  if (day && inMonth) {
    const want = WEEKDAY_NUM[day[1]];
    return { dates: inMonth.filter((k) => parseISO(k).getDay() === want), past: [] };
  }
  if (day) {
    const want = WEEKDAY_NUM[day[1]];
    let ahead = (want - todayNum + 7) % 7;
    if (new RegExp(`\\bnext ${day[1]}`).test(q) && ahead === 0) ahead = 7;
    return { dates: [keyOf(addDays(today, ahead))], past: [] };
  }
  return { dates: [], past: [] };
};

// "for 3 people", "2 guests", "three of us".
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
export const partySizeAsked = (query: string): number | null => {
  const q = query.toLowerCase();
  const m = q.match(/\b(\d+|one|two|three|four|five|six)\s*(?:people|persons|person|guests?|adults?|of us|ppl|pax)\b/);
  if (m) return WORD_NUM[m[1]] ?? Number(m[1]);
  // "book Queen Oct 19-21 for 2" — a small number after "for", when it is not
  // nights, weeks or a time. Read as people the first time a guest tried it.
  const f = q.match(/\bfor (one|two|three|four|five|six|[1-6])\b(?!\s*(?:nights?|nts?|weeks?|days?|months?|am|pm|o'?clock|:))/);
  if (f) return WORD_NUM[f[1]] ?? Number(f[1]);
  // "2人", "两个人", "三位", "4位客人" — never a number alone, which is a date here.
  const zh = q.match(new RegExp(`(\\d{1,2}|${ZH_NUM})\\s*(?:[个個位名]\\s*(?:大人|成人|客人|住客|人)|大人|成人|客人|住客|人|位)`));
  // "二三个人", two or three people, is no one number: TT asks rather than guess.
  const n = zh ? zhNumber(zh[1]) : NaN;
  if (!Number.isNaN(n)) return n;
  // "2명", "두 명", "세 분", "2인". A digit never takes 분 here: "공항에서 10분" is
  // ten minutes, not ten guests. 2인실 and 2인용 describe a room, not the party.
  const ko = q.match(/(\d{1,2})\s*(?:명|사람|인(?![실용]))|(?<![가-힣])(한|두|세|네|다섯|여섯)\s*(?:명|분|사람)/);
  if (ko) return ko[1] ? Number(ko[1]) : ({ 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6 } as Record<string, number>)[ko[2]];
  // Spanish: "2 personas", "dos adultos", "somos tres", and "para 2" as "for 2"
  // is read above — not "para 2 noches", which is nights.
  const ES_N: Record<string, number> = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
  const es =
    q.match(/(?<!\p{L})(\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis)\s*(?:personas?|hu[eé]spedes|adultos?)(?!\p{L})/u) ??
    q.match(/(?<!\p{L})(?:somos|seremos|para)\s+(dos|tres|cuatro|cinco|seis|[1-6])(?!\p{L})(?!\s*(?:noches?|semanas?|d[ií]as|meses|:))/u);
  if (es) return ES_N[es[1]] ?? Number(es[1]);
  // Vietnamese: "2 người", "hai người lớn", "3 khách". "người" needs its
  // number right before it: "người lớn" alone is "adults", no count.
  const VI_N: Record<string, number> = { một: 1, hai: 2, ba: 3, bốn: 4, năm: 5, sáu: 6 };
  const viCount = q.normalize("NFC").match(/(?<![\p{L}\p{M}\d])(\d{1,2}|một|hai|ba|bốn|năm|sáu)\s*(?:người|khách)(?![\p{L}\p{M}])/u);
  return viCount ? VI_N[viCount[1]] ?? Number(viCount[1]) : null;
};

// A room named in the question. Longest name first, so "ChillChill" is not
// read as "Chill".
const roomAsked = (query: string, rooms: TTRoom[]): TTRoom | null => {
  const q = query.toLowerCase();
  const byLength = [...rooms].sort((a, b) => b.name.length - a.name.length);
  return byLength.find((r) => new RegExp(`\\b${r.name.toLowerCase()}\\b`).test(q)) ?? null;
};

const roomsFitting = (rooms: TTRoom[], party: number | null) =>
  party == null ? rooms : rooms.filter((r) => (getRoomFacts(r.airbnbUrl)?.maxGuests ?? 0) >= party);

// What this guest pays, in the gallery's own words. A stranger is never quoted
// the room's list price: TiBook leaves the price to a conversation with the
// host, and TT saying a number the gallery does not would be two screens
// disagreeing. A $0 rate is family, on purpose — said, never "corrected".
//
// Since 2026-11 a room with no rate for this guest is given as its range, the
// same one its card shows (util/priceRange) — still never one bare number.
const rateLine = (room: TTRoom, ctx: AskTTContext): string | null => {
  const rate = ctx.myRates.get(room.id);
  if (rate == null) {
    return room.priceRange ? t("{room}: {range} a night.", { room: room.name, range: priceRangeText(room.priceRange) }) : null;
  }
  return rate === 0
    ? t("{room}: family — no charge, agreed with {host}.", { room: room.name, host: ctx.hostFirstName })
    : t("{room}: your price is ${rate}/night.", { room: room.name, rate });
};

const chat = (ctx: AskTTContext, label?: string): TTAction => ({ kind: "chat", label: label ?? t("Ask {host}", { host: ctx.hostFirstName }) });

// How a reply was asked for. `booking` is set when the guest has said they
// want to BOOK — in this question, or in the one before it ("I'd like to book"
// … "Oct 10-12") — rather than only asked what is free.
interface Asked {
  booking: boolean;
  party: number | null;
  // The two-night reading of a dash range, carried onto a Book button.
  alt?: string[] | null;
}
const JUST_LOOKING: Asked = { booking: false, party: null };

// The button that takes nights. For somebody new who is only LOOKING it
// chooses them — the nights land on the calendar so they can see what they
// picked and learn how TiBook works. Somebody who asked to book, or a
// returning guest (who came to book), gets "Book", which books the stay here
// in the conversation (ttBooking.ts) — once they have read it back and said
// send. A stay with no one room ("any room") still goes the calendar's way,
// where the form gives each stay its own room.
const pick = (ctx: AskTTContext, what: string, dates: string[], roomId: string | null, asked: Asked = JUST_LOOKING): TTAction => {
  if (roomId && (ctx.guest || asked.booking)) {
    const alt = asked.alt && asked.alt.length > 0 && asked.alt.length === dates.length - 1 ? asked.alt : undefined;
    return { kind: "book", label: t("Book {what} →", { what }), dates, roomId, party: asked.party, ...(alt ? { alt } : {}) };
  }
  return ctx.guest
    ? { kind: "pick", label: t("Request {what} →", { what }), dates, roomId, review: true }
    : { kind: "pick", label: t("Choose {what}", { what }), dates, roomId };
};

// The guest's rooms first, in the order the greeting and the usual-stay popup
// name them (usualRoomIds), then the rest as they came. It used to lift only
// usualRoomId, so a guest told "King, Cute, Queen or Chill" saw Cute after
// rooms they never stay in.
const usualFirst = (rooms: TTRoom[], ctx: AskTTContext) => {
  const order = ctx.guest?.usualRoomIds?.length ? ctx.guest.usualRoomIds : ctx.guest?.usualRoomId ? [ctx.guest.usualRoomId] : [];
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  return [...rooms].sort((a, b) => rank(a.id) - rank(b.id));
};
const roomLabel = (r: TTRoom, ctx: AskTTContext) =>
  r.id === ctx.guest?.usualRoomId ? t("{room} (your usual)", { room: r.name }) : r.name;

// ── Availability ─────────────────────────────────────────────────────────────
const answerDates = (
  dates: string[],
  past: string[],
  ctx: AskTTContext,
  room: TTRoom | null,
  party: number | null,
  asked: Asked = JUST_LOOKING,
): TTReply => {
  const nice = (key: string) => niceDay(key, ctx.today);
  const lines: string[] = [];
  const actions: TTAction[] = [];
  if (past.length > 0 && dates.length === 0) {
    return {
      lines: [
        past.length === 1
          ? t("{day} has already passed. Which dates are you thinking of next?", { day: nice(past[0]) })
          : t("Those nights have already passed. Which dates are you thinking of next?"),
      ],
      // The label is in the guest's language; the query stays English because
      // the parser reads English. The chip shows German, TT reads "this weekend".
      actions: [{ kind: "ask", label: t("This weekend"), query: "this weekend" }],
    };
  }
  if (past.length > 0) {
    lines.push(
      past.length === 1
        ? t("{nights} you mentioned has already passed, so I've left it out.", { nights: plural(past.length, "night") })
        : t("{nights} you mentioned have already passed, so I've left them out.", { nights: plural(past.length, "night") }),
    );
  }

  const askedNights = dates.slice(0, MAX_NIGHTS);
  // Said FIRST, before which rooms are free: a returning guest asking for
  // "Nov Mon-Tue" may not notice Thanksgiving week is in it, and TT's button
  // goes straight to Review Request. Review asks again; this is the earlier,
  // cheaper moment to notice (2026-10-05).
  const holidays = askedNights.filter((k) => usHolidayOn(k));
  if (holidays.length > 0) {
    lines.push(
      t(
        holidays.length === 1
          ? "Heads up — {days}, a US holiday. Make sure you mean to stay that night."
          : "Heads up — {days}, a US holiday. Make sure you mean to stay those nights.",
        { days: holidays.map((k) => t("{day} is {holiday}", { day: nice(k), holiday: holidayLabelForGuest(usHolidayOn(k)!) })).join(", ") },
      ),
    );
  }
  if (dates.length > MAX_NIGHTS) lines.push(t("That's {n} nights — I've looked at the first {max}. The calendar shows the rest.", { n: dates.length, max: MAX_NIGHTS }));

  // The rooms this question is about: the one named, else every room that
  // fits the party.
  const scope = room ? [room] : roomsFitting(ctx.rooms, party);
  if (party != null && !room && scope.length === 0) {
    return {
      lines: [t("No single room here sleeps {n}. {host} can tell you how to split the party across two rooms.", { n: party, host: ctx.hostFirstName })],
      actions: [chat(ctx)],
    };
  }
  if (party != null && !room) lines.push(t("For {guests}: {rooms}.", { guests: plural(party, "guest"), rooms: names(scope) }));
  const scopeIds = new Set(scope.map((r) => r.id));
  const freeIn = (key: string) => ctx.freeRoomsOn(key).filter((r) => scopeIds.has(r.id));

  const soldOut: string[] = [];
  for (const run of runsOf(askedNights)) {
    const span = run.length === 1 ? nice(run[0]) : `${nice(run[0])} – ${nice(run[run.length - 1])}`;
    const perNight = run.map((k) => ({ key: k, free: freeIn(k) }));
    const wholeStay = usualFirst(scope, ctx).filter((r) => perNight.every((n) => n.free.some((f) => f.id === r.id)));
    const fullNights = perNight.filter((n) => n.free.length === 0).map((n) => n.key);
    soldOut.push(...fullNights);
    const nightsWord = plural(run.length, "night");

    if (wholeStay.length > 0) {
      lines.push(
        room
          ? t("{span} ({nights}): {room} is free ✓", { span, nights: nightsWord, room: room.name })
          : t("{span} ({nights}): free for the whole stay — {rooms}.", { span, nights: nightsWord, rooms: wholeStay.map((r) => roomLabel(r, ctx)).join(", ") }),
      );
      const forSpan = askedNights.length > run.length ? t(" for {span}", { span }) : "";
      wholeStay.slice(0, 3).forEach((r) => actions.push(pick(ctx, r.name + forSpan, run, r.id, asked)));
      if (!room && wholeStay.length > 1) actions.push(pick(ctx, t("any room") + forSpan, run, null, asked));
    } else if (fullNights.length === 0) {
      // Every night has a room, just not the same one. Two stays, said so
      // (TIBOOK.md rule 2) — the guest is not told "nothing is free".
      lines.push(
        t("{span}: there's a room every night, but no one room for all {nights} — you'd move once. {each}.", {
          span,
          nights: nightsWord,
          each: perNight.map((n) => `${nice(n.key)}: ${names(n.free)}`).join(" · "),
        }),
      );
      actions.push(pick(ctx, t("these {nights}", { nights: nightsWord }), run, null));
    } else if (fullNights.length === run.length) {
      lines.push(room ? t("{span}: {room} is taken.", { span, room: room.name }) : t("{span}: sold out, I'm sorry.", { span }));
      if (room) {
        const others = ctx.rooms.filter((r) => r.id !== room.id && run.every((k) => ctx.freeRoomsOn(k).some((f) => f.id === r.id)));
        if (others.length > 0) {
          lines.push(t("Free instead for those nights: {rooms}.", { rooms: names(others) }));
          usualFirst(others, ctx).slice(0, 2).forEach((r) => actions.push(pick(ctx, r.name, run, r.id, asked)));
        }
      }
    } else {
      const open = perNight.filter((n) => n.free.length > 0);
      const vars = { span, days: fullNights.map(nice).join(", "), free: open.map((n) => `${nice(n.key)} (${names(n.free)})`).join(" · ") };
      lines.push(
        room
          ? t("{span}: {room} is taken on {days}. Free: {free}.", { ...vars, room: room.name })
          : t("{span}: sold out on {days}. Free: {free}.", vars),
      );
      const openKeys = open.map((n) => n.key);
      // A Book button only for nights that are still one stay; free nights
      // with a sold-out one between them go to the calendar, which splits them.
      const oneRun = runsOf(openKeys).length === 1;
      actions.push(pick(ctx, t("the {nights}", { nights: plural(open.length, "free night") }), openKeys, room && oneRun ? room.id : null, asked));
    }
  }
  // A night nobody can have is still worth the host knowing about: the wish
  // list is how a guest says "tell me if this opens up". Added for them, not
  // described (rule 5).
  if (soldOut.length > 0) {
    actions.push({ kind: "wish", label: t("★ Wish list the {nights}", { nights: plural(soldOut.length, "full night") }), dates: soldOut });
  }
  return { lines, actions };
};

// ── Booking ──────────────────────────────────────────────────────────────────
//
// The guest asked to BOOK, with dates. When one room is free for the whole
// stay — the one they named, their usual, or the only one that fits — TT
// starts the booking straight away (`book`), and the sheet asks for whatever
// is still missing. Anything else is the availability answer with Book
// buttons on it, so a taken room or a split stay is explained exactly as it
// always has been.
const answerBooking = (
  dates: string[],
  past: string[],
  ctx: AskTTContext,
  room: TTRoom | null,
  asked: Asked,
): TTReply => {
  const party = asked.party;
  if (room && party != null && maxGuestsOf(room) < party) {
    const fit = roomsFitting(ctx.rooms, party).filter((r) => dates.length > 0 && dates.every((k) => ctx.freeRoomsOn(k).some((f) => f.id === r.id)));
    return {
      lines: [
        t("{room} sleeps up to {max}, so it can't take {n}.", { room: room.name, max: maxGuestsOf(room), n: party }),
        fit.length > 0
          ? t("Free for {guests} on those nights: {rooms}.", { guests: plural(party, "guest"), rooms: names(fit) })
          : t("{host} can help you split the party across two rooms.", { host: ctx.hostFirstName }),
      ],
      actions: fit.length > 0 ? fit.slice(0, 3).map((r) => pick(ctx, r.name, dates, r.id, asked)) : [chat(ctx)],
    };
  }
  const choice = past.length === 0 ? chooseRoom(dates, ctx, room, party) : { kind: "none" as const };
  if (choice.kind === "room") {
    const r = choice.room;
    const alt = asked.alt && asked.alt.length === dates.length - 1 ? asked.alt : undefined;
    return {
      lines: [t("{room} is free — {stay}. Let's book it.", { room: r.name, stay: stayLine(dates) })],
      actions: [],
      book: { roomId: r.id, dates, party, ...(alt ? { alt } : {}) },
    };
  }
  if (choice.kind === "choose") {
    return {
      lines: [t("{stay}. Free for the whole stay: {rooms}. Which room would you like?", { stay: stayLine(dates), rooms: choice.rooms.map((r) => roomLabel(r, ctx)).join(", ") })],
      actions: [
        ...usualFirst(choice.rooms, ctx).slice(0, 5).map((r) => pick(ctx, r.name, dates, r.id, asked)),
        { kind: "ask", label: t("Compare the rooms"), query: party ? `rooms for ${party} guests` : "rooms" },
      ],
    };
  }
  return answerDates(dates, past, ctx, room, party, asked);
};

// "Anything in November?" — the month at a glance, never thirty buttons.
const answerMonth = (nights: string[], ctx: AskTTContext, room: TTRoom | null): TTReply => {
  const month = fmtDate(parseISO(nights[0]), "MMMM");
  const free = (k: string) => ctx.freeRoomsOn(k).filter((r) => !room || r.id === room.id).length > 0;
  const full = nights.filter((k) => !free(k));
  const nice = (k: string) => fmtDate(parseISO(k), "MMM d");
  // German writes a run inside one month as "3.–5. Nov.", English "Nov 3–5",
  // and Chinese "11月3日–5日".
  const runLabel = (r: string[]) =>
    r.length === 1
      ? nice(r[0])
      : currentLang() === "de"
        ? `${fmtDate(parseISO(r[0]), "d.")}–${nice(r[r.length - 1])}`
        : currentLang() === "zh"
          ? `${nice(r[0])}–${format(parseISO(r[r.length - 1]), "d")}日`
          : currentLang() === "ko"
            ? `${nice(r[0])}–${format(parseISO(r[r.length - 1]), "d")}일`
            // Spanish puts the run before the month, as German does: "3–5 nov".
            // Vietnamese too: "3–5 thg 11".
            : currentLang() === "es" || currentLang() === "vi"
              ? `${format(parseISO(r[0]), "d")}–${nice(r[r.length - 1])}`
              : `${nice(r[0])}–${format(parseISO(r[r.length - 1]), "d")}`;
  const who = room ? room.name : t("a room");
  return {
    lines: [
      full.length === 0
        ? t("{month}: {who} is free every night ✓", { month, who })
        : full.length === nights.length
          ? room
            ? t("{month}: {room} is taken every night, I'm sorry.", { month, room: room.name })
            : t("{month}: sold out every night, I'm sorry.", { month })
          : t("{month}: {who} is free on {free} of {n} nights. Taken: {taken}.", {
              month,
              who,
              free: nights.length - full.length,
              n: nights.length,
              taken: runsOf(full).map(runLabel).join(", "),
            }),
      // The example stays in English date words on purpose: it is something
      // to TYPE, and the date parser reads English — and Chinese, so a Chinese
      // guest is shown the form they would write anyway. Korean the same.
      t("Tell me the nights — like “{example}” — and I'll book them.", {
        example:
          currentLang() === "zh"
            ? `${format(parseISO(nights[0]), "M月d")}-${format(addDays(parseISO(nights[0]), 2), "d")}日`
            : currentLang() === "ko"
            ? `${format(parseISO(nights[0]), "M월 d")}-${format(addDays(parseISO(nights[0]), 2), "d")}일`
            // "10-12 de octubre", which dateText reads as Spanish.
            : currentLang() === "es"
            ? `${format(parseISO(nights[0]), "d")}-${format(addDays(parseISO(nights[0]), 2), "d")} de ${fmtDate(parseISO(nights[0]), "MMMM")}`
            // "10-12 tháng 10", which dateText reads as Vietnamese.
            : currentLang() === "vi"
            ? `${format(parseISO(nights[0]), "d")}-${format(addDays(parseISO(nights[0]), 2), "d")} tháng ${format(parseISO(nights[0]), "M")}`
            :`${format(parseISO(nights[0]), "MMM d")}-${format(addDays(parseISO(nights[0]), 2), "d")}`,
      }),
    ],
    // Only house-wide sold-out nights: the wish list says "tell me if a room
    // opens", and a night only the named room is taken on has rooms open.
    actions: !room && full.length > 0 ? [{ kind: "wish", label: t("★ Wish list the {nights}", { nights: plural(full.length, "full night") }), dates: full }] : [],
  };
};

// ── Rooms ────────────────────────────────────────────────────────────────────
const answerRoom = (room: TTRoom, ctx: AskTTContext): TTReply => {
  const facts = getRoomFacts(room.airbnbUrl);
  const lines: string[] = [];
  if (facts) {
    // The listing's own words (roomFacts.ts) go through t() as well, so a
    // German line for one, added anywhere in the dictionary, is used here
    // too; one with none stays in the listing's English.
    lines.push(t("{room} sleeps up to {max} · {beds}.", { room: room.name, max: facts.maxGuests, beds: facts.beds.map((b) => t(b.label)).join(" + ") }));
    lines.push(t(facts.bathroom).replace(/ /g, " ") + t("."));
    lines.push(t(facts.privacy) + t("."));
    lines.push(facts.highlights.map((h) => t(h)).join(" · "));
  } else {
    lines.push(t("{room} is one of the {n} rooms. {host} can tell you more about it.", { room: room.name, n: ctx.rooms.length, host: ctx.hostFirstName }));
  }
  const rate = rateLine(room, ctx);
  if (rate) lines.push(rate);
  return {
    lines,
    actions: [
      { kind: "photos", label: t("See {room}'s photos", { room: room.name }), roomId: room.id },
      { kind: "room", label: t("Show {room}'s free nights", { room: room.name }), roomId: room.id },
      { kind: "ask", label: t("Is {room} free this weekend?", { room: room.name }), query: `${room.name} this weekend` },
      ...(ctx.reviews?.rooms[room.id] ? [reviewsOf(room)] : []),
      ...(ctx.reviews?.latest?.[room.id] ? [latestOf(room)] : []),
    ],
    // A room the facts table does not know is one TT could not describe.
    answered: !!facts,
  };
};

// ── What guests say ──────────────────────────────────────────────────────────
//
// Only what the host PUBLISHED (see `reviews` on the context): Claude drafts
// it from the AirBnB reviews, the host reads and edits it in TiMag. TT adds
// nothing of its own — a guest choosing a room on the strength of a review
// must be reading what the house stands behind.
const REVIEW_WORDS =
  /\b(?:reviews?|reviewed|ratings?|rated|stars|feedback|testimonials?)\b|\bwhat (?:do|did|have) (?:the )?(?:other |previous |past |former |last |latest |recent |most recent )?(?:guests?|people) (?:say|said|think|thought|write|written|like|liked)\b/;
// "Bewertung(en)" beside the English (see DE_ASKED).
const askedAboutReviews = (q: string) => REVIEW_WORDS.test(q.toLowerCase()) || /\bbewertung|评价|评论|点评|评分|几星|星级|口碑|리뷰|후기|평점|별점|평가/.test(q.toLowerCase());
// "King's latest review", "the most recent reviews", "what did the last guest
// think". Only ever read AFTER askedAboutReviews, so "last" here is never
// "last weekend".
const LATEST_WORDS = /\b(?:latest|newest|most recent|recent|last|lastest)\b|最新|最近|上一位|上一个|上次|최신|최근|마지막|지난번/;
const askedForLatest = (q: string) => LATEST_WORDS.test(q.toLowerCase());

// The label in the guest's language, the query in English: the parser reads
// English, so the chip shows German and still asks "King reviews".
const reviewsOf = (room: TTRoom): TTAction => ({ kind: "ask", label: t("What guests say about {room}", { room: room.name }), query: `${room.name} reviews` });
const latestOf = (room: TTRoom): TTAction => ({ kind: "ask", label: t("{room}'s latest review", { room: room.name }), query: `${room.name} latest review` });

// "Gail · September 2026 · ★★★★★" — who wrote it (first name, as on AirBnB;
// host, 2026-10-09), and how recent "latest" is, said every time, so a guest
// never takes a review from a year ago for last week's. The stars are a ROW
// of five, not "5 ★": that read as a data label, and TiBook colours a row of
// stars so the score is seen at a glance (host, 2026-10-09).
export const starRow = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
// The night of the stay when it is on record ("Oct 8, 2026"), else the month
// the review gives ("October 2026") — the host asked for the day once the
// stays were found (2026-10-10). Shared with TiMag's TT box so the two agree.
export const latestDateLabel = (l: Pick<TTLatestReview, "month" | "stayDate">) =>
  l.stayDate ? format(parseISO(l.stayDate), "MMM d, yyyy") : format(parseISO(`${l.month}-01`), "MMMM yyyy");
// latestDateLabel is TiMag's too, and the host reads English, so the guest's
// date is made here and that one is left alone.
const latestDateForGuest = (l: Pick<TTLatestReview, "month" | "stayDate">) =>
  l.stayDate ? fmtDate(parseISO(l.stayDate), "MMM d, yyyy") : fmtDate(parseISO(`${l.month}-01`), "MMMM yyyy");
const latestWhen = (l: TTLatestReview) =>
  [l.guest ?? "", latestDateForGuest(l), l.stars ? starRow(l.stars) : ""].filter(Boolean).join(" · ");

// The newest review of a room, as the host published its summary. No room
// named: each room's, one line apiece, since "latest" of the house would be
// one guest's word on one room standing in for all five.
const answerLatestReview = (ctx: AskTTContext, room: TTRoom | null): TTReply => {
  const r = ctx.reviews;
  const withLatest = ctx.rooms.filter((x) => r?.latest?.[x.id]);
  if (room) {
    const l = r?.latest?.[room.id];
    if (l) {
      return {
        lines: [t("{room}'s latest review — {when}:", { room: room.name, when: latestWhen(l) }), l.summary],
        actions: [
          ...(r?.rooms[room.id] ? [reviewsOf(room)] : []),
          { kind: "photos", label: t("See {room}'s photos", { room: room.name }), roomId: room.id },
          { kind: "room", label: t("Show {room}'s free nights", { room: room.name }), roomId: room.id },
        ],
      };
    }
    // The overall summary is still worth saying — but it is not what was
    // asked, so the host sees the question.
    const said = r?.rooms[room.id];
    return {
      lines: [
        t("I don't have {room}'s latest review yet.", { room: room.name }),
        ...(said
          ? [t("Here's what guests say about {room} overall:", { room: room.name }), said]
          : [t("{host} can tell you what the last guests thought.", { host: ctx.hostFirstName })]),
      ],
      actions: [...withLatest.filter((x) => x.id !== room.id).slice(0, 3).map(latestOf), chat(ctx)],
      answered: false,
    };
  }
  if (withLatest.length === 0) {
    return {
      lines: [t("I don't have the latest reviews yet — {host} can tell you what recent guests thought.", { host: ctx.hostFirstName })],
      actions: [...reviewStarter(ctx), chat(ctx)],
      answered: false,
    };
  }
  return {
    lines: [
      t("The latest review of each room:"),
      ...withLatest.map((x) => {
        const l = r!.latest![x.id];
        return `${x.name} (${latestWhen(l)}): ${l.summary}`;
      }),
    ],
    actions: [...reviewStarter(ctx), ...withLatest.slice(0, 3).map((x) => ({ kind: "photos" as const, label: t("See {room}'s photos", { room: x.name }), roomId: x.id }))],
  };
};

const ratingLine = (r: TTReviews | undefined): string | null =>
  r?.rating && r.count
    ? t("Rated {rating} ★ across {reviews}.", { rating: currentLang() === "de" ? String(r.rating).replace(".", ",") : r.rating, reviews: plural(r.count, "AirBnB review") })
    : null;

const answerReviews = (ctx: AskTTContext, room: TTRoom | null): TTReply => {
  const r = ctx.reviews;
  const roomsWithReviews = ctx.rooms.filter((x) => r?.rooms[x.id]);
  if (room) {
    const said = r?.rooms[room.id];
    if (said) {
      return {
        lines: [t("What guests say about {room}:", { room: room.name }), said],
        // The latest review is ALWAYS the next step from one room's reviews,
        // published or not (host, 2026-10-08) — unlike the other review
        // buttons, which only appear when there is something to show. A tap
        // with nothing published is logged unanswered, which tells the host
        // guests want it.
        actions: [
          latestOf(room),
          { kind: "photos", label: t("See {room}'s photos", { room: room.name }), roomId: room.id },
          { kind: "room", label: t("Show {room}'s free nights", { room: room.name }), roomId: room.id },
          ...(r?.house ? [{ kind: "ask" as const, label: t("What guests say about the house"), query: "reviews" }] : []),
        ],
      };
    }
    // Nothing for this room yet: what there is for the house is still worth
    // saying, but the question was not answered and the host should see it.
    return {
      lines: [
        t("I don't have a summary of {room}'s reviews yet.", { room: room.name }),
        ...(r?.house
          ? [t("Here's what guests say about the house:"), r.house]
          : [t("{host} can tell you what guests think of it.", { host: ctx.hostFirstName })]),
      ],
      actions: [latestOf(room), ...roomsWithReviews.slice(0, 3).map(reviewsOf), chat(ctx)],
      answered: false,
    };
  }
  const rating = ratingLine(r);
  if (!r?.house) {
    return {
      lines: [
        ...(rating ? [rating] : []),
        t("I don't have a summary of the reviews yet — {host} can tell you what guests say.", { host: ctx.hostFirstName }),
      ],
      actions: [...roomsWithReviews.slice(0, 3).map(reviewsOf), chat(ctx)],
      answered: false,
    };
  }
  return {
    lines: [...(rating ? [rating] : []), t("What guests say about TT House:"), r.house],
    // Each room's own summary one tap away, so a guest weighing two rooms
    // does not have to type the question twice.
    actions: roomsWithReviews.slice(0, 5).map(reviewsOf),
  };
};

const answerRooms = (ctx: AskTTContext, party: number | null): TTReply => {
  const fit = roomsFitting(ctx.rooms, party);
  if (fit.length === 0) {
    return { lines: [t("No single room here sleeps {n}. {host} can help you split the party across two.", { n: String(party), host: ctx.hostFirstName })], actions: [chat(ctx)] };
  }
  return {
    lines: [
      party != null ? t("For {guests}:", { guests: plural(party, "guest") }) : t("There are {n} rooms:", { n: ctx.rooms.length }),
      ...fit.map((r) => {
        const f = getRoomFacts(r.airbnbUrl);
        return f
          ? t(f.bathroom.startsWith("Shared") ? "{room} — up to {max}, shared bathroom" : "{room} — up to {max}, private bathroom", { room: r.name, max: f.maxGuests })
          : r.name;
      }),
    ],
    actions: fit.slice(0, 4).map((r) => ({ kind: "ask" as const, label: t("About {room}", { room: r.name }), query: r.name })),
  };
};

// ── What is in the rooms ─────────────────────────────────────────────────────
//
// Things guests ask after, each checked against what every room's LISTING
// says (roomFacts.ts) — TT says what the listings say and no more. One with no
// `listed` pattern is something no listing mentions: TT names it and hands it
// to the host, so the guest knows they were understood and the host's log
// shows which thing is being asked about (it used to read "I'm not sure I
// understood that" for a towel).
//
// Order matters: "hair dryer" and "body wash" before the washer and dryer.
// The German words at the end of some `asked` are additions, as DE_ASKED's are.
interface Amenity {
  asked: RegExp;
  label: string;
  listed?: RegExp;
  // A basic every guest expects. One listing mentioning it is not the others
  // going without, so a partial match is left for the host to confirm.
  basic?: boolean;
}
const AMENITIES: Amenity[] = [
  { asked: /\b(?:wi-?fi|internet|wlan)\b/i, label: "wifi", listed: /wifi/i },
  { asked: /\b(?:air ?con\w*|a\/c|ac|cooling|klimaanlage|klima)\b/i, label: "air conditioning", listed: /air conditioning/i },
  { asked: /\b(?:heat\w*|cold|heizung)\b/i, label: "heating", listed: /heating/i },
  { asked: /\b(?:tv|television|netflix|streaming|fernseher)\b/i, label: "a TV", listed: /\btv\b/i },
  { asked: /\b(?:work from|working from|work remotely|desk|workspace|office|zoom)\b/i, label: "a dedicated workspace", listed: /workspace/i },
  { asked: /\bfans?\b/i, label: "a fan", listed: /\bfans?\b/i },
  { asked: /\b(?:locks?|lockable|locked)\b/i, label: "a lock on the door", listed: /lock on the door/i },
  { asked: /\b(?:balcony|backyard|yard|garden|patio|outdoor)\b/i, label: "outdoor space", listed: /backyard|balcony/i },
  { asked: /\b(?:towels?|linens?|sheets|bedding|handtücher|handtuch|bettwäsche)\b/i, label: "towels and bed linen", listed: /towels|linen/i, basic: true },
  { asked: /\b(?:hair ?dryer|blow ?dryer|föhn|fön|haartrockner)\b/i, label: "a hair dryer" },
  { asked: /\b(?:shampoo|conditioner|soap|body wash|toiletries|toothbrush|toothpaste)\b/i, label: "toiletries" },
  { asked: /\b(?:laundry|washer|washing machine|dryer|wash|waschmaschine|trockner)\b/i, label: "a washer or dryer", listed: /washer|laundry/i },
  { asked: /\b(?:iron|ironing)\b/i, label: "an iron" },
  { asked: /\b(?:blankets?|pillows?|duvet)\b/i, label: "extra blankets and pillows" },
  { asked: /\b(?:closet|wardrobe|hangers?|drawers?)\b/i, label: "a closet" },
  { asked: /\b(?:curtains?|blackout|blinds)\b/i, label: "blackout curtains" },
  { asked: /\bwindows?\b/i, label: "a window" },
  { asked: /\b(?:crib|cot|high ?chair|pack ?n ?play)\b/i, label: "a crib" },
  { asked: /\b(?:gym|fitness)\b/i, label: "a gym" },
  { asked: /\b(?:pool|hot tub|jacuzzi|sauna)\b/i, label: "a pool or hot tub" },
  { asked: /\bbreakfast\b/i, label: "breakfast" },
  { asked: /\b(?:elevator|lift|stairs|wheelchair|accessible|step-free)\b/i, label: "step-free access" },
];

// ── The questions guests text the host ───────────────────────────────────────
const answerTopic = (q: string, ctx: AskTTContext, party: number | null): TTAnswer | null => {
  let category: TTCategory = "other";
  const reply = ((): TTReply | null => {
    const host = ctx.hostFirstName;

    // Staying longer is booking the extra nights — something TT can do now
    // (ttBooking.ts) — not a question about the stay already booked.
    if (has(q, "extend", "stay longer", "extra night", "more nights", "another night", ...DE_ASKED.extend, ...ZH_ASKED.extend, ...KO_ASKED.extend, ...ES_ASKED.extend, ...VI_ASKED.extend)) {
      category = "booking";
      return {
        lines: [t("Tell me the extra nights — like “Oct 13-14” — and I'll check your room is free and book them.")],
        actions: [{ kind: "bookings", label: t("See my stays") }],
      };
    }
    // Cancelling comes before "my booking": "I need to cancel my booking" is
    // asking about the terms, and was being sent to the bookings list alone.
    if (has(q, "cancel", "refund", "change my", "money back", ...DE_ASKED.cancel, ...ZH_ASKED.cancel, ...KO_ASKED.cancel, ...ES_ASKED.cancel, ...VI_ASKED.cancel)) {
      category = "cancellation";
      const full = ctx.cancellationFullRefundDays;
      const half = ctx.cancellationHalfRefundDays;
      const mine: TTAction[] = has(q, "my booking", "my stay", "my reservation") ? [{ kind: "bookings", label: t("Open Your bookings") }] : [];
      return full != null && half != null
        ? { lines: [cancellationHeadline(full, t) + t("."), formatCancellationPolicy(full, half, t)], actions: [...mine, chat(ctx)] }
        : { lines: [t("TT House is flexible when plans change — tell {host} what's happening and you'll work it out together.", { host })], actions: [...mine, chat(ctx)] };
    }
    if (has(q, "my booking", "my stay", "my reservation", "booked", "confirm", ...DE_ASKED.myBookings, ...ZH_ASKED.myBookings, ...KO_ASKED.myBookings, ...ES_ASKED.myBookings, ...VI_ASKED.myBookings)) {
      category = "myBookings";
      return { lines: [t("Your stays, holds and wish list are all under Your bookings — just your phone number opens them.")], actions: [{ kind: "bookings", label: t("Open Your bookings") }] };
    }
    // Bags before and after a stay: nothing on the page says, so it goes to
    // the host — filed under check-in, where the host will look for it.
    if (has(q, "luggage", "bags?\\b", "suitcase", "baggage", ...DE_ASKED.luggage, ...ZH_ASKED.luggage, ...KO_ASKED.luggage, ...ES_ASKED.luggage, ...VI_ASKED.luggage)) {
      category = "checkIn";
      return { lines: [t("{host} can tell you whether your bags can stay before check-in or after check-out.", { host })], actions: [chat(ctx)], answered: false };
    }
    if (has(q, "check-in", "check in", "checkin", "arriv", "check-out", "check out", "checkout", "late", "early", "get in\\b", "let myself in", "keys\\b", ...DE_ASKED.checkIn, ...ZH_ASKED.checkIn, ...KO_ASKED.checkIn, ...ES_ASKED.checkIn, ...VI_ASKED.checkIn)) {
      category = "checkIn";
      // The house has no check-in or check-out TIME written down anywhere TT
      // can read. Self check-in is the true answer to "how do I get in"; it
      // is not an answer to "what time", and saying it as one left guests
      // asking twice. The time goes to the host, and the log shows it.
      const askingTime = has(q, "what time", "when", "time", "hour", "o'clock", ...ZH_ASKED.askingTime, ...KO_ASKED.askingTime, ...ES_ASKED.askingTime, ...VI_ASKED.askingTime);
      return {
        lines: [
          t("Every room has self check-in."),
          t("Your door code and the address come in Your bookings once your stay is confirmed."),
          ...(askingTime ? [t("{host} will confirm your check-in and check-out times with your booking.", { host })] : []),
          t("Arriving after midnight? Book the night BEFORE — 1am Tuesday is the Monday night. If you're unsure, {host} will sort it out.", { host }),
        ],
        actions: [{ kind: "bookings", label: t("Open Your bookings") }, chat(ctx)],
        answered: !askingTime,
      };
    }
    if (has(q, "\\bev\\b", "charger", "charging", "electric car", "tesla", ...ZH_ASKED.charger, ...KO_ASKED.charger, ...ES_ASKED.charger, ...VI_ASKED.charger)) {
      category = "parking";
      return { lines: [t(houseParking) + t("."), t("None of the listings mention a charger — {host} will know.", { host })], actions: [chat(ctx)], answered: false };
    }
    if (has(q, "park", "car", "garage", "driv", ...ZH_ASKED.parking, ...KO_ASKED.parking, ...ES_ASKED.parking, ...VI_ASKED.parking)) {
      category = "parking";
      return { lines: [t(houseParking) + t(".")], actions: [] };
    }
    // How to pay, deposits, fees, receipts: none of it is written anywhere TT
    // reads, and a wrong word about money is the expensive kind. Filed under
    // price for the host, who answers and can teach it.
    if (has(q, "cash", "venmo", "zelle", "paypal", "credit card", "debit", "card\\b", "deposit", "cleaning fee", "fees?\\b", "receipt", "invoice", "how (?:do|can|should) i pay", "payment", ...DE_ASKED.payment, ...ZH_ASKED.payment, ...KO_ASKED.payment, ...ES_ASKED.payment, ...VI_ASKED.payment)) {
      category = "price";
      return {
        lines: [t("{host} sorts out payment with you directly — ask about it in a message and you'll have a straight answer.", { host })],
        actions: [chat(ctx, t("Ask {host} about payment", { host }))],
        answered: false,
      };
    }
    // A long stay is two questions: is a room free the whole time (TT can
    // check) and what does it cost (the host's, like every price).
    if (has(q, "month", "monthly", "long term", "long-term", "longer stay", "weekly", "a week", ...DE_ASKED.longStay, ...ZH_ASKED.longStay, ...KO_ASKED.longStay, ...ES_ASKED.longStay, ...VI_ASKED.longStay)) {
      category = "price";
      return {
        lines: [
          t("Tell me the dates — like “Nov 1 for 30 nights” — and I'll check a room is free the whole time."),
          t("The rate for a longer stay is agreed with {host}: send the dates and {host} will come back with one.", { host }),
        ],
        actions: [chat(ctx, t("Ask {host} about a long stay", { host }))],
      };
    }
    // TiBook takes a request for any number of nights; the host decides each.
    if (has(q, "minimum", "min stay", "maximum", "max stay", "shortest", "longest", "(?:just|only) (?:one|1|a single) night", ...ZH_ASKED.minimum, ...KO_ASKED.minimum, ...ES_ASKED.minimum, ...VI_ASKED.minimum)) {
      category = "booking";
      return {
        lines: [t("You can ask for any number of nights here, even one. {host} confirms each request.", { host })],
        actions: [{ kind: "ask", label: t("This weekend"), query: "book this weekend" }],
      };
    }
    if (has(q, "price", "cost", "how much", "rate", "cheap", "discount", "pay", "dollar", ...DE_ASKED.price, ...ZH_ASKED.price, ...KO_ASKED.price, ...ES_ASKED.price, ...VI_ASKED.price)) {
      category = "price";
      const rates = ctx.rooms.map((r) => rateLine(r, ctx)).filter(Boolean) as string[];
      // "Your prices" only when every line IS theirs; a list with ranges in it
      // says who settles the exact figure.
      const allAgreed = ctx.rooms.every((r) => ctx.myRates.get(r.id) != null);
      return rates.length > 0
        ? {
            lines: [
              allAgreed
                ? t("Your prices, agreed with {host}:", { host })
                : t("Prices a night are flexible — {host} will find one that works for you both:", { host }),
              ...rates,
            ],
            actions: [chat(ctx, allAgreed ? t("Talk to {host} about price", { host }) : t("Ask {host} for a price", { host }))],
          }
        : { lines: [t("The price is something you settle with {host} directly — send your dates and {host} will give you a rate.", { host })], actions: [chat(ctx, t("Ask {host} for a price", { host }))] };
    }
    if (has(q, "kitchen", "cook", "fridge", "refrigerator", "microwave", "coffee", "food", "kettle", ...DE_ASKED.kitchen, ...ZH_ASKED.kitchen, ...KO_ASKED.kitchen, ...ES_ASKED.kitchen, ...VI_ASKED.kitchen)) {
      category = "kitchen";
      const withIt = (re: RegExp) => ctx.rooms.filter((r) => getRoomFacts(r.airbnbUrl)?.highlights.some((h) => re.test(h)));
      const fridge = withIt(/fridge/i);
      const micro = withIt(/microwave/i);
      const coffee = withIt(/coffee/i);
      return {
        lines: [
          t(houseKitchen) + t("."),
          ...(fridge.length ? [t("Mini fridge in: {rooms}.", { rooms: names(fridge) })] : []),
          ...(micro.length ? [t("Microwave in: {rooms}.", { rooms: names(micro) })] : []),
          ...(coffee.length ? [t("Coffee maker in: {rooms}.", { rooms: names(coffee) })] : []),
        ],
        actions: [],
      };
    }
    if (has(q, "bath", "toilet", "shower", "restroom", "bidet", "hot water", ...DE_ASKED.bathroom, ...ZH_ASKED.bathroom, ...KO_ASKED.bathroom, ...ES_ASKED.bathroom, ...VI_ASKED.bathroom)) {
      category = "bathroom";
      const shared = ctx.rooms.filter((r) => getRoomFacts(r.airbnbUrl)?.bathroom.startsWith("Shared"));
      const own = ctx.rooms.filter((r) => { const f = getRoomFacts(r.airbnbUrl); return f && !f.bathroom.startsWith("Shared"); });
      return {
        lines: [
          t(houseBathrooms) + t("."),
          ...(own.length ? [t("Private bathroom: {rooms}.", { rooms: names(own) })] : []),
          ...(shared.length ? [t("Shared bathroom with a bathtub and hot water: {rooms}.", { rooms: names(shared) })] : []),
        ],
        actions: [],
      };
    }
    const amenity = AMENITIES.find((a) => a.asked.test(q) || ZH_AMENITY[a.label]?.test(q) || KO_AMENITY[a.label]?.test(q) || ES_AMENITY[a.label]?.test(q) || VI_AMENITY[a.label]?.test(q));
    if (amenity) {
      category = "amenities";
      // What each room's listing says, all of it: the highlights, and the
      // bathroom and privacy lines ("with a lock on the door", "hot water").
      const listed = (r: TTRoom) => {
        const f = getRoomFacts(r.airbnbUrl);
        return f ? [...f.highlights, f.bathroom, f.privacy].join(" · ") : "";
      };
      const withIt = amenity.listed ? ctx.rooms.filter((r) => amenity.listed!.test(listed(r))) : [];
      // Not when there are no rooms to read: none of none is not "every".
      // German needs the thing in a different case after "has" and after
      // "with", so its lines are built around the bare noun ("Fernseher")
      // rather than slotting "a TV" into the middle of a sentence.
      const thing = t(amenity.label);
      if (withIt.length > 0 && withIt.length === ctx.rooms.length) return { lines: [t("Every room has {thing} ✓", { thing })], actions: [] };
      if (withIt.length > 0) {
        return {
          // A basic (towels) listed for one room is a listing that happened to
          // mention it, not the other rooms going without. Said that way, and
          // left for the host to settle.
          lines: amenity.basic
            ? [t("{rooms}'s listing mentions {thing}. The others don't say — {host} can confirm.", { rooms: names(withIt), thing, host })]
            : [t("Rooms with {thing}: {rooms}.", { thing, rooms: names(withIt) })],
          actions: amenity.basic ? [chat(ctx)] : [],
          answered: !amenity.basic,
        };
      }
      // Named, so the guest knows TT understood the question and the host's
      // log shows which thing guests are asking after.
      return { lines: [t("None of the room listings mention {thing} — {host} will know for sure.", { thing, host })], actions: [chat(ctx)], answered: false };
    }
    if (
      has(q, "pet", "dog", "cat", "smok", "party", "parties", "quiet", "loud", "nois", "rule", "visitor", "friend", "kid", "child", "baby", "babies", "infant", "toddler", ...DE_ASKED.houseRules, ...ZH_ASKED.houseRules, ...KO_ASKED.houseRules, ...ES_ASKED.houseRules, ...VI_ASKED.houseRules) ||
      /\b(?:have|bring|invite)\b.*\b(?:a guest|guests|someone|somebody|people|partner|over)\b/i.test(q)
    ) {
      category = "houseRules";
      const rules = ctx.houseRules?.trim();
      return rules
        ? { lines: [t("The house rules:"), rules], actions: [chat(ctx, t("Ask {host} about something else", { host }))] }
        : { lines: [t("{host} will tell you straight — just ask.", { host })], actions: [chat(ctx)], answered: false };
    }
    if (has(q, "where", "address", "location", "near", "airport", "transit", "caltrain", "bart", "how far", "distance", "minutes", "sjc", "sfo", "stanford", "google", "apple\\b", "downtown", "safe\\b", "neighbo", "area\\b", "shuttle", "pick me up", "pick up", "uber\\b", "lyft", "bus\\b", "train\\b", ...DE_ASKED.location, ...ZH_ASKED.location, ...KO_ASKED.location, ...ES_ASKED.location, ...VI_ASKED.location)) {
      category = "location";
      // "Where is it" is answered: Silicon Valley, address once confirmed.
      // "How far to Stanford", "is the area safe", "a store nearby" are not —
      // TT has no map — and are left in the host's to-teach pile.
      const onlyWhere = !has(q, "how far", "distance", "minutes", "near", "safe", "neighbo", "area", "shuttle", "pick", "uber", "lyft", "bus", "train", "sjc", "sfo", "stanford", "google", "apple", "downtown", ...ZH_ASKED.area, ...KO_ASKED.area, ...ES_ASKED.area, ...VI_ASKED.area);
      return {
        lines: [
          t("TT House is in Silicon Valley. The exact address comes in Your bookings once your stay is confirmed."),
          onlyWhere
            ? t("{host} can tell you how to get here from the airport or the station.", { host })
            : t("{host} knows the area best and will answer that — send a message.", { host }),
        ],
        actions: [chat(ctx)],
        answered: onlyWhere,
      };
    }
    if (has(q, "photo", "picture", "pics?\\b", "image", "look like", "see the room", "see inside", ...DE_ASKED.photos, ...ZH_ASKED.photos, ...KO_ASKED.photos, ...ES_ASKED.photos, ...VI_ASKED.photos)) {
      category = "rooms";
      return {
        lines: [t("Pick a room to see its photos:")],
        actions: ctx.rooms.slice(0, 5).map((r) => ({ kind: "photos" as const, label: t("{room} photos", { room: r.name }), roomId: r.id })),
      };
    }
    if (has(q, "host", "human", "person", "talk", "call", "text", "contact", "message", "speak", ...DE_ASKED.host, ...ZH_ASKED.host, ...KO_ASKED.host, ...ES_ASKED.host, ...VI_ASKED.host)) {
      category = "contactHost";
      return { lines: [t("{host} lives here and reads every message personally.", { host })], actions: [chat(ctx, t("Chat {host}", { host }))] };
    }
    if (has(q, "book", "reserve", "request", "want a room", "need a room", ...DE_ASKED.booking, ...ZH_ASKED.booking, ...KO_ASKED.booking, ...ES_ASKED.booking, ...VI_ASKED.booking)) {
      category = "booking";
      const usual = ctx.rooms.find((r) => r.id === ctx.guest?.usualRoomId);
      if (ctx.guest) {
        return {
          lines: [
            usual
              ? t("Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and I'll book them in {room}, or any room that's free. You check the request before it's sent.", { room: usual.name })
              : t("Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and I'll book them. You check the request before it's sent."),
          ],
          actions: [
            ...(ctx.guest.wishList.length > 0 ? [{ kind: "ask" as const, label: t("My wish list"), query: "my wish list" }] : []),
            { kind: "ask", label: usual ? t("{room} this weekend", { room: usual.name }) : t("This weekend"), query: usual ? `book ${usual.name} this weekend` : "book this weekend" },
          ],
        };
      }
      return {
        lines: [
          t("Happy to book it for you. Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and how many of you there are."),
          t("You'll see the whole request before anything is sent."),
        ],
        actions: [{ kind: "ask", label: t("This weekend"), query: "book this weekend" }, { kind: "request", label: t("Use the booking form") }],
      };
    }
    if (has(q, "room", "bed", "sleep", "fit", "capacity", "how many", ...DE_ASKED.rooms, ...ZH_ASKED.rooms, ...KO_ASKED.rooms, ...ES_ASKED.rooms, ...VI_ASKED.rooms) || party != null) {
      category = "rooms";
      return answerRooms(ctx, party);
    }
    // Whole words: "hi" as a prefix greeted a guest asking whether a fee was hidden.
    // Guests here greet in Vietnamese and Spanish too; TT answers in English,
    // but it should know it was greeted.
    if (has(q, "hi\\b", "hello", "hey\\b", "good morning", "good afternoon", "good evening", "hola\\b", "xin ch[aà]o", "ch[aà]o\\b", "bonjour", "yo\\b", ...DE_ASKED.greeting, ...ZH_ASKED.greeting, ...KO_ASKED.greeting, ...ES_ASKED.greeting, ...VI_ASKED.greeting)) {
      category = "greeting";
      return { lines: [t("Hello! Ask me about dates, rooms, parking, check-in — anything about staying here.")], actions: [] };
    }
    if (has(q, "thank", "thx", "great", "perfect", "awesome", ...DE_ASKED.thanks, ...ZH_ASKED.thanks, ...KO_ASKED.thanks, ...ES_ASKED.thanks, ...VI_ASKED.thanks)) {
      category = "thanks";
      return { lines: [t("You're welcome. “Your comfort. Our mission.” is TT House's promise to you.")], actions: [] };
    }
    return null;
  })();
  return reply ? as(category, reply) : null;
};

// ── Layer 2: what TT will not be asked ───────────────────────────────────────
//
// Checked before ANY other reading of the question, so a date or a room name
// inside it cannot route it to an answer first ("who is in King Oct 10" is a
// question about a person, not about Oct 10). Broad on purpose: a guest whose
// honest question trips one of these is sent to the host, which costs them a
// message; a question about somebody else that slips through costs that
// person their privacy.
//
// No refusal repeats what was asked for, names anyone, or says whether the
// thing asked about exists.

// Other people: who is staying, who booked, other guests, the team.
//
// Each pattern is about SOMEBODY ELSE. The guest's own questions — "3 guests
// staying Oct 10", "are kids allowed", "show me my bookings" — must not trip
// them, so none matches on "guests" or "kids" alone.
const ABOUT_OTHERS = [
  /\bwho(?:m|'s|s)?\b/,
  /\bwhose\b/,
  /\b(?:other|another|previous|next|last|current|existing) (?:guests?|person|people|tenants?|bookings?|reservations?)\b/,
  /\b(?:someone|somebody|anyone|anybody) (?:else|staying|booked|there|in)\b/,
  // "is Eddie staying", "are the Nguyens arriving" — up to three words of
  // somebody between the verb and the stay. Not the guest's own party: "are
  // two of us staying", "are 3 guests arriving".
  /\b(?:is|are|was|were) (?!(?:it|there|you|we|i|my|our|us|two|three|four|five|six|\d+)\b)(?:the )?(?![a-z]* ?(?:guests?|people|of us|adults|kids)\b)[a-z'-]+(?: [a-z'-]+){0,2} (?:staying|booked|checking in|coming|arriving|leaving)\b/,
  /\bnames? of\b/,
  /\bthe (?:guest|person|people|man|woman|guy|lady|family|couple) (?:in|at|staying|who|booked|from)\b/,
  /\bbooked by\b/,
  /\b(?:guest|booking|reservation) (?:list|names?|history|records?)\b/,
  /\b(?:all|every|everyone's|other people's) (?:bookings?|reservations?|stays|guests'?s? (?:names|details|bookings))\b/,
  /\bhow many (?:people|guests|others) (?:are|will be|were) (?:staying|there|here|booked|in)\b/,
  /\b(?:their|his|her) (?:name|names|phone|number|email|booking|bookings|address|details|dates)\b/,
  /\b(?:neighbou?rs?|roommates?|housemates?|tenants?|occupants?)\b/,
  /\b(?:cleaners?|cleaning (?:lady|staff|crew|person)|housekeep\w*|staff|employees?|workers?|team members?|interns?|cohosts?|co-hosts?)\b/,
  /\b(?:last name|surname|full name|maiden name)\b/,
  // The same in Chinese. Without these, the dates TT now reads in Chinese would
  // answer "谁住在 King 10月10日" as a question about Oct 10. Broad, as above.
  /谁|哪位客人|其他(?:客人|住客|房客|人)|别的(?:客人|住客|房客)|上一位|下一位|姓名|全名|名字|名单|他们的|他的|她的|邻居|室友|房客|清洁工|保洁|员工|工作人员|团队成员|实习生/,
  // And Korean, for the same reason: "누가 King 10월 10일에 묵어요?" must not be
  // answered as a question about Oct 10.
  /누구|누가|다른\s*(?:손님|게스트|투숙객|사람)|이전\s*(?:손님|게스트)|다음\s*(?:손님|게스트)|이름|성함|명단|그\s*사람|이웃|룸메이트|하우스메이트|세입자|청소부|청소하시는|직원|스태프|인턴|공동\s*호스트/,
  // And Spanish: "¿quién se queda en King el 10 de octubre?". Letter-aware
  // edges, since \b stops at the é of "quién". Not "equipo", which is also
  // equipment, and not "su reserva": a guest writing "usted" says "su" to TT.
  /(?<!\p{L})(?:qui[eé]n(?:es)?|de qui[eé]n|otr[oa]s? (?:hu[eé]sped(?:es)?|personas?|inquilin[oa]s?|reservas?|reservaciones?)|alguien (?:m[aá]s|est[aá]|se queda|reserv\p{L}*)|(?:el|la|los|las) (?:hu[eé]sped(?:es)?|persona|personas|se[ñn]or|se[ñn]ora|familia|pareja) (?:de|en|que)|reservad[oa] por|nombres? de|(?:su|sus) (?:nombre|tel[eé]fono|n[uú]mero|correo|direcci[oó]n)|cu[aá]ntas personas (?:hay|est[aá]n|se quedan)|apellidos?|nombre completo|vecin[oa]s?|compa[ñn]er[oa]s? de cuarto|inquilin[oa]s?|limpiador[ae]?s?|personal de limpieza|el personal|emplead[oa]s?|trabajador[ae]?s?|becari[oa]s?|pasantes?|coanfitri\p{L}*)(?!\p{L})/u,
  // And Vietnamese: "ai ở phòng King ngày 10 tháng 10?". "ai" (who) only with
  // a verb after it — "ai" alone is also the English "AI", and "có ai…" can
  // be a guest asking whether anyone can help. Not "khách" alone, and not
  // "vợ chồng": "2 khách", "vợ chồng tôi" are the guest's own party.
  /(?<![\p{L}\p{M}])(?:ai\s+(?:đang|đã|sẽ|ở|thuê|đặt|book|ngủ|nằm|đến|trả phòng|nhận phòng)|của\s+ai|người\s+khác|khách\s+(?:khác|trước|sau|kế|bên cạnh|ở phòng)|(?:người|khách)\s+(?:đang\s+)?(?:ở|thuê)\s+(?:phòng|trước|sau|bên)|tên\s+(?:của\s+)?(?:khách|người|họ)|họ\s+tên|danh\s+sách\s+khách|hàng\s+xóm|bạn\s+cùng\s+phòng|người\s+thuê|người\s+dọn|nhân\s+viên|lao\s+công|thực\s+tập\s+sinh|đồng\s+chủ\s+nhà|có\s+ai\s+(?:ở|đặt|thuê))(?![\p{L}\p{M}])/u,
];
// The host's personal life. The page says who the host is and that they live
// here; nothing beyond that.
const hostPersonal = (s: string, hostFirst: string) =>
  (/房东|屋主/.test(s) && /年龄|多大|几岁|生日|结婚|老婆|妻子|太太|丈夫|老公|女朋友|男朋友|工资|收入|宗教|政治|在哪[儿里]?(?:工作|上班|上学)|公司|学校|国籍|哪里人|哪国人/.test(s)) ||
  (/호스트|집주인/.test(s) && /나이|몇\s*살|생일|결혼|아내|부인|남편|여자\s*친구|남자\s*친구|애인|월급|연봉|수입|종교|정치|직장|회사|학교|국적|어디\s*출신|어느\s*나라/.test(s)) ||
  (/anfitri|due[ñn]o/.test(s) && /(?<!\p{L})(?:edad|cu[aá]ntos a[ñn]os|cumplea[ñn]os|casad[oa]|esposa|esposo|marido|novi[oa]|salario|sueldo|ingresos|religi[oó]n|pol[ií]tica|d[oó]nde trabaja|empresa|escuela|nacionalidad|de d[oó]nde es)(?!\p{L})/u.test(s)) ||
  // Vietnamese. Not "vợ chồng", "bạn gái" or "con" alone: "chủ nhà có cho vợ
  // chồng ở không" asks whether a couple may stay.
  (/chủ\s+nhà/.test(s) && /(?<![\p{L}\p{M}])(?:bao nhiêu tuổi|mấy tuổi|tuổi|sinh nhật|có (?:vợ|chồng|người yêu|bạn gái|bạn trai|gia đình)|kết hôn|lập gia đình|lương|thu nhập|tôn giáo|đạo gì|chính trị|làm (?:ở |việc ở )?(?:đâu|công ty)|học (?:ở đâu|trường)|quốc tịch|người nước nào|quê)(?![\p{L}\p{M}])/u.test(s)) ||
  new RegExp(`\\b(?:host|owner|${hostFirst.toLowerCase().replace(/[^a-z-]/g, "")})\\b`).test(s) &&
  // Not "kids", "family" or "partner": "does the host allow kids" is a guest
  // asking about their OWN party.
  /\b(?:age|old is|birthday|born|married|wife|husband|girlfriend|boyfriend|salary|income|religion|politics|employer|job|work(?:s)? (?:at|for)|company|school|studies|nationality|from where|where (?:is|does) (?:the )?\w+ (?:from|work|live))\b/.test(s);
// Contact details, anyone's — the host's included. The Message button reaches
// the host without a number ever being shown.
// Vietnamese apart, with letter-aware edges. Zalo is how Vietnamese people
// text, as WeChat is for Chinese.
const VI_CONTACT = /(?<![\p{L}\p{M}])(?:số\s+điện\s+thoại|số\s+đt|sđt|zalo|địa\s+chỉ\s+nhà|địa\s+chỉ\s+email|mạng\s+xã\s+hội)(?![\p{L}\p{M}])/u;
// Codes and passwords in Vietnamese. "mã giảm giá" (a discount code) is not a
// secret; "mã" with a door, lock or PIN is.
const VI_SECRETS = /(?<![\p{L}\p{M}])(?:mật\s+khẩu|mật\s+mã|mã\s+(?:cửa|khóa|khoá|mở\s+cửa|vào|pin|số\s+cửa)|hộp\s+(?:chìa\s+)?khóa|hộp\s+(?:chìa\s+)?khoá|két\s+sắt)(?![\p{L}\p{M}])/u;
// 微信 alone is contact; 微信支付 is a question about paying, which goes to the host.
const CONTACT = /\b(?:phone|cell|mobile|whatsapp|telephone|e-?mail|emails|contact (?:info|information|details)|home address|social media|instagram|facebook|linkedin)\b|(?<![a-z])(?:tel[eé]fono|celular|correo electr[oó]nico|correo|datos de contacto|direcci[oó]n de (?:su |tu )?casa|redes sociales)(?![a-zñ])|电话|手机|微信(?!支付)|邮箱|电子邮件|联系方式|家庭住址|社交媒体|전화\s*번호|휴대폰|핸드폰|카톡|카카오톡|이메일|메일\s*주소|연락처|집\s*주소|인스타|sns/;
// Codes and passwords. Zip, promo and coupon codes are not secrets.
const SECRETS = /(?<!zip |postal |promo |coupon |discount )\b(?:codes?|pass ?(?:word|code)s?|pins?|combination|combo|lock ?box|key ?pad|key ?safe)\b|(?<![a-z])(?:c[oó]digos?(?! postal| de descuento| promocional)|contrase[ñn]as?|clave(?:s)?(?! del? (?:anfitri|reserva))|caja de llaves|combinaci[oó]n)(?![a-zñ])|密码|门禁码|开门码|门码|门锁码|保险箱|钥匙盒|비밀\s*번호|비번|패스워드|도어\s*코드|출입\s*코드|현관\s*코드|공동\s*현관|키\s*박스|금고/;
// The system behind the page, and attempts to talk TT out of these rules.
const SYSTEM = [
  /\b(?:api|apis|api key|backend|back-end|server|servers|database|databases|db|mongo\w*|graphql|endpoint|admin\w*|tokens?|jwt|credentials?|source code|env|\.env|environment variables?|secrets?|ip address|hack\w*|exploit\w*|vulnerab\w*|sql|json|aws|ec2|vite|config\w*|devtools|dev tools|console|debug\w*|localstorage|cookies?|user ?agent)\b/,
  /\b(?:prompt|system prompt|your (?:rules|instructions|code|programming)|how (?:are|were) you (?:built|made|programmed|coded))\b/,
  /\b(?:ignore|disregard|forget|override|bypass) (?:all |the |your |any |previous |prior |above )*(?:rules|instructions|prompts?|restrictions|guidelines)\b/,
  /\b(?:pretend|act as|you are now|roleplay|role-play|jailbreak|developer mode|dan mode)\b/,
  /后端|服务器|数据库|接口|管理员|令牌|凭据|源代码|源码|环境变量|密钥|秘钥|漏洞|黑客|提示词|系统提示|你的(?:指令|规则|代码|程序)|你是怎么(?:做|写|开发|编写|编程)|(?:忽略|无视|忘记|绕过|覆盖).{0,12}(?:规则|指令|提示|限制)|假装|扮演|越狱|开发者模式/,
  // Korean puts the verb last, so "ignore the rules" is 규칙을 무시해: both orders.
  /백엔드|서버|데이터베이스|관리자|토큰|소스\s*코드|환경\s*변수|비밀\s*키|취약점|해킹|해커|프롬프트|너의?\s*(?:지시|규칙|코드)|(?:규칙|지시|지침|제한).{0,12}(?:무시|잊어|우회)|(?:무시|잊어|우회).{0,12}(?:규칙|지시|지침|제한)|역할\s*극|탈옥|개발자\s*모드/,
  /(?<!\p{L})(?:servidor(?:es)?|base de datos|c[oó]digo fuente|variables? de entorno|credenciales|administrador|tus (?:reglas|instrucciones|c[oó]digo)|c[oó]mo te (?:hicieron|programaron|crearon)|(?:ignora|olvida|omite|salta|evita)\p{L}* .{0,20}(?:reglas|instrucciones|restricciones|indicaciones)|finge|act[uú]a como|haz de cuenta|modo desarrollador)(?!\p{L})/u,
  // Vietnamese: "bỏ qua các quy tắc", "giả vờ là…". Verb first, as in English.
  /(?<![\p{L}\p{M}])(?:máy\s+chủ|cơ\s+sở\s+dữ\s+liệu|mã\s+nguồn|biến\s+môi\s+trường|quản\s+trị\s+viên|(?:bỏ\s+qua|quên|phớt\s+lờ|vượt\s+qua).{0,20}(?:quy\s+tắc|hướng\s+dẫn|chỉ\s+dẫn|giới\s+hạn)|giả\s+vờ|đóng\s+vai|chế\s+độ\s+nhà\s+phát\s+triển)(?![\p{L}\p{M}])/u,
];

const privacyRefusal = (q: string, ctx: AskTTContext): TTAnswer | null => {
  const s = q.toLowerCase();
  const host = ctx.hostFirstName;
  // "Who is the host?" is the one "who" with a public answer: the host's
  // name and face are at the top of the page.
  if (/^\W*who(?:'s| is)(?: the| your| my)? (?:host|owner)\W*$/.test(s) || /^(?:(?:你们的|这里的|这儿的)?房东是谁|谁是(?:你们的|这里的|这儿的)?房东)[?？!！。\s]*$/.test(s) || /^(?:호스트(?:가|는|분이?|님이?)?\s*누구(?:예요|에요|인가요|세요|야)?|누가\s*호스트(?:예요|에요|인가요|야)?)[?!.\s]*$/.test(s) || /^[¿¡\s]*qui[eé]n es (?:el |la |tu |su )?(?:anfitri[oó]na?|due[ñn][oa])[?!.\s]*$/.test(s) || /^\s*(?:ai\s+là\s+chủ\s+nhà|chủ\s+nhà\s+là\s+ai)(?:\s*(?:vậy|thế|ạ|nhỉ))?[?!.\s]*$/u.test(s)) {
    return as("contactHost", { lines: [t("Your host is {host}, who lives here.", { host })], actions: [chat(ctx, t("Chat {host}", { host }))] });
  }
  if (SYSTEM.some((re) => re.test(s))) {
    return as("privacy", {
      lines: [
        t("That's not something I can help with. I'm TT House's booking helper — I can tell you about the rooms, which nights are free, and staying here."),
      ],
      actions: [{ kind: "ask", label: t("What's free this weekend?"), query: "this weekend" }],
    });
  }
  if (SECRETS.test(s) || VI_SECRETS.test(s)) {
    return as("privacy", {
      lines: [
        t("I never give out door codes, passwords or PINs."),
        t("Once your stay is confirmed, your own check-in details are in Your bookings, opened with your phone number."),
      ],
      actions: [{ kind: "bookings", label: t("Open Your bookings") }],
    });
  }
  if (CONTACT.test(s) || VI_CONTACT.test(s)) {
    return as("privacy", {
      lines: [t("I don't share anyone's contact details. To reach {host}, send a message here — it goes straight to {host}.", { host })],
      actions: [chat(ctx, t("Chat {host}", { host }))],
    });
  }
  // "What did previous guests say about King?" reads as a question about
  // other guests, and is really one about the room. Let it through to the
  // reviews — unless it asks WHO, or for names, which are still refused.
  const aboutReviews = askedAboutReviews(s) && !/\bwho|\bnames?\b|谁|名字|姓名|누구|누가|이름|성함|qui[eé]n|nombres?/.test(s) && !/(?<![\p{L}\p{M}])(?:ai|tên)(?![\p{L}\p{M}])/u.test(s);
  if ((ABOUT_OTHERS.some((re) => re.test(s)) && !aboutReviews) || hostPersonal(s, host)) {
    return as("privacy", {
      lines: [
        t("I keep everyone at TT House private — guests, the host and the team. I can't say who is staying, who booked, or anything about them."),
        t("I can tell you which rooms are free on your dates."),
      ],
      actions: [{ kind: "ask", label: t("What's free this weekend?"), query: "this weekend" }],
    });
  }
  return null;
};

// ── Layer 3: nothing private leaves, whatever produced it ────────────────────
//
// Shapes, not values: TT does not hold the door codes to look for, which is
// the point of layer 1. A house-rules note the host typed with a number in it
// is the case this is mostly for.
const SCRUBS: RegExp[] = [
  /\b\d{3,8}#/g, // a door code: "1224#"
  /[^\s@]+@[^\s@]+\.[^\s@]+/g, // an email
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi, // a link
  /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, // an IP address
  /(?:\+?\d[\s().-]*){7,}\d/g, // a phone number, or any long run of digits
];
export const scrub = (text: string) => SCRUBS.reduce((t, re) => t.replace(re, "(hidden)"), text);
const scrubAction = (a: TTAction): TTAction =>
  a.kind === "ask" ? { ...a, label: scrub(a.label), query: scrub(a.query) } : { ...a, label: scrub(a.label) };

export interface AskOptions {
  // The guest said they want to book in the turn before this one ("I'd like
  // to book"), so dates on their own now mean "book these".
  booking?: boolean;
}

const answer = (query: string, ctx: AskTTContext, opts: AskOptions): TTAnswer => {
  const q = query.trim();
  const usual = ctx.rooms.find((r) => r.id === ctx.guest?.usualRoomId) ?? null;
  // "my usual room", "same room as last time", "King again" — a returning
  // guest saying which room without naming it.
  const room = roomAsked(q, ctx.rooms) ?? (usual && has(q, "usual", "same room", "my room", "again", "as last time", ...ZH_ASKED.usualRoom, ...KO_ASKED.usualRoom, ...ES_ASKED.usualRoom, ...VI_ASKED.usualRoom) ? usual : null);
  const party = partySizeAsked(q);
  // Their wish list: the nights they already told the house they wanted. TT
  // checks them all at once, which is the shortest way from "I wanted these"
  // to a request for them.
  if (ctx.guest && has(q, "wish", ...DE_ASKED.wish, ...ZH_ASKED.wish, ...KO_ASKED.wish, ...ES_ASKED.wish, ...VI_ASKED.wish)) {
    if (ctx.guest.wishList.length === 0) {
      return as("wishList", {
        lines: [t("Your wish list is empty. Tell me the dates you'd like — “Oct 10-12”, “Nov Mon-Tue” — and I'll check them.")],
        actions: [{ kind: "ask", label: t("This weekend"), query: "this weekend" }],
      });
    }
    return as("wishList", answerDates(ctx.guest.wishList, [], ctx, room, party));
  }
  // Dates first: "is King free Oct 10" is a question about Oct 10, with King
  // narrowing it. Stripping the party size first keeps "3 people" from being
  // read as anything else.
  //
  // A stay written with its check-out ("Oct 20 to Oct 23", "Nov 3 for 2
  // nights") is read as one first: the plain parser sees two loose days there.
  const stay = readStay(q, ctx.today);
  const { dates, past } = stay ?? datesAsked(q, ctx.today);
  if (dates.length > 0 || past.length > 0) {
    const booking = !!opts.booking || wantsToBook(q);
    // A stay read from its check-out day is unambiguous; "Oct 10-12" is not.
    const asked: Asked = { booking, party, alt: stay ? null : checkoutReading(q, dates) };
    return booking
      ? as("booking", answerBooking(dates, past, ctx, room, asked))
      : as("availability", answerDates(dates, past, ctx, room, party, asked));
  }
  // A month on its own. Only with a word about staying, or alone: "may" is
  // also a verb, and "May I bring a dog?" is about the dog.
  const month = monthAsked(q, ctx.today);
  // Chinese has no spaces to count words by, so a short message stands in for a
  // short sentence: "12月能带狗吗" is about the dog, and says nothing about a stay.
  // Korean has spaces, but its words carry more: "12\uc6d4 \uac15\uc544\uc9c0 \ub3fc\uc694?" is three and
  // about the dog. Two words \u2014 "12\uc6d4 \uc5b4\ub54c\uc694?" \u2014 is still a question about a stay.
  const shortAsk = /[\u4e00-\u9fff]/.test(q) ? q.length <= 5 : /[\uac00-\ud7a3]/.test(q) ? q.split(/\s+/).length <= 2 : q.split(/\s+/).length <= 3;
  if (month && (has(q, "free", "availab", "open", "vacan", "book", "stay", "room", "anything", ...ZH_ASKED.available, ...KO_ASKED.available, ...ES_ASKED.available, ...VI_ASKED.available) || shortAsk)) {
    return as("availability", answerMonth(month, ctx, room));
  }
  // Before the room and the price: "King reviews" is not a tour of King, and
  // "rated" begins with "rate", which the price question would take.
  if (askedAboutReviews(q)) return as("reviews", askedForLatest(q) ? answerLatestReview(ctx, room) : answerReviews(ctx, room));
  if (room && !has(q, "park", "cancel", "refund", "price", "cost", "how much", "rate", ...ZH_ASKED.parking, ...KO_ASKED.parking, ...ES_ASKED.parking, ...VI_ASKED.parking, ...ZH_ASKED.cancel, ...KO_ASKED.cancel, ...ES_ASKED.cancel, ...VI_ASKED.cancel, ...ZH_ASKED.price, ...KO_ASKED.price, ...ES_ASKED.price, ...VI_ASKED.price)) return as("rooms", answerRoom(room, ctx));
  const topic = answerTopic(q, ctx, party);
  if (topic) return topic;
  // Not understood. Said plainly, and the guest is handed to the host with
  // their question rather than told to rephrase it.
  return as("other", {
    lines: [t("I'm not sure I understood that. {host} can answer it — or try dates like “Oct 10-12”, a room name, or “parking”.", { host: ctx.hostFirstName })],
    actions: [chat(ctx, t("Ask {host}", { host: ctx.hostFirstName }))],
    answered: false,
  });
};

// The only way in. The guard first, then the answer, then the scrub — no
// caller can reach `answer` without both.
export const askTT = (query: string, ctx: AskTTContext, opts: AskOptions = {}): TTAnswer => {
  // NFC: a Windows Vietnamese keyboard can type "ặ" as a + two combining marks,
  // and none of the Vietnamese words in this file would match it.
  const q = query.normalize("NFC").trim();
  if (!q) return { lines: [], actions: [], category: "other", answered: false };
  const a = privacyRefusal(q, ctx) ?? languageSwitch(q) ?? answer(q, ctx, opts);
  return { ...a, lines: a.lines.map(scrub), actions: a.actions.map(scrubAction) };
};

// "한국어로 바꿔 주세요": TT changes the page's language itself (ttLanguage.ts).
// Filed as "other" only because the type wants a topic — the sheet never logs
// it: it is a setting, not a question about the house for the host to answer.
const languageSwitch = (q: string): TTAnswer | null => {
  const lang = languageAsked(q);
  return lang ? { lines: [SWITCHED[lang]], actions: [], category: "other", answered: true, switchLang: lang } : null;
};

// Suggested first questions, shown before anything is typed.
export const ttStarters = (ctx: AskTTContext): TTAction[] => {
  const g = ctx.guest;
  if (g) {
    // A returning guest came to book. Their usual room and their wish list
    // lead, ready to check, rather than the questions a stranger has.
    // The weekend buttons name no room: they used to say "King this weekend"
    // under a greeting offering King, Cute, Queen or Chill (host, 2026-10-07),
    // and checked King alone. Unnamed, the answer checks every room and lists
    // theirs first, in the greeting's order (usualFirst). A single-room guest
    // still gets their room named.
    const one = (g.usualRoomIds?.length ?? 0) <= 1 ? ctx.rooms.find((r) => r.id === g.usualRoomId) : undefined;
    return [
      // Each chip's label is in the guest's language and its query in English:
      // the parser reads English, so a German chip still asks "this weekend".
      ...(g.wishList.length > 0 ? [{ kind: "ask" as const, label: t("My wish list ({nights})", { nights: plural(g.wishList.length, "night") }), query: "my wish list" }] : []),
      one
        ? { kind: "ask" as const, label: t("{room} this weekend", { room: one.name }), query: `${one.name} this weekend` }
        : { kind: "ask" as const, label: t("This weekend"), query: "this weekend" },
      one
        ? { kind: "ask" as const, label: t("{room} next weekend", { room: one.name }), query: `${one.name} next weekend` }
        : { kind: "ask" as const, label: t("Next weekend"), query: "next weekend" },
      { kind: "bookings", label: t("My bookings") },
      ...reviewStarter(ctx),
      ...latestStarter(ctx),
      ...hostDoors(ctx),
    ];
  }
  return newGuestStarters(ctx);
};

// Offered only when there is something to show: a button that answers "I
// don't have that yet" is a button that wastes a guest's tap.
const reviewStarter = (ctx: AskTTContext): TTAction[] =>
  ctx.reviews?.house || ratingLine(ctx.reviews) ? [{ kind: "ask", label: t("What guests say"), query: "reviews" }] : [];
const latestStarter = (ctx: AskTTContext): TTAction[] =>
  Object.keys(ctx.reviews?.latest ?? {}).length > 0 ? [{ kind: "ask", label: t("Latest reviews"), query: "latest reviews" }] : [];

const newGuestStarters = (ctx: AskTTContext): TTAction[] => [
  // First: TT can book now, and saying so is the quickest way in.
  // Labels in the guest's language, queries in English: the parser reads
  // English, so "Parken" on the chip still asks "parking".
  { kind: "ask", label: t("Book a stay"), query: "I'd like to book a stay" },
  { kind: "ask", label: t("Anything free this weekend?"), query: "this weekend" },
  { kind: "ask", label: t("Which rooms fit 2?"), query: "2 guests" },
  { kind: "ask", label: t("Parking"), query: "parking" },
  { kind: "ask", label: t("Check-in"), query: "check in" },
  { kind: "ask", label: t("Cancellation"), query: "cancel" },
  ...reviewStarter(ctx),
  ...latestStarter(ctx),
  ...hostDoors(ctx),
];

// Reaching the host from inside TT: chat here, or ring him. These used to sit
// (and texting him) on a floating bubble of their own beside TT's door — two places to ask
// somebody. TT is the one place now (host, 2026-10-07: "add Chat Anh-Tuan"
// and "Call Anh-Tuan"). Unread replies ride on the chat button, so a guest
// who closed the chat still sees the host wrote back.
const hostDoors = (ctx: AskTTContext): TTAction[] => [
  chat(
    ctx,
    t("Chat {host}", { host: ctx.hostFirstName }) + (ctx.hostUnread ? t(" · {n} new", { n: ctx.hostUnread }) : ""),
  ),
  ...(ctx.hostCanCall
    ? [
        { kind: "text" as const, label: t("Text {host}", { host: ctx.hostFirstName }) },
        { kind: "call" as const, label: t("Call {host}", { host: ctx.hostFirstName }) },
      ]
    : []),
];
