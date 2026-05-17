"use client";

import Image from "next/image";
import Link from "next/link";
import { Recipe } from "@/lib/recipes";

interface RecipeCardProps {
  recipe: Recipe;
  isBookmarked: boolean;
  onToggleBookmark: (slug: string, e: React.MouseEvent) => void;
}

export default function RecipeCard({
  recipe,
  isBookmarked,
  onToggleBookmark,
}: RecipeCardProps) {
  const primaryCategory = recipe.categories.find((c) => c !== "All") || recipe.categories[0];

  // Dynamic aspect ratio based on slug to create a true masonry scrapbook aesthetic
  let aspectClass = "aspect-square";
  if (recipe.slug === "coconut-chicken-curry" || recipe.slug === "egg-puff") {
    aspectClass = "aspect-[3/4]";
  } else if (recipe.slug === "15-minute-fried-rice" || recipe.slug === "potato-pops") {
    aspectClass = "aspect-[4/3]";
  }

  return (
    <Link href={`/recipes/${recipe.slug}`} className="block relative group select-none cursor-pointer h-full">
      <article className="h-full bg-surface-bright dark:bg-dark-surface border border-transparent dark:border-brown-muted/10 rounded-xl p-4 warm-shadow recipe-card-hover transition-all duration-300 flex flex-col gap-stack-md relative">
        {/* Bookmark Button */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleBookmark(recipe.slug, e);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onToggleBookmark(recipe.slug, e as any);
            }
          }}
          className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/90 dark:bg-dark-surface/90 hover:bg-white dark:hover:bg-dark-surface border border-sand-border/30 dark:border-brown-muted/20 rounded-full flex items-center justify-center text-secondary dark:text-secondary-fixed transition-all duration-300 hover:scale-110 active:scale-95 shadow-sm cursor-pointer"
          aria-label={isBookmarked ? "Remove from bookmarks" : "Add to bookmarks"}
        >
          <span
            className="material-symbols-outlined text-xl transition-all duration-300"
            style={{ fontVariationSettings: isBookmarked ? "'FILL' 1" : "'FILL' 0" }}
          >
            favorite
          </span>
        </div>

        {/* Image container */}
        <div className={`relative w-full ${aspectClass} overflow-hidden rounded-lg bg-surface-dim/20`}>
          <Image
            alt={recipe.title}
            src={recipe.coverImage}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover rounded-lg group-hover:scale-105 transition-transform duration-500"
          />
        </div>

        <div className="flex flex-col gap-stack-sm justify-between flex-1">
          <div className="flex flex-col gap-stack-sm">
            {/* Category & Stats */}
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 bg-terracotta-light dark:bg-on-secondary-fixed-variant text-secondary dark:text-secondary-fixed rounded-full font-label-caps text-label-caps tracking-wide font-medium">
                {primaryCategory}
              </span>
              <div className="flex items-center gap-2 text-brown-muted dark:text-outline font-label-caps text-[11px]">
                <div className="flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  <span>{recipe.prepTime + recipe.cookTime}m</span>
                </div>
                <span>•</span>
                <span>{recipe.difficulty}</span>
              </div>
            </div>

            {/* Title */}
            <h3 className="font-headline-sm text-headline-sm italic text-on-surface dark:text-surface-bright group-hover:text-secondary dark:group-hover:text-secondary-fixed transition-colors">
              {recipe.title}
            </h3>

            {/* Description */}
            <p className="font-body-sm text-body-sm text-brown-muted dark:text-outline-variant line-clamp-2">
              {recipe.description}
            </p>
          </div>

          {/* Cook Link */}
          <div className="mt-4 flex items-center gap-1 text-secondary dark:text-secondary-fixed font-medium font-body-sm hover:text-primary dark:hover:text-primary-fixed transition-colors select-none">
            <span className="underline decoration-terracotta-light dark:decoration-secondary/50 underline-offset-4 decoration-2">
              View Recipe
            </span>
            <span className="material-symbols-outlined text-sm translate-x-0 group-hover:translate-x-1 transition-transform duration-200">
              arrow_forward
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
