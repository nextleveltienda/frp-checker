# FRP Checker Pro — Guía de instalación

## ¿Qué es?
App para verificar en tiempo real si un celular tiene solución FRP disponible con tus herramientas (Octoplus, SamFw, UMT, Pandora, NCK, Chimera, SigmaPlus, etc).

---

## 📁 Archivos incluidos

```
frp-checker-pwa/
├── index.html          ← App principal
├── manifest.json       ← Configuración PWA
├── sw.js               ← Service Worker (offline)
└── icons/              ← Íconos en todos los tamaños
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-256x256.png
    ├── icon-384x384.png
    └── icon-512x512.png
```

---

## 🖥 Instalación en Windows (Chrome)

### Opción A — Servidor local (recomendado, todas las funciones)

1. Instalá Python si no lo tenés: https://python.org
2. Abrí una terminal en la carpeta `frp-checker-pwa`
3. Ejecutá:
   ```
   python -m http.server 8080
   ```
4. Abrí Chrome y andá a: `http://localhost:8080`
5. En la barra de Chrome vas a ver un ícono ⊕ (instalar)
6. Hacé clic → "Instalar FRP Checker Pro"
7. ¡Listo! Aparece en el escritorio y en el menú de apps

### Opción B — Abrir directamente (funciones básicas)
1. Hacé doble clic en `index.html`
2. Se abre en el navegador
3. El modo instalable requiere el servidor local (Opción A)

---

## 📱 Instalación en Android (Chrome)

### Opción A — Hosting gratuito (recomendado)

1. Subí la carpeta completa a un hosting gratuito:
   - **Netlify Drop**: andá a https://app.netlify.com/drop y arrastrá la carpeta
   - Te da una URL tipo `https://tu-nombre.netlify.app`

2. Abrí esa URL en Chrome Android
3. Chrome muestra un banner "Agregar a pantalla de inicio"
   - Si no aparece: menú ⋮ → "Agregar a pantalla de inicio"
4. ¡Listo! Aparece como app en tu pantalla

### Opción B — Desde tu PC con servidor local

1. Ejecutá el servidor en tu PC (ver Opción A de Windows)
2. Asegurate que el celular esté en la misma red WiFi
3. En Chrome Android andá a: `http://IP-DE-TU-PC:8080`
   - Para saber tu IP: en CMD escribí `ipconfig`
4. Menú ⋮ → "Agregar a pantalla de inicio"

---

## ⚡ Características

- ✅ Búsqueda en tiempo real con IA + web search
- ✅ Soporta: Octoplus FRP, SamFw, UMT/UMTv2, Pandora, NCK Box, Chimera, SigmaPlus
- ✅ Historial de búsquedas guardado localmente
- ✅ Funciona sin internet (muestra últimos datos cacheados)
- ✅ Filtros por marca (Samsung, Motorola, Xiaomi, LG, Huawei, Nokia, Alcatel, Tecno, TCL)
- ✅ Nivel de confianza por resultado
- ✅ Actualización automática de la app

---

## 🔧 Actualización

Para actualizar a una versión nueva:
1. Reemplazá los archivos en tu carpeta
2. La app se actualiza automáticamente en el próximo inicio

---

## 📞 Soporte de herramientas

| Herramienta | Marcas principales |
|---|---|
| Octoplus FRP | Samsung, LG, Huawei |
| SamFw Tool | Samsung (exclusivo) |
| UMT / UMTv2 | MTK, Qualcomm, Unisoc |
| Pandora Tool | Samsung, Motorola, LG |
| NCK Box | MTK, Samsung, LG, Alcatel |
| Chimera | Samsung, Nokia, LG |
| SigmaPlus | MTK, Unisoc, Qualcomm |
