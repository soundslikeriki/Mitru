import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold outline-none transition-all duration-200 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-2 border-emerald-600/80 bg-accent text-accent-foreground shadow-lg shadow-emerald-950/20 hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-400 hover:shadow-emerald-900/25 active:translate-y-0 dark:border-emerald-400/30 dark:shadow-emerald-950/30 dark:hover:border-emerald-300/50 dark:hover:shadow-emerald-900/35",
        ghost:
          "border border-transparent bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white active:bg-white/[0.08]",
        outline:
          "border-2 border-slate-300 bg-white text-slate-800 shadow-sm hover:border-emerald-500 hover:bg-emerald-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-200 dark:shadow-none dark:hover:border-emerald-400/30 dark:hover:bg-white/8 dark:hover:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
