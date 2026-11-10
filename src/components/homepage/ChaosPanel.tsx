"use client";

import { useEffect, useRef } from "react";
import { Bookmark, FileText, PanelsTopLeft, Terminal } from "lucide-react";

const tiles = [
  { icon: <b>N</b>, style: "left-[12%] top-[12%] text-white", vx: 9, vy: -7 },
  { icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.61-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.6 9.6 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>, style: "left-[63%] top-[9%] text-slate-200", vx: -8, vy: 12 },
  { icon: <svg viewBox="0 0 32 32" fill="none" strokeWidth="5" strokeLinecap="round"><path stroke="#36c5f0" d="M4 12h9M12 4v1" /><path stroke="#2eb67d" d="M20 4v9M28 12h-1" /><path stroke="#ecb22e" d="M28 20h-9M20 28v-1" /><path stroke="#e01e5a" d="M12 28v-9M4 20h1" /></svg>, style: "left-[39%] top-[32%] text-pink-400", vx: 7, vy: 9 },
  { icon: <svg viewBox="0 0 32 32" fill="currentColor"><path d="m23 2 7 3v22l-7 3L9 19l-6 5-3-2V10l3-2 6 5L23 2Zm0 8-9 6 9 6V10ZM3 13v6l4-3-4-3Z" /></svg>, style: "right-[6%] top-[39%] text-sky-400", vx: -12, vy: -7 },
  { icon: <PanelsTopLeft />, style: "left-[6%] top-[54%] text-indigo-300", vx: 9, vy: 6 },
  { icon: <Terminal />, style: "left-[53%] top-[65%] text-emerald-400", vx: -9, vy: -9 },
  { icon: <FileText />, style: "left-[27%] top-[65%] text-slate-300", vx: -8, vy: 10 },
  { icon: <Bookmark />, style: "right-[4%] top-[66%] text-amber-300", vx: -12, vy: 5 },
];

export function ChaosPanel() {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const icons = Array.from(panel.querySelectorAll<HTMLElement>("[data-floating-tile]"), (element, index) => ({
      element,
      x: element.offsetLeft,
      y: element.offsetTop,
      vx: tiles[index].vx,
      vy: tiles[index].vy,
      phase: index * 1.7,
    }));
    let frame = 0;
    let previousTime = 0;
    let inView = false;
    let width = 0;
    let height = 0;
    const pointer = { x: -Infinity, y: -Infinity };
    const radius = 28.5;
    const maxSpeed = 24;

    function animate(time: number) {
      const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.04) : 0;
      previousTime = time;

      for (const icon of icons) {
        const dx = icon.x + radius - pointer.x;
        const dy = icon.y + radius - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < 110) {
          const force = (1 - distance / 110) * 85 * delta;
          icon.vx += dx / distance * force;
          icon.vy += dy / distance * force;
        }

        icon.vx += Math.sin(time / 3000 + icon.phase) * delta * 3;
        icon.vy += Math.cos(time / 3500 + icon.phase) * delta * 3;
        const speed = Math.hypot(icon.vx, icon.vy);
        if (speed > maxSpeed) {
          icon.vx *= maxSpeed / speed;
          icon.vy *= maxSpeed / speed;
        }

        icon.x += icon.vx * delta;
        icon.y += icon.vy * delta;
        if (icon.x < 6 || icon.x > width) icon.vx *= -1;
        if (icon.y < 6 || icon.y > height) icon.vy *= -1;
        icon.x = Math.max(6, Math.min(width, icon.x));
        icon.y = Math.max(6, Math.min(height, icon.y));

        const rotation = Math.sin(time / 2200 + icon.phase) * 12;
        const scale = 0.96 + Math.sin(time / 1700 + icon.phase) * 0.04;
        icon.element.style.transform = `translate(${icon.x}px, ${icon.y}px) rotate(${rotation}deg) scale(${scale})`;
      }
      frame = requestAnimationFrame(animate);
    }

    function syncAnimation() {
      cancelAnimationFrame(frame);
      previousTime = 0;
      if (motion.matches) {
        for (const { element } of icons) {
          element.removeAttribute("style");
        }
      } else if (inView && !document.hidden) {
        for (const { element } of icons) {
          element.style.inset = "0 auto auto 0";
        }
        frame = requestAnimationFrame(animate);
      }
    }

    function resetPointer() {
      pointer.x = -Infinity;
      pointer.y = -Infinity;
    }

    const resizeObserver = new ResizeObserver(() => {
      width = Math.max(6, panel.clientWidth - 63);
      height = Math.max(6, panel.clientHeight - 93);
    });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      resetPointer();
      syncAnimation();
    });

    function movePointer(event: PointerEvent) {
      if (event.pointerType === "touch" || !panel) return;
      const bounds = panel.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
    }

    resizeObserver.observe(panel);
    visibilityObserver.observe(panel);
    panel.addEventListener("pointermove", movePointer);
    panel.addEventListener("pointerleave", resetPointer);
    motion.addEventListener("change", syncAnimation);
    document.addEventListener("visibilitychange", syncAnimation);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      panel.removeEventListener("pointermove", movePointer);
      panel.removeEventListener("pointerleave", resetPointer);
      motion.removeEventListener("change", syncAnimation);
      document.removeEventListener("visibilitychange", syncAnimation);
      for (const { element } of icons) {
        element.removeAttribute("style");
      }
    };
  }, []);

  return (
    <div ref={panelRef} className="relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0e101a] bg-[radial-gradient(#28324c_1px,transparent_1px)] bg-size-[19px_19px] lg:h-87">
      <p className="absolute inset-x-2 bottom-3 text-center font-mono text-xs text-slate-400">“Where did I save that again?”</p>
      {tiles.map(({ icon, style }) => (
        <span key={style} data-floating-tile aria-hidden="true" className={`absolute grid size-[57px] place-items-center rounded-2xl border border-white/15 bg-[#171b2c] text-2xl shadow-xl [&_svg]:size-7 ${style}`}>
          {icon}
        </span>
      ))}
    </div>
  );
}
