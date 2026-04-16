import { createPortal } from "react-dom";
import { MdOutlineMessage } from "react-icons/md";
import { FaCalendarCheck } from "react-icons/fa";

interface TemplatePickerModalProps {
  onClose: () => void;
  onOpenReminderTemplate: () => void;
  onOpenBookingTemplate: () => void;
}

const TemplatePickerModal = ({
  onClose,
  onOpenReminderTemplate,
  onOpenBookingTemplate,
}: TemplatePickerModalProps) => {
  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-64 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold text-base">Template</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex flex-col">
          <button
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-left"
            onClick={() => { onClose(); onOpenReminderTemplate(); }}
          >
            <MdOutlineMessage className="text-lg shrink-0" />
            <span className="text-sm">Reminder Template</span>
          </button>
          <button
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 text-left border-t"
            onClick={() => { onClose(); onOpenBookingTemplate(); }}
          >
            <FaCalendarCheck className="text-lg shrink-0" />
            <span className="text-sm">Booking Template</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TemplatePickerModal;