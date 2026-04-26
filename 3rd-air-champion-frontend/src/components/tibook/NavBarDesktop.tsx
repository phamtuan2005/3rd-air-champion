const NavBarDesktop = () => {
  return (
    <nav className="px-1 flex items-center justify-center gap-2 w-full h-[80px] bg-white drop-shadow-md z-50 lg:h-[120px]">
      <img
        className="h-[44px] w-[44px] sm:h-[76px] sm:w-[76px]"
        alt="TT House Logo"
        title="TT House Logo"
        src="./TiMagLogo.svg"
      ></img>
      <h1 className="p-1 sm:p-2 text-base sm:text-xl font-bold tracking-wide text-gray-800">
        TiBook - Book with TT House
      </h1>
    </nav>
  );
};

export default NavBarDesktop;
