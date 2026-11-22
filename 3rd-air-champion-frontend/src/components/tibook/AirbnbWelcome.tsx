import { useEffect, useState } from "react";
import axios from "axios";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { useTiBookLang } from "../../contexts/TiBookLanguageContext";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

// A guest who stayed here through AirBnB, welcomed back as one.
//
// Guests who first found TT House on AirBnB now come back and book on TiBook.
// TiBook knew them only by a TiBook booking, so Irina, who had stayed through
// AirBnB, was greeted as a stranger (host, 2026-11-22). The server matches her
// first name and her phone's last four digits against the AirBnB stays
// (backend util/airbnbHistory) and answers only how many and which rooms.
//
// Shown where a guest has no TiBook stay yet — a guest who has one is already
// greeted by name and by their stays.

const cache = new Map<string, Promise<{ stays: number; rooms: string[] }>>();

export const fetchAirbnbWelcome = (host: string, name: string, phone: string) => {
  const key = `${host}|${name.trim().toLowerCase()}|${phone.replace(/\D/g, "")}`;
  let p = cache.get(key);
  if (!p) {
    p = axios
      .post(`${BACKEND_ENDPOINT}/booking-request/airbnb-welcome`, { host, name, phone })
      .then((r) => ({ stays: Number(r.data?.stays) || 0, rooms: Array.isArray(r.data?.rooms) ? r.data.rooms : [] }))
      .catch(() => {
        cache.delete(key);
        return { stays: 0, rooms: [] };
      });
    cache.set(key, p);
  }
  return p;
};

interface Props {
  hostId: string;
  name: string;
  phone: string;
  className?: string;
}

const AirbnbWelcome = ({ hostId, name, phone, className = "" }: Props) => {
  const { theme } = useTiBookTheme();
  const { t } = useTiBookLang();
  const [found, setFound] = useState<{ stays: number; rooms: string[] } | null>(null);

  useEffect(() => {
    if (!hostId || !name.trim() || !phone.trim()) return;
    let live = true;
    fetchAirbnbWelcome(hostId, name, phone).then((f) => live && setFound(f));
    return () => {
      live = false;
    };
  }, [hostId, name, phone]);

  if (!found || found.stays === 0) return null;
  const first = name.trim().split(/\s+/)[0];
  const rooms = found.rooms.join(" & ");
  return (
    <div className={`tibook-type w-full px-4 py-3 rounded-2xl border text-left ${theme.tagBg} ${theme.tagBorder} ${className}`}>
      <p className={`text-sm font-bold ${theme.textPrimaryDark}`}>{t("Welcome back, {name}!", { name: first })}</p>
      <p className={`mt-1 text-sm leading-relaxed ${theme.surfaceMuted}`}>
        {found.stays > 1
          ? t("You stayed with us {n} times on AirBnB, in {rooms}. Thank you for coming back to book with us directly.", { n: found.stays, rooms })
          : t("You stayed with us on AirBnB, in {rooms}. Thank you for coming back to book with us directly.", { rooms })}
      </p>
    </div>
  );
};

export default AirbnbWelcome;
