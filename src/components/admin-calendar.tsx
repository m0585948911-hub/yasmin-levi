

'use client';

import type React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings, Printer, PlusCircle, Trash2, Pencil, Users, ArrowLeft, UserPlus, Check, ChevronsUpDown, X, CalendarX2, FileText, CheckCircle2, AlertTriangle, GripVertical, Clock, DollarSign, User, Pin, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useRef, useEffect, useTransition, useCallback, Suspense } from "react";
import { format, addDays, subDays, startOfWeek, endOfWeek, parse, isValid, getDay, isWithinInterval, differenceInMinutes, set, addMinutes, startOfDay, addHours, isToday, isEqual, isBefore, max, min } from 'date-fns';
import { he } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import type jsPDF from 'jspdf';
import type html2canvas from 'html2canvas';
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Holiday, getHolidayForDate } from "@/lib/holidays";
import { getBusinessHours, saveBusinessHours, type BusinessHoursRule } from "@/lib/business-hours";
import { getCalendars, saveCalendar, deleteCalendar, type Calendar as CalendarType } from "@/lib/calendars";
import { getAppointments, saveAppointment as saveAppointmentAction, updateAppointmentStatus, type Appointment, getAppointmentById } from "@/lib/appointments";
import { Client, getClients, saveClient } from "@/lib/clients";
import { Service, getServices } from "@/lib/services";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ScrollArea } from "./ui/scroll-area";
import { createLog } from "@/lib/logs";
import { useSearchParams } from "next/navigation";
import { useAdminUser } from "@/hooks/use-admin-user";
import { Badge } from "./ui/badge";


const TimeSlot = ({ time }: { time: string }) => (
    <div className="h-10 flex items-center justify-center text-xs text-muted-foreground border-b border-r">
        {time}
    </div>
);

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


const DayHeader = ({ date, calendarView, holiday, isCurrentDay }: { date: Date, calendarView: string, holiday?: Holiday, isCurrentDay: boolean }) => {
    const hebrewDateFormatter = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' });
    const parts = hebrewDateFormatter.formatToParts(date);
    const dayPart = parts.find(p => p.type === 'day');
    const monthPart = parts.find(p => p.type === 'month');
    
    const dayInHebrew = dayPart ? toGematria(parseInt(dayPart.value, 10)) : '';
    const monthInHebrew = monthPart ? monthPart.value : '';
    const hebrewDate = `${dayInHebrew} ${monthInHebrew}`;
    
    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-2 text-center border-b border-l", 
            holiday?.isDayOff && "bg-muted",
            isCurrentDay && "bg-primary/10"
        )}>
            <span className="text-sm font-medium">{format(date, 'd')}</span>
            <span className="text-xs">{hebrewDate}</span>
            <span className="text-xs text-muted-foreground">{format(date, 'eeee', { locale: he })}</span>
             {holiday && <span className="text-xs font-semibold text-primary">{holiday.name}</span>}
        </div>
    );
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

const formatDays = (dayIds: string[]) => {
    if(dayIds.length === 7) return "כל השבוע";
    if (dayIds.length === 0) return "לא נבחרו ימים";
    return dayIds.map(id => daysOfWeek.find(d => d.id === id)?.label).join(', ');
}

const EditHoursRuleDialog = ({ 
    isOpen, 
    onOpenChange, 
    rule, 
    onSave 
} : { 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    rule: BusinessHoursRule | null,
    onSave: (updatedRule: BusinessHoursRule) => void 
}) => {
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [name, setName] = useState<string | undefined>("");
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        if (rule) {
            setStartTime(rule.startTime);
            setEndTime(rule.endTime);
            setName(rule.name);
            setSelectedDays(rule.days);
            setStartDate(rule.dateRange.from ? format(new Date(rule.dateRange.from), 'dd/MM/yyyy') : '');
            setEndDate(rule.dateRange.to ? format(new Date(rule.dateRange.to), 'dd/MM/yyyy') : '');
        }
    }, [rule]);
    
    const handleDayToggle = (dayId: string) => {
        setSelectedDays(prev => 
            prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
        );
    }
    
    const handleSave = () => {
        if (!rule) return;
        
        const fromDate = startDate ? parse(startDate, 'dd/MM/yyyy', new Date()) : undefined;
        const toDate = endDate ? parse(endDate, 'dd/MM/yyyy', new Date()) : undefined;

        if ((startDate && !isValid(fromDate)) || (endDate && !isValid(toDate))) {
             toast({
                variant: "destructive",
                title: "שגיאה",
                description: "פורמט התאריך אינו תקין. יש להשתמש ב- DD/MM/YYYY.",
            });
            return;
        }

        if (fromDate && toDate && fromDate > toDate) {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: "תאריך ההתחלה לא יכול להיות מאוחר מתאריך הסיום.",
            });
            return;
        }
        
        const updatedRule: BusinessHoursRule = {
            ...rule,
            startTime,
            endTime,
            name,
            days: selectedDays,
            dateRange: { 
                from: fromDate?.toISOString(), 
                to: toDate?.toISOString() 
            }
        };

        onSave(updatedRule);
        onOpenChange(false);
    };

    if (!rule) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>עריכת כלל</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">שם (אופציונלי)</Label>
                        <Input id="edit-name" placeholder="לדוגמה: הפסקת צהריים" value={name || ''} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label htmlFor="edit-startTime">שעת התחלה</Label>
                             <Input id="edit-startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="edit-endTime">שעת סיום</Label>
                             <Input id="edit-endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>ימים בשבוע</Label>
                        <div className="flex flex-wrap gap-2">
                            {daysOfWeek.map(day => (
                                <Button
                                    key={day.id}
                                    variant={selectedDays.includes(day.id) ? "default" : "outline"}
                                    onClick={() => handleDayToggle(day.id)}
                                >
                                    {day.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>טווח תאריכים</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-startDate">מתאריך</Label>
                                <Input 
                                    id="edit-startDate" 
                                    type="text" 
                                    placeholder="dd/MM/yyyy" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-endDate">עד תאריך</Label>
                                <Input 
                                    id="edit-endDate" 
                                    type="text" 
                                    placeholder="dd/MM/yyyy" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave}>שמירה</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const AddOpeningHoursDialog = ({ onSave }: { onSave: (rule: Omit<BusinessHoursRule, 'id'>) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(format(new Date(), 'dd/MM/yyyy'));
    const [endDate, setEndDate] = useState(format(addDays(new Date(), 30), 'dd/MM/yyyy'));
    const { toast } = useToast();


    const handleDayToggle = (dayId: string) => {
        setSelectedDays(prev => 
            prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
        );
    }
    
    const handleSave = () => {
        const fromDate = parse(startDate, 'dd/MM/yyyy', new Date());
        const toDate = parse(endDate, 'dd/MM/yyyy', new Date());

        if (!isValid(fromDate) || !isValid(toDate)) {
             toast({
                variant: "destructive",
                title: "שגיאה",
                description: "פורמט התאריך אינו תקין. יש להשתמש ב- DD/MM/YYYY.",
            });
            return;
        }

        if (fromDate > toDate) {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: "תאריך ההתחלה לא יכול להיות מאוחר מתאריך הסיום.",
            });
            return;
        }

        onSave({
            startTime,
            endTime,
            days: selectedDays,
            dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() }
        });
        setIsOpen(false);
        // Reset form
        setSelectedDays([]);
        setStartTime("09:00");
        setEndTime("17:00");
        setStartDate(format(new Date(), 'dd/MM/yyyy'));
        setEndDate(format(addDays(new Date(), 30), 'dd/MM/yyyy'));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><PlusCircle className="ml-2"/>הוסף שעות פתיחה</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>הוספת שעות פתיחה</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label htmlFor="startTime">שעת התחלה</Label>
                             <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="endTime">שעת סיום</Label>
                             <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>ימים בשבוע</Label>
                        <div className="flex flex-wrap gap-2">
                            {daysOfWeek.map(day => (
                                <Button
                                    key={day.id}
                                    variant={selectedDays.includes(day.id) ? "default" : "outline"}
                                    onClick={() => handleDayToggle(day.id)}
                                >
                                    {day.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>טווח תאריכים</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">מתאריך</Label>
                                <Input 
                                    id="startDate" 
                                    type="text" 
                                    placeholder="dd/MM/yyyy" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">עד תאריך</Label>
                                <Input 
                                    id="endDate" 
                                    type="text" 
                                    placeholder="dd/MM/yyyy" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>ביטול</Button>
                    <Button onClick={handleSave}>שמירה</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const AddClosingHoursDialog = ({ onSave }: { onSave: (rule: Omit<BusinessHoursRule, 'id'>) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [name, setName] = useState("");
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(format(new Date(), 'dd/MM/yyyy'));
    const [endDate, setEndDate] = useState(format(addDays(new Date(), 30), 'dd/MM/yyyy'));
    const { toast } = useToast();

    const handleDayToggle = (dayId: string) => {
        setSelectedDays(prev => 
            prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
        );
    }
    
    const handleSave = () => {
        const fromDate = parse(startDate, 'dd/MM/yyyy', new Date());
        const toDate = parse(endDate, 'dd/MM/yyyy', new Date());

        if (!isValid(fromDate) || !isValid(toDate)) {
             toast({
                variant: "destructive",
                title: "שגיאה",
                description: "פורמט התאריך אינו תקין. יש להשתמש ב- DD/MM/YYYY.",
            });
            return;
        }

        if (fromDate > toDate) {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: "תאריך ההתחלה לא יכול להיות מאוחר מתאריך הסיום.",
            });
            return;
        }

        onSave({
            startTime,
            endTime,
            name: name || undefined,
            days: selectedDays,
            dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() }
        });
        setIsOpen(false);
        // Reset form
        setSelectedDays([]);
        setStartTime("09:00");
        setEndTime("17:00");
        setName("");
        setStartDate(format(new Date(), 'dd/MM/yyyy'));
        setEndDate(format(addDays(new Date(), 30), 'dd/MM/yyyy'));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><PlusCircle className="ml-2"/>הוסף שעות סגירה</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>הוספת שעות סגירה / חופשה</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label htmlFor="add-name">שם (אופציונלי)</Label>
                        <Input id="add-name" placeholder="לדוגמה: חופשה" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label htmlFor="startTime">שעת התחלה</Label>
                             <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="endTime">שעת סיום</Label>
                             <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>ימים בשבוע</Label>
                        <div className="flex flex-wrap gap-2">
                            {daysOfWeek.map(day => (
                                <Button
                                    key={day.id}
                                    variant={selectedDays.includes(day.id) ? "default" : "outline"}
                                    onClick={() => handleDayToggle(day.id)}
                                >
                                    {day.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>טווח תאריכים</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">מתאריך</Label>
                                <Input 
                                    id="startDate" 
                                    type="text" 
                                    placeholder="dd/MM/yyyy" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">עד תאריך</Label>
                                <Input 
                                    id="endDate" 
                                    type="text" 
                                    placeholder="dd/MM/yyyy" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>ביטול</Button>
                    <Button onClick={handleSave}>שמירה</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const EditCalendarDialog = ({
    calendar,
    onSave,
    onOpenChange,
    isOpen,
  }: {
    calendar: CalendarType | null,
    onSave: (calendar: CalendarType) => void,
    onOpenChange: (open: boolean) => void,
    isOpen: boolean,
  }) => {
    const [name, setName] = useState(calendar?.name || "");
    const [slotDuration, setSlotDuration] = useState(calendar?.slotDuration || 15);
    const [sortOrder, setSortOrder] = useState(calendar?.sortOrder || 1);
  
    useEffect(() => {
      if (calendar) {
        setName(calendar.name);
        setSlotDuration(calendar.slotDuration);
        setSortOrder(calendar.sortOrder);
      }
    }, [calendar]);
  
    const handleSave = () => {
      if (!calendar) return;
      onSave({ ...calendar, name, slotDuration, sortOrder });
      onOpenChange(false);
    };
  
    if (!calendar) return null;
  
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת יומן: {calendar.name}</DialogTitle>
          </DialogHeader>
  
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="calendarName">שם היומן</Label>
              <Input
                id="calendarName"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="slotDuration">דקות לתא</Label>
              <Input
                id="slotDuration"
                type="number"
                value={slotDuration}
                onChange={(e) => setSlotDuration(parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                קביעת ברירת מחדל לתצוגת זמן ביומן. ללקוח תמיד יוצג 15 דקות.
              </p>
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="sortOrder">סדר מיון</Label>
              <Input
                id="sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
  
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button onClick={handleSave}>שמירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

const CalendarManagement = () => {
    const [calendars, setCalendars] = useState<CalendarType[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newCalendarName, setNewCalendarName] = useState("");
    const [editingCalendar, setEditingCalendar] = useState<CalendarType | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchAndSetCalendars = async () => {
            const fetchedCalendars = await getCalendars();
            setCalendars(fetchedCalendars);
        }
        fetchAndSetCalendars();
    }, []);

    const handleAddCalendar = async () => {
        if (newCalendarName.trim()) {
            const newCalendarData = {
                name: newCalendarName,
                slotDuration: 15,
                sortOrder: calendars.length + 1
            };
            const savedCalendar = await saveCalendar(newCalendarData);
            setCalendars([...calendars, savedCalendar].sort((a,b) => a.sortOrder - b.sortOrder));
            setNewCalendarName("");
            setShowAddForm(false);
            toast({ title: "הצלחה", description: "היומן נוסף בהצלחה." });
        }
    };
    
    const handleEditCalendar = (calendar: CalendarType) => {
        setEditingCalendar(calendar);
    };

    const handleSaveCalendar = async (updatedCalendar: CalendarType) => {
        const savedCalendar = await saveCalendar(updatedCalendar);
        setCalendars(calendars.map(c => c.id === savedCalendar.id ? savedCalendar : c).sort((a, b) => a.sortOrder - b.sortOrder));
        setEditingCalendar(null);
        toast({ title: "הצלחה", description: "היומן עודכן בהצלחה." });
    }

    const handleDeleteCalendar = async (id: string) => {
        await deleteCalendar(id);
        setCalendars(calendars.filter(c => c.id !== id));
        toast({ title: "הצלחה", description: "היומן נמחק בהצלחה." });
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">יומנים קיימים</h3>
                <Button onClick={() => setShowAddForm(s => !s)}>
                    <PlusCircle className="ml-2" />
                    {showAddForm ? 'ביטול' : 'הוסף יומן חדש'}
                </Button>
            </div>
            {showAddForm && (
                <Card className="p-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="שם היומן החדש"
                            value={newCalendarName}
                            onChange={(e) => setNewCalendarName(e.target.value)}
                        />
                        <Button onClick={handleAddCalendar}>הוספה</Button>
                    </div>
                </Card>
            )}
            <ul className="space-y-2">
                {calendars.map(cal => (
                     <li key={cal.id} className="flex items-center justify-between p-2 border rounded-md bg-accent/50">
                        <div className="flex items-center gap-2">
                             <Users className="w-4 h-4 text-primary"/>
                             <span>{cal.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditCalendar(cal)}>
                                <Pencil className="w-4 h-4 text-primary"/>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCalendar(cal.id)}>
                                <Trash2 className="w-4 h-4 text-destructive"/>
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
            <EditCalendarDialog
                isOpen={!!editingCalendar}
                onOpenChange={() => setEditingCalendar(null)}
                calendar={editingCalendar}
                onSave={handleSaveCalendar}
            />
        </div>
    )
}


const CalendarSettingsDialog = ({
    isOpen,
    onOpenChange,
    onSettingsSave,
}: {
    isOpen: boolean,
    onOpenChange: (isOpen: boolean) => void,
    onSettingsSave: () => void,
}) => {
    const { toast } = useToast();
    const [openingHours, setLocalOpeningHours] = useState<BusinessHoursRule[]>([]);
    const [closingHours, setLocalClosingHours] = useState<BusinessHoursRule[]>([]);
    const [editingRule, setEditingRule] = useState<{rule: BusinessHoursRule, type: 'opening' | 'closing'} | null>(null);

    useEffect(() => {
        if (isOpen) {
            const fetchRules = async () => {
                const { opening, closing } = await getBusinessHours();
                setLocalOpeningHours(opening);
                setLocalClosingHours(closing);
            }
            fetchRules();
        }
    }, [isOpen]);

    const handleSaveOpeningHours = (rule: Omit<BusinessHoursRule, 'id'>) => {
        setLocalOpeningHours(prev => [...prev, { ...rule, id: Date.now() }]);
    }
    
    const handleSaveClosingHours = (rule: Omit<BusinessHoursRule, 'id'>) => {
        setLocalClosingHours(prev => [...prev, { ...rule, id: Date.now(), name: rule.name || 'סגור' }]);
    }

    const handleDeleteOpeningHours = (id: number) => {
        setLocalOpeningHours(prev => prev.filter(rule => rule.id !== id));
    }
    
    const handleDeleteClosingHours = (id: number) => {
        setLocalClosingHours(prev => prev.filter(rule => rule.id !== id));
    }
    
    const handleEditRule = (rule: BusinessHoursRule, type: 'opening' | 'closing') => {
        setEditingRule({ rule, type });
    }

    const handleUpdateRule = (updatedRule: BusinessHoursRule) => {
        if (editingRule?.type === 'opening') {
            setLocalOpeningHours(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
        } else if (editingRule?.type === 'closing') {
            setLocalClosingHours(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
        }
    }


    const handleSaveChanges = async () => {
        await saveBusinessHours({
            opening: openingHours,
            closing: closingHours,
        });
        toast({
            title: "הצלחה",
            description: "הגדרות היומן נשמרו בהצלחה.",
        });
        onSettingsSave(); // Notify parent to refetch
        onOpenChange(false);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>הגדרות יומן</DialogTitle>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto">
                    <Tabs defaultValue="hours" className="h-full flex flex-col">
                        <TabsList className="flex-shrink-0">
                            <TabsTrigger value="general">הגדרות כלליות</TabsTrigger>
                            <TabsTrigger value="calendars">ניהול יומנים</TabsTrigger>
                            <TabsTrigger value="hours">שעות פתיחה וסוגי תורים</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="p-4 flex-grow">
                           <p>כאן יהיו הגדרות כלליות של המערכת.</p>
                        </TabsContent>
                        <TabsContent value="calendars" className="p-4 flex-grow">
                           <CalendarManagement />
                        </TabsContent>
                        <TabsContent value="hours" className="p-4 flex-grow flex flex-col">
                            <Tabs defaultValue="opening" className="h-full flex flex-col">
                                <TabsList className="flex-shrink-0">
                                    <TabsTrigger value="opening">שעות פתיחה</TabsTrigger>
                                    <TabsTrigger value="closing">שעות סגירה/חופשה</TabsTrigger>
                                </TabsList>
                                <TabsContent value="opening" className="space-y-4 flex-grow flex flex-col">
                                    <div className="flex justify-end flex-shrink-0">
                                        <AddOpeningHoursDialog onSave={handleSaveOpeningHours} />
                                    </div>
                                    <Separator/>
                                     <div className="flex-grow overflow-y-auto">
                                        {openingHours.length === 0 ? (
                                            <p className="text-muted-foreground text-center py-8">אין שעות פתיחה מוגדרות.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {openingHours.map(rule => (
                                                    <li key={rule.id} className="flex items-center justify-between p-2 border rounded-md bg-accent/50">
                                                        <div>
                                                            <p className="font-semibold">{rule.startTime} - {rule.endTime}</p>
                                                            <p className="text-sm text-muted-foreground">{formatDays(rule.days)}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {rule.dateRange.from && format(new Date(rule.dateRange.from), "dd/MM/yy")} - {rule.dateRange.to && format(new Date(rule.dateRange.to), "dd/MM/yy")}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule, 'opening')}>
                                                                <Pencil className="w-4 h-4 text-primary"/>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteOpeningHours(rule.id)}>
                                                                <Trash2 className="w-4 h-4 text-destructive"/>
                                                            </Button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                     </div>
                                </TabsContent>
                                <TabsContent value="closing" className="space-y-4 flex-grow flex flex-col">
                                     <div className="flex justify-end flex-shrink-0">
                                        <AddClosingHoursDialog onSave={handleSaveClosingHours} />
                                    </div>
                                    <Separator/>
                                    <div className="flex-grow overflow-y-auto">
                                         {closingHours.length === 0 ? (
                                            <p className="text-muted-foreground text-center py-8">אין שעות סגירה מוגדרות.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {closingHours.map(rule => (
                                                    <li key={rule.id} className="flex items-center justify-between p-2 border rounded-md bg-destructive/10">
                                                        <div>
                                                            <p className="font-semibold">{rule.name || `${rule.startTime} - ${rule.endTime}`}</p>
                                                            <p className="text-sm text-muted-foreground">{formatDays(rule.days)}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {rule.dateRange.from && format(new Date(rule.dateRange.from), "dd/MM/yy")} - {rule.dateRange.to && format(new Date(rule.dateRange.to), "dd/MM/yy")}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEditRule(rule, 'closing')}>
                                                                <Pencil className="w-4 h-4 text-primary"/>
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClosingHours(rule.id)}>
                                                                <Trash2 className="w-4 h-4 text-destructive"/>
                                                            </Button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </TabsContent>
                    </Tabs>
                </div>
                <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSaveChanges}>שמירת שינויים</Button>
                </DialogFooter>
            </DialogContent>
             <EditHoursRuleDialog 
                isOpen={!!editingRule}
                onOpenChange={() => setEditingRule(null)}
                rule={editingRule?.rule || null}
                onSave={handleUpdateRule}
            />
        </Dialog>
    )
}

type NewAppointmentSlot = {
    date: Date,
    time: string,
    calendarId: string,
};

const AddClientDialog = ({ onSave, onClose, prefillName }: { onSave: (newClient: Client) => void, onClose: () => void, prefillName: string }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        gender: 'female' as 'male' | 'female'
    });
    const [isMutating, startMutation] = useTransition();

    useEffect(() => {
        const nameParts = prefillName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        setFormData(prev => ({ ...prev, firstName, lastName }));
    }, [prefillName]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleSave = () => {
        startMutation(async () => {
            const newClient = await saveClient({
                ...formData,
                businessId: 'default',
            });
            onSave(newClient);
        });
    }

    return (
        <DialogContent dir="ltr" className="text-left">
            <DialogHeader>
                <DialogTitle>הוספת לקוח חדש</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className='grid grid-cols-4 items-center gap-4'>
                    <Label htmlFor="add-firstName" className="text-right">שם פרטי</Label>
                    <Input id="add-firstName" name="firstName" value={formData.firstName} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className='grid grid-cols-4 items-center gap-4'>
                    <Label htmlFor="add-lastName" className="text-right">שם משפחה</Label>
                    <Input id="add-lastName" name="lastName" value={formData.lastName} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className='grid grid-cols-4 items-center gap-4'>
                    <Label htmlFor="add-phone" className="text-right">טלפון</Label>
                    <Input id="add-phone" name="phone" value={formData.phone} onChange={handleChange} dir="ltr" className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSave} disabled={isMutating}>
                    {isMutating ? <Loader2 className="animate-spin" /> : 'שמור לקוח'}
                </Button>
                <Button variant="outline" onClick={onClose}>ביטול</Button>
            </DialogFooter>
        </DialogContent>
    );
};

type SelectedService = Service;

const AppointmentFormDialog = ({
    appointmentSlot,
    appointmentToEdit,
    onOpenChange,
    clients,
    services,
    calendars,
    onSaveSuccess,
    onClientAdded,
    allAppointments,
    openingHours,
    closingHours,
    permissions,
    appointmentToPlace,
    setAppointmentToPlace,
    clientIdForNewAppointment,
}: {
    appointmentSlot: NewAppointmentSlot | null,
    appointmentToEdit: Appointment | null,
    onOpenChange: (open: boolean) => void,
    clients: Client[],
    services: Service[],
    calendars: CalendarType[],
    onSaveSuccess: () => void,
    onClientAdded: (client: Client) => void,
    allAppointments: Appointment[],
    openingHours: BusinessHoursRule[],
    closingHours: BusinessHoursRule[],
    permissions: any,
    appointmentToPlace: Appointment | null,
    setAppointmentToPlace: (app: Appointment | null) => void,
    clientIdForNewAppointment: string | null,
}) => {
    const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
    const [customServiceName, setCustomServiceName] = useState('');
    const [clientId, setClientId] = useState<string | null>(null);
    const [clientSearch, setClientSearch] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, startSaving] = useTransition();
    const [isCancelling, startCancelling] = useTransition();
    const { toast } = useToast();
    const [isAddClientOpen, setIsAddClientOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [startTime, setStartTime] = useState(''); // HH:mm format
    const [endTime, setEndTime] = useState(''); // HH:mm format, now editable
    const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [amount, setAmount] = useState(0);
    const [paid, setPaid] = useState(0);
    const [calendarId, setCalendarId] = useState<string>('');
    const [isServiceComboboxOpen, setIsServiceComboboxOpen] = useState(false);
    const [isClientComboboxOpen, setIsClientComboboxOpen] = useState(false);
    const [isPersonalEvent, setIsPersonalEvent] = useState(false);

    const getSlotStatus = useMemo(() => (date: Date, time: string): { isOpen: boolean, rule?: BusinessHoursRule } => {
        if (!time) return { isOpen: true }; // Should not happen in practice
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

        if (openingHours.length === 0) return { isOpen: true };

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

    const checkWarnings = useCallback((checkStartTime: string, checkEndTime: string, checkDate: Date) => {
        if (!checkStartTime || !checkEndTime || !isValid(checkDate)) {
            setWarnings([]);
            return;
        }
        
        let newWarnings: string[] = [];
        const baseDate = startOfDay(new Date(checkDate));
        const [startHour, startMinute] = checkStartTime.split(':').map(Number);
        const startDateTime = set(baseDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });

        const [endHour, endMinute] = checkEndTime.split(':').map(Number);
        const endDateTime = set(baseDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
        
        if(!isValid(startDateTime) || !isValid(endDateTime)) {
             return;
        }
        
        const statusAtStart = getSlotStatus(startDateTime, format(startDateTime, 'HH:mm'));
        if (!statusAtStart.isOpen) {
             const slotStatus = getSlotStatus(startDateTime, checkStartTime);
             const warningText = slotStatus.rule?.name ? `היומן סגור (${slotStatus.rule.name}) בשעה שנבחרה` : "היומן סגור בשעה שנבחרה";
             if (!newWarnings.includes(warningText)) {
                newWarnings.push(warningText);
             }
        } else {
            const statusAtEnd = getSlotStatus(addMinutes(endDateTime, -1), format(addMinutes(endDateTime, -1), 'HH:mm'));
            if (!statusAtEnd.isOpen && !newWarnings.some(w => w.includes("היומן סגור"))) {
                 const endWarning = "אזהרה: התור מסתיים מחוץ לשעות הפעילות!";
                 if(!newWarnings.includes(endWarning)) {
                    newWarnings.push(endWarning);
                 }
            }
        }

        // 1. Check for collision
        const appointmentIdToIgnore = appointmentToEdit?.id || appointmentToPlace?.id;
        const hasCollision = allAppointments.some(app => {
            if (app.id === appointmentIdToIgnore) return false;
            if (app.calendarId !== calendarId) return false;
            if (app.status === 'cancelled') return false; // Ignore cancelled appointments
            const existingStart = new Date(app.start);
            const existingEnd = new Date(app.end);
            return startDateTime < existingEnd && endDateTime > existingStart;
        });
        if (hasCollision) {
            newWarnings.push("אזהרה: התור מתנגש עם תור קיים!");
        }

        setWarnings(newWarnings);
    }, [allAppointments, appointmentToEdit, getSlotStatus, calendarId, appointmentToPlace]);


    useEffect(() => {
        checkWarnings(startTime, endTime, currentDate);
    }, [startTime, endTime, currentDate, checkWarnings]);

    useEffect(() => {
        let totalDuration = 0;
        if (isPersonalEvent) {
             const [startH, startM] = startTime.split(':').map(Number);
             const [endH, endM] = endTime.split(':').map(Number);
             if (!isNaN(startH) && !isNaN(endH)) {
                totalDuration = (endH * 60 + endM) - (startH * 60 + startM);
             }
        } else {
            totalDuration = selectedServices.reduce((acc, s) => acc + s.duration, 0);
        }
        
        if (startTime && isValid(currentDate) && !isPersonalEvent) {
            const [hour, minute] = startTime.split(':').map(Number);
            const startDateTime = set(currentDate, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
            if (isValid(startDateTime)) {
                const newEndTime = addMinutes(startDateTime, totalDuration);
                setEndTime(format(newEndTime, 'HH:mm'));
            }
        }
        
    }, [selectedServices, startTime, currentDate, isPersonalEvent]);
    
    useEffect(() => {
        const totalPrice = selectedServices.reduce((acc, s) => acc + (s.price || 0), 0);
        setAmount(totalPrice);
    },[selectedServices]);
    
    const initializeForm = useCallback((app: Appointment, slot?: NewAppointmentSlot) => {
        const isPersonal = !app.clientId;
        const startDate = slot ? slot.date : new Date(app.start);
        const startTimeStr = slot ? slot.time : format(new Date(app.start), 'HH:mm');

        setIsPersonalEvent(isPersonal);
        setClientId(app.clientId);
        setClientSearch(app.clientName);
        setNotes(app.notes || '');
        setArrivalConfirmed(!!app.arrivalConfirmed);
        setAmount(app.amount || 0);
        setPaid(app.paid || 0);

        const serviceIds = app.serviceId?.split(',') || [];
        const currentServices = services.filter(s => serviceIds.includes(s.id));
        setSelectedServices(currentServices);
        setCustomServiceName(isPersonal ? app.serviceName : '');
        
        setCurrentDate(startDate);
        setStartTime(startTimeStr);
        setCalendarId(app.calendarId);

        const duration = currentServices.reduce((acc, s) => acc + s.duration, 0);
        const startDateTime = set(startDate, {hours: parseInt(startTimeStr.split(':')[0]), minutes: parseInt(startTimeStr.split(':')[1])});
        const endDateTime = addMinutes(startDateTime, duration);
        setEndTime(format(endDateTime, 'HH:mm'));

        checkWarnings(startTimeStr, format(endDateTime, 'HH:mm'), startDate);
    }, [services, checkWarnings]);


    useEffect(() => {
        if (appointmentToPlace && appointmentSlot) {
            initializeForm(appointmentToPlace, appointmentSlot);
            return;
        }

        const isEditing = !!appointmentToEdit;
        
        if (appointmentSlot && !isEditing) {
            // New Appointment
            const startDateTime = set(appointmentSlot.date, {hours: parseInt(appointmentSlot.time.split(':')[0]), minutes: parseInt(appointmentSlot.time.split(':')[1])});
            const endDateTime = addMinutes(startDateTime, 15);
            setSelectedServices([]);
            setCustomServiceName('');
            setCurrentDate(appointmentSlot.date);
            setStartTime(appointmentSlot.time);
            setEndTime(format(endDateTime, 'HH:mm'));
            setCalendarId(appointmentSlot.calendarId);
            if (clientIdForNewAppointment) {
                const client = clients.find(c => c.id === clientIdForNewAppointment);
                if (client) {
                    setClientId(client.id);
                    setClientSearch(`${client.firstName} ${client.lastName}`);
                }
            } else {
                setClientSearch('');
                setClientId(null);
            }
            setNotes('');
            setArrivalConfirmed(false);
            setAmount(0);
            setPaid(0);
            setIsPersonalEvent(false);
            checkWarnings(appointmentSlot.time, format(endDateTime, 'HH:mm'), appointmentSlot.date);
        } else if (appointmentToEdit && !appointmentSlot) {
            // Editing Appointment
            initializeForm(appointmentToEdit);
        }
    }, [appointmentSlot, appointmentToEdit, initializeForm, appointmentToPlace, clientIdForNewAppointment, clients, checkWarnings]);


    const handleServiceSelect = (service: Service) => {
        setSelectedServices(prev => {
            const isSelected = prev.some(s => s.id === service.id);
            if (isSelected) {
                return prev.filter(s => s.id !== service.id);
            }
            return [...prev, service];
        });
        setCustomServiceName('');
    };

    const handleRemoveService = (serviceId: string) => {
        setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
    }
    
    const getServiceName = () => {
        if (isPersonalEvent) {
            return customServiceName.trim() || 'פגישה אישית';
        }
        const serviceNames = selectedServices.map(s => s.name).join(', ');
        return serviceNames || 'תור אישי';
    }

    const handleSave = async () => {
        const isFormValid = isPersonalEvent ? customServiceName.trim() : clientId;
        if (!isFormValid) {
            const message = isPersonalEvent ? 'יש להזין תיאור לפגישה.' : 'יש לבחור לקוח.';
            toast({ variant: 'destructive', title: 'שגיאה', description: message });
            return;
        }

        const client = clients.find(c => c.id === clientId);

        const baseDate = startOfDay(currentDate);
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startDateTime = set(baseDate, { hours: startHour, minutes: startMinute, seconds: 0, milliseconds: 0 });

        const [endHour, endMinute] = endTime.split(':').map(Number);
        const endDateTime = set(baseDate, { hours: endHour, minutes: endMinute, seconds: 0, milliseconds: 0 });
        
        if(!isValid(startDateTime) || !isValid(endDateTime) || endDateTime <= startDateTime) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'טווח השעות אינו תקין.' });
            return;
        }

        const editingId = appointmentToEdit?.id || appointmentToPlace?.id;
        const currentStatus = appointmentToEdit?.status || appointmentToPlace?.status || 'scheduled';


        const appointmentData: Omit<Appointment, 'id'> & { id?: string } = {
            id: editingId,
            businessId: 'default',
            calendarId: calendarId,
            clientId: isPersonalEvent ? null : client!.id,
            clientName: isPersonalEvent ? 'פגישה אישית' : `${client!.firstName} ${client!.lastName}`,
            serviceName: getServiceName(),
            serviceId: isPersonalEvent ? 'personal' : selectedServices.map(s => s.id).join(','),
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            status: currentStatus,
            notes: notes,
            arrivalConfirmed: isPersonalEvent ? false : arrivalConfirmed,
            amount: isPersonalEvent ? 0 : amount,
            paid: isPersonalEvent ? 0 : paid,
        };
        
        startSaving(async () => {
            const result = await saveAppointmentAction(appointmentData);
            if (result) {
                const action = editingId ? 'Appointment Changed' : 'Appointment Created';
                const details = `${action === 'Appointment Changed' ? 'Changed' : 'Created'} appointment for ${appointmentData.clientName} for ${appointmentData.serviceName} at ${format(new Date(appointmentData.start), 'dd/MM/yyyy HH:mm')}.`;
                await createLog({ action, details, user: 'Admin' });

                toast({ title: "הצלחה", description: "התור נשמר בהצלחה."});
                onSaveSuccess();
                onOpenChange(false);
            } else {
                 toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשמור את התור."});
            }
        });
    }

    const handleCancelAppointment = () => {
        if (!appointmentToEdit) return;

        startCancelling(async () => {
            const result = await updateAppointmentStatus(appointmentToEdit.id, 'cancelled', 'admin');

            if (result.success) {
                const logDetails = `Appointment for ${appointmentToEdit.clientName} at ${format(new Date(appointmentToEdit.start), 'dd/MM/yyyy HH:mm')} was cancelled.`;
                await createLog({
                    action: 'Appointment Cancellation',
                    details: logDetails,
                    user: 'Admin'
                });
                
                toast({ title: "הצלחה", description: "התור בוטל."});
                onSaveSuccess();
                onOpenChange(false);
            } else {
                 toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לבטל את התור."});
            }
        });
    }
    
    const handleClientAdded = (newClient: Client) => {
        onClientAdded(newClient);
        setClientId(newClient.id);
        setClientSearch(`${newClient.firstName} ${newClient.lastName}`);
        setIsAddClientOpen(false);
        toast({ title: 'הצלחה!', description: `הלקוח ${newClient.firstName} נוסף ונבחר.`})
    }
    
    const handleAddNewClient = (name: string) => {
        setClientSearch(name);
        setIsAddClientOpen(true);
        setIsClientComboboxOpen(false);
    }
    
    if (!appointmentSlot && !appointmentToEdit) return null;
    
    const isEditMode = !!appointmentToEdit;
    const balance = amount - paid;

    const filteredClients = clientSearch ? clients.filter(c => {
        const term = clientSearch.toLowerCase();
        return (
            c.firstName.toLowerCase().includes(term) ||
            c.lastName.toLowerCase().includes(term) ||
            c.phone.includes(term)
        );
    }) : clients;
    
    const canSave = isEditMode ? permissions.canChangeAppointments : true;
    const canCancel = permissions.canCancelAppointments;

    const dialogTitle = appointmentToPlace
        ? "העבר תור ממתין"
        : isPersonalEvent
        ? "פגישה אישית / סגירה"
        : isEditMode
        ? 'עריכת תור קיים'
        : 'יצירת תור חדש';


    return (
        <>
            <Dialog open={!!(appointmentSlot || appointmentToEdit) && !isAddClientOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
                <DialogHeader className="bg-primary text-primary-foreground -mx-6 -mt-6 p-4 rounded-t-lg flex-row justify-between items-center">
                    <DialogTitle className="text-center text-lg flex-grow">{dialogTitle}</DialogTitle>
                    <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary/80" onClick={() => setIsPersonalEvent(p => !p)}>
                        {isPersonalEvent ? "חזור לתור רגיל" : "פגישה אישית / סגירה"}
                    </Button>
                </DialogHeader>
                 {warnings.length > 0 && (
                    <div className="space-y-1 rounded-md bg-yellow-50 p-3 border border-yellow-200">
                        {warnings.map((warning, index) => (
                             <div key={index} className="flex items-center gap-2 text-sm font-semibold text-yellow-800">
                                <AlertTriangle className="h-4 w-4" />
                                <p>{warning}</p>
                            </div>
                        ))}
                    </div>
                )}
                <ScrollArea className="flex-grow -mx-6 px-6">
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-4">
                           
                           {!isPersonalEvent && (
                                <>
                                    <Label htmlFor="client-search">לקוח:</Label>
                                    <div className="relative">
                                        <Popover open={isClientComboboxOpen} onOpenChange={setIsClientComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Input
                                                    id="client-search"
                                                    placeholder="חיפוש שם, משפחה או טלפון..."
                                                    value={clientSearch}
                                                    onChange={(e) => {
                                                        setClientSearch(e.target.value);
                                                        setClientId(null);
                                                        if (!isClientComboboxOpen) setIsClientComboboxOpen(true);
                                                    }}
                                                    className="w-full pl-8"
                                                    disabled={!!appointmentToPlace || !!clientIdForNewAppointment}
                                                />
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder="חפש שם, משפחה או טלפון..." />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            <Button variant="ghost" className="w-full justify-start" onClick={() => handleAddNewClient(clientSearch)}>
                                                                <UserPlus className="mr-2 h-4 w-4" />
                                                                הוסף לקוח חדש: "{clientSearch}"
                                                            </Button>
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {filteredClients.map((c) => (
                                                                <CommandItem
                                                                    key={c.id}
                                                                    value={`${c.firstName} ${c.lastName} ${c.phone}`}
                                                                    onSelect={() => {
                                                                        setClientId(c.id);
                                                                        setClientSearch(`${c.firstName} ${c.lastName}`);
                                                                        setIsClientComboboxOpen(false);
                                                                    }}
                                                                >
                                                                    <Check className={cn("mr-2 h-4 w-4", clientId === c.id ? "opacity-100" : "opacity-0")} />
                                                                    {c.firstName} {c.lastName}
                                                                    <span className="text-xs text-muted-foreground ml-auto">{c.phone}</span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {clientId && !appointmentToPlace && !clientIdForNewAppointment && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                                onClick={() => {
                                                    setClientId(null);
                                                    setClientSearch('');
                                                }}
                                            >
                                                <X className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                    
                                    <Label htmlFor="service-search">סוג תור:</Label>
                                    <div className="space-y-2">
                                        <Popover open={isServiceComboboxOpen} onOpenChange={setIsServiceComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full justify-between font-normal"
                                                >
                                                    {selectedServices.length > 0 ? selectedServices.map(s => s.name).join(', ') : "בחר שירות..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder="חפש שירות..." />
                                                    <CommandList>
                                                        <CommandEmpty>לא נמצא שירות.</CommandEmpty>
                                                        <CommandGroup>
                                                            {services.map((service) => (
                                                                <CommandItem
                                                                    key={service.id}
                                                                    value={service.name}
                                                                    onSelect={() => handleServiceSelect(service)}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            selectedServices.some(s => s.id === service.id) ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {service.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                         <div className="flex flex-wrap gap-1">
                                            {selectedServices.map(s => (
                                                <Badge
                                                    key={s.id}
                                                    variant="secondary"
                                                    className="flex items-center gap-1"
                                                >
                                                    <span>{s.name}</span>
                                                    <button
                                                        type="button"
                                                        className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                        onClick={() => handleRemoveService(s.id)}
                                                    >
                                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </>
                           )}

                           {isPersonalEvent && (
                            <>
                                <Label htmlFor="personal-event-description">תיאור הפגישה:</Label>
                                <Input id="personal-event-description" placeholder="לדוגמה: יציאה לרופא" value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} />
                            </>
                           )}

                            <Label>תאריך:</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="justify-start font-normal w-full">
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {format(currentDate, 'dd/MM/yyyy')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={currentDate} onSelect={(d) => d && setCurrentDate(d)} initialFocus />
                                </PopoverContent>
                            </Popover>

                            <Label>שעות:</Label>
                             <div className="flex items-center gap-2">
                                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                <span className="text-muted-foreground">-</span>
                                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={!isPersonalEvent} />
                             </div>
                            
                            <Label>יומן:</Label>
                            <Select value={calendarId} onValueChange={setCalendarId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר יומן..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {calendars.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Label>הערות:</Label>
                            <Textarea placeholder="הערות..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>

                        {!isPersonalEvent && (
                            <>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <Checkbox id="arrival-confirmed" checked={arrivalConfirmed} onCheckedChange={(checked) => setArrivalConfirmed(!!checked)} />
                                    <Label htmlFor="arrival-confirmed">אישר הגעה</Label>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
                                    <Label className="font-bold text-pink-600">לתשלום:</Label>
                                    <div className="flex items-center gap-2">
                                    <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-24 text-pink-600 font-bold"/>
                                    <span className="text-pink-600 font-bold">₪</span>
                                    </div>

                                    <Label className="font-bold text-green-600">שולם:</Label>
                                    <div className="flex items-center gap-2">
                                    <Input type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value))} className="w-24 text-green-600 font-bold" />
                                    <span className="text-green-600 font-bold">₪</span>
                                    </div>

                                    <Label className="font-bold">יתרה:</Label>
                                    <p className="font-bold">{balance.toFixed(2)} ₪</p>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="justify-between pt-4 border-t flex-shrink-0">
                    <Button variant="destructive" onClick={handleCancelAppointment} disabled={isCancelling || !isEditMode || !canCancel}>
                        {isCancelling ? <Loader2 className="animate-spin ml-2" /> : <CalendarX2 className="ml-2"/>}
                        ביטול תור
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>סגור</Button>
                        <Button className="bg-green-500 hover:bg-green-600" onClick={handleSave} disabled={isSaving || (warnings.length > 0 && warnings.some(w => w.includes("היומן סגור"))) || !canSave}>
                             {isSaving ? <Loader2 className="animate-spin" /> : 'שמור'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <AddClientDialog onSave={handleClientAdded} onClose={() => setIsAddClientOpen(false)} prefillName={clientSearch} />
        </Dialog>
      </>
    );
};

function CalendarComponent() {
    const searchParams = useSearchParams();
    const from = searchParams.get('from');
    const pendingAppointmentId = searchParams.get('pendingAppointmentId');
    const clientIdForNewAppointment = searchParams.get('clientIdForNewAppointment');
    const viewParam = searchParams.get('view');
    const { user, permissions, isLoading: isUserLoading } = useAdminUser();
    
    const [currentDate, setCurrentDate] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<'weekly' | 'daily'>(viewParam === 'daily' ? 'daily' : 'weekly');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [openingHours, setOpeningHours] = useState<BusinessHoursRule[]>([]);
    const [closingHours, setClosingHours] = useState<BusinessHoursRule[]>([]);
    const [businessHoursLoaded, setBusinessHoursLoaded] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [calendarView, setCalendarView] = useState('gregorian');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [calendars, setCalendars] = useState<CalendarType[]>([]);
    const [isFetching, startFetching] = useTransition();
    const [newAppointmentSlot, setNewAppointmentSlot] = useState<NewAppointmentSlot | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [appointmentToPlace, setAppointmentToPlace] = useState<Appointment | null>(null);

    const TIME_SLOT_HEIGHT = 40;
    const TIME_SLOT_INTERVAL = 15;

    const weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0; // Sunday

     useEffect(() => {
        const dateFromParams = searchParams.get('date');
        if (dateFromParams && isValid(new Date(dateFromParams))) {
            setCurrentDate(new Date(dateFromParams));
        } else {
            setCurrentDate(new Date());
        }
    }, [searchParams]);
    
    useEffect(() => {
        if(pendingAppointmentId) {
            const fetchAppointmentToPlace = async () => {
                const app = await getAppointmentById(pendingAppointmentId);
                if (app) {
                    setAppointmentToPlace(app);
                }
            }
            fetchAppointmentToPlace();
        } else {
            setAppointmentToPlace(null);
        }
    }, [pendingAppointmentId]);

    const { weekStart, weekEnd, days, headerRangeText } = useMemo(() => {
        if (!currentDate) {
            return { weekStart: new Date(), weekEnd: new Date(), days: [], headerRangeText: ''};
        }
        let start: Date, end: Date, dayList: Date[], header: string;
        
        if (viewMode === 'daily') {
            start = currentDate;
            end = currentDate;
            dayList = [currentDate];
            header = format(currentDate, 'd MMMM yyyy', { locale: he });
        } else { // weekly
            start = startOfWeek(currentDate, { weekStartsOn });
            end = endOfWeek(currentDate, { weekStartsOn });
            dayList = Array.from({ length: 7 }, (_, i) => addDays(start, i));
            header = `${format(start, 'd MMM', { locale: he })} - ${format(end, 'd MMM yyyy', { locale: he })}`;
        }
        
        return { 
            weekStart: start, 
            weekEnd: end, 
            days: dayList, 
            headerRangeText: header,
        };

    }, [currentDate, viewMode]);

    const timeSlots = useMemo(() => {
        const slots: string[] = [];
        for (let i = 0; i < 24 * (60 / TIME_SLOT_INTERVAL); i++) {
            const totalMinutes = i * TIME_SLOT_INTERVAL;
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
        }
        return slots;
    }, [TIME_SLOT_INTERVAL]);

    const { visibleTimeSlots, earliestHour } = useMemo(() => {
        if (!businessHoursLoaded || openingHours.length === 0) {
            return { visibleTimeSlots: timeSlots, earliestHour: 8 };
        }

        let minHour = 24;
        
        openingHours.forEach(rule => {
            const startHour = parseInt(rule.startTime.split(':')[0], 10);
            if (startHour < minHour) minHour = startHour;
        });

        if (minHour === 24) { // No valid opening hours found
            return { visibleTimeSlots: timeSlots, earliestHour: 8 };
        }

        return { visibleTimeSlots: timeSlots, earliestHour: minHour };

    }, [businessHoursLoaded, openingHours, timeSlots]);


    useEffect(() => {
        if (!scrollContainerRef.current || !businessHoursLoaded || !visibleTimeSlots.length) return;
        
        const scrollTargetHour = earliestHour < 24 ? earliestHour : 8;
        
        const firstVisibleSlotTime = visibleTimeSlots[0];
        if (!firstVisibleSlotTime) return;

        const [firstHour, firstMinute] = firstVisibleSlotTime.split(':').map(Number);
        const firstSlotTotalMinutes = firstHour * 60 + firstMinute;
        const targetSlotTotalMinutes = scrollTargetHour * 60;
        
        const minutesFromTop = targetSlotTotalMinutes - firstSlotTotalMinutes;

        if (minutesFromTop >= 0) {
            const scrollTop = (minutesFromTop / TIME_SLOT_INTERVAL) * TIME_SLOT_HEIGHT;
            scrollContainerRef.current.scrollTop = scrollTop;
        } else {
            scrollContainerRef.current.scrollTop = 0;
        }
    
    }, [currentDate, viewMode, businessHoursLoaded, visibleTimeSlots, earliestHour, TIME_SLOT_INTERVAL, TIME_SLOT_HEIGHT]);


    const fetchBusinessHours = async () => {
        setBusinessHoursLoaded(false);
        const { opening, closing } = await getBusinessHours();
        setOpeningHours(opening);
        setClosingHours(closing);
        setBusinessHoursLoaded(true);
    };

    const fetchAppointmentsAndData = useCallback(async () => {
         startFetching(async () => {
            const [fetchedAppointments, fetchedClients, fetchedServices, fetchedCalendars] = await Promise.all([
                getAppointments(weekStart, addDays(weekEnd, 1)),
                getClients(),
                getServices(),
                getCalendars()
            ]);
            
            setAppointments(fetchedAppointments);
            setClients(fetchedClients);
            setServices(fetchedServices);
            setCalendars(fetchedCalendars);
        });
    }, [weekStart, weekEnd]);

    useEffect(() => {
        fetchBusinessHours();
        const savedView = localStorage.getItem('calendarView');
        if (savedView) {
            setCalendarView(savedView);
        }
    }, []);

    useEffect(() => {
        if(currentDate) {
            fetchAppointmentsAndData();
        }
    }, [fetchAppointmentsAndData, currentDate]);

    const handlePrev = () => {
        if(!currentDate) return;
        const daysToSubtract = viewMode === 'weekly' ? 7 : 1;
        setCurrentDate(subDays(currentDate, daysToSubtract));
    };

    const handleNext = () => {
        if(!currentDate) return;
        const daysToAdd = viewMode === 'weekly' ? 7 : 1;
        setCurrentDate(addDays(currentDate, daysToAdd));
    };
    
    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            setCurrentDate(date);
            setIsDatePickerOpen(false);
        }
    }
    
    const handleGoToToday = () => {
        setCurrentDate(new Date());
    };
    
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

        if (openingHours.length === 0) return { isOpen: true };

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

    const handlePrint = async () => {
        const input = calendarRef.current;
        if (!input) return;

        try {
            const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
                import('jspdf'),
                import('html2canvas')
            ]);

            const canvas = await html2canvas(input, { 
                useCORS: true, 
                backgroundColor: '#ffffff',
                scale: 2 
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            let newWidth = pdfWidth;
            let newHeight = newWidth / ratio;

            if (newHeight > pdfHeight) {
                newHeight = pdfHeight;
                newWidth = newHeight * ratio;
            }
            
            const x = (pdfWidth - newWidth) / 2;
            const y = (pdfHeight - newHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, newWidth, newHeight);
            pdf.save("calendar.pdf");
        } catch (error) {
            console.error("Error generating PDF:", error);
        }
    };
    
    const handleSlotClick = (date: Date, time: string) => {
        setNewAppointmentSlot({ date, time, calendarId: calendars[0]?.id || 'default' });
        setSelectedAppointment(null);
    }
    
    const handleAppointmentClick = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setNewAppointmentSlot(null);
    }
    
    const closeFormDialog = () => {
        setNewAppointmentSlot(null);
        setSelectedAppointment(null);
        if (appointmentToPlace) {
            setAppointmentToPlace(null);
        }
    }
    
    const dailyAppointments = useMemo(() => {
        const daily: { [key: string]: (Appointment & { layout: { width: string, left: string, top: string, height: string } })[] } = {};

        const firstVisibleSlotTime = visibleTimeSlots[0] || "00:00";
        const [startHour, startMinute] = firstVisibleSlotTime.split(':').map(Number);
        const dayStartOffsetMinutes = startHour * 60 + startMinute;

        days.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayAppointments = appointments
                .filter(app => format(new Date(app.start), 'yyyy-MM-dd') === dayKey)
                .filter(app => app.status !== 'cancelled')
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            if (dayAppointments.length === 0) {
                daily[dayKey] = [];
                return;
            }
            
            let allCollisions: Appointment[][] = [];

            // Group events that visually collide
            for (const event of dayAppointments) {
                let foundGroup = false;
                for (let group of allCollisions) {
                    if (group.some(e => !(new Date(event.end) <= new Date(e.start) || new Date(event.start) >= new Date(e.end)))) {
                        group.push(event);
                        foundGroup = true;
                        break;
                    }
                }
                if (!foundGroup) {
                    allCollisions.push([event]);
                }
            }

            let processedAppointments: (Appointment & { layout: { width: string, left: string, top: string, height: string } })[] = [];
            for (const collisionGroup of allCollisions) {
                const columns: Appointment[][] = [];
                collisionGroup.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

                for (const event of collisionGroup) {
                    let placed = false;
                    for (let i = 0; i < columns.length; i++) {
                        if (!columns[i].some(e => new Date(event.start) < new Date(e.end))) {
                            columns[i].push(event);
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        columns.push([event]);
                    }
                }

                const totalColumns = columns.length;
                columns.forEach((column, colIndex) => {
                    for (const event of column) {
                        const appStartTime = new Date(event.start);
                        const appStartTotalMinutes = appStartTime.getHours() * 60 + appStartTime.getMinutes();
                        
                        const top = ((appStartTotalMinutes - dayStartOffsetMinutes) / TIME_SLOT_INTERVAL) * TIME_SLOT_HEIGHT;

                        // Don't process appointments that start before the visible range.
                        if (top < 0) continue;

                        const height = Math.max(
                            TIME_SLOT_HEIGHT,
                            (differenceInMinutes(new Date(event.end), appStartTime) / TIME_SLOT_INTERVAL) * TIME_SLOT_HEIGHT
                        );
                        
                        processedAppointments.push({
                            ...event,
                            layout: {
                                top: `${top}px`,
                                height: `${height}px`,
                                width: `${100 / totalColumns}%`,
                                left: `${(colIndex / totalColumns) * 100}%`
                            }
                        });
                    }
                });
            }

            daily[dayKey] = processedAppointments;
        });

        return daily;
    }, [appointments, days, visibleTimeSlots, TIME_SLOT_INTERVAL, TIME_SLOT_HEIGHT]);

    if (isUserLoading || !currentDate || !permissions) {
        return (
             <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    const backButtonHref = from === 'pending' ? '/admin/appointments/pending' : '/admin';
    const backButtonText = from === 'pending' ? 'חזרה לאישור תורים' : 'חזרה';
    
    const visibleCalendars = calendars.filter(c => permissions.accessibleCalendars.includes(c.id));


    return (
        <div className="p-4 space-y-4 flex flex-col h-[calc(100vh-theme(spacing.16))] bg-[#F9F7F9]">
             {appointmentToPlace && (
                <div className="bg-primary/10 border-l-4 border-primary text-primary-dark p-3 rounded-md flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Pin className="h-5 w-5" />
                        <div>
                            <p className="font-bold">מצב שיבוץ תור ממתין</p>
                            <p className="text-sm">
                                בחר שעה פנויה ביומן כדי למקם את התור של {appointmentToPlace.clientName}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setAppointmentToPlace(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
                <div className="flex items-center gap-2">
                     <Link href={backButtonHref} passHref>
                        <Button variant="outline">
                            <ArrowLeft className="mr-2" />
                            {backButtonText}
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">יומן</h1>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
                    <Button variant="ghost" size="icon" onClick={handlePrev}><ChevronRight className="h-5 w-5"/></Button>
                     <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="w-48 justify-start">
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {headerRangeText}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={currentDate}
                                onSelect={handleDateSelect}
                                initialFocus
                                />
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="icon" onClick={handleNext}><ChevronLeft className="h-5 w-5"/></Button>
                    <Button variant="outline" onClick={handleGoToToday} className="h-auto">היום</Button>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant={viewMode === 'daily' ? 'default' : 'outline'} onClick={() => setViewMode('daily')}>יומי</Button>
                    <Button variant={viewMode === 'weekly' ? 'default' : 'outline'} onClick={() => setViewMode('weekly')}>שבועי</Button>
                    <Button variant="outline">כל היומנים</Button>
                     <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)} disabled={!permissions.canEditCalendarSettings}>
                        <Settings className="w-4 h-4" />
                    </Button>
                    <CalendarSettingsDialog 
                        isOpen={isSettingsOpen} 
                        onOpenChange={setIsSettingsOpen}
                        onSettingsSave={fetchBusinessHours}
                    />
                    <Button onClick={handlePrint}><Printer className="ml-2"/>הדפסה</Button>
                </div>
            </div>
             <Card ref={calendarRef} className="flex-grow flex flex-col overflow-hidden">
                <CardContent className="p-0 flex flex-col h-full">
                   <div className={cn(
                       "grid flex-shrink-0",
                       viewMode === 'weekly' ? "grid-cols-[60px_repeat(7,1fr)]" : "grid-cols-[60px_1fr]"
                    )}>
                        <div className="text-center p-2 border-b border-l bg-card">
                            <span className="text-sm font-medium">{format(currentDate, 'MMMM', { locale: he })}</span>
                        </div>
                        {days.map(day => <DayHeader key={day.toString()} date={day} calendarView={calendarView} holiday={getHolidayForDate(day)} isCurrentDay={isToday(day)} />)}
                   </div>
                   <div ref={scrollContainerRef} className="flex-grow overflow-y-auto no-scrollbar">
                        <div className={cn(
                            "grid relative",
                            viewMode === 'weekly' ? "grid-cols-[60px_repeat(7,1fr)]" : "grid-cols-[60px_1fr]"
                        )}>
                            <div className="col-start-1 col-end-2">
                                {visibleTimeSlots.map(time => <TimeSlot key={time} time={time} />)}
                            </div>
                            
                            {days.map((day, dayIndex) => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                return (
                                <div key={dayKey} className="col-start-auto border-r relative">
                                    {visibleTimeSlots.map((time, slotIndex) => {
                                        const status = getSlotStatus(day, time);
                                        const slotDateTime = set(day, { hours: parseInt(time.split(':')[0]), minutes: parseInt(time.split(':')[1]) });
                                        const isPast = isBefore(slotDateTime, startOfDay(new Date())) || (isToday(day) && isBefore(slotDateTime, new Date()));

                                        return (
                                            <div 
                                                key={slotIndex} 
                                                onClick={() => handleSlotClick(day, time)}
                                                className={cn(
                                                    "h-10 border-b flex items-center justify-center cursor-pointer hover:bg-accent",
                                                    {
                                                        'bg-muted/50': !status.isOpen,
                                                        'bg-background': status.isOpen && !isPast,
                                                        'bg-primary/5': isPast,
                                                    }
                                                )}
                                            >
                                                
                                            </div>
                                        )
                                    })}
                                    {dailyAppointments[dayKey]?.map(app => {
                                            const isPersonalEvent = app.serviceId === 'personal';
                                            const serviceColor = isPersonalEvent
                                                ? '#a7f3d0' // mint green for personal events
                                                : services.find(s => s.id === (app.serviceId || '').split(',')[0])?.displayColor || '#d1d5db';
                                            
                                            const backgroundStyle: React.CSSProperties = {
                                                backgroundColor: serviceColor,
                                                color: '#000000',
                                            };
                                            
                                            return (
                                                <button
                                                    key={app.id} 
                                                    onClick={() => handleAppointmentClick(app)}
                                                    className={cn(
                                                        "absolute p-1 rounded-md text-xs overflow-hidden border border-primary/50 text-right flex flex-col",
                                                        app.status === 'pending' && 'opacity-60 border-dashed border-orange-500',
                                                        app.status === 'pending_cancellation' && 'opacity-50 line-through'
                                                    )}
                                                    style={{ 
                                                        ...backgroundStyle,
                                                        ...app.layout,
                                                    }}
                                                >
                                                   <div className="flex-grow space-y-1 overflow-hidden">
                                                        <p className="font-bold whitespace-nowrap overflow-ellipsis overflow-hidden">{isPersonalEvent ? app.serviceName : app.clientName}</p>
                                                        {!isPersonalEvent && <p className="whitespace-nowrap overflow-ellipsis overflow-hidden">{app.serviceName}</p>}
                                                    </div>
                                                   <div className="flex justify-between items-center mt-auto flex-shrink-0">
                                                        <span className="text-xs">{format(new Date(app.start), 'HH:mm')} - {format(new Date(app.end), 'HH:mm')}</span>
                                                        <div className="flex gap-1">
                                                            {app.notes && <FileText className="w-3 h-3" />}
                                                            {app.arrivalConfirmed && <CheckCircle2 className="w-3 h-3 text-green-800" />}
                                                        </div>
                                                   </div>
                                                </button>
                                            )
                                        })}
                                </div>
                                )
                            })}
                        </div>
                   </div>
                </CardContent>
            </Card>
            <AppointmentFormDialog
                appointmentSlot={newAppointmentSlot}
                appointmentToEdit={selectedAppointment}
                onOpenChange={(isOpen) => !isOpen && closeFormDialog()}
                clients={clients}
                services={services}
                calendars={visibleCalendars}
                onSaveSuccess={fetchAppointmentsAndData}
                onClientAdded={(newClient) => setClients(prev => [...prev, newClient])}
                allAppointments={appointments}
                openingHours={openingHours}
                closingHours={closingHours}
                permissions={permissions}
                appointmentToPlace={appointmentToPlace}
                setAppointmentToPlace={setAppointmentToPlace}
                clientIdForNewAppointment={clientIdForNewAppointment}
            />
        </div>
    );
}

export function AdminCalendar() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <CalendarComponent />
        </Suspense>
    )
}
    

    


    
