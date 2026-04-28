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
    <div className="bg-white border-b border-gray-100 px-4 py-2 flex flex-col gap-1.5">
      {/* Property name + highlights */}
      <div className="flex flex-col gap-1">
        {displayName && (
          <span className="font-bold text-gray-900 text-sm leading-tight">{displayName}</span>
        )}
        {host.highlights && host.highlights.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {host.highlights.map((h) => (
              <span
                key={h}
                className="flex-shrink-0 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Host info row */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-1.5">
        <div className="relative flex-shrink-0">
          <div className="h-8 w-8 rounded-full border-2 border-green-500 overflow-hidden bg-green-100 flex items-center justify-center">
            {!photoError ? (
              <img
                src={`/${host.name}.jpg`}
                alt={host.name}
                className="h-full w-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <span className="text-green-700 font-bold text-xs">{initials}</span>
            )}
          </div>
          <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white" />
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-xs text-gray-600 flex-shrink-0">Hosted by</span>
          <span className="text-xs font-semibold text-gray-800 truncate">{host.name}</span>
          {host.airbnbSuperhost && (
            <span className="flex-shrink-0 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
              Superhost
            </span>
          )}
          {host.airbnbRating != null && (
            <span className="flex items-center gap-0.5 text-xs text-gray-500 flex-shrink-0">
              <svg className="w-3 h-3 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
              </svg>
              <span className="font-semibold text-gray-700">{host.airbnbRating.toFixed(2)}</span>
              {host.airbnbReviewCount != null && (
                <span className="text-gray-400">({host.airbnbReviewCount})</span>
              )}
            </span>
          )}
        </div>

        <span className="flex-shrink-0 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
          Verified
        </span>
      </div>
    </div>
  );
};

export default HostProfileBanner;