import { generateAvatar } from "../../util/avatarGen";

// The identity-color ramp for the initials fallback — one calm tint per team
// member. Shared so every view (Cleaners modal, ToDo) draws from the same set.
export const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// The owner photos already shipped in the app — used automatically for these
// two, so they need no setup.
export const builtInPhoto = (name: string) => {
  const n = name.trim().toLowerCase();
  if (n.startsWith("anh-tuan") || n.startsWith("anh tuan") || n === "tuan") return "Anh-Tuan.jpg";
  if (n.startsWith("cindy")) return "Cindy.jpg";
  return "";
};

// Stable fallback color from the name, so a member without an explicit
// positional color still looks the same everywhere they appear.
const colorFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

interface CleanerAvatarProps {
  name: string;
  photo?: string; // explicit image (owner jpg / data URL) — wins over everything
  character?: string; // note the illustrated avatar is generated from
  colorClass?: string; // initials-fallback tint (defaults to a stable per-name color)
  sizeClass?: string;
  textClass?: string;
}

// One avatar for a team member everywhere: an explicit photo (owner jpg) wins,
// else the illustrated avatar generated from their "character" note, else the
// colored initials fallback.
const CleanerAvatar = ({
  name,
  photo,
  character,
  colorClass,
  sizeClass = "h-8 w-8",
  textClass = "text-xs",
}: CleanerAvatarProps) => {
  const resolved = photo || builtInPhoto(name);
  if (resolved)
    return <img src={resolved} alt={name} className={`${sizeClass} shrink-0 rounded-full object-cover`} />;
  if (character)
    return (
      <img
        src={generateAvatar(name, character)}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-bold ${textClass} ${colorClass ?? colorFor(name)}`}
    >
      {initials(name)}
    </span>
  );
};

export default CleanerAvatar;
