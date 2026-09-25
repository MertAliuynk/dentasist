// Runs once per server process at startup (Next.js instrumentation hook).
// Hosts the automatic SMS reminder loop — the app is deployed as a single
// long-lived container, so an in-process interval is enough; the claim in
// runDueReminders keeps it safe even if more instances are ever added.
// Set SMS_REMINDER_WORKER=off to disable (e.g. on a secondary instance).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SMS_REMINDER_WORKER === "off") return;
  const { startReminderWorker } = await import("@/server/sms/reminders");
  startReminderWorker();
}
