"use client";

import { useEffect, useRef, useState } from "react";
import { Recipe } from "@/lib/recipes";
import RecipeCard from "@/components/recipe/RecipeCard";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  bookmarks: string[];
  onToggleBookmark: (slug: string, e: React.MouseEvent) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
}

export default function SearchOverlay({
  isOpen,
  onClose,
  recipes,
  bookmarks,
  onToggleBookmark,
  activeCategory,
  setActiveCategory,
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [isFridgeSearch, setIsFridgeSearch] = useState(false);
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [under30Mins, setUnder30Mins] = useState(false);
  const [easyOnly, setEasyOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load query and active category from URL on mount/open
  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qParam = params.get("q");
      const catParam = params.get("category");
      if (qParam) setQuery(qParam);
      if (catParam) setActiveCategory(catParam);
    }
  }, [isOpen, setActiveCategory]);

  // Sync state to URL in real-time
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (query.trim()) {
        url.searchParams.set("q", query.trim());
      } else {
        url.searchParams.delete("q");
      }
      if (activeCategory && activeCategory !== "All") {
        url.searchParams.set("category", activeCategory);
      } else {
        url.searchParams.delete("category");
      }
      window.history.pushState({}, "", url.toString());
    }
  }, [query, activeCategory, isOpen]);

  const handleClose = () => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("q");
      url.searchParams.delete("category");
      window.history.pushState({}, "", url.toString());
    }
    onClose();
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body scroll when search is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const availableIngredients = [
    "Chicken",
    "Eggs",
    "Rice",
    "Potatoes",
    "Tomatoes",
    "Coconut Milk",
    "Puff Pastry",
    "Flour"
  ];

  const categories = ["All", "Egg Dishes", "Rice", "Snacks", "Curries", "Breakfast Bites", "Vegetarian", "Bookmarks"];

  // Helper to match nested ingredients from JSON
  const recipeContainsIngredient = (recipe: Recipe, ingredient: string): boolean => {
    const ingLower = ingredient.toLowerCase();
    if (
      recipe.title.toLowerCase().includes(ingLower) ||
      recipe.description.toLowerCase().includes(ingLower) ||
      recipe.tags.some((t) => t.toLowerCase().includes(ingLower))
    ) {
      return true;
    }
    if (recipe.blocks) {
      const ingredientsBlock = recipe.blocks.find((b) => b.type === "ingredients");
      if (ingredientsBlock && ingredientsBlock.sections) {
        return ingredientsBlock.sections.some((sec: any) =>
          sec.items.some((item: any) => item.item.toLowerCase().includes(ingLower))
        );
      }
    }
    return false;
  };

  // Filter recipes
  let filtered = recipes;

  if (activeCategory === "Bookmarks") {
    filtered = recipes.filter((r) => bookmarks.includes(r.slug));
  } else if (activeCategory !== "All") {
    filtered = recipes.filter((r) => r.categories.includes(activeCategory));
  }

  if (query.trim() !== "") {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.categories.some((c) => c.toLowerCase().includes(q))
    );
  }

  if (isFridgeSearch && fridgeIngredients.length > 0) {
    filtered = filtered.filter((r) =>
      fridgeIngredients.some((ing) => recipeContainsIngredient(r, ing))
    );
  }

  if (under30Mins) {
    filtered = filtered.filter((r) => (r.prepTime + r.cookTime) <= 30);
  }

  if (easyOnly) {
    filtered = filtered.filter((r) => r.difficulty.toLowerCase() === "easy");
  }

  const handleToggleFridgeIngredient = (ingredient: string) => {
    if (fridgeIngredients.includes(ingredient)) {
      setFridgeIngredients(fridgeIngredients.filter((i) => i !== ingredient));
    } else {
      setFridgeIngredients([...fridgeIngredients, ingredient]);
    }
  };

  const clearAllFilters = () => {
    setQuery("");
    setActiveCategory("All");
    setIsFridgeSearch(false);
    setFridgeIngredients([]);
    setShowAdvancedFilters(false);
    setUnder30Mins(false);
    setEasyOnly(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background-cream/98 dark:bg-dark-bg/98 backdrop-blur-md flex justify-center p-4 md:p-8 overflow-y-auto transition-all duration-300">
      <div className="w-full max-w-6xl flex flex-col gap-6 relative">
        
        {/* Header Controls */}
        <div className="flex justify-between items-center border-b border-sand-border/30 dark:border-brown-muted/20 pb-4">
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-brown-muted dark:text-outline uppercase tracking-wider font-semibold">
              Browse Cozy Binder
            </span>
            <span className="font-body-sm text-[12px] text-brown-muted dark:text-outline-variant">
              Esc to return home
            </span>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 hover:bg-surface-container-low dark:hover:bg-dark-surface rounded-full flex items-center justify-center text-brown-mid dark:text-surface-variant transition-all duration-300 cursor-pointer"
            aria-label="Close search"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* Category Pill Tabs */}
        <div className="flex flex-wrap gap-2 py-2 border-b border-sand-border/20 dark:border-brown-muted/10">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            let activeStyle = "bg-secondary dark:bg-on-secondary-fixed-variant text-white border-transparent shadow-sm";
            let hoverStyle = "hover:bg-secondary-fixed dark:hover:bg-brown-mid/30";
            let baseBg = "bg-surface-container-low dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 text-on-surface-variant dark:text-surface-variant";

            if (cat === "Vegetarian") {
              activeStyle = "bg-tertiary dark:bg-on-tertiary-fixed-variant text-white border-transparent shadow-sm";
              hoverStyle = "hover:bg-tertiary-fixed dark:hover:bg-on-tertiary-fixed-variant/20";
            }

            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setQuery("");
                }}
                className={`px-4 py-2 rounded-full font-body-sm text-body-sm transition-all duration-200 select-none cursor-pointer ${
                  isActive ? activeStyle : `${baseBg} ${hoverStyle}`
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search Input and Collapsible Buttons Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative w-full md:flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-brown-muted dark:text-outline">
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search recipes, ingredients, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 focus:border-primary dark:focus:border-primary-fixed-dim rounded-xl py-3 pl-14 pr-6 font-body-md text-body-md text-on-surface dark:text-surface-bright placeholder:text-brown-muted dark:placeholder:text-outline outline-none transition-colors shadow-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Fridge Toggle */}
            <button
              onClick={() => setIsFridgeSearch(!isFridgeSearch)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border shadow-sm transition-all duration-300 cursor-pointer select-none text-body-sm font-medium ${
                isFridgeSearch
                  ? "bg-secondary dark:bg-on-secondary-fixed-variant text-white border-transparent"
                  : "border-sand-border dark:border-brown-muted/20 bg-surface-bright dark:bg-dark-surface text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-brown-mid/30"
              }`}
            >
              <span className="material-symbols-outlined text-base">kitchen</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Fridge Search</span>
            </button>

            {/* Filters Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border shadow-sm transition-colors duration-300 cursor-pointer select-none text-body-sm font-medium ${
                showAdvancedFilters || under30Mins || easyOnly
                  ? "bg-primary dark:bg-on-primary-fixed-variant text-white border-transparent"
                  : "border-sand-border dark:border-brown-muted/20 bg-surface-bright dark:bg-dark-surface text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-brown-mid/30"
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span className="font-label-caps text-label-caps uppercase tracking-wider">Filters</span>
            </button>
          </div>
        </div>

        {/* Fridge Shelf */}
        {isFridgeSearch && (
          <div className="p-4 bg-surface-container-low dark:bg-dark-surface border border-sand-border dark:border-brown-muted/15 rounded-xl flex flex-col gap-3 transition-all duration-300">
            <div className="flex justify-between items-center">
              <h4 className="font-label-caps text-label-caps text-brown-mid dark:text-surface-variant uppercase tracking-wider flex items-center gap-2 font-semibold">
                <span className="material-symbols-outlined text-sm text-secondary">kitchen</span>
                What's in your fridge?
              </h4>
              {fridgeIngredients.length > 0 && (
                <button
                  onClick={() => setFridgeIngredients([])}
                  className="text-xs text-secondary dark:text-secondary-fixed hover:underline font-bold"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableIngredients.map((ing) => {
                const isSelected = fridgeIngredients.includes(ing);
                return (
                  <button
                    key={ing}
                    onClick={() => handleToggleFridgeIngredient(ing)}
                    className={`px-4 py-1.5 rounded-full font-body-sm text-body-sm transition-all duration-300 select-none cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-secondary dark:bg-on-secondary-fixed-variant text-white border-transparent shadow-sm"
                        : "border-sand-border dark:border-brown-muted/20 bg-surface-bright dark:bg-dark-bg text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-brown-mid/30"
                    }`}
                  >
                    {isSelected && <span className="material-symbols-outlined text-[14px]">check</span>}
                    {ing}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="p-4 bg-surface-soft dark:bg-dark-surface border border-sand-border dark:border-brown-muted/15 rounded-xl flex flex-wrap gap-6 transition-all duration-300">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={under30Mins}
                onChange={(e) => setUnder30Mins(e.target.checked)}
                className="w-4 h-4 rounded text-secondary dark:text-on-secondary-fixed-variant focus:ring-secondary dark:focus:ring-on-secondary-fixed-variant border-sand-border dark:border-brown-muted/20 cursor-pointer"
              />
              <span className="font-body-sm text-body-sm text-on-surface dark:text-surface-bright font-medium">
                ⚡ Under 30 Mins (Total Time)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={easyOnly}
                onChange={(e) => setEasyOnly(e.target.checked)}
                className="w-4 h-4 rounded text-secondary dark:text-on-secondary-fixed-variant focus:ring-secondary dark:focus:ring-on-secondary-fixed-variant border-sand-border dark:border-brown-muted/20 cursor-pointer"
              />
              <span className="font-body-sm text-body-sm text-on-surface dark:text-surface-bright font-medium">
                🍃 Easy Recipes Only
              </span>
            </label>
          </div>
        )}

        {/* Active Filter Chips */}
        {(query || activeCategory !== "All" || (isFridgeSearch && fridgeIngredients.length > 0) || under30Mins || easyOnly) && (
          <div className="flex flex-wrap items-center gap-2 text-body-sm bg-surface-soft dark:bg-dark-surface border border-sand-border/30 dark:border-brown-muted/10 p-3 rounded-lg transition-all duration-300">
            <span className="text-brown-muted dark:text-outline font-medium">Active Filters:</span>
            
            {activeCategory !== "All" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-terracotta-light dark:bg-on-secondary-fixed-variant/40 text-secondary dark:text-secondary-fixed rounded-full text-xs font-semibold">
                Category: {activeCategory}
                <button
                  onClick={() => setActiveCategory("All")}
                  className="hover:bg-secondary/15 rounded-full p-0.5 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                </button>
              </span>
            )}

            {query && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-terracotta-light dark:bg-on-secondary-fixed-variant/40 text-secondary dark:text-secondary-fixed rounded-full text-xs font-semibold">
                Query: "{query}"
                <button
                  onClick={() => setQuery("")}
                  className="hover:bg-secondary/15 rounded-full p-0.5 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                </button>
              </span>
            )}

            {isFridgeSearch && fridgeIngredients.map((ing) => (
              <span key={ing} className="inline-flex items-center gap-1.5 px-3 py-1 bg-herb-light dark:bg-on-tertiary-fixed-variant/40 text-tertiary dark:text-tertiary-fixed rounded-full text-xs font-semibold">
                Has: {ing}
                <button
                  onClick={() => handleToggleFridgeIngredient(ing)}
                  className="hover:bg-tertiary/15 rounded-full p-0.5 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                </button>
              </span>
            ))}

            {under30Mins && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-herb-light dark:bg-on-tertiary-fixed-variant/40 text-tertiary dark:text-tertiary-fixed rounded-full text-xs font-semibold">
                Under 30 Mins
                <button
                  onClick={() => setUnder30Mins(false)}
                  className="hover:bg-tertiary/15 rounded-full p-0.5 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                </button>
              </span>
            )}

            {easyOnly && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-herb-light dark:bg-on-tertiary-fixed-variant/40 text-tertiary dark:text-tertiary-fixed rounded-full text-xs font-semibold">
                Easy Difficulty
                <button
                  onClick={() => setEasyOnly(false)}
                  className="hover:bg-tertiary/15 rounded-full p-0.5 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                </button>
              </span>
            )}

            <button
              onClick={clearAllFilters}
              className="ml-auto text-xs text-secondary dark:text-secondary-fixed hover:underline font-bold cursor-pointer"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Dynamic Masonry flex columns grid */}
        <div className="flex-1 pb-12 mt-4">
          {filtered.length > 0 ? (
            <div>
              {/* Desktop 3-Column Layout */}
              <div className="hidden lg:flex gap-gutter-grid w-full items-start">
                <div className="flex flex-col gap-gutter-grid flex-1">
                  {filtered
                    .filter((_, idx) => idx % 3 === 0)
                    .map((recipe) => (
                      <RecipeCard
                        key={recipe.slug}
                        recipe={recipe}
                        isBookmarked={bookmarks.includes(recipe.slug)}
                        onToggleBookmark={onToggleBookmark}
                      />
                    ))}
                </div>
                <div className="flex flex-col gap-gutter-grid flex-1">
                  {filtered
                    .filter((_, idx) => idx % 3 === 1)
                    .map((recipe) => (
                      <RecipeCard
                        key={recipe.slug}
                        recipe={recipe}
                        isBookmarked={bookmarks.includes(recipe.slug)}
                        onToggleBookmark={onToggleBookmark}
                      />
                    ))}
                </div>
                <div className="flex flex-col gap-gutter-grid flex-1">
                  {filtered
                    .filter((_, idx) => idx % 3 === 2)
                    .map((recipe) => (
                      <RecipeCard
                        key={recipe.slug}
                        recipe={recipe}
                        isBookmarked={bookmarks.includes(recipe.slug)}
                        onToggleBookmark={onToggleBookmark}
                      />
                    ))}
                </div>
              </div>

              {/* Tablet 2-Column Layout */}
              <div className="hidden md:flex lg:hidden gap-gutter-grid w-full items-start">
                <div className="flex flex-col gap-gutter-grid flex-1">
                  {filtered
                    .filter((_, idx) => idx % 2 === 0)
                    .map((recipe) => (
                      <RecipeCard
                        key={recipe.slug}
                        recipe={recipe}
                        isBookmarked={bookmarks.includes(recipe.slug)}
                        onToggleBookmark={onToggleBookmark}
                      />
                    ))}
                </div>
                <div className="flex flex-col gap-gutter-grid flex-1">
                  {filtered
                    .filter((_, idx) => idx % 2 === 1)
                    .map((recipe) => (
                      <RecipeCard
                        key={recipe.slug}
                        recipe={recipe}
                        isBookmarked={bookmarks.includes(recipe.slug)}
                        onToggleBookmark={onToggleBookmark}
                      />
                    ))}
                </div>
              </div>

              {/* Mobile 1-Column Layout */}
              <div className="flex md:hidden flex-col gap-gutter-grid w-full">
                {filtered.map((recipe) => (
                  <RecipeCard
                    key={recipe.slug}
                    recipe={recipe}
                    isBookmarked={bookmarks.includes(recipe.slug)}
                    onToggleBookmark={onToggleBookmark}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 flex flex-col items-center gap-3 bg-surface-bright dark:bg-dark-surface border border-sand-border/30 dark:border-brown-muted/10 rounded-xl warm-shadow w-full select-none">
              <span className="material-symbols-outlined text-5xl text-brown-muted dark:text-outline animate-bounce">
                soup_kitchen
              </span>
              <p className="font-headline-sm text-headline-sm italic text-on-surface dark:text-surface-bright">
                Hmm, nothing here yet.
              </p>
              <p className="font-body-md text-brown-muted dark:text-outline max-w-[40ch]">
                Try another combination of search terms or check if you have bookmarked any dishes yet!
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-2 px-6 py-2.5 bg-secondary dark:bg-on-secondary-fixed-variant text-white dark:text-secondary-fixed rounded-full font-semibold font-body-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
