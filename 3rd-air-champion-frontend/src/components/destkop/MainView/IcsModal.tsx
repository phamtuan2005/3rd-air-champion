import { createPortal } from "react-dom";
import { IcsModalState } from "./hooks/useMessaging";

interface IcsModalProps {
  icsModal: IcsModalState | null;
  setIcsModal: React.Dispatch<React.SetStateAction<IcsModalState | null>>;
  airbnbName: string;
}

const IcsModal = ({ icsModal, setIcsModal, airbnbName }: IcsModalProps) => {
  if (!icsModal) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={() => setIcsModal(null)}
    >
      <div
        className="bg-white rounded-lg p-4 w-full max-w-lg shadow-lg flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setIcsModal(null)}
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
          >
            &times;
          </button>
          <h2 className="font-bold text-lg">Calendar Events</h2>
        </div>
        <textarea
          readOnly
          className="border rounded px-2 py-1 text-sm w-full resize-none font-mono"
          rows={14}
          value={icsModal.icsContent}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">File name</label>
          <input
            type="text"
            className="border rounded px-2 py-1 text-sm flex-1"
            value={icsModal.fileName}
            onChange={(e) => setIcsModal({ ...icsModal, fileName: e.target.value })}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setIcsModal(null)}
            className="px-3 py-1 bg-gray-400 text-white text-sm rounded"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              const fileName = icsModal.fileName.endsWith(".ics")
                ? icsModal.fileName
                : `${icsModal.fileName}.ics`;
              const blob = new Blob([icsModal.icsContent], { type: "text/calendar;charset=utf-8" });
              const file = new File([blob], fileName, { type: "text/calendar" });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                  await navigator.share({ files: [file], title: "Calendar Events" });
                } catch {
                  // user cancelled share sheet
                }
              } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
          >
            Save
          </button>
          <button
            onClick={() => {
              const checkin = new Date(icsModal.checkinDate);
              const checkout = new Date(icsModal.checkoutDate);
              const checkinMonth = checkin.toLocaleString("en-US", { month: "long" });
              const checkinYear = checkin.getFullYear();
              const checkoutMonth = checkout.toLocaleString("en-US", { month: "long" });
              const checkoutYear = checkout.getFullYear();
              const periodStr =
                checkinYear === checkoutYear && checkinMonth === checkoutMonth
                  ? `${checkinMonth} ${checkinYear}`
                  : checkinYear === checkoutYear
                    ? `${checkinMonth} to ${checkoutMonth} ${checkinYear}`
                    : `${checkinMonth} ${checkinYear} to ${checkoutMonth} ${checkoutYear}`;
              const body = `Hello ${icsModal.guestDisplayName}, please find attached your calendar events of your booking from ${periodStr}. Please download the file and save to your phone calendar for better reminding of your upcoming stays at ${airbnbName}. Thanks!`;
              window.location.href = `sms:${icsModal.phone}?&body=${encodeURIComponent(body)}`;
            }}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded"
          >
            Send Message
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default IcsModal;