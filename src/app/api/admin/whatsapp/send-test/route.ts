
import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

async function verifyAdmin(request: Request): Promise<boolean> {
    console.log("TODO: Implement real admin verification");
    return true;
}

export async function POST(request: Request) {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { to, body } = await request.json();

        if (!to || !body) {
            return NextResponse.json({ error: 'Missing "to" or "body"' }, { status: 400 });
        }
        
        let sanitizedNumber = to.replace(/\D/g, '');
        if (sanitizedNumber.startsWith('0')) {
            sanitizedNumber = `972${sanitizedNumber.substring(1)}`;
        } else if (!sanitizedNumber.startsWith('972')) {
            sanitizedNumber = `972${sanitizedNumber}`;
        }

        const dedupeKey = `test_${sanitizedNumber}_${Date.now()}`;
        const queueRef = adminDb.collection('whatsapp_queue').doc(dedupeKey);
        
        await queueRef.create({
            dedupeKey: dedupeKey,
            whatsappPayload: {
                to: sanitizedNumber,
                body: body,
            },
            status: 'pending',
            attempts: 0,
            createdAt: Timestamp.now(),
            nextAttemptAt: Timestamp.now(),
        });

        return NextResponse.json({ success: true, message: 'Test message queued.' });

    } catch (error: any) {
        console.error("Error queuing test message:", error);
        if (error.code === 6) { // ALREADY_EXISTS
            return NextResponse.json({ success: true, message: 'A similar test message was recently queued.' });
        }
        return NextResponse.json({ error: 'Failed to queue message.', details: error.message }, { status: 500 });
    }
}
