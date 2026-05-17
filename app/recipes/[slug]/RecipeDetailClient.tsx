"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Recipe } from "@/lib/recipes";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import RecipeCard from "@/components/recipe/RecipeCard";

interface RecipeDetailClientProps {
  recipe: Recipe;
  allRecipes: Recipe[];
}

interface ActiveTimer {
  id: string;
  duration: number; // in seconds
  maxDuration: number; // in seconds
  label: string;
}

export default function RecipeDetailClient({ recipe, allRecipes }: RecipeDetailClientProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [darkMode, setDarkMode] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Scaled servings count
  const [servings, setServings] = useState(recipe.servings);
  
  // Interactive checklist states
  const [checkedIngredients, setCheckedIngredients] = useState<string[]>([]);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  // Cook Mode states
  const [isCookMode, setIsCookMode] = useState(false);
  const [currentCookStep, setCurrentCookStep] = useState(0);
  
  // Built-in Timers states
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  
  // Reading Progress Bar
  const [scrollProgress, setScrollProgress] = useState(0);

  const [shareSuccess, setShareSuccess] = useState(false);
  const [shareTooltip, setShareTooltip] = useState(false);

  // Wake Lock Sentinel
  const wakeLockRef = useRef<any>(null);

  // Initialize state and load preferences
  useEffect(() => {
    setMounted(true);

    // Theme loading
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = savedTheme === "dark" || (!savedTheme && systemPrefersDark);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add("dark");

    // Bookmarks loading
    const savedBookmarks = localStorage.getItem("bookmarks");
    if (savedBookmarks) {
      try { setBookmarks(JSON.parse(savedBookmarks)); } catch (e) {}
    }

    // Servings loading
    const savedServings = localStorage.getItem(`servings-${recipe.slug}`);
    if (savedServings) {
      const parsed = parseInt(savedServings);
      if (!isNaN(parsed) && parsed > 0) setServings(parsed);
    }

    // Ticked Ingredients loading
    const savedIngredients = localStorage.getItem(`ticked-ing-${recipe.slug}`);
    if (savedIngredients) {
      try { setCheckedIngredients(JSON.parse(savedIngredients)); } catch (e) {}
    }

    // Completed steps loading
    const savedSteps = localStorage.getItem(`completed-steps-${recipe.slug}`);
    if (savedSteps) {
      try { setCompletedSteps(JSON.parse(savedSteps)); } catch (e) {}
    }
  }, [recipe.slug]);

  // Sync scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track recently viewed recipe
  useEffect(() => {
    try {
      const stored = localStorage.getItem("recentlyViewed");
      let list: string[] = stored ? JSON.parse(stored) : [];
      list = [recipe.slug, ...list.filter((s) => s !== recipe.slug)].slice(0, 6);
      localStorage.setItem("recentlyViewed", JSON.stringify(list));
    } catch (e) {
      console.error("Failed to update recently viewed recipes:", e);
    }
  }, [recipe.slug]);

  // Scroll Lock when Cook Mode is active
  useEffect(() => {
    if (isCookMode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isCookMode]);

  // Timer Countdown Logic
  useEffect(() => {
    if (activeTimers.length === 0) return;

    const interval = setInterval(() => {
      setActiveTimers((prev) =>
        prev
          .map((t) => {
            const nextDuration = t.duration - 1;
            if (nextDuration <= 0) {
              playTimerChime();
            }
            return { ...t, duration: nextDuration };
          })
          .filter((t) => t.duration >= 0)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers]);

  // Request Wake Lock in Cook Mode
  useEffect(() => {
    async function requestWakeLock() {
      if (isCookMode && "wakeLock" in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        } catch (err) {
          console.warn("Wake Lock failed to acquire:", err);
        }
      }
    }
    
    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
        });
      }
    };
  }, [isCookMode]);

  // Synthesize soft chime audio when a step timer is completed
  const playTimerChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      // Clear chord notes
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.warn("Web Audio Chime synthesize failed:", e);
    }
  };

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

  const handleShare = async () => {
    const shareData = {
      title: recipe.title,
      text: recipe.description,
      url: window.location.href,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.warn("Native share cancelled or failed:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        setShareSuccess(true);
        setShareTooltip(true);
        setTimeout(() => {
          setShareSuccess(false);
          setShareTooltip(false);
        }, 2000);
      } catch (err) {
        alert("Failed to copy link to clipboard.");
      }
    }
  };

  // Scaler
  const updateServings = (val: number) => {
    const nextServings = Math.max(1, servings + val);
    setServings(nextServings);
    localStorage.setItem(`servings-${recipe.slug}`, nextServings.toString());
  };

  const formatQty = (qty: number | null | undefined) => {
    if (qty === null || qty === undefined) return "";
    const scaled = (qty * servings) / recipe.servings;
    if (scaled % 1 === 0) return scaled.toString();
    if (scaled % 0.5 === 0) return scaled.toString();
    return parseFloat(scaled.toFixed(2)).toString();
  };

  // Toggle checklist
  const toggleIngredient = (id: string) => {
    let next: string[];
    if (checkedIngredients.includes(id)) {
      next = checkedIngredients.filter((i) => i !== id);
    } else {
      next = [...checkedIngredients, id];
    }
    setCheckedIngredients(next);
    localStorage.setItem(`ticked-ing-${recipe.slug}`, JSON.stringify(next));
  };

  const toggleStep = (idx: number) => {
    let next: number[];
    if (completedSteps.includes(idx)) {
      next = completedSteps.filter((i) => i !== idx);
    } else {
      next = [...completedSteps, idx];
    }
    setCompletedSteps(next);
    localStorage.setItem(`completed-steps-${recipe.slug}`, JSON.stringify(next));
  };

  // Start Step Timer
  const startTimer = (minutes: number, label: string) => {
    const id = `timer-${Date.now()}`;
    const seconds = minutes * 60;
    setActiveTimers((prev) => [...prev, { id, duration: seconds, maxDuration: seconds, label }]);
  };

  const formatTimerTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Jump to Recipe
  const jumpToRecipe = () => {
    const el = document.getElementById("ingredients-list");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Render Dynamic Blocks
  const renderBlock = (block: any, idx: number) => {
    switch (block.type) {
      case "hero-image":
        return (
          <div key={idx} className="relative aspect-[16/9] md:aspect-[21/9] rounded-xl overflow-hidden warm-shadow mb-8 print:hidden select-none">
            <img
              alt={block.alt || recipe.title}
              src={block.src || recipe.coverImage}
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
        );

      case "intro":
        return (
          <p key={idx} className="font-headline-sm text-headline-sm italic text-brown-mid dark:text-surface-variant leading-relaxed max-w-[65ch] mb-8 font-fraunces select-none">
            {block.text}
          </p>
        );

      case "meta-bar":
        return (
          <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-stack-md bg-surface-soft dark:bg-dark-surface p-stack-md rounded-xl border border-sand-border dark:border-brown-muted/20 mb-8 warm-shadow print:border-black/50 select-none">
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-brown-muted dark:text-outline mb-1">PREP TIME</span>
              <span className="font-body-md text-body-md font-semibold text-on-surface dark:text-surface-bright">{recipe.prepTime}m</span>
            </div>
            <div className="flex flex-col border-l border-sand-border dark:border-brown-muted/20 pl-4">
              <span className="font-label-caps text-label-caps text-brown-muted dark:text-outline mb-1">COOK TIME</span>
              <span className="font-body-md text-body-md font-semibold text-on-surface dark:text-surface-bright">{recipe.cookTime}m</span>
            </div>
            <div className="flex flex-col border-l border-sand-border dark:border-brown-muted/20 pl-4">
              <span className="font-label-caps text-label-caps text-brown-muted dark:text-outline mb-1">SERVINGS</span>
              <span className="font-body-md text-body-md font-semibold text-on-surface dark:text-surface-bright">{recipe.servings}</span>
            </div>
            <div className="flex flex-col border-l border-sand-border dark:border-brown-muted/20 pl-4">
              <span className="font-label-caps text-label-caps text-brown-muted dark:text-outline mb-1">DIFFICULTY</span>
              <span className="font-body-md text-body-md font-semibold text-on-surface dark:text-surface-bright">{recipe.difficulty}</span>
            </div>
          </div>
        );

      case "ingredients":
        return (
          <div key={idx} id="ingredients-list" className="bg-surface-bright dark:bg-dark-surface p-stack-lg rounded-xl border border-sand-border dark:border-brown-muted/15 warm-shadow print:border-black mb-8">
            <div className="flex justify-between items-center mb-stack-md border-b border-sand-border/30 dark:border-brown-muted/10 pb-3 select-none">
              <h2 className="font-headline-md text-headline-md text-primary dark:text-primary-fixed-dim italic">Ingredients</h2>
              {/* Servings Adjuster */}
              <div className="flex items-center gap-2 bg-surface-soft dark:bg-dark-bg rounded-full border border-sand-border dark:border-brown-muted/20 px-2.5 py-1">
                <button
                  onClick={() => updateServings(-1)}
                  className="w-6 h-6 flex items-center justify-center text-brown-muted hover:text-primary dark:hover:text-primary-fixed cursor-pointer transition-colors"
                  aria-label="Decrease servings"
                >
                  <span className="material-symbols-outlined text-sm font-bold">remove</span>
                </button>
                <span className="font-label-data text-label-data w-6 text-center text-on-surface dark:text-surface-bright font-semibold">{servings}</span>
                <button
                  onClick={() => updateServings(1)}
                  className="w-6 h-6 flex items-center justify-center text-brown-muted hover:text-primary dark:hover:text-primary-fixed cursor-pointer transition-colors"
                  aria-label="Increase servings"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                </button>
              </div>
            </div>
            <div className="space-y-6">
              {block.sections?.map((sec: any, sIdx: number) => (
                <div key={sIdx}>
                  {sec.heading && (
                    <h3 className="font-label-caps text-label-caps text-brown-muted dark:text-outline mt-3 mb-3 uppercase tracking-wider font-semibold border-l-2 border-secondary dark:border-secondary-fixed pl-2 select-none">
                      {sec.heading}
                    </h3>
                  )}
                  <div className="space-y-3 pl-1">
                    {sec.items?.map((item: any, iIdx: number) => {
                      const id = `ing-${sIdx}-${iIdx}`;
                      const isChecked = checkedIngredients.includes(id);
                      return (
                        <div key={iIdx} className="flex items-start gap-3 select-none">
                          <input
                            type="checkbox"
                            id={id}
                            checked={isChecked}
                            onChange={() => toggleIngredient(id)}
                            className="strikethrough-checked mt-1 w-5 h-5 rounded border-sand-border dark:border-brown-muted/20 text-secondary focus:ring-secondary focus:ring-offset-surface-bright dark:bg-dark-bg cursor-pointer"
                          />
                          <label
                            htmlFor={id}
                            className={`cursor-pointer select-none font-body-md text-body-md text-on-surface dark:text-surface-bright hover:text-primary dark:hover:text-primary-fixed-dim transition-colors ${
                              isChecked ? "line-through text-brown-muted/65 dark:text-outline/50" : ""
                            }`}
                          >
                            <span>
                              {item.qty && <span className="font-mono text-secondary dark:text-secondary-fixed font-bold mr-1">{formatQty(item.qty)}</span>}
                              {item.unit && <span className="font-mono text-brown-muted dark:text-outline mr-1.5">{item.unit}</span>}
                              {item.item}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "steps":
        return (
          <div key={idx} className="space-y-6 mb-8">
            <h2 className="font-headline-lg text-headline-lg text-primary dark:text-primary-fixed-dim italic border-b border-sand-border/30 dark:border-brown-muted/10 pb-3 select-none">
              Instructions
            </h2>
            <div className="space-y-6">
              {block.items?.map((step: any, sIdx: number) => {
                const isChecked = completedSteps.includes(sIdx);
                return (
                  <div
                    key={sIdx}
                    className={`flex gap-stack-md transition-all duration-300 ${
                      isChecked ? "opacity-60 dark:opacity-40" : ""
                    }`}
                  >
                    <div className="flex-shrink-0 select-none">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 flex items-center justify-center font-headline-sm text-headline-sm text-primary dark:text-primary-fixed font-semibold shadow-sm">
                        {sIdx + 1}
                      </div>
                    </div>
                    <div className="flex-1 pb-4 border-b border-sand-border/30 dark:border-brown-muted/10">
                      <p className={`font-body-md text-body-md text-on-surface-variant dark:text-surface-variant leading-relaxed mb-3 ${
                        isChecked ? "line-through decoration-secondary/50" : ""
                      }`}>
                        {step.text}
                      </p>

                      {/* Inline Timer Button */}
                      {step.timer && (() => {
                        const activeTimer = activeTimers.find((t) => t.label === `Step ${sIdx + 1}`);
                        if (activeTimer) {
                          return (
                            <div className="flex items-center gap-3 mb-3 select-none">
                              <div className="bg-secondary/15 dark:bg-secondary-fixed/15 border border-secondary/20 text-secondary dark:text-secondary-fixed font-mono font-bold px-4 py-1.5 rounded-full text-body-sm flex items-center gap-2 animate-pulse">
                                <span className="material-symbols-outlined text-sm">timer</span>
                                <span>Running: {formatTimerTime(activeTimer.duration)}</span>
                              </div>
                              <button
                                onClick={() => setActiveTimers((prev) => prev.filter((t) => t.id !== activeTimer.id))}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-body-sm text-[12px] font-bold cursor-pointer active:scale-95 transition-transform"
                              >
                                Cancel
                              </button>
                            </div>
                          );
                        }
                        return (
                          <button
                            onClick={() => startTimer(step.timer, `Step ${sIdx + 1}`)}
                            className="bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 text-primary dark:text-primary-fixed-dim hover:bg-surface-container-low dark:hover:bg-brown-mid/30 font-body-sm text-body-sm px-4 py-1.5 rounded-full transition-colors flex items-center gap-2 mb-3 shadow-sm select-none cursor-pointer active:scale-95"
                          >
                            <span className="material-symbols-outlined text-sm">timer</span>
                            <span>Start {step.timer} min timer</span>
                          </button>
                        );
                      })()}

                      <div className="flex items-center gap-2 select-none">
                        <input
                          type="checkbox"
                          id={`step-${sIdx}`}
                          checked={isChecked}
                          onChange={() => toggleStep(sIdx)}
                          className="w-5 h-5 rounded border-sand-border dark:border-brown-muted/20 text-secondary focus:ring-secondary bg-surface-soft dark:bg-dark-bg cursor-pointer"
                        />
                        <label
                          htmlFor={`step-${sIdx}`}
                          className="font-body-sm text-body-sm text-brown-muted dark:text-outline cursor-pointer select-none font-medium"
                        >
                          Mark complete
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "tip":
        return (
          <div key={idx} className="bg-surface-container-low dark:bg-dark-surface border-l-4 border-secondary dark:border-secondary-fixed p-stack-md rounded-r-lg my-6 select-none shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-secondary dark:text-secondary-fixed">
              <span className="material-symbols-outlined text-xl">lightbulb</span>
              <span className="font-headline-sm text-headline-sm italic font-semibold">Cook's Tip</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-surface-variant leading-relaxed">
              {block.text}
            </p>
          </div>
        );

      case "note":
        return (
          <div key={idx} className="bg-herb-light/40 dark:bg-dark-surface border-l-4 border-tertiary dark:border-tertiary-fixed p-stack-md rounded-r-lg my-6 select-none shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-tertiary dark:text-tertiary-fixed">
              <span className="material-symbols-outlined text-xl">sticky_note_2</span>
              <span className="font-headline-sm text-headline-sm italic font-semibold">Note</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-surface-variant leading-relaxed">
              {block.text}
            </p>
          </div>
        );

      case "gallery":
        return (
          <div key={idx} className="grid grid-cols-2 md:grid-cols-3 gap-gutter-grid mb-8 print:hidden select-none">
            {block.images?.map((img: any, gIdx: number) => (
              <div key={gIdx} className="flex flex-col gap-1">
                <div className="aspect-square rounded-xl overflow-hidden border border-sand-border dark:border-brown-muted/15 warm-shadow">
                  <img src={img.src} alt={img.caption || "Gallery"} className="w-full h-full object-cover" />
                </div>
                {img.caption && (
                  <span className="font-body-sm text-[12px] text-brown-muted dark:text-outline text-center mt-1">
                    {img.caption}
                  </span>
                )}
              </div>
            ))}
          </div>
        );

      case "video":
        return (
          <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-sand-border dark:border-brown-muted/20 warm-shadow mb-8 print:hidden select-none">
            <iframe
              src={block.src?.replace("watch?v=", "embed/")}
              title="Recipe Video"
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        );

      case "nutrition":
        return (
          <div key={idx} className="bg-surface-soft dark:bg-dark-surface p-stack-md rounded-xl border border-sand-border dark:border-brown-muted/15 mb-8 max-w-md select-none warm-shadow">
            <h4 className="font-label-caps text-label-caps text-brown-muted dark:text-outline mb-3 uppercase tracking-wider font-semibold border-b border-sand-border/30 dark:border-brown-muted/10 pb-2">
              Nutrition Information
            </h4>
            <div className="divide-y divide-sand-border/40 dark:divide-brown-muted/10 space-y-2">
              {recipe.nutrition?.calories && (
                <div className="flex justify-between py-1 font-body-sm text-body-sm">
                  <span className="text-brown-muted dark:text-outline">Calories</span>
                  <span className="font-semibold text-on-surface dark:text-surface-bright">{recipe.nutrition.calories} kcal</span>
                </div>
              )}
              {recipe.nutrition?.protein && (
                <div className="flex justify-between py-1 font-body-sm text-body-sm">
                  <span className="text-brown-muted dark:text-outline">Protein</span>
                  <span className="font-semibold text-on-surface dark:text-surface-bright">{recipe.nutrition.protein}</span>
                </div>
              )}
              {recipe.nutrition?.carbs && (
                <div className="flex justify-between py-1 font-body-sm text-body-sm">
                  <span className="text-brown-muted dark:text-outline">Carbohydrates</span>
                  <span className="font-semibold text-on-surface dark:text-surface-bright">{recipe.nutrition.carbs}</span>
                </div>
              )}
              {recipe.nutrition?.fat && (
                <div className="flex justify-between py-1 font-body-sm text-body-sm">
                  <span className="text-brown-muted dark:text-outline">Fat</span>
                  <span className="font-semibold text-on-surface dark:text-surface-bright">{recipe.nutrition.fat}</span>
                </div>
              )}
            </div>
          </div>
        );

      case "tags":
        return (
          <div key={idx} className="flex flex-wrap gap-2 mb-8 select-none">
            {recipe.tags?.map((tag) => (
              <span key={tag} className="bg-terracotta-light/60 dark:bg-on-secondary-fixed-variant/40 text-secondary dark:text-secondary-fixed px-3 py-1 rounded-full font-label-caps text-label-caps uppercase tracking-wider font-medium">
                {tag}
              </span>
            ))}
          </div>
        );

      case "divider":
        return <hr key={idx} className="border-t border-sand-border/60 dark:border-brown-muted/20 my-8" />;

      default:
        return null;
    }
  };

  const ingredientsBlock = recipe.blocks?.find((b) => b.type === "ingredients");
  const stepsBlock = recipe.blocks?.find((b) => b.type === "steps");

  return (
    <>
      <Navbar
        activeCategory={activeCategory}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          // Redirection triggers
        }}
        onOpenSearch={() => {}}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-[5px] bg-sand/30 dark:bg-brown-muted/10 z-[60] print:hidden">
        <div
          className="h-full bg-secondary dark:bg-on-secondary-fixed-variant transition-all duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <main className="pt-28 pb-section-gap px-margin-page max-w-7xl mx-auto flex flex-col gap-6 w-full print:pt-4">
        
        {/* Jump to Recipe Header Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/15 p-4 rounded-xl warm-shadow mb-4 print:hidden z-10 select-none">
          <button
            onClick={jumpToRecipe}
            className="bg-secondary dark:bg-on-secondary-fixed-variant text-white dark:text-secondary-fixed font-bold font-body-sm text-body-sm px-6 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
          >
            <span className="material-symbols-outlined text-base">arrow_downward</span>
            <span>Jump to Recipe</span>
          </button>
          
          <div className="flex flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => window.print()}
              className="bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 text-on-surface dark:text-surface-bright font-bold font-body-sm text-body-sm px-4 py-2.5 rounded-full hover:bg-surface-container-low dark:hover:bg-brown-mid/30 transition-colors flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Print</span>
            </button>
            
            <button
              onClick={() => setIsCookMode(true)}
              className="bg-primary dark:bg-on-primary-fixed-variant text-white dark:text-primary-fixed font-bold font-body-sm text-body-sm px-4 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-base">local_dining</span>
              <span>Start Cook Mode</span>
            </button>
          </div>
        </div>

        {/* Recipe Title & Meta Header */}
        <div className="flex flex-col gap-3 select-none mb-4">
          <div className="flex flex-wrap gap-2">
            {recipe.categories.map((cat) => (
              <span key={cat} className="bg-terracotta-light text-secondary dark:bg-on-secondary-fixed-variant/40 dark:text-secondary-fixed px-3 py-1 rounded-full font-label-caps text-label-caps font-semibold uppercase tracking-wider">
                {cat}
              </span>
            ))}
            <span className="bg-herb-light text-tertiary dark:bg-on-tertiary-fixed-variant/40 dark:text-tertiary-fixed px-3 py-1 rounded-full font-label-caps text-label-caps font-semibold uppercase tracking-wider">
              {recipe.difficulty.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-hero-display text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-hero-display italic text-primary dark:text-primary-fixed-dim leading-tight break-words">
                {recipe.title}
              </h1>
            </div>
            <div className="flex gap-2.5 self-start md:self-auto mt-1 print:hidden select-none flex-shrink-0">
              {/* Share Button */}
              <button
                onClick={handleShare}
                className="p-3 bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 hover:border-secondary rounded-full warm-shadow cursor-pointer group active:scale-95 transition-all flex items-center justify-center relative"
                aria-label="Share recipe"
              >
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform text-brown-muted dark:text-outline">
                  {shareSuccess ? "check" : "share"}
                </span>
                {shareTooltip && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-on-surface dark:bg-surface-bright text-surface-bright dark:text-on-surface text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap animate-fade-in z-20">
                    Link copied!
                  </div>
                )}
              </button>

              {/* Bookmark Button */}
              <button
                onClick={(e) => handleToggleBookmark(recipe.slug, e)}
                className="p-3 bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 hover:border-secondary rounded-full warm-shadow cursor-pointer group active:scale-95 transition-all flex items-center justify-center"
                aria-label="Bookmark recipe"
              >
                <span
                  className={`material-symbols-outlined text-2xl group-hover:scale-110 transition-transform ${
                    bookmarks.includes(recipe.slug) ? "text-secondary font-fill-1" : "text-brown-muted dark:text-outline"
                  }`}
                  style={{ fontVariationSettings: bookmarks.includes(recipe.slug) ? "'FILL' 1" : "'FILL' 0" }}
                >
                  favorite
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Recipe Columns Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-section-gap items-start relative w-full mt-2">
          
          {/* Main Story & Recipe Content Block (Dynamic) */}
          <div className="lg:col-span-8 space-y-2 order-2 lg:order-1">
            {recipe.blocks?.map((block, idx) => {
              if (block.type === "ingredients") return null; // rendered in sticky sidebar or custom section
              return renderBlock(block, idx);
            })}
          </div>

          {/* Ingredients Sticky Sidebar (lg:col-span-4) */}
          <aside className="lg:col-span-4 relative print:col-span-12 order-1 lg:order-2">
            {ingredientsBlock && (
              <div className="sticky top-28 print:static">
                {renderBlock(ingredientsBlock, 999)}
              </div>
            )}
          </aside>
        </div>

        {/* Print-specific layout block for ingredients & steps */}
        <div className="hidden print:block space-y-6">
          <hr className="border-t-2 border-black my-8" />
          <h2 className="text-3xl font-bold font-fraunces text-black">Ingredients</h2>
          {ingredientsBlock?.sections?.map((sec: any, sIdx: number) => (
            <div key={sIdx} className="mb-4">
              {sec.heading && <h3 className="text-xl font-bold font-fraunces mt-2 mb-2 text-black uppercase">{sec.heading}</h3>}
              <ul className="list-disc pl-6 space-y-1 text-black font-body">
                {sec.items?.map((item: any, iIdx: number) => (
                  <li key={iIdx}>
                    {item.qty && <span className="font-bold mr-1">{formatQty(item.qty)}</span>}
                    {item.unit && <span className="mr-1">{item.unit}</span>}
                    {item.item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <h2 className="text-3xl font-bold font-fraunces text-black mt-8">Instructions</h2>
          <ol className="list-decimal pl-6 space-y-4 text-black font-body">
            {stepsBlock?.items?.map((step: any, sIdx: number) => (
              <li key={sIdx} className="pl-2">
                <p className="text-black leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Related Recipes Section */}
        {recipe.blocks?.find((b) => b.type === "related") && (
          <div className="mt-8 border-t border-sand-border dark:border-brown-muted/15 pt-8 print:hidden select-none">
            <h3 className="font-headline-md text-headline-md italic text-primary dark:text-primary-fixed-dim mb-6">
              You Might Also Enjoy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter-grid items-start">
              {allRecipes
                .filter((r) => r.slug !== recipe.slug && r.status === "published")
                .slice(0, 3)
                .map((rel) => (
                  <RecipeCard
                    key={rel.slug}
                    recipe={rel}
                    isBookmarked={bookmarks.includes(rel.slug)}
                    onToggleBookmark={handleToggleBookmark}
                  />
                ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Active Timers Widget (Global Countdown) */}
      {activeTimers.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full p-4 bg-surface-bright dark:bg-dark-surface border border-secondary/30 rounded-xl warm-shadow animate-fade-in print:hidden">
          <div className="flex justify-between items-center border-b border-sand-border/30 pb-2">
            <span className="font-label-caps text-label-caps text-secondary dark:text-secondary-fixed uppercase tracking-wider font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm animate-pulse">timer</span>
              Active Timers ({activeTimers.length})
            </span>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {activeTimers.map((t) => {
              const percent = (t.duration / t.maxDuration) * 100;
              return (
                <div key={t.id} className="flex flex-col gap-1 bg-surface-soft dark:bg-dark-bg p-2.5 rounded-lg border border-sand-border/30">
                  <div className="flex justify-between items-center font-body-sm text-body-sm">
                    <span className="font-semibold text-on-surface dark:text-surface-bright">{t.label}</span>
                    <span className="font-mono text-secondary dark:text-secondary-fixed font-bold">{formatTimerTime(t.duration)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-sand/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary dark:bg-on-secondary-fixed-variant transition-all duration-1000"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step-by-Step Focused COOK MODE Overlay */}
      {isCookMode && stepsBlock && stepsBlock.items && (
        <div className="fixed inset-0 z-[100] bg-background-cream dark:bg-dark-bg flex flex-col p-6 overflow-y-auto animate-fade-in select-none">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-sand-border/30 dark:border-brown-muted/15 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary dark:text-secondary-fixed animate-pulse text-xl">local_dining</span>
              <span className="font-label-caps text-label-caps text-brown-muted dark:text-outline uppercase tracking-wider font-bold text-[11px] sm:text-xs truncate max-w-[200px] sm:max-w-none">
                COOK MODE — {recipe.title.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => setIsCookMode(false)}
              className="px-4 py-2 bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 hover:bg-surface-container-low dark:hover:bg-brown-mid/30 text-brown-muted dark:text-surface-bright rounded-full font-bold font-body-sm text-body-sm cursor-pointer shadow-sm active:scale-95 transition-transform"
            >
              Exit Cook Mode
            </button>
          </div>

          {/* Focused Content */}
          <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full text-center py-4 my-auto">
            <span className="font-label-caps text-label-caps text-secondary dark:text-secondary-fixed uppercase tracking-wider font-bold mb-4 block">
              STEP {currentCookStep + 1} OF {stepsBlock.items.length}
            </span>
            
            <p className="font-fraunces text-2xl sm:text-3xl md:text-4xl italic text-on-surface dark:text-surface-bright leading-relaxed mb-8 max-w-2xl mx-auto px-2">
              "{stepsBlock.items[currentCookStep].text}"
            </p>

            {/* Dynamic Step Timer Area inside Cook Mode Overlay */}
            {stepsBlock.items[currentCookStep].timer && (() => {
              const activeTimer = activeTimers.find((t) => t.label === `Step ${currentCookStep + 1}`);
              if (activeTimer) {
                const percent = (activeTimer.duration / activeTimer.maxDuration) * 100;
                return (
                  <div className="flex flex-col items-center gap-4 mb-8 max-w-sm mx-auto w-full">
                    <div className="font-mono text-5xl md:text-6xl font-bold text-secondary dark:text-secondary-fixed animate-pulse">
                      {formatTimerTime(activeTimer.duration)}
                    </div>
                    <div className="w-full h-2 bg-sand/35 dark:bg-brown-muted/30 rounded-full overflow-hidden border border-sand-border/30">
                      <div
                        className="h-full bg-secondary dark:bg-on-secondary-fixed-variant transition-all duration-1000"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <button
                      onClick={() => setActiveTimers((prev) => prev.filter((t) => t.id !== activeTimer.id))}
                      className="px-6 py-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold font-body-sm rounded-full cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-950/40 transition-colors active:scale-95"
                    >
                      Cancel Timer
                    </button>
                  </div>
                );
              }
              return (
                <div className="flex justify-center mb-8">
                  <button
                    onClick={() => startTimer(stepsBlock.items[currentCookStep].timer, `Step ${currentCookStep + 1}`)}
                    className="bg-secondary dark:bg-on-secondary-fixed-variant text-white dark:text-secondary-fixed font-bold font-body-md text-body-md px-6 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined">timer</span>
                    <span>Start {stepsBlock.items[currentCookStep].timer} min timer</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Navigation Controls */}
          <div className="border-t border-sand-border/30 pt-6 mt-auto flex flex-col gap-4 max-w-3xl mx-auto w-full">
            {/* Step Completion Toggle (Touch friendly) */}
            <button
              onClick={() => toggleStep(currentCookStep)}
              className={`w-full py-3.5 rounded-full font-bold font-body-md text-body-md transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                completedSteps.includes(currentCookStep)
                  ? "bg-herb-light border-tertiary/20 text-tertiary dark:bg-on-tertiary-fixed-variant/20 dark:text-tertiary-fixed shadow-sm"
                  : "bg-surface-bright border-sand-border text-brown-muted dark:bg-dark-surface dark:border-brown-muted/30 dark:text-surface-bright hover:bg-surface-container-low dark:hover:bg-brown-mid/20"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {completedSteps.includes(currentCookStep) ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>{completedSteps.includes(currentCookStep) ? "Step Completed" : "Mark Step Complete"}</span>
            </button>

            {/* Back / Next Row */}
            <div className="flex justify-between items-center w-full gap-4 pb-2">
              <button
                disabled={currentCookStep === 0}
                onClick={() => setCurrentCookStep((p) => p - 1)}
                className="flex-1 py-3 px-4 bg-surface-bright dark:bg-dark-surface border border-sand-border dark:border-brown-muted/20 rounded-full font-bold font-body-sm text-body-sm text-on-surface dark:text-surface-bright hover:bg-surface-container-low dark:hover:bg-brown-mid/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
                <span>Previous</span>
              </button>

              <button
                disabled={currentCookStep === stepsBlock.items.length - 1}
                onClick={() => setCurrentCookStep((p) => p + 1)}
                className="flex-1 py-3 px-4 bg-secondary dark:bg-on-secondary-fixed-variant rounded-full font-bold font-body-sm text-body-sm text-white dark:text-secondary-fixed hover:bg-secondary/90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer onSelectCategory={() => {}} />
    </>
  );
}
