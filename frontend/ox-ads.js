/**
 * 0xAds — Embeddable Widget (v3)
 *
 * Usage:
 *   <div id="ox-ad-slot" data-slot-id="1"></div>
 *   <script src="ox-ads.js"></script>
 *
 * Multiple slots on the same page:
 *   <div class="ox-ad-slot" data-slot-id="1"></div>
 *   <div class="ox-ad-slot" data-slot-id="2"></div>
 *   <script src="ox-ads.js"></script>
 */

(function () {
  'use strict';

  // ── CONFIG ───────────────────────────────────────────────────────────────
  const CONTRACT_ADDRESS = '0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab'
  const RPC_URL          = 'http://127.0.0.1:8545';

  const ABI = [
    {
      "inputs": [{"internalType": "uint256", "name": "slotId", "type": "uint256"}],
      "name": "getSlotMeta",
      "outputs": [
        {"internalType": "string",  "name": "name",         "type": "string"},
        {"internalType": "uint256", "name": "siteId",       "type": "uint256"},
        {"internalType": "uint256", "name": "width",        "type": "uint256"},
        {"internalType": "uint256", "name": "height",       "type": "uint256"},
        {"internalType": "uint256", "name": "currentPrice", "type": "uint256"},
        {"internalType": "bool",    "name": "exists",       "type": "bool"}
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "slotId", "type": "uint256"}],
      "name": "getCurrentAd",
      "outputs": [
        {"internalType": "address", "name": "advertiser", "type": "address"},
        {"internalType": "string",  "name": "imageUrl",   "type": "string"},
        {"internalType": "string",  "name": "linkUrl",    "type": "string"},
        {"internalType": "uint256", "name": "price",      "type": "uint256"},
        {"internalType": "uint256", "name": "timestamp",  "type": "uint256"}
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "uint256", "name": "slotId",   "type": "uint256"},
        {"internalType": "string",  "name": "imageUrl", "type": "string"},
        {"internalType": "string",  "name": "linkUrl",  "type": "string"}
      ],
      "name": "placeAd",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true,  "internalType": "uint256", "name": "slotId",     "type": "uint256"},
        {"indexed": true,  "internalType": "uint256", "name": "siteId",     "type": "uint256"},
        {"indexed": true,  "internalType": "address", "name": "advertiser", "type": "address"},
        {"indexed": false, "internalType": "uint256", "name": "price",      "type": "uint256"},
        {"indexed": false, "internalType": "string",  "name": "imageUrl",   "type": "string"},
        {"indexed": false, "internalType": "string",  "name": "linkUrl",    "type": "string"}
      ],
      "name": "AdPlaced",
      "type": "event"
    }
  ];

  // ── STYLES ───────────────────────────────────────────────────────────────
  const CSS = `
    .oxads-widget {
      font-family: system-ui, -apple-system, sans-serif;
      border: 1px solid rgba(79,142,247,0.25);
      border-radius: 8px;
      overflow: hidden;
      background: #0e1525;
      color: #e2e8f0;
      max-width: 100%;
      position: relative;
    }
    .oxads-label {
      position: absolute; top: 6px; left: 6px;
      font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
      background: rgba(79,142,247,0.85); color: #fff; padding: 2px 6px; border-radius: 3px;
      pointer-events: none; z-index: 2;
    }
    .oxads-img-wrap { position: relative; }
    .oxads-img {
      display: block; width: 100%; height: 160px; object-fit: cover;
      cursor: pointer; transition: opacity 0.2s;
    }
    .oxads-img:hover { opacity: 0.9; }
    .oxads-empty {
      height: 160px; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 0.5rem; background: #0e1525;
      color: #64748b; font-size: 0.85rem;
    }
    .oxads-empty-icon { font-size: 2rem; opacity: 0.3; }
    .oxads-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.6rem 0.8rem; background: #0a0f1e; font-size: 0.72rem;
    }
    .oxads-meta { color: #64748b; }
    .oxads-meta strong { color: #4f8ef7; font-family: monospace; }
    .oxads-buy {
      background: #4f8ef7; color: #fff; border: none; border-radius: 5px;
      padding: 0.35rem 0.8rem; font-size: 0.72rem; font-weight: 600; cursor: pointer;
      transition: background 0.15s;
    }
    .oxads-buy:hover { background: #6fa3ff; }
    .oxads-buy:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Buy panel (inline) */
    .oxads-panel {
      position: absolute; inset: 0; background: rgba(7,11,20,0.96);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 1.2rem; z-index: 10; border-radius: 8px;
    }
    .oxads-panel h3 { font-size: 0.95rem; margin-bottom: 1rem; color: #e2e8f0; }
    .oxads-panel input {
      width: 100%; padding: 0.55rem 0.7rem; margin-bottom: 0.7rem;
      background: #151e33; border: 1px solid rgba(255,255,255,0.1); border-radius: 5px;
      color: #e2e8f0; font-size: 0.82rem;
    }
    .oxads-panel input:focus { outline: none; border-color: #4f8ef7; }
    .oxads-panel input::placeholder { color: #64748b; }
    .oxads-panel-actions { display: flex; gap: 0.6rem; width: 100%; }
    .oxads-panel-actions button { flex: 1; padding: 0.55rem; border: none; border-radius: 5px; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
    .oxads-btn-confirm { background: #4f8ef7; color: #fff; }
    .oxads-btn-confirm:hover { background: #6fa3ff; }
    .oxads-btn-cancel  { background: #1e293b; color: #94a3b8; }
    .oxads-panel-msg { font-size: 0.75rem; margin-top: 0.6rem; min-height: 1.2em; }
    .oxads-panel-msg.error  { color: #f75555; }
    .oxads-panel-msg.success { color: #22d3a5; }
    .oxads-branding {
      font-size: 0.6rem; color: #1e3a5f; text-align: right;
      padding: 2px 6px; background: #0a0f1e; letter-spacing: 0.5px;
    }
  `;

  // ── BOOTSTRAP ────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('oxads-styles')) return;
    const style = document.createElement('style');
    style.id = 'oxads-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function loadWeb3(cb) {
    if (window.Web3) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/web3@1.10.0/dist/web3.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  // ── WIDGET ───────────────────────────────────────────────────────────────
  function initSlot(el) {
    const slotId = el.dataset.slotId;
    if (!slotId) return;

    const roWeb3     = new Web3(RPC_URL);
    const roContract = new roWeb3.eth.Contract(ABI, CONTRACT_ADDRESS);

    async function render() {
      try {
        const [slot, ad] = await Promise.all([
          roContract.methods.getSlotMeta(slotId).call(),
          roContract.methods.getCurrentAd(slotId).call()
        ]);
        if (!slot.exists) { el.innerHTML = ''; return; }

        const priceEth  = parseFloat(roWeb3.utils.fromWei(slot.currentPrice, 'ether')).toFixed(4);
        const hasAd     = ad.advertiser !== '0x0000000000000000000000000000000000000000';
        const addrShort = hasAd ? ad.advertiser.slice(0,6)+'…'+ad.advertiser.slice(-4) : '';
        const imgH      = Math.max(60, Math.min(parseInt(slot.height) || 160, 400));

        const imgSection = hasAd && ad.imageUrl
          ? `<div class="oxads-img-wrap">
               <span class="oxads-label">Ad</span>
               <img class="oxads-img" src="${esc(ad.imageUrl)}" alt="advertisement"
                    style="height:${imgH}px"
                    onclick="window.open('${esc(ad.linkUrl)}','_blank','noopener')"
                    onerror="this.parentElement.innerHTML='<div class=oxads-empty style=height:${imgH}px><span class=oxads-empty-icon>🖼️</span>Image unavailable</div>'">
             </div>`
          : `<div class="oxads-img-wrap">
               <span class="oxads-label">Ad</span>
               <div class="oxads-empty" style="height:${imgH}px">
                 <span class="oxads-empty-icon">📺</span>
                 <span>No ad yet — be first!</span>
               </div>
             </div>`;

        el.innerHTML = `<div class="oxads-widget" data-slot="${slotId}">
          ${imgSection}
          <div class="oxads-footer">
            <div class="oxads-meta">
              ${hasAd ? `by <strong>${addrShort}</strong>` : 'Empty slot'}
            </div>
            <button class="oxads-buy" data-price="${slot.currentPrice}">
              Buy · ${priceEth} ETH
            </button>
          </div>
          <div class="oxads-branding">Powered by 0xAds</div>
        </div>`;

        el.querySelector('.oxads-buy').addEventListener('click', () => openBuyPanel(el, slotId, slot.currentPrice));

        // Listen for new ads and refresh
        roContract.events.AdPlaced({ filter: { slotId } }).on('data', render);
      } catch(e) { console.error('[0xAds] Slot', slotId, e); }
    }

    render();
  }

  // ── BUY PANEL ─────────────────────────────────────────────────────────────
  function openBuyPanel(container, slotId, currentPrice) {
    const widget = container.querySelector('.oxads-widget');
    if (!widget) return;

    const priceEth = parseFloat(
      (typeof Web3 !== 'undefined' ? new Web3(RPC_URL) : { utils: { fromWei: (v) => v } }).utils.fromWei(currentPrice, 'ether')
    ).toFixed(4);

    const panel = document.createElement('div');
    panel.className = 'oxads-panel';
    panel.innerHTML = `
      <h3>Place Your Ad · <span style="color:#4f8ef7">${priceEth} ETH</span></h3>
      <input type="text" id="oxads-img-${slotId}" placeholder="Image URL (https://...)">
      <input type="text" id="oxads-link-${slotId}" placeholder="Destination URL (https://...)">
      <div class="oxads-panel-actions">
        <button class="oxads-btn-cancel" id="oxads-cancel-${slotId}">Cancel</button>
        <button class="oxads-btn-confirm" id="oxads-confirm-${slotId}">Confirm & Pay</button>
      </div>
      <div class="oxads-panel-msg" id="oxads-msg-${slotId}"></div>
    `;
    widget.appendChild(panel);

    panel.querySelector(`#oxads-cancel-${slotId}`).onclick = () => panel.remove();

    panel.querySelector(`#oxads-confirm-${slotId}`).onclick = async () => {
      const imgUrl  = panel.querySelector(`#oxads-img-${slotId}`).value.trim();
      const linkUrl = panel.querySelector(`#oxads-link-${slotId}`).value.trim();
      const msg     = panel.querySelector(`#oxads-msg-${slotId}`);

      if (!imgUrl || !linkUrl) { setMsg(msg, 'Fill in both fields', 'error'); return; }
      if (!window.ethereum)    { setMsg(msg, 'MetaMask not found', 'error'); return; }

      try {
        setMsg(msg, 'Waiting for MetaMask...', 'success');
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const w3 = new Web3(window.ethereum);
        const c  = new w3.eth.Contract(ABI, CONTRACT_ADDRESS);

        // Re-fetch price to be safe
        const fresh = await c.methods.getSlotMeta(slotId).call();
        if (!fresh.exists) {
          setMsg(msg, 'Slot not found', 'error');
          return;
        }
        const value = fresh.currentPrice.toString();
        await c.methods.placeAd(slotId, imgUrl, linkUrl).send({ from: accounts[0], value, gas: 800000 });

        setMsg(msg, '✅ Ad placed!', 'success');
        setTimeout(() => { panel.remove(); initSlot(container); }, 1500);
      } catch(e) {
        const reason = e.data?.message || e.message || 'Transaction failed';
        setMsg(msg, reason.slice(0, 120), 'error');
      }
    };
  }

  function setMsg(el, text, type) {
    el.textContent = text;
    el.className = 'oxads-panel-msg ' + type;
  }

  function esc(s) { return (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

  // ── ENTRY POINT ───────────────────────────────────────────────────────────
  function bootstrap() {
    injectStyles();
    // Support both id="ox-ad-slot" (single) and class="ox-ad-slot" (multiple)
    const slots = [
      ...document.querySelectorAll('[id="ox-ad-slot"][data-slot-id]'),
      ...document.querySelectorAll('.ox-ad-slot[data-slot-id]')
    ];
    slots.forEach(initSlot);
  }

  loadWeb3(function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  });

})();
