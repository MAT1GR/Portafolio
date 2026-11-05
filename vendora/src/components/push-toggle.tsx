"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Activa las notificaciones push de ventas en este dispositivo (app instalable). */
export function PushToggle() {
  const [state, setState] = useState<"loading" | "unsupported" | "disabled" | "off" | "on" | "denied">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const cfg = await fetch("/api/push").then((r) => r.json());
      if (!cfg.enabled) return setState("disabled");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    setMsg(null);
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState("denied");
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await fetch("/api/push").then((r) => r.json());
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    if (!res.ok) return setMsg("No se pudo activar. Volvé a ingresar y probá de nuevo.");
    setState("on");
    await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true }) });
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
  };

  const text = {
    loading: "Comprobando…",
    unsupported: "Este navegador no admite notificaciones. En iPhone: Compartir → Agregar a inicio y abrí la app desde ahí.",
    disabled: "Las notificaciones no están configuradas en el servidor (faltan las claves VAPID).",
    denied: "Bloqueaste las notificaciones. Habilitalas en los ajustes del navegador.",
    off: "Recibí un aviso en este dispositivo por cada venta.",
    on: "Avisos de venta activos en este dispositivo.",
  }[state];

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">🔔 Avisos de venta</div>
          <p className="text-xs text-muted">{text}</p>
        </div>
        {state === "off" && (
          <button onClick={enable} className="btn btn-brand btn-sm">
            Activar
          </button>
        )}
        {state === "on" && (
          <button onClick={disable} className="btn btn-secondary btn-sm">
            Desactivar
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs text-bad">{msg}</p>}
    </div>
  );
}
