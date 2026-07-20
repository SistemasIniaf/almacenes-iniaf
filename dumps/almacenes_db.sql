--
-- PostgreSQL database dump
--

\restrict ZfCIwFVMdL0WJoZfhCJyfw0mtQ6vb02xDGD0fTGQsi9pzyCV9GVjEwHdiwn4RNJ

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_unidad_id_fkey;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_almacen_id_fkey;
ALTER TABLE IF EXISTS ONLY public.usuario_almacen_observado DROP CONSTRAINT IF EXISTS usuario_almacen_observado_usuario_id_fkey;
ALTER TABLE IF EXISTS ONLY public.usuario_almacen_observado DROP CONSTRAINT IF EXISTS usuario_almacen_observado_almacen_id_fkey;
ALTER TABLE IF EXISTS ONLY public.partidas DROP CONSTRAINT IF EXISTS partidas_padre_id_fkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_partida_id_fkey;
DROP INDEX IF EXISTS public.usuarios_usuario_key;
DROP INDEX IF EXISTS public.usuarios_unidad_id_idx;
DROP INDEX IF EXISTS public.usuarios_almacen_id_idx;
DROP INDEX IF EXISTS public.usuario_almacen_observado_usuario_id_almacen_id_key;
DROP INDEX IF EXISTS public.usuario_almacen_observado_almacen_id_idx;
DROP INDEX IF EXISTS public.uq_responsable_por_almacen;
DROP INDEX IF EXISTS public.uq_central_por_almacen;
DROP INDEX IF EXISTS public.uq_aprobador_por_unidad;
DROP INDEX IF EXISTS public.unidades_sigla_key;
DROP INDEX IF EXISTS public.unidades_nombre_key;
DROP INDEX IF EXISTS public.proveedores_nit_key;
DROP INDEX IF EXISTS public.partidas_padre_id_idx;
DROP INDEX IF EXISTS public.partidas_codigo_key;
DROP INDEX IF EXISTS public.items_partida_id_idx;
DROP INDEX IF EXISTS public.items_codigo_key;
DROP INDEX IF EXISTS public.idx_usuarios_usuario_unaccent;
DROP INDEX IF EXISTS public.idx_usuarios_nombre_unaccent;
DROP INDEX IF EXISTS public.idx_unidades_sigla_unaccent;
DROP INDEX IF EXISTS public.idx_unidades_nombre_unaccent;
DROP INDEX IF EXISTS public.idx_proveedores_nombre_unaccent;
DROP INDEX IF EXISTS public.idx_proveedores_nit_unaccent;
DROP INDEX IF EXISTS public.idx_proveedores_contacto_unaccent;
DROP INDEX IF EXISTS public.idx_partidas_denominacion_unaccent;
DROP INDEX IF EXISTS public.idx_partidas_codigo_unaccent;
DROP INDEX IF EXISTS public.idx_items_descripcion_unaccent;
DROP INDEX IF EXISTS public.idx_items_codigo_unaccent;
DROP INDEX IF EXISTS public.idx_almacenes_nombre_unaccent;
DROP INDEX IF EXISTS public.almacenes_nombre_key;
ALTER TABLE IF EXISTS ONLY public.usuarios DROP CONSTRAINT IF EXISTS usuarios_pkey;
ALTER TABLE IF EXISTS ONLY public.usuario_almacen_observado DROP CONSTRAINT IF EXISTS usuario_almacen_observado_pkey;
ALTER TABLE IF EXISTS ONLY public.unidades DROP CONSTRAINT IF EXISTS unidades_pkey;
ALTER TABLE IF EXISTS ONLY public.proveedores DROP CONSTRAINT IF EXISTS proveedores_pkey;
ALTER TABLE IF EXISTS ONLY public.partidas DROP CONSTRAINT IF EXISTS partidas_pkey;
ALTER TABLE IF EXISTS ONLY public.items DROP CONSTRAINT IF EXISTS items_pkey;
ALTER TABLE IF EXISTS ONLY public.almacenes DROP CONSTRAINT IF EXISTS almacenes_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS public.usuarios ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.usuario_almacen_observado ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.unidades ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.proveedores ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.partidas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.almacenes ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.usuarios_id_seq;
DROP TABLE IF EXISTS public.usuarios;
DROP SEQUENCE IF EXISTS public.usuario_almacen_observado_id_seq;
DROP TABLE IF EXISTS public.usuario_almacen_observado;
DROP SEQUENCE IF EXISTS public.unidades_id_seq;
DROP TABLE IF EXISTS public.unidades;
DROP SEQUENCE IF EXISTS public.proveedores_id_seq;
DROP TABLE IF EXISTS public.proveedores;
DROP SEQUENCE IF EXISTS public.partidas_id_seq;
DROP TABLE IF EXISTS public.partidas;
DROP SEQUENCE IF EXISTS public.items_id_seq;
DROP TABLE IF EXISTS public.items;
DROP SEQUENCE IF EXISTS public.almacenes_id_seq;
DROP TABLE IF EXISTS public.almacenes;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP FUNCTION IF EXISTS public.f_unaccent(text);
DROP TYPE IF EXISTS public."Rol";
DROP EXTENSION IF EXISTS unaccent;
DROP EXTENSION IF EXISTS pg_trgm;
--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: Rol; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Rol" AS ENUM (
    'super_admin',
    'admin',
    'solicitador',
    'aprobador',
    'responsable_almacen',
    'central',
    'observador_almacen'
);


ALTER TYPE public."Rol" OWNER TO postgres;

--
-- Name: f_unaccent(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.f_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
  SELECT public.unaccent('public.unaccent', $1)
$_$;


ALTER FUNCTION public.f_unaccent(text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: almacenes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.almacenes (
    id integer NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.almacenes OWNER TO postgres;

--
-- Name: almacenes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.almacenes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.almacenes_id_seq OWNER TO postgres;

--
-- Name: almacenes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.almacenes_id_seq OWNED BY public.almacenes.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id integer NOT NULL,
    codigo text NOT NULL,
    descripcion text NOT NULL,
    unidad_medida text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    partida_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    imagen_url text
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: partidas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.partidas (
    id integer NOT NULL,
    codigo text NOT NULL,
    denominacion text NOT NULL,
    nivel integer NOT NULL,
    seleccionable boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    ultimo_correlativo integer DEFAULT 0 NOT NULL,
    padre_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.partidas OWNER TO postgres;

--
-- Name: partidas_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.partidas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.partidas_id_seq OWNER TO postgres;

--
-- Name: partidas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.partidas_id_seq OWNED BY public.partidas.id;


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.proveedores (
    id integer NOT NULL,
    nombre text NOT NULL,
    nit text,
    telefono text,
    contacto text,
    direccion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.proveedores OWNER TO postgres;

--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.proveedores_id_seq OWNER TO postgres;

--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.proveedores_id_seq OWNED BY public.proveedores.id;


--
-- Name: unidades; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unidades (
    id integer NOT NULL,
    nombre text NOT NULL,
    sigla text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.unidades OWNER TO postgres;

--
-- Name: unidades_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.unidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.unidades_id_seq OWNER TO postgres;

--
-- Name: unidades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.unidades_id_seq OWNED BY public.unidades.id;


--
-- Name: usuario_almacen_observado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_almacen_observado (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    almacen_id integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.usuario_almacen_observado OWNER TO postgres;

--
-- Name: usuario_almacen_observado_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuario_almacen_observado_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuario_almacen_observado_id_seq OWNER TO postgres;

--
-- Name: usuario_almacen_observado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuario_almacen_observado_id_seq OWNED BY public.usuario_almacen_observado.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre text NOT NULL,
    usuario text NOT NULL,
    password text NOT NULL,
    rol public."Rol" NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    unidad_id integer,
    almacen_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_id_seq OWNER TO postgres;

--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: almacenes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.almacenes ALTER COLUMN id SET DEFAULT nextval('public.almacenes_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: partidas id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidas ALTER COLUMN id SET DEFAULT nextval('public.partidas_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores ALTER COLUMN id SET DEFAULT nextval('public.proveedores_id_seq'::regclass);


--
-- Name: unidades id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unidades ALTER COLUMN id SET DEFAULT nextval('public.unidades_id_seq'::regclass);


--
-- Name: usuario_almacen_observado id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_almacen_observado ALTER COLUMN id SET DEFAULT nextval('public.usuario_almacen_observado_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
e0ad6a8b-0d47-4756-979b-c3dd31bbe377	fa9ea09d99bef01300d733353f946d67432fe6971be0ca74033fb46f85d93634	2026-07-19 14:36:20.887228+00	20260713211430_init	\N	\N	2026-07-19 14:36:20.509634+00	1
79e06b0c-4425-4d87-8868-fea884b59fd5	2f23024a44797fb1884f61b87d3f230a66b8040b2f02fd76896b007a9c3d2d8c	2026-07-19 14:36:20.915592+00	20260717192133_item_imagen_url	\N	\N	2026-07-19 14:36:20.888637+00	1
ffc68d59-a4e3-444a-805f-0842fed18a8e	bceae30e854669f4a6c44a285bce9b5fa90d84fe5c5fa0e264294311bd248fe9	2026-07-19 15:01:28.804926+00	20260719150128_proveedores	\N	\N	2026-07-19 15:01:28.7865+00	1
87e4dfb3-6423-43ec-ba05-6d997968f8d2	1edf4d5619ea499b67b039676c563a54fb858ba2e8bb0fe65aa36fb44d0bd312	2026-07-19 16:12:23.510486+00	20260719161128_busqueda_sin_acentos	\N	\N	2026-07-19 16:12:23.447245+00	1
\.


--
-- Data for Name: almacenes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.almacenes (id, nombre, activo, created_at, updated_at) FROM stdin;
4	Oficina Nacional	t	2026-07-19 15:05:07.309	2026-07-20 02:10:19.684
3	Oficina Departamental de Semillas La Paz	t	2026-07-19 15:05:07.307	2026-07-20 02:10:49.424
2	Oficina Departamental de Semillas Cochabamba	t	2026-07-19 15:05:07.305	2026-07-20 02:11:04.197
1	Oficina Departamental de Semillas Santa Cruz	t	2026-07-19 15:05:07.302	2026-07-20 02:11:17.2
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, codigo, descripcion, unidad_medida, activo, partida_id, created_at, updated_at, imagen_url) FROM stdin;
2	21200-000001	Papel bond tamaño oficio	Unidad	t	4	2026-07-19 17:13:48.123	2026-07-19 17:14:35.158	/uploads/items/2-55cd33b8.webp
4	21200-000002	Papel	Unidad	t	4	2026-07-19 17:14:26.933	2026-07-19 17:14:40.439	/uploads/items/4-291f996d.webp
7	21600-000001	Papel	Unidad	t	8	2026-07-19 17:24:55.112	2026-07-19 17:24:55.197	/uploads/items/7-d45495bc.webp
8	21200-000005	Carton	Unidad	t	4	2026-07-19 17:42:02.334	2026-07-19 17:42:10.78	/uploads/items/8-86e2383d.webp
3	21300-000001	Test	dsada	t	5	2026-07-19 17:14:09.321	2026-07-19 17:42:22.079	\N
\.


--
-- Data for Name: partidas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.partidas (id, codigo, denominacion, nivel, seleccionable, activo, ultimo_correlativo, padre_id, created_at, updated_at) FROM stdin;
1	20000	SERVICIOS NO PERSONALES	1	f	t	0	\N	2026-07-19 14:36:31.773	2026-07-19 14:37:29.981
5	21300	Agua	3	t	t	1	2	2026-07-19 14:36:31.783	2026-07-19 17:14:09.319
6	21400	Telefonía	3	t	t	0	2	2026-07-19 14:36:31.785	2026-07-19 14:37:30.189
7	21500	Gas Domiciliario	3	t	t	0	2	2026-07-19 14:36:31.787	2026-07-19 14:37:30.191
4	21200	Energía Eléctrica	3	t	t	5	2	2026-07-19 14:36:31.782	2026-07-19 17:42:02.329
9	22000	Servicios de Transporte y Seguros	2	f	t	0	1	2026-07-19 14:36:31.791	2026-07-19 14:37:30.195
10	22100	Pasajes	3	f	t	0	9	2026-07-19 14:36:31.793	2026-07-19 14:37:30.197
11	22110	Pasajes al Interior del País	4	t	t	0	10	2026-07-19 14:36:31.794	2026-07-19 14:37:30.198
12	22120	Pasajes al Exterior del País	4	t	t	0	10	2026-07-19 14:36:31.828	2026-07-19 14:37:30.2
13	22200	Viáticos	3	f	t	0	9	2026-07-19 14:36:31.83	2026-07-19 14:37:30.202
14	22210	Viáticos por Viajes al Interior del País	4	t	t	0	13	2026-07-19 14:36:31.832	2026-07-19 14:37:30.204
15	22220	Viáticos por Viajes al Exterior del País	4	t	t	0	13	2026-07-19 14:36:31.833	2026-07-19 14:37:30.206
16	22300	Fletes y Almacenamiento	3	t	t	0	9	2026-07-19 14:36:31.835	2026-07-19 14:37:30.208
17	22400	Gastos de Instalación y Retorno	3	t	t	0	9	2026-07-19 14:36:31.836	2026-07-19 14:37:30.21
18	22500	Seguros	3	t	t	0	9	2026-07-19 14:36:31.838	2026-07-19 14:37:30.212
19	22600	Transporte de Personal	3	t	t	0	9	2026-07-19 14:36:31.839	2026-07-19 14:37:30.215
20	23000	Alquileres	2	f	t	0	1	2026-07-19 14:36:31.841	2026-07-19 14:37:30.217
21	23100	Alquiler de Inmuebles	3	t	t	0	20	2026-07-19 14:36:31.842	2026-07-19 14:37:30.219
22	23200	Alquiler de Equipos y Maquinarias	3	t	t	0	20	2026-07-19 14:36:31.844	2026-07-19 14:37:30.221
23	23300	Alquiler de Tierras y Terrenos	3	t	t	0	20	2026-07-19 14:36:31.845	2026-07-19 14:37:30.223
24	23400	Otros Alquileres	3	t	t	0	20	2026-07-19 14:36:31.847	2026-07-19 14:37:30.225
25	24000	Instalación, Mantenimiento y Reparaciones	2	f	t	0	1	2026-07-19 14:36:31.848	2026-07-19 14:37:30.226
26	24100	Mantenimiento y Reparación de Inmuebles, Muebles y Equipos	3	f	t	0	25	2026-07-19 14:36:31.85	2026-07-19 14:37:30.228
27	24110	Mantenimiento y Reparación de Inmuebles	4	t	t	0	26	2026-07-19 14:36:31.851	2026-07-19 14:37:30.23
29	24130	Mantenimiento y Reparación de Muebles y Enseres	4	t	t	0	26	2026-07-19 14:36:31.881	2026-07-19 14:37:30.234
30	24200	Mantenimiento y Reparación de Vías de Comunicación	3	t	t	0	25	2026-07-19 14:36:31.882	2026-07-19 14:37:30.236
31	24300	Otros Gastos por Concepto de Instalación, Mantenimiento y Reparación	3	t	t	0	25	2026-07-19 14:36:31.884	2026-07-19 14:37:30.238
32	25000	Servicios Profesionales y Comerciales	2	f	t	0	1	2026-07-19 14:36:31.886	2026-07-19 14:37:30.24
33	25100	Médicos, Sanitarios y Sociales	3	f	t	0	32	2026-07-19 14:36:31.887	2026-07-19 14:37:30.242
34	25120	Gastos Especializados por Atención Médica y Otros	4	t	t	0	33	2026-07-19 14:36:31.889	2026-07-19 14:37:30.244
35	25130	Gastos por Afiliación de Estudiantes Universitarios al Seguro Social	4	t	t	0	33	2026-07-19 14:36:31.89	2026-07-19 14:37:30.246
36	25200	Estudios, Investigaciones, Auditorías Externas y Revalorizaciones	3	f	t	0	32	2026-07-19 14:36:31.892	2026-07-19 14:37:30.248
37	25210	Consultorías por Producto	4	t	t	0	36	2026-07-19 14:36:31.893	2026-07-19 14:37:30.25
38	25220	Consultores Individuales de Línea	4	t	t	0	36	2026-07-19 14:36:31.895	2026-07-19 14:37:30.252
39	25230	Auditorías Externas	4	t	t	0	36	2026-07-19 14:36:31.896	2026-07-19 14:37:30.253
40	25300	Comisiones y Gastos Bancarios	3	t	t	0	32	2026-07-19 14:36:31.898	2026-07-19 14:37:30.255
41	25400	Lavandería, Limpieza e Higiene	3	t	t	0	32	2026-07-19 14:36:31.899	2026-07-19 14:37:30.257
42	25500	Publicidad	3	t	t	0	32	2026-07-19 14:36:31.901	2026-07-19 14:37:30.259
43	25600	Servicios de Imprenta, Fotocopiado y Fotográficos	3	t	t	0	32	2026-07-19 14:36:31.902	2026-07-19 14:37:30.261
44	25700	Capacitación del Personal	3	t	t	0	32	2026-07-19 14:36:31.93	2026-07-19 14:37:30.263
45	25800	Estudios e Investigaciones para Proyectos de Inversión No Capitalizables	3	f	t	0	32	2026-07-19 14:36:31.932	2026-07-19 14:37:30.265
46	25810	Consultorías por Producto	4	t	t	0	45	2026-07-19 14:36:31.934	2026-07-19 14:37:30.267
47	25820	Consultores Individuales de Línea	4	t	t	0	45	2026-07-19 14:36:31.936	2026-07-19 14:37:30.269
48	25900	Servicios Manuales	3	t	t	0	32	2026-07-19 14:36:31.937	2026-07-19 14:37:30.271
49	26000	Otros Servicios No Personales	2	f	t	0	1	2026-07-19 14:36:31.939	2026-07-19 14:37:30.273
50	26200	Gastos Judiciales	3	t	t	0	49	2026-07-19 14:36:31.94	2026-07-19 14:37:30.275
51	26300	Derechos sobre Bienes Intangibles	3	t	t	0	49	2026-07-19 14:36:31.942	2026-07-19 14:37:30.277
52	26500	Conjueces y Jueces Ciudadanos	3	t	t	0	49	2026-07-19 14:36:31.943	2026-07-19 14:37:30.279
53	26600	Servicio de Seguridad de los Batallones de Seguridad Física de la Policía Boliviana, las Fuerzas Armadas y Vigilancia Privada	3	f	t	0	49	2026-07-19 14:36:31.944	2026-07-19 14:37:30.281
54	26610	Servicios Públicos	4	t	t	0	53	2026-07-19 14:36:31.946	2026-07-19 14:37:30.283
55	26620	Servicios Privados	4	t	t	0	53	2026-07-19 14:36:31.947	2026-07-19 14:37:30.285
56	26630	Servicios por Traslado de Valores	4	t	t	0	53	2026-07-19 14:36:31.949	2026-07-19 14:37:30.287
57	26640	Compensación Económica	4	t	t	0	53	2026-07-19 14:36:31.95	2026-07-19 14:37:30.289
58	26700	Servicios de Laboratorios Especializados	3	t	t	0	49	2026-07-19 14:36:31.952	2026-07-19 14:37:30.291
59	26900	Otros Servicios No Personales	3	f	t	0	49	2026-07-19 14:36:31.953	2026-07-19 14:37:30.294
60	26910	Gastos de Representación	4	t	t	0	59	2026-07-19 14:36:31.988	2026-07-19 14:37:30.296
61	26920	Fallas de Caja	4	t	t	0	59	2026-07-19 14:36:31.989	2026-07-19 14:37:30.298
62	26930	Pago por Trabajos Dirigidos y Pasantías	4	t	t	0	59	2026-07-19 14:36:31.991	2026-07-19 14:37:30.3
63	26940	Compensación Costo de Vida	4	t	t	0	59	2026-07-19 14:36:31.993	2026-07-19 14:37:30.302
64	26950	Aguinaldo "Esfuerzo por Bolivia"	4	t	t	0	59	2026-07-19 14:36:31.994	2026-07-19 14:37:30.304
65	26990	Otros	4	t	t	0	59	2026-07-19 14:36:31.996	2026-07-19 14:37:30.306
66	27000	Gastos por Servicios Especializados por la Actividad Extractiva de Recursos Naturales del Estado Plurinacional	2	f	t	0	1	2026-07-19 14:36:31.997	2026-07-19 14:37:30.308
67	27100	Servicios por la Extracción, Transformación y Conversión de los Recursos Naturales de Propiedad del Estado Plurinacional	3	f	t	0	66	2026-07-19 14:36:31.999	2026-07-19 14:37:30.309
68	27110	Pago por Costos Incurridos	4	t	t	0	67	2026-07-19 14:36:32	2026-07-19 14:37:30.311
69	27120	Pago por Utilidades	4	t	t	0	67	2026-07-19 14:36:32.002	2026-07-19 14:37:30.313
71	31000	Alimentos y Productos Agroforestales	2	f	t	0	70	2026-07-19 14:36:32.005	2026-07-19 14:37:30.315
70	30000	MATERIALES Y SUMINISTROS	1	f	t	0	\N	2026-07-19 14:36:32.003	2026-07-19 14:37:30.097
72	31100	Alimentos y Bebidas para Personas, Desayuno Escolar y Otros	3	f	t	0	71	2026-07-19 14:36:32.007	2026-07-19 14:37:30.317
8	21600	Internet	3	t	t	1	2	2026-07-19 14:36:31.789	2026-07-19 17:24:55.111
3	21100	Comunicaciones	3	t	t	0	2	2026-07-19 14:36:31.78	2026-07-19 17:10:56.928
79	31300	Productos Agrícolas, Pecuarios y Forestales	3	t	t	0	71	2026-07-19 14:36:32.046	2026-07-19 14:37:30.333
80	32000	Productos de Papel, Cartón e Impresos	2	f	t	0	70	2026-07-19 14:36:32.048	2026-07-19 14:37:30.335
81	32100	Papel	3	t	t	0	80	2026-07-19 14:36:32.049	2026-07-19 14:37:30.337
82	32200	Productos de Artes Gráficas	3	t	t	0	80	2026-07-19 14:36:32.051	2026-07-19 14:37:30.339
83	32300	Libros, Manuales y Revistas	3	t	t	0	80	2026-07-19 14:36:32.052	2026-07-19 14:37:30.341
84	32400	Textos de Enseñanza	3	t	t	0	80	2026-07-19 14:36:32.054	2026-07-19 14:37:30.343
85	32500	Periódicos y Boletines	3	t	t	0	80	2026-07-19 14:36:32.055	2026-07-19 14:37:30.345
86	33000	Textiles y Vestuario	2	f	t	0	70	2026-07-19 14:36:32.057	2026-07-19 14:37:30.347
98	34400	Productos de Cuero y Caucho	3	t	t	0	91	2026-07-19 14:36:32.108	2026-07-19 14:37:30.371
99	34500	Productos de Minerales no Metálicos y Plásticos	3	t	t	0	91	2026-07-19 14:36:32.109	2026-07-19 14:37:30.373
100	34600	Productos Metálicos	3	t	t	0	91	2026-07-19 14:36:32.111	2026-07-19 14:37:30.375
101	34700	Minerales	3	t	t	0	91	2026-07-19 14:36:32.112	2026-07-19 14:37:30.377
102	34800	Herramientas Menores	3	t	t	0	91	2026-07-19 14:36:32.114	2026-07-19 14:37:30.379
103	34900	Material y Equipo Militar	3	t	t	0	91	2026-07-19 14:36:32.115	2026-07-19 14:37:30.381
104	39000	Productos Varios	2	f	t	0	70	2026-07-19 14:36:32.117	2026-07-19 14:37:30.382
105	39100	Material de Limpieza e Higiene	3	t	t	0	104	2026-07-19 14:36:32.118	2026-07-19 14:37:30.39
106	39200	Material Deportivo y Recreativo	3	t	t	0	104	2026-07-19 14:36:32.12	2026-07-19 14:37:30.392
107	39300	Utensilios de Cocina y Comedor	3	t	t	0	104	2026-07-19 14:36:32.16	2026-07-19 14:37:30.395
108	39400	Instrumental Menor Médico-Quirúrgico	3	t	t	0	104	2026-07-19 14:36:32.162	2026-07-19 14:37:30.397
109	39500	Útiles de Escritorio y Oficina	3	t	t	0	104	2026-07-19 14:36:32.164	2026-07-19 14:37:30.399
110	39600	Útiles Educacionales, Culturales y de Capacitación	3	t	t	0	104	2026-07-19 14:36:32.166	2026-07-19 14:37:30.4
111	39700	Útiles y Materiales Eléctricos	3	t	t	0	104	2026-07-19 14:36:32.167	2026-07-19 14:37:30.402
112	39800	Otros Repuestos y Accesorios	3	t	t	0	104	2026-07-19 14:36:32.169	2026-07-19 14:37:30.404
113	39900	Otros Materiales y Suministros	3	f	t	0	104	2026-07-19 14:36:32.17	2026-07-19 14:37:30.406
114	39910	Acuñación de Monedas e Impresión de Billetes	4	f	t	0	113	2026-07-19 14:36:32.172	2026-07-19 14:37:30.408
115	39911	Acuñación de monedas	5	t	t	0	114	2026-07-19 14:36:32.173	2026-07-19 14:37:30.41
116	39912	Impresión de billetes	5	t	t	0	114	2026-07-19 14:36:32.175	2026-07-19 14:37:30.412
117	39990	Otros Materiales y Suministros	4	t	t	0	113	2026-07-19 14:36:32.176	2026-07-19 14:37:30.414
2	21000	Servicios Básicos	2	f	t	0	1	2026-07-19 14:36:31.777	2026-07-19 14:37:30.181
28	24120	Mantenimiento y Reparación de Vehículos, Maquinaria y Equipos	4	t	t	0	26	2026-07-19 14:36:31.879	2026-07-19 14:37:30.232
73	31110	Gastos por Refrigerios al Personal Permanente, Eventual y Consultores Individuales de Línea de las Instituciones Públicas	4	t	t	0	72	2026-07-19 14:36:32.008	2026-07-19 14:37:30.321
74	31120	Gastos por Alimentación y Otros Similares	4	t	t	0	72	2026-07-19 14:36:32.01	2026-07-19 14:37:30.323
75	31130	Alimentación Complementaria Escolar	4	t	t	0	72	2026-07-19 14:36:32.039	2026-07-19 14:37:30.325
76	31140	Alimentación Hospitalaria, Penitenciaria, Aeronaves y Otras Específicas	4	t	t	0	72	2026-07-19 14:36:32.041	2026-07-19 14:37:30.327
77	31150	Alimentos y Bebidas para la atención de emergencias y desastres naturales	4	t	t	0	72	2026-07-19 14:36:32.043	2026-07-19 14:37:30.329
78	31200	Alimentos para Animales	3	t	t	0	71	2026-07-19 14:36:32.045	2026-07-19 14:37:30.331
87	33100	Hilados, Telas, Fibras y Algodón	3	t	t	0	86	2026-07-19 14:36:32.058	2026-07-19 14:37:30.349
88	33200	Confecciones Textiles	3	t	t	0	86	2026-07-19 14:36:32.06	2026-07-19 14:37:30.351
89	33300	Prendas de Vestir	3	t	t	0	86	2026-07-19 14:36:32.061	2026-07-19 14:37:30.352
90	33400	Calzados	3	t	t	0	86	2026-07-19 14:36:32.063	2026-07-19 14:37:30.355
91	34000	Combustibles, Productos Químicos, Farmacéuticos y Otras Fuentes de Energía	2	f	t	0	70	2026-07-19 14:36:32.096	2026-07-19 14:37:30.357
92	34100	Combustibles, Lubricantes, Derivados y otras Fuentes de Energía	3	f	t	0	91	2026-07-19 14:36:32.098	2026-07-19 14:37:30.359
93	34110	Combustibles, Lubricantes y Derivados para consumo	4	t	t	0	92	2026-07-19 14:36:32.1	2026-07-19 14:37:30.361
94	34120	Combustibles, Lubricantes y Derivados para comercialización	4	t	t	0	92	2026-07-19 14:36:32.101	2026-07-19 14:37:30.363
95	34130	Energía Eléctrica para Comercialización	4	t	t	0	92	2026-07-19 14:36:32.103	2026-07-19 14:37:30.365
96	34200	Productos Químicos y Farmacéuticos	3	t	t	0	91	2026-07-19 14:36:32.104	2026-07-19 14:37:30.367
97	34300	Llantas y Neumáticos	3	t	t	0	91	2026-07-19 14:36:32.106	2026-07-19 14:37:30.369
\.


--
-- Data for Name: proveedores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.proveedores (id, nombre, nit, telefono, contacto, direccion, activo, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: unidades; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.unidades (id, nombre, sigla, activo, created_at, updated_at) FROM stdin;
1	Unidad de Planificación y Gestión Institucional	UPGI	t	2026-07-19 15:05:07.266	2026-07-19 15:52:28.713
6	Unidad de Producción y Servicios	UPS	t	2026-07-19 15:54:06.65	2026-07-19 15:54:06.65
4	Unidad de Asesoria Legal	UAL	t	2026-07-19 15:05:07.3	2026-07-19 15:54:14.953
3	Unidad de Recursos Humanos	URH	t	2026-07-19 15:05:07.298	2026-07-19 15:54:17.982
2	Unidad Administrativa Financiera	UAF	t	2026-07-19 15:05:07.296	2026-07-19 16:03:55.436
8	Dirección General Ejecutiva	DGE	t	2026-07-19 16:04:55.136	2026-07-19 16:04:55.136
7	Dirección Nacional de Semillas	DNS	t	2026-07-19 15:54:53.792	2026-07-19 23:56:09.184
9	Coordinación General	CO-DGE	t	2026-07-19 16:05:21.63	2026-07-20 01:02:04.793
\.


--
-- Data for Name: usuario_almacen_observado; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuario_almacen_observado (id, usuario_id, almacen_id, created_at) FROM stdin;
5	20	1	2026-07-19 15:05:07.365
6	20	4	2026-07-19 15:05:07.365
9	19	4	2026-07-20 02:11:36.947
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, nombre, usuario, password, rol, activo, unidad_id, almacen_id, created_at, updated_at) FROM stdin;
1	Administrador del Sistema	admin	$2b$10$mELebwf2l5nGulyeZUzJXe3kNqGguS1DGBpXXQbYFUJaj8OJg6bUO	super_admin	t	\N	\N	2026-07-19 14:36:31.754	2026-07-19 14:36:31.754
2	Admin Secundario	admin2	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	admin	t	\N	\N	2026-07-19 15:05:07.313	2026-07-19 15:05:07.313
7	Solicitador Planificación 1	solic_up1	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	solicitador	t	1	1	2026-07-19 15:05:07.325	2026-07-19 15:05:07.325
8	Solicitador Planificación 2	solic_up2	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	solicitador	t	1	2	2026-07-19 15:05:07.328	2026-07-19 15:05:07.328
9	Solicitador Administrativo 1	solic_uaf1	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	solicitador	t	2	1	2026-07-19 15:05:07.33	2026-07-19 15:05:07.33
10	Solicitador RR.HH. 1	solic_urh1	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	solicitador	t	3	3	2026-07-19 15:05:07.331	2026-07-19 15:05:07.331
11	Responsable Almacén Central	resp_central	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	responsable_almacen	t	\N	1	2026-07-19 15:05:07.334	2026-07-19 15:05:07.334
12	Responsable Suministros	resp_suministros	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	responsable_almacen	t	\N	2	2026-07-19 15:05:07.335	2026-07-19 15:05:07.335
13	Responsable Materiales	resp_materiales	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	responsable_almacen	t	\N	3	2026-07-19 15:05:07.337	2026-07-19 15:05:07.337
14	Responsable Regional	resp_regional	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	responsable_almacen	t	\N	4	2026-07-19 15:05:07.339	2026-07-19 15:05:07.339
15	Central Almacén Central	central_central	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	central	t	\N	1	2026-07-19 15:05:07.341	2026-07-19 15:05:07.341
16	Central Suministros	central_suministros	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	central	t	\N	2	2026-07-19 15:05:07.343	2026-07-19 15:05:07.343
17	Central Materiales	central_materiales	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	central	t	\N	3	2026-07-19 15:05:07.345	2026-07-19 15:05:07.345
18	Central Regional	central_regional	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	central	t	\N	4	2026-07-19 15:05:07.347	2026-07-19 15:05:07.347
20	Observador Control Interno	obs_control	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	observador_almacen	t	\N	\N	2026-07-19 15:05:07.362	2026-07-19 15:05:07.362
25	Brandon Ticona	brandon.ticona	$2b$10$qnTQXYggpkfjwLx2dE3cJev6rwCSPp.w7uOEAaxe1GXxvwuLCvhcm	solicitador	t	1	1	2026-07-20 01:14:02.502	2026-07-20 01:14:02.502
19	Observador Auditor	obs_auditor	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	observador_almacen	t	\N	\N	2026-07-19 15:05:07.349	2026-07-20 02:11:36.941
3	Aprobador Planificación	aprob_up	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	aprobador	t	1	4	2026-07-19 15:05:07.317	2026-07-19 15:05:07.317
4	Aprobador Administrativo	aprob_uaf	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	aprobador	t	2	4	2026-07-19 15:05:07.32	2026-07-19 15:05:07.32
5	Aprobador RR.HH.	aprob_urh	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	aprobador	t	3	4	2026-07-19 15:05:07.321	2026-07-19 15:05:07.321
6	Aprobador Jurídico	aprob_uj	$2b$10$1uPe868E3KTl/3h8ZTmKteyS/BmMdhh39cRIrLarmUiU8oknpLFIy	aprobador	t	4	4	2026-07-19 15:05:07.323	2026-07-19 15:05:07.323
24	Juan Perez	jjperez	$2b$10$RcT0XhFcluRbZqgpoEk0realmFKRe55AEWU1DyB48ZJop7NKM0OrS	aprobador	t	8	4	2026-07-19 17:45:47.177	2026-07-20 01:37:28.625
\.


--
-- Name: almacenes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.almacenes_id_seq', 6, true);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_seq', 8, true);


--
-- Name: partidas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.partidas_id_seq', 234, true);


--
-- Name: proveedores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.proveedores_id_seq', 8, true);


--
-- Name: unidades_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.unidades_id_seq', 9, true);


--
-- Name: usuario_almacen_observado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuario_almacen_observado_id_seq', 9, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 27, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: almacenes almacenes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.almacenes
    ADD CONSTRAINT almacenes_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: partidas partidas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidas
    ADD CONSTRAINT partidas_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: unidades unidades_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unidades
    ADD CONSTRAINT unidades_pkey PRIMARY KEY (id);


--
-- Name: usuario_almacen_observado usuario_almacen_observado_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_almacen_observado
    ADD CONSTRAINT usuario_almacen_observado_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: almacenes_nombre_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX almacenes_nombre_key ON public.almacenes USING btree (nombre);


--
-- Name: idx_almacenes_nombre_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_almacenes_nombre_unaccent ON public.almacenes USING gin (public.f_unaccent(nombre) public.gin_trgm_ops);


--
-- Name: idx_items_codigo_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_codigo_unaccent ON public.items USING gin (public.f_unaccent(codigo) public.gin_trgm_ops);


--
-- Name: idx_items_descripcion_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_descripcion_unaccent ON public.items USING gin (public.f_unaccent(descripcion) public.gin_trgm_ops);


--
-- Name: idx_partidas_codigo_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partidas_codigo_unaccent ON public.partidas USING gin (public.f_unaccent(codigo) public.gin_trgm_ops);


--
-- Name: idx_partidas_denominacion_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_partidas_denominacion_unaccent ON public.partidas USING gin (public.f_unaccent(denominacion) public.gin_trgm_ops);


--
-- Name: idx_proveedores_contacto_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_contacto_unaccent ON public.proveedores USING gin (public.f_unaccent(contacto) public.gin_trgm_ops);


--
-- Name: idx_proveedores_nit_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_nit_unaccent ON public.proveedores USING gin (public.f_unaccent(nit) public.gin_trgm_ops);


--
-- Name: idx_proveedores_nombre_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_proveedores_nombre_unaccent ON public.proveedores USING gin (public.f_unaccent(nombre) public.gin_trgm_ops);


--
-- Name: idx_unidades_nombre_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unidades_nombre_unaccent ON public.unidades USING gin (public.f_unaccent(nombre) public.gin_trgm_ops);


--
-- Name: idx_unidades_sigla_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unidades_sigla_unaccent ON public.unidades USING gin (public.f_unaccent(sigla) public.gin_trgm_ops);


--
-- Name: idx_usuarios_nombre_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_nombre_unaccent ON public.usuarios USING gin (public.f_unaccent(nombre) public.gin_trgm_ops);


--
-- Name: idx_usuarios_usuario_unaccent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_usuarios_usuario_unaccent ON public.usuarios USING gin (public.f_unaccent(usuario) public.gin_trgm_ops);


--
-- Name: items_codigo_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX items_codigo_key ON public.items USING btree (codigo);


--
-- Name: items_partida_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX items_partida_id_idx ON public.items USING btree (partida_id);


--
-- Name: partidas_codigo_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX partidas_codigo_key ON public.partidas USING btree (codigo);


--
-- Name: partidas_padre_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX partidas_padre_id_idx ON public.partidas USING btree (padre_id);


--
-- Name: proveedores_nit_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX proveedores_nit_key ON public.proveedores USING btree (nit);


--
-- Name: unidades_nombre_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unidades_nombre_key ON public.unidades USING btree (nombre);


--
-- Name: unidades_sigla_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX unidades_sigla_key ON public.unidades USING btree (sigla);


--
-- Name: uq_aprobador_por_unidad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_aprobador_por_unidad ON public.usuarios USING btree (unidad_id) WHERE ((rol = 'aprobador'::public."Rol") AND (activo = true));


--
-- Name: uq_central_por_almacen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_central_por_almacen ON public.usuarios USING btree (almacen_id) WHERE ((rol = 'central'::public."Rol") AND (activo = true));


--
-- Name: uq_responsable_por_almacen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_responsable_por_almacen ON public.usuarios USING btree (almacen_id) WHERE ((rol = 'responsable_almacen'::public."Rol") AND (activo = true));


--
-- Name: usuario_almacen_observado_almacen_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX usuario_almacen_observado_almacen_id_idx ON public.usuario_almacen_observado USING btree (almacen_id);


--
-- Name: usuario_almacen_observado_usuario_id_almacen_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usuario_almacen_observado_usuario_id_almacen_id_key ON public.usuario_almacen_observado USING btree (usuario_id, almacen_id);


--
-- Name: usuarios_almacen_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX usuarios_almacen_id_idx ON public.usuarios USING btree (almacen_id);


--
-- Name: usuarios_unidad_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX usuarios_unidad_id_idx ON public.usuarios USING btree (unidad_id);


--
-- Name: usuarios_usuario_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usuarios_usuario_key ON public.usuarios USING btree (usuario);


--
-- Name: items items_partida_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_partida_id_fkey FOREIGN KEY (partida_id) REFERENCES public.partidas(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: partidas partidas_padre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.partidas
    ADD CONSTRAINT partidas_padre_id_fkey FOREIGN KEY (padre_id) REFERENCES public.partidas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usuario_almacen_observado usuario_almacen_observado_almacen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_almacen_observado
    ADD CONSTRAINT usuario_almacen_observado_almacen_id_fkey FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuario_almacen_observado usuario_almacen_observado_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_almacen_observado
    ADD CONSTRAINT usuario_almacen_observado_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuarios usuarios_almacen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_almacen_id_fkey FOREIGN KEY (almacen_id) REFERENCES public.almacenes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: usuarios usuarios_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.unidades(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict ZfCIwFVMdL0WJoZfhCJyfw0mtQ6vb02xDGD0fTGQsi9pzyCV9GVjEwHdiwn4RNJ

