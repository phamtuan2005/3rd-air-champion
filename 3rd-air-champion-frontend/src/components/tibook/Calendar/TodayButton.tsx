interface TodayButtonProps {
  isCurrentMonth: boolean;
  onScrollToToday?: () => void;
}

const TodayButton = ({ isCurrentMonth, onScrollToToday }: TodayButtonProps) => {
  return (
    <button
      onClick={() => onScrollToToday?.()}
      disabled={isCurrentMonth}
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
        isCurrentMonth
          ? "text-gray-300 border-gray-200 cursor-default"
          : "text-blue-500 border-blue-300 hover:bg-blue-50 cursor-pointer"
      }`}
    >
      Today
    </button>
  );
};

export default TodayButton;
