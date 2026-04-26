import { fetchHost } from "../../../util/hostOperations";
import { fetchRooms } from "../../../util/roomOperations";
import host from "../../../util/types/TiBook/host.type";
import { hostType } from "../../../util/types/hostType";
import { useState } from "react";
import { roomType } from "../../../util/types/roomType";
import { dayType } from "../../../util/types/dayType";
import { fetchDays } from "../../../util/dayOperations";

interface HostFilterProps {
  hosts: host[];
  setCurrentHost: React.Dispatch<React.SetStateAction<hostType | null>>;
  setDays: React.Dispatch<React.SetStateAction<dayType[]>>;
  setRooms: React.Dispatch<React.SetStateAction<roomType[]>>;
}

const HostFilter = ({
  hosts,
  setCurrentHost,
  setDays,
  setRooms,
}: HostFilterProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectHost = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    console.log("handleSelectHost");
    const token = localStorage.getItem("tiBookToken") ?? null;
    if (!token) return;

    setIsLoading(true);

    try {
      const hostId = e.target.value;
      const host = await fetchHost(hostId, token as string);
      const rooms = await fetchRooms(hostId, token as string);
      const days = await fetchDays(host?.calendar as string, token as string);
      setCurrentHost(host ? { ...host, id: hostId } : null);
      setRooms(rooms);
      setDays(days);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <select
      className="border border-gray-300 rounded px-2 py-1 text-sm"
      disabled={isLoading}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
        handleSelectHost(e)
      }
    >
      {hosts.map((host) => (
        <>
          <option key={host.id} value={host.id}>
            {host.name}
          </option>
        </>
      ))}
    </select>
  );
};

export default HostFilter;
