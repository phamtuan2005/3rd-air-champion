import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uploadRoomPhoto } from "../../../../util/roomOperations";

interface SortablePhotoProps {
  url: string;
  index: number;
  backendEndpoint: string;
  onRemove: () => void;
}

const SortablePhoto = ({ url, index, backendEndpoint, onRemove }: SortablePhotoProps) => {
  const [imgError, setImgError] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const resolvedUrl = url.startsWith("/") ? `${backendEndpoint}${url}` : url;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
      />

      {imgError ? (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 px-1 text-center break-all">
          {url}
        </div>
      ) : (
        <img
          src={resolvedUrl}
          alt={`photo-${index}`}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          draggable={false}
        />
      )}

      {index === 0 && (
        <span className="absolute top-1 left-1 bg-black bg-opacity-60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none z-20">
          Cover
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-opacity-80 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
};

interface RoomPhotosEditorProps {
  photos: string[];
  roomName: string;
  token: string;
  onChange: (photos: string[]) => void;
}

const RoomPhotosEditor = ({ photos, roomName, token, onChange }: RoomPhotosEditorProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backendEndpoint = import.meta.env.VITE_BACKEND_ENDPOINT || "";

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = photos.indexOf(active.id as string);
      const newIndex = photos.indexOf(over.id as string);
      onChange(arrayMove(photos, oldIndex, newIndex));
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError("");
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadRoomPhoto(file, roomName, token);
        uploaded.push(url);
      }
      onChange([...photos, ...uploaded]);
    } catch (err) {
      setUploadError(typeof err === "string" ? err : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Room Photos</p>
        {photos.length > 0 && (
          <span className="text-xs text-gray-400">
            {photos.length} photo{photos.length > 1 ? "s" : ""} · drag to reorder
          </span>
        )}
      </div>

      {photos.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <SortablePhoto
                  key={url}
                  url={url}
                  index={i}
                  backendEndpoint={backendEndpoint}
                  onRemove={() => onChange(photos.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-xs text-gray-400">No photos added yet.</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "+ Add Photos"}
      </button>

      {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}
    </div>
  );
};

export default RoomPhotosEditor;