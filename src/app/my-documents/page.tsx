import { MyDocuments } from "@/components/my-documents";
import { Suspense } from 'react';
import { Loader2 } from "lucide-react";

export default function MyDocumentsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <MyDocuments />
    </Suspense>
  );
}
