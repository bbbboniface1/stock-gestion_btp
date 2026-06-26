-- Migration production v2 — StockBTP
-- Exécuter sur PostgreSQL (Supabase SQL Editor) OU via: pnpm db:push
-- Date: 2026-06-25

-- 1. Tables nouvelles
CREATE TABLE IF NOT EXISTS invoice_sequences (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS revoked_tokens_expires_at_idx ON revoked_tokens (expires_at);

-- 2. stock_movements — lien facture + reversal
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS invoice_id integer REFERENCES invoices(id);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS reversed_by_movement_id integer;

CREATE INDEX IF NOT EXISTS stock_movements_invoice_id_idx ON stock_movements (invoice_id);

-- 3. invoice_items — quantités entières (aligné stock)
ALTER TABLE invoice_items
  ALTER COLUMN quantity TYPE integer USING round(quantity)::integer;

-- 4. products — stock non négatif
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_quantity_non_negative'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_quantity_non_negative CHECK (quantity_in_stock >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_threshold_non_negative'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_threshold_non_negative CHECK (minimum_threshold >= 0);
  END IF;
END $$;

-- 5. project_materials — pas de doublons produit/projet
CREATE UNIQUE INDEX IF NOT EXISTS project_materials_project_product_unique
  ON project_materials (project_id, product_id);

-- 6. Initialiser séquences factures depuis données existantes
INSERT INTO invoice_sequences (year, last_number)
SELECT
  CAST(substring(invoice_number FROM 'FAC-(\d{4})-') AS integer) AS year,
  MAX(CAST(substring(invoice_number FROM 'FAC-\d{4}-(\d+)') AS integer)) AS last_number
FROM invoices
WHERE invoice_number ~ '^FAC-[0-9]{4}-[0-9]+$'
GROUP BY 1
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(invoice_sequences.last_number, EXCLUDED.last_number);

-- 7. Backfill invoice_id sur mouvements existants (reversal legacy)
UPDATE stock_movements sm
SET invoice_id = i.id
FROM invoices i
WHERE sm.invoice_id IS NULL
  AND sm.type = 'OUT'
  AND sm.reason = 'Facture ' || i.invoice_number;
