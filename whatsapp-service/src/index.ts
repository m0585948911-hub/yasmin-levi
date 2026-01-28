
import express from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { startQueueProcessor } from './queue';

// --- Firebase Admin Initialization ---
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : undefined;

initializeApp(serviceAccount ? { credential: cert(serviceAccount) } : undefined);
const db = getFirestore();

// --- Express App Initialization ---
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// --- Start Queue Processor ---
startQueueProcessor(db);

// --- API Endpoints ---

// Webhook verification endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified successfully!');
    res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed.');
    res.sendStatus(403);
  }
});

// Webhook for receiving messages
app.post('/webhook', (req, res) => {
  console.log('Received WhatsApp webhook:', JSON.stringify(req.body, null, 2));
  // Here you would process incoming messages, status updates, etc.
  // For now, we just log it.
  res.sendStatus(200);
});


app.get('/_health', (req, res) => {
  // Simple health check endpoint
  res.status(200).send('OK');
});


app.listen(port, () => {
  console.log(`WhatsApp service (Webhook Mode) listening on port ${port}`);
});
