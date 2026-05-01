import { useRef, useState } from "react";

interface MobilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const DEFAULT_HEIGHT_VH = 60;
const MIN_HEIGHT_VH = 20;
const CLOSE_THRESHOLD_VH = 22;
const MAX_HEIGHT_VH = 92;

const MobilePanel = ({ isOpen, onClose, children }: MobilePanelProps) => {
  const [height, setHeight] = useState(DEFAULT_HEIGHT_VH);
  const dragStartY = useRef(0);
  const heightAtStart = useRef(DEFAULT_HEIGHT_VH);
  const dragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    heightAtStart.current = height;
    dragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dy = dragStartY.current - e.touches[0].clientY;
    const newHeight = Math.min(MAX_HEIGHT_VH, Math.max(MIN_HEIGHT_VH, heightAtStart.current + (dy / window.innerHeight) * 100));
    setHeight(newHeight);
  };

  const handleTouchEnd = () => {
    dragging.current = false;
    if (height < CLOSE_THRESHOLD_VH) {
      setHeight(DEFAULT_HEIGHT_VH);
      onClose();
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50 flex flex-col sm:hidden transition-transform duration-300 ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ height: `${height}vh` }}
    >
      {/* Drag handle bar */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-4 pt-2.5 pb-1.5 touch-none select-none cursor-row-resize"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-8" />
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
        <button
          className="w-8 text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none flex items-center justify-end"
          onClick={onClose}
        >
          &times;
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
};

export default MobilePanel;