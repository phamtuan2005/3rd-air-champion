import { useContext } from "react";
import { LuMail, LuMapPin, LuPhoneCall } from "react-icons/lu";
import { FooterContext } from "../../../App";

const Footer = () => {
  const footerContext = useContext(FooterContext) as {
    isFooterVisible: boolean;
    setIsFooterVisible: React.Dispatch<React.SetStateAction<boolean>>;
  };

  const { isFooterVisible } = footerContext;

  return (
    isFooterVisible && (
      <footer className="absolute bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-2">
        <div className="container flex flex-col md:flex-row md:justify-between items-center text-xs gap-2">
          <p className="text-center md:text-left">
            TT House & Garden is permitted by Milpitas City for STR. License#
            45542
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <LuPhoneCall className="size-3" />
              <span>(408) 306 2119</span>
            </div>
            <span>|</span>
            <div className="flex items-center gap-1">
              <LuMail className="size-3" />
              <span>phamtuan2005@yahoo.com</span>
            </div>
            <span>|</span>
            <div className="flex items-center gap-1">
              <LuMapPin className="size-3" />
              <span>1682 Blue Spruce Way, Milpitas, CA 95035</span>
            </div>
          </div>
        </div>
      </footer>
    )
  );
};

export default Footer;
