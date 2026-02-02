

'use client';

import { Category } from "@/lib/categories";
import { Service } from "@/lib/services";
import { getAppointments, Appointment, saveAppointment } from "@/lib/appointments";
import { useEffect, useState, useMemo, useCallback, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, ShoppingCart, Calendar as CalendarIcon, ChevronRight, ChevronLeft, CheckCircle2, Users, Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { format, addDays, subDays, startOfWeek, set, isBefore, startOfDay, addMinutes, getDay, isEqual } from 'date-fns';
import { he } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createLog } from "@/lib/logs";
import { Logo } from "./logo";
import { Client } from "@/lib/clients";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import type { AllSettings } from "@/lib/settings-types";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogContent } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { createWaitingListRequest } from "@/lib/waiting-list";
import { getBusinessHours, type BusinessHoursRule } from "@/lib/business-hours";
import { getHolidayForDate } from "@/lib/holidays";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

interface ServiceWithCategory extends Service {
  categoryName: string;
}

const getFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
        return `${minutes} דקות`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    let hourText;
    if (hours === 1) {
        hourText = "שעה";
    } else if (hours === 2) {
        hourText = "שעתיים";
    } else {
        hourText = `${hours} שעות`;
    }
    
    if (remainingMinutes === 0) {
        return hourText;
    }

    return `${hourText} ו-${remainingMinutes} דקות`;
};

type View = 'services' | 'calendar';

const toGematria = (num: number): string => {
    if (num <= 0) return '';

    const letters: [number, string][] = [
        [1000, ''], [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
        [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'],
        [30, 'ל'], [20, 'כ'], [10, 'י'],
        [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']
    ];

    if (num === 15) return 'ט"ו';
    if (num === 16) return 'ט"ז';

    let result = '';
    for (const [value, letter] of letters) {
        while (num >= value) {
            result += letter;
            num -= value;
        }
    }

    if (result.length > 1) {
        result = result.slice(0, -1) + '"' + result.slice(-1);
    } else {
        result += "'";
    }

    return result;
};


const daysOfWeek = [
    { id: 'sunday', label: 'ראשון', dayIndex: 0 },
    { id: 'monday', label: 'שני', dayIndex: 1 },
    { id: 'tuesday', label: 'שלישי', dayIndex: 2 },
    { id: 'wednesday', label: 'רביעי', dayIndex: 3 },
    { id: 'thursday', label: 'חמישי', dayIndex: 4 },
    { id: 'friday', label: 'שישי', dayIndex: 5 },
    { id: 'saturday', label: 'שבת', dayIndex: 6 },
];

const WaitingListDialog = ({
    isOpen,
    onOpenChange,
    onSubmit,
    isSubmitting
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (message: string) => void;
    isSubmitting: boolean;
}) => {
    const [message, setMessage] = useState('');

    const handleSubmit = () => {
        onSubmit(message);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>בקשה לרשימת המתנה</DialogTitle>
                    <DialogDescription>
                        כתוב/י הודעה חופשית עם פרטי הבקשה שלך. נשתדל לחזור אליך בהקדם.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="לדוגמה: אשמח לתור גבות דחוף השבוע, אני גמישה בשעות הבוקר..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !message.trim()}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Send className="ml-2" />}
                        שלח בקשה
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function AppointmentBooking() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [familyMembers, setFamilyMembers] = useState<Client[]>([]);
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [openingHours, setOpeningHours] = useState<BusinessHoursRule[]>([]);
  const [closingHours, setClosingHours] = useState<BusinessHoursRule[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRevalidating, startRevalidation] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition();


  const searchParams = useSearchParams();
  const [targetClientId, setTargetClientId] = useState<string>(() => searchParams.get('bookForClientId') || searchParams.get('id') || '');
  const router = useRouter();
  const { toast } = useToast();

  const [view, setView] = useState<View>('services');
  const [selectedServices, setSelectedServices] = useState<ServiceWithCategory[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null);
  const [showApprovalPendingDialog, setShowApprovalPendingDialog] = useState(false);
  const [showBookingSuccessDialog, setShowBookingSuccessDialog] = useState(false);
  const [isWaitingListDialogOpen, setIsWaitingListDialogOpen] = useState(false);


  const loggedInClientId = searchParams.get('id');
  const changeAppointmentId = searchParams.get('changeAppointmentId');
  const bookForClientId = searchParams.get('bookForClientId');
  
  const loadDataFromCache = useCallback(() => {
    setIsLoading(true);
    const cachedSettings = getFromLocalStorage<AllSettings | null>('appGeneralSettings', null);
    const cachedCategories = getFromLocalStorage<Category[]>('allCategories', []);
    const cachedServices = getFromLocalStorage<Service[]>('allServices', []);
    const cachedClients = getFromLocalStorage<Client[]>('allClients', []);

    setSettings(cachedSettings);
    setCategories(cachedCategories);
    setServices(cachedServices);
    setAllClients(cachedClients);

    const newTargetId = bookForClientId || loggedInClientId || '';
    if (newTargetId !== targetClientId) {
      setTargetClientId(newTargetId);
    }

     if (loggedInClientId) {
        const allFamilyRelations = getFromLocalStorage<any>('familyRelations', {});
        const relations = allFamilyRelations[loggedInClientId] || [];
        const memberDetails = relations.map((rel: any) => cachedClients.find(c => c.id === rel.memberId)).filter((c?: Client): c is Client => !!c);
        setFamilyMembers(memberDetails);
      }

    const serviceIdsToSelect = searchParams.get('serviceIds')?.split(',');
      if (serviceIdsToSelect) {
          const servicesToPreselect = cachedServices
              .filter(s => serviceIdsToSelect.includes(s.id))
              .map(s => {
                  const category = cachedCategories.find(c => c.id === s.categoryId);
                  return { ...s, categoryName: category?.name || '' };
              });
          setSelectedServices(servicesToPreselect);
          setView('calendar');
      }

    setIsLoading(false);
    
    getBusinessHours().then(({opening, closing}) => {
        setOpeningHours(opening);
        setClosingHours(closing);
    });

    // Stale-while-revalidate
    setTimeout(() => {
      startRevalidation(async () => {
        // Here you could re-fetch data from the server
        // For this prototype, we'll assume the cache is fresh enough.
        console.log("Revalidating data in the background...");
      });
    }, 1000);

  }, [bookForClientId, loggedInClientId, searchParams, targetClientId]);

  useEffect(() => {
    loadDataFromCache();
  }, [loadDataFromCache]);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 0 }), [currentDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const fetchAppointments = useCallback(async () => {
      if (view !== 'calendar') return;
      setIsLoading(true);
      const fetchedAppointments = await getAppointments(startOfDay(weekStart), startOfDay(addDays(weekEnd, 1)));
      setAppointments(fetchedAppointments);
      setIsLoading(false);
  }, [weekStart, weekEnd, view]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);
  
  useEffect(() => {
    if (view === 'calendar') {
      const intervalId = setInterval(() => {
        console.log("Refreshing appointments every 5 minutes...");
        fetchAppointments();
      }, 5 * 60 * 1000); // 5 minutes in milliseconds

      return () => clearInterval(intervalId);
    }
  }, [view, fetchAppointments]);


  const handleServiceSelection = (service: Service, isSelected: boolean) => {
    const category = categories.find(c => c.id === service.categoryId);
    const serviceWithCategory: ServiceWithCategory = { ...service, categoryName: category?.name || '' };

    if (isSelected) {
      setSelectedServices(prev => [...prev, serviceWithCategory]);
    } else {
      setSelectedServices(prev => prev.filter(s => s.id !== service.id));
    }
  }
  
  const handleProceedToCalendar = () => {
      if (selectedServices.length > 0) {
          setView('calendar');
      }
  }

  const handleSlotSelection = (date: Date, time: string) => {
      setSelectedSlot({ date, time });
  }

  const confirmBooking = async () => {
    if (!selectedSlot) return;

    startSubmitting(async () => {
        const totalDuration = selectedServices.reduce((acc, s) => acc + (s.duration || 0) + (s.breakTime || 0), 0);
        const serviceNames = selectedServices.map(s => s.name).join(', ');
        const serviceIds = selectedServices.map(s => s.id).join(',');
        
        const targetClient = allClients.find(c => c.id === targetClientId);
        if (!targetClient) {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: "לא נבחר לקוח תקין."
            });
            return;
        }

        const clientName = `${targetClient.firstName} ${targetClient.lastName}`;
        const clientId = targetClient.id;

        const loggedInUser = allClients.find(c => c.id === loggedInClientId);
        const bookedBy = loggedInUser ? `${loggedInUser.firstName} ${loggedInUser.lastName}` : 'Unknown';
        const notes = targetClientId !== loggedInClientId ? `תור שנקבע על ידי ${bookedBy}` : '';


        const [hour, minute] = selectedSlot.time.split(':').map(Number);
        const startDate = set(selectedSlot.date, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
        const endDate = addMinutes(startDate, totalDuration);

        const mockCalendarId = 'default_calendar';
        
        let finalStatus: Appointment['status'] = 'scheduled';
        if (settings?.generalAppSettings?.appointmentApproval === 'manager') {
            finalStatus = 'pending';
        } else if (targetClient.isBlocked) {
            finalStatus = 'pending';
        }

        const appointmentData: Omit<Appointment, 'id'> & { id?: string } = {
            id: changeAppointmentId || undefined,
            calendarId: mockCalendarId,
            clientId: clientId,
            businessId: 'default',
            clientName: clientName,
            serviceId: serviceIds,
            serviceName: serviceNames,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            status: finalStatus,
            notes: notes,
        };

        try {
            await saveAppointment(appointmentData);
            
            const actionType = changeAppointmentId ? 'Appointment Changed' : 'Appointment Booked';
            const logDetails = `${actionType === 'Appointment Changed' ? 'Changed' : 'Created'} appointment for ${clientName} for ${serviceNames} at ${format(startDate, 'dd/MM/yyyy HH:mm')}. Status: ${finalStatus}.`;
            await createLog({
                action: actionType,
                details: logDetails,
                user: bookedBy,
            });
            
            setSelectedSlot(null);

            if (finalStatus === 'pending') {
                setShowApprovalPendingDialog(true);
            } else {
                 setShowBookingSuccessDialog(true);
            }

        } catch(e) {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: "לא ניתן היה לקבוע את התור. נא לנסות שוב."
            });
        }
    });
  }
  
  const handleWaitingListSubmit = (message: string) => {
      if (!loggedInClientId) {
          toast({ variant: "destructive", title: "שגיאה", description: "יש להיות מחובר כדי לשלוח בקשה." });
          return;
      }
      startSubmitting(async () => {
          const result = await createWaitingListRequest({
              clientId: loggedInClientId,
              selectedServices: selectedServices.map(s => ({ id: s.id, name: s.name })),
              message: message,
          });

          if (result.success) {
              toast({ title: "הצלחה!", description: "בקשתך לרשימת ההמתנה נשלחה." });
              setIsWaitingListDialogOpen(false);
          } else {
              toast({ variant: "destructive", title: "שגיאה", description: result.error || "לא ניתן היה לשלוח את הבקשה." });
          }
      });
  }
  
  const redirectToDashboard = () => {
    const params = new URLSearchParams(searchParams.toString());
    router.push(`/dashboard?${params.toString()}`);
  }


  const totalDuration = selectedServices.reduce((acc, service) => acc + (service.duration || 0) + (service.breakTime || 0), 0);
  const totalPrice = selectedServices.reduce((acc, service) => acc + (service.price || 0), 0);
  const isServiceSelected = (serviceId: string) => selectedServices.some(s => s.id === serviceId);

  const getSlotStatus = useMemo(() => (date: Date, time: string): { isOpen: boolean, rule?: BusinessHoursRule } => {
    const holiday = getHolidayForDate(date);
    if (holiday?.isDayOff) {
        return { isOpen: false, rule: { id: 0, days: [], startTime: '00:00', endTime: '23:59', dateRange: {}, name: holiday.name } };
    }

    const dayOfWeekIndex = getDay(date);
    const dayId = daysOfWeek.find(d => d.dayIndex === dayOfWeekIndex)?.id;
    const [hour, minute] = time.split(':').map(Number);
    const slotTimeInMinutes = hour * 60 + minute;

    for (const rule of closingHours) {
        const isDayMatch = rule.days.length === 0 || (dayId && rule.days.includes(dayId));
        const isDateInRange = (!rule.dateRange.from || date >= new Date(rule.dateRange.from)) && 
                              (!rule.dateRange.to || date <= new Date(rule.dateRange.to));

        if (isDayMatch && isDateInRange) {
            const [startHour, startMinute] = rule.startTime.split(':').map(Number);
            const [endHour, endMinute] = rule.endTime.split(':').map(Number);
            const startTimeInMinutes = startHour * 60 + startMinute;
            const endTimeInMinutes = endHour * 60 + endMinute;

            if (slotTimeInMinutes >= startTimeInMinutes && slotTimeInMinutes < endTimeInMinutes) {
                return { isOpen: false, rule }; 
            }
        }
    }

    if (openingHours.length === 0) return { isOpen: true }; // Default to open if no hours are set

    for (const rule of openingHours) {
        const isDayMatch = rule.days.length === 0 || (dayId && rule.days.includes(dayId));
        const isDateInRange = (!rule.dateRange.from || date >= new Date(rule.dateRange.from)) && 
                              (!rule.dateRange.to || date <= new Date(rule.dateRange.to));

        if (isDayMatch && isDateInRange) {
            const [startHour, startMinute] = rule.startTime.split(':').map(Number);
            const [endHour, endMinute] = rule.endTime.split(':').map(Number);
            const startTimeInMinutes = startHour * 60 + startMinute;
            const endTimeInMinutes = endHour * 60 + endMinute;

            if (slotTimeInMinutes >= startTimeInMinutes && slotTimeInMinutes < endTimeInMinutes) {
                return { isOpen: true };
            }
        }
    }

    return { isOpen: false };
}, [openingHours, closingHours]);

  const availableSlots = useMemo(() => {
    if (view !== 'calendar' || totalDuration === 0 || !settings) return {};

    const slots: { [key: string]: string[] } = {};
    const days = Array.from({length: 7}, (_, i) => addDays(weekStart, i));

    for (const day of days) {
        const dayKey = format(day, 'yyyy-MM-dd');
        slots[dayKey] = [];
        if (isBefore(day, startOfDay(new Date()))) continue;

        const dayAppointments = appointments
            .filter(a => {
                if (a.id === changeAppointmentId) return false;
                return isEqual(startOfDay(new Date(a.start)), startOfDay(day));
            });

        // Iterate in 15 minute intervals
        for (let i = 0; i < (24 * 4); i++) {
            const minutesFromMidnight = i * 15;
            const currentTime = addMinutes(startOfDay(day), minutesFromMidnight);
            
            if (isBefore(currentTime, new Date())) continue;
            
            const potentialEndTime = addMinutes(currentTime, totalDuration);

            // 1. Check business hours for the entire slot duration
            let isWithinOperatingHours = true;
            let tempTime = new Date(currentTime);
            while (tempTime < potentialEndTime) {
                const status = getSlotStatus(tempTime, format(tempTime, 'HH:mm'));
                if (!status.isOpen) {
                    isWithinOperatingHours = false;
                    break;
                }
                tempTime = addMinutes(tempTime, 15); // Check every 15 minutes
            }
            if(!isWithinOperatingHours) continue;


            // 2. Check for collisions with existing appointments
            const hasCollision = dayAppointments.some(app => {
                const appStart = new Date(app.start);
                const appEnd = new Date(app.end);
                return !(potentialEndTime <= appStart || currentTime >= appEnd);
            });
            if (hasCollision) continue;

            // If all checks pass, add the slot
            slots[dayKey].push(format(currentTime, 'HH:mm'));
        }
    }
    return slots;
  }, [view, weekStart, appointments, settings, totalDuration, changeAppointmentId, getSlotStatus]);

  const dashboardLinkParams = new URLSearchParams();
  if (searchParams.get('id')) dashboardLinkParams.append('id', searchParams.get('id')!);
  if (searchParams.get('firstName')) dashboardLinkParams.append('firstName', searchParams.get('firstName')!);
  if (searchParams.get('lastName')) dashboardLinkParams.append('lastName', searchParams.get('lastName')!);
  if (searchParams.get('gender')) dashboardLinkParams.append('gender', searchParams.get('gender')!);
  if (searchParams.get('phone')) dashboardLinkParams.append('phone', searchParams.get('phone')!);
  const dashboardLink = `/dashboard?${dashboardLinkParams.toString()}`;

  const loggedInUser = allClients.find(c => c.id === loggedInClientId);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderServiceSelection = () => (
    <div className="flex flex-col h-full">
       <header className="p-4 flex items-center gap-4">
          <Button asChild variant="outline">
            <Link href={dashboardLink}>
              <ArrowLeft />
              <span className="mr-2">חזרה</span>
            </Link>
          </Button>
          <h1 className="text-xl font-bold">קביעת תור חדש</h1>
        </header>

      <main className="flex-grow overflow-y-auto pb-48 md:pb-4 px-4">
        <div className="w-24 h-24 mx-auto mb-4">
           <Logo className="w-full h-full" />
        </div>
        <div className="md:grid md:grid-cols-3 md:gap-8 items-start">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-4">
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                    <Label className="font-semibold flex items-center gap-2 flex-shrink-0 pt-3 sm:pt-0">
                        <Users className="text-primary" />
                        קביעת תור עבור:
                    </Label>
                    {familyMembers.length > 0 ? (
                        <RadioGroup value={targetClientId} onValueChange={setTargetClientId} className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 flex-grow">
                        {loggedInUser && (
                            <Label htmlFor={loggedInUser.id} className={cn("flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-accent", targetClientId === loggedInUser.id && "bg-primary/10 border-primary")}>
                            <RadioGroupItem value={loggedInUser.id} id={loggedInUser.id} />
                            <span>עבורי ({loggedInUser.firstName})</span>
                            </Label>
                        )}
                        {familyMembers.map(member => (
                            <Label key={member.id} htmlFor={member.id} className={cn("flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-accent", targetClientId === member.id && "bg-primary/10 border-primary")}>
                            <RadioGroupItem value={member.id} id={member.id} />
                            <span>{member.firstName} {member.lastName}</span>
                            </Label>
                        ))}
                        </RadioGroup>
                    ) : (
                        <Input
                            value={loggedInUser ? `עבורי (${loggedInUser.firstName})` : ''}
                            disabled
                            className="flex-grow mt-2 sm:mt-0"
                        />
                    )}
                </div>
              </CardContent>
            </Card>
            <Accordion type="multiple" className="w-full space-y-2">
              {categories.map(category => (
                <AccordionItem value={category.id} key={category.id} className="border-b-0">
                  <AccordionTrigger className="flex items-center justify-between w-full text-lg font-semibold p-4 bg-accent/50 rounded-md hover:bg-accent/80 transition-colors">
                    <div className="flex items-center gap-4">
                      {category.imageUrl && <Image src={category.imageUrl} alt={category.name} width={40} height={40} className="rounded-full" data-ai-hint="beauty category" />}
                      <span>{category.name}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <div className="space-y-2 pl-4">
                      {services.filter(s => s.categoryId === category.id).map(service => (
                        <div
                          key={service.id}
                          className={cn(
                            "flex items-start justify-between p-3 rounded-md border cursor-pointer transition-all",
                            isServiceSelected(service.id) ? 'bg-primary/10 border-primary' : 'bg-background hover:bg-accent/50'
                          )}
                          onClick={() => handleServiceSelection(service, !isServiceSelected(service.id))}
                        >
                          <div className="flex flex-col gap-1 flex-grow">
                            <span className="font-semibold">{service.name}</span>
                            <span className="text-xs text-muted-foreground">{service.description}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm flex-shrink-0 ml-4">
                            {isServiceSelected(service.id) && <CheckCircle2 className="text-primary" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          
          <div className="hidden md:block md:col-span-1">
             <Card className="sticky top-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingCart />
                        התור שלי
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedServices.length > 0 ? (
                        <ul className="space-y-3">
                            {selectedServices.map(s => (
                                <li key={s.id} className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{s.name}</span>
                                    <button onClick={() => handleServiceSelection(s, false)} className="text-destructive text-xs hover:underline">הסר</button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            נא לבחור שירות אחד או יותר.
                        </p>
                    )}
                </CardContent>
                {selectedServices.length > 0 && (
                    <CardFooter className="flex-col items-stretch space-y-4">
                         {settings?.generalAppSettings?.showDuration && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>זמן משוער:</span>
                                <span className="font-bold">{formatDuration(totalDuration)}</span>
                            </div>
                         )}
                         {settings?.generalAppSettings?.showPrice && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>סה"כ לתשלום:</span>
                                <span className="font-bold">₪{totalPrice.toFixed(2)}</span>
                            </div>
                         )}
                        <Button className="w-full" onClick={handleProceedToCalendar}>
                            <ChevronLeft className="ml-2" />
                            המשך לבחירת מועד
                        </Button>
                    </CardFooter>
                )}
            </Card>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 md:hidden bg-background border-t z-10 p-4">
        {selectedServices.length > 0 ? (
            <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <div className="font-bold">סה"כ: ₪{totalPrice.toFixed(2)}</div>
                    <div className="text-muted-foreground">{formatDuration(totalDuration)}</div>
                </div>
                <Button className="w-full" onClick={handleProceedToCalendar}>
                    <ChevronLeft className="ml-2" />
                    המשך לבחירת מועד
                </Button>
            </div>
        ) : (
             <p className="text-sm text-muted-foreground text-center py-4">
                נא לבחור שירות אחד או יותר.
            </p>
        )}
      </footer>
    </div>
  );

  const renderCalendar = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    
    return (
        <div className="max-w-7xl mx-auto">
             <header className="p-4 flex justify-between items-center">
                <Button asChild variant="outline">
                    <Link href={dashboardLink}>
                        <ArrowLeft className="ml-2" />
                        חזרה
                    </Link>
                </Button>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary">בחירת מועד</h1>
                    <p className="text-muted-foreground">נא לבחור שעה פנויה</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}>
                        <ChevronRight className="h-5 w-5"/>
                    </Button>
                     <span className="font-semibold">{format(weekStart, 'd/M')} - {format(weekEnd, 'd/M/yy')}</span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
                        <ChevronLeft className="h-5 w-5"/>
                    </Button>
                </div>
             </header>

            {settings?.generalAppSettings.isWaitingListActive && (
                 <div className="text-center my-4 p-3 bg-accent/50 rounded-md">
                     <p>לא מצאת את הזמן שמתאים לך?
                         <Button variant="link" className="p-1" onClick={() => setIsWaitingListDialogOpen(true)}>
                             ניתן להירשם לרשימת ההמתנה
                         </Button>
                     </p>
                 </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-7 gap-1 text-center">
                    {days.map(day => {
                        const hebrewDateFormatter = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' });
                        const parts = hebrewDateFormatter.formatToParts(day);
                        const dayPart = parts.find(p => p.type === 'day');
                        const monthPart = parts.find(p => p.type === 'month');
                        
                        const dayInHebrew = dayPart ? toGematria(parseInt(dayPart.value, 10)) : '';
                        const monthInHebrew = monthPart ? monthPart.value : '';
                        const hebrewDate = `${dayInHebrew} ${monthInHebrew}`;
                        
                        return (
                            <div key={day.toString()} className="font-semibold text-sm space-y-1 p-2">
                                <p className="text-base">{daysOfWeek[getDay(day)].label}</p>
                                <p className="text-lg">{format(day, 'd')}</p>
                                <p className="text-xs text-muted-foreground">{hebrewDate}</p>
                            </div>
                        )
                    })}
                    {days.map(day => (
                        <div key={format(day, 'yyyy-MM-dd')} className="space-y-2">
                            {(availableSlots[format(day, 'yyyy-MM-dd')] || []).map(time => (
                                <Button
                                    key={time}
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => handleSlotSelection(day, time)}
                                >
                                    {time}
                                </Button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
             <AlertDialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>{changeAppointmentId ? "אישור שינוי תור" : "אישור קביעת תור"}</AlertDialogTitle>
                    <AlertDialogDescription>
                        האם {changeAppointmentId ? 'לשנות את' : 'לקבוע את'} התור בתאריך {selectedSlot && format(selectedSlot.date, 'dd/MM/yyyy')} בשעה {selectedSlot?.time}?
                        <br/>
                        שירותים: {selectedServices.map(s => s.name).join(', ')}
                        <br/>
                        {settings?.generalAppSettings?.showDuration && `זמן משוער: ${formatDuration(totalDuration)}`}
                        <br/>
                         {settings?.generalAppSettings?.showPrice && `מחיר: ₪${totalPrice.toFixed(2)}`}
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmBooking} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "אישור וקביעת התור"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             <AlertDialog open={showApprovalPendingDialog} onOpenChange={(isOpen) => { if(!isOpen) redirectToDashboard(); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>תודה רבה!</AlertDialogTitle>
                        <AlertDialogDescription>
                           התור שלך נשלח לאישור אצל {settings?.businessDetails?.firstName || 'בעלת העסק'}.
                           <br />
                           זמינה לשירותך בנייד: {settings?.businessDetails?.phone || ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={redirectToDashboard}>אישור</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showBookingSuccessDialog} onOpenChange={(isOpen) => { if(!isOpen) redirectToDashboard(); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{changeAppointmentId ? "התור עודכן בהצלחה!" : "התור נקבע בהצלחה!"}</AlertDialogTitle>
                        <AlertDialogDescription>
                           אישור ופרטי התור המלאים נשלחו אליך בהודעת SMS.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={redirectToDashboard}>אישור</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <WaitingListDialog 
                isOpen={isWaitingListDialogOpen}
                onOpenChange={setIsWaitingListDialogOpen}
                onSubmit={handleWaitingListSubmit}
                isSubmitting={isSubmitting}
            />
        </div>
    );
  }


  return (
    <div className="container mx-auto p-0 sm:p-4">
      {view === 'services' ? renderServiceSelection() : renderCalendar()}
    </div>
  );
}
