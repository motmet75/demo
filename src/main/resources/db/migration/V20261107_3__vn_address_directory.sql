-- Vietnam administrative address directory shared by all DEMO tenants.
-- IMPORTANT: Run once with psql as a DB role allowed to create extensions.
-- CURRENT_2025 = current province->ward catalogue (verify against NSO).
-- VIETTELPOST_LEGACY = Viettel Post's old province->district->ward DELIVERY catalogue.
-- They are intentionally NOT considered equivalent.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS public.vn_address_unit (
    source        text NOT NULL CHECK (source IN ('CURRENT_2025', 'VIETTELPOST_LEGACY')),
    unit_type     text NOT NULL CHECK (unit_type IN ('PROVINCE','DISTRICT','WARD')),
    code          text NOT NULL,
    parent_code   text,
    province_code text,
    display_name  text NOT NULL,
    search_key    text NOT NULL,
    active        boolean NOT NULL DEFAULT true,
    imported_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source, unit_type, code)
);
CREATE INDEX IF NOT EXISTS vn_address_unit_search_gin
  ON public.vn_address_unit USING GIN (search_key gin_trgm_ops);
CREATE INDEX IF NOT EXISTS vn_address_unit_parent_idx
  ON public.vn_address_unit (source, unit_type, parent_code);
CREATE INDEX IF NOT EXISTS vn_address_unit_province_idx
  ON public.vn_address_unit (source, province_code) WHERE active;

-- Optional per-unit aliases: e.g. "TP HCM", "HCM" or historically used names.
CREATE TABLE IF NOT EXISTS public.vn_address_alias (
    source       text NOT NULL,
    unit_type    text NOT NULL,
    code         text NOT NULL,
    alias_text   text NOT NULL,
    search_key   text NOT NULL,
    PRIMARY KEY (source, unit_type, code, search_key),
    FOREIGN KEY (source, unit_type, code)
       REFERENCES public.vn_address_unit(source, unit_type, code) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS vn_address_alias_search_gin
  ON public.vn_address_alias USING GIN (search_key gin_trgm_ops);

-- Mergers and splits are manually verified; never infer a one-to-one mapping.
CREATE TABLE IF NOT EXISTS public.vn_address_transition (
    old_source text NOT NULL,
    old_type   text NOT NULL,
    old_code   text NOT NULL,
    new_source text NOT NULL,
    new_type   text NOT NULL,
    new_code   text NOT NULL,
    relation   text NOT NULL CHECK (relation IN ('UNCHANGED','MERGED','SPLIT','RENAMED')),
    verified   boolean NOT NULL DEFAULT false,
    citation_url text,
    PRIMARY KEY (old_source, old_type, old_code, new_source, new_type, new_code)
);

CREATE TABLE IF NOT EXISTS public.vn_address_import_log (
    id bigserial PRIMARY KEY,
    source text NOT NULL,
    source_version text NOT NULL,
    source_url text NOT NULL,
    province_count integer NOT NULL DEFAULT 0,
    ward_count integer NOT NULL DEFAULT 0,
    imported_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vn_address_unit IS
 'Reference/alias directory; not personally identifiable customer addresses.';
COMMENT ON TABLE public.vn_address_transition IS
 'Only verified old-to-new changes; mappings may be one-to-many.';
