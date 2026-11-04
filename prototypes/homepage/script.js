(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const navbar = document.querySelector(".navbar");
  const updateNavbar = () => navbar.classList.toggle("scrolled", window.scrollY > 20);
  window.addEventListener("scroll", updateNavbar, { passive: true });
  updateNavbar();
  document.querySelector("#year").textContent = String(new Date().getFullYear());

  const billingButtons = document.querySelectorAll("[data-billing]");
  billingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const yearly = button.dataset.billing === "yearly";
      billingButtons.forEach((option) => {
        const selected = option === button;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      document.querySelector("#pro-amount").textContent = yearly ? "$72" : "$8";
      document.querySelector("#pro-period").textContent = yearly ? "/ year" : "/ month";
      document.querySelector("#billing-note").textContent = yearly
        ? "$6/month, billed yearly. Save $24 a year."
        : "Billed monthly. Cancel anytime.";
    });
  });

  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    document.documentElement.classList.add("motion-enabled");
  }

  const panel = document.querySelector(".chaos-panel");
  const positions = [[0.14, 0.15], [0.64, 0.12], [0.42, 0.4], [0.79, 0.48],
    [0.09, 0.63], [0.58, 0.76], [0.31, 0.77], [0.84, 0.78]];
  let width = 0;
  let height = 0;
  let previousTime = 0;
  let frame = 0;
  let inView = true;
  const pointer = { x: -1000, y: -1000 };
  const icons = Array.from(panel.querySelectorAll(".floating-icon"), (element, index) => ({
    element, x: 0, y: 0, vx: (Math.random() - 0.5) * 23,
    vy: (Math.random() - 0.5) * 23, phase: index * 1.7,
  }));

  function render(icon, time) {
    const rotation = reducedMotion.matches ? 0 : Math.sin(time / 2200 + icon.phase) * 12;
    const scale = reducedMotion.matches ? 1 : 0.96 + Math.sin(time / 1700 + icon.phase) * 0.04;
    icon.element.style.transform = `translate(${icon.x}px, ${icon.y}px) rotate(${rotation}deg) scale(${scale})`;
  }

  function resize() {
    width = Math.max(0, panel.clientWidth - 61);
    height = Math.max(0, panel.clientHeight - 78);
    icons.forEach((icon, index) => {
      icon.x = 6 + positions[index][0] * width;
      icon.y = 6 + positions[index][1] * height;
      render(icon, 0);
    });
  }

  function animate(time) {
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.04) : 0;
    previousTime = time;
    icons.forEach((icon) => {
      const dx = icon.x + 24 - pointer.x;
      const dy = icon.y + 24 - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 110 && distance > 0) {
        const force = (1 - distance / 110) * 200 * delta;
        icon.vx += dx / distance * force;
        icon.vy += dy / distance * force;
      }
      icon.vx += Math.sin(time / 3000 + icon.phase) * delta * 3;
      icon.vy += Math.cos(time / 3500 + icon.phase) * delta * 3;
      const speed = Math.hypot(icon.vx, icon.vy);
      if (speed > 45) { icon.vx *= 45 / speed; icon.vy *= 45 / speed; }
      icon.x += icon.vx * delta;
      icon.y += icon.vy * delta;
      if (icon.x < 6 || icon.x > width) icon.vx *= -1;
      if (icon.y < 6 || icon.y > height) icon.vy *= -1;
      icon.x = Math.max(6, Math.min(width, icon.x));
      icon.y = Math.max(6, Math.min(height, icon.y));
      render(icon, time);
    });
    frame = requestAnimationFrame(animate);
  }

  function syncAnimation() {
    cancelAnimationFrame(frame);
    previousTime = 0;
    if (!reducedMotion.matches && !document.hidden && inView) {
      frame = requestAnimationFrame(animate);
    } else {
      icons.forEach((icon) => render(icon, 0));
    }
  }

  panel.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const bounds = panel.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
  });
  panel.addEventListener("pointerleave", () => { pointer.x = -1000; pointer.y = -1000; });
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", syncAnimation);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
    }
    syncAnimation();
  });
  if ("IntersectionObserver" in window) {
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncAnimation();
    });
    visibilityObserver.observe(panel);
  }
  resize();
  syncAnimation();
})();
