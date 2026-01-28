
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Users, Calendar, Ban, Share2, Send, Download, Apple, Smartphone, ArrowRight, CalendarIcon, Loader2, List, Trash2, CheckCircle2, XCircle, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import React, { useTransition, useEffect, useCallback, useState } from "react";
import { sendNotification } from "@/app/admin/actions";
import { useToast } from "@/hooks/use-toast";
import { getActiveNotifications, deleteNotification } from "@/lib/notifications";
import { ScrollArea } from "./ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getAppointments } from "@/lib/appointments";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Badge } from "./ui/badge";


const notificationSchema = z.object({
    title: z.string().min(1, { message: 'יש להזין כותרת' }),
    content: z.string().min(1, { message: 'יש להזין תוכן' }),
    expiresAt: z.date({ required_error: 'יש לבחור תאריך תפוגה' }),
});

function NotificationForm({ onNotificationSent }: { onNotificationSent: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const form = useForm<z.infer<typeof notificationSchema>>({
        resolver: zodResolver(notificationSchema),
        defaultValues: {
            title: '',
            content: '',
        }
    });

    function onSubmit(values: z.infer<typeof notificationSchema>) {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('title', values.title);
            formData.append('content', values.content);
            formData.append('expiresAt', values.expiresAt.toISOString());

            const result = await sendNotification(formData);

            if (result?.error) {
                toast({
                    variant: "destructive",
                    title: "שגיאה",
                    description: result.error,
                });
            } else {
                 toast({
                    title: "הצלחה",
                    description: "ההודעה נשלחה בהצלחה ללקוחות.",
                });
                form.reset();
                onNotificationSent();
            }
        });
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col flex-grow">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5" />
                        יצירת הודעה ללקוחות
                    </CardTitle>
                    <CardDescription>
                        שלח עדכונים ומבצעים.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-grow">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>כותרת</FormLabel>
                                <FormControl>
                                    <Input placeholder="מבצע יום הולדת!" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>תוכן ההודעה</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="לכבוד יום ההולדת, 20% הנחה על כל הטיפולים!" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="expiresAt"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>תאריך תפוגה</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value ? (
                                        format(field.value, "PPP")
                                        ) : (
                                        <span>בחרי תאריך</span>
                                        )}
                                        <CalendarIcon className="mr-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                    />
                                </PopoverContent>
                                </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? <Loader2 className="animate-spin" /> : 'שלח הודעה'}
                    </Button>
                </CardFooter>
            </form>
        </Form>
    );
}

interface Notification {
    id: string;
    title: string;
    content: string;
    expiresAt: Date;
    createdAt: Date;
}

function ActiveNotificationsList() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isDeleting, startDeleteTransition] = useTransition();

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        try {
            const activeNotifications = await getActiveNotifications();
             setNotifications(activeNotifications.map(n => ({...n, expiresAt: new Date(n.expiresAt), createdAt: new Date(n.createdAt) })));
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את ההודעות הפעילות' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);
    
    const handleDelete = (id: string) => {
        startDeleteTransition(async () => {
            const result = await deleteNotification(id);
            if(result.success) {
                toast({ title: 'הצלחה', description: 'ההודעה נמחקה' });
                fetchNotifications();
            } else {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את ההודעה' });
            }
        });
    }

    if (isLoading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><List className="h-5 w-5" />הודעות מערכת פעילות</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="animate-spin" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <Card className="flex flex-col">
                <NotificationForm onNotificationSent={fetchNotifications} />
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <List className="h-5 w-5" />
                        הודעות מערכת פעילות
                    </CardTitle>
                    <CardDescription>
                        הודעות אלו נשלחות באופן אוטומטי לכלל הלקוחות ומוצגות באפליקציה עד לתאריך התפוגה.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-96">
                        {notifications.length > 0 ? (
                             <ul className="space-y-4">
                                {notifications.map(n => (
                                    <li key={n.id} className="p-3 bg-accent/50 rounded-md border">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold">{n.title}</h3>
                                                <p className="text-sm text-muted-foreground mt-1">{n.content}</p>
                                                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-4">
                                                    <span>
                                                        בתוקף עד: {format(new Date(n.expiresAt), 'dd/MM/yyyy')}
                                                    </span>
                                                    <Badge variant="secondary">נשלח לכל הלקוחות</Badge>
                                                </div>
                                            </div>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isDeleting}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        פעולה זו תמחק את ההודעה לצמיתות. לא ניתן לשחזר את הפעולה.
                                                    </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(n.id)} disabled={isDeleting}>
                                                        {isDeleting ? <Loader2 className="animate-spin" /> : 'מחק'}
                                                    </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">אין הודעות פעילות כרגע.</p>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}

export function AdminDashboard() {
  const [stats, setStats] = useState([
    {
      title: "לקוחות להיום",
      value: "...",
      icon: <Users className="h-6 w-6 text-muted-foreground" />,
      description: "לקוחות עם תור שנקבע להיום",
      href: `/admin/calendar?date=${format(new Date(), 'yyyy-MM-dd')}&view=daily`,
    },
    {
      title: "לקוחות השבוע",
      value: "...",
      icon: <Calendar className="h-6 w-6 text-muted-foreground" />,
      description: "לקוחות עם תור בשבוע הנוכחי",
      href: `/admin/calendar`,
    },
    {
      title: "ביטולים החודש",
      value: "...",
      icon: <Ban className="h-6 w-6 text-muted-foreground" />,
      description: "סה״כ ביטולים על ידי לקוחות החודש",
      href: '/admin/reports/cancellations'
    },
  ]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
        const weekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        const [
          appointmentsToday,
          appointmentsThisWeek,
          cancellationsThisMonth,
        ] = await Promise.all([
          getAppointments(todayStart, todayEnd),
          getAppointments(weekStart, weekEnd),
          getAppointments(monthStart, monthEnd, undefined, undefined, ['cancelled'], 'desc', undefined, 'client'),
        ]);

        const clientsTodayCount = new Set(
          appointmentsToday.filter((a) => a.clientId).map((a) => a.clientId)
        ).size;
        const clientsThisWeekCount = new Set(
          appointmentsThisWeek.filter((a) => a.clientId).map((a) => a.clientId)
        ).size;
        const cancellationsThisMonthCount = cancellationsThisMonth.length;

        setStats([
           {
            title: "לקוחות להיום",
            value: clientsTodayCount.toString(),
            icon: <Users className="h-6 w-6 text-muted-foreground" />,
            description: "לקוחות עם תור שנקבע להיום",
            href: `/admin/calendar?date=${format(new Date(), 'yyyy-MM-dd')}&view=daily`,
          },
          {
            title: 'לקוחות השבוע',
            value: clientsThisWeekCount.toString(),
            icon: <Calendar className="h-6 w-6 text-muted-foreground" />,
            description: "לקוחות עם תור בשבוע הנוכחי",
            href: `/admin/calendar`,
          },
          {
            title: 'ביטולים החודש',
            value: cancellationsThisMonthCount.toString(),
            icon: <Ban className="h-6 w-6 text-muted-foreground" />,
            description: 'סה״כ ביטולים על ידי לקוחות החודש',
             href: '/admin/reports/cancellations',
          },
        ]);
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
        toast({
          variant: 'destructive',
          title: 'שגיאה',
          description: 'לא ניתן היה לטעון את הנתונים ללוח הבקרה.',
        });
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [toast]);

  return (
    <div className="p-4 space-y-6">
        <div className="flex items-center gap-4">
            <Link href="/admin" passHref>
            <Button variant="outline">
                <ArrowLeft className="mr-2" />
                חזרה
            </Button>
            </Link>
            <h1 className="text-2xl font-bold">לוח בקרה</h1>
        </div>
        <div className="grid auto-rows-fr grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 mb-6">
            {stats.map((stat) => {
                const card = (
                    <Card key={stat.title} className="flex flex-col h-full hover:bg-accent/50 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        {stat.icon}
                        </CardHeader>
                        <CardContent className="flex-grow">
                        <div className="text-2xl font-bold">
                            {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : stat.value}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stat.description}
                        </p>
                        </CardContent>
                    </Card>
                );

                if ((stat as any).href) {
                     return (
                        <Link href={(stat as any).href} key={stat.title} className="no-underline text-inherit">
                            {card}
                        </Link>
                    );
                }

                return card;
            })}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        נתוני הורדות
                    </CardTitle>
                    <CardDescription>
                        מעקב אחר הורדות האפליקציה.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Apple className="h-5 w-5" />
                            <span>אפל</span>
                        </div>
                        <span className="font-bold">0</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5" />
                            <span>אנדרואיד</span>
                        </div>
                        <span className="font-bold">0</span>
                    </div>
                </CardContent>
                <CardFooter>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="link" className="p-0 h-auto" disabled>מעבר לנתונים המלאים</Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>תכונה זו תהיה זמינה בקרוב.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardFooter>
            </Card>
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Share2 className="h-5 w-5" />
                        ניהול רשתות חברתיות
                    </CardTitle>
                    <CardDescription>
                        פרסום וניהול התוכן.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                    כאן ניתן יהיה לחבר את חשבונות המדיה החברתית שלך ולנהל פוסטים.
                </p>
                </CardContent>
                <CardFooter>
                    <Link href="/admin/social" passHref>
                        <Button>עבור לניהול</Button>
                    </Link>
                </CardFooter>
            </Card>
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        סטטוס מערכת הודעות
                    </CardTitle>
                    <CardDescription>
                       חיווי על מערכות WhatsApp ו-SMS.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                    <div>
                        <p className="text-sm font-medium">הודעות שנשלחו החודש</p>
                        <p className="text-2xl font-bold">0</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                               <CheckCircle2 className="h-5 w-5 text-green-500" />
                               <span>WhatsApp</span>
                           </div>
                           <span className="text-sm font-medium text-green-500">מחובר</span>
                        </div>
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                               <XCircle className="h-5 w-5 text-destructive" />
                               <span>SMS</span>
                           </div>
                           <span className="text-sm font-medium text-destructive">מנותק</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
        <ActiveNotificationsList />
    </div>
  );
}
