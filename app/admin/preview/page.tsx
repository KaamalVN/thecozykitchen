"use client";

import { useEffect, useState } from "react";
import { Recipe } from "@/lib/recipes";
import RecipeDetailClient from "@/app/recipes/[slug]/RecipeDetailClient";

export default function PreviewIframePage() {
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Allow messages only from the same origin for security
      if (e.origin !== window.location.origin) return;
      
      if (e.data && e.data.type === "PREVIEW_UPDATE") {
        setRecipe(e.data.recipe);
      }
    };
    window.addEventListener("message", handleMessage);
    
    // Signal to parent window that the iframe is loaded and ready
    window.parent.postMessage({ type: "PREVIEW_READY" }, window.location.origin);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!recipe) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center text-brown-muted p-6 text-center select-none">
        <span className="material-symbols-outlined text-4xl animate-spin text-secondary mb-3">cooking</span>
        <h3 className="font-fraunces text-xl italic font-semibold text-primary">Simulating Kitchen...</h3>
        <p className="font-body-sm text-body-sm mt-1 max-w-xs">Start editing or select a recipe to build the real-time preview.</p>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <RecipeDetailClient recipe={recipe} allRecipes={[]} />
    </div>
  );
}
