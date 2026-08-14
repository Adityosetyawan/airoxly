import React from "react";
import { useLocalSearchParams } from "expo-router";
import CustomerDetailReadonly from "@/src/components/CustomerDetailReadonly";

export default function AdminCustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <CustomerDetailReadonly customerId={id} canDelete />;
}
