
import { MyAppointments } from "@/components/my-appointments";
import { Suspense } from 'react';
import { Loader2 } from "lucide-react";


export default function MyAppointmentsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <MyAppointments />
    </Suspense>
    );
}
