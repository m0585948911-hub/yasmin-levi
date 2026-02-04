"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplate = getTemplate;
const templates = {
    appointmentApproved: "✨התור שלך אושר!✨\nהיי #clientName#, שמחנו לאשר את תורך עבור #serviceName# בתאריך #date# בשעה #time#.\nמצפים לראותך!\n\nיסמין - לגלות את היופי שבך\nרחוב ברנר 7, רחובות",
    appointmentRescheduled: "היי #clientName#, שימי לב, התור שלך עודכן!\nהתור שלך ל-#serviceName# עודכן לתאריך #date# בשעה #time#.",
    appointmentCancelled: "היי #clientName#, התור שלך ל#serviceName# בתאריך #date# בוטל. נשמח לראותך שוב בקרוב.",
    appointmentReminder24h: "היי #clientName#, תזכורת לקראת התור שלך מחר עבור #serviceName# בשעה #time#. מצפים לראותך!",
};
function getTemplate(key, variables) {
    let content = templates[key] || '';
    for (const [variable, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(variable, 'g'), value);
    }
    return content;
}
//# sourceMappingURL=whatsapp-templates.js.map