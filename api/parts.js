// Vercel Serverless Function — comparador de precios de repuestos.
// Lee las tiendas (Google Sheets públicos) por sección vía export CSV, sin credenciales.
// Búsqueda con conciencia de calidad: OLED nunca cuenta como Incell y viceversa.

// ── Tiendas ──
// Cada sección es una pestaña del sheet. gid = id de la pestaña.
const STORES = [
  {
    id: 'tecnico_cerca',
    name: 'Técnico Cerca',
    sheet: '1LMKqZSc16gUMu4F14NTQKRdG3c-uoKbGwZL9aJ1jkuc',
    sections: {
      modulo: '1093796664', bateria: '39199108', 'placa de carga': '380013865',
      'partes chicas': '1195012373', herramientas: '879585554', insumos: '1242682806', cables: '1267238951',
    },
  },
  {
    id: 'mundo_parts',
    name: 'Mundo Parts',
    sheet: '1c39kYssBH8TWE4JPZ8c4xy9OJ4RnsCme',
    sections: {
      modulo: '1972998278', bateria: '1836755602', joystick: '423680103', 'tapa': '179022904',
      'placa de carga': '348896271', camara: '1071045594', 'porta sim': '2104641707',
      'flex main': '1977680430', 'flex power': '412695498', 'lente de camara': '987950431',
      'home': '1520798856', 'pin de carga': '1774088237', microfono: '2092694088',
      parlante: '1485518785', glass: '1182551262',
    },
  },
];

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36' };
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 h — los sheets se actualizan ~1 vez por semana
const mem = {};

function csvUrl(sheet, gid) {
  return `https://docs.google.com/spreadsheets/d/${sheet}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

// Parser CSV mínimo que respeta comillas.
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c === '\r') { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const PRICE_RE = /^\$?\s*\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$|^\$?\s*\d{4,}([.,]\d{1,2})?$/;
const HEADER_RE = /^(precio|descripcion|codigo|modelo|lista actualizada|samsung|motorola|iphone|xiaomi|modulos|baterias)/i;

function isPrice(s) { return PRICE_RE.test((s || '').trim()); }

function toARS(s) {
  s = (s || '').replace(/\$/g, '').trim();
  let v;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) v = parseFloat(s.replace(/\./g, ''));       // 12.800
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) v = parseFloat(s.replace(/,/g, '')); // 12,731.91
  else v = parseFloat(s.replace(/,/g, ''));
  return isFinite(v) ? Math.round(v) : null;
}

function looksDesc(s) {
  s = (s || '').trim();
  if (s.length < 5 || isPrice(s) || !/[A-Za-z]/.test(s)) return false;
  if (HEADER_RE.test(s)) return false;
  return true;
}

// De un CSV saca [{desc, price}]. Toma el ÚLTIMO precio válido en las 3 celdas a la derecha
// (así en Técnico Cerca agarra el precio final redondeado y no el intermedio).
function extractItems(rows) {
  const out = [];
  for (const row of rows) {
    const n = row.length;
    for (let i = 0; i < n; i++) {
      if (!looksDesc(row[i])) continue;
      let price = null;
      for (let j = i + 1; j < Math.min(i + 4, n); j++) {
        if (isPrice(row[j])) { const v = toARS(row[j]); if (v && v >= 1000) price = v; }
      }
      if (price) out.push({ desc: row[i].trim(), price });
    }
  }
  return out;
}

async function fetchSection(sheet, gid) {
  const key = `${sheet}:${gid}`;
  const hit = mem[key];
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  let text = null, lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(csvUrl(sheet, gid), { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      text = await r.text();
      break;
    } catch (e) { lastErr = e; await new Promise(s => setTimeout(s, 400)); }
  }
  if (text == null) throw lastErr || new Error('fetch failed');
  const items = extractItems(parseCSV(text));
  mem[key] = { t: Date.now(), v: items };
  return items;
}

// ── El Búnker (pedix) ──
// El catálogo entero (nombre, precio, categoría, activo) viene embebido en el HTML
// de cualquier página de categoría. Una sola descarga trae todo.
const BUNKER_URL = 'https://pedix.app/onthegobunkercor/categoria/Tz9zIhUW5Oe1aKeK9jWQ';

async function fetchBunker() {
  const key = 'bunker';
  const hit = mem[key];
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  let html = null, lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(BUNKER_URL, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      html = await r.text();
      break;
    } catch (e) { lastErr = e; await new Promise(s => setTimeout(s, 400)); }
  }
  if (html == null) throw lastErr || new Error('fetch failed');
  // Mapa id de categoría → nombre.
  const cats = {};
  for (const m of html.matchAll(/"id":"([A-Za-z0-9]{12,})","name":"([^"]{2,40})"(?=,"slug"|,"description"|,"active"|,"products")/g))
    cats[m[1]] = m[2];
  // Cada producto arranca con {"id":"..","categoryId":".."
  const items = [];
  const chunks = html.split(/\{"id":"[A-Za-z0-9]{12,}","categoryId":"/);
  for (let i = 1; i < chunks.length; i++) {
    const o = chunks[i];
    const cid = o.slice(0, o.indexOf('"'));
    const nm = o.match(/"name":"([^"]{1,90})"/);
    const pr = o.match(/"price":(\d+)/);
    const ac = o.match(/"active":(true|false)/);
    if (!nm || !pr) continue;
    const price = parseInt(pr[1], 10);
    if (!price) continue;
    items.push({ desc: nm[1], price, section: cats[cid] || 'otros', active: !ac || ac[1] === 'true' });
  }
  mem[key] = { t: Date.now(), v: items };
  return items;
}

// ── Análisis de la consulta ──
const PART_ALIASES = {
  modulo: ['modulo', 'módulo', 'pantalla', 'display', 'lcd', 'glass', 'visor'],
  bateria: ['bateria', 'batería', 'pila'],
  'pin de carga': ['pin de carga', 'pin', 'conector de carga', 'flex de carga', 'placa de carga'],
  tapa: ['tapa', 'marco', 'carcasa'],
  camara: ['camara', 'cámara'],
  home: ['home', 'huella', 'boton home', 'lector'],
  parlante: ['parlante', 'altavoz', 'auricular', 'speaker'],
  microfono: ['microfono', 'micrófono', 'vibrador'],
};
const QUALITIES = {
  oled: ['oled', 'amoled', 'super amoled'],
  incell: ['incell', 'in-cell', 'in cell', 'ic', 'tft'],
  original: ['original', 'ori', 'service pack', 'genuino', 'oem'],
  'sin riesgo': ['sin riesgo', 'riesgo cero'],
  'con marco': ['con marco', 'c/m', 'c/marco'],
};

function analyzeQuery(q) {
  const low = ' ' + q.toLowerCase().replace(/[\/]/g, ' ') + ' ';
  let part = null;
  for (const [canon, al] of Object.entries(PART_ALIASES))
    if (al.some(a => low.includes(' ' + a + ' ') || low.includes(' ' + a))) { part = canon; break; }
  const wantQual = [];
  for (const [canon, al] of Object.entries(QUALITIES))
    if (al.some(a => low.includes(a))) wantQual.push(canon);
  // Tokens del modelo: alfanuméricos con al menos un dígito (a15, sm-a155, g24, note13)
  const stop = new Set(['modulo', 'módulo', 'bateria', 'batería', 'oled', 'incell', 'original', 'con', 'sin', 'marco', 'de', 'carga', 'pin', 'para']);
  const modelTokens = (q.toLowerCase().match(/[a-z]*\d+[a-z0-9]*|\b[a-z]{2,}\b/g) || [])
    .map(t => t.replace(/\s+/g, ''))
    .filter(t => /\d/.test(t) && !stop.has(t));
  return { part, wantQual, modelTokens };
}

function qualityOf(desc) {
  const d = desc.toLowerCase();
  const set = new Set();
  for (const [canon, al] of Object.entries(QUALITIES))
    if (al.some(a => d.includes(a))) set.add(canon);
  return set;
}

// A15 no debe matchear A150; exige que el token esté delimitado.
function tokenMatches(desc, tok) {
  const d = desc.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  return new RegExp('(^|[^a-z0-9])' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(' ' + d + ' ');
}

module.exports = async function handler(req, res) {
  const q = (((req.query && req.query.q) || '') + '').trim().slice(0, 120);
  if (!q) { res.status(400).json({ error: 'Falta ?q=' }); return; }
  const a = analyzeQuery(q);
  if (!a.modelTokens.length) { res.status(200).json({ query: q, analysis: a, results: [], note: 'No se detectó un modelo en la búsqueda.' }); return; }

  const results = [];
  const errors = [];

  // Un item pasa el filtro de tipo de repuesto si su descripción o su sección lo indican.
  const partOK = (desc, section) => {
    if (!a.part) return true;
    const hay = (' ' + (desc + ' ' + section).toLowerCase() + ' ');
    return (PART_ALIASES[a.part] || [a.part]).some(al => hay.includes(al));
  };
  const consider = (storeName, section, desc, price, sinStock) => {
    if (!a.modelTokens.every(t => tokenMatches(desc, t))) return;
    if (!partOK(desc, section)) return;
    const q2 = qualityOf(desc);
    if (a.wantQual.length) {
      const wantsPanel = a.wantQual.filter(w => w === 'oled' || w === 'incell');
      if (wantsPanel.length && !wantsPanel.some(w => q2.has(w))) return;
      if (a.wantQual.includes('oled') && q2.has('incell')) return;
      if (a.wantQual.includes('incell') && q2.has('oled')) return;
    }
    results.push({ store: storeName, section, desc, price, quality: [...q2], sinStock });
  };

  const jobs = [];

  // Tiendas en Google Sheets.
  for (const store of STORES) {
    const EQUIV = { 'pin de carga': ['pin de carga', 'placa de carga', 'partes chicas'] };
    let picked = null;
    if (a.part) {
      for (const key of (EQUIV[a.part] || [a.part]))
        if (store.sections[key]) { picked = [[key, store.sections[key]]]; break; }
    }
    const gids = picked || Object.entries(store.sections);
    for (const [secName, gid] of gids) {
      jobs.push(fetchSection(store.sheet, gid)
        .then(items => items.forEach(it => consider(store.name, secName, it.desc, it.price, /sin stock/i.test(it.desc))))
        .catch(e => errors.push(`${store.name}/${secName}: ${e.message}`)));
    }
  }

  // El Búnker (pedix).
  jobs.push(fetchBunker()
    .then(items => items.forEach(it => consider('El Búnker', it.section, it.desc, it.price, !it.active)))
    .catch(e => errors.push(`El Búnker: ${e.message}`)));

  await Promise.all(jobs);

  results.sort((x, y) => (x.sinStock - y.sinStock) || (x.price - y.price));
  res.setHeader('Cache-Control', 's-maxage=3600');
  res.status(200).json({ query: q, analysis: a, count: results.length, results, errors });
};
