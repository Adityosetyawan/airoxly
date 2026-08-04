import React from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/AuthContext";
import CustomersList from "@/src/components/CustomersList";

export default function AdminCustomers() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <CustomersList
      title="Pelanggan Wilayah"
      showSalesFilter
      restrictGroupLetter={user?.group_letter}
      onOpenCustomer={(id) =>
        router.push({ pathname: "/(admin)/customer/[id]", params: { id } })
      }
    />
  );
}
