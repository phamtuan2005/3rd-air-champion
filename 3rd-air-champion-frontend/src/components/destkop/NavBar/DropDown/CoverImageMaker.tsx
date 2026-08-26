import { useEffect, useRef, useState } from "react";

const BACKEND = import.meta.env.VITE_BACKEND_ENDPOINT || "";
const resolveUrl = (url: string) => (url.startsWith("/") ? `${BACKEND}${url}` : url);

// A cover picture with the selling points written on it, for the AirBnB listing.
//
// Nothing in this app can write to AirBnB — TiBook only links out to those
// listings ([[project-shared-kitchen]] is the standing example of the two
// disagreeing). So this makes the PICTURE and hands it over; uploading it stays
// Anh-Tuan's job, done once per listing.
//
// The room's FIRST photo is the base, which is the same one the room card and
// the gallery lead with. Reordering the photos changes this too, so there is one
// idea of "the cover" rather than two that can drift.

interface CoverImageMakerProps {
  roomName: string;
  photos: string[];
  // Room id, so a room's lines are remembered against that room and not
  // whichever one happened to be open last.
  roomId: string;
}

// Sized for AirBnB's own listing images, which are landscape and served around
// 1200 wide. Rendering larger and letting them downscale keeps the text crisp.
const W = 1600;
const H = 1067; // 3:2, the shape AirBnB crops to

const storageKey = (roomId: string) => `coverLines:${roomId}`;

const CoverImageMaker = ({ roomName, photos, roomId }: CoverImageMakerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const cover = photos[0] ? resolveUrl(photos[0]) : null;

  // Lines survive closing the modal. Kept in this browser rather than on the
  // room record: it is copy being drafted, not something TiBook or the guest
  // ever reads, and a backend field for it would be a migration for a caption.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(roomId));
      setLines(saved ? (JSON.parse(saved) as string[]) : ["", ""]);
    } catch {
      setLines(["", ""]);
    }
  }, [roomId]);

  const setLine = (i: number, value: string) => {
    const next = [...lines];
    next[i] = value;
    setLines(next);
    try {
      localStorage.setItem(storageKey(roomId), JSON.stringify(next));
    } catch {
      // A full or blocked localStorage must not stop the picture being made.
    }
  };

  // Redraw whenever the photo or the words change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cover) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setReady(false);
    const img = new Image();
    // Required BEFORE src, or the canvas is tainted and cannot be exported.
    // AirBnB's CDN answers with Access-Control-Allow-Origin: *, so this holds
    // for the house photos as well as anything uploaded here.
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, W, H);

      // Cover-fit: fill the frame and crop the overflow, never squash the room.
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

      const written = lines.filter((l) => l.trim() !== "");
      if (written.length > 0) {
        // A dark wash up from the bottom. Photos of a bright room would leave
        // white text unreadable, and a guest scrolling a grid of listings gives
        // this less than a second.
        const scrim = ctx.createLinearGradient(0, H * 0.45, 0, H);
        scrim.addColorStop(0, "rgba(0,0,0,0)");
        scrim.addColorStop(1, "rgba(0,0,0,0.72)");
        ctx.fillStyle = scrim;
        ctx.fillRect(0, H * 0.45, W, H * 0.55);

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#ffffff";
        // Shadowed as well as scrimmed — a pale photo can still swallow white.
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;

        const sizes = [86, 58];
        const gap = 26;
        let y = H - 72;
        // Drawn bottom-up so the first line always sits highest, whether there
        // are one or two.
        for (let i = written.length - 1; i >= 0; i--) {
          const size = sizes[Math.min(i, sizes.length - 1)];
          ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          ctx.fillText(written[i], 72, y);
          y -= size + gap;
        }
        ctx.shadowColor = "transparent";
      }
      setError(null);
      setReady(true);
    };
    img.onerror = () => {
      setError("That photo could not be loaded for editing.");
      setReady(false);
    };
    img.src = cover;
  }, [cover, lines]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("The picture could not be saved. Try a different photo.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${roomName.toLowerCase().replace(/\s+/g, "-")}-cover.jpg`;
      a.click();
      // Revoked on the next tick — revoking immediately can beat the download
      // in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/jpeg", 0.92);
  };

  if (!cover) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-gray-700">AirBnB cover picture</p>
        <p className="text-xs text-gray-400">
          Add a photo above first — the first one is used as the cover.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-gray-700">AirBnB cover picture</p>
      <p className="text-xs text-gray-400">
        Writes your selling points onto the room's first photo. Download it, then upload it to
        the listing on AirBnB — this app cannot post there for you.
      </p>

      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={lines[0] ?? ""}
          onChange={(e) => setLine(0, e.target.value)}
          maxLength={34}
          placeholder="Stay with Engineers"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <input
          type="text"
          value={lines[1] ?? ""}
          onChange={(e) => setLine(1, e.target.value)}
          maxLength={40}
          placeholder="Smart toilet · Private bathroom"
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        />
      </div>

      {/* The picture as it will be, not a description of it. */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-lg border border-gray-200 bg-gray-100"
      />

      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

      <button
        type="button"
        onClick={download}
        disabled={!ready}
        className="self-start rounded bg-gray-900 px-3 py-1.5 text-xs font-bold text-white disabled:bg-gray-300"
      >
        Download cover picture
      </button>
    </div>
  );
};

export default CoverImageMaker;
