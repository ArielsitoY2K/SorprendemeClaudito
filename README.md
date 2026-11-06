# Sorpréndeme Viandas — Landing + mini tienda

Sitio estático (HTML + CSS + JavaScript, sin build ni dependencias). Se despliega tal cual en Vercel (plan gratuito).

## Probar en tu computadora

```bash
npx http-server . -p 5180 -c-1
```

Abrí http://localhost:5180

## Cada semana: actualizar el menú

El menú se edita en una **planilla de Google** (o en `data/menu.csv`). Paso a paso para quien no programa:
**[COMO-ACTUALIZAR-EL-MENU.md](COMO-ACTUALIZAR-EL-MENU.md)**.

- **Precios, WhatsApp y link de la planilla:** `js/menu.js`.
- **Platos (semanales, clásicos, empanadas, pizzas, postres):** la planilla / `data/menu.csv`.
- **Fotos:** columna *Foto* (nombre de archivo de `assets/img/` o link de Google Drive).

> Los postres todavía no tienen fotos: muestran un dibujo hasta que se cargue una.

**Reglas de precio que ya están programadas** (los valores se cambian en `prices`):
viandas más baratas desde la unidad 21, postres 3 por un precio, empanadas por docena y combo de pizzas (1 muzzarella + 1 a elección).
La **promo mensual** (20 viandas, 5 por semana durante 4 semanas) está en `promoMensual`; poné `null` para ocultarla.

Las **preguntas frecuentes** están escritas directamente en `index.html` (sección `id="faq"`).

## Subir a GitHub

```bash
git init
git add .
git commit -m "Landing y tienda Sorpréndeme Viandas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/sorprendeme-viandas.git
git push -u origin main
```

## Desplegar en Vercel (gratis)

1. Entrá a https://vercel.com e ingresá con tu cuenta de GitHub.
2. **Add New → Project** y elegí el repositorio.
3. En *Framework Preset* dejá **Other**. No cambies nada más (sin build command, sin output directory).
4. **Deploy**. Cada `git push` a `main` publica los cambios solo.

## Estructura

```
index.html        Estructura de la página
css/styles.css    Estilos (colores y tipografías del Design System)
js/menu.js        Precios, WhatsApp y link de la planilla del menú
data/menu.csv     Menú de respaldo / plantilla para importar a Google Sheets
js/app.js         Lógica de la tienda y armado del mensaje de WhatsApp
assets/img/       Logo y fotos
vercel.json       Cabeceras de caché y seguridad
```

## Accesibilidad pensada para mayores de 50

Letra grande con botón «Letra normal / grande / muy grande», contraste alto, botones de 56 px o más,
un solo camino en 3 pasos, foco visible con teclado, lectores de pantalla y respeto de «reducir movimiento».
