import type { MaterialMaster, OrderDocument, Project, PurchaseRecord } from "@/stores/project-store";

export type PurchaseOrderSummary = {
  order: OrderDocument;
  project: Project | undefined;
  orderedAmount: number;
  purchasedAmount: number;
  remainingAmount: number;
  purchaseRecords: PurchaseRecord[];
  masterUnitPrice?: number;
  unitPriceDiff?: number;
};

export function getOrderPurchasedAmount(order: OrderDocument) {
  return order.purchasedAmount ?? (order.purchaseRecords ?? []).reduce((sum, record) => sum + record.amount, 0);
}

export function getOrderRemainingAmount(order: OrderDocument) {
  return Math.max(0, order.totalAmount - getOrderPurchasedAmount(order));
}

export function buildPurchaseOrderSummaries({
  orders,
  projects,
  materialMasters,
}: {
  orders: OrderDocument[];
  projects: Project[];
  materialMasters: MaterialMaster[];
}): PurchaseOrderSummary[] {
  return orders
    .map((order) => {
      const purchasedAmount = getOrderPurchasedAmount(order);
      const line = order.orderLineSnapshot?.[0];
      const matchedMaster = line ? findMaterialMaster(line, materialMasters) : undefined;
      return {
        order,
        project: projects.find((project) => project.id === order.projectId),
        orderedAmount: order.totalAmount,
        purchasedAmount,
        remainingAmount: Math.max(0, order.totalAmount - purchasedAmount),
        purchaseRecords: order.purchaseRecords ?? [],
        masterUnitPrice: matchedMaster?.materialUnitCost,
        unitPriceDiff: matchedMaster && line ? line.unitPrice - matchedMaster.materialUnitCost : undefined,
      };
    })
    .sort((a, b) => getOrderSortDate(b.order).localeCompare(getOrderSortDate(a.order)));
}

function getOrderSortDate(order: OrderDocument) {
  const value = order.dueDate || order.orderedAt || order.updatedAt || order.createdAt;
  return typeof value === "string" && value.trim() ? value : "1970-01-01";
}

function findMaterialMaster(line: NonNullable<OrderDocument["orderLineSnapshot"]>[number], masters: MaterialMaster[]) {
  const label = `${line.name} ${line.specification}`.toLowerCase();
  return masters.find((master) => {
    const candidates = [master.productName, master.productNumber, master.manufacturer, master.specification]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const needles = [master.productName, master.productNumber].filter((value): value is string => Boolean(value?.trim()));
    return candidates.length > 0 && needles.some((needle) => label.includes(needle.toLowerCase()));
  });
}
