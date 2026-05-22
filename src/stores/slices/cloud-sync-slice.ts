import {
  syncCustomersWithCloud,
  syncEstimatesWithCloud,
  syncInvoicesWithCloud,
  syncPaymentsWithCloud,
  syncProjectsWithCloud,
} from "@/services/cloud-sync";
import { cloudSyncFeatureEnabled } from "@/lib/feature-flags";
import { defaultCloudSyncSettings } from "../defaults";
import type {
  CloudSyncEntityResult,
  CloudSyncConflict,
  CloudSyncConflictResolution,
  CloudSyncResults,
  CloudSyncSettings,
  Customer,
  EstimateDocument,
  InvoiceDocument,
  PaymentRecord,
  Project,
  ProjectStore,
  ProjectSyncSummary,
  SliceContext,
  SyncMetadata,
} from "./types";

export const cloudSyncSliceVersion = 5;

export function createCloudSyncSlice({ set, get }: SliceContext) {
  return {
    updateCloudSyncSettings: (input: Partial<CloudSyncSettings>) => {
      const current = get().cloudSyncSettings;
      const next = {
        ...current,
        ...input,
      };
      const isEnabled = cloudSyncFeatureEnabled ? next.isEnabled : false;

      set({
        cloudSyncSettings: {
          ...next,
          isEnabled,
          isTestMode: isEnabled ? next.isTestMode : false,
          isConnected: isEnabled ? next.isConnected : false,
          syncStatus: isEnabled ? next.syncStatus : "idle",
          syncProgress: isEnabled ? next.syncProgress : defaultCloudSyncSettings.syncProgress,
          lastSyncResults: isEnabled ? next.lastSyncResults : defaultCloudSyncSettings.lastSyncResults,
          lastProjectsSyncedAt: isEnabled ? next.lastProjectsSyncedAt : defaultCloudSyncSettings.lastProjectsSyncedAt,
          lastCustomersSyncedAt: isEnabled ? next.lastCustomersSyncedAt : defaultCloudSyncSettings.lastCustomersSyncedAt,
          lastEstimatesSyncedAt: isEnabled ? next.lastEstimatesSyncedAt : defaultCloudSyncSettings.lastEstimatesSyncedAt,
          lastInvoicesSyncedAt: isEnabled ? next.lastInvoicesSyncedAt : defaultCloudSyncSettings.lastInvoicesSyncedAt,
          lastPaymentsSyncedAt: isEnabled ? next.lastPaymentsSyncedAt : defaultCloudSyncSettings.lastPaymentsSyncedAt,
          lastProjectsSyncCursorId: isEnabled ? next.lastProjectsSyncCursorId : defaultCloudSyncSettings.lastProjectsSyncCursorId,
          lastCustomersSyncCursorId: isEnabled ? next.lastCustomersSyncCursorId : defaultCloudSyncSettings.lastCustomersSyncCursorId,
          lastEstimatesSyncCursorId: isEnabled ? next.lastEstimatesSyncCursorId : defaultCloudSyncSettings.lastEstimatesSyncCursorId,
          lastInvoicesSyncCursorId: isEnabled ? next.lastInvoicesSyncCursorId : defaultCloudSyncSettings.lastInvoicesSyncCursorId,
          lastPaymentsSyncCursorId: isEnabled ? next.lastPaymentsSyncCursorId : defaultCloudSyncSettings.lastPaymentsSyncCursorId,
          syncHistory: isEnabled ? next.syncHistory : [],
          authState: isEnabled ? next.authState : "idle",
          user: isEnabled ? next.user : null,
        },
      });
    },
    syncProjects: async (): Promise<ProjectSyncSummary> => {
      const settings = get().cloudSyncSettings;
      const lastProjectSyncedAt = getEntityLastSyncedAt(settings, "projects");
      const lastProjectCursorId = getEntitySyncCursorId(settings, "projects");
      const syncedAt = new Date().toISOString();
      const previousResults = settings.lastSyncResults;
      logCloudSyncTestMode(settings, "projects sync started", {
        enabled: settings.isEnabled,
        lastSyncedAt: lastProjectSyncedAt || null,
        cursorId: lastProjectCursorId || null,
        localCount: get().projects.length,
      });

      try {
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "syncing",
          },
        }));
        if (!settings.isEnabled) {
          throw new Error("クラウド同期が無効です。設定画面で有効にしてください。");
        }
        if (!settings.supabaseUrl.trim() || !settings.supabaseAnonKey.trim()) {
          throw new Error("Supabase Project URL と Anon Key を入力してください。");
        }
        if (settings.authState !== "authenticated" || !settings.user) {
          throw new Error("案件同期にはSupabaseアカウントでログインしてください。");
        }

        const localProjects = get().projects;
        const result = await syncProjectsWithCloud({
          config: {
            supabaseUrl: settings.supabaseUrl,
            supabaseAnonKey: settings.supabaseAnonKey,
          },
          localProjects,
          lastSyncedAt: lastProjectSyncedAt,
          lastSyncCursorId: lastProjectCursorId,
          currentUserId: settings.user.id,
        });

        const projectMerge = mergeProjectsForSync(
          get().projects,
          result.pulledProjects,
          result.pushedMetadataByProjectId,
          lastProjectSyncedAt,
        );
        const mergedProjects = projectMerge.records;
        const summary = {
          pulled: result.pulledProjects.length,
          pushed: result.pushedCount,
          skipped: Math.max(localProjects.length - result.pushedCount, 0) + projectMerge.conflicts.length,
          syncedAt: result.syncCursor?.updatedAt ?? lastProjectSyncedAt,
          syncCursorId: result.syncCursor?.id ?? lastProjectCursorId ?? null,
        };
        const projectResult = createEntityResult(
          "success",
          summary,
          projectMerge.conflicts.length > 0
            ? `案件同期が完了しました。競合 ${projectMerge.conflicts.length}件は自動上書きせず保留しました。`
            : "案件同期が完了しました。",
        );

        set((state) => ({
          projects: mergedProjects,
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            isConnected: true,
            lastSyncAt: syncedAt,
            lastProjectsSyncedAt: summary.syncedAt,
            lastProjectsSyncCursorId: summary.syncCursorId ?? "",
            syncStatus: "success",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              projects: projectResult,
            },
            pendingConflicts: mergePendingConflicts(state.cloudSyncSettings.pendingConflicts, projectMerge.conflicts),
          },
        }));

        logCloudSyncTestMode(get().cloudSyncSettings, "projects sync completed", summary);
        return summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : "案件同期に失敗しました。";
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "error",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              projects: createEntityResult(
                "error",
                {
                  pulled: previousResults.projects.pulled,
                  pushed: previousResults.projects.pushed,
                  skipped: previousResults.projects.skipped,
                  syncedAt,
                },
                message,
              ),
            },
          },
        }));
        console.error("[Mitru cloud-sync] projects sync failed", message);
        throw error;
      }
    },
    syncCustomers: async (): Promise<ProjectSyncSummary> => {
      const settings = get().cloudSyncSettings;
      const lastCustomerSyncedAt = getEntityLastSyncedAt(settings, "customers");
      const lastCustomerCursorId = getEntitySyncCursorId(settings, "customers");
      const syncedAt = new Date().toISOString();
      const previousResults = settings.lastSyncResults;
      logCloudSyncTestMode(settings, "customers sync started", {
        enabled: settings.isEnabled,
        lastSyncedAt: lastCustomerSyncedAt || null,
        cursorId: lastCustomerCursorId || null,
        localCount: get().customers.length,
      });

      try {
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "syncing",
          },
        }));
        if (!settings.isEnabled) {
          throw new Error("クラウド同期が無効です。設定画面で有効にしてください。");
        }
        if (!settings.supabaseUrl.trim() || !settings.supabaseAnonKey.trim()) {
          throw new Error("Supabase Project URL と Anon Key を入力してください。");
        }
        if (settings.authState !== "authenticated" || !settings.user) {
          throw new Error("顧客同期にはSupabaseアカウントでログインしてください。");
        }

        const localCustomers = get().customers;
        const result = await syncCustomersWithCloud({
          config: {
            supabaseUrl: settings.supabaseUrl,
            supabaseAnonKey: settings.supabaseAnonKey,
          },
          localCustomers,
          lastSyncedAt: lastCustomerSyncedAt,
          lastSyncCursorId: lastCustomerCursorId,
          currentUserId: settings.user.id,
        });

        const customerMerge = mergeCustomersForSync(
          get().customers,
          result.pulledCustomers,
          result.pushedMetadataByCustomerId,
          lastCustomerSyncedAt,
        );
        const mergedCustomers = customerMerge.records;
        const summary = {
          pulled: result.pulledCustomers.length,
          pushed: result.pushedCount,
          skipped: Math.max(localCustomers.length - result.pushedCount, 0) + customerMerge.conflicts.length,
          syncedAt: result.syncCursor?.updatedAt ?? lastCustomerSyncedAt,
          syncCursorId: result.syncCursor?.id ?? lastCustomerCursorId ?? null,
        };
        const customerResult = createEntityResult(
          "success",
          summary,
          customerMerge.conflicts.length > 0
            ? `顧客同期が完了しました。競合 ${customerMerge.conflicts.length}件は自動上書きせず保留しました。`
            : "顧客同期が完了しました。",
        );

        set((state) => ({
          customers: mergedCustomers,
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            isConnected: true,
            lastSyncAt: syncedAt,
            lastCustomersSyncedAt: summary.syncedAt,
            lastCustomersSyncCursorId: summary.syncCursorId ?? "",
            syncStatus: "success",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              customers: customerResult,
            },
            pendingConflicts: mergePendingConflicts(state.cloudSyncSettings.pendingConflicts, customerMerge.conflicts),
          },
        }));

        logCloudSyncTestMode(get().cloudSyncSettings, "customers sync completed", summary);
        return summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : "顧客同期に失敗しました。";
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "error",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              customers: createEntityResult(
                "error",
                {
                  pulled: previousResults.customers.pulled,
                  pushed: previousResults.customers.pushed,
                  skipped: previousResults.customers.skipped,
                  syncedAt,
                },
                message,
              ),
            },
          },
        }));
        console.error("[Mitru cloud-sync] customers sync failed", message);
        throw error;
      }
    },
    syncEstimates: async (): Promise<ProjectSyncSummary> => {
      const settings = get().cloudSyncSettings;
      const lastEstimateSyncedAt = getEntityLastSyncedAt(settings, "estimates");
      const lastEstimateCursorId = getEntitySyncCursorId(settings, "estimates");
      const syncedAt = new Date().toISOString();
      const previousResults = settings.lastSyncResults;
      logCloudSyncTestMode(settings, "estimates sync started", {
        enabled: settings.isEnabled,
        lastSyncedAt: lastEstimateSyncedAt || null,
        cursorId: lastEstimateCursorId || null,
        localCount: get().estimateDocuments.length,
      });

      try {
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "syncing",
          },
        }));
        if (!settings.isEnabled) {
          throw new Error("クラウド同期が無効です。設定画面で有効にしてください。");
        }
        if (!settings.supabaseUrl.trim() || !settings.supabaseAnonKey.trim()) {
          throw new Error("Supabase Project URL と Anon Key を入力してください。");
        }
        if (settings.authState !== "authenticated" || !settings.user) {
          throw new Error("見積書同期にはSupabaseアカウントでログインしてください。");
        }

        const localEstimates = get().estimateDocuments;
        const result = await syncEstimatesWithCloud({
          config: {
            supabaseUrl: settings.supabaseUrl,
            supabaseAnonKey: settings.supabaseAnonKey,
          },
          localEstimates,
          lastSyncedAt: lastEstimateSyncedAt,
          lastSyncCursorId: lastEstimateCursorId,
          currentUserId: settings.user.id,
        });

        const estimateMerge = mergeEstimatesForSync(
          get().estimateDocuments,
          result.pulledEstimates,
          result.pushedMetadataByEstimateId,
          lastEstimateSyncedAt,
        );
        const mergedEstimates = estimateMerge.records;
        const summary = {
          pulled: result.pulledEstimates.length,
          pushed: result.pushedCount,
          skipped: Math.max(localEstimates.length - result.pushedCount, 0) + estimateMerge.conflicts.length,
          syncedAt: result.syncCursor?.updatedAt ?? lastEstimateSyncedAt,
          syncCursorId: result.syncCursor?.id ?? lastEstimateCursorId ?? null,
        };
        const estimateResult = createEntityResult(
          "success",
          summary,
          estimateMerge.conflicts.length > 0
            ? `見積書同期が完了しました。競合 ${estimateMerge.conflicts.length}件は自動上書きせず保留しました。`
            : "見積書同期が完了しました。",
        );

        set((state) => ({
          estimateDocuments: mergedEstimates,
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            isConnected: true,
            lastSyncAt: syncedAt,
            lastEstimatesSyncedAt: summary.syncedAt,
            lastEstimatesSyncCursorId: summary.syncCursorId ?? "",
            syncStatus: "success",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              estimates: estimateResult,
            },
            pendingConflicts: mergePendingConflicts(state.cloudSyncSettings.pendingConflicts, estimateMerge.conflicts),
          },
        }));

        logCloudSyncTestMode(get().cloudSyncSettings, "estimates sync completed", summary);
        return summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : "見積書同期に失敗しました。";
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "error",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              estimates: createEntityResult(
                "error",
                {
                  pulled: previousResults.estimates.pulled,
                  pushed: previousResults.estimates.pushed,
                  skipped: previousResults.estimates.skipped,
                  syncedAt,
                },
                message,
              ),
            },
          },
        }));
        console.error("[Mitru cloud-sync] estimates sync failed", message);
        throw error;
      }
    },
    syncInvoices: async (): Promise<ProjectSyncSummary> => {
      const settings = get().cloudSyncSettings;
      const lastInvoiceSyncedAt = getEntityLastSyncedAt(settings, "invoices");
      const lastInvoiceCursorId = getEntitySyncCursorId(settings, "invoices");
      const syncedAt = new Date().toISOString();
      const previousResults = settings.lastSyncResults;
      logCloudSyncTestMode(settings, "invoices sync started", {
        enabled: settings.isEnabled,
        lastSyncedAt: lastInvoiceSyncedAt || null,
        cursorId: lastInvoiceCursorId || null,
        localCount: get().invoiceDocuments.length,
      });

      try {
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "syncing",
          },
        }));
        if (!settings.isEnabled) {
          throw new Error("クラウド同期が無効です。設定画面で有効にしてください。");
        }
        if (!settings.supabaseUrl.trim() || !settings.supabaseAnonKey.trim()) {
          throw new Error("Supabase Project URL と Anon Key を入力してください。");
        }
        if (settings.authState !== "authenticated" || !settings.user) {
          throw new Error("請求書同期にはSupabaseアカウントでログインしてください。");
        }

        const localInvoices = get().invoiceDocuments;
        const result = await syncInvoicesWithCloud({
          config: {
            supabaseUrl: settings.supabaseUrl,
            supabaseAnonKey: settings.supabaseAnonKey,
          },
          localInvoices,
          lastSyncedAt: lastInvoiceSyncedAt,
          lastSyncCursorId: lastInvoiceCursorId,
          currentUserId: settings.user.id,
        });

        const invoiceMerge = mergeInvoicesForSync(
          get().invoiceDocuments,
          result.pulledInvoices,
          result.pushedMetadataByInvoiceId,
          lastInvoiceSyncedAt,
        );
        const mergedInvoices = invoiceMerge.records;
        const summary = {
          pulled: result.pulledInvoices.length,
          pushed: result.pushedCount,
          skipped: Math.max(localInvoices.length - result.pushedCount, 0) + invoiceMerge.conflicts.length,
          syncedAt: result.syncCursor?.updatedAt ?? lastInvoiceSyncedAt,
          syncCursorId: result.syncCursor?.id ?? lastInvoiceCursorId ?? null,
        };
        const invoiceResult = createEntityResult(
          "success",
          summary,
          invoiceMerge.conflicts.length > 0
            ? `請求書同期が完了しました。競合 ${invoiceMerge.conflicts.length}件は自動上書きせず保留しました。`
            : "請求書同期が完了しました。",
        );

        set((state) => ({
          invoiceDocuments: mergedInvoices,
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            isConnected: true,
            lastSyncAt: syncedAt,
            lastInvoicesSyncedAt: summary.syncedAt,
            lastInvoicesSyncCursorId: summary.syncCursorId ?? "",
            syncStatus: "success",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              invoices: invoiceResult,
            },
            pendingConflicts: mergePendingConflicts(state.cloudSyncSettings.pendingConflicts, invoiceMerge.conflicts),
          },
        }));

        logCloudSyncTestMode(get().cloudSyncSettings, "invoices sync completed", summary);
        return summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : "請求書同期に失敗しました。";
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "error",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              invoices: createEntityResult(
                "error",
                {
                  pulled: previousResults.invoices.pulled,
                  pushed: previousResults.invoices.pushed,
                  skipped: previousResults.invoices.skipped,
                  syncedAt,
                },
                message,
              ),
            },
          },
        }));
        console.error("[Mitru cloud-sync] invoices sync failed", message);
        throw error;
      }
    },
    syncPayments: async (): Promise<ProjectSyncSummary> => {
      const settings = get().cloudSyncSettings;
      const lastPaymentSyncedAt = getEntityLastSyncedAt(settings, "payments");
      const lastPaymentCursorId = getEntitySyncCursorId(settings, "payments");
      const syncedAt = new Date().toISOString();
      const previousResults = settings.lastSyncResults;
      logCloudSyncTestMode(settings, "payments sync started", {
        enabled: settings.isEnabled,
        lastSyncedAt: lastPaymentSyncedAt || null,
        cursorId: lastPaymentCursorId || null,
        localCount: collectInvoicePayments(get().invoiceDocuments).length,
      });

      try {
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "syncing",
          },
        }));
        if (!settings.isEnabled) {
          throw new Error("クラウド同期が無効です。設定画面で有効にしてください。");
        }
        if (!settings.supabaseUrl.trim() || !settings.supabaseAnonKey.trim()) {
          throw new Error("Supabase Project URL と Anon Key を入力してください。");
        }
        if (settings.authState !== "authenticated" || !settings.user) {
          throw new Error("入金記録同期にはSupabaseアカウントでログインしてください。");
        }

        const syncedInvoiceIds = new Set(
          get()
            .invoiceDocuments.filter((invoice) => invoice.syncMetadata?.serverId || invoice.syncMetadata?.lastSyncedAt)
            .map((invoice) => invoice.id),
        );
        const allLocalPayments = collectInvoicePayments(get().invoiceDocuments);
        const localPayments = allLocalPayments.filter((payment) => syncedInvoiceIds.has(payment.invoiceId));

        if (allLocalPayments.length > 0 && syncedInvoiceIds.size === 0) {
          throw new Error("入金記録同期には、先に請求書同期を完了してください。");
        }

        const result = await syncPaymentsWithCloud({
          config: {
            supabaseUrl: settings.supabaseUrl,
            supabaseAnonKey: settings.supabaseAnonKey,
          },
          localPayments,
          lastSyncedAt: lastPaymentSyncedAt,
          lastSyncCursorId: lastPaymentCursorId,
          currentUserId: settings.user.id,
        });
        const pulledPaymentsForSyncedInvoices = result.pulledPayments.filter((payment) =>
          syncedInvoiceIds.has(payment.invoiceId),
        );

        const paymentMerge = mergePaymentsIntoInvoices(
          get().invoiceDocuments,
          pulledPaymentsForSyncedInvoices,
          result.pushedMetadataByPaymentId,
          lastPaymentSyncedAt,
        );
        const mergedInvoices = paymentMerge.records;
        const summary = {
          pulled: pulledPaymentsForSyncedInvoices.length,
          pushed: result.pushedCount,
          skipped: Math.max(allLocalPayments.length - result.pushedCount, 0) + paymentMerge.conflicts.length,
          syncedAt: result.syncCursor?.updatedAt ?? lastPaymentSyncedAt,
          syncCursorId: result.syncCursor?.id ?? lastPaymentCursorId ?? null,
        };
        const paymentResult = createEntityResult(
          "success",
          summary,
          paymentMerge.conflicts.length > 0
            ? `入金記録同期が完了しました。競合 ${paymentMerge.conflicts.length}件は自動上書きせず保留しました。`
            : "入金記録同期が完了しました。",
        );

        set((state) => ({
          invoiceDocuments: mergedInvoices,
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            isConnected: true,
            lastSyncAt: syncedAt,
            lastPaymentsSyncedAt: summary.syncedAt,
            lastPaymentsSyncCursorId: summary.syncCursorId ?? "",
            syncStatus: "success",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              payments: paymentResult,
            },
            pendingConflicts: mergePendingConflicts(state.cloudSyncSettings.pendingConflicts, paymentMerge.conflicts),
          },
        }));

        logCloudSyncTestMode(get().cloudSyncSettings, "payments sync completed", summary);
        return summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : "入金記録同期に失敗しました。";
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "error",
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              payments: createEntityResult(
                "error",
                {
                  pulled: previousResults.payments.pulled,
                  pushed: previousResults.payments.pushed,
                  skipped: previousResults.payments.skipped,
                  syncedAt,
                },
                message,
              ),
            },
          },
        }));
        console.error("[Mitru cloud-sync] payments sync failed", message);
        throw error;
      }
    },
    resolveCloudSyncConflict: (conflictId: string, resolution: CloudSyncConflictResolution) => {
      const conflict = get().cloudSyncSettings.pendingConflicts.find((item) => item.id === conflictId);
      if (!conflict) return;
      const resolvedAt = new Date().toISOString();
      set((state) => {
        const cloudSyncSettings = {
          ...state.cloudSyncSettings,
          pendingConflicts: state.cloudSyncSettings.pendingConflicts.filter((item) => item.id !== conflictId),
        };
        if (resolution === "local") {
          return applyLocalConflictResolution(state, cloudSyncSettings, conflict, resolvedAt);
        }
        return applyCloudConflictResolution(state, cloudSyncSettings, conflict);
      });
    },
    resolveAllCloudSyncConflicts: (resolution: CloudSyncConflictResolution) => {
      const conflicts = get().cloudSyncSettings.pendingConflicts;
      if (conflicts.length === 0) return;
      const resolvedAt = new Date().toISOString();
      set((state) => {
        let nextState: ProjectStore = {
          ...state,
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            pendingConflicts: [],
          },
        };

        for (const conflict of conflicts) {
          const patch =
            resolution === "local"
              ? applyLocalConflictResolution(nextState, nextState.cloudSyncSettings, conflict, resolvedAt)
              : applyCloudConflictResolution(nextState, nextState.cloudSyncSettings, conflict);
          nextState = {
            ...nextState,
            ...patch,
            cloudSyncSettings: patch.cloudSyncSettings ?? nextState.cloudSyncSettings,
          };
        }

        return {
          cloudSyncSettings: nextState.cloudSyncSettings,
          projects: nextState.projects,
          customers: nextState.customers,
          estimateDocuments: nextState.estimateDocuments,
          invoiceDocuments: nextState.invoiceDocuments,
        };
      });
    },
    syncAll: async (): Promise<CloudSyncResults> => {
      const startedAt = new Date().toISOString();
      logCloudSyncTestMode(get().cloudSyncSettings, "all sync started", {
        startedAt,
        entityLastSyncedAt: getEntitySyncBaselines(get().cloudSyncSettings),
      });
      const setProgress = (currentStep: number, label: string, isSyncing = true) => {
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncProgress: {
              isSyncing,
              currentStep,
              totalSteps: 5,
              label,
              startedAt,
            },
          },
        }));
      };

      try {
        setProgress(0, "同期を準備しています");
        setProgress(1, "案件を同期しています");
        const projectSummary = await get().syncProjects();
        const projectResult = createEntityResult("success", projectSummary, "案件同期が完了しました。");
        let customerResult: CloudSyncEntityResult;
        let estimateResult: CloudSyncEntityResult;
        let invoiceResult: CloudSyncEntityResult;
        let paymentResult: CloudSyncEntityResult;
        let hasCustomerError = false;
        let hasEstimateError = false;
        let hasInvoiceError = false;
        let hasPaymentError = false;
        try {
          setProgress(2, "顧客を同期しています");
          const customerSummary = await get().syncCustomers();
          customerResult = createEntityResult("success", customerSummary, "顧客同期が完了しました。");
        } catch (error) {
          hasCustomerError = true;
          const message = error instanceof Error ? error.message : "顧客同期に失敗しました。";
          customerResult = createEntityResult(
            "error",
            { pulled: 0, pushed: 0, skipped: get().customers.length, syncedAt: new Date().toISOString() },
            message,
          );
        }
        try {
          setProgress(3, "見積書を同期しています");
          const estimateSummary = await get().syncEstimates();
          estimateResult = createEntityResult("success", estimateSummary, "見積書同期が完了しました。");
        } catch (error) {
          hasEstimateError = true;
          const message = error instanceof Error ? error.message : "見積書同期に失敗しました。";
          estimateResult = createEntityResult(
            "error",
            { pulled: 0, pushed: 0, skipped: get().estimateDocuments.length, syncedAt: new Date().toISOString() },
            message,
          );
        }
        try {
          setProgress(4, "請求書を同期しています");
          const invoiceSummary = await get().syncInvoices();
          invoiceResult = createEntityResult("success", invoiceSummary, "請求書同期が完了しました。");
        } catch (error) {
          hasInvoiceError = true;
          const message = error instanceof Error ? error.message : "請求書同期に失敗しました。";
          invoiceResult = createEntityResult(
            "error",
            { pulled: 0, pushed: 0, skipped: get().invoiceDocuments.length, syncedAt: new Date().toISOString() },
            message,
          );
        }
        if (hasInvoiceError) {
          paymentResult = createEntityResult(
            "skipped",
            { pulled: 0, pushed: 0, skipped: collectInvoicePayments(get().invoiceDocuments).length, syncedAt: new Date().toISOString() },
            "請求書同期が失敗したため、入金記録同期は実行していません。",
          );
        } else {
          try {
            setProgress(5, "入金記録を同期しています");
            const paymentSummary = await get().syncPayments();
            paymentResult = createEntityResult("success", paymentSummary, "入金記録同期が完了しました。");
          } catch (error) {
            hasPaymentError = true;
            const message = error instanceof Error ? error.message : "入金記録同期に失敗しました。";
            paymentResult = createEntityResult(
              "error",
              { pulled: 0, pushed: 0, skipped: collectInvoicePayments(get().invoiceDocuments).length, syncedAt: new Date().toISOString() },
              message,
            );
          }
        }

        const results: CloudSyncResults = {
          projects: projectResult,
          customers: customerResult,
          estimates: estimateResult,
          invoices: invoiceResult,
          payments: paymentResult,
        };

        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: hasCustomerError || hasEstimateError || hasInvoiceError || hasPaymentError ? "error" : "success",
            syncProgress: {
              isSyncing: false,
              currentStep: 5,
              totalSteps: 5,
              label: "同期が完了しました",
              startedAt,
            },
            lastSyncResults: results,
          },
        }));
        logCloudSyncTestMode(get().cloudSyncSettings, "all sync completed", {
          results,
          entityLastSyncedAt: getEntitySyncBaselines(get().cloudSyncSettings),
        });
        return results;
      } catch (error) {
        const message = error instanceof Error ? error.message : "全データ同期に失敗しました。";
        set((state) => ({
          cloudSyncSettings: {
            ...state.cloudSyncSettings,
            syncStatus: "error",
            syncProgress: {
              isSyncing: false,
              currentStep: Math.min(state.cloudSyncSettings.syncProgress.currentStep, 5),
              totalSteps: 5,
              label: "同期に失敗しました",
              startedAt,
            },
            lastSyncResults: {
              ...state.cloudSyncSettings.lastSyncResults,
              customers: {
                ...state.cloudSyncSettings.lastSyncResults.customers,
                status: "skipped",
                message: "案件同期が失敗したため、顧客同期は実行していません。",
              },
              estimates: {
                ...state.cloudSyncSettings.lastSyncResults.estimates,
                status: "skipped",
                message: "案件同期が失敗したため、見積書同期は実行していません。",
              },
              invoices: {
                ...state.cloudSyncSettings.lastSyncResults.invoices,
                status: "skipped",
                message: "案件同期が失敗したため、請求書同期は実行していません。",
              },
              payments: {
                ...state.cloudSyncSettings.lastSyncResults.payments,
                status: "skipped",
                message: "案件同期が失敗したため、入金記録同期は実行していません。",
              },
            },
          },
        }));
        console.error("[Mitru cloud-sync] all sync failed", message);
        throw error;
      }
    },
  };
}

function createEntityResult(
  status: CloudSyncEntityResult["status"],
  summary: ProjectSyncSummary,
  message: string,
): CloudSyncEntityResult {
  return {
    status,
    pulled: summary.pulled,
    pushed: summary.pushed,
    skipped: summary.skipped,
    message,
    syncedAt: summary.syncedAt,
    syncCursorId: summary.syncCursorId ?? null,
  };
}

function logCloudSyncTestMode(settings: CloudSyncSettings, event: string, details: unknown) {
  if (!settings.isTestMode) return;
  console.info(`[Mitru cloud-sync test] ${event}`, details);
}

type CloudSyncEntityKey = keyof CloudSyncResults;

const entitySyncedAtFields: Record<
  CloudSyncEntityKey,
  keyof Pick<
    CloudSyncSettings,
    | "lastProjectsSyncedAt"
    | "lastCustomersSyncedAt"
    | "lastEstimatesSyncedAt"
    | "lastInvoicesSyncedAt"
    | "lastPaymentsSyncedAt"
  >
> = {
  projects: "lastProjectsSyncedAt",
  customers: "lastCustomersSyncedAt",
  estimates: "lastEstimatesSyncedAt",
  invoices: "lastInvoicesSyncedAt",
  payments: "lastPaymentsSyncedAt",
};

const entityCursorIdFields: Record<
  CloudSyncEntityKey,
  keyof Pick<
    CloudSyncSettings,
    | "lastProjectsSyncCursorId"
    | "lastCustomersSyncCursorId"
    | "lastEstimatesSyncCursorId"
    | "lastInvoicesSyncCursorId"
    | "lastPaymentsSyncCursorId"
  >
> = {
  projects: "lastProjectsSyncCursorId",
  customers: "lastCustomersSyncCursorId",
  estimates: "lastEstimatesSyncCursorId",
  invoices: "lastInvoicesSyncCursorId",
  payments: "lastPaymentsSyncCursorId",
};

function getEntityLastSyncedAt(settings: CloudSyncSettings, entity: CloudSyncEntityKey) {
  const timestamp = settings[entitySyncedAtFields[entity]];
  if (timestamp) return timestamp;
  const result = settings.lastSyncResults[entity];
  return result.status === "success" ? result.syncedAt ?? "" : "";
}

function getEntitySyncCursorId(settings: CloudSyncSettings, entity: CloudSyncEntityKey) {
  const cursorId = settings[entityCursorIdFields[entity]];
  if (cursorId) return cursorId;
  const result = settings.lastSyncResults[entity];
  return result.status === "success" ? result.syncCursorId ?? "" : "";
}

function getEntitySyncBaselines(settings: CloudSyncSettings): Record<CloudSyncEntityKey, { updatedAt: string | null; id: string | null }> {
  return {
    projects: getEntitySyncBaseline(settings, "projects"),
    customers: getEntitySyncBaseline(settings, "customers"),
    estimates: getEntitySyncBaseline(settings, "estimates"),
    invoices: getEntitySyncBaseline(settings, "invoices"),
    payments: getEntitySyncBaseline(settings, "payments"),
  };
}

function getEntitySyncBaseline(settings: CloudSyncSettings, entity: CloudSyncEntityKey) {
  return {
    updatedAt: getEntityLastSyncedAt(settings, entity) || null,
    id: getEntitySyncCursorId(settings, entity) || null,
  };
}

function applyLocalConflictResolution(
  state: ProjectStore,
  cloudSyncSettings: CloudSyncSettings,
  conflict: CloudSyncConflict,
  resolvedAt: string,
): Partial<ProjectStore> {
  if (conflict.entityType === "projects") {
    return {
      cloudSyncSettings,
      projects: state.projects.map((project) =>
        project.id === conflict.entityId ? { ...project, updatedAt: resolvedAt } : project,
      ),
    };
  }
  if (conflict.entityType === "customers") {
    return {
      cloudSyncSettings,
      customers: state.customers.map((customer) =>
        customer.id === conflict.entityId ? { ...customer, updatedAt: resolvedAt } : customer,
      ),
    };
  }
  if (conflict.entityType === "estimates") {
    return {
      cloudSyncSettings,
      estimateDocuments: state.estimateDocuments.map((estimate) =>
        estimate.id === conflict.entityId ? { ...estimate, updatedAt: resolvedAt } : estimate,
      ),
    };
  }
  if (conflict.entityType === "invoices") {
    return {
      cloudSyncSettings,
      invoiceDocuments: state.invoiceDocuments.map((invoice) =>
        invoice.id === conflict.entityId ? { ...invoice, updatedAt: resolvedAt } : invoice,
      ),
    };
  }
  if (conflict.entityType === "payments") {
    return {
      cloudSyncSettings,
      invoiceDocuments: state.invoiceDocuments.map((invoice) => {
        const paymentRecords = Array.isArray(invoice.paymentRecords) ? invoice.paymentRecords : [];
        if (!paymentRecords.some((payment) => payment.id === conflict.entityId)) return invoice;
        return withUpdatedPayments(
          { ...invoice, updatedAt: resolvedAt },
          paymentRecords.map((payment) =>
            payment.id === conflict.entityId
              ? { ...payment, updatedAt: resolvedAt }
              : payment,
          ),
        );
      }),
    };
  }
  return { cloudSyncSettings };
}

function applyCloudConflictResolution(
  state: ProjectStore,
  cloudSyncSettings: CloudSyncSettings,
  conflict: CloudSyncConflict,
): Partial<ProjectStore> {
  if (conflict.entityType === "projects" && isProject(conflict.cloudRecord)) {
    return {
      cloudSyncSettings,
      projects: replaceById(state.projects, conflict.cloudRecord),
    };
  }
  if (conflict.entityType === "customers" && isCustomer(conflict.cloudRecord)) {
    return {
      cloudSyncSettings,
      customers: replaceById(state.customers, conflict.cloudRecord),
    };
  }
  if (conflict.entityType === "estimates" && isEstimateDocument(conflict.cloudRecord)) {
    return {
      cloudSyncSettings,
      estimateDocuments: replaceById(state.estimateDocuments, conflict.cloudRecord),
    };
  }
  if (conflict.entityType === "invoices" && isInvoiceDocument(conflict.cloudRecord)) {
    return {
      cloudSyncSettings,
      invoiceDocuments: replaceById(state.invoiceDocuments, conflict.cloudRecord),
    };
  }
  if (conflict.entityType === "payments" && isPaymentRecord(conflict.cloudRecord)) {
    const cloudPayment = conflict.cloudRecord;
    return {
      cloudSyncSettings,
      invoiceDocuments: state.invoiceDocuments.map((invoice) => {
        if (invoice.id !== cloudPayment.invoiceId) return invoice;
        const paymentRecords = Array.isArray(invoice.paymentRecords) ? invoice.paymentRecords : [];
        const paymentsById = new Map(paymentRecords.map((payment) => [payment.id, payment]));
        paymentsById.set(cloudPayment.id, cloudPayment);
        return withUpdatedPayments(invoice, Array.from(paymentsById.values()));
      }),
    };
  }
  return { cloudSyncSettings };
}

function replaceById<TRecord extends { id: string }>(records: TRecord[], nextRecord: TRecord) {
  const hasRecord = records.some((record) => record.id === nextRecord.id);
  if (!hasRecord) return [...records, nextRecord];
  return records.map((record) => (record.id === nextRecord.id ? nextRecord : record));
}

function isProject(value: unknown): value is Project {
  return isRecordWithId(value) && typeof value.name === "string" && typeof value.updatedAt === "string";
}

function isCustomer(value: unknown): value is Customer {
  return isRecordWithId(value) && typeof value.updatedAt === "string" && typeof value.type === "string";
}

function isEstimateDocument(value: unknown): value is EstimateDocument {
  return isRecordWithId(value) && typeof value.projectId === "string" && typeof value.updatedAt === "string";
}

function isInvoiceDocument(value: unknown): value is InvoiceDocument {
  return isRecordWithId(value) && typeof value.projectId === "string" && typeof value.updatedAt === "string";
}

function isPaymentRecord(value: unknown): value is PaymentRecord {
  return isRecordWithId(value) && typeof value.invoiceId === "string" && typeof value.createdAt === "string";
}

function isRecordWithId(value: unknown): value is Record<string, unknown> & { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string");
}

function mergeProjectsForSync(
  localProjects: Project[],
  pulledProjects: Project[],
  pushedMetadataByProjectId: Record<string, SyncMetadata>,
  lastSyncedAt: string,
) {
  const projectsById = new Map(localProjects.map((project) => [project.id, project]));
  const conflicts: CloudSyncConflict[] = [];

  for (const cloudProject of pulledProjects) {
    const localProject = projectsById.get(cloudProject.id);
    if (localProject && isRecordSyncConflict(localProject, cloudProject, lastSyncedAt)) {
      conflicts.push(createCloudSyncConflict("projects", "案件", localProject, cloudProject, getProjectTitle(localProject)));
      continue;
    }
    if (!localProject || isCloudProjectNewer(localProject, cloudProject)) {
      projectsById.set(cloudProject.id, cloudProject);
    }
  }

  const records = Array.from(projectsById.values()).map((project) => {
    const pushedMetadata = pushedMetadataByProjectId[project.id];
    if (!pushedMetadata) return project;

    return {
      ...project,
      syncMetadata: {
        ...pushedMetadata,
        version: (project.syncMetadata?.version ?? 0) + 1,
      },
    };
  });
  return { records, conflicts };
}

function mergeCustomersForSync(
  localCustomers: Customer[],
  pulledCustomers: Customer[],
  pushedMetadataByCustomerId: Record<string, SyncMetadata>,
  lastSyncedAt: string,
) {
  const customersById = new Map(localCustomers.map((customer) => [customer.id, customer]));
  const conflicts: CloudSyncConflict[] = [];

  for (const cloudCustomer of pulledCustomers) {
    const localCustomer = customersById.get(cloudCustomer.id);
    if (localCustomer && isRecordSyncConflict(localCustomer, cloudCustomer, lastSyncedAt)) {
      conflicts.push(createCloudSyncConflict("customers", "顧客", localCustomer, cloudCustomer, getCustomerTitle(localCustomer)));
      continue;
    }
    if (!localCustomer || isCloudCustomerNewer(localCustomer, cloudCustomer)) {
      customersById.set(cloudCustomer.id, cloudCustomer);
    }
  }

  const records = Array.from(customersById.values()).map((customer) => {
    const pushedMetadata = pushedMetadataByCustomerId[customer.id];
    if (!pushedMetadata) return customer;

    return {
      ...customer,
      syncMetadata: {
        ...pushedMetadata,
        version: (customer.syncMetadata?.version ?? 0) + 1,
      },
    };
  });
  return { records, conflicts };
}

function mergeEstimatesForSync(
  localEstimates: EstimateDocument[],
  pulledEstimates: EstimateDocument[],
  pushedMetadataByEstimateId: Record<string, SyncMetadata>,
  lastSyncedAt: string,
) {
  const estimatesById = new Map(localEstimates.map((estimate) => [estimate.id, estimate]));
  const conflicts: CloudSyncConflict[] = [];

  for (const cloudEstimate of pulledEstimates) {
    const localEstimate = estimatesById.get(cloudEstimate.id);
    if (localEstimate && isRecordSyncConflict(localEstimate, cloudEstimate, lastSyncedAt)) {
      conflicts.push(createCloudSyncConflict("estimates", "見積書", localEstimate, cloudEstimate, getEstimateTitle(localEstimate)));
      continue;
    }
    if (!localEstimate || isCloudEstimateNewer(localEstimate, cloudEstimate)) {
      estimatesById.set(cloudEstimate.id, cloudEstimate);
    }
  }

  const records = Array.from(estimatesById.values()).map((estimate) => {
    const pushedMetadata = pushedMetadataByEstimateId[estimate.id];
    if (!pushedMetadata) return estimate;

    return {
      ...estimate,
      syncMetadata: {
        ...pushedMetadata,
        version: (estimate.syncMetadata?.version ?? 0) + 1,
      },
    };
  });
  return { records, conflicts };
}

function mergeInvoicesForSync(
  localInvoices: InvoiceDocument[],
  pulledInvoices: InvoiceDocument[],
  pushedMetadataByInvoiceId: Record<string, SyncMetadata>,
  lastSyncedAt: string,
) {
  const invoicesById = new Map(localInvoices.map((invoice) => [invoice.id, invoice]));
  const conflicts: CloudSyncConflict[] = [];

  for (const cloudInvoice of pulledInvoices) {
    const localInvoice = invoicesById.get(cloudInvoice.id);
    if (localInvoice && isRecordSyncConflict(localInvoice, cloudInvoice, lastSyncedAt)) {
      conflicts.push(createCloudSyncConflict("invoices", "請求書", localInvoice, cloudInvoice, getInvoiceTitle(localInvoice)));
      continue;
    }
    if (!localInvoice || isCloudInvoiceNewer(localInvoice, cloudInvoice)) {
      invoicesById.set(cloudInvoice.id, cloudInvoice);
    }
  }

  const records = Array.from(invoicesById.values()).map((invoice) => {
    const pushedMetadata = pushedMetadataByInvoiceId[invoice.id];
    if (!pushedMetadata) return invoice;

    return {
      ...invoice,
      syncMetadata: {
        ...pushedMetadata,
        version: (invoice.syncMetadata?.version ?? 0) + 1,
      },
    };
  });
  return { records, conflicts };
}

function mergePaymentsIntoInvoices(
  localInvoices: InvoiceDocument[],
  pulledPayments: PaymentRecord[],
  pushedMetadataByPaymentId: Record<string, SyncMetadata>,
  lastSyncedAt: string,
) {
  const invoicesById = new Map(localInvoices.map((invoice) => [invoice.id, invoice]));
  const conflicts: CloudSyncConflict[] = [];

  for (const cloudPayment of pulledPayments) {
    const invoice = invoicesById.get(cloudPayment.invoiceId);
    if (!invoice) continue;
    const paymentRecords = Array.isArray(invoice.paymentRecords) ? invoice.paymentRecords : [];
    const paymentsById = new Map(paymentRecords.map((payment) => [payment.id, payment]));
    const localPayment = paymentsById.get(cloudPayment.id);
    if (
      localPayment &&
      isRecordSyncConflict(localPayment, cloudPayment, lastSyncedAt)
    ) {
      conflicts.push(createCloudSyncConflict("payments", "入金記録", localPayment, cloudPayment, getPaymentTitle(localPayment)));
      continue;
    }
    if (!localPayment || isCloudPaymentNewer(localPayment, cloudPayment)) {
      paymentsById.set(cloudPayment.id, cloudPayment);
    }
    invoicesById.set(invoice.id, withUpdatedPayments(invoice, Array.from(paymentsById.values())));
  }

  const records = Array.from(invoicesById.values()).map((invoice) => {
    const paymentRecords = Array.isArray(invoice.paymentRecords) ? invoice.paymentRecords : [];
    let hasPushedPayment = false;
    const nextPaymentRecords = paymentRecords.map((payment) => {
      const pushedMetadata = pushedMetadataByPaymentId[payment.id];
      if (!pushedMetadata) return payment;
      hasPushedPayment = true;
      return {
        ...payment,
        syncMetadata: {
          ...pushedMetadata,
          version: (payment.syncMetadata?.version ?? 0) + 1,
        },
      };
    });
    return hasPushedPayment ? withUpdatedPayments(invoice, nextPaymentRecords) : invoice;
  });
  return { records, conflicts };
}

function collectInvoicePayments(invoices: InvoiceDocument[]) {
  return invoices.flatMap((invoice) =>
    Array.isArray(invoice.paymentRecords)
      ? invoice.paymentRecords.map((payment) => ({
          ...payment,
          invoiceId: payment.invoiceId || invoice.id,
        }))
      : [],
  );
}

function withUpdatedPayments(invoice: InvoiceDocument, paymentRecords: PaymentRecord[]): InvoiceDocument {
  const activePaymentTotal = paymentRecords.reduce((sum, payment) => {
    return payment.deletedAt ? sum : sum + Number(payment.amount || 0);
  }, 0);
  return {
    ...invoice,
    paymentRecords,
    paidAmount: activePaymentTotal,
  };
}

function isSyncConflict(localUpdatedAt: string, cloudUpdatedAt: string, lastSyncedAt: string) {
  return isChangedAfterSync(localUpdatedAt, lastSyncedAt) && isChangedAfterSync(cloudUpdatedAt, lastSyncedAt);
}

function isRecordSyncConflict(
  localRecord: { updatedAt?: string; createdAt?: string; syncMetadata?: SyncMetadata },
  cloudRecord: { updatedAt?: string; createdAt?: string },
  lastSyncedAt: string,
) {
  const baseline = localRecord.syncMetadata?.lastSyncedAt || lastSyncedAt;
  const localDirty = Boolean(localRecord.syncMetadata && !localRecord.syncMetadata.lastSyncedAt);
  return (
    (localDirty || isChangedAfterSync(getRecordUpdatedAt(localRecord), baseline)) &&
    isChangedAfterSync(getRecordUpdatedAt(cloudRecord), baseline)
  );
}

function isChangedAfterSync(updatedAt: string, lastSyncedAt: string) {
  const updated = Date.parse(updatedAt || "");
  if (!Number.isFinite(updated)) return false;
  const synced = Date.parse(lastSyncedAt || "");
  if (!Number.isFinite(synced)) return true;
  return updated > synced;
}

function createCloudSyncConflict<TRecord extends { id: string; updatedAt?: string; createdAt?: string }>(
  entityType: CloudSyncConflict["entityType"],
  entityLabel: string,
  localRecord: TRecord,
  cloudRecord: TRecord,
  title: string,
): CloudSyncConflict {
  return {
    id: `${entityType}:${localRecord.id}`,
    entityType,
    entityLabel,
    entityId: localRecord.id,
    title,
    localUpdatedAt: getRecordUpdatedAt(localRecord),
    cloudUpdatedAt: getRecordUpdatedAt(cloudRecord),
    detectedAt: new Date().toISOString(),
    localRecord,
    cloudRecord,
  };
}

function getRecordUpdatedAt(record: { updatedAt?: string; createdAt?: string }) {
  return record.updatedAt || record.createdAt || "";
}

function mergePendingConflicts(current: CloudSyncConflict[] = [], incoming: CloudSyncConflict[] = []) {
  const conflictsById = new Map(current.map((conflict) => [conflict.id, conflict]));
  for (const conflict of incoming) {
    conflictsById.set(conflict.id, conflict);
  }
  return Array.from(conflictsById.values()).slice(0, 30);
}

function getProjectTitle(project: Project) {
  return project.projectNumber ? `${project.projectNumber} ${project.name}` : project.name;
}

function getCustomerTitle(customer: Customer) {
  return customer.companyName || customer.name || customer.id;
}

function getEstimateTitle(estimate: EstimateDocument) {
  return estimate.documentNumber || estimate.title || estimate.id;
}

function getInvoiceTitle(invoice: InvoiceDocument) {
  return invoice.documentNumber || invoice.id;
}

function getPaymentTitle(payment: PaymentRecord) {
  return `${payment.paymentDate || "入金日未設定"} ${Number(payment.amount || 0).toLocaleString("ja-JP")}円`;
}

function isCloudProjectNewer(localProject: Project, cloudProject: Project) {
  const localUpdatedAt = Date.parse(localProject.updatedAt || "");
  const cloudUpdatedAt = Date.parse(cloudProject.updatedAt || "");
  if (!Number.isFinite(localUpdatedAt)) return true;
  if (!Number.isFinite(cloudUpdatedAt)) return false;
  return cloudUpdatedAt >= localUpdatedAt;
}

function isCloudCustomerNewer(localCustomer: Customer, cloudCustomer: Customer) {
  const localUpdatedAt = Date.parse(localCustomer.updatedAt || "");
  const cloudUpdatedAt = Date.parse(cloudCustomer.updatedAt || "");
  if (!Number.isFinite(localUpdatedAt)) return true;
  if (!Number.isFinite(cloudUpdatedAt)) return false;
  return cloudUpdatedAt >= localUpdatedAt;
}

function isCloudEstimateNewer(localEstimate: EstimateDocument, cloudEstimate: EstimateDocument) {
  const localUpdatedAt = Date.parse(localEstimate.updatedAt || "");
  const cloudUpdatedAt = Date.parse(cloudEstimate.updatedAt || "");
  if (!Number.isFinite(localUpdatedAt)) return true;
  if (!Number.isFinite(cloudUpdatedAt)) return false;
  return cloudUpdatedAt >= localUpdatedAt;
}

function isCloudInvoiceNewer(localInvoice: InvoiceDocument, cloudInvoice: InvoiceDocument) {
  const localUpdatedAt = Date.parse(localInvoice.updatedAt || "");
  const cloudUpdatedAt = Date.parse(cloudInvoice.updatedAt || "");
  if (!Number.isFinite(localUpdatedAt)) return true;
  if (!Number.isFinite(cloudUpdatedAt)) return false;
  return cloudUpdatedAt >= localUpdatedAt;
}

function isCloudPaymentNewer(localPayment: PaymentRecord, cloudPayment: PaymentRecord) {
  const localSyncedAt = Date.parse(localPayment.syncMetadata?.lastSyncedAt || localPayment.updatedAt || localPayment.createdAt || "");
  const cloudSyncedAt = Date.parse(cloudPayment.syncMetadata?.lastSyncedAt || cloudPayment.updatedAt || cloudPayment.createdAt || "");
  if (!Number.isFinite(localSyncedAt)) return true;
  if (!Number.isFinite(cloudSyncedAt)) return false;
  return cloudSyncedAt >= localSyncedAt;
}
