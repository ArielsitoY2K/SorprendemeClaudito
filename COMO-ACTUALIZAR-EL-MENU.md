# Cómo actualizar el menú (sin programar)

El menú vive en **una planilla de Google** (como un Excel). Cambiás los platos ahí y la web se actualiza sola, en unos 5 minutos.
No hay que tocar código, ni GitHub, ni Vercel.

---

## Cada semana (2 minutos)

1. Abrí la planilla del menú de Sorpréndeme.
2. Buscá las filas que dicen **Semana** en la primera columna.
3. Cambiá el **Nombre** (y, si querés, la **Descripción** y la **Foto**) de cada plato.
4. Listo. Cerrá la planilla. En unos 5 minutos ya está en la web.

| Quiero… | Qué hago |
|---|---|
| Cambiar un plato | Escribo el nombre nuevo encima del anterior |
| Agregar un plato | Agrego una fila abajo y completo **Sección**, **Tipo** y **Nombre** |
| Sacar un plato | Borro la fila (clic derecho en el número de fila → *Eliminar fila*) |
| Avisar algo arriba del menú (por ejemplo la fecha) | Agrego una fila con **Sección = Aviso** y el texto en **Nombre** |

### Qué va en cada columna

| Columna | Qué escribir | Ejemplos |
|---|---|---|
| **Sección** | Dónde aparece | `Semana`, `Clásicos`, `Empanadas`, `Pizzas`, `Postres`, `Aviso` |
| **Tipo** | Solo para `Semana` y `Clásicos` | `Con carne` o `Vegetariana` |
| **Nombre** | El nombre del plato (obligatorio) | `Pollo al disco con arroz` |
| **Descripción** | Una frase corta (opcional) | `Pollo cocinado a fuego lento, con arroz.` |
| **Foto** | La foto (opcional, ver abajo) | |

- Los platos con `Sección = Clásicos` son los fijos. Se combinan libremente con los de `Semana` en un mismo pedido.
- Para que una pizza entre en el combo de muzzarella, el nombre tiene que decir **muzzarella** (por ejemplo `Pizza de muzzarella`).
- Los precios **no** están en la planilla (están en `js/menu.js`).

---

## Fotos: tres formas, elegí la más cómoda

1. **No poner nada.** La web muestra un dibujo con el cartel «Foto próximamente». Sirve para empezar.
2. **Pegar un link de Google Drive** *(la más fácil)*: subí la foto a Drive → clic derecho → *Compartir* → «Cualquier persona con el enlace» → *Copiar enlace* → pegalo en la columna **Foto**.
3. **Archivo en la web:** subí la foto al repositorio, carpeta `assets/img`, con el nombre del plato en minúsculas, sin tildes y con guiones (`pollo-al-disco-con-arroz.jpg`). Si la columna **Foto** está vacía, la web busca ese archivo sola. También podés escribir el nombre del archivo (sin `.jpg`) en la columna **Foto**.

Fotos recomendadas: horizontales, 800 px de ancho, menos de 200 KB.

---

## Configuración inicial (se hace una sola vez)

1. Entrá a https://sheets.google.com y creá una planilla en blanco.
2. **Archivo → Importar → Subir** y elegí el archivo `data/menu.csv` de este proyecto. En «Ubicación de importación» elegí **Reemplazar hoja de cálculo** y confirmá.
3. **Archivo → Compartir → Publicar en la web.**
   - En el primer desplegable elegí la hoja (Hoja 1).
   - En el segundo elegí **Valores separados por comas (.csv)**.
   - Tocá **Publicar** y copiá el link que te da.
4. Abrí el archivo `js/menu.js` (en GitHub: tocá el archivo → ícono del lápiz), pegá el link entre las comillas de `menuSheetUrl: ""` y guardá con **Commit changes**.

Desde ese momento, todo se cambia solo desde la planilla.

> **Importante:** la planilla tiene que estar publicada en la web (paso 3). Si solo la compartís, la página no puede leerla.

---

## ¿Y si algo falla?

- Si la planilla no se puede leer (se cayó internet, se borró el link, etc.), la web usa automáticamente el menú guardado en `data/menu.csv`, así nunca queda vacía.
- Si un plato no muestra su foto, aparece el dibujo «Foto próximamente».
- Si cambiás algo y no aparece, esperá 5 minutos y recargá la página.
- Para volver atrás un cambio: en Google Sheets, **Archivo → Historial de versiones**.

## Alternativa sin Google

Si algún día no querés usar Google Sheets, dejá `menuSheetUrl` vacío y editá el archivo `data/menu.csv` (se puede abrir con Excel). Los cambios se publican al subir el archivo a GitHub.
