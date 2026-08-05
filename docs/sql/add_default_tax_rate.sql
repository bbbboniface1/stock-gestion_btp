-- Migration: ajout du taux de TVA par défaut sur les paramètres entreprise
-- Date: 2026-08-05
-- Exécuter dans Supabase SQL Editor (ou via pnpm db:push si connexion directe disponible)

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS default_tax_rate integer;
