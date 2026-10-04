import { ReactNode, useRef, useState } from "react";
import { SWIPE_DELETE } from "./dangerButton";

// A row that slides left to show a Delete button behind it.
//
// Asked for by Anh-Tuan on 2026-10-04 for the payments on a cleaner's Pay
// tab: "x should be removed and change to the design swipe left to show
// delete button and before delete popup a confirmation dialog". A × on every
// line is a mistake waiting on a phone; a swipe is a deliberate gesture, and
// the button it reveals is the only way to delete. What happens on the tap is
// the caller's — it should ask before it acts.
//
// Pointer events, so a mouse drags the same way a finger does. touch-action
// pan-y leaves vertical scrolling to the browser: a list that cannot be
// scrolled because every row grabs the finger is worse than the ×.

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  label?: string;
  className?: string;
}

const REVEAL = 80; // px the row slides: the 72px button behind it plus its inset
const SLOP = 6; // px before a touch counts as a swipe rather than a tap

const SwipeToDelete = ({ children, onDelete, label = "Delete", className = "" }: SwipeToDeleteProps) => {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const open = useRef(false);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  const settle = (isOpen: boolean) => {
    open.current = isOpen;
    setDx(isOpen ? -REVEAL : 0);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => {
          settle(false);
          onDelete();
        }}
        tabIndex={open.current ? 0 : -1}
        aria-hidden={!open.current}
        className={SWIPE_DELETE}
      >
        {label}
      </button>
      <div
        // select-none: a drag with a mouse highlighted the amounts as it went.
        className="relative select-none bg-white"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 160ms ease-out",
          touchAction: "pan-y",
        }}
        onPointerDown={(e) => {
          startX.current = e.clientX;
          moved.current = false;
          setDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (startX.current === null) return;
          const d = e.clientX - startX.current + (open.current ? -REVEAL : 0);
          if (Math.abs(e.clientX - startX.current) > SLOP) moved.current = true;
          setDx(Math.max(-REVEAL, Math.min(0, d)));
        }}
        onPointerUp={() => {
          if (startX.current === null) return;
          setDragging(false);
          // A tap on an open row closes it; a swipe past halfway opens it.
          if (!moved.current) settle(false);
          else settle(dx < -REVEAL / 2);
          startX.current = null;
        }}
        onPointerCancel={() => {
          startX.current = null;
          setDragging(false);
          settle(open.current);
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeToDelete;
