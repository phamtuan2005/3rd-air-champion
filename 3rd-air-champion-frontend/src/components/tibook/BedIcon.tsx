import { bedKind } from "../../util/roomFacts";

// Line drawings in the manner AirBnB uses beside a sleeping arrangement: one
// even stroke, no fill, round joins. They exist for the guest who skims five
// rooms on a phone and takes in the shape before reading a word.
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

// A bed seen from the side: headboard, pillow, mattress, foot. Queen and double
// share it — the label carries the size, the picture carries "this is a bed".
const Bed = () => (
  <svg {...common}>
    <path d="M2.5 19.5V6" />
    <path d="M2.5 12.5h14a4 4 0 0 1 4 4v3" />
    <path d="M2.5 16.5h18" />
    <circle cx="7" cy="9.75" r="2.25" />
  </svg>
);

// A sofa: back, two arms, seat. Distinct enough from the bed at a glance that a
// guest can tell the second sleeping place is a sofa without reading.
const Sofa = () => (
  <svg {...common}>
    <path d="M5 12V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V12" />
    <path d="M2.5 14.5a2 2 0 0 1 4 0V17h11v-2.5a2 2 0 0 1 4 0V19H2.5Z" />
    <path d="M6 19v1.5M18 19v1.5" />
  </svg>
);

const BedIcon = ({ kind }: { kind: bedKind }) => (kind === "sofa" ? <Sofa /> : <Bed />);

export default BedIcon;
