--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1 (Debian 18.1-1.pgdg12+2)
-- Dumped by pg_dump version 18.1 (Debian 18.1-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_table_access_method = heap;


--create uuid_v7 function for each schema that does not have it
CREATE OR REPLACE FUNCTION public.uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    ts_ms bigint;
    rand_a int;
    rand_b bigint;
BEGIN
    -- milliseconds since Unix epoch
    ts_ms := floor(extract(epoch FROM clock_timestamp()) * 1000);

    -- 12 bits + 62 bits randomness
    rand_a := floor(random() * 4096);                 -- 12 bits
    rand_b := floor(random() * 4611686018427387904);  -- 62 bits

    RETURN (
        lpad(to_hex(ts_ms), 12, '0') ||                -- 48 bits time
        '7' ||                                         -- version 7
        lpad(to_hex(rand_a), 3, '0') ||
        lpad(to_hex(rand_b), 16, '0')
    )::uuid;
END;
$$;


CREATE TABLE public.tenant (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    created_at timestamp(6) with time zone,
    tenant_code character varying(100) NOT NULL,
    tenant_name text NOT NULL,
    tenant_type character varying(50),
    is_active boolean NOT NULL
);

--
-- Name: bom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
   -- model_name character varying(100) NOT NULL,
    version integer NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    model_id uuid NOT NULL,
    company_id character varying(100) NOT NULL
);


--
-- Name: bom_calculation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_calculation (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    bom_id uuid NOT NULL,
    model_name character varying(100) NOT NULL,
    target_qty numeric(14,4) NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: bom_calculation_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_calculation_item (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    calculation_id uuid NOT NULL,
    material_id uuid NOT NULL,
    required_qty numeric(14,4) NOT NULL,
    available_qty numeric(14,4) NOT NULL,
    shortage_qty numeric(14,4) NOT NULL,
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: bom_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_item (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    bom_id uuid NOT NULL,
    parent_item_id uuid,
    material_id uuid NOT NULL,
    quantity double precision NOT NULL,
    level integer NOT NULL,
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    created_at timestamp(6) with time zone,
    company_id uuid NOT NULL
);


--
-- Name: company; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company (
    id uuid NOT NULL,
    company_code character varying(100) NOT NULL,
    company_name text NOT NULL,
    created_at timestamp(6) with time zone,
    tenant_id uuid DEFAULT public.uuid_v7() NOT NULL
);


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity_on_hand numeric(14,4) NOT NULL,
    quantity_locked numeric(14,4) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now(),
    material_code character varying(50),
    material_name text,
    warehouse_code character varying(50),
    warehouse_name text,
    quantity_reserved numeric(18,4) DEFAULT 0,
    batch_no character varying(255) NOT NULL,
    expiration_date_time timestamp without time zone,
    production_date_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    expiration_date timestamp(6) with time zone,
    production_date timestamp(6) with time zone,
    tenant_id uuid DEFAULT public.uuid_v7() NOT NULL,
    quantity double precision,
    company_id uuid NOT NULL,
    CONSTRAINT chk_quantity_non_negative CHECK (((quantity_on_hand >= (0)::numeric) AND (quantity_reserved >= (0)::numeric))),
    CONSTRAINT chk_reserved_not_exceed_onhand CHECK ((quantity_reserved <= quantity_on_hand))
);


--
-- Name: inventory_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_history (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity numeric(14,4) NOT NULL,
    snapshot_date date NOT NULL,
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: inventory_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_lock (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    lock_type character varying(30) NOT NULL,
    quantity numeric(14,4) NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_code character varying(50) NOT NULL,
    material_name text NOT NULL,
    unit character varying(20) NOT NULL,
    material_type character varying(30) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    description text,
    price numeric(38,2),
    tenant_id uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: material_consumption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_consumption (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_id uuid NOT NULL,
    quantity numeric(14,4) NOT NULL,
    source character varying(30) NOT NULL,
    consumed_at date NOT NULL,
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: material_defect; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_defect (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    quantity numeric(14,4) NOT NULL,
    defect_reason text,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: material_forecast; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_forecast (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    forecast_date date NOT NULL,
    forecast_qty numeric(14,4) NOT NULL,
    model_version character varying(20),
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    model_code character varying(50) NOT NULL,
    model_name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: model_bom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_bom (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    model_id uuid NOT NULL,
    material_id uuid NOT NULL,
    qty_per_unit numeric(14,4) NOT NULL,
    tenant_id uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    code character varying(50),
    supplier_code character varying(50) NOT NULL,
    supplier_name text NOT NULL,
    contact_name character varying(100),
    phone character varying(30),
    email character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: supplier_issue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_issue (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    supplier_id uuid NOT NULL,
    material_id uuid NOT NULL,
    quantity numeric(14,4),
    issue_type character varying(30) NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying(100) DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: warehouse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    code character varying(50) NOT NULL,
    name text NOT NULL,
    contact_name character varying(100),
    phone character varying(30),
    email character varying(100),
    capacity numeric(18,2),
    note text,
    created_at timestamp(6) with time zone,
    is_active boolean,
    location character varying(200),
    tenant_id uuid DEFAULT public.uuid_v7() NOT NULL,
    company_id uuid NOT NULL
);


--
-- Name: bom_calculation_item bom_calculation_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_calculation_item
    ADD CONSTRAINT bom_calculation_item_pkey PRIMARY KEY (id);


--
-- Name: bom_calculation bom_calculation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_calculation
    ADD CONSTRAINT bom_calculation_pkey PRIMARY KEY (id);


--
-- Name: bom_item bom_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_item
    ADD CONSTRAINT bom_item_pkey PRIMARY KEY (id);


--
-- Name: bom bom_model_name_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom
    ADD CONSTRAINT bom_model_name_version_key UNIQUE (model_name, version);


--
-- Name: bom bom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom
    ADD CONSTRAINT bom_pkey PRIMARY KEY (id);


--
-- Name: company company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (id);


--
-- Name: inventory_history inventory_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_history
    ADD CONSTRAINT inventory_history_pkey PRIMARY KEY (id);


--
-- Name: inventory_lock inventory_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lock
    ADD CONSTRAINT inventory_lock_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_material_wh_tenant_batch_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_material_wh_tenant_batch_key UNIQUE (material_id, warehouse_id, tenant_id, batch_no);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: material_consumption material_consumption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_consumption
    ADD CONSTRAINT material_consumption_pkey PRIMARY KEY (id);


--
-- Name: material_defect material_defect_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_defect
    ADD CONSTRAINT material_defect_pkey PRIMARY KEY (id);


--
-- Name: material_forecast material_forecast_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_forecast
    ADD CONSTRAINT material_forecast_pkey PRIMARY KEY (id);


--
-- Name: material material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material
    ADD CONSTRAINT material_pkey PRIMARY KEY (id);


--
-- Name: model_bom model_bom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_bom
    ADD CONSTRAINT model_bom_pkey PRIMARY KEY (id);


--
-- Name: model model_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model
    ADD CONSTRAINT model_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_code_key UNIQUE (code);


--
-- Name: supplier_issue supplier_issue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_issue
    ADD CONSTRAINT supplier_issue_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);


--
-- Name: bom uk202l6q1gwmylnd747aj357352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom
    ADD CONSTRAINT uk202l6q1gwmylnd747aj357352 UNIQUE (tenant_id, model_id, version);


--
-- Name: bom ukev5ldcj8xrbgp9y1ugp5j52t9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom
    ADD CONSTRAINT ukev5ldcj8xrbgp9y1ugp5j52t9 UNIQUE (model_name, version);


--
-- Name: company uki2jcjcejgnwuafxofwmgosd13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT uki2jcjcejgnwuafxofwmgosd13 UNIQUE (company_code);


--
-- Name: inventory uksrvmvf2p5ll6g527yjos2uoby; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT uksrvmvf2p5ll6g527yjos2uoby UNIQUE (material_id, warehouse_id, batch_no);


--
-- Name: supplier uq_supplier_supplier_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT uq_supplier_supplier_code UNIQUE (supplier_code);


--
-- Name: warehouse warehouse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT warehouse_pkey PRIMARY KEY (id);


--
-- Name: idx_bom_calc_item_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_calc_item_tenant_id ON public.bom_calculation_item USING btree (tenant_id);


--
-- Name: idx_bom_calculation_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_calculation_tenant_id ON public.bom_calculation USING btree (tenant_id);


--
-- Name: idx_bom_item_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_item_tenant_id ON public.bom_item USING btree (tenant_id);


--
-- Name: idx_bom_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bom_tenant_id ON public.bom USING btree (tenant_id);


--
-- Name: idx_company_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_tenant ON public.company USING btree (tenant_id);


--
-- Name: idx_inventory_history_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_history_tenant_id ON public.inventory_history USING btree (tenant_id);


--
-- Name: idx_inventory_lock_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_lock_tenant_id ON public.inventory_lock USING btree (tenant_id);


--
-- Name: idx_inventory_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_tenant_id ON public.inventory USING btree (tenant_id);


--
-- Name: idx_material_consumption_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_consumption_tenant_id ON public.material_consumption USING btree (tenant_id);


--
-- Name: idx_material_defect_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_defect_tenant_id ON public.material_defect USING btree (tenant_id);


--
-- Name: idx_material_forecast_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_forecast_tenant_id ON public.material_forecast USING btree (tenant_id);


--
-- Name: idx_material_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_tenant_id ON public.material USING btree (tenant_id);


--
-- Name: idx_model_bom_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_bom_tenant_id ON public.model_bom USING btree (tenant_id);


--
-- Name: idx_model_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_model_tenant_id ON public.model USING btree (tenant_id);


--
-- Name: idx_supplier_issue_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_issue_tenant_id ON public.supplier_issue USING btree (tenant_id);


--
-- Name: idx_supplier_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_tenant_id ON public.supplier USING btree (tenant_id);


--
-- Name: idx_warehouse_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_tenant_id ON public.warehouse USING btree (tenant_id);


--
-- Name: ux_company_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_company_code ON public.company USING btree (company_code);


--
-- Name: bom_calculation bom_calculation_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_calculation
    ADD CONSTRAINT bom_calculation_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.bom(id);


--
-- Name: bom_calculation_item bom_calculation_item_calculation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_calculation_item
    ADD CONSTRAINT bom_calculation_item_calculation_id_fkey FOREIGN KEY (calculation_id) REFERENCES public.bom_calculation(id) ON DELETE CASCADE;


--
-- Name: bom_calculation_item bom_calculation_item_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_calculation_item
    ADD CONSTRAINT bom_calculation_item_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: bom_item bom_item_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_item
    ADD CONSTRAINT bom_item_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.bom(id) ON DELETE CASCADE;


--
-- Name: bom_item bom_item_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_item
    ADD CONSTRAINT bom_item_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: bom_item bom_item_parent_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_item
    ADD CONSTRAINT bom_item_parent_item_id_fkey FOREIGN KEY (parent_item_id) REFERENCES public.bom_item(id);


--
-- Name: inventory fk_inventory_material; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT fk_inventory_material FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: inventory fk_inventory_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT fk_inventory_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: company fkf95c42jmgyrxft6dcmpqc0ff4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT fkf95c42jmgyrxft6dcmpqc0ff4 FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: bom fkl4wbjvwwrlol8hsbye67v213u; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom
    ADD CONSTRAINT fkl4wbjvwwrlol8hsbye67v213u FOREIGN KEY (model_id) REFERENCES public.model(id);


--
-- Name: material fkl6g2pxw3ehxapbwy3yej3hw82; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material
    ADD CONSTRAINT fkl6g2pxw3ehxapbwy3yej3hw82 FOREIGN KEY (tenant_id) REFERENCES public.tenant(id);


--
-- Name: inventory_history inventory_history_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_history
    ADD CONSTRAINT inventory_history_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: inventory_history inventory_history_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_history
    ADD CONSTRAINT inventory_history_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: inventory_lock inventory_lock_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lock
    ADD CONSTRAINT inventory_lock_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: inventory_lock inventory_lock_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lock
    ADD CONSTRAINT inventory_lock_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: inventory inventory_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: inventory inventory_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: material_consumption material_consumption_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_consumption
    ADD CONSTRAINT material_consumption_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: material_defect material_defect_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_defect
    ADD CONSTRAINT material_defect_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: material_defect material_defect_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_defect
    ADD CONSTRAINT material_defect_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: material_forecast material_forecast_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_forecast
    ADD CONSTRAINT material_forecast_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: material_forecast material_forecast_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_forecast
    ADD CONSTRAINT material_forecast_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouse(id);


--
-- Name: model_bom model_bom_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_bom
    ADD CONSTRAINT model_bom_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id) ON DELETE RESTRICT;


--
-- Name: model_bom model_bom_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_bom
    ADD CONSTRAINT model_bom_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.model(id) ON DELETE CASCADE;


--
-- Name: supplier_issue supplier_issue_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_issue
    ADD CONSTRAINT supplier_issue_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: supplier_issue supplier_issue_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_issue
    ADD CONSTRAINT supplier_issue_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier(id);


--
-- PostgreSQL database dump complete
--

    CREATE TABLE contract (
    id                      uuid                     PRIMARY KEY DEFAULT public.uuid_v7(),
    
    -- Business identifier - no longer unique alone
    contract_number         VARCHAR(50)              NOT NULL,
    
    -- Main info
    title                   VARCHAR(200)             NOT NULL,
    description             TEXT,
    
    -- Parties (updated naming)
    supplier_company_id     uuid                     NOT NULL,   -- the selling/supplying company
    purchasing_company_id   uuid                     NOT NULL,   -- the buying company (your side or client)
    company_id              uuid                     NOT NULL,   -- the owning company (for multi-company scoping)
    tenant_id               uuid,                                -- multi-tenant scope (optional)
    
    -- Type & category
    contract_type           VARCHAR(50)              NOT NULL DEFAULT 'PURCHASE',
    category                VARCHAR(100),
    
    -- Dates
    start_date              DATE                     NOT NULL,
    end_date                DATE,
    signing_date            DATE,
    effective_date          DATE                     DEFAULT CURRENT_DATE,
    termination_date        DATE,
    
    -- Financial
    total_value             NUMERIC(18,2),
    currency                CHAR(3)                  DEFAULT 'VND',
    payment_terms           VARCHAR(100),
    
    -- Status
    status                  VARCHAR(30)              NOT NULL DEFAULT 'DRAFT',
    
    -- Audit
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by              VARCHAR(100),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by              VARCHAR(100),
    
    -- Extras
    is_auto_renew           BOOLEAN                  DEFAULT FALSE,
    renewal_notice_days     INTEGER                  DEFAULT 30,
    attachment_path         VARCHAR(500),
    notes                   TEXT,
    
    -- Constraints
    CONSTRAINT chk_contract_dates      CHECK (start_date <= end_date OR end_date IS NULL),
    CONSTRAINT chk_contract_value      CHECK (total_value >= 0 OR total_value IS NULL),
    CONSTRAINT chk_contract_status     CHECK (status IN (
        'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 
        'EXPIRED', 'TERMINATED', 'CLOSED'
    )),
    
    -- New composite unique constraint: same contract number only allowed once per tenant + buying company
    CONSTRAINT uk_contract_number_supplier_tenant_purchaser 
        UNIQUE ( tenant_id, supplier_company_id, contract_number, purchasing_company_id)
);


