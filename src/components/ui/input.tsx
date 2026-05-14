import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white shadow-inner shadow-black/10 outline-none transition file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 hover:border-white/15 focus:border-emerald-400/60 focus:bg-white/[0.075] focus:ring-3 focus:ring-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
