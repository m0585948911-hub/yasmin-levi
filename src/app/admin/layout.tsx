'use client';

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { AdminAppointmentNotifier } from "@/components/admin-appointment-notifier";
import { AdminUserProvider, useAdminUser } from "@/hooks/use-admin-user";
import { usePathname, useRouter } from "next/navigation";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AdminReminderNotifier } from "@/components/admin-reminder-notifier";
import { VersionNotifier } from "@/components/version-notifier";


function AdminHeader() {
    const { user, setUser } = useAdminUser();
    const router = useRouter();

    const handleLogout = () => {
        setUser(null);
        router.push('/admin/login');
    }

    if (!user) {
        return null;
    }

    return (
        <header className="p-4 border-b flex items-center justify-between gap-4 bg-background flex-shrink-0">
          <Link href="/admin" className="flex items-center gap-2 no-underline text-foreground">
            <Logo className="w-8 h-8" />
            <h1 className="text-lg font-bold hidden sm:block">ממשק ניהול</h1>
          </Link>
          <TooltipProvider>
            <div className="flex items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link href="/admin/profile" passHref>
                          <Button variant="outline" size="icon" className="rounded-full">
                              <User />
                            </Button>
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent><p>הפרופיל שלי</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-full" onClick={handleLogout}>
                            <LogOut />
                        </Button>
                    </TooltipTrigger>
                     <TooltipContent><p>התנתקות</p></TooltipContent>
                </Tooltip>
            </div>
          </TooltipProvider>
      </header>
    )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  return (
    <AdminUserProvider>
      <div className="flex flex-col h-screen bg-[#F9F7F9]">
        {!isLoginPage && <AdminHeader />}
          <main className="flex-grow overflow-auto">
              {children}
          </main>
          {!isLoginPage && <AdminAppointmentNotifier />}
          {!isLoginPage && <AdminReminderNotifier />}
          <VersionNotifier />
      </div>
    </AdminUserProvider>
  );
}
