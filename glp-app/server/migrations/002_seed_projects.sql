-- ============================================================
-- Seed: 18 proyectos GLP — taxonomía oficial
-- Usa la tabla projects existente con estructura JSONB (data)
-- tenant_id = 'tenant-glp-001'
-- ============================================================

INSERT INTO projects (id, tenant_id, data, imagen_url) VALUES

-- ── PROYECTO DE CIUDAD ──────────────────────────────────────

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Armonía", "category": "Proyecto de Ciudad", "tipo": "Residencia",
  "zone": "Bella Vista — Ciudad de Panamá", "zoneShort": "Armonía / Bella Vista",
  "investorType": "renta", "entrega": "F1 Inmediata · F2 Q2 2026 · F3 Q2 2028",
  "construction": "Multi-fase · F1 entregada", "bedrooms": "1, 2 y 3 rec.",
  "minPrice": 181000, "maxPrice": 235000, "areaMin": 45, "areaMax": 71, "priceM2Min": 2550, "priceM2Max": 3300,
  "amenities": ["Piscina y área social", "Gimnasio moderno", "Lobby de diseño", "Seguridad 24/7", "Parqueo"],
  "notaValorizacion": "Corridor Bella Vista con crecimiento sostenido. F1 entregada genera renta desde día 1.",
  "capRateMin": 6.0, "capRateMax": 7.5, "vacancyDef": 6, "rentSuggest": 1100, "rentM2Min": 12, "rentM2Max": 16,
  "condominioMes": 220, "appreciationDef": 4.0,
  "appreciationNote": "Bella Vista es uno de los corredores más demandados de Ciudad de Panamá. Valorización 4–6% anual.",
  "zonaColegios": "Instituto Alberto Einstein, Oxford International School (10 min)",
  "zonaSupermercados": "El Rey, Super 99, Riba Smith (5 min)",
  "zonaEntretenimiento": "Multiplaza Pacific, Albrook Mall, Cinta Costera (15 min)",
  "zonaSalud": "Hospital Punta Pacífica, Clínica Hospital San Fernando (10 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Ventu", "category": "Proyecto de Ciudad", "tipo": "Hotelero",
  "zone": "Bella Vista — Ciudad de Panamá", "zoneShort": "Ventu / Bella Vista",
  "investorType": "patrimonial", "entrega": "Q2 2028",
  "construction": "En construcción (entrega Q2 2028)", "bedrooms": "1 y 2 rec.",
  "minPrice": 136000, "maxPrice": 259000, "areaMin": 40, "areaMax": 63, "priceM2Min": 2100, "priceM2Max": 3200,
  "amenities": ["Diseño Airbnb optimizado", "Administración hotelera", "Pool deck", "Coworking", "Check-in automático", "Seguridad 24/7"],
  "notaValorizacion": "Modelo hotelero con administración incluida. Cap rate proyectado 8–12% con estrategia Airbnb/Booking.",
  "capRateMin": 8.0, "capRateMax": 12.0, "vacancyDef": 20, "rentSuggest": 2400, "rentM2Min": 0, "rentM2Max": 0,
  "condominioMes": 250, "appreciationDef": 4.5,
  "appreciationNote": "Único proyecto hotelero optimizado para renta corta (Airbnb/Booking) en Bella Vista. 4–5% valorización anual.",
  "perfilArrendatario": "Nómada digital, turista corporativo, visitante de corta duración",
  "zonaColegios": "Instituto Alberto Einstein, Oxford International School (10 min)",
  "zonaSupermercados": "El Rey, Super 99 (5 min)",
  "zonaEntretenimiento": "Multiplaza Pacific, vida nocturna Bella Vista (5 min)",
  "zonaSalud": "Hospital San Fernando (10 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Ocena", "category": "Proyecto de Ciudad", "tipo": "Residencia",
  "zone": "Santa María — Ciudad de Panamá", "zoneShort": "Ocena / Santa María",
  "investorType": "patrimonial", "entrega": "Q4 2027",
  "construction": "En construcción (entrega Q4 2027)", "bedrooms": "2 y 3 rec.",
  "minPrice": 446000, "maxPrice": 1200000, "areaMin": 100, "areaMax": 270, "priceM2Min": 3200, "priceM2Max": 5000,
  "amenities": ["Golf 18 hoyos Jack Nicklaus", "Club House", "Piscinas resort", "Pickleball y tenis", "Co-working", "Wellness center", "Concierge"],
  "notaValorizacion": "Activo de lujo con diferencial de golf Jack Nicklaus único en Panamá. Alta plusvalía patrimonial.",
  "capRateMin": 4.7, "capRateMax": 6.0, "vacancyDef": 4, "rentSuggest": 3500, "rentM2Min": 20, "rentM2Max": 25,
  "condominioMes": 550, "appreciationDef": 5.0,
  "appreciationNote": "Única comunidad con golf Jack Nicklaus en Santa María. Demanda de ejecutivos y familias expat. 5–7% valorización anual.",
  "perfilArrendatario": "Ejecutivo multinacional, embajador, familia expat de alto perfil",
  "zonaColegios": "Kings College, Oxford School Panamá (5 min)",
  "zonaSupermercados": "Riba Smith Santa María, El Machetazo (10 min)",
  "zonaEntretenimiento": "Club de Golf Santa María, Costa del Este (15 min)",
  "zonaSalud": "Hospital Punta Pacífica, Clínica Hospital San Fernando (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Ipanema", "category": "Proyecto de Ciudad", "tipo": "Residencia",
  "zone": "Costa Sur — Ciudad de Panamá", "zoneShort": "Ipanema / Costa Sur",
  "investorType": "disfrute", "entrega": "F1 Q1 2028 · F2 Q4 2028",
  "construction": "En construcción · F1 Q1 2028", "bedrooms": "1, 2 y 3 rec.",
  "minPrice": 283000, "maxPrice": 519000, "areaMin": 72, "areaMax": 163, "priceM2Min": 2500, "priceM2Max": 3800,
  "amenities": ["Piscina con vista al mar", "Gimnasio", "Co-working", "BBQ y lounge", "Seguridad 24/7", "Parque infantil"],
  "notaValorizacion": "Costa del Este consolida demanda corporativa. Cap rate 6.0–7.5% confirmado por inteligencia de mercado Q2 2026.",
  "capRateMin": 6.0, "capRateMax": 7.5, "vacancyDef": 6, "rentSuggest": 1600, "rentM2Min": 12, "rentM2Max": 18,
  "condominioMes": 280, "appreciationDef": 4.0,
  "appreciationNote": "Costa del Este es hub corporativo multinacional. Alta demanda de ejecutivos expat. 4–6% valorización anual.",
  "velocidadColocacion": "1–2 meses", "perfilArrendatario": "Ejecutivo corporativo, inversor — demanda multinacional Costa del Este",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaColegios": "International School of Panama, Kings College (10 min)",
  "zonaSupermercados": "Riba Smith Costa del Este, El Rey (5 min)",
  "zonaEntretenimiento": "Multiplaza Panamá, Soho Mall (10 min)",
  "zonaSalud": "Hospital Punta Pacífica Johns Hopkins (15 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Bosco", "category": "Proyecto de Ciudad", "tipo": "Residencia",
  "zone": "Santa María — Ciudad de Panamá", "zoneShort": "Bosco / Santa María",
  "investorType": "patrimonial", "entrega": "2030",
  "construction": "En preventa (entrega 2030)", "bedrooms": "2, 3 y 4 rec.",
  "minPrice": 474000, "maxPrice": 1100000, "areaMin": 100, "areaMax": 296, "priceM2Min": 2800, "priceM2Max": 4200,
  "amenities": ["Jardines botánicos", "Piscina natural", "Gimnasio", "Senderos de meditación", "Áreas sociales", "Seguridad 24/7"],
  "notaValorizacion": "Entorno botánico único en Santa María. Cap rate 5.5–7.2% y vacancia 4–7% confirmados por inteligencia de mercado.",
  "capRateMin": 5.5, "capRateMax": 7.2, "vacancyDef": 5, "rentSuggest": 2800, "rentM2Min": 13, "rentM2Max": 18,
  "condominioMes": 420, "appreciationDef": 4.5,
  "appreciationNote": "Santa María en consolidación definitiva. Proyecto de lujo con jardines botánicos. 4–6% valorización anual.",
  "velocidadColocacion": "1–2 meses", "perfilArrendatario": "Familia ejecutiva — entorno natural diferencial, perfil patrimonial",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaColegios": "Kings College, Oxford School Panamá (5 min)",
  "zonaSupermercados": "Riba Smith Santa María (8 min)",
  "zonaEntretenimiento": "Club Santa María, Costa del Este (15 min)",
  "zonaSalud": "Hospital Punta Pacífica (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Panama Viejo Residence", "category": "Proyecto de Ciudad", "tipo": "Residencia",
  "zone": "Panamá Viejo — Ciudad de Panamá", "zoneShort": "Panama Viejo / Panamá Viejo",
  "investorType": "renta", "entrega": "ENTREGA INMEDIATA",
  "construction": "Entrega inmediata", "bedrooms": "2 rec.",
  "minPrice": 160000, "maxPrice": 182000, "areaMin": 58, "areaMax": 58, "priceM2Min": 2750, "priceM2Max": 3140,
  "amenities": ["Piscina y área social", "Gimnasio", "Coworking", "Seguridad 24/7", "Parque infantil"],
  "notaValorizacion": "Mayor velocidad de colocación del portafolio de ciudad. Renta desde el primer mes, vacancia 5–8%.",
  "capRateMin": 6.5, "capRateMax": 8.0, "vacancyDef": 6, "rentSuggest": 950, "rentM2Min": 10, "rentM2Max": 14,
  "condominioMes": 200, "appreciationDef": 3.2,
  "appreciationNote": "Entrega inmediata con valorización consistente 3–5% anual impulsada por proximidad a Costa del Este.",
  "velocidadColocacion": "0.5–1 mes", "perfilArrendatario": "Profesional local, familia joven — bajo riesgo mora",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaColegios": "Colegio Internacional de María Inmaculada (10 min)",
  "zonaSupermercados": "Super 99 Panamá Viejo (5 min)",
  "zonaEntretenimiento": "Ruinas de Panamá Viejo, Cinta Costera (10 min)",
  "zonaSalud": "Hospital Nacional (15 min)"
}', null),

-- ── OCEAN REEF ISLANDS ──────────────────────────────────────

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "The Palms", "category": "Ocean Reef Islands", "tipo": "Residencia",
  "zone": "Punta Pacífica — Ciudad de Panamá", "zoneShort": "The Palms / Punta Pacífica",
  "investorType": "patrimonial", "entrega": "ENTREGA INMEDIATA",
  "construction": "Entrega inmediata", "bedrooms": "2 rec.",
  "minPrice": 1200000, "maxPrice": 1400000, "areaMin": 169, "areaMax": 239, "priceM2Min": 5020, "priceM2Max": 5860,
  "amenities": ["Marina privada 180+ muelles", "Yacht club", "Piscinas infinity", "Spa y wellness", "Restaurantes", "Beach club", "Seguridad 24/7"],
  "notaValorizacion": "Menor vacancia del portafolio (4–6%). Activo único en isla artificial con marina. Cap rate 5.5–7.0% confirmado.",
  "capRateMin": 5.5, "capRateMax": 7.0, "vacancyDef": 4, "rentSuggest": 5500, "rentM2Min": 22, "rentM2Max": 30,
  "condominioMes": 700, "appreciationDef": 5.5,
  "appreciationNote": "Isla artificial exclusiva con acceso a marina privada. Activo de mayor plusvalía del portafolio. 6–8% valorización anual.",
  "velocidadColocacion": "1–2 meses", "perfilArrendatario": "Ejecutivo joven, nómada digital — alta rotación baja vacancia",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaColegios": "The Oxford School (5 min)",
  "zonaSupermercados": "Multiplaza Panamá (5 min)",
  "zonaEntretenimiento": "Multiplaza, Yatch Club, restaurantes Punta Pacífica (5 min)",
  "zonaSalud": "Hospital Punta Pacífica Johns Hopkins (2 min)"
}', 'https://glp.com.pa/wp-content/uploads/2026/05/ocean_reef.webp'),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Ocean Reef Park", "category": "Ocean Reef Islands", "tipo": "Residencia",
  "zone": "Punta Pacífica — Ciudad de Panamá", "zoneShort": "Ocean Reef Park / Punta Pacífica",
  "investorType": "patrimonial", "entrega": "Q2 2028",
  "construction": "En construcción (entrega Q2 2028)", "bedrooms": "3 y 4 rec.",
  "minPrice": 1700000, "maxPrice": 2100000, "areaMin": 491, "areaMax": 569, "priceM2Min": 3460, "priceM2Max": 3690,
  "amenities": ["Marina privada", "Yacht club", "Piscinas infinity", "Helipuerto", "Spa y wellness", "Restaurantes", "Club privado"],
  "notaValorizacion": "Producto ultra-premium con demanda captiva. Vacancia 3–5%, la más baja del portafolio de isla.",
  "capRateMin": 5.0, "capRateMax": 6.5, "vacancyDef": 4, "rentSuggest": 9000, "rentM2Min": 18, "rentM2Max": 25,
  "condominioMes": 900, "appreciationDef": 6.0,
  "appreciationNote": "La unidad de mayor tamaño y valor del portafolio. Acceso directo al Johns Hopkins. 6–9% valorización anual.",
  "velocidadColocacion": "0.5–1 mes", "perfilArrendatario": "Diplomático, C-nivel — producto único, demanda captiva",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaColegios": "The Oxford School (5 min)",
  "zonaSupermercados": "Multiplaza Panamá (5 min)",
  "zonaEntretenimiento": "Multiplaza, marina privada, restaurantes premium (en proyecto)",
  "zonaSalud": "Hospital Punta Pacífica Johns Hopkins (2 min)"
}', 'https://glp.com.pa/wp-content/uploads/2026/05/ocean_reef.webp'),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "O Club Residences", "category": "Ocean Reef Islands", "tipo": "Residencia",
  "zone": "Punta Pacífica — Ciudad de Panamá", "zoneShort": "O Club / Punta Pacífica",
  "investorType": "patrimonial", "entrega": "Q4 2027",
  "construction": "En construcción (entrega Q4 2027)", "bedrooms": "2 rec.",
  "minPrice": 1000000, "maxPrice": 1400000, "areaMin": 183, "areaMax": 236, "priceM2Min": 4230, "priceM2Max": 5930,
  "amenities": ["Club privado O Club", "Marina", "Piscinas", "Restaurantes", "Spa", "Seguridad 24/7"],
  "notaValorizacion": "Acceso exclusivo a O Club. Proyecto nuevo en Ocean Reef Islands sin datos históricos aún — pendiente actualización Camilo.",
  "capRateMin": 5.0, "capRateMax": 6.5, "vacancyDef": 4, "rentSuggest": 5000, "rentM2Min": 20, "rentM2Max": 28,
  "condominioMes": 750, "appreciationDef": 5.5,
  "appreciationNote": "Isla artificial de Punta Pacífica. Acceso exclusivo a club privado y marina. 5–7% valorización.",
  "zonaColegios": "The Oxford School (5 min)",
  "zonaSupermercados": "Multiplaza Panamá (5 min)",
  "zonaEntretenimiento": "O Club, marina privada, Multiplaza (5 min)",
  "zonaSalud": "Hospital Punta Pacífica Johns Hopkins (2 min)"
}', null),

-- ── PLAYA CARACOL ───────────────────────────────────────────

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Aires del Mar", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "Aires del Mar / Playa Caracol",
  "investorType": "renta", "entrega": "INMEDIATA · Q4 2026",
  "construction": "Entrega inmediata / Q4 2026", "bedrooms": "2 y 3 rec.",
  "minPrice": 143000, "maxPrice": 207000, "areaMin": 42, "areaMax": 71, "priceM2Min": 2010, "priceM2Max": 2915,
  "amenities": ["Vista al océano Pacífico", "Piscinas", "Parques infantiles", "Jardines", "Seguridad 24/7"],
  "notaValorizacion": "Punto de entrada Playa Caracol. Cap rate 5.8–8.0% con estrategia mixta larga/corta duración.",
  "capRateMin": 5.8, "capRateMax": 8.0, "vacancyDef": 11, "rentSuggest": 950, "rentM2Min": 9, "rentM2Max": 13,
  "condominioMes": 180, "appreciationDef": 3.5,
  "appreciationNote": "Producto de entrada a Playa Caracol. Alta demanda vacacional de colombianos y panameños. 3.5–5% valorización.",
  "velocidadColocacion": "2–3.5 meses", "perfilArrendatario": "Familia segunda residencia — precio accesible en zona playa",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaPlaya": "Playa Caracol 1.2 km (acceso comunitario)",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Surf club Playa Caracol, restaurantes de playa (10 min)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "The Tides", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "The Tides / Playa Caracol",
  "investorType": "disfrute", "entrega": "ENTREGA INMEDIATA",
  "construction": "Entrega inmediata", "bedrooms": "2 y 3 rec.",
  "minPrice": 278000, "maxPrice": 308000, "areaMin": 99, "areaMax": 99, "priceM2Min": 2810, "priceM2Max": 3110,
  "amenities": ["1.2 km playa privada", "Surf club", "3 piscinas", "Restaurante y beach bar", "Senderos naturales", "Gimnasio", "Seguridad 24/7"],
  "notaValorizacion": "Única playa privada de 1.2 km en Playa Caracol. Cap rate 5.5–7.5%, vacancia 7–12%.",
  "capRateMin": 5.5, "capRateMax": 7.5, "vacancyDef": 10, "rentSuggest": 1500, "rentM2Min": 10, "rentM2Max": 16,
  "condominioMes": 320, "appreciationDef": 4.5,
  "appreciationNote": "Frente a playa de 1.2 km. Uno de los proyectos más nuevos en Playa Caracol. Valorización 4–6% anual.",
  "velocidadColocacion": "2–3 meses", "perfilArrendatario": "Familia segunda residencia, expat remoto — playa privada 1.2 km",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaPlaya": "Playa privada 1.2 km (frente al proyecto)",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Surf club, beach bar, senderos naturales (en proyecto)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Brisas del Mar", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "Brisas del Mar / Playa Caracol",
  "investorType": "renta", "entrega": "ENTREGA INMEDIATA",
  "construction": "Entrega inmediata", "bedrooms": "2 y 3 rec.",
  "minPrice": 276000, "maxPrice": 332000, "areaMin": 93, "areaMax": 108, "priceM2Min": 2555, "priceM2Max": 3080,
  "amenities": ["Frente al mar", "Piscina", "BBQ", "Área social", "Seguridad 24/7", "Parque infantil"],
  "notaValorizacion": "Proyecto nuevo en Playa Caracol — pendiente actualización de datos de mercado por Camilo.",
  "capRateMin": 5.8, "capRateMax": 7.5, "vacancyDef": 10, "rentSuggest": 1300, "rentM2Min": 9, "rentM2Max": 13,
  "condominioMes": 260, "appreciationDef": 4.0,
  "appreciationNote": "Entrega inmediata con flujo de renta activo desde el primer mes. Playa Caracol lidera valorización en el Pacífico.",
  "zonaPlaya": "Playa Caracol (acceso comunitario)",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Surf club Playa Caracol (10 min)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Olas del Mar", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "Olas del Mar / Playa Caracol",
  "investorType": "renta", "entrega": "ENTREGA INMEDIATA",
  "construction": "Entrega inmediata", "bedrooms": "2 y 3 rec.",
  "minPrice": 267000, "maxPrice": 398000, "areaMin": 69, "areaMax": 97, "priceM2Min": 2750, "priceM2Max": 3875,
  "amenities": ["Piscina con vista al mar", "Zona de BBQ", "Área social", "Seguridad 24/7", "Parque infantil"],
  "notaValorizacion": "Cap rate 5.8–8.0% con estrategia mixta. Vacancia 8–14% — mejorable con administración activa.",
  "capRateMin": 6.0, "capRateMax": 8.0, "vacancyDef": 11, "rentSuggest": 1050, "rentM2Min": 8, "rentM2Max": 12,
  "condominioMes": 220, "appreciationDef": 3.5,
  "appreciationNote": "Playa Caracol lidera valorización en el Pacífico panameño. Entrega inmediata. 4–6% anual en proyectos nuevos.",
  "velocidadColocacion": "2–3.5 meses", "perfilArrendatario": "Familia segunda residencia — precio accesible en zona playa",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaPlaya": "Playa Caracol (acceso comunitario)",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Surf club, restaurantes de playa (10 min)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Surfside", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "Surfside / Playa Caracol",
  "investorType": "disfrute", "entrega": "ENTREGA INMEDIATA",
  "construction": "Entrega inmediata", "bedrooms": "2 y 3 rec.",
  "minPrice": 314000, "maxPrice": 413000, "areaMin": 81, "areaMax": 107, "priceM2Min": 2930, "priceM2Max": 3860,
  "amenities": ["Playa privada", "Piscinas y jacuzzi", "Restaurante y bar", "Surf lounge", "Gimnasio", "Seguridad 24/7"],
  "notaValorizacion": "Componente aparthotel potencia renta a corto plazo. Cap rate 5.5–7.5%, escalable con gestión activa.",
  "capRateMin": 5.8, "capRateMax": 7.5, "vacancyDef": 10, "rentSuggest": 1400, "rentM2Min": 10, "rentM2Max": 14,
  "condominioMes": 300, "appreciationDef": 4.0,
  "appreciationNote": "Frente al mar con componente aparthotel. Renta vacacional activa desde entrega inmediata. 4–5% anual.",
  "velocidadColocacion": "2–3 meses", "perfilArrendatario": "Inversor mixto — estrategia mixta eleva cap rate al 9–12%",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaPlaya": "Playa privada frente al proyecto",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Surf lounge, beach bar, restaurante (en proyecto)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Beachwalk", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "Beachwalk / Playa Caracol",
  "investorType": "disfrute", "entrega": "Q1 2027",
  "construction": "En construcción (entrega Q1 2027)", "bedrooms": "2 y 3 rec.",
  "minPrice": 297000, "maxPrice": 386000, "areaMin": 85, "areaMax": 97, "priceM2Min": 3060, "priceM2Max": 3980,
  "amenities": ["Frente al océano Pacífico", "Wellness spa", "Piscina paisajística", "Gimnasio exterior", "Yoga deck", "BBQ", "Seguridad 24/7"],
  "notaValorizacion": "Diferencial wellness único en Playa Caracol. Cap rate 5.5–7.5%, escalable con estrategia mixta.",
  "capRateMin": 5.5, "capRateMax": 7.5, "vacancyDef": 10, "rentSuggest": 1300, "rentM2Min": 9, "rentM2Max": 14,
  "condominioMes": 280, "appreciationDef": 4.0,
  "appreciationNote": "Enfoque wellness frente al Pacífico. Entrega Q1 2027 — ventana de preventa activa. 4–5% valorización anual.",
  "velocidadColocacion": "2–3 meses", "perfilArrendatario": "Inversor mixto, familia wellness — estrategia mixta recomendada",
  "fechaActualizacionMercado": "2026-06-27",
  "zonaPlaya": "Frente al océano Pacífico",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Yoga deck, wellness spa, surf (en proyecto)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Seashore", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "Seashore / Playa Caracol",
  "investorType": "renta", "entrega": "Q4 2027",
  "construction": "En construcción (entrega Q4 2027)", "bedrooms": "2 y 3 rec.",
  "minPrice": 290000, "maxPrice": 490000, "areaMin": 84, "areaMax": 150, "priceM2Min": 2440, "priceM2Max": 3870,
  "amenities": ["Vista al Pacífico", "Piscina", "Área social y BBQ", "Gimnasio", "Seguridad 24/7"],
  "notaValorizacion": "Proyecto nuevo en Playa Caracol — pendiente actualización de datos de mercado por Camilo.",
  "capRateMin": 5.8, "capRateMax": 7.5, "vacancyDef": 10, "rentSuggest": 1350, "rentM2Min": 9, "rentM2Max": 13,
  "condominioMes": 270, "appreciationDef": 4.0,
  "appreciationNote": "Amplio rango de área permite diversificación. Entrega Q4 2027. Valorización esperada 4–5% anual.",
  "zonaPlaya": "Playa Caracol (acceso comunitario)",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Surf club Playa Caracol (10 min)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null),

(gen_random_uuid(), 'tenant-glp-001', '{
  "name": "Seashore Reserve", "category": "Playa Caracol", "tipo": "Residencia",
  "zone": "Playa Caracol, Chame — Pacífico", "zoneShort": "Seashore Reserve / Playa Caracol",
  "investorType": "renta", "entrega": "Q4 2028",
  "construction": "En preventa (entrega Q4 2028)", "bedrooms": "2 y 3 rec.",
  "minPrice": 290000, "maxPrice": 490000, "areaMin": 84, "areaMax": 150, "priceM2Min": 2440, "priceM2Max": 3870,
  "amenities": ["Vista Pacífico reservada", "Club de playa", "Piscinas", "Wellness area", "Seguridad 24/7"],
  "notaValorizacion": "Versión premium de Seashore — pendiente actualización de datos de mercado por Camilo.",
  "capRateMin": 5.5, "capRateMax": 7.5, "vacancyDef": 10, "rentSuggest": 1350, "rentM2Min": 9, "rentM2Max": 13,
  "condominioMes": 270, "appreciationDef": 4.5,
  "appreciationNote": "Versión Reserve con acabados superiores. Mayor plusvalía por preventa larga. 4.5–6% valorización anual.",
  "zonaPlaya": "Playa Caracol (acceso comunitario)",
  "zonaSupermercados": "Centro comercial Coronado (20 min)",
  "zonaEntretenimiento": "Club de playa, wellness area (en proyecto)",
  "zonaSalud": "Centro médico Coronado (20 min)"
}', null);
