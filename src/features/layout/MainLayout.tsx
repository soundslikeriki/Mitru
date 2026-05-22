import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Header } from "@/features/layout/Header";
import { DesktopSidebar } from "@/features/layout/Sidebar";

export function MainLayout({
  children,
  onAboutOpen,
  resolvedTheme,
}: {
  children: ReactNode;
  onAboutOpen: () => void;
  resolvedTheme: "light" | "dark";
}) {
  return (
    <div className={`${resolvedTheme === "dark" ? "dark bg-[#0F172A] text-slate-100" : "light bg-slate-100 text-slate-950"} h-screen overflow-hidden transition-colors`}>
      <div aria-hidden="true" className={`pointer-events-none fixed inset-0 transition-colors ${
        resolvedTheme === "dark"
          ? "bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(30,58,138,0.42),transparent_32%),linear-gradient(135deg,#0F172A_0%,#111827_52%,#07111F_100%)]"
          : "bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.13),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(30,58,138,0.16),transparent_32%),linear-gradient(135deg,#F8FAFC_0%,#EEF2FF_50%,#ECFDF5_100%)]"
      }`} />
      <div className="relative z-10 flex h-screen overflow-hidden">
        <DesktopSidebar onAboutOpen={onAboutOpen} />

        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden md:pl-[280px]">
          <Header />
          <motion.main
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-8 lg:py-8"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: "easeOut" }}
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}
