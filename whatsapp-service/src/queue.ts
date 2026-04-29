import { Firestore, Timestamp } from 'firebase-admin/firestore';
import type { Client as WhatsAppClient } from 'whatsapp-web.js';

const QUEUE_COLLECTION = 'whatsapp_queue';
const LOG_COLLECTION = 'whatsapp_logs';

const POLLING_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;
const LOCK_DURATION_MINUTES = 2;
const IGNORE_BEFORE_TS = Number(process.env.WHATSAPP_IGNORE_BEFORE_TS || '0');

function getNextBackoff(attempt: number): number {
  const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = backoff * 0.2 * Math.random();
  return backoff + jitter;
}

function normalizeIsraeliPhone(input: string): string {
  const cleaned = String(input || '').replace(/\D/g, '');
  if (cleaned.startsWith('972')) return cleaned;
  if (cleaned.startsWith('0')) return `972${cleaned.slice(1)}`;
  return `972${cleaned}`;
}

export function startQueueProcessor(db: Firestore, whatsappClient: WhatsAppClient) {
  const instanceId = `whatsapp-web-processor-${Date.now()}`;
  console.log(`Starting WhatsApp queue processor with ID: ${instanceId}`);

  setInterval(async () => {
    if (!whatsappClient.info) {
      console.log('WhatsApp session not ready yet, skipping queue tick');
      return;
    }

    let doc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const now = Timestamp.now();

    try {
      const snapshot = await db.collection(QUEUE_COLLECTION).limit(30).get();

      const pendingDocs = snapshot.docs
        .filter((d) => {
          const x = d.data();

          const createdMs =
            x.createdAt?.toMillis?.() ||
            x.createdAt?._seconds * 1000 ||
            x.createdAt?.seconds * 1000 ||
            0;

          if (IGNORE_BEFORE_TS && createdMs && createdMs < IGNORE_BEFORE_TS * 1000) {
            return false;
          }

          return (
            ['pending', 'retrying'].includes(x.status) &&
            (!x.nextAttemptAt || x.nextAttemptAt.toMillis() <= now.toMillis())
          );
        })
        .sort((a, b) => {
          const ax = a.data().nextAttemptAt?.toMillis?.() || 0;
          const bx = b.data().nextAttemptAt?.toMillis?.() || 0;
          return ax - bx;
        });

      if (!pendingDocs.length) return;

      doc = pendingDocs[0];
      const messageId = doc.id;

      await db.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(doc!.ref);
        if (!freshDoc.exists) throw new Error('Document does not exist.');

        const freshData = freshDoc.data()!;
        if (freshData.status !== 'pending' && freshData.status !== 'retrying') {
          throw new Error(`Document ${messageId} is not processable.`);
        }

        const lockExpiresAt = Timestamp.fromMillis(
          now.toMillis() + LOCK_DURATION_MINUTES * 60 * 1000
        );

        transaction.update(doc!.ref, {
          status: 'processing',
          lockedBy: instanceId,
          lockedAt: now,
          lockExpiresAt,
        });
      });

      const messageData = doc.data();
      const { to, body } = messageData.whatsappPayload || {};
      if (!to || !body) throw new Error('Missing whatsappPayload.to/body');

      if (!whatsappClient.info) {
        throw new Error('WhatsApp session is not ready yet');
      }

      const normalized = normalizeIsraeliPhone(to);
      const chatId = `${normalized}@c.us`;

      console.log(`Sending WhatsApp message ${messageId} to ${chatId}`);

      const isRegistered = await whatsappClient.isRegisteredUser(chatId);
      if (!isRegistered) {
        throw new Error(`Phone is not registered on WhatsApp: ${normalized}`);
      }

      await whatsappClient.sendMessage(chatId, String(body));

      await db.collection(LOG_COLLECTION).add({
        ...messageData,
        status: 'sent',
        provider: 'whatsapp-web-session',
        processedAt: Timestamp.now(),
      });

      await doc.ref.delete();
      console.log(`Successfully sent message ${messageId}`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown send error';

      if (!doc) {
        console.error('Queue processor error:', errorMessage);
        return;
      }

      const messageData = doc.data();
      const newAttempts = (messageData.attempts || 0) + 1;

      console.error(`Attempt ${newAttempts} failed for ${doc.id}:`, errorMessage);

      if (newAttempts >= MAX_ATTEMPTS) {
        await doc.ref.update({
          status: 'failed',
          attempts: newAttempts,
          lastError: errorMessage,
          provider: 'whatsapp-web-session',
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
        });
      } else {
        const backoffMs = getNextBackoff(newAttempts);
        const nextAttemptAt = Timestamp.fromMillis(Date.now() + backoffMs);

        await doc.ref.update({
          status: 'retrying',
          attempts: newAttempts,
          lastError: errorMessage,
          nextAttemptAt,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          provider: 'whatsapp-web-session',
        });
      }
    }
  }, POLLING_INTERVAL_MS);
}
