"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query-client";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { platformTrpc } from "@/lib/platform-trpc/client";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function PlatformTRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(() =>
    platformTrpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/platform-trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <platformTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </platformTrpc.Provider>
  );
}
