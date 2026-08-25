import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { roomType } from "../../util/types/roomType";
import { getRoomFacts, getRoomPhotos, houseKitchen } from "../../util/roomFacts";
import { getRoomColor } from "../../util/getRoomColor";
import BedIcon from "./BedIcon";

const BACKEND = import.meta.env.VITE_BACKEND_ENDPOINT || "";
const resolveUrl = (url: string) => url.startsWith("/") ? `${BACKEND}${url}` : url;

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
  onClose: () => void;
}

const RoomGalleryModal = ({ room, initialIndex = 0, hostPhone, hostName, myRate, onClose }: RoomGalleryModalProps) => {
  const photos = getRoomPhotos(room).map(resolveUrl);
  const [index, setIndex] = useState(initialIndex);
  // Undefined for any room not transcribed yet, and the footer then reads
  // exactly as it did before — a guest never sees a gap where facts should be.
  const facts = getRoomFacts(room.airbnbUrl);
  // Honours a colour set on the room record first, and falls back to the
  // house's own name-to-colour rule — the same call the room cards make.
  const roomColor = getRoomColor(room.name, room.color);
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
  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    swiped.current = false;
  };
  const onTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || photos.length < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
    swiped.current = true;
    // Drag left, the picture moves left: the next one arrives from the right.
    if (dx < 0) next();
    else prev();
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
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [photos.length]);

  return createPortal(
    <div
      // Top edge moves, bottom stays pinned — the sheet SHRINKS rather than
      // sliding, so nothing at the bottom is pushed off the screen when it is
      // pulled down. Rounded only once it has moved, since at rest it is
      // full-bleed and a rounded corner there would just show the page behind.
      className={`tibook-type fixed inset-x-0 bottom-0 bg-black bg-opacity-90 z-50 flex flex-col ${
        pull > 0 ? "rounded-t-2xl" : ""
      }`}
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

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`${roomColor} rounded px-2 py-0.5 text-sm font-medium text-white`}>
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
        className="flex-1 flex items-center justify-center relative px-12 min-h-0"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={photos[index]}
          alt={`${room.name} ${index + 1}`}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          draggable={false}
        />

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

      {/* Everything below the picture, sharing one capped scroll area on a
          SHORT screen — a phone held sideways. There the header, the 90px
          thumbnail strip and the facts added up to more than the whole 390px
          of height, and the photo, being the flex-1 child, was squeezed to
          exactly 0 pixels: a guest opened a picture and saw no picture.
          Capped at 38% there so the photo keeps the clear majority; the facts
          scroll within what is left rather than pushing the picture out.
          `contents` means this wrapper does not exist as far as layout is
          concerned on a normal upright phone — portrait is untouched. */}
      <div className="contents [@media(max-height:560px)]:block [@media(max-height:560px)]:max-h-[38%] [@media(max-height:560px)]:shrink-0 [@media(max-height:560px)]:overflow-y-auto">
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
          className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0 justify-center-safe [@media(max-height:560px)]:py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              // Smaller sideways, where every row of height comes straight out
              // of the picture the guest came to look at.
              className={`shrink-0 w-14 h-14 [@media(max-height:560px)]:h-9 [@media(max-height:560px)]:w-9 rounded-md overflow-hidden border-2 transition-colors ${
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
        className="px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The room's own colour, from the same getRoomColor the cards and
            badges use — so King reads red here exactly as it does everywhere
            else, and a guest deep in a gallery still knows which room this is. */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`${roomColor} inline-block rounded px-2 py-0.5 text-sm font-semibold text-white`}
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
            text-sm, not text-xs: one step up the tibook-type scale rather than
            a hardcoded size, so it still answers the same knob. */}
        {facts && (
          <div className="mt-1.5 max-h-[34vh] overflow-y-auto">
            <p className="text-sm text-gray-300">Accommodates up to {facts.maxGuests}</p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {facts.beds.map((bed) => (
                <li key={bed.label} className="flex items-center gap-1.5 text-sm text-gray-200">
                  <BedIcon kind={bed.kind} />
                  {bed.label}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-sm text-gray-300">{facts.bathroom}</p>
            {/* Beside the bathroom, because it is the same kind of answer: what
                in this house is yours alone and what is everybody's. Read from
                one constant, so all five rooms say it identically. */}
            <p className="text-sm text-gray-300">{houseKitchen}</p>
            <p className="text-sm text-gray-300">{facts.privacy}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {facts.highlights.map((highlight) => (
                <li
                  key={highlight}
                  // bg-white/20, NOT "bg-white bg-opacity-20" — Tailwind v4
                  // dropped the bg-opacity-* utilities, so that pair silently
                  // renders a SOLID white pill and the white label vanishes
                  // into it. Other spots in this file still have the old form.
                  className="rounded-full bg-white/20 px-2 py-0.5 text-sm text-white"
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
        {priceSmsHref && (
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
            <a
              href={priceSmsHref}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/30 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              💬 {hasRate ? `Message ${hostFirstName}` : `Ask ${hostFirstName} about the price`}
            </a>
          </>
        )}
      </div>
      </div>
    </div>,
    document.body,
  );
};

export default RoomGalleryModal;