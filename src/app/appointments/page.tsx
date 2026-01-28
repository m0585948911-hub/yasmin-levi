
import { AppointmentBooking } from "@/components/appointment-booking";
import { Suspense } from 'react';
import { Loader2 } from "lucide-react";

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AppointmentBooking />
    </Suspense>
  );
}
