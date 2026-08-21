import { useState } from "react";
import { roomType } from "../../util/types/roomType";
import RoomGalleryModal from "./RoomGalleryModal";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { getRoomColor } from "../../util/getRoomColor";
import RoomBadge from "../shared/RoomBadge";

const BACKEND = import.meta.env.VITE_BACKEND_ENDPOINT || "";
const resolveUrl = (url: string) => url.startsWith("/") ? `${BACKEND}${url}` : url;

interface RoomCardsProps {
  rooms: roomType[];
  selectedRoomIds: Set<string> | null;
  onToggleRoom: (id: string) => void;
  onSelectAll: () => void;
  compact?: boolean;
  // Supplied only where the guest is allowed to change the banner's size — the
  // home header. Its presence is what puts the toggle on the banner; the
  // reduced filter shown over a dragged-up calendar passes nothing and stays
  // fixed, because there the calendar owns the height.
  onToggleCompact?: () => void;
  // This guest's own agreed rate per room, where they have one. Empty for a
  // stranger, and for a returning guest with no special price — both of whom
  // simply see the room's own rate.
  myRates?: Map<string, number>;
}

const RoomCard = ({
  room,
  allRooms,
  selected,
  onSelect,
  onViewPhotos,
  myRate,
}: {
  room: roomType;
  allRooms: roomType[];
  selected: boolean;
  onSelect: () => void;
  onViewPhotos: () => void;
  myRate?: number;
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
      <div
        className="relative w-full h-11 sm:h-20 bg-gray-100 cursor-pointer active:opacity-80"
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
          <div className={`w-full h-full flex items-center justify-center text-white text-2xl font-bold ${room.color ?? "bg-gray-400"}`}>
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

      {/* One row, not three. "tap to select" said the same thing on every card
          and moved to the header once; "✓ selected" repeated the tick already
          drawn on the photo and the border already around the card. Both were
          costing a line of every card, and the cards sit above the calendar. */}
      {/* What THIS guest pays. Their agreed rate could only be seen several
          taps into a booking request, so a returning guest on $60 was quoted
          the room's $73 everywhere they actually looked.

          A guest on a deliberate $0 rate — family — is not shown "$0", which
          reads like a bug. They are told what it means. */}
      {myRate != null && (
        <div className="px-2 pt-1 text-[10px] leading-tight sm:text-[11px]">
          {myRate === 0 ? (
            <span className={`font-bold ${theme.textPrimary}`}>
              Family — no charge
            </span>
          ) : (
            <>
              {myRate < room.price && (
                <span className="mr-1 text-gray-400 line-through">${room.price}</span>
              )}
              <span className="font-bold text-gray-800">${myRate}</span>
              <span className="text-gray-400">/night</span>
            </>
          )}
        </div>
      )}

      <div
        className="px-2 py-1.5 cursor-pointer active:bg-gray-50 flex items-center gap-1"
        onClick={onSelect}
      >
        <RoomBadge room={room} rooms={allRooms} className="min-w-0" />
        {room.airbnbUrl && (
          <a
            href={room.airbnbUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`View ${room.name} on AirBnB`}
            aria-label={`View ${room.name} on AirBnB`}
            className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-rose-200 text-[9px] font-bold leading-none text-[#FF5A5F] transition-colors hover:bg-rose-50"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
};

const RoomCards = ({ rooms, selectedRoomIds, onToggleRoom, onSelectAll, compact = false, onToggleCompact, myRates }: RoomCardsProps) => {
  const { theme } = useTiBookTheme();
  const [galleryRoom, setGalleryRoom] = useState<roomType | null>(null);
  const activeRooms = rooms.filter((r) => r.active).sort((a, b) => b.price - a.price);
  if (activeRooms.length === 0) return null;

  const isAll = selectedRoomIds === null;

  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        {/* The pills scroll; the button does NOT live among them.
            It used to, with ml-auto — which does nothing once the pills overflow,
            so with six rooms the only way to the photos sat off the right edge
            where nobody would think to swipe for it. */}
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={onSelectAll}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              isAll ? `${theme.btn} text-white shadow-sm` : "bg-white text-gray-500 border border-gray-200"
            }`}
          >
            All
          </button>
          {activeRooms.map((room) => {
            const selected = !isAll && (selectedRoomIds?.has(room.id) ?? false);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => onToggleRoom(room.id)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold text-white transition-all ${getRoomColor(room.name, room.color)} ${
                  selected ? "ring-2 ring-offset-1 ring-gray-400 scale-105" : "opacity-75"
                }`}
              >
                {room.name}
              </button>
            );
          })}
        </div>
        {/* A first-time guest has not seen the rooms at all, so this cannot be a
            faint bit of text they have to notice — it is a real button, pinned
            outside the scroller and always on screen. */}
        {onToggleCompact && (
          <button
            type="button"
            onClick={onToggleCompact}
            aria-label="Show room photos"
            className="flex shrink-0 items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
          >
            Photos ▾
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="tibook-type px-3 py-1.5 border-b border-gray-100 bg-gray-50">
        <div className="mb-2 flex items-center justify-between gap-2">
          {/* The hint that used to repeat on every card, said once — and saying
              which HALF of the card selects. The photo opens the gallery and the
              name row selects the room, so "tap to select" pointed at the wrong
              half for anyone who tried the picture first.
              No truncate: an instruction that gets cut off is worse than one
              that wraps on the narrowest phones. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Our Rooms{" "}
            <span className="font-medium normal-case">· tap on the room name to select</span>
          </p>
          {onToggleCompact && (
            <button
              type="button"
              onClick={onToggleCompact}
              aria-label="Hide room photos"
              className="shrink-0 text-xs font-semibold text-gray-400 hover:text-gray-600"
            >
              Hide ▴
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
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
              allRooms={activeRooms}
              selected={!isAll && (selectedRoomIds?.has(room.id) ?? false)}
              onSelect={() => onToggleRoom(room.id)}
              onViewPhotos={() => setGalleryRoom(room)}
              myRate={myRates?.get(room.id)}
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