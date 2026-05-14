import type { Customer, SliceContext } from "./types";

export const customerSliceVersion = 2;

export function createCustomerSlice({ set, get, now }: SliceContext) {
  return {
    createCustomer: (input: Omit<Customer, "id" | "createdAt" | "updatedAt">) => {
      const customer: Customer = {
        id: `customer-${Date.now()}`,
        ...input,
        createdAt: now(),
        updatedAt: now(),
      };
      set({ customers: [customer, ...get().customers] });
      return customer;
    },
    updateCustomer: (id: string, input: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt">>) => {
      set({
        customers: get().customers.map((customer) =>
          customer.id === id ? { ...customer, ...input, updatedAt: now() } : customer,
        ),
      });
    },
    deleteCustomer: (id: string) => {
      set({
        customers: get().customers.filter((customer) => customer.id !== id),
      });
    },
  };
}
