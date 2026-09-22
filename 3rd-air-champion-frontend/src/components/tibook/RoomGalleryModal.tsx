import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { roomType } from "../../util/types/roomType";
import { getRoomFacts, getRoomPhotos, houseKitchen } from "../../util/roomFacts";
import { useRoomChip, useTiBookTheme } from "../../contexts/TiBookThemeContext";
import BedIcon from "./BedIcon";

const BACKEND = import.meta.env.VITE_BACKEND_ENDPOINT || "";
const resolveUrl = (url: string) => url.startsWith("/") ? `${BACKEND}${url}` : url;

// How close together two taps have to land to read as one gesture, and how far
// a finger may wander and still count as a tap at all. A tap on a touchscreen
// always drifts a pixel or two; 12px forgives that without swallowing a drag
// the guest actually meant.
const DOUBLE_TAP_MS = 300;
const TAP_SLOP = 12;

interface RoomGalleryModalProps {
  room: roomType;
  initialIndex?: number;
  // Where the house has no number on file the offer is simply not made, rather
  // than showing a button that goes nowhere.
  hostPhone?: string;
  hostName?: string;
  // This guest's own agreed rate for THIS room, where they have one. Absent for
  // a stranger, and for a returning guest who has never been quoted this room.
  myRate?: number;
  // Opens TiBook's own chat. Offered beside the text link because an sms: to a
  // US number is the one way out of this screen that quietly fails a guest
  // abroad — it leans on their carrier, it bills as an international text, and
  // a guest whose message never left their phone reads the silence as the
  // house not answering. Chat needs nothing but the page already open.
  // Absent where the screen around it has no chat to open, and the gallery
  // then simply does not offer it.
  onOpenChat?: () => void;
  onClose: () => void;
}

const RoomGalleryModal = ({ room, initialIndex = 0, hostPhone, hostName, myRate, onOpenChat, onClose }: RoomGalleryModalProps) => {
  const photos = getRoomPhotos(room).map(resolveUrl);
  const [index, setIndex] = useState(initialIndex);
  // Undefined for any room not transcribed yet, and the footer then reads
  // exactly as it did before — a guest never sees a gap where facts should be.
  const facts = getRoomFacts(room.airbnbUrl);
  // Honours a colour set on the room record first, and falls back to the
  // house's own name-to-colour rule — the same call the room cards make.
  const roomChipClass = useRoomChip()(room);
  /*
   * Hero exclusively.
   *
   * The stacked layout opens this gallery from a small card in a strip, so a
   * letterboxed picture on black is the right answer there — the guest came
   * from a thumbnail and wants to see the whole frame.
   *
   * Hero opens it from a photograph that already fills two fifths of the
   * screen, and dropping from that into a letterbox reads as a step DOWN. So
   * in Hero the picture goes full-bleed and the facts ride up over it on a
   * rounded sheet, which is the shape the rest of that layout is made of.
   *
   * This reads the LAYOUT, not the skin. A layout genuinely changes the
   * arrangement of a screen, which is the one thing a token cannot carry.
   * Every fact, every amenity and the price conversation below are the same
   * markup in both — only the chrome around them differs.
   */
  const { theme, layout } = useTiBookTheme();
  const hero = layout === "hero";
  const hostFirstName = (hostName ?? "").split(" ")[0] || "the host";

  // Same one-tap text the rest of TiBook uses: an sms: link that opens the
  // guest's OWN messaging app with a draft they can read, change and send
  // themselves. Nothing is sent on their behalf — the house has no server-side
  // sending at all, and a button that fired a message off silently would be a
  // worse promise than this one.
  //
  // A real <a href>, not a click handler assigning window.location, so the link
  // is a link: long-press to copy it, and it still announces as one. TiMag's
  // WishListPanel does the same.
  //
  // The room is named in the draft because the host's reply depends on which
  // room it is, and a guest should not have to type that out again.
  //
  // A guest who already HAS a rate is not asking what the price is — they know.
  // Their draft carries the rate so the host can see which figure is being
  // talked about, and asks about dates instead of asking to be quoted again.
  const hasRate = myRate != null;
  const priceSmsHref = hostPhone
    ? `sms:${hostPhone}?&body=${encodeURIComponent(
        `Hi ${hostFirstName}! I'm looking at the ${room.name} room on TiBook` +
          (hasRate
            ? myRate === 0
              ? `. Could we talk about my dates?`
              : ` (my price is $${myRate}/night). Could we talk about my dates?`
            : `. Could we talk about the price for my dates?`),
      )}`
    : undefined;

  // The two ways out of this screen share a shape, so the pair reads as one
  // offer with two doors rather than as two unrelated buttons. Only the weight
  // differs, and CHAT is the one that carries it: it is the door that opens
  // for every guest wherever they are, while the text link depends on a phone
  // plan reaching a US number. So chat wears the guest's own palette colour in
  // both layouts — this used to be the text link's, and only in Hero, which
  // left the stacked footer with two identical outlines and nothing saying
  // which to reach for.
  // Where the house has no number on file there is no pair, and chat simply
  // keeps the colour rather than the footer holding one lonely outline.
  const contactBase =
    "mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white";
  const contactShape = hero ? "rounded-full" : "rounded-lg";
  const contactColoured = `${contactShape} ${theme.btn} ${theme.btnHover} ${theme.btnMotion} ${theme.glow}`;
  const contactOutline = `${contactShape} border border-white/30 hover:bg-white/10`;

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  const stripRef = useRef<HTMLDivElement>(null);

  // A swipe has to out-run a tap and beat the vertical axis, or a guest
  // scrolling the page past the picture would flip it by accident. 45px across
  // and more sideways than up-and-down is the usual bar for that.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // A swipe that starts or ends on a control still emits a click on it once
  // the finger lifts, so a swipe beginning over ‹ or › — both of which sit on
  // top of the picture — would move twice: once for the gesture and once for
  // the click. Same for a swipe ending on a thumbnail. This flag lets the
  // click that trails a swipe be recognised and dropped.
  const swiped = useRef(false);

  /*
   * Enlarging a picture.
   *
   * The gallery gives the photograph two fifths of the screen in Hero, and in
   * the stacked layout whatever is left once the thumbnails and the facts have
   * taken theirs. That is enough to CHOOSE a room by and not enough to look
   * into one, which is what a guest is actually doing in here. Enlarged is the
   * whole screen, letterboxed on black, with every piece of chrome gone.
   *
   * Double-tap gets there, because that is the gesture a phone already answers
   * to in every other photo app. The ⤢ button does exactly the same thing and
   * exists because a gesture nobody can see is a feature nobody has: the house
   * reported the pictures as too small while the picture could already fill
   * the screen, and nothing on it ever said so.
   */
  const [enlarged, setEnlarged] = useState(false);
  // When a finger last lifted from something that was a tap rather than a
  // swipe. Two of those inside DOUBLE_TAP_MS is a double-tap.
  const lastTap = useRef(0);

  /*
   * A touchscreen double-tap ALSO emits click, click, dblclick a moment later,
   * for the sake of pages written before touch existed. So the gesture arrives
   * twice: once as touch events, once as a mouse double-click.
   *
   * That is not harmless here, because the two ends mean opposite things. The
   * touch handler enlarges; the layer it opens has its own onDoubleClick to
   * close again; and the trailing dblclick lands on that freshly mounted layer
   * and closes it in the same breath. Double-tapping appeared to do nothing at
   * all, on a phone and in the harness alike.
   *
   * So the mouse handlers stand down for a moment after any touch. A real
   * mouse never sets this, and keeps its double-click.
   */
  const lastTouchAt = useRef(0);
  const MOUSE_AFTER_TOUCH_MS = 700;
  const isRealMouse = () => Date.now() - lastTouchAt.current > MOUSE_AFTER_TOUCH_MS;

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
  };
  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    lastTouchAt.current = Date.now();
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy)) {
      // A swipe is never half of a double-tap. Without this, swiping along to
      // picture 9 and then tapping it once to look properly would enlarge on
      // that single tap, because the swipe still counted as the first half.
      lastTap.current = 0;
      if (photos.length < 2) return;
      swiped.current = true;
      // Drag left, the picture moves left: the next one arrives from the right.
      if (dx < 0) next();
      else prev();
      return;
    }

    // Travelled, but not far enough or not flat enough to be a swipe: an
    // abandoned drag, or a scroll this element was never going to give. Not a
    // tap either, so it must not become half of one.
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) return;

    // A tap that landed on a control belongs to the control. Pressing › twice
    // quickly to skip two pictures along is an ordinary thing to do, and
    // without this it also reads as a double-tap on the photograph underneath
    // — so the guest skipping ahead gets thrown into the enlarged view, or out
    // of it. Only the TAP is claimed this way: a SWIPE that happens to start
    // on an arrow still turns the page, which is what the flag above is for.
    if ((e.target as HTMLElement).closest("button")) {
      lastTap.current = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      setEnlarged((on) => !on);
      return;
    }
    lastTap.current = now;
  };

  // Pull-down, the same gesture the calendar uses: grab the grip and drag.
  //
  // A full-bleed gallery hides who TiBook thinks you are. A guest deep in the
  // pictures cannot see their own name in the nav, and "am I still signed in
  // as me?" is a question they should never have to close the gallery to
  // answer. Pulling down uncovers the nav and stops there — this is a peek,
  // not a way out. The × and Escape still close it.
  const [pull, setPull] = useState(0);
  // How far down is "enough": the bottom edge of the nav, measured rather than
  // guessed, so it still uncovers exactly the nav if that bar ever changes
  // height. The fallback is only for the case where there is no nav to find.
  const maxPull = useRef(72);
  useEffect(() => {
    const bottom = document.querySelector("nav")?.getBoundingClientRect().bottom;
    if (bottom && bottom > 24) maxPull.current = Math.round(bottom);
    // OPEN at the nav's edge rather than full-bleed. The pull-down exists so a
    // guest can see their own name while looking at the pictures; starting
    // over the top of it meant the gallery covered that name until they found
    // a grip they had no reason to look for. Dragging still closes the gap
    // back up for a full-bleed look.
    setPull(maxPull.current);
  }, []);

  const grip = useRef<{ y: number; start: number } | null>(null);
  const onGripDown = (e: React.PointerEvent) => {
    grip.current = { y: e.clientY, start: pull };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    const g = grip.current;
    if (!g) return;
    // Drag down => positive => the sheet's top edge comes down.
    setPull(Math.max(0, Math.min(maxPull.current, g.start + (e.clientY - g.y))));
  };
  const onGripUp = () => {
    grip.current = null;
  };

  // Bring the current thumbnail to the middle of the strip. With 29 pictures
  // the marked one is otherwise off-screen the moment a guest presses ›, and
  // finding it again by dragging is work the app can do for them.
  useEffect(() => {
    stripRef.current?.children[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [index]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape backs out one layer at a time. Shutting the whole gallery from
      // the enlarged picture would throw away the guest's place in 29 photos
      // to answer "I have seen enough of this one".
      if (e.key === "Escape") {
        if (enlarged) setEnlarged(false);
        else onClose();
      }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [photos.length, enlarged]);

  return createPortal(
    <>
    <div
      // Top edge moves, bottom stays pinned — the sheet SHRINKS rather than
      // sliding, so nothing at the bottom is pushed off the screen when it is
      // pulled down. Rounded only once it has moved, since at rest it is
      // full-bleed and a rounded corner there would just show the page behind.
      className={`tibook-type fixed inset-x-0 bottom-0 z-50 flex flex-col ${
        hero ? `${theme.surface} rounded-t-3xl overflow-hidden` : "bg-black bg-opacity-90"
      } ${pull > 0 && !hero ? "rounded-t-2xl" : ""}`}
      style={{ top: pull }}
      onClickCapture={(e) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.stopPropagation();
      }}
      onClick={onClose}
    >
      {/* Drag grip — pull down to uncover the nav, and your own name with it.
          touch-none so the browser does not claim the gesture as a scroll.
          The click that trails a drag is stopped here: the backdrop closes on
          click, and letting go of the grip must not shut the gallery. */}
      <div
        className="flex shrink-0 cursor-ns-resize touch-none select-none items-center justify-center pb-1 pt-2"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="h-1.5 w-10 rounded-full bg-white/40" />
      </div>

      {/* Header. In Hero the picture takes this row back: the chip and the
          counter sit on the photograph and the close button floats over it. */}
      <div
        className={`items-center justify-between px-4 py-3 shrink-0 ${hero ? "hidden" : "flex"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`${roomChipClass} rounded px-2 py-0.5 text-sm font-medium text-white`}>
          {room.name}
        </span>
        <span className="text-gray-400 text-sm">{index + 1} / {photos.length}</span>
        <button
          onClick={onClose}
          className="text-white text-2xl leading-none w-8 h-8 flex items-center justify-center hover:text-gray-300"
        >
          ×
        </button>
      </div>

      {/* Photo.
          Swipeable, because on a phone that is how everyone expects to move
          through pictures — and because the scrollbar under the thumbnails
          cannot be dragged. Mobile browsers draw it as an overlay indicator,
          not a control, so a guest who reaches for it gets nothing back and
          is left believing the gallery is stuck. The ‹ › buttons and the
          thumbnails still work exactly as before; this only adds a gesture. */}
      <div
        className={`flex items-center justify-center relative min-h-0 ${hero ? "h-[42%] shrink-0" : "flex-1 px-12"}`}
        // touch-action: manipulation gives up the browser's OWN double-tap,
        // which is a page zoom. Without it the gesture below is competing with
        // a built-in one on every mobile browser, and the guest gets whichever
        // wins — a magnified corner of a fixed overlay being the bad outcome.
        style={{ touchAction: "manipulation" }}
        onClick={(e) => e.stopPropagation()}
        // Mouse only — see isRealMouse. A finger's double-tap is handled in
        // onTouchEnd, and the dblclick that trails it must not be acted on.
        onDoubleClick={() => {
          if (isRealMouse()) setEnlarged(true);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={photos[index]}
          alt={`${room.name} ${index + 1}`}
          className={`select-none ${hero ? "h-full w-full object-cover" : "max-w-full max-h-full object-contain rounded-lg"}`}
          draggable={false}
        />

        {hero && (
          <>
            {/* Enough scrim to carry the chip and the close button, and no
                more — the picture is what the guest tapped for. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-xl leading-none text-white"
            >
              ×
            </button>
            <span className={`absolute bottom-10 left-4 rounded-lg px-3 py-1 text-sm font-bold text-white ${roomChipClass}`}>
              {room.name}
            </span>
            {photos.length > 1 && (
              <span className="absolute bottom-10 right-4 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                {index + 1} / {photos.length}
              </span>
            )}
          </>
        )}

        {/* The gesture, said out loud. Double-tap is what a phone owner reaches
            for, but nothing on this screen ever admitted the picture could
            grow — so as far as anyone looking at TiBook could tell, it could
            not. Opposite corner from the × in each layout, so neither layout
            has two controls stacked on the same bit of photograph. */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEnlarged(true);
          }}
          aria-label="Enlarge this picture"
          className={`absolute top-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white ${
            hero ? "left-3" : "right-3"
          }`}
        >
          ⤢ Enlarge
        </button>

        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Everything below the picture, in ONE capped scroll area.
          The photo is the flex-1 child, so it gets whatever this block does
          not take — which for a long time was almost nothing. Sideways, the
          header, the 90px thumbnail strip and the facts came to more than the
          whole 390px of height and the photo was squeezed to exactly 0 pixels:
          a guest opened a picture and saw no picture. That was capped at 38%.
          Upright this wrapper was `contents`, i.e. no cap at all, on the
          reasoning that a tall phone has room for everything. It does not: on
          a 844px screen the strip, the facts and the price conversation left
          the photograph about 70 pixels — the house reported "the picture is
          too small" and this was why. So the cap is unconditional now, and
          only its size changes with the screen. The facts scroll within what
          is left rather than pushing the picture out.
          Both numbers are a CEILING on this block, never a floor: a room with
          few facts still gives its spare height back to the photo. */}
      <div className={hero
        ? `relative z-10 -mt-6 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-3xl ${theme.surface}`
        : "flex min-h-0 max-h-[52%] shrink-0 flex-col overflow-y-auto [@media(max-height:560px)]:max-h-[38%]"}>
      {/* Thumbnail strip.
          justify-center-safe, NOT justify-center. A centred flex row that
          overflows spills out of BOTH ends, and the left overflow is
          unreachable because scroll position cannot go negative — with 28
          thumbnails a phone could only ever reach pictures 13 to 28. The
          "safe" keyword falls back to start-alignment once the row overflows,
          and still centres it when a room has only a few pictures. */}
      {photos.length > 1 && (
        <div
          ref={stripRef}
          className={`flex gap-2 px-4 overflow-x-auto shrink-0 justify-center-safe [@media(max-height:560px)]:py-1.5 ${hero ? "py-2" : "py-3"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              // Smaller sideways, where every row of height comes straight out
              // of the picture the guest came to look at.
              className={`shrink-0 w-14 h-14 [@media(max-height:560px)]:h-9 [@media(max-height:560px)]:w-9 overflow-hidden border-2 transition-colors ${hero ? "rounded-xl" : "rounded-md"} ${
                i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-75"
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        className={`px-4 py-3 ${hero ? "" : "shrink-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* The room's own colour, from the same getRoomColor the cards and
            badges use — so King reads red here exactly as it does everywhere
            else, and a guest deep in a gallery still knows which room this is. */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`${roomChipClass} inline-block rounded px-2 py-0.5 text-sm font-semibold text-white`}
          >
            {room.name}
          </span>
          {/* The listing holds more than TiBook shows: the reviews, the full
              28-item amenity list, the map. Offered here, beside the room's
              name, rather than leaving the guest to find the small ↗ back on
              the card they have already scrolled away from.
              AirBnB's own red, the same colour that arrow uses. */}
          {room.airbnbUrl && (
            <a
              href={room.airbnbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm font-semibold text-[#FF5A5F] hover:underline"
            >
              See more on AirBnB ↗
            </a>
          )}
        </div>
        {/* The questions a guest actually opens a photo to answer: how many of
            us fit, what the bed is, is the bathroom ours, is the door ours.
            They were only on the AirBnB listing, which meant leaving TiBook to
            find out. Capped and scrollable so a long list never squeezes the
            photo off a small phone.
            text-BASE, which is another step up the same tibook-type scale —
            never a hardcoded size, so the whole block still answers the one
            knob. It was text-sm, and the house asked for it bigger: this is
            what a guest reads to decide whether the room fits them, on a
            phone, often at night, and it was the smallest thing on the screen
            that actually had to be read rather than glanced at. */}
        {facts && (
          <div className="mt-1.5 max-h-[34vh] overflow-y-auto">
            <p className="text-base text-gray-300">Accommodates up to {facts.maxGuests}</p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {facts.beds.map((bed) => (
                <li key={bed.label} className="flex items-center gap-1.5 text-base text-gray-200">
                  <BedIcon kind={bed.kind} />
                  {bed.label}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-base text-gray-300">{facts.bathroom}</p>
            {/* Beside the bathroom, because it is the same kind of answer: what
                in this house is yours alone and what is everybody's. Read from
                one constant, so all five rooms say it identically. */}
            <p className="text-base text-gray-300">{houseKitchen}</p>
            <p className="text-base text-gray-300">{facts.privacy}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {facts.highlights.map((highlight) => (
                <li
                  key={highlight}
                  // bg-white/20, NOT "bg-white bg-opacity-20" — Tailwind v4
                  // dropped the bg-opacity-* utilities, so that pair silently
                  // renders a SOLID white pill and the white label vanishes
                  // into it. Other spots in this file still have the old form.
                  // Sized with the lines above it: these are amenities a guest
                  // reads down, not decoration, and a pill left a step smaller
                  // than the sentence beside it read as a footnote.
                  className="rounded-full bg-white/20 px-2 py-0.5 text-base text-white"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The price here is a conversation, not a checkout — a guest can
            settle it with the host directly, and several already do. Said out
            loud rather than left for the guest to guess at, and placed where
            they are already weighing up the room.
            Outside the facts block on purpose: it stands for every room, even
            the ones with nothing transcribed yet.

            A returning guest on an agreed rate is told what it IS, not invited
            to go and find out. This said "you can settle the price directly"
            and offered "Ask about the price" to everyone, including guests
            whose rate the app was showing on the card they had just tapped —
            two screens disagreeing about whether a price existed. The message
            stays offered either way: an agreed rate is still a conversation,
            it is just no longer an unanswered question. */}
        {(priceSmsHref || onOpenChat) && (
          <>
            <p className="mt-3 text-sm text-gray-300">
              {!hasRate ? (
                <>The price here is something you can settle with {hostFirstName} directly.</>
              ) : myRate === 0 ? (
                <>
                  <span className="font-semibold text-white">Family — no charge</span> for this
                  room, agreed with {hostFirstName}.
                </>
              ) : (
                <>
                  Your price for this room is{" "}
                  <span className="font-semibold text-white">${myRate}/night</span>, agreed with{" "}
                  {hostFirstName}.
                </>
              )}
            </p>
            {/* Chat first, and in colour. It is the route that reaches the
                host from anywhere, so it is the one a guest should land on
                without having to weigh the two — the text link sat here on
                its own for so long that it read as the only way. */}
            {onOpenChat && (
              <>
                <button
                  type="button"
                  onClick={onOpenChat}
                  className={`${contactBase} ${contactColoured}`}
                >
                  💬 Chat here in TiBook
                </button>
                <p className="mt-1.5 text-center text-xs text-gray-400">
                  Works from any country, on any phone — {hostFirstName} replies on this screen.
                </p>
              </>
            )}
            {/* The same conversation by text, for a guest whose phone reaches
                a US number easily. Named by where it happens — "Chat here in
                TiBook" above, "Text" here — because two buttons that both said
                "message" would leave the guest picking blind. */}
            {priceSmsHref && (
              <a
                href={priceSmsHref}
                className={`${contactBase} ${onOpenChat ? contactOutline : contactColoured}`}
              >
                💬 {hasRate ? `Text ${hostFirstName}` : `Ask ${hostFirstName} about the price`}
              </a>
            )}
          </>
        )}
      </div>
      </div>
    </div>

    {/* The enlarged picture.
        A LAYER over the gallery, not a second modal: it reads and writes the
        same `index`, so a guest who enlarges photo 7, swipes along to 9 and
        drops back out finds the gallery sitting on 9 too. The swipe and the
        double-tap are the very same handlers the small picture uses.
        A SIBLING of the sheet, not a child. In Hero the sheet carries
        `overflow-hidden` for its rounded top, and a full-screen layer inside
        something clipped is one browser quirk away from being clipped with it.
        Out here nothing can crop it, at the price of naming `tibook-type`
        itself — every overlay root in TiBook does that anyway. */}
    {enlarged && (
        <div
          className="tibook-type fixed inset-0 z-[70] flex items-center justify-center bg-black"
          style={{ touchAction: "manipulation" }}
          // The same guard the sheet carries: a swipe that ends over ‹ or ›
          // still emits a click on it when the finger lifts, and the picture
          // would move twice — once for the gesture, once for the click.
          onClickCapture={(e) => {
            if (!swiped.current) return;
            swiped.current = false;
            e.stopPropagation();
          }}
          // Mouse only, for the same reason the small picture's is: the
          // dblclick that trails the very double-tap which OPENED this layer
          // would otherwise close it again before the guest saw it.
          onDoubleClick={() => {
            if (isRealMouse()) setEnlarged(false);
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={photos[index]}
            alt={`${room.name} ${index + 1}`}
            className="max-h-full max-w-full select-none object-contain"
            draggable={false}
          />

          <button
            onClick={() => setEnlarged(false)}
            aria-label="Back to the room"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl leading-none text-white hover:bg-white/30"
          >
            ×
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                aria-label="Previous picture"
                className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
              >
                ‹
              </button>
              <button
                onClick={next}
                aria-label="Next picture"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-xl text-white transition-colors hover:bg-white/30"
              >
                ›
              </button>
              <span className="absolute bottom-3 right-4 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                {index + 1} / {photos.length}
              </span>
            </>
          )}

          {/* The way back, said rather than left to be worked out. A guest who
              arrived by double-tapping has no reason to assume the same
              gesture is also the exit. */}
          <span className="absolute bottom-3 left-4 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
            Tap twice to go back
          </span>
        </div>
    )}
    </>,
    document.body,
  );
};

export default RoomGalleryModal;