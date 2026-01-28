"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requeueStuckJobs = exports.onWhatsAppJobFailed = exports.sendAppointmentReminders = exports.onAppointmentWritten = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const whatsapp_templates_1 = require("./whatsapp-templates");
admin.initializeApp();
const db = admin.firestore();
// --- Helper Functions ---
async function getClientTokens(clientId) {
    const devicesSnapshot = await db.collection('clients').doc(clientId).collection('devices').get();
    if (devicesSnapshot.empty) {
        return [];
    }
    return devicesSnapshot.docs.map(doc => doc.data().token);
}
async function getClientPhone(clientId) {
    var _a;
    if (!clientId)
        return null;
    try {
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (clientDoc.exists) {
            return ((_a = clientDoc.data()) === null || _a === void 0 ? void 0 : _a.phone) || null;
        }
        functions.logger.warn(`Could not find client document for ID: ${clientId}`);
        return null;
    }
    catch (error) {
        functions.logger.error(`Error fetching client phone for ${clientId}:`, error);
        return null;
    }
}
async function enqueueWhatsAppMessage(dedupeKey, templateKey, variables, pushPayload) {
    if (!pushPayload.clientId) {
        functions.logger.warn(`Missing clientId for dedupeKey: ${dedupeKey}. Cannot enqueue message.`);
        return;
    }
    const clientPhone = await getClientPhone(pushPayload.clientId);
    if (!clientPhone) {
        functions.logger.warn(`Missing phone number for client ${pushPayload.clientId}. Cannot enqueue WhatsApp message. Sending fallback push.`);
        await sendPushNotification(pushPayload.clientId, pushPayload.title, pushPayload.body, pushPayload.data);
        return;
    }
    let sanitizedNumber = clientPhone.replace(/\D/g, '');
    if (sanitizedNumber.startsWith('0')) {
        sanitizedNumber = `972${sanitizedNumber.substring(1)}`;
    }
    else if (!sanitizedNumber.startsWith('972')) {
        sanitizedNumber = `972${sanitizedNumber}`;
    }
    const whatsappBody = (0, whatsapp_templates_1.getTemplate)(templateKey, variables);
    const messageData = {
        dedupeKey,
        whatsappPayload: {
            to: sanitizedNumber,
            body: whatsappBody,
        },
        pushPayload,
        status: 'pending',
        attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        nextAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = db.collection('whatsapp_queue').doc(dedupeKey);
    try {
        await docRef.create(messageData); // create() is idempotent because doc ID is the dedupeKey
        functions.logger.info(`Successfully enqueued WhatsApp message with key: ${dedupeKey}`);
    }
    catch (error) {
        if (error.code === 6) { // ALREADY_EXISTS from Firestore
            functions.logger.warn(`Message with dedupeKey ${dedupeKey} already exists. Skipping.`);
        }
        else {
            functions.logger.error(`Failed to enqueue WhatsApp message with key ${dedupeKey}:`, error);
        }
    }
}
async function sendPushNotification(clientId, title, body, data) {
    if (!clientId) {
        functions.logger.warn("No client ID provided, cannot send push notification.");
        return;
    }
    const tokens = await getClientTokens(clientId);
    if (tokens.length === 0) {
        functions.logger.info(`No FCM tokens for client ${clientId}.`);
        return;
    }
    const uniqueTokens = [...new Set(tokens)];
    const message = {
        notification: { title, body },
        data,
        tokens: uniqueTokens,
        apns: {
            payload: { aps: { sound: "default" } },
        },
        android: {
            notification: { sound: "default" }
        }
    };
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        functions.logger.info(`Push notification sent to ${response.successCount} tokens for client ${clientId}.`);
        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
            var _a;
            if (!resp.success) {
                const errorCode = (_a = resp.error) === null || _a === void 0 ? void 0 : _a.code;
                if (errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered') {
                    const tokenToDelete = uniqueTokens[idx];
                    const promise = db.collection('clients').doc(clientId).collection('devices').where('token', '==', tokenToDelete).limit(1).get().then(snap => {
                        if (!snap.empty) {
                            return snap.docs[0].ref.delete();
                        }
                        return null;
                    });
                    tokensToRemove.push(promise);
                }
            }
        });
        if (tokensToRemove.length > 0) {
            await Promise.all(tokensToRemove);
            functions.logger.info(`Removed ${tokensToRemove.length} invalid FCM tokens for client ${clientId}.`);
        }
    }
    catch (error) {
        functions.logger.error(`Error sending push notification multicast for client ${clientId}:`, error);
    }
}
// --- Cloud Triggers ---
exports.onAppointmentWritten = functions.firestore.document("/appointments/{appointmentId}")
    .onWrite(async (change, context) => {
    var _a, _b, _c, _d, _e;
    const appointmentId = context.params.appointmentId;
    const dataAfter = change.after.exists ? change.after.data() : undefined;
    const dataBefore = change.before.exists ? change.before.data() : undefined;
    // --- Logic for new PENDING appointments (notify admin via Push) ---
    if (!dataBefore && dataAfter && dataAfter.status === 'pending') {
        functions.logger.info(`New pending appointment detected: ${appointmentId}`);
        try {
            const usersSnapshot = await db.collection('users').where('permission', 'in', ['owner', 'developer', 'employee']).get();
            const tokens = [];
            usersSnapshot.forEach(doc => {
                const user = doc.data();
                if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
                    tokens.push(...user.fcmTokens);
                }
            });
            if (tokens.length > 0) {
                const uniqueTokens = [...new Set(tokens)];
                const message = {
                    notification: {
                        title: 'בקשת תור חדשה',
                        body: `תור חדש ממתין לאישור מ: ${dataAfter.clientName}`,
                    },
                    data: {
                        route: '/admin/appointments/pending'
                    },
                    tokens: uniqueTokens,
                    apns: { payload: { aps: { sound: "default" } } },
                    android: { notification: { sound: "default" } }
                };
                await admin.messaging().sendEachForMulticast(message);
            }
        }
        catch (error) {
            functions.logger.error("Error sending push notification to admin:", error);
        }
    }
    const clientId = (dataAfter === null || dataAfter === void 0 ? void 0 : dataAfter.clientId) || (dataBefore === null || dataBefore === void 0 ? void 0 : dataBefore.clientId);
    if (!clientId) {
        functions.logger.warn(`No client ID found for appointment ${appointmentId}. Skipping client notifications.`);
        return;
    }
    const clientName = (_b = (_a = dataAfter === null || dataAfter === void 0 ? void 0 : dataAfter.clientName) !== null && _a !== void 0 ? _a : dataBefore === null || dataBefore === void 0 ? void 0 : dataBefore.clientName) !== null && _b !== void 0 ? _b : 'לקוח/ה יקר/ה';
    const serviceName = (_d = (_c = dataAfter === null || dataAfter === void 0 ? void 0 : dataAfter.serviceName) !== null && _c !== void 0 ? _c : dataBefore === null || dataBefore === void 0 ? void 0 : dataBefore.serviceName) !== null && _d !== void 0 ? _d : 'השירות שלך';
    // --- Client Notification Logic ---
    // 1. Appointment Approved
    if ((dataBefore === null || dataBefore === void 0 ? void 0 : dataBefore.status) === 'pending' && (dataAfter === null || dataAfter === void 0 ? void 0 : dataAfter.status) === 'scheduled') {
        functions.logger.info(`Appointment ${appointmentId} approved. Enqueueing notifications.`);
        const title = 'התור שלך אושר!';
        const body = `היי ${clientName}, התור שלך ל${serviceName} נקבע בהצלחה ליום ${(0, date_fns_1.format)(dataAfter.start.toDate(), 'eeee, d MMMM', { locale: locale_1.he })} בשעה ${(0, date_fns_1.format)(dataAfter.start.toDate(), 'HH:mm')}.`;
        const dedupeKey = `${appointmentId}_approved`;
        const variables = {
            '#clientName#': clientName,
            '#serviceName#': serviceName,
            '#date#': (0, date_fns_1.format)(dataAfter.start.toDate(), 'eeee, d MMMM', { locale: locale_1.he }),
            '#time#': (0, date_fns_1.format)(dataAfter.start.toDate(), 'HH:mm'),
        };
        await sendPushNotification(clientId, title, body, { route: '/my-appointments', appointmentId });
        await enqueueWhatsAppMessage(dedupeKey, 'appointmentApproved', variables, { clientId, title, body, data: { route: '/my-appointments', appointmentId } });
    }
    // 2. Appointment Rescheduled by Admin
    else if (dataBefore && dataAfter && dataBefore.start.toMillis() !== dataAfter.start.toMillis() && dataAfter.status === 'scheduled') {
        functions.logger.info(`Appointment ${appointmentId} rescheduled. Enqueueing notifications.`);
        const newTimeStr = (0, date_fns_1.format)(dataAfter.start.toDate(), 'dd/MM/yy HH:mm', { locale: locale_1.he });
        const title = 'התור שלך עודכן';
        const body = `היי ${clientName}, שימי לב, התור שלך עודכן לתאריך ${newTimeStr}.`;
        const dedupeKey = `${appointmentId}_rescheduled_${dataAfter.start.toMillis()}`;
        const variables = {
            '#clientName#': clientName,
            '#serviceName#': serviceName,
            '#date#': (0, date_fns_1.format)(dataAfter.start.toDate(), 'dd/MM/yy'),
            '#time#': (0, date_fns_1.format)(dataAfter.start.toDate(), 'HH:mm'),
        };
        await sendPushNotification(clientId, title, body, { route: '/my-appointments', appointmentId });
        await enqueueWhatsAppMessage(dedupeKey, 'appointmentRescheduled', variables, { clientId, title, body, data: { route: '/my-appointments', appointmentId } });
    }
    // 3. Appointment Cancelled/Rejected by Admin
    else if ((dataAfter === null || dataAfter === void 0 ? void 0 : dataAfter.status) === 'cancelled' && (dataBefore === null || dataBefore === void 0 ? void 0 : dataBefore.status) !== 'cancelled') {
        functions.logger.info(`Appointment ${appointmentId} cancelled/rejected. Enqueueing notifications.`);
        const startTimestamp = (_e = dataBefore === null || dataBefore === void 0 ? void 0 : dataBefore.start) !== null && _e !== void 0 ? _e : dataAfter === null || dataAfter === void 0 ? void 0 : dataAfter.start;
        const datePart = startTimestamp && typeof startTimestamp.toDate === "function"
            ? `בתאריך ${(0, date_fns_1.format)(startTimestamp.toDate(), 'dd/MM/yyyy')}`
            : "שנקבע";
        const body = `היי ${clientName}, התור שלך ל${serviceName} ${datePart} בוטל.`;
        const title = 'התור שלך בוטל';
        const dedupeKey = `${appointmentId}_cancelled`;
        const variables = {
            '#clientName#': clientName,
            '#serviceName#': serviceName,
            '#date#': datePart,
        };
        await sendPushNotification(clientId, title, body, { route: '/my-appointments', appointmentId });
        await enqueueWhatsAppMessage(dedupeKey, 'appointmentCancelled', variables, { clientId, title, body, data: { route: '/my-appointments', appointmentId } });
    }
});
exports.sendAppointmentReminders = functions.pubsub.schedule("every 1 hours").onRun(async (context) => {
    functions.logger.info("Running hourly appointment reminder job.");
    const now = new Date();
    const reminderStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const q = db.collection('appointments')
        .where('status', 'in', ['scheduled', 'confirmed'])
        .where('start', '>=', admin.firestore.Timestamp.fromDate(reminderStart))
        .where('start', '<', admin.firestore.Timestamp.fromDate(reminderEnd));
    const querySnapshot = await q.get();
    if (querySnapshot.empty) {
        functions.logger.info("No appointments in the next 24-25 hours to send reminders for.");
        return;
    }
    functions.logger.info(`Found ${querySnapshot.size} appointments for reminders.`);
    for (const doc of querySnapshot.docs) {
        const appointmentId = doc.id;
        const appointment = doc.data();
        if (appointment.clientId) {
            const appTime = (0, date_fns_1.format)(appointment.start.toDate(), 'HH:mm', { locale: locale_1.he });
            const serviceName = appointment.serviceName || "הטיפול שלך";
            const clientName = appointment.clientName || 'לקוח/ה';
            const title = "תזכורת לתור מחר";
            const body = `היי ${clientName}, תזכורת לקראת התור שלך מחר (${serviceName}) בשעה ${appTime}. מצפים לראותך!`;
            const dedupeKey = `${appointmentId}_reminder_24h`;
            const variables = {
                '#clientName#': clientName,
                '#serviceName#': serviceName,
                '#time#': appTime,
            };
            const pushPayload = { clientId: appointment.clientId, title, body, data: { route: '/my-appointments', appointmentId } };
            await sendPushNotification(pushPayload.clientId, pushPayload.title, pushPayload.body, pushPayload.data);
            await enqueueWhatsAppMessage(dedupeKey, 'appointmentReminder24h', variables, pushPayload);
        }
    }
});
exports.onWhatsAppJobFailed = functions.firestore.document('whatsapp_queue/{messageId}')
    .onUpdate(async (change, context) => {
    const dataAfter = change.after.data();
    const dataBefore = change.before.data();
    if (dataBefore.status !== 'failed' && dataAfter.status === 'failed') {
        functions.logger.warn(`WhatsApp message ${context.params.messageId} failed. Sending fallback push notification.`);
        const { pushPayload } = dataAfter;
        if (pushPayload && pushPayload.clientId) {
            await sendPushNotification(pushPayload.clientId, pushPayload.title, pushPayload.body, pushPayload.data);
        }
        else {
            functions.logger.error(`Could not send fallback for ${context.params.messageId} due to missing pushPayload.`);
        }
    }
});
exports.requeueStuckJobs = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    functions.logger.info('Checking for stuck WhatsApp jobs...');
    const now = admin.firestore.Timestamp.now();
    const stuckJobsQuery = db.collection('whatsapp_queue')
        .where('status', '==', 'processing')
        .where('lockExpiresAt', '<', now);
    const snapshot = await stuckJobsQuery.get();
    if (snapshot.empty) {
        functions.logger.info('No stuck jobs found.');
        return null;
    }
    const batch = db.batch();
    snapshot.forEach(doc => {
        functions.logger.warn(`Found stuck job ${doc.id}, resetting to 'pending'.`);
        batch.update(doc.ref, {
            status: 'pending',
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
        });
    });
    await batch.commit();
    functions.logger.info(`Reset ${snapshot.size} stuck jobs.`);
    return null;
});
//# sourceMappingURL=index.js.map