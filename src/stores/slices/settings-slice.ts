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
      set({
        companyInfo: {
          ...get().companyInfo,
          bankAccounts: get().companyInfo.bankAccounts.map((account) =>
            account.id === id ? { ...account, ...input } : account,
          ),
          updatedAt: now(),
        },
      });
    },
    deleteBankAccount: (id: string) => {
      set({
        companyInfo: {
          ...get().companyInfo,
          bankAccounts: get().companyInfo.bankAccounts.filter((account) => account.id !== id),
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
