
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, ChevronLeft, Download, Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { DateRange } from 'react-day-picker';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

type ReportConfig = {
  id: string;
  name: string;
  description?: string;
  needsDateRange?: boolean;
};

const clientReports: ReportConfig[] = [
    { id: 'clients_not_returned', name: 'לקוחות שלא חזרו (מעל 60 יום)'},
    { id: 'clients_no_show', name: 'לקוחות שלא הגיעו לתור' },
    { id: 'clients_list', name: 'רשימת הלקוחות' },
    { id: 'clients_blocked', name: 'לקוחות חסומים' },
    { id: 'clients_not_blocked', name: 'לקוחות לא חסומים' },
    { id: 'clients_active', name: 'לקוחות פעילים' },
    { id: 'clients_new', name: 'לקוחות חדשים' },
    { id: 'clients_by_category', name: 'לקוחות לפי קטגוריית טיפול' },
    { id: 'clients_by_calendar', name: 'לקוחות לפי יומן' },
    { id: 'clients_birthday_week', name: 'לקוחות עם יום הולדת השבוע' },
    { id: 'clients_birthday_month', name: 'לקוחות עם יום הולדת החודש' },
    { id: 'clients_app_download', name: 'לקוחות שהורידו את האפליקציה' },
];

const appointmentReports: ReportConfig[] = [
    { id: 'appointments_list', name: 'רשימת התורים' },
    { id: 'appointments_by_calendar', name: 'רשימת תורים לפי יומן' },
    { id: 'appointments_arrivals', name: 'דוח אישורי הגעה' },
    { id: 'appointments_cancellations', name: 'דוח ביטולים' },
];

const financialReports: ReportConfig[] = [
     { id: 'vouchers_report', name: 'דוח כרטיסיות' },
     { id: 'coupons_report', name: 'דוח שוברים' },
];

const communicationReports: ReportConfig[] = [
    { id: 'sms_report', name: 'דוח הודעות SMS' },
    { id: 'whatsapp_report', name: 'דוח הודעות WhatsApp' },
    { id: 'email_report', name: 'דוח אימייל' },
    { id: 'push_notifications_report', name: 'דוח התראות פוש' },
    { id: 'system_alerts_report', name: 'דוח התראות מערכת' },
];

const otherReports: ReportConfig[] = [
    { id: 'app_downloads_summary', name: 'כמה לקוחות הורידו את האפליקציה (אפל/אנדרואיד)' },
    { id: 'forms_list', name: 'רשימת טפסים בבנק' },
];


export function AdminReports() {

    const handleGenerateReport = (report: ReportConfig) => {
        // Placeholder for report generation logic
        console.log('Generating report:', report.name);
        alert(`מפיק דוח: ${report.name}`);
    };
    
    const ReportListItem = ({ report }: { report: ReportConfig }) => (
        <button
            onClick={() => handleGenerateReport(report)}
            className="flex items-center justify-between w-full text-right p-4 border-b hover:bg-accent transition-colors"
        >
            <span>{report.name}</span>
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </button>
    );

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                 <div className="flex items-center gap-4">
                    <Link href="/admin" passHref>
                        <Button variant="outline">
                            <ArrowLeft className="ml-2" />
                            חזרה
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">דוחות</h1>
                </div>
                 <Button variant="outline">
                    <PlusCircle className="ml-2" />
                    יצירת דוח מותאם אישית
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>רשימת דוחות</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Accordion type="multiple" className="w-full">
                        <AccordionItem value="clients">
                            <AccordionTrigger className="px-6 py-4 bg-muted/50">דוחות לקוחות</AccordionTrigger>
                            <AccordionContent className="p-0">
                                <div className="flex flex-col">
                                    {clientReports.map(report => <ReportListItem key={report.id} report={report} />)}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="appointments">
                            <AccordionTrigger className="px-6 py-4 bg-muted/50">דוחות תורים</AccordionTrigger>
                            <AccordionContent className="p-0">
                                 <div className="flex flex-col">
                                    {appointmentReports.map(report => <ReportListItem key={report.id} report={report} />)}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="financial">
                            <AccordionTrigger className="px-6 py-4 bg-muted/50">דוחות כספיים</AccordionTrigger>
                            <AccordionContent className="p-0">
                                 <div className="flex flex-col">
                                    {financialReports.map(report => <ReportListItem key={report.id} report={report} />)}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="communication">
                            <AccordionTrigger className="px-6 py-4 bg-muted/50">דוחות תקשורת</AccordionTrigger>
                            <AccordionContent className="p-0">
                                <div className="flex flex-col">
                                    {communicationReports.map(report => <ReportListItem key={report.id} report={report} />)}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="other">
                            <AccordionTrigger className="px-6 py-4 bg-muted/50">דוחות כלליים</AccordionTrigger>
                            <AccordionContent className="p-0">
                                <div className="flex flex-col">
                                    {otherReports.map(report => <ReportListItem key={report.id} report={report} />)}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
