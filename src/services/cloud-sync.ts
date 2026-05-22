import { createSupabaseClient, type SupabaseConnectionConfig } from "@/lib/supabase";
import type { Customer, EstimateDocument, InvoiceDocument, PaymentRecord, Project, SyncMetadata } from "@/stores/project-store";

const CLOUD_SYNC_SCHEMA_VERSION = 1;

type VersionedCloudPayload<T> = T & {
  schemaVersion?: number;
};

export type CloudSyncCursor = {
  updatedAt: string;
  id: string;
};

// BYO Supabase schema and RLS policies live in docs/supabase-schema.sql.

type CloudProjectRow = {
  id: string;
  owner_id?: string | null;
  local_id: string;
  project_payload: VersionedCloudPayload<Project>;
  updated_at: string;
  synced_by: string | null;
};

type CloudCustomerRow = {
  id: string;
  owner_id?: string | null;
  local_id: string;
  customer_payload: VersionedCloudPayload<Customer>;
  updated_at: string;
  synced_by: string | null;
};

type CloudEstimateRow = {
  id: string;
  owner_id?: string | null;
  local_id: string;
  estimate_payload: VersionedCloudPayload<EstimateDocument>;
  updated_at: string;
  synced_by: string | null;
};

type CloudInvoiceRow = {
  id: string;
  owner_id?: string | null;
  local_id: string;
  invoice_payload: VersionedCloudPayload<InvoiceDocument>;
  updated_at: string;
  synced_by: string | null;
};

type CloudPaymentRow = {
  id: string;
  owner_id?: string | null;
  local_id: string;
  invoice_local_id: string;
  payment_payload: VersionedCloudPayload<PaymentRecord>;
  updated_at: string;
  synced_by: string | null;
};

export type CustomerSyncResult = {
  pulledCustomers: Customer[];
  pushedMetadataByCustomerId: Record<string, SyncMetadata>;
  pushedCount: number;
  conflictIds: string[];
  syncCursor: CloudSyncCursor | null;
};

export type EstimateSyncResult = {
  pulledEstimates: EstimateDocument[];
  pushedMetadataByEstimateId: Record<string, SyncMetadata>;
  pushedCount: number;
  conflictIds: string[];
  syncCursor: CloudSyncCursor | null;
};

export type InvoiceSyncResult = {
  pulledInvoices: InvoiceDocument[];
  pushedMetadataByInvoiceId: Record<string, SyncMetadata>;
  pushedCount: number;
  conflictIds: string[];
  syncCursor: CloudSyncCursor | null;
};

export type PaymentSyncResult = {
  pulledPayments: PaymentRecord[];
  pushedMetadataByPaymentId: Record<string, SyncMetadata>;
  pushedCount: number;
  conflictIds: string[];
  syncCursor: CloudSyncCursor | null;
};

export type ProjectSyncResult = {
  pulledProjects: Project[];
  pushedMetadataByProjectId: Record<string, SyncMetadata>;
  pushedCount: number;
  conflictIds: string[];
  syncCursor: CloudSyncCursor | null;
};

type CloudRowForMetadata = Pick<CloudProjectRow, "id" | "local_id" | "updated_at" | "synced_by">;

async function pullEntityFromCloud<TRecord>({
  config,
  table,
  selectColumns,
  label,
  lastSyncedAt,
  lastSyncCursorId = "",
  normalize,
}: {
  config: SupabaseConnectionConfig;
  table: string;
  selectColumns: string;
  label: string;
  lastSyncedAt: string;
  lastSyncCursorId?: string;
  normalize: (row: unknown) => TRecord | null;
}): Promise<TRecord[]> {
  const client = createSupabaseClient(config);
  let query = client
    .from(table)
    .select(selectColumns)
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true });

  query = applyServerCursorFilter(query, lastSyncedAt, lastSyncCursorId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`${label}のpullに失敗しました: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => normalize(row))
    .filter((record): record is TRecord => Boolean(record));
}

async function pushEntityToCloud<TRecord>({
  config,
  table,
  label,
  records,
  currentUserId,
  buildRow,
}: {
  config: SupabaseConnectionConfig;
  table: string;
  label: string;
  records: TRecord[];
  currentUserId: string;
  buildRow: (record: TRecord, ownerId: string) => Record<string, unknown>;
}): Promise<Record<string, SyncMetadata>> {
  const client = createSupabaseClient(config);
  const ownerId = requireAuthenticatedUserId(currentUserId);
  const rows = records.map((record) => buildRow(record, ownerId));

  if (rows.length === 0) return {};
  logPayloadSchemaVersion(table, rows.length);

  const { data, error } = await client
    .from(table)
    .upsert(rows, { onConflict: "owner_id,local_id" })
    .select("id, owner_id, local_id, updated_at, synced_by");

  if (error) {
    throw new Error(`${label}のpushに失敗しました: ${error.message}`);
  }

  return (data ?? []).reduce<Record<string, SyncMetadata>>((metadataByLocalId, row) => {
    const typedRow = row as CloudRowForMetadata;
    metadataByLocalId[typedRow.local_id] = {
      lastSyncedAt: typedRow.updated_at,
      serverId: typedRow.id,
      version: 1,
      syncedBy: typedRow.synced_by ?? "local",
    };
    return metadataByLocalId;
  }, {});
}

async function syncEntityWithCloud<TRecord extends { id: string; syncMetadata?: SyncMetadata }>({
  config,
  localRecords,
  lastSyncedAt,
  lastSyncCursorId,
  currentUserId,
  pull,
  push,
  getUpdatedAt,
  shouldPush,
}: {
  config: SupabaseConnectionConfig;
  localRecords: TRecord[];
  lastSyncedAt: string;
  lastSyncCursorId?: string;
  currentUserId: string;
  pull: (config: SupabaseConnectionConfig, lastSyncedAt: string, lastSyncCursorId?: string) => Promise<TRecord[]>;
  push: (config: SupabaseConnectionConfig, records: TRecord[], currentUserId: string) => Promise<Record<string, SyncMetadata>>;
  getUpdatedAt: (record: TRecord) => string;
  shouldPush: (record: TRecord, lastSyncedAt: string) => boolean;
}) {
  const pulledRecords = await pull(config, lastSyncedAt, lastSyncCursorId);
  const conflictIds = detectSyncConflictIds(localRecords, pulledRecords, lastSyncedAt, getUpdatedAt);
  const recordsToPush = localRecords.filter(
    (record) => shouldPush(record, lastSyncedAt) && !conflictIds.includes(record.id),
  );
  const pushedMetadataByRecordId = await push(config, recordsToPush, currentUserId);
  const syncCursor = resolveNextSyncCursor(lastSyncedAt, lastSyncCursorId, pulledRecords, pushedMetadataByRecordId);

  return {
    pulledRecords,
    pushedMetadataByRecordId,
    pushedCount: recordsToPush.length,
    conflictIds,
    syncCursor,
  };
}

export async function pullCustomersFromCloud(
  config: SupabaseConnectionConfig,
  lastSyncedAt: string,
  lastSyncCursorId = "",
): Promise<Customer[]> {
  return pullEntityFromCloud({
    config,
    table: "customers",
    selectColumns: "id, owner_id, local_id, customer_payload, updated_at, synced_by",
    label: "顧客",
    lastSyncedAt,
    lastSyncCursorId,
    normalize: (row) => normalizeCloudCustomerRow(row as CloudCustomerRow),
  });
}

export async function pushCustomersToCloud(
  config: SupabaseConnectionConfig,
  customers: Customer[],
  currentUserId: string,
): Promise<Record<string, SyncMetadata>> {
  return pushEntityToCloud({
    config,
    table: "customers",
    label: "顧客",
    records: customers,
    currentUserId,
    buildRow: (customer, ownerId) => ({
      owner_id: ownerId,
      local_id: customer.id,
      customer_payload: withCloudSchemaVersion(customer),
      synced_by: ownerId,
    }),
  });
}

export async function pullProjectsFromCloud(
  config: SupabaseConnectionConfig,
  lastSyncedAt: string,
  lastSyncCursorId = "",
): Promise<Project[]> {
  return pullEntityFromCloud({
    config,
    table: "projects",
    selectColumns: "id, owner_id, local_id, project_payload, updated_at, synced_by",
    label: "案件",
    lastSyncedAt,
    lastSyncCursorId,
    normalize: (row) => normalizeCloudProjectRow(row as CloudProjectRow),
  });
}

export async function pullEstimatesFromCloud(
  config: SupabaseConnectionConfig,
  lastSyncedAt: string,
  lastSyncCursorId = "",
): Promise<EstimateDocument[]> {
  return pullEntityFromCloud({
    config,
    table: "estimate_documents",
    selectColumns: "id, owner_id, local_id, estimate_payload, updated_at, synced_by",
    label: "見積書",
    lastSyncedAt,
    lastSyncCursorId,
    normalize: (row) => normalizeCloudEstimateRow(row as CloudEstimateRow),
  });
}

export async function pushEstimatesToCloud(
  config: SupabaseConnectionConfig,
  estimates: EstimateDocument[],
  currentUserId: string,
): Promise<Record<string, SyncMetadata>> {
  return pushEntityToCloud({
    config,
    table: "estimate_documents",
    label: "見積書",
    records: estimates,
    currentUserId,
    buildRow: (estimate, ownerId) => ({
      owner_id: ownerId,
      local_id: estimate.id,
      estimate_payload: withCloudSchemaVersion(estimate),
      synced_by: ownerId,
    }),
  });
}

export async function pullInvoicesFromCloud(
  config: SupabaseConnectionConfig,
  lastSyncedAt: string,
  lastSyncCursorId = "",
): Promise<InvoiceDocument[]> {
  return pullEntityFromCloud({
    config,
    table: "invoice_documents",
    selectColumns: "id, owner_id, local_id, invoice_payload, updated_at, synced_by",
    label: "請求書",
    lastSyncedAt,
    lastSyncCursorId,
    normalize: (row) => normalizeCloudInvoiceRow(row as CloudInvoiceRow),
  });
}

export async function pushInvoicesToCloud(
  config: SupabaseConnectionConfig,
  invoices: InvoiceDocument[],
  currentUserId: string,
): Promise<Record<string, SyncMetadata>> {
  return pushEntityToCloud({
    config,
    table: "invoice_documents",
    label: "請求書",
    records: invoices,
    currentUserId,
    buildRow: (invoice, ownerId) => ({
      owner_id: ownerId,
      local_id: invoice.id,
      invoice_payload: withCloudSchemaVersion(invoice),
      synced_by: ownerId,
    }),
  });
}

export async function pullPaymentsFromCloud(
  config: SupabaseConnectionConfig,
  lastSyncedAt: string,
  lastSyncCursorId = "",
): Promise<PaymentRecord[]> {
  return pullEntityFromCloud({
    config,
    table: "payment_records",
    selectColumns: "id, owner_id, local_id, invoice_local_id, payment_payload, updated_at, synced_by",
    label: "入金記録",
    lastSyncedAt,
    lastSyncCursorId,
    normalize: (row) => normalizeCloudPaymentRow(row as CloudPaymentRow),
  });
}

export async function pushPaymentsToCloud(
  config: SupabaseConnectionConfig,
  payments: PaymentRecord[],
  currentUserId: string,
): Promise<Record<string, SyncMetadata>> {
  return pushEntityToCloud({
    config,
    table: "payment_records",
    label: "入金記録",
    records: payments,
    currentUserId,
    buildRow: (payment, ownerId) => ({
      owner_id: ownerId,
      local_id: payment.id,
      invoice_local_id: payment.invoiceId,
      payment_payload: withCloudSchemaVersion(payment),
      synced_by: ownerId,
    }),
  });
}

export async function pushProjectsToCloud(
  config: SupabaseConnectionConfig,
  projects: Project[],
  currentUserId: string,
): Promise<Record<string, SyncMetadata>> {
  return pushEntityToCloud({
    config,
    table: "projects",
    label: "案件",
    records: projects,
    currentUserId,
    buildRow: (project, ownerId) => ({
      owner_id: ownerId,
      local_id: project.id,
      project_payload: withCloudSchemaVersion(project),
      synced_by: ownerId,
    }),
  });
}

export async function syncProjectsWithCloud({
  config,
  localProjects,
  lastSyncedAt,
  lastSyncCursorId,
  currentUserId,
}: {
  config: SupabaseConnectionConfig;
  localProjects: Project[];
  lastSyncedAt: string;
  lastSyncCursorId?: string;
  currentUserId: string;
}): Promise<ProjectSyncResult> {
  const result = await syncEntityWithCloud({
    config,
    localRecords: localProjects,
    lastSyncedAt,
    lastSyncCursorId,
    currentUserId,
    pull: pullProjectsFromCloud,
    push: pushProjectsToCloud,
    getUpdatedAt: getProjectUpdatedAt,
    shouldPush: shouldPushProject,
  });

  return {
    pulledProjects: result.pulledRecords,
    pushedMetadataByProjectId: result.pushedMetadataByRecordId,
    pushedCount: result.pushedCount,
    conflictIds: result.conflictIds,
    syncCursor: result.syncCursor,
  };
}

export async function syncCustomersWithCloud({
  config,
  localCustomers,
  lastSyncedAt,
  lastSyncCursorId,
  currentUserId,
}: {
  config: SupabaseConnectionConfig;
  localCustomers: Customer[];
  lastSyncedAt: string;
  lastSyncCursorId?: string;
  currentUserId: string;
}): Promise<CustomerSyncResult> {
  const result = await syncEntityWithCloud({
    config,
    localRecords: localCustomers,
    lastSyncedAt,
    lastSyncCursorId,
    currentUserId,
    pull: pullCustomersFromCloud,
    push: pushCustomersToCloud,
    getUpdatedAt: getCustomerUpdatedAt,
    shouldPush: shouldPushCustomer,
  });

  return {
    pulledCustomers: result.pulledRecords,
    pushedMetadataByCustomerId: result.pushedMetadataByRecordId,
    pushedCount: result.pushedCount,
    conflictIds: result.conflictIds,
    syncCursor: result.syncCursor,
  };
}

export async function syncEstimatesWithCloud({
  config,
  localEstimates,
  lastSyncedAt,
  lastSyncCursorId,
  currentUserId,
}: {
  config: SupabaseConnectionConfig;
  localEstimates: EstimateDocument[];
  lastSyncedAt: string;
  lastSyncCursorId?: string;
  currentUserId: string;
}): Promise<EstimateSyncResult> {
  const result = await syncEntityWithCloud({
    config,
    localRecords: localEstimates,
    lastSyncedAt,
    lastSyncCursorId,
    currentUserId,
    pull: pullEstimatesFromCloud,
    push: pushEstimatesToCloud,
    getUpdatedAt: getEstimateUpdatedAt,
    shouldPush: shouldPushEstimate,
  });

  return {
    pulledEstimates: result.pulledRecords,
    pushedMetadataByEstimateId: result.pushedMetadataByRecordId,
    pushedCount: result.pushedCount,
    conflictIds: result.conflictIds,
    syncCursor: result.syncCursor,
  };
}

export async function syncInvoicesWithCloud({
  config,
  localInvoices,
  lastSyncedAt,
  lastSyncCursorId,
  currentUserId,
}: {
  config: SupabaseConnectionConfig;
  localInvoices: InvoiceDocument[];
  lastSyncedAt: string;
  lastSyncCursorId?: string;
  currentUserId: string;
}): Promise<InvoiceSyncResult> {
  const result = await syncEntityWithCloud({
    config,
    localRecords: localInvoices,
    lastSyncedAt,
    lastSyncCursorId,
    currentUserId,
    pull: pullInvoicesFromCloud,
    push: pushInvoicesToCloud,
    getUpdatedAt: getInvoiceUpdatedAt,
    shouldPush: shouldPushInvoice,
  });

  return {
    pulledInvoices: result.pulledRecords,
    pushedMetadataByInvoiceId: result.pushedMetadataByRecordId,
    pushedCount: result.pushedCount,
    conflictIds: result.conflictIds,
    syncCursor: result.syncCursor,
  };
}

export async function syncPaymentsWithCloud({
  config,
  localPayments,
  lastSyncedAt,
  lastSyncCursorId,
  currentUserId,
}: {
  config: SupabaseConnectionConfig;
  localPayments: PaymentRecord[];
  lastSyncedAt: string;
  lastSyncCursorId?: string;
  currentUserId: string;
}): Promise<PaymentSyncResult> {
  const result = await syncEntityWithCloud({
    config,
    localRecords: localPayments,
    lastSyncedAt,
    lastSyncCursorId,
    currentUserId,
    pull: pullPaymentsFromCloud,
    push: pushPaymentsToCloud,
    getUpdatedAt: getPaymentUpdatedAt,
    shouldPush: shouldPushPayment,
  });

  return {
    pulledPayments: result.pulledRecords,
    pushedMetadataByPaymentId: result.pushedMetadataByRecordId,
    pushedCount: result.pushedCount,
    conflictIds: result.conflictIds,
    syncCursor: result.syncCursor,
  };
}

function applyServerCursorFilter<TQuery>(query: TQuery, lastSyncedAt: string, lastSyncCursorId = ""): TQuery {
  if (!lastSyncedAt) return query;
  if (!lastSyncCursorId) {
    return (query as { gte: (column: string, value: string) => TQuery }).gte("updated_at", lastSyncedAt);
  }
  return (query as { or: (filters: string) => TQuery }).or(
    `updated_at.gt.${lastSyncedAt},and(updated_at.eq.${lastSyncedAt},id.gt.${lastSyncCursorId})`,
  );
}

function resolveNextSyncCursor(
  previousUpdatedAt: string,
  previousCursorId: string | undefined,
  pulledRecords: Array<{ syncMetadata?: SyncMetadata }>,
  pushedMetadataByLocalId: Record<string, SyncMetadata>,
): CloudSyncCursor | null {
  const candidates: CloudSyncCursor[] = [];
  if (previousUpdatedAt && previousCursorId) {
    candidates.push({ updatedAt: previousUpdatedAt, id: previousCursorId });
  }
  for (const record of pulledRecords) {
    const cursor = syncMetadataToCursor(record.syncMetadata);
    if (cursor) candidates.push(cursor);
  }
  for (const metadata of Object.values(pushedMetadataByLocalId)) {
    const cursor = syncMetadataToCursor(metadata);
    if (cursor) candidates.push(cursor);
  }
  return candidates.reduce<CloudSyncCursor | null>((latest, cursor) => {
    if (!latest) return cursor;
    return compareSyncCursor(cursor, latest) > 0 ? cursor : latest;
  }, null);
}

function syncMetadataToCursor(metadata: SyncMetadata | undefined): CloudSyncCursor | null {
  if (!metadata?.lastSyncedAt || !metadata.serverId) return null;
  return {
    updatedAt: metadata.lastSyncedAt,
    id: metadata.serverId,
  };
}

function compareSyncCursor(left: CloudSyncCursor, right: CloudSyncCursor) {
  const leftTime = Date.parse(left.updatedAt);
  const rightTime = Date.parse(right.updatedAt);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  return left.id.localeCompare(right.id);
}

function isUnsyncedLocalRecord(record: { syncMetadata?: SyncMetadata }) {
  return !record.syncMetadata || record.syncMetadata.lastSyncedAt == null || record.syncMetadata.lastSyncedAt === "";
}

function shouldPushProject(project: Project, globalLastSyncedAt: string) {
  if (isUnsyncedLocalRecord(project)) return true;
  const projectSyncedAt = project.syncMetadata?.lastSyncedAt ?? globalLastSyncedAt;
  if (!projectSyncedAt) return true;
  const localUpdatedAt = Date.parse(project.updatedAt || "");
  const syncedAt = Date.parse(projectSyncedAt);
  if (!Number.isFinite(localUpdatedAt) || !Number.isFinite(syncedAt)) return true;
  return localUpdatedAt > syncedAt;
}

function shouldPushCustomer(customer: Customer, globalLastSyncedAt: string) {
  if (isUnsyncedLocalRecord(customer)) return true;
  const customerSyncedAt = customer.syncMetadata?.lastSyncedAt ?? globalLastSyncedAt;
  if (!customerSyncedAt) return true;
  const localUpdatedAt = Date.parse(customer.updatedAt || "");
  const syncedAt = Date.parse(customerSyncedAt);
  if (!Number.isFinite(localUpdatedAt) || !Number.isFinite(syncedAt)) return true;
  return localUpdatedAt > syncedAt;
}

function shouldPushEstimate(estimate: EstimateDocument, globalLastSyncedAt: string) {
  if (isUnsyncedLocalRecord(estimate)) return true;
  const estimateSyncedAt = estimate.syncMetadata?.lastSyncedAt ?? globalLastSyncedAt;
  if (!estimateSyncedAt) return true;
  const localUpdatedAt = Date.parse(estimate.updatedAt || "");
  const syncedAt = Date.parse(estimateSyncedAt);
  if (!Number.isFinite(localUpdatedAt) || !Number.isFinite(syncedAt)) return true;
  return localUpdatedAt > syncedAt;
}

function shouldPushInvoice(invoice: InvoiceDocument, globalLastSyncedAt: string) {
  if (isUnsyncedLocalRecord(invoice)) return true;
  const invoiceSyncedAt = invoice.syncMetadata?.lastSyncedAt ?? globalLastSyncedAt;
  if (!invoiceSyncedAt) return true;
  const localUpdatedAt = Date.parse(invoice.updatedAt || "");
  const syncedAt = Date.parse(invoiceSyncedAt);
  if (!Number.isFinite(localUpdatedAt) || !Number.isFinite(syncedAt)) return true;
  return localUpdatedAt > syncedAt;
}

function shouldPushPayment(payment: PaymentRecord, globalLastSyncedAt: string) {
  if (isUnsyncedLocalRecord(payment)) return true;
  const paymentSyncedAt = payment.syncMetadata?.lastSyncedAt ?? globalLastSyncedAt;
  if (!paymentSyncedAt) return true;
  const localUpdatedAt = Date.parse(payment.updatedAt || payment.createdAt || "");
  const syncedAt = Date.parse(paymentSyncedAt);
  if (!Number.isFinite(localUpdatedAt) || !Number.isFinite(syncedAt)) return true;
  return localUpdatedAt > syncedAt;
}

function detectSyncConflictIds<TRecord extends { id: string; syncMetadata?: SyncMetadata }>(
  localRecords: TRecord[],
  cloudRecords: TRecord[],
  globalLastSyncedAt: string,
  getUpdatedAt: (record: TRecord) => string,
) {
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  return cloudRecords
    .filter((cloudRecord) => {
      const localRecord = localById.get(cloudRecord.id);
      if (!localRecord) return false;
      const baseline = localRecord.syncMetadata?.lastSyncedAt || globalLastSyncedAt || "";
      const localDirty = Boolean(localRecord.syncMetadata && !localRecord.syncMetadata.lastSyncedAt);
      return (localDirty || isChangedAfterBaseline(getUpdatedAt(localRecord), baseline)) && isChangedAfterBaseline(getUpdatedAt(cloudRecord), baseline);
    })
    .map((record) => record.id);
}

function isChangedAfterBaseline(updatedAt: string, baseline: string) {
  const updated = Date.parse(updatedAt || "");
  if (!Number.isFinite(updated)) return false;
  const synced = Date.parse(baseline || "");
  if (!Number.isFinite(synced)) return true;
  return updated > synced;
}

function getProjectUpdatedAt(project: Project) {
  return project.updatedAt || "";
}

function getCustomerUpdatedAt(customer: Customer) {
  return customer.updatedAt || "";
}

function getEstimateUpdatedAt(estimate: EstimateDocument) {
  return estimate.updatedAt || "";
}

function getInvoiceUpdatedAt(invoice: InvoiceDocument) {
  return invoice.updatedAt || "";
}

function getPaymentUpdatedAt(payment: PaymentRecord) {
  return payment.updatedAt || payment.createdAt || "";
}

function normalizeCloudProjectRow(row: CloudProjectRow): Project | null {
  if (!row.project_payload || typeof row.project_payload !== "object") return null;
  assertSupportedCloudSchemaVersion("projects", row.local_id, row.project_payload);
  const project = withoutCloudSchemaVersion(row.project_payload);
  if (!project.id || !project.name || !project.createdAt || !project.updatedAt) return null;

  return {
    ...project,
    id: project.id || row.local_id,
    deletedAt: project.deletedAt ?? null,
    ownerId: project.ownerId || row.owner_id || row.synced_by || "local",
    assignedTo: project.assignedTo ?? null,
    syncMetadata: {
      lastSyncedAt: row.updated_at,
      serverId: row.id,
      version: project.syncMetadata?.version ?? 1,
      syncedBy: row.synced_by ?? row.owner_id ?? project.syncMetadata?.syncedBy ?? null,
    },
  };
}

function normalizeCloudCustomerRow(row: CloudCustomerRow): Customer | null {
  if (!row.customer_payload || typeof row.customer_payload !== "object") return null;
  assertSupportedCloudSchemaVersion("customers", row.local_id, row.customer_payload);
  const customer = withoutCloudSchemaVersion(row.customer_payload);
  if (!customer.id || !customer.createdAt || !customer.updatedAt) return null;

  return {
    ...customer,
    id: customer.id || row.local_id,
    deletedAt: customer.deletedAt ?? null,
    syncMetadata: {
      lastSyncedAt: row.updated_at,
      serverId: row.id,
      version: customer.syncMetadata?.version ?? 1,
      syncedBy: row.synced_by ?? row.owner_id ?? customer.syncMetadata?.syncedBy ?? null,
    },
  };
}

function normalizeCloudEstimateRow(row: CloudEstimateRow): EstimateDocument | null {
  if (!row.estimate_payload || typeof row.estimate_payload !== "object") return null;
  assertSupportedCloudSchemaVersion("estimate_documents", row.local_id, row.estimate_payload);
  const estimate = withoutCloudSchemaVersion(row.estimate_payload);
  if (!estimate.id || !estimate.projectId || !estimate.createdAt || !estimate.updatedAt) return null;

  return {
    ...estimate,
    id: estimate.id || row.local_id,
    deletedAt: estimate.deletedAt ?? null,
    syncMetadata: {
      lastSyncedAt: row.updated_at,
      serverId: row.id,
      version: estimate.syncMetadata?.version ?? 1,
      syncedBy: row.synced_by ?? row.owner_id ?? estimate.syncMetadata?.syncedBy ?? null,
    },
  };
}

function normalizeCloudInvoiceRow(row: CloudInvoiceRow): InvoiceDocument | null {
  if (!row.invoice_payload || typeof row.invoice_payload !== "object") return null;
  assertSupportedCloudSchemaVersion("invoice_documents", row.local_id, row.invoice_payload);
  const invoice = withoutCloudSchemaVersion(row.invoice_payload);
  if (!invoice.id || !invoice.projectId || !invoice.createdAt || !invoice.updatedAt) return null;

  return {
    ...invoice,
    id: invoice.id || row.local_id,
    deletedAt: invoice.deletedAt ?? null,
    syncMetadata: {
      lastSyncedAt: row.updated_at,
      serverId: row.id,
      version: invoice.syncMetadata?.version ?? 1,
      syncedBy: row.synced_by ?? row.owner_id ?? invoice.syncMetadata?.syncedBy ?? null,
    },
  };
}

function normalizeCloudPaymentRow(row: CloudPaymentRow): PaymentRecord | null {
  if (!row.payment_payload || typeof row.payment_payload !== "object") return null;
  assertSupportedCloudSchemaVersion("payment_records", row.local_id, row.payment_payload);
  const payment = withoutCloudSchemaVersion(row.payment_payload);
  const invoiceId = payment.invoiceId || row.invoice_local_id;
  if (!payment.id || !invoiceId || !payment.createdAt) return null;

  return {
    ...payment,
    id: payment.id || row.local_id,
    invoiceId,
    deletedAt: payment.deletedAt ?? null,
    syncMetadata: {
      lastSyncedAt: row.updated_at,
      serverId: row.id,
      version: payment.syncMetadata?.version ?? 1,
      syncedBy: row.synced_by ?? row.owner_id ?? payment.syncMetadata?.syncedBy ?? null,
    },
  };
}

function requireAuthenticatedUserId(currentUserId: string) {
  const userId = currentUserId.trim();
  if (!userId) {
    throw new Error("クラウド同期にはSupabaseアカウントでログインしてください。");
  }
  return userId;
}

function withCloudSchemaVersion<T extends object>(payload: T): VersionedCloudPayload<T> {
  return {
    ...payload,
    schemaVersion: CLOUD_SYNC_SCHEMA_VERSION,
  };
}

function withoutCloudSchemaVersion<T extends object>(payload: VersionedCloudPayload<T>): T {
  const { schemaVersion: _schemaVersion, ...rest } = payload;
  return rest as T;
}

function assertSupportedCloudSchemaVersion<T extends object>(
  tableName: string,
  localId: string,
  payload: VersionedCloudPayload<T>,
) {
  const payloadVersion = payload.schemaVersion ?? 0;
  if (payloadVersion > CLOUD_SYNC_SCHEMA_VERSION) {
    throw new Error(
      `${tableName} のpayload schemaVersion ${payloadVersion} は、このMitruでは読み込めません。Mitruを最新版へ更新してから同期してください。`,
    );
  }
  if (payloadVersion < CLOUD_SYNC_SCHEMA_VERSION) {
    console.warn("[Mitru cloud-sync] schemaVersion mismatch", {
      table: tableName,
      localId,
      payloadSchemaVersion: payloadVersion,
      expectedSchemaVersion: CLOUD_SYNC_SCHEMA_VERSION,
      action: "pulled with compatibility mode; future migration hook will handle this explicitly",
    });
  }
}

function logPayloadSchemaVersion(tableName: string, count: number) {
  if (!isCloudSyncTestModeEnabled()) return;
  console.info("[Mitru cloud-sync] payload schemaVersion attached", {
    table: tableName,
    count,
    schemaVersion: CLOUD_SYNC_SCHEMA_VERSION,
  });
}

function isCloudSyncTestModeEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const persisted = window.localStorage.getItem("mitru-local-store");
    if (!persisted) return false;
    return persisted.includes('"isTestMode":true');
  } catch {
    return false;
  }
}
