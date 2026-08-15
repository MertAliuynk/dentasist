import { router } from "@/server/trpc/trpc";
import { labKlinikRouter } from "@/server/trpc/routers/lab/klinik";
import { labStaffRouter } from "@/server/trpc/routers/lab/staff";
import { labPatientRouter } from "@/server/trpc/routers/lab/labPatient";
import { labTreatmentRouter } from "@/server/trpc/routers/lab/labTreatment";
import { labFeedbackRouter } from "@/server/trpc/routers/lab/labFeedback";
import { labNotificationRouter } from "@/server/trpc/routers/lab/labNotification";
import {
  labTreatmentTypeRouter,
  labStageCatalogRouter,
  toothColorRouter,
  labExpenseCategoryRouter,
} from "@/server/trpc/routers/lab/labCatalog";
import { labCashRouter } from "@/server/trpc/routers/lab/labCash";
import { labReportsRouter } from "@/server/trpc/routers/lab/labReports";

export const labRouter = router({
  klinik: labKlinikRouter,
  staff: labStaffRouter,
  patient: labPatientRouter,
  treatment: labTreatmentRouter,
  feedback: labFeedbackRouter,
  notification: labNotificationRouter,
  treatmentType: labTreatmentTypeRouter,
  stageCatalog: labStageCatalogRouter,
  toothColor: toothColorRouter,
  expenseCategory: labExpenseCategoryRouter,
  cash: labCashRouter,
  reports: labReportsRouter,
});
