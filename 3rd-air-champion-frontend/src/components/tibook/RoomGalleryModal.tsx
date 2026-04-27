import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { roomType } from "../../util/types/roomType";

const BACKEND = import.meta.env.VITE_BACKEND_ENDPOINT || "";
const resolveUrl = (url: string) => url.startsWith("/") ? `${BACKEND}${url}` : url;

interface RoomGalleryModalProps {
  room: roomType;
  initialIndex?: number;
  onClose: () => void;
}

const RoomGalleryModal = ({ room, initialIndex = 0, onClose }: RoomGalleryModalProps) => {
  const photos = (room.photos?.filter(Boolean) ?? []).map(resolveUrl);
  const [index, setIndex] = useState(initialIndex);

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

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
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white text-sm font-medium">{room.name}</span>
        <span className="text-gray-400 text-sm">{index + 1} / {photos.length}</span>
        <button
          onClick={onClose}
          className="text-white text-2xl leading-none w-8 h-8 flex items-center justify-center hover:text-gray-300"
        >
          ×
        </button>
      </div>

      {/* Photo */}
      <div
        className="flex-1 flex items-center justify-center relative px-12 min-h-0"
        onClick={(e) => e.stopPropagation()}
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
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-15 hover:bg-opacity-30 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-15 hover:bg-opacity-30 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div
          className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0 justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${
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
        <p className="text-white font-semibold">{room.name}</p>
      </div>
    </div>,
    document.body,
  );
};

export default RoomGalleryModal;