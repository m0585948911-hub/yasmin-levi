import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = 'http://35.193.216.250:8080';

export async function GET() {
 try{
   const response = await fetch(
      `${WHATSAPP_SERVICE_URL}/status`,
      {cache:'no-store'}
   );

   const data=await response.json();

   return NextResponse.json(
      data,
      {status:response.status}
   );

 }catch(e){
   return NextResponse.json({
      ok:false,
      ready:false,
      status:'disconnected'
   });
 }
}
