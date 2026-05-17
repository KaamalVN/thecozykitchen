"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Recipe, HomeSettings } from "@/lib/recipes";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import RecipeCard from "@/components/recipe/RecipeCard";
import SearchOverlay from "@/components/ui/SearchOverlay";

interface CozyKitchenHomeProps {
  initialRecipes: Recipe[];
  homeSettings?: HomeSettings;
}

export default function CozyKitchenHome({ initialRecipes, homeSettings }: CozyKitchenHomeProps) {
  const [recipes] = useState<Recipe[]>(initialRecipes);
  const [activeCategory, setActiveCategory] = useState("All");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [recentViewed, setRecentViewed] = useState<Recipe[]>([]);
  const [mounted, setMounted] = useState(false);

  // Load preferences Safely in Client
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

    // Recently viewed loading
    const savedRecent = localStorage.getItem("recentlyViewed");
    if (savedRecent) {
      try {
        const slugs: string[] = JSON.parse(savedRecent);
        const recentRecipes = slugs
          .map((slug) => initialRecipes.find((r) => r.slug === slug))
          .filter((r): r is Recipe => !!r);
        setRecentViewed(recentRecipes);
      } catch (e) {
        console.error("Failed to parse recently viewed", e);
      }
    }
  }, [initialRecipes]);

  // Keyboard shortcut listener: '/' focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  // Curate 3 high-quality featured showcase recipes
  const featuredRecipes = (() => {
    if (homeSettings?.showcaseSlugs && homeSettings.showcaseSlugs.length > 0) {
      const selected = homeSettings.showcaseSlugs
        .map((slug) => recipes.find((r) => r.slug === slug))
        .filter((r): r is Recipe => !!r);
      if (selected.length > 0) return selected;
    }
    // If not chosen, randomize everyday using stable date hash
    if (recipes.length <= 3) return recipes;
    const day = new Date().getDate(); // 1-31
    const selected: Recipe[] = [];
    for (let i = 0; i < 3; i++) {
      const index = (day + i) % recipes.length;
      const rec = recipes[index];
      if (rec && !selected.includes(rec)) {
        selected.push(rec);
      }
    }
    return selected.length > 0 ? selected : recipes.slice(0, 3);
  })();

  // Today's Pick rotates daily, or uses custom admin pick if chosen
  const todayPick = (() => {
    if (recipes.length === 0) return null;
    if (homeSettings?.todaysPickSlug) {
      const selected = recipes.find((r) => r.slug === homeSettings.todaysPickSlug);
      if (selected) return selected;
    }
    // Fallback: Daily rotation based on day of month
    const day = new Date().getDate();
    const todayIndex = day % recipes.length;
    return recipes[todayIndex];
  })();

  const handleOpenSearchOverlay = (category: string = "All") => {
    setActiveCategory(category);
    setIsSearchOpen(true);
  };

  return (
    <>
      {/* Search & Browse Overlay (Encapsulates all interactive filtering and grid display) */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        recipes={recipes}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />

      {/* Sticky Navigation */}
      <Navbar
        activeCategory={activeCategory}
        onSelectCategory={handleOpenSearchOverlay}
        onOpenSearch={() => handleOpenSearchOverlay("All")}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Main Home Layout */}
      <main className="pt-[110px] pb-section-gap px-margin-page max-w-7xl mx-auto flex flex-col gap-section-gap flex-1 w-full">
        
        {/* Hero Section */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-gutter-grid items-center mt-4">
          <div className="md:col-span-5 md:col-start-1 flex flex-col gap-stack-lg z-10 select-none">
            <h1 className="font-hero-display text-hero-display italic text-on-background dark:text-surface-bright leading-tight max-w-[12ch]">
              Recipes from a real kitchen.
            </h1>
            <p className="font-body-lg text-body-lg text-brown-muted dark:text-outline-variant max-w-[40ch]">
              No fuss, just good food. A collection of warm, hearty meals documented as they were cooked, with all the lovely imperfections.
            </p>
            <div>
              <button
                onClick={() => handleOpenSearchOverlay("All")}
                className="inline-flex items-center justify-center px-8 py-4 bg-secondary dark:bg-on-secondary-fixed-variant text-on-secondary dark:text-secondary-fixed rounded-full font-body-md text-body-md font-semibold hover:bg-secondary/90 dark:hover:bg-on-secondary-fixed-variant/90 transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg cursor-pointer"
              >
                Start Cooking
              </button>
            </div>
          </div>
          <div className="md:col-span-6 md:col-start-7 mt-stack-lg md:mt-0 relative select-none">
            <div className="absolute -inset-4 bg-surface-container-low dark:bg-dark-surface/40 rounded-xl transform -rotate-2 z-0"></div>
            <div className="relative z-10 p-2 bg-surface-bright dark:bg-dark-surface border border-transparent dark:border-brown-muted/10 rounded-lg warm-shadow transform rotate-1 transition-transform hover:rotate-0 duration-500">
              <Image
                alt="Featured Dish"
                width={800}
                height={600}
                priority
                className="w-full aspect-[4/3] object-cover rounded-lg"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxeWqADLqkBfDbJgW1ulKrdSr8HLY3esiGjBmKj9WDd1FmJ-H8I-WDoUwIVmk5Ds2gr6FFBtiCDJI6pQ_h8zqGLz5_MYj3lE1FcGBOXX_3ZfIaHOUtE7Ruj8xvCN9CtPBVsl3HZJIKGS_Q_MJ0Y-6I1QQWlFEW1Mjo2wmKkKpawccgfay5EmiGM4Hys1_kv328kjUmiT_wpx78ndLmWOgnSAnc734H1eYsNJR6SwqaDxW9r6Mev5Z5M_ptHTMuXuup4dsfg-1-mSHT"
              />
            </div>
          </div>
        </section>

        {/* Today's Pick Strip */}
        {todayPick && (
          <Link
            href={`/recipes/${todayPick.slug}`}
            className="group bg-surface-soft dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-stack-md warm-shadow hover:border-secondary/40 dark:hover:border-secondary-fixed/40 transition-all select-none cursor-pointer duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 relative rounded-lg overflow-hidden flex-shrink-0 border border-sand-border/30 dark:border-brown-muted/20">
                <Image
                  src={todayPick.coverImage}
                  alt={todayPick.title}
                  fill
                  sizes="48px"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="material-symbols-outlined text-secondary dark:text-secondary-fixed text-sm font-fill-1"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    stars
                  </span>
                  <span className="font-label-caps text-[10px] text-brown-muted dark:text-outline uppercase tracking-wider font-semibold">
                    Today's Pick
                  </span>
                </div>
                <h3 className="font-headline-sm text-headline-sm italic text-on-surface dark:text-surface-bright group-hover:text-secondary dark:group-hover:text-secondary-fixed transition-colors font-semibold leading-tight">
                  {todayPick.title}
                </h3>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-secondary dark:text-secondary-fixed font-semibold font-body-sm hover:text-primary dark:hover:text-primary-fixed transition-colors">
              <span>Cook this today</span>
              <span className="material-symbols-outlined text-sm translate-x-0 group-hover:translate-x-1 transition-transform duration-200">
                arrow_forward
              </span>
            </div>
          </Link>
        )}

        {/* Curated Showcase Grid */}
        <section id="recipes" className="flex flex-col gap-8 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-4 select-none">
            <h2 className="font-headline-lg text-headline-lg italic text-on-background dark:text-surface-bright mb-3">
              Featured from the Hearth
            </h2>
            <p className="font-body-md text-body-md text-brown-muted dark:text-outline-variant">
              A handful of my absolute favorite, hand-binder recipes currently warming our kitchen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-grid items-start w-full">
            {featuredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.slug}
                recipe={recipe}
                isBookmarked={bookmarks.includes(recipe.slug)}
                onToggleBookmark={handleToggleBookmark}
              />
            ))}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={() => handleOpenSearchOverlay("All")}
              className="px-8 py-3.5 bg-secondary dark:bg-on-secondary-fixed-variant text-white dark:text-secondary-fixed rounded-full font-bold font-body-md hover:scale-105 active:scale-95 transition-all shadow-md hover:shadow-lg cursor-pointer inline-flex items-center gap-2.5 group"
            >
              <span className="material-symbols-outlined text-xl">search</span>
              <span>Browse the Full Binder</span>
              <span className="material-symbols-outlined text-xl group-hover:translate-x-1.5 transition-transform">
                arrow_forward
              </span>
            </button>
          </div>
        </section>

        {/* Recently Viewed Recipes Scroll Strip */}
        {recentViewed.length > 0 && (
          <section className="flex flex-col gap-6 select-none border-t border-sand-border/60 dark:border-brown-muted/15 pt-section-gap">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-lg text-headline-lg italic text-on-background dark:text-surface-bright leading-tight font-semibold">
                Recently Viewed Recipes
              </h2>
              <p className="font-body-md text-body-md text-brown-muted dark:text-outline-variant">
                Continue cooking right where you left off.
              </p>
            </div>
            
            <div className="flex gap-stack-lg overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-sand scrollbar-track-transparent -mx-margin-page px-margin-page">
              {recentViewed.map((recipe) => (
                <Link
                  key={recipe.slug}
                  href={`/recipes/${recipe.slug}`}
                  className="flex-shrink-0 w-64 bg-surface-bright dark:bg-dark-surface border border-sand-border/30 dark:border-brown-muted/10 rounded-xl p-3 warm-shadow hover:scale-[1.02] transition-all cursor-pointer group flex flex-col gap-3"
                >
                  <div className="w-full aspect-[4/3] relative rounded-lg overflow-hidden bg-surface-dim/20">
                    <Image
                      src={recipe.coverImage}
                      alt={recipe.title}
                      fill
                      sizes="256px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="self-start px-2 py-0.5 bg-terracotta-light dark:bg-on-secondary-fixed-variant text-[10px] text-secondary dark:text-secondary-fixed rounded-full font-label-caps tracking-wide font-medium">
                      {recipe.categories[0]}
                    </span>
                    <h3 className="font-headline-sm text-headline-sm italic text-on-surface dark:text-surface-bright group-hover:text-secondary dark:group-hover:text-secondary-fixed transition-colors font-semibold leading-tight line-clamp-1 font-fraunces">
                      {recipe.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* About Blurb */}
        <section className="max-w-3xl mx-auto text-center flex flex-col items-center gap-stack-md py-section-gap relative select-none">
          <div className="w-16 h-16 rounded-full bg-surface-dim dark:bg-brown-mid/30 flex items-center justify-center text-primary dark:text-primary-fixed mb-4 transform -rotate-6 shadow-sm border border-sand-border/30 dark:border-brown-muted/10">
            <span
              className="material-symbols-outlined text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              soup_kitchen
            </span>
          </div>
          <h2 className="font-headline-lg text-headline-lg italic text-on-background dark:text-surface-bright">
            Made with love, and slightly messy counters.
          </h2>
          <p className="font-body-md text-body-md text-brown-muted dark:text-outline-variant max-w-[50ch]">
            Welcome to my digital recipe binder. No ten-page stories before the ingredients, just the honest-to-goodness steps to make food that makes you feel good. Grab an apron.
          </p>
        </section>
      </main>

      {/* Footer */}
      <Footer onSelectCategory={handleOpenSearchOverlay} />
    </>
  );
}
