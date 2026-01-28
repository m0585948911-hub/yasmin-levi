'use client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Using a static list of quotes to avoid build issues with server-side dependencies.
const quotes = [
    "העסק שלי הוא ביטוי של החזון שלי, ואני נחוש להגשים אותו.",
    "אני מאמין ביכולת שלי ליצור שינוי חיובי בעולם דרך העסק שלי.",
    "אני יוצר עסק מצליח המבוסס על ערכים של יושרה, חדשנות וצמיחה.",
    "העסק שלי הוא השליחות שלי, ואני מחויב להביא אותו להצלחה.",
    "אני בונה עסק שישפיע לטובה על חיי לקוחותיי ועל הקהילה שלי.",
    "אני מוכן להתמודד עם אתגרים ולהמשיך לצמוח, כדי להגשים את החזון שלי.",
    "אני נחוש ליצור עסק שמייצג את הערכים שלי ומשאיר חותם בעולם.",
    "אני יודעת את הערך שלי ואני ראויה להצלחה.",
    "אני בוטחת ביכולת שלי להגשים את החלומות שלי.",
    "אני משקיעה בעצמי ובפיתוח המקצועי שלי, כי אני יודעת שזה ישתלם.",
];


export function QuoteFlow() {
    const [quote, setQuote] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch a random quote from the static list
        const randomIndex = Math.floor(Math.random() * quotes.length);
        setQuote(quotes[randomIndex]);
        setLoading(false);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" />
                <p>טוען ציטוט יומי...</p>
            </div>
        );
    }

    return (
        <p className="mt-2 text-muted-foreground italic">"{quote}"</p>
    );
}
