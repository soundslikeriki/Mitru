import { type ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type DocumentNumberConfig,
  type DocumentNumberSettings,
  useProjectStore,
} from "@/stores/project-store";
import { ToastMessage, type ToastState } from "@/features/shared/ToastMessage";

export function DocumentNumberSettingsSection() {
  const settings = useProjectStore((state) => state.documentNumberSettings);
  const updateDocumentNumberSettings = useProjectStore((state) => state.updateDocumentNumberSettings);
  const [draft, setDraft] = useState<DocumentNumberSettings>(settings);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateDraft = (kind: "estimate" | "invoice", field: keyof DocumentNumberConfig, value: string | number) => {
    setDraft((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        [field]: value,
      },
    }));
  };

  const saveSettings = () => {
    updateDocumentNumberSettings({
      estimate: draft.estimate,
      invoice: draft.invoice,
    });
    setToast({
      title: "書類番号設定を更新しました",
      description: "新しく作成する見積書・請求書からこの番号ルールを適用します。",
    });
    window.setTimeout(() => setToast(null), 3600);
  };

  return (
    <motion.section
      className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="grid gap-4">
        <DocumentNumberCard
          title="見積書番号設定"
          description="新しい見積書を作成するときの番号ルールです。"
          value={draft.estimate}
          placeholder="MTL- / 見積- / EST-"
          onChange={(field, value) => updateDraft("estimate", field, value)}
        />
        <DocumentNumberCard
          title="請求書番号設定"
          description="新しい請求書を作成するときの番号ルールです。"
          value={draft.invoice}
          placeholder="INV- / 請求- / MTL-"
          onChange={(field, value) => updateDraft("invoice", field, value)}
        />
      </div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Document No.</p>
        <h3 className="mt-3 text-lg font-semibold text-white">次回作成番号</h3>
        <div className="mt-5 space-y-3 text-sm">
          <SummaryRow label="見積書" value={buildPreviewDocumentNumber(draft.estimate)} />
          <SummaryRow label="請求書" value={buildPreviewDocumentNumber(draft.invoice)} />
        </div>
        <Button className="mt-6 w-full gap-2" onClick={saveSettings}>
          <ShieldCheck className="size-4" />
          設定を保存
        </Button>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          既存の書類番号は変更せず、次に新規作成する書類から適用されます。
        </p>
      </aside>
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </motion.section>
  );
}

function DocumentNumberCard({
  title,
  description,
  value,
  placeholder,
  onChange,
}: {
  title: string;
  description: string;
  value: DocumentNumberConfig;
  placeholder: string;
  onChange: (field: keyof DocumentNumberConfig, value: string | number) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_160px]">
        <Field label="プレフィックス">
          <Input
            value={value.prefix}
            onChange={(event) => onChange("prefix", event.target.value)}
            placeholder={placeholder}
          />
        </Field>
        <Field label="次回番号">
          <Input
            type="number"
            min={1}
            value={value.nextNumber}
            onChange={(event) => onChange("nextNumber", Math.max(1, Number(event.target.value) || 1))}
          />
        </Field>
        <Field label="連番の桁数">
          <select
            value={value.digits}
            onChange={(event) => onChange("digits", Number(event.target.value) as DocumentNumberConfig["digits"])}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
          >
            {[4, 5, 6].map((digit) => (
              <option key={digit} value={digit} className="bg-white text-slate-800 dark:bg-slate-950 dark:text-white">
                {digit}桁
              </option>
            ))}
          </select>
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function buildPreviewDocumentNumber(config: DocumentNumberConfig) {
  const prefix = config.prefix || "";
  return `${prefix}${String(Math.max(1, Number(config.nextNumber) || 1)).padStart(config.digits, "0")}`;
}
