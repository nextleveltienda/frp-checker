// Vercel Serverless Function — compatibilidad de un modelo con herramientas de service GSM.
// No usa IA. El veredicto sale de comparar el modelo contra las páginas públicas de
// soporte de cada herramienta (las mismas que un técnico consultaría a mano).

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36' };
const CACHE_MS = 24 * 60 * 60 * 1000; // 24 h
const mem = {};

async function getText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function getJSON(url) { return JSON.parse(await getText(url)); }

async function cached(key, fn) {
  const hit = mem[key];
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
  const v = await fn();
  mem[key] = { t: Date.now(), v };
  return v;
}

// ── Análisis del modelo pedido ──
const STOP = new Set(['de', 'del', 'el', 'la', 'para', 'modelo', 'celular', 'telefono', 'equipo', 'samsung galaxy']);
function tokenize(q) {
  return (q.toLowerCase().match(/[a-z0-9-]+/g) || [])
    .filter(t => t.length >= 2 && !STOP.has(t));
}
function tokenMatches(text, tok) {
  const d = (' ' + text.toLowerCase().replace(/[^a-z0-9]/g, ' ') + ' ');
  return new RegExp('[ -](' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[ -]').test(d.replace(/-/g, ' '));
}

// ── Fuente 1: Chimera ── (chimeratool.com — dato explícito por modelo, con link)
async function sourceChimera(query, tokens) {
  const slugs = [];
  for (let p = 0; p < 2; p++) {
    const d = await getJSON(`https://chimeratool.com/en/models?ajax=1&p=${p}&q=${encodeURIComponent(query)}`);
    const found = [...(d.output || '').matchAll(/href="\/en\/models\/([^"?#]+)"/g)].map(m => m[1]);
    found.forEach(s => { if (!slugs.includes(s)) slugs.push(s); });
    if (!d.limit || (p + 1) * d.limit >= (d.total || 0)) break;
  }
  const picked = slugs.filter(s => tokens.every(t => tokenMatches(s, t))).slice(0, 6);
  const settled = await Promise.allSettled(picked.map(async slug => {
    const html = await cached('ch:' + slug, () => getText(`https://chimeratool.com/en/models/${slug}`));
    const name = (html.match(/sm-v2__display__name">([\s\S]*?)<\/div>/) || [])[1] || '';
    const code = (html.match(/sm-v2__display__type[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '';
    const rows = html.split('<tr class="-body">').slice(1);
    const frpRow = rows.find(r => /Remove FRP|Reset FRP|FRP Lock/i.test(r.split('<div class="sm-v2__display__modes"')[0] || ''));
    return {
      model: strip(name), code: strip(code), frp: !!frpRow,
      modes: frpRow ? [...frpRow.matchAll(/sm-v2__display__mode__name"[^>]*>([^<]+)</g)].map(m => m[1].trim()) : [],
      url: `https://chimeratool.com/en/models/${slug}`,
    };
  }));
  return settled.filter(r => r.status === 'fulfilled').map(r => r.value);
}
function strip(s) { return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(); }

// ── Fuente 2: UnlockTool ── (mirror público unlocktool.org — dato explícito por modelo)
const UNLOCKTOOL_URL = 'https://www.unlocktool.org/supported-models';
async function fetchUnlockToolRows() {
  return cached('ut:rows', async () => {
    const html = await getText(UNLOCKTOOL_URL);
    const rows = [];
    for (const m of html.matchAll(/<li class="mm-row">([\s\S]*?)<\/li>/g)) {
      const block = m[1];
      const name = strip((block.match(/mm-name">([^<]+)</) || [])[1] || '');
      const meta = strip((block.match(/mm-meta">([^<]+)</) || [])[1] || '');
      const ops = [...block.matchAll(/mm-op">([^<]+)</g)].map(x => x[1].trim());
      if (name) rows.push({ name, meta, ops });
    }
    return rows;
  });
}
async function sourceUnlockTool(tokens) {
  const rows = await fetchUnlockToolRows();
  const hits = rows.filter(r => tokens.every(t => tokenMatches(r.name + ' ' + r.meta, t)));
  return hits.slice(0, 6).map(r => ({
    model: r.name, code: r.meta, frp: r.ops.some(o => /FRP/i.test(o)),
    modes: r.ops.filter(o => /FRP/i.test(o)),
    url: UNLOCKTOOL_URL,
  }));
}

// ── Fuente 3: Griffin-Unlocker ── (matriz oficial — confirma que el MODELO está
// reconocido por la herramienta; no desglosa operación por modelo, así que cuenta
// como señal media, no como "Remove FRP" explícito).
const GRIFFIN_URL = 'https://griffin-unlocker.com/support_matrix.json';
async function sourceGriffin(tokens) {
  const data = await cached('gr:matrix', () => getJSON(GRIFFIN_URL));
  const out = [];
  for (const [brand, info] of Object.entries(data.brands || {})) {
    for (const model of info.models || []) {
      if (tokens.every(t => tokenMatches(brand + ' ' + model, t))) {
        out.push({ model: `${brand} ${model}`, code: '', frp: null, modes: info.tabs || [], url: 'https://griffin-unlocker.com/models.html' });
        if (out.length >= 6) return out;
      }
    }
  }
  return out;
}

// ── Handler ──
module.exports = async function handler(req, res) {
  const q = (((req.query && req.query.q) || '') + '').trim().slice(0, 120);
  if (!q) { res.status(400).json({ error: 'Falta ?q=' }); return; }
  const tokens = tokenize(q);
  if (!tokens.length) { res.status(200).json({ query: q, verdict: 'sin_evidencia', sources: [], errors: ['No se detectó un modelo en la búsqueda.'] }); return; }

  const errors = [];
  const [chimera, unlocktool, griffin] = await Promise.all([
    sourceChimera(q, tokens).catch(e => { errors.push('Chimera: ' + e.message); return []; }),
    sourceUnlockTool(tokens).catch(e => { errors.push('UnlockTool: ' + e.message); return []; }),
    sourceGriffin(tokens).catch(e => { errors.push('Griffin-Unlocker: ' + e.message); return []; }),
  ]);

  const explicit = [
    ...chimera.map(x => ({ ...x, tool: 'Chimera' })),
    ...unlocktool.map(x => ({ ...x, tool: 'UnlockTool' })),
  ];
  const confirmedFrp = explicit.filter(x => x.frp);
  const listedOnly = [
    ...explicit.filter(x => !x.frp),
    ...griffin.map(x => ({ ...x, tool: 'Griffin-Unlocker' })),
  ];

  let verdict = 'sin_evidencia';
  if (confirmedFrp.length) verdict = 'confirmado';
  else if (listedOnly.length) verdict = 'probable';

  res.setHeader('Cache-Control', 's-maxage=1800');
  res.status(200).json({
    query: q,
    verdict, // confirmado | probable | sin_evidencia
    confirmedFrp,
    listedOnly,
    errors,
    note: 'En Samsung el soporte de FRP suele depender del parche de seguridad instalado, no solo del modelo.',
  });
};
