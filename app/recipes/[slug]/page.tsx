import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRecipeBySlug, getAllRecipes } from "@/lib/recipes";
import RecipeDetailClient from "./RecipeDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

// Generate dynamic SEO metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) {
    return {
      title: "Recipe Not Found - The Cozy Kitchen",
    };
  }

  return {
    title: `${recipe.title} - The Cozy Kitchen`,
    description: recipe.description,
    openGraph: {
      title: `${recipe.title} - The Cozy Kitchen`,
      description: recipe.description,
      images: [{ url: recipe.coverImage }],
    },
  };
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);

  if (!recipe) {
    notFound();
  }

  const allRecipes = await getAllRecipes(true); // load all for related cards

  // Build JSON-LD Structured Recipe Schema for Google Rich Snippets
  const recipeSchema = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": recipe.title,
    "image": recipe.coverImage,
    "description": recipe.description,
    "prepTime": `PT${recipe.prepTime}M`,
    "cookTime": `PT${recipe.cookTime}M`,
    "totalTime": `PT${recipe.prepTime + recipe.cookTime}M`,
    "recipeYield": `${recipe.servings} servings`,
    "recipeCategory": recipe.categories[0] || "Main Course",
    "difficulty": recipe.difficulty,
    "nutrition": recipe.nutrition ? {
      "@type": "NutritionInformation",
      "calories": `${recipe.nutrition.calories} calories`,
      "proteinContent": recipe.nutrition.protein,
      "carbohydrateContent": recipe.nutrition.carbs,
      "fatContent": recipe.nutrition.fat
    } : undefined,
    "recipeIngredient": recipe.blocks
      ?.find((b) => b.type === "ingredients")
      ?.sections?.flatMap((sec: any) => sec.items.map((item: any) => `${item.qty || ""} ${item.unit || ""} ${item.item}`)) || [],
    "recipeInstructions": recipe.blocks
      ?.find((b) => b.type === "steps")
      ?.items?.map((step: any, idx: number) => ({
        "@type": "HowToStep",
        "position": idx + 1,
        "text": step.text
      })) || []
  };

  return (
    <>
      {/* Inject JSON-LD Schema on Server-side for Google Search Engine indexing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeSchema) }}
      />
      <RecipeDetailClient recipe={recipe} allRecipes={allRecipes} />
    </>
  );
}
