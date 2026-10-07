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

### Visitor counting

TiBook tells the backend once a day per device that someone is looking: a
random id the device keeps, and the time zone it is set to (read as a
continent). No name goes with it, and a **phone number only once the guest has
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
