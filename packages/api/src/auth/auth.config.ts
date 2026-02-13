import type { AuthConfig } from '@auth/core';

export const authConfig: AuthConfig = {
  providers: [],
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
};

export const authProvidersNote = {
  google: 'Configure Google OAuth in production via Auth.js provider setup',
  email: 'Configure Email provider (SMTP) in production via Auth.js provider setup',
};
