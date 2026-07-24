import React from "react";
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
          &times;
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
          TiMag 2.0{" "}
        </h2>
        <p className="mb-4">
          TiMag began as a way to manage direct and AirBnB bookings in one place
          — sparing both guest and host the heavy platform fees — so every stay
          at TT House feels personal and fairly priced. TiMag 2.0 has grown into
          the complete back office for the home: bookings, guests, the cleaning
          team, and every message in between. Key features:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>One calendar for direct + AirBnB bookings, with live AirBnB sync</li>
          <li>TiBook guest booking site with SMS confirmations & flexible cancellation</li>
          <li>Per-stay pricing, extra fees, and monthly profit statistics</li>
          <li>Cleaning operation: team roster, weekly scheduling, hours & payouts</li>
          <li>One-tap messaging — guest reminders and cleaner schedule / earnings / cleaning rules</li>
          <li>Availability & date-blocking tools with action-item reminders</li>
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
