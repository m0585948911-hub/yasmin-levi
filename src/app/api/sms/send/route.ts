import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { to, message } = await req.json();

    if (!to || !message) {
      return NextResponse.json({ ok: false, error: 'missing_to_or_message' }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !from) {
      return NextResponse.json({ ok: false, error: 'missing_twilio_env' }, { status: 500 });
    }

    const normalizedTo = String(to).startsWith('+') ? String(to) : `+${String(to)}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const body = new URLSearchParams({
      To: normalizedTo,
      From: from,
      Body: message,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Twilio SMS error:', data);
      return NextResponse.json({ ok: false, error: data }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sid: data.sid });
  } catch (err) {
    console.error('SMS route error:', err);
    return NextResponse.json({ ok: false, error: 'sms_send_failed' }, { status: 500 });
  }
}
