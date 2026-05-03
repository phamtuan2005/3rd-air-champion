import { useState } from "react";
import { hostType } from "../../util/types/hostType";

interface HostProfileBannerProps {
  host: hostType;
  cohostNames?: string[];
}

const HostAvatar = ({ name }: { name: string }) => {
  const [photoError, setPhotoError] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <div className="relative">
        <div className="h-9 w-9 rounded-full border-2 border-green-500 overflow-hidden bg-green-100 flex items-center justify-center">
          {!photoError ? (
            <img
              src={`/${name}.jpg`}
              alt={name}
              className="h-full w-full object-cover"
              onError={() => setPhotoError(true)}
            />
          ) : (
            <span className="text-green-700 font-bold text-xs">{initials}</span>
          )}
        </div>
        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 rounded-full border-2 border-white" />
      </div>
      <span className="text-[10px] font-semibold text-gray-800">{name}</span>
      <span className="text-[9px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full -mt-0.5">Verified</span>
    </div>
  );
};

const HostProfileBanner = ({ host, cohostNames = [] }: HostProfileBannerProps) => {
  const displayName = host.airbnbName || host.name;

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-2 flex flex-col gap-1.5">
      {/* Property name + highlights */}
      <div className="flex flex-col gap-1">
        {displayName && (
          <span className="font-bold text-gray-900 text-sm leading-tight">{displayName}</span>
        )}
        {host.highlights && host.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {host.highlights.map((h) => (
              <span
                key={h}
                className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Host info row */}
      <div className="flex items-start gap-3 border-t border-gray-100 pt-1.5">
        {/* Avatars */}
        <div className="flex items-end gap-2">
          <HostAvatar name={host.name} />
          {cohostNames.map((name) => (
            <HostAvatar key={name} name={name} />
          ))}
        </div>

        {/* Badges + rating */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {host.airbnbSuperhost ? (
            <span className="w-fit text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
              {cohostNames.length > 0 ? "Superhosts" : "Superhost"}
            </span>
          ) : (
            <span className="w-fit text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
              Verified
            </span>
          )}
          <div className="flex flex-col gap-0 mt-0.5 pl-0.5 border-l-2 border-indigo-300">
            <span className="text-[10px] text-indigo-600 font-semibold italic leading-tight tracking-wide">
              Your Comfort. Our Mission.
            </span>
            <span className="text-[9px] text-gray-400 leading-tight">
              Sự Thoải Mái Của Bạn. Sứ Mệnh Của Chúng Tôi.
            </span>
            <span className="text-[9px] text-gray-400 leading-tight">
              您的舒适，我们的使命。
            </span>
          </div>
          {host.airbnbRating != null && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const fill = Math.min(1, Math.max(0, host.airbnbRating! - (star - 1)));
                  const pct = Math.round(fill * 100);
                  const gradId = `sg-${star}`;
                  return (
                    <svg key={star} className="w-3.5 h-3.5" viewBox="0 0 20 20">
                      <defs>
                        <linearGradient id={gradId}>
                          <stop offset={`${pct}%`} stopColor="#FBBF24" />
                          <stop offset={`${pct}%`} stopColor="#D1D5DB" />
                        </linearGradient>
                      </defs>
                      <path
                        fill={`url(#${gradId})`}
                        d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z"
                      />
                    </svg>
                  );
                })}
              </span>
              {host.airbnbReviewCount != null && (
                host.airbnbReviewsUrl ? (
                  <a
                    href={host.airbnbReviewsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 underline underline-offset-2 hover:text-gray-700 transition-colors"
                  >
                    {host.airbnbReviewCount} reviews
                  </a>
                ) : (
                  <span className="text-gray-500">{host.airbnbReviewCount} reviews</span>
                )
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostProfileBanner;