/* Ejecuta las tareas periódicas cada minuto llamando a /api/cron (para Docker/VPS). En Vercel usá vercel.json. */
const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/cron`;
const secret = process.env.CRON_SECRET || "";

async function tick() {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
    const body = await res.text();
    console.log(new Date().toISOString(), res.status, body.slice(0, 300));
  } catch (e) {
    console.error(new Date().toISOString(), "cron error", (e as Error).message);
  }
}

tick();
setInterval(tick, 60_000);
