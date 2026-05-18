import fs from "fs";
import path from "path";
import { list, put, get } from "@vercel/blob";

export interface Recipe {
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  categories: string[];
  tags: string[];
  difficulty: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  status: string;
  nutrition: {
    calories?: number;
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  blocks?: any[];
}

export interface HomeSettings {
  showcaseSlugs: string[];
  todaysPickSlug: string | null;
}

// Rewrites private Vercel Blob URLs to use our secure server-side proxy endpoint
export function resolvePrivateUrl(url: string): string {
  if (!url) return url;
  if (url.includes(".private.blob.vercel-storage.com")) {
    return `/api/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Scans recipe data structures and maps private Vercel Blob assets safely
export function resolvePrivateImageUrls(recipe: Recipe): Recipe {
  if (!recipe) return recipe;
  
  const cloned = { ...recipe };
  
  if (cloned.coverImage) {
    cloned.coverImage = resolvePrivateUrl(cloned.coverImage);
  }
  
  if (Array.isArray(cloned.blocks)) {
    cloned.blocks = cloned.blocks.map((block: any) => {
      if (!block) return block;
      const clonedBlock = { ...block };
      
      if (clonedBlock.type === "hero-image" && clonedBlock.src) {
        clonedBlock.src = resolvePrivateUrl(clonedBlock.src);
      } else if (clonedBlock.type === "gallery" && Array.isArray(clonedBlock.images)) {
        clonedBlock.images = clonedBlock.images.map((img: any) => {
          if (!img) return img;
          return {
            ...img,
            src: resolvePrivateUrl(img.src),
          };
        });
      }
      
      return clonedBlock;
    });
  }
  
  return cloned;
}

// Check if Vercel Blob is configured
const isBlobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Local fallback recipes directory
const getLocalDir = () => path.join(process.cwd(), "data", "recipes");

// Safe Vercel Blob Put wrapper that automatically detects and handles Private Stores
export async function safePut(pathname: string, content: string | Buffer, options: { addRandomSuffix?: boolean, allowOverwrite?: boolean } = {}) {
  try {
    return await put(pathname, content, {
      ...options,
      access: "public",
      allowOverwrite: options.allowOverwrite ?? true,
    });
  } catch (error: any) {
    if (error?.message?.includes("private store") || error?.message?.includes("private access")) {
      console.log(`Detected private Vercel Blob store. Uploading ${pathname} with private access...`);
      return await put(pathname, content, {
        ...options,
        access: "private",
        allowOverwrite: options.allowOverwrite ?? true,
      });
    }
    throw error;
  }
}

// Safe Vercel Blob Get wrapper that automatically detects and handles Private and Public Stores
export async function safeGet(urlOrPathname: string) {
  try {
    return await get(urlOrPathname, { access: "private" });
  } catch (error) {
    return await get(urlOrPathname, { access: "public" });
  }
}

// Seed Vercel Blob with local files if Vercel Blob is empty
async function seedBlobIfEmpty() {
  if (!isBlobEnabled()) return;
  try {
    const { blobs } = await list({ prefix: "recipes/" });
    if (blobs.length > 0) return; // already seeded

    console.log("Vercel Blob is empty! Seeding with local recipes...");
    const localDir = getLocalDir();
    if (!fs.existsSync(localDir)) return;

    const filenames = fs.readdirSync(localDir);
    for (const filename of filenames) {
      if (filename.endsWith(".json")) {
        const filePath = path.join(localDir, filename);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const slug = filename.replace(".json", "");
        
        await safePut(`recipes/${slug}.json`, fileContent, {
          addRandomSuffix: false,
        });
        console.log(`Seeded recipe: ${slug} to Vercel Blob`);
      }
    }

    // Seed default settings too
    const defaultSettings: HomeSettings = {
      showcaseSlugs: ["chicken-biryani", "egg-puff", "coconut-chicken-curry"],
      todaysPickSlug: null,
    };
    await safePut("settings.json", JSON.stringify(defaultSettings, null, 2), {
      addRandomSuffix: false,
    });
    console.log("Seeded default settings.json to Vercel Blob");
  } catch (error) {
    console.error("Failed to seed Vercel Blob:", error);
  }
}

export async function getAllRecipes(includeDrafts = false): Promise<Recipe[]> {
  if (isBlobEnabled()) {
    await seedBlobIfEmpty();
    try {
      const { blobs } = await list({ prefix: "recipes/" });
      const recipes: Recipe[] = [];
      
      const jsonBlobs = blobs.filter((b) => b.pathname.endsWith(".json"));
      
      // Fetch all blobs in parallel using Vercel Blob SDK safeGet() to support both Private & Public stores
      const fetched = await Promise.all(
        jsonBlobs.map(async (b) => {
          try {
            const blobObj = await safeGet(b.url);
            if (!blobObj) return null;
            const text = await new Response(blobObj.stream).text();
            return JSON.parse(text) as Recipe;
          } catch (err) {
            console.error(`Error fetching recipe blob ${b.pathname}:`, err);
            return null;
          }
        })
      );

      for (const recipe of fetched) {
        if (recipe && (includeDrafts || recipe.status === "published")) {
          recipes.push(resolvePrivateImageUrls(recipe));
        }
      }
      return recipes;
    } catch (error) {
      console.error("Error loading recipes from Vercel Blob:", error);
      // Fallback to local on error
    }
  }

  // Local filesystem fallback
  const recipesDirectory = getLocalDir();
  if (!fs.existsSync(recipesDirectory)) {
    return [];
  }

  const filenames = fs.readdirSync(recipesDirectory);
  const recipes: Recipe[] = [];

  for (const filename of filenames) {
    if (filename.endsWith(".json")) {
      const filePath = path.join(recipesDirectory, filename);
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const recipe = JSON.parse(fileContent) as Recipe;
        if (includeDrafts || recipe.status === "published") {
          recipes.push(resolvePrivateImageUrls(recipe));
        }
      } catch (error) {
        console.error(`Error reading or parsing recipe ${filename}:`, error);
      }
    }
  }

  return recipes;
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | null> {
  if (isBlobEnabled()) {
    await seedBlobIfEmpty();
    try {
      const { blobs } = await list({ prefix: `recipes/${slug}.json` });
      const blob = blobs.find((b) => b.pathname === `recipes/${slug}.json`);
      if (blob) {
        const blobObj = await safeGet(blob.url);
        if (blobObj) {
          const text = await new Response(blobObj.stream).text();
          return resolvePrivateImageUrls(JSON.parse(text) as Recipe);
        }
      }
      return null;
    } catch (error) {
      console.error(`Error loading recipe by slug ${slug} from Vercel Blob:`, error);
    }
  }

  // Local filesystem fallback
  const recipesDirectory = getLocalDir();
  const filePath = path.join(recipesDirectory, `${slug}.json`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return resolvePrivateImageUrls(JSON.parse(fileContent) as Recipe);
  } catch (error) {
    console.error(`Error reading or parsing recipe ${slug}.json:`, error);
    return null;
  }
}

export async function getHomeSettings(): Promise<HomeSettings> {
  if (isBlobEnabled()) {
    await seedBlobIfEmpty();
    try {
      const { blobs } = await list({ prefix: "settings.json" });
      const blob = blobs.find((b) => b.pathname === "settings.json");
      if (blob) {
        const blobObj = await safeGet(blob.url);
        if (blobObj) {
          const text = await new Response(blobObj.stream).text();
          return JSON.parse(text) as HomeSettings;
        }
      }
    } catch (error) {
      console.error("Error loading home settings from Vercel Blob:", error);
    }
  }

  // Local filesystem fallback
  const filePath = path.join(process.cwd(), "data", "settings.json");
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content) as HomeSettings;
    } catch (error) {
      console.error("Error parsing local home settings:", error);
    }
  }

  return {
    showcaseSlugs: [],
    todaysPickSlug: null,
  };
}

export async function saveHomeSettings(settings: HomeSettings): Promise<void> {
  if (isBlobEnabled()) {
    await safePut("settings.json", JSON.stringify(settings, null, 2), {
      addRandomSuffix: false,
    });
  } else {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, "settings.json");
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
  }
}
