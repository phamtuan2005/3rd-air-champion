import { useState } from "react";
import { hostType } from "../../util/types/hostType";

interface HostProfileBannerProps {
  host: hostType;
}

const HostProfileBanner = ({ host }: HostProfileBannerProps) => {
  const [photoError, setPhotoError] = useState(false);

  const displayName = host.airbnbName || host.name;
  const initials = host.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100">
      {/* Photo */}
      <div className="relative flex-shrink-0">
        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-green-500 overflow-hidden bg-green-100 flex items-center justify-center">
          {!photoError ? (
            <img
              src={`/${host.name}.jpg`}
              alt={host.name}
              className="h-full w-full object-cover"
              onError={() => setPhotoError(true)}
            />
          ) : (
            <span className="text-green-700 font-bold text-lg">{initials}</span>
          )}
        </div>
        {/* Online indicator */}
        <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-white" />
      </div>

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">
          {displayName}
        </span>
        {host.airbnbAddress && (
          <span className="text-gray-400 text-xs truncate flex items-center gap-1 mt-0.5">
            <svg
              className="w-3 h-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            {host.airbnbAddress}
          </span>
        )}
      </div>

      {/* Verified badge */}
      <div className="ml-auto flex-shrink-0">
        <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
          Verified Host
        </span>
      </div>
    </div>
  );
};

export default HostProfileBanner;