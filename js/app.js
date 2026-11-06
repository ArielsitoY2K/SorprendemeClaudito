/* =====================================================================
   SORPRÉNDEME VIANDAS — tienda y pedido por WhatsApp
   Sin dependencias. Los datos (platos, precios) están en js/menu.js
===================================================================== */
(() => {
  'use strict';

  const CFG = window.SORPRENDEME;
  const P = CFG.prices;
  const MIN_TOTAL = CFG.minViandas * P.vianda;
  const HAS_MENSUAL = !!P.promoMensual;
  const GROUPS = ['viandas', 'empanadas', 'pizzas', 'postres'];
  const LABEL = { viandas: 'Viandas', empanadas: 'Empanadas', pizzas: 'Pizzas', postres: 'Postres' };
  const ONE = { viandas: 'vianda', empanadas: 'docena', pizzas: 'pizza', postres: 'postre' };
  const MANY = { viandas: 'viandas', empanadas: 'docenas', pizzas: 'pizzas', postres: 'postres' };
  const MODE_NAME = { libre: 'Tu pedido', mensual: 'Promo mensual' };
  const STORAGE = 'sorp-v2';
  const MAX_QTY = 30;

  let items = [];
  let byId = new Map();
  let menuFailed = false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================================================================
     MENÚ: se lee de una planilla de Google Sheets (publicada como CSV)
     o, si no hay, del archivo data/menu.csv. Mismo formato en ambos:
     Sección | Tipo | Nombre | Descripción | Foto
  ================================================================ */
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function parseCSV(text, delim) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = ''; rows.push(row); row = [];
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function menuFromCSV(raw) {
    const text = raw.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';   // Excel en español guarda con ;
    const rows = parseCSV(text, delim);
    const head = (rows.shift() || []).map(norm);
    const col = (...names) => head.findIndex((h) => names.includes(h));
    const iSec = col('seccion', 'menu'), iTipo = col('tipo', 'categoria'), iName = col('nombre', 'plato'), iDesc = col('descripcion'), iFoto = col('foto', 'imagen');
    if (iSec < 0 || iName < 0) throw new Error('La planilla necesita las columnas Sección y Nombre');
    const out = [];
    const used = new Map();
    let aviso = '';
    rows.forEach((r) => {
      const name = (r[iName] || '').trim();
      if (!name) return;
      const sec = norm(r[iSec]);
      if (sec === 'aviso') { aviso = name; return; }
      let group, set = '';
      if (/^(semana|semanal|menu semanal|esta semana)/.test(sec)) { group = 'viandas'; set = 'semana'; }
      else if (/^clasic/.test(sec)) { group = 'viandas'; set = 'clasico'; }
      else if (/^empanad/.test(sec)) group = 'empanadas';
      else if (/^pizza/.test(sec)) group = 'pizzas';
      else if (/^postre/.test(sec)) group = 'postres';
      else return;
      const t = norm(iTipo >= 0 ? r[iTipo] : '');
      const diet = group === 'viandas' ? (t.includes('veg') ? 'veg' : t.includes('carne') ? 'carne' : '') : '';
      let id = `${set || group}-${slug(name)}`;
      const n = (used.get(id) || 0) + 1;
      used.set(id, n);
      if (n > 1) id += `-${n}`;
      out.push({ id, group, set, diet, name, desc: (iDesc >= 0 ? r[iDesc] || '' : '').trim(), photo: (iFoto >= 0 ? r[iFoto] || '' : '').trim(), muzza: group === 'pizzas' && /m[uo]zz?arella/.test(norm(name)) });
    });
    return { items: out, aviso };
  }

  async function fetchText(url, ms = 7000) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } finally { clearTimeout(timer); }
  }

  async function loadMenu() {
    const sources = [CFG.menuSheetUrl, CFG.menuFile].filter(Boolean);
    for (const src of sources) {
      try {
        const m = menuFromCSV(await fetchText(src));
        if (m.items.length) return m;
        console.warn('El menú de', src, 'no tiene platos.');
      } catch (e) { console.warn('No se pudo leer el menú de', src, e); }
    }
    return { items: [], aviso: '', failed: true };
  }

  /* Foto: nombre de archivo de assets/img, link de Google Drive, o (si está vacío) el nombre del plato */
  function imgSrc(it) {
    const p = it.photo;
    if (!p) return `assets/img/${slug(it.name)}.jpg`;
    if (/^https?:\/\//i.test(p)) {
      const m = p.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]+)/);
      return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800` : p;
    }
    const clean = p.replace(/[^\w.\- ]/g, '');
    return `assets/img/${encodeURIComponent(/\.(jpe?g|png|webp)$/i.test(clean) ? clean : clean + '.jpg')}`;
  }

  /* ---------- utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const money = (n) => '$' + Math.round(n).toLocaleString('es-AR');
  const unitsOf = (g, n) => `${n} ${n === 1 ? ONE[g] : MANY[g]}`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = '') => `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;

  /* ---------- estado (se guarda en el navegador de quien pide) ---------- */
  const state = {
    mode: 'libre',
    cart: {},
    tab: 'semana',
    diet: 'todas',
    customer: { name: '', phone: '', address: '', barrio: '', obs: '' }
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (!saved) return;
      if (saved.mode === 'mensual' && HAS_MENSUAL) state.mode = 'mensual';
      const c = saved.cart || {};
      Object.keys(c).forEach((id) => {
        const q = Number(c[id]);
        if (byId.has(id) && q > 0) state.cart[id] = Math.min(q, MAX_QTY);
      });
      if (saved.customer) Object.keys(state.customer).forEach((k) => { state.customer[k] = String(saved.customer[k] || ''); });
    } catch (e) { /* sin almacenamiento: la página funciona igual */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify({ mode: state.mode, cart: state.cart, customer: state.customer })); } catch (e) { /* nada */ }
  }

  /* ---------- cálculos de precio ---------- */
  const qtyOf = (id) => state.cart[id] || 0;

  function counts() {
    const r = { viandas: 0, empanadas: 0, pizzas: 0, postres: 0, muzza: 0 };
    Object.entries(state.cart).forEach(([id, q]) => {
      const it = byId.get(id);
      if (!it) return;
      r[it.group] += q;
      if (it.muzza) r.muzza += q;
    });
    return r;
  }

  /* Devuelve total, promos aplicadas y sugerencias para ahorrar */
  function pricing() {
    const c = counts();
    const offers = [];
    const nudges = [];

    const vUnit = c.viandas >= P.viandaBulkFrom ? P.viandaBulk : P.vianda;
    if (c.viandas >= P.viandaBulkFrom) offers.push(`Precio por cantidad: tus ${c.viandas} viandas salen ${money(vUnit)} cada una.`);
    else if (c.viandas >= 12) nudges.push(`Sumando ${plural(P.viandaBulkFrom - c.viandas, 'vianda más', 'viandas más')}, cada una sale ${money(P.viandaBulk)}.`);
    const viandas = c.viandas * vUnit;

    const packs = Math.floor(c.postres / 3);
    if (packs) offers.push(`Postres: ${plural(packs, 'pack de 3', 'packs de 3')} a ${money(P.postrePack3)}.`);
    else if (c.postres === 2) nudges.push(`Con un postre más, los 3 salen ${money(P.postrePack3)}.`);
    const postres = packs * P.postrePack3 + (c.postres % 3) * P.postre;

    const empanadas = c.empanadas * P.empanada;

    const combos = Math.min(c.muzza, Math.floor(c.pizzas / 2));
    if (combos) offers.push(`Pizzas: ${plural(combos, 'combo', 'combos')} de muzzarella + 1 a elección por ${money(P.pizzaCombo)}.`);
    if (c.pizzas === 1 && c.muzza === 1) nudges.push(`Sumá otra pizza a elección y las dos salen ${money(P.pizzaCombo)}.`);
    else if (c.pizzas >= 1 && c.muzza === 0) nudges.push(`Sumá una pizza de muzzarella y esa más otra a elección salen ${money(P.pizzaCombo)}.`);
    const pizzas = combos * P.pizzaCombo + (c.pizzas - 2 * combos) * P.pizza;

    return { total: viandas + postres + empanadas + pizzas, offers, nudges, c };
  }

  function total() { return state.mode === 'mensual' ? P.promoMensual : pricing().total; }

  function status() {
    if (state.mode === 'mensual') return { ok: true, text: '' };
    const t = pricing().total;
    if (t === 0) return { ok: false, text: 'Todavía no elegiste ningún producto.' };
    if (t < MIN_TOTAL) return { ok: false, text: `El pedido mínimo es de ${CFG.minViandas} viandas (${money(MIN_TOTAL)}). Te faltan ${money(MIN_TOTAL - t)}.` };
    return { ok: true, text: '¡Listo para enviar!' };
  }

  /* ---------- avisos ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 3400);
  }

  /* ---------- acciones sobre el pedido ---------- */
  function add(id, fromEl) {
    const it = byId.get(id);
    if (!it || state.mode === 'mensual') return;
    if (qtyOf(id) >= MAX_QTY) { toast(`Para más de ${MAX_QTY} unidades, escribinos por WhatsApp.`); return; }
    state.cart[id] = qtyOf(id) + 1;
    fly(fromEl);
    refresh({ id });
  }
  function sub(id) {
    if (!qtyOf(id)) return;
    state.cart[id] -= 1;
    if (state.cart[id] <= 0) delete state.cart[id];
    refresh({ id });
  }

  function setMode(mode) {
    state.mode = mode;
    $('#picker').hidden = mode === 'mensual';
    $('#mensual').hidden = mode !== 'mensual';
    $('#step2-title').textContent = mode === 'mensual' ? 'Así funciona tu promo mensual' : 'Elegí tus productos';
    renderTabs();
    renderGrid();
    refresh();
  }

  /* ---------- animación: la bolita vuela hasta la barra ---------- */
  function fly(from) {
    if (reduceMotion || !from || !from.getBoundingClientRect) return;
    const a = from.getBoundingClientRect();
    const bx = Math.min(window.innerWidth - 40, 60);
    const by = window.innerHeight - 44;
    const dot = document.createElement('span');
    dot.className = 'fly';
    document.body.appendChild(dot);
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const anim = dot.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1 },
        { transform: `translate(${(sx + bx) / 2}px, ${Math.min(sy, by) - 70}px) scale(1.1)`, opacity: 1, offset: .45 },
        { transform: `translate(${bx}px, ${by}px) scale(.35)`, opacity: .25 }
      ],
      { duration: 700, easing: 'cubic-bezier(.4,.1,.3,1)' }
    );
    anim.onfinish = () => dot.remove();
  }
  function bump(el) {
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  }

  /* ---------- pestañas, filtros y productos ---------- */
  const TABS = [
    { id: 'semana', label: 'Esta semana' },
    { id: 'clasico', label: 'Los clásicos' },
    { id: 'empanadas', label: 'Empanadas' },
    { id: 'pizzas', label: 'Pizzas' },
    { id: 'postres', label: 'Postres' }
  ];
  const TAB_NOTES = {
    empanadas: 'Cada tarjeta es una docena. Vienen congeladas y listas para hornear.',
    pizzas: `Congeladas y listas para hornear. Llevando 1 de muzzarella + 1 a elección, las dos salen ${money(P.pizzaCombo)}.`
  };
  const tabItems = (tab) => items.filter((i) => (tab === 'semana' || tab === 'clasico' ? i.group === 'viandas' && i.set === tab : i.group === tab));
  const tabCount = (tab) => tabItems(tab).reduce((n, i) => n + qtyOf(i.id), 0);

  function renderTabs() {
    $('#tabs').innerHTML = TABS.map((t) => {
      const n = tabCount(t.id);
      return `<button type="button" class="tab" data-act="tab" data-tab="${t.id}" aria-pressed="${state.tab === t.id}">${t.label}${n ? `<span class="tab__n" aria-label="${n} en tu pedido">${n}</span>` : ''}</button>`;
    }).join('');
    const showDiet = state.tab === 'semana' || state.tab === 'clasico';
    const diet = $('#diet');
    diet.hidden = !showDiet;
    diet.innerHTML = `<span class="diet__label">Mostrar:</span>
      <button type="button" class="pill" data-act="diet" data-diet="todas" aria-pressed="${state.diet === 'todas'}">Todas</button>
      <button type="button" class="pill" data-act="diet" data-diet="carne" aria-pressed="${state.diet === 'carne'}">${icon('ic-meat')}Con carne</button>
      <button type="button" class="pill" data-act="diet" data-diet="veg" aria-pressed="${state.diet === 'veg'}">${icon('ic-leaf')}Vegetarianas</button>`;
    const note = $('#tabnote');
    note.hidden = !TAB_NOTES[state.tab];
    note.textContent = TAB_NOTES[state.tab] || '';
  }

  function priceHTML(it) {
    switch (it.group) {
      case 'viandas': return `<div class="price">${money(P.vianda)}<small>Más de 20: ${money(P.viandaBulk)} c/u</small></div>`;
      case 'empanadas': return `<div class="price">${money(P.empanada)}<small>la docena</small></div>`;
      case 'pizzas': return `<div class="price">${money(P.pizza)}<small>1 muzzarella + 1 a elección: ${money(P.pizzaCombo)}</small></div>`;
      default: return `<div class="price">${money(P.postre)}<small>3 por ${money(P.postrePack3)}</small></div>`;
    }
  }
  function controlHTML(it) {
    const q = qtyOf(it.id);
    if (!q) return `<button type="button" class="btn btn--add" data-act="add" data-id="${it.id}" aria-label="Agregar ${esc(it.name)}">${icon('ic-plus')}Agregar</button>`;
    return `<div class="stepper" role="group" aria-label="Cantidad de ${esc(it.name)}">
      <button type="button" class="stepper__btn" data-act="sub" data-id="${it.id}" aria-label="Quitar uno: ${esc(it.name)}">${icon('ic-minus')}</button>
      <output class="stepper__q">${q}</output>
      <button type="button" class="stepper__btn" data-act="add" data-id="${it.id}" aria-label="Sumar uno: ${esc(it.name)}">${icon('ic-plus')}</button>
    </div>`;
  }
  function tagHTML(it) {
    if (it.group === 'empanadas' || it.group === 'pizzas') return `<span class="tag tag--horno">${icon('ic-horno')}Lista para hornear</span>`;
    if (it.diet === 'veg') return `<span class="tag tag--veg">${icon('ic-leaf')}Vegetariana</span>`;
    if (it.diet === 'carne') return `<span class="tag tag--carne">${icon('ic-meat')}Con carne</span>`;
    return '';
  }
  function cardHTML(it, i, animate) {
    const q = qtyOf(it.id);
    const media = `<img src="${esc(imgSrc(it))}" alt="${esc(it.name)}" width="800" height="600" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
    return `<article class="dish${q ? ' is-picked' : ''}${animate ? ' dish--enter' : ''}" data-id="${it.id}" style="--i:${i}">
      <div class="dish__media">${media}${tagHTML(it)}${q ? `<span class="picked">${q} en tu pedido</span>` : ''}</div>
      <div class="dish__body">
        <h3>${esc(it.name)}</h3>
        ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
        <div class="dish__foot">${priceHTML(it)}<div class="ctl">${controlHTML(it)}</div></div>
      </div>
    </article>`;
  }

  function renderGrid(animate = true) {
    let list = tabItems(state.tab);
    if ((state.tab === 'semana' || state.tab === 'clasico') && state.diet !== 'todas') list = list.filter((i) => i.diet === state.diet);
    const grid = $('#grid');
    let empty;
    if (menuFailed) empty = `<div class="empty"><p>No pudimos cargar el menú. Escribinos por WhatsApp y te lo pasamos.</p><a class="btn btn--primary" href="${waUrl('Hola Sorpréndeme! No me carga el menú, ¿me lo pasan?')}" target="_blank" rel="noopener">${icon('ic-whatsapp')}Escribinos por WhatsApp</a></div>`;
    else if (!tabItems(state.tab).length) empty = `<div class="empty"><p>${state.tab === 'semana' ? 'Estamos preparando el menú de esta semana. ¡Mientras tanto mirá Los clásicos!' : 'No hay productos en esta sección por ahora.'}</p>${state.tab === 'semana' ? `<button type="button" class="btn btn--teal" data-act="tab" data-tab="clasico">Ver Los clásicos</button>` : ''}</div>`;
    else empty = `<div class="empty"><p>No hay platos de este tipo por ahora.</p><button type="button" class="btn btn--teal" data-act="diet" data-diet="todas">Ver todos</button></div>`;
    grid.innerHTML = list.length ? list.map((it, i) => cardHTML(it, i, animate)).join('') : empty;
  }

  /* si una foto no existe, se muestra un dibujo en su lugar (nunca un ícono roto) */
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.closest('.dish__media')) return;
    const it = byId.get(img.closest('.dish').dataset.id);
    if (!it) return;
    const post = it.group === 'postres';
    img.outerHTML = `<div class="dish__art">${icon(post ? 'ic-postre' : 'ic-plato', 'dish__art-icon')}<span>${post ? 'Postre casero' : 'Foto próximamente'}</span></div>`;
  }, true);

  /* actualiza solo lo que cambió, sin recargar toda la grilla (no se pierde el lugar ni el foco) */
  function updateCards(focusId, focusAct) {
    $$('#grid .dish').forEach((card) => {
      const it = byId.get(card.dataset.id);
      const q = qtyOf(it.id);
      card.classList.toggle('is-picked', q > 0);
      card.querySelector('.ctl').innerHTML = controlHTML(it);
      const media = card.querySelector('.dish__media');
      const old = media.querySelector('.picked');
      if (q) {
        if (old) { if (old.textContent !== `${q} en tu pedido`) { old.textContent = `${q} en tu pedido`; bump(old); } }
        else media.insertAdjacentHTML('beforeend', `<span class="picked">${q} en tu pedido</span>`);
      } else if (old) old.remove();
    });
    if (focusId) {
      const card = $(`#grid .dish[data-id="${focusId}"]`);
      if (card) {
        const target = card.querySelector(`[data-act="${focusAct}"]`) || card.querySelector('[data-act="add"]') || card.querySelector('button');
        if (target) target.focus({ preventScroll: true });
      }
    }
  }

  /* ---------- panel de avance: pedido mínimo, promos y sugerencias ---------- */
  function renderProgress() {
    const box = $('#progress');
    if (state.mode === 'mensual') { box.hidden = true; return; }
    box.hidden = false;
    const pr = pricing();
    const t = pr.total;
    const reached = t >= MIN_TOTAL;
    const hints = pr.offers.map((o) => `<li class="is-offer">${icon('ic-check')}${esc(o)}</li>`).concat(pr.nudges.map((n) => `<li>${icon('ic-heart')}${esc(n)}</li>`));
    box.innerHTML = `<div class="meter"><div class="meter__top"><span>Pedido mínimo: ${CFG.minViandas} viandas (${money(MIN_TOTAL)})</span>${reached ? `<span class="meter__done">${icon('ic-check')}Alcanzado</span>` : `<b>${money(t)}</b>`}</div><div class="meter__bar"><i style="--p:${Math.min(100, (t / MIN_TOTAL) * 100)}%"></i></div></div>${hints.length ? `<ul class="hints">${hints.join('')}</ul>` : ''}`;
  }

  /* ---------- barra de pedido de abajo ---------- */
  let lastTotal = null;
  function renderBar() {
    const bar = $('#cartbar');
    const c = counts();
    const n = c.viandas + c.empanadas + c.pizzas + c.postres;
    const show = state.mode === 'mensual' || n > 0;
    bar.classList.toggle('is-visible', show);
    bar.toggleAttribute('inert', !show);
    bar.setAttribute('aria-hidden', String(!show));
    $('#cb-title').textContent = MODE_NAME[state.mode];
    $('#cb-sub').textContent = state.mode === 'mensual'
      ? '20 viandas · 5 por semana'
      : GROUPS.filter((g) => c[g]).map((g) => unitsOf(g, c[g])).join(' · ');
    const tot = total();
    const totEl = $('#cb-total');
    totEl.textContent = show ? money(tot) : '';
    if (lastTotal !== null && lastTotal !== tot) { bump(totEl); bump($('#cb-icon')); }
    lastTotal = tot;
  }

  /* ---------- panel del pedido ---------- */
  function linesHTML() {
    if (state.mode === 'mensual') {
      return `<div class="sum-group"><h4>Promo mensual <span>20 viandas</span></h4><p>5 viandas por semana durante 4 semanas. El menú de cada semana lo elegimos juntos por WhatsApp. Se paga por adelantado.</p></div>`;
    }
    const c = counts();
    if (!(c.viandas + c.empanadas + c.pizzas + c.postres)) return `<p class="drawer__empty">Todavía no elegiste nada. Cerrá este panel y tocá <b>Agregar</b> en los productos que quieras.</p>`;
    return GROUPS.map((g) => {
      const rows = items.filter((i) => i.group === g && qtyOf(i.id));
      if (!rows.length) return '';
      return `<div class="sum-group"><h4>${LABEL[g]} <span>${unitsOf(g, c[g])}</span></h4>${rows.map((it) => `
        <div class="line" data-id="${it.id}">
          <span class="line__name">${esc(it.name)}${g === 'empanadas' ? ' <small>(por docena)</small>' : ''}</span>
          <div class="stepper stepper--sm" role="group" aria-label="Cantidad de ${esc(it.name)}">
            <button type="button" class="stepper__btn" data-act="sub" data-id="${it.id}" aria-label="Quitar uno: ${esc(it.name)}">${icon('ic-minus')}</button>
            <output class="stepper__q">${qtyOf(it.id)}</output>
            <button type="button" class="stepper__btn" data-act="add" data-id="${it.id}" aria-label="Sumar uno: ${esc(it.name)}">${icon('ic-plus')}</button>
          </div>
        </div>`).join('')}</div>`;
    }).join('');
  }

  function renderDrawer(focusSel) {
    if (!drawer.open) return;
    $('#d-mode').textContent = state.mode === 'mensual' ? 'Promo mensual' : 'Pedido a elección';
    $('#d-lines').innerHTML = linesHTML();
    $('#d-total').textContent = money(total());
    const pr = state.mode === 'mensual' ? { offers: [], nudges: [] } : pricing();
    const note = $('#d-note');
    const lines = pr.offers.map((o) => `<li class="is-offer">${icon('ic-check')}${esc(o)}</li>`).concat(pr.nudges.map((n) => `<li>${icon('ic-heart')}${esc(n)}</li>`));
    if (state.mode === 'mensual') lines.push(`<li>${icon('ic-clock')}Se paga por adelantado y coordinamos cada semana por WhatsApp.</li>`);
    note.hidden = !lines.length;
    note.innerHTML = lines.join('');
    const st = status();
    const stEl = $('#d-status');
    stEl.textContent = st.text;
    stEl.className = 'drawer__status ' + (st.ok ? 'is-ok' : 'is-warn');
    $('#d-send').disabled = !st.ok;
    if (focusSel) { const el = $(focusSel, $('#d-lines')); if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- refresco general ---------- */
  function refresh(opts = {}) {
    const wasId = opts.id;
    const active = document.activeElement;
    const inDrawer = active && active.closest && active.closest('#d-lines');
    const act = active && active.dataset ? active.dataset.act : null;
    renderTabs();
    updateCards(inDrawer ? null : wasId, act === 'sub' && qtyOf(wasId) > 0 ? 'sub' : 'add');
    renderProgress();
    renderBar();
    renderDrawer(inDrawer && wasId ? `[data-id="${wasId}"] [data-act="${qtyOf(wasId) > 0 ? act : 'add'}"]` : null);
    save();
  }

  /* ---------- panel: abrir y cerrar con animación ---------- */
  const drawer = $('#drawer');
  let opener = null;
  function openCart(btn) {
    if (drawer.open) return;
    opener = btn || null;
    showMain();
    drawer.showModal();
    document.documentElement.classList.add('modal-open');
    renderDrawer();
    fillForm();
    requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add('is-open')));
  }
  function closeCart() {
    if (!drawer.open) return;
    drawer.classList.remove('is-open');
    const done = () => { drawer.close(); document.documentElement.classList.remove('modal-open'); if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    if (reduceMotion) done(); else setTimeout(done, 380);
  }
  drawer.addEventListener('cancel', (e) => { e.preventDefault(); closeCart(); });
  drawer.addEventListener('click', (e) => { if (e.target === drawer) closeCart(); });

  function showMain() {
    $('#drawer-main').hidden = false;
    $('#drawer-sent').hidden = true;
    $('#drawer-foot').hidden = false;
  }

  /* ---------- formulario ---------- */
  const F = { name: $('#f-name'), phone: $('#f-phone'), address: $('#f-address'), barrio: $('#f-barrio'), obs: $('#f-obs') };
  function fillForm() { Object.keys(F).forEach((k) => { if (!F[k].value) F[k].value = state.customer[k]; }); }
  Object.keys(F).forEach((k) => F[k].addEventListener('input', () => {
    state.customer[k] = F[k].value;
    if (k === 'name' || k === 'phone' || k === 'address') setErr(k, false);
    save();
  }));
  function setErr(k, on) {
    const err = $('#e-' + k);
    if (!err) return;
    err.hidden = !on;
    F[k].closest('.field').classList.toggle('has-error', on);
    F[k].setAttribute('aria-invalid', on ? 'true' : 'false');
  }
  function validate() {
    const digits = F.phone.value.replace(/\D/g, '');
    const bad = [];
    if (F.name.value.trim().length < 2) bad.push('name');
    if (digits.length < 8) bad.push('phone');
    if (F.address.value.trim().length < 4) bad.push('address');
    ['name', 'phone', 'address'].forEach((k) => setErr(k, bad.includes(k)));
    if (bad.length) { F[bad[0]].focus(); F[bad[0]].scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }); }
    return bad.length === 0;
  }

  /* ---------- mensaje de WhatsApp ---------- */
  function buildMessage() {
    const cu = state.customer;
    const L = ['¡Hola Sorpréndeme! Quiero hacer un pedido 😊', ''];
    L.push(`*Tipo de pedido:* ${state.mode === 'mensual' ? 'Promo mensual' : 'A elección'}`);
    if (state.mode === 'mensual') {
      L.push('20 viandas: 5 por semana durante 4 semanas. Quiero coordinar el menú de cada semana por acá.');
    } else {
      const pr = pricing();
      GROUPS.forEach((g) => {
        const rows = items.filter((i) => i.group === g && qtyOf(i.id));
        if (!rows.length) return;
        L.push('', `*${LABEL[g]} (${unitsOf(g, pr.c[g])}):*`);
        rows.forEach((it) => L.push(g === 'empanadas' ? `• ${it.name}: ${unitsOf(g, qtyOf(it.id))}` : `• ${qtyOf(it.id)} x ${it.name}`));
      });
      if (pr.offers.length) { L.push('', '*Promos aplicadas:*'); pr.offers.forEach((o) => L.push(`• ${o}`)); }
    }
    L.push('', `*Total:* ${money(total())}`, '', '*Mis datos*', `Nombre: ${cu.name.trim()}`, `Teléfono: ${cu.phone.trim()}`, `Dirección: ${cu.address.trim()}${cu.barrio.trim() ? ' (Barrio ' + cu.barrio.trim() + ')' : ''}`);
    if (cu.obs.trim()) L.push(`Aviso: ${cu.obs.trim()}`);
    L.push('', 'Entiendo que el envío no tiene cargo dentro de la ciudad de Córdoba. ¡Gracias!');
    return L.join('\n');
  }
  const waUrl = (text) => `https://wa.me/${CFG.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`;

  $('#orderform').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!status().ok) { renderDrawer(); return; }
    if (!validate()) return;
    const url = waUrl(buildMessage());
    $('#sent-link').href = url;
    $('#drawer-main').hidden = true;
    $('#drawer-foot').hidden = true;
    $('#drawer-sent').hidden = false;
    $('#drawer-scroll').scrollTop = 0;
    window.open(url, '_blank', 'noopener');
    $('#drawer-sent h3').setAttribute('tabindex', '-1');
    $('#drawer-sent h3').focus({ preventScroll: true });
  });

  /* ---------- clicks (un solo oyente para toda la página) ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'add') add(el.dataset.id, el);
    else if (act === 'sub') sub(el.dataset.id);
    else if (act === 'tab') { state.tab = el.dataset.tab; renderTabs(); renderGrid(); $(`#tabs [data-tab="${state.tab}"]`).focus({ preventScroll: true }); }
    else if (act === 'diet') { state.diet = el.dataset.diet; renderTabs(); renderGrid(); const b = $(`#diet [data-diet="${state.diet}"]`); if (b) b.focus({ preventScroll: true }); }
    else if (act === 'open-cart') openCart(el);
    else if (act === 'close-cart') closeCart();
    else if (act === 'font') cycleFont();
    else if (act === 'again') { state.cart = {}; closeCart(); setMode(state.mode); $('#tienda').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }
  });

  $$('input[name="mode"]').forEach((r) => r.addEventListener('change', () => { if (r.checked) setMode(r.value); }));

  /* ---------- tamaño de letra ---------- */
  const FONT_LABELS = ['Letra normal', 'Letra grande', 'Letra muy grande'];
  function applyFont() {
    const s = Number(document.documentElement.dataset.size || 0);
    $('#font-label').textContent = FONT_LABELS[s] || FONT_LABELS[0];
    $('#font-btn').setAttribute('aria-label', `Tamaño de letra: ${FONT_LABELS[s].toLowerCase()}. Tocá para cambiarlo.`);
  }
  function cycleFont() {
    const next = (Number(document.documentElement.dataset.size || 0) + 1) % 3;
    if (next === 0) delete document.documentElement.dataset.size; else document.documentElement.dataset.size = String(next);
    try { localStorage.setItem('sorp-size', String(next)); } catch (e) { /* nada */ }
    applyFont();
  }

  /* ---------- revelar al hacer scroll ---------- */
  function setupReveal() {
    const els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
    setTimeout(() => els.forEach((el) => el.classList.add('is-in')), 4000);   // red de seguridad
  }

  /* ---------- arranque ---------- */
  async function init() {
    $('#grid').innerHTML = '<p class="loading">Cargando el menú…</p>';
    const menu = await loadMenu();
    items = menu.items;
    byId = new Map(items.map((i) => [i.id, i]));
    menuFailed = !!menu.failed;
    load();
    if (!HAS_MENSUAL) { $('#modes-wrap').remove(); state.mode = 'libre'; }
    else {
      $('#price-mensual').textContent = money(P.promoMensual);
      $('#libre-text').textContent = `Armás tu pedido producto por producto. Mínimo ${CFG.minViandas} viandas (${money(MIN_TOTAL)}).`;
      $('#price-libre').innerHTML = `${money(P.vianda)} <small>cada vianda</small>`;
    }

    // numeración de pasos según lo que haya en pantalla
    const nums = $$('.step__n');
    nums.forEach((el, i) => { el.textContent = String(i + 1); });
    $('#steps-count').textContent = ['', 'un solo paso', 'dos pasos', 'tres pasos'][nums.length] || `${nums.length} pasos`;

    // cartel de precios congelados
    const fn = $('#freeze-note');
    if (CFG.priceNote) fn.textContent = CFG.priceNote; else $('#freeze').remove();

    if (menu.aviso) { const w = $('#week-label'); w.textContent = menu.aviso; w.hidden = false; }
    $('#year').textContent = new Date().getFullYear();
    const hello = 'Hola Sorpréndeme! Quiero hacer una consulta 😊';
    ['#wa-top', '#wa-foot'].forEach((s) => { $(s).href = waUrl(hello); });
    // botón de ayuda al pie de cada pregunta frecuente: abre WhatsApp con la pregunta escrita
    $$('[data-wa-q]').forEach((a) => { a.href = waUrl(`Hola Sorpréndeme! Tengo una consulta: ${a.dataset.waQ}`); });
    const modeInput = $(`input[name="mode"][value="${state.mode}"]`);
    if (modeInput) modeInput.checked = true;
    applyFont();
    setupReveal();
    setMode(state.mode);
  }
  init();
})();
