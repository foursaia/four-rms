"use client";

import Image from "next/image";
import Link from "next/link";
import { Product } from "@/stores/menuStore";
import { Card } from "../ui/Card";
import { motion } from "framer-motion";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/kiosk/product/${product.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -8 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.3 }}
        className="cursor-pointer h-full"
      >
        <Card className="group h-full flex flex-col border-none glass-lighter hover:glass transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl">
            <Image
              src={product.image_url || "/placeholder-food.jpg"}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
          </div>

          <div className="p-6 flex flex-col flex-grow items-center text-center">
            <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            <p className="text-sm text-muted line-clamp-2 leading-relaxed">
              {product.description || "Freshly prepared with the finest ingredients."}
            </p>
            
            <div className="mt-6 w-8 h-1 bg-border group-hover:w-16 group-hover:bg-primary transition-all duration-500 rounded-full" />
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}
