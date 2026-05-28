import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronRight, Info, Menu } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { menuItems } from "@/features/layout/navigation";

export function DesktopSidebar({ onAboutOpen }: { onAboutOpen: () => void }) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const sidebar = (
    <aside
      data-testid="desktop-sidebar"
      className="pointer-events-auto fixed left-0 top-0 z-[2147483647] hidden h-screen w-[280px] isolate flex-col overflow-hidden border-r border-white/10 bg-slate-950/90 px-5 py-6 shadow-2xl shadow-black/30 backdrop-blur-2xl md:flex"
    >
      <Brand />
      <SidebarNav />
      <SidebarFooter onAboutOpen={onAboutOpen} />
    </aside>
  );

  return portalRoot ? createPortal(sidebar, portalRoot) : sidebar;
}

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="メニューを開く">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] border-white/10 bg-slate-950 p-5 text-white">
        <SheetHeader className="sr-only">
          <SheetTitle>Mitru ナビゲーション</SheetTitle>
        </SheetHeader>
        <Brand />
        <SidebarNav />
        <SidebarFooter onAboutOpen={() => window.dispatchEvent(new CustomEvent("mitru-about-open"))} />
      </SheetContent>
    </Sheet>
  );
}

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-3 px-1">
      <BrandLogo subtitle="建築見積・歩掛積算" animated />
    </Link>
  );
}

function SidebarNav() {
  const location = useLocation();

  return (
    <nav data-testid="sidebar-nav" className="mt-9 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
      {menuItems.map((item, index) => {
        const active =
          item.to === "/projects"
            ? location.pathname.startsWith("/projects")
            : item.to === "/masters" || item.to === "/settings"
              ? location.pathname.startsWith(item.to)
              : location.pathname === item.to;

        return (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
          >
            <NavLink
              to={item.to}
              className={`group flex min-h-14 w-full items-center justify-between rounded-lg px-3 py-2 transition ${
                active
                  ? "bg-emerald-50 text-slate-950 shadow-sm shadow-emerald-950/10 ring-1 ring-emerald-200 dark:bg-white dark:shadow-lg dark:shadow-black/20 dark:ring-0"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <item.icon
                  className={`size-4 shrink-0 ${
                    active ? "text-[#10B981]" : "text-slate-500 group-hover:text-emerald-400"
                  }`}
                />
                <span className="min-w-0 leading-none">
                  <span
                    className={`block truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      active ? "text-slate-500" : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                    }`}
                  >
                    {item.englishLabel}
                  </span>
                  <span
                    className={`mt-1 block truncate text-sm font-semibold ${
                      active ? "text-slate-950" : "text-slate-600 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white"
                    }`}
                  >
                    {item.label}
                  </span>
                </span>
              </span>
              {active && <ChevronRight className="size-4 text-slate-500" />}
            </NavLink>
          </motion.div>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onAboutOpen }: { onAboutOpen: () => void }) {
  return (
    <div className="mt-5 shrink-0 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={onAboutOpen}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-300 transition hover:border-emerald-400/30 hover:bg-white/[0.08] hover:text-white"
      >
        <Info className="size-4 text-emerald-300" />
        Mitruについて
      </button>
    </div>
  );
}
