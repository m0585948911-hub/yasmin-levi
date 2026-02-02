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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Client } from "@/lib/clients";
import PushNotificationHandler from "@/components/PushNotificationHandler";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VersionNotifier } from "@/components/version-notifier";
import dynamic from "next/dynamic";
import type { FamilyRelation } from "@/components/client-family-management-dialogs";

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

const ClientFamilyManagementDialog = dynamic(() => 
  import('@/components/client-family-management-dialogs').then(mod => mod.ClientFamilyManagementDialog), 
  { 
    ssr: false,
    loading: () => <div className="p-4"><Loader2 className="animate-spin" /></div> 
  }
);


// Copied from admin/clients/[id]/page.tsx as it's a shared type
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
      let inverseRel: "son" | "daughter" | "father" | "mother" | "brother" | "sister" | undefined;
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
      <main className="container mx-auto px-4 pb-20 flex flex-col">
        {gender && <ClientQuote gender={gender} />}
        <div className="grid grid-cols-4 gap-3 text-center mb-6 mt-4">
          {features.map(feature => <DashboardIcon key={feature.label} {...feature} />)}
        </div>

        <div className="flex-grow overflow-y-auto">
           <div className="mx-auto max-w-2xl">
              <UpdatesSection />
            </div>
        </div>
      </main>
      <footer className="sticky bottom-10 left-4 self-start">
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
      {clientId && gender && isFamilyDialogOpen && (
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
                const [settings, categories, services, clients] = await Promise.all([
                    getSettingsForClient(),
                    getFromLocalStorage<any[]>('allCategories', []),
                    getFromLocalStorage<any[]>('allServices', []),
                    getFromLocalStorage<any[]>('allClients', []),
                ]);
                setInLocalStorage('appGeneralSettings', settings);
                
                if (categories.length === 0) {
                    const fetchedCategories = await import('@/lib/categories').then(m => m.getCategories());
                    setInLocalStorage('allCategories', fetchedCategories);
                }
                 if (services.length === 0) {
                    const fetchedServices = await import('@/lib/services').then(m => m.getServices());
                    setInLocalStorage('allServices', fetchedServices);
                }
                 if (clients.length === 0) {
                    setStatus('טוען לקוחות...');
                    const fetchedClients = await import('@/lib/clients').then(m => m.getClients());
                    setInLocalStorage('allClients', fetchedClients);
                }
                
                setStatus('טוען קשרי משפחה...');
                if (!localStorage.getItem('familyRelations')) {
                   setInLocalStorage('familyRelations', {});
                }

                setStatus('כמעט סיימנו...');
                localStorage.setItem(DATA_LOADED_KEY, 'true');
                onDataLoaded();

            } catch (error) {
                console.error("Failed to pre-load app data:", error);
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

  return (
    <>
      <VersionNotifier />
      <DashboardContent />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center h-screen bg-background text-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <DashboardPageWrapper />
    </Suspense>
  );
}

    
