'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ArrowLeft, Bot, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Label } from './ui/label';
import Link from 'next/link';
import { Badge } from './ui/badge';
import { WhatsAppLog, getWhatsAppLogs } from '@/lib/whatsapp-logs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from './ui/scroll-area';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const CLOUD_RUN_SERVICE_URL = "https://whatsapp-service-90023766755.us-central1.run.app";
const WEBHOOK_URL = `${CLOUD_RUN_SERVICE_URL}/webhook`;
const VERIFY_TOKEN = "yasmin_verify_2026";


export function AdminSettingsWhatsapp() {
  const [isSendingTest, startSendTestTransition] = useTransition();
  const [testNumber, setTestNumber] = useState('');
  const { toast } = useToast();
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const fetchLogs = async () => {
      setIsLoadingLogs(true);
      const fetchedLogs = await getWhatsAppLogs(50);
      setLogs(fetchedLogs);
      setIsLoadingLogs(false);
  }

  useEffect(() => {
      fetchLogs();
  }, []);
  
  const handleSendTest = () => {
      if (!testNumber) {
          toast({ variant: 'destructive', title: 'שגיאה', description: 'יש להזין מספר טלפון.' });
          return;
      }
      startSendTestTransition(async () => {
          try {
              const response = await fetch('/api/admin/whatsapp/send-test', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ to: testNumber, body: 'הודעת בדיקה ממערכת יסמין לוי.' }),
              });
              const data = await response.json();
              if (response.ok) {
                  toast({ title: 'הצלחה', description: 'הודעת הבדיקה נשלחה לתור.' });
              } else {
                  toast({ variant: 'destructive', title: 'שגיאה', description: data.error || 'לא ניתן היה לשלוח את ההודעה.' });
              }
          } catch (error) {
              toast({ variant: 'destructive', title: 'שגיאת רשת', description: 'לא ניתן היה לשלוח את הודעת הבדיקה.' });
          }
      });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-4">
            <Link href="/admin/settings" passHref>
                <Button variant="outline">
                    <ArrowLeft className="ml-2" />
                    חזרה להגדרות
                </Button>
            </Link>
            <h1 className="text-2xl font-bold">הגדרות WhatsApp</h1>
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-green-500" />
                    <span>חיבור WhatsApp Cloud API</span>
                </div>
                <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="ml-1" /> מוכן להגדרה</Badge>
            </CardTitle>
            <CardDescription>
                כדי לחבר את המערכת לשירות ההודעות הרשמי של וואטסאפ, יש לבצע את השלבים הבאים בפורטל המפתחים של Meta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              <div>
                  <h3 className="font-semibold text-lg">שלב 1: הגדרת Webhook</h3>
                  <p className="text-sm text-muted-foreground">בפורטל המפתחים של Meta, תחת הגדרות ה-Webhook של אפליקציית הוואטסאפ שלך, יש להזין את הפרטים הבאים:</p>
                  <div className="mt-2 space-y-2">
                       <div className="space-y-1">
                           <Label>Callback URL</Label>
                           <Input readOnly value={WEBHOOK_URL} dir="ltr" />
                       </div>
                       <div className="space-y-1">
                           <Label>Verify token</Label>
                           <Input readOnly value={VERIFY_TOKEN} dir="ltr" />
                       </div>
                  </div>
              </div>

               <div>
                  <h3 className="font-semibold text-lg">שלב 2: הגדרת משתני סביבה</h3>
                  <p className="text-sm text-muted-foreground">ב-Cloud Run, תחת הגדרות שירות ה-`whatsapp-service`, יש להוסיף את משתני הסביבה הבאים:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm font-mono bg-muted p-3 rounded-md">
                      <li>WHATSAPP_VERIFY_TOKEN={VERIFY_TOKEN}</li>
                      <li>WHATSAPP_ACCESS_TOKEN=&lt;Your_Permanent_Access_Token&gt;</li>
                      <li>WHATSAPP_PHONE_NUMBER_ID=&lt;Your_Phone_Number_ID&gt;</li>
                  </ul>
              </div>
          </CardContent>
          <CardFooter>
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="outline" className="w-full">
                    <ExternalLink className="ml-2" />
                    פתח את פורטל המפתחים של Meta
                </Button>
            </a>
          </CardFooter>
        </Card>

         <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>בדיקת שליחת הודעה</CardTitle>
                <CardDescription>לאחר הגדרת ה-Webhook והמשתנים, שלח הודעת בדיקה כדי לוודא שהשירות עובד.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="test-number">מספר טלפון (בפורמט בינלאומי)</Label>
                    <Input 
                        id="test-number"
                        placeholder="לדוגמה: 972501234567"
                        value={testNumber}
                        onChange={(e) => setTestNumber(e.target.value)}
                        dir="ltr"
                    />
                 </div>
            </CardContent>
            <CardFooter>
                <Button 
                    onClick={handleSendTest} 
                    disabled={isSendingTest}
                    className="w-full"
                >
                    {isSendingTest ? <Loader2 className="animate-spin" /> : <Send className="ml-2"/>}
                    שלח הודעת בדיקה
                </Button>
            </CardFooter>
         </Card>
      </div>
       <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>יומן הודעות וואטסאפ</CardTitle>
                <CardDescription>50 ההודעות האחרונות שנשלחו.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={isLoadingLogs}>
                <RefreshCw className={cn("h-4 w-4", isLoadingLogs && "animate-spin")} />
            </Button>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-96">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>לקוח/ה</TableHead>
                            <TableHead>הודעה</TableHead>
                            <TableHead>סטטוס</TableHead>
                            <TableHead>תאריך</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingLogs ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-48">
                                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                </TableCell>
                            </TableRow>
                        ) : logs.length > 0 ? (
                            logs.map(log => (
                                <TableRow key={log.id}>
                                    <TableCell>{log.clientName}</TableCell>
                                    <TableCell className="max-w-xs">
                                        <p className="whitespace-pre-wrap">{log.body}</p>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={log.status === 'sent' ? 'secondary' : 'destructive'}>
                                            {log.status === 'sent' ? 'נשלח' : 'נכשל'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{format(log.processedAt, 'dd/MM/yy HH:mm', { locale: he })}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-48">
                                    אין יומני הודעות להצגה.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
