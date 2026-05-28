export function detailTabClass(active: boolean) {
  return active
    ? "relative rounded-md border-2 border-emerald-600 bg-emerald-600 text-white shadow-md ring-1 ring-emerald-600/15 dark:border-emerald-400/70 dark:bg-[#172F73] dark:text-white dark:shadow-lg dark:shadow-blue-950/30 dark:ring-emerald-400/25"
    : "relative rounded-md border border-slate-300 bg-white/70 text-slate-600 shadow-sm ring-0 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-white";
}
