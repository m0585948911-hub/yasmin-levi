
'use client';

import { useState, useEffect, useTransition, Fragment } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, PlusCircle, Edit, Trash2, Loader2, Upload, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { saveService, getServices, deleteService, Service } from '@/lib/services';
import { getCategories, saveCategory, deleteCategory, Category } from '@/lib/categories';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import Image from 'next/image';
import { Switch } from './ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

const RECENT_COLORS_KEY = 'recentServiceColors';
const MAX_RECENT_COLORS = 8;

const EditServiceDialog = ({ service, categories, onSave, onOpenChange, isOpen }: { service: Partial<Service> | null, categories: Category[], onSave: (updatedService: Partial<Service>) => void, onOpenChange: (open: boolean) => void, isOpen: boolean}) => {
    const [formData, setFormData] = useState<Partial<Service>>({});
    const [isSaving, startSavingTransition] = useTransition();
    const [recentColors, setRecentColors] = useState<string[]>([]);

    useEffect(() => {
        const savedColors = localStorage.getItem(RECENT_COLORS_KEY);
        if (savedColors) {
            setRecentColors(JSON.parse(savedColors));
        }
    }, []);

    useEffect(() => {
        if (service) {
            setFormData(service);
        }
    }, [service]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        let processedValue: any = value;
        if (type === 'number') {
            processedValue = value ? parseFloat(value) : 0;
        }

        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }
    
     const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSwitchChange = (name: keyof Service, checked: boolean) => {
        setFormData(prev => ({...prev, [name]: checked }));
    }

    const handleSave = () => {
        startSavingTransition(() => {
            if (formData.displayColor) {
                const newColor = formData.displayColor;
                const updatedRecentColors = [newColor, ...recentColors.filter(c => c !== newColor)].slice(0, MAX_RECENT_COLORS);
                setRecentColors(updatedRecentColors);
                localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updatedRecentColors));
            }
            onSave(formData);
        });
    };

    if (!formData) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{service?.id ? `עריכת שירות: ${service.name}` : 'הוספת שירות חדש'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    
                    <div className="space-y-2">
                        <Label>שם השירות</Label>
                        <Input name="name" value={formData.name || ''} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                        <Label>פירוט (תיאור ללקוח)</Label>
                        <Textarea name="description" value={formData.description || ''} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>דקות</Label>
                            <Input name="duration" type="number" value={formData.duration || 0} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>מנוחה (דקות)</Label>
                            <Input name="breakTime" type="number" value={formData.breakTime || 0} onChange={handleInputChange} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>תמונת שירות</Label>
                        <div className="flex items-center gap-4">
                            <Input id="service-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            <label htmlFor="service-image-upload" className="cursor-pointer">
                                <Button type="button" variant="outline" asChild>
                                    <span><Upload className="ml-2" />העלה תמונה</span>
                                </Button>
                            </label>
                            {formData.imageUrl && <Image src={formData.imageUrl} alt="Service Preview" width={40} height={40} className="rounded-md border object-contain" />}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>צבע תור ביומן</Label>
                        <div className="flex items-center gap-2">
                           <Input name="displayColor" type="color" value={formData.displayColor || '#8B5CF6'} onChange={handleInputChange} className="p-1 h-10 w-20" />
                            <div className="flex flex-wrap gap-1">
                                {recentColors.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        className="h-6 w-6 rounded-md border"
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData(prev => ({ ...prev, displayColor: color }))}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>מחיר</Label>
                        <Input name="price" type="number" value={formData.price || 0} onChange={handleInputChange} />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Switch id="allowPayments" checked={!!formData.allowPayments} onCheckedChange={(c) => handleSwitchChange('allowPayments', c)} />
                            <Label htmlFor="allowPayments">אפשר תשלומים</Label>
                        </div>
                        {formData.allowPayments && (
                             <div className="flex-grow space-y-2">
                                <Label>עד</Label>
                                <Input name="maxPayments" type="number" value={formData.maxPayments || 1} onChange={handleInputChange} />
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>הגבלת תורים ליום</Label>
                            <Input name="dailyBookingLimit" type="number" value={formData.dailyBookingLimit || 0} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>הגבלת תור חוזר (ימים)</Label>
                            <Input name="repeatBookingLimitDays" type="number" value={formData.repeatBookingLimitDays || 0} onChange={handleInputChange} />
                        </div>
                    </div>
                     <Separator />
                     <div className="space-y-3">
                        <div className="flex items-center gap-2">
                           <Switch id="hasPreTreatmentInstructions" checked={!!formData.hasPreTreatmentInstructions} onCheckedChange={(c) => handleSwitchChange('hasPreTreatmentInstructions', c)} />
                           <Label htmlFor="hasPreTreatmentInstructions">הוספת הוראות לפני טיפול</Label>
                        </div>
                        {formData.hasPreTreatmentInstructions && (
                            <div className="space-y-2 pl-6">
                                <Label>הוראות</Label>
                                <Textarea name="preTreatmentInstructions" value={formData.preTreatmentInstructions || ''} onChange={handleInputChange} placeholder="לדוגמה: נא להגיע ללא איפור..." />
                            </div>
                        )}
                    </div>
                     <Separator />
                    <div className="space-y-2">
                        <Label>קטגוריה</Label>
                        <select name="categoryId" value={formData.categoryId || ''} onChange={(e) => setFormData(prev => ({...prev, categoryId: e.target.value }))} className="w-full h-10 border rounded-md px-3 bg-background">
                            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </div>
                    {/* TODO: Add preferred calendar and form selection */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Switch id="allowMultiPurchase" checked={!!formData.allowMultiPurchase} onCheckedChange={(c) => handleSwitchChange('allowMultiPurchase', c)} />
                            <Label htmlFor="allowMultiPurchase">אפשר רכישה קבוצתית / בחירה מרובה</Label>
                        </div>
                         <div className="flex items-center gap-2">
                            <Switch id="isPromoted" checked={!!formData.isPromoted} onCheckedChange={(c) => handleSwitchChange('isPromoted', c)} />
                            <Label htmlFor="isPromoted">קידום מכירות</Label>
                        </div>
                         <div className="flex items-center gap-2">
                            <Switch id="isPremium" checked={!!formData.isPremium} onCheckedChange={(c) => handleSwitchChange('isPremium', c)} />
                            <Label htmlFor="isPremium">מוצר פרימיום</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id="isPublic" checked={!!formData.isPublic} onCheckedChange={(c) => handleSwitchChange('isPublic', c)} />
                            <Label htmlFor="isPublic">הצג ללקוחות</Label>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>מיון</Label>
                        <Input name="sortOrder" type="number" value={formData.sortOrder || 0} onChange={handleInputChange} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : 'שמור'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export function ServicesSettings() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySortOrder, setNewCategorySortOrder] = useState(0);
  const [newCategoryImage, setNewCategoryImage] = useState<string | null>(null);

  const [isMutating, startMutation] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    const [fetchedServices, fetchedCategories] = await Promise.all([
      getServices(),
      getCategories()
    ]);
    setServices(fetchedServices.sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    setCategories(fetchedCategories.sort((a,b) => a.sortOrder - b.sortOrder));
    setNewCategorySortOrder(fetchedCategories.length + 1);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  
  const handleAddCategory = () => {
      if (!newCategoryName.trim()) {
          toast({ variant: 'destructive', title: 'שגיאה', description: 'יש להזין שם קטגוריה.' });
          return;
      }
       if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'קטגוריה עם שם זהה כבר קיימת.' });
            return;
        }
      startMutation(async () => {
          try {
              await saveCategory({ name: newCategoryName, sortOrder: newCategorySortOrder, imageUrl: newCategoryImage || undefined });
              toast({ title: 'הצלחה!', description: 'הקטגוריה נוספה בהצלחה.' });
              setNewCategoryName('');
              setNewCategoryImage(null);
              setIsCategoryDialogOpen(false);
              fetchData();
          } catch(e) {
              toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה להוסיף את הקטגוריה.' });
          }
      })
  }

  const handleEditService = (service: Service) => {
    setEditingService(service);
  }

  const handleAddNewService = () => {
      if (categories.length === 0) {
          toast({ variant: "destructive", title: "שגיאה", description: "יש ליצור קטגוריה תחילה לפני הוספת שירות." });
          return;
      }
      setEditingService({
          categoryId: categories[0].id, // Default to the first category
          name: '',
          duration: 15,
          price: 0,
          isPublic: true,
          sortOrder: (services.filter(s => s.categoryId === categories[0].id).length || 0) + 1
      });
  }

  const handleEditCategory = (category: Category) => {
      setNewCategoryName(category.name);
      setNewCategorySortOrder(category.sortOrder);
      setNewCategoryImage(category.imageUrl || null);
      setEditingCategory(category);
      setIsCategoryDialogOpen(true);
  }
  
  const handleUpdateCategory = () => {
    if (!editingCategory) return;
     if (!newCategoryName.trim()) {
          toast({ variant: 'destructive', title: 'שגיאה', description: 'יש להזין שם קטגוריה.' });
          return;
      }
       if (categories.some(cat => cat.id !== editingCategory.id && cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'קטגוריה אחרת עם שם זהה כבר קיימת.' });
            return;
        }
      startMutation(async () => {
          try {
              await saveCategory({ ...editingCategory, name: newCategoryName, sortOrder: newCategorySortOrder, imageUrl: newCategoryImage || undefined });
              toast({ title: 'הצלחה!', description: 'הקטגוריה עודכנה.' });
              setNewCategoryName('');
              setEditingCategory(null);
              setNewCategoryImage(null);
              setIsCategoryDialogOpen(false);
              fetchData();
          } catch(e) {
              toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לעדכן את הקטגוריה.' });
          }
      });
  }


  const handleSaveService = (serviceData: Partial<Service>) => {
    startMutation(async () => {
        try {
            if (!serviceData.name || !serviceData.name.trim()){
                 toast({ variant: 'destructive', title: 'שגיאה', description: 'יש להזין שם שירות.' });
                 return;
            }

            const isDuplicate = services.some(s => 
                s.name!.toLowerCase() === serviceData.name!.toLowerCase() && 
                s.id !== serviceData.id &&
                s.categoryId === serviceData.categoryId
            );

            if (isDuplicate) {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'שירות עם שם זהה כבר קיים בקטגוריה זו.' });
                return;
            }

            const dataToSave = { ...serviceData };
            if (!dataToSave.categoryId && categories.length > 0) {
                dataToSave.categoryId = categories[0].id;
            }
            await saveService(dataToSave as Omit<Service, 'id'> & { id?: string });
            toast({ title: 'הצלחה', description: 'השירות נשמר בהצלחה.' });
            setEditingService(null);
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשמור את השירות.' });
        }
    });
  }

  const handleDeleteService = (serviceId: string, serviceName: string) => {
     startMutation(async () => {
        try {
            await deleteService(serviceId);
            toast({ title: 'הצלחה', description: `השירות "${serviceName}" נמחק.` });
            fetchData();
        } catch (error) {
             toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את השירות.' });
        }
     });
  }
  
  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
      const servicesInCategory = services.filter(s => s.categoryId === categoryId);
      if (servicesInCategory.length > 0) {
          toast({ variant: 'destructive', title: 'שגיאה', description: `לא ניתן למחוק קטגוריה שמכילה שירותים. מחק או העבר את השירותים תחילה.` });
          return;
      }

      startMutation(async () => {
          try {
              await deleteCategory(categoryId);
              toast({title: "הצלחה!", description: `הקטגוריה "${categoryName}" נמחקה.`});
              fetchData();
          } catch(e) {
              toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את הקטגוריה.' });
          }
      });
  }

  const handleCategoryImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.type !== 'image/png') {
        toast({
            variant: "destructive",
            title: "שגיאה",
            description: "יש לבחור קובץ בפורמט PNG בלבד.",
        });
        return;
      }
      
      if (file.size > 10 * 1024) { // 10 KB
        toast({
            variant: "destructive",
            title: "שגיאה",
            description: "גודל הקובץ לא יכול לעלות על 10KB.",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          setNewCategoryImage(reader.result as string);
      };
      reader.readAsDataURL(file);
  }

  if (isLoading) {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/settings" passHref>
            <Button variant="outline">
              <ArrowLeft className="ml-2" />
              חזרה
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">ניהול שירותים</h1>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Dialog open={isCategoryDialogOpen} onOpenChange={(isOpen) => {
              if (!isOpen) {
                  setIsCategoryDialogOpen(false);
                  setEditingCategory(null);
                  setNewCategoryName('');
                  setNewCategoryImage(null);
                  setNewCategorySortOrder(categories.length + 1);
              } else {
                  setIsCategoryDialogOpen(true);
              }
          }}>
              <DialogTrigger asChild>
                  <Button variant="outline"><PlusCircle className="ml-2"/>הוסף קטגוריה</Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>{editingCategory ? 'עריכת קטגוריה' : 'הוספת קטגוריה חדשה'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                      <div className="space-y-2">
                      <Label htmlFor="new-category-name">שם הקטגוריה</Label>
                      <Input id="new-category-name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="לדוגמה: טיפולי פנים" />
                      </div>
                      <div className="space-y-2">
                      <Label htmlFor="new-category-sort">מספר מיון</Label>
                      <Input id="new-category-sort" type="number" value={newCategorySortOrder} onChange={(e) => setNewCategorySortOrder(parseInt(e.target.value, 10) || 0)} />
                      </div>
                      <div className="space-y-2">
                          <Label>תמונת קטגוריה (PNG, עד 10KB)</Label>
                          <div className="flex items-center gap-4">
                              <Input id="logo-upload" type="file" accept="image/png" className="hidden" onChange={handleCategoryImageUpload} />
                              <label htmlFor="logo-upload" className="cursor-pointer">
                                  <Button type="button" variant="outline" asChild>
                                      <span><Upload className="ml-2" />העלה תמונה</span>
                                  </Button>
                              </label>
                              {newCategoryImage && <Image src={newCategoryImage} alt="Category Preview" width={40} height={40} className="rounded-full border object-contain" />}
                          </div>
                      </div>
                  </div>
                  <DialogFooter>
                      <Button variant="outline" onClick={() => {
                          setIsCategoryDialogOpen(false);
                          setEditingCategory(null);
                          setNewCategoryName('');
                          setNewCategoryImage(null);
                          setNewCategorySortOrder(categories.length + 1);
                      }}>ביטול</Button>
                      <Button onClick={editingCategory ? handleUpdateCategory : handleAddCategory} disabled={isMutating}>
                          {isMutating ? <Loader2 className="animate-spin" /> : 'שמור'}
                      </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>

          <Button onClick={handleAddNewService} disabled={categories.length === 0}>
              <PlusCircle className="ml-2"/>הוסף שירות חדש
          </Button>
        </div>
      </div>
      
      {categories.length > 0 ? (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={[categories[0]?.id]}>
          {categories.map(cat => (
            <AccordionItem value={cat.id} key={cat.id} className="border-b-0 rounded-lg bg-card border overflow-hidden">
              <AccordionTrigger className="p-4 hover:no-underline hover:bg-accent/50 data-[state=open]:bg-accent/50 data-[state=open]:border-b">
                <div className='flex items-center justify-between w-full'>
                    <div className='flex items-center gap-4'>
                        <GripVertical className="cursor-grab text-muted-foreground" />
                        <Avatar>
                            <AvatarImage src={cat.imageUrl} alt={cat.name} />
                            <AvatarFallback>{cat.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-lg">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 pr-4">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}>
                            <Edit className="h-4 w-4 text-primary" />
                        </Button>
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>האם למחוק את הקטגוריה "{cat.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    לא ניתן למחוק קטגוריה אם יש בה שירותים.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCategory(cat.id, cat.name)} disabled={isMutating}>
                                    {isMutating ? <Loader2 className="animate-spin" /> : 'מחק'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-2 md:p-4">
                <div className="space-y-3">
                  {services.filter(s => s.categoryId === cat.id).map(service => (
                    <div key={service.id} className="border rounded-md p-4 bg-background hover:border-primary/30">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Avatar>
                                    <AvatarImage src={service.imageUrl || cat.imageUrl} alt={service.name} />
                                    <AvatarFallback>{service.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{service.name}</p>
                                    <p className="text-sm text-muted-foreground">{service.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground self-end sm:self-start flex-shrink-0">
                                {service.duration > 0 && <span>{service.duration} דקות</span>}
                                {service.price && service.price > 0 && <span>₪{service.price}</span>}
                            </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="flex justify-end gap-2">
                             <Button variant="ghost" size="sm" onClick={() => handleEditService(service)}>
                                <Edit className="h-4 w-4 ml-2" />
                                עריכה
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4 ml-2" />
                                        מחיקה
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>האם למחוק את השירות?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            פעולה זו תמחק את השירות "{service.name}" לצמיתות.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteService(service.id, service.name)} disabled={isMutating}>
                                            {isMutating ? <Loader2 className="animate-spin" /> : 'מחק'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                  ))}
                   {services.filter(s => s.categoryId === cat.id).length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                            אין שירותים בקטגוריה זו.
                        </p>
                    )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                <p>לא נוצרו עדיין קטגוריות.</p>
                <p>לחץ על "הוסף קטגוריה" כדי להתחיל.</p>
            </CardContent>
        </Card>
      )}

      <EditServiceDialog
        isOpen={!!editingService}
        onOpenChange={(isOpen) => !isOpen && setEditingService(null)}
        service={editingService}
        categories={categories}
        onSave={handleSaveService}
       />
    </div>
  );
}
