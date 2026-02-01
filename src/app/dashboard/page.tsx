

'use client'

import { DashboardIcon } from "@/components/dashboard-icon";
import { UpdatesSection } from "@/components/updates-section";
import { WazeIcon } from "@/components/waze-icon";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect, useTransition, useCallback } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { LogOut, Headset, Users, PlusCircle, Settings, Calendar, Loader2, Trash2, FileSignature } from 'lucide-react';
import { NotificationPopup } from '@/components/notification-popup';
import Link from 'next/link';
import { ClientQuote } from '@/components/client-quote';
import { AppointmentListener } from '@/components/appointment-listener';
import { getSettingsForClient } from "@/lib/settings";
import type { AllSettings } from "@/lib/settings-types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Client, getClients, findClientByPhone, saveClient } from "@/lib/clients";
import { getServices } from "@/lib/services";
import { getCategories } from "@/lib/categories";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PushNotificationHandler } from "@/components/PushNotificationHandler";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { testLocalNotification } from '@/lib/client-notifications';

import { 
  CalendarPlus, 
  CalendarCheck2, 
  CalendarClock, 
  CalendarX2, 
  Store,
  Facebook,
  Instagram,
  UserCircle,
  ScrollText,
  Bell,
} from "lucide-react";


const DATA_LOADED_KEY = 'appDataLoaded';

// Copied from admin/clients/[id]/page.tsx as it's a shared type
type Relationship = "son" | "daughter" | "father" | "mother" | "brother" | "sister";
interface FamilyRelation {
  memberId: string;
  relation: Relationship;
}
type FamilyRelationsData = {
  [clientId: string]: FamilyRelation[];
};

// Helper to get data from localStorage, also from admin client page
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

// Helper to set data to localStorage, also from admin client page
const setInLocalStorage = <T,>(key: string, value: T) => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
    }
};


const ClientAddFamilyMemberDialog = ({ onAdd, isChecking }: { onAdd: (phone: string) => void, isChecking: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [phone, setPhone] = useState('');

    const handleAddClick = () => {
        onAdd(phone);
        // Do not close the dialog here, let the parent component handle it
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full mt-4">
                    <PlusCircle className="ml-2" />
                    הוסף בן משפחה
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>הוספת בן משפחה</DialogTitle>
                    <DialogDescription>
                        הקלד את מספר הטלפון של בן המשפחה שברצונך להוסיף.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="phone">מספר טלפון</Label>
                    <Input
                        id="phone"
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="05X-XXXXXXX"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>ביטול</Button>
                    <Button onClick={handleAddClick} disabled={isChecking}>
                        {isChecking ? <Loader2 className="animate-spin" /> : 'המשך'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ClientNewFamilyMemberRegistrationDialog = ({
    isOpen,
    onOpenChange,
    phone,
    onRegister
}: {
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    phone: string,
    onRegister: (newClientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>, relation: Relationship) => void;
}) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [relation, setRelation] = useState<Relationship>('daughter');
    const [isRegistering, startRegistration] = useTransition();

    const handleRegister = () => {
        if (!firstName.trim() || !lastName.trim()) {
            alert('נא למלא שם פרטי ושם משפחה.');
            return;
        }
        startRegistration(async () => {
            await onRegister({
                businessId: 'default',
                firstName,
                lastName,
                phone,
                gender,
                isBlocked: false,
                receivesSms: true
            }, relation);
        });
    }

    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>רישום בן משפחה חדש</DialogTitle>
                    <DialogDescription>
                        מלא את הפרטים של בן המשפחה. מספר הטלפון שהזנת הוא: {phone}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstName">שם פרטי</Label>
                        <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="lastName">שם משפחה</Label>
                        <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label>מין</Label>
                        <RadioGroup value={gender} onValueChange={(v: 'male' | 'female') => setGender(v)} className="flex gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="female" id="reg-female" />
                                <Label htmlFor="reg-female">נקבה</Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="male" id="reg-male" />
                                <Label htmlFor="reg-male">זכר</Label>
                            </div>
                        </RadioGroup>
                    </div>
                     <div className="space-y-2">
                        <Label>קרבה</Label>
                         <Select value={relation} onValueChange={(v: Relationship) => setRelation(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="בחר קרבה..."/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="son">בן</SelectItem>
                                <SelectItem value="daughter">בת</SelectItem>
                                <SelectItem value="mother">אמא</SelectItem>
                                <SelectItem value="father">אבא</SelectItem>
                                <SelectItem value="brother">אח</SelectItem>
                                <SelectItem value="sister">אחות</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleRegister} disabled={isRegistering}>
                        {isRegistering ? <Loader2 className="animate-spin" /> : 'שמור וקשר'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


const ClientFamilyManagementDialog = ({
  isOpen,
  onOpenChange,
  currentClientId,
  onSave,
  initialRelations,
  setInitialRelations,
  allClients,
  setAllClients,
  currentClientGender,
  currentClientPhone,
  onBookAppointmentFor,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentClientId: string;
  onSave: (relations: FamilyRelation[]) => void;
  initialRelations: FamilyRelation[];
  setInitialRelations: (relations: FamilyRelation[]) => void;
  allClients: Client[];
  setAllClients: (clients: Client[]) => void;
  currentClientGender: 'male' | 'female';
  currentClientPhone: string | null;
  onBookAppointmentFor: (clientId: string) => void;
}) => {
    const { toast } = useToast();
    const [isCheckingPhone, startPhoneCheck] = useTransition();
    const [confirmClient, setConfirmClient] = useState<Client | null>(null);
    const [clientToAdd, setClientToAdd] = useState<Client | null>(null);
    const [isRegisteringNewMember, setIsRegisteringNewMember] = useState(false);
    const [phoneForRegistration, setPhoneForRegistration] = useState('');
    const [selectedRelation, setSelectedRelation] = useState<Relationship>('daughter');


    const handleAddMember = (phone: string) => {
        if (!phone.trim()) {
            toast({ variant: "destructive", title: "שגיאה", description: "יש להזין מספר טלפון." });
            return;
        }
        
        if (phone.trim() === currentClientPhone) {
            toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן להוסיף את עצמך כבן משפחה." });
            return;
        }

        startPhoneCheck(async () => {
            const client = await findClientByPhone(phone.trim());
            if (client) {
                if (initialRelations.some(rel => rel.memberId === client.id)) {
                    toast({ title: "מידע", description: "הלקוח כבר מקושר לחשבונך." });
                    return;
                }
                setConfirmClient(client);
            } else {
                setPhoneForRegistration(phone.trim());
                setIsRegisteringNewMember(true);
            }
        });
    };

    const handleConfirmYes = () => {
        if (confirmClient) {
            setClientToAdd(confirmClient);
            setConfirmClient(null);
        }
    };

    const handleRelationSave = () => {
        if (clientToAdd) {
            const newRelation: FamilyRelation = { memberId: clientToAdd.id, relation: selectedRelation };
            const updatedRelations = [...initialRelations, newRelation];
            setInitialRelations(updatedRelations);
            onSave(updatedRelations); // This will persist the changes
            setClientToAdd(null);
        }
    };
    
     const handleDeleteRelation = (memberId: string) => {
        const updatedRelations = initialRelations.filter(rel => rel.memberId !== memberId);
        setInitialRelations(updatedRelations);
        onSave(updatedRelations);
    };


    const getRelationName = (relation: Relationship) => {
        switch (relation) {
          case "mother": return "אמא";
          case "father": return "אבא";
          case "son": return "בן";
          case "daughter": return "בת";
          case "sister": return "אחות";
          case "brother": return "אח";
          default: return "";
        }
    };
    
    const handleRegisterAndLink = async (newClientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>, relation: Relationship) => {
        const newClient = await saveClient(newClientData);
        setAllClients([...allClients, newClient]); // Update client list locally

        const newRelation: FamilyRelation = { memberId: newClient.id, relation };
        const updatedRelations = [...initialRelations, newRelation];
        setInitialRelations(updatedRelations);
        onSave(updatedRelations);

        toast({ title: 'הצלחה!', description: `${newClient.firstName} נוסף למשפחה בהצלחה.`});
        setIsRegisteringNewMember(false);
    }

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => {
             if (!open) {
                setClientToAdd(null);
                setConfirmClient(null);
                setIsRegisteringNewMember(false);
                onOpenChange(false);
             } else {
                 onOpenChange(true);
             }
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>ניהול בני משפחה</DialogTitle>
                    <DialogDescription>
                        כאן ניתן לקשר בני משפחה לחשבונך כדי לנהל עבורם תורים.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <h4 className="font-semibold mb-2">בני משפחה מקושרים:</h4>
                    {initialRelations.length > 0 ? (
                        <ScrollArea className="h-48">
                            <div className="space-y-2 pr-4">
                                {initialRelations.map(rel => {
                                    const member = allClients.find(c => c.id === rel.memberId);
                                    return (
                                        <div key={rel.memberId} className="flex items-center justify-between p-2 border rounded-md">
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => onBookAppointmentFor(rel.memberId)}>
                                                    <Calendar className="w-4 h-4 text-primary" />
                                                </Button>
                                                <div>
                                                    <span>{member ? `${member.firstName} ${member.lastName}` : 'לקוח לא ידוע'}</span>
                                                    <span className="text-sm text-primary mx-2">({getRelationName(rel.relation)})</span>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRelation(rel.memberId)}>
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-center text-muted-foreground py-4">
                            אין כרגע בני משפחה מקושרים.
                        </p>
                    )}
                    <ClientAddFamilyMemberDialog onAdd={handleAddMember} isChecking={isCheckingPhone} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>סגירה</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmClient} onOpenChange={() => setConfirmClient(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>אישור בן משפחה</AlertDialogTitle>
                    <AlertDialogDescription>
                        האם {confirmClient?.firstName} {confirmClient?.lastName} הוא בן המשפחה אותו תרצה/י להוסיף?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmClient(null)}>לא</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmYes}>כן, זהו בן המשפחה</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!clientToAdd} onOpenChange={() => setClientToAdd(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>הגדרת קרבה משפחתית</DialogTitle>
                    <DialogDescription>
                        בחר את הקרבה שלך ל{clientToAdd?.firstName} {clientToAdd?.lastName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                     <Select value={selectedRelation} onValueChange={(v: Relationship) => setSelectedRelation(v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="בחר קרבה..."/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="son">בן</SelectItem>
                            <SelectItem value="daughter">בת</SelectItem>
                            <SelectItem value="mother">אמא</SelectItem>
                            <SelectItem value="father">אבא</SelectItem>
                            <SelectItem value="brother">אח</SelectItem>
                            <SelectItem value="sister">אחות</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setClientToAdd(null)}>ביטול</Button>
                    <Button onClick={handleRelationSave}>שמור קשר</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <ClientNewFamilyMemberRegistrationDialog 
            isOpen={isRegisteringNewMember}
            onOpenChange={setIsRegisteringNewMember}
            phone={phoneForRegistration}
            onRegister={handleRegisterAndLink}
        />

        </>
    );
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isFamilyDialogOpen, setIsFamilyDialogOpen] = useState(false);
  const [familyRelations, setFamilyRelations] = useState<FamilyRelation[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [pendingDocsCount, setPendingDocsCount] = useState(0);

  const { toast } = useToast();

  const gender = searchParams.get('gender') as 'male' | 'female' | null;
  const firstName = searchParams.get('firstName');
  const lastName = searchParams.get('lastName');
  const clientId = searchParams.get('id');
  const phone = searchParams.get('phone');
  
  useEffect(() => {
    // Data is pre-loaded by AppDataLoader, so we just get it from localStorage
    setSettings(getFromLocalStorage<AllSettings | null>('appGeneralSettings', null));
    setAllClients(getFromLocalStorage<Client[]>('allClients', []));
    if (clientId) {
      const allFamilyRelations = getFromLocalStorage<FamilyRelationsData>('familyRelations', {});
      setFamilyRelations(allFamilyRelations[clientId] || []);
    }
  }, [clientId]);
  
  useEffect(() => {
    if (!clientId) return;

    const q = query(
        collection(db, "formInstances"), 
        where("clientId", "==", clientId), 
        where("status", "==", "pending_client_fill")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        setPendingDocsCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [clientId]);


  const handleSaveFamilyRelations = (newRelations: FamilyRelation[]) => {
    if (!clientId || !gender) return;

    const allFamilyRelations = getFromLocalStorage<FamilyRelationsData>('familyRelations', {});
    const oldRelations = allFamilyRelations[clientId] || [];

    // Remove old inverse relationships
    oldRelations.forEach(oldRel => {
      const memberRelations = allFamilyRelations[oldRel.memberId] || [];
      allFamilyRelations[oldRel.memberId] = memberRelations.filter(r => r.memberId !== clientId);
    });

    allFamilyRelations[clientId] = newRelations;
    setFamilyRelations(newRelations);

    // Add new inverse relationships
    newRelations.forEach(newRel => {
      let inverseRel: Relationship | undefined;
      const member = allClients.find(c => c.id === newRel.memberId);

      if (!member) return;

      if (newRel.relation === 'brother') {
        inverseRel = member.gender === 'male' ? 'brother' : 'sister';
      } else if (newRel.relation === 'sister') {
        inverseRel = member.gender === 'male' ? 'brother' : 'sister';
      } else if (newRel.relation === 'son') {
        inverseRel = gender === 'male' ? 'father' : 'mother';
      } else if (newRel.relation === 'daughter') {
        inverseRel = gender === 'male' ? 'father' : 'mother';
      } else if (newRel.relation === 'father') {
        inverseRel = gender === 'male' ? 'son' : 'daughter';
      } else if (newRel.relation === 'mother') {
        inverseRel = gender === 'male' ? 'son' : 'daughter';
      }

      if (inverseRel) {
        if (!allFamilyRelations[newRel.memberId]) {
          allFamilyRelations[newRel.memberId] = [];
        }
        // Remove any existing relation from the other side to avoid duplicates
        allFamilyRelations[newRel.memberId] = allFamilyRelations[newRel.memberId].filter(r => r.memberId !== clientId);
        // Add the new inverse relation
        allFamilyRelations[newRel.memberId].push({ memberId: clientId, relation: inverseRel });
      }
    });

    setInLocalStorage('familyRelations', allFamilyRelations);
    toast({ title: 'הצלחה', description: 'קשרי המשפחה עודכנו.' });
  };


  const welcomeMessage = gender === 'male' ? 'ברוך השב!' : 'ברוכה השבה!';
  const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : 'לקוח/ה';

  const handleLogout = () => {
    localStorage.removeItem(DATA_LOADED_KEY);
    localStorage.removeItem('clientUser');
    router.push('/');
  };
  
  const clientParams = new URLSearchParams();
  if (clientId) clientParams.append('id', clientId);
  if (firstName) clientParams.append('firstName', firstName);
  if (lastName) clientParams.append('lastName', lastName);
  if (gender) clientParams.append('gender', gender);
  if (phone) clientParams.append('phone', phone);
  
  const dashboardLink = `/dashboard?${clientParams.toString()}`;
  const newAppointmentLink = `/appointments?${clientParams.toString()}`;
  const myAppointmentsLink = `/my-appointments?${clientParams.toString()}`;
  const profileLink = `/profile?${clientParams.toString()}`;
  const myDocumentsLink = `/my-documents?${clientParams.toString()}`;


  const iconSize = 48;

  const businessPhone = settings?.businessDetails?.phone;
  let whatsappLink = "#";
  if (businessPhone) {
      const cleanedPhone = businessPhone.replace(/[^0-9]/g, '');
      const internationalPhone = cleanedPhone.startsWith('0') ? `972${cleanedPhone.substring(1)}` : cleanedPhone;
      whatsappLink = `https://wa.me/${internationalPhone}`;
  }
  
  const handleFamilyClick = () => {
        if (clientId) {
            setIsFamilyDialogOpen(true);
        } else {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: "לא ניתן לנהל בני משפחה כרגע.",
            });
        }
    };
    
    const handleBookAppointmentFor = (familyMemberId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('bookForClientId', familyMemberId);
        router.push(`/appointments?${params.toString()}`);
        setIsFamilyDialogOpen(false);
    }


  const features = [
    { icon: <CalendarPlus size={iconSize} className="text-primary" />, label: "קביעת תור", href: newAppointmentLink },
    { icon: <CalendarCheck2 size={iconSize} className="text-primary" />, label: "התורים שלי", href: myAppointmentsLink },
    { icon: <FileSignature size={iconSize} className="text-primary" />, label: "המסמכים שלי", href: myDocumentsLink, badgeCount: pendingDocsCount },
    { icon: <Users size={iconSize} className="text-primary" />, label: "בני משפחה", href: "#", action: handleFamilyClick },
    { icon: <Store size={iconSize} className="text-primary" />, label: "חנות", href: "https://yasminlevi.co.il/shop", external: true },
    { icon: <Settings size={iconSize} className="text-primary" />, label: "פרופיל והגדרות", href: profileLink },
    { icon: <WazeIcon className="text-primary" style={{ width: iconSize, height: iconSize }}/>, label: "ניווט לקליניקה", href: "https://waze.com/ul?q=Brenner%207%2C%20Rehovot", external: true },
    { icon: <WhatsAppIcon className="text-primary" style={{ width: iconSize, height: iconSize }}/>, label: "פנייה בווצאפ", href: whatsappLink, external: true },
    { icon: <Facebook size={iconSize} className="text-primary" />, label: "פייסבוק", href: settings?.appLinks?.facebook || "#", external: true },
    { icon: <Instagram size={iconSize} className="text-primary" />, label: "אינסטגרם", href: settings?.appLinks?.instagram || "#", external: true },
    { icon: <UserCircle size={iconSize} className="text-primary" />, label: "הדף שלי", href: settings?.appLinks?.website || "#", external: true },
    { icon: <ScrollText size={iconSize} className="text-primary" />, label: "תקנון", href: "#", action: () => setIsTermsOpen(true) },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PushNotificationHandler />
      <AppointmentListener clientId={clientId || ''} />
      <NotificationPopup />
      <header className="p-4 flex justify-between items-center">
        <Link href={dashboardLink} className="w-20 h-20">
            <Logo className="w-full h-full" />
        </Link>
        <div className="text-center">
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <p className="text-muted-foreground mt-1">{welcomeMessage}</p>
        </div>
        <div className="w-20 flex items-center justify-center">
            <Button variant="ghost" size="icon" className="w-12 h-12">
                <Headset className="w-8 h-8 text-primary" />
            </Button>
        </div>
      </header>
      <main className="container mx-auto px-4 pb-8 flex flex-col">
        {gender && <ClientQuote gender={gender} />}
        <div className="grid grid-cols-4 gap-3 text-center mb-6 mt-4">
          {features.map(feature => <DashboardIcon key={feature.label} {...feature} />)}
        </div>
        
        <div className="my-4 text-center">
          <button
            onClick={() => testLocalNotification()}
            style={{ padding: 12, border: '1px solid #ccc', borderRadius: 8 }}
          >
            Test Local Notification
          </button>
        </div>

        <div className="flex-grow overflow-y-auto">
           <div className="mx-auto max-w-2xl">
              <UpdatesSection />
            </div>
        </div>
      </main>
      <footer className="sticky bottom-4 left-4 self-start">
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="ml-2" />
          התנתקות
        </Button>
      </footer>
       <Dialog open={isTermsOpen} onOpenChange={setIsTermsOpen}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>תקנון</DialogTitle>
            <DialogDescription>
              להלן תנאי השימוש והתקנון של העסק.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto -mx-6 px-6">
            <ScrollArea className="h-full pr-2">
                <pre className="text-sm whitespace-pre-wrap font-sans text-center">
                {settings?.generalAppSettings?.termsAndConditions || "התקנון לא נמצא. יש לפנות למנהל/ת העסק."}
                </pre>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTermsOpen(false)}>סגירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {clientId && gender && (
        <ClientFamilyManagementDialog
            isOpen={isFamilyDialogOpen}
            onOpenChange={setIsFamilyDialogOpen}
            currentClientId={clientId}
            onSave={handleSaveFamilyRelations}
            initialRelations={familyRelations}
            setInitialRelations={setFamilyRelations}
            allClients={allClients}
            setAllClients={(clients) => setInLocalStorage('allClients', clients)}
            currentClientGender={gender}
            currentClientPhone={phone}
            onBookAppointmentFor={handleBookAppointmentFor}
        />
      )}
    </div>
  );
}

function AppDataLoader({ onDataLoaded }: { onDataLoaded: () => void }) {
    const [status, setStatus] = useState('מכין את הדברים...');

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                setStatus('טוען הגדרות וקטגוריות...');
                const [settings, categories] = await Promise.all([
                    getSettingsForClient(),
                    getCategories(),
                ]);
                setInLocalStorage('appGeneralSettings', settings);
                setInLocalStorage('allCategories', categories);

                setStatus('טוען שירותים...');
                const services = await getServices();
                setInLocalStorage('allServices', services);
                
                setStatus('טוען לקוחות...');
                const clients = await getClients();
                setInLocalStorage('allClients', clients);
                
                setStatus('טוען קשרי משפחה...');
                // This is a placeholder as family relations are not in DB yet.
                // In a real app, this would be a DB call.
                if (!localStorage.getItem('familyRelations')) {
                   setInLocalStorage('familyRelations', {});
                }

                setStatus('כמעט סיימנו...');
                localStorage.setItem(DATA_LOADED_KEY, 'true');
                onDataLoaded();

            } catch (error) {
                console.error("Failed to pre-load app data:", error);
                // Handle error case, maybe show an error message and a retry button
                setStatus('אופס, משהו השתבש. נסה לרענן את הדף.');
            }
        };

        fetchAllData();
    }, [onDataLoaded]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background text-center">
            <Logo className="w-48 h-48 mb-6" />
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{status}</p>
        </div>
    );
}

function DashboardPageWrapper() {
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
      setIsClient(true);
      if (localStorage.getItem(DATA_LOADED_KEY) === 'true') {
          setDataLoaded(true);
      }
  }, []);

  if (!isClient) {
     return <div className="flex flex-col items-center justify-center h-screen bg-background text-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!dataLoaded) {
      return <AppDataLoader onDataLoaded={() => setDataLoaded(true)} />;
  }

  return <DashboardContent />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center h-screen bg-background text-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <DashboardPageWrapper />
    </Suspense>
  );
}
