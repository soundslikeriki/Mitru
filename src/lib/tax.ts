import type { ProjectTaxRateType } from "@/stores/project-store";

export const projectTaxRateOptions = [
  { value: "exempt", label: "非課税", shortLabel: "非課税", rate: 0 },
  { value: "reduced", label: "8%（軽減税率）", shortLabel: "8%", rate: 0.08 },
  { value: "standard", label: "10%（標準）", shortLabel: "10%", rate: 0.1 },
] as const satisfies ReadonlyArray<{
  value: ProjectTaxRateType;
  label: string;
  shortLabel: string;
  rate: number;
}>;

export function normalizeProjectTaxRateType(value: unknown): ProjectTaxRateType {
  if (value === "exempt" || value === "reduced" || value === "standard") return value;
  return "standard";
}

export function resolveProjectTaxRate(taxRateType: unknown, fallbackRate = 0.1) {
  const normalized = normalizeProjectTaxRateType(taxRateType);
  const option = projectTaxRateOptions.find((item) => item.value === normalized);
  return option?.rate ?? fallbackRate;
}

export function formatTaxRateLabel(taxRate: number) {
  if (taxRate <= 0) return "非課税";
  return `${Math.round(taxRate * 100)}%`;
}

export function formatConsumptionTaxLabel(taxRate: number) {
  return taxRate <= 0 ? "消費税（非課税）" : `消費税（${formatTaxRateLabel(taxRate)}）`;
}
