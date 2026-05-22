import type { ProjectItem, TaxRoundingMode } from "@/stores/project-store";

export type CalculationLine = ReturnType<typeof calculateLine>;
export type EstimateTotals = ReturnType<typeof calculateEstimateTotals>;
export type InvoiceTotals = ReturnType<typeof calculateInvoiceTotals>;

export type InvoiceCalculationLineInput = {
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
};

export function calculateLine(item: ProjectItem) {
  if (item.itemType === "material") {
    const materialUnitCost = resolveMaterialUnitCost(item);
    const materialCost = item.quantity * materialUnitCost;
    return { laborCost: 0, welfareCost: 0, totalLaborCost: 0, materialCost, expenseCost: 0, subtotal: materialCost };
  }

  const laborUnitCost = resolveLaborUnitCost(item);
  const laborCost =
    item.priceModelVersion === 1
      ? item.quantity * resolveLaborProductivity(item) * laborUnitCost
      : item.quantity * laborUnitCost;
  const welfareCost = laborCost * resolveWelfareRate(item);
  const totalLaborCost = laborCost + welfareCost;
  const subtotal = totalLaborCost;

  return { laborCost, welfareCost, totalLaborCost, materialCost: 0, expenseCost: 0, subtotal };
}

function resolveLaborProductivity(item: ProjectItem) {
  if (typeof item.estimatedLaborProductivity === "number" && item.estimatedLaborProductivity > 0) {
    return item.estimatedLaborProductivity;
  }
  return item.laborProductivity || 1;
}

function resolveLaborUnitCost(item: ProjectItem) {
  if (typeof item.estimatedLaborUnitCost === "number" && item.estimatedLaborUnitCost > 0) {
    return item.estimatedLaborUnitCost;
  }
  return item.laborUnitCost || 0;
}

function resolveWelfareRate(item: ProjectItem) {
  return typeof item.welfareRate === "number" && item.welfareRate >= 0 ? item.welfareRate : 0.25;
}

function resolveMaterialUnitCost(item: ProjectItem) {
  if (
    item.itemType === "material" &&
    typeof item.baseCost === "number" &&
    item.baseCost > 0 &&
    typeof item.markupRate === "number" &&
    item.markupRate > 0
  ) {
    return item.baseCost * item.markupRate;
  }
  if (typeof item.estimatedUnitCost === "number" && item.estimatedUnitCost > 0) {
    return item.estimatedUnitCost;
  }
  return item.materialUnitCost || 0;
}

export function calculateEstimateTotals(
  items: ProjectItem[],
  commonTemporaryRate: number,
  siteManagementRate: number,
  taxRate: number,
  taxRoundingMode: TaxRoundingMode = "round",
  totalRoundingMode: TaxRoundingMode = "round",
) {
  const base = items.reduce(
    (sum, item) => {
      const line = calculateLine(item);
      return {
        laborCost: sum.laborCost + line.laborCost,
        welfareCost: sum.welfareCost + (line.welfareCost ?? 0),
        totalLaborCost: sum.totalLaborCost + (line.totalLaborCost ?? line.laborCost),
        materialCost: sum.materialCost + line.materialCost,
        expenseCost: sum.expenseCost + line.expenseCost,
        directSubtotal: sum.directSubtotal + line.subtotal,
      };
    },
    { laborCost: 0, welfareCost: 0, totalLaborCost: 0, materialCost: 0, expenseCost: 0, directSubtotal: 0 },
  );
  const commonTemporaryCost = base.directSubtotal * commonTemporaryRate;
  const siteManagementCost = base.directSubtotal * siteManagementRate;
  const beforeTax = base.directSubtotal + commonTemporaryCost + siteManagementCost;
  const tax = roundCurrency(beforeTax * taxRate, taxRoundingMode);
  const afterTax = roundCurrency(beforeTax + tax, totalRoundingMode);

  return {
    ...base,
    commonTemporaryCost,
    siteManagementCost,
    beforeTax,
    tax,
    afterTax,
  };
}

export function calculateInvoiceTotals(
  lines: InvoiceCalculationLineInput[],
  taxRate: number,
  taxRoundingMode: TaxRoundingMode = "round",
  totalRoundingMode: TaxRoundingMode = "round",
) {
  const previousBeforeTax = lines.reduce((sum, line) => sum + line.previousAmount, 0);
  const beforeTax = lines.reduce((sum, line) => sum + line.currentAmount, 0);
  const cumulativeBeforeTax = lines.reduce((sum, line) => sum + line.cumulativeAmount, 0);
  const tax = roundCurrency(beforeTax * taxRate, taxRoundingMode);
  const afterTax = roundCurrency(beforeTax + tax, totalRoundingMode);

  return {
    previousBeforeTax,
    beforeTax,
    cumulativeBeforeTax,
    tax,
    afterTax,
  };
}

export function roundCurrency(value: number, mode: TaxRoundingMode) {
  if (mode === "floor") return Math.floor(value);
  if (mode === "ceil") return Math.ceil(value);
  return Math.round(value);
}
