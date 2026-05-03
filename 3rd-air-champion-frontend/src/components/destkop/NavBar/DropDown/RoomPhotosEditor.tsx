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
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}

const SortablePhoto = ({
  url,
  index,
  backendEndpoint,
  onRemove,
  selectMode,
  isSelected,
  onToggleSelect,
}: SortablePhotoProps) => {
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
      onClick={selectMode ? onToggleSelect : undefined}
      className={`relative aspect-square rounded-lg overflow-hidden border bg-gray-100 group transition-all ${
        selectMode
          ? isSelected
            ? "border-blue-500 border-2 cursor-pointer"
            : "border-gray-200 border-2 cursor-pointer"
          : "border-gray-200"
      }`}
    >
      {!selectMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
        />
      )}

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

      {index === 0 && !selectMode && (
        <span className="absolute top-1 left-1 bg-black bg-opacity-60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none z-20">
          Cover
        </span>
      )}

      {selectMode ? (
        <div
          className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center z-20 pointer-events-none ${
            isSelected ? "bg-blue-500 border-blue-500" : "bg-white bg-opacity-80 border-gray-400"
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-opacity-80 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}

      {selectMode && isSelected && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-15 pointer-events-none z-10" />
      )}
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
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

  const toggleSelect = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedUrls(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedUrls(new Set());
  };

  const deleteSelected = () => {
    onChange(photos.filter((url) => !selectedUrls.has(url)));
    exitSelectMode();
  };

  const selectAll = () => {
    setSelectedUrls(new Set(photos));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Room Photos</p>
        {photos.length > 0 && !selectMode && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {photos.length} photo{photos.length > 1 ? "s" : ""} · drag to reorder
            </span>
            <button
              type="button"
              onClick={enterSelectMode}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              Select
            </button>
          </div>
        )}
        {selectMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectedUrls.size === photos.length ? exitSelectMode : selectAll}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {selectedUrls.size === photos.length ? "Deselect all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={exitSelectMode}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
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
                  selectMode={selectMode}
                  isSelected={selectedUrls.has(url)}
                  onToggleSelect={() => toggleSelect(url)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-xs text-gray-400">No photos added yet.</p>
      )}

      {selectMode && (
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedUrls.size === 0}
          className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300"
        >
          {selectedUrls.size === 0
            ? "Tap photos to select"
            : `Delete ${selectedUrls.size} photo${selectedUrls.size > 1 ? "s" : ""}`}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {!selectMode && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "+ Add Photos"}
        </button>
      )}

      {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}
    </div>
  );
};

export default RoomPhotosEditor;