import { MonthlyReportScreen } from "@/src/components/MonthlyReport";

export default function AdminMonthly() {
  // Admin can edit yellow (monthly fields) but NOT red (super admin permanent)
  return <MonthlyReportScreen canEditYellow={true} canEditRed={false} />;
}
