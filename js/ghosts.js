/* ===== Hemi's Graveyard — ghost, boss and projectile models ===== */
const FaceTex = {};
function loadFaces() {
  const L = new THREE.TextureLoader();
  ['rick', 'koala'].forEach(k => {
    const t = L.load(IMG[k]); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; FaceTex[k] = t;
  });
}

const GHOST_PROFILE = [[0.03, 0], [0.11, 0.16], [0.19, 0.32], [0.27, 0.52], [0.35, 0.78], [0.40, 1.02], [0.42, 1.26], [0.38, 1.5], [0.27, 1.72]];
function ghostBodyGeo() {
  const pts = new THREE.SplineCurve(GHOST_PROFILE.map(p => new THREE.Vector2(p[0], p[1]))).getPoints(22);
  return new THREE.LatheGeometry(pts, 22);
}
const SHARED = { glowTex: null };
function glowSprite(color, scale, opacity) {
  if (!SHARED.glowTex) SHARED.glowTex = glowTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHARED.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: opacity == null ? 0.6 : opacity }));
  s.scale.set(scale, scale, 1); return s;
}
function ghostMat(emissive, opacity) {
  return new THREE.MeshStandardMaterial({ color: 0xf6f9ff, emissive, emissiveIntensity: 0.62, transparent: true, opacity, roughness: 0.55, metalness: 0 });
}

/* kind: 'clone' | 'rick' */
function makeGhost(kind) {
  const isRick = kind === 'rick';
  const S = isRick ? 1.6 : 1.0;
  const group = new THREE.Group();
  const inner = new THREE.Group(); group.add(inner);
  const mat = ghostMat(isRick ? 0xffd9b0 : 0xb5d9ff, isRick ? 0.92 : 0.82);
  const geo = ghostBodyGeo();
  const base = geo.attributes.position.array.slice();
  const body = new THREE.Mesh(geo, mat); inner.add(body);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), mat); head.position.set(0, 1.95, 0); inner.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: isRick ? 0xffb070 : 0xaed4ff, transparent: true, opacity: 0.22, depthWrite: false })); hood.position.set(0, 1.97, -0.03); inner.add(hood);
  const face = curvedFace(FaceTex.rick, 0.74, 0.74 / 0.69, 0.16); face.position.set(0, 2.0, 0.24); inner.add(face);
  // arms
  const armGeo = new THREE.CylinderGeometry(0.07, 0.12, 0.8, 8); armGeo.translate(0, -0.4, 0);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group(); a.position.set(s * 0.42, 1.38, 0.05);
    const m = new THREE.Mesh(armGeo, mat); a.add(m);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), mat); hand.position.y = -0.86; a.add(hand);
    a.rotation.z = s * 0.7; inner.add(a); return a;
  });
  const aura = glowSprite(isRick ? 0xff8a30 : 0x8cc8ff, 3.6, isRick ? 0.55 : 0.4); aura.position.set(0, 1.1, 0); inner.add(aura);
  inner.scale.setScalar(S);
  const gh = {
    kind, S, group, inner, body, base, arms, face, aura, mat, faceMat: face.material, head, hood,
    hp: 1, maxHp: 1, dead: false, spawnT: 0, hitFlash: 0, atkCd: 1 + Math.random(), phase: Math.random() * 6.28,
    vx: 0, vz: 0, yaw: 0, hover: 0.55 + Math.random() * 0.2, tele: 0, shootCd: 2.5
  };
  return gh;
}

function animateGhost(gh, t, dt) {
  // wavy tail
  const pos = gh.body.geometry.attributes.position, b = gh.base;
  for (let i = 0; i < pos.count; i++) {
    const bx = b[i * 3], by = b[i * 3 + 1], bz = b[i * 3 + 2];
    const k = Math.max(0, 1 - by / 1.35), k2 = k * k;
    const ph = t * 3 + by * 4.2 + gh.phase;
    pos.setX(i, bx + Math.sin(ph) * 0.13 * k2);
    pos.setZ(i, bz + Math.cos(ph * 0.9) * 0.13 * k2);
  }
  pos.needsUpdate = true;
  gh.arms[0].rotation.z = -0.7 - Math.sin(t * 2.2 + gh.phase) * 0.35;
  gh.arms[1].rotation.z = 0.7 + Math.sin(t * 2.2 + gh.phase + 1) * 0.35;
  gh.arms[0].rotation.x = Math.sin(t * 1.7 + gh.phase) * 0.3;
  gh.arms[1].rotation.x = Math.cos(t * 1.7 + gh.phase) * 0.3;
}

function ghostVolumes(gh, out) {
  const p = gh.group.position, S = gh.S, y0 = p.y;
  out.length = 0;
  out.push({ x: p.x, y: y0 + 1.98 * S, z: p.z, r: 0.5 * S, head: true });
  out.push({ x: p.x, y: y0 + 1.2 * S, z: p.z, r: 0.5 * S, head: false });
  out.push({ x: p.x, y: y0 + 0.55 * S, z: p.z, r: 0.38 * S, head: false });
  return out;
}

/* ---------- BOSS: three-headed Rick/Koala ghost with legs ---------- */
function makeBoss() {
  const group = new THREE.Group();
  const inner = new THREE.Group(); group.add(inner);
  const mat = ghostMat(0xffe0c8, 0.94);
  const furMat = new THREE.MeshStandardMaterial({ color: 0x9a9aa4, emissive: 0x555560, emissiveIntensity: 0.35, roughness: 1 });
  // torso
  const tPts = new THREE.SplineCurve([[0.01, 3.0], [1.1, 3.2], [1.6, 4.0], [2.0, 5.0], [1.9, 5.8], [1.3, 6.3], [0.01, 6.5]].map(p => new THREE.Vector2(p[0], p[1]))).getPoints(20);
  const torsoGeo = new THREE.LatheGeometry(tPts, 24), tBase = torsoGeo.attributes.position.array.slice();
  const torso = new THREE.Mesh(torsoGeo, mat); inner.add(torso);
  // legs (pivot at hip)
  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.95, 3.2, 0);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.8, 10), mat); up.position.y = -0.85; hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -1.7; hip.add(knee);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 1.5, 10), mat); lo.position.y = -0.7; knee.add(lo);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat); foot.scale.set(0.9, 0.5, 1.5); foot.position.set(0, -1.45, 0.35); knee.add(foot);
    inner.add(hip); return { hip, knee };
  });
  // arms
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * 2.0, 5.5, 0.2);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 1.9, 10), mat); up.position.y = -0.9; sh.add(up);
    const el = new THREE.Group(); el.position.y = -1.8; sh.add(el);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 1.7, 10), mat); lo.position.y = -0.8; el.add(lo);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat); fist.position.y = -1.75; el.add(fist);
    sh.rotation.z = s * 0.35; inner.add(sh); return { sh, el, s };
  });
  // heads
  const heads = [];
  const rickGroup = new THREE.Group(); rickGroup.position.set(0, 7.35, 0.2);
  const rs = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 16), mat); rickGroup.add(rs);
  const rf = curvedFace(FaceTex.rick, 1.9, 1.9 / 0.69, 0.4); rf.position.set(0, 0.2, 0.7); rickGroup.add(rf);
  const rh = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff9a50, transparent: true, opacity: 0.2, depthWrite: false })); rickGroup.add(rh);
  inner.add(rickGroup); heads.push({ g: rickGroup, face: rf, kind: 'rick' });
  [-1, 1].forEach(s => {
    const kg = new THREE.Group(); kg.position.set(s * 3.1, 6.7, 0.2);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.4, 10), mat); neck.position.set(-s * 1.35, -1.0, -0.2); neck.rotation.z = s * 1.0; kg.add(neck);
    const ks = new THREE.Mesh(new THREE.SphereGeometry(1.2, 18, 14), furMat); ks.position.z = -0.1; kg.add(ks);
    const kf = curvedFace(FaceTex.koala, 3.5, 3.5 / 0.82, 0.55); kf.position.set(0, 0.1, 0.55); kg.add(kf);
    const kh = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.1, depthWrite: false })); kg.add(kh);
    inner.add(kg); heads.push({ g: kg, face: kf, kind: 'koala', s });
  });
  const aura = glowSprite(0xff4a20, 22, 0.5); aura.position.set(0, 4.5, -0.8); inner.add(aura);
  const gh = {
    kind: 'boss', S: 1, group, inner, torso, tBase, legs, arms, heads, aura, mat, furMat, faceMats: heads.map(h => h.face.material),
    hp: 5000, maxHp: 5000, dead: false, spawnT: 0, hitFlash: 0, atkCd: 3, phase: 0, walk: 0, stompCd: 1, shootCd: 3, summonCd: 8, yaw: 0, enraged: false
  };
  return gh;
}

function animateBoss(b, t, dt, moving) {
  const pos = b.torso.geometry.attributes.position, bb = b.tBase;
  for (let i = 0; i < pos.count; i++) {
    const by = bb[i * 3 + 1], k = Math.max(0, 1 - (by - 3.0) / 1.6);
    pos.setX(i, bb[i * 3] + Math.sin(t * 2 + by * 2) * 0.1 * k);
    pos.setZ(i, bb[i * 3 + 2] + Math.cos(t * 1.8 + by * 2) * 0.1 * k);
  }
  pos.needsUpdate = true;
  if (moving) b.walk += dt * 2.6;
  const w = Math.sin(b.walk);
  b.legs[0].hip.rotation.x = w * 0.5; b.legs[1].hip.rotation.x = -w * 0.5;
  b.legs[0].knee.rotation.x = Math.max(0, -w) * 0.7; b.legs[1].knee.rotation.x = Math.max(0, w) * 0.7;
  b.arms.forEach(a => { a.sh.rotation.x = -Math.sin(b.walk + (a.s > 0 ? 0 : Math.PI)) * 0.4 + Math.sin(t * 1.3) * 0.05; a.el.rotation.x = -0.5 - Math.abs(Math.sin(b.walk)) * 0.3; a.sh.rotation.z = a.s * (0.35 + Math.sin(t * 1.1 + a.s) * 0.08); });
  b.heads.forEach((h, i) => { h.g.rotation.y = Math.sin(t * 0.9 + i * 2) * 0.18; h.g.rotation.z = Math.sin(t * 1.2 + i) * 0.05; });
  b.inner.position.y = Math.sin(b.walk * 2) * 0.05;
}

function bossVolumes(b, out) {
  const p = b.group.position, s = b.inner.scale.x; out.length = 0;
  out.push({ x: p.x, y: p.y + 7.35 * s, z: p.z, r: 1.25 * s, head: true, name: 'rick' });
  out.push({ x: p.x - 3.1 * s, y: p.y + 6.7 * s, z: p.z, r: 1.7 * s, head: true, name: 'koalaL' });
  out.push({ x: p.x + 3.1 * s, y: p.y + 6.7 * s, z: p.z, r: 1.7 * s, head: true, name: 'koalaR' });
  out.push({ x: p.x, y: p.y + 5.0 * s, z: p.z, r: 2.1 * s, head: false });
  out.push({ x: p.x, y: p.y + 3.6 * s, z: p.z, r: 1.6 * s, head: false });
  out.push({ x: p.x - 0.95 * s, y: p.y + 1.8 * s, z: p.z, r: 0.85 * s, head: false });
  out.push({ x: p.x + 0.95 * s, y: p.y + 1.8 * s, z: p.z, r: 0.85 * s, head: false });
  out.push({ x: p.x - 0.95 * s, y: p.y + 0.6 * s, z: p.z, r: 0.8 * s, head: false });
  out.push({ x: p.x + 0.95 * s, y: p.y + 0.6 * s, z: p.z, r: 0.8 * s, head: false });
  return out;
}

/* ---------- projectiles (ghost orbs) ---------- */
function makeOrb(color, size) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshBasicMaterial({ color })));
  g.add(glowSprite(color, size * 6, 0.8));
  return g;
}



/* ---------- per-grave themes: ghost colour, fog, lights ---------- */
const GRAVE_THEMES = [
  { name: 'WHITE',  body: 0xf4f6ff, em: 0xcfd6ff, aura: 0xe8eeff, face: 0xffffff, fog: 0x232a3c, fogD: 0.016, sky: 0x3a4468, light: 0xdfe6ff },
  { name: 'BLUE',   body: 0x3f86ff, em: 0x1650d0, aura: 0x3a8cff, face: 0x8fb4ff, fog: 0x0b1d4a, fogD: 0.019, sky: 0x12307a, light: 0x4a7cff },
  { name: 'BLACK',  body: 0x15151b, em: 0x140a1e, aura: 0x8a30ff, face: 0x6a6a80, fog: 0x07050d, fogD: 0.027, sky: 0x120a22, light: 0x8a4cff },
  { name: 'ORANGE', body: 0xff8a1c, em: 0xd24e00, aura: 0xff7a10, face: 0xffb070, fog: 0x3a1706, fogD: 0.021, sky: 0x5a2208, light: 0xff7a30 },
  { name: 'RED',    body: 0xff2a2a, em: 0xa00000, aura: 0xff1a1a, face: 0xff6a6a, fog: 0x2e0606, fogD: 0.025, sky: 0x4a0808, light: 0xff3030 }
];
/* colour a ghost (clone / rick / boss) for the given grave index 0..4 */
function applyGhostTheme(gh, idx) {
  const th = GRAVE_THEMES[Math.max(0, Math.min(4, idx))];
  gh.theme = th; gh.baseEm = th.em; gh.faceEm = th.face;
  gh.mat.color.setHex(th.body); gh.mat.emissive.setHex(th.em);
  if (gh.kind === 'boss') {
    gh.furMat.color.setHex(0x2a0a0a); gh.furMat.emissive.setHex(0x7a0000);
    gh.faceMats.forEach(fm => fm.emissive.setHex(th.face));
    gh.aura.material.color.setHex(th.aura);
  } else {
    gh.faceMat.emissive.setHex(th.face);
    gh.aura.material.color.setHex(th.aura);
    if (gh.hood) gh.hood.material.color.setHex(th.aura);
  }
}
