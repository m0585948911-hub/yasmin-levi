

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { getTemplate, TemplateKey } from "./whatsapp-templates";

admin.initializeApp();
const db = admin.firestore();

interface Device {
    token: string;
    platform: 'web' | 'ios' | 'android';
    updatedAt: admin.firestore.Timestamp;
    appVersion?: string;
}

// --- Helper Functions ---

async function getTokensForEntity(entityId: string, entityType: 'clients' | 'users'): Promise<string[]> {
    const devicesSnapshot = await db.collection(entityType).doc(entityId).collection('devices').get();
    if (devicesSnapshot.empty) {
        return [];
    }
    return devicesSnapshot.docs.map(doc => (doc.data() as Device).token);
}


async function getClientPhone(clientId: string): Promise<string | null> {
    if (!clientId) return null;
    try {
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (clientDoc.exists) {
            return clientDoc.data()?.phone || null;
        }
        functions.logger.warn(`Could not find client document for ID: ${clientId}`);
        return null;
    } catch (error) {
        functions.logger.error(`Error fetching client phone for ${clientId}:`, error);
        return null;
    }
}


async function enqueueWhatsAppMessage(
    dedupeKey: string,
    templateKey: TemplateKey,
    variables: Record<string, string>,
    pushPayload: { clientId: string, title: string, body: string, data: { [key: string]: string } }
) {
    if (!pushPayload.clientId) {
        functions.logger.warn(`Missing clientId for dedupeKey: ${dedupeKey}. Cannot enqueue message.`);
        return;
    }

    const clientPhone = await getClientPhone(pushPayload.clientId);
    if (!clientPhone) {
        functions.logger.warn(`Missing phone number for client ${pushPayload.clientId}. Cannot enqueue WhatsApp message. Sending fallback push.`);
        await sendPushNotification(pushPayload.clientId, 'clients', pushPayload.title, pushPayload.body, pushPayload.data);
        return;
    }

    let sanitizedNumber = clientPhone.replace(/\D/g, '');
    if (sanitizedNumber.startsWith('0')) {
        sanitizedNumber = `972${sanitizedNumber.substring(1)}`;
    } else if (!sanitizedNumber.startsWith('972')) {
        sanitizedNumber = `972${sanitizedNumber}`;
    }
    
    const whatsappBody = getTemplate(templateKey, variables);

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
    } catch (error: any) {
        if (error.code === 6) { // ALREADY_EXISTS from Firestore
            functions.logger.warn(`Message with dedupeKey ${dedupeKey} already exists. Skipping.`);
        } else {
            functions.logger.error(`Failed to enqueue WhatsApp message with key ${dedupeKey}:`, error);
        }
    }
}


async function sendPushNotification(
    entityId: string,
    entityType: 'clients' | 'users',
    title: string,
    body: string,
    data: { [key: string]: string; }
) {
    if (!entityId) {
        functions.logger.warn(`No entity ID provided for ${entityType}, cannot send push notification.`);
        return;
    }
    
    const tokens = await getTokensForEntity(entityId, entityType);

    if (tokens.length === 0) {
        functions.logger.info(`No FCM tokens for ${entityType} ${entityId}.`);
        return;
    }
    
    const uniqueTokens = [...new Set(tokens)];

    const message: admin.messaging.MulticastMessage = {
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
        functions.logger.info(`Push notification sent to ${response.successCount} tokens for ${entityType} ${entityId}.`);

        const tokensToRemove: Promise<any>[] = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const errorCode = resp.error?.code;
                if (errorCode === 'messaging/invalid-registration-token' ||
                    errorCode === 'messaging/registration-token-not-registered') {
                    
                    const tokenToDelete = uniqueTokens[idx];
                    const deviceDocRef = db.collection(entityType).doc(entityId).collection('devices').doc(tokenToDelete);
                    tokensToRemove.push(deviceDocRef.delete());
                }
            }
        });

        if (tokensToRemove.length > 0) {
            await Promise.all(tokensToRemove);
            functions.logger.info(`Removed ${tokensToRemove.length} invalid FCM tokens for ${entityType} ${entityId}.`);
        }
    } catch (error) {
        functions.logger.error(`Error sending push notification multicast for ${entityType} ${entityId}:`, error);
    }
}


// --- Cloud Triggers ---

export const onAppointmentWritten = functions.firestore.document("/appointments/{appointmentId}")
    .onWrite(async (change, context) => {
        const appointmentId = context.params.appointmentId;
        const dataAfter = change.after.exists ? (change.after.data() as any) : undefined;
        const dataBefore = change.before.exists ? (change.before.data() as any) : undefined;

        // --- Logic for new PENDING appointments (notify admin via Push) ---
        if (!dataBefore && dataAfter && dataAfter.status === 'pending') {
            functions.logger.info(`New pending appointment detected: ${appointmentId}`);
            try {
                // Get all users with permission to approve appointments
                const usersSnapshot = await db.collection('users')
                    .where('permission', 'in', ['owner', 'developer', 'employee'])
                    .get();
                
                const userIdsToNotify: string[] = [];
                usersSnapshot.forEach(doc => {
                    const user = doc.data();
                    if (user.permission === 'owner' || user.permission === 'developer' || user.isSuperAdmin) {
                        userIdsToNotify.push(doc.id);
                    } else if (user.permission === 'employee' && user.employeePermissions?.canApproveAppointments) {
                        userIdsToNotify.push(doc.id);
                    }
                });

                const notificationPromises = userIdsToNotify.map(userId => 
                    sendPushNotification(
                        userId,
                        'users',
                        'בקשת תור חדשה',
                        `תור חדש ממתין לאישור מ: ${dataAfter.clientName}`,
                        { route: '/admin/appointments/pending' }
                    )
                );
                
                await Promise.all(notificationPromises);
                
            } catch (error) {
                functions.logger.error("Error sending push notification to admin:", error);
            }
        }
        
        const clientId = dataAfter?.clientId || dataBefore?.clientId;
        if (!clientId) {
            functions.logger.warn(`No client ID found for appointment ${appointmentId}. Skipping client notifications.`);
            return;
        }

        const clientName = dataAfter?.clientName ?? dataBefore?.clientName ?? 'לקוח/ה יקר/ה';
        const serviceName = dataAfter?.serviceName ?? dataBefore?.serviceName ?? 'השירות שלך';

        // --- Client Notification Logic ---

        // 1. Appointment Approved
        if (dataBefore?.status === 'pending' && dataAfter?.status === 'scheduled') {
            functions.logger.info(`Appointment ${appointmentId} approved. Enqueueing notifications.`);
            const title = 'התור שלך אושר!';
            const body = `היי ${clientName}, התור שלך ל${serviceName} נקבע בהצלחה ליום ${format(dataAfter.start.toDate(), 'eeee, d MMMM', { locale: he })} בשעה ${format(dataAfter.start.toDate(), 'HH:mm')}.`;
            const dedupeKey = `${appointmentId}_approved`;
            const variables = {
                '#clientName#': clientName,
                '#serviceName#': serviceName,
                '#date#': format(dataAfter.start.toDate(), 'eeee, d MMMM', { locale: he }),
                '#time#': format(dataAfter.start.toDate(), 'HH:mm'),
            };

            await sendPushNotification(clientId, 'clients', title, body, { route: '/my-appointments', appointmentId });
            await enqueueWhatsAppMessage(dedupeKey, 'appointmentApproved', variables, { clientId, title, body, data: { route: '/my-appointments', appointmentId } });
        }

        // 2. Appointment Rescheduled by Admin
        else if (dataBefore && dataAfter && dataBefore.start.toMillis() !== dataAfter.start.toMillis() && dataAfter.status === 'scheduled') {
            functions.logger.info(`Appointment ${appointmentId} rescheduled. Enqueueing notifications.`);
            const newTimeStr = format(dataAfter.start.toDate(), 'dd/MM/yy HH:mm', { locale: he });
            const title = 'התור שלך עודכן';
            const body = `היי ${clientName}, שימי לב, התור שלך עודכן לתאריך ${newTimeStr}.`;
            const dedupeKey = `${appointmentId}_rescheduled_${dataAfter.start.toMillis()}`;
            const variables = {
                '#clientName#': clientName,
                '#serviceName#': serviceName,
                '#date#': format(dataAfter.start.toDate(), 'dd/MM/yy'),
                '#time#': format(dataAfter.start.toDate(), 'HH:mm'),
            };
            
            await sendPushNotification(clientId, 'clients', title, body, { route: '/my-appointments', appointmentId });
            await enqueueWhatsAppMessage(dedupeKey, 'appointmentRescheduled', variables, { clientId, title, body, data: { route: '/my-appointments', appointmentId } });
        }
        
        // 3. Appointment Cancelled/Rejected by Admin
        else if (dataAfter?.status === 'cancelled' && dataBefore?.status !== 'cancelled') {
            functions.logger.info(`Appointment ${appointmentId} cancelled/rejected. Enqueueing notifications.`);
            
            const startTimestamp = dataBefore?.start ?? dataAfter?.start;
            const datePart = startTimestamp && typeof startTimestamp.toDate === "function"
                ? `בתאריך ${format(startTimestamp.toDate(), 'dd/MM/yyyy')}`
                : "שנקבע";

            const body = `היי ${clientName}, התור שלך ל${serviceName} ${datePart} בוטל.`;
            const title = 'התור שלך בוטל';
            const dedupeKey = `${appointmentId}_cancelled`;
            const variables = {
                '#clientName#': clientName,
                '#serviceName#': serviceName,
                '#date#': datePart,
            };
            
            await sendPushNotification(clientId, 'clients', title, body, { route: '/my-appointments', appointmentId });
            await enqueueWhatsAppMessage(dedupeKey, 'appointmentCancelled', variables, { clientId, title, body, data: { route: '/my-appointments', appointmentId } });
        }
    });


export const sendAppointmentReminders = functions.pubsub.schedule("every 1 hours").onRun(async (context) => {
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
        const appointment = doc.data() as any;

        if (appointment.clientId) {
            const appTime = format(appointment.start.toDate(), 'HH:mm', { locale: he });
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

            const pushPayload = { clientId: appointment.clientId, title, body, data: { route: '/my-appointments', appointmentId }};
            await sendPushNotification(pushPayload.clientId, 'clients', pushPayload.title, pushPayload.body, pushPayload.data);
            await enqueueWhatsAppMessage(dedupeKey, 'appointmentReminder24h', variables, pushPayload);
        }
    }
});


export const onWhatsAppJobFailed = functions.firestore.document('whatsapp_queue/{messageId}')
    .onUpdate(async (change, context) => {
        const dataAfter = change.after.data();
        const dataBefore = change.before.data();

        if (dataBefore.status !== 'failed' && dataAfter.status === 'failed') {
            functions.logger.warn(`WhatsApp message ${context.params.messageId} failed. Sending fallback push notification.`);
            
            const { pushPayload } = dataAfter;
            if (pushPayload && pushPayload.clientId) {
                await sendPushNotification(pushPayload.clientId, 'clients', pushPayload.title, pushPayload.body, pushPayload.data);
            } else {
                functions.logger.error(`Could not send fallback for ${context.params.messageId} due to missing pushPayload.`);
            }
        }
    });

export const requeueStuckJobs = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
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


export const onFormInstanceCreated = functions.firestore
    .document('formInstances/{instanceId}')
    .onCreate(async (snap, context) => {
        const instance = snap.data();
        if (!instance) {
            functions.logger.error("Form instance data is missing for id:", context.params.instanceId);
            return;
        }

        if (instance.status === 'pending_client_fill') {
            const clientId = instance.clientId;
            if (!clientId) {
                functions.logger.warn(`Missing clientId for form instance ${context.params.instanceId}.`);
                return;
            }

            const title = "מסמך חדש ממתין למילוי";
            const body = `נשלח אליך טופס למילוי: "${instance.templateName || 'טופס כללי'}".`;
            
            functions.logger.info(`New form instance ${context.params.instanceId} for client ${clientId}. Sending push notification.`);
            
            await sendPushNotification(clientId, 'clients', title, body, { route: '/my-documents' });
        }
    });


export const onNotificationCreated = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        if (!notification) {
            functions.logger.error("Notification data is missing.");
            return;
        }
        const { title, content } = notification;

        functions.logger.info(`New notification created: "${title}". Sending to all clients.`);

        const clientsSnapshot = await db.collection('clients').get();
        if (clientsSnapshot.empty) {
            functions.logger.info("No clients to send notification to.");
            return;
        }

        const promises = clientsSnapshot.docs.map(clientDoc => {
            const clientId = clientDoc.id;
            return sendPushNotification(clientId, 'clients', title, content, { route: '/dashboard' });
        });

        await Promise.all(promises);

        functions.logger.info(`Finished sending notification "${title}" to all clients.`);
    });


export const sendCommunicationReminders = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    functions.logger.info("Running communication reminder job.");
    const now = admin.firestore.Timestamp.now();
    
    const q = db.collection('reminders')
        .where('status', '==', 'pending')
        .where('notificationTime', '<=', now);

    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
        functions.logger.info("No due reminders found.");
        return null;
    }

    const batch = db.batch();

    for (const doc of querySnapshot.docs) {
        const reminder = doc.data() as any; 
        
        const title = `תזכורת: ${reminder.clientName}`;
        const body = reminder.summary;
        
        functions.logger.info(`Sending reminder for client ${reminder.clientName} to user ${reminder.userId}`);

        await sendPushNotification(
            reminder.userId,
            'users',
            title,
            body,
            { route: `/admin/clients/${reminder.clientId}` }
        );

        batch.update(doc.ref, { status: 'sent' });
    }

    await batch.commit();
    functions.logger.info(`Processed ${querySnapshot.size} reminders.`);
    return null;
});
