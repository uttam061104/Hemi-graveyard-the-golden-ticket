/* ===== Hemi's Graveyard — wallet (MetaMask / Rabby) + on-chain score on HEMI MAINNET ===== */
const Chain = (function () {

  /* ------------------------------------------------------------------
     CONFIG — the only part you should ever need to edit
     ------------------------------------------------------------------ */
  // >>> After deploying the NEW contract, paste its address between the quotes on the next line <<<
  const CONTRACT_ADDRESS = '0xadDb40da2AF99F0494E8BE0Bb0B6c8ECA6d79d0D';

  // Function the game calls on your contract. MUST match your Solidity function exactly.
  // The args below are filled in this order from the game result:
  //   name (string), score (uint32), graves (uint16), kills (uint16), time (uint32)
  const CONTRACT_FN = {
    signature: 'submitScore(string,uint32,uint16,uint16,uint32)',
    args: ['name', 'score', 'graves', 'kills', 'time']
  };

  // Start-of-game transaction: calls your contract (submitScore with all zeros) to mark "this player started a run".
  // The player pays only the tiny network gas. Set to false to turn the start transaction off.
  const REQUIRE_START_TX = true;

  // Function called when a player presses "Enter the Graveyard" (separate from submitScore).
  const START_FN = { signature: 'startGame(string)' };

  const HEMI = {
    chainId: '0x' + (43111).toString(16),            // 0xa867 — Hemi Mainnet
    chainName: 'Hemi',
    rpcUrls: ['https://rpc.hemi.network/rpc'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://explorer.hemi.xyz']
  };

  const WALLETS = {
    metamask: { name: 'MetaMask', rdns: 'io.metamask', install: 'https://metamask.io/download/' },
    rabby: { name: 'Rabby', rdns: 'io.rabby', install: 'https://rabby.io/' }
  };

  /* ------------------------------------------------------------------
     Minimal keccak-256 + ABI encoder (no external libraries needed)
     ------------------------------------------------------------------ */
  const M = (1n << 64n) - 1n;
  const RC = [0x0000000000000001n, 0x0000000000008082n, 0x800000000000808An, 0x8000000080008000n, 0x000000000000808Bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n, 0x000000000000008An, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000An, 0x000000008000808Bn, 0x800000000000008Bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n, 0x000000000000800An, 0x800000008000000An, 0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n];
  const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
  const rotl = (x, n) => n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M;
  function keccakF(s) {
    for (let r = 0; r < 24; r++) {
      const C = [], B = new Array(25);
      for (let x = 0; x < 5; x++) C[x] = s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20];
      for (let x = 0; x < 5; x++) { const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1); for (let y = 0; y < 5; y++) s[x + 5 * y] ^= D; }
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x][y]);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5 * y] = B[x + 5 * y] ^ ((~B[(x + 1) % 5 + 5 * y] & M) & B[(x + 2) % 5 + 5 * y]);
      s[0] ^= RC[r];
    }
  }
  function keccak256(bytes) {
    const rate = 136, s = new Array(25).fill(0n);
    const padLen = rate - (bytes.length % rate);
    const p = new Uint8Array(bytes.length + padLen); p.set(bytes);
    p[bytes.length] ^= 0x01; p[p.length - 1] ^= 0x80;
    for (let off = 0; off < p.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) { let v = 0n; for (let b = 7; b >= 0; b--) v = (v << 8n) | BigInt(p[off + i * 8 + b]); s[i] ^= v; }
      keccakF(s);
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) { let v = s[i]; for (let b = 0; b < 8; b++) { out[i * 8 + b] = Number(v & 0xffn); v >>= 8n; } }
    return out;
  }
  const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
  const word = n => BigInt(n).toString(16).padStart(64, '0');

  function encodeCall(signature, types, values) {
    const selector = hex(keccak256(new TextEncoder().encode(signature))).slice(0, 8);
    let head = '', tail = '';
    const headSize = types.length * 32;
    types.forEach((t, i) => {
      const v = values[i];
      if (t === 'string') {
        const b = new TextEncoder().encode(String(v));
        head += word(headSize + tail.length / 2);
        tail += word(b.length) + hex(b).padEnd(Math.ceil(b.length / 32) * 64, '0');
      } else if (/^uint\d*$/.test(t)) {
        const bits = parseInt(t.slice(4), 10) || 256;                       // e.g. uint16 -> 16
        const max = (1n << BigInt(bits)) - 1n;
        let n = BigInt(Math.max(0, Math.floor(Number(v) || 0)));
        if (n > max) n = max;                                               // never overflow the contract's type
        head += word(n);
      } else if (t === 'bool') {
        head += word(v ? 1 : 0);
      } else if (t === 'address') {
        head += String(v).replace(/^0x/, '').toLowerCase().padStart(64, '0');
      } else throw new Error('Unsupported ABI type: ' + t);
    });
    return '0x' + selector + head + tail;
  }
  function cleanName(n) {   // contract requires 1–20 BYTES
    let c = String(n || '').replace(/[\n\r]/g, ' ').trim() || 'anon';
    while (new TextEncoder().encode(c).length > 20) c = c.slice(0, -1);
    return c;
  }
  function assertContractSet() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS)) throw new Error('Contract address is not set in js/chain.js');
  }
  const FN_TYPES = CONTRACT_FN.signature.slice(CONTRACT_FN.signature.indexOf('(') + 1, -1).split(',').filter(Boolean);

  /* ------------------------------------------------------------------
     Wallet discovery: EIP-6963 + legacy window.ethereum
     ------------------------------------------------------------------ */
  const found = {};
  let active = null, account = null, activeKey = null;

  function onAnnounce(ev) {
    const d = ev && ev.detail; if (!d || !d.provider || !d.info) return;
    for (const k in WALLETS) if (d.info.rdns === WALLETS[k].rdns) found[k] = d.provider;
  }
  window.addEventListener('eip6963:announceProvider', onAnnounce);
  function ask() { try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch (_) { } }
  function legacy() {
    const list = [], w = window;
    if (w.ethereum) { if (Array.isArray(w.ethereum.providers)) list.push(...w.ethereum.providers); list.push(w.ethereum); }
    for (const p of list) {
      if (!p || typeof p.request !== 'function') continue;
      if (p.isRabby) found.rabby = found.rabby || p;
      else if (p.isMetaMask && !p.isBraveWallet && !p.isPhantom && !p.isCoinbaseWallet) found.metamask = found.metamask || p;
    }
  }
  async function detect(maxMs) {
    const t0 = Date.now();
    for (;;) {
      ask(); legacy();
      if (Object.keys(found).length || Date.now() - t0 > (maxMs == null ? 3000 : maxMs)) break;
      await new Promise(r => setTimeout(r, 250));
    }
    return { metamask: !!found.metamask, rabby: !!found.rabby };
  }
  ask(); setTimeout(() => { ask(); legacy(); }, 500);

  async function ensureHemi() {
    const e = active;
    try {
      await e.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: HEMI.chainId }] });
    } catch (err) {
      if (err && (err.code === 4902 || err.code === -32603 || /unrecognized|not added|add/i.test(err.message || ''))) {
        await e.request({ method: 'wallet_addEthereumChain', params: [HEMI] });
        await e.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: HEMI.chainId }] });
      } else throw err;
    }
    // Hard guarantee: never send anything unless the wallet is really on Hemi Mainnet.
    const id = await e.request({ method: 'eth_chainId' });
    if (String(id).toLowerCase() !== HEMI.chainId) throw new Error('Wrong network. Please switch your wallet to Hemi Mainnet (chain ID 43111).');
  }

  return {
    HEMI, WALLETS, CONTRACT_ADDRESS, detect,
    has(key) { return !!found[key]; },
    get account() { return account; },
    get walletName() { return activeKey ? WALLETS[activeKey].name : ''; },
    onChange: null,
    short(a) { a = a || account; return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; },
    explorerTx(hash) { return HEMI.blockExplorerUrls[0] + '/tx/' + hash; },
    explorerContract() { return HEMI.blockExplorerUrls[0] + '/address/' + CONTRACT_ADDRESS; },

    async connect(key) {
      await detect(key && found[key] ? 0 : 3000);
      const p = found[key];
      if (!p) throw new Error(location.protocol === 'file:' ? 'FILE_PROTOCOL' : 'NO_WALLET');
      active = p; activeKey = key;
      const accs = await p.request({ method: 'eth_requestAccounts' });
      if (!accs || !accs.length) throw new Error('No account returned by the wallet');
      account = accs[0];
      await ensureHemi();
      if (p.on) {
        p.on('accountsChanged', a => { account = a && a[0] ? a[0] : null; if (Chain.onChange) Chain.onChange(); });
        p.on('chainChanged', () => { /* re-checked before every submit */ });
      }
      return account;
    },

    /* Calls the score contract on Hemi Mainnet. value is always 0 — the game is free, players only pay network gas. */
    async submitScore(r) {
      if (!active || !account) throw new Error('Wallet not connected');
      assertContractSet();
      await ensureHemi();
      const clean = cleanName(r.name);
      const vals = CONTRACT_FN.args.map(a => a === 'name' ? clean : r[a]);
      const data = encodeCall(CONTRACT_FN.signature, FN_TYPES, vals);
      const tx = { from: account, to: CONTRACT_ADDRESS, value: '0x0', data };
      try { await active.request({ method: 'eth_estimateGas', params: [tx] }); }   // catches reverts before the popup
      catch (err) {
        if (err && err.code === 4001) throw err;
        throw new Error('The contract rejected this call (function/arguments mismatch or revert). ' + ((err && err.message) || ''));
      }
      const hash = await active.request({ method: 'eth_sendTransaction', params: [tx] });
      return { hash };
    },
    /* Start-of-run transaction, sent to YOUR contract: startGame(name). value is 0 — the player pays only network gas. */
    REQUIRE_START_TX,
    async startGameTx(name) {
      if (!active || !account) throw new Error('Wallet not connected');
      assertContractSet();
      await ensureHemi();
      const data = encodeCall(START_FN.signature, ['string'], [cleanName(name)]);
      const tx = { from: account, to: CONTRACT_ADDRESS, value: '0x0', data };
      try { await active.request({ method: 'eth_estimateGas', params: [tx] }); }
      catch (err) {
        if (err && err.code === 4001) throw err;
        throw new Error('The contract rejected the start call. ' + ((err && err.message) || ''));
      }
      const hash = await active.request({ method: 'eth_sendTransaction', params: [tx] });
      return { hash };
    },
    async waitReceipt(hash, tries) {
      for (let i = 0; i < (tries || 40); i++) {
        try { const rc = await active.request({ method: 'eth_getTransactionReceipt', params: [hash] }); if (rc) return rc; } catch (_) { }
        await new Promise(r => setTimeout(r, 2500));
      }
      return null;
    }
  };
})();

