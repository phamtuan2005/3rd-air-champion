import React from "react";
import { FaWindowClose } from "react-icons/fa";
import { MdEmail, MdOutlineSmartphone } from "react-icons/md";

interface AboutProps {
  setIsAboutModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const About = ({ setIsAboutModalOpen }: AboutProps) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="relative bg-white rounded-lg p-6 w-4/5 max-w-md shadow-lg">
        <button
          className="absolute top-4 right-4 hover:text-black text-gray-700 font-bold text-[1.5rem]"
          onClick={() => setIsAboutModalOpen(false)}
        >
          <FaWindowClose />
        </button>
        <h2 className="w-full flex items-center justify-center text-xl font-bold mb-2">
          <img
            className={
              window.screen.availWidth > 640
                ? "h-[76px] w-[76px]"
                : "h-[44px] w-[44px]"
            }
            alt="About"
            title="About"
            src="./TiMagLogo.svg"
          ></img>
          TiMag 1.0{" "}
        </h2>
        <p className="mb-4">
          TiMag 1.0 is designed to manage non AirBnB vs. regular AirBnB bookings
          within a single platform. AirBnB charges both the guest and host a
          high usage fee. That makes it unfair for both endusers. As such, TiMag
          is a system to minimize fees and maximize the staying experience at TT
          house. It provides the following features:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Centralized management for room rentals</li>
          <li>Seamless synchronization with AirBnB calendars</li>
          <li>Monthly statistics for profit optimization</li>
          <li>User-friendly interface for effortless operations</li>
          <li>Action item reminders for better task management</li>
        </ul>
        <p className="mt-4">
          For inquiries, please reach out to Anh-Tri Pham:
          <div className="flex items-center space-x-2">
            <MdEmail />
            <a
              href="mailto:anhtp5@uci.edu"
              className="text-blue-500 underline hover:text-blue-700"
            >
              anhtp5@uci.edu
            </a>
          </div>
          <div className="flex items-center space-x-2">
            <MdOutlineSmartphone />
            <a
              href="tel:+14086096660"
              className="text-blue-500 underline hover:text-blue-700"
            >
              (408) 609-6660
            </a>
          </div>
        </p>
      </div>
    </div>
  );
};

export default About;
