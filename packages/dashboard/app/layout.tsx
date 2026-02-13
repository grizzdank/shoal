import './globals.css';
import type { ReactNode } from 'react';
import { Sidebar } from '../components/sidebar';
import { AuthSessionProvider } from '../components/session-provider';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthSessionProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
