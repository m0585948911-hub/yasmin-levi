
import { Logo } from "@/components/logo";
import Link from "next/link";

function DCHeader() {
    return (
        <header className="p-4 border-b flex items-center justify-between gap-4 bg-background flex-shrink-0">
          <Link href="/dc" className="flex items-center gap-2 no-underline text-foreground">
            <Logo className="w-8 h-8" />
            <h1 className="text-lg font-bold">Developer Console</h1>
          </Link>
        </header>
    )
}

export default function DCLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
        <DCHeader />
          <main className="flex-grow overflow-auto">
              {children}
          </main>
      </div>
  );
}
