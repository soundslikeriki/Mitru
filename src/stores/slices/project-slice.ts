import type { NewProjectInput, Project, SliceContext } from "./types";

export const projectSliceVersion = 2;

export function createProjectSlice({ set, get, now }: SliceContext) {
  return {
    createProject: (input: NewProjectInput) => {
      const createdAt = now();
      const currentUser = get().cloudSyncSettings.user;
      const ownerId = currentUser?.id || "local";
      const project: Project = {
        id: `project-${Date.now()}`,
        ...input,
        projectNumber: input.projectNumber?.trim() || generateNextProjectNumber(get().projects, createdAt),
        ownerId,
        assignedTo: input.assignedTo ?? currentUser?.id ?? null,
        status: "見積中",
        taxRateType: input.taxRateType ?? "standard",
        totalAmount: 0,
        progress: 0,
        nextActionDate: input.nextActionDate ?? "",
        processMemo: input.processMemo ?? "",
        ownerMemo: input.ownerMemo ?? "",
        deletedAt: null,
        createdAt,
        updatedAt: createdAt,
      };

      set({ projects: [project, ...get().projects] });
      return project;
    },
    updateProject: (id: string, input: Partial<Omit<Project, "id" | "ownerId" | "createdAt">>) => {
      set({
        projects: get().projects.map((project) =>
          project.id === id
            ? {
                ...project,
                ...input,
                syncMetadata: markSyncMetadataDirty(project.syncMetadata),
                updatedAt: now(),
              }
            : project,
        ),
      });
    },
    deleteProject: (id: string) => {
      const deletedAt = now();
      const estimateDocumentIds = new Set(get().estimateDocuments.filter((document) => document.projectId === id).map((document) => document.id));
      const invoiceDocumentIds = new Set(get().invoiceDocuments.filter((document) => document.projectId === id).map((document) => document.id));

      set({
        projects: get().projects.map((project) =>
          project.id === id ? { ...project, deletedAt, syncMetadata: markSyncMetadataDirty(project.syncMetadata), updatedAt: deletedAt } : project,
        ),
        estimateDocuments: get().estimateDocuments.map((document) =>
          document.projectId === id ? { ...document, deletedAt, syncMetadata: markSyncMetadataDirty(document.syncMetadata), updatedAt: deletedAt } : document,
        ),
        invoiceDocuments: get().invoiceDocuments.map((document) =>
          document.projectId === id
            ? {
                ...document,
                deletedAt,
                syncMetadata: markSyncMetadataDirty(document.syncMetadata),
                updatedAt: deletedAt,
                paymentRecords: (document.paymentRecords ?? []).map((record) => ({
                  ...record,
                  deletedAt,
                  syncMetadata: markSyncMetadataDirty(record.syncMetadata),
                  updatedAt: deletedAt,
                })),
              }
            : document,
        ),
        billingCloseRecords: get().billingCloseRecords
          .map((record) => ({
            ...record,
            targetEstimateIds: record.targetEstimateIds.filter((estimateId) => !estimateDocumentIds.has(estimateId)),
            createdInvoiceIds: record.createdInvoiceIds.filter((invoiceId) => !invoiceDocumentIds.has(invoiceId)),
          }))
          .filter((record) => record.targetEstimateIds.length > 0 || record.createdInvoiceIds.length > 0),
      });
    },
  };
}

function markSyncMetadataDirty<TSyncMetadata extends { lastSyncedAt: string | null } | undefined>(
  syncMetadata: TSyncMetadata,
) {
  return syncMetadata ? { ...syncMetadata, lastSyncedAt: null } : syncMetadata;
}

function generateNextProjectNumber(projects: Project[], dateIso: string) {
  const year = String(new Date(dateIso).getFullYear());
  const highest = projects.reduce((max, project) => {
    const match = project.projectNumber?.match(new RegExp(`^${year}-(\\d{3,})$`));
    if (!match) return max;
    return Math.max(max, Number(match[1] || 0));
  }, 0);
  return `${year}-${String(highest + 1).padStart(3, "0")}`;
}
