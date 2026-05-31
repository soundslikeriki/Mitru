import { motion } from "framer-motion";
import { Calculator, FileText, HelpCircle, LayoutDashboard, ReceiptText, ShieldCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router";

const quickStart = [
  {
    icon: LayoutDashboard,
    title: "1. ダッシュボードで全体を見る",
    description: "今年の業績予測、キャッシュフロー、リスク案件を最初に確認します。",
  },
  {
    icon: Calculator,
    title: "2. 案件を作って積算する",
    description: "工事項目マスタやよく使う項目から行を追加し、数量・歩掛・単価を入力します。",
  },
  {
    icon: TrendingUp,
    title: "3. 粗利を見る",
    description: "緑は良好、黄は注意、赤は要見直し。見積粗利と実行粗利を並べて確認できます。",
  },
  {
    icon: FileText,
    title: "4. 見積書を作る",
    description: "積算データから見積書を作成し、プレビューで社判やロゴの位置を確認します。",
  },
  {
    icon: ReceiptText,
    title: "5. 請求・納品・注文へ進める",
    description: "見積内容をもとに請求書、納品書、注文書へ展開し、案件の進行管理に反映します。",
  },
];

const faqs = [
  {
    question: "データはどこに保存されますか？",
    answer: "Mitruはローカルファーストです。クラウド同期をOFFにしている間、現在のデータは端末内のlocalStorageに保存され、サーバーへ送信されません。",
  },
  {
    question: "クラウド同期では何が同期されますか？",
    answer: "クラウド同期は実験的機能です。データ消失の可能性があります。必ずバックアップを取ってからONにしてください。同期対象は5種類のみで、案件、顧客、見積書、請求書、入金記録です。※積算明細（projectItems）は現在クラウド同期対象外です。別端末では積算内容を再入力する必要があります。",
  },
  {
    question: "粗利率の色は何を意味しますか？",
    answer: "粗利率が30%未満になると黄色の注意表示、25%未満になると赤色の警告表示になります。注意や警告が出た案件・行は、単価・数量・実行原価を早めに見直してください。",
  },
  {
    question: "積算から見積書に反映できますか？",
    answer: "できます。積算タブの内容をもとに、この案件の見積書タブで書類を作成できます。",
  },
  {
    question: "帳票をPDF保存したいときは？",
    answer: "v0.9.7-betaでは各帳票プレビューの「印刷 / PDF保存」からOS標準の印刷ダイアログを開き、PDFとして保存してください。",
  },
];

export function HelpPage() {
  return (
    <div className="w-full max-w-none">
      <section className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-5 shadow-2xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">ローカルファーストで安心して使えます</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                見積・積算データは端末内で管理されます。サーバーレスで、インターネットにつながっていない現場でも作業できます。
                ベータ版では定期的なバックアップをおすすめします。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        {quickStart.map((step, index) => (
          <motion.article
            key={step.title}
            className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.26 }}
          >
            <div className="mb-4 grid size-10 place-items-center rounded-xl bg-[#1E3A8A]/55 text-emerald-300">
              <step.icon className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-xs leading-6 text-slate-400">{step.description}</p>
          </motion.article>
        ))}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <HelpCircle className="size-4 text-emerald-300" />
            <h2 className="text-base font-semibold text-white">よくある質問</h2>
          </div>
          <div className="grid gap-3">
            {faqs.map((faq) => (
              <details key={faq.question} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white">{faq.question}</summary>
                <p className="mt-3 text-sm leading-7 text-slate-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <h2 className="text-base font-semibold text-white">最初に見るべき画面</h2>
          <div className="mt-4 grid gap-3">
            <HelpLink to="/dashboard" label="ダッシュボード" description="売上・粗利・キャッシュフローを確認" />
            <HelpLink to="/projects" label="案件一覧" description="利益リスクや次回対応日で案件を探す" />
            <HelpLink to="/masters" label="マスタ設定" description="工事項目・材料を整える" />
            <HelpLink to="/settings" label="アプリ設定" description="会社情報・税率・書類番号を設定" />
          </div>
        </aside>
      </section>
    </div>
  );
}

function HelpLink({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-white/10 bg-white/[0.05] p-4 transition hover:border-emerald-400/35 hover:bg-white/[0.08]"
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
    </Link>
  );
}
