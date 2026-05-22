import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BarChart3, Banknote, CalendarClock, Percent, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { formatProfitRate } from "@/features/calculation/lib/profit";
import { buildCashflowForecast, type CashflowSummary } from "@/features/dashboard/lib/cashflow";
import {
  buildAnnualPerformanceForecast,
  type AnnualPerformanceForecast,
  type PerformancePeriod,
} from "@/features/dashboard/lib/performance-forecast";
import {
  buildProjectProfitMetrics,
  getProjectProfitLevel,
  projectProfitTextClass,
  summarizeProjectProfitDashboard,
  type ProjectProfitMetrics,
} from "@/features/projects/lib/profit-dashboard";
import { buildPaymentInvoiceSummaries, flattenPaymentRecords, getMonthPaymentTotal } from "@/features/payments/lib/payments";
import { buildPurchaseOrderSummaries } from "@/features/purchases/lib/purchases";
import { buildCurrentMonthBusinessSummary } from "@/features/reports/lib/reports";
import type { ProjectStatus } from "@/stores/project-store";
import { useProjectStore } from "@/stores/project-store";

const pageBadgeClass =
  "mb-2 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.10] dark:text-emerald-300";

export function DashboardPage() {
  const {
    projects: allProjects,
    projectItems,
    customers: allCustomers,
    estimateDocuments: allEstimateDocuments,
    invoiceDocuments: allInvoiceDocuments,
    orderDocuments,
    materialMasters,
  } = useProjectStore(
    useShallow((state) => ({
      projects: state.projects,
      projectItems: state.projectItems,
      customers: state.customers,
      estimateDocuments: state.estimateDocuments,
      invoiceDocuments: state.invoiceDocuments,
      orderDocuments: state.orderDocuments,
      materialMasters: state.materialMasters,
    })),
  );
  const projects = useMemo(() => allProjects.filter((project) => !project.deletedAt), [allProjects]);
  const customers = useMemo(() => allCustomers.filter((customer) => !customer.deletedAt), [allCustomers]);
  const estimateDocuments = useMemo(
    () => allEstimateDocuments.filter((document) => !document.deletedAt),
    [allEstimateDocuments],
  );
  const invoiceDocuments = useMemo(
    () => allInvoiceDocuments.filter((document) => !document.deletedAt),
    [allInvoiceDocuments],
  );

  try {
  const projectMetrics = buildProjectProfitMetrics(projects, projectItems);
  const activeProjectMetrics = projectMetrics.filter((metric) => !isDashboardExcludedStatus(metric.project.status));
  const profitSummary = summarizeProjectProfitDashboard(activeProjectMetrics);
  const cashflow = buildCashflowForecast({ projects, projectItems, invoiceDocuments });
  const annualForecast = buildAnnualPerformanceForecast({ metrics: activeProjectMetrics, invoiceDocuments });
  const currentMonthReport = buildCurrentMonthBusinessSummary({
    projects,
    projectItems,
    customers,
    estimateDocuments,
    invoiceDocuments,
  });
  const paymentSummaries = buildPaymentInvoiceSummaries({ invoices: invoiceDocuments, projects });
  const paymentRecords = flattenPaymentRecords({ invoices: invoiceDocuments, projects });
  const purchaseSummaries = buildPurchaseOrderSummaries({ orders: orderDocuments, projects, materialMasters });
  const unpaidInvoices = paymentSummaries.filter((summary) => summary.outstandingAmount > 0);
  const topUnpaidInvoices = unpaidInvoices
    .slice()
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
    .slice(0, 5);
  const openPurchases = purchaseSummaries.filter((summary) => summary.remainingAmount > 0);
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthPaymentPlan = unpaidInvoices
    .filter((summary) => getMonthKey(summary.invoice.dueDate || summary.invoice.invoiceDate || summary.invoice.updatedAt) === thisMonthKey)
    .reduce((sum, summary) => sum + summary.outstandingAmount, 0);
  const thisMonthPaidActual = getMonthPaymentTotal(paymentRecords, thisMonthKey);
  const thisMonthPurchasePlan = openPurchases
    .filter((summary) => getMonthKey(summary.order.dueDate || summary.order.orderedAt || summary.order.updatedAt) === thisMonthKey)
    .reduce((sum, summary) => sum + summary.remainingAmount, 0);
  const thisMonthClosingDate = getThisMonthClosingDate();
  const invoicedEstimateIds = new Set(invoiceDocuments.map((invoice) => invoice.sourceEstimateDocumentId).filter(Boolean));
  const billingCloseCandidates = estimateDocuments.filter(
    (estimate) =>
      estimate.status === "発行済" &&
      !invoicedEstimateIds.has(estimate.id) &&
      safeDateString(estimate.issuedAt || estimate.updatedAt) <= thisMonthClosingDate,
  );
  const billingCloseAmount = billingCloseCandidates.reduce(
    (sum, estimate) => sum + (estimate.totalsSnapshot?.afterTax ?? estimate.totalAmount),
    0,
  );
  const upcomingActions = projects
    .filter((project) => project.nextActionDate)
    .sort((a, b) => String(a.nextActionDate).localeCompare(String(b.nextActionDate)))
    .slice(0, 4);

  const metricCards = [
    { label: "今月の予想売上", value: formatCurrency(profitSummary.monthlyExpectedRevenue), detail: "開始予定月ベース", icon: Banknote },
    { label: "今年の累計粗利", value: formatCurrency(profitSummary.yearlyGrossProfit), detail: "実行粗利ベース", icon: TrendingUp },
    { label: "平均粗利率", value: formatProfitRate(profitSummary.averageGrossMarginRate), detail: "全案件平均", icon: Percent },
    { label: "赤字リスク案件", value: String(profitSummary.riskyProjectCount), detail: "粗利率30%未満", icon: AlertTriangle },
  ];
  const riskProjects = activeProjectMetrics
    .filter((metric) => metric.actualGrossMarginRate < 0.3)
    .sort((a, b) => a.actualGrossMarginRate - b.actualGrossMarginRate)
    .slice(0, 4);

  return (
    <div className="w-full max-w-none">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card, index) => (
          <motion.div
            key={card.label}
            className="rounded-xl border border-white/10 bg-slate-950/55 p-5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-400/35 hover:bg-white/[0.07]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + index * 0.05, duration: 0.32 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">{card.label}</p>
              <div className="grid size-9 place-items-center rounded-lg bg-[#1E3A8A]/55 text-emerald-300">
                <card.icon className="size-4" />
              </div>
            </div>
            <p className="text-3xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
          </motion.div>
        ))}
      </section>

      <MonthlyBusinessSummaryCard report={currentMonthReport} />

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PaymentDashboardCard
          label="未入金請求書"
          value={`${unpaidInvoices.length}件`}
          detail={`残債合計 ${formatCurrency(unpaidInvoices.reduce((sum, summary) => sum + summary.outstandingAmount, 0))}`}
          to="/payments"
        />
        <PaymentDashboardCard
          label="今月の入金予定"
          value={formatCurrency(thisMonthPaymentPlan)}
          detail="支払期限が今月の未入金請求書"
          to="/payments"
        />
        <PaymentDashboardCard
          label="今月の入金実績"
          value={formatCurrency(thisMonthPaidActual)}
          detail={`${paymentRecords.filter(({ record }) => getMonthKey(record.paymentDate) === thisMonthKey).length}件の入金履歴`}
          to="/payments"
        />
        <PaymentDashboardCard
          label="今月の締め予定"
          value={`${billingCloseCandidates.length}件`}
          detail={`${formatCurrency(billingCloseAmount)} / 締め日 ${thisMonthClosingDate.replaceAll("-", "/")}`}
          to="/billing"
        />
        <PaymentDashboardCard
          label="支払予定"
          value={formatCurrency(thisMonthPurchasePlan)}
          detail={`発注残 ${openPurchases.length}件`}
          to="/purchases"
        />
      </section>

      <AnnualPerformanceForecastSection forecast={annualForecast} />

      <CashflowForecastCard cashflow={cashflow} />

      <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Banknote className="size-4 text-emerald-300" />
            <h3 className="text-sm font-semibold text-white">未入金請求トップ5</h3>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/payments">入金管理へ</Link>
          </Button>
        </div>
        {topUnpaidInvoices.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {topUnpaidInvoices.map(({ invoice, project, outstandingAmount, paidAmount, invoiceTotal }) => (
              <Link
                key={invoice.id}
                to={`/projects/${invoice.projectId}/invoices`}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-400/30 hover:bg-white/[0.07]"
              >
                <p className="truncate text-sm font-semibold text-white">{project?.name ?? "不明な案件"}</p>
                <p className="mt-1 text-xs text-slate-500">{invoice.documentNumber}</p>
                <p className="mt-3 text-lg font-bold text-amber-300">{formatCurrency(outstandingAmount)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, invoiceTotal > 0 ? (paidAmount / invoiceTotal) * 100 : 0)}%` }} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
            未入金の請求書はありません。
          </p>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="size-4 text-emerald-300" />
          <h3 className="text-sm font-semibold text-white">次回対応が近い案件</h3>
        </div>
        {upcomingActions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {upcomingActions.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}?tab=progress`}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-emerald-400/30 hover:bg-white/[0.07]"
              >
                <p className="text-sm font-semibold text-white">{project.name}</p>
                <p className="mt-2 text-xs text-slate-500">{project.nextActionDate?.replaceAll("-", "/")}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{project.processMemo || project.ownerMemo || "対応メモは未入力です。"}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
            直近の対応予定はありません。案件の進行管理タブで次回対応日を設定できます。
          </p>
        )}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border border-white/10 bg-slate-950/55 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h3 className="text-sm font-semibold text-white">最近の案件</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/projects">すべて表示</Link>
            </Button>
          </div>
          <div className="divide-y divide-white/10">
            {activeProjectMetrics.slice(0, 3).map((metric, index) => (
              <ProjectSummaryRow key={metric.project.id} metric={metric} index={index} />
            ))}
          </div>
        </div>

        <RiskProjectsCard projects={riskProjects} />
      </section>
    </div>
  );
  } catch (error) {
    console.error("[Mitru] Dashboard fallback mode:", error);
    return <DashboardRecoveryMode projectCount={projects.length} invoiceCount={invoiceDocuments.length} />;
  }
}

function DashboardRecoveryMode({ projectCount, invoiceCount }: { projectCount: number; invoiceCount: number }) {
  return (
    <div className="w-full max-w-none">
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-slate-900 shadow-sm dark:border-amber-400/30 dark:bg-amber-400/[0.10] dark:text-white">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className={pageBadgeClass}>Dashboard</p>
            <h2 className="text-2xl font-bold tracking-normal">最小限のダッシュボードで起動しています</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700 dark:text-slate-300">
              保存済みデータの一部に古い形式または欠損値があるため、重い集計だけを一時的に停止しました。
              案件一覧や入金管理は通常どおり開けます。
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MiniMetric label="案件数" value={`${projectCount}件`} tone="text-slate-900 dark:text-white" />
              <MiniMetric label="請求書数" value={`${invoiceCount}件`} tone="text-slate-900 dark:text-white" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/projects">案件一覧を開く</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/payments">入金管理を開く</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/reports">レポートを開く</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PaymentDashboardCard({
  label,
  value,
  detail,
  to,
}: {
  label: string;
  value: string;
  detail: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/10 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-400/35 hover:bg-white/[0.07]"
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </Link>
  );
}

function MonthlyBusinessSummaryCard({
  report,
}: {
  report: ReturnType<typeof buildCurrentMonthBusinessSummary>;
}) {
  const maxCost = Math.max(
    report.costBreakdown.laborCost,
    report.costBreakdown.welfareCost,
    report.costBreakdown.materialCost,
    report.costBreakdown.outsourcingCost,
    1,
  );

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Monthly Summary</p>
          <h3 className="mt-1 text-xl font-semibold text-white">今月の業績サマリー</h3>
          <p className="mt-1 text-sm text-slate-400">売上・粗利・法定福利費を含む原価内訳をひと目で確認できます。</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/reports">レポートを見る</Link>
        </Button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniMetric label="売上" value={formatCurrency(report.summary.revenue)} />
          <MiniMetric label="粗利" value={formatCurrency(report.summary.grossProfit)} />
          <MiniMetric label="平均粗利率" value={formatProfitRate(report.summary.averageGrossMarginRate)} tone={profitTextClassByRate(report.summary.averageGrossMarginRate)} />
        </div>
        <div className="grid gap-2">
          {[
            { label: "労務費", value: report.costBreakdown.laborCost, className: "bg-sky-400" },
            { label: "法定福利費", value: report.costBreakdown.welfareCost, className: "bg-purple-400" },
            { label: "材料費", value: report.costBreakdown.materialCost, className: "bg-emerald-400" },
            { label: "外注費", value: report.costBreakdown.outsourcingCost, className: "bg-amber-400" },
          ].map((item) => (
            <div key={item.label} className="grid grid-cols-[90px_minmax(0,1fr)_90px] items-center gap-3 text-xs">
              <span className="text-slate-400">{item.label}</span>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className={`h-full rounded-full ${item.className}`} style={{ width: `${(item.value / maxCost) * 100}%` }} />
              </div>
              <span className="text-right font-semibold text-white">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniMetric({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function getThisMonthClosingDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 25).toISOString().slice(0, 10);
}

function getMonthKey(value?: string) {
  return safeDateString(value).slice(0, 7);
}

function safeDateString(value?: string) {
  return typeof value === "string" && value.trim() ? value : new Date().toISOString().slice(0, 10);
}

function isDashboardExcludedStatus(status: ProjectStatus) {
  return status === "失注" || status === "破棄";
}

function ProjectSummaryRow({ metric, index }: { metric: ProjectProfitMetrics; index: number }) {
  const { project } = metric;
  return (
    <motion.div
      className="grid gap-5 px-5 py-5 transition hover:bg-white/[0.04] sm:grid-cols-[1fr_auto]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.05, duration: 0.3 }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium text-white">{project.name}</p>
          <StatusBadge status={project.status} />
        </div>
        <div className="mt-4 h-2 max-w-xl overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-[#10B981]"
            initial={{ width: 0 }}
            animate={{ width: `${project.progress}%` }}
            transition={{ delay: 0.3 + index * 0.05, duration: 0.55, ease: "easeOut" }}
          />
        </div>
      </div>
      <div className="sm:text-right">
        <p className="font-semibold text-white">{formatCurrency(project.totalAmount)}</p>
        <p className={`mt-2 text-xs font-bold tabular-nums ${projectProfitTextClass(metric.riskLevel)}`}>
          実行粗利 {formatProfitRate(metric.actualGrossMarginRate)}
        </p>
        <p className="mt-1 text-xs text-slate-500">進捗 {project.progress}%</p>
      </div>
    </motion.div>
  );
}

function AnnualPerformanceForecastSection({ forecast }: { forecast: AnnualPerformanceForecast }) {
  const maxQuarterValue = Math.max(1, ...forecast.quarters.map((quarter) => quarter.revenue));
  const trendMonths = forecast.months.filter((month) => month.revenue > 0 || month.grossProfit > 0);

  return (
    <motion.section
      className={`mt-5 rounded-2xl border p-5 shadow-2xl shadow-black/20 backdrop-blur-xl ${
        forecast.warning ? "border-amber-400/30 bg-amber-400/[0.08]" : "border-white/10 bg-slate-950/55"
      }`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.34 }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Annual Forecast</p>
          <h3 className="mt-1 text-xl font-semibold text-white">今年の業績予測（{forecast.year}年）</h3>
          <p className="mt-1 text-sm text-slate-400">
            完了案件は請求書合計を売上として計上し、未完了案件は見積/実行加重で予測します。
          </p>
        </div>
        {forecast.warning && (
          <WarningCallout tone="amber" message="年間粗利率が30%を下回る見込みです。利益率の低い案件を確認してください。" />
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ForecastMetric label="今年の予想売上" value={formatCurrency(forecast.predictedRevenue)} icon={Banknote} title="完了案件は関連する請求書の合計金額、未完了案件は見込み金額で計算しています。" />
        <ForecastMetric label="今年の予想粗利" value={formatCurrency(forecast.predictedGrossProfit)} icon={TrendingUp} title="完了案件は実績、未完了案件は見積粗利と実行粗利を進捗で加重しています。" />
        <ForecastMetric label="平均粗利率" value={formatProfitRate(forecast.averageGrossMarginRate)} icon={Percent} tone={profitTextClassByRate(forecast.averageGrossMarginRate)} title="今年の予想粗利 ÷ 今年の予想売上で計算しています。" />
        <ForecastMetric
          label="前年比"
          value={forecast.yearOverYearRate == null ? "前年データなし" : `${forecast.yearOverYearRate >= 0 ? "+" : ""}${formatProfitRate(forecast.yearOverYearRate)}`}
          icon={BarChart3}
          title="前年の請求書売上と今年の予想売上を比較しています。"
        />
      </div>

      <div className="mt-5 grid gap-4 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Target className="size-4 text-emerald-300" />
            目標に対する達成率
          </div>
          <ProgressLine label="売上目標" value={forecast.predictedRevenue} target={forecast.targetRevenue} rate={forecast.revenueProgressRate} />
          <ProgressLine label="粗利目標" value={forecast.predictedGrossProfit} target={forecast.targetGrossProfit} rate={forecast.grossProfitProgressRate} />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">月別・四半期別の内訳</h4>
            <span className="text-xs text-slate-500">粗利率トレンド</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="grid gap-2">
              {forecast.quarters.map((quarter) => (
                <QuarterBar key={quarter.key} quarter={quarter} maxValue={maxQuarterValue} />
              ))}
            </div>
            <div className="grid grid-cols-6 items-end gap-1 rounded-lg bg-slate-950/45 p-3">
              {(trendMonths.length ? trendMonths : forecast.months.slice(0, 6)).slice(0, 6).map((month) => (
                <TrendBar key={month.key} month={month} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ForecastMetric({
  label,
  value,
  icon: Icon,
  tone = "text-white",
  title,
}: {
  label: string;
  value: string;
  icon: typeof Banknote;
  tone?: string;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4" title={title}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <div className="grid size-8 place-items-center rounded-lg bg-[#1E3A8A]/55 text-emerald-300">
          <Icon className="size-4" />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function ProgressLine({
  label,
  value,
  target,
  rate,
}: {
  label: string;
  value: number;
  target: number;
  rate: number;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-400">{label}</span>
        <span className="font-bold tabular-nums text-slate-200">{Math.round(rate * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, rate * 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{formatCurrency(value)}</span>
        <span>目標 {formatCurrency(target)}</span>
      </div>
    </div>
  );
}

function QuarterBar({ quarter, maxValue }: { quarter: PerformancePeriod; maxValue: number }) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)_112px] items-center gap-3 sm:grid-cols-[36px_minmax(0,1fr)_132px]">
      <span className="text-xs font-semibold text-slate-400">{quarter.label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(100, (quarter.revenue / maxValue) * 100)}%` }} />
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold tabular-nums text-slate-200">{formatCurrency(quarter.revenue)}</p>
        <p className={`text-[10px] font-bold tabular-nums ${profitTextClassByRate(quarter.grossMarginRate)}`}>{formatProfitRate(quarter.grossMarginRate)}</p>
      </div>
    </div>
  );
}

function TrendBar({ month }: { month: PerformancePeriod }) {
  const height = `${Math.max(8, Math.min(100, month.grossMarginRate * 100))}%`;
  const tone = month.grossMarginRate >= 0.7 ? "bg-emerald-400" : month.grossMarginRate >= 0.5 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex h-28 flex-col items-center justify-end gap-2">
      <div className="flex h-20 w-full items-end justify-center">
        <div className={`w-4 rounded-t ${tone}`} style={{ height }} title={`${month.label} ${formatProfitRate(month.grossMarginRate)}`} />
      </div>
      <span className="text-[10px] text-slate-500">{month.label}</span>
    </div>
  );
}

function CashflowForecastCard({ cashflow }: { cashflow: CashflowSummary }) {
  const maxValue = Math.max(1, ...cashflow.months.flatMap((month) => [month.inflow, month.outflow, Math.abs(month.net)]));

  return (
    <motion.section
      className={`mt-5 rounded-2xl border p-5 shadow-2xl shadow-black/20 backdrop-blur-xl ${
        cashflow.nextMonthNegative
          ? "border-red-400/30 bg-red-400/[0.08]"
          : "border-white/10 bg-slate-950/55"
      }`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, duration: 0.34 }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Cashflow Forecast</p>
          <h3 className="mt-1 text-xl font-semibold text-white">キャッシュフロー予測</h3>
          <p className="mt-1 text-sm text-slate-400">請求書ベースの入金予定と、実行原価から見た支出予定を3ヶ月で確認します。</p>
        </div>
        {cashflow.nextMonthNegative && (
          <WarningCallout tone="red" message="翌月の累計キャッシュがマイナスになる見込みです。" />
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <CashflowMetric label="3ヶ月入金予定" value={cashflow.totalInflow} tone="text-emerald-300" />
          <CashflowMetric label="3ヶ月支出予定" value={cashflow.totalOutflow} tone="text-red-300" />
        </div>
        <div className="grid gap-3">
          {cashflow.months.map((month) => (
            <div key={month.key} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{month.label}</span>
                <span className={`text-sm font-bold tabular-nums ${month.cumulative >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  累計 {formatCurrency(month.cumulative)}
                </span>
              </div>
              <CashflowBar label="入金" value={month.inflow} maxValue={maxValue} className="bg-emerald-400" />
              <CashflowBar label="支出" value={month.outflow} maxValue={maxValue} className="bg-red-400" />
              <CashflowBar label="差引" value={Math.abs(month.net)} maxValue={maxValue} className={month.net >= 0 ? "bg-sky-400" : "bg-amber-400"} />
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function CashflowMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tone}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function RiskProjectsCard({ projects }: { projects: ProjectProfitMetrics[] }) {
  return (
    <motion.div
      className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-5 backdrop-blur-xl"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.24, duration: 0.35 }}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-red-400/15 text-red-200">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">リスク案件</h3>
          <p className="text-xs text-slate-400">粗利率30%未満を優先表示</p>
        </div>
      </div>
      <div className="space-y-3 text-sm text-slate-300">
        {projects.length > 0 ? (
          projects.map((metric) => (
            <Link
              key={metric.project.id}
              to={`/projects/${metric.project.id}?tab=calculation`}
              className="block rounded-lg border border-white/10 bg-slate-950/45 p-3 transition hover:border-red-400/35 hover:bg-red-400/[0.08]"
              title="案件の積算タブで原価と粗利を確認します。"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="line-clamp-1 font-semibold text-white">{metric.project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{metric.project.clientName || metric.project.clientCompanyName || "顧客未設定"}</p>
                </div>
                <span className={`shrink-0 text-sm font-black tabular-nums ${profitTextClassByRate(metric.actualGrossMarginRate)}`}>
                  {formatProfitRate(metric.actualGrossMarginRate)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>実行粗利</span>
                <span className="font-semibold tabular-nums text-slate-300">{formatCurrency(metric.actualGrossProfit)}</span>
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-lg bg-slate-950/50 p-3 text-slate-400">現在、粗利率30%未満の案件はありません。</p>
        )}
      </div>
    </motion.div>
  );
}

function WarningCallout({ tone, message }: { tone: "amber" | "red"; message: string }) {
  const className =
    tone === "red"
      ? "border-red-300 bg-red-100 font-semibold text-red-800 shadow-sm dark:border-red-400/30 dark:bg-red-400/[0.12] dark:text-red-200"
      : "border-amber-300 bg-amber-100 font-semibold text-amber-900 shadow-sm dark:border-amber-400/30 dark:bg-amber-400/[0.12] dark:text-amber-200";
  const iconClassName = tone === "red" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300";

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${className}`}>
      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${iconClassName}`} />
      {message}
    </div>
  );
}

function CashflowBar({
  label,
  value,
  maxValue,
  className,
}: {
  label: string;
  value: number;
  maxValue: number;
  className: string;
}) {
  return (
    <div className="mb-2 grid grid-cols-[42px_minmax(0,1fr)_96px] items-center gap-3 last:mb-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.min(100, (value / maxValue) * 100)}%` }} />
      </div>
      <span className="text-right text-xs font-semibold tabular-nums text-slate-300">{formatCurrency(value)}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const className =
    status === "施工中"
      ? "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-400/30 dark:bg-orange-400/[0.12] dark:text-orange-200"
      : status === "契約済"
        ? "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-300/25 dark:bg-blue-400/[0.12] dark:text-blue-200"
        : status === "完了"
          ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-200"
          : status === "請求済み"
            ? "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-400/30 dark:bg-purple-400/[0.12] dark:text-purple-200"
            : status === "請求締済"
              ? "border-indigo-300 bg-indigo-100 text-indigo-800 dark:border-indigo-400/30 dark:bg-indigo-400/[0.12] dark:text-indigo-200"
              : status === "失注"
                ? "border-red-300 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-400/[0.12] dark:text-red-200"
                : status === "破棄"
                  ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-400/30 dark:bg-slate-400/[0.12] dark:text-slate-200"
                  : "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-300/25 dark:bg-amber-400/[0.12] dark:text-amber-200";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}

function formatCurrency(value: number) {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${sign}${formatCompactNumber(absolute / 100_000_000)}億円`;
  if (absolute >= 10_000) return `${sign}${formatCompactNumber(absolute / 10_000)}万円`;
  return `${sign}${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(absolute)}円`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

function profitTextClassByRate(rate: number) {
  return projectProfitTextClass(getProjectProfitLevel(rate));
}
