(() => {
  const C = window.SKYLINE_CONFIG;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ---------------- Header ---------------- */
  const header = $(".site-header");
  const onScroll = () => header.classList.toggle("is-solid", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = $(".menu-toggle");
  const mobileMenu = $("#mobile-menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.hidden = !open;
    header.classList.toggle("is-solid", open || window.scrollY > 40);
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  $$("#mobile-menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  /* ---------------- Trust line, offer, contact ---------------- */
  const b = C.business;
  const trust = [];
  if (b.part107) trust.push("FAA Part 107 Certified");
  if (b.insured) trust.push("Fully Insured");
  trust.push(b.serviceArea);
  const trustLine = $("#trust-line");
  trust.forEach((t) => trustLine.append(el("li", null, t)));

  if (C.launchOffer?.enabled) {
    $("#offer-text").textContent = C.launchOffer.text;
    $("#offer-bar").hidden = false;
  }

  // Any blank field is skipped, so a placeholder never ships as if it were real.
  const contactLinks = (container) => {
    const nodes = [];
    if (b.email) {
      const email = el("a", null, b.email);
      email.href = `mailto:${b.email}`;
      nodes.push(email);
    }
    if (b.phone) {
      const phone = el("a", null, b.phone);
      phone.href = `tel:${b.phone.replace(/[^\d+]/g, "")}`;
      nodes.push(phone);
    }
    if (b.instagram) {
      const ig = el("a", null, `@${b.instagram}`);
      ig.href = `https://www.instagram.com/${b.instagram}/`;
      ig.target = "_blank";
      ig.rel = "noopener";
      nodes.push(ig);
    }
    if (b.serviceArea) nodes.push(el("span", null, b.serviceArea));
    container.append(...nodes);
  };
  contactLinks($("#contact-direct"));
  contactLinks($("#footer-contact"));
  $("#footer-tag").textContent = `${b.tagline}. Based in ${b.baseCity}.`;

  // Bottom bar: copyright + registered entity, owner, contact email.
  const legalBits = [`© ${new Date().getFullYear()} ${b.legalName || b.name}`];
  if (b.owner) legalBits.push(b.owner);
  if (b.email) legalBits.push(b.email);
  $("#footer-legal").textContent = legalBits.join(" · ");
  $("#footer-compliance").hidden = !b.part107;

  if (C.bookingUrl) {
    const link = $("#booking-link");
    link.href = C.bookingUrl;
    link.hidden = false;
  }

  /* ---------------- Hero reel ---------------- */
  const heroMedia = $("#hero-media");
  const progress = $("#reel-progress");
  const label = $("#reel-label");
  const reelToggle = $("#reel-toggle");
  const clips = C.heroReel.clips.slice();
  const bars = clips.map(() => {
    const i = el("i");
    i.append(el("b"));
    progress.append(i);
    return i.firstChild;
  });

  const placeholder = createCityFlyover($("#hero-placeholder"));
  const vids = [0, 1].map(() => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.preload = "auto";
    if (C.heroReel.poster) v.poster = C.heroReel.poster;
    heroMedia.append(v);
    return v;
  });

  let current = -1;
  let activeVid = 1;
  let paused = reducedMotion;
  let failed = new Set();
  let usingPlaceholder = false;
  let phStart = 0;
  let phElapsed = 0;
  const PH_DURATION = 7000;

  const setLabel = (i) => { label.textContent = clips[i]?.label || ""; };
  const setBars = (i, frac) => {
    bars.forEach((bar, k) => { bar.style.width = k < i ? "100%" : k === i ? `${Math.min(frac, 1) * 100}%` : "0%"; });
  };

  function nextClip() {
    if (failed.size >= clips.length) return startPlaceholderCycle();
    let n = current;
    for (let tries = 0; tries < clips.length; tries++) {
      n = (n + 1) % clips.length;
      if (!failed.has(n)) break;
    }
    playClip(n);
  }

  function playClip(i) {
    const incoming = vids[1 - activeVid];
    const outgoing = vids[activeVid];
    const onReady = () => {
      cleanup();
      delete incoming.dataset.advancing;
      current = i;
      activeVid = 1 - activeVid;
      setLabel(i);
      incoming.classList.add("is-visible");
      outgoing.classList.remove("is-visible");
      setTimeout(() => outgoing.pause(), 1500);
      placeholder.stop();
      if (!paused) incoming.play().catch(() => {});
    };
    const onError = () => {
      cleanup();
      failed.add(i);
      bars[i].parentElement.hidden = true;
      current = i;
      nextClip();
    };
    const cleanup = () => {
      incoming.removeEventListener("canplay", onReady);
      incoming.removeEventListener("error", onError);
    };
    incoming.addEventListener("canplay", onReady, { once: true });
    incoming.addEventListener("error", onError, { once: true });
    incoming.src = clips[i].src;
    incoming.currentTime = 0;
    incoming.load();
  }

  vids.forEach((v) => {
    v.addEventListener("timeupdate", () => {
      if (v !== vids[activeVid] || !v.duration || v.dataset.advancing) return;
      if (v.duration - v.currentTime < 1.1) {
        v.dataset.advancing = "1";
        nextClip();
      }
    });
  });

  function startPlaceholderCycle() {
    if (usingPlaceholder) return;
    usingPlaceholder = true;
    bars.forEach((bar) => { bar.parentElement.hidden = false; });
    current = 0;
    setLabel(0);
    phStart = performance.now();
    if (!paused) placeholder.start();
  }

  function tick(now) {
    if (usingPlaceholder) {
      const elapsed = paused ? phElapsed : phElapsed + (now - phStart);
      if (!paused && elapsed >= PH_DURATION) {
        current = (current + 1) % clips.length;
        setLabel(current);
        phElapsed = 0;
        phStart = now;
      }
      setBars(current, (paused ? phElapsed : phElapsed + (now - phStart)) / PH_DURATION);
    } else if (current >= 0) {
      const v = vids[activeVid];
      if (v.duration) setBars(current, v.currentTime / v.duration);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  reelToggle.addEventListener("click", () => {
    paused = !paused;
    reelToggle.classList.toggle("is-paused", paused);
    reelToggle.setAttribute("aria-label", paused ? "Play background video" : "Pause background video");
    if (usingPlaceholder) {
      if (paused) { phElapsed += performance.now() - phStart; placeholder.stop(); }
      else { phStart = performance.now(); placeholder.start(); }
    } else {
      const v = vids[activeVid];
      paused ? v.pause() : v.play().catch(() => {});
    }
  });
  reelToggle.classList.toggle("is-paused", paused);

  if (clips.length) nextClip();
  else startPlaceholderCycle();
  placeholder.drawStill();

  /* City-lights flyover drawn on canvas while real footage is missing */
  function createCityFlyover(canvas) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0, running = false, last = 0, z0 = 0;
    const lights = [];
    const ridge = [];
    const rand = mulberry32(7);
    for (let i = 0; i < 2600; i++) {
      const street = rand() < 0.75;
      const gx = Math.round((rand() - 0.5) * 60) * 2;
      lights.push({
        x: street ? gx + (rand() - 0.5) * 0.3 : (rand() - 0.5) * 120,
        z: rand() * 120,
        warm: rand() < 0.8,
        s: 0.6 + rand() * 1.2,
        tw: rand() * Math.PI * 2,
      });
    }
    for (let i = 0; i <= 160; i++) {
      const u = (i / 160) * Math.PI * 2;
      ridge.push(0.55 + 0.28 * Math.sin(u * 1.3 + 0.4) + 0.16 * Math.sin(u * 3.1 + 1.2) + 0.07 * Math.sin(u * 7.3 + 2.0) + 0.03 * Math.sin(u * 17 + 0.5));
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(0);
    };
    new ResizeObserver(resize).observe(canvas);

    function draw(t) {
      const horizon = h * 0.42;
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#070a14");
      sky.addColorStop(0.6, "#1b1a2c");
      sky.addColorStop(1, "#6b3f2a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon + 1);
      const glow = ctx.createRadialGradient(w * 0.7, horizon, 0, w * 0.7, horizon, w * 0.5);
      glow.addColorStop(0, "rgba(242,160,70,0.45)");
      glow.addColorStop(1, "rgba(242,160,70,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, horizon + 1);

      ctx.fillStyle = "#0b0b10";
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let i = 0; i <= 160; i++) ctx.lineTo((i / 160) * w, horizon - ridge[i] * Math.min(h * 0.11, w * 0.09));
      ctx.lineTo(w, horizon); ctx.closePath(); ctx.fill();

      const ground = ctx.createLinearGradient(0, horizon, 0, h);
      ground.addColorStop(0, "#0d0c10");
      ground.addColorStop(1, "#030304");
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, w, h - horizon);

      const f = w * 0.9;
      const camH = 6;
      for (const L of lights) {
        let z = (L.z - z0) % 120;
        if (z < 0) z += 120;
        z += 0.8;
        const sx = w * 0.5 + (L.x / z) * f * 0.25;
        const sy = horizon + (camH / z) * f * 0.12;
        if (sx < -10 || sx > w + 10 || sy > h + 10) continue;
        const fade = Math.min(1, z / 8) * Math.max(0, 1 - z / 120);
        const r = Math.min(2.6, Math.max(0.5, (L.s * 14) / z));
        const flick = 0.75 + 0.25 * Math.sin(t * 0.002 + L.tw);
        ctx.globalAlpha = fade * flick;
        ctx.fillStyle = L.warm ? "#ffc27a" : "#e8f0ff";
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      if (!running) return;
      const dt = Math.min(50, now - (last || now));
      last = now;
      z0 += dt * 0.0035;
      draw(now);
      raf = requestAnimationFrame(loop);
    }
    return {
      start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); },
      stop() { running = false; cancelAnimationFrame(raf); },
      drawStill() { resize(); },
    };
  }

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Gallery ---------------- */
  const gallery = $("#gallery");
  const phGradients = {
    realestate: ["#3a2a1f", "#c98a4a"],
    construction: ["#1f2530", "#6f7d8c"],
    business: ["#1c2626", "#4f8a82"],
    land: ["#1d2419", "#8c9a5b"],
  };
  C.photos.forEach((p, idx) => {
    const tile = el("button", `tile${p.tall ? " tall" : ""}`);
    tile.type = "button";
    tile.dataset.category = p.category;
    tile.setAttribute("aria-label", `View photo: ${p.alt}`);
    const img = new Image();
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = p.alt;
    img.onerror = () => {
      const [a, c] = phGradients[p.category] || ["#222", "#555"];
      const ph = el("div", "tile-ph");
      ph.style.background = `linear-gradient(${135 + idx * 17}deg, ${a}, ${c})`;
      ph.append(el("span", null, `Photo ${String(idx + 1).padStart(2, "0")}: ${p.alt}`));
      img.replaceWith(ph);
      tile.dataset.placeholder = "true";
    };
    img.src = p.src;
    tile.append(img, el("span", "tile-cap", p.alt));
    tile.addEventListener("click", () => {
      if (tile.dataset.placeholder) return;
      openLightbox(p.src, p.alt);
    });
    gallery.append(tile);
  });

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".chip").forEach((c) => { c.classList.remove("is-active"); c.setAttribute("aria-selected", "false"); });
      chip.classList.add("is-active");
      chip.setAttribute("aria-selected", "true");
      const f = chip.dataset.filter;
      $$(".tile", gallery).forEach((t) => t.classList.toggle("is-hidden", f !== "all" && t.dataset.category !== f));
    });
  });

  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightbox-img");
  let lastFocus = null;
  function openLightbox(src, alt) {
    lastFocus = document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightbox.hidden = false;
    $(".lightbox-close").focus();
  }
  const closeLightbox = () => { lightbox.hidden = true; lastFocus?.focus(); };
  lightbox.addEventListener("click", (e) => { if (e.target !== lightboxImg) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lightbox.hidden) closeLightbox(); });

  /* ---------------- Before / after ---------------- */
  const compare = $("#compare");
  const range = $("#compare-range");
  range.addEventListener("input", () => compare.style.setProperty("--pos", `${range.value}%`));
  $("#compare-before .compare-tag").textContent = C.compare.beforeLabel;
  $("#compare-after .compare-tag").textContent = C.compare.afterLabel;
  const setCompareImage = (node, src, fallbackSvg) => {
    const probe = new Image();
    probe.onload = () => { node.style.backgroundImage = `url("${src}")`; };
    probe.onerror = () => { node.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}")`; };
    probe.src = src;
  };
  setCompareImage($("#compare-before"), C.compare.before, groundSvg());
  setCompareImage($("#compare-after"), C.compare.after, aerialSvg());

  function groundSvg() {
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' preserveAspectRatio='xMidYMid slice'>
      <rect width='800' height='600' fill='#9aa0a6'/><rect y='330' width='800' height='270' fill='#6f6a63'/>
      <rect x='0' y='420' width='800' height='180' fill='#55524e'/>
      <rect x='230' y='210' width='340' height='170' fill='#b9b2a6'/><polygon points='210,215 400,120 590,215' fill='#5a5552'/>
      <rect x='270' y='260' width='70' height='60' fill='#6d7680'/><rect x='460' y='260' width='70' height='60' fill='#6d7680'/>
      <rect x='375' y='290' width='50' height='90' fill='#4a4038'/>
      <rect x='60' y='300' width='120' height='90' fill='#7b7f78'/><rect x='640' y='300' width='120' height='90' fill='#7f7a72'/>
      <rect x='90' y='380' width='60' height='40' fill='#3a3a3a'/><rect x='580' y='372' width='120' height='50' rx='10' fill='#2f3a44'/>
    </svg>`;
  }
  function aerialSvg() {
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' preserveAspectRatio='xMidYMid slice'>
      <defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1f2a44'/><stop offset='1' stop-color='#f0a35a'/></linearGradient>
      <linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#3c4a2e'/><stop offset='1' stop-color='#26301f'/></linearGradient></defs>
      <rect width='800' height='600' fill='url(#g)'/><rect width='800' height='150' fill='url(#s)'/>
      <polygon points='0,150 120,70 230,120 340,40 470,110 590,55 700,105 800,70 800,150' fill='#2a2f3a'/>
      <path d='M0 520 C200 470 420 560 800 480 L800 600 L0 600Z' fill='#2b2b2d'/>
      <g stroke='#f2b33d' stroke-width='3' stroke-dasharray='12 8' fill='none'><polygon points='250,230 590,215 620,450 220,470'/></g>
      <rect x='330' y='260' width='190' height='120' fill='#e6e1d8' transform='rotate(-4 425 320)'/>
      <rect x='330' y='260' width='190' height='40' fill='#4a4a50' transform='rotate(-4 425 320)'/>
      <rect x='450' y='395' width='110' height='45' rx='6' fill='#39b3d4' transform='rotate(-4 505 417)'/>
      <rect x='300' y='390' width='60' height='80' fill='#9c9892' transform='rotate(-4 330 430)'/>
      <g fill='#1f3a24'><circle cx='270' cy='250' r='24'/><circle cx='585' cy='250' r='20'/><circle cx='245' cy='430' r='22'/><circle cx='600' cy='440' r='26'/><circle cx='120' cy='300' r='30'/><circle cx='700' cy='330' r='28'/></g>
      <g fill='#ffcf8a' opacity='0.9'><rect x='350' y='318' width='30' height='12'/><rect x='400' y='315' width='30' height='12'/><rect x='455' y='312' width='30' height='12'/></g>
    </svg>`;
  }

  /* ---------------- Packages ---------------- */
  const packagesEl = $("#packages");
  C.packages.forEach((p) => {
    const card = el("article", `package reveal${p.featured ? " is-featured" : ""}`);
    if (p.featured) card.append(el("span", "package-badge", "Most Popular"));
    card.append(el("h3", null, p.name), el("p", "package-blurb", p.blurb));
    const price = el("p", "package-price", p.price);
    price.append(el("small", null, "per property"));
    card.append(price);
    const ul = el("ul");
    p.features.forEach((f) => ul.append(el("li", null, f)));
    card.append(ul);
    const cta = el("a", `btn ${p.featured ? "btn-accent" : "btn-outline"} btn-block`, `Book ${p.name}`);
    cta.href = "#book";
    cta.addEventListener("click", () => { preselect.value = p.name; });
    card.append(cta);
    packagesEl.append(card);
  });

  /* ---------------- Testimonials ---------------- */
  const tWrap = $("#testimonials");
  tWrap.closest("section").hidden = !C.testimonials.length;
  C.testimonials.forEach((t) => {
    const card = el("figure", "t-card reveal");
    card.append(el("div", "t-stars", "★★★★★"));
    const q = el("blockquote", null, `“${t.quote}”`);
    const who = el("figcaption", "t-who");
    who.append(el("strong", null, t.name), document.createTextNode(t.role));
    card.append(q, who);
    tWrap.append(card);
  });

  /* ---------------- About ---------------- */
  const a = C.about;
  $("#about-title").textContent = `Hi, I'm ${a.name.split(" ")[0]}.`;
  $("#about-role").textContent = a.role;
  a.bio.forEach((p) => $("#about-bio").append(el("p", null, p)));
  a.credentials
    .filter((c) => (b.part107 || !/part 107/i.test(c)) && (b.insured || !/insured/i.test(c)))
    .forEach((c) => $("#about-badges").append(el("li", null, c)));
  const aboutImg = new Image();
  aboutImg.alt = `${a.name}, ${a.role}`;
  aboutImg.onload = () => { $("#about-photo").replaceChildren(aboutImg); };
  aboutImg.src = a.photo;

  /* ---------------- FAQ ---------------- */
  const faqList = $("#faq-list");
  // An FAQ that asserts a credential only shows while that credential's toggle is on.
  C.faqs.filter((f) => (f.requires || []).every((k) => b[k])).forEach((f, i) => {
    const d = el("details", "faq-item reveal");
    if (i === 0) d.open = true;
    d.append(el("summary", null, f.q), el("p", null, f.a));
    faqList.append(d);
  });

  /* ---------------- Booking form ---------------- */
  const form = $("#book-form");
  const steps = $$(".form-step", form);
  const errorEl = $("#form-error");
  const preselect = document.createElement("input");
  preselect.type = "hidden";
  preselect.name = "package";
  form.append(preselect);

  const showStep = (name) => {
    steps.forEach((s) => s.classList.toggle("is-active", s.dataset.step === name));
    errorEl.hidden = true;
  };
  $("[data-next]", form).addEventListener("click", () => {
    showStep("2");
    $('input[name="name"]', form).focus();
  });
  $("[data-back]", form).addEventListener("click", () => showStep("1"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get("company_website")) return;
    const name = $('input[name="name"]', form);
    const email = $('input[name="email"]', form);
    let ok = true;
    [name, email].forEach((i) => {
      const valid = i.value.trim() && (i.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.value.trim()));
      i.classList.toggle("is-invalid", !valid);
      if (!valid) ok = false;
    });
    if (!ok) {
      errorEl.textContent = "Please add your name and a valid email so I can reply.";
      errorEl.hidden = false;
      return;
    }
    const services = data.getAll("service").join(", ") || "Not specified";
    const submitBtn = $('button[type="submit"]', form);
    submitBtn.disabled = true;

    if (C.formEndpoint) {
      try {
        data.set("services", services);
        const res = await fetch(C.formEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        showStep("done");
      } catch {
        errorEl.textContent = `Something went wrong. Email me directly at ${b.email}.`;
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
      return;
    }

    const body = [
      `Name: ${name.value.trim()}`,
      `Email: ${email.value.trim()}`,
      `Phone: ${data.get("phone") || "-"}`,
      `Property city: ${data.get("city") || "-"}`,
      `Interested in: ${services}`,
      data.get("package") ? `Package: ${data.get("package")}` : "",
      "",
      String(data.get("message") || ""),
    ].filter((l) => l !== null).join("\n");
    window.location.href = `mailto:${b.email}?subject=${encodeURIComponent("Free consult request — " + name.value.trim())}&body=${encodeURIComponent(body)}`;
    submitBtn.disabled = false;
    showStep("done");
  });

  /* ---------------- Sticky mobile CTA ---------------- */
  const sticky = $("#sticky-cta");
  const hero = $(".hero");
  const book = $("#book");
  let heroVisible = true, bookVisible = false;
  const updateSticky = () => sticky.classList.toggle("is-visible", !heroVisible && !bookVisible);
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; updateSticky(); }, { threshold: 0.15 }).observe(hero);
  new IntersectionObserver(([e]) => { bookVisible = e.isIntersecting; updateSticky(); }, { threshold: 0.05 }).observe(book);

  /* ---------------- Reveal on scroll ---------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  const observeReveals = () => $$(".reveal:not(.is-in)").forEach((n, i) => {
    n.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
    io.observe(n);
  });
  observeReveals();
})();
