import './globals.css';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { AuthSessionProvider } from '../components/session-provider';
import { auth } from '../auth';

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/signin' as never);
  }

  return (
    <html lang="en">
      <body>
        <AuthSessionProvider session={session}>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
