
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, PlusCircle, Trash2, Calendar } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Client, findClientByPhone, saveClient } from '@/lib/clients';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// --- TYPES ---
type Relationship = "son" | "daughter" | "father" | "mother" | "brother" | "sister";
export interface FamilyRelation {
  memberId: string;
  relation: Relationship;
}

// --- DIALOGS ---

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

export function ClientFamilyManagementDialog({
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
}) {
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
