'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const BirthDateSelector = ({ value, onChange, disabled }: { value: Date | undefined | null, onChange: (date: Date | undefined) => void, disabled?: boolean }) => {
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

    const handleDateChange = (newDay: string, newMonth: string, newYear: string) => {
        if (newYear && newMonth && newDay) {
            const yearNum = parseInt(newYear);
            const monthNum = parseInt(newMonth) - 1;
            const dayNum = parseInt(newDay);

            const newDate = new Date(yearNum, monthNum, dayNum);
            
            if (newDate.getFullYear() === yearNum && newDate.getMonth() === monthNum && newDate.getDate() === dayNum) {
                if (!initialDate || newDate.getTime() !== initialDate.getTime()) {
                    onChange(newDate);
                }
            }
        } else if (!newYear && !newMonth && !newDay) {
            if (initialDate !== null) {
                onChange(undefined);
            }
        }
    };
    
    const handleDayChange = (newDay: string) => {
        setDay(newDay);
        handleDateChange(newDay, month, year);
    };

    const handleMonthChange = (newMonth: string) => {
        setMonth(newMonth);
        if (year && day) {
            const dayNum = parseInt(day);
            const daysInNewMonth = new Date(parseInt(year), parseInt(newMonth), 0).getDate();
            if (dayNum > daysInNewMonth) {
                setDay(daysInNewMonth.toString());
                handleDateChange(daysInNewMonth.toString(), newMonth, year);
                return;
            }
        }
        handleDateChange(day, newMonth, year);
    };

    const handleYearChange = (newYear: string) => {
        setYear(newYear);
         if (month === '2' && day === '29') {
            const isLeap = new Date(parseInt(newYear), 1, 29).getMonth() === 1;
            if (!isLeap) {
                setDay('28');
                handleDateChange('28', month, newYear);
                return;
            }
        }
        handleDateChange(day, month, newYear);
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
