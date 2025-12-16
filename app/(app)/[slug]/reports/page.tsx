'use client';

import { Suspense } from 'react';
import Reports from '@/src/components/Reports';

function ReportsPageContent() {
  return <Reports />;
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p>Loading reports...</p>
          </div>
        </div>
      }
    >
      <ReportsPageContent />
    </Suspense>
  );
}
