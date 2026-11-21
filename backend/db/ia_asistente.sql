-- Migración: nombre con el que se presenta el asistente de WhatsApp
-- ("¡Hola! Soy Alex, el asistente IA de …"). Vacío = sin nombre. Idempotente.

ALTER TABLE whatsapp_ia ADD COLUMN IF NOT EXISTS nombre_asistente VARCHAR(30);
