import type { Customer, SliceContext } from "./types";

export const customerSliceVersion = 2;

export function createCustomerSlice({ set, get, now }: SliceContext) {
  return {
    createCustomer: (input: Omit<Customer, "id" | "createdAt" | "updatedAt">) => {
      const customer: Customer = {
        id: `customer-${Date.now()}`,
        ...input,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      set({ customers: [customer, ...get().customers] });
      return customer;
    },
    updateCustomer: (id: string, input: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt">>) => {
      set({
        customers: get().customers.map((customer) =>
          customer.id === id ? { ...customer, ...input, syncMetadata: markSyncMetadataDirty(customer.syncMetadata), updatedAt: now() } : customer,
        ),
      });
    },
    deleteCustomer: (id: string) => {
      const deletedAt = now();
      set({
        customers: get().customers.map((customer) =>
          customer.id === id ? { ...customer, deletedAt, syncMetadata: markSyncMetadataDirty(customer.syncMetadata), updatedAt: deletedAt } : customer,
        ),
      });
    },
  };
}

function markSyncMetadataDirty<TSyncMetadata extends { lastSyncedAt: string | null } | undefined>(
  syncMetadata: TSyncMetadata,
) {
  return syncMetadata ? { ...syncMetadata, lastSyncedAt: null } : syncMetadata;
}
