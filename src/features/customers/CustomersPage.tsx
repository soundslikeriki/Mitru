import { type FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PlusCircle, ScanText } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BusinessCardDialog } from "@/features/customers/components/CustomerCard";
import { CustomerList } from "@/features/customers/components/CustomerList";
import { CustomerFormFields, Field } from "@/features/customers/components/CustomerForm";
import { useCustomers } from "@/features/customers/hooks/useCustomers";
import {
  blankCustomerInput,
  customerStatusOptions,
  customerTypeOptions,
  formatCustomerOptionLabel,
  getCustomerProjects,
  hasCustomerIdentity,
  normalizeCustomerInput,
  normalizeCustomerInputField,
  requiredFieldsMessage,
} from "@/features/customers/lib/customer-utils";
import { ToastMessage } from "@/features/shared/ToastMessage";
import {
  type Customer,
  type CustomerInput,
  type CustomerStatus,
  type CustomerType,
  useProjectStore,
} from "@/stores/project-store";
import { persistImageAssetReferences } from "@/lib/image-storage";

export function CustomersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    deleteCustomer,
    projects,
    query,
    rows,
    setQuery,
    setStatus,
    setType,
    status,
    type,
  } = useCustomers();
  const [createOpen, setCreateOpen] = useState(false);
  const [businessCardOpen, setBusinessCardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string; tone?: "success" | "error" } | null>(null);

  useEffect(() => {
    const state = location.state as { customerUpdated?: boolean; customerName?: string } | null;
    if (!state?.customerUpdated) return;

    setToast({
      title: "顧客情報を更新しました",
      description: state.customerName ? `${state.customerName} の編集内容を保存しました。` : "編集内容を保存しました。",
    });
    window.setTimeout(() => setToast(null), 3600);
    navigate("/customers", { replace: true, state: null });
  }, [location.state, navigate]);

  const handleDeleteCustomer = () => {
    if (!deleteTarget) return;

    const linkedProjects = getCustomerProjects(projects, deleteTarget);
    if (linkedProjects.length > 0) {
      setDeleteTarget(null);
      setToast({
        title: "顧客を削除できません",
        description: "この顧客は進行中の案件があるため削除できません",
        tone: "error",
      });
      window.setTimeout(() => setToast(null), 3600);
      return;
    }

    deleteCustomer(deleteTarget.id);
    setToast({
      title: "顧客を削除しました",
      description: `${formatCustomerOptionLabel(deleteTarget)} を削除しました。`,
    });
    setDeleteTarget(null);
    window.setTimeout(() => setToast(null), 3600);
  };

  return (
    <div className="w-full max-w-none">
      <motion.div
        className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="顧客名・会社名・電話番号で検索"
            className="h-10 w-full min-w-[240px] max-w-sm sm:w-[320px]"
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value as CustomerType | "すべて")}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            aria-label="顧客種別"
          >
            {customerTypeOptions.map((option) => (
              <option key={option} value={option} className="bg-white text-slate-800 dark:bg-slate-950 dark:text-white">{option}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as CustomerStatus | "すべて")}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            aria-label="顧客状態"
          >
            {customerStatusOptions.map((option) => (
              <option key={option} value={option} className="bg-white text-slate-800 dark:bg-slate-950 dark:text-white">{option}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <Button variant="outline" className="gap-2" onClick={() => setBusinessCardOpen(true)}>
            <ScanText className="size-4" />
            名刺から登録
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <PlusCircle className="size-4" />
            新規顧客登録
          </Button>
        </div>
      </motion.div>

      <motion.div
        className="grid gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.34 }}
      >
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <CustomerList customers={rows} projects={projects} onDelete={setDeleteTarget} />
        </section>
      </motion.div>
      <CustomerCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(customer) => {
          setCreateOpen(false);
          setToast({
            title: "顧客を登録しました",
            description: `${customer.name || customer.companyName} を顧客管理に追加しました。`,
          });
          window.setTimeout(() => setToast(null), 3600);
        }}
      />
      <BusinessCardDialog open={businessCardOpen} onOpenChange={setBusinessCardOpen} />
      <DeleteDocumentDialog
        open={Boolean(deleteTarget)}
        title="顧客を削除しますか？"
        description="削除してよろしいですか？この操作は取り消せません。"
        targetName={deleteTarget ? formatCustomerOptionLabel(deleteTarget) : undefined}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteCustomer}
      />
      <ToastMessage toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export function CustomerCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (customer: Customer) => void;
}) {
  const navigate = useNavigate();
  const createCustomer = useProjectStore((state) => state.createCustomer);
  const [form, setForm] = useState<CustomerInput>(blankCustomerInput());
  const [businessCardOpen, setBusinessCardOpen] = useState(false);
  const update = (field: keyof CustomerInput, value: string) =>
    setForm((current) => ({ ...current, [field]: normalizeCustomerInputField(field, value) }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCustomerIdentity(form)) {
      window.alert(requiredFieldsMessage);
      return;
    }
    const customer = createCustomer(normalizeCustomerInput({
      ...form,
      businessCards: await persistImageAssetReferences(form.businessCards, "business-card"),
    }));
    setForm(blankCustomerInput());
    onOpenChange(false);
    if (onCreated) {
      onCreated(customer);
      return;
    }
    navigate(`/customers/${customer.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>新規顧客登録</DialogTitle>
          <DialogDescription>顧客情報を登録すると、新規案件作成時に選択できます。</DialogDescription>
        </DialogHeader>
        <Button type="button" variant="outline" className="w-fit gap-2" onClick={() => setBusinessCardOpen(true)}>
          <ScanText className="size-4" />
          名刺を読み込む
        </Button>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          <CustomerFormFields form={form} update={update} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>キャンセル</Button>
            <Button type="submit">登録する</Button>
          </div>
        </form>
        <BusinessCardDialog
          open={businessCardOpen}
          onOpenChange={setBusinessCardOpen}
          onApply={(data) => setForm((current) => normalizeCustomerInput({ ...current, ...data }))}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteDocumentDialog({
  open,
  title,
  description,
  targetName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  targetName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            {targetName ? <span className="mt-2 block text-slate-300">対象: {targetName}</span> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>キャンセル</Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm}>削除する</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoPill({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/45 dark:shadow-none">
      <p className="text-xs text-slate-600 dark:text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm ${strong ? "font-semibold text-slate-900 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200"}`}>
        {value}
      </p>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  if (!value) return "-";
  return value.replaceAll("-", "/");
}
