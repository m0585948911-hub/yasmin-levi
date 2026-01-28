
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import axios from 'axios';

const QUEUE_COLLECTION = 'whatsapp_queue';
const LOG_COLLECTION = 'whatsapp_logs';

const POLLING_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;
const LOCK_DURATION_MINUTES = 2;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getNextBackoff(attempt: number): number {
    const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
    const jitter = backoff * 0.2 * Math.random();
    return backoff + jitter;
}

export function startQueueProcessor(db: Firestore) {
  const instanceId = `whatsapp-processor-${Date.now()}`;
  console.log(`Starting WhatsApp queue processor (Webhook Mode) with ID: ${instanceId}`);

  const {
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID
  } = process.env;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error("WhatsApp environment variables (ACCESS_TOKEN, PHONE_NUMBER_ID) are not set. Processor will not run.");
      return;
  }

  setInterval(async () => {
    const now = Timestamp.now();
    const q = db.collection(QUEUE_COLLECTION)
      .where('status', 'in', ['pending', 'retrying'])
      .where('nextAttemptAt', '<=', now)
      .orderBy('nextAttemptAt')
      .limit(1);

    const snapshot = await q.get();
    if (snapshot.empty) return;

    const doc = snapshot.docs[0];
    const messageId = doc.id;
    let messageData = doc.data();

    // --- Transactional Claim ---
    try {
        await db.runTransaction(async (transaction) => {
            const freshDoc = await transaction.get(doc.ref);
            if (!freshDoc.exists) throw new Error("Document does not exist.");
            
            const freshData = freshDoc.data()!;
            if (freshData.status !== 'pending' && freshData.status !== 'retrying') {
                throw new Error(`Document ${messageId} is not in a processable state.`);
            }

            const lockExpiresAt = Timestamp.fromMillis(now.toMillis() + LOCK_DURATION_MINUTES * 60 * 1000);
            transaction.update(doc.ref, {
                status: 'processing',
                lockedBy: instanceId,
                lockedAt: now,
                lockExpiresAt: lockExpiresAt,
            });
        });
    } catch (error: any) {
        console.warn(`Failed to claim message ${messageId}:`, error.message);
        return;
    }
    
    // --- Process Message ---
    try {
      console.log(`Processing message ${messageId} to ${messageData.whatsappPayload.to}`);
      const { to, body } = messageData.whatsappPayload;

      await axios.post(
        `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: body },
        },
        {
          headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // --- Success ---
      console.log(`Successfully sent message ${messageId}`);
      await db.collection(LOG_COLLECTION).add({ ...messageData, status: 'sent', processedAt: Timestamp.now() });
      await doc.ref.delete();

    } catch (error: any) {
      const isAxiosError = axios.isAxiosError(error);
      const errorMessage = isAxiosError ? JSON.stringify(error.response?.data) : error.message;
      console.error(`Attempt ${messageData.attempts + 1} failed for message ${messageId}:`, errorMessage);
      
      const newAttempts = messageData.attempts + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        console.error(`Message ${messageId} has failed permanently after ${newAttempts} attempts.`);
        await doc.ref.update({ status: 'failed', lastError: errorMessage });
      } else {
        const backoffMs = getNextBackoff(newAttempts);
        const nextAttemptAt = Timestamp.fromMillis(Date.now() + backoffMs);
        console.log(`Scheduling retry for message ${messageId} in ${Math.round(backoffMs / 1000)}s.`);
        await doc.ref.update({
            status: 'retrying',
            attempts: newAttempts,
            lastError: errorMessage,
            nextAttemptAt: nextAttemptAt,
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
        });
      }
    }
  }, POLLING_INTERVAL_MS);
}
