import { motion } from "framer-motion";
import { useThemeStore, type ThemeMode } from "@/stores/theme-store";

export function DisplaySettingsSection() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
    { value: "light", label: "ライトモード", description: "明るい作業環境向け" },
    { value: "dark", label: "ダークモード", description: "暗い作業環境向け" },
    { value: "system", label: "自動", description: "システム設定に従う" },
  ];

  return (
    <motion.section
      className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <h3 className="text-lg font-semibold text-white">表示設定</h3>
      <p className="mt-1 text-sm text-slate-400">アプリ全体のテーマモードを切り替えます。</p>
      <div className="mt-5 grid gap-4">
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-sm font-semibold text-white">テーマモード</h4>
              <p className="mt-1 text-xs text-slate-500">初期設定はライトモードです。自動ではPCの外観設定に追従します。</p>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-emerald-400/25 dark:bg-emerald-400/[0.10] dark:text-emerald-300">
              {theme === "system" ? "自動" : theme === "dark" ? "ダークモード" : "ライトモード"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`rounded-xl border p-3 text-left transition ${
                  theme === option.value
                    ? "border-emerald-500/70 bg-emerald-100 text-slate-800 shadow-lg shadow-emerald-950/10 dark:border-emerald-400/70 dark:bg-emerald-400/[0.14] dark:text-white dark:shadow-emerald-950/20"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/[0.06]"
                }`}
                aria-pressed={theme === option.value}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`grid size-4 place-items-center rounded-full border ${theme === option.value ? "border-emerald-500 dark:border-emerald-300" : "border-slate-500"}`}>
                    {theme === option.value && <span className="size-2 rounded-full bg-emerald-300" />}
                  </span>
                  {option.label}
                </span>
                <span className="mt-1 block text-xs text-slate-700 dark:text-slate-500">{option.description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </motion.section>
  );
}
