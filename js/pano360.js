import * as THREE from "three";

const items = window.SKYLINE_CONFIG.pano360 || [];
const pano = document.getElementById("pano");

// No real 360 footage shot yet -- hide the whole section rather than show the
// procedural placeholder sphere as if it were a real tour. Remove this guard
// (and the `pano360: []` override in config.js) once real clips are in.
if (!items.length) {
  document.getElementById("experience")?.setAttribute("hidden", "");
  // Also hide every nav link / CTA that points at the now-hidden section
  // (desktop nav, mobile nav, hero CTA, footer) so nothing links to a dead anchor.
  document.querySelectorAll('a[href="#experience"]').forEach((a) => { a.hidden = true; });
}
const mount = document.getElementById("pano-canvas");
const startBtn = document.getElementById("pano-start");
const hint = document.getElementById("pano-hint");
const list = document.getElementById("pano-list");
const playBtn = document.getElementById("pano-play");
const muteBtn = document.getElementById("pano-mute");
const gyroBtn = document.getElementById("pano-gyro");
const fullBtn = document.getElementById("pano-full");
const nowLabel = document.getElementById("pano-now");

let renderer, scene, camera, sphereMat, placeholderTex;
let video = null, videoTex = null;
let active = 0;
let live = false;
let lon = 0, lat = 0, yawOffset = 0;
let dragging = false, lastInteraction = 0;
let gyroOn = false, deviceQuat = null;
const pointers = new Map();
let pinchStart = 0, fovStart = 75;

items.forEach((item, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `pano-item${i === 0 ? " is-active" : ""}`;
  btn.setAttribute("role", "listitem");
  const strong = document.createElement("strong");
  strong.textContent = item.title;
  const span = document.createElement("span");
  span.textContent = item.location;
  btn.append(strong, span);
  btn.addEventListener("click", () => {
    select(i);
    if (!live) enterLive();
    pano.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  list.append(btn);
});
if (items.length < 2) list.hidden = true;

mount.style.touchAction = "pan-y";

new IntersectionObserver(([e], obs) => {
  if (!e.isIntersecting) return;
  init();
  obs.disconnect();
}, { rootMargin: "300px" }).observe(pano);

let visible = false;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(pano);

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.append(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
  const geo = new THREE.SphereGeometry(500, 64, 40);
  geo.scale(-1, 1, 1);
  placeholderTex = new THREE.CanvasTexture(buildPlaceholderPanorama());
  placeholderTex.colorSpace = THREE.SRGBColorSpace;
  sphereMat = new THREE.MeshBasicMaterial({ map: placeholderTex });
  scene.add(new THREE.Mesh(geo, sphereMat));

  const resize = () => {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(mount);
  resize();

  bindPointer();
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    if (!dragging && now - lastInteraction > 2500 && !gyroOn) lon += dt * (live ? 3 : 6);
    updateCamera();
    renderer.render(scene, camera);
  });
}

function updateCamera() {
  if (gyroOn && deviceQuat) {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yawOffset));
    camera.quaternion.copy(yaw).multiply(deviceQuat);
    return;
  }
  lat = Math.max(-85, Math.min(85, lat));
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);
  camera.lookAt(
    500 * Math.sin(phi) * Math.cos(theta),
    500 * Math.cos(phi),
    500 * Math.sin(phi) * Math.sin(theta)
  );
}

function bindPointer() {
  const el = renderer.domElement;
  let sx = 0, sy = 0, slon = 0, slat = 0, syaw = 0;
  el.addEventListener("pointerdown", (e) => {
    if (!live) return;
    pointers.set(e.pointerId, e);
    el.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      fovStart = camera.fov;
      return;
    }
    dragging = true;
    sx = e.clientX; sy = e.clientY; slon = lon; slat = lat; syaw = yawOffset;
    hideHint();
  });
  el.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    lastInteraction = performance.now();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setFov(fovStart * (pinchStart / d));
      return;
    }
    if (!dragging) return;
    const k = (camera.fov / 75) * 0.12;
    if (gyroOn) yawOffset = syaw + (e.clientX - sx) * k;
    else {
      lon = slon - (e.clientX - sx) * k;
      lat = slat + (e.clientY - sy) * k;
    }
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) dragging = false;
    lastInteraction = performance.now();
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("wheel", (e) => {
    if (!live || !isFull()) return;
    e.preventDefault();
    setFov(camera.fov + e.deltaY * 0.04);
  }, { passive: false });
}

function setFov(f) {
  camera.fov = Math.max(35, Math.min(95, f));
  camera.updateProjectionMatrix();
}

function enterLive() {
  if (!renderer) init();
  live = true;
  pano.classList.add("is-live");
  mount.style.touchAction = "none";
  lastInteraction = performance.now();
  hint.classList.add("is-visible");
  setTimeout(hideHint, 4000);
  loadVideo(active);
}

function hideHint() { hint.classList.remove("is-visible"); }

function select(i) {
  active = i;
  [...list.children].forEach((c, k) => c.classList.toggle("is-active", k === i));
  if (live) loadVideo(i);
}

function loadVideo(i) {
  const item = items[i];
  if (!item) return;
  nowLabel.textContent = `${item.title} · ${item.location}`;
  if (!video) {
    video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.preload = "auto";
    video.addEventListener("playing", () => setPaused(false));
    video.addEventListener("pause", () => setPaused(true));
  }
  video.onerror = () => {
    sphereMat.map = placeholderTex;
    sphereMat.needsUpdate = true;
    nowLabel.textContent = `${item.title} · preview (add ${item.src.split("/").pop()})`;
    setPaused(true);
  };
  video.oncanplay = () => {
    if (!videoTex) {
      videoTex = new THREE.VideoTexture(video);
      videoTex.colorSpace = THREE.SRGBColorSpace;
    }
    sphereMat.map = videoTex;
    sphereMat.needsUpdate = true;
  };
  video.src = item.src;
  video.load();
  video.play().catch(() => setPaused(true));
}

function setPaused(p) {
  playBtn.classList.toggle("is-paused", p);
  playBtn.setAttribute("aria-label", p ? "Play 360 video" : "Pause 360 video");
}

startBtn.addEventListener("click", enterLive);

playBtn.addEventListener("click", () => {
  if (!video || sphereMat.map !== videoTex) return;
  video.paused ? video.play().catch(() => {}) : video.pause();
});

muteBtn.addEventListener("click", () => {
  if (!video) return;
  video.muted = !video.muted;
  muteBtn.classList.toggle("is-unmuted", !video.muted);
  muteBtn.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
});

// ---- Phone motion (gyroscope) ----
const zee = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const onOrient = (e) => {
  if (e.alpha == null) return;
  const d = THREE.MathUtils.degToRad;
  const orient = d(screen.orientation?.angle ?? window.orientation ?? 0);
  euler.set(d(e.beta), d(e.alpha), -d(e.gamma), "YXZ");
  deviceQuat = deviceQuat || new THREE.Quaternion();
  deviceQuat.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));
};
if ("DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches) {
  gyroBtn.hidden = false;
  gyroBtn.addEventListener("click", async () => {
    if (gyroOn) {
      gyroOn = false;
      window.removeEventListener("deviceorientation", onOrient);
      gyroBtn.classList.remove("is-on");
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return;
      }
      window.addEventListener("deviceorientation", onOrient);
      gyroOn = true;
      yawOffset = 0;
      gyroBtn.classList.add("is-on");
    } catch { /* permission denied */ }
  });
}

// ---- Fullscreen (real API, with a CSS fallback for iPhone) ----
const isFull = () => document.fullscreenElement === pano || pano.classList.contains("is-pseudo-full");
fullBtn.addEventListener("click", async () => {
  if (isFull()) {
    if (document.fullscreenElement) await document.exitFullscreen();
    pano.classList.remove("is-pseudo-full");
    document.body.style.overflow = "";
    return;
  }
  if (pano.requestFullscreen) {
    try { await pano.requestFullscreen(); return; } catch { /* fall through */ }
  }
  pano.classList.add("is-pseudo-full");
  document.body.style.overflow = "hidden";
});

// Stylized dusk valley used until real 360° footage is added.
function buildPlaceholderPanorama() {
  const W = 2048, H = 1024;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const horizon = H * 0.52;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#050914");
  sky.addColorStop(0.45, "#16213d");
  sky.addColorStop(0.8, "#5a3b4a");
  sky.addColorStop(1, "#f29a52");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);

  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 380; i++) {
    const y = rnd() * horizon * 0.55;
    g.globalAlpha = 0.25 + rnd() * 0.6;
    g.fillStyle = "#fff";
    g.fillRect(rnd() * W, y, 1.5, 1.5);
  }
  g.globalAlpha = 1;

  const sunX = W * 0.62;
  const glow = g.createRadialGradient(sunX, horizon, 0, sunX, horizon, 520);
  glow.addColorStop(0, "rgba(255,190,110,0.85)");
  glow.addColorStop(0.3, "rgba(255,150,80,0.35)");
  glow.addColorStop(1, "rgba(255,150,80,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, horizon);

  const range = (base, amp, color, harmonics) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, horizon);
    for (let x = 0; x <= W; x += 4) {
      const u = x / W;
      let y = 0;
      harmonics.forEach(([k, a, p]) => { y += a * Math.sin(2 * Math.PI * k * u + p); });
      g.lineTo(x, base - amp * (0.5 + y));
    }
    g.lineTo(W, horizon);
    g.closePath();
    g.fill();
  };
  range(horizon - 4, 150, "#2a2536", [[2, 0.35, 0.4], [5, 0.2, 1.3], [11, 0.08, 2.1], [23, 0.03, 0.7]]);
  range(horizon + 2, 90, "#15131c", [[3, 0.3, 2.2], [7, 0.16, 0.2], [17, 0.06, 1.1], [31, 0.02, 2.9]]);

  const ground = g.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, "#131219");
  ground.addColorStop(0.5, "#0b0b0f");
  ground.addColorStop(1, "#050506");
  g.fillStyle = ground;
  g.fillRect(0, horizon, W, H - horizon);

  const lake = g.createLinearGradient(0, horizon + 10, 0, horizon + 90);
  lake.addColorStop(0, "rgba(242,160,90,0.55)");
  lake.addColorStop(1, "rgba(60,70,110,0.15)");
  g.fillStyle = lake;
  g.beginPath();
  g.ellipse(sunX, horizon + 40, 360, 38, 0, 0, Math.PI * 2);
  g.fill();

  for (let i = 0; i < 2600; i++) {
    const v = Math.pow(rnd(), 2.2);
    const y = horizon + 14 + v * (H - horizon) * 0.6;
    const x = rnd() * W;
    if (Math.abs(x - sunX) < 340 && y < horizon + 80) continue;
    g.globalAlpha = 0.9 - v * 0.7;
    g.fillStyle = rnd() < 0.8 ? "#ffc47d" : "#dfe9ff";
    const s = 1 + v * 3;
    g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1;

  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = "300 30px Jost, 'Century Gothic', sans-serif";
  g.textAlign = "center";
  g.fillText("SKYLINE 360 · AERIAL PREVIEW", W * 0.25, horizon - 210);
  g.font = "300 20px Jost, 'Century Gothic', sans-serif";
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillText("Your Avata 360 footage plays here", W * 0.25, horizon - 176);
  return c;
}
