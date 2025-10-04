import React from "react";
import Search from "./Search";

const Header: React.FC = () => {
  return (
    <header className="fixed top-0 inset-x-0 h-14 bg-white border-b border-neutral-200 flex items-center px-4 gap-3 z-50">
      {/* Left: hamburger + logo */}
      <button
        aria-label="Menu"
        className="size-10 rounded-full hover:bg-neutral-100 flex items-center justify-center"
      >
        <div className="space-y-1.5">
          <div className="w-5 h-[2px] bg-neutral-800" />
          <div className="w-5 h-[2px] bg-neutral-800" />
          <div className="w-5 h-[2px] bg-neutral-800" />
        </div>
      </button>

      <div className="flex items-center gap-2">
        <div className="w-7 h-5 bg-red-600 rounded-[3px]" />
        <span className="text-lg font-semibold tracking-tight">Vidshelf</span>
      </div>

      {/* Center: search */}
      <Search />

      {/* Right: simple icons */}
      <div className="flex items-center gap-8">
        <button className="size-10 rounded-full hover:bg-neutral-100">Upload</button>
        <div className="size-8 rounded-full bg-neutral-300" />
      </div>
    </header>
  );
};

export default Header;
