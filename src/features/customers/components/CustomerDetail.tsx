import { type FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, PenLine } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { ImageAsset } from "@/components/ImageAsset";
import { Button } from "@/components/ui/button";
import { CustomerFormFields } from "@/features/customers/components/CustomerForm";
import { persistImageAssetReferences } from "@/lib/image-storage";
import {
  formatCustomerOptionLabel,
  getCustomerProjects,
  hasCustomerIdentity,
  normalizeCustomerInput,
  normalizeCustomerInputField,
  requiredFieldsMessage,
} from "@/features/customers/lib/customer-utils";
import { type Customer, type CustomerInput, useProjectStore } from "@/stores/project-store";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customer = useProjectStore((state) => state.customers.find((item) => item.id === id));
  const projects = useProjectStore((state) => state.projects);
  const updateCustomer = useProjectStore((state) => state.updateCustomer);
  const [form, setForm] = useState<Customer | undefined>(customer);

  useEffect(() => setForm(customer), [customer]);

  if (!customer || !form) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-950/55 p-8 backdrop-blur-xl">
        <h2 className="text-2xl font-semibold text-white">顧客が見つかりません</h2>
        <Button asChild className="mt-6"><Link to="/customers">顧客一覧へ戻る</Link></Button>
      </div>
    );
  }

  const customerProjects = getCustomerProjects(projects, customer);
  const totalAmount = customerProjects.reduce((sum, project) => sum + project.totalAmount, 0);
  const update = (field: keyof CustomerInput, value: string) =>
    setForm((current) => current ? { ...current, [field]: normalizeCustomerInputField(field, value) } : current);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCustomerIdentity(form)) {
      window.alert(requiredFieldsMessage);
      return;
    }
    const normalizedForm = normalizeCustomerInput({
      ...form,
      businessCards: await persistImageAssetReferences(form.businessCards, "business-card"),
    });
    updateCustomer(customer.id, normalizedForm);
    navigate("/customers", {
      state: {
        customerUpdated: true,
        customerName: formatCustomerOptionLabel(normalizedForm),
      },
    });
  };

  return (
    <div className="w-full max-w-none">
      <Button asChild variant="ghost" className="mb-4 w-fit gap-2">
        <Link to="/customers"><ArrowLeft className="size-4" />顧客一覧へ戻る</Link>
      </Button>

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <InfoPill label="合計契約金額" value={formatCurrency(totalAmount)} strong />
        <InfoPill label="発注回数" value={`${customerProjects.length} 回`} />
        <InfoPill label="直近更新" value={formatDate(customer.updatedAt)} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <motion.form
          className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={save}
          noValidate
        >
          <h3 className="mb-5 text-lg font-semibold text-white">基本情報編集</h3>
          <CustomerFormFields form={form} update={update} />
          <div className="mt-5 flex justify-end">
            <Button type="submit" className="gap-2"><PenLine className="size-4" />保存</Button>
          </div>
        </motion.form>

        <aside className="grid h-fit gap-5">
          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white">名刺画像</h3>
            <div className="mt-4 grid gap-3">
              {form.businessCards.length > 0 ? (
                form.businessCards.map((image, index) => (
                  <ImageAsset key={`${image.slice(0, 24)}-${index}`} src={image} alt="名刺" className="max-h-52 w-full rounded-xl border border-white/10 object-contain" />
                ))
              ) : (
                <p className="text-sm text-slate-500">登録済みの名刺はありません。</p>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white">過去案件</h3>
            <div className="mt-4 grid gap-3">
              {customerProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-emerald-400/30 hover:bg-white/[0.07]"
                >
                  <p className="font-semibold text-white">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatCurrency(project.totalAmount)} / {project.status}</p>
                </button>
              ))}
              {customerProjects.length === 0 && <p className="text-sm text-slate-500">過去案件はありません。</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
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
