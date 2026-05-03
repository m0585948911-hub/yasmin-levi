export async function sendSMS(to: string, message: string) {
  try {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
    });

    if (!res.ok) throw new Error('SMS failed');

    return { ok: true };
  } catch (err) {
    console.error('SMS ERROR:', err);
    return { ok: false };
  }
}
