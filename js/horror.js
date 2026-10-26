/* ===== Hemi's Graveyard — horror props: dolls, dead bodies, broken Bitcoin & Ethereum monuments, extra fog ===== */
function buildHorror(scene, Wd) {
  const glow = glowTexture();
  const addCircle = (x, z, r) => Wd.circles.push({ x, z, r });
  Wd.monuments = []; Wd.dolls = []; Wd.hangers = []; Wd.floaters = []; Wd.sparkSprites = [];

  /* ---------- extra low fog banks (rolling mist near the ground) ---------- */
  const mistTex = canvasTex(256, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(210,220,240,0.55)'); g.addColorStop(0.5, 'rgba(180,195,225,0.22)'); g.addColorStop(1, 'rgba(160,175,210,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: 0xaab6d6, transparent: true, opacity: 0.32, depthWrite: false }));
    const s = srange(14, 30); m.scale.set(s, s * 0.32, 1);
    m.position.set(srange(-70, 70), srange(0.7, 1.8), srange(-72, 92));
    m.userData.v = srange(0.25, 0.9) * (srnd() < 0.5 ? 1 : -1); m.userData.base = m.position.x; m.userData.low = true;
    scene.add(m); Wd.fogBanks.push(m);
  }

  /* ---------- DOLLS ---------- */
  const faceTex = canvasTex(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#d8ccbb'; ctx.beginPath(); ctx.arc(64, 64, 62, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.7)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); let x = srange(20, 108), y = srange(10, 40); ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += srange(-10, 10); y += srange(6, 14); ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.ellipse(40, 56, 14, 17, 0, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(90, 52, 11, 13, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#d8d0c0'; ctx.beginPath(); ctx.arc(43, 52, 3, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#7a0a0a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(40, 74); ctx.lineTo(36, 108); ctx.moveTo(90, 66); ctx.lineTo(94, 104); ctx.stroke(); // blood tears
    ctx.fillStyle = '#8a0f12'; ctx.fillRect(32, 96, 66, 6);
    ctx.strokeStyle = '#220000'; ctx.lineWidth = 2; for (let x = 34; x < 98; x += 8) { ctx.beginPath(); ctx.moveTo(x, 90); ctx.lineTo(x + 2, 110); ctx.stroke(); } // stitched mouth
    ctx.fillStyle = 'rgba(110,0,0,0.5)'; ctx.beginPath(); ctx.arc(26, 78, 9, 0, 6.283); ctx.fill();
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xcdbfae, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 1 });
  const dressCols = [0x6b1414, 0xb8b0a0, 0x1c2540, 0x4a3a2a, 0x8c8478];

  function makeDoll(dressCol) {
    const g = new THREE.Group();
    const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.3, 0.55, 10), new THREE.MeshStandardMaterial({ color: dressCol, roughness: 1 })); dress.position.y = 0.42; g.add(dress);
    [-0.07, 0.07].forEach(x => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), skinMat); l.position.set(x, 0.1, 0); g.add(l); });
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 6), skinMat); a1.position.set(0.24, 0.62, 0.05); a1.rotation.z = -1.1; g.add(a1); // one arm reaching, the other torn off
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x2a0606 })); stump.position.set(-0.13, 0.64, 0); stump.rotation.z = 1.1; g.add(stump);
    const head = new THREE.Group(); head.position.y = 0.88; g.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skinMat));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.9, emissive: 0x201010, emissiveMap: faceTex })); face.position.z = 0.175; head.add(face);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 8, 0, 6.283, 0, 1.15), hairMat); hair.position.set(0, 0.01, -0.02); head.add(hair);
    [-1, 1].forEach(s => { const pg = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 6), hairMat); pg.position.set(s * 0.2, -0.12, -0.02); pg.rotation.z = s * 0.25; pg.rotation.x = Math.PI; head.add(pg); });
    [-0.07, 0.065].forEach((x, i) => { const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff1a1a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.0 })); e.scale.set(0.16, 0.16, 1); e.position.set(x, 0.03 - i * 0.01, 0.2); head.add(e); (head.userData.eyes = head.userData.eyes || []).push(e); });
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { g, head };
  }
  function placeDoll(x, z, scale, tilt) {
    const d = makeDoll(dressCols[rint(0, dressCols.length - 1)]);
    d.g.position.set(x, 0, z); d.g.scale.setScalar(scale || 1.7); d.g.rotation.y = srnd() * 6.283; d.g.rotation.z = tilt || srange(-0.18, 0.18);
    scene.add(d.g); Wd.dolls.push({ x, z, g: d.g, head: d.head, triggered: false, eyeOn: 0 });
    addCircle(x, z, 0.35 * (scale || 1.7));
  }
  function hangDoll(x, z, y) {
    const d = makeDoll(dressCols[rint(0, dressCols.length - 1)]);
    const pivot = new THREE.Group(); pivot.position.set(x, y, z);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0x3a2a18 })); rope.position.y = -0.7; pivot.add(rope);
    d.g.scale.setScalar(2.2); d.g.position.set(0, -1.4 - 1.9, 0); d.g.rotation.x = 0; pivot.add(d.g);
    scene.add(pivot); Wd.hangers.push({ pivot, ph: srnd() * 6, x, z, head: d.head });
  }
  // entrance dolls (first thing the player sees) + scattered ones
  [[-5.6, 60], [6.0, 40], [-5.4, 24], [5.8, 2]].forEach(p => placeDoll(p[0], p[1], 2.3));
  let tries = 0, cnt = 0;
  while (cnt < 9 && tries < 800) {
    tries++;
    const x = srange(-BOUNDS.x + 6, BOUNDS.x - 6), z = srange(BOUNDS.zMin + 6, BOUNDS.zMax - 10);
    if (nearRoad(x, z, 3) || SPECIAL.some(s => Math.hypot(x - s.x, z - s.z) < 9)) continue;
    if (Wd.graves.some(g => Math.hypot(x - g.x, z - g.z) < 3) || Wd.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 1.5)) continue;
    placeDoll(x, z, srange(2.0, 2.6)); cnt++;
  }
  [0, 1, 2, 5, 8].slice(0, 3).forEach(i => { if (Wd.dolls[i]) { Wd.dolls[i].laugher = true; Wd.dolls[i].laughT = 0; } }); // only 3 dolls laugh
  Wd.trees.filter((t, i) => i % 5 === 1).slice(0, 6).forEach(t => hangDoll(t.position.x + 1.1, t.position.z, 5.4));

  /* ---------- DEAD BODIES ---------- */
  const rag = [0x4a1a1a, 0x1c2a44, 0x3a3326, 0x2a2a30, 0x5a4a3a];
  const bloodMat = new THREE.MeshBasicMaterial({ color: 0x4a0707, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  function makeBody(shirt, pants) {
    const f = new THREE.Group();
    const sm = new THREE.MeshStandardMaterial({ color: shirt, roughness: 1 }), pm = new THREE.MeshStandardMaterial({ color: pants, roughness: 1 }), fl = new THREE.MeshStandardMaterial({ color: 0x8d9a86, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.24), sm); torso.position.y = 1.15; f.add(torso);
    const pel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.22), pm); pel.position.y = 0.72; f.add(pel);
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.7, 0.18), pm); l1.position.set(-0.11, 0.3, 0); f.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.7, 0.18), pm); l2.position.set(0.15, 0.3, 0); l2.rotation.z = -0.35; f.add(l2);
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), sm); a1.position.set(-0.33, 1.1, 0); a1.rotation.z = 0.25; f.add(a1);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), sm); a2.position.set(0.4, 1.3, 0.1); a2.rotation.z = -1.0; a2.rotation.x = -0.4; f.add(a2);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), fl); hd.position.y = 1.6; f.add(hd);
    [-0.05, 0.05].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0x050505 })); e.position.set(x, 1.62, 0.12); f.add(e); });
    const wound = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.02), new THREE.MeshBasicMaterial({ color: 0x5a0808 })); wound.position.set(0.06, 1.2, 0.125); f.add(wound);
    f.rotation.x = -Math.PI / 2; f.position.y = 0.12;
    const o = new THREE.Group(); o.add(f); o.userData.fig = f;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 14), bloodMat); pool.rotation.x = -Math.PI / 2; pool.position.set(0.05, 0.045, -0.9); pool.scale.set(1.2, 1, 1.5); o.add(pool);
    o.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return o;
  }
  Wd.zombies = []; Wd.bodies = [];
  function placeBody(x, z, rot, riser) {
    const b = makeBody(rag[rint(0, rag.length - 1)], rag[rint(0, rag.length - 1)]);
    b.position.set(x, 0, z); b.scale.setScalar(1.3); b.rotation.y = rot == null ? srnd() * 6.283 : rot; scene.add(b); Wd.bodies.push(b);
    if (riser) { Wd.zombies.push({ o: b, fig: b.userData.fig, x, z, state: 'sleep', t: 0, hp: 70, atk: 0, groan: 3 }); }
    else addCircle(x, z, 0.8);
  }
  [[5.8, 64, 0.4, 0], [-6.2, 46, 2.2, 1], [6.4, 20, 1.1, 1], [-6.0, 8, 0.2, 1], [5.4, -18, 2.8, 0]].forEach(p => placeBody(p[0], p[1], p[2], p[3]));
  tries = 0; cnt = 0;
  while (cnt < 14 && tries < 1000) {
    tries++;
    const x = srange(-BOUNDS.x + 5, BOUNDS.x - 5), z = srange(BOUNDS.zMin + 6, BOUNDS.zMax - 10);
    if (nearRoad(x, z, 3) || SPECIAL.some(s => Math.hypot(x - s.x, z - s.z) < (s.rank === 1 ? 14 : 9))) continue;
    if (Wd.graves.some(g => Math.hypot(x - g.x, z - g.z) < 3.2) || Wd.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 1.6)) continue;
    placeBody(x, z); cnt++;
  }

  /* ---------- BROKEN BITCOIN ---------- */
  const btcTex = canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); g.addColorStop(0, '#d9a21c'); g.addColorStop(0.8, '#8a5a08'); g.addColorStop(1, '#3a2504');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4a3004'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(w / 2, h / 2, 112, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#4a3004'; ctx.font = 'bold 170px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', w / 2, h / 2 + 8);
    ctx.fillRect(w / 2 - 22, 34, 8, 30); ctx.fillRect(w / 2 + 12, 34, 8, 30); ctx.fillRect(w / 2 - 22, 192, 8, 30); ctx.fillRect(w / 2 + 12, 192, 8, 30);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${srnd() < 0.5 ? '0,0,0' : '255,220,150'},${srnd() * 0.18})`; ctx.fillRect(srnd() * w, srnd() * h, srange(1, 5), srange(1, 5)); }
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 7; i++) { ctx.beginPath(); let x = srnd() * w, y = srnd() * h; ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { x += srange(-20, 20); y += srange(-20, 20); ctx.lineTo(x, y); } ctx.stroke(); }
  });
  const btcFace = new THREE.MeshStandardMaterial({ map: btcTex, metalness: 0.55, roughness: 0.55, emissive: 0x3a1c00, emissiveIntensity: 0.7 });
  const btcSide = new THREE.MeshStandardMaterial({ color: 0x6a4a0c, metalness: 0.7, roughness: 0.6 });
  const crackMat = new THREE.MeshStandardMaterial({ color: 0x1a1006, roughness: 1 });
  function brokenBitcoin(x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const R = 2.7, T = 0.55;
    function half(start) {
      const geo = new THREE.CylinderGeometry(R, R, T, 28, 1, false, start, Math.PI); geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, [btcSide, btcFace, btcFace]); m.castShadow = true;
      const edge = new THREE.Group(); edge.add(m);
      // jagged fracture along the straight cut
      for (let i = -4; i <= 4; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, srange(0.3, 0.7), 4), crackMat); sp.position.set((start === 0 ? 0 : 0), i * 0.58, 0); sp.rotation.z = start === 0 ? -Math.PI / 2 : Math.PI / 2; sp.position.x = start === 0 ? -0.05 : 0.05; edge.add(sp); }
      const cut = new THREE.Mesh(new THREE.BoxGeometry(0.08, R * 2, T), crackMat); edge.add(cut);
      return edge;
    }
    const a = half(0), b = half(Math.PI);
    a.position.set(-0.1, 2.2, 0); a.rotation.z = 0.22; a.rotation.y = 0.2; g.add(a);               // upright, leaning
    b.position.set(3.4, 0.55, 1.6); b.rotation.set(-1.25, 0.6, 1.1); g.add(b);                       // fallen piece
    for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(srange(0.25, 0.6), 0), crackMat); r.position.set(srange(-2.4, 4.2), 0.2, srange(-1.8, 2.6)); r.rotation.set(srnd() * 3, srnd() * 3, srnd() * 3); g.add(r); }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff8a10, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 })); gl.scale.set(11, 9, 1); gl.position.set(0, 2.6, 0.8); g.add(gl); Wd.flames.push(gl); Wd.dayHide.push(gl.material);
    scene.add(g); Wd.monuments.push(g); addCircle(x, z, 2.9);
    const wz = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: textPlate('BTC', null, { bg: '#1a1208', color: '#c98a10', size: 64 }) })); wz.position.set(0, 0.35, 2.2); wz.rotation.x = -0.4; g.add(wz);
  }

  /* ---------- BROKEN ETHEREUM ---------- */
  const ethMat = new THREE.MeshStandardMaterial({ color: 0x4d5a7e, metalness: 0.75, roughness: 0.3, flatShading: true, emissive: 0x161e48, emissiveIntensity: 0.9 });
  const ethDark = new THREE.MeshStandardMaterial({ color: 0x1d2236, metalness: 0.5, roughness: 0.6, flatShading: true });
  function brokenEth(x, z, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const lower = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.3, 4), ethMat); lower.rotation.x = Math.PI; lower.position.set(0, 2.4, 0); lower.rotation.z = 0.18; lower.rotation.y = Math.PI / 4; lower.castShadow = true; g.add(lower);
    const lowerCap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), ethDark); lowerCap.position.set(0, 4.55, 0); lowerCap.rotation.y = Math.PI / 4; lowerCap.rotation.z = 0.18; g.add(lowerCap);
    const upper = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.8, 4), ethMat); upper.position.set(3.3, 0.95, 1.2); upper.rotation.set(1.2, 0.5, 1.1); upper.castShadow = true; g.add(upper); // snapped-off top lies on the ground
    for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(srange(0.3, 0.7), 0), ethDark); r.position.set(srange(-2.2, 2.2), 0.2, srange(-2.2, 2.2)); r.rotation.set(srnd() * 3, srnd() * 3, srnd() * 3); g.add(r); }
    for (let i = 0; i < 6; i++) {
      const sh = new THREE.Mesh(new THREE.OctahedronGeometry(srange(0.2, 0.45), 0), ethMat); sh.position.set(srange(-2, 2), srange(3.5, 7.0), srange(-2, 2)); g.add(sh);
      Wd.floaters.push({ m: sh, y: sh.position.y, ph: srnd() * 6.28, sp: srange(0.5, 1.2) });
    }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x6a7cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 })); gl.scale.set(10, 10, 1); gl.position.set(0, 3.2, 0); g.add(gl); Wd.flames.push(gl); Wd.dayHide.push(gl.material);
    scene.add(g); Wd.monuments.push(g); addCircle(x, z, 2.4); addCircle(x + 3.3 * Math.cos(rot), z - 3.3 * Math.sin(rot), 1.6);
  }

  /* ---------- GHOSTS FLOATING IN THE SKY ---------- */
  Wd.skyGhosts = [];
  const sgMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.34, depthWrite: false, fog: false });
  const sgDark = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(ghostBodyGeo(), sgMat); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), sgMat); head.position.y = 1.95; g.add(head);
    [-0.15, 0.15].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), sgDark); e.scale.set(1, 1.5, 0.6); e.position.set(x, 2.02, 0.37); g.add(e); });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), sgDark); mouth.scale.set(1, 1.7, 0.6); mouth.position.set(0, 1.74, 0.38); g.add(mouth);
    [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.0, 6), sgMat); a.position.set(s * 0.5, 1.35, 0.1); a.rotation.z = s * 1.0; g.add(a); });
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x9fc0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25, fog: false })); gl.scale.set(5, 5, 1); gl.position.y = 1.2; g.add(gl);
    const sc = srange(3.2, 5.6); g.scale.setScalar(sc);
    const o = { g, r: srange(25, 85), a: srnd() * 6.283, sp: srange(0.03, 0.09) * (srnd() < 0.5 ? 1 : -1), y: srange(14, 38), ph: srnd() * 6.28 };
    g.position.set(Math.cos(o.a) * o.r, o.y, Math.sin(o.a) * o.r); scene.add(g); Wd.skyGhosts.push(o);
  }

  brokenBitcoin(-46, 54, 0.4); brokenEth(46, 52, 2.4);
  brokenBitcoin(46, -8, 3.6); brokenEth(-46, -36, 0.9);
  brokenBitcoin(-18, -60, 1.9); brokenEth(22, -60, 5.0);
  brokenEth(-22, 62, 0.3); brokenBitcoin(24, 64, 4.4);
}

/* per-frame animation for the horror props */
function updateHorror(Wd, t, dt, px, pz) {
  Wd.hangers.forEach(h => { h.pivot.rotation.z = Math.sin(t * 0.9 + h.ph) * 0.12; h.pivot.rotation.x = Math.cos(t * 0.7 + h.ph) * 0.08; });
  Wd.floaters.forEach(f => { f.m.position.y = f.y + Math.sin(t * f.sp + f.ph) * 0.35; f.m.rotation.y += dt * 0.6; f.m.rotation.x += dt * 0.3; });
  Wd.dolls.forEach(d => {
    const dx = px - d.x, dz = pz - d.z, dist = Math.hypot(dx, dz);
    if (dist < 30) { // the head slowly turns to watch you
      const want = Math.atan2(dx, dz) - d.g.rotation.y, cur = d.head.rotation.y;
      let da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); d.head.rotation.y = cur + da * Math.min(1, dt * 1.6);
    }
    const eyeT = dist < 16 ? 0.9 : 0; d.eyeOn += (eyeT - d.eyeOn) * Math.min(1, dt * 3);
    if (d.head.userData.eyes) d.head.userData.eyes.forEach(e => e.material.opacity = d.eyeOn);
  });
  Wd.hangers.forEach(h => {
    const dist = Math.hypot(px - h.x, pz - h.z);
    if (h.head.userData.eyes) h.head.userData.eyes.forEach(e => e.material.opacity = dist < 16 ? 0.9 : 0);
  });
}

/* sky ghosts drift in slow circles and always face the player */
function updateSkyGhosts(Wd, t, dt, px, pz) {
  Wd.skyGhosts.forEach(o => {
    o.a += o.sp * dt; const g = o.g;
    g.position.set(Math.cos(o.a) * o.r, o.y + Math.sin(t * 0.7 + o.ph) * 1.6, Math.sin(o.a) * o.r);
    g.rotation.y = Math.atan2(px - g.position.x, pz - g.position.z);
    g.rotation.z = Math.sin(t * 0.5 + o.ph) * 0.12;
  });
}

/* show / hide every horror prop (hidden behind the lobby menu so it does not reveal the game) */
function setHorrorVisible(Wd, v) {
  Wd.skyGhosts.forEach(o => o.g.visible = v);
  Wd.dolls.forEach(d => d.g.visible = v);
  Wd.hangers.forEach(h => h.pivot.visible = v);
  Wd.bodies.forEach(b => b.visible = v);
  Wd.monuments.forEach(m => m.visible = v);
  Wd.fogBanks.forEach(f => { if (f.userData.low) f.visible = v; });
}
