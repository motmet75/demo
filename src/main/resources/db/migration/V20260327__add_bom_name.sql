-- Add bom_name column to the bom table (nullable, max 200 chars)
ALTER TABLE public.bom ADD COLUMN IF NOT EXISTS bom_name character varying(200);
