import { useContext } from "react";
import { FooterContext } from "../../../context";

const Footer = () => {
  const { isFooterVisible, phone, contactEmail, licenseNumber, airbnbAddress } = useContext(FooterContext)!;

  return (
    isFooterVisible && (
      <footer className="absolute bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-2">
        <p className="text-xs text-left leading-relaxed">
          {licenseNumber && <>TT House &amp; Garden is permitted by Milpitas City for STR. License# {licenseNumber}{(phone || contactEmail || airbnbAddress) ? "  |  " : ""}</>}
          {phone && <>{phone}{(contactEmail || airbnbAddress) ? "  |  " : ""}</>}
          {contactEmail && <>{contactEmail}{airbnbAddress ? "  |  " : ""}</>}
          {airbnbAddress && <>{airbnbAddress.replace("\n", ", ")}</>}
        </p>
      </footer>
    )
  );
};

export default Footer;
