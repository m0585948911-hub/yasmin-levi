'use client';
import { useState, useEffect } from 'react';
import { getClientQuote } from '@/ai/flows/get-client-quote-flow';
import { Loader2 } from 'lucide-react';

export function ClientQuote({ gender }: { gender: 'male' | 'female' }) {
    const [quote, setQuote] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchQuote() {
            setLoading(true);
            try {
                const result = await getClientQuote({ gender });
                setQuote(result);
            } catch (error) {
                console.error("Error fetching client quote:", error);
                setQuote("היופי שלך הוא ייחודי ומתחיל בך.");
            } finally {
                setLoading(false);
            }
        }
        if (gender) {
            fetchQuote();
        }
    }, [gender]);

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" />
                <p>טוען משפט יומי...</p>
            </div>
        );
    }

    return (
        <p className="mt-2 text-center text-muted-foreground italic">"{quote}"</p>
    );
}
