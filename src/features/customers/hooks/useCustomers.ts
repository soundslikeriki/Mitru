import { useMemo, useState } from "react";
import type { CustomerStatus, CustomerType } from "@/stores/project-store";
import { useProjectStore } from "@/stores/project-store";

export function useCustomers() {
  const customers = useProjectStore((state) => state.customers);
  const projects = useProjectStore((state) => state.projects);
  const deleteCustomer = useProjectStore((state) => state.deleteCustomer);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CustomerType | "すべて">("すべて");
  const [status, setStatus] = useState<CustomerStatus | "すべて">("すべて");

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery =
        normalized.length === 0 ||
        [customer.name, customer.companyName, customer.phone, customer.email, customer.address]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesType = type === "すべて" || customer.type === type;
      const matchesStatus = status === "すべて" || customer.status === status;
      return matchesQuery && matchesType && matchesStatus;
    });
  }, [customers, query, status, type]);

  return {
    deleteCustomer,
    projects,
    query,
    rows,
    setQuery,
    setStatus,
    setType,
    status,
    type,
  };
}
