'use client';

import dynamic from 'next/dynamic';

const PushNotificationHandler = dynamic(
  () => import('@/components/PushNotificationHandler'),
  { ssr: false }
);

export default function PushNotificationHandlerWrapper() {
  return <PushNotificationHandler />;
}
