import { NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = 'https://whatsapp-service-90023766755.us-central1.run.app';

export async function POST() {
 try{
   const response=await fetch(
      `${WHATSAPP_SERVICE_URL}/logout`,
      {
        method:'POST',
        cache:'no-store'
      }
   );

   const data=await response.json();

   return NextResponse.json(
      data,
      {status:response.status}
   );

 }catch(e){
   return NextResponse.json(
      {error:'logout failed'},
      {status:500}
   );
 }
}
