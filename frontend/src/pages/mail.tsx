import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MailPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the static mail.html
    window.location.href = '/mail.html';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading Bheem Mail...</p>
      </div>
    </div>
  );
}
