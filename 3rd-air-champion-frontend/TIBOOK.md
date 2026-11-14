# Working on TiBook

TiBook is the **guest-facing** app: the page a guest opens to see the rooms, look
at what is free, and ask to book. It lives at `/book`.

The other two apps in this repo are TiMag (the host's, at `/`) and TiWork (the
team's, at `/work`). They share components and utilities, so a change in
`src/components/shared/` or `src/util/` reaches all three — check before editing
there.

## Running it

```bash
cd 3rd-air-champion-frontend
npm install
npm run dev          # then open http://localhost:5173/book
```

You need `.env.development`, which is **not** in git. Ask Anh-Tuan for it. It
holds `VITE_BACKEND_ENDPOINT` plus the TiBook sign-in variables.

Two things about that file:

- Anything named `VITE_*` is **compiled into the public bundle** and readable by
  anyone who opens devtools. Never put a real secret behind that prefix.
- Point `VITE_BACKEND_ENDPOINT` at a development backend unless you have been
  told otherwise. Pointed at production, your dev server writes to real bookings
  that real guests are in.

## The map

| Path | What it is |
|---|---|
| `src/routes/TiBook.tsx` | The whole screen: state, data loading, the cart |
| `src/components/tibook/BookingRequestModal.tsx` | The request flow — step 1 dates, step 2 details |
| `src/components/tibook/Calendar/` | The guest calendar and its filters — a month grid, or a day-by-day list (`GuestDayList`) the guest switches to beside Today; the choice is remembered per device |
| `src/util/nightStatus.ts` | Free / partly taken / sold out for one night — the one rule both calendar views print from |
| `src/components/tibook/RoomCards.tsx` | The room banner, photos, and the guest's own rate |
| `src/util/dateText.ts` | Reads dates out of what a guest types |
| `src/util/cartGrouping.ts` | Turns chosen dates into stays |
| `src/contexts/TiBookThemeContext.tsx` | Colour tokens, the two skins and the two layouts — use `theme.*`, never a hardcoded colour |
| `src/components/tibook/HeroShell.tsx` | The Hero layout: rooms as a swipeable deck over the month |
| `src/util/askTT.ts` | TT's answers to guests — no model, only what TiBook already shows |
| `src/util/ttBooking.ts` | Booking a stay by talking to TT: reading the stay, choosing the room, the read-back |
| `src/util/tibookVisitOperations.ts` | Counts that a guest opened TiBook, for the host's **TiBook visitors** screen in TiMag (Money menu) |

### German

TiBook speaks English, German, Chinese, Korean, Spanish or Vietnamese (`src/contexts/TiBookLanguageContext.tsx`).
A phone set to German opens in German; the guest can switch under **Look**, and
the choice is remembered per device. (How a guest finds the switch is under
"Switching language", after Spanish.)

- Words go through `t("the English")`, and dates the guest reads through
  `fmtDate` (German puts the day first). The German is in `src/i18n/de/`, keyed
  by the exact English, so a new line with no German yet shows in English.
  A component that shows words calls `useTiBookLang()` — that is what redraws
  it when the guest switches.
- **Only what the guest reads is translated.** Booking request notes, texts
  to the host and logged questions stay English: the host reads them.
- Informal "du", worded like Airbnb.de and Booking.com. "Ask TT" is a name
  and stays English.
- The date box and TT also read German dates ("1. Mai", "3.9.", "vom 10. bis
  12. Dezember") and a few German words (buchen, ja/nein, zu zweit, WLAN…).
  Questions TT does not recognise go to the host, as in English.
- The host's highlight pills are typed in TiMag in English; a new one shows
  in English until its German is added to `src/i18n/de/shell.ts`.

### Chinese

TiBook also speaks Simplified Chinese, the same way: `src/i18n/zh/`, keyed by
the exact English, chosen under **Look → 语言**. What differs from German:

- **Who starts in it.** A phone with Simplified Chinese listed before English
  (`langOfDevice`). An English phone with Chinese as a second language stays
  English, and so does a Traditional one (Taiwan, Hong Kong, Macau) until the
  guest chooses: the text is Simplified, and that is theirs to accept.
- **"您", worded like Airbnb China** — 房东, 超赞房东, 心愿单, 入住/退房. Punctuation is
  full-width (`zh.test.ts` fails on an ASCII mark).
- **TT and the date box read Chinese, and its examples are Chinese.** 5月1日,
  10月10-12日, 本周末, 下周五, 11月3日住2晚, 两个人. A dash or 到 is every night, like
  "Oct 10-12", with the shorter reading on a button.
- **Regexes.** `\b` never fires between Chinese characters, so `has()` drops it
  for a Chinese word. Words go in `ZH_ASKED` and `ZH_AMENITY`. A sentence has no
  spaces, so a word matches anywhere in it: keep each one specific.
- **A Chinese yes must match the whole reply** (`ZH_YES`). A yes can send the
  request, and 可以取消吗 ("can I cancel?") begins with 可以 ("yes, OK").
- **The privacy guard has Chinese patterns too.** A new way for TT to read a
  question needs a matching refusal, or a date inside "谁住在 King 10月10日" gets
  it answered.

As with German, only what the guest reads is translated. Requests, texts and
notes to the host stay English, and a guest's own typed words go as they wrote
them.

### Korean

Korean follows Chinese: `src/i18n/ko/`, keyed by the exact English, started on a
phone with Korean listed before English, offered (below) to one with it after.

- **Polite 해요체, worded like Airbnb Korea** — 호스트, 슈퍼호스트, 위시리스트,
  체크인/체크아웃, 내 예약. Never 당신. Korean uses ASCII punctuation, so there is no
  "." entry.
- **No particle straight after a slot.** 은/는, 이/가, 을/를 and 과/와 depend on how
  the word before ends, and `{host}` or `{room}` hides that word. Anchor the slot
  instead — "{host} 님이", "{room} 객실은" — or follow it with 의, 에, 도, 부터,
  까지. `ko.test.ts` fails on a slot followed by one.
- **TT and the date box read Korean.** 5월 1일, 10월 10-12일, 10일부터 12일까지,
  11월 3일 2박 (and 2박 3일, which is two nights), 이번 주말, 다음 주 금요일, 2명.
  Words go in `KO_ASKED` and `KO_AMENITY`; like Chinese they match anywhere in
  the sentence, so a short one carries a lookahead (방 begins 방법 and 방문).
- **A Korean yes must be the whole reply** (`KO_YES`), and 네 ("yes") is never
  read as four people: 네, 세, 한 and 두 only count with a counter (명, 분).
- **The privacy guard has Korean patterns too**, as Chinese does.

### Spanish

Spanish follows Korean: `src/i18n/es/`, keyed by the exact English, started on a
phone with Spanish listed before English, offered to one with it after. That
last group is the biggest in California, which is why Spanish does not take
German's rule (any German in the list opens in German).

- **Latin American Spanish with "tú", worded like Airbnb** — anfitrión,
  Superanfitrión, huésped, reserva, estadía, lista de deseos, llegada/salida.
  Never "vosotros" or "vos" (`es.test.ts` fails on either), and no Spain-only
  words (móvil, ordenador). A held stay is **apartada**: "reservada" reads as
  confirmed.
- **Gender.** Spanish genders adjectives, and TiBook rarely knows the guest's
  gender or a room name's. Write around it: "Hola de nuevo", not
  "Bienvenido/a"; "{room} está libre", not "ocupada".
- **Every ¿…? and ¡…!** opens with its mark (`es.test.ts` checks).
- **Dates.** Day first and lowercase, as Spanish writes them: "mar 3 nov",
  "3 de noviembre de 2026". The clock stays 12-hour. "M/d" is **not** turned
  round: the date box reads a slash month first, so a page showing "3/11" for
  the 3rd of November would be read back as March 11. The phone weekday header
  is D L M X J V S — miércoles is X because martes has the M.
- **TT and the date box read Spanish.** 1 de mayo, 10-12 de octubre, del 10 al
  12 de diciembre, 1, 3 y 5 de mayo, hoy / mañana / pasado mañana, este fin de
  semana, el próximo viernes, los lunes de noviembre, 3 de noviembre 2 noches,
  una semana, hasta el 6, somos dos. Words go in `ES_ASKED` and `ES_AMENITY`.
  They match from the start of a word like the English, but `\b` does not see
  an accented letter, so a pattern that must END on one (sí, reservé) uses
  `(?!\p{L})` with the `u` flag.
- **Left out on purpose.** "ago" and "set" are not months (English words); "por
  la mañana" is the morning, not tomorrow; "tarde" is not a late arrival
  ("buenas tardes"); "estación" is not parking (a train station).
- **A Spanish yes must be the whole reply** (`ES_YES`): "si" is also "if", and
  "si cancelo, ¿me devuelven?" must never send a request.
- **The privacy guard has Spanish patterns too**, as Korean does. The cases
  are in `src/util/spanishGuest.test.ts`.

### Vietnamese

Vietnamese follows Spanish: `src/i18n/vi/`, keyed by the exact English, started
on a phone with Vietnamese listed before English, offered to one with it after.

- **"bạn", worded like Airbnb Vietnam** — chủ nhà, Chủ nhà siêu cấp, khách, đặt
  phòng, kỳ lưu trú, danh sách yêu thích, nhận phòng/trả phòng. Never "quý
  khách" or "anh/chị" (`vi.test.ts` fails on either). TT calls itself "mình";
  the host is "anh ấy". A held stay is **đang giữ chỗ**, never "đã đặt".
- **Dates.** Day first: "3 thg 11", "Thứ Ba, 3 tháng 11", a 24-hour clock, and
  CN T2 … T7 over the phone calendar. Unlike Spanish, **a slash is day first**
  — shown ("3/11") and read — because a Vietnamese guest reads "10/12" as the
  10th of December whatever the page does. Only TiBook passes
  `parseDateText(…, { lang: "vi" })`; TiMag's date box still reads 8/23 as August.
- **TT and the date box read Vietnamese.** 1 tháng 5, ngày 1 tháng 5, mùng 5
  tháng 5, 10-12 tháng 10, từ 10 đến 12 tháng 12, 1, 3-5 và 20-21 tháng 5, hôm
  nay / tối nay / ngày mai / ngày mốt, cuối tuần này, thứ Sáu tuần sau, T2, các
  thứ Hai trong tháng 11, 3 tháng 11 2 đêm, một tuần, trả phòng ngày 14, 2
  người, hai vợ chồng. "tháng N" is rewritten in place as Spanish's "de
  <month>", padded to the same length, so one set of rules reads both.
  Words go in `VI_ASKED` and `VI_AMENITY`.
- **Accents.** Every Vietnamese pattern uses letter-aware edges: `\b` does not
  see "đ" or "ở", so `has()` starts a word that begins with one after any
  non-letter. Input is NFC-normalised first: a Windows keyboard can type "ặ"
  as three code points. Unaccented spellings (tieng viet, khong, dong y) are
  read too.
- **Left out on purpose.** "mai" alone is tomorrow only when the text is
  Vietnamese — "im Mai" is German May. "1 tháng 2 người" is a month and two
  people, not the 1st of February. "lần thứ hai" is the second time, not
  Monday; "sân" alone is not outdoor space (sân bay is the airport).
- **A Vietnamese yes must be the whole reply** (`VI_YES`): "có" also begins
  "có hủy được không?" (can I cancel?). And the English YES/NO now end where a
  letter ends rather than at `\b`, which had read "ý tôi là…" (I mean…) as
  "y", yes, and "nói…"/"nếu…" as "n", no.
- **The privacy guard has Vietnamese patterns too**, as Spanish does. "ai"
  (who) counts only with a verb after it, since "AI" is English too. The cases
  are in `src/util/vietnameseGuest.test.ts`.

### Switching language

Three ways, because the guest who most needs the switch is the one least able to
read the menu it sits in.

- **The offer** (`LanguageOffer.tsx`). TiBook keeps an English phone with
  Chinese, Korean, Spanish or Vietnamese added in English — on purpose, see `langOfDevice`. Those
  guests get one card above the bottom bar, in THEIR language: "TiBook을 한국어로
  보시겠어요?" with the switch and "Keep English". Either tap is stored as a
  choice, so it never comes back. It waits behind any open sheet, and the TT
  and Look callouts wait for it. Who is asked: `languageToSuggest`.
- **The menu.** Under Look, a list with one language a line, each named in its
  own language, under a heading that is every language's word for "language" at
  once (🌐 Language · Sprache · 语言 · 언어 · Idioma · Ngôn ngữ), folded to one row that shows the
  current language until tapped. It was a row of pills; four no
  longer fitted a phone. A new language is one line in `LANGS`.
- **Asking TT** (`src/util/ttLanguage.ts`). "한국어로 바꿔 주세요", "auf Deutsch
  bitte", "说中文", "en español, por favor", "chuyển sang tiếng Việt", "English please" — in any of
  TiBook's languages, naming any of them. TT switches the page and says so in the new language; a booking
  under way keeps going and asks its next question again in that language.
  A language name counts only alone or with a word asking for the switch, so
  "Korean food nearby?" is still a question about food. Not logged for the
  host: it is a setting, not a question. A new language needs its names in
  `NAMES` and a line in `SWITCHED`.

### Visitor counting

TiBook tells the backend once a day per device that someone is looking: a
random id the device keeps, and the time zone it is set to. The continent comes
from the **country CloudFront reads from the connection** (the
`CloudFront-Viewer-Country` header; the backend never sees the IP), falling back
to the time zone when the header is missing. The header only arrives once the
CloudFront origin request policy for `/api/*` includes it. No name goes with it, and a **phone number only once the guest has
agreed to TiBook remembering it** (`guestConsent`) — that is what lets TiMag list
which guests visited; "Not you?" unlinks the day's visit. **Every look counts, whoever is
looking** — including the host and cohosts on a device signed in to TiMag. That
was once skipped; the house reversed it. The only thing not counted is the dev
server, whose `/api` reaches production. To test counting against a **local**
backend, put `VITE_COUNT_TIBOOK_VISITS_IN_DEV=true` in `.env.development.local`.

The numbers are read only through `/api/tibook-stats`, behind the JWT gate and
`requireManager`. Keep them out of GraphQL: `/graphql` has no login in front of it.

### What guests ask TT, and what guests say

TT (`src/util/askTT.ts`) still answers on the phone, with no model. Every answer
carries a `category` and whether TT really `answered`. A hand-off to the host is
**not** answered, and a privacy refusal **is** answered. After the answer is on
screen, `src/util/ttQuestionLog.ts` sends the question, scrubbed of phone
numbers, emails and links, to `/api/tt/question`. The backend scrubs it again
and caps it per address. The host reads the questions in TiMag's **TT
questions** screen (Money menu), split into answered and not answered and then
by category, through `/api/tt-host`, which sits behind `requireManager`. The dev
server does not log, for the same reason it does not count visits.

A guest the host gave the stats code to reads the same questions at
`/book?stats`. There is a *Visitors · TT questions* switch, and the questions
come from `/api/tibook-stats-viewer/tt-questions`, which checks the code exactly
as the visitor numbers do. The code box adds the dashes itself and stops at
twelve characters (`formatStatsCode`).

### When a wished-for night opens up

The house tells the guest itself. Until 2026-10-23 this waited on the host
spotting the night in TiMag and texting by hand, and a freed night could sit
unannounced for hours.

- **The backend** (`jobs/wishListNotify.ts`, at :15 and :45 every hour) checks
  every wish list with TiBook's own rule, `nightStatus`. The rule is copied into
  the backend by `scripts/sync-cleaning-rule.js`, so the chat and the calendar
  cannot disagree. Held (reserved) requests and per-room blocks count as taken.
  A night the guest already has or has already asked for is skipped.
- A night must be free on **two runs in a row** before anyone is told, so a
  glitchy AirBnB sync cannot set off messages to every guest. The guest gets one
  message in their TiBook chat, naming the night and the free room(s), and the
  wish turns **Notified**. They are never told the same news twice.
- **No room is held.** Everyone who wished for the night is told, and the first
  request wins (host's call).
- **TiBook** opens `WishFreeCard` once per visit when a wished-for night is
  free. **Book it** puts the nights into Review Request, and the guest sends it.
- **TiMag**'s wish-list panel shows "TiBook told … in their chat". "Contact now"
  becomes a quieter "Text them as well" once every open night has been
  announced.

The chat message is English, like everything else in the host's thread.

### Booking through TT

A guest can book by asking: "book King Oct 27 to Oct 29 for 2". The rules are
in `src/util/ttBooking.ts`, and the conversation is in `AskTT.tsx`.

- **The dates.** TT reads stays the way people write them: with a check-out
  ("to", "until", "check out"), with "through", or as "for 2 nights". It always
  states the check-out day. "Oct 10-12" reads as three nights, the same as
  everywhere else in TiBook, with a button offering the two-night reading.
- **The room.** TT uses the room the guest named, then their usual room, then
  the only room that fits the party. When several fit, it asks the guest to
  choose. Nights that don't form one stay go to the calendar, as before.
- **The rest.** TT asks one thing at a time: the party size, then a name and
  phone number. A US holiday in the stay is asked about once. Then it reads
  the whole request back, and **nothing is sent until the guest taps Send.**
  Replies to these questions (names, numbers) are never logged.
- **What is sent.** The same `createBookingRequest` the form sends. The host's
  Requests screen cannot tell the two apart.

A new guest who only asks about dates still gets **Choose** (the calendar). A
returning guest, or anyone who asked to book, gets **Book**.

**Test mode.** On the dev server, Send shows the request and does not send it.
The sheet says "Test mode" in its header. `/api` there is production. To send
to a **local** backend instead, put `VITE_TT_SEND_BOOKINGS_IN_DEV=true` in
`.env.development.local`.

"What guests say" shows only summaries the host **published** in TiMag's
**Guest reviews** screen. AirBnB has no reviews API and may not be scraped, so
the host pastes each listing's reviews there. Claude drafts the summaries in the
background (`reviewDraft.ts` on the backend), and the host edits and publishes
them. The pasted text is not kept. When nothing is published, TT says it has no
summary and logs the question as not answered. It never makes one up.

**A room's latest review.** "King's latest review", "most recent reviews" or
"what did the last guest think" gets the room's NEWEST review, summarised on
its own. With no room named, TT lists the latest for each room. The draft
writes it from the room's newest review that has a date (a stay date or a
review month), and it is published with the other summaries. TT always gives
its month and stars, which come from the review itself and not from the model,
so a guest can see how recent "latest" is. A room with no published latest
gets its overall summary, and the question is logged as not answered.

## Tests

```bash
npm test
```

`dateText` and `cartGrouping` are the two TiBook rules with real tests, and both
exist because of bugs a guest actually hit. If a test fails, the **meaning**
changed — reword freely, but do not adjust a test to make a change pass without
understanding which case it was protecting.

## Rules that are not obvious from the code

These were each learned the hard way. The reasons are in the comments beside
them; this is the index.

1. **Availability must subtract per-room blocks, not just whole-day blocks.** A
   room can be blocked while the day is open. Ask `roomsFreeOn` / the helpers in
   `TiBook.tsx` rather than writing a second availability rule — two of them
   will eventually disagree, and the guest sees the disagreement.

2. **Consecutive nights are only one stay if a single room can take all of
   them.** Sep 7 with only Chill free and Sep 8 with only King free is two
   stays. Lumped together, they ask for a room free on both and the guest is
   told there is none.

3. **Show the guest what was understood before acting on it.** Typed dates are
   read back as chips they can check. The guest confirms a reading; they do not
   trust one.

4. **A night the guest already booked is not "unavailable".** It gets a tick and
   "already yours" — never a strike-through, which tells someone they cannot
   have the date they already hold.

5. **Never leave the guest work the app could do.** Full dates they asked for go
   onto the wish list as part of the same tap, disclosed on the button. If you
   find yourself writing "tap them on the calendar to…", that is the app being
   lazy.

6. **The type scale is set by `tibook-type` on the overlay root**, with a 12px
   floor. Do not set font sizes that fight it — guests read this on phones, in
   the dark, at 11pm.

7. **Colour is semantic and comes from the theme.** Guests can pick a theme;
   hardcoding `bg-blue-500` breaks it for everyone who chose otherwise.

8. **There are two LAYOUTS as well as two skins, and neither is a second
   app.** The menu offers three looks — Classic (light, stacked), Neon (dark,
   stacked) and Hero (dark, rooms-first). Skin and layout are separate axes
   underneath (`vibe` and `layout`) even though the menu sets them together,
   so a light Hero is a one-line change if it is ever wanted.

   Hero is a different ARRANGEMENT of the same screens, never a second set of
   rules. `HeroShell` computes nothing: swiping a room card sets the same
   `selectedRoomIds` the room strip has always driven, and `GuestCalendar`
   scopes availability by it exactly as before — so "is this room free" is
   answered by the one availability rule there has ever been. Dates, rates,
   holds and the wish list arrive as props from `TiBook.tsx`, and every modal
   is shared, which is why a guest can switch look mid-visit and keep their
   dates and their place in the month.

   If you find yourself computing a date, a rate or an availability inside a
   layout, stop: that belongs in `TiBook.tsx` where the other layout can see
   it too.

   One modal knows which layout it is in: `RoomGalleryModal` reads `layout`
   and wears a different CHROME in Hero — full-bleed photo, the facts on a
   rounded sheet lifted over it. The facts, the amenities and the price
   conversation are the same markup in both. That is the line: a layout may
   change how a screen is arranged, never what it says.

   A guest who has never picked a look starts in Hero, first visit or not
   (until 2026-10-17 a first visit got Classic). On EVERY visit (once per page
   load) Hero opens the host banner by itself and closes it after three seconds,
   so every guest meets the hosts; TT's nudge and the Look nudge wait until it
   closes. It was a first visit only for its first day; the host asked for
   every visit (2026-10-17).

9. **There are two SKINS, and neither is a second app.** A guest picks Classic
   or Neon in the nav and the choice is remembered per device, alongside the
   palette — which survives the switch rather than being replaced by it. Both
   skins are the same screens, the same flows and the same booking rules; a
   skin is only a second set of values behind the same `theme.*` tokens, so no
   component asks which one it is wearing. If you find yourself writing
   `if (vibe === "vivid")` inside a component, add a token instead.

   Neon is dark **throughout** — nav, month strip, action bar, host banner,
   room cards, the calendar grid, and every sheet and modal. It began at the
   frame only, because the ~130 greys written into the markup were picked
   against white; those became a faithful token scale instead — one token per
   grey the light skin actually distinguished — so Classic reads back byte for
   byte and only the dark column is new.

   Two things stay bright on purpose: a small status or tier **chip**, which
   carries its own dark text on its own pale fill, and the white pill in the
   action bar, which sits on the gradient rather than on a sheet.

   Watch for a pale card holding *themed* text. A `bg-amber-50` card whose body
   text comes from `surfaceText` is fine on white and unreadable the moment
   `surfaceText` goes near-white — that is what `cardWarm`, `warmFill` and the
   `alert*` family are for. And an element with **no** colour class inherits:
   the vivid root sets `color` for exactly that reason, after "Your Dates"
   turned up as a black heading on a black panel.

   Corner radius and the drifting gradient are **not** tokens — they hang off
   `.tibook-vibe-vivid` in `index.css`, which redeclares Tailwind's
   `--radius-*` steps the same way the type scale above it redeclares
   `--text-*`. One knob, every corner, no per-element edits.

## The tone

The house motto is "Your comfort. Our mission." It is a promise **to the
guest**, and TiBook is where it is kept. Wording should read as a person
talking: warm, specific, and never making someone feel stupid for what they
typed. When you have a choice between telling a guest what they cannot do and
telling them what will happen instead, pick the second.

## Before you push

```bash
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
```

Deploys are Anh-Tuan's to run.
