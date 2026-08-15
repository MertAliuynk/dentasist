import { createTRPCReact } from "@trpc/react-query";
import type { PlatformAppRouter } from "@/server/trpc/platform-routers/_app";

export const platformTrpc = createTRPCReact<PlatformAppRouter>();
