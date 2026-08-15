import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { platformAppRouter } from "@/server/trpc/platform-routers/_app";
import { createPlatformTRPCContext } from "@/server/trpc/platform-context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/platform-trpc",
    req,
    router: platformAppRouter,
    createContext: createPlatformTRPCContext,
  });

export { handler as GET, handler as POST };
