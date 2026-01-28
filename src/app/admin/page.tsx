'use client';

import { QuoteFlow } from "@/components/quote-flow";
import { Greeting } from "@/components/greeting";
import { DashboardIcon } from "@/components/dashboard-icon";
import {
  Home,
  Settings,
  Users,
  Calendar,
  Clock,
  CreditCard,
  Info,
  Activity,
  UserCheck,
  BarChart3,
  Share2,
  Briefcase,
  Loader2,
  Bell,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getPendingAppointments } from "@/lib/appointments";
import { getWaitingListRequests } from "@/lib/waiting-list";
import { useAdminUser } from "@/hooks/use-admin-user";
import { getReminders } from "@/lib/reminders";


export default function AdminDashboardPage() {
  const iconSize = 48;
  const { user, permissions } = useAdminUser();
  
  const [pendingAppointmentsCount, setPendingAppointmentsCount] = useState(0);
  const [waitingListCount, setWaitingListCount] = useState(0);
  const [pendingRemindersCount, setPendingRemindersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function fetchCounts() {
      if (!user) return;
      setIsLoading(true);
      try {
        const [pending, waiting, reminders] = await Promise.all([
            permissions.canApproveAppointments ? getPendingAppointments() : Promise.resolve([]),
            getWaitingListRequests(),
            getReminders(['pending'])
        ]);
        setPendingAppointmentsCount(pending.length);
        setWaitingListCount(waiting.filter(r => r.status === 'new').length);
        setPendingRemindersCount(reminders.length);
      } catch (error) {
        console.error("Failed to fetch counts", error);
        setPendingAppointmentsCount(0);
        setWaitingListCount(0);
        setPendingRemindersCount(0);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCounts();
  }, [user, permissions]);

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  const allFeatures = [
    { id: 'dashboard', icon: <Home size={iconSize} className="text-primary" />, label: "לוח בקרה", href: "/admin/dashboard", requiredPermission: true },
    { id: 'calendar', icon: <Calendar size={iconSize} className="text-primary" />, label: "יומן", href: "/admin/calendar", requiredPermission: permissions.accessibleCalendars.length > 0 },
    { id: 'clients', icon: <Users size={iconSize} className="text-primary" />, label: "לקוחות", href: "/admin/clients", requiredPermission: permissions.canViewClients },
    { id: 'services', icon: <Briefcase size={iconSize} className="text-primary" />, label: "ניהול שירותים", href: "/admin/settings/services", requiredPermission: user.permission === 'owner' },
    { 
      id: 'pending',
      icon: isLoading ? <Loader2 size={iconSize} className="animate-spin text-primary" /> : <UserCheck size={iconSize} className="text-primary" />, 
      label: "תורים לאישור", 
      href: "/admin/appointments/pending", 
      badgeCount: pendingAppointmentsCount,
      requiredPermission: permissions.canApproveAppointments
    },
    { 
        id: 'waiting',
        icon: isLoading ? <Loader2 size={iconSize} className="animate-spin text-primary" /> : <Clock size={iconSize} className="text-primary" />, 
        label: "רשימת המתנה", 
        href: "/admin/waiting-list", 
        badgeCount: waitingListCount,
        requiredPermission: true
    },
    { 
      id: 'reminders',
      icon: isLoading ? <Loader2 size={iconSize} className="animate-spin text-primary" /> : <Bell size={iconSize} className="text-primary" />, 
      label: "תזכורות", 
      href: "/admin/reminders", 
      badgeCount: pendingRemindersCount,
      requiredPermission: true
    },
    { id: 'reports', icon: <BarChart3 size={iconSize} className="text-primary" />, label: "דוחות", href: "/admin/reports", requiredPermission: user.permission === 'owner' },
    { id: 'social', icon: <Share2 size={iconSize} className="text-primary" />, label: "רשתות חברתיות", href: "/admin/social", requiredPermission: user.permission === 'owner' },
    { id: 'finance', icon: <CreditCard size={iconSize} className="text-primary" />, label: "כספים", href: "#", requiredPermission: user.permission === 'owner' },
    { id: 'info', icon: <Info size={iconSize} className="text-primary" />, label: "מידע ותשלום", href: "#", requiredPermission: user.permission === 'owner' },
    { id: 'activity', icon: <Activity size={iconSize} className="text-primary" />, label: "פעילות", href: "/admin/activity", requiredPermission: user.permission === 'owner' },
    { id: 'settings', icon: <Settings size={iconSize} className="text-primary" />, label: "הגדרות", href: "/admin/settings", requiredPermission: user.permission === 'owner' },
  ];

  const features = allFeatures.filter(feature => feature.requiredPermission);
  
  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
      <div>
        <Greeting />
        <QuoteFlow />
      </div>
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
          {features.map(feature => <DashboardIcon key={feature.label} {...feature} />)}
       </div>
    </div>
  );
}
