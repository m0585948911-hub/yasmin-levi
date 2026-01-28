
'use client';

import { useState, useEffect } from 'react';
import { useAdminUser } from '@/hooks/use-admin-user';

function getGreeting(gender?: 'male' | 'female') {
  const hour = new Date().getHours();
  let greeting;
  
  if (gender === 'male') {
    if (hour < 12) greeting = "בוקר טוב";
    else if (hour < 18) greeting = "צהריים טובים";
    else if (hour < 22) greeting = "ערב טוב";
    else greeting = "לילה טוב";
  } else { // Default to female or unspecified
    if (hour < 12) greeting = "בוקר טוב";
    else if (hour < 18) greeting = "צהריים טובים";
    else if (hour < 22) greeting = "ערב טוב";
    else greeting = "לילה טוב";
  }


  return greeting;
}

export function Greeting() {
  const { user } = useAdminUser();
  const [greeting, setGreeting] = useState('');
  const [name, setName] = useState('מנהל/ת');

  useEffect(() => {
    if (user) {
        setName(user.firstName);
        setGreeting(getGreeting(user.gender));
    } else {
        setGreeting(getGreeting());
    }
  }, [user]);

  if (!greeting) {
    return null; 
  }

  return (
    <h1 className="text-3xl font-bold">
      {greeting}, {name}
    </h1>
  );
}
