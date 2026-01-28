

'use client';

import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Trash2, Calendar as CalendarIcon, Pencil, Settings, MessageSquare, Plus, X, Upload, UserPlus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { WhatsAppIcon } from './whatsapp-icon';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
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
} from './ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription as DialogDescriptionComponent,
} from './ui/dialog';
import { Label } from './ui/label';
import { getClients, saveClient, deleteClient, Client } from '@/lib/clients';
import { importClientsFromExcel } from '@/app/admin/clients/actions';
import { useAdminUser } from '@/hooks/use-admin-user';
import { getAppointments, Appointment } from '@/lib/appointments';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/**
 * NOTE:
 * Client כולל businessId חובה (לפי שגיאת הבילד).
 * לכן הטפסים (Edit/Add) לא ינהלו businessId בכלל — אנחנו מוסיפים אותו רק בשמירה.
 */
type ClientFormData = Omit<Client, 'id' | 'createdAt' | 'businessId' | 'updatedAt'>;

function getBusinessIdClientSide(): string {
  // TODO: החלף למקור האמיתי אצלך (settings / user claims / db / context)
  if (typeof window === 'undefined') return 'default';
  return sessionStorage.getItem('businessId') || localStorage.getItem('businessId') || 'default';
}

const BirthDateSelector = ({ value, onChange, disabled }: { value: Date | undefined | null, onChange: (date: Date | undefined) => void, disabled?: boolean }) => {
    const initialDate = React.useMemo(() => value && !isNaN(new Date(value).valueOf()) ? new Date(value) : null, [value]);

    const [day, setDay] = React.useState<string>(initialDate ? initialDate.getDate().toString() : "");
    const [month, setMonth] = React.useState<string>(initialDate ? (initialDate.getMonth() + 1).toString() : "");
    const [year, setYear] = React.useState<string>(initialDate ? initialDate.getFullYear().toString() : "");

    React.useEffect(() => {
        const newDate = value && !isNaN(new Date(value).valueOf()) ? new Date(value) : null;
        setDay(newDate ? newDate.getDate().toString() : "");
        setMonth(newDate ? (newDate.getMonth() + 1).toString() : "");
        setYear(newDate ? newDate.getFullYear().toString() : "");
    }, [value]);

    React.useEffect(() => {
        if (year && month && day) {
            const yearNum = parseInt(year);
            const monthNum = parseInt(month) - 1;
            const dayNum = parseInt(day);

            const newDate = new Date(yearNum, monthNum, dayNum);
            
            if (newDate.getFullYear() === yearNum && newDate.getMonth() === monthNum && newDate.getDate() === dayNum) {
                if (!initialDate || newDate.getTime() !== initialDate.getTime()) {
                    onChange(newDate);
                }
            }
        } else if (!year && !month && !day) {
            if (initialDate !== null) {
                onChange(undefined);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [day, month, year, initialDate]);
    
    const handleDayChange = (newDay: string) => {
        setDay(newDay);
    };

    const handleMonthChange = (newMonth: string) => {
        setMonth(newMonth);
        if (year && day) {
            const dayNum = parseInt(day);
            const daysInNewMonth = new Date(parseInt(year), parseInt(newMonth), 0).getDate();
            if (dayNum > daysInNewMonth) {
                setDay(daysInNewMonth.toString());
            }
        }
    };

    const handleYearChange = (newYear: string) => {
        setYear(newYear);
        if (month === '2' && day === '29') {
            const isLeap = new Date(parseInt(newYear), 1, 29).getMonth() === 1;
            if (!isLeap) {
                setDay('28');
            }
        }
    };

    const years = Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const daysInMonth = (y: string, m: string) => (y && m) ? new Date(parseInt(y), parseInt(m), 0).getDate() : 31;
    const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

    return (
        <div className="flex gap-2" dir="rtl">
            <Select value={day} onValueChange={handleDayChange} disabled={disabled}>
                <SelectTrigger className="w-[80px]"><SelectValue placeholder="יום" /></SelectTrigger>
                <SelectContent>
                    {days.map(d => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={month} onValueChange={handleMonthChange} disabled={disabled}>
                <SelectTrigger className="w-[100px]"><SelectValue placeholder="חודש" /></SelectTrigger>
                <SelectContent>
                    {months.map(m => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={year} onValueChange={handleYearChange} disabled={disabled}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="שנה" /></SelectTrigger>
                <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
};

const ClientAppointmentsDialog = ({ client }: { client: Client | null }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (client) {
      const fetchAppointments = async () => {
        setIsLoading(true);
        try {
          // Fetch all appointments for the client (past and future)
          const clientAppointments = await getAppointments(undefined, undefined, client.businessId, client.id);
          // Sort them by date, newest first
          const sortedAppointments = clientAppointments.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
          setAppointments(sortedAppointments);
        } catch (error) {
          console.error("Failed to fetch client appointments:", error);
          // Optionally show a toast or error message
        } finally {
          setIsLoading(false);
        }
      };
      fetchAppointments();
    }
  }, [client]);

  if (!client) return null;

  const getStatusText = (app: Appointment): string => {
    const isPast = new Date(app.start) < new Date();
    if (isPast && (app.status === 'scheduled' || app.status === 'confirmed')) {
        return 'הושלם';
    }
    switch (app.status) {
      case 'completed': return 'הושלם';
      case 'scheduled': return 'מתוכנן';
      case 'confirmed': return 'מאושר';
      case 'pending': return 'ממתין לאישור';
      case 'cancelled': return 'בוטל';
      case 'no-show': return 'לא הופיע';
      default: return app.status;
    }
  };

  const getStatusClass = (app: Appointment): string => {
      const isPast = new Date(app.start) < new Date();
      const displayStatus = (isPast && (app.status === 'scheduled' || app.status === 'confirmed')) ? 'completed' : app.status;
      switch (displayStatus) {
        case 'completed':
        case 'scheduled':
        case 'confirmed':
            return 'bg-green-100 text-green-800';
        case 'cancelled':
        case 'no-show':
            return 'bg-red-100 text-red-800';
        case 'pending':
            return 'bg-orange-100 text-orange-800';
        default:
            return 'bg-gray-100 text-gray-800';
      }
  };


  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          היסטוריית תורים עבור {client.firstName} {client.lastName}
        </DialogTitle>
        <DialogDescriptionComponent>כאן ניתן לראות את כל התורים הקודמים והעתידיים של הלקוח.</DialogDescriptionComponent>
      </DialogHeader>

      <div className="py-4 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : (
          <ul className="space-y-4">
            {appointments.length > 0 ? (
              appointments.map((app) => (
                <li key={app.id} className="flex justify-between items-center p-3 border rounded-md bg-accent/50">
                  <div>
                    <p className="font-semibold">{app.serviceName}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(app.start), 'd MMM yyyy, HH:mm', { locale: he })}</p>
                  </div>
                  <span
                    className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusClass(app)}`}
                  >
                    {getStatusText(app)}
                  </span>
                </li>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">לא קיימים תורים ללקוח/ה.</p>
            )}
          </ul>
        )}
      </div>

      <DialogFooter className="sm:justify-between items-center">
        <Link href={`/admin/calendar?clientIdForNewAppointment=${client.id}`} passHref>
          <Button>
            <CalendarIcon className="ml-2" />
            קבע תור חדש
          </Button>
        </Link>
      </DialogFooter>
    </DialogContent>
  );
};

const EditClientDialog = ({
  client,
  onSave,
  onClose,
}: {
  client: Client | null;
  onSave: (updatedClient: Client) => void;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState<Partial<ClientFormData>>({});

  useEffect(() => {
    if (client) {
      setFormData({
        firstName: client.firstName ?? '',
        lastName: client.lastName ?? '',
        phone: client.phone ?? '',
        gender: client.gender ?? 'female',
        email: client.email ?? '',
        idNumber: client.idNumber ?? '',
        city: client.city ?? '',
        street: client.street ?? '',
        houseNumber: client.houseNumber ?? '',
        birthDate: client.birthDate,
      });
    }
  }, [client]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleGenderChange = (gender: 'male' | 'female') => {
      setFormData(prev => ({ ...prev, gender }));
  }
  
  const handleDateChange = (date: Date | undefined) => {
    setFormData(prev => ({
        ...prev,
        birthDate: date ? date.toISOString() : null,
    }));
  }

  const handleSave = () => {
    if (!client) return;

    onSave({
      ...client,
      ...formData,
    } as Client);
  };

  if (!client) return null;

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          עריכת פרטי לקוח: {`${client.firstName} ${client.lastName}`}
        </DialogTitle>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">שם פרטי</Label>
            <Input id="firstName" name="firstName" value={formData.firstName || ''} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">שם משפחה</Label>
            <Input id="lastName" name="lastName" value={formData.lastName || ''} onChange={handleChange} />
          </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="email">כתובת אימייל</Label>
            <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} />
        </div>

        <div className="space-y-2">
            <Label>תאריך לידה</Label>
             <BirthDateSelector
                value={formData.birthDate ? new Date(formData.birthDate) : null}
                onChange={handleDateChange}
             />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="phone">טלפון</Label>
          <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} dir="ltr" />
        </div>
        
        <div className="space-y-2">
            <Label>מין</Label>
            <RadioGroup
                value={formData.gender}
                onValueChange={handleGenderChange}
                className="flex gap-4 pt-2"
            >
                <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="female" id="female-edit" />
                    <Label htmlFor="female-edit" className="font-normal">נקבה</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="male" id="male-edit" />
                    <Label htmlFor="male-edit" className="font-normal">זכר</Label>
                </div>
            </RadioGroup>
        </div>

        <div className="space-y-2">
            <Label htmlFor="idNumber">תעודת זהות</Label>
            <Input id="idNumber" name="idNumber" value={formData.idNumber || ''} onChange={handleChange} />
        </div>

        <div className="space-y-2">
            <Label htmlFor="city">עיר</Label>
            <Input id="city" name="city" value={formData.city || ''} onChange={handleChange} />
        </div>
        
        <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2">
                <Label htmlFor="street">רחוב</Label>
                <Input id="street" name="street" value={formData.street || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="houseNumber">מס' בית</Label>
                <Input id="houseNumber" name="houseNumber" value={formData.houseNumber || ''} onChange={handleChange} />
            </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ביטול
        </Button>
        <Button onClick={handleSave}>שמור שינויים</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const AddClientDialog = ({
  onSave,
  onClose,
}: {
  onSave: (newClient: ClientFormData) => void;
  onClose: () => void;
}) => {
  const [formData, setFormData] = useState<ClientFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    gender: 'female',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>הוספת לקוח חדש</DialogTitle>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="add-firstName">שם פרטי</Label>
          <Input id="add-firstName" name="firstName" value={formData.firstName} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="add-lastName">שם משפחה</Label>
          <Input id="add-lastName" name="lastName" value={formData.lastName} onChange={handleChange} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="add-phone">טלפון</Label>
          <Input id="add-phone" name="phone" value={formData.phone} onChange={handleChange} dir="ltr" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ביטול
        </Button>
        <Button onClick={handleSave}>שמור לקוח</Button>
      </DialogFooter>
    </DialogContent>
  );
};

const ImportClientsDialog = ({
  onImportSuccess,
  onClose,
}: {
  onImportSuccess: () => void;
  onClose: () => void;
}) => {
  const [isImporting, startImportTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'יש לבחור קובץ תחילה.' });
      return;
    }

    startImportTransition(async () => {
      const formData = new FormData();
      formData.append('file', file);

      const result = await importClientsFromExcel(formData);

      if (result?.error) {
        toast({ variant: 'destructive', title: 'שגיאת ייבוא', description: result.error });
      } else {
        toast({ title: 'הצלחה!', description: result?.success || 'הייבוא בוצע בהצלחה.' });
        onImportSuccess();
      }
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>ייבוא לקוחות מקובץ Excel</DialogTitle>
        <DialogDescriptionComponent>
          בחר קובץ Excel (xlsx) כדי לייבא לקוחות למערכת. העמודות הנדרשות הן: שם, משפחה, נייד, דוא&quot;ל.
        </DialogDescriptionComponent>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <Input ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
        {file && <p className="text-sm text-muted-foreground">קובץ שנבחר: {file.name}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          ביטול
        </Button>
        <Button onClick={handleImport} disabled={isImporting || !file}>
          {isImporting ? <Loader2 className="animate-spin" /> : 'ייבא לקוחות'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isImportClientOpen, setIsImportClientOpen] = useState(false);
  const [isMutating, startMutation] = useTransition();
  const { toast } = useToast();
  const { permissions } = useAdminUser();

  const businessId = useMemo(() => getBusinessIdClientSide(), []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const fetchedClients = await getClients(businessId);
      setClients(fetchedClients);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את רשימת הלקוחות.' });
      setClients([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        const fullName = `${client.firstName} ${client.lastName}`;
        const term = searchTerm.toLowerCase();

        return (
          fullName.toLowerCase().includes(term) ||
          (permissions.canViewClientPhone && (client.phone || '').toLowerCase().includes(term))
        );
      }),
    [clients, searchTerm, permissions.canViewClientPhone],
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedClients(filteredClients.map((c) => c.id));
    else setSelectedClients([]);
  };

  const handleSelectClient = (clientId: string, checked: boolean) => {
    if (checked) setSelectedClients((prev) => [...prev, clientId]);
    else setSelectedClients((prev) => prev.filter((id) => id !== clientId));
  };

  const handleDeleteSelected = () => {
    startMutation(async () => {
      await Promise.all(selectedClients.map((id) => deleteClient(id)));
      toast({
        title: 'הצלחה!',
        description: `נמחקו ${selectedClients.length} לקוחות בהצלחה.`,
      });
      setSelectedClients([]);
      fetchClients();
    });
  };

  const formatWhatsAppLink = (phone: string): string => {
    const cleanedPhone = (phone || '').replace(/[^0-9]/g, '');
    if (cleanedPhone.startsWith('0')) return `https://wa.me/972${cleanedPhone.substring(1)}`;
    return `https://wa.me/${cleanedPhone}`;
  };

  const handleSaveEdit = (updatedClient: Client) => {
    startMutation(async () => {
      await saveClient(updatedClient);
      setEditingClient(null);
      toast({
        title: 'הצלחה!',
        description: `פרטי הלקוח ${updatedClient.firstName} ${updatedClient.lastName} עודכנו.`,
      });
      fetchClients();
    });
  };

  const handleSaveNewClient = (newClientData: ClientFormData) => {
    startMutation(async () => {
      // כאן אנחנו מוסיפים businessId חובה לפני שמירה
      const payload: Omit<Client, 'id' | 'createdAt'> = {
        ...newClientData,
        businessId,
      };

      const newClient = await saveClient(payload);
      setIsAddClientOpen(false);
      toast({
        title: 'הצלחה!',
        description: `הלקוח ${newClient.firstName} ${newClient.lastName} נוסף בהצלחה.`,
      });
      fetchClients();
    });
  };

  const handleImportSuccess = () => {
    setIsImportClientOpen(false);
    fetchClients();
  };

  const isAllSelected = filteredClients.length > 0 && selectedClients.length === filteredClients.length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-auto md:flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="חיפוש לקוח..."
            className="pl-10 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
            <Button className="bg-green-500 hover:bg-green-600" onClick={() => setIsAddClientOpen(true)}>
                <Plus className="ml-2" />
                חדש
            </Button>
            <Button variant="outline" onClick={() => setIsImportClientOpen(true)}>
                <Upload className="ml-2" />
                ייבוא
            </Button>
             <Link href="/admin/settings/clients" passHref>
                <Button variant="outline" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
            </Link>
        </div>
      </div>
      
       {selectedClients.length > 0 && (
          <Card className="bg-accent">
              <CardContent className="p-2 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                        <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="בחר הכל" />
                        <span className="text-sm font-medium">{selectedClients.length} נבחרו</span>
                   </div>
                   <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                            <MessageSquare className="ml-2" />
                            שלח SMS
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isMutating}>
                                <Trash2 className="ml-2" />
                                מחק נבחרים
                            </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                <AlertDialogDescription>
                                פעולה זו תמחק {selectedClients.length} לקוחות שנבחרו. לא ניתן לשחזר את הפעולה.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelected} disabled={isMutating}>
                                {isMutating ? <Loader2 className="animate-spin" /> : 'מחיקה'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                   </div>
              </CardContent>
          </Card>
      )}


      <div className="space-y-4">
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
        ) : filteredClients.length > 0 ? (
            filteredClients.map((client) => (
                <Card key={client.id} data-state={selectedClients.includes(client.id) ? 'selected' : ''} className="data-[state=selected]:bg-accent">
                    {/* Desktop View */}
                    <div className="hidden sm:block">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-grow">
                                <Checkbox
                                    checked={selectedClients.includes(client.id)}
                                    onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                                    aria-label={`בחר לקוח ${client.firstName} ${client.lastName}`}
                                />
                                <div className="flex-grow">
                                    <Link href={`/admin/clients/${client.id}`} className="hover:underline">
                                        <p className="font-bold">{`${client.firstName} ${client.lastName}`}</p>
                                    </Link>
                                    {permissions.canViewClientPhone && (
                                        <a href={`tel:${client.phone}`} className="text-sm text-primary hover:underline">
                                            {client.phone}
                                        </a>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <TooltipProvider>
                                    <Dialog onOpenChange={(open) => !open && setActiveClient(null)}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Link href={`/admin/clients/${client.id}`} passHref>
                                                    <Button size="icon" variant="outline">
                                                        <UserPlus className="h-4 w-4" />
                                                        <span className="sr-only">צפה בכרטיס</span>
                                                    </Button>
                                                </Link>
                                            </TooltipTrigger>
                                            <TooltipContent><p>צפה בכרטיס לקוח</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <DialogTrigger asChild>
                                                <Button size="icon" variant="outline" onClick={() => setActiveClient(client)}>
                                                    <CalendarIcon className="h-4 w-4" />
                                                    <span className="sr-only">היסטוריית תורים</span>
                                                </Button>
                                                </DialogTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent><p>היסטוריית תורים</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="outline" onClick={() => setEditingClient(client)} disabled={isMutating}>
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">ערוך פרטים</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>ערוך פרטי לקוח</p></TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <a href={formatWhatsAppLink(client.phone)} target="_blank" rel="noopener noreferrer">
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="text-green-600 border-green-600 hover:bg-green-500/10"
                                                    disabled={!permissions.canViewClientPhone}
                                                >
                                                    <WhatsAppIcon className="h-4 w-4" />
                                                    <span className="sr-only">שלח הודעה</span>
                                                </Button>
                                                </a>
                                            </TooltipTrigger>
                                            <TooltipContent><p>שלח הודעת וואטסאפ</p></TooltipContent>
                                        </Tooltip>
                                        {activeClient && activeClient.id === client.id && <ClientAppointmentsDialog client={activeClient} />}
                                    </Dialog>
                                </TooltipProvider>
                            </div>
                        </CardContent>
                    </div>

                    {/* Mobile View */}
                    <div className="block sm:hidden">
                        <CardContent className="p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <Dialog onOpenChange={(open) => !open && setActiveClient(null)}>
                                    <div className="flex items-center gap-1">
                                        <Link href={`/admin/clients/${client.id}`} passHref>
                                            <Button size="icon" variant="ghost">
                                                <UserPlus className="h-5 w-5" />
                                            </Button>
                                        </Link>
                                        <DialogTrigger asChild>
                                            <Button size="icon" variant="ghost" onClick={() => setActiveClient(client)}>
                                                <CalendarIcon className="h-5 w-5" />
                                            </Button>
                                        </DialogTrigger>
                                        <Button size="icon" variant="ghost" onClick={() => setEditingClient(client)} disabled={isMutating}>
                                            <Pencil className="h-5 w-5" />
                                        </Button>
                                        <a href={formatWhatsAppLink(client.phone)} target="_blank" rel="noopener noreferrer">
                                            <Button size="icon" variant="ghost" disabled={!permissions.canViewClientPhone}>
                                                <WhatsAppIcon className="h-5 w-5 text-green-600"/>
                                            </Button>
                                        </a>
                                    </div>
                                    {activeClient && activeClient.id === client.id && <ClientAppointmentsDialog client={activeClient} />}
                                </Dialog>
                                <Checkbox
                                    className="h-6 w-6"
                                    checked={selectedClients.includes(client.id)}
                                    onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                                    aria-label={`בחר לקוח ${client.firstName} ${client.lastName}`}
                                />
                            </div>
                            <div className="pt-1">
                                <Link href={`/admin/clients/${client.id}`} className="hover:underline">
                                    <p className="font-bold text-lg">{`${client.firstName} ${client.lastName}`}</p>
                                </Link>
                                {permissions.canViewClientPhone && (
                                    <a href={`tel:${client.phone}`} className="text-sm text-primary hover:underline">
                                        {client.phone}
                                    </a>
                                )}
                            </div>
                        </CardContent>
                    </div>
                </Card>
            ))
        ) : (
             <div className="text-center text-muted-foreground py-16">
                 <p className="text-lg">לא נמצאו לקוחות.</p>
                 <p>נסה לחפש בשם אחר או הוסף לקוח חדש.</p>
             </div>
        )}
      </div>

        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
            {editingClient && <EditClientDialog client={editingClient} onSave={handleSaveEdit} onClose={() => setEditingClient(null)} />}
        </Dialog>

        <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <AddClientDialog onSave={handleSaveNewClient} onClose={() => setIsAddClientOpen(false)} />
        </Dialog>

        <Dialog open={isImportClientOpen} onOpenChange={setIsImportClientOpen}>
            <ImportClientsDialog onImportSuccess={handleImportSuccess} onClose={() => setIsImportClientOpen(false)} />
        </Dialog>
    </div>
  );
}
