"use client";

import { useMenuStore, Category } from "@/stores/menuStore";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface CategoryBarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryBar({ selectedId, onSelect }: CategoryBarProps) {
  const categories = useMenuStore((state) => state.categories);

  return (
    <div className="w-64 h-full flex flex-col gap-3 p-4 glass border-r border-border overflow-y-auto">
      <h2 className="text-xs font-black uppercase tracking-widest text-muted mb-4 px-2">Categories</h2>
      
      <button
        onClick={() => onSelect('all')}
        className={cn(
          "group flex items-center gap-4 p-3 rounded-2xl transition-all duration-300",
          selectedId === 'all' || !selectedId
            ? "bg-primary text-background shadow-lg shadow-primary/20"
            : "hover:bg-surface-lighter text-muted hover:text-foreground"
        )}
      >
        <div className="w-12 h-12 rounded-xl bg-surface-lighter flex items-center justify-center overflow-hidden border border-border group-hover:border-primary/50 transition-colors">
          <span className="text-xl">🍽️</span>
        </div>
        <span className="font-bold">All Items</span>
      </button>

      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            "group flex items-center gap-4 p-3 rounded-2xl transition-all duration-300",
            selectedId === cat.id
              ? "bg-primary text-background shadow-lg shadow-primary/20"
              : "hover:bg-surface-lighter text-muted hover:text-foreground"
          )}
        >
          <div className="w-12 h-12 rounded-xl bg-surface-lighter flex items-center justify-center overflow-hidden border border-border group-hover:border-primary/50 transition-colors relative">
            {cat.image_url ? (
              <Image src={cat.image_url} alt={cat.name} fill className="object-cover" />
            ) : (
              <span className="text-xl">🍔</span>
            )}
          </div>
          <span className="font-bold text-left">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
