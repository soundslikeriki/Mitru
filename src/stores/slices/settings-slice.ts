import type {
  BankAccount,
  CompanyInfo,
  DocumentNumberConfig,
  PdfTemplateSettings,
  SliceContext,
  TaxSettings,
} from "./types";

export const settingsSliceVersion = 2;

export function createSettingsSlice({ set, get, now }: SliceContext) {
  return {
    updateCompanyInfo: (input: Partial<CompanyInfo>) => {
      set({ companyInfo: { ...get().companyInfo, ...input, updatedAt: now() } });
    },
    addBankAccount: () => {
      const account: BankAccount = {
        id: `bank-${Date.now()}`,
        bankName: "",
        branchName: "",
        accountType: "普通",
        accountNumber: "",
        accountHolder: "",
        isDefault: get().companyInfo.bankAccounts.length === 0,
      };
      set({
        companyInfo: {
          ...get().companyInfo,
          bankAccounts: [...get().companyInfo.bankAccounts, account],
          updatedAt: now(),
        },
      });
    },
    updateBankAccount: (id: string, input: Partial<BankAccount>) => {
      const nextAccounts = get().companyInfo.bankAccounts.map((account) =>
        account.id === id ? { ...account, ...input } : input.isDefault ? { ...account, isDefault: false } : account,
      );
      set({
        companyInfo: {
          ...get().companyInfo,
          bankAccounts: ensureDefaultBankAccount(nextAccounts),
          updatedAt: now(),
        },
      });
    },
    setDefaultBankAccount: (id: string) => {
      set({
        companyInfo: {
          ...get().companyInfo,
          bankAccounts: get().companyInfo.bankAccounts.map((account) => ({
            ...account,
            isDefault: account.id === id,
          })),
          updatedAt: now(),
        },
      });
    },
    deleteBankAccount: (id: string) => {
      const nextAccounts = get().companyInfo.bankAccounts.filter((account) => account.id !== id);
      set({
        companyInfo: {
          ...get().companyInfo,
          bankAccounts: ensureDefaultBankAccount(nextAccounts),
          updatedAt: now(),
        },
      });
    },
    updatePdfTemplateSettings: (input: Partial<PdfTemplateSettings>) => {
      set({ pdfTemplateSettings: { ...get().pdfTemplateSettings, ...input } });
    },
    updateTaxSettings: (input: Partial<Omit<TaxSettings, "updatedAt">>) => {
      set({ taxSettings: { ...get().taxSettings, ...input, updatedAt: now() } });
    },
    updateDocumentNumberSettings: (input: Partial<{
      estimate: Partial<DocumentNumberConfig>;
      invoice: Partial<DocumentNumberConfig>;
    }>) => {
      const current = get().documentNumberSettings;
      set({
        documentNumberSettings: {
          estimate: { ...current.estimate, ...input.estimate },
          invoice: { ...current.invoice, ...input.invoice },
          updatedAt: now(),
        },
      });
    },
  };
}

function ensureDefaultBankAccount(accounts: BankAccount[]) {
  if (accounts.length === 0) return [];
  if (accounts.some((account) => account.isDefault)) {
    let defaultFound = false;
    return accounts.map((account) => {
      if (!account.isDefault) return account;
      if (defaultFound) return { ...account, isDefault: false };
      defaultFound = true;
      return account;
    });
  }
  return accounts.map((account, index) => ({ ...account, isDefault: index === 0 }));
}
