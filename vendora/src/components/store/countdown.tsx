"use client";

import { useEffect, useState } from "react";

export function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Cuenta regresiva hasta una fecha fija. onEnd se llama una vez al llegar a cero. */
export function Countdown({ endsAt, template = "{timer}", onEnd, className }: { endsAt: number; template?: string; onEnd?: () => void; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = endsAt - now;
  useEffect(() => {
    if (left <= 0) onEnd?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 0]);
  const [before, after] = template.split("{timer}");
  return (
    <span className={className}>
      {before}
      <b className="tabular-nums">{format(left)}</b>
      {after ?? ""}
    </span>
  );
}

/** Cuenta regresiva de sesión (checkout): arranca al entrar y se guarda en sessionStorage. */
export function SessionCountdown({ id, minutes, template }: { id: string; minutes: number; template: string }) {
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    const key = `vd_cd_${id}`;
    let v = 0;
    try {
      v = Number(sessionStorage.getItem(key)) || 0;
    } catch {
      v = 0;
    }
    if (!v || v < Date.now()) {
      v = Date.now() + minutes * 60_000;
      try {
        sessionStorage.setItem(key, String(v));
      } catch {
        /* sin almacenamiento */
      }
    }
    setEnd(v);
  }, [id, minutes]);
  if (!end) return null;
  return <Countdown endsAt={end} template={template} />;
}

/** Barra "N personas mirando" (opcional, configurable por el vendedor). */
export function SocialProof({ min, max, template }: { min: number; max: number; template: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const lo = Math.max(1, Math.min(min, max));
    const hi = Math.max(lo, max);
    const pick = () => setN(lo + Math.floor(Math.random() * (hi - lo + 1)));
    pick();
    const t = setInterval(pick, 25_000);
    return () => clearInterval(t);
  }, [min, max]);
  if (n === null) return null;
  return <span>{template.replace("{n}", String(n))}</span>;
}
