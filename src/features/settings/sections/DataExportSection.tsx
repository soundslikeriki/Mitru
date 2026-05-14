import { useState } from "react";
import { motion } from "framer-motion";
import { DatabaseBackup, FileDown, FileText, RotateCcw, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportAllDocumentsPdf } from "@/features/documents";
import {
  downloadTextFile,
  projectsToCsv,
} from "@/features/settings/lib/settings-utils";
import { ToastMessage } from "@/features/shared/ToastMessage";
import { useProjectStore } from "@/stores/project-store";
import {
  defaultDocumentNumberSettings,
  defaultTaxSettings,
  initialCompanyInfo,
  initialPdfTemplateSettings,
} from "@/stores/defaults";
import { projectStoreVersion } from "@/stores/slices/persist";

export function DataExportSection() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const projectItems = useProjectStore((state) => state.projectItems);
  const workItemMasters = useProjectStore((state) => state.workItemMasters);
  const materialMasters = useProjectStore((state) => state.materialMasters);
  const costSettingsByProjectId = useProjectStore((state) => state.costSettingsByProjectId);
  const quoteSettingsByProjectId = useProjectStore((state) => state.quoteSettingsByProjectId);
  const invoiceSettingsByProjectId = useProjectStore((state) => state.invoiceSettingsByProjectId);
  const invoiceItemsByItemId = useProjectStore((state) => state.invoiceItemsByItemId);
  const sealSettingsByProjectId = useProjectStore((state) => state.sealSettingsByProjectId);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const companyInfo = useProjectStore((state) => state.companyInfo);
  const pdfTemplateSettings = useProjectStore((state) => state.pdfTemplateSettings);
  const taxSettings = useProjectStore((state) => state.taxSettings);
  const documentNumberSettings = useProjectStore((state) => state.documentNumberSettings);
  const exportBackupData = useProjectStore((state) => state.exportBackupData);
  const resetBusinessDataKeepingMasters = useProjectStore((state) => state.resetBusinessDataKeepingMasters);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  const notify = (title: string, description: string, tone: "success" | "error" = "success") => {
    setToast({ title, description, tone });
    window.setTimeout(() => setToast(null), 3600);
  };

  const exportProjectsCsv = async () => {
    setBusy(true);
    try {
      const csv = projectsToCsv(projects);
      const saved = await downloadTextFile(`mitru_projects_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
      if (saved) notify("CSVを出力しました", "全案件一覧を書き出しました。");
    } catch (error) {
      notify("CSV出力に失敗しました", error instanceof Error ? error.message : "不明なエラー", "error");
    } finally {
      setBusy(false);
    }
  };

  const exportPdfBundle = async () => {
    setBusy(true);
    try {
      const count = await exportAllDocumentsPdf({
        projects,
        projectItems,
        costSettingsByProjectId,
        quoteSettingsByProjectId,
        invoiceSettingsByProjectId,
        invoiceItemsByItemId,
        sealSettingsByProjectId,
        estimateDocuments,
        invoiceDocuments,
        companyInfo,
        templateSettings: pdfTemplateSettings,
        taxSettings,
      });
      notify("PDF一括出力が完了しました", `見積書・請求書 ${count} 件を1つのPDFにまとめました。`);
    } catch (error) {
      notify("PDF一括出力に失敗しました", error instanceof Error ? error.message : "不明なエラー", "error");
    } finally {
      setBusy(false);
    }
  };

  const exportBackupJson = async () => {
    setBusy(true);
    try {
      const backup = exportBackupData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const saved = await downloadTextFile(
        `mitru_backup_${timestamp}.json`,
        JSON.stringify(backup, null, 2),
        "application/json;charset=utf-8",
      );
      if (saved) notify("バックアップを出力しました", "全データをJSONファイルとして保存しました。");
    } catch (error) {
      notify("バックアップ出力に失敗しました", error instanceof Error ? error.message : "不明なエラー", "error");
    } finally {
      setBusy(false);
    }
  };

  const resetBusinessData = async () => {
    try {
      const backup = exportBackupData();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const resetAt = new Date().toISOString();
      await downloadTextFile(
        `mitru_reset_backup_${timestamp}.json`,
        JSON.stringify(backup, null, 2),
        "application/json;charset=utf-8",
      );
      resetBusinessDataKeepingMasters();
      localStorage.setItem(
        "mitru-local-store",
        JSON.stringify({
          state: {
            customers: [],
            projects: [],
            projectItems: [],
            workItemMasters,
            materialMasters,
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
            documentNumberSettings: defaultDocumentNumberSettings,
            lastBackupAt: resetAt,
          },
          version: projectStoreVersion,
        }),
      );
      localStorage.removeItem("mitru-onboarding-completed");
      localStorage.setItem("mitru-business-data-reset-at", resetAt);
      window.dispatchEvent(new Event("mitru-onboarding-open"));
      navigate("/settings", { replace: true });
      setResetOpen(false);
      notify(
        "案件データをリセットしました",
        "工事項目マスタと材料マスタは保持したまま、案件・顧客・書類データを削除しました。",
      );
    } catch (error) {
      notify("リセットに失敗しました", error instanceof Error ? error.message : "不明なエラー", "error");
    }
  };

  return (
    <motion.section
      className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">データ出力</h3>
        <p className="mt-1 text-sm text-slate-400">
          案件一覧と帳票PDFを書き出します。バックアップ/復元機能はここには表示しません。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">全案件をCSVで出力</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            案件名、顧客名、工事場所、契約金額、更新日などをCSVで書き出します。
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={exportProjectsCsv} disabled={busy}>
            <FileDown className="size-4" />
            全案件CSV出力
          </Button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">全データをJSONでバックアップ</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            案件、顧客、書類、マスタ、設定をまとめてJSON形式で保存します。
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={exportBackupJson} disabled={busy}>
            <DatabaseBackup className="size-4" />
            JSONバックアップ出力
          </Button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">見積書・請求書を一括でPDF出力</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            作成済みの見積書・請求書を1つのPDFファイルにまとめて出力します。
          </p>
          <Button className="mt-4 gap-2" onClick={exportPdfBundle} disabled={busy}>
            <FileText className="size-4" />
            {busy ? "出力中..." : "帳票PDF一括出力"}
          </Button>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-rose-300/40 bg-rose-500/10 p-4 dark:border-rose-400/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                案件データ・書類データをすべてリセット（マスタは保持）
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                案件、積算、見積書、請求書、納品書、注文書、顧客データを削除します。
                工事項目マスタと材料マスタだけを保持し、会社情報やロゴ・社判も空に戻します。
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-400/40 dark:text-rose-200 dark:hover:bg-rose-400/10"
            onClick={() => setResetOpen(true)}
            disabled={busy}
          >
            <RotateCcw className="size-4" />
            リセットを実行
          </Button>
        </div>
      </div>
      {busy && (
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-950/60">
          <motion.div
            className="h-full rounded-full bg-emerald-400"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
          />
        </div>
      )}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="border-white/10 bg-white text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>案件データ・書類データをリセットしますか？</DialogTitle>
            <DialogDescription className="leading-7 text-slate-600 dark:text-slate-400">
              工事項目マスタと材料マスタは保持されます。会社情報を含む他の全データが削除されます。よろしいですか？
              実行前に現在の全データをJSONで自動バックアップします。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            削除対象: 会社情報、ロゴ、社判、案件、積算データ、見積書、請求書、納品書、注文書、顧客データ、進行管理データ
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              キャンセル
            </Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={resetBusinessData}>
              バックアップしてリセット
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
  );
}
