import { bedKind } from "../../util/roomFacts";

// Line drawings in the manner AirBnB uses beside a sleeping arrangement: one
// even stroke, no fill, round joins. They exist for the guest who skims five
// rooms on a phone and takes in the shape before reading a word.
//
// Both are drawn END-ON, from the foot of the bed, rather than from the side.
// Side-on, a bed is a long rectangle with a circle at one end — which is also a
// sofa, a desk or a table, and the old pair leaned on the sofa's arms to be
// told apart at all. Head-on, the bed narrows away from the viewer and the
// sleepers face you, so the shape can only be a bed. It also gives the picture
// somewhere to say the thing the label never does: how many the bed is for.
//
// currentColor and em-based sizing on purpose — the icon inherits the colour of
// the line it sits on and grows with the `tibook-type` scale, so turning the
// type knob moves the pictures with the words instead of leaving them stranded.
//
// aria-hidden throughout: the label beside each icon already says "1 queen bed",
// and a screen reader announcing it twice is worse than not drawing it at all.

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-[1.35em] w-[1.35em] shrink-0",
};

// Every number in both drawings is spaced for the size they are actually seen
// at: 1.35em, about 19px on a phone. At 1.6 stroke that leaves very little room
// — heads closer than ~6 units apart merge into one blob, and the duvet has to
// clear them by about a stroke or the middle of the icon greys over. The two
// were drawn at 19px and checked there. Zoomed in, every spacing mistake in
// here looks fine, which is why none of these gaps are as generous as they
// look on your screen.

// The room's own bed, from the foot: headboard at the far end, two heads on the
// pillows, and the duvet rising over a body under each of them. Queen and
// double share it — the label carries the size, the picture carries "this is
// the bed, and it is for two".
//
// The duvet is a wave rather than a straight edge, and that is the whole reason
// the sleepers read as people: two circles over a flat line are two buttons on
// a lampshade, and the same two circles over a line that lifts beneath each of
// them are heads with shoulders under the covers. It costs nothing at 19px and
// pays off for a guest who has turned the type scale up, where these are drawn
// several times larger.
//
// Those two figures are NOT the room's capacity, and must not be read as one.
// Cozy's bed is a double drawn with two sleepers while the listing caps that
// room at a single guest; the "Accommodates up to N" line sitting directly
// above these icons is the number a guest goes by. Dropping a sleeper here to
// match it would tell the next guest the bed is a single, which it is not.
const Bed = () => (
  <svg {...common}>
    {/* The mattress: widest at the foot, nearest the guest, narrowing to the head. */}
    <path d="M5.5 7h13l3.5 13.5h-20Z" />
    {/* The headboard, standing on the two far corners. */}
    <path d="M5.5 7V4.8h13V7" />
    {/* The duvet, turned down and lifting over a body under each head. */}
    <path d="M3.3 15.6H5.6Q5.6 14.2 8.8 14.2Q12 14.2 12 15.6Q12 14.2 15.2 14.2Q18.4 14.2 18.4 15.6H20.7" />
    {/* Two asleep. */}
    <circle cx="8.8" cy="10.6" r="1.55" />
    <circle cx="15.2" cy="10.6" r="1.55" />
  </svg>
);

// The sofa bed, made up: same viewpoint, same duvet, same sleeper, so the two
// icons read as a pair rather than as two unrelated drawings. What differs is
// only what a guest needs in order to tell them apart — it is narrower, it has
// a sofa's back and arms where the bed has a headboard, and ONE person is
// asleep in it. That last part is the honest one: this is the second sleeping
// place in King and Queen, and it is for one.
const Sofa = () => (
  <svg {...common}>
    {/* Narrower than the bed above at both ends — the width IS the difference. */}
    <path d="M8 7h8l2.5 13.5h-13Z" />
    {/* The sofa's back, its arms coming down either side of the mattress. */}
    <path d="M5.5 9.5V6.5A1.5 1.5 0 0 1 7 5h10a1.5 1.5 0 0 1 1.5 1.5v3" />
    {/* The duvet, turned down and lifting over the one body under it. */}
    <path d="M6.4 15.6H8.8Q8.8 14.2 12 14.2Q15.2 14.2 15.2 15.6H17.6" />
    {/* One asleep. */}
    <circle cx="12" cy="10.6" r="1.55" />
  </svg>
);

const BedIcon = ({ kind }: { kind: bedKind }) => (kind === "sofa" ? <Sofa /> : <Bed />);

export default BedIcon;
