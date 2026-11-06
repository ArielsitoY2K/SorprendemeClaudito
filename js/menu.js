/* =====================================================================
   SORPRÉNDEME VIANDAS — AJUSTES (precios, WhatsApp, planilla del menú)

   ⚠ ESTE ARCHIVO NO SE TOCA PARA CAMBIAR EL MENÚ.
   Los platos (semanales, clásicos, empanadas, pizzas y postres) están
   en una PLANILLA. Ver COMO-ACTUALIZAR-EL-MENU.md

   Acá solo se cambian los precios o el número de WhatsApp.
===================================================================== */
window.SORPRENDEME = {
  whatsapp: "5493517863863",      // formato internacional, sin + ni espacios
  phoneLabel: "351 7863863",

  /* ------------------------------------------------------------------
     DE DÓNDE SALE EL MENÚ
     - menuSheetUrl: el link de tu planilla de Google Sheets "publicada
       como CSV" (se pega UNA sola vez, ver la guía).
       Mientras esté vacío, la web usa el archivo data/menu.csv.
     - Si el link de Google falla, la web usa data/menu.csv automáticamente.
  ------------------------------------------------------------------ */
  menuSheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQV6x9tqit-Fl9g7ZM2EkbKYZBl0ofb3rojgUcP7mm8RKhFYtUCtc0hB3KlyAthRxtpW-fKxS_Z0Lj8/pub?gid=1859023255&single=true&output=csv",
  menuFile: "data/menu.csv",

  // Cartel de "Precios congelados". Poné "" para sacarlo.
  priceNote: "Seguimos con los precios de julio 2026",

  prices: {
    vianda: 10500,
    viandaBulk: 10000,       // precio de cada vianda cuando se piden más de 20
    viandaBulkFrom: 21,      // desde cuántas viandas rige el precio por cantidad
    postre: 5000,
    postrePack3: 12000,      // 3 postres
    empanada: 12000,         // la docena
    pizza: 12500,
    pizzaCombo: 20000,       // 1 muzzarella + 1 a elección
    promoMensual: 200000     // 20 viandas: 5 por semana durante 4 semanas, se abona por adelantado. null = no se muestra
  },
  minViandas: 5              // pedido mínimo: se calcula como 5 x precio de vianda
};
