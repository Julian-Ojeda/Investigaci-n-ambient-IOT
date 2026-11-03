(() => {
const $ = s => document.querySelector(s);
const root = document.documentElement, body = document.body;
const stage = $('#stage'), world = $('#world'), grid = $('#grid'), ov = $('#ov'), route = $('#route');
const secs = [...document.querySelectorAll('.sec')];
const slides = [...document.querySelectorAll('.slide')];
const frames = [ov, ...secs, ...slides];

// Copia el encabezado de cada columna a sus celdas para la vista de celular
document.querySelectorAll('.tbl').forEach(t => {
  const heads = [...t.querySelectorAll('.hd > div')].map(h => h.textContent.trim());
  t.querySelectorAll('.row:not(.hd)').forEach(r => [...r.children].forEach((c, i) => c.dataset.l = heads[i]));
});

// En el celular, el lienzo con zoom se reemplaza por un documento con scroll vertical e índice
const phone = matchMedia('(max-width: 760px), (max-height: 500px) and (pointer: coarse)');
phone.addEventListener('change', () => location.reload());
if (phone.matches) { readingMode(); return; }

function readingMode() {
  root.classList.add('reading');
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const make = (tag, cls, html) => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; return e; };
  const info = secs.map((sec, i) => ({
    id: 's' + (i + 1),
    name: sec.dataset.name,
    num: sec.querySelector('.c-num')?.textContent || '',
    sub: sec.querySelector('.c-sub').textContent,
    first: slides.find(s => s.dataset.sec === sec.dataset.sec),
    n: slides.filter(s => s.dataset.sec === sec.dataset.sec).length,
  }));
  const toc = () => '<ol>' + info.map(s => `<li><a href="#${s.id}">`
    + (s.num ? `<span class="r-n">${s.num}</span>` : '')
    + `<span class="r-t"><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span><span class="r-c">${s.n}</span></a></li>`).join('') + '</ol>';

  // Encabezado de cada sección antes de su primera diapositiva
  info.forEach(s => s.first.before(make('header', 'r-sec',
    (s.num ? `<span class="r-n">${s.num}</span>` : '') + `<h2>${esc(s.name)}</h2><p>${esc(s.sub)}</p>`)));
  info.forEach(s => { s.head = s.first.previousElementSibling; s.head.id = s.id; });

  ov.after(make('nav', 'r-toc', `<p class="r-toc-h">Contenido</p>${toc()}`));
  slides[slides.length - 1].after(make('footer', 'r-end',
    '<p>Fin de la presentación</p><a href="#ov">Volver arriba</a><a href="./">Todas las presentaciones</a>'));

  const bar = make('div', 'r-bar',
    '<a class="r-home" href="./" aria-label="Todas las presentaciones"><svg class="ico"><use href="#i-home"/></svg></a>'
    + '<span id="rSec">Inicio</span>'
    + '<button type="button" id="rTocBtn" aria-haspopup="dialog"><svg class="ico"><use href="#i-ov"/></svg>Índice</button>');
  const sheet = make('div', 'r-sheet',
    `<div class="r-panel" role="dialog" aria-modal="true" aria-label="Índice"><div class="r-panel-h"><b>Índice</b>`
    + `<button type="button" class="r-close" aria-label="Cerrar">✕</button></div>${toc()}</div>`);
  sheet.hidden = true;
  body.prepend(bar);
  body.append(sheet);

  const open = () => { sheet.hidden = false; sheet.querySelector('.r-close').focus(); };
  const close = () => { sheet.hidden = true; };
  bar.querySelector('#rTocBtn').addEventListener('click', open);
  sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('.r-close, a')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // La barra muestra la sección que se está leyendo y el avance
  const rSec = bar.querySelector('#rSec');
  let ticking = false;
  const update = () => {
    ticking = false;
    let name = 'Inicio';
    info.forEach(s => { if (s.head.getBoundingClientRect().top < 90) name = s.name; });
    rSec.textContent = name;
    const max = root.scrollHeight - innerHeight;
    root.style.setProperty('--p', (max > 0 ? scrollY / max * 100 : 0).toFixed(2) + '%');
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) target.scrollIntoView();
}

const ROT = [0];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Recorrido: vista general → cada círculo y sus diapositivas → vista general
const bySec = secs.map(sec => slides.filter(s => s.dataset.sec === sec.dataset.sec));
const stops = [ov];
secs.forEach((sec, i) => stops.push(sec, ...bySec[i]));
stops.push(ov);
const last = stops.length - 1;

let W, H, cur = 0, peek = false, raf = 0;
let cam = { x: 0, y: 0, w: 1, r: 0 };

// Cada marco mide lo mismo que la pantalla y se ubica en el lienzo con posición, escala y giro
function place(f, x, y, s, r) {
  f._g = { x, y, s, r };
  f.style.transform = `translate(${x - W / 2}px,${y - H / 2}px) rotate(${r}deg) scale(${s})`;
}

function layout() {
  W = stage.clientWidth; H = stage.clientHeight;
  const portrait = W / H < 0.9, D = 0.9 * Math.min(W, H);
  body.classList.toggle('portrait', portrait);
  root.style.setProperty('--W', W + 'px');
  root.style.setProperty('--H', H + 'px');
  root.style.setProperty('--D', D + 'px');
  root.style.setProperty('--G', Math.ceil(2 * Math.hypot(W, H)) + 'px');
  place(ov, W / 2, H / 2, 1, 0);

  // Horizontal: los temas en una elipse alrededor del título. Vertical: un panal de filas de 3 y 2.
  const N = secs.length, pts = [];
  let d;
  if (portrait) {
    const rows = [];
    for (let left = N; left > 0; left -= rows[rows.length - 1]) rows.push(Math.min(left, rows.length % 2 ? 2 : 3));
    const top = 0.3 * H, rowH = (0.87 * H - top) / rows.length;
    rows.forEach((c, r) => {
      for (let j = 0; j < c; j++) pts.push([W / 2 + (j - (c - 1) / 2) * 0.32 * W, top + rowH * (r + 0.5)]);
    });
    d = Math.min(0.29 * W, 0.9 * Math.hypot(0.16 * W, rowH));
  } else {
    for (let i = 0; i < N; i++) {
      const a = (-90 - 180 / N + 360 / N * i) * Math.PI / 180;
      pts.push([W / 2 + 0.385 * W * Math.cos(a), 0.47 * H + 0.35 * H * Math.sin(a)]);
    }
    d = Math.min(0.16 * W, 0.25 * H) * Math.min(1, 8.5 / N);
  }
  secs.forEach((sec, i) => {
    const [cx, cy] = pts[i], rot = ROT[i % ROT.length], th = rot * Math.PI / 180, R = d / 2;
    place(sec, cx, cy, d / D, rot);

    // Miniaturas de las diapositivas en la mitad inferior del círculo
    const list = bySec[i], n = list.length, gx = 0.14 * W, gy = 0.14 * H;
    let best = { s: 0 };
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      const s = Math.min(1.4 * R / (c * W + (c - 1) * gx), 0.54 * R / (r * H + (r - 1) * gy));
      if (s > best.s) best = { c, r, s };
    }
    const { c: cols, r: rows, s } = best;
    list.forEach((sl, k) => {
      const row = Math.floor(k / cols), inRow = Math.min(cols, n - row * cols), col = k - row * cols;
      const ox = (col - (inRow - 1) / 2) * (W + gx) * s;
      const oy = 0.31 * R + (row - (rows - 1) / 2) * (H + gy) * s;
      place(sl, cx + ox * Math.cos(th) - oy * Math.sin(th), cy + ox * Math.sin(th) + oy * Math.cos(th), s, rot);
    });
  });

  // Camino punteado que une los temas (cerrado en horizontal, en zigzag en vertical)
  const P = portrait ? pts : [...pts, pts[0]], at = j => P[Math.max(0, Math.min(P.length - 1, j))];
  let path = `M${P[0]}`;
  for (let j = 0; j < P.length - 1; j++) {
    const p0 = portrait ? at(j - 1) : P[(j - 1 + pts.length) % pts.length], p1 = P[j], p2 = P[j + 1];
    const p3 = portrait ? at(j + 2) : P[(j + 2) % pts.length];
    path += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2}`;
  }
  route.setAttribute('d', path);
}

const camFor = f => ({ x: f._g.x, y: f._g.y, w: W * f._g.s, r: f._g.r });

function apply(c) {
  const k = W / c.w, t = -c.r * Math.PI / 180, a = Math.cos(t) * k, b = Math.sin(t) * k;
  world.style.transform = `matrix(${a},${b},${-b},${a},${W / 2 - a * c.x + b * c.y},${H / 2 - b * c.x - a * c.y})`;
  // Grilla de puntos "infinita": tres capas que se funden según el nivel de zoom
  const L = Math.log2(k), fr = L - Math.floor(L), base = 34 * 2 ** fr;
  const G = Math.ceil(2 * Math.hypot(W, H)), sizes = [base, base * 2, base * 4];
  grid.style.backgroundSize = sizes.map(s => `${s}px ${s}px`).join(',');
  grid.style.backgroundPosition = sizes.map(s => `${G / 2 - c.x * k - s / 2}px ${G / 2 - c.y * k - s / 2}px`).join(',');
  grid.style.setProperty('--a1', (fr * 0.1).toFixed(3));
  grid.style.setProperty('--a3', ((1 - fr) * 0.1).toFixed(3));
  grid.style.transform = `translate(-50%,-50%) rotate(${-c.r}deg)`;
}

// Trayectoria de zoom suave (van Wijk y Nuij): se aleja, se desplaza y se vuelve a acercar
function zoomPath([ux0, uy0, w0], [ux1, uy1, w1]) {
  const rho = Math.SQRT2, dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
  let S, fn;
  if (d2 < 1e-12) {
    S = Math.log(w1 / w0) / rho;
    fn = t => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
  } else {
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (2 * w0 * 2 * d1);
    const b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (2 * w1 * 2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / rho;
    fn = t => {
      const s = t * S, c0 = Math.cosh(r0), u = w0 / (2 * d1) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, w0 * c0 / Math.cosh(rho * s + r0)];
    };
  }
  fn.ms = Math.abs(S) * 1000;
  return fn;
}

function fly(to, instant) {
  cancelAnimationFrame(raf);
  if (instant || reduce) { cam = to; apply(cam); arrived(); return; }
  const from = cam, path = zoomPath([from.x, from.y, from.w], [to.x, to.y, to.w]);
  const dur = Math.min(1800, Math.max(650, path.ms * 0.85)), t0 = performance.now();
  const step = now => {
    const t = Math.min(1, (now - t0) / dur), e = t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const [x, y, w] = path(e);
    cam = { x, y, w, r: from.r + (to.r - from.r) * e };
    apply(cam);
    if (t < 1) raf = requestAnimationFrame(step);
    else { cam = to; apply(cam); arrived(); }
  };
  raf = requestAnimationFrame(step);
}

const view = () => peek ? ov : stops[cur];

function arrived() {
  frames.forEach(f => {
    const sc = f.querySelector('.scroll');
    if (sc && f !== view()) sc.scrollTop = 0;
  });
  const card = view().querySelector('.card');
  if (card) checkMore(card);
}

function checkMore(card) {
  const sc = card.querySelector('.scroll');
  card.classList.toggle('has-more', sc.scrollHeight - sc.scrollTop - sc.clientHeight > 8);
}
document.querySelectorAll('.scroll').forEach(sc => sc.addEventListener('scroll', () => checkMore(sc.parentElement), { passive: true }));

function sync() {
  const active = view(), f = stops[cur];
  frames.forEach(fr => {
    fr.classList.toggle('active', fr === active);
    const card = fr.querySelector('.card');
    if (card) { card.inert = fr !== active; if (fr !== active) card.classList.remove('has-more'); }
  });
  const sec = f.dataset.sec ? secs[f.dataset.sec - 1] : null;
  body.classList.toggle('peek', peek);
  body.classList.toggle('at-end', cur === last);
      $('#secName').textContent = peek ? 'Vista general' : sec ? sec.dataset.name : cur === 0 ? 'Inicio' : 'Fin';
  $('#count').textContent = `${cur + 1} / ${stops.length}`;
  root.style.setProperty('--p', (cur / last * 100).toFixed(2) + '%');
  $('#prev').disabled = cur === 0 && !peek;
  $('#next').disabled = cur === last && !peek;
  history.replaceState(null, '', '#' + (cur + 1));
}

function go(i) {
  cur = Math.max(0, Math.min(last, i));
  peek = false;
  hideToast();
  sync();
  fly(camFor(stops[cur]));
}
const next = () => go(cur + 1);
const prev = () => go(peek ? cur : cur - 1);
function togglePeek() {
  if (peek || cur === 0 || cur === last) return go(cur);
  peek = true;
  sync();
  fly(camFor(ov));
}
function toggleFs() {
  if (!document.fullscreenEnabled) return;
  document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
}

$('#next').addEventListener('click', next);
$('#prev').addEventListener('click', prev);
$('#ovBtn').addEventListener('click', togglePeek);
$('#fs').addEventListener('click', toggleFs);
if (!document.fullscreenEnabled) $('#fs').hidden = true;

// Tocar un círculo o una miniatura lleva directo ahí
world.addEventListener('click', e => {
  const f = e.target.closest('.sec, .slide');
  if (!f || (!peek && f === stops[cur])) return;
  go(stops.indexOf(f));
});

addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key, onButton = document.activeElement && document.activeElement.matches('button, a');
  if ((k === ' ' || k === 'Enter') && onButton) return;
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
  else if (k === 'Home') go(0);
  else if (k === 'End') go(last);
  else if (k === 'Escape' || k === 'o' || k === 'O') togglePeek();
  else if (k === 'f' || k === 'F') toggleFs();
});

// Deslizar a los costados para avanzar o retroceder; el deslizamiento vertical hace scroll
let sx = null, sy = 0;
stage.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) { sx = null; return; }
  sx = e.touches[0].clientX; sy = e.touches[0].clientY;
}, { passive: true });
stage.addEventListener('touchend', e => {
  if (sx === null) return;
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  sx = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) dx < 0 ? next() : prev();
}, { passive: true });

let rt;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { layout(); fly(camFor(view()), true); }, 120);
});

const toast = $('#toast');
let toastTimer;
function hideToast() { clearTimeout(toastTimer); toast.classList.add('hide'); }
toast.textContent = matchMedia('(pointer: coarse)').matches
  ? 'Deslizá ← → para avanzar'
  : 'Usá ← → o la barra espaciadora · O para la vista general';

layout();
const h = parseInt(location.hash.slice(1), 10);
cur = h >= 1 && h <= stops.length ? h - 1 : 0;
sync();
cam = { x: W / 2, y: H / 2, w: W * 1.8, r: 0 };
apply(cam);
fly(camFor(stops[cur]));
toastTimer = setTimeout(hideToast, 5000);
})();
