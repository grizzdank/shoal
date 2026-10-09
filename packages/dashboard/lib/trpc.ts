import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';
import { getSession } from 'next-auth/react';

type AppRouter = AnyRouter;

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/trpc`,
      headers: async () => {
        const session = await getSession();
        const userId = session?.user?.email;
        const userRole = (session?.user as { role?: string } | undefined)?.role;
        return {
          ...(userId ? { 'x-shoal-user-id': userId } : {}),
          ...(userRole ? { 'x-shoal-user-role': userRole } : {}),
        };
      },
    }),
  ],
});
