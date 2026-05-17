"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Recipe } from "@/lib/recipes";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import RecipeCard from "@/components/recipe/RecipeCard";
import SearchOverlay from "@/components/ui/SearchOverlay";

interface SavedRecipesClientProps {
  allRecipes: Recipe[];
}

export default function SavedRecipesClient({ allRecipes }: SavedRecipesClientProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load bookmarks safely on mount
  useEffect(() => {
    setMounted(true);

    // Theme loading
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = savedTheme === "dark" || (!savedTheme && systemPrefersDark);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Bookmarks loading
    const savedBookmarks = localStorage.getItem("bookmarks");
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks));
      } catch (e) {
        console.error("Failed to parse bookmarks", e);
      }
    }
  }, []);

  const handleToggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleToggleBookmark = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let updated: string[];
    if (bookmarks.includes(slug)) {
      updated = bookmarks.filter((s) => s !== slug);
    } else {
      updated = [...bookmarks, slug];
    }
    setBookmarks(updated);
    localStorage.setItem("bookmarks", JSON.stringify(updated));
  };

  const handleOpenSearchOverlay = (category: string = "All") => {
    setActiveCategory(category);
    setIsSearchOpen(true);
  };

  // Filter bookmarked recipes
  const savedRecipes = allRecipes.filter((r) => bookmarks.includes(r.slug));

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background-cream dark:bg-dark-bg transition-colors duration-300" />
    );
  }

  return (
    <div className="min-h-screen bg-background-cream dark:bg-dark-bg text-on-background dark:text-surface-bright flex flex-col transition-colors duration-300 relative">
      {/* Noise grain overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-repeat" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }} />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        recipes={allRecipes}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      <Navbar
        activeCategory={activeCategory}
        onSelectCategory={handleOpenSearchOverlay}
        onOpenSearch={() => handleOpenSearchOverlay("All")}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      <main className="pt-28 pb-section-gap px-margin-page max-w-7xl mx-auto flex flex-col gap-8 flex-1 w-full relative z-10">
        
        {/* Header section */}
        <div className="flex flex-col gap-2 select-none">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-brown-muted dark:text-outline hover:text-secondary dark:hover:text-secondary-fixed transition-colors font-body-sm text-body-sm font-semibold self-start"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Back to Homepage</span>
          </Link>
          
          <h1 className="font-hero-display text-hero-display italic text-primary dark:text-primary-fixed-dim leading-tight">
            Your Saved Recipes
          </h1>
          <p className="font-body-md text-body-md text-brown-muted dark:text-outline-variant max-w-[55ch]">
            Your hand-curated recipe binder. Tap the hearts on recipes across the kitchen to save them here for quick access.
          </p>
        </div>

        {/* Recipes Grid or Empty State */}
        {savedRecipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-grid items-start w-full mt-4">
            {savedRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.slug}
                recipe={recipe}
                isBookmarked={true}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface-bright dark:bg-dark-surface border border-sand-border/40 dark:border-brown-muted/10 rounded-2xl warm-shadow max-w-md w-full mx-auto my-12 select-none">
            <div className="w-16 h-16 rounded-full bg-surface-soft dark:bg-brown-mid/30 flex items-center justify-center text-secondary dark:text-secondary-fixed mb-6 border border-sand-border/30 transform -rotate-6">
              <span className="material-symbols-outlined text-3xl">favorite</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-surface-bright italic mb-2">
              Your binder is empty
            </h2>
            <p className="font-body-sm text-body-sm text-brown-muted dark:text-outline-variant mb-6 max-w-[28ch] leading-relaxed">
              Explore the hearth and save dishes here with a heart tap to prepare them later.
            </p>
            <button
              onClick={() => handleOpenSearchOverlay("All")}
              className="px-6 py-3 bg-secondary dark:bg-on-secondary-fixed-variant text-white dark:text-secondary-fixed font-bold font-body-sm text-body-sm rounded-full hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              Browse Recipe Binder
            </button>
          </div>
        )}
      </main>

      <Footer onSelectCategory={handleOpenSearchOverlay} />
    </div>
  );
}
