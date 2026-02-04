
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Briefcase, Settings, Users, UserCog, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAdminUser } from "@/hooks/use-admin-user";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { user, isLoading } = useAdminUser();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  // Only owners can see the settings page
  if (user?.permission !== 'owner') {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">אין לך הרשאה לגשת לדף זה.</h1>
        <p>פנה למנהל המערכת לקבלת גישה.</p>
        <Link href="/admin" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2" />
            חזרה לדף הבית
          </Button>
        </Link>
      </div>
    );
  }

  const settingsCategories = [
      {
          title: "הגדרות כלליות",
          description: "ניהול פרטי העסק, קישורים, ותצורת האפליקקציה.",
          href: "/admin/settings/general",
          icon: <Settings className="w-8 h-8 text-primary" />,
      },
      {
          title: "ניהול שירותים",
          description: "הוספה, עריכה ומחיקה של סוגי טיפולים.",
          href: "/admin/settings/services",
          icon: <Briefcase className="w-8 h-8 text-primary" />,
      },
      {
          title: "הגדרות לקוחות",
          description: "ניהול טפסים, קשרי משפחה והגדרות ברירת מחדל.",
          href: "/admin/settings/clients",
          icon: <Users className="w-8 h-8 text-primary" />,
      },
      {
          title: "ניהול משתמשים",
          description: "הוספה ועריכה של משתמשי מערכת וניהול הרשאות.",
          href: "/admin/settings/users",
          icon: <UserCog className="w-8 h-8 text-primary" />,
      },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-4">
            <Link href="/admin" passHref>
            <Button variant="outline">
                <ArrowLeft className="mr-2" />
                חזרה
            </Button>
            </Link>
            <h1 className="text-2xl font-bold">הגדרות</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settingsCategories.map((category) => (
                <Link href={category.href} key={category.title} className="no-underline">
                    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow hover:border-primary/30">
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle>{category.title}</CardTitle>
                                <CardDescription className="mt-2">{category.description}</CardDescription>
                            </div>
                             <div className="p-3 bg-accent rounded-md">
                                {category.icon}
                            </div>
                        </CardHeader>
                    </Card>
                </Link>
            ))}
        </div>
    </div>
  );
}
