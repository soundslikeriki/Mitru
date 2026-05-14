export type ProjectStatus = "見積中" | "契約済" | "施工中" | "完了" | "請求済み";

export type Project = {
  id: string;
  customerId?: string;
  name: string;
  clientName: string;
  clientCompanyName?: string;
  constructionName: string;
  location: string;
  startDate: string;
  endDate: string;
  expectedPaymentDate?: string;
  nextActionDate?: string;
  processMemo?: string;
  ownerMemo?: string;
  status: ProjectStatus;
  totalAmount: number;
  progress: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type NewProjectInput = {
  customerId?: string;
  name: string;
  clientName: string;
  clientCompanyName?: string;
  constructionName: string;
  location: string;
  startDate: string;
  endDate: string;
  expectedPaymentDate?: string;
  nextActionDate?: string;
  processMemo?: string;
  ownerMemo?: string;
  note: string;
};

export type CustomerType = "個人" | "法人" | "設計事務所" | "不動産会社" | "その他";
export type CustomerStatus = "新規" | "既存";

export type Customer = {
  id: string;
  name: string;
  companyName: string;
  position: string;
  postalCode: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  type: CustomerType;
  status: CustomerStatus;
  note: string;
  memo: string;
  website: string;
  businessCards: string[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = Omit<Customer, "id" | "createdAt" | "updatedAt">;

export type ProjectItem = {
  id: string;
  projectId: string;
  priceModelVersion?: 1 | 2;
  itemType?: "labor" | "material";
  majorCategory: string;
  middleCategory: string;
  name: string;
  specification: string;
  unit: string;
  quantity: number;
  laborProductivity: number;
  welfareRate?: number;
  estimatedLaborProductivity?: number;
  actualLaborProductivity?: number;
  laborUnitCost: number;
  estimatedLaborUnitCost?: number;
  actualLaborUnitCost?: number;
  materialUnitCost: number;
  estimatedUnitCost?: number;
  actualUnitCost?: number;
  actualMaterialCost?: number;
  actualLaborCost?: number;
  actualOutsourcingCost?: number;
  expenseRate: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectItemTemplateInput = Omit<ProjectItem, "id" | "projectId" | "createdAt" | "updatedAt">;

export type ProjectCostSettings = {
  commonTemporaryRate: number;
  siteManagementRate: number;
  taxRate: number;
};

export type TaxDisplayMode = "taxIncluded" | "taxExcluded";
export type TaxRoundingMode = "round" | "floor" | "ceil";

export type TaxSettings = {
  standardTaxRate: 0.08 | 0.1;
  displayMode: TaxDisplayMode;
  reducedTaxEnabled: boolean;
  reducedTaxRate: 0.08;
  defaultWelfareRate: number;
  taxRoundingMode: TaxRoundingMode;
  totalRoundingMode: TaxRoundingMode;
  updatedAt: string;
};

export type DocumentNumberConfig = {
  prefix: string;
  digits: 4 | 5 | 6;
  nextNumber: number;
};

export type DocumentNumberSettings = {
  estimate: DocumentNumberConfig;
  invoice: DocumentNumberConfig;
  updatedAt: string;
};

export type ProjectQuoteSettings = {
  title: string;
  expiresAt: string;
  remarks: string;
  template: "standard" | "renovation" | "new-build";
};

export type ProjectInvoiceSettings = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  remarks: string;
};

export type ProjectInvoiceItemState = {
  previousRate: number;
  currentRate: number;
};

export type EstimateDocumentStatus = "下書き" | "発行済" | "失効";

export type DocumentCalculationLineSnapshot = {
  laborCost: number;
  welfareCost: number;
  totalLaborCost: number;
  materialCost: number;
  expenseCost: number;
  subtotal: number;
};

export type EstimateTotalsSnapshot = {
  laborCost: number;
  welfareCost: number;
  totalLaborCost: number;
  materialCost: number;
  expenseCost: number;
  directSubtotal: number;
  commonTemporaryCost: number;
  siteManagementCost: number;
  beforeTax: number;
  tax: number;
  afterTax: number;
};

export type InvoiceTotalsSnapshot = {
  previousBeforeTax: number;
  beforeTax: number;
  cumulativeBeforeTax: number;
  tax: number;
  afterTax: number;
};

export type EstimateLineSnapshot = {
  item: ProjectItem;
  line: DocumentCalculationLineSnapshot;
  unitPrice: number;
};

export type InvoiceLineSnapshot = {
  item: ProjectItem;
  line: DocumentCalculationLineSnapshot;
  previousRate: number;
  currentRate: number;
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
};

export type PaymentMethod = "銀行振込" | "現金" | "カード" | "その他";

export type PaymentRecord = {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  note: string;
  createdAt: string;
};

export type PurchaseRecord = {
  id: string;
  orderId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  note: string;
  createdAt: string;
};

export type OrderLineSnapshot = {
  sourceItemId: string;
  majorCategory: string;
  middleCategory?: string;
  name: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type BillingCloseRecord = {
  id: string;
  closingDate: string;
  clientName: string;
  customerKey: string;
  targetEstimateIds: string[];
  createdInvoiceIds: string[];
  totalAmount: number;
  status: "作成済";
  createdAt: string;
};

export type EstimateDocument = {
  id: string;
  projectId: string;
  documentNumber: string;
  issuedAt: string;
  title: string;
  expiresAt: string;
  remarks: string;
  totalAmount: number;
  version: number;
  status: EstimateDocumentStatus;
  lineSnapshot?: EstimateLineSnapshot[];
  totalsSnapshot?: EstimateTotalsSnapshot;
  snapshotCreatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDocument = {
  id: string;
  projectId: string;
  sourceEstimateDocumentId?: string;
  documentNumber: string;
  invoiceDate: string;
  dueDate: string;
  currentAmount: number;
  cumulativeAmount: number;
  progressRate: number;
  paidAmount?: number;
  paymentRecords?: PaymentRecord[];
  version: number;
  status: "下書き" | "発行済" | "入金済";
  remarks: string;
  lineSnapshot?: InvoiceLineSnapshot[];
  totalsSnapshot?: InvoiceTotalsSnapshot;
  snapshotCreatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryDocumentStatus = "未発行" | "発行済" | "納品済";
export type OrderDocumentStatus = "未発行" | "発行済" | "発注済";
export type WorkflowDocumentSourceKind = "calculation" | "estimate" | "invoice" | "template";

export type DeliveryDocument = {
  id: string;
  projectId: string;
  sourceDocumentId?: string;
  sourceDocumentKind: WorkflowDocumentSourceKind;
  documentNumber: string;
  issuedAt: string;
  deliveryDate: string;
  title: string;
  totalAmount: number;
  itemCount: number;
  status: DeliveryDocumentStatus;
  remarks: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderDocument = {
  id: string;
  projectId: string;
  sourceDocumentId?: string;
  sourceDocumentKind: WorkflowDocumentSourceKind;
  documentNumber: string;
  orderedAt: string;
  dueDate: string;
  supplierName: string;
  title: string;
  totalAmount: number;
  itemCount: number;
  status: OrderDocumentStatus;
  orderLineSnapshot?: OrderLineSnapshot[];
  purchasedAmount?: number;
  purchaseRecords?: PurchaseRecord[];
  remarks: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkItemMaster = {
  id: string;
  majorCategory: string;
  middleCategory: string;
  name: string;
  unit: string;
  standardLaborProductivity: number;
  standardLaborUnitCost: number;
  standardMaterialUnitCost: number;
  standardExpenseRate: number;
  favorite: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkItemMasterInput = Omit<WorkItemMaster, "id" | "favorite" | "createdAt" | "updatedAt"> & {
  favorite?: boolean;
};

export type MaterialCategory = "資材・建材" | "電気資材" | "水道・衛生資材" | "副資材・消耗品" | "その他";

export type MaterialMaster = {
  id: string;
  category?: MaterialCategory;
  productName: string;
  productNumber: string;
  manufacturer: string;
  specification: string;
  unit: string;
  materialUnitCost: number;
  favorite: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type MaterialMasterInput = Omit<MaterialMaster, "id" | "favorite" | "createdAt" | "updatedAt"> & {
  favorite?: boolean;
};

export type BankAccount = {
  id: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
};

export type CompanyInfo = {
  legalName: string;
  shortName: string;
  postalCode: string;
  headOfficeAddress: string;
  siteAddress: string;
  phone: string;
  fax: string;
  contactName: string;
  contactTitle: string;
  constructionLicense: string;
  invoiceRegistrationNumber: string;
  email: string;
  website: string;
  bankAccounts: BankAccount[];
  sealImage: string;
  logoImage: string;
  logoEnabled: boolean;
  updatedAt: string;
};

export type PdfTemplateSettings = {
  quoteBackgroundImage: string;
  invoiceBackgroundImage: string;
  sealOpacity: number;
  sealSize: number;
};

export type ProjectSealSettings = {
  enabled: boolean;
  sealImage: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  logoEnabled: boolean;
  logoX: number;
  logoY: number;
  logoScale: number;
  logoOpacity: number;
};

export type MitruBackupData = {
  app: "mitru";
  version: number;
  storeVersion: number;
  exportedAt: string;
  customers: Customer[];
  projects: Project[];
  projectItems: ProjectItem[];
  workItemMasters: WorkItemMaster[];
  materialMasters: MaterialMaster[];
  costSettingsByProjectId: Record<string, ProjectCostSettings>;
  quoteSettingsByProjectId: Record<string, ProjectQuoteSettings>;
  invoiceSettingsByProjectId: Record<string, ProjectInvoiceSettings>;
  invoiceItemsByItemId: Record<string, ProjectInvoiceItemState>;
  sealSettingsByProjectId: Record<string, ProjectSealSettings>;
  estimateDocuments: EstimateDocument[];
  invoiceDocuments: InvoiceDocument[];
  deliveryDocuments: DeliveryDocument[];
  orderDocuments: OrderDocument[];
  billingCloseRecords: BillingCloseRecord[];
  companyInfo: CompanyInfo;
  pdfTemplateSettings: PdfTemplateSettings;
  taxSettings: TaxSettings;
  documentNumberSettings: DocumentNumberSettings;
};

export type ProjectStore = {
  customers: Customer[];
  projects: Project[];
  projectItems: ProjectItem[];
  workItemMasters: WorkItemMaster[];
  materialMasters: MaterialMaster[];
  costSettingsByProjectId: Record<string, ProjectCostSettings>;
  quoteSettingsByProjectId: Record<string, ProjectQuoteSettings>;
  invoiceSettingsByProjectId: Record<string, ProjectInvoiceSettings>;
  invoiceItemsByItemId: Record<string, ProjectInvoiceItemState>;
  sealSettingsByProjectId: Record<string, ProjectSealSettings>;
  estimateDocuments: EstimateDocument[];
  invoiceDocuments: InvoiceDocument[];
  deliveryDocuments: DeliveryDocument[];
  orderDocuments: OrderDocument[];
  billingCloseRecords: BillingCloseRecord[];
  companyInfo: CompanyInfo;
  pdfTemplateSettings: PdfTemplateSettings;
  taxSettings: TaxSettings;
  documentNumberSettings: DocumentNumberSettings;
  createCustomer: (input: CustomerInput) => Customer;
  updateCustomer: (id: string, input: Partial<CustomerInput>) => void;
  deleteCustomer: (id: string) => void;
  createProject: (input: NewProjectInput) => Project;
  updateProject: (id: string, input: Partial<Omit<Project, "id" | "createdAt">>) => void;
  deleteProject: (id: string) => void;
  addProjectItem: (projectId: string) => void;
  addProjectItemFromMaster: (projectId: string, masterId: string) => ProjectItem | undefined;
  addProjectItemFromTemplate: (projectId: string, template: ProjectItemTemplateInput) => ProjectItem;
  importSampleItems: (projectId: string) => void;
  updateProjectItemPricesFromMasters: (projectId: string) => number;
  updateProjectItem: (id: string, input: Partial<Omit<ProjectItem, "id" | "projectId" | "createdAt">>) => void;
  deleteProjectItem: (id: string) => void;
  updateCostSettings: (projectId: string, input: Partial<ProjectCostSettings>) => void;
  updateQuoteSettings: (projectId: string, input: Partial<ProjectQuoteSettings>) => void;
  updateInvoiceSettings: (projectId: string, input: Partial<ProjectInvoiceSettings>) => void;
  updateInvoiceItemState: (itemId: string, input: Partial<ProjectInvoiceItemState>) => void;
  updateInvoiceItemStates: (inputs: Record<string, Partial<ProjectInvoiceItemState>>) => void;
  updateProjectSealSettings: (projectId: string, input: Partial<ProjectSealSettings>) => void;
  createEstimateDocument: (projectId: string, input: Omit<EstimateDocument, "id" | "projectId" | "createdAt" | "updatedAt">) => EstimateDocument;
  duplicateEstimateDocument: (documentId: string) => EstimateDocument | undefined;
  updateEstimateDocument: (documentId: string, input: Partial<Omit<EstimateDocument, "id" | "projectId" | "createdAt">>) => void;
  updateEstimateDocumentStatus: (documentId: string, status: EstimateDocumentStatus) => void;
  deleteEstimateDocument: (documentId: string) => void;
  createInvoiceDocument: (projectId: string, input: Omit<InvoiceDocument, "id" | "projectId" | "createdAt" | "updatedAt">) => InvoiceDocument;
  duplicateInvoiceDocument: (documentId: string) => InvoiceDocument | undefined;
  updateInvoiceDocument: (documentId: string, input: Partial<Omit<InvoiceDocument, "id" | "projectId" | "createdAt">>) => void;
  updateInvoiceDocumentStatus: (documentId: string, status: InvoiceDocument["status"]) => void;
  registerInvoicePayment: (
    invoiceId: string,
    input: Omit<PaymentRecord, "id" | "invoiceId" | "createdAt">,
  ) => PaymentRecord | undefined;
  deleteInvoicePayment: (invoiceId: string, paymentId: string) => void;
  deleteInvoiceDocument: (documentId: string) => void;
  createBillingCloseRun: (input: { closingDate: string; estimateIds: string[] }) => BillingCloseRecord[];
  createDeliveryDocument: (projectId: string, input: Omit<DeliveryDocument, "id" | "projectId" | "createdAt" | "updatedAt">) => DeliveryDocument;
  duplicateDeliveryDocument: (documentId: string) => DeliveryDocument | undefined;
  deleteDeliveryDocument: (documentId: string) => void;
  createOrderDocument: (projectId: string, input: Omit<OrderDocument, "id" | "projectId" | "createdAt" | "updatedAt">) => OrderDocument;
  createPurchaseOrderFromItem: (
    projectId: string,
    itemId: string,
    input: {
      supplierName: string;
      quantity: number;
      unitPrice: number;
      dueDate: string;
      remarks?: string;
    },
  ) => OrderDocument | undefined;
  duplicateOrderDocument: (documentId: string) => OrderDocument | undefined;
  registerOrderPurchase: (
    orderId: string,
    input: Omit<PurchaseRecord, "id" | "orderId" | "createdAt">,
  ) => PurchaseRecord | undefined;
  deleteOrderPurchase: (orderId: string, purchaseId: string) => void;
  deleteOrderDocument: (documentId: string) => void;
  createWorkItemMaster: (input: WorkItemMasterInput) => WorkItemMaster;
  updateWorkItemMaster: (id: string, input: Partial<WorkItemMasterInput>) => void;
  deleteWorkItemMaster: (id: string) => void;
  clearWorkItemMasters: () => void;
  resetWorkItemMasterCosts: () => void;
  toggleWorkItemMasterFavorite: (id: string) => void;
  createMaterialMaster: (input: MaterialMasterInput) => MaterialMaster;
  updateMaterialMaster: (id: string, input: Partial<MaterialMasterInput>) => void;
  deleteMaterialMaster: (id: string) => void;
  toggleMaterialMasterFavorite: (id: string) => void;
  updateCompanyInfo: (input: Partial<CompanyInfo>) => void;
  addBankAccount: () => void;
  updateBankAccount: (id: string, input: Partial<BankAccount>) => void;
  deleteBankAccount: (id: string) => void;
  updatePdfTemplateSettings: (input: Partial<PdfTemplateSettings>) => void;
  updateTaxSettings: (input: Partial<Omit<TaxSettings, "updatedAt">>) => void;
  updateDocumentNumberSettings: (input: Partial<{
    estimate: Partial<DocumentNumberConfig>;
    invoice: Partial<DocumentNumberConfig>;
  }>) => void;
  lastBackupAt: string;
  markBackupCreated: () => void;
  exportBackupData: () => MitruBackupData;
  restoreBackupData: (data: MitruBackupData, mode: "overwrite" | "merge") => void;
  resetBusinessDataKeepingMasters: () => void;
};

export type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
export type StoreGet = () => ProjectStore;

export type SliceContext = {
  set: StoreSet;
  get: StoreGet;
  now: () => string;
};
