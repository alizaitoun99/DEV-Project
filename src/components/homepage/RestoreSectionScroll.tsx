"use client";

import { useEffect } from "react";

const sectionHashes = new Set(["#features", "#pricing", "#ai", "#preview"]);

export function RestoreSectionScroll() {
  useEffect(() => {
    let frame = 0;

    function restoreSection() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { hash } = window.location;
        // Chrome can restore the hash but leave the homepage at the top.
        if (window.scrollY === 0 && sectionHashes.has(hash)) {
          document.getElementById(hash.slice(1))?.scrollIntoView();
        }
      });
    }

    restoreSection();
    window.addEventListener("pageshow", restoreSection);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", restoreSection);
    };
  }, []);

  return null;
}
