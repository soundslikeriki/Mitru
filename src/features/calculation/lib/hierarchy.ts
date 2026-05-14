import { calculateLine } from "@/features/calculation/lib/calculation";
import { summarizeProfitComparison, type ProfitComparison } from "@/features/calculation/lib/profit";
import type { ProjectItem } from "@/stores/project-store";

export type CalculationHierarchyNode =
  | {
      id: string;
      type: "major";
      label: string;
      depth: 0;
      items: ProjectItem[];
      totals: CalculationHierarchyTotals;
      profit: ProfitComparison;
      subRows: CalculationHierarchyNode[];
    }
  | {
      id: string;
      type: "middle";
      label: string;
      depth: 1;
      items: ProjectItem[];
      totals: CalculationHierarchyTotals;
      profit: ProfitComparison;
      subRows: CalculationHierarchyNode[];
    }
  | {
      id: string;
      type: "item";
      label: string;
      depth: 2;
      item: ProjectItem;
      items: ProjectItem[];
      totals: CalculationHierarchyTotals;
      profit: ProfitComparison;
      subRows: [];
    };

export type CalculationHierarchyTotals = {
  laborCost: number;
  welfareCost: number;
  totalLaborCost: number;
  materialCost: number;
  expenseCost: number;
  subtotal: number;
};

export function buildCalculationHierarchy(items: ProjectItem[]): CalculationHierarchyNode[] {
  const majorMap = new Map<string, ProjectItem[]>();

  items.forEach((item) => {
    const major = item.majorCategory || "未分類";
    if (!majorMap.has(major)) majorMap.set(major, []);
    majorMap.get(major)!.push(item);
  });

  return Array.from(majorMap.entries()).map(([major, majorItems]) => {
    const middleMap = new Map<string, ProjectItem[]>();
    majorItems.forEach((item) => {
      const middle = item.middleCategory || "未分類";
      if (!middleMap.has(middle)) middleMap.set(middle, []);
      middleMap.get(middle)!.push(item);
    });

    return createGroupNode({
      id: `major-${major}`,
      type: "major",
      label: major,
      depth: 0,
      items: majorItems,
      subRows: Array.from(middleMap.entries()).map(([middle, middleItems]) =>
        createMiddleNode(major, middle, middleItems),
      ),
    });
  });
}

function createMiddleNode(major: string, middle: string, items: ProjectItem[]): CalculationHierarchyNode {
  return {
    id: `middle-${major}-${middle}`,
    type: "middle",
    label: middle,
    depth: 1,
    items,
    totals: summarizeTotals(items),
    profit: summarizeProfitComparison(items),
    subRows: items.map((item) => createItemNode(item)),
  };
}

function createItemNode(item: ProjectItem): CalculationHierarchyNode {
  const line = calculateLine(item);
  return {
    id: item.id,
    type: "item",
    label: item.name,
    depth: 2,
    item,
    items: [item],
    totals: {
      laborCost: line.laborCost,
      welfareCost: line.welfareCost,
      totalLaborCost: line.totalLaborCost,
      materialCost: line.materialCost,
      expenseCost: line.expenseCost,
      subtotal: line.subtotal,
    },
    profit: summarizeProfitComparison([item]),
    subRows: [],
  };
}

function createGroupNode(input: {
  id: string;
  type: "major";
  label: string;
  depth: 0;
  items: ProjectItem[];
  subRows: CalculationHierarchyNode[];
}): CalculationHierarchyNode {
  return {
    ...input,
    totals: summarizeTotals(input.items),
    profit: summarizeProfitComparison(input.items),
  };
}

function summarizeTotals(items: ProjectItem[]): CalculationHierarchyTotals {
  return items.reduce<CalculationHierarchyTotals>(
    (summary, item) => {
      const line = calculateLine(item);
      return {
        laborCost: summary.laborCost + line.laborCost,
        welfareCost: summary.welfareCost + line.welfareCost,
        totalLaborCost: summary.totalLaborCost + line.totalLaborCost,
        materialCost: summary.materialCost + line.materialCost,
        expenseCost: summary.expenseCost + line.expenseCost,
        subtotal: summary.subtotal + line.subtotal,
      };
    },
    { laborCost: 0, welfareCost: 0, totalLaborCost: 0, materialCost: 0, expenseCost: 0, subtotal: 0 },
  );
}
