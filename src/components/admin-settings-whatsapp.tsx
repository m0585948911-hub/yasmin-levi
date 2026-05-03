'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  LogOut,
  PlugZap,
  RefreshCw,
  Send,
  Smartphone,
  WifiOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { WhatsAppLog, getWhatsAppLogs } from '@/lib/whatsapp-logs';

type WhatsAppStatus = {
  ok?: boolean;
  ready?: boolean;
  status?: string;
  qr?: string;
};

export function AdminSettingsWhatsapp() {
  const { toast } = useToast();

  const [phone, setPhone] = useState('0545617619');
  const [pairingCode, setPairingCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [status, setStatus] = useState<WhatsAppStatus>({ ready: false, status: 'loading' });

  const [testNumber, setTestNumber] = useState('');
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const [isConnecting, startConnectTransition] = useTransition();
  const [isDisconnecting, startDisconnectTransition] = useTransition();
  const [isSendingTest, startSendTestTransition] = useTransition();

  const isReady = !!status.ready || status.status === 'ready';

  const timeLeft = useMemo(() => {
    if (!expiresAt) return '';
    const seconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, [expiresAt]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp/status', { cache: 'no-store' });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ ready: false, status: 'service_unreachable' });
    }
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    const fetchedLogs = await getWhatsAppLogs(50);
    setLogs(fetchedLogs);
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const id = window.setInterval(fetchStatus, 10000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => {
      if (Date.now() >= expiresAt) {
        setPairingCode('');
        setExpiresAt(null);
      } else {
        setExpiresAt((x) => x);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const normalizeIsraeliPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!/^05\d{8}$/.test(digits)) return '';
    return digits;
  };

  const toInternationalPhone = (localPhone: string) => `972${localPhone.slice(1)}`;

  const handleConnect = () => {
    const localPhone = normalizeIsraeliPhone(phone);

    if (!localPhone) {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'יש להזין מספר ישראלי תקין בפורמט 05XXXXXXXX.' });
      return;
    }

    setPhone(localPhone);
    const cleanPhone = toInternationalPhone(localPhone);

    startConnectTransition(async () => {
      try {
        const res = await fetch('/api/admin/whatsapp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone }),
        });

        const data = await res.json();

        if (!res.ok || !data.code) {
          throw new Error(data.error || 'לא התקבל קוד חיבור');
        }

        setPairingCode(String(data.code));
        setExpiresAt(Date.now() + Number(data.expiresIn || 300) * 1000);
        setStatus({ ready: false, status: 'pairing' });

        toast({
          title: 'קוד חיבור נוצר',
          description: 'פתח WhatsApp > מכשירים מקושרים > קישור באמצעות מספר טלפון.',
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'שגיאת חיבור',
          description: error?.message || 'לא ניתן ליצור קוד חיבור.',
        });
      }
    });
  };

  const handleLogout = () => {
    startDisconnectTransition(async () => {
      try {
        await fetch('/api/admin/whatsapp/logout', { method: 'POST' });
        setPairingCode('');
        setExpiresAt(null);
        await fetchStatus();
        toast({ title: 'נותק', description: 'סשן WhatsApp נותק.' });
      } catch {
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לנתק את הסשן.' });
      }
    });
  };

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
      } catch {
        toast({ variant: 'destructive', title: 'שגיאת רשת', description: 'לא ניתן היה לשלוח את הודעת הבדיקה.' });
      }
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6" dir="rtl">
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
            <CardTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isReady ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <WifiOff className="h-6 w-6 text-red-500" />
                }
{status.status === 'qr' && status.qr && (
  <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-5 text-center space-y-3">
    <div className="text-sm font-medium text-blue-800">
      סרוק את הקוד עם WhatsApp
    </div>
    <div className="flex justify-center">
      <QRCodeSVG value={status.qr} size={220} />
    </div>
    <div className="text-xs text-blue-900">
      WhatsApp ← מכשירים מקושרים ← סרוק קוד QR
    </div>
  </div>
)}
                <span>חיבור WhatsApp Web</span>
              </div>
              <Badge className={isReady ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
                {isReady ? 'מחובר' : 'לא מחובר'}
              </Badge>
            </CardTitle>
            <CardDescription>
              חבר את המערכת כמכשיר מקושר ב־WhatsApp. ההודעות יישלחו דרך המספר שתגדיר כאן.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-lg border p-4 bg-muted/40">
              <div className="text-sm text-muted-foreground">סטטוס נוכחי</div>
              <div className="mt-1 font-semibold" dir="ltr">
                {status.status || 'unknown'}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-phone">מספר WhatsApp לשליחה</Label>
              <Input
                id="wa-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value}
{status.status === 'qr' && status.qr && (
  <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-5 text-center space-y-3">
    <div className="text-sm font-medium text-blue-800">
      סרוק את הקוד עם WhatsApp
    </div>
    <div className="flex justify-center">
      <QRCodeSVG value={status.qr} size={220} />
    </div>
    <div className="text-xs text-blue-900">
      WhatsApp ← מכשירים מקושרים ← סרוק קוד QR
    </div>
  </div>
)}
                placeholder="0509234865"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                יש להזין מספר ישראלי רגיל בלבד, לדוגמה: 0509234865
              </p>
            </div>

            {pairingCode && (
              <div className="rounded-2xl border-2 border-green-500 bg-green-50 p-5 text-center space-y-3">
                <div className="text-sm font-medium text-green-800">קוד לחיבור WhatsApp</div>
                <div className="text-4xl font-black tracking-widest text-green-900" dir="ltr">
                  {pairingCode}
                </div>
                <div className="text-sm text-green-800">
                  זמן נותר להקלדה: <span className="font-bold" dir="ltr">{timeLeft}</span>
                </div>
                <div className="text-xs text-green-900">
                  WhatsApp ← מכשירים מקושרים ← קישור באמצעות מספר טלפון
                </div>
              </div>
            }
{status.status === 'qr' && status.qr && (
  <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-5 text-center space-y-3">
    <div className="text-sm font-medium text-blue-800">
      סרוק את הקוד עם WhatsApp
    </div>
    <div className="flex justify-center">
      <QRCodeSVG value={status.qr} size={220} />
    </div>
    <div className="text-xs text-blue-900">
      WhatsApp ← מכשירים מקושרים ← סרוק קוד QR
    </div>
  </div>
)}
          </CardContent>

          <CardFooter className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
              {isConnecting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PlugZap className="ml-2 h-4 w-4" />}
              {isReady ? 'חבר מחדש / צור קוד' : 'חבר WhatsApp'}
            </Button>

            <Button variant="outline" onClick={handleLogout} disabled={isDisconnecting} className="w-full">
              {isDisconnecting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <LogOut className="ml-2 h-4 w-4" />}
              נתק סשן
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              בדיקת שליחת הודעה
            </CardTitle>
            <CardDescription>
              הבדיקה תכניס הודעה לתור. השליחה בפועל תתבצע רק אם WhatsApp מחובר.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-number">מספר טלפון לבדיקה</Label>
              <Input
                id="test-number"
                placeholder="לדוגמה: 972501234567"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value}
{status.status === 'qr' && status.qr && (
  <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-5 text-center space-y-3">
    <div className="text-sm font-medium text-blue-800">
      סרוק את הקוד עם WhatsApp
    </div>
    <div className="flex justify-center">
      <QRCodeSVG value={status.qr} size={220} />
    </div>
    <div className="text-xs text-blue-900">
      WhatsApp ← מכשירים מקושרים ← סרוק קוד QR
    </div>
  </div>
)}
                dir="ltr"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSendTest} disabled={isSendingTest || !isReady} className="w-full">
              {isSendingTest ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
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
            <RefreshCw className={cn('h-4 w-4', isLoadingLogs && 'animate-spin')} />
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
                  logs.map((log) => (
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
                }
{status.status === 'qr' && status.qr && (
  <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-5 text-center space-y-3">
    <div className="text-sm font-medium text-blue-800">
      סרוק את הקוד עם WhatsApp
    </div>
    <div className="flex justify-center">
      <QRCodeSVG value={status.qr} size={220} />
    </div>
    <div className="text-xs text-blue-900">
      WhatsApp ← מכשירים מקושרים ← סרוק קוד QR
    </div>
  </div>
)}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
