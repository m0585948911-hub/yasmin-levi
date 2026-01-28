
'use server';

import { collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getClientById } from './clients';

export interface WhatsAppLog {
    id: string;
    to: string;
    clientName?: string;
    body: string;
    status: 'sent' | 'failed';
    processedAt: Date;
    lastError?: string;
}

const logsCollection = collection(db, 'whatsapp_logs');

export async function getWhatsAppLogs(logLimit: number = 50): Promise<WhatsAppLog[]> {
    try {
        const q = query(logsCollection, orderBy("processedAt", "desc"), limit(logLimit));
        const querySnapshot = await getDocs(q);

        const logs = await Promise.all(querySnapshot.docs.map(async (doc) => {
            const data = doc.data();
            let clientName: string | undefined = 'לא ידוע';

            if (data.pushPayload?.clientId) {
                const client = await getClientById(data.pushPayload.clientId);
                if (client) {
                    clientName = `${client.firstName} ${client.lastName}`;
                }
            }

            return {
                id: doc.id,
                to: data.whatsappPayload?.to || 'N/A',
                clientName: clientName,
                body: data.whatsappPayload?.body || 'N/A',
                status: data.status,
                processedAt: (data.processedAt as Timestamp).toDate(),
                lastError: data.lastError,
            };
        }));
        return logs;
    } catch (error) {
        console.error("Error fetching WhatsApp logs:", error);
        return [];
    }
}
