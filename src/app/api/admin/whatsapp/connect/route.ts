import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL =
 process.env.WHATSAPP_SERVICE_URL || 'http://localhost:8080';

export async function POST(req: Request) {
 try {
   const body = await req.json();

   const response = await fetch(
     `${WHATSAPP_SERVICE_URL}/connect`,
     {
       method:'POST',
       headers:{'Content-Type':'application/json'},
       body: JSON.stringify(body),
       cache:'no-store'
     }
   );

   const data = await response.json();
   return NextResponse.json(data,{status:response.status});

 } catch(e){
   return NextResponse.json(
     {error:'connect failed'},
     {status:500}
   );
 }
}
