"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface NavbarProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  onOpenSearch: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function Navbar({
  activeCategory,
  onSelectCategory,
  onOpenSearch,
  darkMode,
  onToggleDarkMode,
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    handleScroll(); // Call immediately on mount to check initial scroll position
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navCategories = [
    { label: "Egg Dishes", value: "Egg Dishes" },
    { label: "Rice", value: "Rice" },
    { label: "Snacks", value: "Snacks" },
    { label: "Curries", value: "Curries" },
    { label: "All", value: "All" },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-40 transition-all duration-300 border-b ${
        isScrolled
          ? "bg-background-cream/95 dark:bg-dark-bg/95 backdrop-blur-sm border-sand-border/40 dark:border-brown-muted/20 shadow-sm py-4"
          : "bg-transparent border-transparent py-6"
      }`}
    >
      <div className="flex justify-between items-center px-margin-page max-w-7xl mx-auto">
        {/* Logo */}
        <Link
          href="/"
          onClick={() => {
            onSelectCategory("All");
          }}
          className="font-headline-md text-headline-md italic font-semibold text-secondary dark:text-secondary-fixed flex items-center gap-2 group select-none"
        >
          {/* Pot illustration SVG */}
          <svg
            className="w-8 h-8 fill-current transition-transform duration-500 group-hover:rotate-12"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M19 12h-2v-2a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2H5a1 1 0 0 0-1 1v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4a1 1 0 0 0-1-1zm-10-2h6v2H9v-2zm9 7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-3h12v3zm-5-11h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2z" />
          </svg>
          <span className="font-fraunces text-base xs:text-lg sm:text-xl md:text-2xl">The Cozy Kitchen</span>
        </Link>

        {/* Desktop Quick links */}
        <div className="hidden md:flex items-center gap-6">
          {navCategories.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <Link
                key={cat.value}
                href={cat.value === "All" ? "/" : `/?category=${encodeURIComponent(cat.value)}`}
                onClick={() => {
                  onSelectCategory(cat.value);
                  setIsMobileMenuOpen(false);
                }}
                className={`transition-all duration-300 font-body-md text-body-md pb-1 border-b-2 hover:text-primary dark:hover:text-primary-fixed cursor-pointer select-none ${
                  isActive
                    ? "text-secondary dark:text-secondary-fixed font-bold border-secondary dark:border-secondary-fixed"
                    : "text-on-surface-variant dark:text-surface-variant border-transparent"
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-primary dark:text-primary-fixed select-none">
          {/* Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center justify-center w-10 h-10 hover:bg-surface-container-low dark:hover:bg-dark-surface rounded-full transition-all duration-300 active:scale-95 cursor-pointer"
            aria-label="Search recipes"
          >
            <span className="material-symbols-outlined text-2xl">search</span>
          </button>

          {/* Bookmarks Link */}
          <Link
            href="/saved"
            className="flex items-center justify-center w-10 h-10 hover:bg-surface-container-low dark:hover:bg-dark-surface rounded-full transition-all duration-300 active:scale-95 cursor-pointer text-primary dark:text-primary-fixed"
            aria-label="View saved recipes"
          >
            <span className="material-symbols-outlined text-2xl">favorite</span>
          </Link>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="flex items-center justify-center w-10 h-10 hover:bg-surface-container-low dark:hover:bg-dark-surface rounded-full transition-all duration-300 active:scale-95 cursor-pointer"
            aria-label="Toggle dark mode"
          >
            <span className="material-symbols-outlined text-2xl">
              {darkMode ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center w-10 h-10 hover:bg-surface-container-low dark:hover:bg-dark-surface rounded-full transition-all duration-300 active:scale-95 md:hidden cursor-pointer"
            aria-label="Menu"
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background-cream dark:bg-dark-bg border-b border-sand-border/30 dark:border-brown-muted/20 px-margin-page py-6 absolute top-full left-0 w-full flex flex-col gap-4 shadow-lg animate-fade-in">
          {navCategories.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <Link
                key={cat.value}
                href={cat.value === "All" ? "/" : `/?category=${encodeURIComponent(cat.value)}`}
                onClick={() => {
                  onSelectCategory(cat.value);
                  setIsMobileMenuOpen(false);
                }}
                className={`py-2 px-3 rounded-lg font-body-md text-body-md transition-all duration-300 cursor-pointer select-none ${
                  isActive
                    ? "bg-secondary dark:bg-on-secondary-fixed-variant text-white font-bold"
                    : "text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-dark-surface"
                }`}
              >
                {cat.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
