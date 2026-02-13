import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';

type AppRouter = AnyRouter;

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/trpc`,
    }),
  ],
});
