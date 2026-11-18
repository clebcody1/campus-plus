"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes Campus Plus installable.
 * Renders nothing. Safe to mount once in the root layout.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing is not fatal — the site still works.
      });
    };

    // Wait for load so the worker never competes with the first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}