'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FamilyManagerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/family-manager/families');
  }, [router]);

  return null;
}
