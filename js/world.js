/* ===== Hemi's Graveyard — world builder (graveyard, graves, sky, gate) ===== */
const ORANGE = 0xff6a00;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
// seeded rng so the cemetery layout is the same every run
let _seed = 1337;
function srnd() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }
const srange = (a, b) => a + srnd() * (b - a);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
function noiseFill(ctx, w, h, base, n, vary, size) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (srnd() - 0.5) * vary;
    ctx.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    ctx.fillRect(srnd() * w, srnd() * h, srnd() * size + 1, srnd() * size + 1);
  }
}
function glowTexture(inner, outer) {
  return canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner || 'rgba(255,255,255,1)'); g.addColorStop(0.35, outer || 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}
function textPlate(text, sub, opt) {
  opt = opt || {};
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = opt.bg || '#3a3f4a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(255,255,255,${srnd() * 0.06})`; ctx.fillRect(srnd() * w, srnd() * h, 3, 3); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (opt.glow) { ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 24; }
    ctx.fillStyle = opt.color || '#161a22';
    let fs = opt.size || 72;
    ctx.font = `bold ${fs}px Georgia, serif`;
    while (ctx.measureText(text).width > w - 50 && fs > 20) { fs -= 4; ctx.font = `bold ${fs}px Georgia, serif`; }
    ctx.fillText(text, w / 2, sub ? h * 0.42 : h * 0.5);
    if (sub) { ctx.shadowBlur = opt.glow ? 14 : 0; ctx.font = `bold 40px Georgia, serif`; ctx.fillText(sub, w / 2, h * 0.76); }
  });
}

/* curved face plane so photos look 3D (bulges toward the viewer) */
function curvedFace(tex, w, h, bulge, transparent) {
  const geo = new THREE.PlaneGeometry(w, h, 14, 14);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2);
    p.setZ(i, bulge * (1 - Math.min(1, x * x * 0.7 + y * y * 0.45)));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.9, metalness: 0
  });
  return new THREE.Mesh(geo, mat);
}

const SPECIAL = [
  { name: 'JOSHUA', rank: 5, x: -36, z: 34 },
  { name: 'JEREMY', rank: 4, x: 34, z: 12 },
  { name: 'JCV', rank: 3, x: -32, z: -12 },
  { name: 'MAX', rank: 2, x: 32, z: -34 },
  { name: 'JEFF', rank: 1, x: 0, z: -54 }
];
const COMMUNITY = ['alix', 'anuboobies', 'alpha', 'funky', 'ajeet', 'avijit', 'creator', 'foxstar', 'yahuze', 'liko', 'hexusian', 'tee', 'omni', 'exca', 'samstar', 'fake chinese'];
const BOUNDS = { x: 60, zMin: -70, zMax: 70 };
const ROADS = [ // [x1,z1,x2,z2,width]
  [0, 96, 0, -50, 4.2],
  [0, 34, -33, 34, 3], [0, 12, 31, 12, 3], [0, -12, -29, -12, 3], [0, -34, 29, -34, 3]
];

function distToSeg(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
}
function nearRoad(x, z, m) { return ROADS.some(r => distToSeg(x, z, r[0], r[1], r[2], r[3]) < r[4] / 2 + m); }

function buildWorld(scene) {
  const Wd = {
    colliders: [], circles: [], graves: [], specials: [], glows: [], flames: [], dayHide: [], dayShow: [],
    clouds: [], fogBanks: [], trees: [], gate: {}, lights: {}, sky: {}, communityGraves: []
  };
  const addCircle = (x, z, r) => Wd.circles.push({ x, z, r });
  const addBox = (cx, cz, hx, hz) => Wd.colliders.push({ minx: cx - hx, maxx: cx + hx, minz: cz - hz, maxz: cz + hz });

  /* ----- textures & materials ----- */
  const grassTex = canvasTex(256, 256, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#3d5a33', 2200, 70, 5);
    for (let i = 0; i < 1400; i++) { ctx.strokeStyle = `rgba(${rint(40, 90)},${rint(90, 150)},${rint(40, 70)},0.5)`; const x = srnd() * w, y = srnd() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + srange(-2, 2), y - srange(3, 8)); ctx.stroke(); }
  }, [90, 90]);
  const dirtTex = canvasTex(256, 256, (ctx, w, h) => noiseFill(ctx, w, h, '#7a6650', 3000, 90, 4), [1, 14]);
  const stoneTex = canvasTex(256, 256, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#8f95a3', 3500, 80, 6);
    for (let i = 0; i < 14; i++) { ctx.strokeStyle = 'rgba(20,20,30,0.25)'; ctx.beginPath(); ctx.moveTo(srnd() * w, srnd() * h); ctx.lineTo(srnd() * w, srnd() * h); ctx.stroke(); }
  }, [1, 1]);
  const wallTex = canvasTex(256, 128, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#6d7280', 1800, 60, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); for (let x = (y / 32 % 2) * 32; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke(); } }
  }, [6, 1]);
  const barkTex = canvasTex(64, 128, (ctx, w, h) => { noiseFill(ctx, w, h, '#3b3330', 800, 70, 3); for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(srnd() * w, 0, 2, h); } });
  const stoneMats = [0xffffff, 0xd8e0f0, 0xbfc8b8].map(c => new THREE.MeshStandardMaterial({ map: stoneTex, color: c, roughness: 0.95, metalness: 0 }));
  const darkStone = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x6e7484, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 0.55, metalness: 0.7 });
  const moundMat = new THREE.MeshStandardMaterial({ map: grassTex, color: 0x9b8f74, roughness: 1 });
  const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, color: 0x9a8f8a, roughness: 1 });
  const glowTex = glowTexture();

  /* ----- ground ----- */
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, color: 0xb8c8c8, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  Wd.groundMat = groundMat;
  ROADS.forEach(r => {
    const len = Math.hypot(r[2] - r[0], r[3] - r[1]);
    const t = dirtTex.clone(); t.needsUpdate = true; t.repeat.set(1, len / 5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r[4], len), new THREE.MeshStandardMaterial({ map: t, color: 0xa89a8a, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-(r[2] - r[0]), (r[3] - r[1])) + Math.PI;
    m.position.set((r[0] + r[2]) / 2, 0.03, (r[1] + r[3]) / 2); m.receiveShadow = true; scene.add(m);
  });

  /* ----- sky dome, stars, moon, sun ----- */
  const skyU = { top: { value: new THREE.Color(0x0b1235) }, mid: { value: new THREE.Color(0x2a3d78) }, bot: { value: new THREE.Color(0x1b2548) } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 c = h>0.0 ? mix(mid,top,pow(h,0.55)) : mix(mid,bot,min(1.0,-h*2.5)); gl_FragColor=vec4(c,1.0);} '
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  Wd.sky = { mesh: sky, uniforms: skyU };
  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 700; i++) { const a = srnd() * Math.PI * 2, e = Math.acos(srnd() * 0.97 + 0.03); sp.push(Math.sin(e) * Math.cos(a) * 430, Math.cos(e) * 430, Math.sin(e) * Math.sin(a) * 430); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat); stars.renderOrder = -9; scene.add(stars);
  Wd.stars = stars;
  const moonTex = canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,245,1)'); g.addColorStop(0.28, 'rgba(235,240,255,0.95)'); g.addColorStop(0.32, 'rgba(180,200,255,0.28)'); g.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(150,160,190,0.35)'; [[110, 110, 14], [150, 140, 10], [120, 150, 8], [140, 100, 7]].forEach(c => { ctx.beginPath(); ctx.arc(c[0] + 10, c[1], c[2], 0, 7); ctx.fill(); });
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
  moon.scale.set(120, 120, 1); moon.position.set(-170, 190, -250); moon.renderOrder = -8; scene.add(moon); Wd.moon = moon;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,230,1)', 'rgba(255,220,120,0.5)'), color: 0xfff2b0, transparent: true, fog: false, depthWrite: false, opacity: 0 }));
  sun.scale.set(170, 170, 1); sun.position.set(120, 200, -260); sun.renderOrder = -8; scene.add(sun); Wd.sun = sun;

  /* ----- clouds & fog banks ----- */
  const cloudTex = canvasTex(256, 128, (ctx, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x = srange(40, 216), y = srange(40, 90), r = srange(18, 44);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0x39466f, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
    const a = srnd() * Math.PI * 2, d = srange(120, 330);
    m.position.set(Math.cos(a) * d, srange(70, 150), Math.sin(a) * d); m.scale.set(srange(160, 280), srange(60, 110), 1);
    m.userData.v = srange(0.8, 2.2); scene.add(m); Wd.clouds.push(m);
  }
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0x8da0c8, transparent: true, opacity: 0.2, depthWrite: false }));
    m.position.set(srange(-70, 70), srange(1.2, 2.8), srange(-75, 80)); m.scale.set(srange(30, 55), srange(7, 12), 1);
    m.userData.v = srange(0.3, 0.9); m.userData.base = m.position.x; scene.add(m); Wd.fogBanks.push(m);
  }

  /* ----- lights ----- */
  const hemi = new THREE.HemisphereLight(0x8fa8ff, 0x2f3b58, 1.0); scene.add(hemi);
  const moonL = new THREE.DirectionalLight(0xa8c0ff, 1.15);
  moonL.position.set(-40, 70, 30); moonL.castShadow = true;
  moonL.shadow.mapSize.set(1024, 1024); const sc = moonL.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 220; moonL.shadow.bias = -0.0006;
  scene.add(moonL); scene.add(moonL.target);
  const amb = new THREE.AmbientLight(0x6070a0, 0.25); scene.add(amb);
  const graveLight = new THREE.PointLight(ORANGE, 1.6, 26, 1.6); graveLight.position.set(0, 3, 0); scene.add(graveLight);
  Wd.lights = { hemi, moonL, amb, graveLight };

  /* ----- boundary walls ----- */
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xb0b8c8, roughness: 1 });
  function wall(cx, cz, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), wallMat);
    m.position.set(cx, 1.6, cz); m.castShadow = true; m.receiveShadow = true; scene.add(m); addBox(cx, cz, w / 2, d / 2);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), darkStone); cap.position.set(cx, 3.35, cz); scene.add(cap);
  }
  wall(0, BOUNDS.zMin - 0.5, BOUNDS.x * 2 + 2, 1.2);
  wall(-BOUNDS.x - 0.5, 0, 1.2, (BOUNDS.zMax - BOUNDS.zMin) + 2);
  wall(BOUNDS.x + 0.5, 0, 1.2, (BOUNDS.zMax - BOUNDS.zMin) + 2);
  wall(-33.6, BOUNDS.zMax + 0.5, 54.8, 1.2);
  wall(33.6, BOUNDS.zMax + 0.5, 54.8, 1.2);
  // wall posts with lantern orbs
  const orbMat = new THREE.MeshBasicMaterial({ color: 0xffa650 });
  function post(x, z, h) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), darkStone); p.position.set(x, h / 2, z); p.castShadow = true; scene.add(p);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.1, 4), darkStone); cap.position.set(x, h + 0.55, z); cap.rotation.y = Math.PI / 4; scene.add(cap);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), orbMat); orb.position.set(x, h + 1.4, z); scene.add(orb);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a40, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    s.scale.set(4.5, 4.5, 1); s.position.copy(orb.position); scene.add(s); Wd.dayHide.push(s.material); Wd.glows.push(s);
    addBox(x, z, 0.75, 0.75);
  }
  for (let x = -BOUNDS.x; x <= BOUNDS.x; x += 20) { post(x, BOUNDS.zMin - 0.5, 4.4); if (Math.abs(x) > 6) post(x, BOUNDS.zMax + 0.5, 4.4); }
  for (let z = BOUNDS.zMin + 20; z < BOUNDS.zMax; z += 20) { post(-BOUNDS.x - 0.5, z, 4.4); post(BOUNDS.x + 0.5, z, 4.4); }

  /* ----- gate ----- */
  const gz = BOUNDS.zMax + 0.5;
  [-5.2, 5.2].forEach(x => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), darkStone); p.position.set(x, 4, gz); p.castShadow = true; scene.add(p);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 2.6), stoneMats[0]); top.position.set(x, 8.3, gz); scene.add(top);
    const sk = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.8 })); sk.position.set(x, 9.2, gz); scene.add(sk);
    [-0.28, 0.28].forEach(ex => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), new THREE.MeshBasicMaterial({ color: ORANGE })); e.position.set(x + ex, 9.3, gz + 0.62); scene.add(e); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ORANGE, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
    s.scale.set(5, 5, 1); s.position.set(x, 9.3, gz + 0.7); scene.add(s); Wd.dayHide.push(s.material); Wd.glows.push(s);
    addBox(x, gz, 1.1, 1.1);
  });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.9, 1.2), darkStone); arch.position.set(0, 9.3, gz); scene.add(arch);
  const signTex = canvasTex(1024, 192, (ctx, w, h) => {
    ctx.fillStyle = '#17120e'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 22; ctx.fillStyle = '#ffb066'; ctx.font = 'bold 84px Georgia, serif'; ctx.fillText('HEMI’S GRAVEYARD', w / 2, h * 0.4);
    ctx.shadowBlur = 8; ctx.font = '34px Georgia, serif'; ctx.fillText('EST. 3026  ·  ABANDON ALL HOPE, YE WHO ENTER', w / 2, h * 0.78);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.8), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 11.0, gz + 0.1); scene.add(sign);
  const hinge = (side) => {
    const g = new THREE.Group(); g.position.set(side * 4.2, 0, gz);
    const w = 4.1;
    for (let i = 0; i <= 12; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.6 + (i % 2) * 0.5, 0.12), ironMat); b.position.set(-side * (0.1 + i * (w / 12)), 3.3 + (i % 2) * 0.25, 0); g.add(b);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 5), ironMat); sp.position.set(-side * (0.1 + i * (w / 12)), 6.8 + (i % 2) * 0.5, 0); g.add(sp);
    }
    [1.2, 3.4, 5.6].forEach(y => { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.16), ironMat); r.position.set(-side * w / 2, y, 0); g.add(r); });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 8, 24), ironMat); ring.position.set(-side * w / 2, 3.4, 0.05); g.add(ring);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(g); return g;
  };
  Wd.gate = { left: hinge(-1), right: hinge(1), z: gz, open: 0 };
  // closed gate collider (removed when opened)
  Wd.gateCollider = { minx: -4.3, maxx: 4.3, minz: gz - 0.3, maxz: gz + 0.3 };
  Wd.colliders.push(Wd.gateCollider);

  /* ----- plain graves ----- */
  const markers = [];
  function plainGrave(x, z, name, big) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const sm = stoneMats[rint(0, 2)], type = rint(0, 3), s = big ? 1.25 : srange(0.85, 1.15);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), moundMat); mound.scale.set(0.8 * s, 0.22, 1.7 * s); mound.position.set(0, 0.04, 1.2 * s); mound.receiveShadow = true; g.add(mound);
    let stone;
    if (type === 0) { stone = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.3), sm); b.position.y = 0.65; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), sm); t.rotation.x = Math.PI / 2; t.position.y = 1.3; stone.add(b, t); }
    else if (type === 1) { stone = new THREE.Group(); const v = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.7, 0.25), sm); v.position.y = 0.85; const h = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.26, 0.25), sm); h.position.y = 1.2; stone.add(v, h); }
    else if (type === 2) { stone = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.35), sm); stone.position.y = 0.4; }
    else { stone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 2.0, 4), sm); stone.position.y = 1.0; stone.rotation.y = Math.PI / 4; }
    stone.scale.setScalar(s); g.add(stone);
    stone.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (type !== 3 && type !== 1) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * s, 0.5 * s), new THREE.MeshStandardMaterial({ map: textPlate(name || 'R.I.P.', null, { size: name ? 80 : 90 }), roughness: 1 }));
      pl.position.set(0, type === 2 ? 0.42 * s : 0.75 * s, 0.19 * s); g.add(pl);
    } else if (name) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * s, 0.4 * s), new THREE.MeshStandardMaterial({ map: textPlate(name, null, { size: 80 }), roughness: 1 }));
      pl.position.set(0, 0.5 * s, 0.4 * s); pl.rotation.x = -0.5; g.add(pl);
    }
    g.rotation.y = srange(-0.25, 0.25); g.rotation.z = srange(-0.05, 0.05);
    scene.add(g); addCircle(x, z + 0.8, 1.1);
    Wd.graves.push({ x, z, name });
    return g;
  }

  /* ----- special (Hemi team) tombs ----- */
  const flowerCols = [0xff3b6b, 0xffd23f, 0xffffff, 0xff8a1f, 0xb06bff, 0xff5fa8];
  const flowerGeo = new THREE.SphereGeometry(0.085, 7, 6), stemGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.4, 4);
  const logoTex = (() => { const t = new THREE.TextureLoader().load(IMG.logo); t.encoding = THREE.sRGBEncoding; return t; })();
  const beamTex = canvasTex(8, 128, (ctx, w, h) => { const g = ctx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(255,150,40,0.85)'); g.addColorStop(0.5, 'rgba(255,110,10,0.35)'); g.addColorStop(1, 'rgba(255,90,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); });
  const discTex = canvasTex(256, 256, (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,140,30,0.85)'); g.addColorStop(0.5, 'rgba(255,100,10,0.35)'); g.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); });

  SPECIAL.forEach((sp, idx) => {
    const g = new THREE.Group(); g.position.set(sp.x, 0, sp.z);
    // face the road (towards x=0 spur): rotate so headstone is on the far side
    g.rotation.y = 0;
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 6.8), darkStone); base.position.y = 0.17; base.receiveShadow = true; base.castShadow = true; g.add(base);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 5.0), stoneMats[1]); body.position.y = 0.85; body.castShadow = true; body.receiveShadow = true; g.add(body);
    // glowing interior revealed when lid slides away
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.5), new THREE.MeshBasicMaterial({ color: 0x2a0d00 })); inner.rotation.x = -Math.PI / 2; inner.position.y = 1.36; g.add(inner);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.4, 5.2), stoneMats[0]); lid.position.y = 1.57; lid.castShadow = true; g.add(lid);
    const lidBase = lid.position.clone();
    // engraved cross ornament on lid
    const crossMat = new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.9 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 2.4), crossMat); c1.position.set(0, 0.23, 0); lid.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.16), crossMat); c2.position.set(0, 0.23, -0.55); lid.add(c2);
    // headstone with name
    const hs = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.0, 0.6), darkStone); hs.position.set(0, 2.35, -3.7); hs.castShadow = true; g.add(hs);
    const hsTop = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.6, 24), darkStone); hsTop.rotation.x = Math.PI / 2; hsTop.position.set(0, 4.35, -3.7); hsTop.castShadow = true; g.add(hsTop);
    const plateMat = new THREE.MeshBasicMaterial({ map: canvasTex(512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#14100d'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 26; ctx.fillStyle = '#ffc07a';
      let fs = 96; ctx.font = `bold ${fs}px Georgia, serif`; while (ctx.measureText(sp.name).width > w - 70) { fs -= 4; ctx.font = `bold ${fs}px Georgia, serif`; }
      ctx.fillText(sp.name, w / 2, h * 0.5); ctx.font = 'bold 44px Georgia, serif'; ctx.shadowBlur = 14; ctx.fillText('HEMI TEAM  ·  RANK #' + sp.rank, w / 2, h * 0.8);
    }) });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.8), plateMat); plate.position.set(0, 2.5, -3.39); g.add(plate);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })); logo.position.set(0, 3.65, -3.39); g.add(logo);
    // flowers (instanced)
    const N = 130, fl = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: 0x331100 }), N);
    const st = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: 0x2f6a2b, roughness: 1 }), N);
    const dm = new THREE.Object3D(), col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      let fx, fz; const side = srnd();
      if (side < 0.5) { const a = srnd() * 6.283, r = 3.2 + srnd() * 1.6; fx = Math.cos(a) * r * 0.95; fz = Math.sin(a) * r * 1.35; if (Math.abs(fx) < 1.9 && Math.abs(fz) < 3.6) { fx *= 1.6; } }
      else { fx = srange(-2.6, 2.6); fz = srange(3.2, 4.4) * (srnd() < 0.5 ? 1 : 1); }
      const fy = 0.42; dm.position.set(fx, fy + 0.2, fz); dm.scale.setScalar(srange(0.8, 1.3)); dm.updateMatrix(); fl.setMatrixAt(i, dm.matrix);
      fl.setColorAt(i, col.setHex(flowerCols[rint(0, flowerCols.length - 1)]));
      dm.position.set(fx, fy, fz); dm.scale.set(1, 1, 1); dm.updateMatrix(); st.setMatrixAt(i, dm.matrix);
    }
    fl.instanceMatrix.needsUpdate = true; if (fl.instanceColor) fl.instanceColor.needsUpdate = true; st.instanceMatrix.needsUpdate = true;
    g.add(fl, st);
    // candles
    [[-2.1, 3.0], [2.1, 3.0], [-2.1, -2.2], [2.1, -2.2]].forEach(c => {
      const cd = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 })); cd.position.set(c[0], 0.6, c[1]); g.add(cd);
      const fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      fs.scale.set(0.9, 0.9, 1); fs.position.set(c[0], 1.0, c[1]); g.add(fs); Wd.flames.push(fs);
    });
    // glow on ground + halo + beam
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; g.add(disc); Wd.dayHide.push(disc.material);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: ORANGE, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    halo.scale.set(14, 10, 1); halo.position.set(0, 3, 0); g.add(halo); Wd.dayHide.push(halo.material);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 90, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.y = 45; beam.visible = false; g.add(beam);
    scene.add(g);
    addBox(sp.x, sp.z - 0.4, 2.4, 3.8);
    const tomb = { idx, name: sp.name, rank: sp.rank, x: sp.x, z: sp.z, group: g, lid, lidBase, inner, disc, halo, beam, plate, state: 'locked', open: 0, glow: 0.5, innerMat: inner.material, crossMat };
    Wd.specials.push(tomb);
  });

  /* ----- community graves (plain, with names) ----- */
  const spots = [[-14, 44], [12, 52], [-20, 20], [20, 24], [14, -6], [-16, -30], [-14, 2], [14, -24],
    [-28, 52], [28, 42], [26, -18], [-26, -46], [16, -46], [-40, 10], [42, 28], [-12, -48]];
  COMMUNITY.forEach((nm, i) => { const p = spots[i]; plainGrave(p[0], p[1], nm, true); Wd.communityGraves.push({ x: p[0], z: p[1], name: nm }); });
  // random anonymous graves
  let tries = 0, count = 0;
  while (count < 64 && tries < 2000) {
    tries++;
    const x = srange(-BOUNDS.x + 4, BOUNDS.x - 4), z = srange(BOUNDS.zMin + 5, BOUNDS.zMax - 6);
    if (nearRoad(x, z, 3.2)) continue;
    if (SPECIAL.some(s => Math.hypot(x - s.x, z - s.z) < (s.rank === 1 ? 22 : 13))) continue;
    if (Wd.graves.some(g => Math.hypot(x - g.x, z - g.z) < 5)) continue;
    plainGrave(x, z, null, false); count++;
  }

  /* ----- dead trees ----- */
  function deadTree(x, z, s) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.42 * s, 6 * s, 7), barkMat); trunk.position.y = 3 * s; trunk.castShadow = true; g.add(trunk);
    const nb = rint(5, 8);
    for (let i = 0; i < nb; i++) {
      const len = srange(1.6, 3.4) * s, br = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.14 * s, len, 5), barkMat);
      const a = srnd() * 6.283, y = srange(2.6, 5.6) * s, tilt = srange(0.6, 1.25);
      br.position.set(Math.cos(a) * Math.sin(tilt) * len / 2, y + Math.cos(tilt) * len / 2, Math.sin(a) * Math.sin(tilt) * len / 2);
      br.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt); br.castShadow = true; g.add(br);
      if (srnd() < 0.7) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.07 * s, len * 0.6, 4), barkMat); tw.position.set(br.position.x * 1.8, br.position.y + len * 0.3, br.position.z * 1.8); tw.rotation.set(br.rotation.x * 1.3, 0, br.rotation.z * 1.3); g.add(tw); }
    }
    g.rotation.y = srnd() * 6; scene.add(g); addCircle(x, z, 0.6 * s); Wd.trees.push(g);
  }
  tries = 0; count = 0;
  while (count < 34 && tries < 1500) {
    tries++;
    const edge = srnd() < 0.55;
    const x = edge ? (srnd() < 0.5 ? -1 : 1) * srange(BOUNDS.x - 7, BOUNDS.x - 2) : srange(-BOUNDS.x + 5, BOUNDS.x - 5);
    const z = edge ? srange(BOUNDS.zMin + 4, BOUNDS.zMax - 5) : srange(BOUNDS.zMin + 5, BOUNDS.zMax - 8);
    if (nearRoad(x, z, 2.5)) continue;
    if (SPECIAL.some(s => Math.hypot(x - s.x, z - s.z) < (s.rank === 1 ? 24 : 14))) continue;
    if (Wd.graves.some(g => Math.hypot(x - g.x, z - g.z) < 3.5)) continue;
    deadTree(x, z, srange(0.9, 1.5)); count++;
  }
  // outside-the-wall silhouettes (distant trees and hills)
  for (let i = 0; i < 40; i++) {
    const a = srnd() * 6.283, d = srange(95, 200);
    const t = new THREE.Mesh(new THREE.ConeGeometry(srange(4, 8), srange(14, 28), 7), new THREE.MeshStandardMaterial({ color: 0x1d2a32, roughness: 1 }));
    t.position.set(Math.cos(a) * d, t.geometry.parameters.height / 2, Math.sin(a) * d); scene.add(t);
    if (Math.abs(Math.cos(a) * d) < 60 && Math.sin(a) * d > 0 && Math.sin(a) * d < 100 && Math.abs(Math.cos(a) * d) < 16) t.visible = false; // keep the road clear
  }

  /* ----- lantern posts along the main road ----- */
  for (let z = 84; z > -44; z -= 14) [-3.2, 3.2].forEach(x => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), ironMat); pole.position.set(x, 1.3, z); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb870 })); lamp.position.set(x, 2.75, z); scene.add(lamp);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa550, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    s.scale.set(3.4, 3.4, 1); s.position.copy(lamp.position); scene.add(s); Wd.dayHide.push(s.material); Wd.flames.push(s);
    addCircle(x, z, 0.2);
  });

  /* ----- floating wisps (ambient particles) ----- */
  const wc = 260, wg = new THREE.BufferGeometry(), wp = new Float32Array(wc * 3);
  for (let i = 0; i < wc; i++) { wp[i * 3] = srange(-65, 65); wp[i * 3 + 1] = srange(0.3, 9); wp[i * 3 + 2] = srange(-72, 80); }
  wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
  const wisps = new THREE.Points(wg, new THREE.PointsMaterial({ map: glowTex, color: 0x9fd0ff, size: 0.9, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(wisps); Wd.wisps = wisps;

  /* ----- golden ticket (spawned hidden) ----- */
  const tk = new THREE.Group();
  const tshape = new THREE.Shape(), tw = 1.5, th = 0.8, rr = 0.12;
  tshape.moveTo(-tw + rr, -th); tshape.lineTo(tw - rr, -th); tshape.quadraticCurveTo(tw, -th, tw, -th + rr); tshape.lineTo(tw, th - rr); tshape.quadraticCurveTo(tw, th, tw - rr, th);
  tshape.lineTo(-tw + rr, th); tshape.quadraticCurveTo(-tw, th, -tw, th - rr); tshape.lineTo(-tw, -th + rr); tshape.quadraticCurveTo(-tw, -th, -tw + rr, -th);
  const tgeo = new THREE.ExtrudeGeometry(tshape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }); tgeo.translate(0, 0, -0.06);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc93a, emissive: 0xffa000, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.25 });
  tk.add(new THREE.Mesh(tgeo, gold));
  const ttex = canvasTex(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffe58a'); g.addColorStop(0.5, '#ffbf2e'); g.addColorStop(1, '#ffe58a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 5; ctx.setLineDash([14, 8]); ctx.strokeRect(14, 14, w - 28, h - 28); ctx.setLineDash([]);
    ctx.fillStyle = '#5a3600'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 58px Georgia, serif'; ctx.fillText('GOLDEN TICKET', w / 2, 72); ctx.font = 'bold 84px Georgia, serif'; ctx.fillText('1,000,000', w / 2, 145); ctx.font = 'bold 44px Georgia, serif'; ctx.fillText('BITCOIN  ·  HEMI', w / 2, 212);
  });
  [0.1, -0.1].forEach((zz, i) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(tw * 2 - 0.2, th * 2 - 0.2), new THREE.MeshBasicMaterial({ map: ttex })); f.position.z = zz * 1.05; if (i) f.rotation.y = Math.PI; tk.add(f); });
  const tglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd25a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  tglow.scale.set(9, 9, 1); tk.add(tglow);
  const tbeam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 80, 16, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xffe080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  tbeam.position.y = 38; tk.add(tbeam);
  tk.visible = false; scene.add(tk); Wd.ticket = tk;

  return Wd;
}

