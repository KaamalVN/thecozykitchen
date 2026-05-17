"use client";

interface FooterProps {
  onSelectCategory: (category: string) => void;
}

export default function Footer({ onSelectCategory }: FooterProps) {
  const categories = [
    { label: "Egg Dishes", value: "Egg Dishes" },
    { label: "Rice", value: "Rice" },
    { label: "Snacks", value: "Snacks" },
    { label: "Curries", value: "Curries" },
    { label: "All", value: "All" },
  ];

  return (
    <footer className="w-full py-stack-lg mt-section-gap bg-surface-container-low dark:bg-dark-surface border-t border-sand-border/30 dark:border-brown-muted/10 flex flex-col items-center gap-stack-md text-center px-margin-page select-none">
      <div
        onClick={() => onSelectCategory("All")}
        className="font-headline-sm text-headline-sm italic text-secondary dark:text-secondary-fixed cursor-pointer font-semibold font-fraunces"
      >
        The Cozy Kitchen
      </div>
      <div className="flex flex-wrap justify-center gap-6">
        {categories.map((cat) => (
          <a
            key={cat.value}
            href="#recipes"
            onClick={() => onSelectCategory(cat.value)}
            className="text-brown-muted dark:text-outline hover:text-primary dark:hover:text-primary-fixed transition-colors hover:underline decoration-terracotta-light underline-offset-4 font-body-sm text-body-sm cursor-pointer"
          >
            {cat.label}
          </a>
        ))}
      </div>
      <div className="font-body-sm text-body-sm text-brown-mid dark:text-surface-variant max-w-[40ch] mt-2 opacity-80">
        © {new Date().getFullYear()} The Cozy Kitchen. Made with love, real cumin, and slightly messy counters.
      </div>
    </footer>
  );
}
