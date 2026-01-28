import { MyAppointmentsHistory } from "@/components/my-appointments-history";

// This function is necessary for Next.js static export
export async function generateStaticParams() {
  return [];
}

export default function MyAppointmentsHistoryPage() {
  return <MyAppointmentsHistory />;
}
