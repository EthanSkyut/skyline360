import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const cfg = window.SKYLINE_CONFIG.model3d;
const mount = document.getElementById("model-canvas");
const stage = document.getElementById("model-stage");

if (cfg.polycamEmbedUrl) {
  const frame = document.createElement("iframe");
  frame.src = cfg.polycamEmbedUrl;
  frame.title = "3D property scan";
  frame.loading = "lazy";
  frame.allow = "fullscreen; xr-spatial-tracking";
  mount.append(frame);
  stage.querySelector(".scan-ring")?.remove();
} else {
  initViewer();
}

function initViewer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  camera.position.set(15, 10, 16.5);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1a22, 1.1));
  const sun = new THREE.DirectionalLight(0xffd6a0, 2.4);
  sun.position.set(7, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 0.8);
  rim.position.set(-8, 5, -9);
  scene.add(rim);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.4, 0.25, 96),
    new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.9 })
  );
  pedestal.position.y = -0.125;
  pedestal.receiveShadow = true;
  scene.add(pedestal);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(7.25, 7.32, 128),
    new THREE.MeshBasicMaterial({ color: 0xf2b33d, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = (cfg.rotationSpeed ?? 0.6) * 2;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.update();
  // Spin on its own; pause the moment someone grabs it, resume a few seconds
  // after they let go (matches how most product-style 3D viewers behave).
  let resumeTimer = null;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
    clearTimeout(resumeTimer);
  });
  controls.addEventListener("end", () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 4000);
  });
  // Let vertical swipes keep scrolling the page on phones; horizontal drags rotate.
  renderer.domElement.style.touchAction = "pan-y";

  const group = new THREE.Group();
  scene.add(group);

  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(
    cfg.src,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      levelModel(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 9 / Math.max(size.x, size.z, size.y * 1.6);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      group.add(model);
    },
    undefined,
    () => group.add(buildHouse())
  );

  const resize = () => {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 40 : 32;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(mount);
  resize();

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "100px" }).observe(mount);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (!visible || document.hidden) return;
    ring.material.opacity = 0.35 + 0.25 * Math.sin(clock.elapsedTime * 1.6);
    controls.update(dt);
    renderer.render(scene, camera);
  });
}

// Photogrammetry scans aren't always perfectly level -- fit a plane to the
// lowest quarter of the mesh (the ground/rooftops) and rotate the model so
// that plane's normal points straight up. Runs before the existing
// bounding-box scale/center step, so that step centers the already-leveled
// geometry rather than the tilted original.
function levelModel(model) {
  model.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(model);
  // A wider band (e.g. the bottom quarter) pulls in wall/facade points on a
  // scan this tilted, which biases the fit toward a steeper angle than the
  // ground actually has -- measured ~14 deg at 25% vs. ~10 deg at 10-12% on
  // this house's scan, and the tighter band still clears the sample floor
  // below once the vertex budget is raised to match.
  const groundY = box.min.y + (box.max.y - box.min.y) * 0.12;
  const pts = [];
  const v = new THREE.Vector3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 20000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y <= groundY) pts.push(v.x, v.y, v.z);
    }
  });
  if (pts.length < 90) return;

  let sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0, n = 0;
  for (let i = 0; i < pts.length; i += 3) {
    const x = pts[i], y = pts[i + 1], z = pts[i + 2];
    sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y; n++;
  }
  // Least-squares fit of y = a*x + b*z + c.
  const sol = solve3x3(
    [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, n]],
    [sxy, szy, sy]
  );
  if (!sol) return;
  const [a, b] = sol;
  const normal = new THREE.Vector3(-a, 1, -b).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 1, 0));
  model.quaternion.copy(quat);
}

function solve3x3(m, b) {
  const det = (r) => (
    r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1]) -
    r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0]) +
    r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0])
  );
  const d = det(m);
  if (Math.abs(d) < 1e-9) return null;
  const replace = (col) => m.map((row, i) => row.map((val, j) => (j === col ? b[i] : val)));
  return [det(replace(0)) / d, det(replace(1)) / d, det(replace(2)) / d];
}

function buildHouse() {
  const house = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const walls = mat(0xe8e4dc, { roughness: 0.7 });
  const trim = mat(0x2b2b30, { roughness: 0.5 });
  const wood = mat(0x8a5a36, { roughness: 0.75 });
  const roof = mat(0x35353b, { roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2230, emissive: 0xe8983f, emissiveIntensity: 0.38, roughness: 0.15, metalness: 0.3 });
  const lawn = mat(0x31472d);
  const concrete = mat(0x9c9a95);
  const water = new THREE.MeshStandardMaterial({ color: 0x2aa9cc, emissive: 0x0e5a70, emissiveIntensity: 0.6, roughness: 0.1 });
  const leaves = mat(0x2d4b31);

  const box = (w, h, d, m, x, y, z, ry = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    house.add(mesh);
    return mesh;
  };

  const G = 0.12;
  box(10, G, 8, lawn, 0, G / 2, 0).castShadow = false;
  box(1.7, 0.02, 3.2, concrete, 2.9, G + 0.01, 2.4);
  box(0.9, 0.02, 2.4, concrete, 0.9, G + 0.01, 2.1);

  // main floor, garage wing, cantilevered upper floor
  box(4.4, 2.2, 3.0, walls, -0.5, G + 1.1, -0.6);
  box(2.5, 1.7, 2.7, wood, 2.9, G + 0.85, -0.45);
  box(3.2, 1.45, 2.6, walls, -1.2, G + 2.2 + 0.725, -0.8);
  box(3.3, 0.1, 2.8, trim, -1.2, G + 2.2, -0.8);
  box(2.7, 0.12, 2.9, trim, 2.9, G + 1.76, -0.45);

  // gable roof over upper floor
  const tri = new THREE.Shape();
  tri.moveTo(-1.3, 0); tri.lineTo(1.3, 0); tri.lineTo(0, 0.8); tri.closePath();
  const atticGeo = new THREE.ExtrudeGeometry(tri, { depth: 3.2, bevelEnabled: false });
  atticGeo.translate(0, 0, -1.6);
  const attic = new THREE.Mesh(atticGeo, walls);
  attic.rotation.y = Math.PI / 2;
  const topY = G + 2.2 + 1.45;
  attic.position.set(-1.2, topY, -0.8);
  attic.castShadow = true;
  house.add(attic);
  const slope = Math.atan2(0.8, 1.3);
  const slabLen = Math.hypot(1.3, 0.8) + 0.25;
  [-1, 1].forEach((side) => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.09, slabLen), roof);
    slab.position.set(-1.2, topY + 0.43, -0.8 + side * 0.68);
    slab.rotation.x = side * slope;
    slab.castShadow = true;
    house.add(slab);
  });

  // glazing and doors
  box(2.8, 1.5, 0.05, glass, -0.9, G + 1.0, 0.93);
  box(2.3, 0.95, 0.05, glass, -1.2, G + 2.95, 0.52);
  box(0.05, 0.9, 1.6, glass, -2.72, G + 1.1, -0.6);
  box(1.9, 1.15, 0.05, trim, 2.9, G + 0.6, 0.93);
  box(0.55, 1.2, 0.05, wood, 1.15, G + 0.62, 0.93);
  box(2.4, 1.3, 0.05, glass, -0.6, G + 1.0, -2.13);

  // back patio + pool
  box(3.8, 0.1, 1.3, wood, -0.6, G + 0.05, -2.85);
  box(3.0, 0.08, 1.5, concrete, 2.7, G + 0.04, -2.9);
  box(2.4, 0.04, 1.0, water, 2.7, G + 0.1, -2.9);

  // trees
  const trunkMat = mat(0x4a3526);
  [[-4.2, 3.1], [-4.3, -3.2], [4.4, 3.2], [4.3, -3.5], [-4.4, 0.1], [0.6, -3.7]].forEach(([x, z], i) => {
    const h = 1.5 + (i % 3) * 0.35;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 8), trunkMat);
    trunk.position.set(x, G + 0.2, z);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5, h, 10), leaves);
    crown.position.set(x, G + 0.4 + h / 2, z);
    trunk.castShadow = crown.castShadow = true;
    house.add(trunk, crown);
  });

  // property line overlay
  const pts = [[-4.8, 3.8], [4.8, 3.8], [4.8, -3.8], [-4.8, -3.8]].map(([x, z]) => new THREE.Vector3(x, G + 0.03, z));
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color: 0xf2b33d, dashSize: 0.35, gapSize: 0.2 })
  );
  line.computeLineDistances();
  house.add(line);

  return house;
}
