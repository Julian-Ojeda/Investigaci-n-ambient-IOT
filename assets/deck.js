(() => {
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const root = document.documentElement;

// En el celular, cada fila de tabla muestra el nombre de su columna
$$('.tbl').forEach(t => {
  const heads = [...t.querySelectorAll('.hd > div')].map(h => h.textContent.trim());
  t.querySelectorAll('.row:not(.hd)').forEach(r => [...r.children].forEach((c, i) => { if (heads[i]) c.dataset.l = heads[i]; }));
});

// ---------- Índice: abrir en pantallas chicas y marcar la sección visible ----------
const toc = $('#toc'), tocBtn = $('#tocBtn'), tbSec = $('#tbSec');
const setToc = open => { toc.classList.toggle('open', open); tocBtn.setAttribute('aria-expanded', open); };
tocBtn.addEventListener('click', () => setToc(!toc.classList.contains('open')));
toc.addEventListener('click', e => { if (e.target.closest('a')) setToc(false); });
addEventListener('keydown', e => { if (e.key === 'Escape' && toc.classList.contains('open')) setToc(false); });

const links = $$('#toc a[href^="#"]');
const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
let ticking = false;
function spy() {
  ticking = false;
  const line = innerHeight * 0.3;
  let cur = targets[0];
  targets.forEach(t => { if (t.getBoundingClientRect().top < line) cur = t; });
  links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur.id));
  if (tbSec) tbSec.textContent = cur.dataset.name || '';
  const max = root.scrollHeight - innerHeight;
  root.style.setProperty('--p', (max > 0 ? scrollY / max * 100 : 0).toFixed(2) + '%');
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
spy();

// ---------- Modo Presentar: una diapositiva por pantalla ----------
const presentBtn = $('#presentBtn');
const stops = $$('.doc > .hero, .doc > .exec, .sec > .sec-h, .sec > .slide');
const nameOf = el => el.closest('.sec')?.dataset.name || (el.classList.contains('exec') ? 'Lo esencial' : 'Inicio');
const bar = document.createElement('nav');
bar.className = 'pbar'; bar.hidden = true; bar.setAttribute('aria-label', 'Controles de la presentación');
bar.innerHTML = '<button type="button" id="pPrev" aria-label="Anterior (←)" title="Anterior (←)"><svg class="ico"><use href="#i-left"/></svg></button>'
  + '<div class="where" aria-live="polite"><span id="pSec"></span><span id="pCount"></span></div>'
  + '<button type="button" id="pNext" aria-label="Siguiente (→)" title="Siguiente (→)"><svg class="ico"><use href="#i-right"/></svg></button>'
  + '<button type="button" id="pExit" aria-label="Salir (Esc)" title="Salir (Esc)"><svg class="ico"><use href="#i-x"/></svg></button>';
const prog = document.createElement('div');
prog.className = 'pprog'; prog.hidden = true; prog.innerHTML = '<i></i>';
document.body.append(bar, prog);

let cur = -1;
function show(i) {
  cur = Math.max(0, Math.min(stops.length - 1, i));
  stops.forEach((s, k) => s.classList.toggle('is-cur', k === cur));
  stops[cur].scrollTop = 0;
  $('#pSec').textContent = nameOf(stops[cur]);
  $('#pCount').textContent = `${cur + 1} / ${stops.length}`;
  $('#pPrev').disabled = cur === 0;
  $('#pNext').disabled = cur === stops.length - 1;
  root.style.setProperty('--pp', ((cur + 1) / stops.length * 100).toFixed(2) + '%');
}
function enter() {
  // Empieza en la diapositiva que se está leyendo
  let start = 0;
  stops.forEach((s, k) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) start = k; });
  root.classList.add('present');
  bar.hidden = prog.hidden = false;
  show(start);
  try { if (document.fullscreenEnabled && !document.fullscreenElement) root.requestFullscreen().catch(() => {}); } catch (e) {}
}
function exit() {
  const el = stops[cur];
  root.classList.remove('present');
  stops.forEach(s => s.classList.remove('is-cur'));
  bar.hidden = prog.hidden = true;
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  root.style.scrollBehavior = 'auto';
  el.scrollIntoView();
  root.style.scrollBehavior = '';
  cur = -1;
  presentBtn.focus();
}
const presenting = () => root.classList.contains('present');
presentBtn.addEventListener('click', enter);
$('#pPrev').addEventListener('click', () => show(cur - 1));
$('#pNext').addEventListener('click', () => show(cur + 1));
$('#pExit').addEventListener('click', exit);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presenting()) exit(); });

addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (!presenting()) {
    if ((e.key === 'p' || e.key === 'P') && !e.target.closest('input, textarea')) enter();
    return;
  }
  const onBtn = document.activeElement && document.activeElement.matches('button, a');
  if ((e.key === ' ' || e.key === 'Enter') && onBtn) return;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(cur + 1); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); show(cur - 1); }
  else if (e.key === 'Home') show(0);
  else if (e.key === 'End') show(stops.length - 1);
  else if (e.key === 'Escape') exit();
});

// Deslizar a los costados avanza o retrocede
let sx = null, sy = 0;
addEventListener('touchstart', e => { if (presenting() && e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
addEventListener('touchend', e => {
  if (sx === null) return;
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  sx = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) show(cur + (dx < 0 ? 1 : -1));
}, { passive: true });
})();
