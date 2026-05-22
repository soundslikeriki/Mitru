import { useMemo, useState } from "react";
import { FilePlus2, Layers3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CalculationTemplate } from "@/stores/project-store";

type CalculationTemplateManagerProps = {
  templates: CalculationTemplate[];
  customerId?: string | null;
  itemsCount: number;
  onSave: (input: { name: string; customerId?: string | null }) => void;
  onApply: (templateId: string) => void;
};

export function CalculationTemplateManager({
  templates,
  customerId,
  itemsCount,
  onSave,
  onApply,
}: CalculationTemplateManagerProps) {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveForCustomer, setSaveForCustomer] = useState(false);
  const hasCustomer = Boolean(customerId);
  const commonTemplates = useMemo(
    () => templates.filter((template) => !template.customerId),
    [templates],
  );
  const customerTemplates = useMemo(
    () => templates.filter((template) => template.customerId && template.customerId === customerId),
    [customerId, templates],
  );

  const handleSave = () => {
    const name = templateName.trim() || `積算テンプレート ${new Date().toLocaleDateString("ja-JP")}`;
    onSave({ name, customerId: saveForCustomer && hasCustomer ? customerId : null });
    setTemplateName("");
    setSaveForCustomer(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/45">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">積算テンプレート</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            現在の積算を保存し、共通または顧客専用のテンプレートとして再利用できます。
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <Layers3 className="size-4" />
          テンプレート
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>積算テンプレート</DialogTitle>
            <DialogDescription>
              共通テンプレートと、この顧客だけで使うテンプレートを分けて管理できます。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                テンプレート名
                <Input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="例：クリニック内装 基本パターン"
                />
              </label>
              <Button className="gap-2" onClick={handleSave} disabled={itemsCount === 0}>
                <Save className="size-4" />
                現在の積算を保存
              </Button>
            </div>
            <label className={`flex items-center gap-2 text-sm ${hasCustomer ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
              <input
                type="checkbox"
                className="size-4 accent-emerald-500"
                checked={saveForCustomer && hasCustomer}
                disabled={!hasCustomer}
                onChange={(event) => setSaveForCustomer(event.target.checked)}
              />
              この顧客専用テンプレートとして保存
              {!hasCustomer && <span className="text-xs text-slate-400">（顧客未選択の案件では利用できません）</span>}
            </label>
          </div>

          <Tabs defaultValue="common" className="mt-4">
            <TabsList>
              <TabsTrigger value="common">共通テンプレート</TabsTrigger>
              <TabsTrigger value="customer" disabled={!hasCustomer}>
                この顧客のテンプレート
              </TabsTrigger>
            </TabsList>
            <TabsContent value="common" className="mt-4">
              <TemplateList
                templates={commonTemplates}
                emptyMessage="共通テンプレートはまだありません。"
                onApply={onApply}
              />
            </TabsContent>
            <TabsContent value="customer" className="mt-4">
              <TemplateList
                templates={customerTemplates}
                emptyMessage="この顧客専用のテンプレートはまだありません。"
                onApply={onApply}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplateList({
  templates,
  emptyMessage,
  onApply,
}: {
  templates: CalculationTemplate[];
  emptyMessage: string;
  onApply: (templateId: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {templates.map((template) => (
        <div
          key={template.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/50"
        >
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{template.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {template.items.length}行 / {new Date(template.updatedAt || template.createdAt).toLocaleDateString("ja-JP")}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => onApply(template.id)}>
            <FilePlus2 className="size-4" />
            読み込む
          </Button>
        </div>
      ))}
    </div>
  );
}
