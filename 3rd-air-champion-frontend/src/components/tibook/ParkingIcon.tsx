// A car, side-on, beside the parking line in a room's gallery.
//
// Third drawing, each at the house's request. First the road sign for parking,
// a "P" in a rounded square — a letter in a box beside a sentence that already
// says "parking". Then a car head-on, drawn to match BedIcon's beds seen from
// the foot. Now side-on: the car a guest knows from every map and parking app,
// so it is recognised before it is looked at.
//
// Facing RIGHT, toward the sentence it introduces, so it reads as driving into
// the line rather than away from it. The bonnet is longer than the boot on
// purpose — a cabin with equal ends either side reads as a van or a bus at
// 19px, and the long front is what says "car".
//
// Drawn in BedIcon's hand, because it sits a few lines below those beds and
// the first side-on car did not: it was small, thin and all curves, and read
// as clip-art from another set. So this one is built the way the beds are —
// straight edges meeting at round joins, curves only where the thing is round
// (the wheels, as the beds' only curves are the sleepers), and filling the
// square about as fully as a bed does, so the two carry the same weight.
//
// The cabin is closed off at the waist and split by one pillar into two
// windows, which is the car's equivalent of the beds' sleepers: the one
// detail that makes the outline a particular thing. Nothing finer than that.
// At 1.35em (~19px) with a 1.6 stroke, lines closer than ~4 units merge, and
// the window line of the curvy car before it greyed the roof over. Checked at
// 19px, like the beds.
//
// One even stroke, no fill, currentColor and em sizing, like BedIcon, so it
// takes the colour of its line and grows with the `tibook-type` scale instead
// of staying behind when a guest turns it up.
//
// Centred on (12, 12) — 1.8 to 22.2 across, 6.1 to 17.9 down, wheels
// included. The gallery centres this box on the first line of text, so a
// drawing off-centre inside its own box looks crooked however well the box is
// placed. The first "P" had exactly that problem.
//
// aria-hidden: the sentence beside it says "parking" already.
const ParkingIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="h-[1.35em] w-[1.35em] shrink-0"
  >
    {/* The body, from the back bumper up over the roof and down the long
        bonnet to the front, with a gap left in the sill where each wheel sits. */}
    <path d="M4.3 15.4H1.8V11.1L5.9 10.4L8.5 6.1H15L18.1 10.4L21.2 11Q22.2 11.2 22.2 12.2V15.4H19.7M9.3 15.4H14.7" />
    {/* The waist, closing off the cabin, and the pillar between its windows. */}
    <path d="M5.9 10.4H18.1M12 6.1V10.4" />
    {/* Two wheels. */}
    <circle cx="6.8" cy="15.4" r="2.5" />
    <circle cx="17.2" cy="15.4" r="2.5" />
  </svg>
);

export default ParkingIcon;
