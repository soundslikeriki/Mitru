import { motion } from "framer-motion";
import { ArrowLeft, PackageCheck, ShoppingCart, Users } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/features/calculation/lib/formatting";
import { ProjectStatusBadge, ProjectStatusBar } from "@/features/projects/components/ProjectStatusBar";
import { getProjectClientLabel } from "@/features/projects/lib/project-utils";
import { type Customer, type Project, useProjectStore } from "@/stores/project-store";

type ProjectHeaderToast = {
  title: string;
  description: string;
  tone?: "success" | "error";
};

export function ProjectHeader({
  project,
  linkedCustomer,
  onNotify,
}: {
  project: Project;
  linkedCustomer?: Customer;
  onNotify?: (toast: ProjectHeaderToast | null) => void;
}) {
  const navigate = useNavigate();
  const projectItems = useProjectStore((state) => state.projectItems);
  const estimateDocuments = useProjectStore((state) => state.estimateDocuments);
  const invoiceDocuments = useProjectStore((state) => state.invoiceDocuments);
  const createDeliveryDocument = useProjectStore((state) => state.createDeliveryDocument);
  const createOrderDocument = useProjectStore((state) => state.createOrderDocument);
  const projectLineItems = projectItems.filter((item) => item.projectId === project.id);
  const latestInvoice = invoiceDocuments
    .filter((document) => document.projectId === project.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const latestEstimate = estimateDocuments
    .filter((document) => document.projectId === project.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const today = new Date().toISOString().slice(0, 10);
  const calculatedTotal = projectLineItems.reduce((sum, item) => {
    const unitCost = item.estimatedUnitCost || item.materialUnitCost || 0;
    return sum + item.quantity * unitCost;
  }, 0);
  const fallbackTotal = calculatedTotal || project.totalAmount || 0;
  const sourceDocument = latestInvoice ?? latestEstimate;
  const sourceKind = latestInvoice ? "invoice" : latestEstimate ? "estimate" : "calculation";
  const sourceTotal = latestInvoice?.currentAmount ?? latestEstimate?.totalAmount ?? fallbackTotal;

  const notify = (toast: ProjectHeaderToast) => {
    onNotify?.(toast);
    window.setTimeout(() => onNotify?.(null), 3600);
  };

  const handleCreateDelivery = () => {
    const document = createDeliveryDocument(project.id, {
      sourceDocumentId: sourceDocument?.id,
      sourceDocumentKind: sourceKind,
      documentNumber: "",
      issuedAt: today,
      deliveryDate: project.endDate || today,
      title: `${project.constructionName || project.name} 納品書`,
      totalAmount: sourceTotal,
      itemCount: projectLineItems.length,
      status: "未発行",
      remarks: "見積・請求・積算データから作成した納品書下書きです。",
    });
    notify({ title: "納品書を作成しました", description: `${document.documentNumber} を下書きとして保存しました。` });
    navigate("/deliveries");
  };

  const handleCreateOrder = () => {
    const document = createOrderDocument(project.id, {
      sourceDocumentId: sourceDocument?.id,
      sourceDocumentKind: sourceKind,
      documentNumber: "",
      orderedAt: today,
      dueDate: project.endDate || today,
      supplierName: "未設定",
      title: `${project.constructionName || project.name} 注文書`,
      totalAmount: fallbackTotal,
      itemCount: projectLineItems.length,
      status: "未発行",
      remarks: "外注・材料発注用の注文書下書きです。発注先は後から編集してください。",
    });
    notify({ title: "注文書を作成しました", description: `${document.documentNumber} を下書きとして保存しました。` });
    navigate("/orders");
  };

  return (
    <>
      <Button asChild variant="ghost" className="mb-3 w-fit gap-2">
        <Link to="/projects">
          <ArrowLeft className="size-4" />
          案件一覧へ戻る
        </Link>
      </Button>

      <motion.section
        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-xl shadow-black/10 backdrop-blur-xl"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34 }}
      >
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <ProjectStatusBadge status={project.status} />
              <span className="truncate text-sm font-semibold text-white">{project.name}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-slate-400">
                更新日 {formatDate(project.updatedAt)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-slate-300">{getProjectClientLabel(project)}</span>
              {linkedCustomer && (
                <Link
                  to={`/customers/${linkedCustomer.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.10] px-3 py-1 text-xs font-semibold text-slate-800 transition hover:bg-emerald-400/[0.16] dark:text-emerald-300"
                >
                  <Users className="size-3.5" />
                  顧客情報
                </Link>
              )}
            </div>
            <div className="mt-3">
              <ProjectStatusBar project={project} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 bg-white/80 text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.10]"
              onClick={handleCreateDelivery}
            >
              <PackageCheck className="size-4" />
              納品書作成
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 bg-white/80 text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.10]"
              onClick={handleCreateOrder}
            >
              <ShoppingCart className="size-4" />
              注文書作成
            </Button>
          </div>
        </div>
      </motion.section>
    </>
  );
}
