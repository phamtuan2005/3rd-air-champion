# 3rd-air-champion

Three apps for TT House, a five-room short-stay house in Silicon Valley.

| App | Route | Who uses it |
|---|---|---|
| **TiMag** | `/` | The host — calendar, bookings, money, cleaning, staff |
| **TiBook** | `/book` | Guests — see rooms, check dates, request a booking |
| **TiWork** | `/work` | Cleaners and staff — their rota, their hours, their pay |

`3rd-air-champion-frontend/` is one React + Vite app serving all three.
`3rd-air-champion-backend/` is Express + Mongoose, with a GraphQL layer the REST
routes call into. Working on TiBook? Read `3rd-air-champion-frontend/TIBOOK.md`
first.

## Commands

```bash
# frontend
cd 3rd-air-champion-frontend
npm run dev                              # localhost:5173
npx tsc --noEmit -p tsconfig.app.json    # typecheck
npm test                                 # unit tests
npm run build

# backend
cd 3rd-air-champion-backend
npm run dev
npx tsc --noEmit
npx jest
```

Run the typecheck and the tests before you consider a change finished. CI runs
all of it on every pull request and every push to `main` — a red tick is not
somebody else's problem to sort out.

## Rules

**Never `git add -A`.** The repo root collects unrelated files (CSV output,
scratch scripts). Stage the specific files you changed, by path.

**Never commit `.env`, and never put a secret behind a `VITE_` name.** Anything
`VITE_*` is compiled into the public bundle and readable in devtools.

**Deploys are Anh-Tuan's to run.** Do not deploy, and do not push to `main` —
work on a branch and open a pull request.

**Write comments that say WHY.** This codebase explains the reason a thing is
the way it is, usually because something went wrong once. Match that. A comment
restating the code adds nothing; a comment saying "this used to do X and a guest
hit Y" saves the next person a day. Don't delete those comments to tidy up —
they are the record of what has already been tried.

**When a test fails, the meaning changed.** The tests in `src/util` were each
written for a real bug. Understand which case a test protects before adjusting
it.

## Things this business knows

These are not obvious from the code and getting them wrong costs real money.

- **A booking with `reserved: true` is HELD, not free.** It is an unpaid stay,
  not a vacancy. Occupancy and availability must count it as occupied.
- **Some guests are on deliberate `$0` rates** — family. That is not a bug and
  must never be "corrected".
- **A stay is written onto every night it covers.** Count arrivals by the night
  the stay STARTS, never by every row.
- **Dates are `yyyy-MM-dd` strings, keyed by UTC day.** Do not convert stored
  dates through a local timezone — it shifts the calendar a day for anyone east
  or west of the host.
- **Availability subtracts per-room blocks as well as bookings.** A room can be
  blocked on a day that is otherwise open.
- **An arrival in the small hours belongs to the night BEFORE that calendar
  day.** A guest saying "1am Tuesday" usually means the Monday night booking.
  This one has already cost the house a room.
- **Fees are per STAY but stored on every night.** Count them once.

## Tone

TiMag talks to the host. TiWork talks to the team, in the second person
("Your work", "Your pay"). TiBook talks to guests, and the house motto — "Your
comfort. Our mission." — is a promise **to the guest**, so it is always named as
one rather than left to look like a promise to whoever is reading.

Across all three: say what will happen rather than what someone cannot do, and
never leave a person work the app could do itself.
