# Plan de mejora — FRP Checker → herramienta de compra/venta

Objetivo: que la app responda, para un celular ofrecido, **¿lo puedo desbloquear?, ¿cuánto me cuesta arreglarlo?, ¿cuánto lo vendo? → ¿cuánto pago como máximo?**

## Diagnóstico actual
- La app **no busca en Google**: le pregunta a un LLM (Groq/Llama) que responde de memoria, con reglas fijas en el prompt ("Samsung siempre sí"). Por eso los resultados son genéricos.
- No hay base de datos propia: el precio estimado es una tabla fija en Ajustes.

## Decisión de arquitectura (3 opciones)
1. **Todo en el LLM con búsqueda web** — rápido de hacer, pero sigue sin verificar y cada consulta es lenta/impredecible.
2. **Backend Vercel con conectores por fuente + LLM solo para interpretar** — cada herramienta tiene su scraper/lector, el LLM normaliza el nombre del modelo y resume. Verificable, con link a la fuente.
3. **Base de datos propia precargada (Supabase) actualizada por un job nocturno** — respuestas instantáneas, pero más trabajo inicial.

**Elegida: 2, evolucionando a 3.** Empieza consultando en vivo con fuentes citadas; lo que se consulta queda guardado en Supabase y un job periódico lo refresca.

## Fase 1 — Repuestos: 3 Google Sheets (prioridad alta, más fácil)
- Leer las 3 hojas desde `/api/repuestos` (Sheets API con cuenta de servicio, o hojas "publicadas como CSV" si no son privadas). Cache de 1–6 h.
- **Parser de consulta** que separe: marca · modelo · tipo de repuesto (módulo, batería, pin de carga, tapa, cámara…) · calidad (OLED, Incell, Original, Service Pack, TFT, con/sin marco).
- **Diccionario de sinónimos** editable: "incel/incell/in-cell", "oled/amoled", "A15 / SM-A155 / A155M", "módulo/pantalla/display".
- Coincidencia estricta en calidad: si pedís OLED, **nunca** mostrar Incell como equivalente; si no hay OLED, decirlo y ofrecer el resto aparte.
- Resultado: tabla ordenada por precio con tienda, descripción original de la fila, fecha de actualización de la hoja. Destacar el más barato.
- Detalle: A15 4G y A15 5G (SM-A155 vs SM-A156) usan módulos distintos → el parser debe distinguirlos o preguntar.

## Fase 2 — FRP verificado por fuente (PRIORIDAD 1)
Principio: **el veredicto sale de las listas oficiales de cada herramienta, no de la IA.** La IA (Groq gratis alcanza) solo traduce "A15" → código exacto (SM-A155M / SM-A156M) + chipset, y redacta el resumen. Cambiar a OpenRouter u otro modelo no arregla el problema: el problema es no tener datos.

Herramientas por software/licencia (sin box física) con lista pública de modelos:
| # | Herramienta | Lista de modelos | Nota |
|---|---|---|---|
| 1 | Chimera | chimeratool.com/en/models | oficial |
| 2 | UnlockTool | unlocktool.net/models | oficial, ~3.500 modelos |
| 3 | Griffin-Unlocker | griffin-unlocker.com/models.html | oficial |
| 4 | TFM Tool Pro | tfmtool.com/supports | oficial |
| 5 | DFT Pro | dftpro.com/news (release notes) | sin lista, solo changelog |
| 6 | Octoplus FRP (licencia digital) | octoplusbox.com | licencia sin box; lista a relevar |
| 7 | SamFw | samfw.com | solo Samsung; depende del parche de seguridad |
| 8 | AMT (Android Multi Tool) | a relevar | licencia + créditos |
| 9 | Cheetah Tool Pro | a relevar | |
| — | UMT | por chipset | **requiere dongle físico** → descartar o confirmar si lo tenés |

Veredicto:
- **Confirmado**: el modelo exacto figura en ≥1 lista oficial con función FRP.
- **Probable**: figura el chipset/serie pero no el modelo exacto.
- **Sin evidencia → CLAVO**: no figura en ninguna. En rojo, sin suavizar.
- Siempre con link a la fuente y fecha de lectura. Advertencia fija: el soporte puede depender del parche de seguridad → pedir/mostrar el parche.
- Tu registro ("lo desbloqueé con X / falló") tiene prioridad sobre todo.
- Implementación: un job indexa las listas en Supabase (diario/semanal) → búsqueda instantánea; no scrapear en cada consulta.

## Fase 3 — Calculadora de compra (precio real, sin que la IA invente)
`precio de venta real` − `repuestos (Fase 1)` − `costo FRP (alquiler/créditos)` − `ganancia deseada` = **precio máximo a pagar**.
La IA **no estima precios**; solo hace la cuenta con datos:
1. **Tus ventas reales** (registro propio en Supabase: modelo, variante, estado, precio vendido, días hasta vender) → fuente principal.
2. **Mercado Libre, publicaciones usadas** vía API oficial con tu token → mediana de precios del modelo exacto, descartando extremos.
3. **Factor Marketplace**: ML suele estar por encima de Marketplace; el factor se calibra solo comparando tus ventas vs la mediana de ML.
4. **Carga manual rápida**: 3–5 precios que viste en Marketplace para ese modelo.
Siempre muestra de dónde salió cada número y cuántas muestras tiene; con pocas muestras avisa "referencia débil".

## Fase 4 — Ideas extra (ordenadas por impacto)
1. **Inventario de equipos**: comprado → en reparación → publicado → vendido, con costo real y ganancia por equipo.
2. **Alertas de precio**: aviso cuando un repuesto baja en alguna de las 3 tiendas.
3. **Checklist de revisión al comprar**: IMEI (bloqueo por robo), Knox Guard, cuenta Mi, estado de batería.
4. **Estadísticas**: qué modelos te dejan más ganancia y rotan más rápido → qué conviene comprar.

## Pendiente de seguridad (antes de todo)
Revocar y regenerar la key de Groq y el token de GitHub que quedaron expuestos.

## Orden de trabajo propuesto
0. Rotar credenciales · confirmar deploy en Vercel
1. Fase 2 (FRP verificado) — lo primordial
2. Fase 1 (repuestos) — necesita los links y formato de las 3 hojas
3. Fase 3 calculadora
4. Fase 4 según prioridad
