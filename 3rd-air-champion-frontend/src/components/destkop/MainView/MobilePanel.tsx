interface MobilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobilePanel = ({ isOpen, onClose, children }: MobilePanelProps) => (
  <div
    className={`fixed bottom-0 left-0 w-full max-h-[85vh] bg-white border-t border-gray-300 z-50 flex flex-col sm:hidden transition-transform duration-300 ${
      isOpen ? "translate-y-0" : "translate-y-full"
    }`}
  >
    <div className="flex justify-center flex-shrink-0 py-1">
      <button
        className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
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

export default MobilePanel;