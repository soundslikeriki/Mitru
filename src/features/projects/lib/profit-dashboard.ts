import {
  summarizeProfitComparison,
  type ProfitComparison,
} from "@/features/calculation/lib/profit";
import type { Project, ProjectItem } from "@/stores/project-store";

export type ProjectProfitLevel = "safe" | "watch" | "danger";

export type ProjectProfitMetrics = {
  project: Project;
  items: ProjectItem[];
  profit: ProfitComparison;
  estimatedGrossProfit: number;
  actualGrossProfit: number;
  actualGrossMarginRate: number;
  riskLevel: ProjectProfitLevel;
  riskLabel: string;
  expectedRevenue: number;
};

export type DashboardProfitSummary = {
  monthlyExpectedRevenue: number;
  yearlyGrossProfit: number;
  averageGrossMarginRate: number;
  riskyProjectCount: number;
};

export function buildProjectProfitMetrics(projects: Project[], projectItems: ProjectItem[]): ProjectProfitMetrics[] {
  return projects.map((project) => {
    const items = projectItems.filter((item) => item.projectId === project.id);
    const profit = summarizeProfitComparison(items);
    const expectedRevenue = profit.estimated.revenue || project.totalAmount;
    const actualGrossMarginRate = profit.actual.revenue > 0 ? profit.actual.grossMarginRate : estimateFallbackRate(project);
    const actualGrossProfit = profit.actual.revenue > 0 ? profit.actual.grossProfit : project.totalAmount * actualGrossMarginRate;
    const estimatedGrossProfit = profit.estimated.revenue > 0 ? profit.estimated.grossProfit : project.totalAmount * actualGrossMarginRate;

    return {
      project,
      items,
      profit,
      estimatedGrossProfit,
      actualGrossProfit,
      actualGrossMarginRate,
      riskLevel: getProjectProfitLevel(actualGrossMarginRate),
      riskLabel: getProjectProfitLabel(actualGrossMarginRate),
      expectedRevenue,
    };
  });
}

export function summarizeProjectProfitDashboard(metrics: ProjectProfitMetrics[], now = new Date()): DashboardProfitSummary {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyExpectedRevenue = metrics
    .filter(({ project }) => {
      const date = new Date(project.startDate || project.updatedAt);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    })
    .reduce((sum, metric) => sum + metric.expectedRevenue, 0);
  const yearlyMetrics = metrics.filter(({ project }) => {
    const date = new Date(project.updatedAt || project.startDate);
    return date.getFullYear() === currentYear;
  });
  const yearlyGrossProfit = yearlyMetrics.reduce((sum, metric) => sum + metric.actualGrossProfit, 0);
  const totalRevenue = metrics.reduce((sum, metric) => sum + metric.expectedRevenue, 0);
  const totalGrossProfit = metrics.reduce((sum, metric) => sum + metric.actualGrossProfit, 0);

  return {
    monthlyExpectedRevenue,
    yearlyGrossProfit,
    averageGrossMarginRate: totalRevenue > 0 ? totalGrossProfit / totalRevenue : 0,
    riskyProjectCount: metrics.filter((metric) => metric.actualGrossMarginRate < 0.3).length,
  };
}

export function getProjectProfitLevel(rate: number): ProjectProfitLevel {
  if (rate < 0.25) return "danger";
  if (rate < 0.3) return "watch";
  return "safe";
}

export function projectProfitToneClass(level: ProjectProfitLevel) {
  if (level === "safe") {
    return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-200";
  }
  if (level === "watch") {
    return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/[0.12] dark:text-amber-200";
  }
  return "border-red-300 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-400/[0.12] dark:text-red-200";
}

export function projectProfitTextClass(level: ProjectProfitLevel) {
  if (level === "safe") return "text-emerald-700 dark:text-emerald-300";
  if (level === "watch") return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

function getProjectProfitLabel(rate: number) {
  if (rate < 0.25) return "危険";
  if (rate < 0.3) return "注意";
  return "良好";
}

function estimateFallbackRate(project: Project) {
  if (project.status === "完了") return 0.58;
  if (project.status === "施工中") return 0.62;
  return 0.65;
}
