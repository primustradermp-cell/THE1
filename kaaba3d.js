/* Interactive 3D Architectural Kaaba Model (Three.js) for SalahSync */

(function initKaaba3D() {
  const container = document.getElementById("kaaba-3d-canvas");
  if (!container || typeof THREE === "undefined") return;

  const fallbackImg = document.getElementById("stage-kaaba-bg");

  /* ---------- Scene, Camera, Renderer ---------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x171612, 0.052);

  const width = container.clientWidth || 860;
  const height = container.clientHeight || 460;

  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    console.warn("WebGL unavailable, keeping 2D render fallback.", err);
    return;
  }

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  container.appendChild(renderer.domElement);
  if (fallbackImg) fallbackImg.style.opacity = "0";

  /* ---------- Procedural High-Res Kiswah Textures ---------- */
  function createKiswahTextures(hasDoor) {
    const size = 1024;

    // Color map
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = size;
    colorCanvas.height = size;
    const ctx = colorCanvas.getContext("2d");

    // Metalness / Roughness map (gold = metallic & shiny, black cloth = matte)
    const metalCanvas = document.createElement("canvas");
    metalCanvas.width = size;
    metalCanvas.height = size;
    const mctx = metalCanvas.getContext("2d");

    // Bump map for silk drapery folds + raised embroidery
    const bumpCanvas = document.createElement("canvas");
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bctx = bumpCanvas.getContext("2d");

    // 1. Matte black woven silk base
    ctx.fillStyle = "#131312";
    ctx.fillRect(0, 0, size, size);
    mctx.fillStyle = "#101010";
    mctx.fillRect(0, 0, size, size);
    bctx.fillStyle = "#444444";
    bctx.fillRect(0, 0, size, size);

    // Subtle vertical drapery pleats
    for (let x = 0; x < size; x += 2) {
      const wave = Math.sin(x * 0.045) * 0.5 + Math.sin(x * 0.13) * 0.25 + 0.5;
      const shade = Math.floor(14 + wave * 12);
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade - 1})`;
      ctx.fillRect(x, 0, 2, size);

      const bump = Math.floor(55 + wave * 36);
      bctx.fillStyle = `rgb(${bump}, ${bump}, ${bump})`;
      bctx.fillRect(x, 0, 2, size);
    }

    // Subtle tonal jacquard chevron weave across Kiswah
    ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
    ctx.lineWidth = 1.5;
    for (let y = 0; y < size; y += 26) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 26) {
        ctx.lineTo(x, y + ((x / 26) % 2 === 0 ? 0 : 12));
      }
      ctx.stroke();
    }

    function drawGoldRect(x, y, w, h, lineW = 3, fill = false) {
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, "#b99142");
      grad.addColorStop(0.5, "#e7c675");
      grad.addColorStop(1, "#a77f34");
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineW;
      if (fill) {
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeRect(x, y, w, h);
      }

      mctx.strokeStyle = "#e6e6e6";
      mctx.lineWidth = lineW + 1;
      if (fill) {
        mctx.fillStyle = "#e0e0e0";
        mctx.fillRect(x, y, w, h);
      } else {
        mctx.strokeRect(x, y, w, h);
      }

      bctx.strokeStyle = "#dcdcdc";
      bctx.lineWidth = lineW + 1;
      if (fill) {
        bctx.fillStyle = "#cccccc";
        bctx.fillRect(x, y, w, h);
      } else {
        bctx.strokeRect(x, y, w, h);
      }
    }

    function drawCalligraphyBand(x, y, w, h) {
      drawGoldRect(x, y, w, h, 4);
      drawGoldRect(x + 8, y + 8, w - 16, h - 16, 2);

      // Stylized golden calligraphic strokes inside the Hizam belt
      ctx.save();
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, "#f2d687");
      grad.addColorStop(0.5, "#cda34f");
      grad.addColorStop(1, "#9f7930");
      ctx.strokeStyle = grad;
      ctx.fillStyle = grad;
      mctx.strokeStyle = "#f0f0f0";
      bctx.strokeStyle = "#e5e5e5";

      const step = 30;
      for (let px = x + 20; px < x + w - 24; px += step) {
        const seed = Math.sin(px * 0.17) * 0.5 + 0.5;
        const barH = h * (0.35 + seed * 0.34);
        const topY = y + h * 0.18;

        // Vertical alif/lam strokes + sweeping curves
        [ctx, mctx, bctx].forEach((c) => {
          c.lineWidth = 3.2;
          c.beginPath();
          c.moveTo(px, topY + barH);
          c.lineTo(px + 2, topY + (1 - seed) * 14);
          c.moveTo(px - 6, y + h * 0.68);
          c.quadraticCurveTo(px + 8, y + h * 0.82, px + 22, y + h * 0.64);
          c.stroke();
        });

        // Diacritic dots
        if (seed > 0.45) {
          ctx.fillRect(px + 10, y + h * 0.28, 4, 4);
          mctx.fillStyle = "#efefef";
          mctx.fillRect(px + 10, y + h * 0.28, 4, 4);
        }
      }
      ctx.restore();
    }

    // 2. Hizam (Upper-third golden belt)
    const hizamY = 265;
    const hizamH = 92;
    drawCalligraphyBand(0, hizamY, size, hizamH);

    // 3. Medallion cartouches below Hizam
    const panelY = hizamY + hizamH + 28;
    const panelW = 190;
    const panelH = 74;
    const positions = hasDoor ? [44, 780] : [54, 292, 530, 768];
    positions.forEach((px) => {
      drawCalligraphyBand(px, panelY, panelW, panelH);
    });

    // Small lantern medallions (Qandils) between panels
    const qandils = hasDoor ? [280, 725] : [264, 502, 740];
    qandils.forEach((qx) => {
      [ctx, mctx, bctx].forEach((c, idx) => {
        c.fillStyle = idx === 0 ? "#d9b45e" : "#dcdcdc";
        c.beginPath();
        c.moveTo(qx, panelY + 14);
        c.lineTo(qx + 16, panelY + 37);
        c.lineTo(qx, panelY + 60);
        c.lineTo(qx - 16, panelY + 37);
        c.closePath();
        c.fill();
      });
    });

    // 4. Corner diamond chain (matches reference photo left corner)
    if (hasDoor) {
      for (let i = 0; i < 6; i++) {
        const dy = panelY + 95 + i * 68;
        const dx = 42;
        [ctx, mctx, bctx].forEach((c, idx) => {
          c.strokeStyle = idx === 0 ? "#d9b45e" : "#e5e5e5";
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(dx, dy - 16);
          c.lineTo(dx + 15, dy);
          c.lineTo(dx, dy + 16);
          c.lineTo(dx - 15, dy);
          c.closePath();
          c.stroke();
        });
      }
    }

    // 5. Sitara (Embroidered Golden Curtain over the Kaaba Door)
    if (hasDoor) {
      const sx = 370;
      const sy = hizamY + hizamH + 24;
      const sw = 284;
      const sh = 505;

      // Rich gold-framed Sitara panel
      ctx.fillStyle = "#191713";
      ctx.fillRect(sx, sy, sw, sh);
      drawGoldRect(sx, sy, sw, sh, 7);
      drawGoldRect(sx + 14, sy + 14, sw - 28, sh - 28, 3);

      // Upper calligraphy headers on Sitara
      drawCalligraphyBand(sx + 24, sy + 26, sw - 48, 72);
      drawCalligraphyBand(sx + 24, sy + 114, sw - 48, 58);

      // Ornate central arch medallion on Sitara
      const cx = sx + sw / 2;
      const cy = sy + 275;
      [ctx, mctx, bctx].forEach((c, idx) => {
        c.strokeStyle = idx === 0 ? "#e2be6c" : "#ebebeb";
        c.lineWidth = 4;
        c.beginPath();
        c.arc(cx, cy, 62, 0, Math.PI * 2);
        c.stroke();
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy, 44, 0, Math.PI * 2);
        c.stroke();
      });

      // Raised Golden Kaaba Door (Bab al-Kaaba) opening at bottom of Sitara
      const dw = 114;
      const dh = 190;
      const dx = cx - dw / 2;
      const dy = sy + sh - dh + 58;
      drawGoldRect(dx, dy, dw, dh, 4, true);

      // Door panels & center split
      ctx.strokeStyle = "#6e511c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, dy);
      ctx.lineTo(cx, dy + dh);
      ctx.stroke();
      ctx.strokeRect(dx + 10, dy + 14, dw / 2 - 16, dh * 0.4);
      ctx.strokeRect(cx + 6, dy + 14, dw / 2 - 16, dh * 0.4);
      ctx.strokeRect(dx + 10, dy + dh * 0.52, dw / 2 - 16, dh * 0.36);
      ctx.strokeRect(cx + 6, dy + dh * 0.52, dw / 2 - 16, dh * 0.36);
    }

    const colorTex = new THREE.CanvasTexture(colorCanvas);
    colorTex.encoding = THREE.sRGBEncoding;
    colorTex.anisotropy = 8;

    const metalTex = new THREE.CanvasTexture(metalCanvas);
    const bumpTex = new THREE.CanvasTexture(bumpCanvas);

    return { colorTex, metalTex, bumpTex };
  }

  function createCourtyardTexture() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#191815";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(218, 204, 174, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  /* ---------- Build the 3D Kaaba Architecture ---------- */
  const root = new THREE.Group();
  scene.add(root);

  const kiswahSide = createKiswahTextures(false);
  const kiswahDoor = createKiswahTextures(true);

  const makeKiswahMat = (texSet) =>
    new THREE.MeshStandardMaterial({
      map: texSet.colorTex,
      metalnessMap: texSet.metalTex,
      bumpMap: texSet.bumpTex,
      bumpScale: 0.025,
      metalness: 0.82,
      roughness: 0.62,
    });

  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x161513,
    roughness: 0.9,
    metalness: 0.1,
  });

  const sideMat = makeKiswahMat(kiswahSide);
  const doorMat = makeKiswahMat(kiswahDoor);

  // Authentic Kaaba block: width 2.25, height 2.65, depth 2.45
  const kaabaGeo = new THREE.BoxGeometry(2.25, 2.65, 2.45);
  const kaabaMaterials = [
    doorMat, // +X (Front-right face with Golden Door & Sitara)
    sideMat, // -X
    roofMat, // +Y (Roof)
    roofMat, // -Y
    sideMat, // +Z (Front-left face)
    sideMat, // -Z
  ];
  const kaabaMesh = new THREE.Mesh(kaabaGeo, kaabaMaterials);
  kaabaMesh.position.y = 1.54;
  kaabaMesh.castShadow = true;
  kaabaMesh.receiveShadow = true;
  root.add(kaabaMesh);

  // Subtle recessed golden door relief mesh for real 3D depth on +X face
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xdcb45c,
    metalness: 0.9,
    roughness: 0.24,
  });

  const doorRelief = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.28), goldMat);
  doorRelief.position.set(1.135, 0.8, 0.0);
  root.add(doorRelief);

  // Shadherwan (Stepped marble base)
  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0x8f8878,
    roughness: 0.45,
    metalness: 0.1,
  });
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.26, 2.66), marbleMat);
  baseMesh.position.y = 0.13;
  baseMesh.receiveShadow = true;
  baseMesh.castShadow = true;
  root.add(baseMesh);

  // Dark decorative base niches around Shadherwan
  const nicheMat = new THREE.MeshStandardMaterial({ color: 0x1e1d19, roughness: 0.85 });
  for (let i = -3; i <= 3; i++) {
    const n1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.1), nicheMat);
    n1.position.set(1.23, 0.13, i * 0.34);
    root.add(n1);
    const n2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.04), nicheMat);
    n2.position.set(i * 0.31, 0.13, 1.33);
    root.add(n2);
  }

  // Al-Hajar al-Aswad (Silver-framed Black Stone on Eastern corner +X, +Z)
  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xd5d2c8,
    metalness: 0.92,
    roughness: 0.2,
  });
  const stoneFrame = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 12, 24), silverMat);
  stoneFrame.position.set(1.13, 0.72, 1.22);
  stoneFrame.rotation.y = Math.PI / 4;
  root.add(stoneFrame);

  const blackStone = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.22, metalness: 0.3 })
  );
  blackStone.position.set(1.12, 0.72, 1.21);
  root.add(blackStone);

  // Mizab al-Rahmah (Golden rain spout on the -Z roofline)
  const mizab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.55), goldMat);
  mizab.position.set(0, 2.82, -1.42);
  root.add(mizab);

  // Hijr Ismail (Curved semicircular marble wall beside -Z face)
  const hateemShape = new THREE.Shape();
  hateemShape.absarc(0, 0, 1.05, 0, Math.PI, false);
  hateemShape.absarc(0, 0, 0.91, Math.PI, 0, true);
  const hateemGeo = new THREE.ExtrudeGeometry(hateemShape, { depth: 0.36, bevelEnabled: false });
  const hateemMesh = new THREE.Mesh(hateemGeo, marbleMat);
  hateemMesh.rotation.x = -Math.PI / 2;
  hateemMesh.position.set(0, 0, -1.68);
  hateemMesh.receiveShadow = true;
  hateemMesh.castShadow = true;
  root.add(hateemMesh);

  // Maqam Ibrahim (Small golden glass shrine on +X side)
  const maqamGroup = new THREE.Group();
  const maqamBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.28, 16), marbleMat);
  maqamBase.position.y = 0.14;
  const maqamDome = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), goldMat);
  maqamDome.position.y = 0.34;
  maqamGroup.add(maqamBase, maqamDome);
  maqamGroup.position.set(2.35, 0, 0.42);
  root.add(maqamGroup);

  // Subtle Reflective Courtyard Floor
  const floorGeo = new THREE.CircleGeometry(18, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createCourtyardTexture(),
    roughness: 0.32,
    metalness: 0.28,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // Distant Subtle Masjid al-Haram Arched Colonnade Ring + Minaret Silhouette
  const archMat = new THREE.MeshStandardMaterial({
    color: 0x3b372e,
    roughness: 0.85,
    metalness: 0.05,
  });
  const colonnadeRadius = 8.4;
  const pillarCount = 24;
  for (let i = 0; i < pillarCount; i++) {
    const angle = (i / pillarCount) * Math.PI * 2;
    const px = Math.cos(angle) * colonnadeRadius;
    const pz = Math.sin(angle) * colonnadeRadius;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.4, 8), archMat);
    pillar.position.set(px, 1.2, pz);
    root.add(pillar);
  }
  const ringTop = new THREE.Mesh(new THREE.TorusGeometry(colonnadeRadius, 0.22, 8, 48), archMat);
  ringTop.rotation.x = Math.PI / 2;
  ringTop.position.y = 2.45;
  root.add(ringTop);

  // Graceful Background Minaret
  const minaret = new THREE.Group();
  const mShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 5.8, 12), archMat);
  mShaft.position.y = 2.9;
  const mBalcony = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.22, 12), archMat);
  mBalcony.position.y = 4.6;
  const mTop = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.9, 12), archMat);
  mTop.position.y = 6.2;
  minaret.add(mShaft, mBalcony, mTop);
  minaret.position.set(-4.2, 0, -5.6);
  root.add(minaret);

  // Subtle Floating Warm Dust Motes
  const particleCount = 60;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 9;
    pPos[i * 3 + 1] = Math.random() * 4.2 + 0.3;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 9;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xe6cfa0,
    size: 0.035,
    transparent: true,
    opacity: 0.45,
  });
  const motes = new THREE.Points(pGeo, pMat);
  root.add(motes);

  /* ---------- GymSync Warm Charcoal & Khaki-Taupe Cinematic Lighting ---------- */
  const hemiLight = new THREE.HemisphereLight(0xd9ceb7, 0x1c1a15, 0.65);
  scene.add(hemiLight);

  // Main warm golden-khaki key light illuminating the Door & Hizam
  const keyLight = new THREE.DirectionalLight(0xffebd0, 2.2);
  keyLight.position.set(5.5, 7.5, 4.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 20;
  scene.add(keyLight);

  // Warm rim light behind the Kaaba matching the khaki-taupe sidebar glow
  const rimLight = new THREE.PointLight(0xd8b473, 2.4, 18);
  rimLight.position.set(-4.5, 4.2, -3.8);
  scene.add(rimLight);

  // Subtle warm burnt-orange floor reflection accent (GymSync signature touch)
  const accentLight = new THREE.PointLight(0xe85d2a, 0.75, 10);
  accentLight.position.set(3.2, 0.9, 2.4);
  scene.add(accentLight);

  function apply3DTheme(isLight) {
    if (isLight) {
      scene.fog.color.setHex(0xeef3f0);
      scene.fog.density = 0.036;
      hemiLight.color.setHex(0xfff9ee);
      hemiLight.groundColor.setHex(0xd8e4df);
      hemiLight.intensity = 1.25;
      keyLight.intensity = 2.6;
      rimLight.color.setHex(0xffe0a3);
      rimLight.intensity = 1.8;
      accentLight.intensity = 0.5;
      floorMat.color.setHex(0xdbe6e1);
      archMat.color.setHex(0xc8d4ce);
      marbleMat.color.setHex(0xebe6db);
      pMat.color.setHex(0xe85d2a);
      pMat.opacity = 0.32;
    } else {
      scene.fog.color.setHex(0x171612);
      scene.fog.density = 0.052;
      hemiLight.color.setHex(0xd9ceb7);
      hemiLight.groundColor.setHex(0x1c1a15);
      hemiLight.intensity = 0.65;
      keyLight.intensity = 2.2;
      rimLight.color.setHex(0xd8b473);
      rimLight.intensity = 2.4;
      accentLight.intensity = 0.75;
      floorMat.color.setHex(0xffffff);
      archMat.color.setHex(0x3b372e);
      marbleMat.color.setHex(0x8f8878);
      pMat.color.setHex(0xe6cfa0);
      pMat.opacity = 0.45;
    }
  }

  apply3DTheme(document.documentElement.getAttribute("data-theme") === "light");
  window.addEventListener("themechange", (e) => {
    apply3DTheme(e.detail && e.detail.theme === "light");
  });

  /* ---------- Interactive Orbit & Auto-Rotate State ---------- */
  const DEFAULT_AZIMUTH = 0.76; // Classic 3/4 view matching reference photo
  const DEFAULT_POLAR = 1.36;   // Slightly upward heroic architectural angle
  const DEFAULT_RADIUS = 7.4;

  const orbit = {
    azimuth: DEFAULT_AZIMUTH,
    polar: DEFAULT_POLAR,
    targetAzimuth: DEFAULT_AZIMUTH,
    targetPolar: DEFAULT_POLAR,
    radius: DEFAULT_RADIUS,
    targetRadius: DEFAULT_RADIUS,
    autoRotate: true,
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  function updateCamera() {
    const sinP = Math.sin(orbit.polar);
    camera.position.set(
      orbit.radius * sinP * Math.sin(orbit.azimuth),
      orbit.radius * Math.cos(orbit.polar) + 1.05,
      orbit.radius * sinP * Math.cos(orbit.azimuth)
    );
    camera.lookAt(0, 1.15, 0);
  }

  // Pointer drag to orbit 360°
  const stageEl = document.getElementById("hud-stage") || container;

  stageEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, select, input, a")) return;
    orbit.dragging = true;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;
    stageEl.classList.add("is-dragging");
  });

  window.addEventListener("pointermove", (e) => {
    if (!orbit.dragging) return;
    const dx = e.clientX - orbit.lastX;
    const dy = e.clientY - orbit.lastY;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;

    orbit.targetAzimuth -= dx * 0.0065;
    orbit.targetPolar = Math.min(1.5, Math.max(0.75, orbit.targetPolar - dy * 0.0045));
  });

  window.addEventListener("pointerup", () => {
    if (!orbit.dragging) return;
    orbit.dragging = false;
    stageEl.classList.remove("is-dragging");
  });

  // Scroll wheel zoom inside stage (subtle clamped range)
  stageEl.addEventListener(
    "wheel",
    (e) => {
      if (e.target.closest(".table-scroll")) return;
      orbit.targetRadius = Math.min(10.5, Math.max(5.2, orbit.targetRadius + e.deltaY * 0.004));
    },
    { passive: true }
  );

  // HUD 3D Controls
  const spinBtn = document.getElementById("btn-3d-spin");
  if (spinBtn) {
    spinBtn.addEventListener("click", () => {
      orbit.autoRotate = !orbit.autoRotate;
      spinBtn.textContent = orbit.autoRotate ? "Orbit" : "Paused";
      spinBtn.classList.toggle("is-active", orbit.autoRotate);
    });
  }

  const resetBtn = document.getElementById("btn-3d-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      orbit.targetAzimuth = DEFAULT_AZIMUTH;
      orbit.targetPolar = DEFAULT_POLAR;
      orbit.targetRadius = DEFAULT_RADIUS;
    });
  }

  /* ---------- Responsive Resize & Calm Framing ---------- */
  function applyFraming(w, h) {
    camera.aspect = w / h;
    if (w > 720) {
      // Gently offset Kaaba slightly right so left-side Next Prayer typography stays unobstructed
      camera.setViewOffset(w, h, -Math.round(w * 0.14), Math.round(h * 0.04), w, h);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function handleResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    applyFraming(w, h);
  }

  applyFraming(width, height);

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(handleResize).observe(container);
  } else {
    window.addEventListener("resize", handleResize);
  }

  /* ---------- Animation Loop ---------- */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (orbit.autoRotate && !orbit.dragging) {
      orbit.targetAzimuth += dt * 0.14;
    }

    orbit.azimuth += (orbit.targetAzimuth - orbit.azimuth) * 0.08;
    orbit.polar += (orbit.targetPolar - orbit.polar) * 0.08;
    orbit.radius += (orbit.targetRadius - orbit.radius) * 0.08;

    motes.rotation.y += dt * 0.03;

    updateCamera();
    renderer.render(scene, camera);
  }

  updateCamera();
  animate();
})();
