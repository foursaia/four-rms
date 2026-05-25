import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-background hover:bg-primary-dark shadow-[0_0_15px_rgba(234,179,8,0.3)]",
      secondary: "bg-surface-lighter text-foreground hover:bg-surface border border-border",
      outline: "border-2 border-primary text-primary hover:bg-primary/10",
      ghost: "hover:bg-surface-lighter text-muted hover:text-foreground",
      accent: "bg-accent text-white hover:opacity-90 shadow-[0_0_15px_rgba(249,115,22,0.3)]",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-6 py-2.5",
      lg: "px-8 py-3.5 text-lg font-semibold",
      xl: "px-10 py-4 text-xl font-bold rounded-2xl",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
