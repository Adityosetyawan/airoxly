import React from "react";
import { useRouter } from "expo-router";
import CustomersList from "@/src/components/CustomersList";

export default function SuperAdminCustomers() {
  const router = useRouter();
  return (
    <CustomersList
      title="Semua Pelanggan"
      showSalesFilter
      onOpenCustomer={(id) =>
        router.push({ pathname: "/(superadmin)/customer/[id]", params: { id } })
      }
    />
  );
}
