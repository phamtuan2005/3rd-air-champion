// Function to dynamically assign colors to rooms
export const getRoomColor = (roomName: string, color?: string) => {
    if (color) return color;

    if (roomName.toLowerCase().includes("master") || roomName.toLowerCase().includes("king")) return "bg-red-500";
    if (roomName.toLowerCase().includes("queen")) return "bg-yellow-500";
    if (roomName.toLowerCase().includes("cozy")) return "bg-blue-500";
    if (roomName.toLowerCase().includes("cute")) return "bg-green-500";

    // Default dynamic colors for other rooms
    const colors = [
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-gray-500",
      "bg-teal-500",
      "bg-orange-500",
    ];

    let hash = 0;
    for (let i = 0; i < roomName.length; i++) {
      hash = roomName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };