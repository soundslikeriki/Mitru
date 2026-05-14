import {
  getActualLaborUnitCost,
  getActualUnitCost,
  getEstimatedLaborUnitCost,
  getEstimatedUnitCost,
} from "@/features/calculation/lib/profit";
import type { ProjectItem, WorkItemMaster } from "@/stores/project-store";

export type PreviousUnitPriceSnapshot = {
  estimatedUnitCost: number;
  actualUnitCost: number;
  estimatedLaborUnitCost: number;
  actualLaborUnitCost: number;
  updatedAt: string;
};

export type PriceDiff = {
  amount: number;
  rate: number | null;
};

export function findMatchingWorkItemMaster(item: ProjectItem, masters: WorkItemMaster[]) {
  return masters.find(
    (master) =>
      normalize(master.majorCategory) === normalize(item.majorCategory) &&
      normalize(master.middleCategory) === normalize(item.middleCategory) &&
      normalize(master.name) === normalize(item.name),
  );
}

export function getPreviousUnitPrice(item: ProjectItem, allItems: ProjectItem[]): PreviousUnitPriceSnapshot | null {
  const previousItem = allItems
    .filter((candidate) => candidate.id !== item.id && isSameWorkItem(candidate, item))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt))[0];

  if (!previousItem) return null;

  return {
    estimatedUnitCost: getEstimatedUnitCost(previousItem),
    actualUnitCost: getActualUnitCost(previousItem),
    estimatedLaborUnitCost: getEstimatedLaborUnitCost(previousItem),
    actualLaborUnitCost: getActualLaborUnitCost(previousItem),
    updatedAt: previousItem.updatedAt || previousItem.createdAt,
  };
}

export function calculatePriceDiff(current: number, previous?: number | null): PriceDiff | null {
  if (previous == null) return null;
  const amount = current - previous;
  return {
    amount,
    rate: previous === 0 ? null : amount / previous,
  };
}

function isSameWorkItem(a: ProjectItem, b: ProjectItem) {
  return (
    normalize(a.majorCategory) === normalize(b.majorCategory) &&
    normalize(a.middleCategory) === normalize(b.middleCategory) &&
    normalize(a.name) === normalize(b.name)
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
