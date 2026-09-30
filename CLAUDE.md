# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

FRP Checker Pro: PWA en español (rioplatense) para saber si un modelo de celular es desbloqueable por FRP con las herramientas del técnico (Octoplus, SamFw, UMT, Pandora, NCK, Chimera, SigmaPlus). Se usa para evaluar ofertas de compra de celulares bloqueados. Nota de contexto en Obsidian: `Z:\Second Brain\Tecnologia\Celulares\FRP Checker.md`. Repo: `github.com/nextleveltienda/frp-checker`. Hay un respaldo en `Z:\Copias Apps\frp-checker-2.0.0.zip`.

## Comandos

No hay build, package.json, linter ni tests. Es HTML/JS estático más una función serverless.

- Local: servir la carpeta con cualquier server estático (`npx serve .`). `/api/check` solo existe en Vercel (o `vercel dev`), y necesita la variable de entorno `GROQ_API_KEY`.
- Deploy: Vercel (usa `vercel.json` y `api/`). Antes estuvo en GitHub Pages, que ya no sirve porque no ejecuta `/api/check`.

## Arquitectura

- `index.html` (~47KB): toda la UI, el CSS y la lógica en un solo `<script>`. Pestañas: buscar, lote, historial, herramientas. Estado en `localStorage` (`frp_history`, `frp_stats`, `frp_cache`, `frp_prices`, `frp_supabase`, `frp_device_id`).
- `api/check.js`: proxy a Groq (`llama-3.3-70b-versatile`). Contiene el prompt de sistema con el conocimiento FRP por marca y las reglas de status. Es donde se define la calidad de las respuestas, y la API key nunca llega al cliente.
- Flujo: `doSearch`/`doBatch` → `getCached` (TTL 7 días) → `callAPI` (POST `/api/check`) → `parseResults` (regex `\[[\s\S]*\]` sobre el JSON que devuelve el modelo) → `renderResults`/`buildCards`.
- El modelo devuelve un array JSON: `model, brand, status (yes|partial|no|unknown), tools[], android, notes, confidence`. Si cambia ese esquema, hay que tocar el prompt en `api/check.js` y `parseResults` a la vez.
- `getPriceEstimate(status, confidence)` da el precio estimado; los precios se configuran en Ajustes.
- Sync opcional con Supabase (tabla `searches`, REST directo desde el cliente con URL y key guardadas en `localStorage`). El historial en la nube se marca con `getDeviceId()`.
- `sw.js`: HTML network-first, assets cache-first, `/api/` y peticiones cross-origin siempre a la red. Al cambiar assets, subir `CACHE_NAME`.

## Cuidados

- El resultado es una respuesta de LLM, no una base de datos verificada: el prompt fuerza "yes" para Samsung y Motorola por regla, sin comprobar el modelo concreto. Es la principal limitación de la app.
- Las keys de Groq y el token de GitHub se pegaron en chats en texto plano. Hay que revocarlos y regenerarlos. No guardar credenciales en el repo.
- Las rutas del manifest y del SW son absolutas (`/index.html`), así que la app funciona solo en la raíz del dominio.
