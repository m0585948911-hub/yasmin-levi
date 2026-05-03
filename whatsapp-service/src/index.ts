import express from 'express';
import pino from 'pino';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : undefined;

initializeApp(serviceAccount ? { credential: cert(serviceAccount) } : undefined);
const db = getFirestore();

const app = express();
app.use(express.json());

let sock: any = null;
let ready = false;
let status = 'logged_out';
let lastPairingCode: string | null = null;
let startingPromise: Promise<void> | null = null;
let retryAfterUntil = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isConnectionClosed(error: any) {
  return String(error?.message || error).includes('Connection Closed')
    || error?.output?.statusCode === 428;
}

async function setStatus(next: string, extra: Record<string, any> = {}) {
  status = next;
  await db.collection('whatsapp_status').doc('main').set({
    status,
    ready,
    pairingCode: lastPairingCode,
    updatedAt: Timestamp.now(),
    ...extra,
  }, { merge: true });
}

async function startWhatsApp(phone?: string) {
  if (Date.now() < retryAfterUntil) {
    const err: any = new Error('socket_reconnecting');
    err.retryAfter = Math.ceil((retryAfterUntil - Date.now()) / 1000);
    throw err;
  }

  if (startingPromise) return startingPromise;

  startingPromise = (async () => {
    ready = false;
    await setStatus('starting');

    const { state, saveCreds } = await useMultiFileAuthState('./baileys_auth');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['Yasmin Levi App', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        ready = true;
        lastPairingCode = null;
        await setStatus('connected', {
          clientInfo: sock?.user || null,
        });
      }

      if (connection === 'close') {
        ready = false;
        const reason = lastDisconnect?.error?.output?.statusCode;
        status = reason === DisconnectReason.loggedOut ? 'logged_out' : 'disconnected';
        await setStatus(status);
        startingPromise = null;
      }
    });

    if (phone && !state.creds.registered) {
      await sleep(5000);

      try {
        const code = await sock.requestPairingCode(phone);
        lastPairingCode = code;
        await setStatus('pairing', {
          pairingPhone: phone,
          pairingCode: code,
          codeExpiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
        });
      } catch (error: any) {
        if (isConnectionClosed(error)) {
          sock = null;
          ready = false;
          lastPairingCode = null;
          startingPromise = null;
          retryAfterUntil = Date.now() + 30 * 1000;

          await setStatus('reconnecting', {
            pairingCode: null,
            retryAfter: 30,
            retryAfterUntil: Timestamp.fromMillis(retryAfterUntil),
          });

          const err: any = new Error('socket_reconnecting');
          err.retryAfter = 30;
          throw err;
        }

        throw error;
      }
    }
  })();

  return startingPromise;
}

app.get('/status', async (_req, res) => {
  res.json({
    ok: true,
    ready,
    status,
    hasQr: false,
    pairingCode: lastPairingCode,
    clientInfo: sock?.user || null,
  });
});

app.post('/connect', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').replace(/\D/g, '');

    if (!phone || !phone.startsWith('972')) {
      return res.status(400).json({ error: 'phone must be international Israeli format, e.g. 972509234865' });
    }

    await startWhatsApp(phone);

    return res.json({
      ok: true,
      status,
      code: lastPairingCode,
      expiresIn: lastPairingCode ? 300 : undefined,
    });
  } catch (error: any) {
    console.error('[BAILEYS CONNECT ERROR]', error);

    if (error?.message === 'socket_reconnecting' || isConnectionClosed(error)) {
      const retryAfter = error?.retryAfter || 30;
      retryAfterUntil = Date.now() + retryAfter * 1000;

      return res.status(409).json({
        ok: false,
        error: 'socket_reconnecting',
        message: 'החיבור עדיין מתאפס. נסה שוב בעוד כמה שניות.',
        retryAfter,
      });
    }

    return res.status(500).json({
      error: 'pairing failed',
      details: error?.message || String(error),
    });
  }
});

app.post('/logout', async (_req, res) => {
  try {
    await sock?.logout?.();
  } catch (error) {
    console.error('[BAILEYS LOGOUT ERROR]', error);
  }

  sock = null;
  ready = false;
  lastPairingCode = null;
  startingPromise = null;

  await setStatus('logged_out', { pairingCode: null, clientInfo: null });

  res.json({ ok: true, status: 'logged_out' });
});

app.post('/send', async (req, res) => {
  try {
    if (!sock || !ready) return res.status(400).json({ error: 'WhatsApp is not connected' });

    const to = String(req.body?.to || '').replace(/\D/g, '');
    const body = String(req.body?.body || '');

    if (!to || !body) return res.status(400).json({ error: 'missing to/body' });

    const jid = `${to.startsWith('972') ? to : `972${to.replace(/^0/, '')}`}@s.whatsapp.net`;

    await sock.sendMessage(jid, { text: body });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('[BAILEYS SEND ERROR FULL]', error);
    res.status(500).json({
      ok: false,
      error: 'send failed',
      details: error?.message || String(error),
      stack: error?.stack || null,
    });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Baileys WhatsApp service listening on port ${port}`);
});
