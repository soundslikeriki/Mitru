import type {
  CompanyInfo,
  CloudSyncSettings,
  BillingCloseRecord,
  Customer,
  DeliveryDocument,
  DocumentNumberConfig,
  DocumentNumberSettings,
  EstimateLineSnapshot,
  EstimateDocument,
  EstimateTotalsSnapshot,
  InvoiceDocument,
  InvoiceLineSnapshot,
  InvoiceTotalsSnapshot,
  MaterialCategory,
  MaterialMaster,
  PaymentRecord,
  OrderDocument,
  PdfTemplateSettings,
  Project,
  ProjectCostSettings,
  ProjectInvoiceSettings,
  ProjectItem,
  ProjectQuoteSettings,
  ProjectSealSettings,
  TaxSettings,
  WorkItemMaster,
  WorkItemMasterInput,
} from "./slices/types";

const seedNow = "2026-05-07";
export const defaultWelfareRate = 0.25;
export const now = () => new Date().toISOString();

export const defaultCloudSyncSettings: CloudSyncSettings = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  isEnabled: false,
  isTestMode: false,
  isConnected: false,
  lastSyncAt: "",
  lastProjectsSyncedAt: "",
  lastCustomersSyncedAt: "",
  lastEstimatesSyncedAt: "",
  lastInvoicesSyncedAt: "",
  lastPaymentsSyncedAt: "",
  lastProjectsSyncCursorId: "",
  lastCustomersSyncCursorId: "",
  lastEstimatesSyncCursorId: "",
  lastInvoicesSyncCursorId: "",
  lastPaymentsSyncCursorId: "",
  syncStatus: "idle",
  syncProgress: {
    isSyncing: false,
    currentStep: 0,
    totalSteps: 5,
    label: "待機中",
    startedAt: null,
  },
  lastSyncResults: {
    projects: {
      status: "idle",
      pulled: 0,
      pushed: 0,
      skipped: 0,
      message: "未同期",
      syncedAt: null,
      syncCursorId: null,
    },
    customers: {
      status: "idle",
      pulled: 0,
      pushed: 0,
      skipped: 0,
      message: "未同期",
      syncedAt: null,
      syncCursorId: null,
    },
    estimates: {
      status: "idle",
      pulled: 0,
      pushed: 0,
      skipped: 0,
      message: "未同期",
      syncedAt: null,
      syncCursorId: null,
    },
    invoices: {
      status: "idle",
      pulled: 0,
      pushed: 0,
      skipped: 0,
      message: "未同期",
      syncedAt: null,
      syncCursorId: null,
    },
    payments: {
      status: "idle",
      pulled: 0,
      pushed: 0,
      skipped: 0,
      message: "未同期",
      syncedAt: null,
      syncCursorId: null,
    },
  },
  syncHistory: [],
  pendingConflicts: [],
  authState: "idle",
  user: null,
};

export const systemWorkMasterCategories = [
  "仮設工事",
  "基礎工事",
  "木工事",
  "鉄骨工事",
  "解体工事",
  "内装工事",
  "外装工事",
  "建具工事",
  "左官工事",
  "タイル工事",
  "塗装工事",
  "防水工事",
  "電気工事",
  "給排水衛生工事",
  "空調換気工事",
  "ガス工事",
  "設備工事",
  "昇降機工事",
  "外構工事",
  "造園工事",
  "リフォーム工事",
  "その他",
] as const;

export const systemMaterialCategories = [
  "資材・建材",
  "電気資材",
  "水道・衛生資材",
  "副資材・消耗品",
  "その他",
] as const satisfies readonly MaterialCategory[];

export const samplePortfolioCustomers: Customer[] = [
  {
    id: "sample-customer-clinic",
    name: "山口 真理",
    companyName: "ひなたクリニック",
    position: "院長",
    postalCode: "150-0001",
    address: "東京都渋谷区神宮前",
    phone: "03-3400-1100",
    fax: "",
    email: "clinic@example.com",
    type: "法人",
    status: "新規",
    note: "診療を止めない短工期の内装改修。",
    memo: "",
    website: "",
    businessCards: [],
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-customer-apparel",
    name: "石川 悠",
    companyName: "Lino Apparel",
    position: "店舗開発",
    postalCode: "180-0004",
    address: "東京都武蔵野市吉祥寺本町",
    phone: "0422-20-2300",
    fax: "",
    email: "store@example.com",
    type: "法人",
    status: "新規",
    note: "什器と照明を含む店舗改装。",
    memo: "",
    website: "",
    businessCards: [],
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-customer-cafe",
    name: "中村 亮",
    companyName: "青空カフェ",
    position: "代表",
    postalCode: "248-0006",
    address: "神奈川県鎌倉市小町",
    phone: "0467-20-2600",
    fax: "",
    email: "cafe@example.com",
    type: "法人",
    status: "新規",
    note: "設備比率が高く粗利が低めの改装案件。",
    memo: "",
    website: "",
    businessCards: [],
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-customer-reform",
    name: "佐藤 恵",
    companyName: "",
    position: "",
    postalCode: "154-0012",
    address: "東京都世田谷区駒沢",
    phone: "03-6800-4500",
    fax: "",
    email: "reform@example.com",
    type: "個人",
    status: "既存",
    note: "水回りを含む住宅内装リフォーム。",
    memo: "",
    website: "",
    businessCards: [],
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-customer-office",
    name: "高橋 健",
    companyName: "北参道デザイン株式会社",
    position: "総務",
    postalCode: "151-0051",
    address: "東京都渋谷区千駄ヶ谷",
    phone: "03-5300-7800",
    fax: "",
    email: "office@example.com",
    type: "法人",
    status: "新規",
    note: "オフィス移転に伴う内装一式。",
    memo: "",
    website: "",
    businessCards: [],
    createdAt: seedNow,
    updatedAt: seedNow,
  },
];

export const samplePortfolioProjects: Project[] = [
  {
    id: "sample-project-clinic",
    projectNumber: "2026-001",
    ownerId: "sample-owner",
    assignedTo: "sample-owner",
    customerId: "sample-customer-clinic",
    name: "ひなたクリニック 内装改修工事",
    clientName: "山口 真理",
    clientCompanyName: "ひなたクリニック",
    constructionName: "診療室・待合室 内装改修工事",
    location: "東京都渋谷区神宮前",
    startDate: "2026-05-20",
    endDate: "2026-06-10",
    expectedPaymentDate: "2026-07-10",
    nextActionDate: "2026-05-15",
    processMemo: "夜間作業範囲と養生計画を確認。",
    ownerMemo: "高粗利サンプル。内装中心で外注比率は低め。",
    status: "契約済",
    taxRateType: "standard",
    totalAmount: 6800000,
    progress: 35,
    note: "契約済。400万円入金済みの高粗利サンプル案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-project-apparel",
    projectNumber: "2026-002",
    ownerId: "sample-owner",
    assignedTo: "sample-owner",
    customerId: "sample-customer-apparel",
    name: "Lino Apparel アパレル店舗 改装工事",
    clientName: "石川 悠",
    clientCompanyName: "Lino Apparel",
    constructionName: "売場・試着室 店舗改装工事",
    location: "東京都武蔵野市吉祥寺本町",
    startDate: "2026-06-03",
    endDate: "2026-06-25",
    expectedPaymentDate: "2026-07-31",
    nextActionDate: "2026-05-18",
    processMemo: "什器寸法と照明器具の最終確認。",
    ownerMemo: "中粗利サンプル。造作と照明のバランス型。",
    status: "施工中",
    taxRateType: "standard",
    totalAmount: 4500000,
    progress: 58,
    note: "施工中。造作と照明を含む高粗利サンプル案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-project-cafe",
    projectNumber: "2026-003",
    ownerId: "sample-owner",
    assignedTo: "sample-owner",
    customerId: "sample-customer-cafe",
    name: "青空カフェ 改装工事",
    clientName: "中村 亮",
    clientCompanyName: "青空カフェ",
    constructionName: "厨房・客席 カフェ改装工事",
    location: "神奈川県鎌倉市小町",
    startDate: "2026-06-10",
    endDate: "2026-07-08",
    expectedPaymentDate: "2026-08-10",
    nextActionDate: "2026-05-21",
    processMemo: "給排水と厨房機器の取り合いを確認。",
    ownerMemo: "低粗利サンプル。設備・外注比率が高め。",
    status: "完了",
    taxRateType: "standard",
    totalAmount: 3200000,
    progress: 100,
    note: "完了・全額入金済みのサンプル案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-project-reform",
    projectNumber: "2026-004",
    ownerId: "sample-owner",
    assignedTo: "sample-staff-a",
    customerId: "sample-customer-reform",
    name: "住宅リフォーム（内装中心）",
    clientName: "佐藤 恵",
    clientCompanyName: "",
    constructionName: "LDK・水回り 内装リフォーム工事",
    location: "東京都世田谷区駒沢",
    startDate: "2026-07-01",
    endDate: "2026-07-28",
    expectedPaymentDate: "2026-08-20",
    nextActionDate: "2026-06-18",
    processMemo: "キッチン納期と床材手配を確認。",
    ownerMemo: "部分入金あり。住宅向けの標準粗利サンプル。",
    status: "請求済み",
    taxRateType: "standard",
    totalAmount: 5800000,
    progress: 96,
    note: "請求済み。一部入金済みの住宅リフォーム案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-project-office",
    projectNumber: "2026-005",
    ownerId: "sample-owner",
    assignedTo: "sample-staff-b",
    customerId: "sample-customer-office",
    name: "オフィス内装工事",
    clientName: "高橋 健",
    clientCompanyName: "北参道デザイン株式会社",
    constructionName: "執務室・会議室 オフィス内装工事",
    location: "東京都渋谷区千駄ヶ谷",
    startDate: "2026-08-05",
    endDate: "2026-09-05",
    expectedPaymentDate: "2026-10-10",
    nextActionDate: "2026-06-22",
    processMemo: "レイアウト図と消防設備の確認待ち。",
    ownerMemo: "見積中。単価検討用の粗利55%サンプル。",
    status: "見積中",
    taxRateType: "standard",
    totalAmount: 7500000,
    progress: 12,
    note: "見積中のオフィス内装サンプル案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
];

export const samplePortfolioActualCosts: Record<string, Pick<ProjectItem, "actualMaterialCost" | "actualLaborCost" | "actualOutsourcingCost">> = {
  "sample-clinic-01": { actualMaterialCost: 0, actualLaborCost: 116000, actualOutsourcingCost: 0 },
  "sample-clinic-02": { actualMaterialCost: 455000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-clinic-03": { actualMaterialCost: 350000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-clinic-04": { actualMaterialCost: 165000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-clinic-05": { actualMaterialCost: 0, actualLaborCost: 264000, actualOutsourcingCost: 0 },
  "sample-clinic-06": { actualMaterialCost: 353347, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-apparel-01": { actualMaterialCost: 0, actualLaborCost: 84000, actualOutsourcingCost: 0 },
  "sample-apparel-02": { actualMaterialCost: 230000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-apparel-03": { actualMaterialCost: 0, actualLaborCost: 164000, actualOutsourcingCost: 0 },
  "sample-apparel-04": { actualMaterialCost: 0, actualLaborCost: 65600, actualOutsourcingCost: 0 },
  "sample-apparel-05": { actualMaterialCost: 214000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-apparel-06": { actualMaterialCost: 242512, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-cafe-01": { actualMaterialCost: 0, actualLaborCost: 73600, actualOutsourcingCost: 0 },
  "sample-cafe-02": { actualMaterialCost: 207000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-cafe-03": { actualMaterialCost: 0, actualLaborCost: 231200, actualOutsourcingCost: 0 },
  "sample-cafe-04": { actualMaterialCost: 82000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-cafe-05": { actualMaterialCost: 248000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-cafe-06": { actualMaterialCost: 166297, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-reform-01": { actualMaterialCost: 397000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-reform-02": { actualMaterialCost: 298000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-reform-03": { actualMaterialCost: 0, actualLaborCost: 232000, actualOutsourcingCost: 0 },
  "sample-reform-04": { actualMaterialCost: 347000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-reform-05": { actualMaterialCost: 215000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-reform-06": { actualMaterialCost: 0, actualLaborCost: 142896, actualOutsourcingCost: 0 },
  "sample-office-01": { actualMaterialCost: 731000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-office-02": { actualMaterialCost: 0, actualLaborCost: 577600, actualOutsourcingCost: 0 },
  "sample-office-03": { actualMaterialCost: 537000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-office-04": { actualMaterialCost: 265000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-office-05": { actualMaterialCost: 425000, actualLaborCost: 0, actualOutsourcingCost: 0 },
  "sample-office-06": { actualMaterialCost: 109256, actualLaborCost: 0, actualOutsourcingCost: 0 },
};

function sampleItem(
  id: string,
  projectId: string,
  majorCategory: string,
  middleCategory: string,
  name: string,
  specification: string,
  unit: string,
  quantity: number,
  estimatedUnitCost: number,
  actualUnitCost: number,
  laborProductivity: number,
  estimatedLaborUnitCost: number,
  actualLaborUnitCost: number,
  expenseRate: number,
  note = "",
): ProjectItem {
  const isLaborItem =
    laborProductivity > 0 ||
    estimatedLaborUnitCost > 0 ||
    actualLaborUnitCost > 0 ||
    unit === "人日" ||
    unit === "人" ||
    unit === "時間" ||
    unit === "日";
  const actualCosts = samplePortfolioActualCosts[id];
  const resolvedActualUnitCost =
    !isLaborItem && actualCosts?.actualMaterialCost && quantity > 0
      ? actualCosts.actualMaterialCost / quantity
      : actualUnitCost;
  const resolvedActualLaborUnitCost =
    isLaborItem && actualCosts?.actualLaborCost && quantity > 0
      ? actualCosts.actualLaborCost / quantity
      : actualLaborUnitCost;
  const baseCost = !isLaborItem ? resolvedActualUnitCost || actualUnitCost || estimatedUnitCost : null;
  const markupRate = !isLaborItem && baseCost && baseCost > 0 ? estimatedUnitCost / baseCost : null;

  return {
    id,
    projectId,
    priceModelVersion: 2,
    itemType: isLaborItem ? "labor" : "material",
    majorCategory,
    middleCategory,
    name,
    specification,
    unit,
    quantity,
    laborProductivity,
    welfareRate: defaultWelfareRate,
    estimatedLaborProductivity: laborProductivity,
    actualLaborProductivity: laborProductivity,
    laborUnitCost: estimatedLaborUnitCost,
    estimatedLaborUnitCost,
    actualLaborUnitCost: resolvedActualLaborUnitCost,
    materialUnitCost: estimatedUnitCost,
    baseCost,
    markupRate,
    estimatedUnitCost,
    actualUnitCost: resolvedActualUnitCost,
    expenseRate,
    note,
    ...samplePortfolioActualCosts[id],
    createdAt: seedNow,
    updatedAt: seedNow,
  };
}

export const samplePortfolioProjectItems: ProjectItem[] = [
  sampleItem("sample-clinic-01", "sample-project-clinic", "仮設工事", "養生", "診療エリア防塵養生", "", "人日", 5, 0, 0, 1, 71360, 23200, 0),
  sampleItem("sample-clinic-02", "sample-project-clinic", "内装工事", "床仕上げ系", "抗菌長尺シート張り", "医療施設向け床材", "㎡", 120, 12400, 3792, 0, 0, 0, 0),
  sampleItem("sample-clinic-03", "sample-project-clinic", "内装工事", "壁・天井仕上げ系", "クロス張り（防かび・抗菌）", "待合・診療室", "㎡", 250, 5580, 1400, 0, 0, 0, 0),
  sampleItem("sample-clinic-04", "sample-project-clinic", "内装工事", "壁・天井仕上げ系", "天井クロス張り", "既存下地補修含む", "㎡", 160, 4300, 1031, 0, 0, 0, 0),
  sampleItem("sample-clinic-05", "sample-project-clinic", "内装工事", "造作・建具系", "間仕切り下地組立", "LGS65 + 開口補強", "人日", 14, 0, 0, 1, 56714, 18857, 0),
  sampleItem("sample-clinic-06", "sample-project-clinic", "電気工事", "照明器具設置", "LEDベースライト交換", "既存配線利用", "台", 18, 33907, 19630, 0, 0, 0, 0),

  sampleItem("sample-apparel-01", "sample-project-apparel", "解体工事", "内装解体工事", "既存什器撤去・搬出", "夜間作業", "人日", 4, 0, 0, 1, 62000, 21000, 0),
  sampleItem("sample-apparel-02", "sample-project-apparel", "内装工事", "床仕上げ系", "塩ビタイル張り", "店舗用重歩行フロアタイル", "㎡", 80, 10750, 2875, 0, 0, 0, 0),
  sampleItem("sample-apparel-03", "sample-project-apparel", "木工事", "造作工事", "壁面ディスプレイ造作", "可動棚・ハンガーパイプ含む", "人日", 12, 0, 0, 1, 55934, 13667, 0),
  sampleItem("sample-apparel-04", "sample-project-apparel", "内装工事", "その他内装系", "内部塗装（壁・天井）", "AEP 2回塗り", "人日", 7, 0, 0, 1, 45371, 9371, 0),
  sampleItem("sample-apparel-05", "sample-project-apparel", "電気工事", "照明器具設置", "ライティングレール・スポット", "売場演出照明", "式", 1, 702000, 214000, 0, 0, 0, 0),
  sampleItem("sample-apparel-06", "sample-project-apparel", "内装工事", "造作・建具系", "ハンガーパイプ・金物取付", "什器用金物一式", "式", 1, 611000, 242512, 0, 0, 0, 0),

  sampleItem("sample-cafe-01", "sample-project-cafe", "解体工事", "内装解体工事", "既存カウンター撤去", "処分・搬出含む", "人日", 3, 0, 0, 1, 68800, 24533, 0),
  sampleItem("sample-cafe-02", "sample-project-cafe", "内装工事", "床仕上げ系", "長尺シート張り", "厨房用防滑長尺シート", "㎡", 42, 13214, 4929, 0, 0, 0, 0),
  sampleItem("sample-cafe-03", "sample-project-cafe", "木工事", "造作工事", "カウンター造作", "メラミン天板・腰壁含む", "人日", 10, 0, 0, 1, 57840, 23120, 0),
  sampleItem("sample-cafe-04", "sample-project-cafe", "内装工事", "その他内装系", "内部塗装（木部・建具）", "客席木部仕上げ", "㎡", 50, 4140, 1640, 0, 0, 0, 0),
  sampleItem("sample-cafe-05", "sample-project-cafe", "給排水衛生工事", "給排水管工事", "厨房給排水切回し", "露出配管一部更新", "式", 1, 504000, 248000, 0, 0, 0, 0),
  sampleItem("sample-cafe-06", "sample-project-cafe", "電気工事", "配線工事", "厨房機器用電源増設", "専用回路追加", "式", 1, 397628, 166297, 0, 0, 0, 0),

  sampleItem("sample-reform-01", "sample-project-reform", "内装工事", "床仕上げ系", "フローリング張り（複合フローリング）", "LDK・廊下", "㎡", 95, 11568, 4179, 0, 0, 0, 0),
  sampleItem("sample-reform-02", "sample-project-reform", "内装工事", "壁・天井仕上げ系", "クロス張り（標準）", "居室・廊下", "㎡", 220, 4959, 1355, 0, 0, 0, 0),
  sampleItem("sample-reform-03", "sample-project-reform", "内装工事", "造作・建具系", "室内建具枠調整・交換", "建具3箇所", "人日", 10, 0, 0, 1, 61520, 23200, 0),
  sampleItem("sample-reform-04", "sample-project-reform", "内装工事", "造作・建具系", "収納扉・折れ戸取付", "収納改修一式", "式", 1, 760000, 347000, 0, 0, 0, 0),
  sampleItem("sample-reform-05", "sample-project-reform", "内装工事", "水回り内装系", "トイレ内装調整", "床壁仕上げ更新", "箇所", 2, 256000, 107500, 0, 0, 0, 0),
  sampleItem("sample-reform-06", "sample-project-reform", "内装工事", "造作・建具系", "手すり取付", "廊下・階段", "人日", 8, 0, 0, 1, 56239, 17862, 0),

  sampleItem("sample-office-01", "sample-project-office", "内装工事", "床仕上げ系", "カーペットタイル張り", "執務室OAフロア上", "㎡", 180, 9917, 4061, 0, 0, 0, 0),
  sampleItem("sample-office-02", "sample-project-office", "内装工事", "造作・建具系", "間仕切り下地組立", "会議室・集中ブース", "人日", 20, 0, 0, 1, 59080, 28880, 0),
  sampleItem("sample-office-03", "sample-project-office", "内装工事", "壁・天井仕上げ系", "システム天井", "執務室天井更新", "㎡", 220, 6200, 2441, 0, 0, 0, 0),
  sampleItem("sample-office-04", "sample-project-office", "内装工事", "その他内装系", "カーテンレール・ブラインド取付", "会議室・窓まわり", "箇所", 18, 34722, 14722, 0, 0, 0, 0),
  sampleItem("sample-office-05", "sample-project-office", "電気工事", "照明器具設置", "LED照明・スイッチ更新", "照明更新一式", "式", 1, 727000, 425000, 0, 0, 0, 0),
  sampleItem("sample-office-06", "sample-project-office", "内装工事", "その他内装系", "内部清掃・ハウスクリーニング", "引渡し前清掃", "式", 1, 220347, 109256, 0, 0, 0, 0),
];

const samplePortfolioItemsByProjectId = samplePortfolioProjects.reduce<Record<string, ProjectItem[]>>((groups, project) => {
  groups[project.id] = samplePortfolioProjectItems.filter((item) => item.projectId === project.id);
  return groups;
}, {});

const sampleCommonTemporaryRate = 0.03;
const sampleSiteManagementRate = 0.07;
const sampleTaxRate = 0.1;

function roundSampleCurrency(value: number) {
  return Math.round(value);
}

function createSampleLineSnapshot(item: ProjectItem) {
  if (item.itemType === "material") {
    const materialCost = roundSampleCurrency(item.quantity * (item.estimatedUnitCost ?? item.materialUnitCost ?? 0));
    return {
      laborCost: 0,
      welfareCost: 0,
      totalLaborCost: 0,
      materialCost,
      expenseCost: 0,
      subtotal: materialCost,
    };
  }

  const laborCost = roundSampleCurrency(item.quantity * (item.estimatedLaborUnitCost ?? item.laborUnitCost ?? 0));
  const welfareCost = roundSampleCurrency(laborCost * (item.welfareRate ?? defaultWelfareRate));
  const totalLaborCost = laborCost + welfareCost;
  return {
    laborCost,
    welfareCost,
    totalLaborCost,
    materialCost: 0,
    expenseCost: 0,
    subtotal: totalLaborCost,
  };
}

function createSampleEstimateLineSnapshots(items: ProjectItem[]): EstimateLineSnapshot[] {
  return items.map((item) => {
    const line = createSampleLineSnapshot(item);
    return {
      item: { ...item },
      line,
      unitPrice: item.quantity > 0 ? roundSampleCurrency(line.subtotal / item.quantity) : line.subtotal,
    };
  });
}

function createSampleEstimateTotals(items: ProjectItem[]): EstimateTotalsSnapshot {
  const base = items.reduce(
    (summary, item) => {
      const line = createSampleLineSnapshot(item);
      return {
        laborCost: summary.laborCost + line.laborCost,
        welfareCost: summary.welfareCost + line.welfareCost,
        totalLaborCost: summary.totalLaborCost + line.totalLaborCost,
        materialCost: summary.materialCost + line.materialCost,
        expenseCost: summary.expenseCost + line.expenseCost,
        directSubtotal: summary.directSubtotal + line.subtotal,
      };
    },
    { laborCost: 0, welfareCost: 0, totalLaborCost: 0, materialCost: 0, expenseCost: 0, directSubtotal: 0 },
  );
  const commonTemporaryCost = roundSampleCurrency(base.directSubtotal * sampleCommonTemporaryRate);
  const siteManagementCost = roundSampleCurrency(base.directSubtotal * sampleSiteManagementRate);
  const beforeTax = base.directSubtotal + commonTemporaryCost + siteManagementCost;
  const tax = roundSampleCurrency(beforeTax * sampleTaxRate);
  return {
    ...base,
    commonTemporaryCost,
    siteManagementCost,
    beforeTax,
    tax,
    afterTax: beforeTax + tax,
  };
}

function createSampleInvoiceLineSnapshots(items: ProjectItem[]): InvoiceLineSnapshot[] {
  return items.map((item) => {
    const line = createSampleLineSnapshot(item);
    return {
      item: { ...item },
      line,
      previousRate: 0,
      currentRate: 1,
      previousAmount: 0,
      currentAmount: line.subtotal,
      cumulativeAmount: line.subtotal,
    };
  });
}

function createSampleInvoiceTotals(estimateTotals: EstimateTotalsSnapshot): InvoiceTotalsSnapshot {
  return {
    previousBeforeTax: 0,
    beforeTax: estimateTotals.beforeTax,
    cumulativeBeforeTax: estimateTotals.beforeTax,
    tax: estimateTotals.tax,
    afterTax: estimateTotals.afterTax,
  };
}

const samplePortfolioDocumentMeta = {
  "sample-project-clinic": {
    estimateId: "sample-estimate-clinic",
    invoiceId: "sample-invoice-clinic",
    estimateNumber: "MTL-0001",
    invoiceNumber: "INV-0001",
    issuedAt: "2026-06-08",
    invoiceDate: "2026-06-12",
    dueDate: "2026-07-10",
    paymentDate: "2026-05-18",
    paymentAmount: 4000000,
    paymentMethod: "銀行振込" as const,
  },
  "sample-project-apparel": {
    estimateId: "sample-estimate-apparel",
    invoiceId: "sample-invoice-apparel",
    estimateNumber: "MTL-0002",
    invoiceNumber: "INV-0002",
    issuedAt: "2026-06-20",
    invoiceDate: "2026-06-26",
    dueDate: "2026-07-31",
    paymentDate: "2026-07-12",
    paymentAmount: 0,
    paymentMethod: "銀行振込" as const,
  },
  "sample-project-cafe": {
    estimateId: "sample-estimate-cafe",
    invoiceId: "sample-invoice-cafe",
    estimateNumber: "MTL-0003",
    invoiceNumber: "INV-0003",
    issuedAt: "2026-07-01",
    invoiceDate: "2026-07-09",
    dueDate: "2026-08-10",
    paymentDate: "2026-07-25",
    paymentAmount: "full" as const,
    paymentMethod: "銀行振込" as const,
  },
  "sample-project-reform": {
    estimateId: "sample-estimate-reform",
    invoiceId: "sample-invoice-reform",
    estimateNumber: "MTL-0004",
    invoiceNumber: "INV-0004",
    issuedAt: "2026-07-24",
    invoiceDate: "2026-07-29",
    dueDate: "2026-08-20",
    paymentDate: "2026-08-05",
    paymentAmount: 3200000,
    paymentMethod: "銀行振込" as const,
  },
  "sample-project-office": {
    estimateId: "sample-estimate-office",
    invoiceId: "sample-invoice-office",
    estimateNumber: "MTL-0005",
    invoiceNumber: "INV-0005",
    issuedAt: "2026-08-01",
    invoiceDate: "2026-08-08",
    dueDate: "2026-10-10",
    paymentDate: "2026-09-15",
    paymentAmount: 0,
    paymentMethod: "銀行振込" as const,
  },
};

function getSampleProjectItems(projectId: string) {
  return samplePortfolioItemsByProjectId[projectId] ?? [];
}

export const samplePortfolioEstimateDocuments: EstimateDocument[] = samplePortfolioProjects.map((project) => {
  const meta = samplePortfolioDocumentMeta[project.id as keyof typeof samplePortfolioDocumentMeta];
  const items = getSampleProjectItems(project.id);
  const totals = createSampleEstimateTotals(items);
  return {
    id: meta.estimateId,
    projectId: project.id,
    documentNumber: meta.estimateNumber,
    issuedAt: meta.issuedAt,
    title: "御見積書",
    expiresAt: "2026-08-31",
    remarks: "サンプル案件です。実運用時は現地条件に合わせて数量・単価を調整してください。",
    totalAmount: totals.afterTax,
    version: 1,
    status: "発行済",
    lineSnapshot: createSampleEstimateLineSnapshots(items),
    totalsSnapshot: totals,
    snapshotCreatedAt: `${meta.issuedAt}T09:00:00.000Z`,
    createdAt: `${meta.issuedAt}T09:00:00.000Z`,
    updatedAt: `${meta.issuedAt}T09:00:00.000Z`,
  };
});

export const samplePortfolioInvoiceDocuments: InvoiceDocument[] = samplePortfolioProjects.map((project) => {
  const meta = samplePortfolioDocumentMeta[project.id as keyof typeof samplePortfolioDocumentMeta];
  const items = getSampleProjectItems(project.id);
  const estimateTotals = createSampleEstimateTotals(items);
  const totals = createSampleInvoiceTotals(estimateTotals);
  const requestedPaidAmount = meta.paymentAmount === "full" ? totals.afterTax : meta.paymentAmount;
  const paidAmount = roundSampleCurrency(Math.min(totals.afterTax, requestedPaidAmount));
  const paymentRecords: PaymentRecord[] =
    paidAmount > 0
      ? [
          {
            id: `sample-payment-${project.id}`,
            invoiceId: meta.invoiceId,
            amount: paidAmount,
            paymentDate: meta.paymentDate,
            paymentMethod: meta.paymentMethod,
            note: paidAmount >= totals.afterTax ? "サンプル全額入金" : "サンプル一部入金",
            createdAt: `${meta.paymentDate}T10:00:00.000Z`,
            updatedAt: `${meta.paymentDate}T10:00:00.000Z`,
          },
        ]
      : [];
  return {
    id: meta.invoiceId,
    projectId: project.id,
    sourceEstimateDocumentId: meta.estimateId,
    documentNumber: meta.invoiceNumber,
    invoiceDate: meta.invoiceDate,
    dueDate: meta.dueDate,
    currentAmount: totals.beforeTax,
    cumulativeAmount: totals.beforeTax,
    progressRate: 1,
    paidAmount,
    paymentRecords,
    version: 1,
    status: paidAmount >= totals.afterTax ? "入金済" : "発行済",
    remarks: "サンプル請求書です。入金履歴の確認にも利用できます。",
    lineSnapshot: createSampleInvoiceLineSnapshots(items),
    totalsSnapshot: totals,
    snapshotCreatedAt: `${meta.invoiceDate}T09:00:00.000Z`,
    createdAt: `${meta.invoiceDate}T09:00:00.000Z`,
    updatedAt: `${meta.paymentDate}T10:00:00.000Z`,
  };
});

export const defaultCostSettings: ProjectCostSettings = {
  commonTemporaryRate: 0.03,
  siteManagementRate: 0.07,
  taxRate: 0.1,
};

export const defaultTaxSettings: TaxSettings = {
  standardTaxRate: 0.1,
  displayMode: "taxIncluded",
  reducedTaxEnabled: false,
  reducedTaxRate: 0.08,
  defaultWelfareRate,
  taxRoundingMode: "round",
  totalRoundingMode: "round",
  updatedAt: seedNow,
};

export const defaultDocumentNumberSettings: DocumentNumberSettings = {
  estimate: {
    prefix: "MTL-",
    digits: 4,
    nextNumber: 1,
  },
  invoice: {
    prefix: "INV-",
    digits: 4,
    nextNumber: 1,
  },
  updatedAt: seedNow,
};

export const defaultQuoteSettings: ProjectQuoteSettings = {
  title: "御見積書",
  expiresAt: "2026-06-30",
  remarks: "本見積は現地調査時点の条件に基づき作成しています。仕様変更や追加工事が発生した場合は別途協議といたします。",
  template: "standard",
};

export const defaultInvoiceSettings: ProjectInvoiceSettings = {
  invoiceNumber: "INV-2026-0001",
  invoiceDate: "2026-05-07",
  dueDate: "2026-06-30",
  remarks: "上記の通りご請求申し上げます。お支払い条件に基づき、期日までのお振込みをお願いいたします。",
  bankAccountId: null,
};

export const defaultProjectSealSettings: ProjectSealSettings = {
  enabled: true,
  sealImage: "",
  x: 920,
  y: 270,
  scale: 100,
  opacity: 1,
  logoEnabled: true,
  logoX: 900,
  logoY: 20,
  logoScale: 100,
  logoOpacity: 1,
};

function clampSealNumber(value: unknown, fallback: number, min: number, max: number) {
  const next = Number(value ?? fallback);
  if (!Number.isFinite(next)) return fallback;
  if (next < min) return min;
  if (next > max) return max;
  return next;
}

export function generateDocumentNumber(
  config: DocumentNumberConfig,
  _documents: Array<{ documentNumber: string }> = [],
) {
  const prefix = config.prefix || "";
  const nextNumber = Math.max(1, Math.floor(Number(config.nextNumber) || 1));
  return `${prefix}${String(nextNumber).padStart(config.digits, "0")}`;
}

export function normalizeProjectSealSettings(
  input: Partial<ProjectSealSettings> | undefined,
  fallbackSealImage = "",
): ProjectSealSettings {
  const current = input ?? {};
  return {
    ...defaultProjectSealSettings,
    ...current,
    enabled: current.enabled ?? defaultProjectSealSettings.enabled,
    logoEnabled: current.logoEnabled ?? defaultProjectSealSettings.logoEnabled,
    sealImage: current.sealImage || fallbackSealImage,
    x: Math.round(clampSealNumber(current.x, defaultProjectSealSettings.x, 0, 1000)),
    y: Math.round(clampSealNumber(current.y, defaultProjectSealSettings.y, 0, 1000)),
    scale: Math.round(clampSealNumber(current.scale, defaultProjectSealSettings.scale, 20, 240)),
    opacity: clampSealNumber(current.opacity, defaultProjectSealSettings.opacity, 0, 1),
    logoX: Math.round(clampSealNumber(current.logoX, defaultProjectSealSettings.logoX, 0, 1000)),
    logoY: Math.round(clampSealNumber(current.logoY, defaultProjectSealSettings.logoY, 0, 1000)),
    logoScale: Math.round(clampSealNumber(current.logoScale, defaultProjectSealSettings.logoScale, 20, 240)),
    logoOpacity: clampSealNumber(current.logoOpacity, defaultProjectSealSettings.logoOpacity, 0, 1),
  };
}

export const initialCompanyInfo: CompanyInfo = {
  legalName: "",
  shortName: "",
  postalCode: "",
  headOfficeAddress: "",
  siteAddress: "",
  phone: "",
  fax: "",
  contactName: "",
  contactPosition: "",
  contactTitle: "",
  constructionLicense: "",
  invoiceRegistrationNumber: "",
  email: "",
  website: "",
  bankAccounts: [],
  sealImage: "",
  logoImage: "",
  logoEnabled: true,
  updatedAt: seedNow,
};

export const initialPdfTemplateSettings: PdfTemplateSettings = {
  quoteBackgroundImage: "",
  invoiceBackgroundImage: "",
  sealOpacity: 0.75,
  sealSize: 80,
};

export function createBlankItem(projectId: string): ProjectItem {
  return {
    id: `item-${Date.now()}`,
    projectId,
    priceModelVersion: 2,
    itemType: "labor",
    majorCategory: "未分類",
    middleCategory: "新規項目",
    name: "工事項目",
    specification: "",
    unit: "式",
    quantity: 1,
    laborProductivity: 0,
    welfareRate: defaultWelfareRate,
    estimatedLaborProductivity: 0,
    actualLaborProductivity: 0,
    laborUnitCost: 24000,
    estimatedLaborUnitCost: 24000,
    actualLaborUnitCost: 24000,
    materialUnitCost: 0,
    baseCost: null,
    markupRate: 1,
    estimatedUnitCost: 0,
    actualUnitCost: 0,
    actualMaterialCost: 0,
    actualLaborCost: 0,
    actualOutsourcingCost: 0,
    expenseRate: 0,
    note: "",
    createdAt: seedNow,
    updatedAt: seedNow,
  };
}

export function createProjectItemFromMaster(projectId: string, master: WorkItemMaster): ProjectItem {
  return {
    id: `item-${Date.now()}-${master.id}`,
    projectId,
    priceModelVersion: 2,
    itemType: "labor",
    majorCategory: master.majorCategory,
    middleCategory: master.middleCategory,
    name: master.name,
    specification: "",
    unit: normalizeLaborUnit(master.unit),
    quantity: 1,
    laborProductivity: master.standardLaborProductivity,
    welfareRate: defaultWelfareRate,
    estimatedLaborProductivity: master.standardLaborProductivity,
    actualLaborProductivity: master.standardLaborProductivity,
    laborUnitCost: master.standardLaborUnitCost,
    estimatedLaborUnitCost: master.standardLaborUnitCost,
    actualLaborUnitCost: master.standardLaborUnitCost,
    materialUnitCost: master.standardMaterialUnitCost,
    baseCost: master.standardMaterialUnitCost || null,
    markupRate: 1,
    estimatedUnitCost: master.standardMaterialUnitCost,
    actualUnitCost: master.standardMaterialUnitCost,
    actualMaterialCost: 0,
    actualLaborCost: 0,
    actualOutsourcingCost: 0,
    expenseRate: 0,
    note: "",
    createdAt: seedNow,
    updatedAt: seedNow,
  };
}

function normalizeLaborUnit(unit: string) {
  return ["人", "人日", "時間", "日"].includes(unit) ? unit : "人日";
}

function defaultInteriorWorkItemMaster(
  middleCategory: string,
  name: string,
  unit: string,
  note = "",
): WorkItemMasterInput {
  return {
    majorCategory: "内装工事",
    middleCategory,
    name,
    unit,
    standardLaborProductivity: 0,
    standardLaborUnitCost: 0,
    standardMaterialUnitCost: 0,
    standardExpenseRate: 0,
    note,
  };
}

export const defaultInteriorWorkItemMasterInputs: WorkItemMasterInput[] = [
  defaultInteriorWorkItemMaster("床仕上げ系", "クッションフロア張り", "㎡", "住宅・店舗のCF床仕上げ"),
  defaultInteriorWorkItemMaster("床仕上げ系", "長尺シート張り", "㎡", "店舗・医療施設向け床仕上げ"),
  defaultInteriorWorkItemMaster("床仕上げ系", "塩ビタイル張り", "㎡", "Pタイル・フロアタイル仕上げ"),
  defaultInteriorWorkItemMaster("床仕上げ系", "フローリング張り（複合フローリング）", "㎡", "複合フローリング標準施工"),
  defaultInteriorWorkItemMaster("床仕上げ系", "フローリング張り（無垢材）", "㎡", "無垢フローリング施工"),
  defaultInteriorWorkItemMaster("床仕上げ系", "カーペットタイル張り", "㎡", "オフィス・店舗向け床仕上げ"),
  defaultInteriorWorkItemMaster("床仕上げ系", "畳敷き（新畳）", "畳", "新畳の敷き込み"),
  defaultInteriorWorkItemMaster("床仕上げ系", "畳表替え", "畳", "畳表替え"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "クロス張り（標準）", "㎡", "量産クロス標準"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "クロス張り（防かび・抗菌）", "㎡", "水回り・医療福祉向けクロス"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "クロス張り（和風・アクセントクロス）", "㎡", "意匠クロス・アクセント貼り"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "塗壁（漆喰）", "㎡", "漆喰仕上げ"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "塗壁（珪藻土）", "㎡", "珪藻土仕上げ"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "ボード下地＋クロス", "㎡", "石膏ボード下地からクロスまで"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "天井クロス張り", "㎡", "天井面のクロス仕上げ"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "システム天井", "㎡", "オフィス系システム天井"),
  defaultInteriorWorkItemMaster("壁・天井仕上げ系", "木目天井", "㎡", "木目調天井材・化粧板仕上げ"),
  defaultInteriorWorkItemMaster("造作・建具系", "造作棚・カウンター作成", "m", "造作棚・カウンターの作成"),
  defaultInteriorWorkItemMaster("造作・建具系", "室内建具枠調整・交換", "箇所", "建具枠の調整・交換"),
  defaultInteriorWorkItemMaster("造作・建具系", "巾木取付", "m", "ソフト巾木・木巾木取付"),
  defaultInteriorWorkItemMaster("造作・建具系", "廻り縁取付", "m", "天井廻り縁取付"),
  defaultInteriorWorkItemMaster("造作・建具系", "階段鼻面・蹴込み張り", "m", "階段鼻面・蹴込みの仕上げ"),
  defaultInteriorWorkItemMaster("造作・建具系", "手すり取付", "m", "廊下・階段手すり取付"),
  defaultInteriorWorkItemMaster("造作・建具系", "収納扉・折れ戸取付", "箇所", "収納扉・折れ戸の取付"),
  defaultInteriorWorkItemMaster("造作・建具系", "壁面パネル張り", "㎡", "壁面化粧パネルの取付"),
  defaultInteriorWorkItemMaster("造作・建具系", "化粧フィルム張り", "㎡", "建具・壁面の化粧フィルム仕上げ"),
  defaultInteriorWorkItemMaster("造作・建具系", "床見切り材取付", "m", "床仕上げ切替部の見切り材取付"),
  defaultInteriorWorkItemMaster("水回り内装系", "ユニットバス内装調整工事", "式", "UBまわりの開口・内装調整"),
  defaultInteriorWorkItemMaster("水回り内装系", "システムキッチン内装調整", "式", "キッチン交換に伴う内装調整"),
  defaultInteriorWorkItemMaster("水回り内装系", "トイレ内装調整", "箇所", "トイレ改修時の床壁調整"),
  defaultInteriorWorkItemMaster("水回り内装系", "洗面化粧台内装調整", "箇所", "洗面化粧台交換に伴う内装調整"),
  defaultInteriorWorkItemMaster("水回り内装系", "浴室・トイレの内装リフォーム", "式", "浴室・トイレまわりの内装一式"),
  defaultInteriorWorkItemMaster("その他内装系", "内部塗装（壁・天井）", "㎡", "壁・天井の内部塗装"),
  defaultInteriorWorkItemMaster("その他内装系", "内部塗装（木部・建具）", "㎡", "木部・建具の内部塗装"),
  defaultInteriorWorkItemMaster("その他内装系", "照明器具取付", "箇所", "照明器具の取付"),
  defaultInteriorWorkItemMaster("その他内装系", "カーテンレール・ブラインド取付", "箇所", "カーテンレール・ブラインド取付"),
  defaultInteriorWorkItemMaster("その他内装系", "ロールスクリーン取付", "箇所", "ロールスクリーンの取付"),
  defaultInteriorWorkItemMaster("その他内装系", "ピクチャーレール取付", "m", "壁面ピクチャーレールの取付"),
  defaultInteriorWorkItemMaster("その他内装系", "網戸張り替え", "枚", "網戸張替え"),
  defaultInteriorWorkItemMaster("その他内装系", "内部清掃・ハウスクリーニング", "㎡", "引渡し前清掃"),
  defaultInteriorWorkItemMaster("その他内装系", "床暖房フィルム・マット敷き", "㎡", "床暖房フィルム・マット敷設"),
  defaultInteriorWorkItemMaster("その他内装系", "コンセント・スイッチ移設", "箇所", "内装工事に伴うコンセント・スイッチ移設"),
  defaultInteriorWorkItemMaster("その他内装系", "家具移動・養生復旧", "式", "内装工事に伴う家具移動と復旧"),
];

export const initialWorkItemMasters: WorkItemMaster[] = defaultInteriorWorkItemMasterInputs.map((input, index) => ({
  id: `master-interior-${String(index + 1).padStart(3, "0")}`,
  ...input,
  favorite: index < 6,
  createdAt: seedNow,
  updatedAt: seedNow,
}));

export const initialMaterialMasters: MaterialMaster[] = [
  ["塩化ビニールタイル", "CF-12345", "東リ", "厚み3mm / 置敷き対応", "㎡", 3200, "床仕上げ標準材"],
  ["長尺シート", "NS-2040", "サンゲツ", "2.0mm / 抗菌仕様", "㎡", 3600, "医療・福祉施設向け"],
  ["クッションフロア", "HM-11042", "サンゲツ", "1.8mm / 木目調", "㎡", 1850, "住宅リフォーム向け"],
  ["ダイノックフィルム", "FW-1122", "3M", "木目 / 屋内壁面用", "㎡", 5200, "下地処理別途"],
  ["石膏ボード", "GB-R12.5", "吉野石膏", "12.5mm 3x6版", "枚", 680, "壁・天井下地"],
  ["LGSスタッド", "LGS-65", "桐井製作所", "65形 / 3m", "本", 520, "間仕切り下地"],
  ["構造用合板", "PLY-12", "ノダ", "12mm 3x6版 F☆☆☆☆", "枚", 2380, "床下地・壁下地"],
  ["断熱材グラスウール", "GW-100", "旭ファイバーグラス", "100mm / 16K", "㎡", 1450, "壁・天井断熱"],
].map(([productName, productNumber, manufacturer, specification, unit, materialUnitCost, note], index) => ({
  id: `material-${String(index + 1).padStart(3, "0")}`,
  category: "資材・建材",
  productName: String(productName),
  productNumber: String(productNumber),
  manufacturer: String(manufacturer),
  specification: String(specification),
  unit: String(unit),
  materialUnitCost: Number(materialUnitCost),
  favorite: index < 3,
  note: String(note),
  createdAt: seedNow,
  updatedAt: seedNow,
}));

export function createSampleItems(projectId: string): ProjectItem[] {
  const timestamp = Date.now();
  return [
    {
      ...createBlankItem(projectId),
      id: `item-${timestamp}-01`,
      majorCategory: "内装工事",
      middleCategory: "床仕上",
      name: "フローリング張り",
      specification: "オーク材 厚15mm",
      unit: "㎡",
      quantity: 52,
      laborProductivity: 0.16,
      estimatedLaborProductivity: 0.16,
      actualLaborProductivity: 0.16,
      estimatedUnitCost: 9800,
      actualUnitCost: 6200,
      materialUnitCost: 6200,
      expenseRate: 0.08,
      note: "無垢材グレードB",
    },
    {
      ...createBlankItem(projectId),
      id: `item-${timestamp}-02`,
      majorCategory: "内装工事",
      middleCategory: "壁仕上",
      name: "クロス貼替",
      specification: "量産クロス SP級",
      unit: "㎡",
      quantity: 130,
      laborProductivity: 0.035,
      estimatedLaborProductivity: 0.035,
      actualLaborProductivity: 0.035,
      estimatedUnitCost: 1850,
      actualUnitCost: 980,
      materialUnitCost: 980,
      expenseRate: 0.06,
      note: "量産クロス",
    },
    {
      ...createBlankItem(projectId),
      id: `item-${timestamp}-03`,
      majorCategory: "設備工事",
      middleCategory: "給排水",
      name: "給排水配管更新",
      specification: "架橋ポリエチレン管",
      unit: "箇所",
      quantity: 4,
      laborProductivity: 0.8,
      estimatedLaborProductivity: 0.8,
      actualLaborProductivity: 0.8,
      laborUnitCost: 30000,
      estimatedLaborUnitCost: 30000,
      actualLaborUnitCost: 30000,
      materialUnitCost: 18500,
      estimatedUnitCost: 62000,
      actualUnitCost: 18500,
      expenseRate: 0.12,
      note: "キッチン・洗面・浴室",
    },
  ];
}

export const initialCustomers: Customer[] = samplePortfolioCustomers;

export const initialProjects: Project[] = samplePortfolioProjects;

export const initialProjectItems: ProjectItem[] = samplePortfolioProjectItems;

export const initialEstimateDocuments: EstimateDocument[] = samplePortfolioEstimateDocuments;

export const initialInvoiceDocuments: InvoiceDocument[] = samplePortfolioInvoiceDocuments;

export const initialDeliveryDocuments: DeliveryDocument[] = [];

export const initialOrderDocuments: OrderDocument[] = [];

export const initialBillingCloseRecords: BillingCloseRecord[] = [];
