import type { SliceContext } from "./types";
import type { MitruBackupData } from "./types";
import { collectImageAssetsForBackup, isIndexedDbImageReference, restoreImageAssetsFromBackup } from "@/lib/image-storage";
import {
  defaultCloudSyncSettings,
  defaultDocumentNumberSettings,
  defaultTaxSettings,
  initialCompanyInfo,
  initialPdfTemplateSettings,
} from "../defaults";

export const backupSliceVersion = 1;

type BackupSliceDependencies = {
  migrateProjectStore: (persistedState: unknown, version?: number) => Partial<ReturnType<SliceContext["get"]>>;
  projectStoreVersion: number;
};

function collectBackupImageReferences(data: MitruBackupData) {
  const references = new Set<string>();
  const addReference = (value: string) => {
    if (isIndexedDbImageReference(value)) references.add(value);
  };

  addReference(data.companyInfo.logoImage);
  addReference(data.companyInfo.sealImage);
  addReference(data.pdfTemplateSettings.quoteBackgroundImage);
  addReference(data.pdfTemplateSettings.invoiceBackgroundImage);
  Object.values(data.sealSettingsByProjectId).forEach((settings) => addReference(settings.sealImage));
  data.customers.forEach((customer) => {
    customer.businessCards.forEach(addReference);
  });

  return references;
}

function getRestoreErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "不明なエラー";
}

export function createBackupSlice(
  { set, get }: SliceContext,
  { migrateProjectStore, projectStoreVersion }: BackupSliceDependencies,
) {
  const createBackupData = (): MitruBackupData => ({
    app: "mitru",
    version: 3,
    storeVersion: projectStoreVersion,
    exportedAt: new Date().toISOString(),
    customers: get().customers,
    projects: get().projects,
    projectItems: get().projectItems,
    calculationTemplates: get().calculationTemplates,
    workItemMasters: get().workItemMasters,
    materialMasters: get().materialMasters,
    costSettingsByProjectId: get().costSettingsByProjectId,
    quoteSettingsByProjectId: get().quoteSettingsByProjectId,
    invoiceSettingsByProjectId: get().invoiceSettingsByProjectId,
    invoiceItemsByItemId: get().invoiceItemsByItemId,
    sealSettingsByProjectId: get().sealSettingsByProjectId,
    estimateDocuments: get().estimateDocuments,
    invoiceDocuments: get().invoiceDocuments,
    deliveryDocuments: get().deliveryDocuments,
    orderDocuments: get().orderDocuments,
    billingCloseRecords: get().billingCloseRecords,
    companyInfo: get().companyInfo,
    pdfTemplateSettings: get().pdfTemplateSettings,
    taxSettings: get().taxSettings,
    cloudSyncSettings: get().cloudSyncSettings,
    documentNumberSettings: get().documentNumberSettings,
  });

  return {
    markBackupCreated: () => {
      set({ lastBackupAt: new Date().toISOString() });
    },
    exportBackupData: createBackupData,
    exportBackupDataWithImageAssets: async () => {
      const backup = createBackupData();
      const { imageAssets } = await collectImageAssetsForBackup(collectBackupImageReferences(backup));
      if (Object.keys(imageAssets).length === 0) return backup;
      return {
        ...backup,
        imageAssets,
      };
    },
    restoreBackupData: (data: MitruBackupData, mode: "overwrite" | "merge") => {
      if (data.app && data.app !== "mitru") {
        throw new Error("Mitru用のバックアップファイルではありません。");
      }

      const source = migrateProjectStore(
        { state: data },
        typeof data.storeVersion === "number" ? data.storeVersion : undefined,
      );

      if (mode === "overwrite") {
        set({
          customers: source.customers ?? get().customers,
          projects: source.projects ?? [],
          projectItems: source.projectItems ?? [],
          calculationTemplates: source.calculationTemplates ?? [],
          workItemMasters: source.workItemMasters ?? [],
          materialMasters: source.materialMasters ?? get().materialMasters,
          costSettingsByProjectId: source.costSettingsByProjectId ?? {},
          quoteSettingsByProjectId: source.quoteSettingsByProjectId ?? {},
          invoiceSettingsByProjectId: source.invoiceSettingsByProjectId ?? {},
          invoiceItemsByItemId: source.invoiceItemsByItemId ?? {},
          sealSettingsByProjectId: source.sealSettingsByProjectId ?? {},
          estimateDocuments: source.estimateDocuments ?? [],
          invoiceDocuments: source.invoiceDocuments ?? [],
          deliveryDocuments: source.deliveryDocuments ?? [],
          orderDocuments: source.orderDocuments ?? [],
          billingCloseRecords: source.billingCloseRecords ?? [],
          companyInfo: source.companyInfo ?? get().companyInfo,
          pdfTemplateSettings: source.pdfTemplateSettings ?? get().pdfTemplateSettings,
          taxSettings: source.taxSettings ?? get().taxSettings,
          cloudSyncSettings: source.cloudSyncSettings ?? get().cloudSyncSettings,
          documentNumberSettings: source.documentNumberSettings ?? get().documentNumberSettings,
        });
        return;
      }

      const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
        const map = new Map(current.map((item) => [item.id, item]));
        incoming.forEach((item) => map.set(item.id, item));
        return Array.from(map.values());
      };

      set({
        customers: mergeById(get().customers, source.customers ?? []),
        projects: mergeById(get().projects, source.projects ?? []),
        projectItems: mergeById(get().projectItems, source.projectItems ?? []),
        calculationTemplates: mergeById(get().calculationTemplates, source.calculationTemplates ?? []),
        workItemMasters: mergeById(get().workItemMasters, source.workItemMasters ?? []),
        materialMasters: mergeById(get().materialMasters, source.materialMasters ?? []),
        costSettingsByProjectId: { ...get().costSettingsByProjectId, ...(source.costSettingsByProjectId ?? {}) },
        quoteSettingsByProjectId: { ...get().quoteSettingsByProjectId, ...(source.quoteSettingsByProjectId ?? {}) },
        invoiceSettingsByProjectId: { ...get().invoiceSettingsByProjectId, ...(source.invoiceSettingsByProjectId ?? {}) },
        invoiceItemsByItemId: { ...get().invoiceItemsByItemId, ...(source.invoiceItemsByItemId ?? {}) },
        sealSettingsByProjectId: { ...get().sealSettingsByProjectId, ...(source.sealSettingsByProjectId ?? {}) },
        estimateDocuments: mergeById(get().estimateDocuments, source.estimateDocuments ?? []),
        invoiceDocuments: mergeById(get().invoiceDocuments, source.invoiceDocuments ?? []),
        deliveryDocuments: mergeById(get().deliveryDocuments, source.deliveryDocuments ?? []),
        orderDocuments: mergeById(get().orderDocuments, source.orderDocuments ?? []),
        billingCloseRecords: mergeById(get().billingCloseRecords, source.billingCloseRecords ?? []),
        companyInfo: source.companyInfo ?? get().companyInfo,
        pdfTemplateSettings: source.pdfTemplateSettings ?? get().pdfTemplateSettings,
        taxSettings: source.taxSettings ?? get().taxSettings,
        cloudSyncSettings: source.cloudSyncSettings ?? get().cloudSyncSettings,
        documentNumberSettings: source.documentNumberSettings ?? get().documentNumberSettings,
      });
    },
    restoreBackupDataWithImageAssets: async (data: MitruBackupData, mode: "overwrite" | "merge") => {
      const imageResult = await restoreImageAssetsFromBackup(data.imageAssets);
      try {
        get().restoreBackupData(data, mode);
        return {
          ...imageResult,
          dataRestored: true,
        };
      } catch (error) {
        return {
          ...imageResult,
          dataRestored: false,
          dataRestoreError: getRestoreErrorMessage(error),
        };
      }
    },
    resetBusinessDataKeepingMasters: () => {
      set({
        customers: [],
        projects: [],
        projectItems: [],
        calculationTemplates: [],
        costSettingsByProjectId: {},
        quoteSettingsByProjectId: {},
        invoiceSettingsByProjectId: {},
        invoiceItemsByItemId: {},
        sealSettingsByProjectId: {},
        estimateDocuments: [],
        invoiceDocuments: [],
        deliveryDocuments: [],
        orderDocuments: [],
        billingCloseRecords: [],
        companyInfo: initialCompanyInfo,
        pdfTemplateSettings: initialPdfTemplateSettings,
        taxSettings: defaultTaxSettings,
        cloudSyncSettings: defaultCloudSyncSettings,
        documentNumberSettings: defaultDocumentNumberSettings,
        lastBackupAt: new Date().toISOString(),
      });
    },
  };
}
