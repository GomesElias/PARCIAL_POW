# SkyDash-Manager 🌤️

**Plataforma avanzada de visualización y analítica meteorológica georreferenciada**

> Universidad Católica Andrés Bello (UCAB) · Ingeniería en Informática · Programación Orientada a la Web · Semestre 2-2025

---

## 🌐 Demo en vivo

**GitHub Pages:** [Ver aplicación desplegada](https://tu-usuario.github.io/PARCIAL_POW/)

---

## 📋 Descripción

SkyDash-Manager es una aplicación web de visualización meteorológica que permite al usuario explorar condiciones climáticas en tiempo real en cualquier punto del mundo mediante un mapa interactivo. La plataforma integra datos de Open-Meteo, geolocalización mediante Leaflet y persistencia local para una experiencia fluida en cualquier dispositivo.

---

## ✅ Funcionalidades implementadas

### 1. Módulo de Autenticación y Seguridad
- ✔️ Pantalla de bienvenida con formulario de inicio de sesión
- ✔️ Registro de nuevos usuarios (almacenados en localStorage)
- ✔️ Cuenta demo preconfigurada: `admin` / `skydash2025`
- ✔️ **Spinners de carga** durante la validación de credenciales (delay simulado de 1.5s)
- ✔️ Cierre de sesión seguro con limpieza de `sessionStorage` y redirección automática
- ✔️ Protección de rutas: el dashboard redirige al login si no hay sesión activa

### 2. Arquitectura de Georreferenciación
- ✔️ Mapa interactivo con **Leaflet.js** (clic para seleccionar ubicación)
- ✔️ **Marcadores dinámicos con DivIcon**: emoji del clima inyectado programáticamente (☀️ 🌧️ ⛈️ ❄️...)
- ✔️ **Buscador manual** con sugerencias en tiempo real (debounce 350ms)
- ✔️ Animación de vuelo al seleccionar una ubicación (`flyTo`)
- ✔️ **Geocodificación inversa**: coordenadas → nombre de localidad (Nominatim)
- ✔️ **Geocodificación directa**: texto → coordenadas (Nominatim)
- ✔️ Botón "Mi ubicación" (Geolocation API)
- ✔️ Botón de vista global (reset del mapa)

### 3. Panel de Detalle Meteorológico
- ✔️ Temperatura actual, sensación térmica, humedad, viento, precipitación
- ✔️ **Pronóstico extendido de 7 días** (temperatura máx/mín, código climático, precipitación)
- ✔️ Emojis representativos para todos los códigos WMO de Open-Meteo
- ✔️ Diseño responsivo con CSS avanzado y glassmorphism

### 4. Mis Ubicaciones (Favoritos)
- ✔️ Botón "Guardar ubicación" en el panel de clima
- ✔️ Lista de favoritos en pestaña dedicada
- ✔️ **Persistencia en localStorage**: los favoritos sobreviven al cierre de sesión y al refresco del navegador
- ✔️ Clic en favorito → vuelo inmediato en el mapa + carga de clima
- ✔️ Eliminación individual de favoritos
- ✔️ Detección de duplicados (radio de ~5km)

### 5. Modo Offline
- ✔️ **Service Worker** registrado que cachea el app shell en `install`
- ✔️ Estrategia Cache-First para assets estáticos
- ✔️ Estrategia Network-First para llamadas a APIs (con fallback a caché)
- ✔️ Caché de últimas 15 consultas meteorológicas en localStorage
- ✔️ Banner de advertencia visible cuando el dispositivo pierde conectividad

### 6. Tematización Dual
- ✔️ **Modo oscuro / modo claro** con toggle en header y página de login
- ✔️ Implementado mediante variables CSS (`--` custom properties)
- ✔️ Preferencia guardada en localStorage (persiste entre sesiones)
- ✔️ Atajo de teclado: `D` alterna el tema

### 7. UX y Diseño Responsivo
- ✔️ Diseño Mobile-First con media queries para todas las resoluciones
- ✔️ En móvil: sidebar deslizante desde abajo (65% del viewport)
- ✔️ Partículas animadas en el fondo de la pantalla de login
- ✔️ Toast notifications para feedback no intrusivo
- ✔️ Atajo `Ctrl/Cmd + K` para enfocar el buscador

---

## 🛠️ Tecnologías utilizadas

| Tecnología | Versión | Uso |
|---|---|---|
| HTML5 | — | Estructura semántica |
| CSS3 | — | Estilos, variables, animaciones, responsive |
| JavaScript ES5/ES6 | — | Lógica del cliente |
| [Leaflet.js](https://leafletjs.com/) | 1.9.4 | Mapa interactivo |
| [Open-Meteo](https://open-meteo.com/) | v1 | API meteorológica gratuita |
| [Nominatim / OSM](https://nominatim.openstreetmap.org/) | — | Geocodificación |
| Service Worker | — | Modo offline |
| localStorage / sessionStorage | — | Persistencia de datos |

> ⚠️ No se utilizó ningún framework JavaScript (React, Angular, Vue, etc.) ni framework CSS (Bootstrap, Tailwind). Toda la interfaz es CSS puro y JavaScript vanilla.

---

## 📁 Estructura del proyecto

```
PARCIAL_POW/
├── index.html           # Página de bienvenida / autenticación
├── dashboard.html       # Dashboard principal (mapa + paneles)
├── sw.js                # Service Worker (modo offline)
├── css/
│   └── styles.css       # Hoja de estilos completa (tema dual, responsive)
├── js/
│   ├── auth.js          # Módulo de autenticación y sesión
│   ├── weather.js       # Módulo de clima (Open-Meteo, WMO codes)
│   ├── favorites.js     # Módulo de ubicaciones guardadas (localStorage)
│   ├── map.js           # Módulo de mapa (Leaflet, geocodificación)
│   └── app.js           # Orquestador principal (tema, búsqueda, sidebar)
└── README.md
```

---

## 🚀 Cómo ejecutar localmente

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/PARCIAL_POW.git

# Entrar al directorio
cd PARCIAL_POW

# Abrir con un servidor local (necesario para Service Worker)
# Opción 1: Python
python3 -m http.server 8080

# Opción 2: Node.js
npx serve .

# Luego abrir en el navegador:
# http://localhost:8080
```

> **Nota:** Para que el Service Worker funcione correctamente, el proyecto debe ejecutarse desde un servidor HTTP (no desde `file://`).

---

## 🔑 Credenciales de prueba

| Usuario | Contraseña |
|---|---|
| `admin` | `skydash2025` |
| *(cualquier cuenta registrada)* | *(la que eligiste)* |

---

## 📡 APIs utilizadas

- **Open-Meteo** (`https://api.open-meteo.com/v1/forecast`) — Datos meteorológicos actuales y pronóstico 7 días. Sin clave de API.
- **Nominatim** (`https://nominatim.openstreetmap.org`) — Geocodificación directa e inversa. Sin clave de API.
- **OpenStreetMap tiles** — Capa base del mapa.

---

## 👥 Autores

Proyecto desarrollado para el parcial de **Programación Orientada a la Web** · UCAB · Semestre 2-2025.

---

## 📄 Licencia

Proyecto académico. Todos los derechos reservados © 2025.
