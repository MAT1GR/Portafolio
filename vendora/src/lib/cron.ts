import { db } from "./db";
import { runRecovery } from "./recovery";
import { runBilling } from "./billing";
import { refreshRates } from "./fx";
import { processQueuedAiJobs } from "./ai-jobs";

/** Tareas periódicas. Se ejecutan desde /api/cron (Vercel Cron, cron del sistema o `npm run worker`). */
export async function runCron(now = new Date()) {
  const result: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      result[name] = await fn();
    } catch (e) {
      result[name] = { error: (e as Error).message };
    }
  };
  await step("recovery", () => runRecovery(now));
  await step("billing", () => runBilling(now));
  await step("aiJobs", () => processQueuedAiJobs());
  if (now.getUTCMinutes() < 5) await step("fx", () => refreshRates());
  await step("cleanup", async () => {
    const [sessions, tokens, resets] = await Promise.all([
      db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.buyerLoginToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } }),
      db.passwordReset.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } }),
    ]);
    return { sessions: sessions.count, tokens: tokens.count, resets: resets.count };
  });
  return result;
}
