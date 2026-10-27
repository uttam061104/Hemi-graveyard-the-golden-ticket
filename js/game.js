/* ===== Hemi's Graveyard — main game logic ===== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const practice = params.has('practice'); // ?practice in the URL = play without a wallet (testing)
  const lowfx = params.has('lowfx');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  loadFaces();

  /* ---------- renderer / scene ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: !lowfx, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, lowfx ? 1 : 1.25);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !lowfx;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  $('game').appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  const NIGHT_FOG = new THREE.Color(0x232a3c), DAY_FOG = new THREE.Color(0xcfe6ff);
  scene.fog = new THREE.FogExp2(NIGHT_FOG.getHex(), 0.016);
  let fogBase = 0.016; const skyTarget = new THREE.Color(0x2a3d78), lightTarget = new THREE.Color(0xdfe6ff);
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 700);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const world = buildWorld(scene);
  buildHorror(scene, world);
  const L = world.lights;

  // flashlight + muzzle light
  const flash = new THREE.SpotLight(0xe8f0ff, 0.9, 40, 0.55, 0.7, 1.4);
  camera.add(flash); camera.add(flash.target); flash.target.position.set(0, 0, -10);
  const muzzleL = new THREE.PointLight(0xffffff, 0, 9, 2); camera.add(muzzleL); muzzleL.position.set(0.25, -0.1, -0.9);

  /* ---------- weapons ---------- */
  const WEAPONS = [null,
    { name: 'Spectral Pistol', dmg: 6, rate: 4.5, mag: 24, color: 0xbfe8ff, css: '#bfe8ff', spark: 7, w: 0.018, beam: 'pale blue' },
    { name: 'Wraith Repeater', dmg: 7.5, rate: 5.5, mag: 30, color: 0x55ff88, css: '#55ff88', spark: 9, w: 0.022, beam: 'emerald green' },
    { name: 'Banshee Carbine', dmg: 9.5, rate: 6, mag: 36, color: 0xffe14d, css: '#ffe14d', spark: 11, w: 0.027, beam: 'golden' },
    { name: 'Phantom Cannon', dmg: 12, rate: 6.5, mag: 42, color: 0xb25cff, css: '#b25cff', spark: 14, w: 0.034, beam: 'violet' },
    { name: 'Soul Reaper', dmg: 14, rate: 7, mag: 50, color: 0xff3b3b, css: '#ff3b3b', spark: 18, w: 0.042, beam: 'crimson' }
  ];
  const gun = (function () {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.85, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.6, roughness: 0.5 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });
    const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || g).add(m); return m; };
    add(new THREE.BoxGeometry(0.075, 0.11, 0.46), metal, 0, 0, -0.1);
    add(new THREE.BoxGeometry(0.06, 0.16, 0.085), dark, 0, -0.12, 0.06).rotation.x = 0.25;
    const barrel = add(new THREE.CylinderGeometry(0.026, 0.03, 0.4, 10), metal, 0, 0.015, -0.45); barrel.rotation.x = Math.PI / 2;
    const tip = add(new THREE.TorusGeometry(0.03, 0.007, 6, 14), glow, 0, 0.015, -0.65);
    const core = add(new THREE.OctahedronGeometry(0.04), glow, 0, 0.075, -0.14);
    [-1, 1].forEach(s => add(new THREE.BoxGeometry(0.006, 0.02, 0.3), glow, s * 0.039, 0.01, -0.12));
    const parts = { 2: [], 3: [], 4: [], 5: [] };
    [-1, 1].forEach(s => { const f = add(new THREE.BoxGeometry(0.015, 0.07, 0.16), metal, s * 0.06, 0.02, -0.2); f.rotation.z = s * 0.3; parts[2].push(f); });
    const b2 = add(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), metal, 0, 0.085, -0.38); b2.rotation.x = Math.PI / 2; parts[3].push(b2);
    [-0.5, -0.38].forEach(z => { const r = add(new THREE.TorusGeometry(0.045, 0.01, 6, 14), glow, 0, 0.015, z); parts[4].push(r); });
    [-1, 1].forEach(s => { const sp = add(new THREE.ConeGeometry(0.014, 0.12, 5), glow, s * 0.05, 0.1, -0.1); sp.rotation.z = -s * 0.5; parts[5].push(sp); });
    g.position.set(0.26, -0.25, -0.52); g.rotation.y = 0.04;
    camera.add(g);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.015, -0.7); g.add(muzzle);
    const mf = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    mf.scale.set(0.4, 0.4, 1); mf.visible = false; muzzle.add(mf); mf.renderOrder = 999;
    g.traverse(o => { if (o.isMesh) o.renderOrder = 998; });
    return { g, glow, core, tip, parts, muzzle, mf, base: g.position.clone() };
  })();
  function setWeaponVisual(lv) {
    const w = WEAPONS[lv];
    gun.glow.color.setHex(w.color);
    for (let k = 2; k <= 5; k++) gun.parts[k].forEach(p => p.visible = lv >= k);
    gun.core.scale.setScalar(1 + (lv - 1) * 0.22);
    muzzleL.color.setHex(w.color);
    gun.mf.material.color.setHex(w.color);
  }

  /* ---------- particles (sparks) & tracers ---------- */
  const SP = { n: 420, i: 0 };
  SP.pos = new Float32Array(SP.n * 3); SP.col = new Float32Array(SP.n * 3); SP.vel = new Float32Array(SP.n * 3); SP.life = new Float32Array(SP.n); SP.max = new Float32Array(SP.n);
  for (let i = 0; i < SP.n; i++) SP.pos[i * 3 + 1] = -999;
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(SP.pos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(SP.col, 3));
  const spPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.28, map: glowTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  spPts.frustumCulled = false; scene.add(spPts);
  const _c = new THREE.Color();
  function sparks(p, hex, n, speed, spread) {
    _c.setHex(hex);
    for (let k = 0; k < n; k++) {
      const i = SP.i = (SP.i + 1) % SP.n, a = Math.random() * 6.283, e = (Math.random() - 0.3) * (spread || 1.2), s = speed * (0.4 + Math.random() * 0.8);
      SP.pos[i * 3] = p.x; SP.pos[i * 3 + 1] = p.y; SP.pos[i * 3 + 2] = p.z;
      SP.vel[i * 3] = Math.cos(a) * s; SP.vel[i * 3 + 1] = e * s + speed * 0.2; SP.vel[i * 3 + 2] = Math.sin(a) * s;
      const wh = Math.random() < 0.3; SP.col[i * 3] = wh ? 1 : _c.r; SP.col[i * 3 + 1] = wh ? 1 : _c.g; SP.col[i * 3 + 2] = wh ? 1 : _c.b;
      SP.life[i] = SP.max[i] = 0.3 + Math.random() * 0.45;
    }
  }
  function updateSparks(dt) {
    for (let i = 0; i < SP.n; i++) {
      if (SP.life[i] <= 0) { SP.pos[i * 3 + 1] = -999; continue; }
      SP.life[i] -= dt; const f = Math.max(0, SP.life[i] / SP.max[i]);
      SP.vel[i * 3 + 1] -= 9 * dt;
      SP.pos[i * 3] += SP.vel[i * 3] * dt; SP.pos[i * 3 + 1] += SP.vel[i * 3 + 1] * dt; SP.pos[i * 3 + 2] += SP.vel[i * 3 + 2] * dt;
      if (SP.pos[i * 3 + 1] < 0.02) { SP.pos[i * 3 + 1] = 0.02; SP.vel[i * 3 + 1] *= -0.3; }
      SP.col[i * 3] *= 0.97 + f * 0.03; SP.col[i * 3 + 1] *= 0.97 + f * 0.03; SP.col[i * 3 + 2] *= 0.97 + f * 0.03;
    }
    spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
  }
  const tracers = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.visible = false; m.userData.life = 0; scene.add(m); tracers.push(m);
  }
  let tracerI = 0;
  const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
  function tracer(a, b, hex, w) {
    const m = tracers[tracerI = (tracerI + 1) % tracers.length];
    _dir.subVectors(b, a); const len = _dir.length(); _dir.normalize();
    m.position.copy(a).addScaledVector(_dir, len / 2); m.scale.set(w, len, w);
    m.quaternion.setFromUnitVectors(_up, _dir); m.material.color.setHex(hex); m.material.opacity = 1; m.visible = true; m.userData.life = 0.09;
  }

  /* ---------- game state ---------- */
  const G = {
    state: 'lobby', t: 0, paused: false, locked: false,
    name: 'Player', practice, voice: true,
    p: { x: 0, z: 96, yaw: 0, pitch: 0, hp: 100, step: 0, bob: 0, hurt: 0, shake: 0 },
    wl: 1, ammo: 24, reloading: 0, nextShot: 0, recoil: 0, mouse: false,
    ghosts: [], dying: [], orbs: [], rings: [],
    round: null, activeIdx: 0, gravesOpened: 0, kills: 0, heads: 0, startTime: 0, endTime: 0,
    day: 0, dayTarget: 0, introT: 0, openT: 0, win: false, ticketT: 0, ticketTaken: false,
    keys: {}, whisperT: 20, lightT: 14, heartT: 0, birdT: 3, hudT: 0, miniT: 0, subT: 0, deadT: 0, stats: null, lowHpSaid: false
  };
  /* ---- difficulty curve (i = 0..4, one per grave) ---- */
  const mult = i => Math.pow(1.3, i);            // ghost HP multiplier: x1, 1.3, 1.7, 2.2, 2.9
  const dmgMult = i => 1 + 0.4 * i;              // ghost damage multiplier: x1 .. x2.6
  const orbSpread = i => Math.max(0.15, 1.5 - i * 0.35); // orb aim error (lower = more accurate)
  const BOSS_HP =4000;
  const vols = [];
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

  /* ---------- text lines ---------- */
  const INTRO_LINES = [
    'Year 3026. A thousand years have passed, and the dead of Hemi still refuse to rest.',
    'Beneath five graves lies the Golden Ticket, worth one million Bitcoin. Open them all, if you dare.',
    'Rick walks these grounds. He is not alone.'
  ];
  /* spoken when you arrive at each grave (Joshua, Jeremy, JCV, Max, Jeff) */
  const GRAVE_LINES = [
    'Joshua died like Satoshi. No one knows his face.',
    'Jeremy’s last words were: Don’t cut it… then his beard started moving on its own.',
    'JCV disappeared into the darkness, and three days later, his hair started growing out of the walls.',
    'Even after his death, Max screams from inside his room: I want to go for mid week with Max!',
    'Jeff’s computer showed one final message: Rick, you’re next.'
  ];
  const WHISPERS = [
    'Even the intern died waiting to be unbanned from the Hemi Discord.',
    'I can hear your wallet trembling...',
    'The airdrop never came, but the ghosts did.',
    'Gas fees are temporary. Haunting is forever.',
    'You are not alone in this graveyard.',
    'Behind you...',
    'The mods are asleep. Rick is wide awake.',
    'Never share your seed phrase. The dead are already listening.',
    'Every grave you open, I multiply.'
  ];

  function say(text, ms, voice) {
    const el = $('sub'); el.textContent = text; el.classList.add('on');
    G.subT = (ms || 4200) / 1000;
    if (voice !== false) SFX.say(text, Math.min(6, (ms || 4200) / 1000));
  }
  /* Shows the subtitle and speaks the line; resolves only when the voice has FINISHED (so lines never cut each other off). */
  function sayWait(text) {
    const el = $('sub'); el.textContent = text; el.classList.add('on');
    G.subT = 999;                                         // keep subtitle up until the voice ends
    return Promise.resolve(SFX.say(text, 6)).then(() => { G.subT = 1.2; });
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function banner(title, sub, ms, color) {
    const b = $('banner'); $('bTitle').textContent = title; $('bSub').textContent = sub || '';
    b.style.setProperty('--bc', color || '#ff6a00'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(banner._t); banner._t = setTimeout(() => b.classList.remove('on'), ms || 2800);
  }

  /* ---------- lobby / wallet UI ---------- */
  const SPOOKY = [
    'Even the intern died waiting to be unbanned from the Hemi Discord.',
    'Connect your wallet. The dead have waited a thousand years for a new signature.',
    'Never share your seed phrase. The ghosts are already listening.',
    'Gas fees are temporary. Haunting is eternal.',
    'The last player who clicked “Reject” was never seen again.',
    'A thousand years later, and the airdrop still has not arrived.',
    'Rick knows your address. Rick always knows.',
    'The mempool is full of restless souls.'
  ];

  let walletOk = practice;
  function refreshEnter() {
    const nameOk = $('pname').value.trim().length > 0, ok = walletOk && nameOk;
    $('btnEnter').disabled = !ok;
    $('btnEnter').textContent = ok ? 'ENTER THE GRAVEYARD' : (walletOk ? 'ENTER YOUR NAME FIRST' : 'CONNECT WALLET FIRST');
  }
  $('pname').addEventListener('input', refreshEnter);
  const savedName = (function () { try { return localStorage.getItem('hg_name') || ''; } catch (e) { return ''; } })();
  if (savedName) $('pname').value = savedName;
  const WBTN = { metamask: $('btnMM'), rabby: $('btnRabby') };
  function walletMsg(cls, html) { const st = $('walletStatus'); st.className = cls || ''; st.innerHTML = html; }
  if (practice) { walletMsg('ok', 'Practice mode: no wallet, no transaction.'); $('btnMM').parentNode.style.display = 'none'; }
  else {
    // mark which wallets are installed (extensions can take a moment to appear)
    const paint = () => Chain.detect(0).then(d => { for (const k in WBTN) if (!WBTN[k].classList.contains('done')) WBTN[k].classList.toggle('missing', !d[k]); });
    paint(); setTimeout(paint, 800); setTimeout(paint, 2500);
    walletMsg('', 'Connect MetaMask or Rabby to play.');
  }
  async function connectWallet(key) {
    SFX.init(); SFX.click();
    walletMsg('', 'Waiting for ' + Chain.WALLETS[key].name + '…');
    try {
      const acc = await Chain.connect(key);
      walletOk = true;
      walletMsg('ok', 'Connected: ' + Chain.short(acc) + ' · Hemi Mainnet');
      for (const k in WBTN) { WBTN[k].classList.remove('done'); WBTN[k].disabled = false; }
      WBTN[key].classList.add('done'); WBTN[key].textContent = Chain.WALLETS[key].name.toUpperCase() + ' ✔';
    } catch (e) {
      walletOk = false;
      if (e && e.message === 'FILE_PROTOCOL') walletMsg('err', 'Wallets cannot connect to a page opened as a local file. Open the game from its web link, or run it with VS Code Live Server (http://localhost).');
      else if (e && e.message === 'NO_WALLET') walletMsg('err', Chain.WALLETS[key].name + ' was not found in this browser. <a href="' + Chain.WALLETS[key].install + '" target="_blank" rel="noopener">Install ' + Chain.WALLETS[key].name + '</a>, enable it for this site, then refresh.');
      else if (e && e.code === 4001) walletMsg('err', 'Connection rejected in the wallet. Try again.');
      else if (e && e.code === -32002) walletMsg('err', 'A wallet request is already open. Check your wallet popup.');
      else walletMsg('err', 'Could not connect: ' + ((e && e.message) || e));
    }
    refreshEnter();
  }
  WBTN.metamask.addEventListener('click', () => connectWallet('metamask'));
  WBTN.rabby.addEventListener('click', () => connectWallet('rabby'));
  Chain.onChange = () => { if (!Chain.account && !practice) { walletOk = false; walletMsg('err', 'Wallet disconnected. Connect again.'); for (const k in WBTN) { WBTN[k].classList.remove('done'); WBTN[k].textContent = Chain.WALLETS[k].name.toUpperCase(); } refreshEnter(); } else if (Chain.account && !practice) walletMsg('ok', 'Connected: ' + Chain.short() + ' · Hemi Mainnet'); };
  $('voiceChk').addEventListener('change', e => { G.voice = e.target.checked; SFX.setVoice(G.voice); });
  refreshEnter();

  $('btnEnter').addEventListener('click', () => {
    if ($('btnEnter').disabled) return;
    G.name = $('pname').value.trim().slice(0, 18);
    try { localStorage.setItem('hg_name', G.name); } catch (e) { }
    if (practice || !Chain.REQUIRE_START_TX) { startGame(); return; }
    // Start-of-run transaction on Hemi Mainnet (0 ETH, only network gas)
    const btn = $('btnEnter'); btn.disabled = true; btn.textContent = 'CONFIRM IN WALLET…';
    walletMsg('', 'Confirm the <b>start transaction</b> in your wallet (calls the game contract, 0 ETH — you only pay the tiny network gas).');
    const fail = html => { btn.disabled = false; refreshEnter(); walletMsg('err', html); };
    Chain.startGameTx(G.name).then(async r => {
      const link = ' <a target="_blank" rel="noopener" href="' + Chain.explorerTx(r.hash) + '">View tx ↗</a>';
      btn.textContent = 'CONFIRMING ON HEMI…';
      walletMsg('', 'Start transaction sent. Waiting for confirmation on Hemi Mainnet…' + link);
      const rc = await Chain.waitReceipt(r.hash, 60);            // up to ~2.5 minutes
      if (!rc) return fail('Still not confirmed. The game starts only after the transaction succeeds — check the link, then press Enter again.' + link);
      if (rc.status !== '0x1' && rc.status !== 1) return fail('The start transaction failed on-chain, so the game was not started. Press Enter to try again.' + link);
      walletMsg('ok', 'Start transaction confirmed on Hemi Mainnet ✔' + link);
      startGame();
      // the browser may refuse mouse-capture after the wait; if so show the "click to continue" screen
      setTimeout(() => { if (!G.locked) { G.paused = true; $('pause').classList.remove('hide'); } }, 400);
    }).catch(e => {
      btn.disabled = false; refreshEnter();
      if (e && e.code === 4001) walletMsg('err', 'Start transaction rejected in the wallet. Confirm it to play (or use ?practice for no-wallet mode).');
      else walletMsg('err', 'Could not send the start transaction: ' + ((e && e.message) || e));
    });
  });

  /* ---------- start / intro ---------- */
  function startGame() {
    SFX.init(); SFX.setVoice(G.voice); setHorrorVisible(world, true);
    SFX.ambience('night'); SFX.music('dark'); setTheme(0);
    $('lobby').classList.add('hide'); $('hud').classList.remove('hide');
    $('hName').textContent = G.name; $('hWallet').textContent = practice ? 'practice mode' : Chain.short();
    G.state = 'intro'; G.introT = 0; G.startTime = performance.now();
    G.p.x = 0; G.p.z = 96; G.p.yaw = 0; G.p.pitch = 0; G.p.hp = 100;
    G.wl = 1; G.ammo = WEAPONS[1].mag; setWeaponVisual(1);
    G.gateOpening = false; G.gateT = 0;                    // gate stays CLOSED until Rick's first line has finished
    if (world.gateCollider && world.colliders.indexOf(world.gateCollider) < 0) world.colliders.push(world.gateCollider);
    setTimeout(() => SFX.thunder(), 900);
    // Intro dialogue plays one line AFTER the other; the gate/walk-in waits until both lines have finished.
    G.introDone = false; const tok = G.introTok = (G.introTok || 0) + 1;
    (async () => {
      await sleep(900);
      for (const i of [0, 1]) {
        if (G.introTok !== tok || G.state !== 'intro') return;
        await sayWait(INTRO_LINES[i]);
        if (i === 0 && G.introTok === tok && G.state === 'intro') {   // first line finished -> NOW the gate opens
          G.gateOpening = true; SFX.gateOpen(); updateObjective();
        }
        await sleep(700);                                  // small pause between lines
      }
      if (G.introTok === tok) { G.introDone = true; if (G.state === 'intro') updateObjective(); }
    })();
    requestLock();
    updateObjective();
  }
  function requestLock() { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
  document.addEventListener('pointerlockchange', () => {
    const lk = document.pointerLockElement === canvas;
    if (lk) { G.locked = true; G.paused = false; $('pause').classList.add('hide'); }
    else if (G.locked) { G.locked = false; if (['explore', 'opening', 'fight', 'day', 'ticket', 'intro'].includes(G.state)) { G.paused = true; $('pause').classList.remove('hide'); } }
  });
  $('pause').addEventListener('click', () => { requestLock(); G.paused = false; $('pause').classList.add('hide'); });

  /* ---------- input ---------- */
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    G.keys[e.code] = true;
    if (e.code === 'KeyE') tryInteract();
    if (e.code === 'KeyR') startReload();
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { G.keys[e.code] = false; });
  addEventListener('mousedown', e => { if (e.button === 0 && G.locked) G.mouse = true; });
  addEventListener('mouseup', e => { if (e.button === 0) G.mouse = false; });
  addEventListener('mousemove', e => {
    if (!G.locked || G.paused) return;
    G.p.yaw -= (e.movementX || 0) * 0.0022; G.p.pitch = clamp(G.p.pitch - (e.movementY || 0) * 0.0022, -1.35, 1.35);
  });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  /* ---------- collision ---------- */
  const PR = 0.45;
  function blocked(x, z) {
    for (const c of world.colliders) if (x > c.minx - PR && x < c.maxx + PR && z > c.minz - PR && z < c.maxz + PR) return true;
    for (const c of world.circles) { const dx = x - c.x, dz = z - c.z, r = c.r + PR; if (dx * dx + dz * dz < r * r) return true; }
    return false;
  }
  function movePlayer(dx, dz) {
    const p = G.p;
    if (!blocked(p.x + dx, p.z)) p.x += dx;
    if (!blocked(p.x, p.z + dz)) p.z += dz;
    p.x = clamp(p.x, -72, 72); p.z = clamp(p.z, -69, 106);
    if (p.z < BOUNDS.zMax) p.x = clamp(p.x, -BOUNDS.x + 1, BOUNDS.x - 1);
  }

  /* ---------- shooting ---------- */
  function startReload() {
    const w = WEAPONS[G.wl];
    if (G.reloading > 0 || G.ammo >= w.mag || !['explore', 'opening', 'fight', 'day', 'ticket'].includes(G.state)) return;
    G.reloading = 1.25; SFX.reload();
  }
  function rayVsSphere(ox, oy, oz, dx, dy, dz, s, extra) {
    const cx = s.x - ox, cy = s.y - oy, cz = s.z - oz, b = cx * dx + cy * dy + cz * dz;
    if (b < 0) return -1;
    const r = s.r + extra, d2 = cx * cx + cy * cy + cz * cz - b * b;
    if (d2 > r * r) return -1;
    return b - Math.sqrt(r * r - d2);
  }
  function getVolumes(gh) { return gh.kind === 'boss' ? bossVolumes(gh, vols) : ghostVolumes(gh, vols); }

  function fire(now) {
    const w = WEAPONS[G.wl];
    if (G.ammo <= 0) { if (G.reloading <= 0) { SFX.empty(); startReload(); } return; }
    G.ammo--; G.nextShot = now + 1 / w.rate; G.recoil = 1;
    SFX.shoot(G.wl);
    // aim
    camera.updateMatrixWorld();
    camera.getWorldPosition(_v);
    const spread = 0.004 + (G.keys.KeyW || G.keys.KeyA || G.keys.KeyS || G.keys.KeyD ? 0.004 : 0);
    camera.getWorldDirection(_v2);
    _v2.x += (Math.random() - 0.5) * spread; _v2.y += (Math.random() - 0.5) * spread; _v2.z += (Math.random() - 0.5) * spread; _v2.normalize();
    let best = null, bt = 90;
    for (const gh of G.ghosts) {
      if (gh.spawnT < 1) continue;
      for (const s of getVolumes(gh)) {
        const t = rayVsSphere(_v.x, _v.y, _v.z, _v2.x, _v2.y, _v2.z, s, 0.1);
        if (t >= 0 && t < bt) { bt = t; best = { gh, s }; }
      }
    }
    for (const z of world.zombies) { if (z.state !== 'chase' && z.state !== 'rise') continue; for (const sv of zVols(z)) { const tz = rayVsSphere(_v.x, _v.y, _v.z, _v2.x, _v2.y, _v2.z, sv, 0.1); if (tz >= 0 && tz < bt) { bt = tz; best = { gh: z, s: sv, zombie: true }; } } }
    gun.muzzle.getWorldPosition(_v3);
    const end = new THREE.Vector3().copy(_v).addScaledVector(_v2, best ? bt : 70);
    tracer(_v3.clone(), end, w.color, w.w);
    if (G.wl >= 4) tracer(_v3.clone().add(new THREE.Vector3(0.02, 0.02, 0)), end, 0xffffff, w.w * 0.4);
    gun.mf.visible = true; gun.mf.scale.setScalar(0.35 + Math.random() * 0.25); muzzleL.intensity = 3.2; G.flashT = 0.05;
    if (best) {
      if (best.zombie) { const zd = w.dmg * (best.s.head ? 2.2 : 1); best.gh.hp -= zd; sparks(end, 0xff3030, 8, 4, 1.2); SFX.hit(best.s.head); const hm = $('hit'); hm.className = best.s.head ? 'head' : ''; hm.style.opacity = 1; setTimeout(() => hm.style.opacity = 0, 90); if (best.gh.hp <= 0 && best.gh.state !== 'dead') killZombie(best.gh); if (G.ammo <= 0) startReload(); return; }
      let d = w.dmg, head = best.s.head;
      if (best.gh.kind === 'boss') d *= head ? 1.25 : 0.6; else if (head) d *= 2;
      sparks(end, w.color, w.spark, 5, 1.4); sparks(end, 0xffffff, 3, 3, 1);
      SFX.hit(head);
      damageGhost(best.gh, d, head);
    } else {
      sparks(end, w.color, 3, 3, 1);
    }
    if (G.ammo <= 0) startReload();
  }

  function damageGhost(gh, d, head) {
    if (gh.dead) return;
    gh.hp -= d; gh.hitFlash = 0.1;
    const hm = $('hit'); hm.className = head ? 'head' : ''; hm.style.opacity = 1; clearTimeout(damageGhost._t); damageGhost._t = setTimeout(() => hm.style.opacity = 0, 90);
    if (head) G.heads++;
    if (gh.kind === 'boss') {
      $('bossFill').style.width = Math.max(0, gh.hp / gh.maxHp * 100) + '%';
      if (!gh.enraged && gh.hp < gh.maxHp * 0.5) { gh.enraged = true; SFX.bossRoar(); banner('THE BOSS IS ENRAGED', 'It moves faster. It hits harder.', 2600, '#ff2a2a'); G.p.shake = 0.8; say('YOU THINK THIS IS OVER? WE\'RE NOT EVEN FINISHED!', 3500); }
      if (!gh.nearDeath && gh.hp > 0 && gh.hp < gh.maxHp * 0.15) { gh.nearDeath = true; say('NO! THE TICKET… WAS NEVER MEANT FOR YOU!', 3500); }
    }
    if (gh.hp <= 0) killGhost(gh);
  }

  function killGhost(gh) {
    gh.dead = true; G.kills++;
    const i = G.ghosts.indexOf(gh); if (i >= 0) G.ghosts.splice(i, 1);
    G.dying.push({ gh, t: 0 });
    const p = gh.group.position;
    const big = gh.kind !== 'clone';
    sparks(new THREE.Vector3(p.x, p.y + 1.5 * gh.S, p.z), gh.kind === 'boss' ? 0xff5030 : 0xbfe8ff, gh.kind === 'boss' ? 160 : 40, gh.kind === 'boss' ? 14 : 7, 1.6);
    SFX.ghostDie(big);
    if (gh.kind === 'rick') { G.round && (G.round.rickDead = true); if (G.round && G.round.idx === 0) say('Rick: “You cannot kill what is already dead...”', 3200); }   // first grave only
    if (gh.kind === 'boss') bossDefeated();
  }

  /* ---------- orbs (ghost projectiles) ---------- */
  function fireOrb(from, speed, dmg, color, size, spread) {
    const sp = spread == null ? 1.2 : spread;
    const m = makeOrb(color, size || 0.28); m.position.copy(from); scene.add(m);
    camera.getWorldPosition(_v);
    const tx = _v.x + (Math.random() - 0.5) * sp, ty = _v.y - 0.3 + (Math.random() - 0.5) * sp * 0.5, tz = _v.z + (Math.random() - 0.5) * sp;
    const d = new THREE.Vector3(tx - from.x, ty - from.y, tz - from.z).normalize();
    G.orbs.push({ m, vx: d.x * speed, vy: d.y * speed, vz: d.z * speed, life: 7, dmg });
    SFX.orb();
  }
  function updateOrbs(dt) {
    camera.getWorldPosition(_v);
    for (let i = G.orbs.length - 1; i >= 0; i--) {
      const o = G.orbs[i]; o.life -= dt;
      o.m.position.x += o.vx * dt; o.m.position.y += o.vy * dt; o.m.position.z += o.vz * dt;
      const dx = o.m.position.x - _v.x, dy = o.m.position.y - (_v.y - 0.3), dz = o.m.position.z - _v.z;
      if (dx * dx + dy * dy + dz * dz < 1.0) { hurtPlayer(o.dmg); sparks(o.m.position, 0xff6a30, 14, 5, 1.2); o.life = 0; }
      if (o.life <= 0 || o.m.position.y < 0) { scene.remove(o.m); G.orbs.splice(i, 1); }
    }
  }

  /* ---------- player damage ---------- */
  function hurtPlayer(d) {
    if (G.state === 'dead' || G.state === 'end' || G.state === 'intro' || G.p.hp <= 0) return;
    G.p.hp = Math.max(0, G.p.hp - d); G.p.hurt = 0.45; G.p.shake = Math.max(G.p.shake, 0.35);
    SFX.hurt();
    if (G.p.hp <= 0) die();
    else if (G.p.hp < 30 && !G.lowHpSaid) { G.lowHpSaid = true; say('Your heartbeat is so loud... it is almost delicious.', 3600); }
    else if (G.p.hp > 60) G.lowHpSaid = false;
  }
  function die() {
    G.state = 'dead'; G.deadT = 0; G.mouse = false; G.win = false;
    SFX.lose(); SFX.music('off'); say('Rick claimed another soul.', 3500);
    banner('YOU DIED', 'Rick claimed your soul', 3200, '#ff2a2a');
    try { document.exitPointerLock(); } catch (e) { }
  }

  /* ---------- rounds ---------- */
  function updateObjective() {
    const t = world.specials[G.activeIdx], ot = $('objTitle'), os = $('objSub');
    if (G.state === 'intro') { ot.textContent = 'Enter the cemetery'; os.textContent = G.gateOpening ? 'Walk through the gate' : 'Listen… the gate will open'; }
    else if (G.state === 'explore') { ot.textContent = 'Open ' + t.name + '’s grave  (#' + t.rank + ')'; os.textContent = 'Follow the orange light and the minimap'; }
    else if (G.state === 'opening') { ot.textContent = 'The grave is opening…'; os.textContent = 'Brace yourself'; }
    else if (G.state === 'fight') { const n = G.ghosts.length + (G.round ? Math.max(0, G.round.quota - G.round.spawned) : 0); ot.textContent = G.round && G.round.boss ? 'DESTROY RICKOALA' : 'Destroy every ghost'; os.textContent = n + ' remaining  ·  aim for the heads'; }
    else if (G.state === 'day') { ot.textContent = 'The darkness lifts…'; os.textContent = ''; }
    else if (G.state === 'ticket') { ot.textContent = 'Take the Golden Ticket!'; os.textContent = 'Touch the floating ticket'; }
    else { ot.textContent = ''; os.textContent = ''; }
  }
  function tryInteract() {
    if (G.state !== 'explore' || G.paused) return;
    const t = world.specials[G.activeIdx];
    if (Math.hypot(G.p.x - t.x, G.p.z - t.z) < 5.8) openGrave(t);
  }
  function openGrave(t) {
    G.state = 'opening'; G.openT = 0; t.state = 'opening';
    SFX.graveOpen(); G.p.shake = 0.6; setTheme(G.activeIdx); if (G.activeIdx > 0) setTimeout(() => G.state === 'opening' && jumpScare(), 1700);
    setTimeout(() => G.state === 'opening' && lightning(), 400);
    setTimeout(() => G.state === 'opening' && SFX.rickScream(1 + G.activeIdx * 0.3), 1100);
    updateObjective();
  }
  function startRound() {
    const idx = G.activeIdx, t = world.specials[idx], boss = idx === 4;
    G.state = 'fight'; G.gravesOpened = idx + 1;
    const m = mult(idx);
    G.round = { idx, quota: boss ? 0 : [4, 7, 10, 13][idx], spawned: 0, timer: 5, rickDead: false, boss, m };
    if (boss) {
      const b = makeBoss(); applyGhostTheme(b, 4); b.maxHp = b.hp = BOSS_HP; b.group.position.set(t.x, -8, t.z - 11); b.spawnT = 0; b.m = m;
      scene.add(b.group); G.ghosts.push(b); G.boss = b;
      $('bossBar').classList.remove('hide'); $('bossFill').style.width = '100%';
      SFX.bossRoar(); G.p.shake = 1;
      banner('RICKOALA', 'The final nightmare', 3500, '#ff3030'); jumpScare(1);
      setTimeout(() => G.state === 'fight' && SFX.koalaScream(), 1800);
      say('You made it to Jeff’s grave. Congratulations. Now meet what we’ve become.', 4800);          // Rick (natural browser voice)
      setTimeout(() => G.state === 'fight' && say('YOU WANTED THE TICKET? COME AND TAKE IT!', 3500), 5200);   // Rickoala (clip)
    } else {
      const r = makeGhost('rick'); applyGhostTheme(r, idx); r.maxHp = r.hp = 150 * m; r.group.position.set(t.x, -2, t.z); r.m = m; r.tele = 0; r.teleT = 6; r.dir = 1; r.dirT = 3;
      scene.add(r.group); G.ghosts.push(r);
      const first = Math.min(G.round.quota, 3 + idx); spawnClones(first, t.x, t.z, 7, 11);
      G.round.spawned = first; G.round.timer = 1.2;
    }
    updateObjective();
  }
  function spawnClones(n, cx, cz, rmin, rmax) {
    for (let i = 0; i < n; i++) {
      const gh = makeGhost('clone'); applyGhostTheme(gh, G.round && G.round.boss ? 4 : G.activeIdx); const m = G.round ? G.round.m : 1;
      gh.maxHp = gh.hp = 36 * m; gh.m = m;
      const a = Math.random() * 6.283, r = rnd(rmin, rmax);
      gh.group.position.set(clamp(cx + Math.cos(a) * r, -56, 56), 0, clamp(cz + Math.sin(a) * r, -66, 66));
      scene.add(gh.group); G.ghosts.push(gh);
    }
    SFX.spawn();
  }
  function roundCleared() {
    const idx = G.round.idx, t = world.specials[idx];
    t.state = 'done'; G.round = null;
    SFX.roundClear(); G.p.hp = Math.min(100, G.p.hp + 25);
    if (idx < 4) {
      G.activeIdx = idx + 1; G.wl = idx + 2; G.ammo = WEAPONS[G.wl].mag; G.reloading = 0; setWeaponVisual(G.wl);
      setTimeout(() => { SFX.upgrade(); banner('WEAPON UPGRADED', WEAPONS[G.wl].name + '  ·  ' + WEAPONS[G.wl].beam + ' beam', 3200, WEAPONS[G.wl].css); }, 700);
      if (idx === 0) say('The grave grants you its power... but the next one hungers.', 4000);   // said once only
      G.state = 'explore';
    }
    updateObjective();
  }
  function bossDefeated() {
    const t = world.specials[4]; t.state = 'done';
    G.state = 'day'; G.dayT = 0; G.ticketT = 0; G.round = null;
    $('bossBar').classList.add('hide');
    G.orbs.forEach(o => scene.remove(o.m)); G.orbs.length = 0;
    G.ghosts.slice().forEach(g => { g.hp = 0; killGhost(g); });
    SFX.bossRoar(); G.p.shake = 1.2; lightning();
    banner('IT IS OVER', 'The night is lifting…', 3600, '#ffd25a');
    say('Rick: “No... the sun... I can feel the sun...”', 4600);
    updateObjective();
    setTimeout(() => { SFX.music('day'); SFX.ambience('day'); SFX.upgrade(); }, 1500);
  }

  /* ---------- lightning ---------- */
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe6efff, fog: false, transparent: true });
  const boltLight = new THREE.PointLight(0xa8c4ff, 0, 160, 1.5); scene.add(boltLight);
  function lightning() {
    SFX.thunder(); // soft distant lightning: no screen flash, no sudden light spike
    // visible jagged bolt striking the ground near the player
    const a = rnd(0, 6.283), d = rnd(28, 70), bx = clamp(G.p.x + Math.cos(a) * d, -75, 75), bz = G.p.z + Math.sin(a) * d;
    const pts = []; let x = bx, z = bz;
    for (let y = 95; y >= 0; y -= 6) { pts.push(new THREE.Vector3(x, y, z)); x += rnd(-3.2, 3.2); z += rnd(-3.2, 3.2); }
    const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltMat); scene.add(bolt);
    boltLight.position.set(bx, 14, bz); boltLight.intensity = 1.5;
    [60, 120, 190].forEach((ms, i) => setTimeout(() => { boltLight.intensity = 0; bolt.visible = i !== 1; }, ms));
    setTimeout(() => { scene.remove(bolt); bolt.geometry.dispose(); boltLight.intensity = 0; }, 260);
    }

  /* ---------- per-grave atmosphere (fog / sky / light colours) ---------- */
  function setTheme(idx) {
    const th = GRAVE_THEMES[Math.max(0, Math.min(4, idx))];
    NIGHT_FOG.setHex(th.fog); fogBase = th.fogD; skyTarget.setHex(th.sky); lightTarget.setHex(th.light); SFX.setIntensity(idx);
    const tb = world.specials[idx]; if (tb) { tb.halo.material.color.setHex(th.aura); tb.crossMat.color.setHex(th.aura); tb.crossMat.emissive.setHex(th.aura); L.graveLight.color.setHex(th.light); }
  }
  function updateTheme(dt) {
    if (G.state === 'day' || G.state === 'end') return;
    scene.fog.color.lerp(NIGHT_FOG, Math.min(1, dt * 0.9));
    scene.fog.density += (fogBase - scene.fog.density) * Math.min(1, dt * 0.9);
    world.sky.uniforms.mid.value.lerp(skyTarget, Math.min(1, dt * 0.6));
    L.hemi.color.lerp(lightTarget, Math.min(1, dt * 0.5));
  }

  /* ---------- jump scares & creeping horror ---------- */
  const scareEl = document.createElement('div');
  scareEl.style.cssText = 'position:fixed;inset:0;z-index:13;pointer-events:none;opacity:0;background:#000 center/contain no-repeat;transition:opacity .05s;mix-blend-mode:normal';
  document.body.appendChild(scareEl);
  function jumpScare(kind) {
    if (G.state === 'dead' || G.state === 'end' || G.state === 'day') return;
    const k = kind == null ? Math.floor(Math.random() * 3) : kind;
    SFX.jumpscare(k); G.p.shake = Math.max(G.p.shake, 1.1);
    scareEl.style.backgroundImage = 'radial-gradient(circle at 50% 50%, rgba(120,0,0,0.0) 10%, rgba(0,0,0,0.9) 80%), url(' + (k === 2 ? IMG.koala : IMG.rick) + ')';
    scareEl.style.backgroundColor = k === 0 ? '#3a0000' : '#000';
    scareEl.style.filter = 'contrast(1.6) saturate(0.4) brightness(0.9)';
    scareEl.style.backgroundSize = 'auto, ' + (80 + Math.random() * 40) + '%';
    let n = 0; const iv = setInterval(() => { scareEl.style.opacity = n % 2 === 0 ? 0.95 : 0.15; scareEl.style.backgroundPosition = '0 0, ' + (Math.random() * 20 - 10) + 'px ' + (Math.random() * 20 - 10) + 'px'; if (++n > 5) { clearInterval(iv); scareEl.style.opacity = 0; } }, 55);
  }
  const SKY_LINES = ['Leave this place...', 'You cannot escape us...', 'Join us in the sky...', 'He is watching you...', 'Your soul is ours...'];
  /* ---- dead bodies that wake up when you walk near (3 of them) ---- */
  function zVols(z) { const s = 1.3, p = z.o.position; return [{ x: p.x, y: 2.05 * s * 0.85, z: p.z, r: 0.3 * s, head: true }, { x: p.x, y: 1.2 * s * 0.8, z: p.z, r: 0.5 * s, head: false }, { x: p.x, y: 0.5 * s, z: p.z, r: 0.45 * s, head: false }]; }
  function killZombie(z) { z.state = 'dead'; z.t = 0; SFX.ghostDie(false); sparks(new THREE.Vector3(z.o.position.x, 1.2, z.o.position.z), 0xff3030, 18, 5, 1.4); G.kills++; }
  function updateZombies(dt) {
    for (const z of world.zombies) {
      const p = z.o.position, dist = Math.hypot(G.p.x - p.x, G.p.z - p.z), f = z.fig;
      if (z.state === 'sleep') {
        if (dist < 8.5) { z.state = 'rise'; z.t = 0; SFX.zombieRise(); setTimeout(() => SFX.zombieGroan(), 700); }
      } else if (z.state === 'rise') {
        z.t += dt; const k = Math.min(1, z.t / 1.6), e = k * k * (3 - 2 * k);
        f.rotation.x = -Math.PI / 2 * (1 - e) + Math.sin(z.t * 30) * 0.05 * (1 - e); f.position.y = 0.12 * (1 - e);
        z.o.rotation.y = Math.atan2(G.p.x - p.x, G.p.z - p.z);
        if (k >= 1) { z.state = 'chase'; if (!z.scared) { z.scared = true; jumpScare(1); } }
      } else if (z.state === 'chase') {
        z.groan -= dt; if (z.groan <= 0) { z.groan = rnd(3, 5); SFX.zombieGroan(); }
        const yaw = Math.atan2(G.p.x - p.x, G.p.z - p.z); z.o.rotation.y = yaw;
        if (dist > 1.7) { p.x += Math.sin(yaw) * 2.6 * dt; p.z += Math.cos(yaw) * 2.6 * dt; } else { z.atk -= dt; if (z.atk <= 0) { z.atk = 1.1; hurtPlayer(10); } }
        f.rotation.x = 0.18 + Math.sin(G.t * 6) * 0.05; f.rotation.z = Math.sin(G.t * 4) * 0.08;
        if (G.state === 'day' || G.state === 'end') z.state = 'dead';
      } else if (z.state === 'dead') {
        z.t += dt; const k = Math.min(1, z.t / 0.7); f.rotation.x = -Math.PI / 2 * k; f.position.y = 0.12 * k; f.rotation.z *= 0.9;
      }
    }
  }
  function updateScares(dt) {
    if (!['explore', 'fight'].includes(G.state)) return;
    G.jsT = (G.jsT == null ? 45 : G.jsT) - dt;
    if (G.jsT <= 0) { G.jsT = rnd(40, 75) - G.activeIdx * 6; if (G.gravesOpened > 0 || Math.random() < 0.4) jumpScare(); }
    G.hrT = (G.hrT == null ? 6 : G.hrT) - dt;
    if (G.hrT <= 0) { G.hrT = rnd(7, 15); SFX.horrorAmbient(); }
    // arrive at the next grave -> its story is spoken
    const tb = world.specials[G.activeIdx];
    if (G.state === 'explore' && tb && G.arrived !== G.activeIdx && Math.hypot(G.p.x - tb.x, G.p.z - tb.z) < 16) { G.arrived = G.activeIdx; say(GRAVE_LINES[G.activeIdx], 9500); }
    // scary voices from the ghosts floating in the sky
    G.skyT = (G.skyT == null ? 12 : G.skyT) - dt;
    if (G.skyT <= 0) {
      G.skyT = rnd(9, 18);
      const sg = world.skyGhosts[(Math.random() * world.skyGhosts.length) | 0], dx = sg.g.position.x - G.p.x;
      const pan = Math.max(-1, Math.min(1, dx / 60));
      SFX.ghostWail(pan);
      if (Math.random() < 0.3) setTimeout(() => SFX.ghostLaugh(), 1200);
      if (G.activeIdx === 0 && Math.random() < 0.25) setTimeout(() => say(SKY_LINES[(Math.random() * SKY_LINES.length) | 0], 3200), 800);
    }
    // only 3 dolls laugh, and only while you are close
    for (const d of world.dolls) {
      if (!d.laugher) continue;
      const dd = Math.hypot(G.p.x - d.x, G.p.z - d.z);
      d.laughT -= dt;
      if (dd < 14 && d.laughT <= 0) { d.laughT = rnd(5, 8); SFX.dollLaugh(); G.p.shake = Math.max(G.p.shake, 0.25); if (!d.triggered) { d.triggered = true; if (Math.random() < 0.6) setTimeout(() => jumpScare(0), 1000); } }
    }
    updateZombies(dt);
  }

  /* ---------- day / night ---------- */
  const C = (h) => new THREE.Color(h);
  const SKY = { nTop: C(0x0b1235), nMid: C(0x2a3d78), nBot: C(0x1b2548), dTop: C(0x3a82df), dMid: C(0xa9d4ff), dBot: C(0xcfe8ff) };
  function applyDay(d) {
    const u = world.sky.uniforms;
    u.top.value.copy(SKY.nTop).lerp(SKY.dTop, d); u.mid.value.copy(SKY.nMid).lerp(SKY.dMid, d); u.bot.value.copy(SKY.nBot).lerp(SKY.dBot, d);
    scene.fog.color.copy(NIGHT_FOG).lerp(DAY_FOG, d); scene.fog.density = lerp(fogBase, 0.0032, d);
    L.hemi.color.copy(C(0x8fa8ff)).lerp(C(0xdcecff), d); L.hemi.groundColor.copy(C(0x2f3b58)).lerp(C(0x6c8a55), d); L.hemi.intensity = lerp(0.62, 1.25, d);
    L.moonL.color.copy(C(0xa8c0ff)).lerp(C(0xfff0d0), d); L.moonL.intensity = lerp(0.8, 2.1, d);
    L.amb.intensity = lerp(0.14, 0.45, d); L.graveLight.intensity = lerp(1.6, 0, d);
    world.groundMat.color.copy(C(0xb8c8c8)).lerp(C(0xffffff), d);
    renderer.toneMappingExposure = lerp(1.0, 1.0, d);
    world.stars.material.opacity = 0.9 * (1 - d); world.moon.material.opacity = 1 - d; world.sun.material.opacity = d;
    world.clouds.forEach(c => { c.material.color.copy(C(0x39466f)).lerp(C(0xffffff), d); c.material.opacity = lerp(0.85, 0.9, d); });
    world.fogBanks.forEach(c => { c.material.opacity = lerp(c.userData.low ? 0.34 : 0.2, 0.05, d); });
    world.wisps.material.color.copy(C(0x9fd0ff)).lerp(C(0xfff2a0), d);
    flash.intensity = lerp(0.9, 0, d);
    world.dayHide.forEach(m => { if (m._b === undefined) m._b = m.opacity; m.opacity = m._b * (1 - d); });
    world.flames.forEach(s => { s.visible = d < 0.9; });
  }

  /* ---------- ghosts AI ---------- */
  function updateGhosts(dt, t) {
    const px = G.p.x, pz = G.p.z;
    let moving = false;
    for (const gh of G.ghosts) {
      const g = gh.group, p = g.position;
      gh.spawnT = Math.min(1, gh.spawnT + dt / (gh.kind === 'boss' ? 4 : 1.3));
      const sp = smooth(gh.spawnT);
      if (gh.kind === 'boss') { p.y = lerp(-8, 0, sp); gh.inner.scale.setScalar(lerp(0.6, 1, sp)); }
      else { gh.inner.scale.setScalar(gh.S * lerp(0.3, 1, sp)); gh.mat.opacity = (gh.kind === 'rick' ? 0.92 : 0.82) * sp; }
      const dx = px - p.x, dz = pz - p.z, dist = Math.hypot(dx, dz) || 0.001;
      const want = Math.atan2(dx, dz);
      let da = want - gh.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); gh.yaw += da * Math.min(1, dt * 5); g.rotation.y = gh.yaw;
      const m = gh.m || 1;

      if (gh.kind === 'clone') {
        if (gh.spawnT >= 1) {
          const spd = 3.0 + G.activeIdx * 0.6;
          if (dist > 1.9) { const wv = Math.sin(t * 2 + gh.phase) * 1.1; p.x += (dx / dist * spd + (-dz / dist) * wv) * dt; p.z += (dz / dist * spd + (dx / dist) * wv) * dt; }
          else { gh.atkCd -= dt; if (gh.atkCd <= 0) { gh.atkCd = 1.2 / (1 + G.activeIdx * 0.15); hurtPlayer(8 * dmgMult(G.activeIdx)); gh.arms[0].rotation.x = 1.2; } }
        }
        p.y = gh.hover + Math.sin(t * 2 + gh.phase) * 0.16;
        // separation
        for (const o of G.ghosts) if (o !== gh && o.kind !== 'boss') { const ox = p.x - o.group.position.x, oz = p.z - o.group.position.z, d2 = ox * ox + oz * oz; if (d2 < 1.2 && d2 > 0.0001) { const d = Math.sqrt(d2); p.x += ox / d * dt * 1.5; p.z += oz / d * dt * 1.5; } }
      } else if (gh.kind === 'rick') {
        if (gh.spawnT >= 1) {
          gh.dirT -= dt; if (gh.dirT <= 0) { gh.dir *= -1; gh.dirT = rnd(2, 4); }
          const want2 = 9, ds = dist - want2, rad = ds * 0.6;
          const sx = -dz / dist * gh.dir * 3.2, sz = dx / dist * gh.dir * 3.2;
          p.x += (dx / dist * clamp(rad, -3.5, 3.5) + sx) * dt; p.z += (dz / dist * clamp(rad, -3.5, 3.5) + sz) * dt;
          p.x = clamp(p.x, -56, 56); p.z = clamp(p.z, -66, 66);
          gh.shootCd -= dt;
          if (gh.shootCd <= 0 && gh.tele <= 0) {
            gh.shootCd = 2.4 / (1 + G.activeIdx * 0.22);
            const burst = 1 + Math.floor(G.activeIdx / 2); // 1,1,2,2 orbs per volley
            for (let b = 0; b < burst; b++) { _v.set(p.x, p.y + 2.0 * gh.S, p.z); fireOrb(_v, 13 + G.activeIdx * 2.2, 9 * dmgMult(G.activeIdx), 0xff8a30, 0.3, orbSpread(G.activeIdx) + b * 0.4); }
          }
          // clone summoning
          if (G.round && !G.round.rickDead) {
            G.round.timer -= dt;
            if (G.round.timer <= 0 && G.round.spawned < G.round.quota) {
              const cnt = Math.min(3 + (G.activeIdx >= 2 ? 1 : 0), G.round.quota - G.round.spawned), alive = G.ghosts.filter(x => x.kind === 'clone').length;
              if (alive < 9 + G.activeIdx * 2) { spawnClones(cnt, p.x, p.z, 3, 6); G.round.spawned += cnt; SFX.rickScream(0.5); G.round.timer = Math.max(0.9, 2.0 - G.activeIdx * 0.3); updateObjective(); }
              else G.round.timer = 0.8;
            }
          }
          // teleport
          gh.teleT -= dt;
          if (gh.teleT <= 0 && gh.tele <= 0) { gh.tele = 1; gh.teleT = rnd(7, 11); }
          if (gh.tele > 0) {
            gh.tele -= dt * 2.4; gh.mat.opacity = 0.92 * Math.abs(gh.tele - 0.5) * 2;
            if (gh.tele <= 0.5 && !gh.teleDone) { gh.teleDone = true; const a = Math.random() * 6.283, tg = world.specials[G.activeIdx]; p.x = clamp(px + Math.cos(a) * 11, -56, 56); p.z = clamp(pz + Math.sin(a) * 11, -66, 66); sparks(new THREE.Vector3(p.x, 2, p.z), 0xffa050, 24, 5, 1.5); }
            if (gh.tele <= 0) { gh.teleDone = false; }
          }
        }
        p.y = gh.spawnT < 1 ? lerp(-2.2, 0.9, sp) : gh.hover + 0.35 + Math.sin(t * 1.6 + gh.phase) * 0.22;
      } else if (gh.kind === 'boss') {
        if (gh.spawnT >= 1) {
          const spd = gh.enraged ? 4.2 : 3.0; moving = false;
          if (dist > 13) { p.x += dx / dist * spd * dt; p.z += dz / dist * spd * dt; moving = true; }
          p.x = clamp(p.x, -54, 54); p.z = clamp(p.z, -66, 66);
          gh.stompCd -= dt;
          if (moving) { gh.stompT = (gh.stompT || 0) - dt; if (gh.stompT <= 0) { gh.stompT = 1.15; SFX.bossStomp(); G.p.shake = Math.max(G.p.shake, Math.max(0, 0.4 - dist / 60)); } }
          // shockwave slam
          if (gh.stompCd <= 0 && dist < 22) {
            gh.stompCd = gh.enraged ? 4.5 : 6.5; SFX.bossStomp(); G.p.shake = 0.9;
            addRing(p.x, p.z, 0xff5a20);
          }
          gh.shootCd -= dt;
          if (gh.shootCd <= 0) {
            gh.shootCd = gh.enraged ? 1.4 : 2.3; SFX.koalaScream();
            [-1, 1].forEach(s => { for (let k = -1; k <= 1; k++) { gh.inner.localToWorld(_v.set(s * 3.1, 6.7, 1.5)); _v.x += k * 0.6; fireOrb(_v, 14 + (gh.enraged ? 3 : 0), 13 * (gh.enraged ? 1.25 : 1), 0xff4040, 0.32, gh.enraged ? 0.12 : 0.3); } });
          }
          gh.summonCd -= dt;
          if (gh.summonCd <= 0) {
            gh.summonCd = gh.enraged ? 4 : 6.5; const alive = G.ghosts.filter(x => x.kind === 'clone').length;
            if (alive < 9) { spawnClones(3, p.x, p.z, 5, 8); SFX.rickScream(1.3); }
          }
        }
        animateBoss(gh, t, dt, moving);
        g.position.y = p.y;
      }
      if (gh.kind !== 'boss') animateGhost(gh, t, dt);
      // hit flash
      if (gh.hitFlash > 0) {
        gh.hitFlash -= dt;
        if (gh.kind === 'boss') { gh.mat.emissive.setHex(0xff3030); gh.faceMats.forEach(fm => fm.emissive.setHex(0xff4040)); }
        else { gh.mat.emissive.setHex(0xff3030); gh.faceMat.emissive.setHex(0xff5050); }
        if (gh.hitFlash <= 0) {
          if (gh.kind === 'boss') { gh.mat.emissive.setHex(gh.baseEm); gh.faceMats.forEach(fm => fm.emissive.setHex(gh.faceEm)); }
          else { gh.mat.emissive.setHex(gh.baseEm); gh.faceMat.emissive.setHex(gh.faceEm); }
        }
      }
    }
    // dying ghosts fade away
    for (let i = G.dying.length - 1; i >= 0; i--) {
      const d = G.dying[i]; d.t += dt; const gh = d.gh, f = 1 - d.t / (gh.kind === 'boss' ? 2.2 : 0.7);
      if (f <= 0) { scene.remove(gh.group); gh.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); G.dying.splice(i, 1); continue; }
      gh.group.position.y += dt * (gh.kind === 'boss' ? 0.2 : 1.8);
      gh.inner.rotation.y += dt * 6;
      if (gh.kind === 'boss') { gh.inner.scale.setScalar(Math.max(0.01, f)); if (Math.random() < 0.5) sparks(new THREE.Vector3(gh.group.position.x + rnd(-3, 3), rnd(1, 8), gh.group.position.z + rnd(-2, 2)), 0xffa050, 5, 6, 1.5); }
      else { gh.mat.opacity = Math.max(0, f * 0.8); gh.inner.scale.setScalar(gh.S * (0.6 + f * 0.4)); }
    }
  }
  function addRing(x, z, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.15, z); scene.add(m); G.rings.push({ m, r: 1, x, z, hit: false });
  }
  function updateRings(dt) {
    for (let i = G.rings.length - 1; i >= 0; i--) {
      const r = G.rings[i]; r.r += dt * 16; r.m.scale.setScalar(r.r); r.m.material.opacity = Math.max(0, 0.9 - r.r / 36);
      const d = Math.hypot(G.p.x - r.x, G.p.z - r.z);
      if (!r.hit && Math.abs(d - r.r) < 1.2) { r.hit = true; hurtPlayer(14 * (G.boss ? G.boss.m : 1)); }
      if (r.r > 36) { scene.remove(r.m); G.rings.splice(i, 1); }
    }
  }

  /* ---------- tomb visuals ---------- */
  function updateTombs(dt, t) {
    world.specials.forEach((tb, i) => {
      const active = i === G.activeIdx && (G.state === 'explore' || G.state === 'opening');
      if (tb.state === 'opening' || tb.state === 'done') tb.open = Math.min(1, tb.open + dt / 2.2);
      const o = smooth(tb.open);
      tb.lid.position.set(tb.lidBase.x + o * 1.7, tb.lidBase.y + o * 0.12, tb.lidBase.z + o * 0.3); tb.lid.rotation.y = o * 0.45; tb.lid.rotation.z = -o * 0.08;
      const target = tb.state === 'done' ? 0.28 : (tb.state === 'opening' ? 1.1 : (active ? 1 : 0.55));
      tb.glow += (target - tb.glow) * Math.min(1, dt * 3);
      const pulse = 0.85 + Math.sin(t * 2.4 + i) * 0.15;
      const fl = tb.state === 'opening' ? (0.6 + Math.random() * 0.6) : 1;
      tb.disc.material.opacity = Math.min(1, tb.glow * pulse * fl) * (1 - G.day);
      tb.halo.material.opacity = tb.glow * 0.55 * pulse * fl * (1 - G.day);
      tb.crossMat.emissiveIntensity = 0.5 + tb.glow * 0.7;
      tb.innerMat.color.setHex(tb.open > 0.2 ? (tb.state === 'done' ? 0x803000 : 0xff7a1a) : 0x2a0d00);
      tb.beam.visible = active || tb.state === 'opening';
      if (tb.beam.visible) { tb.beam.material.opacity = 0.55 + Math.sin(t * 3) * 0.12; }
    });
    // single real light follows the active tomb
    const at = world.specials[Math.min(G.activeIdx, 4)];
    if (G.day < 0.9) {
      const flick = G.state === 'opening' ? 0.5 + Math.random() * 1.2 : 1;
      L.graveLight.position.set(at.x, 3.2, at.z); L.graveLight.intensity = lerp(1.6, 0, G.day) * (0.9 + Math.sin(t * 3) * 0.1) * flick;
    }
    world.flames.forEach((s, i) => { if (s.visible && s.scale.x < 3) { const k = 0.85 + Math.sin(t * 9 + i * 1.7) * 0.15 + Math.random() * 0.1; s.scale.set(0.9 * k, 0.9 * k, 1); } });
  }

  /* ---------- player update ---------- */
  function updatePlayer(dt, t) {
    const p = G.p, k = G.keys;
    const control = ['explore', 'opening', 'fight', 'day', 'ticket'].includes(G.state) || (G.state === 'intro' && G.introT > 4.4);
    if (control) {
      if (k.ArrowLeft) p.yaw += 1.9 * dt; if (k.ArrowRight) p.yaw -= 1.9 * dt;
      if (k.ArrowUp) p.pitch = clamp(p.pitch + 1.4 * dt, -1.35, 1.35); if (k.ArrowDown) p.pitch = clamp(p.pitch - 1.4 * dt, -1.35, 1.35);
      let fx = 0, fz = 0;
      if (k.KeyW) fz += 1; if (k.KeyS) fz -= 1; if (k.KeyD) fx += 1; if (k.KeyA) fx -= 1;
      const sprint = (k.ShiftLeft || k.ShiftRight) && fz > 0;
      const sp = sprint ? 8.2 : 5.3;
      const l = Math.hypot(fx, fz);
      if (l > 0) {
        fx /= l; fz /= l;
        const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
        const mx = (-sy * fz + cy * fx) * sp * dt, mz = (-cy * fz - sy * fx) * sp * dt;
        const ox = p.x, oz = p.z; movePlayer(mx, mz);
        const moved = Math.hypot(p.x - ox, p.z - oz); p.step += moved; p.bob += moved * 2.6;
        if (p.step > (sprint ? 2.5 : 1.9)) { p.step = 0; SFX.step(sprint); }
      }
      if (k.Space || G.mouse) { const now = G.t; if (G.reloading <= 0 && now >= G.nextShot && G.state !== 'day') fire(now); }
    } else if (G.state === 'intro') {
      p.z = lerp(96, 76, smooth(clamp(G.introT / 4.6, 0, 1))); p.bob = G.introT * 6;
      if (Math.floor(G.introT * 1.9) !== Math.floor((G.introT - dt) * 1.9) && G.introT < 4.5) SFX.step(false);
    }
    if (G.reloading > 0) { G.reloading -= dt; if (G.reloading <= 0) { G.ammo = WEAPONS[G.wl].mag; } }
    if (p.hurt > 0) p.hurt -= dt;
    p.shake = Math.max(0, p.shake - dt * 1.5);
    G.recoil = Math.max(0, G.recoil - dt * 9);
    // camera
    const bobY = Math.sin(p.bob) * 0.045, shk = p.shake;
    let y = 1.7 + bobY;
    if (G.state === 'dead') { y = lerp(1.7, 0.4, smooth(clamp(G.deadT / 1.2, 0, 1))); }
    camera.position.set(p.x + (Math.random() - 0.5) * shk * 0.12, y + (Math.random() - 0.5) * shk * 0.12, p.z + (Math.random() - 0.5) * shk * 0.12);
    camera.rotation.y = p.yaw; camera.rotation.x = p.pitch + G.recoil * 0.012; camera.rotation.z = G.state === 'dead' ? smooth(clamp(G.deadT / 1.2, 0, 1)) * 0.9 : Math.sin(p.bob * 0.5) * 0.004 + (Math.random() - 0.5) * shk * 0.01;
    // gun sway
    gun.g.position.set(gun.base.x + Math.sin(p.bob * 0.5) * 0.006, gun.base.y + Math.abs(Math.sin(p.bob)) * 0.008 - G.recoil * 0.015 - (G.reloading > 0 ? Math.sin(clamp(1 - G.reloading / 1.25, 0, 1) * Math.PI) * 0.18 : 0), gun.base.z + G.recoil * 0.07);
    gun.g.rotation.x = G.recoil * 0.1 + (G.reloading > 0 ? Math.sin(clamp(1 - G.reloading / 1.25, 0, 1) * Math.PI) * 0.7 : 0);
    gun.core.rotation.y += dt * 3; gun.core.rotation.x += dt * 1.7;
    if (G.flashT > 0) { G.flashT -= dt; if (G.flashT <= 0) { gun.mf.visible = false; } }
    muzzleL.intensity = Math.max(0, muzzleL.intensity - dt * 40);
    gun.g.visible = G.state !== 'dead';
    // moon shadow follows
    L.moonL.position.set(p.x - 40 + G.day * 70, 70 + G.day * 20, p.z + 30 - G.day * 50); L.moonL.target.position.set(p.x, 0, p.z);
  }

  /* ---------- main update ---------- */
  function update(dt) {
    G.t += dt; const t = G.t;
    if (G.flashAdd) { L.hemi.intensity -= G.flashAdd * dt * 6; G.flashAdd -= dt * 6; if (G.flashAdd <= 0) { G.flashAdd = 0; applyDayLights(); } }
    // gate
    if (G.state === 'intro' || G.state === 'lobby') {
      if (G.state === 'intro' && G.gateOpening) {
        G.gateT += dt;
        if (G.gateT >= 3.2) { const gi = world.colliders.indexOf(world.gateCollider); if (gi >= 0) world.colliders.splice(gi, 1); }   // gate fully open -> remove the invisible wall
      }
      const o = G.state === 'intro' ? smooth(clamp(G.gateT / 3.2, 0, 1)) : 0;
      world.gate.left.rotation.y = o * 1.5; world.gate.right.rotation.y = -o * 1.5;
    }
    if (G.state === 'intro') {
      G.introT += dt;
      if (G.introT > 5.0 && G.introDone) { G.state = 'explore'; world.gate.left.rotation.y = 1.5; world.gate.right.rotation.y = -1.5; const i = world.colliders.indexOf(world.gateCollider); if (i >= 0) world.colliders.splice(i, 1); updateObjective(); setTimeout(() => G.state === 'explore' && sayWait(INTRO_LINES[2]), 800); }
    }
    if (G.state === 'opening') {
      G.openT += dt + (G.fastOpen ? 5 : 0);
      if (G.openT > 3.0) { startRound(); }
    }
    if (['explore', 'opening', 'fight'].includes(G.state)) {
      // random lightning & whispers
      G.lightT -= dt; if (G.lightT <= 0) { G.lightT = G.state === 'fight' ? rnd(14, 24) : rnd(18, 32); lightning(); }
      G.whisperT -= dt; if (G.whisperT <= 0 && G.state !== 'opening') { G.whisperT = rnd(26, 40); if (G.state === 'explore' && G.activeIdx === 0) say(WHISPERS[rint(0, WHISPERS.length - 1)], 4200); }   // random whispers only before the first grave is cleared
      if (Math.random() < dt * 0.04) SFX.owl();
    }
    if (G.state === 'fight') {
      updateGhosts(dt, t);
      if (G.round && G.round.boss === false && G.ghosts.length === 0 && G.round.spawned >= G.round.quota) roundCleared();
      else if (G.round && G.round.boss === false && G.ghosts.length === 0 && G.round.rickDead) roundCleared();
      // update objective periodically
    } else if (G.dying.length) updateGhosts(dt, t);
    updateOrbs(dt); updateRings(dt); updateSparks(dt);
    // tracers
    tracers.forEach(m => { if (m.visible) { m.userData.life -= dt; m.material.opacity = Math.max(0, m.userData.life / 0.09); if (m.userData.life <= 0) m.visible = false; } });
    // day transition
    if (G.state === 'day') {
      G.dayT += dt;
      G.day = smooth(clamp((G.dayT - 1.0) / 7, 0, 1)); applyDay(G.day);
      if (G.dayT > 3 && !G.ticketSpawned) {
        G.ticketSpawned = true; const tb = world.specials[4]; world.ticket.visible = true; world.ticket.position.set(tb.x, 1.0, tb.z); SFX.pickup();
        say('A golden light rises from the final grave...', 3800);
      }
      if (G.dayT > 8.2) { G.state = 'ticket'; say('The Golden Ticket is yours to take. Touch it!', 4200); updateObjective(); }
    }
    if (G.ticketSpawned && world.ticket.visible && !G.ticketTaken) {
      const tk = world.ticket, tb = world.specials[4];
      G.ticketT += dt; const rise = smooth(clamp((G.dayT - 3) / 3, 0, 1));
      tk.position.set(tb.x, lerp(1.0, 2.6, rise) + Math.sin(t * 2) * 0.12, tb.z + lerp(0, 4.2, rise)); tk.rotation.y += dt * 1.6;
      if (G.state === 'ticket' && Math.hypot(G.p.x - tk.position.x, G.p.z - tk.position.z) < 2.6) takeTicket();
      if (Math.random() < dt * 14) sparks(new THREE.Vector3(tk.position.x + rnd(-1.5, 1.5), tk.position.y + rnd(-0.8, 0.8), tk.position.z + rnd(-0.5, 0.5)), 0xffd25a, 2, 1.2, 1);
    }
    if (G.state === 'dead') { G.deadT += dt; if (G.deadT > 3.4) showEnd(false); }
    if (G.state === 'win') { G.deadT += dt; if (G.deadT > 3.2) showEnd(true); if (Math.random() < dt * 25) sparks(new THREE.Vector3(G.p.x + rnd(-6, 6), rnd(0.5, 6), G.p.z + rnd(-6, 6) - 5), [0xffd25a, 0xff6a00, 0xffffff][rint(0, 2)], 6, 6, 1.5); }
    // heartbeat low HP
    if (G.p.hp < 30 && G.p.hp > 0 && ['explore', 'fight', 'opening'].includes(G.state)) { G.heartT -= dt; if (G.heartT <= 0) { G.heartT = 0.85; SFX.heartbeat(); } }
    // birds in the day
    if (G.day > 0.6 && G.state !== 'win') { G.birdT -= dt; if (G.birdT <= 0) { G.birdT = rnd(1.5, 4); SFX.bird(); } }
    updatePlayer(dt, t);
    updateTombs(dt, t);
    animateWorld(dt, t);
    updateHud(dt);
  }
  function applyDayLights() { if (G.day < 1) L.hemi.intensity = lerp(0.62, 1.25, G.day); }

  function animateWorld(dt, t) {
    world.clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 360) c.position.x = -360; });
    world.fogBanks.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 85) c.position.x = -85; else if (c.position.x < -85) c.position.x = 85; c.position.y = (c.userData.low ? 1.1 : 1.6) + Math.sin(t * 0.3 + c.userData.base) * 0.3; });
    updateHorror(world, t, dt, G.p.x, G.p.z); updateSkyGhosts(world, t, dt, G.p.x, G.p.z); updateTheme(dt); updateScares(dt);
    const wp = world.wisps.geometry.attributes.position;
    for (let i = 0; i < wp.count; i++) { wp.setY(i, wp.getY(i) + Math.sin(t + i) * dt * 0.3 + dt * 0.12); wp.setX(i, wp.getX(i) + Math.cos(t * 0.5 + i) * dt * 0.25); if (wp.getY(i) > 10) wp.setY(i, 0.3); }
    wp.needsUpdate = true;
    world.sky.mesh.position.copy(camera.position); world.stars.position.copy(camera.position); world.stars.rotation.y += dt * 0.002;
    // keep sun/moon fixed relative to camera
    world.moon.position.set(camera.position.x - 170, 190, camera.position.z - 250); world.sun.position.set(camera.position.x + 120, 200, camera.position.z - 260);
  }

  function takeTicket() {
    G.ticketTaken = true; world.ticket.visible = false; G.state = 'win'; G.deadT = 0; G.win = true;
    SFX.pickup(); setTimeout(() => SFX.win(), 400);
    sparks(world.ticket.position, 0xffd25a, 200, 10, 1.6);
    banner('YOU WIN!', '1,000,000 BTC golden ticket claimed', 3400, '#ffd25a');
    say('The ticket is yours... for now.', 3000);
    G.mouse = false; try { document.exitPointerLock(); } catch (e) { }
  }

  /* ---------- HUD ---------- */
  const mini = $('mini'), mctx = mini.getContext('2d'), MS = 190, MSC = 1.5;
  function drawMini() {
    const c = mctx, p = G.p, cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cx = MS / 2;
    const m2s = (x, z) => { const dx = x - p.x, dz = z - p.z; return [cx + (dx * cy - dz * sy) * MSC, cx - (dx * -sy + dz * -cy) * MSC]; };
    c.clearRect(0, 0, MS, MS); c.save(); c.beginPath(); c.arc(cx, cx, cx - 2, 0, 7); c.clip();
    c.fillStyle = G.day > 0.5 ? 'rgba(70,110,70,0.85)' : 'rgba(10,18,38,0.86)'; c.fillRect(0, 0, MS, MS);
    // roads
    c.strokeStyle = 'rgba(160,140,110,0.55)'; c.lineCap = 'round';
    ROADS.forEach(r => { const a = m2s(r[0], r[1]), b = m2s(r[2], r[3]); c.lineWidth = r[4] * MSC; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
    // walls
    c.strokeStyle = 'rgba(200,210,230,0.7)'; c.lineWidth = 2; c.beginPath();
    [[-60, -70], [60, -70], [60, 70], [-60, 70], [-60, -70]].forEach((q, i) => { const s = m2s(q[0], q[1]); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.stroke();
    // graves
    c.fillStyle = 'rgba(150,160,180,0.7)';
    world.graves.forEach(g => { const s = m2s(g.x, g.z); if (Math.abs(s[0] - cx) < cx && Math.abs(s[1] - cx) < cx) c.fillRect(s[0] - 1.5, s[1] - 1.5, 3, 3); });
    world.communityGraves.forEach(g => { const s = m2s(g.x, g.z); c.fillStyle = 'rgba(190,200,230,0.9)'; c.fillRect(s[0] - 2, s[1] - 2, 4, 4); });
    // special graves
    world.specials.forEach((tb, i) => {
      const s = m2s(tb.x, tb.z), act = i === G.activeIdx && tb.state !== 'done', done = tb.state === 'done';
      c.fillStyle = done ? '#4ad98a' : (act ? '#ff8a20' : '#a35a1f');
      c.beginPath(); c.arc(s[0], s[1], act ? 6 + Math.sin(G.t * 5) * 1.5 : 4.5, 0, 7); c.fill();
      if (act) { c.strokeStyle = 'rgba(255,160,50,0.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(s[0], s[1], 10 + Math.sin(G.t * 5) * 2, 0, 7); c.stroke(); }
      c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText(tb.rank, s[0], s[1] + 3);
    });
    // ghosts & orbs
    G.ghosts.forEach(g => { const s = m2s(g.group.position.x, g.group.position.z); c.fillStyle = g.kind === 'boss' ? '#ff2020' : (g.kind === 'rick' ? '#ff7030' : '#ff5a5a'); c.beginPath(); c.arc(s[0], s[1], g.kind === 'boss' ? 7 : (g.kind === 'rick' ? 4.5 : 3), 0, 7); c.fill(); });
    c.fillStyle = '#ffd25a'; G.orbs.forEach(o => { const s = m2s(o.m.position.x, o.m.position.z); c.fillRect(s[0] - 1, s[1] - 1, 2, 2); });
    if (world.ticket.visible) { const s = m2s(world.ticket.position.x, world.ticket.position.z); c.fillStyle = '#ffd25a'; c.beginPath(); c.arc(s[0], s[1], 6 + Math.sin(G.t * 6) * 1.5, 0, 7); c.fill(); }
    // objective pointer
    let tgt = null;
    if (G.state === 'explore' || G.state === 'intro') tgt = world.specials[G.activeIdx]; else if (G.state === 'ticket' && world.ticket.visible) tgt = { x: world.ticket.position.x, z: world.ticket.position.z };
    if (tgt) {
      const s = m2s(tgt.x, tgt.z), dx = s[0] - cx, dy = s[1] - cx, d = Math.hypot(dx, dy);
      if (d > cx - 14) { const a = Math.atan2(dy, dx), r = cx - 10; c.save(); c.translate(cx + Math.cos(a) * r, cx + Math.sin(a) * r); c.rotate(a); c.fillStyle = '#ffb040'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore(); }
    }
    // player
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(cx, cx - 8); c.lineTo(cx - 5.5, cx + 6); c.lineTo(cx, cx + 3); c.lineTo(cx + 5.5, cx + 6); c.closePath(); c.fill();
    // field of view
    c.fillStyle = 'rgba(255,255,255,0.10)'; c.beginPath(); c.moveTo(cx, cx); c.arc(cx, cx, 60, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62); c.closePath(); c.fill();
    c.restore();
    // north marker
    const n = m2s(p.x, p.z - 100), na = Math.atan2(n[1] - cx, n[0] - cx);
    c.fillStyle = '#9fd0ff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('N', cx + Math.cos(na) * (cx - 9), cx + Math.sin(na) * (cx - 9) + 4);
  }
  let lastObjN = -1;
  function updateHud(dt) {
    G.hudT -= dt;
    if (G.subT > 0) { G.subT -= dt; if (G.subT <= 0) $('sub').classList.remove('on'); }
    const hpf = G.p.hp / 100;
    $('hpBar').style.width = hpf * 100 + '%'; $('hpBar').className = hpf < 0.3 ? 'low' : ''; $('hpText').textContent = Math.ceil(G.p.hp);
    $('vig').style.opacity = clamp(G.p.hurt * 1.6 + (G.p.hp < 30 ? 0.35 + Math.sin(G.t * 6) * 0.15 : 0), 0, 0.9);
    if (G.hudT <= 0) {
      G.hudT = 0.1;
      const w = WEAPONS[G.wl];
      $('wName').textContent = w.name; $('wName').style.color = w.css;
      $('ammo').textContent = G.reloading > 0 ? 'RELOADING…' : G.ammo + ' / ' + w.mag;
      [...$('wLevel').children].forEach((d, i) => { d.style.background = i < G.wl ? w.css : '#333'; d.style.boxShadow = i < G.wl ? '0 0 8px ' + w.css : 'none'; });
      $('kills').textContent = G.kills;
      $('graves').textContent = world.specials.filter(x => x.state === 'done').length;
      const n = G.ghosts.length + (G.round ? Math.max(0, G.round.quota - G.round.spawned) : 0);
      if (G.state === 'fight' && n !== lastObjN) { lastObjN = n; updateObjective(); }
      // prompt + distance
      const t = world.specials[Math.min(G.activeIdx, 4)];
      const d = Math.hypot(G.p.x - t.x, G.p.z - t.z);
      if (G.state === 'explore' && d < 5.8) { $('prompt').textContent = 'Press  E  to open ' + t.name + '’s grave'; $('prompt').classList.add('on'); } else $('prompt').classList.remove('on');
      let dist = '';
      if (G.state === 'explore') dist = Math.round(d) + ' m to ' + t.name; else if (G.state === 'ticket') dist = 'Touch the ticket';
      $('objDist').textContent = dist;
      if (G.state === 'fight' && G.boss && !G.boss.dead) $('bossFill').style.width = Math.max(0, G.boss.hp / G.boss.maxHp * 100) + '%';
      $('bossHp').textContent = G.boss ? Math.max(0, Math.ceil(G.boss.hp)) + ' / ' + BOSS_HP : '';
    }
    G.miniT -= dt; if (G.miniT <= 0) { G.miniT = 0.033; drawMini(); }
  }

  /* ---------- end screen & transaction ---------- */
  function showEnd(win) {
    if (G.state === 'end') return;
    G.state = 'end'; G.endTime = performance.now();
    const time = Math.round((G.endTime - G.startTime) / 1000);
    const graves = win ? 5 : world.specials.filter(x => x.state === 'done').length;
    const score = G.kills * 100 + G.heads * 50 + (win ? 5000 + Math.max(0, 600 - time) * 5 + Math.round(G.p.hp) * 10 : 0) + graves * 500;
    G.stats = { name: G.name, win, score, graves, kills: G.kills, time, heads: G.heads };
    $('hud').classList.add('hide'); $('pause').classList.add('hide');
    const e = $('end'); e.classList.remove('hide'); e.classList.toggle('win', win);
    $('eTitle').textContent = win ? 'YOU WON THE GOLDEN TICKET' : 'RICK CLAIMED YOUR SOUL';
    $('eSub').textContent = win ? 'One million Bitcoin of glory. The ghosts bow to you.' : 'Even the dead are laughing. Try again?';
    $('eStats').innerHTML = [['Player', G.name], ['Result', win ? 'WIN' : 'LOSE'], ['Score', score], ['Graves opened', graves + ' / 5'], ['Ghosts destroyed', G.kills], ['Headshots', G.heads], ['Time', time + 's']].map(r => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    SFX.music(win ? 'day' : 'off');
    const canSubmit = win && !practice;
    $('btnSubmit').style.display = canSubmit ? '' : 'none'; $('btnSubmit').disabled = false; $('btnSubmit').textContent = 'SUBMIT SCORE ON-CHAIN (HEMI MAINNET)';
    $('txStatus').className = ''; $('txStatus').textContent = canSubmit ? 'Wallet: ' + Chain.short() + ' · a wallet popup will ask you to confirm.' : (win ? '' : 'Only winners who claim the golden ticket can submit a score.');
  }
  $('btnSubmit').addEventListener('click', async () => {
    const st = $('txStatus'), b = $('btnSubmit'); b.disabled = true; st.className = ''; st.textContent = 'Confirm the transaction in your wallet…';
    try {
      const r = await Chain.submitScore({ name: G.stats.name, score: G.stats.score, graves: G.stats.graves, kills: G.stats.kills, time: G.stats.time });
      st.className = 'ok'; st.innerHTML = 'Transaction sent, waiting for confirmation…<br><code>' + r.hash.slice(0, 20) + '…' + r.hash.slice(-8) + '</code><br><a target="_blank" rel="noopener" href="' + Chain.explorerTx(r.hash) + '">View on Hemi Explorer ↗</a>';
      b.textContent = 'SCORE SUBMITTED ✔'; SFX.pickup();
      const rc = await Chain.waitReceipt(r.hash);
      if (rc) st.innerHTML = 'Score recorded on-chain ✔<br><code>' + r.hash.slice(0, 20) + '…' + r.hash.slice(-8) + '</code><br><a target="_blank" rel="noopener" href="' + Chain.explorerTx(r.hash) + '">View on Hemi Explorer ↗</a>';
    } catch (e) {
      b.disabled = false; st.className = 'err';
      st.textContent = e && e.code === 4001 ? 'You rejected the transaction. Press the button to try again.' : 'Transaction failed: ' + ((e && (e.message || e.reason)) || e);
      b.textContent = 'TRY AGAIN';
    }
  });
  $('btnAgain').addEventListener('click', () => { location.reload(); });

  /* ---------- lobby background camera ---------- */
  function lobbyCam(t) { // original lobby view: the cemetery gate from outside the wall
    camera.position.set(Math.sin(t * 0.12) * 12, 5.2 + Math.sin(t * 0.2) * 0.6, 100);
    camera.lookAt(Math.sin(t * 0.1) * 6, 6, 40);
    gun.g.visible = false;
  }

  /* ---------- main loop ---------- */
  applyDay(0); setWeaponVisual(1); setTheme(0); setHorrorVisible(world, false); // hide the scary props in the lobby so the menu doesn't spoil the game
  let last = performance.now(), slow = 0, lowCount = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.state === 'lobby') {
      G.t += dt; lobbyCam(G.t); animateWorld(dt, G.t); updateTheme(dt);
      world.specials.forEach((tb, i) => { tb.disc.material.opacity = 0.6 + Math.sin(G.t * 2 + i) * 0.15; tb.halo.material.opacity = 0.5; });
      L.graveLight.position.set(world.specials[0].x, 3, world.specials[0].z);
      world.flames.forEach((s, i) => { if (s.scale.x < 3) { const k = 0.85 + Math.sin(G.t * 9 + i * 1.7) * 0.15; s.scale.set(0.9 * k, 0.9 * k, 1); } });
    } else if (!G.paused && G.state !== 'end') update(dt);
    else if (G.state === 'end') { G.t += dt; updateSparks(dt); animateWorld(dt, G.t); }
    renderer.render(scene, camera);
    // adaptive resolution
    slow = slow * 0.95 + dt * 0.05;
    if (slow > 0.036 && pixelRatio > 0.7 && G.t > 3) { lowCount++; if (lowCount > 90) { lowCount = 0; pixelRatio = Math.max(0.6, pixelRatio * 0.8); renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth, innerHeight); } } else lowCount = 0;
  }
  requestAnimationFrame(loop);

  /* ---------- debug hooks (used for automated testing) ---------- */
  window.__G = {
    G, world, camera, scene, SFX, WEAPONS, renderer,
    teleportToActive() { const t = world.specials[G.activeIdx]; G.p.x = t.x; G.p.z = t.z + 5.2; G.p.yaw = 0; },
    killAll() { G.ghosts.slice().forEach(g => damageGhost(g, 99999, true)); },
    hit(n) { G.ghosts.forEach(g => damageGhost(g, n, false)); },
    skipIntro() { G.introT = 5.1; G.gateOpening = true; G.gateT = 4; G.introDone = true; G.introTok = (G.introTok || 0) + 1; },
    face(x, z) { G.p.yaw = Math.atan2(-(x - G.p.x), -(z - G.p.z)); },
    end(win) { showEnd(win); },
    fire() { fire(G.t); },
    jumpScare(k) { jumpScare(k); }
  };
})();

