import type { StateStorage } from "zustand/middleware";
import { backupSliceVersion } from "./backup-slice";
import { calculationSliceVersion } from "./calculation-slice";
import { cloudSyncSliceVersion } from "./cloud-sync-slice";
import { customerSliceVersion } from "./customer-slice";
import { deliverySliceVersion, invoiceSliceVersion, orderSliceVersion, quoteSliceVersion } from "./document-slice";
import { masterSliceVersion } from "./master-slice";
import { projectSliceVersion } from "./project-slice";
import { settingsSliceVersion } from "./settings-slice";
import type { ProjectStore } from "./types";
import { cloudSyncFeatureEnabled } from "@/lib/feature-flags";
import { normalizeProjectTaxRateType, resolveProjectTaxRate } from "@/lib/tax";
import {
  defaultCostSettings,
  defaultCloudSyncSettings,
  defaultInteriorWorkItemMasterInputs,
  defaultDocumentNumberSettings,
  defaultTaxSettings,
  defaultWelfareRate,
  initialCompanyInfo,
  initialPdfTemplateSettings,
  samplePortfolioActualCosts,
  samplePortfolioCustomers,
  samplePortfolioEstimateDocuments,
  samplePortfolioInvoiceDocuments,
  samplePortfolioProjectItems,
  samplePortfolioProjects,
  systemMaterialCategories,
} from "../defaults";
import type {
  BillingCloseRecord,
  BankAccount,
  CloudSyncConflict,
  CloudSyncUser,
  CalculationTemplate,
  CompanyInfo,
  Customer,
  DeliveryDocument,
  DocumentNumberConfig,
  EstimateDocument,
  EstimateLineSnapshot,
  EstimateTotalsSnapshot,
  InvoiceDocument,
  InvoiceLineSnapshot,
  MaterialMaster,
  OrderDocument,
  PaymentRecord,
  Project,
  ProjectCostSettings,
  ProjectItem,
  ProjectInvoiceSettings,
  ProjectStatus,
  PurchaseRecord,
  SyncMetadata,
  TaxSettings,
  WorkItemMaster,
} from "./types";

export const projectStoreVersion = 57;
const projectStoreKey = "mitru-local-store";
const sampleDataRemovedKey = "mitru-sample-data-removed-v1";
const samplePortfolioItemById = new Map(samplePortfolioProjectItems.map((item) => [item.id, item]));
const samplePortfolioCustomerIds = new Set(samplePortfolioCustomers.map((customer) => customer.id));
const samplePortfolioProjectIds = new Set(samplePortfolioProjects.map((project) => project.id));
const samplePortfolioEstimateDocumentIds = new Set(samplePortfolioEstimateDocuments.map((document) => document.id));
const samplePortfolioInvoiceDocumentIds = new Set(samplePortfolioInvoiceDocuments.map((document) => document.id));

function notifyStorageWarning(description: string, title = "ローカル保存に失敗しました") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("mitru-storage-warning", {
      detail: {
        title,
        description,
        tone: "error",
      },
    }),
  );
}

export type FlushableStateStorage = StateStorage & {
  flushAll: () => void;
};

export const slicePersistVersions = {
  customer: customerSliceVersion,
  project: projectSliceVersion,
  calculation: calculationSliceVersion,
  quote: quoteSliceVersion,
  invoice: invoiceSliceVersion,
  delivery: deliverySliceVersion,
  order: orderSliceVersion,
  master: masterSliceVersion,
  settings: settingsSliceVersion,
  cloudSync: cloudSyncSliceVersion,
  backup: backupSliceVersion,
} as const;

const persistedKeys = [
  "customers",
  "projects",
  "projectItems",
  "calculationTemplates",
  "workItemMasters",
  "materialMasters",
  "costSettingsByProjectId",
  "quoteSettingsByProjectId",
  "invoiceSettingsByProjectId",
  "invoiceItemsByItemId",
  "sealSettingsByProjectId",
  "estimateDocuments",
  "invoiceDocuments",
  "deliveryDocuments",
  "orderDocuments",
  "billingCloseRecords",
  "companyInfo",
  "pdfTemplateSettings",
  "taxSettings",
  "cloudSyncSettings",
  "documentNumberSettings",
  "lastBackupAt",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function omitRecordKeys<T>(record: Record<string, T> | undefined, keys: Set<string>) {
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
}

function hasUserRemovedSampleData() {
  return typeof localStorage !== "undefined" && localStorage.getItem(sampleDataRemovedKey) === "done";
}

function refreshSamplePortfolioData(migrated: Partial<ProjectStore>): Partial<ProjectStore> {
  if (hasUserRemovedSampleData()) return migrated;

  return {
    ...migrated,
    customers: [
      ...(Array.isArray(migrated.customers)
        ? migrated.customers.filter((customer) => !samplePortfolioCustomerIds.has(customer.id))
        : []),
      ...samplePortfolioCustomers,
    ],
    projects: [
      ...(Array.isArray(migrated.projects)
        ? migrated.projects.filter((project) => !samplePortfolioProjectIds.has(project.id))
        : []),
      ...samplePortfolioProjects,
    ],
    projectItems: [
      ...(Array.isArray(migrated.projectItems)
        ? migrated.projectItems.filter(
            (item) => !samplePortfolioProjectIds.has(item.projectId) && !item.id.startsWith("sample-"),
          )
        : []),
      ...samplePortfolioProjectItems,
    ],
    costSettingsByProjectId: omitRecordKeys(migrated.costSettingsByProjectId, samplePortfolioProjectIds),
    quoteSettingsByProjectId: omitRecordKeys(migrated.quoteSettingsByProjectId, samplePortfolioProjectIds),
    invoiceSettingsByProjectId: omitRecordKeys(migrated.invoiceSettingsByProjectId, samplePortfolioProjectIds),
    invoiceItemsByItemId: Object.fromEntries(
      Object.entries(migrated.invoiceItemsByItemId ?? {}).filter(([itemId]) => !itemId.startsWith("sample-")),
    ),
    sealSettingsByProjectId: omitRecordKeys(migrated.sealSettingsByProjectId, samplePortfolioProjectIds),
    estimateDocuments: [
      ...(Array.isArray(migrated.estimateDocuments)
        ? migrated.estimateDocuments.filter(
            (document) =>
              !samplePortfolioProjectIds.has(document.projectId) &&
              !samplePortfolioEstimateDocumentIds.has(document.id),
          )
        : []),
      ...samplePortfolioEstimateDocuments,
    ],
    invoiceDocuments: [
      ...(Array.isArray(migrated.invoiceDocuments)
        ? migrated.invoiceDocuments.filter(
            (document) =>
              !samplePortfolioProjectIds.has(document.projectId) &&
              !samplePortfolioInvoiceDocumentIds.has(document.id),
          )
        : []),
      ...samplePortfolioInvoiceDocuments,
    ],
    deliveryDocuments: Array.isArray(migrated.deliveryDocuments)
      ? migrated.deliveryDocuments.filter((document) => !samplePortfolioProjectIds.has(document.projectId))
      : [],
    orderDocuments: Array.isArray(migrated.orderDocuments)
      ? migrated.orderDocuments.filter((document) => !samplePortfolioProjectIds.has(document.projectId))
      : [],
  };
}

function createMigratedMasterId(prefix: string, index: number) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-migrated-${Date.now()}-${index}-${random}`;
}

function normalizeUniqueMasterIds<TMaster extends { id: string; updatedAt: string }>(
  masters: TMaster[],
  prefix: "master" | "material",
) {
  const seenIds = new Set<string>();
  return masters.map((master, index) => {
    if (master.id && !seenIds.has(master.id)) {
      seenIds.add(master.id);
      return master;
    }
    const nextId = createMigratedMasterId(prefix, index + 1);
    seenIds.add(nextId);
    return {
      ...master,
      id: nextId,
      updatedAt: master.updatedAt || new Date().toISOString(),
    };
  });
}

function normalizeMaterialCategory(category: unknown): MaterialMaster["category"] {
  if (typeof category === "string" && systemMaterialCategories.includes(category as NonNullable<MaterialMaster["category"]>)) {
    return category as MaterialMaster["category"];
  }
  return "資材・建材";
}

function createInitialSyncMetadata(): SyncMetadata {
  return {
    lastSyncedAt: null,
    serverId: null,
    version: 1,
    syncedBy: null,
  };
}

function normalizeSyncMetadata(value: unknown): SyncMetadata {
  if (!isRecord(value)) return createInitialSyncMetadata();

  const version = Number(value.version);
  return {
    lastSyncedAt: typeof value.lastSyncedAt === "string" && value.lastSyncedAt ? value.lastSyncedAt : null,
    serverId: typeof value.serverId === "string" && value.serverId ? value.serverId : null,
    version: Number.isFinite(version) && version > 0 ? Math.floor(version) : 1,
    syncedBy: typeof value.syncedBy === "string" && value.syncedBy ? value.syncedBy : null,
  };
}

function isCloudSyncAuthState(value: unknown): value is ProjectStore["cloudSyncSettings"]["authState"] {
  return value === "idle" || value === "authenticating" || value === "authenticated" || value === "error";
}

function isCloudSyncStatus(value: unknown): value is ProjectStore["cloudSyncSettings"]["syncStatus"] {
  return value === "idle" || value === "syncing" || value === "success" || value === "error";
}

function normalizeCloudSyncUser(value: unknown): CloudSyncUser | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const email = typeof value.email === "string" ? value.email : "";
  const name = typeof value.name === "string" ? value.name : "";
  if (!id || !email) return null;
  return { id, email, name };
}

function normalizeCloudSyncEntityResult(
  value: unknown,
  fallback: ProjectStore["cloudSyncSettings"]["lastSyncResults"]["projects"],
) {
  if (!isRecord(value)) return fallback;
  const status = value.status === "success" || value.status === "error" || value.status === "skipped" || value.status === "idle"
    ? value.status
    : fallback.status;
  return {
    status,
    pulled: Number(value.pulled ?? fallback.pulled) || 0,
    pushed: Number(value.pushed ?? fallback.pushed) || 0,
    skipped: Number(value.skipped ?? fallback.skipped) || 0,
    message: String(value.message ?? fallback.message),
    syncedAt: typeof value.syncedAt === "string" ? value.syncedAt : fallback.syncedAt,
    syncCursorId: typeof value.syncCursorId === "string" ? value.syncCursorId : fallback.syncCursorId ?? null,
  };
}

function normalizeCloudSyncTimestamp(value: unknown) {
  return typeof value === "string" && value ? value : "";
}

function normalizeEntityLastSyncedAt(
  settings: Record<string, unknown>,
  field: keyof Pick<
    ProjectStore["cloudSyncSettings"],
    | "lastProjectsSyncedAt"
    | "lastCustomersSyncedAt"
    | "lastEstimatesSyncedAt"
    | "lastInvoicesSyncedAt"
    | "lastPaymentsSyncedAt"
  >,
  entity: keyof ProjectStore["cloudSyncSettings"]["lastSyncResults"],
) {
  const explicitTimestamp = normalizeCloudSyncTimestamp(settings[field]);
  if (explicitTimestamp) return explicitTimestamp;

  const lastSyncResults = isRecord(settings.lastSyncResults) ? settings.lastSyncResults : {};
  const entityResult = isRecord(lastSyncResults[entity]) ? lastSyncResults[entity] : {};
  if (entityResult.status !== "success") return "";
  return normalizeCloudSyncTimestamp(entityResult.syncedAt);
}

function normalizeEntitySyncCursorId(
  settings: Record<string, unknown>,
  field: keyof Pick<
    ProjectStore["cloudSyncSettings"],
    | "lastProjectsSyncCursorId"
    | "lastCustomersSyncCursorId"
    | "lastEstimatesSyncCursorId"
    | "lastInvoicesSyncCursorId"
    | "lastPaymentsSyncCursorId"
  >,
  entity: keyof ProjectStore["cloudSyncSettings"]["lastSyncResults"],
) {
  const explicitCursorId = normalizeCloudSyncTimestamp(settings[field]);
  if (explicitCursorId) return explicitCursorId;

  const lastSyncResults = isRecord(settings.lastSyncResults) ? settings.lastSyncResults : {};
  const entityResult = isRecord(lastSyncResults[entity]) ? lastSyncResults[entity] : {};
  if (entityResult.status !== "success") return "";
  return normalizeCloudSyncTimestamp(entityResult.syncCursorId);
}

function normalizeCloudSyncProgress(value: unknown): ProjectStore["cloudSyncSettings"]["syncProgress"] {
  if (!isRecord(value)) return defaultCloudSyncSettings.syncProgress;
  const totalSteps = Math.max(1, Number(value.totalSteps || defaultCloudSyncSettings.syncProgress.totalSteps));
  const currentStep = Math.min(Math.max(0, Number(value.currentStep || 0)), totalSteps);
  return {
    isSyncing: Boolean(value.isSyncing),
    currentStep,
    totalSteps,
    label: typeof value.label === "string" && value.label ? value.label : defaultCloudSyncSettings.syncProgress.label,
    startedAt: typeof value.startedAt === "string" && value.startedAt ? value.startedAt : null,
  };
}

function normalizeCloudSyncHistory(value: unknown): ProjectStore["cloudSyncSettings"]["syncHistory"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => {
      const status: ProjectStore["cloudSyncSettings"]["syncHistory"][number]["status"] =
        entry.status === "success" || entry.status === "partial" || entry.status === "error"
          ? entry.status
          : "error";
      return {
        id: typeof entry.id === "string" && entry.id ? entry.id : `sync-history-${Date.now()}`,
        ranAt:
          typeof entry.ranAt === "string" && entry.ranAt
            ? entry.ranAt
            : typeof entry.syncedAt === "string" && entry.syncedAt
              ? entry.syncedAt
              : new Date().toISOString(),
        status,
        succeeded: Math.max(0, Number(entry.succeeded || 0)),
        failed: Math.max(0, Number(entry.failed || 0)),
        message: String(entry.message || "同期履歴"),
      };
    })
    .slice(0, 3);
}

function isCloudSyncEntityType(value: unknown): value is CloudSyncConflict["entityType"] {
  return value === "projects" || value === "customers" || value === "estimates" || value === "invoices" || value === "payments";
}

function normalizeCloudSyncConflicts(value: unknown): CloudSyncConflict[] {
  if (!Array.isArray(value)) return [];
  const conflicts: CloudSyncConflict[] = [];
  for (const conflict of value.filter(isRecord)) {
    const entityType = isCloudSyncEntityType(conflict.entityType) ? conflict.entityType : null;
    const entityId = typeof conflict.entityId === "string" ? conflict.entityId : "";
    if (!entityType || !entityId) continue;
    conflicts.push({
      id: typeof conflict.id === "string" && conflict.id ? conflict.id : `${entityType}:${entityId}`,
      entityType,
      entityLabel: typeof conflict.entityLabel === "string" && conflict.entityLabel ? conflict.entityLabel : "同期データ",
      entityId,
      title: typeof conflict.title === "string" && conflict.title ? conflict.title : entityId,
      localUpdatedAt: typeof conflict.localUpdatedAt === "string" ? conflict.localUpdatedAt : "",
      cloudUpdatedAt: typeof conflict.cloudUpdatedAt === "string" ? conflict.cloudUpdatedAt : "",
      detectedAt: typeof conflict.detectedAt === "string" && conflict.detectedAt ? conflict.detectedAt : new Date().toISOString(),
      localRecord: conflict.localRecord ?? null,
      cloudRecord: conflict.cloudRecord ?? null,
    });
  }
  return conflicts.slice(0, 20);
}

function withSyncMetadata<TRecord extends { syncMetadata?: SyncMetadata }>(record: TRecord): TRecord {
  return {
    ...record,
    syncMetadata: normalizeSyncMetadata(record.syncMetadata),
  };
}

function withDeletedAt<TRecord extends { deletedAt?: string | null }>(record: TRecord): TRecord {
  return {
    ...record,
    deletedAt: typeof record.deletedAt === "string" && record.deletedAt ? record.deletedAt : null,
  };
}

function withSyncTombstone<TRecord extends { syncMetadata?: SyncMetadata; deletedAt?: string | null }>(record: TRecord): TRecord {
  return withSyncMetadata(withDeletedAt(record));
}

const defaultWorkMiddleCategoryByName = new Map(
  defaultInteriorWorkItemMasterInputs.map((master) => [`${master.majorCategory}|${master.name}`, master.middleCategory]),
);

const legacyInteriorDefaultKeys = new Set([
  "内装工事|床仕上げ系|クッションフロア張り|㎡",
  "内装工事|床仕上げ系|フローリング張り（複合）|㎡",
  "内装工事|床仕上げ系|フローリング張り（無垢）|㎡",
  "内装工事|床仕上げ系|長尺シート張り|㎡",
  "内装工事|床仕上げ系|塩ビタイル張り|㎡",
  "内装工事|床仕上げ系|カーペットタイル張り|㎡",
  "内装工事|床仕上げ系|畳敷き|畳",
  "内装工事|壁・天井系|クロス張り（標準）|㎡",
  "内装工事|壁・天井系|クロス張り（防かび・抗菌）|㎡",
  "内装工事|壁・天井系|塗壁（漆喰・珪藻土）|㎡",
  "内装工事|壁・天井系|ボード下地＋クロス|㎡",
  "内装工事|壁・天井系|天井クロス張り|㎡",
  "内装工事|壁・天井系|システム天井|㎡",
  "内装工事|造作・建具系|造作棚・カウンター|m",
  "内装工事|造作・建具系|室内建具枠調整|箇所",
  "内装工事|造作・建具系|巾木・廻り縁取付|m",
  "内装工事|造作・建具系|階段鼻面張り|m",
  "内装工事|その他内装|内部塗装（壁・天井）|㎡",
  "内装工事|その他内装|内部塗装（木部）|㎡",
  "内装工事|その他内装|照明器具取付|箇所",
  "内装工事|その他内装|カーテンレール取付|m",
  "内装工事|その他内装|網戸張り替え|枚",
  "内装工事|その他内装|内部清掃・ハウスクリーニング|㎡",
  "内装工事|水回り内装|ユニットバス内装調整|式",
  "内装工事|水回り内装|キッチン内装調整|式",
  "内装工事|水回り内装|トイレ内装調整|箇所",
]);

const supersededInteriorDefaultNames = new Set([
  "フローリング張り（複合）",
  "フローリング張り（無垢）",
  "畳敷き",
  "塗壁（漆喰・珪藻土）",
  "造作棚・カウンター",
  "室内建具枠調整",
  "巾木・廻り縁取付",
  "階段鼻面張り",
  "内部塗装（木部）",
  "カーテンレール取付",
  "ユニットバス内装調整",
  "キッチン内装調整",
]);

function normalizeWorkMiddleCategory(master: Pick<WorkItemMaster, "majorCategory" | "middleCategory" | "name">) {
  const current = String(master.middleCategory ?? "").trim();
  if (current && current !== master.majorCategory) return current;
  return defaultWorkMiddleCategoryByName.get(`${master.majorCategory}|${master.name}`) ?? (current || master.majorCategory || "未分類");
}

function workMasterDefaultKey(master: Pick<WorkItemMaster, "majorCategory" | "middleCategory" | "name" | "unit">) {
  return [
    String(master.majorCategory ?? "").trim(),
    String(master.middleCategory ?? "").trim(),
    String(master.name ?? "").trim(),
    String(master.unit ?? "").trim(),
  ].join("|");
}

function supplementDefaultInteriorMasters(masters: WorkItemMaster[]) {
  const mastersWithoutLegacyInteriorDefaults = masters.filter(
    (master) =>
      !(
        legacyInteriorDefaultKeys.has(workMasterDefaultKey(master)) ||
        (master.majorCategory === "内装工事" && supersededInteriorDefaultNames.has(master.name)) ||
        (master.id.startsWith("master-interior-") && !master.id.startsWith("master-interior-default-"))
      ),
  );
  const existingKeys = new Set(mastersWithoutLegacyInteriorDefaults.map(workMasterDefaultKey));
  const additions = defaultInteriorWorkItemMasterInputs
    .filter((input) => !existingKeys.has(workMasterDefaultKey(input)))
    .map((input, index) => ({
      id: `master-interior-default-${String(index + 1).padStart(3, "0")}-${Date.now()}`,
      ...input,
      favorite: index < 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  return additions.length > 0 ? [...mastersWithoutLegacyInteriorDefaults, ...additions] : mastersWithoutLegacyInteriorDefaults;
}

function normalizeWorkMasterCosts(masters: WorkItemMaster[]) {
  return masters.map((master) => {
    return {
      ...master,
      standardLaborProductivity: 0,
      standardLaborUnitCost: 0,
      standardMaterialUnitCost: 0,
      standardExpenseRate: 0,
    };
  });
}

export function createSafeLocalStorage(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch (error) {
        console.warn("[Mitru] localStorageの読み込みに失敗しました。初期状態で起動します。", error);
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value);
      } catch (error) {
        console.warn("[Mitru] localStorageへの保存に失敗しました。", error);
        notifyStorageWarning("保存データが大きすぎる可能性があります。画像はIndexedDBへ移行し、必要に応じてバックアップを作成してください。");
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch (error) {
        console.warn("[Mitru] localStorageの削除に失敗しました。", error);
      }
    },
  };
}

const storageSizeWarningLength = 4 * 1024 * 1024;
let storageSizeWarningShownThisSession = false;

function maybeNotifyStorageSizeWarning(value: string) {
  // value.length is an approximate early warning signal, not an exact byte count.
  if (storageSizeWarningShownThisSession || value.length < storageSizeWarningLength) return;
  storageSizeWarningShownThisSession = true;
  notifyStorageWarning(
    "保存データが4MBを超えています。アプリ設定のデータ出力でバックアップを作成してください。",
    "保存データが大きくなっています",
  );
}

export function createThrottledStateStorage(storage: StateStorage, delayMs = 300): FlushableStateStorage {
  const pendingWrites = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const flush = (name: string) => {
    const value = pendingWrites.get(name);
    if (value === undefined) return;
    pendingWrites.delete(name);
    timers.delete(name);
    storage.setItem(name, value);
  };

  return {
    getItem: (name) => {
      const pending = pendingWrites.get(name);
      if (pending !== undefined) return pending;
      return storage.getItem(name);
    },
    setItem: (name, value) => {
      maybeNotifyStorageSizeWarning(value);
      pendingWrites.set(name, value);
      const currentTimer = timers.get(name);
      if (currentTimer) clearTimeout(currentTimer);
      timers.set(
        name,
        setTimeout(() => flush(name), delayMs),
      );
    },
    removeItem: (name) => {
      const currentTimer = timers.get(name);
      if (currentTimer) clearTimeout(currentTimer);
      timers.delete(name);
      pendingWrites.delete(name);
      storage.removeItem(name);
    },
    flushAll: () => {
      const entries = Array.from(pendingWrites.entries());
      pendingWrites.clear();
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      let firstError: unknown;
      for (const [name, value] of entries) {
        try {
          storage.setItem(name, value);
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError) {
        throw firstError;
      }
    },
  };
}

export function partializeProjectStore(state: ProjectStore): Partial<ProjectStore> {
  return persistedKeys.reduce<Partial<ProjectStore>>((snapshot, key) => {
    return {
      ...snapshot,
      [key]: state[key],
    };
  }, {});
}

export function migrateProjectStore(persistedState: unknown, version?: number): Partial<ProjectStore> {
  if (!isRecord(persistedState)) return {};

  const state = isRecord(persistedState.state) ? persistedState.state : persistedState;
  const migrated = persistedKeys.reduce<Partial<ProjectStore>>((snapshot, key) => {
    if (!(key in state)) return snapshot;
    return {
      ...snapshot,
      [key]: state[key],
    };
  }, {});
  migrated.calculationTemplates = Array.isArray(migrated.calculationTemplates)
    ? (migrated.calculationTemplates as CalculationTemplate[]).map((template) => ({
        ...template,
        customerId: template.customerId ?? null,
        items: Array.isArray(template.items)
          ? template.items.map((item) => ({
              ...item,
              middleCategory: item.middleCategory || item.majorCategory,
            }))
          : [],
      }))
    : [];
  if (isRecord(migrated.taxSettings)) {
    migrated.taxSettings = {
      ...defaultTaxSettings,
      ...migrated.taxSettings,
      defaultWelfareRate: Number(migrated.taxSettings.defaultWelfareRate ?? defaultWelfareRate),
    };
  }
  const forceCloudSyncOff =
    !cloudSyncFeatureEnabled || version === undefined || version < 51;
  migrated.cloudSyncSettings = isRecord(migrated.cloudSyncSettings)
    ? {
        ...defaultCloudSyncSettings,
        ...migrated.cloudSyncSettings,
        isEnabled: forceCloudSyncOff ? false : Boolean(migrated.cloudSyncSettings.isEnabled),
        isTestMode: forceCloudSyncOff ? false : Boolean(migrated.cloudSyncSettings.isTestMode),
        isConnected: forceCloudSyncOff ? false : Boolean(migrated.cloudSyncSettings.isConnected),
        supabaseUrl: String(migrated.cloudSyncSettings.supabaseUrl ?? ""),
        supabaseAnonKey: String(migrated.cloudSyncSettings.supabaseAnonKey ?? ""),
        lastSyncAt: forceCloudSyncOff ? "" : String(migrated.cloudSyncSettings.lastSyncAt ?? ""),
        lastProjectsSyncedAt: forceCloudSyncOff
          ? ""
          : normalizeEntityLastSyncedAt(migrated.cloudSyncSettings, "lastProjectsSyncedAt", "projects"),
        lastCustomersSyncedAt: forceCloudSyncOff
          ? ""
          : normalizeEntityLastSyncedAt(migrated.cloudSyncSettings, "lastCustomersSyncedAt", "customers"),
        lastEstimatesSyncedAt: forceCloudSyncOff
          ? ""
          : normalizeEntityLastSyncedAt(migrated.cloudSyncSettings, "lastEstimatesSyncedAt", "estimates"),
        lastInvoicesSyncedAt: forceCloudSyncOff
          ? ""
          : normalizeEntityLastSyncedAt(migrated.cloudSyncSettings, "lastInvoicesSyncedAt", "invoices"),
        lastPaymentsSyncedAt: forceCloudSyncOff
          ? ""
          : normalizeEntityLastSyncedAt(migrated.cloudSyncSettings, "lastPaymentsSyncedAt", "payments"),
        lastProjectsSyncCursorId: forceCloudSyncOff
          ? ""
          : normalizeEntitySyncCursorId(migrated.cloudSyncSettings, "lastProjectsSyncCursorId", "projects"),
        lastCustomersSyncCursorId: forceCloudSyncOff
          ? ""
          : normalizeEntitySyncCursorId(migrated.cloudSyncSettings, "lastCustomersSyncCursorId", "customers"),
        lastEstimatesSyncCursorId: forceCloudSyncOff
          ? ""
          : normalizeEntitySyncCursorId(migrated.cloudSyncSettings, "lastEstimatesSyncCursorId", "estimates"),
        lastInvoicesSyncCursorId: forceCloudSyncOff
          ? ""
          : normalizeEntitySyncCursorId(migrated.cloudSyncSettings, "lastInvoicesSyncCursorId", "invoices"),
        lastPaymentsSyncCursorId: forceCloudSyncOff
          ? ""
          : normalizeEntitySyncCursorId(migrated.cloudSyncSettings, "lastPaymentsSyncCursorId", "payments"),
        syncStatus: forceCloudSyncOff
          ? "idle"
          : isCloudSyncStatus(migrated.cloudSyncSettings.syncStatus)
          ? migrated.cloudSyncSettings.syncStatus
          : "idle",
        syncProgress: forceCloudSyncOff
          ? defaultCloudSyncSettings.syncProgress
          : normalizeCloudSyncProgress(migrated.cloudSyncSettings.syncProgress),
        lastSyncResults: forceCloudSyncOff
          ? defaultCloudSyncSettings.lastSyncResults
          : {
              projects: normalizeCloudSyncEntityResult(
                isRecord(migrated.cloudSyncSettings.lastSyncResults)
                  ? migrated.cloudSyncSettings.lastSyncResults.projects
                  : undefined,
                defaultCloudSyncSettings.lastSyncResults.projects,
              ),
              customers: normalizeCloudSyncEntityResult(
                isRecord(migrated.cloudSyncSettings.lastSyncResults)
                  ? migrated.cloudSyncSettings.lastSyncResults.customers
                  : undefined,
                defaultCloudSyncSettings.lastSyncResults.customers,
              ),
              estimates: normalizeCloudSyncEntityResult(
                isRecord(migrated.cloudSyncSettings.lastSyncResults)
                  ? migrated.cloudSyncSettings.lastSyncResults.estimates
                  : undefined,
                defaultCloudSyncSettings.lastSyncResults.estimates,
              ),
              invoices: normalizeCloudSyncEntityResult(
                isRecord(migrated.cloudSyncSettings.lastSyncResults)
                  ? migrated.cloudSyncSettings.lastSyncResults.invoices
                  : undefined,
                defaultCloudSyncSettings.lastSyncResults.invoices,
              ),
              payments: normalizeCloudSyncEntityResult(
                isRecord(migrated.cloudSyncSettings.lastSyncResults)
                  ? migrated.cloudSyncSettings.lastSyncResults.payments
                  : undefined,
                defaultCloudSyncSettings.lastSyncResults.payments,
              ),
            },
        syncHistory: forceCloudSyncOff ? [] : normalizeCloudSyncHistory(migrated.cloudSyncSettings.syncHistory),
        pendingConflicts: forceCloudSyncOff ? [] : normalizeCloudSyncConflicts(migrated.cloudSyncSettings.pendingConflicts),
        authState: forceCloudSyncOff
          ? "idle"
          : isCloudSyncAuthState(migrated.cloudSyncSettings.authState)
          ? migrated.cloudSyncSettings.authState
          : "idle",
        user: forceCloudSyncOff ? null : normalizeCloudSyncUser(migrated.cloudSyncSettings.user),
      }
    : defaultCloudSyncSettings;
  migrated.companyInfo = normalizeCompanyInfo(migrated.companyInfo);
  if (isRecord(migrated.invoiceSettingsByProjectId)) {
    migrated.invoiceSettingsByProjectId = Object.fromEntries(
      Object.entries(migrated.invoiceSettingsByProjectId as Record<string, ProjectInvoiceSettings>).map(([projectId, settings]) => [
        projectId,
        {
          ...settings,
          bankAccountId: settings.bankAccountId ?? null,
        },
      ]),
    );
  } else {
    migrated.invoiceSettingsByProjectId = {};
  }
  if (Array.isArray(migrated.customers)) {
    migrated.customers = (migrated.customers as Customer[]).map((customer) => withSyncTombstone(customer));
  }
  if (Array.isArray(migrated.projectItems)) {
    migrated.projectItems = migrated.projectItems.map((item) => {
      const samplePortfolioItem = samplePortfolioItemById.get(item.id);
      const quantity = Number(item.quantity || 0);
      const legacyLineUnitPrice =
        quantity > 0
          ? (quantity * item.laborProductivity * item.laborUnitCost +
              quantity * item.materialUnitCost +
              (quantity * item.laborProductivity * item.laborUnitCost + quantity * item.materialUnitCost) *
                item.expenseRate) /
            quantity
          : item.materialUnitCost;

      const inferredItemType =
        item.itemType ??
        (Number(item.materialUnitCost || item.estimatedUnitCost || 0) > 0 &&
        Number(item.laborProductivity || item.estimatedLaborProductivity || item.laborUnitCost || item.estimatedLaborUnitCost || 0) === 0
          ? "material"
          : "labor");

      return withSyncMetadata({
        ...item,
        middleCategory: normalizeWorkMiddleCategory(item),
        itemType: samplePortfolioItem?.itemType ?? inferredItemType,
        estimatedLaborProductivity: item.estimatedLaborProductivity ?? item.laborProductivity,
        actualLaborProductivity: item.actualLaborProductivity ?? item.laborProductivity,
        estimatedLaborUnitCost: item.estimatedLaborUnitCost ?? item.laborUnitCost,
        actualLaborUnitCost: item.actualLaborUnitCost ?? item.laborUnitCost,
        welfareRate: item.welfareRate ?? defaultWelfareRate,
        baseCost: item.baseCost ?? (inferredItemType === "material" ? item.actualUnitCost ?? item.materialUnitCost ?? null : null),
        markupRate: item.markupRate ?? 1,
        estimatedUnitCost: item.estimatedUnitCost ?? legacyLineUnitPrice,
        actualUnitCost: item.actualUnitCost ?? item.materialUnitCost,
        priceModelVersion: item.priceModelVersion ?? 2,
        ...(version !== undefined && version < 9 && samplePortfolioActualCosts[item.id]
          ? samplePortfolioActualCosts[item.id]
          : {}),
        ...(samplePortfolioItem
          ? {
              itemType: samplePortfolioItem.itemType,
              materialUnitCost: samplePortfolioItem.materialUnitCost,
              baseCost: samplePortfolioItem.baseCost,
              markupRate: samplePortfolioItem.markupRate,
              estimatedUnitCost: samplePortfolioItem.estimatedUnitCost,
              actualUnitCost: samplePortfolioItem.actualUnitCost,
              laborProductivity: samplePortfolioItem.laborProductivity,
              estimatedLaborProductivity: samplePortfolioItem.estimatedLaborProductivity,
              actualLaborProductivity: samplePortfolioItem.actualLaborProductivity,
              laborUnitCost: samplePortfolioItem.laborUnitCost,
              estimatedLaborUnitCost: samplePortfolioItem.estimatedLaborUnitCost,
              actualLaborUnitCost: samplePortfolioItem.actualLaborUnitCost,
              actualMaterialCost: samplePortfolioItem.actualMaterialCost,
              actualLaborCost: samplePortfolioItem.actualLaborCost,
              actualOutsourcingCost: samplePortfolioItem.actualOutsourcingCost,
              priceModelVersion: samplePortfolioItem.priceModelVersion,
            }
          : {}),
      });
    });
  }
  if (Array.isArray(migrated.workItemMasters)) {
    migrated.workItemMasters = normalizeWorkMasterCosts(
      supplementDefaultInteriorMasters(
        normalizeUniqueMasterIds(migrated.workItemMasters as WorkItemMaster[], "master").map((master) => ({
          ...master,
          middleCategory: normalizeWorkMiddleCategory(master),
        })),
      ),
    ).map((master) => withSyncMetadata(master));
  }
  if (Array.isArray(migrated.materialMasters)) {
    migrated.materialMasters = normalizeUniqueMasterIds(migrated.materialMasters as MaterialMaster[], "material").map((material) => ({
      ...material,
      category: normalizeMaterialCategory(material.category),
    })).map((material) => withSyncMetadata(material));
  }
  const projectItems = Array.isArray(migrated.projectItems) ? (migrated.projectItems as ProjectItem[]) : [];
  const projectsForTax = Array.isArray(migrated.projects) ? (migrated.projects as Project[]) : [];
  const projectForTaxById = new Map(projectsForTax.map((project) => [project.id, project]));
  const costSettingsByProjectId =
    isRecord(migrated.costSettingsByProjectId) ? (migrated.costSettingsByProjectId as Record<string, ProjectCostSettings>) : {};
  const taxSettings = isRecord(migrated.taxSettings) ? (migrated.taxSettings as TaxSettings) : defaultTaxSettings;
  if (Array.isArray(migrated.estimateDocuments)) {
    migrated.estimateDocuments = (migrated.estimateDocuments as EstimateDocument[]).map((document) => {
      if (document.lineSnapshot?.length && document.totalsSnapshot) {
        return withSyncTombstone({
          ...document,
          lineSnapshot: normalizeEstimateLineSnapshots(document.lineSnapshot),
          totalsSnapshot: normalizeEstimateTotalsSnapshot(document.totalsSnapshot),
        });
      }
      const items = projectItems.filter((item) => item.projectId === document.projectId);
      const costSettings = costSettingsByProjectId[document.projectId] ?? defaultCostSettings;
      const projectTaxRate = resolveProjectTaxRate(projectForTaxById.get(document.projectId)?.taxRateType, taxSettings.standardTaxRate);
      const lines = createEstimateLineSnapshots(items);
      const totals = calculateEstimateTotalsSnapshot(items, costSettings, taxSettings, projectTaxRate);
      return withSyncTombstone({
        ...document,
        lineSnapshot: lines,
        totalsSnapshot: totals,
        snapshotCreatedAt: document.updatedAt || document.createdAt || new Date().toISOString(),
      });
    });
  }
  if (Array.isArray(migrated.invoiceDocuments)) {
    const invoiceItemsByItemId =
      isRecord(migrated.invoiceItemsByItemId)
        ? (migrated.invoiceItemsByItemId as Record<string, { previousRate?: number; currentRate?: number }>)
        : {};
    migrated.invoiceDocuments = (migrated.invoiceDocuments as InvoiceDocument[]).map((document) => {
      const paymentRecords = Array.isArray(document.paymentRecords)
        ? (document.paymentRecords as PaymentRecord[])
        : [];
      const fallbackPaidAmount =
        document.paidAmount ??
        paymentRecords.reduce((sum, record) => (record.deletedAt ? sum : sum + Number(record.amount || 0)), 0) ??
        0;
      const invoiceTotal = document.totalsSnapshot?.afterTax ?? document.currentAmount;
      const normalizedPaymentRecords =
        paymentRecords.length === 0 && document.status === "入金済" && invoiceTotal > 0
          ? [
              {
                id: `payment-migrated-${document.id}`,
                invoiceId: document.id,
                amount: invoiceTotal,
                paymentDate: document.updatedAt?.slice(0, 10) || document.invoiceDate,
                paymentMethod: "その他" as const,
                note: "移行データ",
                createdAt: document.updatedAt || new Date().toISOString(),
                updatedAt: document.updatedAt || new Date().toISOString(),
              },
            ]
          : paymentRecords;
      const syncedPaymentRecords = normalizedPaymentRecords.map((record) =>
        withSyncTombstone({
          ...record,
          updatedAt: record.updatedAt || record.createdAt || document.updatedAt || new Date().toISOString(),
        }),
      );
      const paidAmount =
        syncedPaymentRecords.length > 0
          ? syncedPaymentRecords.reduce((sum, record) => (record.deletedAt ? sum : sum + Number(record.amount || 0)), 0)
          : fallbackPaidAmount;
      const bankAccountId = normalizeInvoiceBankAccountId(document.bankAccountId, migrated.companyInfo as CompanyInfo);
      if (document.lineSnapshot?.length && document.totalsSnapshot) {
        return withSyncTombstone({
          ...document,
          bankAccountId,
          paidAmount,
          paymentRecords: syncedPaymentRecords,
          lineSnapshot: normalizeInvoiceLineSnapshots(document.lineSnapshot),
        });
      }
      const items = projectItems.filter((item) => item.projectId === document.projectId);
      const lines = createInvoiceLineSnapshots(items, invoiceItemsByItemId);
      const projectTaxRate = resolveProjectTaxRate(projectForTaxById.get(document.projectId)?.taxRateType, taxSettings.standardTaxRate);
      const tax = roundCurrencySnapshot(document.currentAmount * projectTaxRate, taxSettings.taxRoundingMode);
      return withSyncTombstone({
        ...document,
        bankAccountId,
        paidAmount,
        paymentRecords: syncedPaymentRecords,
        lineSnapshot: lines,
        totalsSnapshot: {
          previousBeforeTax: Math.max(0, document.cumulativeAmount - document.currentAmount),
          beforeTax: document.currentAmount,
          cumulativeBeforeTax: document.cumulativeAmount,
          tax,
          afterTax: roundCurrencySnapshot(document.currentAmount + tax, taxSettings.totalRoundingMode),
        },
        snapshotCreatedAt: document.updatedAt || document.createdAt || new Date().toISOString(),
      });
    });
  }
  if (Array.isArray(migrated.projects)) {
    migrated.projects = normalizeProjectNumbers(
      (migrated.projects as Array<Project & { projectNumber?: string }>).map((project) => ({
        ...project,
        ownerId: normalizeProjectOwnerId(project),
        assignedTo: normalizeProjectAssignee(project.assignedTo),
        status: normalizeProjectStatus(project.status),
        taxRateType: normalizeProjectTaxRateType(project.taxRateType),
        nextActionDate: project.nextActionDate ?? "",
        processMemo: project.processMemo ?? "",
        ownerMemo: project.ownerMemo ?? "",
      })),
    ).map((project) => withSyncTombstone(project));
  }
  if (!Array.isArray(migrated.billingCloseRecords)) {
    migrated.billingCloseRecords = [];
  } else {
    migrated.billingCloseRecords = (migrated.billingCloseRecords as BillingCloseRecord[]).map((record) =>
      withSyncMetadata(record),
    );
  }
  if (Array.isArray(migrated.deliveryDocuments)) {
    migrated.deliveryDocuments = (migrated.deliveryDocuments as DeliveryDocument[]).map((document) =>
      withSyncMetadata(document),
    );
  }
  if (Array.isArray(migrated.orderDocuments)) {
    migrated.orderDocuments = migrated.orderDocuments.map((document) => {
      const purchaseRecords = Array.isArray(document.purchaseRecords) ? document.purchaseRecords : [];
      const purchasedAmount =
        document.purchasedAmount ??
        purchaseRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
      return withSyncMetadata({
        ...document,
        purchaseRecords: (purchaseRecords as PurchaseRecord[]).map((record) => withSyncMetadata(record)),
        purchasedAmount,
        orderLineSnapshot: Array.isArray(document.orderLineSnapshot)
          ? document.orderLineSnapshot.map((line) => ({
              ...line,
              middleCategory: line.middleCategory || line.majorCategory,
            }))
          : [],
      });
    });
  }
  if (isRecord(migrated.documentNumberSettings)) {
    migrated.documentNumberSettings = {
      estimate: normalizeDocumentNumberConfig(
        migrated.documentNumberSettings.estimate,
        Array.isArray(migrated.estimateDocuments) ? (migrated.estimateDocuments as EstimateDocument[]) : [],
      ),
      invoice: normalizeDocumentNumberConfig(
        migrated.documentNumberSettings.invoice,
        Array.isArray(migrated.invoiceDocuments) ? (migrated.invoiceDocuments as InvoiceDocument[]) : [],
      ),
      updatedAt: String(migrated.documentNumberSettings.updatedAt || new Date().toISOString()),
    };
  }
  if (version !== undefined && version < 7) {
    return {
      ...migrated,
      customers: samplePortfolioCustomers,
      projects: samplePortfolioProjects,
      projectItems: samplePortfolioProjectItems,
      costSettingsByProjectId: {},
      quoteSettingsByProjectId: {},
      invoiceSettingsByProjectId: {},
      invoiceItemsByItemId: {},
      sealSettingsByProjectId: {},
      estimateDocuments: samplePortfolioEstimateDocuments,
      invoiceDocuments: samplePortfolioInvoiceDocuments,
      deliveryDocuments: [],
      orderDocuments: [],
      companyInfo: initialCompanyInfo,
      pdfTemplateSettings: initialPdfTemplateSettings,
      taxSettings: defaultTaxSettings,
      documentNumberSettings: defaultDocumentNumberSettings,
    };
  }
  if (version !== undefined && version < 8) {
    const hasBusinessData =
      (Array.isArray(migrated.projects) && migrated.projects.length > 0) ||
      (Array.isArray(migrated.projectItems) && migrated.projectItems.length > 0) ||
      (Array.isArray(migrated.estimateDocuments) && migrated.estimateDocuments.length > 0) ||
      (Array.isArray(migrated.invoiceDocuments) && migrated.invoiceDocuments.length > 0);
    if (!hasBusinessData) {
      return {
        ...migrated,
        customers: samplePortfolioCustomers,
        projects: samplePortfolioProjects,
        projectItems: samplePortfolioProjectItems,
        costSettingsByProjectId: {},
        quoteSettingsByProjectId: {},
        invoiceSettingsByProjectId: {},
        invoiceItemsByItemId: {},
        sealSettingsByProjectId: {},
        estimateDocuments: samplePortfolioEstimateDocuments,
        invoiceDocuments: samplePortfolioInvoiceDocuments,
        deliveryDocuments: [],
        orderDocuments: [],
      };
    }
  }
  if (version !== undefined && version < 46) {
    return refreshSamplePortfolioData(migrated);
  }
  return migrated;
}

export function recoverCorruptedProjectStore(error: unknown) {
  if (!error) return;
  console.warn("[Mitru] 保存データが破損しているため、ローカル保存を退避してリセットしました。", error);
  try {
    const raw = localStorage.getItem(projectStoreKey);
    if (raw) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      localStorage.setItem(`${projectStoreKey}-corrupted-backup-${timestamp}`, raw);
      localStorage.setItem("mitru-local-store-recovered-at", new Date().toISOString());
    }
  } catch (backupError) {
    console.warn("[Mitru] 破損した保存データの退避に失敗しました。", backupError);
  }
  try {
    localStorage.removeItem(projectStoreKey);
  } catch (removeError) {
    console.warn("[Mitru] 破損した保存データの削除に失敗しました。", removeError);
  }
}

function createEstimateLineSnapshots(items: ProjectItem[]) {
  return items.map((item) => {
    const line = calculateLineSnapshot(item);
    return {
      item: { ...item },
      line,
      unitPrice: item.quantity > 0 ? line.subtotal / item.quantity : line.subtotal,
    };
  });
}

function normalizeEstimateLineSnapshots(lines: EstimateLineSnapshot[]): EstimateLineSnapshot[] {
  return lines.map((line) => ({
    ...line,
    item: {
      ...line.item,
      middleCategory: normalizeWorkMiddleCategory(line.item),
    },
    line: normalizeCalculationLineSnapshot(line.line),
  }));
}

function normalizeInvoiceLineSnapshots(lines: InvoiceLineSnapshot[]): InvoiceLineSnapshot[] {
  return lines.map((line) => ({
    ...line,
    item: {
      ...line.item,
      middleCategory: normalizeWorkMiddleCategory(line.item),
    },
    line: normalizeCalculationLineSnapshot(line.line),
  }));
}

function normalizeEstimateTotalsSnapshot(totals: EstimateTotalsSnapshot): EstimateTotalsSnapshot {
  return {
    ...totals,
    welfareCost: totals.welfareCost ?? 0,
    totalLaborCost: totals.totalLaborCost ?? totals.laborCost,
  };
}

function normalizeCalculationLineSnapshot<TLine extends { laborCost: number; welfareCost?: number; totalLaborCost?: number }>(
  line: TLine,
) {
  return {
    ...line,
    welfareCost: line.welfareCost ?? 0,
    totalLaborCost: line.totalLaborCost ?? line.laborCost,
  };
}

function createInvoiceLineSnapshots(
  items: ProjectItem[],
  invoiceItemsByItemId: Record<string, { previousRate?: number; currentRate?: number }>,
) {
  return items.map((item) => {
    const line = calculateLineSnapshot(item);
    const state = invoiceItemsByItemId[item.id] ?? { previousRate: 0, currentRate: 1 };
    const previousRate = Number(state.previousRate ?? 0);
    const currentRate = Number(state.currentRate ?? 1);
    const previousAmount = line.subtotal * previousRate;
    const currentAmount = line.subtotal * currentRate;
    return {
      item: { ...item },
      line,
      previousRate,
      currentRate,
      previousAmount,
      currentAmount,
      cumulativeAmount: previousAmount + currentAmount,
    };
  });
}

function calculateEstimateTotalsSnapshot(
  items: ProjectItem[],
  costSettings: ProjectCostSettings,
  taxSettings: TaxSettings,
  taxRate: number = taxSettings.standardTaxRate,
) {
  const base = items.reduce(
    (sum, item) => {
      const line = calculateLineSnapshot(item);
      return {
        laborCost: sum.laborCost + line.laborCost,
        welfareCost: (sum.welfareCost ?? 0) + (line.welfareCost ?? 0),
        totalLaborCost: (sum.totalLaborCost ?? 0) + (line.totalLaborCost ?? line.laborCost),
        materialCost: sum.materialCost + line.materialCost,
        expenseCost: sum.expenseCost + line.expenseCost,
        directSubtotal: sum.directSubtotal + line.subtotal,
      };
    },
    { laborCost: 0, welfareCost: 0, totalLaborCost: 0, materialCost: 0, expenseCost: 0, directSubtotal: 0 },
  );
  const commonTemporaryCost = base.directSubtotal * costSettings.commonTemporaryRate;
  const siteManagementCost = base.directSubtotal * costSettings.siteManagementRate;
  const beforeTax = base.directSubtotal + commonTemporaryCost + siteManagementCost;
  const tax = roundCurrencySnapshot(beforeTax * taxRate, taxSettings.taxRoundingMode);
  const afterTax = roundCurrencySnapshot(beforeTax + tax, taxSettings.totalRoundingMode);
  return { ...base, commonTemporaryCost, siteManagementCost, beforeTax, tax, afterTax };
}

function calculateLineSnapshot(item: ProjectItem) {
  if (item.itemType === "material") {
    const unitCost = resolveMaterialUnitCostSnapshot(item);
    const materialCost = numberOrZero(item.quantity) * unitCost;
    return { laborCost: 0, welfareCost: 0, totalLaborCost: 0, materialCost, expenseCost: 0, subtotal: materialCost };
  }
  const unitCost = numberOrZero(item.estimatedLaborUnitCost) || numberOrZero(item.laborUnitCost);
  const productivity =
    numberOrZero(item.estimatedLaborProductivity) || numberOrZero(item.laborProductivity) || 1;
  const laborCost =
    item.priceModelVersion === 1
      ? numberOrZero(item.quantity) * productivity * unitCost
      : numberOrZero(item.quantity) * unitCost;
  const welfareCost = laborCost * (numberOrZero(item.welfareRate) || defaultWelfareRate);
  const totalLaborCost = laborCost + welfareCost;
  return { laborCost, welfareCost, totalLaborCost, materialCost: 0, expenseCost: 0, subtotal: totalLaborCost };
}

function resolveMaterialUnitCostSnapshot(item: ProjectItem) {
  const baseCost = numberOrZero(item.baseCost);
  const markupRate = numberOrZero(item.markupRate);
  if (baseCost > 0 && markupRate > 0) return baseCost * markupRate;
  return numberOrZero(item.estimatedUnitCost) || numberOrZero(item.materialUnitCost);
}

function numberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrencySnapshot(value: number, mode: TaxSettings["taxRoundingMode"]) {
  if (mode === "floor") return Math.floor(value);
  if (mode === "ceil") return Math.ceil(value);
  return Math.round(value);
}

function normalizeCompanyInfo(value: unknown): CompanyInfo {
  const rawCompanyInfo = isRecord(value) ? value : {};
  const companyInfo = isRecord(value) ? ({ ...initialCompanyInfo, ...value } as CompanyInfo) : initialCompanyInfo;
  const contactPosition =
    typeof rawCompanyInfo.contactPosition === "string"
      ? rawCompanyInfo.contactPosition
      : typeof companyInfo.contactTitle === "string"
        ? companyInfo.contactTitle
        : "";
  return {
    ...companyInfo,
    contactPosition,
    bankAccounts: normalizeBankAccounts(companyInfo.bankAccounts),
  };
}

function normalizeBankAccounts(value: unknown): BankAccount[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter(isRecord)
    .map((account, index) => ({
      id: typeof account.id === "string" && account.id.trim() ? account.id : `bank-migrated-${index}`,
      bankName: typeof account.bankName === "string" ? account.bankName : "",
      branchName: typeof account.branchName === "string" ? account.branchName : "",
      accountType: account.accountType === "当座" ? "当座" : "普通",
      accountNumber: typeof account.accountNumber === "string" ? account.accountNumber : "",
      accountHolder: typeof account.accountHolder === "string" ? account.accountHolder : "",
      isDefault: Boolean(account.isDefault),
    }));

  if (normalized.length === 0) return [];
  const firstDefaultIndex = normalized.findIndex((account) => account.isDefault);
  return normalized.map((account, index) => ({
    ...account,
    isDefault: firstDefaultIndex >= 0 ? index === firstDefaultIndex : index === 0,
  }));
}

function normalizeInvoiceBankAccountId(value: unknown, companyInfo: CompanyInfo) {
  if (typeof value === "string" && companyInfo.bankAccounts.some((account) => account.id === value)) return value;
  return companyInfo.bankAccounts.find((account) => account.isDefault)?.id ?? companyInfo.bankAccounts[0]?.id ?? null;
}

function normalizeProjectStatus(status: unknown): ProjectStatus {
  if (status === "請求済") return "請求済み";
  if (status === "進行中") return "施工中";
  if (
    status === "見積中" ||
    status === "契約済" ||
    status === "施工中" ||
    status === "完了" ||
    status === "請求済み" ||
    status === "請求締済" ||
    status === "失注" ||
    status === "破棄"
  ) {
    return status;
  }
  return "見積中";
}

function normalizeProjectOwnerId(project: Project) {
  const ownerId = typeof project.ownerId === "string" ? project.ownerId.trim() : "";
  if (ownerId) return ownerId;

  const syncedBy = typeof project.syncMetadata?.syncedBy === "string" ? project.syncMetadata.syncedBy.trim() : "";
  return syncedBy || "local";
}

function normalizeProjectAssignee(value: unknown) {
  if (typeof value !== "string") return null;
  const assignedTo = value.trim();
  return assignedTo || null;
}

function normalizeProjectNumbers(projects: Array<Project & { projectNumber?: string }>) {
  const usedNumbers = new Set<string>();
  const nextByYear = new Map<string, number>();
  const acceptedExistingProjectIds = new Set<string>();
  const sortedProjects = [...projects].sort((a, b) => {
    const aTime = getProjectNumberBaseTime(a);
    const bTime = getProjectNumberBaseTime(b);
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });

  sortedProjects.forEach((project) => {
    const year = getProjectNumberYear(project);
    const existing = String(project.projectNumber ?? "").trim();
    const match = existing.match(/^(\d{4})-(\d{3,})$/);
    if (match && match[1] === year && !usedNumbers.has(existing)) {
      usedNumbers.add(existing);
      acceptedExistingProjectIds.add(project.id);
      const next = Number(match[2] || 0) + 1;
      nextByYear.set(year, Math.max(nextByYear.get(year) ?? 1, next));
    }
  });

  return projects.map((project) => {
    const year = getProjectNumberYear(project);
    const existing = String(project.projectNumber ?? "").trim();
    const match = existing.match(/^(\d{4})-(\d{3,})$/);
    if (match && match[1] === year && acceptedExistingProjectIds.has(project.id)) {
      return {
        ...project,
        projectNumber: existing,
      };
    }

    let next = nextByYear.get(year) ?? 1;
    let projectNumber = `${year}-${String(next).padStart(3, "0")}`;
    while (usedNumbers.has(projectNumber)) {
      next += 1;
      projectNumber = `${year}-${String(next).padStart(3, "0")}`;
    }
    usedNumbers.add(projectNumber);
    nextByYear.set(year, next + 1);
    return {
      ...project,
      projectNumber,
    };
  });
}

function getProjectNumberYear(project: Pick<Project, "createdAt" | "startDate" | "updatedAt">) {
  const source = project.createdAt || project.startDate || project.updatedAt || new Date().toISOString();
  const year = new Date(source).getFullYear();
  return Number.isFinite(year) ? String(year) : String(new Date().getFullYear());
}

function getProjectNumberBaseTime(project: Pick<Project, "createdAt" | "startDate" | "updatedAt">) {
  const source = project.createdAt || project.startDate || project.updatedAt || "";
  const time = Date.parse(source);
  return Number.isFinite(time) ? time : 0;
}

function normalizeDocumentNumberConfig(
  value: unknown,
  documents: Array<{ documentNumber: string }>,
): DocumentNumberConfig {
  const input = isRecord(value) ? value : {};
  const prefix = String(input.prefix ?? "");
  const digits = normalizeDigits(input.digits);
  const configuredNextNumber = Number(input.nextNumber);
  return {
    prefix,
    digits,
    nextNumber: Number.isFinite(configuredNextNumber) && configuredNextNumber > 0
      ? Math.floor(configuredNextNumber)
      : inferNextDocumentNumber(prefix, documents),
  };
}

function normalizeDigits(value: unknown): DocumentNumberConfig["digits"] {
  return value === 5 || value === 6 ? value : 4;
}

function inferNextDocumentNumber(prefix: string, documents: Array<{ documentNumber: string }>) {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  const maxNumber = documents.reduce((max, document) => {
    const match = document.documentNumber.match(pattern);
    const parsed = match ? Number(match[1]) : 0;
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  return maxNumber + 1;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
