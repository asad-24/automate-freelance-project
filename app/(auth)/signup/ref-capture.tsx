"use client";
import * as React from "react";

/**
 * Captures ?ref=CODE referral params into localStorage so signups arriving
 * through a referral link can be attributed back to the referrer.
 */
export function RefCapture() {
  React.useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      try {
        localStorage.setItem("autopilot-ref", ref);
      } catch {
        /* storage unavailable */
      }
    }
  }, []);
  return null;
}
