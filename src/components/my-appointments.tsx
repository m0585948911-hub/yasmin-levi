

'use client';

import { getAppointments, Appointment, updateAppointmentStatus } from "@/lib/appointments";
import { useEffect, useState, Suspense, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Calendar, User, Clock, AlertTriangle, History, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import Link from "next/link";
import { format, differenceInHours } from 'date-fns';
import { he } from 'date-fns/locale';
import { Separator } from "./ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createLog } from "@/lib/logs";
import type { AllSettings } from "@/lib/settings-types";
import { Logo } from "./logo";
import { Badge } from "./ui/badge";
import { confirmArrival } from "@/app/actions";

const SETTINGS_STORAGE_KEY = 'appGeneralSettings';

function MyAppointmentsContent() {
    const [futureAppointments, setFutureAppointments] = useState<Appointment[]>([]);
    const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCancelling, startCancelTransition] = useTransition();
    const [isConfirming, startConfirmTransition] = useTransition();
    const [settings, setSettings] = useState<AllSettings | null>(null);

    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    
    const clientId = searchParams.get('id') || `phone_${searchParams.get('phone')}`;
    const confirmAppointmentId = searchParams.get('confirm');


    useEffect(() => {
        const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            } catch (e) { console.error(e); }
        }

        const fetchAppointments = async () => {
            if (!clientId) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const fetchedAppointments = await getAppointments(oneYearAgo, new Date(new Date().setFullYear(new Date().getFullYear() + 1)));

            const clientAppointments = fetchedAppointments
                .filter(app => app.clientId === clientId);
                
            const now = new Date();
            const future = clientAppointments
                .filter(a => new Date(a.start) >= now && a.status !== 'cancelled' && a.status !== 'no-show' && a.status !== 'completed')
                .sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            
            const past = clientAppointments.filter(a => new Date(a.start) < now).sort((a,b) => new Date(b.start).getTime() - new Date(a.start).getTime());

            setFutureAppointments(future);
            setPastAppointments(past);
            setIsLoading(false);

            // Handle confirmation from URL
            if (confirmAppointmentId) {
                const appointmentToConfirm = future.find(a => a.id === confirmAppointmentId);
                if (appointmentToConfirm && !appointmentToConfirm.arrivalConfirmed) {
                    handleConfirmArrival(confirmAppointmentId);
                }
            }
        }
        fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);
    
    const handleCancelAppointment = (appointment: Appointment) => {
        startCancelTransition(async () => {
            const result = await updateAppointmentStatus(appointment.id, 'pending_cancellation', 'client');
            if (result.success) {
                await createLog({
                    action: 'Appointment Cancellation Requested',
                    details: `Client ${appointment.clientName} requested to cancel appointment on ${format(new Date(appointment.start), 'dd/MM/yyyy HH:mm')}.`,
                    user: appointment.clientName,
                });
                
                toast({
                    title: "בקשתך לביטול התור נשלחה",
                    description: "המנהל/ת יאשרו את הביטול בהקדם.",
                });
                setFutureAppointments(prev => prev.map(a => a.id === appointment.id ? { ...a, status: 'pending_cancellation' } : a));
            } else {
                 toast({
                    variant: "destructive",
                    title: "שגיאה",
                    description: "לא ניתן היה לשלוח את בקשת הביטול. נא לנסות שוב.",
                });
            }
        });
    }

    const handleConfirmArrival = (appointmentId: string) => {
        startConfirmTransition(async () => {
            const result = await confirmArrival(appointmentId);
            if (result.success) {
                toast({
                    title: "תודה!",
                    description: "הגעתך אושרה.",
                });
                setFutureAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, arrivalConfirmed: true } : a));

                // If confirmation was via URL, remove the query param
                if(confirmAppointmentId) {
                    const newParams = new URLSearchParams(searchParams.toString());
                    newParams.delete('confirm');
                    router.replace(`/my-appointments?${newParams.toString()}`, { scroll: false });
                }

            } else {
                 toast({
                    variant: "destructive",
                    title: "שגיאה",
                    description: "לא ניתן היה לאשר הגעה. נא לנסות שוב.",
                });
            }
        });
    }

    const getCleanClientParams = () => {
        const clientParams = new URLSearchParams();
        const id = searchParams.get('id');
        const firstName = searchParams.get('firstName');
        const lastName = searchParams.get('lastName');
        const gender = searchParams.get('gender');
        const phone = searchParams.get('phone');

        if (id) clientParams.append('id', id);
        if (firstName) clientParams.append('firstName', firstName);
        if (lastName) clientParams.append('lastName', lastName);
        if (gender) clientParams.append('gender', gender);
        if (phone) clientParams.append('phone', phone);
        return clientParams.toString();
    }
    
    const clientParamsString = getCleanClientParams();
    const dashboardLink = `/dashboard?${clientParamsString}`;
    const newAppointmentLink = `/appointments?${clientParamsString}`;
    const historyLink = `/my-appointments/history?${clientParamsString}`;

    const defaultCancelHours = 6;
    const defaultEditHours = 6;

    const cancelHoursLimit = settings?.limitationSettings?.cancelAppointmentHoursLimit ?? defaultCancelHours;
    const editHoursLimit = settings?.limitationSettings?.editAppointmentHoursLimit ?? defaultEditHours;
    const businessPhone = settings?.businessDetails?.phone;
    const isArrivalConfirmationActive = settings?.generalAppSettings?.isArrivalConfirmationActive;
    
    const getStatusText = (status: Appointment['status']): string => {
        switch (status) {
            case 'completed': return 'הושלם';
            case 'no-show': return 'לא הופיע/ה';
            case 'cancelled': return 'בוטל';
            default: return 'הושלם';
        }
    };


    return (
        <div className="container mx-auto p-4 max-w-2xl space-y-6">
            <header className="p-4 flex justify-between items-center mb-6">
                <Link href={dashboardLink} className="w-20 h-20">
                    <Logo className="w-full h-full" />
                </Link>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary">התורים שלי</h1>
                </div>
                <div className="w-20 flex items-center justify-center">
                    <Button asChild variant="outline">
                        <Link href={dashboardLink}>
                            <ArrowLeft className="ml-2" />
                            חזרה
                        </Link>
                    </Button>
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>תורים עתידיים</CardTitle>
                    <CardDescription>כאן ניתן לצפות, לשנות או לבטל את התורים הבאים שלך.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : futureAppointments.length > 0 ? (
                        <ul className="space-y-4">
                            {futureAppointments.map((app, index) => {
                                const hoursUntilAppointment = differenceInHours(new Date(app.start), new Date());
                                const canCancel = hoursUntilAppointment >= cancelHoursLimit;
                                const canEdit = hoursUntilAppointment >= editHoursLimit;
                                const isPending = app.status === 'pending';
                                const isPendingCancellation = app.status === 'pending_cancellation';

                                return (
                                <li key={app.id}>
                                    <div className="p-4 border rounded-lg bg-accent/50 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-lg">{app.serviceName}</h3>
                                             {isPending ? (
                                                <Badge variant="outline" className="border-orange-500 text-orange-500">
                                                    <AlertCircle className="ml-1 h-3 w-3" />
                                                    ממתין לאישור
                                                </Badge>
                                             ) : isPendingCancellation ? (
                                                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                                                    <AlertCircle className="ml-1 h-3 w-3" />
                                                    בבקשת ביטול
                                                </Badge>
                                             ) : (
                                                <Badge variant="outline" className="border-green-500 text-green-500">
                                                    <CheckCircle2 className="ml-1 h-3 w-3" />
                                                    אושר
                                                </Badge>
                                             )}
                                        </div>
                                         <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            <span>{format(new Date(app.start), 'eeee, d MMMM yyyy', { locale: he })}</span>
                                        </div>
                                         <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            <span>{format(new Date(app.start), 'HH:mm')} - {format(new Date(app.end), 'HH:mm')}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-end gap-2 items-center">
                                            {isArrivalConfirmationActive && !isPending && !isPendingCancellation && (
                                                <div className="flex-grow">
                                                    {app.arrivalConfirmed ? (
                                                        <div className="flex items-center gap-1 text-sm text-green-600 font-semibold">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                            <span>ההגעה אושרה</span>
                                                        </div>
                                                    ) : (
                                                         <Button
                                                            variant="default"
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700"
                                                            onClick={() => handleConfirmArrival(app.id)}
                                                            disabled={isConfirming}
                                                        >
                                                            {isConfirming ? <Loader2 className="animate-spin h-4 w-4"/> : "אישור הגעה"}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" disabled={isPending || isPendingCancellation}>ביטול תור</Button>
                                                </AlertDialogTrigger>
                                                {canCancel ? (
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>רגע לפני שמבטלים...</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                 האם לשלוח בקשה לביטול התור? שימ/י לב, הפעולה תמתין לאישור המנהל.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>להישאר בתור</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleCancelAppointment(app)}
                                                                disabled={isCancelling}
                                                                className="bg-destructive hover:bg-destructive/90"
                                                            >
                                                                 {isCancelling ? <Loader2 className="animate-spin" /> : 'כן, שלח/י בקשה לביטול'}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                ) : (
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="flex items-center gap-2">
                                                                <AlertTriangle className="text-destructive"/>
                                                                לא ניתן לבטל את התור
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                לא ניתן לבצע את הפעולה פחות מ-{cancelHoursLimit} שעות לפני מועד התור.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                         {businessPhone && (
                                                            <div className="text-sm border-t pt-4 mt-4 text-center sm:text-right">
                                                                <div className="font-semibold">לכל שאלה, אני זמינה בשבילך</div>
                                                                <a href={`tel:${businessPhone}`} className="text-primary hover:underline">{businessPhone}</a>
                                                            </div>
                                                        )}
                                                        <AlertDialogFooter>
                                                            <AlertDialogAction>הבנתי</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                )}
                                            </AlertDialog>
                                             {canEdit ? (
                                                <Button asChild variant="default" size="sm" disabled={isPending || isPendingCancellation}>
                                                    <Link href={`${newAppointmentLink}&changeAppointmentId=${app.id}&serviceIds=${app.serviceId}`}>
                                                        שינוי תור
                                                    </Link>
                                                </Button>
                                             ) : (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="default" size="sm" disabled={isPending || isPendingCancellation}>שינוי תור</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="flex items-center gap-2">
                                                                <AlertTriangle className="text-destructive"/>
                                                                לא ניתן לשנות את התור
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                לא ניתן לבצע את הפעולה פחות מ-{editHoursLimit} שעות לפני מועד התור.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        {businessPhone && (
                                                            <div className="text-sm border-t pt-4 mt-4 text-center sm:text-right">
                                                                <div className="font-semibold">לכל שאלה, אני זמינה בשבילך</div>
                                                                <a href={`tel:${businessPhone}`} className="text-primary hover:underline">{businessPhone}</a>
                                                            </div>
                                                        )}
                                                        <AlertDialogFooter>
                                                            <AlertDialogAction>הבנתי</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                             )}
                                        </div>
                                    </div>
                                </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-center text-muted-foreground py-16">
                           אין לך תורים עתידיים כרגע.
                            <br/>
                            <Link href={newAppointmentLink} className="text-primary hover:underline font-semibold">
                                לחצ/י כאן כדי לקבוע תור חדש!
                            </Link>
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History />
                        היסטוריית תורים
                    </CardTitle>
                </CardHeader>
                <CardContent>
                     {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : pastAppointments.length > 0 ? (
                        <ul className="space-y-4">
                            {pastAppointments.slice(0, 2).map((app) => (
                                <li key={app.id}>
                                    <div className="p-4 border rounded-lg bg-accent/50 opacity-70 flex justify-between items-center">
                                        <div>
                                            <h3 className="font-semibold text-base">{app.serviceName}</h3>
                                            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                <Calendar className="h-4 w-4" />
                                                <span>{format(new Date(app.start), 'd MMMM yyyy', { locale: he })}</span>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusText(app.status) === 'הושלם' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {getStatusText(app.status)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                             {pastAppointments.length > 2 && (
                                <div className="text-center mt-4">
                                    <Link href={historyLink} className="text-primary hover:underline font-semibold">
                                        לצפייה בכל ההיסטוריה
                                    </Link>
                                </div>
                            )}
                        </ul>
                     ) : (
                        <p className="text-center text-muted-foreground py-16">
                           אין היסטוריית תורים.
                        </p>
                     )}
                </CardContent>
            </Card>
        </div>
    );
}


export function MyAppointments() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <MyAppointmentsContent />
        </Suspense>
    );
}
