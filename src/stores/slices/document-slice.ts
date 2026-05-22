import type {
  DocumentNumberConfig,
  DeliveryDocument,
  EstimateDocument,
  InvoiceDocument,
  BillingCloseRecord,
  PaymentRecord,
  OrderDocument,
  OrderLineSnapshot,
  PurchaseRecord,
  ProjectInvoiceItemState,
  ProjectInvoiceSettings,
  ProjectQuoteSettings,
  ProjectSealSettings,
  SliceContext,
} from "./types";
import { resolveProjectTaxRate } from "@/lib/tax";

export const quoteSliceVersion = 1;
export const invoiceSliceVersion = 1;
export const deliverySliceVersion = 1;
export const orderSliceVersion = 1;

type DocumentSliceDependencies = {
  defaultInvoiceSettings: ProjectInvoiceSettings;
  defaultQuoteSettings: ProjectQuoteSettings;
  generateDocumentNumber: (
    config: DocumentNumberConfig,
    documents: Array<{ documentNumber: string }>,
  ) => string;
  getProjectSealSettings: (
    settings: Record<string, ProjectSealSettings> | undefined,
    projectId: string,
    fallbackSealImage?: string,
  ) => ProjectSealSettings;
  normalizeProjectSealSettings: (
    input: Partial<ProjectSealSettings> | undefined,
    fallbackSealImage?: string,
  ) => ProjectSealSettings;
};

function incrementDocumentCounter(config: DocumentNumberConfig): DocumentNumberConfig {
  return {
    ...config,
    nextNumber: Math.max(1, Math.floor(Number(config.nextNumber) || 1)) + 1,
  };
}

function generateWorkflowDocumentNumber(prefix: string, documents: Array<{ documentNumber: string }>) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const nextNumber =
    documents.filter((document) => document.documentNumber.startsWith(`${prefix}-${stamp}`)).length + 1;
  return `${prefix}-${stamp}-${String(nextNumber).padStart(3, "0")}`;
}

function getInvoicePaymentTotal(document: InvoiceDocument) {
  return document.totalsSnapshot?.afterTax ?? document.currentAmount;
}

function sumPaymentRecords(records: PaymentRecord[] | undefined) {
  return (records ?? []).reduce((sum, record) => (record.deletedAt ? sum : sum + record.amount), 0);
}

function createPaymentRecordId() {
  return `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sumPurchaseRecords(records: PurchaseRecord[] | undefined) {
  return (records ?? []).reduce((sum, record) => sum + record.amount, 0);
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function buildInvoiceFromEstimateSnapshot(
  estimate: EstimateDocument,
  version: number,
  documentNumber: string,
  dueDate: string,
  timestamp: string,
  taxRate: number,
): Omit<InvoiceDocument, "id" | "projectId" | "createdAt" | "updatedAt"> {
  const beforeTax =
    estimate.totalsSnapshot?.beforeTax ??
    (estimate.totalAmount > 0 && taxRate > 0 ? roundCurrency(estimate.totalAmount / (1 + taxRate)) : estimate.totalAmount);
  const tax = estimate.totalsSnapshot?.tax ?? roundCurrency(beforeTax * taxRate);
  const afterTax = estimate.totalsSnapshot?.afterTax ?? roundCurrency(beforeTax + tax);
  return {
    sourceEstimateDocumentId: estimate.id,
    documentNumber,
    invoiceDate: timestamp.slice(0, 10),
    dueDate,
    currentAmount: beforeTax,
    cumulativeAmount: beforeTax,
    progressRate: 1,
    paidAmount: 0,
    paymentRecords: [],
    version,
    status: "下書き",
    remarks: `${estimate.documentNumber} から締め処理で作成。`,
    lineSnapshot: (estimate.lineSnapshot ?? []).map((line) => ({
      item: { ...line.item },
      line: { ...line.line },
      previousRate: 0,
      currentRate: 1,
      previousAmount: 0,
      currentAmount: line.line.subtotal,
      cumulativeAmount: line.line.subtotal,
    })),
    totalsSnapshot: {
      previousBeforeTax: 0,
      beforeTax,
      cumulativeBeforeTax: beforeTax,
      tax,
      afterTax,
    },
    snapshotCreatedAt: timestamp,
  };
}

export function createQuoteSlice(
  { set, get, now }: SliceContext,
  {
    defaultQuoteSettings,
    generateDocumentNumber,
    getProjectSealSettings,
    normalizeProjectSealSettings,
  }: DocumentSliceDependencies,
) {
  return {
    updateQuoteSettings: (projectId: string, input: Partial<ProjectQuoteSettings>) => {
      const current = get().quoteSettingsByProjectId[projectId] ?? defaultQuoteSettings;
      set({
        quoteSettingsByProjectId: {
          ...get().quoteSettingsByProjectId,
          [projectId]: { ...current, ...input },
        },
      });
    },
    updateProjectSealSettings: (projectId: string, input: Partial<ProjectSealSettings>) => {
      const current = getProjectSealSettings(get().sealSettingsByProjectId, projectId, get().companyInfo.sealImage);
      const next = normalizeProjectSealSettings({ ...current, ...input }, get().companyInfo.sealImage);
      set({
        sealSettingsByProjectId: {
          ...get().sealSettingsByProjectId,
          [projectId]: next,
        },
      });
    },
    createEstimateDocument: (
      projectId: string,
      input: Omit<EstimateDocument, "id" | "projectId" | "createdAt" | "updatedAt">,
    ) => {
      const currentNumberSettings = get().documentNumberSettings;
      const document: EstimateDocument = {
        id: `estimate-doc-${Date.now()}`,
        projectId,
        ...input,
        documentNumber: generateDocumentNumber(currentNumberSettings.estimate, get().estimateDocuments),
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      set({
        estimateDocuments: [document, ...get().estimateDocuments],
        documentNumberSettings: {
          ...currentNumberSettings,
          estimate: incrementDocumentCounter(currentNumberSettings.estimate),
          updatedAt: now(),
        },
      });
      return document;
    },
    duplicateEstimateDocument: (documentId: string) => {
      const source = get().estimateDocuments.find((document) => document.id === documentId);
      if (!source) return undefined;
      const timestamp = now();
      const version =
        Math.max(
          0,
          ...get().estimateDocuments
            .filter((document) => document.projectId === source.projectId)
            .map((document) => document.version),
        ) + 1;
      const duplicated: EstimateDocument = {
        ...source,
        id: `estimate-doc-${Date.now()}`,
        documentNumber: `${source.documentNumber}-R${version}`,
        version,
        status: "下書き",
        issuedAt: timestamp.slice(0, 10),
        syncMetadata: undefined,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      set({ estimateDocuments: [duplicated, ...get().estimateDocuments] });
      return duplicated;
    },
    updateEstimateDocument: (
      documentId: string,
      input: Partial<Omit<EstimateDocument, "id" | "projectId" | "createdAt">>,
    ) => {
      set({
        estimateDocuments: get().estimateDocuments.map((document) =>
          document.id === documentId
            ? { ...document, ...input, syncMetadata: markSyncMetadataDirty(document.syncMetadata), updatedAt: now() }
            : document,
        ),
      });
    },
    updateEstimateDocumentStatus: (documentId: string, status: EstimateDocument["status"]) => {
      const target = get().estimateDocuments.find((document) => document.id === documentId);
      set({
        estimateDocuments: get().estimateDocuments.map((document) =>
          document.id === documentId
            ? { ...document, status, syncMetadata: markSyncMetadataDirty(document.syncMetadata), updatedAt: now() }
            : document,
        ),
        projects:
          target && status === "発行済"
            ? get().projects.map((project) =>
                project.id === target.projectId
                  ? { ...project, status: "見積中", syncMetadata: markSyncMetadataDirty(project.syncMetadata), updatedAt: now() }
                  : project,
              )
            : get().projects,
      });
    },
    deleteEstimateDocument: (documentId: string) => {
      const deletedAt = now();
      set({
        estimateDocuments: get().estimateDocuments.map((document) =>
          document.id === documentId
            ? { ...document, deletedAt, syncMetadata: markSyncMetadataDirty(document.syncMetadata), updatedAt: deletedAt }
            : document,
        ),
      });
    },
  };
}

export function createInvoiceSlice(
  { set, get, now }: SliceContext,
  { defaultInvoiceSettings, generateDocumentNumber }: DocumentSliceDependencies,
) {
  return {
    updateInvoiceSettings: (projectId: string, input: Partial<ProjectInvoiceSettings>) => {
      const current = get().invoiceSettingsByProjectId[projectId] ?? defaultInvoiceSettings;
      set({
        invoiceSettingsByProjectId: {
          ...get().invoiceSettingsByProjectId,
          [projectId]: { ...current, ...input },
        },
      });
    },
    updateInvoiceItemState: (itemId: string, input: Partial<ProjectInvoiceItemState>) => {
      const current = get().invoiceItemsByItemId[itemId] ?? { previousRate: 0, currentRate: 1 };
      set({
        invoiceItemsByItemId: {
          ...get().invoiceItemsByItemId,
          [itemId]: { ...current, ...input },
        },
      });
    },
    updateInvoiceItemStates: (inputs: Record<string, Partial<ProjectInvoiceItemState>>) => {
      const nextStates = { ...get().invoiceItemsByItemId };
      Object.entries(inputs).forEach(([itemId, input]) => {
        const current = nextStates[itemId] ?? { previousRate: 0, currentRate: 1 };
        nextStates[itemId] = { ...current, ...input };
      });
      set({ invoiceItemsByItemId: nextStates });
    },
    createInvoiceDocument: (
      projectId: string,
      input: Omit<InvoiceDocument, "id" | "projectId" | "createdAt" | "updatedAt">,
    ) => {
      const currentNumberSettings = get().documentNumberSettings;
      const document: InvoiceDocument = {
        id: `invoice-doc-${Date.now()}`,
        projectId,
        ...input,
        paidAmount: input.paidAmount ?? sumPaymentRecords(input.paymentRecords),
        paymentRecords: (input.paymentRecords ?? []).map((record) => ({
          ...record,
          updatedAt: record.updatedAt || record.createdAt || now(),
          deletedAt: record.deletedAt ?? null,
        })),
        documentNumber: generateDocumentNumber(currentNumberSettings.invoice, get().invoiceDocuments),
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      set({
        invoiceDocuments: [document, ...get().invoiceDocuments],
        documentNumberSettings: {
          ...currentNumberSettings,
          invoice: incrementDocumentCounter(currentNumberSettings.invoice),
          updatedAt: now(),
        },
      });
      return document;
    },
    duplicateInvoiceDocument: (documentId: string) => {
      const source = get().invoiceDocuments.find((document) => document.id === documentId);
      if (!source) return undefined;
      const timestamp = now();
      const version =
        Math.max(
          0,
          ...get().invoiceDocuments
            .filter((document) => document.projectId === source.projectId)
            .map((document) => document.version),
        ) + 1;
      const duplicated: InvoiceDocument = {
        ...source,
        id: `invoice-doc-${Date.now()}`,
        documentNumber: `${source.documentNumber}-R${version}`,
        version,
        status: "下書き",
        invoiceDate: timestamp.slice(0, 10),
        syncMetadata: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
        paidAmount: 0,
        paymentRecords: [],
        deletedAt: null,
      };
      set({ invoiceDocuments: [duplicated, ...get().invoiceDocuments] });
      return duplicated;
    },
    updateInvoiceDocument: (
      documentId: string,
      input: Partial<Omit<InvoiceDocument, "id" | "projectId" | "createdAt">>,
    ) => {
      set({
        invoiceDocuments: get().invoiceDocuments.map((document) =>
          document.id === documentId
            ? { ...document, ...input, syncMetadata: markSyncMetadataDirty(document.syncMetadata), updatedAt: now() }
            : document,
        ),
      });
    },
    updateInvoiceDocumentStatus: (documentId: string, status: InvoiceDocument["status"]) => {
      const target = get().invoiceDocuments.find((document) => document.id === documentId);
      set({
        invoiceDocuments: get().invoiceDocuments.map((document) =>
          document.id === documentId
            ? {
                ...document,
                status,
                syncMetadata: markSyncMetadataDirty(document.syncMetadata),
                paidAmount:
                  status === "入金済" && sumPaymentRecords(document.paymentRecords) === 0
                    ? getInvoicePaymentTotal(document)
                    : document.paidAmount,
                updatedAt: now(),
              }
            : document,
        ),
        projects:
          target && status === "発行済"
            ? get().projects.map((project) =>
                project.id === target.projectId
                  ? { ...project, status: "請求済み", syncMetadata: markSyncMetadataDirty(project.syncMetadata), updatedAt: now() }
                  : project,
              )
            : get().projects,
      });
    },
    registerInvoicePayment: (
      invoiceId: string,
      input: Omit<PaymentRecord, "id" | "invoiceId" | "createdAt" | "updatedAt">,
    ) => {
      const target = get().invoiceDocuments.find((document) => document.id === invoiceId);
      if (!target) return undefined;
      const timestamp = now();
      const record: PaymentRecord = {
        id: createPaymentRecordId(),
        invoiceId,
        ...input,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const nextRecords = [...(target.paymentRecords ?? []), record];
      const paidAmount = sumPaymentRecords(nextRecords);
      const invoiceTotal = getInvoicePaymentTotal(target);
      set({
        invoiceDocuments: get().invoiceDocuments.map((document) =>
          document.id === invoiceId
            ? {
                ...document,
                paymentRecords: nextRecords,
                paidAmount,
                syncMetadata: markSyncMetadataDirty(document.syncMetadata),
                status: paidAmount >= invoiceTotal ? "入金済" : document.status === "入金済" ? "発行済" : document.status,
                updatedAt: timestamp,
              }
            : document,
        ),
      });
      return record;
    },
    updateInvoicePayment: (
      invoiceId: string,
      paymentId: string,
      input: Partial<Omit<PaymentRecord, "id" | "invoiceId" | "createdAt" | "updatedAt" | "syncMetadata" | "deletedAt">>,
    ) => {
      const target = get().invoiceDocuments.find((document) => document.id === invoiceId);
      if (!target) return;
      const updatedAt = now();
      const nextRecords = (target.paymentRecords ?? []).map((record) =>
        record.id === paymentId
          ? {
              ...record,
              ...input,
              syncMetadata: markSyncMetadataDirty(record.syncMetadata),
              updatedAt,
            }
          : record,
      );
      const paidAmount = sumPaymentRecords(nextRecords);
      const invoiceTotal = getInvoicePaymentTotal(target);
      set({
        invoiceDocuments: get().invoiceDocuments.map((document) =>
          document.id === invoiceId
            ? {
                ...document,
                paymentRecords: nextRecords,
                paidAmount,
                syncMetadata: markSyncMetadataDirty(document.syncMetadata),
                status: paidAmount >= invoiceTotal ? "入金済" : document.status === "入金済" ? "発行済" : document.status,
                updatedAt,
              }
            : document,
        ),
      });
    },
    deleteInvoicePayment: (invoiceId: string, paymentId: string) => {
      const target = get().invoiceDocuments.find((document) => document.id === invoiceId);
      if (!target) return;
      const deletedAt = now();
      const nextRecords = (target.paymentRecords ?? []).map((record) =>
        record.id === paymentId
          ? { ...record, deletedAt, syncMetadata: markSyncMetadataDirty(record.syncMetadata), updatedAt: deletedAt }
          : record,
      );
      const paidAmount = sumPaymentRecords(nextRecords);
      set({
        invoiceDocuments: get().invoiceDocuments.map((document) =>
          document.id === invoiceId
            ? {
                ...document,
                paymentRecords: nextRecords,
                paidAmount,
                syncMetadata: markSyncMetadataDirty(document.syncMetadata),
                status: document.status === "入金済" && paidAmount < getInvoicePaymentTotal(document) ? "発行済" : document.status,
                updatedAt: now(),
              }
            : document,
        ),
      });
    },
    deleteInvoiceDocument: (documentId: string) => {
      const deletedAt = now();
      set({
        invoiceDocuments: get().invoiceDocuments.map((document) =>
          document.id === documentId
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
        billingCloseRecords: get().billingCloseRecords.map((record) => ({
          ...record,
          createdInvoiceIds: record.createdInvoiceIds.filter((invoiceId) => invoiceId !== documentId),
        })),
      });
    },
    createBillingCloseRun: ({ closingDate, estimateIds }: { closingDate: string; estimateIds: string[] }) => {
      const timestamp = now();
      const selectedIds = new Set(estimateIds);
      const alreadyInvoicedEstimateIds = new Set(
        get().invoiceDocuments.map((document) => document.sourceEstimateDocumentId).filter(Boolean),
      );
      const estimates = get().estimateDocuments.filter(
        (estimate) => selectedIds.has(estimate.id) && !alreadyInvoicedEstimateIds.has(estimate.id),
      );
      if (estimates.length === 0) return [];

      const projectsById = new Map(get().projects.map((project) => [project.id, project]));
      let nextInvoiceDocuments = [...get().invoiceDocuments];
      let currentNumberSettings = get().documentNumberSettings;
      const closeRecords = new Map<string, BillingCloseRecord>();

      estimates.forEach((estimate) => {
        const project = projectsById.get(estimate.projectId);
        const taxRate = resolveProjectTaxRate(project?.taxRateType, get().taxSettings.standardTaxRate);
        const customerKey = project?.customerId || project?.clientCompanyName || project?.clientName || "unknown";
        const clientName = project?.clientCompanyName || project?.clientName || "未設定の取引先";
        const version =
          Math.max(
            0,
            ...nextInvoiceDocuments
              .filter((document) => document.projectId === estimate.projectId)
              .map((document) => document.version),
          ) + 1;
        const documentNumber = generateDocumentNumber(currentNumberSettings.invoice, nextInvoiceDocuments);
        const invoiceInput = buildInvoiceFromEstimateSnapshot(
          estimate,
          version,
          documentNumber,
          project?.expectedPaymentDate || closingDate,
          timestamp,
          taxRate,
        );
        const invoice: InvoiceDocument = {
          id: `invoice-doc-${Date.now()}-${nextInvoiceDocuments.length}`,
          projectId: estimate.projectId,
          ...invoiceInput,
          deletedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        nextInvoiceDocuments = [invoice, ...nextInvoiceDocuments];
        currentNumberSettings = {
          ...currentNumberSettings,
          invoice: incrementDocumentCounter(currentNumberSettings.invoice),
          updatedAt: timestamp,
        };

        const currentRecord =
          closeRecords.get(customerKey) ??
          {
            id: `billing-close-${Date.now()}-${closeRecords.size}`,
            closingDate,
            clientName,
            customerKey,
            targetEstimateIds: [],
            createdInvoiceIds: [],
            totalAmount: 0,
            status: "作成済" as const,
            createdAt: timestamp,
          };
        currentRecord.targetEstimateIds.push(estimate.id);
        currentRecord.createdInvoiceIds.push(invoice.id);
        currentRecord.totalAmount += invoice.totalsSnapshot?.afterTax ?? invoice.currentAmount;
        closeRecords.set(customerKey, currentRecord);
      });

      const records = Array.from(closeRecords.values());
      set({
        invoiceDocuments: nextInvoiceDocuments,
        documentNumberSettings: currentNumberSettings,
        billingCloseRecords: [...records, ...get().billingCloseRecords],
      });
      return records;
    },
  };
}

function markSyncMetadataDirty<TSyncMetadata extends { lastSyncedAt: string | null } | undefined>(
  syncMetadata: TSyncMetadata,
) {
  return syncMetadata ? { ...syncMetadata, lastSyncedAt: null } : syncMetadata;
}

export function createDeliverySlice({ set, get, now }: SliceContext) {
  return {
    createDeliveryDocument: (
      projectId: string,
      input: Omit<DeliveryDocument, "id" | "projectId" | "createdAt" | "updatedAt">,
    ) => {
      const document: DeliveryDocument = {
        id: `delivery-doc-${Date.now()}`,
        projectId,
        ...input,
        documentNumber: input.documentNumber || generateWorkflowDocumentNumber("DEL", get().deliveryDocuments),
        createdAt: now(),
        updatedAt: now(),
      };
      set({ deliveryDocuments: [document, ...get().deliveryDocuments] });
      return document;
    },
    duplicateDeliveryDocument: (documentId: string) => {
      const source = get().deliveryDocuments.find((document) => document.id === documentId);
      if (!source) return undefined;
      const timestamp = now();
      const duplicated: DeliveryDocument = {
        ...source,
        id: `delivery-doc-${Date.now()}`,
        documentNumber: generateWorkflowDocumentNumber("DEL", get().deliveryDocuments),
        status: "未発行",
        issuedAt: timestamp.slice(0, 10),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      set({ deliveryDocuments: [duplicated, ...get().deliveryDocuments] });
      return duplicated;
    },
    deleteDeliveryDocument: (documentId: string) => {
      set({
        deliveryDocuments: get().deliveryDocuments.filter((document) => document.id !== documentId),
      });
    },
  };
}

export function createOrderSlice({ set, get, now }: SliceContext) {
  return {
    createOrderDocument: (
      projectId: string,
      input: Omit<OrderDocument, "id" | "projectId" | "createdAt" | "updatedAt">,
    ) => {
      const document: OrderDocument = {
        id: `order-doc-${Date.now()}`,
        projectId,
        ...input,
        purchasedAmount: input.purchasedAmount ?? sumPurchaseRecords(input.purchaseRecords),
        purchaseRecords: input.purchaseRecords ?? [],
        documentNumber: input.documentNumber || generateWorkflowDocumentNumber("ORD", get().orderDocuments),
        createdAt: now(),
        updatedAt: now(),
      };
      set({ orderDocuments: [document, ...get().orderDocuments] });
      return document;
    },
    createPurchaseOrderFromItem: (
      projectId: string,
      itemId: string,
      input: {
        supplierName: string;
        quantity: number;
        unitPrice: number;
        dueDate: string;
        remarks?: string;
      },
    ) => {
      const item = get().projectItems.find((projectItem) => projectItem.id === itemId && projectItem.projectId === projectId);
      if (!item) return undefined;
      const quantity = Math.max(0, input.quantity);
      const unitPrice = Math.max(0, input.unitPrice);
      const subtotal = Math.round(quantity * unitPrice);
      const lineSnapshot: OrderLineSnapshot = {
        sourceItemId: item.id,
        majorCategory: item.majorCategory,
        middleCategory: item.middleCategory,
        name: item.specification || item.name,
        specification: item.specification,
        unit: item.unit,
        quantity,
        unitPrice,
        subtotal,
      };
      const timestamp = now();
      const document: OrderDocument = {
        id: `order-doc-${Date.now()}`,
        projectId,
        sourceDocumentId: item.id,
        sourceDocumentKind: "calculation",
        documentNumber: generateWorkflowDocumentNumber("ORD", get().orderDocuments),
        orderedAt: timestamp.slice(0, 10),
        dueDate: input.dueDate,
        supplierName: input.supplierName,
        title: `${item.specification || item.name} 発注書`,
        totalAmount: subtotal,
        itemCount: 1,
        status: "発行済",
        orderLineSnapshot: [lineSnapshot],
        purchasedAmount: 0,
        purchaseRecords: [],
        remarks: input.remarks ?? "",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      set({ orderDocuments: [document, ...get().orderDocuments] });
      return document;
    },
    duplicateOrderDocument: (documentId: string) => {
      const source = get().orderDocuments.find((document) => document.id === documentId);
      if (!source) return undefined;
      const timestamp = now();
      const duplicated: OrderDocument = {
        ...source,
        id: `order-doc-${Date.now()}`,
        documentNumber: generateWorkflowDocumentNumber("ORD", get().orderDocuments),
        status: "未発行",
        orderedAt: timestamp.slice(0, 10),
        purchasedAmount: 0,
        purchaseRecords: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      set({ orderDocuments: [duplicated, ...get().orderDocuments] });
      return duplicated;
    },
    registerOrderPurchase: (
      orderId: string,
      input: Omit<PurchaseRecord, "id" | "orderId" | "createdAt">,
    ) => {
      const target = get().orderDocuments.find((document) => document.id === orderId);
      if (!target) return undefined;
      const record: PurchaseRecord = {
        id: `purchase-${Date.now()}`,
        orderId,
        ...input,
        createdAt: now(),
      };
      const nextRecords = [...(target.purchaseRecords ?? []), record];
      const purchasedAmount = sumPurchaseRecords(nextRecords);
      set({
        orderDocuments: get().orderDocuments.map((document) =>
          document.id === orderId
            ? {
                ...document,
                purchaseRecords: nextRecords,
                purchasedAmount,
                status: purchasedAmount >= document.totalAmount ? "発注済" : document.status,
                updatedAt: now(),
              }
            : document,
        ),
      });
      return record;
    },
    deleteOrderPurchase: (orderId: string, purchaseId: string) => {
      const target = get().orderDocuments.find((document) => document.id === orderId);
      if (!target) return;
      const nextRecords = (target.purchaseRecords ?? []).filter((record) => record.id !== purchaseId);
      const purchasedAmount = sumPurchaseRecords(nextRecords);
      set({
        orderDocuments: get().orderDocuments.map((document) =>
          document.id === orderId
            ? {
                ...document,
                purchaseRecords: nextRecords,
                purchasedAmount,
                updatedAt: now(),
              }
            : document,
        ),
      });
    },
    deleteOrderDocument: (documentId: string) => {
      set({
        orderDocuments: get().orderDocuments.filter((document) => document.id !== documentId),
      });
    },
  };
}
