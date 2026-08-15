import { platformRouter } from "@/server/trpc/platform-trpc";
import { platformOrganizationRouter } from "@/server/trpc/platform-routers/organization";
import { platformStaffRouter } from "@/server/trpc/platform-routers/staff";
import { platformGrantRouter } from "@/server/trpc/platform-routers/grant";
import { platformAuditLogRouter } from "@/server/trpc/platform-routers/auditLog";
import { platformPlanRouter } from "@/server/trpc/platform-routers/plan";
import { platformSupportTicketRouter } from "@/server/trpc/platform-routers/supportTicket";
import { platformDiscountCodeRouter } from "@/server/trpc/platform-routers/discountCode";

export const platformAppRouter = platformRouter({
  organization: platformOrganizationRouter,
  staff: platformStaffRouter,
  grant: platformGrantRouter,
  auditLog: platformAuditLogRouter,
  plan: platformPlanRouter,
  supportTicket: platformSupportTicketRouter,
  discountCode: platformDiscountCodeRouter,
});

export type PlatformAppRouter = typeof platformAppRouter;
