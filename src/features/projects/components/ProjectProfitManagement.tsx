import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import {
  formatCurrency,
} from "@/features/calculation/lib/formatting";
import {
  formatProfitRate,
  profitTextClass,
  profitToneClass,
  summarizeProfitComparison,
} from "@/features/calculation/lib/profit";
import { useProjectStore } from "@/stores/project-store";

export function ProjectProfitManagement({ projectId }: { projectId: string }) {
  const projectItems = useProjectStore((state) => state.projectItems);
  const items = projectItems.filter((item) => item.projectId === projectId);
  const profit = summarizeProfitComparison(items);
  const overallWarningTone = getOverallWarningTone(profit.actual.grossMarginRate, items.length);

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Profit Forecast</p>
          <h3 className="mt-1 text-xl font-semibold text-white">利益予実管理</h3>
          <p className="mt-1 text-sm text-slate-400">
            予定粗利と実行粗利を比較し、赤字リスクのある工事項目を早めに見つけます。
          </p>
        </div>
        {overallWarningTone && (
          <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${warningToneClass(overallWarningTone)}`}>
            <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${warningIconClass(overallWarningTone)}`} />
            {overallWarningTone === "red"
              ? "案件全体の実行粗利率が25%未満です。積算リストの原価と単価設定を早急に確認してください。"
              : "案件全体の実行粗利率が30%未満です。積算リストの原価と単価設定を確認してください。"}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <ProfitMetricCard
          label="予定（見積）粗利"
          value={profit.estimated.grossProfit}
          rate={profit.estimated.grossMarginRate}
        />
        <ProfitMetricCard
          label="実行粗利"
          value={profit.actual.grossProfit}
          rate={profit.actual.grossMarginRate}
          emphasis
        />
        <DifferenceCard
          amount={profit.profitDiff}
          rate={profit.marginDiff}
        />
      </div>

      <ProfitGauge estimatedRate={profit.estimated.grossMarginRate} actualRate={profit.actual.grossMarginRate} />
    </section>
  );
}

function ProfitMetricCard({
  label,
  value,
  rate,
  emphasis = false,
}: {
  label: string;
  value: number;
  rate: number;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? profitToneClass(rate) : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
      <p className="text-xs font-semibold opacity-75">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-xl font-bold tabular-nums">{formatCurrency(value)}</span>
        <span className={`text-2xl font-black tabular-nums ${profitTextClass(rate)}`}>{formatProfitRate(rate)}</span>
      </div>
    </div>
  );
}

function DifferenceCard({ amount, rate }: { amount: number; rate: number }) {
  const positive = amount >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const tone = positive
    ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.10] dark:text-emerald-200"
    : "border-red-300 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-400/[0.10] dark:text-red-200";
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className={positive ? "text-xs font-semibold text-emerald-700 dark:text-emerald-100/80" : "text-xs font-semibold text-red-700 dark:text-red-100/80"}>差額・差率</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="flex items-center gap-2 text-xl font-bold tabular-nums">
          <Icon className="size-5" />
          {positive ? "+" : ""}{formatCurrency(amount)}
        </span>
        <span className="text-2xl font-black tabular-nums">{rate >= 0 ? "+" : ""}{formatProfitRate(rate)}</span>
      </div>
    </div>
  );
}

function ProfitGauge({ estimatedRate, actualRate }: { estimatedRate: number; actualRate: number }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>粗利率の予実比較</span>
        <span>警告ライン 30%</span>
      </div>
      <GaugeBar label="予定" rate={estimatedRate} />
      <GaugeBar label="実行" rate={actualRate} />
    </div>
  );
}

function GaugeBar({ label, rate }: { label: string; rate: number }) {
  const width = `${Math.max(0, Math.min(rate, 1)) * 100}%`;
  return (
    <div className="mb-3 grid grid-cols-[44px_minmax(0,1fr)_48px] items-center gap-3 last:mb-0">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${rate >= 0.7 ? "bg-emerald-400" : rate >= 0.5 ? "bg-amber-400" : "bg-red-400"}`} style={{ width }} />
        <div className="absolute left-[30%] top-0 h-full w-px bg-white/35" />
      </div>
      <span className={`text-right text-xs font-bold tabular-nums ${profitTextClass(rate)}`}>{formatProfitRate(rate)}</span>
    </div>
  );
}

function getOverallWarningTone(rate: number, itemCount: number): "amber" | "red" | null {
  if (itemCount === 0) return null;
  if (rate < 0.25) return "red";
  if (rate < 0.3) return "amber";
  return null;
}

function warningToneClass(tone: "amber" | "red") {
  if (tone === "red") {
    return "border-red-300 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-400/[0.12] dark:text-red-200";
  }
  return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/[0.12] dark:text-amber-200";
}

function warningIconClass(tone: "amber" | "red") {
  if (tone === "red") return "text-red-700 dark:text-red-300";
  return "text-amber-700 dark:text-amber-300";
}
