import type { Project, SliceContext } from "./types";

export const projectSliceVersion = 1;

export function createProjectSlice({ set, get, now }: SliceContext) {
  return {
    createProject: (
      input: Omit<Project, "id" | "status" | "totalAmount" | "progress" | "createdAt" | "updatedAt">,
    ) => {
      const createdAt = now();
      const project: Project = {
        id: `project-${Date.now()}`,
        ...input,
        status: "見積中",
        totalAmount: 0,
        progress: 0,
        nextActionDate: input.nextActionDate ?? "",
        processMemo: input.processMemo ?? "",
        ownerMemo: input.ownerMemo ?? "",
        createdAt,
        updatedAt: createdAt,
      };

      set({ projects: [project, ...get().projects] });
      return project;
    },
    updateProject: (id: string, input: Partial<Omit<Project, "id" | "createdAt">>) => {
      set({
        projects: get().projects.map((project) =>
          project.id === id
            ? {
                ...project,
                ...input,
                updatedAt: now(),
              }
            : project,
        ),
      });
    },
    deleteProject: (id: string) => {
      const { [id]: _costSettings, ...costSettingsByProjectId } = get().costSettingsByProjectId;
      const { [id]: _quoteSettings, ...quoteSettingsByProjectId } = get().quoteSettingsByProjectId;
      const { [id]: _invoiceSettings, ...invoiceSettingsByProjectId } = get().invoiceSettingsByProjectId;
      const { [id]: _sealSettings, ...sealSettingsByProjectId } = get().sealSettingsByProjectId;
      const projectItemIds = new Set(get().projectItems.filter((item) => item.projectId === id).map((item) => item.id));
      const estimateDocumentIds = new Set(get().estimateDocuments.filter((document) => document.projectId === id).map((document) => document.id));
      const invoiceDocumentIds = new Set(get().invoiceDocuments.filter((document) => document.projectId === id).map((document) => document.id));
      const invoiceItemsByItemId = Object.fromEntries(
        Object.entries(get().invoiceItemsByItemId).filter(([itemId]) => !projectItemIds.has(itemId)),
      );

      set({
        projects: get().projects.filter((project) => project.id !== id),
        projectItems: get().projectItems.filter((item) => item.projectId !== id),
        estimateDocuments: get().estimateDocuments.filter((document) => document.projectId !== id),
        invoiceDocuments: get().invoiceDocuments.filter((document) => document.projectId !== id),
        deliveryDocuments: get().deliveryDocuments.filter((document) => document.projectId !== id),
        orderDocuments: get().orderDocuments.filter((document) => document.projectId !== id),
        billingCloseRecords: get().billingCloseRecords
          .map((record) => ({
            ...record,
            targetEstimateIds: record.targetEstimateIds.filter((estimateId) => !estimateDocumentIds.has(estimateId)),
            createdInvoiceIds: record.createdInvoiceIds.filter((invoiceId) => !invoiceDocumentIds.has(invoiceId)),
          }))
          .filter((record) => record.targetEstimateIds.length > 0 || record.createdInvoiceIds.length > 0),
        invoiceItemsByItemId,
        costSettingsByProjectId,
        quoteSettingsByProjectId,
        invoiceSettingsByProjectId,
        sealSettingsByProjectId,
      });
    },
  };
}
