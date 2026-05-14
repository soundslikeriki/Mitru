import { calculateLine } from "@/features/calculation/lib/calculation";
import type { ProjectItem } from "@/stores/project-store";

export type ProfitSnapshot = {
  revenue: number;
  laborCost: number;
  welfareCost: number;
  totalLaborCost: number;
  materialCost: number;
  directCost: number;
  grossProfit: number;
  grossMarginRate: number;
};

export type ProfitComparison = {
  estimated: ProfitSnapshot;
  actual: ProfitSnapshot;
  profitDiff: number;
  marginDiff: number;
  laborCostDiff: number;
  laborProfitImpact: number;
};

export type ProfitTone = "green" | "yellow" | "red";

export function getEstimatedUnitCost(item: ProjectItem) {
  if (item.itemType === "labor") {
    const line = calculateLine(item);
    return item.quantity > 0 ? line.subtotal / item.quantity : 0;
  }
  if (typeof item.estimatedUnitCost === "number" && item.estimatedUnitCost > 0) return item.estimatedUnitCost;
  if (item.materialUnitCost > 0) return item.materialUnitCost;
  const line = calculateLine(item);
  return item.quantity > 0 ? line.subtotal / item.quantity : item.materialUnitCost;
}

export function getActualUnitCost(item: ProjectItem) {
  if (typeof item.actualUnitCost === "number" && item.actualUnitCost > 0) return item.actualUnitCost;
  return item.materialUnitCost || 0;
}

export function getEstimatedLaborProductivity(item: ProjectItem) {
  return typeof item.estimatedLaborProductivity === "number"
    ? item.estimatedLaborProductivity
    : item.laborProductivity;
}

export function getActualLaborProductivity(item: ProjectItem) {
  return typeof item.actualLaborProductivity === "number"
    ? item.actualLaborProductivity
    : item.laborProductivity;
}

export function getEstimatedLaborUnitCost(item: ProjectItem) {
  return typeof item.estimatedLaborUnitCost === "number" ? item.estimatedLaborUnitCost : item.laborUnitCost;
}

export function getActualLaborUnitCost(item: ProjectItem) {
  return typeof item.actualLaborUnitCost === "number" ? item.actualLaborUnitCost : item.laborUnitCost;
}

export function calculateEstimatedLaborCost(item: ProjectItem) {
  if (item.itemType === "material") return 0;
  return item.quantity * getEstimatedLaborUnitCost(item);
}

export function calculateEstimatedWelfareCost(item: ProjectItem) {
  return calculateEstimatedLaborCost(item) * getWelfareRate(item);
}

export function calculateEstimatedTotalLaborCost(item: ProjectItem) {
  return calculateEstimatedLaborCost(item) + calculateEstimatedWelfareCost(item);
}

export function calculateActualLaborCost(item: ProjectItem) {
  if (item.itemType === "material") return 0;
  return item.quantity * getActualLaborUnitCost(item);
}

export function calculateActualWelfareCost(item: ProjectItem) {
  return getActualLaborCost(item) * getWelfareRate(item);
}

export function calculateActualTotalLaborCost(item: ProjectItem) {
  return getActualLaborCost(item) + calculateActualWelfareCost(item);
}

export function calculateEstimatedProfit(item: ProjectItem): ProfitSnapshot {
  const line = calculateLine(item);
  const revenue = line.subtotal;
  const laborCost = calculateEstimatedLaborCost(item);
  const welfareCost = calculateEstimatedWelfareCost(item);
  const totalLaborCost = laborCost + welfareCost;
  const materialCost = item.itemType === "material" ? line.materialCost : 0;
  const directCost = totalLaborCost + materialCost;
  const grossProfit = revenue - directCost;

  return {
    revenue,
    laborCost,
    welfareCost,
    totalLaborCost,
    materialCost,
    directCost,
    grossProfit,
    grossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
  };
}

export function calculateActualProfit(item: ProjectItem): ProfitSnapshot {
  const line = calculateLine(item);
  const revenue = line.subtotal;
  const laborCost = getActualLaborCost(item);
  const welfareCost = calculateActualWelfareCost(item);
  const totalLaborCost = laborCost + welfareCost;
  const materialCost = getActualMaterialCost(item);
  const outsourcingCost = getActualOutsourcingCost(item);
  const directCost = totalLaborCost + materialCost + outsourcingCost;
  const grossProfit = revenue - directCost;

  return {
    revenue,
    laborCost,
    welfareCost,
    totalLaborCost,
    materialCost,
    directCost,
    grossProfit,
    grossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
  };
}

export function getActualMaterialCost(item: ProjectItem) {
  return typeof item.actualMaterialCost === "number" && item.actualMaterialCost > 0
    ? item.actualMaterialCost
    : item.quantity * getActualUnitCost(item);
}

export function getActualLaborCost(item: ProjectItem) {
  return typeof item.actualLaborCost === "number" && item.actualLaborCost > 0
    ? item.actualLaborCost
    : calculateActualLaborCost(item);
}

export function getActualOutsourcingCost(item: ProjectItem) {
  return typeof item.actualOutsourcingCost === "number" ? item.actualOutsourcingCost : 0;
}

export function getWelfareRate(item: ProjectItem) {
  return typeof item.welfareRate === "number" && item.welfareRate >= 0 ? item.welfareRate : 0.25;
}

export function calculateProfitSnapshot(item: ProjectItem): ProfitSnapshot {
  return calculateActualProfit(item);
}

export function calculateProfitComparison(item: ProjectItem): ProfitComparison {
  const estimated = calculateEstimatedProfit(item);
  const actual = calculateActualProfit(item);

  return {
    estimated,
    actual,
    profitDiff: actual.grossProfit - estimated.grossProfit,
    marginDiff: actual.grossMarginRate - estimated.grossMarginRate,
    laborCostDiff: actual.laborCost - estimated.laborCost,
    laborProfitImpact: estimated.laborCost - actual.laborCost,
  };
}

export function summarizeProfit(items: ProjectItem[]): ProfitSnapshot {
  return summarizeProfitBy(items, calculateActualProfit);
}

export function summarizeEstimatedProfit(items: ProjectItem[]): ProfitSnapshot {
  return summarizeProfitBy(items, calculateEstimatedProfit);
}

export function summarizeActualProfit(items: ProjectItem[]): ProfitSnapshot {
  return summarizeProfitBy(items, calculateActualProfit);
}

export function summarizeProfitComparison(items: ProjectItem[]): ProfitComparison {
  const estimated = summarizeEstimatedProfit(items);
  const actual = summarizeActualProfit(items);
  return {
    estimated,
    actual,
    profitDiff: actual.grossProfit - estimated.grossProfit,
    marginDiff: actual.grossMarginRate - estimated.grossMarginRate,
    laborCostDiff: actual.laborCost - estimated.laborCost,
    laborProfitImpact: estimated.laborCost - actual.laborCost,
  };
}

function summarizeProfitBy(
  items: ProjectItem[],
  calculator: (item: ProjectItem) => ProfitSnapshot,
): ProfitSnapshot {
  return items.reduce<ProfitSnapshot>(
    (summary, item) => {
      const profit = calculator(item);
      const revenue = summary.revenue + profit.revenue;
      const laborCost = summary.laborCost + profit.laborCost;
      const welfareCost = summary.welfareCost + profit.welfareCost;
      const totalLaborCost = summary.totalLaborCost + profit.totalLaborCost;
      const materialCost = summary.materialCost + profit.materialCost;
      const grossProfit = summary.grossProfit + profit.grossProfit;
      const directCost = summary.directCost + profit.directCost;

      return {
        revenue,
        laborCost,
        welfareCost,
        totalLaborCost,
        materialCost,
        directCost,
        grossProfit,
        grossMarginRate: revenue > 0 ? grossProfit / revenue : 0,
      };
    },
    { revenue: 0, laborCost: 0, welfareCost: 0, totalLaborCost: 0, materialCost: 0, directCost: 0, grossProfit: 0, grossMarginRate: 0 },
  );
}

export function getProfitTone(rate: number): ProfitTone {
  if (rate >= 0.7) return "green";
  if (rate >= 0.5) return "yellow";
  return "red";
}

export function profitToneClass(rate: number) {
  const tone = getProfitTone(rate);
  if (tone === "green") return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-200";
  if (tone === "yellow") return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/[0.12] dark:text-amber-200";
  return "border-red-300 bg-red-100 text-red-800 dark:border-red-400/30 dark:bg-red-400/[0.12] dark:text-red-200";
}

export function profitTextClass(rate: number) {
  const tone = getProfitTone(rate);
  if (tone === "green") return "text-emerald-700 dark:text-emerald-300";
  if (tone === "yellow") return "text-amber-700 dark:text-amber-300";
  return "text-red-700 dark:text-red-300";
}

export function formatProfitRate(rate: number) {
  return `${Math.round(rate * 100)}%`;
}
