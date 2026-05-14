import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 bg-white/85 p-1 text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-950/75 dark:text-slate-400",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-slate-300 bg-white/70 px-3 text-sm font-medium text-slate-600 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-2 data-[state=active]:border-[#1E3A8A] data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-[#1E3A8A]/15 data-[state=inactive]:hover:border-slate-400 data-[state=inactive]:hover:bg-slate-100 data-[state=inactive]:hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 dark:shadow-none dark:data-[state=active]:border-emerald-400/70 dark:data-[state=active]:bg-[#172F73] dark:data-[state=active]:text-white dark:data-[state=active]:shadow-lg dark:data-[state=active]:shadow-blue-950/30 dark:data-[state=active]:ring-emerald-400/25 dark:data-[state=inactive]:hover:border-white/20 dark:data-[state=inactive]:hover:bg-white/[0.07] dark:data-[state=inactive]:hover:text-white",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
