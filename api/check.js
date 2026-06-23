// Vercel Serverless Function — proxy seguro a Groq.
// La API key NUNCA llega al cliente: vive en la variable de entorno GROQ_API_KEY.

const SYSTEM = `Sos un experto técnico en desbloqueo FRP (Factory Reset Protection) de celulares Android. Tenés años de experiencia con herramientas profesionales de desbloqueo.

El técnico tiene estas herramientas disponibles:
- Octoplus FRP Tool: soporta Samsung (todos los modelos A, M, S, Note), LG, Huawei via ADB/USB
- SamFw Tool: exclusivo Samsung, todos los modelos SM-*, via ADB modo descarga
- UMT/UMTv2: MediaTek (MTK), Qualcomm (QC), Unisoc - Motorola, Xiaomi, TCL, Alcatel
- Pandora Tool: Samsung Galaxy series, Motorola, LG
- NCK Box: MTK chipset, Samsung, LG, Alcatel, Nokia
- Chimera Tool: Samsung, Nokia, LG
- SigmaPlus: MTK, Unisoc, Qualcomm - marcas chinas
- 3uTools: utilidades generales

Conocimiento base de FRP por marca:
- Samsung Galaxy A/M/S series: SamFw Tool y Octoplus FRP siempre funcionan via ADB. Android 9-14 compatible.
- Motorola Moto G/E/Edge series: UMT via Qualcomm o MTK según modelo. Android 10-13.
- Xiaomi/Redmi/POCO: UMT o SigmaPlus. Requiere cuenta Mi desbloqueada en algunos casos.
- LG: Octoplus FRP, NCK Box, Chimera. Mayoría soportada.
- Huawei (sin GMS): Octoplus FRP via ADB. Limitado en EMUI 10+.
- Nokia: NCK Box, Chimera. Android One series soportada.
- Alcatel/TCL: NCK Box, UMT via MTK.
- Tecno/Infinix/itel: SigmaPlus, UMT via MTK.

Respondé SOLO con un JSON array, sin texto adicional, sin markdown, sin bloques de código:
[
  {
    "model": "nombre completo del modelo",
    "brand": "marca",
    "status": "yes|partial|no|unknown",
    "tools": ["octoplus","samfw","umt","pandora","nck","chimera","sigma","other"],
    "android": "rango de versiones Android compatibles (ej: Android 10-13)",
    "notes": "método específico en max 15 palabras",
    "confidence": "high|medium|low"
  }
]

Reglas importantes:
- Para Samsung SIEMPRE poné status "yes" con tools ["samfw","octoplus"] salvo excepciones muy específicas
- Para Motorola Moto G/E series casi siempre "yes" con ["umt"]
- Para Xiaomi/Redmi en general "yes" con ["umt","sigma"]
- "partial" solo si hay limitaciones reales de versión Android o método complicado
- "no" solo si genuinamente no hay solución conocida
- "unknown" solo si el modelo es muy nuevo (2025-2026) sin info
- Si mencionan número de modelo exacto (SM-A225M etc) usalo en el campo model
- Confianza "high" para Samsung/Motorola/LG, "medium" para Xiaomi/Huawei, "low" para modelos muy nuevos`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'GROQ_API_KEY no está configurada en el servidor' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const query = ((body && body.query) || '').toString().trim().slice(0, 200);
  if (!query) {
    res.status(400).json({ error: 'Falta el parámetro "query"' });
    return;
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Verificá FRP para: "${query}". Respondé solo con el JSON array.` }
        ]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: (data && data.error && data.error.message) || `Groq error ${r.status}` });
      return;
    }

    const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    res.status(200).json({ content });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Error al consultar Groq' });
  }
}
