import { getAllRecipes, getHomeSettings } from "@/lib/recipes";
import CozyKitchenHome from "@/components/CozyKitchenHome";

// Incremental Static Regeneration (ISR) - keeps pages lightning fast but updates automatically within 10s of changes.
export const revalidate = 10;

export default async function Home() {
  const recipes = await getAllRecipes();
  const settings = await getHomeSettings();

  return <CozyKitchenHome initialRecipes={recipes} homeSettings={settings} />;
}
