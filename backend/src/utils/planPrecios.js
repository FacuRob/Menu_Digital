// Precios mensuales de los planes del SaaS y de los módulos que se suman,
// en pesos argentinos. Solo hay cobro mensual.
// Única fuente de verdad del backend: los usa el catálogo del panel, el cobro
// por Mercado Pago y el MRR de plataforma. La landing tiene su copia en
// frontend/src/pages/Landing.tsx (mantener alineadas).
// Hasta el 2026-11-26 eran 20.000 / 41.000 / 65.000: quien ya pagaba conserva
// ese precio (cuentas.precio_plan_fijo, db/modulos_pagos.sql).
const MONEDA = "ARS";

const PRECIOS_MENSUALES = {
  free: 0,
  basic: 22000,
  standard: 44000,
  premium: 72000,
};

// Módulos que se suman al plan (en los planes que no los incluyen; ver
// LIMITES_POR_PLAN en suscripcion.js). `requiere`: otro módulo que tiene que
// estar activo.
const MODULOS_PAGOS = {
  whatsapp: { nombre: "WhatsApp", precio: 12000 },
  ia: { nombre: "Asistente con IA", precio: 11000, requiere: "whatsapp" },
  mapa: { nombre: "Mapa del repartidor", precio: 6000 },
};

const preciosPorPlan = () => ({ moneda: MONEDA, mensual: { ...PRECIOS_MENSUALES } });

module.exports = { preciosPorPlan, PRECIOS_MENSUALES, MODULOS_PAGOS, MONEDA };
