"use server";

import fs from "fs";
import path from "path";
import { Recipe, getAllRecipes, getRecipeBySlug, HomeSettings, getHomeSettings, saveHomeSettings } from "@/lib/recipes";
import { put, del } from "@vercel/blob";

const getPassphrase = () => {
  return process.env.ADMIN_PASSPHRASE || "cozykitchen";
};

const isBlobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Verify admin passphrase
export async function verifyPassphrase(passphrase: string): Promise<{ success: boolean }> {
  const correct = getPassphrase();
  return { success: passphrase === correct };
}

// Load all recipes including drafts for admin view
export async function loadAllAdminRecipes(passphrase: string): Promise<{ success: boolean; recipes?: Recipe[]; error?: string }> {
  const correct = getPassphrase();
  if (passphrase !== correct) {
    return { success: false, error: "Unauthorized" };
  }
  
  try {
    const recipes = await getAllRecipes(true);
    return { success: true, recipes };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load recipes" };
  }
}

// Save or update a recipe
export async function saveRecipe(
  passphrase: string,
  slug: string,
  originalSlug: string | null,
  recipeData: Recipe
): Promise<{ success: boolean; error?: string }> {
  const correct = getPassphrase();
  if (passphrase !== correct) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (isBlobEnabled()) {
      // If the slug changed, delete the old file in Vercel Blob
      if (originalSlug && originalSlug !== slug) {
        await del(`recipes/${originalSlug}.json`);
      }
      
      await put(`recipes/${slug}.json`, JSON.stringify(recipeData, null, 2), {
        access: "public",
        addRandomSuffix: false,
      });
      return { success: true };
    }

    // Local filesystem fallback
    const dir = path.join(process.cwd(), "data", "recipes");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // If the slug changed, delete the old file
    if (originalSlug && originalSlug !== slug) {
      const oldPath = path.join(dir, `${originalSlug}.json`);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const filePath = path.join(dir, `${slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(recipeData, null, 2), "utf-8");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to save recipe" };
  }
}

// Delete a recipe
export async function deleteRecipe(passphrase: string, slug: string): Promise<{ success: boolean; error?: string }> {
  const correct = getPassphrase();
  if (passphrase !== correct) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (isBlobEnabled()) {
      await del(`recipes/${slug}.json`);
      return { success: true };
    }

    // Local fallback
    const filePath = path.join(process.cwd(), "data", "recipes", `${slug}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: "Recipe file not found" };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to delete recipe" };
  }
}

// Duplicate a recipe
export async function duplicateRecipe(passphrase: string, slug: string): Promise<{ success: boolean; newSlug?: string; error?: string }> {
  const correct = getPassphrase();
  if (passphrase !== correct) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const newSlug = `${slug}-copy`;

    if (isBlobEnabled()) {
      const recipe = await getRecipeBySlug(slug);
      if (!recipe) {
        return { success: false, error: "Source recipe not found" };
      }

      const duplicatedRecipe: Recipe = {
        ...recipe,
        slug: newSlug,
        title: `${recipe.title} (Copy)`,
        status: "draft"
      };

      await put(`recipes/${newSlug}.json`, JSON.stringify(duplicatedRecipe, null, 2), {
        access: "public",
        addRandomSuffix: false,
      });
      return { success: true, newSlug };
    }

    // Local filesystem fallback
    const dir = path.join(process.cwd(), "data", "recipes");
    const srcPath = path.join(dir, `${slug}.json`);
    
    if (!fs.existsSync(srcPath)) {
      return { success: false, error: "Source recipe not found" };
    }

    const fileContent = fs.readFileSync(srcPath, "utf-8");
    const recipe = JSON.parse(fileContent) as Recipe;
    
    const destPath = path.join(dir, `${newSlug}.json`);
    
    const duplicatedRecipe: Recipe = {
      ...recipe,
      slug: newSlug,
      title: `${recipe.title} (Copy)`,
      status: "draft"
    };

    fs.writeFileSync(destPath, JSON.stringify(duplicatedRecipe, null, 2), "utf-8");
    return { success: true, newSlug };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to duplicate recipe" };
  }
}

// Load Homepage Settings
export async function loadHomepageSettings(passphrase: string): Promise<{ success: boolean; settings?: HomeSettings; error?: string }> {
  const correct = getPassphrase();
  if (passphrase !== correct) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    const settings = await getHomeSettings();
    return { success: true, settings };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load home settings" };
  }
}

// Save Homepage Settings
export async function saveHomepageSettings(
  passphrase: string,
  settings: HomeSettings
): Promise<{ success: boolean; error?: string }> {
  const correct = getPassphrase();
  if (passphrase !== correct) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    await saveHomeSettings(settings);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to save home settings" };
  }
}
