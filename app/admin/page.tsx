"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Recipe, HomeSettings } from "@/lib/recipes";
import {
  verifyPassphrase,
  loadAllAdminRecipes,
  saveRecipe,
  deleteRecipe,
  duplicateRecipe,
  loadHomepageSettings,
  saveHomepageSettings,
  uploadImageAction,
} from "@/app/actions/recipeActions";
import { upload } from "@vercel/blob/client";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [loginError, setLoginError] = useState("");
  
  // Recipe lists
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  
  // Editor mode: "list" | "edit"
  const [viewMode, setViewMode] = useState<"list" | "edit">("list");
  
  // Preview responsive simulation: "desktop" | "tablet" | "mobile"
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  
  // Search and filters for admin list
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  // Homepage configuration settings states
  const [homeSettings, setHomeSettings] = useState<HomeSettings>({
    showcaseSlugs: [],
    todaysPickSlug: null,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  // Panel split resizing states
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Real-time preview iframe controller
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // File upload indicator states
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Track window size to adapt splitter
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Panel resize dragging handler
  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((mouseMoveEvent.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Limit bounds so panels are always readable
      if (newLeftWidth > 15 && newLeftWidth < 85) {
        setLeftWidthPercent(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Sync edits to the mobile/desktop simulator iframe in real-time
  useEffect(() => {
    if (selectedRecipe && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        { type: "PREVIEW_UPDATE", recipe: selectedRecipe },
        "*"
      );
    }
  }, [selectedRecipe]);

  // Sync state when simulator iframe confirms it is ready
  useEffect(() => {
    const handleParentMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === "PREVIEW_READY" && selectedRecipe && iframeRef.current) {
        iframeRef.current.contentWindow?.postMessage(
          { type: "PREVIEW_UPDATE", recipe: selectedRecipe },
          "*"
        );
      }
    };
    window.addEventListener("message", handleParentMessage);
    return () => window.removeEventListener("message", handleParentMessage);
  }, [selectedRecipe]);

  // Hybrid direct uploader to Vercel Blob (CORS-immune Server Action for <= 4MB, Direct Client-side upload fallback for > 4MB)
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onUploadSuccess: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const activePassphrase = passphrase || sessionStorage.getItem("admin-passphrase") || "";

    try {
      if (file.size <= 4 * 1024 * 1024) {
        // File is small enough for a Serverless Function. Use Server Action (100% CORS-Immune!)
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64String = (reader.result as string).split(",")[1];
            const res = await uploadImageAction(activePassphrase, file.name, base64String);
            setIsUploading(false);
            if (res.success && res.url) {
              onUploadSuccess(res.url);
            } else {
              setUploadError(res.error || "Upload failed");
            }
          } catch (err: any) {
            setIsUploading(false);
            setUploadError(err.message || "Failed to upload image.");
          }
        };
        reader.onerror = () => {
          setIsUploading(false);
          setUploadError("Failed to read file.");
        };
        reader.readAsDataURL(file);
      } else {
        // File exceeds Vercel Serverless Function payload limits. Fall back to secure Direct Client-side Upload
        const newBlob = await upload(`images/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify({ passphrase: activePassphrase }),
        });

        setIsUploading(false);
        if (newBlob && newBlob.url) {
          onUploadSuccess(newBlob.url);
        } else {
          setUploadError("Upload failed to return secure URL.");
        }
      }
    } catch (err: any) {
      setIsUploading(false);
      setUploadError(err.message || "Failed to upload image.");
    }
  };

  // Load session from sessionStorage if it exists
  useEffect(() => {
    const saved = sessionStorage.getItem("admin-passphrase");
    if (saved) {
      verifyPassphrase(saved).then((res) => {
        if (res.success) {
          setPassphrase(saved);
          setIsAuthenticated(true);
          loadRecipes(saved);
        } else {
          sessionStorage.removeItem("admin-passphrase");
        }
      });
    }
  }, []);

  const loadRecipes = async (pass: string) => {
    const res = await loadAllAdminRecipes(pass);
    if (res.success && res.recipes) {
      setRecipes(res.recipes);
    }
    const settingsRes = await loadHomepageSettings(pass);
    if (settingsRes.success && settingsRes.settings) {
      setHomeSettings(settingsRes.settings);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);
    setSettingsError("");
    
    const res = await saveHomepageSettings(passphrase, homeSettings);
    setIsSavingSettings(false);
    if (res.success) {
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } else {
      setSettingsError(res.error || "Failed to save settings");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await verifyPassphrase(passphrase);
    if (res.success) {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin-passphrase", passphrase);
      setLoginError("");
      loadRecipes(passphrase);
    } else {
      setLoginError("Incorrect passphrase. Try again.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin-passphrase");
    setIsAuthenticated(false);
    setPassphrase("");
    setViewMode("list");
    setSelectedRecipe(null);
  };

  const handleCreateNew = () => {
    const newRecipe: Recipe = {
      slug: "new-recipe",
      title: "New Cozy Recipe",
      description: "Short descriptive introduction of the dish.",
      coverImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop",
      categories: ["All"],
      tags: ["Home Cooked"],
      difficulty: "Easy",
      prepTime: 15,
      cookTime: 15,
      servings: 2,
      status: "draft",
      nutrition: {
        calories: 350,
        protein: "12g",
        carbs: "45g",
        fat: "10g"
      },
      blocks: [
        { type: "hero-image", src: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop", alt: "Preview Image" },
        { type: "intro", text: "Write the lovely storytelling background of this recipe here..." },
        { type: "meta-bar" },
        {
          type: "ingredients",
          sections: [
            {
              heading: "Main Ingredients",
              items: [
                { qty: 1, unit: "cup", item: "fresh ingredient" }
              ]
            }
          ]
        },
        {
          type: "steps",
          items: [
            { text: "Prepare your ingredients with fresh care.", timer: 5 }
          ]
        },
        { type: "tip", text: "Always cook with patience and warm love!" }
      ]
    };
    setSelectedRecipe(newRecipe);
    setOriginalSlug(null);
    setViewMode("edit");
  };

  const handleEdit = (recipe: Recipe) => {
    setSelectedRecipe(JSON.parse(JSON.stringify(recipe))); // deep copy
    setOriginalSlug(recipe.slug);
    setViewMode("edit");
  };

  const handleDuplicate = async (slug: string) => {
    const res = await duplicateRecipe(passphrase, slug);
    if (res.success) {
      loadRecipes(passphrase);
    } else {
      alert(res.error || "Failed to duplicate");
    }
  };

  const handleDelete = async (slug: string) => {
    if (confirm(`Are you absolutely sure you want to delete "${slug}"?`)) {
      const res = await deleteRecipe(passphrase, slug);
      if (res.success) {
        loadRecipes(passphrase);
      } else {
        alert(res.error || "Failed to delete");
      }
    }
  };

  const handleSave = async () => {
    if (!selectedRecipe) return;
    if (!selectedRecipe.slug || selectedRecipe.slug.trim() === "") {
      alert("Recipe slug is required!");
      return;
    }

    const res = await saveRecipe(passphrase, selectedRecipe.slug, originalSlug, selectedRecipe);
    if (res.success) {
      alert("Recipe saved successfully!");
      loadRecipes(passphrase);
      setViewMode("list");
      setSelectedRecipe(null);
    } else {
      alert(res.error || "Failed to save recipe");
    }
  };

  // Block Helpers
  const addBlock = (type: string) => {
    if (!selectedRecipe) return;
    let newBlock: any = { type };
    if (type === "ingredients") {
      newBlock.sections = [{ heading: "Ingredients Section", items: [{ qty: 1, unit: "unit", item: "Item Name" }] }];
    } else if (type === "steps") {
      newBlock.items = [{ text: "Step Instruction", timer: null }];
    } else if (type === "gallery") {
      newBlock.images = [{ src: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop", caption: "Process shot" }];
    } else if (type === "video") {
      newBlock.src = "";
    } else if (type === "related") {
      newBlock.slugs = [];
    } else {
      newBlock.text = "Write your content here.";
    }

    setSelectedRecipe({
      ...selectedRecipe,
      blocks: [...(selectedRecipe.blocks || []), newBlock]
    });
  };

  const deleteBlock = (bIdx: number) => {
    if (!selectedRecipe || !selectedRecipe.blocks) return;
    const nextBlocks = [...selectedRecipe.blocks];
    nextBlocks.splice(bIdx, 1);
    setSelectedRecipe({ ...selectedRecipe, blocks: nextBlocks });
  };

  const moveBlock = (bIdx: number, direction: "up" | "down") => {
    if (!selectedRecipe || !selectedRecipe.blocks) return;
    const nextBlocks = [...selectedRecipe.blocks];
    const targetIdx = direction === "up" ? bIdx - 1 : bIdx + 1;
    if (targetIdx < 0 || targetIdx >= nextBlocks.length) return;
    
    // Swap
    const temp = nextBlocks[bIdx];
    nextBlocks[bIdx] = nextBlocks[targetIdx];
    nextBlocks[targetIdx] = temp;
    
    setSelectedRecipe({ ...selectedRecipe, blocks: nextBlocks });
  };

  // Template/JSON file import prefiller
  const handleJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.title && parsed.slug) {
          setSelectedRecipe(parsed);
          alert("JSON template imported successfully!");
        } else {
          alert("Invalid recipe format! Missing title or slug.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  // Download active editing recipe layout as a JSON file
  const handleExportJSON = () => {
    if (!selectedRecipe) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedRecipe, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${selectedRecipe.slug}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download all recipes as a single backup JSON file
  const handleExportAllJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recipes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "cozy-kitchen-all-recipes-backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter recipes for list
  const filteredRecipes = recipes.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      filterCategory === "All" || r.categories.includes(filterCategory);
    return matchesSearch && matchesCategory;
  });

  // Unique categories list
  const categories = ["All", ...Array.from(new Set(recipes.flatMap((r) => r.categories))).filter((cat) => cat !== "All")];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background-cream text-on-surface flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-repeat" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }} />
        
        <form onSubmit={handleLogin} className="max-w-md w-full bg-surface-bright border border-sand-border p-8 rounded-xl warm-shadow flex flex-col gap-6 text-center select-none">
          <div className="w-16 h-16 rounded-full bg-surface-soft border border-sand-border flex items-center justify-center text-primary mx-auto transform -rotate-6">
            <span className="material-symbols-outlined text-3xl">key</span>
          </div>
          <div>
            <h1 className="font-fraunces text-2xl italic text-primary font-semibold mb-1">Owner Workspace</h1>
            <p className="font-body-sm text-body-sm text-brown-muted">Enter passphrase to access visual recipe dashboard.</p>
          </div>
          
          <input
            type="password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full bg-surface-soft border border-sand-border focus:border-primary outline-none px-4 py-3 rounded-full text-center text-body-md placeholder:text-brown-muted/70 text-on-surface focus:ring-0"
            required
            autoFocus
          />
          
          {loginError && <p className="text-red-500 font-body-sm text-body-sm -mt-2 font-medium">{loginError}</p>}
          
          <button
            type="submit"
            className="w-full bg-secondary text-white font-bold font-body-md py-3 rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md cursor-pointer"
          >
            Authenticate
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-cream text-on-surface flex flex-col relative select-none">
      
      {/* Header bar */}
      <header className="h-20 border-b border-sand-border/50 bg-surface-bright flex justify-between items-center px-6 shadow-sm z-30">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">workspace_premium</span>
          <span className="font-fraunces text-headline-sm italic font-semibold text-primary">Cozy Kitchen Admin</span>
        </div>
        
        <div className="flex items-center gap-3">
          {viewMode === "edit" && (
            <button
              onClick={() => {
                setViewMode("list");
                setSelectedRecipe(null);
              }}
              className="bg-surface-soft hover:bg-sand/30 border border-sand-border px-5 py-2 rounded-full font-bold font-body-sm text-body-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm font-bold">arrow_back</span>
              <span>Back to List</span>
            </button>
          )}
          
          <button
            onClick={handleLogout}
            className="bg-secondary text-white hover:bg-secondary/90 px-5 py-2 rounded-full font-bold font-body-sm text-body-sm flex items-center gap-2 cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LIST VIEW MODE */}
        {viewMode === "list" && (
          <div className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col gap-6">
            
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-sand-border/30 pb-4">
              <div>
                <h1 className="font-fraunces text-headline-lg italic font-semibold text-primary">Recipe Locker</h1>
                <p className="font-body-sm text-body-sm text-brown-muted">Manage your drafts, publishings, and recipe layouts.</p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={handleExportAllJSON}
                  className="bg-surface-bright hover:bg-surface-soft border border-sand-border text-brown-mid font-semibold font-body-md px-6 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined">download</span>
                  <span>Export All Backup</span>
                </button>

                <button
                  onClick={handleCreateNew}
                  className="bg-secondary text-white font-bold font-body-md px-6 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined">add</span>
                  <span>Create New Recipe</span>
                </button>
              </div>
            </div>

            {/* Split layout: Grid on left, Homepage Settings on right */}
            <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
              
              {/* Left Column: Recipe Grid & Filters */}
              <div className="flex-1 w-full flex flex-col gap-6">
                {/* Filter Drawer */}
                <div className="flex flex-wrap gap-stack-md bg-surface-bright border border-sand-border p-4 rounded-xl warm-shadow">
                  <div className="relative w-full sm:w-[350px]">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-brown-muted text-xl">search</span>
                    <input
                      type="text"
                      placeholder="Search recipe locker..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-surface-soft border border-sand-border focus:border-primary outline-none py-2 pl-12 pr-4 rounded-full font-body-sm text-body-sm text-on-surface"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-label-caps text-label-caps text-brown-muted font-bold">CATEGORY:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setFilterCategory(cat)}
                          className={`px-3 py-1.5 rounded-full font-body-sm text-[12px] transition-all cursor-pointer ${
                            filterCategory === cat
                              ? "bg-primary text-white"
                              : "bg-surface-soft hover:bg-sand border border-sand-border text-brown-mid"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Grid display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter-grid items-start">
                  {filteredRecipes.map((recipe) => (
                    <div key={recipe.slug} className="bg-surface-bright border border-sand-border rounded-xl p-5 warm-shadow flex flex-col justify-between h-[280px] hover:translate-y-[-2px] transition-transform">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`px-2.5 py-0.5 rounded-full font-label-caps text-[10px] uppercase font-bold tracking-wider ${
                            recipe.status === "published"
                              ? "bg-herb-light text-tertiary"
                              : "bg-terracotta-light text-secondary"
                          }`}>
                            {recipe.status}
                          </span>
                          <span className="font-mono text-[11px] text-brown-muted">{recipe.difficulty} · {recipe.prepTime + recipe.cookTime}m</span>
                        </div>

                        <h3 className="font-fraunces text-xl italic font-semibold text-primary mb-2 line-clamp-1">{recipe.title}</h3>
                        <p className="font-body-sm text-body-sm text-brown-mid line-clamp-3 mb-4">{recipe.description}</p>
                      </div>

                      <div className="border-t border-sand-border/30 pt-3 flex gap-2 justify-end">
                        <button
                          onClick={() => handleDuplicate(recipe.slug)}
                          className="p-2 hover:bg-surface-soft text-primary border border-sand-border rounded-full cursor-pointer flex items-center justify-center"
                          title="Duplicate"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">content_copy</span>
                        </button>
                        <button
                          onClick={() => handleDelete(recipe.slug)}
                          className="p-2 hover:bg-surface-soft text-red-600 border border-sand-border rounded-full cursor-pointer flex items-center justify-center"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">delete</span>
                        </button>
                        <Link
                          href={`/recipes/${recipe.slug}`}
                          target="_blank"
                          className="p-2 hover:bg-surface-soft text-brown-mid border border-sand-border rounded-full cursor-pointer flex items-center justify-center"
                          title="Open page"
                        >
                          <span className="material-symbols-outlined text-sm font-bold">visibility</span>
                        </Link>
                        <button
                          onClick={() => handleEdit(recipe)}
                          className="bg-secondary text-white px-5 py-1.5 rounded-full font-bold font-body-sm text-[12px] hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                        >
                          Open Editor
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredRecipes.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-surface-bright border border-sand-border rounded-xl warm-shadow">
                      <span className="material-symbols-outlined text-5xl text-brown-muted animate-pulse">kitchen</span>
                      <p className="font-fraunces text-xl italic text-primary mt-2">No recipes found matching current filters.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Homepage Display Settings Sidebar */}
              <aside className="w-full xl:w-[380px] bg-surface-bright border border-sand-border p-6 rounded-xl warm-shadow flex flex-col gap-6 flex-shrink-0">
                <div>
                  <h2 className="font-fraunces text-2xl italic font-semibold text-primary mb-1">Display Curator</h2>
                  <p className="font-body-sm text-body-sm text-brown-muted">Choose which recipes to feature on your homepage showcase and daily pick.</p>
                </div>

                <form onSubmit={handleSaveSettings} className="flex flex-col gap-5">
                  {/* Showcase selection */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="font-label-caps text-label-caps text-brown-muted font-bold">HOMEPAGE SHOWCASE (CHOOSE 3)</label>
                      <span className="font-mono text-[11px] font-bold text-secondary">{homeSettings.showcaseSlugs.length}/3</span>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto border border-sand-border rounded-lg p-3 bg-surface-soft/60">
                      {recipes.filter(r => r.status === "published").map((recipe) => {
                        const isSelected = homeSettings.showcaseSlugs.includes(recipe.slug);
                        return (
                          <label key={recipe.slug} className="flex items-center gap-2.5 p-1.5 hover:bg-sand/30 rounded cursor-pointer transition-colors text-body-sm font-semibold text-brown-mid select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isSelected && homeSettings.showcaseSlugs.length >= 3}
                              onChange={() => {
                                let nextSlugs = [...homeSettings.showcaseSlugs];
                                if (isSelected) {
                                  nextSlugs = nextSlugs.filter(s => s !== recipe.slug);
                                } else {
                                  if (nextSlugs.length < 3) {
                                    nextSlugs.push(recipe.slug);
                                  }
                                }
                                setHomeSettings({ ...homeSettings, showcaseSlugs: nextSlugs });
                              }}
                              className="rounded border-sand-border text-secondary focus:ring-secondary w-4 h-4 cursor-pointer"
                            />
                            <span className="line-clamp-1">{recipe.title}</span>
                          </label>
                        );
                      })}
                      {recipes.filter(r => r.status === "published").length === 0 && (
                        <p className="text-[12px] italic text-brown-muted text-center py-4">No published recipes available.</p>
                      )}
                    </div>
                    <p className="text-[10px] text-brown-muted italic">If fewer than 3 are selected, the showcase will dynamically rotate high-quality recipes daily.</p>
                  </div>

                  {/* Today's Pick Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-label-caps text-brown-muted font-bold">TODAY'S FEATURED PICK</label>
                    <select
                      value={homeSettings.todaysPickSlug || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHomeSettings({
                          ...homeSettings,
                          todaysPickSlug: val === "" ? null : val
                        });
                      }}
                      className="bg-surface-soft border border-sand-border focus:border-primary outline-none px-3 py-2.5 rounded-lg font-body-sm text-body-sm text-on-surface cursor-pointer w-full"
                    >
                      <option value="">-- Randomize Every Day (Daily Rotation) --</option>
                      {recipes.filter(r => r.status === "published").map((recipe) => (
                        <option key={recipe.slug} value={recipe.slug}>
                          {recipe.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-brown-muted italic">When daily rotation is enabled, Today's Pick rotates automatically every day based on the day of the month.</p>
                  </div>

                  {settingsError && (
                    <p className="text-red-500 font-body-sm text-[12px] font-semibold">{settingsError}</p>
                  )}

                  {settingsSuccess && (
                    <div className="bg-herb-light border border-tertiary/20 text-tertiary px-4 py-2.5 rounded-lg text-body-sm font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                      <span>Homepage display settings updated!</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full bg-secondary text-white font-bold font-body-md py-3 rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {isSavingSettings ? (
                      <>
                        <span className="animate-spin text-sm">hourglass_empty</span>
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span>Save Display Curator</span>
                      </>
                    )}
                  </button>
                </form>
              </aside>
            </div>
          </div>
        )}

        {/* TWO-PANEL WORKSPACE EDITOR MODE */}
        {viewMode === "edit" && selectedRecipe && (
          <div ref={containerRef} className="flex-1 flex flex-col md:flex-row overflow-hidden w-full relative">
            
            {/* LEFT PANEL: Dynamic Workspaces Editor Form */}
            <div 
              className="w-full md:flex-shrink-0 border-r border-sand-border/50 bg-surface-bright flex flex-col overflow-y-auto p-6 gap-6"
              style={{ width: isMobile ? "100%" : isFullscreenPreview ? "0%" : `${leftWidthPercent}%`, display: isFullscreenPreview ? "none" : "flex" }}
            >
              
              {/* Form header & importer */}
              <div className="flex justify-between items-center border-b border-sand-border/30 pb-3">
                <div>
                  <h2 className="font-fraunces text-2xl italic text-primary font-semibold">Workspace Editor</h2>
                  <p className="font-body-sm text-body-sm text-brown-muted">Customize layout blocks, contents, and settings.</p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="bg-surface-soft hover:bg-sand border border-sand-border px-3.5 py-1.5 rounded-full font-bold font-body-sm text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    <span>Import JSON</span>
                    <input type="file" accept=".json" onChange={handleJSONImport} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Basic Meta Block */}
              <div className="flex flex-col gap-4 border border-sand-border p-4 rounded-xl bg-surface-soft/60">
                <h3 className="font-label-caps text-label-caps text-brown-muted font-bold border-b border-sand-border/30 pb-1.5">BASIC DISH METADATA</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Title</label>
                    <input
                      type="text"
                      value={selectedRecipe.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        const newSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                        setSelectedRecipe({ ...selectedRecipe, title: newTitle, slug: newSlug });
                      }}
                      className="bg-surface-bright border border-sand-border focus:border-primary outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">URL Slug</label>
                    <input
                      type="text"
                      value={selectedRecipe.slug}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, slug: e.target.value })}
                      className="bg-surface-bright border border-sand-border focus:border-primary outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Description (Card teaser)</label>
                  <textarea
                    rows={2}
                    value={selectedRecipe.description}
                    onChange={(e) => setSelectedRecipe({ ...selectedRecipe, description: e.target.value })}
                    className="bg-surface-bright border border-sand-border focus:border-primary outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Prep Time (min)</label>
                    <input
                      type="number"
                      value={selectedRecipe.prepTime}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, prepTime: parseInt(e.target.value) || 0 })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Cook Time (min)</label>
                    <input
                      type="number"
                      value={selectedRecipe.cookTime}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, cookTime: parseInt(e.target.value) || 0 })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Servings</label>
                    <input
                      type="number"
                      value={selectedRecipe.servings}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, servings: parseInt(e.target.value) || 0 })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Difficulty</label>
                    <select
                      value={selectedRecipe.difficulty}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, difficulty: e.target.value })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid flex justify-between items-center select-none">
                      <span>Cover Image URL</span>
                      <label className="text-[10px] text-secondary font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[12px] font-bold">cloud_upload</span>
                        <span>Upload Direct</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e, (url) => {
                            setSelectedRecipe({ ...selectedRecipe, coverImage: url });
                          })}
                        />
                      </label>
                    </label>
                    <input
                      type="text"
                      value={selectedRecipe.coverImage}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, coverImage: e.target.value })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Status</label>
                    <select
                      value={selectedRecipe.status}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, status: e.target.value })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    >
                      <option value="draft">Draft (Admin Locker only)</option>
                      <option value="published">Published (Public binder)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Categories (comma sep)</label>
                    <input
                      type="text"
                      value={selectedRecipe.categories.join(", ")}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, categories: e.target.value.split(",").map(c => c.trim()) })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-body-sm text-[12px] font-semibold text-brown-mid">Tags (comma sep)</label>
                    <input
                      type="text"
                      value={selectedRecipe.tags?.join(", ") || ""}
                      onChange={(e) => setSelectedRecipe({ ...selectedRecipe, tags: e.target.value.split(",").map(t => t.trim()) })}
                      className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Block Editor list */}
              <div className="flex flex-col gap-4">
                <h3 className="font-label-caps text-label-caps text-brown-muted font-bold border-b border-sand-border/30 pb-1.5">REORDER & CUSTOMIZE LAYOUT BLOCKS</h3>
                
                <div className="space-y-4">
                  {selectedRecipe.blocks?.map((block, bIdx) => (
                    <div key={bIdx} className="border border-sand-border rounded-xl bg-surface p-4 flex flex-col gap-3 warm-shadow">
                      {/* Block Controls Header */}
                      <div className="flex justify-between items-center bg-surface-soft dark:bg-dark-surface p-2 rounded-lg border border-sand-border/30">
                        <span className="font-label-caps text-[11px] font-bold text-secondary uppercase">
                          BLOCK {bIdx + 1}: {block.type}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => moveBlock(bIdx, "up")}
                            disabled={bIdx === 0}
                            className="p-1 hover:bg-sand border border-sand-border rounded text-brown-muted disabled:opacity-20 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                          </button>
                          <button
                            onClick={() => moveBlock(bIdx, "down")}
                            disabled={bIdx === (selectedRecipe.blocks?.length || 1) - 1}
                            className="p-1 hover:bg-sand border border-sand-border rounded text-brown-muted disabled:opacity-20 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                          </button>
                          <button
                            onClick={() => deleteBlock(bIdx)}
                            className="p-1 hover:bg-red-50 text-red-600 border border-red-200 rounded cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Dynamic form inputs based on type */}
                      {block.type === "intro" && (
                        <textarea
                          rows={3}
                          value={block.text}
                          onChange={(e) => {
                            const blocksCopy = [...(selectedRecipe.blocks || [])];
                            blocksCopy[bIdx].text = e.target.value;
                            setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                          }}
                          className="w-full bg-surface-bright border border-sand-border focus:border-primary outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                        />
                      )}

                      {block.type === "hero-image" && (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center select-none">
                            <span className="font-body-sm text-[11px] font-semibold text-brown-mid">Image Source & Alt Description</span>
                            <label className="text-[10px] text-secondary font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px] font-bold">cloud_upload</span>
                              <span>Upload File</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImageUpload(e, (url) => {
                                  const blocksCopy = [...(selectedRecipe.blocks || [])];
                                  blocksCopy[bIdx].src = url;
                                  setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                })}
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="Image URL"
                              value={block.src}
                              onChange={(e) => {
                                const blocksCopy = [...(selectedRecipe.blocks || [])];
                                blocksCopy[bIdx].src = e.target.value;
                                setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                              }}
                              className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                            />
                            <input
                              type="text"
                              placeholder="Alt description"
                              value={block.alt}
                              onChange={(e) => {
                                const blocksCopy = [...(selectedRecipe.blocks || [])];
                                blocksCopy[bIdx].alt = e.target.value;
                                setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                              }}
                              className="bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                            />
                          </div>
                        </div>
                      )}

                      {(block.type === "tip" || block.type === "note") && (
                        <textarea
                          rows={3}
                          value={block.text}
                          onChange={(e) => {
                            const blocksCopy = [...(selectedRecipe.blocks || [])];
                            blocksCopy[bIdx].text = e.target.value;
                            setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                          }}
                          className="w-full bg-surface-bright border border-sand-border focus:border-primary outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                        />
                      )}

                      {block.type === "meta-bar" && (
                        <p className="font-body-sm text-body-sm text-brown-muted italic">Automatically populated from basic details.</p>
                      )}

                      {block.type === "ingredients" && (
                        <div className="space-y-4">
                          {block.sections?.map((sec: any, secIdx: number) => (
                            <div key={secIdx} className="border border-sand-border/50 bg-surface-soft/60 p-3 rounded-lg flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <input
                                  type="text"
                                  value={sec.heading}
                                  placeholder="Section title"
                                  onChange={(e) => {
                                    const blocksCopy = [...(selectedRecipe.blocks || [])];
                                    blocksCopy[bIdx].sections[secIdx].heading = e.target.value;
                                    setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                  }}
                                  className="bg-surface-bright border border-sand-border outline-none px-2.5 py-1 rounded font-bold font-body-sm text-[12px] text-primary"
                                />
                                <button
                                  onClick={() => {
                                    const blocksCopy = [...(selectedRecipe.blocks || [])];
                                    blocksCopy[bIdx].sections.splice(secIdx, 1);
                                    setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                  }}
                                  className="text-red-500 hover:underline font-body-sm text-[12px] cursor-pointer"
                                >
                                  Remove Section
                                </button>
                              </div>

                              <div className="space-y-2">
                                {sec.items?.map((item: any, itemIdx: number) => (
                                  <div key={itemIdx} className="grid grid-cols-12 gap-1.5 items-center">
                                    <input
                                      type="number"
                                      step="any"
                                      placeholder="Qty"
                                      value={item.qty || ""}
                                      onChange={(e) => {
                                        const blocksCopy = [...(selectedRecipe.blocks || [])];
                                        blocksCopy[bIdx].sections[secIdx].items[itemIdx].qty = parseFloat(e.target.value) || null;
                                        setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                      }}
                                      className="col-span-3 bg-surface-bright border border-sand-border outline-none px-2 py-1 rounded font-mono text-[12px]"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Unit"
                                      value={item.unit || ""}
                                      onChange={(e) => {
                                        const blocksCopy = [...(selectedRecipe.blocks || [])];
                                        blocksCopy[bIdx].sections[secIdx].items[itemIdx].unit = e.target.value;
                                        setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                      }}
                                      className="col-span-3 bg-surface-bright border border-sand-border outline-none px-2 py-1 rounded font-mono text-[12px]"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Ingredient name"
                                      value={item.item || ""}
                                      onChange={(e) => {
                                        const blocksCopy = [...(selectedRecipe.blocks || [])];
                                        blocksCopy[bIdx].sections[secIdx].items[itemIdx].item = e.target.value;
                                        setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                      }}
                                      className="col-span-5 bg-surface-bright border border-sand-border outline-none px-2 py-1 rounded font-body-sm text-[12px]"
                                    />
                                    <button
                                      onClick={() => {
                                        const blocksCopy = [...(selectedRecipe.blocks || [])];
                                        blocksCopy[bIdx].sections[secIdx].items.splice(itemIdx, 1);
                                        setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                      }}
                                      className="col-span-1 text-red-500 hover:text-red-700 flex items-center justify-center font-bold cursor-pointer"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <button
                                onClick={() => {
                                  const blocksCopy = [...(selectedRecipe.blocks || [])];
                                  blocksCopy[bIdx].sections[secIdx].items.push({ qty: 1, unit: "unit", item: "New item" });
                                  setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                }}
                                className="text-secondary hover:underline font-body-sm text-[12px] self-start mt-1 cursor-pointer font-semibold"
                              >
                                + Add Ingredient
                              </button>
                            </div>
                          ))}

                          <button
                            onClick={() => {
                              const blocksCopy = [...(selectedRecipe.blocks || [])];
                              blocksCopy[bIdx].sections.push({ heading: "New Section", items: [] });
                              setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                            }}
                            className="bg-primary text-white px-4 py-1.5 rounded-full font-bold font-body-sm text-[11px] hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                          >
                            + Add Ingredients Section
                          </button>
                        </div>
                      )}

                      {block.type === "steps" && (
                        <div className="space-y-3">
                          {block.items?.map((item: any, sIdx: number) => (
                            <div key={sIdx} className="border border-sand-border/30 bg-surface-soft/40 p-3 rounded-lg flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="font-label-caps text-[10px] font-bold text-brown-muted">STEP {sIdx + 1}</span>
                                <button
                                  onClick={() => {
                                    const blocksCopy = [...(selectedRecipe.blocks || [])];
                                    blocksCopy[bIdx].items.splice(sIdx, 1);
                                    setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                  }}
                                  className="text-red-500 hover:underline font-body-sm text-[12px] cursor-pointer"
                                >
                                  Remove Step
                                </button>
                              </div>

                              <textarea
                                rows={2}
                                value={item.text}
                                onChange={(e) => {
                                  const blocksCopy = [...(selectedRecipe.blocks || [])];
                                  blocksCopy[bIdx].items[sIdx].text = e.target.value;
                                  setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                }}
                                className="w-full bg-surface-bright border border-sand-border outline-none px-2.5 py-1.5 rounded font-body-sm text-[12px]"
                              />

                              <div className="flex items-center gap-2">
                                <span className="font-body-sm text-[11px] text-brown-muted font-medium">Timer duration (minutes, optional):</span>
                                <input
                                  type="number"
                                  placeholder="No timer"
                                  value={item.timer || ""}
                                  onChange={(e) => {
                                    const blocksCopy = [...(selectedRecipe.blocks || [])];
                                    blocksCopy[bIdx].items[sIdx].timer = parseInt(e.target.value) || null;
                                    setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                  }}
                                  className="bg-surface-bright border border-sand-border outline-none px-2 py-1 rounded w-20 font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          ))}

                          <button
                            onClick={() => {
                              const blocksCopy = [...(selectedRecipe.blocks || [])];
                              blocksCopy[bIdx].items.push({ text: "Next recipe step instruction", timer: null });
                              setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                            }}
                            className="bg-primary text-white px-4 py-1.5 rounded-full font-bold font-body-sm text-[11px] hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer inline-block"
                          >
                            + Add Method Step
                          </button>
                        </div>
                      )}

                      {block.type === "gallery" && (
                        <div className="space-y-3">
                          {block.images?.map((img: any, gIdx: number) => (
                            <div key={gIdx} className="flex flex-col gap-2 border border-sand-border/40 p-3 rounded-lg bg-surface-soft/60">
                              <div className="flex justify-between items-center select-none">
                                <span className="font-body-sm text-[11px] font-semibold text-brown-muted">Gallery Image {gIdx + 1}</span>
                                <label className="text-[10px] text-secondary font-bold hover:underline cursor-pointer flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px] font-bold">cloud_upload</span>
                                  <span>Upload File</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleImageUpload(e, (url) => {
                                      const blocksCopy = [...(selectedRecipe.blocks || [])];
                                      blocksCopy[bIdx].images[gIdx].src = url;
                                      setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                    })}
                                  />
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  placeholder="Image URL"
                                  value={img.src}
                                  onChange={(e) => {
                                    const blocksCopy = [...(selectedRecipe.blocks || [])];
                                    blocksCopy[bIdx].images[gIdx].src = e.target.value;
                                    setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                  }}
                                  className="bg-surface-bright border border-sand-border outline-none px-2.5 py-1.5 rounded font-body-sm text-[11px]"
                                />
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    type="text"
                                    placeholder="Caption"
                                    value={img.caption}
                                    onChange={(e) => {
                                      const blocksCopy = [...(selectedRecipe.blocks || [])];
                                      blocksCopy[bIdx].images[gIdx].caption = e.target.value;
                                      setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                    }}
                                    className="bg-surface-bright border border-sand-border outline-none px-2.5 py-1.5 rounded font-body-sm text-[11px] flex-1"
                                  />
                                  <button
                                    onClick={() => {
                                      const blocksCopy = [...(selectedRecipe.blocks || [])];
                                      blocksCopy[bIdx].images.splice(gIdx, 1);
                                      setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                                    }}
                                    className="text-red-500 font-bold cursor-pointer text-sm"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          <button
                            onClick={() => {
                              const blocksCopy = [...(selectedRecipe.blocks || [])];
                              blocksCopy[bIdx].images.push({ src: "", caption: "" });
                              setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                            }}
                            className="text-secondary hover:underline font-body-sm text-[12px] font-semibold cursor-pointer"
                          >
                            + Add Gallery Image
                          </button>
                        </div>
                      )}

                      {block.type === "video" && (
                        <input
                          type="text"
                          placeholder="Paste YouTube Video URL"
                          value={block.src}
                          onChange={(e) => {
                            const blocksCopy = [...(selectedRecipe.blocks || [])];
                            blocksCopy[bIdx].src = e.target.value;
                            setSelectedRecipe({ ...selectedRecipe, blocks: blocksCopy });
                          }}
                          className="w-full bg-surface-bright border border-sand-border outline-none px-3 py-2 rounded-lg font-body-sm text-body-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Block Selector Panel */}
                <div className="border border-sand-border border-dashed p-5 rounded-xl bg-surface-soft/40 text-center flex flex-col gap-3">
                  <span className="font-label-caps text-label-caps text-brown-muted font-bold">ADD NEW WORKSPACE BLOCK</span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {["hero-image", "intro", "meta-bar", "ingredients", "steps", "tip", "note", "gallery", "video", "divider", "related"].map((t) => (
                      <button
                        key={t}
                        onClick={() => addBlock(t)}
                        className="bg-surface-bright hover:bg-sand border border-sand-border px-3 py-1.5 rounded-full font-body-sm text-[11px] text-brown-mid font-semibold cursor-pointer active:scale-95 transition-all shadow-sm"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-sand-border/30 pt-4 flex justify-between gap-4 select-none">
                <button
                  onClick={() => {
                    setViewMode("list");
                    setSelectedRecipe(null);
                  }}
                  className="bg-surface-soft hover:bg-sand/30 border border-sand-border px-6 py-3 rounded-full font-bold font-body-md text-body-md text-brown-muted cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={handleExportJSON}
                    className="bg-surface-bright hover:bg-surface-soft border border-sand-border px-6 py-3 rounded-full font-bold font-body-md text-body-md text-brown-mid cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm animate-bounce">download</span>
                    <span>Export JSON</span>
                  </button>

                  <button
                    onClick={handleSave}
                    className="bg-secondary text-white font-bold font-body-md px-8 py-3 rounded-full hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">save</span>
                    <span>Save Layout JSON</span>
                  </button>
                </div>
              </div>
            </div>
            {/* DIVIDER SPLITTER BAR */}
            {!isFullscreenPreview && (
              <div
                onMouseDown={startResizing}
                className={`hidden md:block w-1.5 hover:w-2 bg-sand-border/30 hover:bg-secondary/40 cursor-col-resize transition-all active:bg-secondary/70 select-none z-20 flex-shrink-0 border-l border-r border-sand-border/10 ${
                  isResizing ? "bg-secondary/50 w-2.5" : ""
                }`}
                title="Drag to resize panels"
              />
            )}

            {/* RIGHT PANEL: True Real-Time Live Preview Simulator */}
            <div 
              className="w-full bg-background flex flex-col border-l border-sand-border/30 overflow-hidden relative"
              style={{ width: isMobile ? "100%" : isFullscreenPreview ? "100%" : `${100 - leftWidthPercent}%` }}
            >
              
              {/* Simulator width/view controls */}
              <div className="h-14 bg-surface-soft border-b border-sand-border/30 px-6 flex justify-between items-center z-10 print:hidden select-none">
                <span className="font-label-caps text-label-caps text-brown-muted font-bold">100% REAL-TIME LIVE PREVIEW</span>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-surface-bright border border-sand-border rounded-full p-1 shadow-sm">
                    {(["desktop", "tablet", "mobile"] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => setPreviewWidth(w)}
                        className={`px-3 py-1 rounded-full font-body-sm text-[11px] font-bold uppercase transition-all cursor-pointer ${
                          previewWidth === w
                            ? "bg-secondary text-white shadow-sm"
                            : "text-brown-muted hover:text-primary"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                    className="bg-surface-bright hover:bg-sand border border-sand-border p-2 rounded-full font-bold font-body-sm text-[12px] flex items-center justify-center cursor-pointer transition-colors shadow-sm text-brown-muted hover:text-primary"
                    title={isFullscreenPreview ? "Split View" : "Fullscreen Preview"}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {isFullscreenPreview ? "splitscreen" : "fullscreen"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Simulator Frame Container */}
              <div className="flex-1 overflow-y-auto p-6 bg-background-cream/50 flex justify-center items-start">
                <div
                  className={`bg-background text-on-surface warm-shadow border border-sand-border/60 transition-all duration-300 rounded-xl overflow-hidden h-[98%] max-h-[850px] ${
                    previewWidth === "desktop"
                      ? "w-full max-w-full"
                      : previewWidth === "tablet"
                      ? "w-[768px] max-w-full"
                      : "w-[390px] max-w-full"
                  }`}
                >
                  <iframe
                    ref={iframeRef}
                    src="/admin/preview"
                    className="w-full h-full border-none bg-background"
                    title="Cozy Kitchen Live Preview Simulator"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Dynamic Image Upload Status Notifications */}
      {isUploading && (
        <div className="fixed bottom-6 right-6 bg-secondary text-white px-5 py-3 rounded-full font-bold shadow-lg z-50 flex items-center gap-2 animate-bounce select-none">
          <span className="material-symbols-outlined animate-spin text-sm">hourglass_empty</span>
          <span className="text-[12px] font-body-sm">Uploading Image to Vercel Blob...</span>
        </div>
      )}
      {uploadError && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-5 py-3 rounded-full font-bold shadow-lg z-50 flex items-center gap-2 select-none">
          <span className="material-symbols-outlined text-sm">error</span>
          <span className="text-[12px] font-body-sm">{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-white hover:text-red-200 ml-1 font-bold text-sm">×</button>
        </div>
      )}

    </div>
  );
}
