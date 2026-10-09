import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

const providers: NextAuthConfig['providers'] = [];

if (
  process.env.AUTH_GOOGLE_CLIENT_ID &&
  process.env.AUTH_GOOGLE_CLIENT_SECRET
) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    async jwt({ token }) {
      if (!token.role) {
        token.role = 'admin';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role =
          typeof token.role === 'string' ? token.role : 'admin';
      }
      return session;
    },
  },
};
