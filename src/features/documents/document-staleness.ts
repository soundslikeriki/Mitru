import type { ProjectItem } from "@/stores/project-store";

type LineSnapshotWithItem = {
  item: ProjectItem;
};

function getItemTimestamp(item: Pick<ProjectItem, "updatedAt" | "createdAt">) {
  return item.updatedAt || item.createdAt || "";
}

export function isDocumentSnapshotBehindCalculation(
  currentItems: ProjectItem[],
  lineSnapshot: LineSnapshotWithItem[] | undefined,
  snapshotCreatedAt: string,
  latestCalculationUpdatedAt: string,
) {
  if (!lineSnapshot || lineSnapshot.length === 0) {
    return Boolean(latestCalculationUpdatedAt && latestCalculationUpdatedAt > snapshotCreatedAt);
  }

  if (currentItems.length !== lineSnapshot.length) {
    return true;
  }

  const snapshotByItemId = new Map(lineSnapshot.map((line) => [line.item.id, line.item]));
  return currentItems.some((item) => {
    const snapshotItem = snapshotByItemId.get(item.id);
    if (!snapshotItem) return true;

    const currentUpdatedAt = getItemTimestamp(item);
    const snapshotUpdatedAt = getItemTimestamp(snapshotItem) || snapshotCreatedAt;
    return Boolean(currentUpdatedAt && currentUpdatedAt > snapshotUpdatedAt);
  });
}
