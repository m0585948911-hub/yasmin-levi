
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Store } from 'lucide-react';
import { Logo } from '@/components/logo';

function ShopPageContent() {
    const searchParams = useSearchParams();

    const backLink = `/dashboard?${searchParams.toString()}`;

    return (
        <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
            <div className="absolute top-4 right-4">
                <Link href={backLink}>
                    <Button variant="outline">
                        <ArrowLeft className="ml-2" />
                        חזרה
                    </Button>
                </Link>
            </div>
             <div className="w-full max-w-md flex flex-col items-center">
                <Logo className="w-48 h-48 mb-6" />
                <Card className="w-full text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
                            <Store />
                            חנות
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xl text-muted-foreground">
                            בקרוב... חנות דיגיטלית
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function ShopPage() {
    return (
        <Suspense fallback={<div>טוען...</div>}>
            <ShopPageContent />
        </Suspense>
    );
}
