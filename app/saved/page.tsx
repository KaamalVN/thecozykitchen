import { getAllRecipes } from "@/lib/recipes";
import SavedRecipesClient from "./SavedRecipesClient";

export const metadata = {
  title: "Your Saved Recipes — The Cozy Kitchen",
  description: "Browse and cook your favorite handcrafted recipe binder collections.",
};

export default async function SavedPage() {
  const allRecipes = await getAllRecipes(false); // published only
  return <SavedRecipesClient allRecipes={allRecipes} />;
}
