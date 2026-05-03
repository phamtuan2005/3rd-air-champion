import { useState } from "react";
import { roomType } from "../../util/types/roomType";
import RoomGalleryModal from "./RoomGalleryModal";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { getRoomColor } from "../../util/getRoomColor";

const BACKEND = import.meta.env.VITE_BACKEND_ENDPOINT || "";
const resolveUrl = (url: string) => url.startsWith("/") ? `${BACKEND}${url}` : url;

interface RoomCardsProps {
  rooms: roomType[];
  selectedRoomIds: Set<string> | null;
  onToggleRoom: (id: string) => void;
  onSelectAll: () => void;
}

const RoomCard = ({
  room,
  selected,
  onSelect,
  onViewPhotos,
}: {
  room: roomType;
  selected: boolean;
  onSelect: () => void;
  onViewPhotos: () => void;
}) => {
  const { theme } = useTiBookTheme();
  const photos = (room.photos?.filter(Boolean) ?? []).map(resolveUrl);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`flex-shrink-0 w-24 sm:w-32 rounded-xl overflow-hidden shadow-sm border-2 bg-white transition-all ${
        selected ? `${theme.selectedBorder} ${theme.selectedShadow}` : "border-gray-100"
      }`}
    >
      {/* Image area — tap to view photos */}
      <div
        className="relative w-full h-16 sm:h-20 bg-gray-100 cursor-pointer active:opacity-80"
        onClick={photos.length > 0 ? onViewPhotos : undefined}
      >
        {photos.length > 0 && !imgError ? (
          <>
            <img
              src={photos[0]}
              alt={room.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
              draggable={false}
            />
            {photos.length > 1 && (
              <span className="absolute bottom-1 right-1 bg-black bg-opacity-40 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none pointer-events-none flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v7l-3-3-4 4-2-2-3 3V5z"/></svg>
                {photos.length}
              </span>
            )}
          </>
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center text-white text-2xl font-bold ${room.color ?? "bg-gray-400"}`}
          >
            {room.name.charAt(0).toUpperCase()}
          </div>
        )}
        {selected && (
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full ${theme.btn} flex items-center justify-center pointer-events-none`}>
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Name area — tap to select/filter */}
      <div
        className="px-2 py-1.5 cursor-pointer active:bg-gray-50 flex flex-col gap-1"
        onClick={onSelect}
      >
        <span className={`${getRoomColor(room.name, room.color)} text-white text-xs font-semibold px-2 py-0.5 rounded self-start truncate max-w-full`}>
          {room.name}
        </span>
        <p className="text-[10px] text-gray-400 leading-none">
          {selected ? "✓ selected" : "tap to select"}
        </p>
        {room.airbnbUrl && (
          <a
            href={room.airbnbUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-rose-400 hover:text-rose-600 leading-none underline underline-offset-2 transition-colors"
          >
            View on AirBnB
          </a>
        )}
      </div>
    </div>
  );
};

const RoomCards = ({ rooms, selectedRoomIds, onToggleRoom, onSelectAll }: RoomCardsProps) => {
  const { theme } = useTiBookTheme();
  const [galleryRoom, setGalleryRoom] = useState<roomType | null>(null);
  const activeRooms = rooms.filter((r) => r.active).sort((a, b) => b.price - a.price);
  if (activeRooms.length === 0) return null;

  const isAll = selectedRoomIds === null;

  return (
    <>
      <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Our Rooms</p>
        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          {/* All chip */}
          <button
            type="button"
            onClick={onSelectAll}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              isAll
                ? `${theme.btn} text-white shadow-sm`
                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
            }`}
          >
            All Rooms
          </button>

          {activeRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              selected={!isAll && (selectedRoomIds?.has(room.id) ?? false)}
              onSelect={() => onToggleRoom(room.id)}
              onViewPhotos={() => setGalleryRoom(room)}
            />
          ))}
        </div>
      </div>

      {galleryRoom && (
        <RoomGalleryModal
          room={galleryRoom}
          onClose={() => setGalleryRoom(null)}
        />
      )}
    </>
  );
};

export default RoomCards;