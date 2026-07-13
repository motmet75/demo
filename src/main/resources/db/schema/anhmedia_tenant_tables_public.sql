--
-- PostgreSQL database dump
--

\restrict sWIcEPFWfH8u3kJP3n8VWhbL4AlamCFno3QkvfAy75juohmsqOJvSWJ1GXUolnv

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

--
-- Name: articletb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articletb (
    id integer NOT NULL,
    articleid character varying(255),
    username character varying(255) NOT NULL,
    articlelink character varying(255) NOT NULL,
    articlecategory character varying(255),
    articlelangcode character varying(255),
    articlesubcategory character varying(255),
    articletitle character varying(255),
    articlekeyword character varying(255),
    articlethumnailurl character varying(500),
    articledescription text,
    articlecontent text,
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone NOT NULL,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL,
    rejectedbyuser character varying(255),
    rejectedreason text,
    articletime timestamp without time zone,
    originauthor character varying(255) DEFAULT 'none'::character varying,
    menustringid character varying(255) DEFAULT 'n'::character varying,
    viewcount integer DEFAULT 0,
    rating numeric(5,3) DEFAULT 0,
    postid character varying(255) DEFAULT 'n'::character varying,
    articletemplate character varying(255) DEFAULT 'n'::character varying,
    index character varying(255) DEFAULT '0'::character varying
);


--
-- Name: articletb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.articletb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: articletb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.articletb_id_seq OWNED BY public.articletb.id;


--
-- Name: authorities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authorities (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    authority character varying(255) NOT NULL,
    description character varying(255),
    visible boolean DEFAULT true
);


--
-- Name: authorities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.authorities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: authorities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.authorities_id_seq OWNED BY public.authorities.id;


--
-- Name: bieuthuetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bieuthuetb (
    id integer NOT NULL,
    level character varying(255),
    section character varying(255),
    hscode character varying(255),
    description text,
    videscription text,
    viunit character varying(255),
    enunit character varying(255),
    normalimtax character varying(255),
    preferentialimtax character varying(255),
    vat character varying(255),
    acfta character varying(255),
    atiga character varying(255),
    ajcep character varying(255),
    vjepa character varying(255),
    akfta character varying(255),
    aanzfta character varying(255),
    aifta character varying(255),
    vkfta character varying(255),
    vcfta character varying(255),
    vneaeu character varying(255),
    cptpp character varying(255),
    ahkfta character varying(255),
    vncu character varying(255),
    evfta character varying(255),
    ukvfta character varying(255),
    vnlao character varying(255),
    rcepta character varying(255),
    rceptb character varying(255),
    rceptc character varying(255),
    rceptd character varying(255),
    rcepte character varying(255),
    rceptf character varying(255),
    sctax character varying(255),
    extax character varying(255),
    excptp character varying(255),
    exev character varying(255),
    exukv character varying(255),
    enprotax text,
    hspolicy text,
    note text,
    detailnote text,
    description_of_goods_english character varying(255),
    vi_description character varying(255),
    detail_note character varying(255),
    en_pro_tax character varying(255),
    en_unit character varying(255),
    ex_tax character varying(255),
    hs_policy character varying(255),
    normal_im_tax character varying(255),
    preferential_im_tax character varying(255),
    sc_tax character varying(255),
    vi_unit character varying(255),
    vn_eaeu character varying(255),
    vn_lao character varying(255),
    descriptionofgoodsenglish character varying(255)
);


--
-- Name: bieuthuetb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bieuthuetb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bieuthuetb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bieuthuetb_id_seq OWNED BY public.bieuthuetb.id;


--
-- Name: bom; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    model_name character varying(100) NOT NULL,
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
-- Name: bomandmtltb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bomandmtltb (
    id integer NOT NULL,
    bomid integer NOT NULL,
    mtlid integer NOT NULL,
    materialidname character varying(255) NOT NULL,
    qty numeric,
    index integer,
    unit character varying(255),
    visible boolean NOT NULL,
    materialname character varying(255),
    modelid integer
);


--
-- Name: bomandmtltb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bomandmtltb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bomandmtltb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bomandmtltb_id_seq OWNED BY public.bomandmtltb.id;


--
-- Name: cdsitemtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cdsitemtb (
    id integer NOT NULL,
    stringid character varying(255),
    cdsno character varying(50),
    cdsdate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    masohanghoa character varying(50),
    motahanghoa text,
    soluong1 character varying(50),
    soluong2 character varying(50),
    unit character varying(50),
    dongiahoadon character varying(50),
    currency character varying(50),
    trigiahoadon character varying(50),
    thuesuat character varying(50),
    sotienthue character varying(50),
    sotienmiengiam character varying(50),
    nuocxuatxu character varying(50),
    vat character varying(50),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: cdsitemtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cdsitemtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cdsitemtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cdsitemtb_id_seq OWNED BY public.cdsitemtb.id;


--
-- Name: chart_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_option (
    chart_option_id character varying(255) NOT NULL,
    chart_option_ch_name character varying(255),
    chart_option_en_name character varying(255),
    chart_option_vi_name character varying(255),
    default_lang character varying(255)
);


--
-- Name: chart_seri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_seri (
    category_id character varying(255) NOT NULL,
    category_ch_name character varying(255),
    category_en_name character varying(255),
    category_vi_name character varying(255),
    group_number character varying(255)
);


--
-- Name: chart_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_type (
    chart_id character varying(255) NOT NULL,
    chart_ch_name character varying(255),
    chart_en_name character varying(255),
    chart_vi_name character varying(255)
);


--
-- Name: chartoption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chartoption (
    chartoptionid character varying(255) NOT NULL,
    chartoptionchname character varying(255),
    chartoptionenname character varying(255),
    chartoptionviname character varying(255),
    defaultlang character varying(255)
);


--
-- Name: chartseri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chartseri (
    categoryid character varying(255) NOT NULL,
    categorychname character varying(255),
    categoryenname character varying(255),
    categoryviname character varying(255),
    groupnumber character varying(255)
);


--
-- Name: chatboxtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatboxtb (
    id bigint NOT NULL,
    createdtime timestamp without time zone,
    modifiedtime timestamp without time zone,
    name character varying(255),
    status character varying(255),
    stringid character varying(255) NOT NULL,
    visible boolean
);


--
-- Name: chatboxtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.chatboxtb ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.chatboxtb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chatgpttb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chatgpttb (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    message text,
    resmessage text,
    ip character varying,
    country character varying,
    city character varying,
    device character varying,
    browser character varying,
    lat character varying,
    lon character varying,
    isp character varying,
    session character varying,
    "time" timestamp without time zone NOT NULL
);


--
-- Name: chatgpttb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chatgpttb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chatgpttb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chatgpttb_id_seq OWNED BY public.chatgpttb.id;


--
-- Name: chattb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chattb (
    id bigint NOT NULL,
    chatboxid bigint,
    createdtime timestamp without time zone,
    downloadurl character varying(255),
    isfile boolean,
    fileid character varying(255),
    filename character varying(255),
    filestatus character varying(255),
    isimage boolean,
    modifiedtime timestamp without time zone,
    rootmessageid bigint,
    istext boolean,
    username character varying(255),
    isvisible boolean,
    message text,
    downloadthumbnailurl character varying(255)
);


--
-- Name: chattb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.chattb ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.chattb_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clienttb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clienttb (
    id integer NOT NULL,
    clientcode character varying(255) NOT NULL,
    clientname character varying(255),
    clienttaxcode character varying(255),
    clientdescription text,
    clientphone character varying(255),
    clientmail character varying(255),
    clientaddress character varying(255),
    clientmapembeded text,
    clientlangstringid character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL,
    clientbanner text,
    clientlogo text,
    clientbannertext text
);


--
-- Name: clienttb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clienttb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clienttb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clienttb_id_seq OWNED BY public.clienttb.id;


--
-- Name: combo_box_option; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combo_box_option (
    item_id character varying(255) NOT NULL,
    ch_name character varying(255),
    en_name character varying(255),
    vi_name character varying(255),
    default_lang character varying(255)
);


--
-- Name: comboboxoption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comboboxoption (
    itemid character varying(255) NOT NULL,
    chname character varying(255),
    enname character varying(255),
    viname character varying(255),
    defaultlang character varying(255)
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
-- Name: contactmessagetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contactmessagetb (
    id integer NOT NULL,
    username character varying(255),
    msgsendername character varying(255) NOT NULL,
    msgsenderemail character varying(255) NOT NULL,
    msgsubject character varying(255) NOT NULL,
    msgcontent text NOT NULL,
    createdtime timestamp without time zone NOT NULL
);


--
-- Name: contactmessagetb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contactmessagetb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contactmessagetb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contactmessagetb_id_seq OWNED BY public.contactmessagetb.id;


--
-- Name: currency_exchange; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currency_exchange (
    code character varying(255) NOT NULL,
    buy double precision,
    engdes character varying(255),
    sell double precision,
    transfer double precision
);


--
-- Name: currencyexchange; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currencyexchange (
    code character varying(255) NOT NULL,
    buy double precision,
    engdes character varying(255),
    sell double precision,
    transfer double precision
);


--
-- Name: districtandprovincetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.districtandprovincetb (
    id integer NOT NULL,
    provinceid character varying(255),
    provincename character varying(255),
    districtid character varying(255),
    districtname character varying(255),
    language character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: districtandprovincetb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.districtandprovincetb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: districtandprovincetb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.districtandprovincetb_id_seq OWNED BY public.districtandprovincetb.id;


--
-- Name: exporttransactiontb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exporttransactiontb (
    id integer NOT NULL,
    stringid character varying(255),
    warehousesku character varying(255),
    productcode character varying(255),
    exporttransactionbatch character varying(255),
    warehausingusername character varying(255),
    colorcode character varying(255),
    sizecode character varying(255),
    catalog character varying(255),
    brand character varying(255),
    purchasingprice numeric(9,3),
    sellinigunitprice numeric(9,3),
    priceamount numeric(9,3),
    discountpercentage numeric(9,3),
    quantity numeric(9,3),
    note text,
    ordertime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isverified boolean,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: exporttransactiontb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exporttransactiontb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exporttransactiontb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exporttransactiontb_id_seq OWNED BY public.exporttransactiontb.id;


--
-- Name: fileandusertb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fileandusertb (
    id integer NOT NULL,
    filestringid character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    chatboxstringid character varying(255) NOT NULL,
    createdtime timestamp without time zone NOT NULL
);


--
-- Name: fileandusertb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fileandusertb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fileandusertb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fileandusertb_id_seq OWNED BY public.fileandusertb.id;


--
-- Name: filetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.filetb (
    id integer NOT NULL,
    fileid character varying(255) NOT NULL,
    folderidint integer,
    folderid character varying(255),
    username character varying(255) NOT NULL,
    filestatus character varying(255) NOT NULL,
    isfolder boolean NOT NULL,
    filename character varying(255) NOT NULL,
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone NOT NULL,
    downloadurl text
);


--
-- Name: filetb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.filetb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: filetb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.filetb_id_seq OWNED BY public.filetb.id;


--
-- Name: footerblocktb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.footerblocktb (
    id integer NOT NULL,
    stringid character varying(255),
    blockheader text,
    blockbody text,
    langcode character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: footerblocktb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.footerblocktb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: footerblocktb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.footerblocktb_id_seq OWNED BY public.footerblocktb.id;


--
-- Name: forecast; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forecast (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone,
    forecast_date timestamp(6) with time zone,
    quantity double precision,
    material_id uuid,
    company_id uuid NOT NULL
);


--
-- Name: grouptb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grouptb (
    id integer NOT NULL,
    groupkey character varying(255) NOT NULL,
    groupname character varying(255) NOT NULL,
    description text
);


--
-- Name: grouptb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grouptb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grouptb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grouptb_id_seq OWNED BY public.grouptb.id;


--
-- Name: hibernate_sequence; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hibernate_sequence
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: imported_valuetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imported_valuetb (
    id integer NOT NULL,
    aromatic_substances_cosmetics_and_sanitary_products character varying(255),
    automotive_components_and_parts character varying(255),
    camera_cameras_and_components character varying(255),
    car_cars_of_all_kinds character varying(255),
    cars_over_nine_seats character varying(255),
    cashew character varying(255),
    chemistry character varying(255),
    coal character varying(255),
    computers_electronic_products_components character varying(255),
    confectionery_and_cereal_products character varying(255),
    corn character varying(255),
    cotton_types character varying(255),
    crude_oil character varying(255),
    dairy_and_dairy_products character varying(255),
    dap character varying(255),
    exportedac character varying(255),
    fabric character varying(255),
    feces character varying(255),
    feces_sa character varying(255),
    fertilizers_of_all_kinds character varying(255),
    fiber_woven_fibers_of_all_kinds character varying(255),
    flapes_and_animal_grease character varying(255),
    flying_fuel character varying(255),
    fo_oil character varying(255),
    food_and_ingredients character varying(255),
    food_preparation character varying(255),
    gasoline character varying(255),
    gemstones_precious_metals_and_products character varying(255),
    glass_and_glass_products character varying(255),
    household_electric_goods_and_components character varying(255),
    in_foreign_invested_area character varying(255),
    iron_and_steel_scrap character varying(255),
    lpg character varying(255),
    machinery_equipment_tools_spare_parts character varying(255),
    medicine character varying(255),
    metal_is_common character varying(255),
    month character varying(255),
    motorbike_and_components character varying(255),
    nine_seat_car_or_less character varying(255),
    npk_fertilizer character varying(255),
    oil character varying(255),
    ore_and_other_minerals character varying(255),
    other_common_metal_products character varying(255),
    other_goods character varying(255),
    other_means_of_transport_and_spare_parts character varying(255),
    other_products_from_oil character varying(255),
    paper character varying(255),
    pesticides_and_raw_materials character varying(255),
    petroleum_types_of_all_kinds character varying(255),
    pharmaceutical_raw_materials character varying(255),
    phone_of_all_kinds_and_components character varying(255),
    plastic_materials character varying(255),
    potassium character varying(255),
    products_from_chemicals character varying(255),
    products_from_iron_and_steel character varying(255),
    products_from_paper character varying(255),
    products_from_plastic character varying(255),
    products_from_rubber character varying(255),
    quarter character varying(255),
    rubber character varying(255),
    seafood character varying(255),
    soybean character varying(255),
    steels character varying(255),
    textile_garment_leather_and_material_materials character varying(255),
    tobacco_raw_materials character varying(255),
    total character varying(255),
    truck character varying(255),
    vegetable character varying(255),
    wheat character varying(255),
    wires_and_electric_cables character varying(255),
    wood_and_wood_products character varying(255),
    year character varying(255)
);


--
-- Name: importedvaluetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.importedvaluetb (
    id integer NOT NULL,
    month character varying(255),
    year character varying(255),
    quarter character varying(255),
    halfyear character varying(255),
    season character varying(255),
    seasongroup character varying(255),
    exportedac character varying(255),
    total character varying(255),
    inforeigninvestedarea character varying(255),
    seafood character varying(255),
    dairyanddairyproducts character varying(255),
    vegetable character varying(255),
    cashew character varying(255),
    wheat character varying(255),
    corn character varying(255),
    soybean character varying(255),
    flapesandanimalgrease character varying(255),
    confectioneryandcerealproducts character varying(255),
    foodpreparation character varying(255),
    foodandingredients character varying(255),
    tobaccorawmaterials character varying(255),
    oreandotherminerals character varying(255),
    coal character varying(255),
    crudeoil character varying(255),
    petroleumtypesofallkinds character varying(255),
    gasoline character varying(255),
    oil character varying(255),
    fooil character varying(255),
    flyingfuel character varying(255),
    lpg character varying(255),
    otherproductsfromoil character varying(255),
    chemistry character varying(255),
    productsfromchemicals character varying(255),
    pharmaceuticalrawmaterials character varying(255),
    medicine character varying(255),
    fertilizersofallkinds character varying(255),
    feces character varying(255),
    npkfertilizer character varying(255),
    dap character varying(255),
    fecessa character varying(255),
    potassium character varying(255),
    aromaticsubstancescosmeticsandsanitaryproducts character varying(255),
    pesticidesandrawmaterials character varying(255),
    plasticmaterials character varying(255),
    productsfromplastic character varying(255),
    rubber character varying(255),
    productsfromrubber character varying(255),
    woodandwoodproducts character varying(255),
    paper character varying(255),
    productsfrompaper character varying(255),
    cottontypes character varying(255),
    fiberwovenfibersofallkinds character varying(255),
    fabric character varying(255),
    textilegarmentleatherandmaterialmaterials character varying(255),
    glassandglassproducts character varying(255),
    gemstonespreciousmetalsandproducts character varying(255),
    ironandsteelscrap character varying(255),
    steels character varying(255),
    productsfromironandsteel character varying(255),
    metaliscommon character varying(255),
    othercommonmetalproducts character varying(255),
    computerselectronicproductscomponents character varying(255),
    householdelectricgoodsandcomponents character varying(255),
    phoneofallkindsandcomponents character varying(255),
    cameracamerasandcomponents character varying(255),
    machineryequipmenttoolsspareparts character varying(255),
    wiresandelectriccables character varying(255),
    carcarsofallkinds character varying(255),
    nineseatcarorless character varying(255),
    carsovernineseats character varying(255),
    truck character varying(255),
    automotivecomponentsandparts character varying(255),
    motorbikeandcomponents character varying(255),
    othermeansoftransportandspareparts character varying(255),
    othergoods character varying(255)
);


--
-- Name: importedvaluetb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.importedvaluetb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: importedvaluetb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.importedvaluetb_id_seq OWNED BY public.importedvaluetb.id;


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
    warehouse_import_unit character varying(30),
    warehouse_import_quantity numeric(18,6),
    bom_unit_per_warehouse_unit numeric(18,6),
    warehouse_import_unit_price numeric(18,6),
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
-- Name: inventory_movement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movement (
    id integer NOT NULL,
    stringid character varying(255),
    rootid character varying(255),
    productid character varying(255),
    skuid character varying(255),
    positionid character varying(255),
    origintype character varying(255),
    movementtype character varying(255),
    quantity numeric(15,3),
    unit character varying(50),
    unitprice numeric(15,3),
    inventoryqty numeric(15,3),
    depreciationrate numeric(15,5),
    depreciationamount numeric(15,5),
    movementdate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    currency character varying(50),
    mtlcode character varying(255),
    modelquota numeric(15,3),
    bomid character varying(255),
    bomidname character varying(255),
    contractid character varying(255),
    mtlviname text,
    mtlenname text,
    mtlchname text,
    origincountry character varying(255),
    referencetype character varying(255),
    referenceno character varying(255),
    referenceid character varying(255),
    expiredtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    lasteditedbyuser character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: inventory_movement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_movement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_movement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_movement_id_seq OWNED BY public.inventory_movement.id;


--
-- Name: invoicetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoicetb (
    index integer NOT NULL,
    amount double precision,
    description character varying(255),
    hs_code character varying(255),
    import_tax double precision,
    note character varying(255),
    qty double precision,
    unit character varying(255),
    unit_price double precision,
    vat double precision,
    currency character varying(255),
    hscode character varying(255),
    importtax double precision,
    unitprice double precision
);


--
-- Name: invoicetb_index_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoicetb_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoicetb_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoicetb_index_seq OWNED BY public.invoicetb.index;


--
-- Name: language; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.language (
    lang_id character varying(255) NOT NULL,
    lang_name character varying(255),
    sequence integer NOT NULL,
    langid character varying(255) NOT NULL,
    langname character varying(255)
);


--
-- Name: logtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logtb (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    action text NOT NULL,
    value text,
    "time" timestamp without time zone NOT NULL,
    ip character varying,
    country character varying,
    city character varying,
    device character varying,
    browser character varying,
    session character varying,
    lat character varying,
    lon character varying,
    isp character varying,
    visible boolean
);


--
-- Name: logtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logtb_id_seq OWNED BY public.logtb.id;


--
-- Name: material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_code character varying(50) NOT NULL,
    material_name text NOT NULL,
    unit character varying(20) NOT NULL,
    material_type character varying(30) NOT NULL,
    thumbnail_url text,
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
-- Name: material_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_price (
    id uuid DEFAULT public.uuid_v7() NOT NULL,
    material_id uuid NOT NULL,
    price numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'VND'::character varying,
    valid_from date NOT NULL,
    valid_to date,
    source character varying(30),
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: materialtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materialtb (
    id integer NOT NULL,
    rootid integer,
    mtlsystemid character varying(255),
    mtlidname character varying(255),
    username character varying(255) NOT NULL,
    contractid character varying(255) NOT NULL,
    releasedlistid integer,
    releasedlistidname text,
    modeltextid character varying(255),
    importedqty numeric,
    domesticalqty numeric,
    importusedqty numeric,
    domesticusedqty numeric,
    importinventoryqty numeric,
    domesticinventoryqty numeric,
    modelquota numeric,
    unitprice numeric,
    unit character varying(255),
    hscode character varying(255),
    currency character varying(255),
    mtlcode character varying(255),
    mtlviname character varying(255),
    mtlenname character varying(255),
    mtlchname character varying(255),
    mtlimage text,
    origintype character varying(255),
    origincountry character varying(255),
    xformno character varying(255),
    purchaseno character varying(255),
    purchasedatetime timestamp without time zone,
    cdsno character varying(255),
    cdsdatetime timestamp without time zone,
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone NOT NULL,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL
);


--
-- Name: materialtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.materialtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: materialtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.materialtb_id_seq OWNED BY public.materialtb.id;


--
-- Name: mediatb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mediatb (
    id integer NOT NULL,
    createdtime timestamp without time zone,
    downloadurl character varying(255),
    fileid character varying(255),
    filename character varying(255),
    filestatus character varying(255),
    folderid character varying(255),
    folderidint integer,
    isfolder boolean,
    modifiedtime timestamp without time zone,
    username character varying(255),
    filesize numeric DEFAULT 0,
    originalurl character varying(255) DEFAULT 'none'::character varying,
    oriwidth integer DEFAULT 0,
    oriheight integer DEFAULT 0
);


--
-- Name: menutb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menutb (
    id integer NOT NULL,
    menustringid text,
    menurootstringid text,
    menuname character varying(255),
    path text,
    language character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean,
    index character varying(255) DEFAULT '0'::character varying,
    external character varying(255) DEFAULT 'local'::character varying
);


--
-- Name: menutb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menutb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menutb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menutb_id_seq OWNED BY public.menutb.id;


--
-- Name: messagestatustb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messagestatustb (
    id integer NOT NULL,
    ownerusername character varying(255) NOT NULL,
    username character varying(255) NOT NULL,
    statusid integer NOT NULL,
    messageid integer NOT NULL,
    statuskey character varying(255) NOT NULL,
    statusname character varying(255) NOT NULL,
    modifiedtime timestamp without time zone NOT NULL
);


--
-- Name: messagestatustb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messagestatustb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messagestatustb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messagestatustb_id_seq OWNED BY public.messagestatustb.id;


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
-- Name: modelandmtltb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modelandmtltb (
    id integer NOT NULL,
    modelid integer NOT NULL,
    mtlid integer NOT NULL,
    materialidname character varying(255) NOT NULL,
    materialname character varying(255) NOT NULL,
    index integer,
    quota numeric,
    unit character varying(255),
    visible boolean NOT NULL
);


--
-- Name: modelandmtltb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modelandmtltb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modelandmtltb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modelandmtltb_id_seq OWNED BY public.modelandmtltb.id;


--
-- Name: modeltb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modeltb (
    id integer NOT NULL,
    modelidname character varying(255),
    username character varying(255) NOT NULL,
    modelname character varying(255),
    hscode character varying(255),
    cocriteria character varying(255),
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone NOT NULL,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL
);


--
-- Name: modeltb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modeltb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modeltb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modeltb_id_seq OWNED BY public.modeltb.id;


--
-- Name: orderinventorytb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderinventorytb (
    id integer NOT NULL,
    stringid character varying(255),
    warehousesku character varying(255),
    productcode character varying(255),
    importbatchid character varying(255),
    importusername character varying(255),
    colorcode character varying(255),
    sizecode character varying(255),
    catalog character varying(255),
    brand character varying(255),
    purchasingprice numeric(9,3),
    basesellingprice numeric(9,3),
    sellinigunitprice numeric(9,3),
    priceamount numeric(9,3),
    discountpercentage numeric(9,3),
    quantity numeric(9,3),
    missingqty numeric(9,3),
    note text,
    language character varying(255),
    ordertime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    productiondate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    bestusedbeforedate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expireddate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isverified boolean,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: orderinventorytb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orderinventorytb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orderinventorytb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orderinventorytb_id_seq OWNED BY public.orderinventorytb.id;


--
-- Name: orderitemtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderitemtb (
    id integer NOT NULL,
    stringid character varying(255),
    orderstringid character varying(255),
    warehousesku character varying(255),
    exporttransactionbatch character varying(255),
    productcode character varying(255),
    customerusername character varying(255),
    colorcode character varying(255),
    sizecode character varying(255),
    catalog character varying(255),
    brand character varying(255),
    note text,
    status character varying(255),
    unitprice numeric(15,3),
    quantity numeric(15,3),
    priceamount numeric(15,3),
    discountpercentage numeric(9,3),
    discountamount numeric(15,3),
    ordertime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean,
    itemimg text DEFAULT 'none'::text
);


--
-- Name: orderitemtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orderitemtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orderitemtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orderitemtb_id_seq OWNED BY public.orderitemtb.id;


--
-- Name: orderstatustb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderstatustb (
    id integer NOT NULL,
    orderstatus character varying(255),
    orderstatusname character varying(255),
    vi character varying(255),
    eng character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: orderstatustb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orderstatustb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orderstatustb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orderstatustb_id_seq OWNED BY public.orderstatustb.id;


--
-- Name: ordertb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordertb (
    id integer NOT NULL,
    stringid character varying(255),
    customerusername character varying(255),
    shippingdestid character varying(255),
    orderstatus character varying(255),
    verificationcode character varying(255),
    note text,
    priceamount numeric(15,3),
    discountamount numeric(15,3),
    quantity numeric(15,3),
    language character varying(255),
    ordertime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verifiedbefore timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isverified boolean,
    isapproved boolean,
    islocked boolean,
    isvisible boolean,
    customeremail character varying(255) DEFAULT 'none'::character varying,
    finalshipingaddressid character varying(255) DEFAULT 'none'::character varying,
    finalcustomername character varying(255) DEFAULT 'none'::character varying
);


--
-- Name: ordertb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordertb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordertb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordertb_id_seq OWNED BY public.ordertb.id;


--
-- Name: partnertb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partnertb (
    id integer NOT NULL,
    stringid character varying(255),
    partnername character varying(255),
    partnerlogo text,
    langcode character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: partnertb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partnertb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partnertb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partnertb_id_seq OWNED BY public.partnertb.id;


--
-- Name: policyfiletb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policyfiletb (
    id integer NOT NULL,
    fileid character varying(255) NOT NULL,
    folderidint integer,
    folderid character varying(255),
    username character varying(255) NOT NULL,
    filestatus character varying(255) NOT NULL,
    isfolder boolean NOT NULL,
    filename character varying(255) NOT NULL,
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone NOT NULL,
    downloadurl text,
    istrashed boolean,
    filecategory character varying(255),
    thumbnailurl character varying(255),
    thumbnailwidth integer,
    thumbnailheight integer
);


--
-- Name: policyfiletb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.policyfiletb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: policyfiletb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.policyfiletb_id_seq OWNED BY public.policyfiletb.id;


--
-- Name: productbrandtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productbrandtb (
    id integer NOT NULL,
    brandname character varying(255),
    brandcode character varying(255),
    brandshortdes character varying(255),
    brandlongdes text,
    brandimageurl1 text,
    brandimagedesurl text,
    brandvideoadd text,
    language character varying(255),
    path text,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL
);


--
-- Name: productbrandtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productbrandtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productbrandtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productbrandtb_id_seq OWNED BY public.productbrandtb.id;


--
-- Name: productcatalogtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productcatalogtb (
    id integer NOT NULL,
    catalogname character varying(255),
    catalogcode character varying(255),
    catalogshortdes character varying(255),
    cataloglongdes text,
    catalogimageurl1 text,
    catalogimagedesurl text,
    catalogvideoadd text,
    language character varying(255),
    path text,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL,
    catalogindex integer DEFAULT 32000
);


--
-- Name: productcatalogtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productcatalogtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productcatalogtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productcatalogtb_id_seq OWNED BY public.productcatalogtb.id;


--
-- Name: productcolortb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productcolortb (
    id integer NOT NULL,
    colorname character varying(255),
    colorcode character varying(255),
    productcode character varying(255),
    colorshortdes text,
    colorlongdes text,
    colorimageurl1 text,
    colorimagedesurl text,
    colorvideoadd text,
    language character varying(255),
    path text,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: productcolortb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productcolortb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productcolortb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productcolortb_id_seq OWNED BY public.productcolortb.id;


--
-- Name: productgroupitemtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productgroupitemtb (
    id integer NOT NULL,
    stringid character varying(255),
    productgroupitemcode character varying(255),
    productgroupitemname character varying(255),
    productcode character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: productgroupitemtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productgroupitemtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productgroupitemtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productgroupitemtb_id_seq OWNED BY public.productgroupitemtb.id;


--
-- Name: productgrouptb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productgrouptb (
    id integer NOT NULL,
    stringid character varying(255),
    productgroupcode character varying(255),
    productgroupname character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: productgrouptb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productgrouptb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productgrouptb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productgrouptb_id_seq OWNED BY public.productgrouptb.id;


--
-- Name: producthtmltb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producthtmltb (
    id integer NOT NULL,
    stringid character varying(255),
    producthtmlcode character varying(255),
    productcode character varying(255),
    producthtmlusingid character varying(255),
    index character varying(255),
    producthtmlgroup character varying(255),
    producthtmldescription text,
    producthtmlcontent text,
    langcode character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: producthtmltb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producthtmltb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producthtmltb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producthtmltb_id_seq OWNED BY public.producthtmltb.id;


--
-- Name: productpricetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productpricetb (
    id integer NOT NULL,
    pricename character varying(255),
    pricecode character varying(255),
    productcode character varying(255),
    sizecode character varying(255),
    colorcode character varying(255),
    priceshortdes text,
    priceamount numeric(15,3),
    discountamount numeric(15,3),
    pricetype text,
    language character varying(255),
    path text,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean,
    productcatalog character varying(255),
    productbrand character varying(255),
    priceimage text,
    pricediscountpercentage numeric(3,0) DEFAULT 0
);


--
-- Name: productpricetb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productpricetb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productpricetb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productpricetb_id_seq OWNED BY public.productpricetb.id;


--
-- Name: productsizetb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productsizetb (
    id integer NOT NULL,
    sizename character varying(255),
    sizecode character varying(255),
    productcode character varying(255),
    sizeshortdes text,
    sizelongdes text,
    sizeimageurl1 text,
    sizeimagedesurl text,
    sizevideoadd text,
    language character varying(255),
    path text,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: productsizetb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.productsizetb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: productsizetb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.productsizetb_id_seq OWNED BY public.productsizetb.id;


--
-- Name: producttagitemtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producttagitemtb (
    id integer NOT NULL,
    stringid character varying(255),
    producttagitemcode character varying(255),
    producttagitemname character varying(255),
    productcode character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: producttagitemtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producttagitemtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producttagitemtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producttagitemtb_id_seq OWNED BY public.producttagitemtb.id;


--
-- Name: producttagtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producttagtb (
    id integer NOT NULL,
    stringid character varying(255),
    producttagcode character varying(255),
    producttagname character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: producttagtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producttagtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producttagtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producttagtb_id_seq OWNED BY public.producttagtb.id;


--
-- Name: producttb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producttb (
    id integer NOT NULL,
    productname character varying(255),
    productcode character varying(255),
    productcatalog character varying(255),
    productshortdes text,
    productlongdes text,
    productstatus character varying(255),
    productimageurl1 text,
    productimageurl2 text,
    productimagedesurl text,
    productvideoadd text,
    productpriceamount numeric(15,3),
    productdiscont numeric(4,2),
    productpricecurrency character varying(255),
    language character varying(255),
    path text,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL,
    productsubcatalog character varying(255),
    pagekeyword text,
    isnew boolean,
    productbrand character varying(255),
    productgroupstring text DEFAULT 'none'::text
);


--
-- Name: producttb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.producttb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: producttb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.producttb_id_seq OWNED BY public.producttb.id;


--
-- Name: purchase_invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoice (
    id integer NOT NULL,
    stringid character varying(255),
    supplierid character varying(255),
    invoiceno character varying(50),
    vat character varying(50),
    invoicedate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    hscode character varying(50),
    sequencenumber character varying(50),
    description text,
    unit character varying(50),
    unitprice numeric(15,3),
    qty numeric(15,3),
    currency character varying(50),
    amount numeric(15,3),
    note text,
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: purchase_invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_invoice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_invoice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_invoice_id_seq OWNED BY public.purchase_invoice.id;


--
-- Name: quotationtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotationtb (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    actiontype character varying(255) NOT NULL,
    quota integer NOT NULL
);


--
-- Name: quotationtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quotationtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotationtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quotationtb_id_seq OWNED BY public.quotationtb.id;


--
-- Name: realtaxitemtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.realtaxitemtb (
    id integer NOT NULL,
    hscode character varying(255) NOT NULL,
    vndescription text NOT NULL
);


--
-- Name: realtaxitemtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.realtaxitemtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: realtaxitemtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.realtaxitemtb_id_seq OWNED BY public.realtaxitemtb.id;


--
-- Name: releasedlisttb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.releasedlisttb (
    id integer NOT NULL,
    releaselistidname character varying(255),
    username character varying(255) NOT NULL,
    taxid character varying(255),
    qty numeric,
    value numeric,
    hscode character varying(255),
    modelid integer,
    modelidname character varying(255),
    modelname character varying(255),
    cocriteria character varying(255),
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone NOT NULL,
    isvisible boolean NOT NULL,
    isapproved boolean NOT NULL,
    islocked boolean NOT NULL
);


--
-- Name: releasedlisttb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.releasedlisttb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: releasedlisttb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.releasedlisttb_id_seq OWNED BY public.releasedlisttb.id;


--
-- Name: shippinginfotb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shippinginfotb (
    id integer NOT NULL,
    stringid text,
    username character varying(255),
    address text,
    district text,
    city text,
    note text,
    language character varying(255),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean,
    phone character varying(255) DEFAULT 'none'::character varying,
    zipcode character varying(255) DEFAULT 'none'::character varying,
    email character varying(255) DEFAULT 'none'::character varying,
    shippingprice numeric(15,3) DEFAULT 0
);


--
-- Name: shippinginfotb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shippinginfotb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shippinginfotb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shippinginfotb_id_seq OWNED BY public.shippinginfotb.id;


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
-- Name: tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone,
    tenant_code character varying(100) NOT NULL,
    tenant_name text NOT NULL,
    tenant_type character varying(50),
    is_active boolean NOT NULL
);


--
-- Name: ticket_and_usertb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_and_usertb (
    id integer NOT NULL,
    ticketid integer,
    userid integer
);


--
-- Name: ticket_categorytb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_categorytb (
    id integer NOT NULL,
    description character varying(255),
    ticket_category_key character varying(255) NOT NULL,
    ticket_category_name character varying(255) NOT NULL
);


--
-- Name: ticket_statustb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_statustb (
    id integer NOT NULL,
    description character varying(255),
    ticket_status_key character varying(255) NOT NULL,
    ticket_status_name character varying(255) NOT NULL
);


--
-- Name: ticket_tb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_tb (
    id integer NOT NULL,
    assignee_id integer NOT NULL,
    created_time timestamp without time zone NOT NULL,
    due_time timestamp without time zone NOT NULL,
    created_date timestamp without time zone NOT NULL,
    owner_id integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    ticket_category integer NOT NULL,
    ticket_content character varying(255),
    ticket_key character varying(255),
    ticket_order character varying(255),
    ticket_status_id integer NOT NULL,
    ticket_title character varying(255),
    visibility character varying(255) NOT NULL,
    workflow_id integer
);


--
-- Name: ticketandusertb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticketandusertb (
    id integer NOT NULL,
    ticketid integer NOT NULL,
    userid integer NOT NULL,
    username character varying(255),
    ticketstringid character varying(255)
);


--
-- Name: ticketandusertb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticketandusertb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticketandusertb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticketandusertb_id_seq OWNED BY public.ticketandusertb.id;


--
-- Name: ticketcategorytb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticketcategorytb (
    id integer NOT NULL,
    ticketcategorykey character varying(255) NOT NULL,
    ticketcategoryname character varying(255) NOT NULL,
    description text
);


--
-- Name: ticketcategorytb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticketcategorytb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticketcategorytb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticketcategorytb_id_seq OWNED BY public.ticketcategorytb.id;


--
-- Name: ticketstatustb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticketstatustb (
    id integer NOT NULL,
    ticketstatuskey character varying(255) NOT NULL,
    ticketstatusname character varying(255) NOT NULL,
    description text
);


--
-- Name: ticketstatustb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticketstatustb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticketstatustb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticketstatustb_id_seq OWNED BY public.ticketstatustb.id;


--
-- Name: tickettb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickettb (
    id integer NOT NULL,
    ticketkey character varying(255) NOT NULL,
    tickettitle character varying(255) NOT NULL,
    ticketcontent text NOT NULL,
    ticketcategoryid integer NOT NULL,
    ticketstatusid integer NOT NULL,
    ownerid integer NOT NULL,
    assigneeid integer NOT NULL,
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone,
    starttime timestamp without time zone NOT NULL,
    duetime timestamp without time zone NOT NULL,
    visibility character varying(255) NOT NULL,
    ticketorder character varying,
    workflowid integer,
    estimateworkinghours numeric(7,3),
    realworkinghours numeric(7,3),
    ticketpoint numeric(7,3),
    istask boolean,
    workflowstringid character varying(255),
    stringid character varying(255),
    ownerusername character varying(255),
    assigneeusername character varying(255)
);


--
-- Name: tickettb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickettb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickettb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickettb_id_seq OWNED BY public.tickettb.id;


--
-- Name: user_feedbacktb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_feedbacktb (
    id integer NOT NULL,
    content character varying(255) NOT NULL,
    feedback_time timestamp without time zone NOT NULL,
    ticket_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: userconversationtb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.userconversationtb (
    id integer NOT NULL,
    chatboxid integer NOT NULL,
    userid integer NOT NULL,
    description text,
    createdtime timestamp without time zone NOT NULL,
    modifiedtime timestamp without time zone NOT NULL,
    username character varying(255),
    chatboxstringid character varying(255),
    visible boolean NOT NULL
);


--
-- Name: userconversationtb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.userconversationtb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: userconversationtb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.userconversationtb_id_seq OWNED BY public.userconversationtb.id;


--
-- Name: userfeedbacktb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.userfeedbacktb (
    id integer NOT NULL,
    ticketid integer NOT NULL,
    userid integer NOT NULL,
    feedbacktime timestamp without time zone,
    modifiedtime timestamp without time zone,
    content character varying(255) NOT NULL
);


--
-- Name: userfeedbacktb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.userfeedbacktb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: userfeedbacktb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.userfeedbacktb_id_seq OWNED BY public.userfeedbacktb.id;


--
-- Name: usergrouptb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usergrouptb (
    id integer NOT NULL,
    groupid integer NOT NULL,
    userid integer NOT NULL
);


--
-- Name: usergrouptb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usergrouptb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usergrouptb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usergrouptb_id_seq OWNED BY public.usergrouptb.id;


--
-- Name: usertb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usertb (
    id integer NOT NULL,
    username character varying(255) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    isaccountnonexpired boolean NOT NULL,
    isaccountnonlocked boolean NOT NULL,
    iscredentialsnonexpired boolean NOT NULL,
    isenabled boolean NOT NULL,
    validationcode character varying(255),
    expiredtime time without time zone,
    first_name character varying(255),
    is_account_non_expired boolean,
    last_name character varying(255),
    validation_code character varying(255),
    leaderid integer,
    description character varying(255),
    mailquota integer,
    isallowmarketing boolean,
    is_allow_marketing boolean,
    titleandhornorific character varying(255),
    title_and_honorific character varying(255),
    titleandhonorific character varying(255),
    uploadquota integer,
    avatar character varying(255),
    avarta character varying(255),
    phonenumber character varying(255) DEFAULT 'none'::character varying,
    createdtime timestamp without time zone DEFAULT '2025-01-01 00:00:00'::timestamp without time zone,
    created_time timestamp(6) without time zone,
    phone_number character varying(255)
);


--
-- Name: usertb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usertb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usertb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usertb_id_seq OWNED BY public.usertb.id;


--
-- Name: usertb_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usertb_seq
    START WITH 1
    INCREMENT BY 50
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


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
-- Name: warehousecelltb; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehousecelltb (
    id integer NOT NULL,
    stringid character varying(255),
    cellid character varying(50),
    warehouseid character varying(50),
    warehousename character varying(255),
    warehousetype character varying(255),
    location character varying(255),
    description text,
    block character varying(50),
    line character varying(50),
    horizontalrack character varying(50),
    verticalstack character varying(50),
    createdtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modifiedtime timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    isapproved boolean,
    islocked boolean,
    isvisible boolean
);


--
-- Name: warehousecelltb_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warehousecelltb_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warehousecelltb_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warehousecelltb_id_seq OWNED BY public.warehousecelltb.id;


--
-- Name: articletb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articletb ALTER COLUMN id SET DEFAULT nextval('public.articletb_id_seq'::regclass);


--
-- Name: authorities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authorities ALTER COLUMN id SET DEFAULT nextval('public.authorities_id_seq'::regclass);


--
-- Name: bieuthuetb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bieuthuetb ALTER COLUMN id SET DEFAULT nextval('public.bieuthuetb_id_seq'::regclass);


--
-- Name: bomandmtltb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bomandmtltb ALTER COLUMN id SET DEFAULT nextval('public.bomandmtltb_id_seq'::regclass);


--
-- Name: cdsitemtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cdsitemtb ALTER COLUMN id SET DEFAULT nextval('public.cdsitemtb_id_seq'::regclass);


--
-- Name: chatgpttb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatgpttb ALTER COLUMN id SET DEFAULT nextval('public.chatgpttb_id_seq'::regclass);


--
-- Name: clienttb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clienttb ALTER COLUMN id SET DEFAULT nextval('public.clienttb_id_seq'::regclass);


--
-- Name: contactmessagetb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactmessagetb ALTER COLUMN id SET DEFAULT nextval('public.contactmessagetb_id_seq'::regclass);


--
-- Name: districtandprovincetb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districtandprovincetb ALTER COLUMN id SET DEFAULT nextval('public.districtandprovincetb_id_seq'::regclass);


--
-- Name: exporttransactiontb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exporttransactiontb ALTER COLUMN id SET DEFAULT nextval('public.exporttransactiontb_id_seq'::regclass);


--
-- Name: fileandusertb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fileandusertb ALTER COLUMN id SET DEFAULT nextval('public.fileandusertb_id_seq'::regclass);


--
-- Name: filetb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filetb ALTER COLUMN id SET DEFAULT nextval('public.filetb_id_seq'::regclass);


--
-- Name: footerblocktb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.footerblocktb ALTER COLUMN id SET DEFAULT nextval('public.footerblocktb_id_seq'::regclass);


--
-- Name: grouptb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grouptb ALTER COLUMN id SET DEFAULT nextval('public.grouptb_id_seq'::regclass);


--
-- Name: importedvaluetb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importedvaluetb ALTER COLUMN id SET DEFAULT nextval('public.importedvaluetb_id_seq'::regclass);


--
-- Name: inventory_movement id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement ALTER COLUMN id SET DEFAULT nextval('public.inventory_movement_id_seq'::regclass);


--
-- Name: invoicetb index; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoicetb ALTER COLUMN index SET DEFAULT nextval('public.invoicetb_index_seq'::regclass);


--
-- Name: logtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logtb ALTER COLUMN id SET DEFAULT nextval('public.logtb_id_seq'::regclass);


--
-- Name: materialtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materialtb ALTER COLUMN id SET DEFAULT nextval('public.materialtb_id_seq'::regclass);


--
-- Name: menutb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menutb ALTER COLUMN id SET DEFAULT nextval('public.menutb_id_seq'::regclass);


--
-- Name: messagestatustb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messagestatustb ALTER COLUMN id SET DEFAULT nextval('public.messagestatustb_id_seq'::regclass);


--
-- Name: modelandmtltb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelandmtltb ALTER COLUMN id SET DEFAULT nextval('public.modelandmtltb_id_seq'::regclass);


--
-- Name: modeltb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modeltb ALTER COLUMN id SET DEFAULT nextval('public.modeltb_id_seq'::regclass);


--
-- Name: orderinventorytb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderinventorytb ALTER COLUMN id SET DEFAULT nextval('public.orderinventorytb_id_seq'::regclass);


--
-- Name: orderitemtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitemtb ALTER COLUMN id SET DEFAULT nextval('public.orderitemtb_id_seq'::regclass);


--
-- Name: orderstatustb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderstatustb ALTER COLUMN id SET DEFAULT nextval('public.orderstatustb_id_seq'::regclass);


--
-- Name: ordertb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordertb ALTER COLUMN id SET DEFAULT nextval('public.ordertb_id_seq'::regclass);


--
-- Name: partnertb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partnertb ALTER COLUMN id SET DEFAULT nextval('public.partnertb_id_seq'::regclass);


--
-- Name: policyfiletb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policyfiletb ALTER COLUMN id SET DEFAULT nextval('public.policyfiletb_id_seq'::regclass);


--
-- Name: productbrandtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productbrandtb ALTER COLUMN id SET DEFAULT nextval('public.productbrandtb_id_seq'::regclass);


--
-- Name: productcatalogtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productcatalogtb ALTER COLUMN id SET DEFAULT nextval('public.productcatalogtb_id_seq'::regclass);


--
-- Name: productcolortb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productcolortb ALTER COLUMN id SET DEFAULT nextval('public.productcolortb_id_seq'::regclass);


--
-- Name: productgroupitemtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productgroupitemtb ALTER COLUMN id SET DEFAULT nextval('public.productgroupitemtb_id_seq'::regclass);


--
-- Name: productgrouptb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productgrouptb ALTER COLUMN id SET DEFAULT nextval('public.productgrouptb_id_seq'::regclass);


--
-- Name: producthtmltb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producthtmltb ALTER COLUMN id SET DEFAULT nextval('public.producthtmltb_id_seq'::regclass);


--
-- Name: productpricetb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productpricetb ALTER COLUMN id SET DEFAULT nextval('public.productpricetb_id_seq'::regclass);


--
-- Name: productsizetb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productsizetb ALTER COLUMN id SET DEFAULT nextval('public.productsizetb_id_seq'::regclass);


--
-- Name: producttagitemtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producttagitemtb ALTER COLUMN id SET DEFAULT nextval('public.producttagitemtb_id_seq'::regclass);


--
-- Name: producttagtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producttagtb ALTER COLUMN id SET DEFAULT nextval('public.producttagtb_id_seq'::regclass);


--
-- Name: producttb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producttb ALTER COLUMN id SET DEFAULT nextval('public.producttb_id_seq'::regclass);


--
-- Name: purchase_invoice id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice ALTER COLUMN id SET DEFAULT nextval('public.purchase_invoice_id_seq'::regclass);


--
-- Name: quotationtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotationtb ALTER COLUMN id SET DEFAULT nextval('public.quotationtb_id_seq'::regclass);


--
-- Name: realtaxitemtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realtaxitemtb ALTER COLUMN id SET DEFAULT nextval('public.realtaxitemtb_id_seq'::regclass);


--
-- Name: releasedlisttb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releasedlisttb ALTER COLUMN id SET DEFAULT nextval('public.releasedlisttb_id_seq'::regclass);


--
-- Name: shippinginfotb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shippinginfotb ALTER COLUMN id SET DEFAULT nextval('public.shippinginfotb_id_seq'::regclass);


--
-- Name: ticketandusertb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketandusertb ALTER COLUMN id SET DEFAULT nextval('public.ticketandusertb_id_seq'::regclass);


--
-- Name: ticketcategorytb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketcategorytb ALTER COLUMN id SET DEFAULT nextval('public.ticketcategorytb_id_seq'::regclass);


--
-- Name: ticketstatustb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketstatustb ALTER COLUMN id SET DEFAULT nextval('public.ticketstatustb_id_seq'::regclass);


--
-- Name: tickettb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickettb ALTER COLUMN id SET DEFAULT nextval('public.tickettb_id_seq'::regclass);


--
-- Name: userconversationtb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userconversationtb ALTER COLUMN id SET DEFAULT nextval('public.userconversationtb_id_seq'::regclass);


--
-- Name: userfeedbacktb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userfeedbacktb ALTER COLUMN id SET DEFAULT nextval('public.userfeedbacktb_id_seq'::regclass);


--
-- Name: usergrouptb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usergrouptb ALTER COLUMN id SET DEFAULT nextval('public.usergrouptb_id_seq'::regclass);


--
-- Name: usertb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usertb ALTER COLUMN id SET DEFAULT nextval('public.usertb_id_seq'::regclass);


--
-- Name: warehousecelltb id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehousecelltb ALTER COLUMN id SET DEFAULT nextval('public.warehousecelltb_id_seq'::regclass);


--
-- Name: articletb articletb_articlelink_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articletb
    ADD CONSTRAINT articletb_articlelink_key UNIQUE (articlelink);


--
-- Name: articletb articletb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articletb
    ADD CONSTRAINT articletb_pkey PRIMARY KEY (id);


--
-- Name: authorities authorities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authorities
    ADD CONSTRAINT authorities_pkey PRIMARY KEY (id);


--
-- Name: bieuthuetb bieuthuetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bieuthuetb
    ADD CONSTRAINT bieuthuetb_pkey PRIMARY KEY (id);


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
-- Name: bomandmtltb bomandmtltb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bomandmtltb
    ADD CONSTRAINT bomandmtltb_pkey PRIMARY KEY (id);


--
-- Name: cdsitemtb cdsitemtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cdsitemtb
    ADD CONSTRAINT cdsitemtb_pkey PRIMARY KEY (id);


--
-- Name: chart_option chart_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_option
    ADD CONSTRAINT chart_option_pkey PRIMARY KEY (chart_option_id);


--
-- Name: chart_seri chart_seri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_seri
    ADD CONSTRAINT chart_seri_pkey PRIMARY KEY (category_id);


--
-- Name: chart_type chart_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_type
    ADD CONSTRAINT chart_type_pkey PRIMARY KEY (chart_id);


--
-- Name: chartoption chartoption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chartoption
    ADD CONSTRAINT chartoption_pkey PRIMARY KEY (chartoptionid);


--
-- Name: chartseri chartseri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chartseri
    ADD CONSTRAINT chartseri_pkey PRIMARY KEY (categoryid);


--
-- Name: chatboxtb chatboxtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatboxtb
    ADD CONSTRAINT chatboxtb_pkey PRIMARY KEY (id);


--
-- Name: chatgpttb chatgpttb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatgpttb
    ADD CONSTRAINT chatgpttb_pkey PRIMARY KEY (id);


--
-- Name: chattb chattb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chattb
    ADD CONSTRAINT chattb_pkey PRIMARY KEY (id);


--
-- Name: clienttb clienttb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clienttb
    ADD CONSTRAINT clienttb_pkey PRIMARY KEY (id);


--
-- Name: combo_box_option combo_box_option_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_box_option
    ADD CONSTRAINT combo_box_option_pkey PRIMARY KEY (item_id);


--
-- Name: comboboxoption comboboxoption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comboboxoption
    ADD CONSTRAINT comboboxoption_pkey PRIMARY KEY (itemid);


--
-- Name: company company_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company
    ADD CONSTRAINT company_pkey PRIMARY KEY (id);


--
-- Name: contactmessagetb contactmessagetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contactmessagetb
    ADD CONSTRAINT contactmessagetb_pkey PRIMARY KEY (id);


--
-- Name: currency_exchange currency_exchange_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency_exchange
    ADD CONSTRAINT currency_exchange_pkey PRIMARY KEY (code);


--
-- Name: currencyexchange currencyexchange_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currencyexchange
    ADD CONSTRAINT currencyexchange_pkey PRIMARY KEY (code);


--
-- Name: districtandprovincetb districtandprovincetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.districtandprovincetb
    ADD CONSTRAINT districtandprovincetb_pkey PRIMARY KEY (id);


--
-- Name: exporttransactiontb exporttransactiontb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exporttransactiontb
    ADD CONSTRAINT exporttransactiontb_pkey PRIMARY KEY (id);


--
-- Name: fileandusertb fileandusertb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fileandusertb
    ADD CONSTRAINT fileandusertb_pkey PRIMARY KEY (id);


--
-- Name: filetb filetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filetb
    ADD CONSTRAINT filetb_pkey PRIMARY KEY (id);


--
-- Name: footerblocktb footerblocktb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.footerblocktb
    ADD CONSTRAINT footerblocktb_pkey PRIMARY KEY (id);


--
-- Name: forecast forecast_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast
    ADD CONSTRAINT forecast_pkey PRIMARY KEY (id);


--
-- Name: grouptb grouptb_groupkey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grouptb
    ADD CONSTRAINT grouptb_groupkey_key UNIQUE (groupkey);


--
-- Name: grouptb grouptb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grouptb
    ADD CONSTRAINT grouptb_pkey PRIMARY KEY (id);


--
-- Name: imported_valuetb imported_valuetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_valuetb
    ADD CONSTRAINT imported_valuetb_pkey PRIMARY KEY (id);


--
-- Name: importedvaluetb importedvaluetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.importedvaluetb
    ADD CONSTRAINT importedvaluetb_pkey PRIMARY KEY (id);


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
-- Name: inventory_movement inventory_movement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT inventory_movement_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: invoicetb invoicetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoicetb
    ADD CONSTRAINT invoicetb_pkey PRIMARY KEY (index);


--
-- Name: language language_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.language
    ADD CONSTRAINT language_pkey PRIMARY KEY (lang_id);


--
-- Name: logtb logtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logtb
    ADD CONSTRAINT logtb_pkey PRIMARY KEY (id);


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
-- Name: material_price material_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price
    ADD CONSTRAINT material_price_pkey PRIMARY KEY (id);


--
-- Name: materialtb materialtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materialtb
    ADD CONSTRAINT materialtb_pkey PRIMARY KEY (id);


--
-- Name: mediatb mediatb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mediatb
    ADD CONSTRAINT mediatb_pkey PRIMARY KEY (id);


--
-- Name: menutb menutb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menutb
    ADD CONSTRAINT menutb_pkey PRIMARY KEY (id);


--
-- Name: messagestatustb messagestatustb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messagestatustb
    ADD CONSTRAINT messagestatustb_pkey PRIMARY KEY (id);


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
-- Name: modelandmtltb modelandmtltb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modelandmtltb
    ADD CONSTRAINT modelandmtltb_pkey PRIMARY KEY (id);


--
-- Name: modeltb modeltb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modeltb
    ADD CONSTRAINT modeltb_pkey PRIMARY KEY (id);


--
-- Name: orderinventorytb orderinventorytb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderinventorytb
    ADD CONSTRAINT orderinventorytb_pkey PRIMARY KEY (id);


--
-- Name: orderitemtb orderitemtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitemtb
    ADD CONSTRAINT orderitemtb_pkey PRIMARY KEY (id);


--
-- Name: orderstatustb orderstatustb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderstatustb
    ADD CONSTRAINT orderstatustb_pkey PRIMARY KEY (id);


--
-- Name: ordertb ordertb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordertb
    ADD CONSTRAINT ordertb_pkey PRIMARY KEY (id);


--
-- Name: partnertb partnertb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partnertb
    ADD CONSTRAINT partnertb_pkey PRIMARY KEY (id);


--
-- Name: policyfiletb policyfiletb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policyfiletb
    ADD CONSTRAINT policyfiletb_pkey PRIMARY KEY (id);


--
-- Name: productbrandtb productbrandtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productbrandtb
    ADD CONSTRAINT productbrandtb_pkey PRIMARY KEY (id);


--
-- Name: productcatalogtb productcatalogtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productcatalogtb
    ADD CONSTRAINT productcatalogtb_pkey PRIMARY KEY (id);


--
-- Name: productcolortb productcolortb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productcolortb
    ADD CONSTRAINT productcolortb_pkey PRIMARY KEY (id);


--
-- Name: productgroupitemtb productgroupitemtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productgroupitemtb
    ADD CONSTRAINT productgroupitemtb_pkey PRIMARY KEY (id);


--
-- Name: productgrouptb productgrouptb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productgrouptb
    ADD CONSTRAINT productgrouptb_pkey PRIMARY KEY (id);


--
-- Name: producthtmltb producthtmltb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producthtmltb
    ADD CONSTRAINT producthtmltb_pkey PRIMARY KEY (id);


--
-- Name: productpricetb productpricetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productpricetb
    ADD CONSTRAINT productpricetb_pkey PRIMARY KEY (id);


--
-- Name: productsizetb productsizetb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productsizetb
    ADD CONSTRAINT productsizetb_pkey PRIMARY KEY (id);


--
-- Name: producttagitemtb producttagitemtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producttagitemtb
    ADD CONSTRAINT producttagitemtb_pkey PRIMARY KEY (id);


--
-- Name: producttagtb producttagtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producttagtb
    ADD CONSTRAINT producttagtb_pkey PRIMARY KEY (id);


--
-- Name: producttb producttb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producttb
    ADD CONSTRAINT producttb_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoice purchase_invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice
    ADD CONSTRAINT purchase_invoice_pkey PRIMARY KEY (id);


--
-- Name: quotationtb quotationtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotationtb
    ADD CONSTRAINT quotationtb_pkey PRIMARY KEY (id);


--
-- Name: realtaxitemtb realtaxitemtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realtaxitemtb
    ADD CONSTRAINT realtaxitemtb_pkey PRIMARY KEY (id);


--
-- Name: releasedlisttb releasedlisttb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.releasedlisttb
    ADD CONSTRAINT releasedlisttb_pkey PRIMARY KEY (id);


--
-- Name: shippinginfotb shippinginfotb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shippinginfotb
    ADD CONSTRAINT shippinginfotb_pkey PRIMARY KEY (id);


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
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (id);


--
-- Name: ticket_and_usertb ticket_and_usertb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_and_usertb
    ADD CONSTRAINT ticket_and_usertb_pkey PRIMARY KEY (id);


--
-- Name: ticket_categorytb ticket_categorytb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categorytb
    ADD CONSTRAINT ticket_categorytb_pkey PRIMARY KEY (id);


--
-- Name: ticket_statustb ticket_statustb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_statustb
    ADD CONSTRAINT ticket_statustb_pkey PRIMARY KEY (id);


--
-- Name: ticket_tb ticket_tb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tb
    ADD CONSTRAINT ticket_tb_pkey PRIMARY KEY (id);


--
-- Name: ticketandusertb ticketandusertb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketandusertb
    ADD CONSTRAINT ticketandusertb_pkey PRIMARY KEY (id);


--
-- Name: ticketcategorytb ticketcategorytb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketcategorytb
    ADD CONSTRAINT ticketcategorytb_pkey PRIMARY KEY (id);


--
-- Name: ticketcategorytb ticketcategorytb_ticketcategorykey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketcategorytb
    ADD CONSTRAINT ticketcategorytb_ticketcategorykey_key UNIQUE (ticketcategorykey);


--
-- Name: ticketstatustb ticketstatustb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketstatustb
    ADD CONSTRAINT ticketstatustb_pkey PRIMARY KEY (id);


--
-- Name: ticketstatustb ticketstatustb_ticketstatuskey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticketstatustb
    ADD CONSTRAINT ticketstatustb_ticketstatuskey_key UNIQUE (ticketstatuskey);


--
-- Name: tickettb tickettb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickettb
    ADD CONSTRAINT tickettb_pkey PRIMARY KEY (id);


--
-- Name: tickettb tickettb_ticketkey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickettb
    ADD CONSTRAINT tickettb_ticketkey_key UNIQUE (ticketkey);


--
-- Name: bom uk202l6q1gwmylnd747aj357352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom
    ADD CONSTRAINT uk202l6q1gwmylnd747aj357352 UNIQUE (tenant_id, model_id, version);


--
-- Name: ticket_tb uk_l2weq9qxmmmgkq4uvq3tguy0o; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_tb
    ADD CONSTRAINT uk_l2weq9qxmmmgkq4uvq3tguy0o UNIQUE (ticket_key);


--
-- Name: chatboxtb uk_otpqy0460119lv9vo60lmlkt1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chatboxtb
    ADD CONSTRAINT uk_otpqy0460119lv9vo60lmlkt1 UNIQUE (stringid);


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
-- Name: tenant ukng2jtiduv4m34nlcypgqdp29j; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT ukng2jtiduv4m34nlcypgqdp29j UNIQUE (tenant_code);


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
-- Name: user_feedbacktb user_feedbacktb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_feedbacktb
    ADD CONSTRAINT user_feedbacktb_pkey PRIMARY KEY (id);


--
-- Name: userconversationtb userconversationtb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userconversationtb
    ADD CONSTRAINT userconversationtb_pkey PRIMARY KEY (id);


--
-- Name: userfeedbacktb userfeedbacktb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userfeedbacktb
    ADD CONSTRAINT userfeedbacktb_pkey PRIMARY KEY (id);


--
-- Name: usergrouptb usergrouptb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usergrouptb
    ADD CONSTRAINT usergrouptb_pkey PRIMARY KEY (id);


--
-- Name: usertb usertb_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usertb
    ADD CONSTRAINT usertb_email_key UNIQUE (email);


--
-- Name: usertb usertb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usertb
    ADD CONSTRAINT usertb_pkey PRIMARY KEY (id);


--
-- Name: usertb usertb_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usertb
    ADD CONSTRAINT usertb_username_key UNIQUE (username);


--
-- Name: warehouse warehouse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse
    ADD CONSTRAINT warehouse_pkey PRIMARY KEY (id);


--
-- Name: warehousecelltb warehousecelltb_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehousecelltb
    ADD CONSTRAINT warehousecelltb_pkey PRIMARY KEY (id);


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
-- Name: idx_tenant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_created_at ON public.tenant USING btree (created_at);


--
-- Name: idx_warehouse_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_tenant_id ON public.warehouse USING btree (tenant_id);


--
-- Name: ux_company_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_company_code ON public.company USING btree (company_code);


--
-- Name: ux_tenant_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_tenant_tenant_code ON public.tenant USING btree (tenant_code);


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
-- Name: material_price fk_price_material; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_price
    ADD CONSTRAINT fk_price_material FOREIGN KEY (material_id) REFERENCES public.material(id);


--
-- Name: forecast fkf64otves0dxe8gwa3waendt5t; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast
    ADD CONSTRAINT fkf64otves0dxe8gwa3waendt5t FOREIGN KEY (material_id) REFERENCES public.material(id);


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
-- Name: forecast fknufjvjvg6vtyt5u00oy5rgmkv; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forecast
    ADD CONSTRAINT fknufjvjvg6vtyt5u00oy5rgmkv FOREIGN KEY (company_id) REFERENCES public.company(id);


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

\unrestrict sWIcEPFWfH8u3kJP3n8VWhbL4AlamCFno3QkvfAy75juohmsqOJvSWJ1GXUolnv

