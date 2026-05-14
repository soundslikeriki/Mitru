import { type ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type TaxDisplayMode,
  type TaxRoundingMode,
  type TaxSettings,
  useProjectStore,
} from "@/stores/project-store";
import { ToastMessage, type ToastState } from "@/features/shared/ToastMessage";

export function TaxSettingsSection() {
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const updateTaxSettings = useProjectStore((state) => state.updateTaxSettings);
  const [draft, setDraft] = useState<TaxSettings>(taxSettings);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    setDraft(taxSettings);
  }, [taxSettings]);

  const updateDraft = <TField extends keyof TaxSettings>(field: TField, value: TaxSettings[TField]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const saveSettings = () => {
    updateTaxSettings({
      standardTaxRate: draft.standardTaxRate,
      displayMode: draft.displayMode,
      reducedTaxEnabled: draft.reducedTaxEnabled,
      taxRoundingMode: draft.taxRoundingMode,
      totalRoundingMode: draft.totalRoundingMode,
      defaultWelfareRate: draft.defaultWelfareRate,
    });
    setToast({
      title: "税率設定を更新しました",
      description: "見積書・請求書・積算合計の税計算に反映されます。",
    });
    window.setTimeout(() => setToast(null), 3600);
  };

  return (
    <motion.section
      className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="grid gap-4">
        <TaxSettingsCard
          title="消費税率"
          description="見積書・請求書・積算合計の税計算に使用されます。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">標準税率</p>
              <div className="grid grid-cols-2 gap-2">
                {[0.08, 0.1].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => updateDraft("standardTaxRate", rate as 0.08 | 0.1)}
                    className={`h-11 rounded-xl border text-sm font-semibold transition ${
                      draft.standardTaxRate === rate
                        ? "border-emerald-400 bg-emerald-400/[0.16] text-slate-900 dark:text-emerald-200"
                        : "border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                    }`}
                  >
                    {Math.round(rate * 100)}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">表示形式</p>
              <select
                value={draft.displayMode}
                onChange={(event) => updateDraft("displayMode", event.target.value as TaxDisplayMode)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
              >
                <option value="taxIncluded" className="bg-slate-950 text-white">税込表示</option>
                <option value="taxExcluded" className="bg-slate-950 text-white">税抜表示</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                帳票や一覧で金額を確認するときの標準表示です。
              </p>
            </div>
          </div>
        </TaxSettingsCard>

        <TaxSettingsCard
          title="法定福利費"
          description="労務費に上乗せする健康保険・厚生年金・労災保険・雇用保険などの標準率です。新規の人件費行に初期値として反映されます。"
        >
          <label className="grid max-w-xs gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">標準法定福利費率</span>
            <div className="flex items-center gap-2">
              <input
                value={String(Math.round(draft.defaultWelfareRate * 1000) / 10)}
                inputMode="decimal"
                onChange={(event) => updateDraft("defaultWelfareRate", Number(event.target.value || 0) / 100)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>
            <p className="text-xs leading-5 text-slate-500">既存の積算行は各行の法定福利費率を編集できます。</p>
          </label>
        </TaxSettingsCard>

        <TaxSettingsCard
          title="軽減税率"
          description="食品や一部対象品目など、将来的に品目ごとへ税率を割り当てるための準備設定です。"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-300">軽減税率8%を有効にする</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                オンにすると、品目別税率選択の拡張に利用できます。
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.reducedTaxEnabled}
              onClick={() => updateDraft("reducedTaxEnabled", !draft.reducedTaxEnabled)}
              className={`relative h-8 w-14 rounded-full border transition ${
                draft.reducedTaxEnabled
                  ? "border-emerald-400 bg-emerald-500"
                  : "border-white/10 bg-white/[0.10]"
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-white shadow transition ${
                  draft.reducedTaxEnabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </TaxSettingsCard>

        <TaxSettingsCard
          title="端数処理"
          description="税額と税込合計を算出するときの丸め方法です。初期値は四捨五入です。"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <RoundingSelect
              label="税額の端数処理"
              value={draft.taxRoundingMode}
              onChange={(value) => updateDraft("taxRoundingMode", value)}
            />
            <RoundingSelect
              label="合計金額の端数処理"
              value={draft.totalRoundingMode}
              onChange={(value) => updateDraft("totalRoundingMode", value)}
            />
          </div>
        </TaxSettingsCard>
      </div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Current Tax Rule</p>
        <h3 className="mt-3 text-lg font-semibold text-white">現在の税率設定</h3>
        <div className="mt-5 space-y-3 text-sm">
          <TaxSummaryRow label="標準税率" value={`${Math.round(draft.standardTaxRate * 100)}%`} />
          <TaxSummaryRow label="法定福利費" value={`${Math.round(draft.defaultWelfareRate * 1000) / 10}%`} />
          <TaxSummaryRow label="表示形式" value={draft.displayMode === "taxIncluded" ? "税込表示" : "税抜表示"} />
          <TaxSummaryRow label="軽減税率" value={draft.reducedTaxEnabled ? "有効 / 8%" : "無効"} />
          <TaxSummaryRow label="税額端数" value={roundingModeLabel(draft.taxRoundingMode)} />
          <TaxSummaryRow label="合計端数" value={roundingModeLabel(draft.totalRoundingMode)} />
        </div>
        <Button className="mt-6 w-full gap-2" onClick={saveSettings}>
          <ShieldCheck className="size-4" />
          設定を保存
        </Button>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          保存後、積算・見積書・請求書の消費税計算へ即時反映されます。
        </p>
      </aside>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
  );
}

function TaxSettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function RoundingSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TaxRoundingMode;
  onChange: (value: TaxRoundingMode) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TaxRoundingMode)}
        className="h-11 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-emerald-400/60 focus:ring-3 focus:ring-emerald-400/15"
      >
        <option value="round" className="bg-slate-950 text-white">四捨五入</option>
        <option value="floor" className="bg-slate-950 text-white">切り捨て</option>
        <option value="ceil" className="bg-slate-950 text-white">切り上げ</option>
      </select>
    </label>
  );
}

function TaxSummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function roundingModeLabel(mode: TaxRoundingMode) {
  if (mode === "floor") return "切り捨て";
  if (mode === "ceil") return "切り上げ";
  return "四捨五入";
}
