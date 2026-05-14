import type { StateStorage } from "zustand/middleware";
import { backupSliceVersion } from "./backup-slice";
import { calculationSliceVersion } from "./calculation-slice";
import { customerSliceVersion } from "./customer-slice";
import { deliverySliceVersion, invoiceSliceVersion, orderSliceVersion, quoteSliceVersion } from "./document-slice";
import { masterSliceVersion } from "./master-slice";
import { projectSliceVersion } from "./project-slice";
import { settingsSliceVersion } from "./settings-slice";
import type { ProjectStore } from "./types";
import {
  defaultCostSettings,
  defaultInteriorWorkItemMasterInputs,
  defaultDocumentNumberSettings,
  defaultTaxSettings,
  defaultWelfareRate,
  initialCompanyInfo,
  initialPdfTemplateSettings,
  samplePortfolioActualCosts,
  samplePortfolioCustomers,
  samplePortfolioProjectItems,
  samplePortfolioProjects,
  systemMaterialCategories,
} from "../defaults";
import type {
  DocumentNumberConfig,
  EstimateDocument,
  EstimateLineSnapshot,
  EstimateTotalsSnapshot,
  InvoiceDocument,
  InvoiceLineSnapshot,
  MaterialMaster,
  PaymentRecord,
  Project,
  ProjectCostSettings,
  ProjectItem,
  ProjectStatus,
  TaxSettings,
  WorkItemMaster,
} from "./types";

export const projectStoreVersion = 26;
const projectStoreKey = "mitru-local-store";

function notifyStorageWarning(description: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("mitru-storage-warning", {
      detail: {
        title: "ローカル保存に失敗しました",
        description,
        tone: "error",
      },
    }),
  );
}

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
  backup: backupSliceVersion,
} as const;

const persistedKeys = [
  "customers",
  "projects",
  "projectItems",
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
  "documentNumberSettings",
  "lastBackupAt",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function createThrottledStateStorage(storage: StateStorage, delayMs = 300): StateStorage {
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
  if (isRecord(migrated.taxSettings)) {
    migrated.taxSettings = {
      ...defaultTaxSettings,
      ...migrated.taxSettings,
      defaultWelfareRate: Number(migrated.taxSettings.defaultWelfareRate ?? defaultWelfareRate),
    };
  }
  if (Array.isArray(migrated.projectItems)) {
    migrated.projectItems = migrated.projectItems.map((item) => {
      const quantity = Number(item.quantity || 0);
      const legacyLineUnitPrice =
        quantity > 0
          ? (quantity * item.laborProductivity * item.laborUnitCost +
              quantity * item.materialUnitCost +
              (quantity * item.laborProductivity * item.laborUnitCost + quantity * item.materialUnitCost) *
                item.expenseRate) /
            quantity
          : item.materialUnitCost;

      return {
        ...item,
        middleCategory: normalizeWorkMiddleCategory(item),
        itemType:
          item.itemType ??
          (Number(item.materialUnitCost || 0) > 0 && Number(item.laborProductivity || 0) === 0
            ? "material"
            : "labor"),
        estimatedLaborProductivity: item.estimatedLaborProductivity ?? item.laborProductivity,
        actualLaborProductivity: item.actualLaborProductivity ?? item.laborProductivity,
        estimatedLaborUnitCost: item.estimatedLaborUnitCost ?? item.laborUnitCost,
        actualLaborUnitCost: item.actualLaborUnitCost ?? item.laborUnitCost,
        welfareRate: item.welfareRate ?? defaultWelfareRate,
        estimatedUnitCost: item.estimatedUnitCost ?? legacyLineUnitPrice,
        actualUnitCost: item.actualUnitCost ?? item.materialUnitCost,
        priceModelVersion: item.priceModelVersion ?? 2,
        ...(version !== undefined && version < 9 && samplePortfolioActualCosts[item.id]
          ? samplePortfolioActualCosts[item.id]
          : {}),
      };
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
    );
  }
  if (Array.isArray(migrated.materialMasters)) {
    migrated.materialMasters = normalizeUniqueMasterIds(migrated.materialMasters as MaterialMaster[], "material").map((material) => ({
      ...material,
      category: normalizeMaterialCategory(material.category),
    }));
  }
  const projectItems = Array.isArray(migrated.projectItems) ? (migrated.projectItems as ProjectItem[]) : [];
  const costSettingsByProjectId =
    isRecord(migrated.costSettingsByProjectId) ? (migrated.costSettingsByProjectId as Record<string, ProjectCostSettings>) : {};
  const taxSettings = isRecord(migrated.taxSettings) ? (migrated.taxSettings as TaxSettings) : defaultTaxSettings;
  if (Array.isArray(migrated.estimateDocuments)) {
    migrated.estimateDocuments = (migrated.estimateDocuments as EstimateDocument[]).map((document) => {
      if (document.lineSnapshot?.length && document.totalsSnapshot) {
        return {
          ...document,
          lineSnapshot: normalizeEstimateLineSnapshots(document.lineSnapshot),
          totalsSnapshot: normalizeEstimateTotalsSnapshot(document.totalsSnapshot),
        };
      }
      const items = projectItems.filter((item) => item.projectId === document.projectId);
      const costSettings = costSettingsByProjectId[document.projectId] ?? defaultCostSettings;
      const lines = createEstimateLineSnapshots(items);
      const totals = calculateEstimateTotalsSnapshot(items, costSettings, taxSettings);
      return {
        ...document,
        lineSnapshot: lines,
        totalsSnapshot: totals,
        snapshotCreatedAt: document.updatedAt || document.createdAt || new Date().toISOString(),
      };
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
        paymentRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0) ??
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
              },
            ]
          : paymentRecords;
      const paidAmount =
        normalizedPaymentRecords.length > 0
          ? normalizedPaymentRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0)
          : fallbackPaidAmount;
      if (document.lineSnapshot?.length && document.totalsSnapshot) {
        return {
          ...document,
          paidAmount,
          paymentRecords: normalizedPaymentRecords,
          lineSnapshot: normalizeInvoiceLineSnapshots(document.lineSnapshot),
        };
      }
      const items = projectItems.filter((item) => item.projectId === document.projectId);
      const lines = createInvoiceLineSnapshots(items, invoiceItemsByItemId);
      const tax = roundCurrencySnapshot(document.currentAmount * taxSettings.standardTaxRate, taxSettings.taxRoundingMode);
      return {
        ...document,
        paidAmount,
        paymentRecords: normalizedPaymentRecords,
        lineSnapshot: lines,
        totalsSnapshot: {
          previousBeforeTax: Math.max(0, document.cumulativeAmount - document.currentAmount),
          beforeTax: document.currentAmount,
          cumulativeBeforeTax: document.cumulativeAmount,
          tax,
          afterTax: roundCurrencySnapshot(document.currentAmount + tax, taxSettings.totalRoundingMode),
        },
        snapshotCreatedAt: document.updatedAt || document.createdAt || new Date().toISOString(),
      };
    });
  }
  if (Array.isArray(migrated.projects)) {
    migrated.projects = (migrated.projects as Project[]).map((project) => ({
      ...project,
      status: normalizeProjectStatus(project.status),
      nextActionDate: project.nextActionDate ?? "",
      processMemo: project.processMemo ?? "",
      ownerMemo: project.ownerMemo ?? "",
    }));
  }
  if (!Array.isArray(migrated.billingCloseRecords)) {
    migrated.billingCloseRecords = [];
  }
  if (Array.isArray(migrated.orderDocuments)) {
    migrated.orderDocuments = migrated.orderDocuments.map((document) => {
      const purchaseRecords = Array.isArray(document.purchaseRecords) ? document.purchaseRecords : [];
      const purchasedAmount =
        document.purchasedAmount ??
        purchaseRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);
      return {
        ...document,
        purchaseRecords,
        purchasedAmount,
        orderLineSnapshot: Array.isArray(document.orderLineSnapshot)
          ? document.orderLineSnapshot.map((line) => ({
              ...line,
              middleCategory: line.middleCategory || line.majorCategory,
            }))
          : [],
      };
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
      customers: [],
      projects: [],
      projectItems: [],
      costSettingsByProjectId: {},
      quoteSettingsByProjectId: {},
      invoiceSettingsByProjectId: {},
      invoiceItemsByItemId: {},
      sealSettingsByProjectId: {},
      estimateDocuments: [],
      invoiceDocuments: [],
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
        estimateDocuments: [],
        invoiceDocuments: [],
        deliveryDocuments: [],
        orderDocuments: [],
      };
    }
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
  const tax = roundCurrencySnapshot(beforeTax * taxSettings.standardTaxRate, taxSettings.taxRoundingMode);
  const afterTax = roundCurrencySnapshot(beforeTax + tax, taxSettings.totalRoundingMode);
  return { ...base, commonTemporaryCost, siteManagementCost, beforeTax, tax, afterTax };
}

function calculateLineSnapshot(item: ProjectItem) {
  if (item.itemType === "material") {
    const unitCost = numberOrZero(item.estimatedUnitCost) || numberOrZero(item.materialUnitCost);
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

function numberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrencySnapshot(value: number, mode: TaxSettings["taxRoundingMode"]) {
  if (mode === "floor") return Math.floor(value);
  if (mode === "ceil") return Math.ceil(value);
  return Math.round(value);
}

function normalizeProjectStatus(status: unknown): ProjectStatus {
  if (status === "請求済") return "請求済み";
  if (status === "進行中") return "施工中";
  if (
    status === "見積中" ||
    status === "契約済" ||
    status === "施工中" ||
    status === "完了" ||
    status === "請求済み"
  ) {
    return status;
  }
  return "見積中";
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
