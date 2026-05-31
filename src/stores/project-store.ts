import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createBlankItem,
  createProjectItemFromMaster,
  createSampleItems,
  defaultCloudSyncSettings,
  defaultCostSettings,
  defaultInvoiceSettings,
  defaultQuoteSettings,
  defaultTaxSettings,
  defaultDocumentNumberSettings,
  generateDocumentNumber,
  initialCompanyInfo,
  initialCustomers,
  initialDeliveryDocuments,
  initialEstimateDocuments,
  initialInvoiceDocuments,
  initialBillingCloseRecords,
  initialMaterialMasters,
  initialOrderDocuments,
  initialPdfTemplateSettings,
  initialProjectItems,
  initialProjects,
  initialWorkItemMasters,
  normalizeProjectSealSettings,
  now,
} from "./defaults";
import { createBackupSlice } from "./slices/backup-slice";
import { createCloudSyncSlice } from "./slices/cloud-sync-slice";
import { createCalculationSlice } from "./slices/calculation-slice";
import { createCustomerSlice } from "./slices/customer-slice";
import { createDeliverySlice, createInvoiceSlice, createOrderSlice, createQuoteSlice } from "./slices/document-slice";
import { createMasterSlice } from "./slices/master-slice";
import {
  createSafeLocalStorage,
  createThrottledStateStorage,
  migrateProjectStore,
  partializeProjectStore,
  projectStoreVersion,
  recoverCorruptedProjectStore,
} from "./slices/persist";
import { createProjectSlice } from "./slices/project-slice";
import { createSettingsSlice } from "./slices/settings-slice";

export type {
  BankAccount,
  BillingCloseRecord,
  CompanyInfo,
  CloudSyncSettings,
  CloudSyncUser,
  Customer,
  CustomerInput,
  CustomerStatus,
  CustomerType,
  DeliveryDocument,
  DeliveryDocumentStatus,
  DocumentNumberConfig,
  DocumentNumberSettings,
  EstimateDocument,
  EstimateDocumentStatus,
  InvoiceDocument,
  MaterialCategory,
  MaterialMaster,
  MaterialMasterInput,
  CalculationTemplate,
  MitruBackupData,
  NewProjectInput,
  OrderDocument,
  OrderDocumentStatus,
  OrderLineSnapshot,
  PaymentMethod,
  PaymentRecord,
  PurchaseRecord,
  PdfTemplateSettings,
  Project,
  ProjectCostSettings,
  ProjectInvoiceItemState,
  ProjectInvoiceSettings,
  ProjectItem,
  ProjectItemTemplateInput,
  ProjectQuoteSettings,
  ProjectSealSettings,
  ProjectStatus,
  ProjectStore,
  ProjectSyncSummary,
  ProjectTaxRateType,
  SyncMetadata,
  TaxDisplayMode,
  TaxRoundingMode,
  TaxSettings,
  WorkItemMaster,
  WorkItemMasterInput,
} from "./slices/types";

import type {
  ProjectCostSettings,
  ProjectInvoiceSettings,
  ProjectQuoteSettings,
  ProjectSealSettings,
  ProjectStore,
} from "./slices/types";

export const documentSealSettingsKey = "__mitru-document-seal-settings__";

export const useProjectStore = create<ProjectStore>()(
  persist(
    // 現在のMitruはZustand + localStorageのみで永続化しています。SQLite/drizzleのDB層は未使用です。
    (set, get) => ({
      customers: initialCustomers,
      projects: initialProjects,
      projectItems: initialProjectItems,
      calculationTemplates: [],
      workItemMasters: initialWorkItemMasters,
      materialMasters: initialMaterialMasters,
      costSettingsByProjectId: {},
      quoteSettingsByProjectId: {},
      invoiceSettingsByProjectId: {},
      invoiceItemsByItemId: {
        "item-001": { previousRate: 0.25, currentRate: 0.5 },
        "item-002": { previousRate: 0.4, currentRate: 0.45 },
        "item-003": { previousRate: 0.15, currentRate: 0.35 },
      },
      sealSettingsByProjectId: {},
      estimateDocuments: initialEstimateDocuments,
      invoiceDocuments: initialInvoiceDocuments,
      deliveryDocuments: initialDeliveryDocuments,
      orderDocuments: initialOrderDocuments,
      billingCloseRecords: initialBillingCloseRecords,
      companyInfo: initialCompanyInfo,
      pdfTemplateSettings: initialPdfTemplateSettings,
      taxSettings: defaultTaxSettings,
      cloudSyncSettings: defaultCloudSyncSettings,
      documentNumberSettings: defaultDocumentNumberSettings,
      lastBackupAt: "",
      ...createCustomerSlice({ set, get, now }),
      ...createProjectSlice({ set, get, now }),
      ...createCalculationSlice(
        { set, get, now },
        {
          createBlankItem,
          createProjectItemFromMaster,
          createSampleItems,
          defaultCostSettings,
        },
      ),
      ...createQuoteSlice(
        { set, get, now },
        {
          defaultInvoiceSettings,
          defaultQuoteSettings,
          generateDocumentNumber,
          getProjectSealSettings,
          normalizeProjectSealSettings,
        },
      ),
      ...createInvoiceSlice(
        { set, get, now },
        {
          defaultInvoiceSettings,
          defaultQuoteSettings,
          generateDocumentNumber,
          getProjectSealSettings,
          normalizeProjectSealSettings,
        },
      ),
      ...createDeliverySlice({ set, get, now }),
      ...createOrderSlice({ set, get, now }),
      ...createMasterSlice({ set, get, now }),
      ...createSettingsSlice({ set, get, now }),
      ...createCloudSyncSlice({ set, get, now }),
      ...createBackupSlice(
        { set, get, now },
        {
          migrateProjectStore,
          projectStoreVersion,
        },
      ),
    }),
    {
      name: "mitru-local-store",
      storage: createJSONStorage(() => createThrottledStateStorage(createSafeLocalStorage(), 300)),
      version: projectStoreVersion,
      migrate: migrateProjectStore,
      partialize: partializeProjectStore,
      onRehydrateStorage: () => (_state, error) => {
        recoverCorruptedProjectStore(error);
      },
    },
  ),
);

export function getProjectCostSettings(
  settings: Record<string, ProjectCostSettings>,
  projectId: string,
) {
  return settings[projectId] ?? defaultCostSettings;
}

export function getProjectQuoteSettings(
  settings: Record<string, ProjectQuoteSettings>,
  projectId: string,
) {
  return settings[projectId] ?? defaultQuoteSettings;
}

export function getProjectInvoiceSettings(
  settings: Record<string, ProjectInvoiceSettings>,
  projectId: string,
) {
  return settings[projectId] ?? defaultInvoiceSettings;
}

export function getProjectSealSettings(
  settings: Record<string, ProjectSealSettings> | undefined,
  projectId: string,
  fallbackSealImage = "",
) {
  const current = settings?.[projectId];
  return normalizeProjectSealSettings(current, fallbackSealImage);
}

export function getDocumentSealSettings(
  settings: Record<string, ProjectSealSettings> | undefined,
  projectId: string,
  fallbackSealImage = "",
) {
  const current = settings?.[documentSealSettingsKey] ?? settings?.[projectId];
  return normalizeProjectSealSettings(current, fallbackSealImage);
}
