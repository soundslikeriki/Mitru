import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  formatCustomerOptionLabel,
  getCustomerProjects,
} from "@/features/customers/lib/customer-utils";
import type { Customer, Project } from "@/stores/project-store";

const listDeleteButtonClass =
  "text-slate-500 hover:border-red-300/50 hover:bg-red-500/10 hover:text-red-500 dark:text-slate-400 dark:hover:border-red-400/30 dark:hover:bg-red-500/10 dark:hover:text-red-300";

export function CustomerList({
  customers,
  projects,
  onDelete,
}: {
  customers: Customer[];
  projects: Project[];
  onDelete: (customer: Customer) => void;
}) {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[1240px] table-auto whitespace-nowrap text-sm">
        <thead className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
          <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-500">
            <th className="px-4 py-3">名前</th>
            <th className="px-4 py-3">会社名</th>
            <th className="px-4 py-3">電話</th>
            <th className="px-4 py-3">メール</th>
            <th className="px-4 py-3">住所</th>
            <th className="px-4 py-3">直近案件</th>
            <th className="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, index) => {
            const customerProjects = getCustomerProjects(projects, customer);
            const recentProject = [...customerProjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            return (
              <CustomerTableRow
                key={customer.id}
                customer={customer}
                recentProject={recentProject}
                index={index}
                onDelete={onDelete}
              />
            );
          })}
          {customers.length === 0 && (
            <tr>
              <td colSpan={7} className="h-36 text-center text-slate-500">
                条件に一致する顧客がありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CustomerTableRow({
  customer,
  recentProject,
  index,
  onDelete,
}: {
  customer: Customer;
  recentProject?: Project;
  index: number;
  onDelete: (customer: Customer) => void;
}) {
  const navigate = useNavigate();
  return (
    <motion.tr
      className="cursor-pointer border-b border-white/10 transition-colors hover:bg-white/[0.04]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      onClick={() => navigate(`/customers/${customer.id}`)}
    >
      <td className="px-4 py-4">
        <p className="font-semibold text-white">{customer.name}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <CustomerBadge value={customer.type} />
          <CustomerBadge value={customer.status} muted />
        </div>
      </td>
      <td className="px-4 py-4 text-slate-300">{customer.companyName || "-"}</td>
      <td className="px-4 py-4 text-slate-300">{customer.phone || "-"}</td>
      <td className="px-4 py-4 text-slate-300">{customer.email || "-"}</td>
      <td className="px-4 py-4 text-slate-400" title={customer.address}>
        <span className="block max-w-[280px] truncate">{customer.address || "-"}</span>
      </td>
      <td className="px-4 py-4 text-slate-300">{recentProject?.name ?? "-"}</td>
      <td className="px-4 py-4 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`${listDeleteButtonClass} size-9 rounded-lg`}
          aria-label={`${formatCustomerOptionLabel(customer)}を削除`}
          title="削除"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(customer);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </td>
    </motion.tr>
  );
}

function CustomerBadge({ value, muted = false }: { value: string; muted?: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      muted
        ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400"
        : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/[0.10] dark:text-emerald-300"
    }`}>
      {value}
    </span>
  );
}
