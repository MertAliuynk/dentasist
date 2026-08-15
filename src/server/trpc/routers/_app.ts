import { router } from "@/server/trpc/trpc";
import { planRouter } from "@/server/trpc/routers/plan";
import { signupRouter } from "@/server/trpc/routers/signup";
import { userRouter } from "@/server/trpc/routers/user";
import { branchRouter } from "@/server/trpc/routers/branch";
import { doctorRouter } from "@/server/trpc/routers/doctor";
import { expenseCategoryRouter } from "@/server/trpc/routers/expenseCategory";
import { treatmentTypeRouter } from "@/server/trpc/routers/treatmentType";
import { treatmentCategoryRouter } from "@/server/trpc/routers/treatmentCategory";
import { favoriteTreatmentTypeRouter } from "@/server/trpc/routers/favoriteTreatmentType";
import { roomRouter } from "@/server/trpc/routers/room";
import { patientRouter } from "@/server/trpc/routers/patient";
import { appointmentRouter } from "@/server/trpc/routers/appointment";
import { appointmentBlockRouter } from "@/server/trpc/routers/appointmentBlock";
import { treatmentRouter } from "@/server/trpc/routers/treatment";
import { patientNoteRouter } from "@/server/trpc/routers/patientNote";
import { followUpRouter } from "@/server/trpc/routers/followUp";
import { reportsDentalRouter } from "@/server/trpc/routers/reportsDental";
import { cashRegisterRouter } from "@/server/trpc/routers/cashRegister";
import { paymentPlanRouter } from "@/server/trpc/routers/paymentPlan";
import { reportsMuhasebeRouter } from "@/server/trpc/routers/reportsMuhasebe";
import { staffAdminRouter } from "@/server/trpc/routers/staffAdmin";
import { organizationRouter } from "@/server/trpc/routers/organization";
import { auditLogRouter } from "@/server/trpc/routers/auditLog";
import { supportTicketRouter } from "@/server/trpc/routers/supportTicket";
import { labRouter } from "@/server/trpc/routers/lab";
import { stockRouter } from "@/server/trpc/routers/stock";
import { messageTemplateRouter } from "@/server/trpc/routers/messageTemplate";
import { patientConsentFormRouter } from "@/server/trpc/routers/patientConsentForm";

export const appRouter = router({
  plan: planRouter,
  signup: signupRouter,
  user: userRouter,
  branch: branchRouter,
  doctor: doctorRouter,
  expenseCategory: expenseCategoryRouter,
  treatmentType: treatmentTypeRouter,
  treatmentCategory: treatmentCategoryRouter,
  favoriteTreatmentType: favoriteTreatmentTypeRouter,
  room: roomRouter,
  patient: patientRouter,
  appointment: appointmentRouter,
  appointmentBlock: appointmentBlockRouter,
  treatment: treatmentRouter,
  patientNote: patientNoteRouter,
  followUp: followUpRouter,
  reportsDental: reportsDentalRouter,
  cashRegister: cashRegisterRouter,
  paymentPlan: paymentPlanRouter,
  reportsMuhasebe: reportsMuhasebeRouter,
  staffAdmin: staffAdminRouter,
  lab: labRouter,
  stock: stockRouter,
  messageTemplate: messageTemplateRouter,
  patientConsentForm: patientConsentFormRouter,
  organization: organizationRouter,
  auditLog: auditLogRouter,
  supportTicket: supportTicketRouter,
});

export type AppRouter = typeof appRouter;
