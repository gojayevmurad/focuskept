"use client";
import { useEffect } from "react";

/**
 * Marks <html data-hydrated> once React has hydrated the page. Browser tests
 * wait for it so a click can't land before the handlers are attached.
 */
export function HydrationMark() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "";
  }, []);
  return null;
}
