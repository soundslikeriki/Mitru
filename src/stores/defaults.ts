import type {
  CompanyInfo,
  BillingCloseRecord,
  Customer,
  DeliveryDocument,
  DocumentNumberConfig,
  DocumentNumberSettings,
  EstimateDocument,
  InvoiceDocument,
  MaterialCategory,
  MaterialMaster,
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

export const initialCustomers: Customer[] = [];

export const initialProjects: Project[] = [];

export const initialProjectItems: ProjectItem[] = [];

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
];

export const samplePortfolioProjects: Project[] = [
  {
    id: "sample-project-clinic",
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
    status: "見積中",
    totalAmount: 2810000,
    progress: 18,
    note: "高粗利パターンのサンプル案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-project-apparel",
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
    status: "見積中",
    totalAmount: 2360000,
    progress: 12,
    note: "中粗利パターンのサンプル案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: "sample-project-cafe",
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
    status: "見積中",
    totalAmount: 2630000,
    progress: 8,
    note: "低粗利パターンのサンプル案件。",
    createdAt: seedNow,
    updatedAt: seedNow,
  },
];

export const samplePortfolioActualCosts: Record<string, Pick<ProjectItem, "actualMaterialCost" | "actualLaborCost" | "actualOutsourcingCost">> = {
  "sample-clinic-01": { actualMaterialCost: 27000, actualLaborCost: 45000, actualOutsourcingCost: 0 },
  "sample-clinic-02": { actualMaterialCost: 90000, actualLaborCost: 138000, actualOutsourcingCost: 0 },
  "sample-clinic-03": { actualMaterialCost: 94000, actualLaborCost: 131000, actualOutsourcingCost: 0 },
  "sample-clinic-04": { actualMaterialCost: 93000, actualLaborCost: 94000, actualOutsourcingCost: 0 },
  "sample-clinic-05": { actualMaterialCost: 140000, actualLaborCost: 119000, actualOutsourcingCost: 0 },
  "sample-clinic-06": { actualMaterialCost: 34500, actualLaborCost: 0, actualOutsourcingCost: 55000 },
  "sample-apparel-01": { actualMaterialCost: 24000, actualLaborCost: 24000, actualOutsourcingCost: 0 },
  "sample-apparel-02": { actualMaterialCost: 20000, actualLaborCost: 55000, actualOutsourcingCost: 75000 },
  "sample-apparel-03": { actualMaterialCost: 185000, actualLaborCost: 119000, actualOutsourcingCost: 70000 },
  "sample-apparel-04": { actualMaterialCost: 70000, actualLaborCost: 80000, actualOutsourcingCost: 13000 },
  "sample-apparel-05": { actualMaterialCost: 165000, actualLaborCost: 67000, actualOutsourcingCost: 20000 },
  "sample-apparel-06": { actualMaterialCost: 140000, actualLaborCost: 47000, actualOutsourcingCost: 59700 },
  "sample-cafe-01": { actualMaterialCost: 23000, actualLaborCost: 25000, actualOutsourcingCost: 0 },
  "sample-cafe-02": { actualMaterialCost: 25000, actualLaborCost: 63000, actualOutsourcingCost: 100000 },
  "sample-cafe-03": { actualMaterialCost: 205000, actualLaborCost: 105000, actualOutsourcingCost: 72000 },
  "sample-cafe-04": { actualMaterialCost: 112000, actualLaborCost: 52000, actualOutsourcingCost: 20000 },
  "sample-cafe-05": { actualMaterialCost: 175000, actualLaborCost: 78000, actualOutsourcingCost: 152000 },
  "sample-cafe-06": { actualMaterialCost: 112000, actualLaborCost: 48000, actualOutsourcingCost: 114000 },
  "sample-cafe-07": { actualMaterialCost: 98000, actualLaborCost: 36000, actualOutsourcingCost: 45400 },
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
  return {
    id,
    projectId,
    priceModelVersion: 2,
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
    actualLaborUnitCost,
    materialUnitCost: estimatedUnitCost,
    estimatedUnitCost,
    actualUnitCost,
    expenseRate,
    note,
    ...samplePortfolioActualCosts[id],
    createdAt: seedNow,
    updatedAt: seedNow,
  };
}

export const samplePortfolioProjectItems: ProjectItem[] = [
  sampleItem("sample-clinic-01", "sample-project-clinic", "仮設工事", "養生", "床・壁養生", "診療エリア防塵養生", "㎡", 85, 1050, 320, 0.025, 24000, 22000, 0.05),
  sampleItem("sample-clinic-02", "sample-project-clinic", "内装工事", "軽鉄下地工事", "間仕切り下地", "LGS65 + 開口補強", "㎡", 48, 6200, 1900, 0.12, 26000, 24000, 0.08),
  sampleItem("sample-clinic-03", "sample-project-clinic", "内装工事", "石膏ボード工事", "耐水ボード貼り", "12.5mm / 一部耐水", "㎡", 96, 3600, 980, 0.06, 25000, 23000, 0.07),
  sampleItem("sample-clinic-04", "sample-project-clinic", "内装工事", "クロス貼り工事", "抗菌クロス貼り", "医療施設向け抗菌クロス", "㎡", 180, 1600, 520, 0.024, 24000, 22000, 0.06),
  sampleItem("sample-clinic-05", "sample-project-clinic", "内装工事", "床仕上げ工事", "長尺シート張り", "抗菌長尺シート", "㎡", 72, 5600, 1850, 0.07, 26000, 24000, 0.07),
  sampleItem("sample-clinic-06", "sample-project-clinic", "電気工事", "照明器具設置", "LEDベースライト交換", "既存配線利用", "台", 16, 13000, 5200, 0.12, 28000, 25000, 0.08),

  sampleItem("sample-apparel-01", "sample-project-apparel", "仮設工事", "養生", "売場養生", "既存床・什器保護", "㎡", 70, 900, 350, 0.024, 24000, 23000, 0.05),
  sampleItem("sample-apparel-02", "sample-project-apparel", "解体工事", "内装解体工事", "既存什器撤去", "一部再利用材あり", "式", 1, 180000, 85000, 1.4, 27000, 26000, 0.08),
  sampleItem("sample-apparel-03", "sample-project-apparel", "木工事", "造作工事", "壁面ディスプレイ造作", "可動棚含む", "式", 1, 520000, 250000, 3.5, 29000, 28000, 0.1),
  sampleItem("sample-apparel-04", "sample-project-apparel", "内装工事", "塗装工事", "壁面塗装", "AEP 2回塗り", "㎡", 110, 2100, 900, 0.035, 25000, 24000, 0.07),
  sampleItem("sample-apparel-05", "sample-project-apparel", "内装工事", "床仕上げ工事", "塩ビタイル張り", "店舗用重歩行", "㎡", 68, 5200, 2600, 0.065, 26000, 25000, 0.08),
  sampleItem("sample-apparel-06", "sample-project-apparel", "電気工事", "照明器具設置", "ライティングレール・スポット", "売場演出照明", "式", 1, 390000, 235000, 1.8, 28000, 27000, 0.09),

  sampleItem("sample-cafe-01", "sample-project-cafe", "仮設工事", "養生", "客席・厨房養生", "搬入経路含む", "㎡", 64, 950, 500, 0.03, 24000, 24000, 0.05),
  sampleItem("sample-cafe-02", "sample-project-cafe", "解体工事", "内装解体工事", "既存カウンター撤去", "処分費込み", "式", 1, 220000, 150000, 1.6, 27000, 27000, 0.08),
  sampleItem("sample-cafe-03", "sample-project-cafe", "木工事", "造作工事", "カウンター造作", "メラミン天板", "式", 1, 480000, 340000, 3.0, 30000, 30000, 0.08),
  sampleItem("sample-cafe-04", "sample-project-cafe", "内装工事", "床仕上げ工事", "厨房床シート張り", "防滑長尺シート", "㎡", 38, 6200, 3900, 0.08, 26000, 26000, 0.07),
  sampleItem("sample-cafe-05", "sample-project-cafe", "給排水衛生工事", "給排水管工事", "厨房給排水切回し", "露出配管一部更新", "式", 1, 520000, 430000, 2.4, 31000, 32000, 0.08),
  sampleItem("sample-cafe-06", "sample-project-cafe", "電気工事", "配線工事", "厨房機器用電源増設", "専用回路追加", "式", 1, 360000, 285000, 1.6, 29000, 30000, 0.08),
  sampleItem("sample-cafe-07", "sample-project-cafe", "空調換気工事", "換気設備工事", "排気ファン交換", "厨房換気能力増強", "式", 1, 280000, 230000, 1.1, 30000, 31000, 0.08),
];

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
    sealImage: current.sealImage || fallbackSealImage,
    x: 920,
    y: 270,
    scale: 100,
    opacity: 1,
    logoX: Number(current.logoX ?? defaultProjectSealSettings.logoX),
    logoY: Number(current.logoY ?? defaultProjectSealSettings.logoY),
    logoScale: Number(current.logoScale ?? defaultProjectSealSettings.logoScale),
    logoOpacity: Number(current.logoOpacity ?? defaultProjectSealSettings.logoOpacity),
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

export const initialEstimateDocuments: EstimateDocument[] = [];

export const initialInvoiceDocuments: InvoiceDocument[] = [];

export const initialDeliveryDocuments: DeliveryDocument[] = [];

export const initialOrderDocuments: OrderDocument[] = [];

export const initialBillingCloseRecords: BillingCloseRecord[] = [];
