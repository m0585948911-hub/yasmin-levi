
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, PlusCircle, Trash2, Edit, ChevronDown, Eye } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { User, UserPermission, getUsers, saveUser, deleteUser, EmployeePermissions } from '@/lib/users';
import { Calendar, getCalendars } from '@/lib/calendars';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';

type UserFormData = Omit<User, 'id'>;

const UserFormDialog = ({
    isOpen,
    onOpenChange,
    onSave,
    user,
    isPending,
    calendars
}: {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (data: UserFormData) => void;
    user: Partial<User> | null;
    isPending: boolean;
    calendars: Calendar[];
}) => {
    const [formData, setFormData] = useState<Partial<UserFormData>>({});

    useEffect(() => {
        if (user) {
            setFormData(user);
        } else {
            // Default for new user
            setFormData({
                firstName: '',
                lastName: '',
                idNumber: '',
                email: '',
                phone: '',
                password: '',
                permission: 'employee',
                gender: 'female',
                isSuperAdmin: false,
                employeePermissions: {
                    accessibleCalendars: [],
                    canApproveAppointments: false,
                    canCancelAppointments: false,
                    canChangeAppointments: false,
                    canEditCalendarSettings: false,
                    canViewClients: false,
                    canManageClientRecords: false,
                    canViewClientPhone: false,
                }
            });
        }
    }, [user]);

    const handleSave = () => {
        if (!formData.firstName || !formData.lastName || !formData.phone || (!user?.id && !formData.password)) {
             alert('נא למלא את כל השדות הנדרשים (שם, טלפון, וסיסמה למשתמש חדש).');
             return;
        }
        onSave(formData as UserFormData);
    };

    const handlePermissionChange = (value: UserPermission) => {
        setFormData(p => ({
            ...p,
            permission: value,
            // Reset employee permissions if switching to owner/dev
            employeePermissions: (value === 'owner' || value === 'developer') ? null : (p?.employeePermissions || {
                accessibleCalendars: [],
                canApproveAppointments: false,
                canCancelAppointments: false,
                canChangeAppointments: false,
                canEditCalendarSettings: false,
                canViewClients: false,
                canManageClientRecords: false,
                canViewClientPhone: false,
            })
        }));
    };
    
    const handleEmployeePermissionChange = (key: keyof EmployeePermissions, value: any) => {
        setFormData(p => ({
            ...p,
            employeePermissions: {
                ...(p?.employeePermissions as EmployeePermissions),
                [key]: value
            }
        }));
    }

    const handleCalendarSelection = (calendarId: string) => {
        const currentSelection = formData.employeePermissions?.accessibleCalendars || [];
        const newSelection = currentSelection.includes(calendarId)
            ? currentSelection.filter(id => id !== calendarId)
            : [...currentSelection, calendarId];
        handleEmployeePermissionChange('accessibleCalendars', newSelection);
    }

    if (!isOpen) return null;

    const selectedCalendarsText = formData.employeePermissions?.accessibleCalendars.length
        ? `${formData.employeePermissions.accessibleCalendars.length} נבחרו`
        : 'בחר יומנים...';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
             <DialogContent className="max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{user?.id ? `עריכת משתמש: ${user.firstName}` : 'יצירת משתמש חדש'}</DialogTitle>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto -mx-6 px-6">
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>שם פרטי</Label>
                                <Input value={formData.firstName || ''} onChange={e => setFormData(p => ({...p, firstName: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label>שם משפחה</Label>
                                <Input value={formData.lastName || ''} onChange={e => setFormData(p => ({...p, lastName: e.target.value}))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>מספר זהות</Label>
                            <Input value={formData.idNumber || ''} onChange={e => setFormData(p => ({...p, idNumber: e.target.value}))} />
                        </div>
                         <div className="space-y-2">
                            <Label>כתובת אימייל</Label>
                            <Input type="email" value={formData.email || ''} onChange={e => setFormData(p => ({...p, email: e.target.value}))} />
                        </div>
                         <div className="space-y-2">
                            <Label>טלפון (לכניסה)</Label>
                            <Input type="tel" value={formData.phone || ''} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} />
                        </div>
                         <div className="space-y-2">
                            <Label>סיסמה (לכניסה)</Label>
                            <Input type="password" value={formData.password || ''} onChange={e => setFormData(p => ({...p, password: e.target.value}))} placeholder={user?.id ? 'הזן כדי לשנות' : ''} />
                        </div>
                         <div className="space-y-2">
                            <Label>מין</Label>
                            <RadioGroup
                                value={formData.gender}
                                onValueChange={(value: 'male' | 'female') => setFormData(p => ({...p, gender: value}))}
                                className="flex gap-4 pt-2"
                            >
                                 <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value="female" id="female" />
                                    <Label htmlFor="female" className="font-normal">נקבה</Label>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value="male" id="male" />
                                    <Label htmlFor="male" className="font-normal">זכר</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>סוג הרשאה</Label>
                                 <div className="flex items-center gap-2">
                                    <Label htmlFor="super-admin-switch" className="text-sm font-medium text-destructive">
                                      מנהל-על
                                    </Label>
                                    <Switch
                                      id="super-admin-switch"
                                      checked={formData.isSuperAdmin}
                                      onCheckedChange={(checked) => setFormData(p => ({...p, isSuperAdmin: checked }))}
                                      disabled={user?.phone === '039279898' && user.permission === 'developer'}
                                    />
                                  </div>
                            </div>
                            <Select
                                value={formData.permission}
                                onValueChange={handlePermissionChange}
                                disabled={formData.isSuperAdmin}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר הרשאה..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owner">בעל העסק</SelectItem>
                                    <SelectItem value="employee">עובד</SelectItem>
                                    <SelectItem value="developer">מפתח</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {formData.permission === 'employee' && !formData.isSuperAdmin && (
                            <Card className="p-4 bg-muted/50">
                                <CardHeader className="p-0 pb-4">
                                    <CardTitle className="text-base">הרשאות עובד</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 space-y-4">
                                     <div className="space-y-2">
                                        <Label>יומנים נגישים</Label>
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between">
                                                    <span>{selectedCalendarsText}</span>
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-56">
                                                <DropdownMenuLabel>בחר יומנים</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {calendars.map(cal => (
                                                    <DropdownMenuCheckboxItem
                                                        key={cal.id}
                                                        checked={formData.employeePermissions?.accessibleCalendars.includes(cal.id)}
                                                        onSelect={(e) => e.preventDefault()}
                                                        onCheckedChange={() => handleCalendarSelection(cal.id)}
                                                    >
                                                        {cal.name}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        <div className="flex items-center justify-between p-2 rounded-md bg-background border">
                                            <Label htmlFor="canApproveAppointments">יכול לאשר תורים</Label>
                                            <Switch id="canApproveAppointments" checked={formData.employeePermissions?.canApproveAppointments} onCheckedChange={(c) => handleEmployeePermissionChange('canApproveAppointments', c)} />
                                        </div>
                                         <div className="flex items-center justify-between p-2 rounded-md bg-background border">
                                            <Label htmlFor="canCancelAppointments">יכול לבטל תורים</Label>
                                            <Switch id="canCancelAppointments" checked={formData.employeePermissions?.canCancelAppointments} onCheckedChange={(c) => handleEmployeePermissionChange('canCancelAppointments', c)} />
                                        </div>
                                         <div className="flex items-center justify-between p-2 rounded-md bg-background border">
                                            <Label htmlFor="canChangeAppointments">יכול לשנות תורים</Label>
                                            <Switch id="canChangeAppointments" checked={formData.employeePermissions?.canChangeAppointments} onCheckedChange={(c) => handleEmployeePermissionChange('canChangeAppointments', c)} />
                                        </div>
                                         <div className="flex items-center justify-between p-2 rounded-md bg-background border">
                                            <Label htmlFor="canEditCalendarSettings">יכול לשנות הגדרות יומן</Label>
                                            <Switch id="canEditCalendarSettings" checked={formData.employeePermissions?.canEditCalendarSettings} onCheckedChange={(c) => handleEmployeePermissionChange('canEditCalendarSettings', c)} />
                                        </div>
                                         <div className="flex items-center justify-between p-2 rounded-md bg-background border">
                                            <Label htmlFor="canViewClients">יכול לצפות בלקוחות</Label>
                                            <Switch id="canViewClients" checked={formData.employeePermissions?.canViewClients} onCheckedChange={(c) => handleEmployeePermissionChange('canViewClients', c)} />
                                        </div>
                                         <div className="flex items-center justify-between p-2 rounded-md bg-background border">
                                            <Label htmlFor="canManageClientRecords">יכול לנהל תיקי לקוחות</Label>
                                            <Switch id="canManageClientRecords" checked={formData.employeePermissions?.canManageClientRecords} onCheckedChange={(c) => handleEmployeePermissionChange('canManageClientRecords', c)} />
                                        </div>
                                         <div className="flex items-center justify-between p-2 rounded-md bg-background border">
                                            <Label htmlFor="canViewClientPhone">יכול לצפות בטלפונים</Label>
                                            <Switch id="canViewClientPhone" checked={formData.employeePermissions?.canViewClientPhone} onCheckedChange={(c) => handleEmployeePermissionChange('canViewClientPhone', c)} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
                 <DialogFooter className="flex-shrink-0 pt-4 border-t mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave} disabled={isPending}>
                         {isPending ? <Loader2 className="animate-spin" /> : 'שמור'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const UserViewDialog = ({ user, calendars, isOpen, onOpenChange }: { user: Omit<User, 'password'> | null; calendars: Calendar[], isOpen: boolean; onOpenChange: (open: boolean) => void }) => {
    if (!user) return null;

    const permissionText = (user: Omit<User, 'password'>) => {
        if(user.isSuperAdmin) return 'מנהל על';
        switch (user.permission) {
            case 'owner': return 'בעל העסק';
            case 'employee': return 'עובד';
            case 'developer': return 'מפתח';
            default: return 'לא ידוע';
        }
    }
    
    const permissionLabels: Record<keyof EmployeePermissions, string> = {
        accessibleCalendars: "יומנים נגישים",
        canApproveAppointments: "אישור תורים",
        canCancelAppointments: "ביטול תורים",
        canChangeAppointments: "שינוי תורים",
        canEditCalendarSettings: "עריכת הגדרות יומן",
        canViewClients: "צפייה בלקוחות",
        canManageClientRecords: "ניהול תיקי לקוחות",
        canViewClientPhone: "צפייה בטלפונים",
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{`${user.firstName} ${user.lastName}`}</DialogTitle>
                    <DialogDescription>{permissionText(user)}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4 text-sm">
                    <div className="space-y-1">
                        <p><span className="font-semibold text-muted-foreground">אימייל:</span> {user.email}</p>
                        <p><span className="font-semibold text-muted-foreground">טלפון:</span> {user.phone}</p>
                        <p><span className="font-semibold text-muted-foreground">ת.ז.:</span> {user.idNumber}</p>
                    </div>

                    {(user.permission === 'employee' && user.employeePermissions) && (
                        <div className="pt-4 mt-4 border-t">
                            <h4 className="font-semibold mb-2 text-base">הרשאות עובד:</h4>
                            <ul className="space-y-2">
                                {Object.entries(permissionLabels).map(([key, label]) => {
                                    const value = user.employeePermissions![key as keyof EmployeePermissions];
                                    let displayValue: React.ReactNode;
                                    let valueClass = '';

                                    if (key === 'accessibleCalendars') {
                                        const calendarNames = (value as string[]).map(id => calendars.find(c => c.id === id)?.name).filter(Boolean).join(', ');
                                        displayValue = calendarNames || 'אין';
                                    } else {
                                        displayValue = value ? 'כן' : 'לא';
                                        valueClass = value ? 'text-green-600 font-semibold' : 'text-destructive';
                                    }
                                    return (
                                        <li key={key} className="flex justify-between items-center">
                                            <span>{label}</span>
                                            <span className={valueClass}>{displayValue}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>סגור</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export function AdminSettingsUsers() {
    const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, startMutation] = useTransition();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
    const [viewingUser, setViewingUser] = useState<Omit<User, 'password'> | null>(null);
    const { toast } = useToast();

    const fetchInitialData = async () => {
        setIsLoading(true);
        const [fetchedUsers, fetchedCalendars] = await Promise.all([
            getUsers(),
            getCalendars()
        ]);
        setUsers(fetchedUsers);
        setCalendars(fetchedCalendars);
        setIsLoading(false);
    }

    useEffect(() => {
        fetchInitialData();
    }, []);

    const handleOpenForm = (user: Partial<User> | null) => {
        setEditingUser(user);
        setIsFormOpen(true);
    };

    const handleViewUser = (user: Omit<User, 'password'>) => {
        setViewingUser(user);
    };

    const handleSaveUser = (userData: UserFormData) => {
        startMutation(async () => {
            try {
                const dataToSave: Partial<User> = { ...editingUser, ...userData };
                if (!dataToSave.password && editingUser?.id) {
                    delete dataToSave.password; // Don't overwrite password if not provided on edit
                }
                
                await saveUser(dataToSave as User);
                toast({ title: 'הצלחה', description: `המשתמש ${userData.firstName} נשמר.` });
                setIsFormOpen(false);
                setEditingUser(null);
                fetchInitialData();
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשמור את המשתמש.' });
            }
        });
    };

    const handleDeleteUser = (user: Omit<User, 'password'>) => {
        startMutation(async () => {
            try {
                await deleteUser(user.id);
                toast({ title: 'הצלחה', description: `המשתמש ${user.firstName} נמחק.` });
                fetchInitialData();
            } catch(error) {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את המשתמש.' });
            }
        });
    }

    const permissionText = (user: Omit<User, 'password'>) => {
        if(user.isSuperAdmin) return 'מנהל על';
        switch (user.permission) {
            case 'owner': return 'בעל העסק';
            case 'employee': return 'עובד';
            case 'developer': return 'מפתח';
            default: return 'לא ידוע';
        }
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
                 <div className="flex items-center gap-4">
                    <Link href="/admin/settings" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="ml-2" />
                            חזרה להגדרות
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">ניהול משתמשים</h1>
                </div>
                <Button onClick={() => handleOpenForm(null)}>
                    <PlusCircle className="ml-2"/>
                    יצירת משתמש חדש
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>רשימת משתמשי מערכת</CardTitle>
                    <CardDescription>כאן ניתן לנהל את המשתמשים בעלי הגישה לממשק הניהול.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        </div>
                    ) : users.length > 0 ? (
                        <div className="space-y-3">
                            {users.map(user => (
                                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                    <div className="flex-grow">
                                        <p className="font-semibold">{`${user.firstName} ${user.lastName}`}</p>
                                        <p className="text-sm text-muted-foreground">{permissionText(user)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        <Button variant="ghost" size="icon" onClick={() => handleViewUser(user)}>
                                            <Eye className="h-5 w-5 text-blue-600" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(user)}>
                                            <Edit className="h-4 w-4 text-primary" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={user.isSuperAdmin || user.permission === 'developer'}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        פעולה זו תמחק את המשתמש {`${user.firstName} ${user.lastName}`} לצמיתות.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteUser(user)}>מחיקה</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>לא נמצאו משתמשים.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

             <UserFormDialog 
                isOpen={isFormOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) {
                        setEditingUser(null);
                    }
                    setIsFormOpen(isOpen);
                }}
                onSave={handleSaveUser}
                user={editingUser}
                isPending={isMutating}
                calendars={calendars}
             />

             <UserViewDialog
                user={viewingUser}
                calendars={calendars}
                isOpen={!!viewingUser}
                onOpenChange={(isOpen) => !isOpen && setViewingUser(null)}
            />
        </div>
    );
}
