export const C = {
  teal: '#002349',      // Sotheby's Royal Navy (Primary)
  sand: '#E5E7EB',      // Sutil gray border
  coral: '#B89047',     // Gold/Bronze (Accent)
  red: '#A6192E',       // Rojo corporativo GLP (acento) — tono más rojo/menos café, estilo Sotheby's
  palm: '#166534',      // Deep forest green
  sky: '#0E3A60',       // Darker slate blue
  text: '#111827',      // Charcoal (dark)
  textSec: '#4B5563',   // Slate gray (medium)
  bg: '#F9FAFB',        // White alabaster/chalk background
  white: '#FFFFFF',
  fontSerif: '"Cormorant Garamond", serif',
  fontSans: '"Inter", sans-serif',
}

// ─── Project Data ──────────────────────────────────────────────
export type Project = {
  name: string; 
  category: 'Golf y Country Club' | 'Marina Panamá' | 'Ciudad' | 'Playa';
  zone: string; 
  type: 'patrimonial' | 'disfrute' | 'renta';
  price: number; 
  priceM2: string; 
  rentM2: string; 
  capRate: string;
  vacancy: string; 
  area: string; 
  beds: string;
  amenities: string[]; 
  tenant: string; 
  velocity?: string;
  appreciation: string;
  tag: string;
  delivery: string;
  shortDesc: string;
  story?: {
    paragraphs: string[];
    distribucionTitle: string;
    distribucionIntro: string;
    modelos: string[];
    distribucionFooter: string;
  };
}

export const PROJECTS: Project[] = [
  // ── Ciudad ──
  {
    name: 'Armonia',
    category: 'Ciudad',
    zone: 'Bella Vista, Ciudad de Panamá',
    type: 'renta',
    price: 181000,
    priceM2: '3,800-4,020',
    rentM2: '14-18',
    capRate: '6.5-7.8%',
    vacancy: '4%',
    area: '45-71 m²',
    beds: '1-3 rec.',
    amenities: ['Piscina social', 'Gimnasio', 'Lobby premium', 'Coworking', 'Seguridad 24/7'],
    tenant: 'Jóvenes profesionales, Estudiantes',
    velocity: '1 mes',
    appreciation: '4.0%',
    tag: 'Fase Lanzamiento',
    delivery: 'F1 Inmediata, F2 Q2 2026, F3 Q2 2028',
    shortDesc: 'Apartamentos inteligentes en el corazón de Bella Vista, pensados para generar renta desde el día uno.',
    story: {
      paragraphs: [
        'Vive en el corazón financiero y social de la ciudad, donde cada trayecto se acorta y cada día empieza con más tiempo para ti.',
        'Un emblemático proyecto de uso combinado, para un completo estilo de vida. Armonía es un desarrollo innovador que representa un nuevo estándar de vida urbana en Panamá, combinando apartamentos de 1, 2 y 3 recámaras, apart-hotel y un área comercial en una misma propuesta.',
        'Su ubicación estratégica, a pocos pasos de la Cinta Costera y la Avenida Balboa, lo convierte en una de las opciones más atractivas para residir, invertir o emprender en el corazón de la ciudad.',
        'Unidades residenciales versátiles desde espacios para solteros y profesionales hasta apartamentos familiares, un apart-hotel con alta demanda turística ideal para rentas inmediatas, y un área comercial integrada que brinda conveniencia para residentes y visitantes.',
        'Armonía está diseñado para fomentar el bienestar integral y la interacción social: áreas sociales y recreativas, zonas verdes, y espacios comunitarios orientados al concepto de ciudad eficiente, moderna y conectada.',
        'Renta desde el primer mes: la Fase 1 ya está entregada, así que tu inversión empieza a trabajar mientras tú sigues avanzando.'
      ],
      distribucionTitle: 'Razones para invertir en Armonía',
      distribucionIntro: 'Un modelo de uso mixto — residencial, apart-hotel y comercial — altamente rentable:',
      modelos: [
        'Proyecto de uso mixto: residencial, apart-hotel y área comercial',
        'Ubicación premium en el centro urbano, con alta demanda de vivienda y renta',
        'Potencial de alquiler turístico y corporativo junto a Avenida Balboa y la Cinta Costera',
        'Calidad de vida urbana: movilidad, conveniencia y esparcimiento en un solo lugar',
        'Oportunidad de diversificación inmobiliaria para residentes e inversionistas'
      ],
      distribucionFooter: 'Armonía redefine la experiencia urbana en Panamá al integrar vivienda, comercio y turismo en una ubicación insuperable. Apartamentos de 1, 2 y 3 recámaras entre 45 m² y 71 m², desde $181,000 USD — una inversión que combina funcionalidad, rentabilidad y estilo de vida cosmopolita.'
    }
  },
  {
    name: 'Ventu',
    category: 'Ciudad',
    zone: 'Bella Vista, Ciudad de Panamá',
    type: 'renta',
    price: 136000,
    priceM2: '3,400',
    rentM2: 'Airbnb $90-140/noche',
    capRate: '8.5-11.0%',
    vacancy: '15%',
    area: '40-63 m²',
    beds: '1-2 rec.',
    amenities: ['Rooftop infinity pool', 'Co-working lounge', 'Smart home automation', 'Gym', 'Lobby bar'],
    tenant: 'Turistas, Viajeros de negocio',
    velocity: 'N/A',
    appreciation: '4.5%',
    tag: 'Airbnb Apto',
    delivery: 'Q2 2028',
    shortDesc: 'El apartamento perfecto para renta tipo Airbnb, con diseño smart-home en el mejor punto de Bella Vista.',
    story: {
      paragraphs: [
        'Imagina un activo que trabaja para ti las 24 horas, en la zona con mayor demanda de renta corta de la ciudad.',
        'Ventu nace de una pregunta simple: ¿qué pasaría si cada apartamento estuviera diseñado, desde el primer plano, para generar el mejor ingreso posible?',
        'Check-in automático, administración hotelera profesional y un diseño smart-home que enamora a cualquier huésped — tú solo recibes el reporte de ocupación.',
        'Bella Vista nunca duerme, y ahora tu inversión tampoco.'
      ],
      distribucionTitle: 'Un modelo hotelero, no solo un apartamento',
      distribucionIntro: 'Cada unidad se entrega lista para operar bajo Airbnb y Booking, con administración incluida desde el día uno.',
      modelos: ['Rooftop infinity pool', 'Co-working lounge', 'Smart home automation', 'Gimnasio', 'Lobby bar'],
      distribucionFooter: 'Apartamentos de 1 y 2 recámaras entre 40 m² y 63 m², desde $136,000 USD — cap rate proyectado de 8% a 12% anual.'
    }
  },
  {
    name: 'Oceana',
    category: 'Golf y Country Club',
    zone: 'Santa María Golf & CC',
    type: 'patrimonial',
    price: 446000,
    priceM2: '4,460',
    rentM2: '20-25',
    capRate: '5.2-6.5%',
    vacancy: '3%',
    area: '100-270 m²',
    beds: '2-3 rec.',
    amenities: ['Golf 18 hoyos Jack Nicklaus', 'Piscinas resort', 'Padel courts', 'Wellness spa', 'Club house'],
    tenant: 'Ejecutivos de multinacionales, C-Level',
    velocity: '1 mes',
    appreciation: '5.0%',
    tag: 'Golf Premium',
    delivery: 'Q4 2027',
    shortDesc: 'Residencias frente al campo de golf Jack Nicklaus, para quienes buscan exclusividad y patrimonio.',
    story: {
      paragraphs: [
        'Despierta con la niebla matutina sobre el único campo de golf Jack Nicklaus de Panamá, a pasos de tu propia terraza.',
        'Una obra maestra de detalle y diseño minimalista y moderno. Presentamos Oceana, una nueva joya en Santa María. Forma parte de nuestro desarrollo residencial Ocean Series, la perfecta combinación entre cómodos espacios y lujo excepcional, rodeado de la belleza natural del área y muy cerca de todo.',
        'Una comunidad cerrada a sólo 10 minutos de la ciudad que ofrece una vida tranquila y con alta privacidad; un lugar íntimo, seguro y cómodo; planificado para los gustos más exigentes, permitiendo a sus residentes gozar de un tranquilo estilo de vida, en un entorno seguro y bien planificado.',
        'Un proyecto residencial de lujo ubicado en Santa María Golf & Country Club, una de las zonas más exclusivas, seguras y con mayor plusvalía de Ciudad de Panamá. Este desarrollo inmobiliario premium ofrece apartamentos high-end, penthouses y unidades Flex Luxury, con diseños modernos, arquitectura minimalista y acabados importados de la más alta calidad.',
        'Vivir en Oceana Residences significa disfrutar de un entorno privado y sofisticado, a solo 10 minutos del centro de la ciudad y con acceso inmediato a los principales servicios médicos, zonas comerciales, colegios privados, restaurantes de primer nivel y al prestigioso campo de golf de Santa María. Es la combinación ideal de exclusividad, conectividad y bienestar.',
        'Este proyecto es perfecto tanto para familias que priorizan calidad de vida y seguridad, como para inversionistas que buscan rentabilidad garantizada en el mercado inmobiliario panameño, gracias a la alta demanda y al crecimiento sostenido de plusvalía en la zona de Costa del Este y Santa María.',
        'Respaldado por Grupo Los Pueblos, líder en desarrollos inmobiliarios de confianza en Panamá, Oceana Residences asegura una experiencia integral, desde el diseño arquitectónico hasta la entrega de la propiedad.'
      ],
      distribucionTitle: 'Por qué elegir Oceana Residences & Skyhomes',
      distribucionIntro: 'Estos son los motivos que hacen de este el desarrollo residencial más codiciado de Santa María:',
      modelos: [
        'Ubicación estratégica: Santa María, a minutos de Costa del Este y el centro de Panamá',
        'Estilo de vida exclusivo: comunidad cerrada con seguridad privada 24/7',
        'Plusvalía garantizada: zona de alta demanda inmobiliaria',
        'Opciones flexibles: apartamentos, skyhomes y penthouses de lujo',
        'Cercanía a colegios internacionales, hospitales, centros comerciales y parques naturales'
      ],
      distribucionFooter: 'Invierte en el proyecto inmobiliario más prestigioso de Santa María. Solicita información personalizada y asegura tu nueva residencia o propiedad de inversión en un entorno con los más altos estándares de calidad y valorización en Panamá.'
    }
  },
  {
    name: 'Ipanema',
    category: 'Ciudad',
    zone: 'Costa Sur, Ciudad de Panamá',
    type: 'disfrute',
    price: 283000,
    priceM2: '3,200',
    rentM2: '13-18',
    capRate: '6.0-7.2%',
    vacancy: '5%',
    area: '72-163 m²',
    beds: '1-3 rec.',
    amenities: ['Club deportivo', 'Gran piscina social', 'Gimnasio techado', 'Salón de eventos', 'Coworking space'],
    tenant: 'Familias medianas, Ejecutivos',
    velocity: '1-2 meses',
    appreciation: '4.0%',
    tag: 'Lujo Urbano',
    delivery: 'F1 Q1 2028, F2 Q4 2028',
    shortDesc: 'Amplios espacios sociales y deportivos en Costa Sur, ideal para familias que buscan calidad de vida en la ciudad.',
    story: {
      paragraphs: [
        'Inspirado por el océano, creado para la ciudad. Ipanema eleva el estándar de la vivienda de lujo en Panamá, ubicado en Costa del Mar, una de las comunidades residenciales más modernas, seguras y conectadas de Ciudad de Panamá.',
        'Sé parte de un paraíso donde el sol toca las aguas del océano creando hermosos juegos de luces y reflejos para deleitar a quien observa — una comunidad única en Costa del Mar y a minutos de Costa del Este, centro de grandes empresas multinacionales, hoteles, puntos gastronómicos y clubes.',
        'Apartamentos de lujo con vistas al Océano Pacífico y al skyline de la ciudad, diseño arquitectónico de vanguardia con espacios abiertos y luz natural, acabados de alto nivel y un enfoque wellness que promueve el equilibrio y el bienestar integral.',
        'Residir en Ipanema significa vivir en una comunidad de clase mundial: áreas verdes, tecnología avanzada de seguridad con vigilancia 24/7, zonas sociales de lujo, y una ubicación que integra lo mejor de la ciudad y la playa.',
        'Acceso inmediato al Corredor Sur, a minutos de Costa del Este, cerca de los principales colegios internacionales, centros médicos de prestigio, restaurantes gourmet y centros comerciales, con conectividad directa hacia el Aeropuerto Internacional de Tocumen.'
      ],
      distribucionTitle: 'Razones para invertir en Ipanema, Costa del Mar',
      distribucionIntro: 'La dirección definitiva para quienes buscan lujo, bienestar y rentabilidad en Ciudad de Panamá:',
      modelos: [
        'Exclusividad frente al mar, en una de las zonas residenciales más seguras de la ciudad',
        'Alta plusvalía garantizada, con demanda sostenida de familias y ejecutivos globales',
        'Infraestructura premium para vivir, trabajar y disfrutar',
        'Entorno wellness y sustentable que mejora la calidad de vida',
        'Ideal tanto para residencia permanente como para inversión de alto perfil'
      ],
      distribucionFooter: 'Un entorno inspirado en el mar que transforma tu rutina, tu descanso y tu inversión. Ven y descubre cómo puedes disfrutar de un estilo de vida equilibrado y enriquecedor en nuestro exclusivo complejo — te esperamos para que experimentes la vida en Ipanema.'
    }
  },
  {
    name: 'Bosco di Santa Maria',
    category: 'Golf y Country Club',
    zone: 'Santa María Golf & CC',
    type: 'patrimonial',
    price: 474000,
    priceM2: '3,800',
    rentM2: '16-22',
    capRate: '5.5-6.8%',
    vacancy: '4%',
    area: '100-296 m²',
    beds: '2-4 rec.',
    amenities: ['Jardín botánico privado', 'Piscinas naturales', 'Senderos de meditación', 'Gimnasio', 'Lounge social'],
    tenant: 'Familias ejecutivas de alto perfil',
    velocity: '1-2 meses',
    appreciation: '4.5%',
    tag: 'Lujo Biofílico',
    delivery: '2030',
    shortDesc: 'Arquitectura biofílica y jardines privados en Santa María, un refugio de bienestar para familias exigentes.',
    story: {
      paragraphs: [
        'Despierta entre paisajes verdes y el sonido del agua, en una comunidad exclusiva en Santa María, donde la paz y la naturaleza son parte de tus días.',
        'Cada residencia se integra de manera natural, en una distribución armoniosa de villas, apartamentos y penthouses de lujo en espacios de total distinción.',
        'Vive la experiencia única de residir en apartamentos exclusivos, con amplias terrazas que conectan directamente con este entorno natural incomparable.',
        'Sé parte de un Bosque residencial vertical, conectado por amenidades de alta gama, donde cada detalle está pensado para que vivas tus mejores momentos.'
      ],
      distribucionTitle: 'Una distribución pensada para vivir en equilibrio',
      distribucionIntro: 'Más de 30 modelos distintos se distribuyen de forma orgánica en el entorno, integrándose con áreas verdes, senderos y espacios comunes.',
      modelos: ['Attico Panoramico', 'Appartamenti Acquavita', 'Appartamenti Lago & Bosco', 'Villa Boschetto & Villa Giardino'],
      distribucionFooter: 'Residenciales distribuidos en: villas, apartamentos, residencias con piscina privada y penthouses exclusivos. Con espacios desde 100 m² hasta 478 m², adaptándose a diferentes estilos de vida y necesidades.'
    }
  },
  // ── Marina Panamá ──
  {
    name: 'The Palms',
    category: 'Marina Panamá',
    zone: 'Punta Pacifica, Islas Ocean Reef',
    type: 'patrimonial',
    price: 1200000,
    priceM2: '6,200',
    rentM2: '25-35',
    capRate: '5.0-6.0%',
    vacancy: '4%',
    area: '169-239 m²',
    beds: '2 rec.',
    amenities: ['Acceso a marina privada', 'Piscinas infinity vista al mar', 'Helipuerto', 'Yacht club concierge'],
    tenant: 'HNWI, Diplomáticos, C-Level',
    velocity: '1-2 meses',
    appreciation: '5.5%',
    tag: 'Isla Privada',
    delivery: 'ENTREGA INMEDIATA',
    shortDesc: 'Residencias frente al mar con marina privada y helipuerto, en la exclusividad de Ocean Reef Islands.',
    story: {
      paragraphs: [
        'Un refugio privado junto al mar, con la energía vibrante de la ciudad. The Palms Beach Resort es el primer "resort tipo isla" en Ciudad de Panamá, que mezcla arquitectura y diseño de vanguardia con un paisajismo y amenidades que te transportan a una isla remota.',
        'Un día en The Palms es un día entre la playa, terrazas, apartamentos diseñados para el mundo actual, espacios de coworking, plataformas de yoga, gazebos, un muelle donde se puede pescar y ver delfines, amplias piscinas con fire pits, bar y cocina de chef.',
        'The Palms fusiona de manera única la tranquilidad de un resort de playa con la energía cosmopolita de Ciudad de Panamá — un proyecto pionero en Punta Pacífica, diseñado para quienes buscan el equilibrio perfecto entre bienestar, lujo y conectividad global.',
        'Con arquitectura de vanguardia, diseño interior contemporáneo y paisajismo tropical, sus amenidades ofrecen un estilo de vida sin comparación: coworking, yoga y gazebos entre vegetación tropical, piscinas de borde infinito y muelle privado para actividades náuticas.',
        'Ubicado en el epicentro financiero y comercial de Panamá, a minutos de hospitales de referencia, centros comerciales internacionales como Multiplaza y Pacific Center, y el distrito bancario y corporativo de la ciudad.'
      ],
      distribucionTitle: 'Razones para elegir The Palms en Punta Pacífica',
      distribucionIntro: 'Un referente de la evolución urbanística de Ciudad de Panamá:',
      modelos: [
        'Ubicación premium: frente al mar, en una de las zonas más exclusivas de Panamá',
        'Estilo de vida híbrido: resort costero con infraestructura urbana moderna',
        'Alta plusvalía inmobiliaria: constante demanda de expatriados y ejecutivos internacionales',
        'Opciones de inversión flexibles: vivir, rentar a largo plazo o alquiler turístico premium',
        'Infraestructura de primer nivel, diseñada para bienestar, productividad y confort'
      ],
      distribucionFooter: 'Una oportunidad única para familias, inversionistas y profesionales globales que buscan calidad de vida, seguridad y rentabilidad. Invierte en The Palms y asegura una residencia donde la calma del mar y el dinamismo urbano se fusionan en un solo lugar.'
    }
  },
  {
    name: 'Ocean Reef Park',
    category: 'Marina Panamá',
    zone: 'Punta Pacifica, Islas Ocean Reef',
    type: 'patrimonial',
    price: 1700000,
    priceM2: '6,800',
    rentM2: '30-42',
    capRate: '5.2-6.5%',
    vacancy: '3%',
    area: '491-569 m²',
    beds: '3-4 rec.',
    amenities: ['Marina privada 180+ muelles', 'Wellness center', 'Tennis & Padel', 'Helipuertos de isla', 'Beach club privado'],
    tenant: 'Ultra HNWI, Inversionistas internacionales',
    velocity: '0.5-1 mes',
    appreciation: '5.5%',
    tag: 'Ultra Lujo Marino',
    delivery: 'Q2 2028',
    shortDesc: 'El desarrollo insignia de Ocean Reef: marina para 180+ yates, beach club privado y vistas ilimitadas al Pacífico.',
    story: {
      paragraphs: [
        'Tu hogar en el centro de la ciudad. Ocean Reef Park es un desarrollo exclusivo ubicado en los lotes 62-65 de Ocean Reef Islands, las primeras y únicas islas artificiales en el Océano Pacífico — donde sus residentes disfrutan de un estilo de vida isleño a solo minutos del corazón de Ciudad de Panamá.',
        'Ocean Reef Park no es simplemente un residencial, es el máximo referente de exclusividad inmobiliaria en Panamá y Latinoamérica. Ubicado justo frente a Punta Pacífica, este desarrollo marca un antes y un después en el concepto de vivir frente al mar.',
        'Aquí disfrutarás de un entorno insular privado con acceso directo a marinas privadas para yates y embarcaciones, un club de yates exclusivo con servicios de primer nivel, amenidades premium de estilo de vida de élite, y seguridad y privacidad absolutas con vigilancia 24/7.',
        'A solo minutos del corazón financiero y comercial de Ciudad de Panamá, Ocean Reef Park combina lo mejor de dos mundos: la serenidad del océano con la conectividad de una de las ciudades más prósperas y dinámicas de la región.',
        'Invertir aquí significa ser parte de una comunidad élite con infraestructura de nivel internacional, respaldo de Grupo Los Pueblos, y la seguridad de formar parte de uno de los proyectos residenciales costeros más prestigiosos y exclusivos de Latinoamérica.'
      ],
      distribucionTitle: 'Ocean Reef Park: sinónimo de prestigio y visión',
      distribucionIntro: 'Razones para elegir Ocean Reef Park:',
      modelos: [
        'Ubicación privilegiada: islas privadas frente a Punta Pacífica',
        'Alta plusvalía garantizada: desarrollo único en América Latina',
        'Acceso náutico exclusivo: marinas privadas y club de yates',
        'Diseño y confort de clase mundial: vistas panorámicas al Pacífico y al skyline de Panamá',
        'Segmento selecto: familias internacionales, ejecutivos globales y grandes inversionistas',
        'Esquema de sustentabilidad integrado en infraestructura y urbanismo'
      ],
      distribucionFooter: 'Haz de tu residencia un verdadero legado en Panamá. Con el sello de confianza de Grupo Los Pueblos y el diferencial único de estar en las únicas islas privadas urbanas del Pacífico, Ocean Reef Park representa la dirección definitiva para quienes buscan lujo, privacidad y plusvalía sostenida.'
    }
  },
  // ── Playa ──
  {
    name: 'Aires del Mar',
    category: 'Playa',
    zone: 'Playa Caracol, Chame',
    type: 'renta',
    price: 143000,
    priceM2: '2,900',
    rentM2: 'Vacacional $100-150/noche',
    capRate: '7.5-9.0%',
    vacancy: '12%',
    area: '42-71 m²',
    beds: '2-3 rec.',
    amenities: ['Frente al mar', 'Surf club', 'Piscinas familiares', 'Beach bar', 'Seguridad 24/7'],
    tenant: 'Turistas de playa, Familias fin de semana',
    velocity: '2-3.5 meses',
    appreciation: '4.0%',
    tag: 'Playa Asequible',
    delivery: 'INMEDIATA, Q4 2026',
    shortDesc: 'Tu segunda casa en la playa, con acceso directo al mar y precios accesibles en Playa Caracol.',
    story: {
      paragraphs: [
        'Un lugar donde tu visión de una vida perfecta se da entre el mar y el verdor de nuestro interior. Aires del Mar es una joya residencial ubicada en la exclusiva comunidad de Playa Caracol, Chame, donde la tranquilidad del océano y la naturaleza se integran para crear un estilo de vida único.',
        'Los Garden Apartments están diseñados para ofrecer funcionalidad y bienestar en todo momento: unidades de 2 y 3 recámaras, diseños modernos con espacios abiertos y ventilación natural, áreas sociales integradas y jardines privados, con vistas privilegiadas hacia el Cerro Chame.',
        'Al integrarse dentro del desarrollo maestro de Playa Caracol, los residentes también tienen acceso a un concepto completo de vida costera: más de 1 km de playa privada de arena blanca, un club de surf exclusivo, y senderos naturales que promueven un estilo de vida activo y saludable.',
        'Situado en Chame, Panamá Oeste, a tan solo 1 hora de Ciudad de Panamá, con conexión directa a la Carretera Panamericana y cercanía a Coronado, donde están los supermercados, bancos, restaurantes y clínicas privadas.',
        'Al elegir Aires del Mar no solo adquieres una propiedad frente al mar, sino también el acceso a un entorno vibrante, saludable y con proyección turística internacional, donde el contacto con la playa y la naturaleza forma parte de la rutina diaria.'
      ],
      distribucionTitle: 'Razones para invertir en Aires del Mar, Playa Caracol',
      distribucionIntro: 'Una inversión con estilo de vida incluido:',
      modelos: [
        'Alta plusvalía asegurada en una zona turística en plena expansión',
        'Ideal para residencia permanente, segunda vivienda o alquiler vacacional',
        'Diseño familiar y biofílico que promueve la armonía con la naturaleza',
        'Comunidad cerrada y segura con amenidades de resort',
        'Respaldo de un proyecto integrado dentro de Playa Caracol'
      ],
      distribucionFooter: 'Aires del Mar en Playa Caracol es la oportunidad perfecta para invertir o vivir en un espacio exclusivo junto al océano. Apartamentos de 2 y 3 recámaras desde 42 m², desde $143,000 USD — cap rate de 7.5% a 9% anual.'
    }
  },
  {
    name: 'The Tides',
    category: 'Playa',
    zone: 'Playa Caracol, Chame',
    type: 'disfrute',
    price: 278000,
    priceM2: '3,000',
    rentM2: '12-16',
    capRate: '6.0-7.5%',
    vacancy: '8%',
    area: '99 m²',
    beds: '2-3 rec.',
    amenities: ['Acceso directo playa 1.2km', 'Surf camp y escuela', 'Gran piscina resort', 'Club house social'],
    tenant: 'Parejas retiradas, Familias vacacionales',
    velocity: '2-3 meses',
    appreciation: '4.5%',
    tag: 'Frente al Océano',
    delivery: 'ENTREGA INMEDIATA',
    shortDesc: 'Frente al mar con 1.2 km de playa privada y escuela de surf — el balance perfecto entre inversión y disfrute.',
    story: {
      paragraphs: [
        'Ubicado en la hermosa playa de Chame, a 74 km de Ciudad de Panamá, The Tides forma parte del único residencial de playa con más de un kilómetro de arena blanca y vistas ininterrumpidas al Océano Pacífico y al Cerro Chame.',
        '62 townhouses exclusivos de 2 y 3 recámaras desde 81 m², con entrada independiente, patio privado y a solo 80 metros del mar — la privacidad de una casa, con la vida de un resort de playa.',
        'Un desarrollo de Grupo Los Pueblos que redefine la experiencia de vivir frente al mar en Panamá: casas unifamiliares y townhouses de dos niveles pensados para familias modernas, junto a apartamentos de 2 y 3 recámaras ideales tanto para residencia permanente como para inversión turística.',
        'Vivir en The Tides significa disfrutar del Vento Beach Club, un surf club único en la región, múltiples piscinas, canchas deportivas, áreas de BBQ, pet parks y hasta un mercado de conveniencia dentro de la comunidad — todo a pasos de tu puerta.',
        'A solo 74 km de Ciudad de Panamá por la Carretera Panamericana, con acceso ágil a supermercados, hospitales y comercios de Panamá Oeste — la playa, sin perder la conectividad.'
      ],
      distribucionTitle: 'Un estilo de vida que enamora',
      distribucionIntro: 'Deportes acuáticos, bienestar, gastronomía y naturaleza — todo integrado en la experiencia Playa Caracol.',
      modelos: [
        'Vento Beach Club · Allora Ristorante · Beach Break Bar',
        'Surf Club · clases, alquiler de equipo y tienda',
        'Canchas deportivas · básquetbol, tenis, vóley playa',
        'Múltiples piscinas y áreas de BBQ',
        'Pet Parks y Caracol Market'
      ],
      distribucionFooter: 'Ubicación estratégica, alta plusvalía en una zona de crecimiento turístico, seguridad 24/7 y el respaldo de Grupo Los Pueblos — The Tides es perfecto para familias que buscan un estilo de vida playero único, jubilados que desean tranquilidad frente al mar, o inversionistas que buscan rentas turísticas de alta rentabilidad. Da el siguiente paso y asegura tu espacio en The Tides, Playa Caracol.'
    }
  },
  {
    name: 'Brisas del Mar',
    category: 'Playa',
    zone: 'Playa Caracol, Chame',
    type: 'disfrute',
    price: 276000,
    priceM2: '2,950',
    rentM2: '12-15',
    capRate: '5.8-7.2%',
    vacancy: '8%',
    area: '93-108 m²',
    beds: '2-3 rec.',
    amenities: ['Club de playa Brisas', 'Jacuzzis comunitarios', 'Beach volley court', 'Área de asados y hamacas'],
    tenant: 'Familias de segunda residencia',
    velocity: '2-3 meses',
    appreciation: '4.0%',
    tag: 'Segunda Residencia',
    delivery: 'ENTREGA INMEDIATA',
    shortDesc: 'Club de playa privado y ambiente familiar, ideal como segunda residencia frente al mar en Chame.',
    story: {
      paragraphs: [
        'Las mejores memorias familiares no se planean, se construyen fin de semana tras fin de semana en el mismo lugar. Brisas del Mar es ese lugar.',
        'Un club de playa privado, jacuzzis comunitarios y un área de asados donde las tardes se alargan sin que nadie lo note.',
        'Pensado para la familia que quiere una segunda residencia real — no un apartamento vacío la mayor parte del año.',
        'Entrega inmediata: las próximas vacaciones ya pueden ser aquí.'
      ],
      distribucionTitle: 'Ambiente familiar frente al mar',
      distribucionIntro: 'Unidades espaciosas pensadas para estadías largas en familia, con áreas comunes diseñadas para la convivencia.',
      modelos: ['Club de playa Brisas', 'Jacuzzis comunitarios', 'Cancha de beach volley', 'Área de asados y hamacas'],
      distribucionFooter: 'Apartamentos de 2 y 3 recámaras entre 93 m² y 108 m², desde $276,000 USD — cap rate de 5.8% a 7.2% anual.'
    }
  },
  {
    name: 'Olas del Mar',
    category: 'Playa',
    zone: 'Playa Caracol, Chame',
    type: 'disfrute',
    price: 267000,
    priceM2: '2,900',
    rentM2: '11-15',
    capRate: '5.8-7.5%',
    vacancy: '8%',
    area: '69-97 m²',
    beds: '2-3 rec.',
    amenities: ['Mirador a las olas', 'Piscinas infinitas', 'Gimnasio equipado', 'Senderos para caminar'],
    tenant: 'Surfistas, Familias',
    velocity: '2.5-3.5 meses',
    appreciation: '4.2%',
    tag: 'Disfrute Costero',
    delivery: 'ENTREGA INMEDIATA',
    shortDesc: 'Piscinas infinitas con vista a las olas — disfrute costero para quienes buscan tranquilidad frente al Pacífico.',
    story: {
      paragraphs: [
        'El lugar para tu estadía inolvidable en Chame. Aquí es donde la mejor vida frente al mar te espera — arrullado por las olas, los amaneceres y atardeceres más hermosos. Un lugar para festejar, descansar y disfrutar de lo que la playa te ofrece.',
        'Olas del Mar es uno de los desarrollos residenciales más sofisticados dentro de Playa Caracol, Chame, creado para quienes desean un estilo de vida frente al océano con un entorno natural único. Imagina despertar cada día a pasos del Océano Pacífico, rodeado de la imponente vista del Cerro Chame y con acceso directo a más de un kilómetro de playa de arena blanca.',
        'Apartamentos de 2 y 3 recámaras desde 70 m² en edificios de baja densidad, con arquitectura contemporánea, amplios balcones que aprovechan al máximo la vista al mar y la brisa costera, y acabados de alta calidad pensados para durabilidad y confort.',
        'Residir en Olas del Mar es sumergirse en un ambiente familiar y seguro, enriquecido con amenidades estilo resort: piscinas para adultos y niños, áreas deportivas y espacios recreativos, seguridad integral con monitoreo 24/7, y senderos naturales que promueven la conexión con la naturaleza.',
        'El proyecto está situado en Chame, Panamá Oeste, a menos de 1 hora y 15 minutos de Ciudad de Panamá por la Carretera Panamericana, cerca de supermercados, farmacias y comercios en Coronado y alrededores.'
      ],
      distribucionTitle: 'Razones para invertir en Olas del Mar, Playa Caracol',
      distribucionIntro: 'Apostar por la calidad de vida frente al océano, en un entorno de privacidad, naturaleza y plusvalía en crecimiento:',
      modelos: [
        'Experiencia de vida exclusiva: apartamentos frente al mar con entorno de montaña y playa',
        'Alta rentabilidad: demanda de alquileres vacacionales y turísticos todo el año',
        'Infraestructura consolidada dentro de Playa Caracol: club de surf y áreas sociales',
        'Ambiente familiar y seguro, ideal para residencia permanente o segunda casa',
        'Revalorización asegurada por el crecimiento de la zona oeste y la cercanía a la capital'
      ],
      distribucionFooter: 'Apartamentos de 2 y 3 recámaras desde 70 m², desde $267,000 USD — cap rate de 5.8% a 7.5% anual. Área social con piscina, solarium, juegos infantiles, pérgolas y BBQ.'
    }
  },
  {
    name: 'Surfside',
    category: 'Playa',
    zone: 'Playa Caracol, Chame',
    type: 'disfrute',
    price: 314000,
    priceM2: '3,200',
    rentM2: '14-18',
    capRate: '6.0-7.8%',
    vacancy: '9%',
    area: '81-107 m²',
    beds: '2-3 rec.',
    amenities: ['Piscina frente a playa', 'Aparthotel boutique', 'Surf lounge', 'Área BBQ al aire libre'],
    tenant: 'Surfistas pro, Expatriados',
    velocity: '2-3 meses',
    appreciation: '4.5%',
    tag: 'Estilo de Vida Playero',
    delivery: 'ENTREGA INMEDIATA',
    shortDesc: 'Un estilo de vida playero auténtico, con lounge de surf y aparthotel boutique en Playa Caracol.',
    story: {
      paragraphs: [
        'Surfside es un complejo de uso mixto frente al mar, ubicado dentro de Playa Caracol, un residencial de playa privado. Encarna el verdadero espíritu de la vida playera en Panamá, combinando naturaleza, deporte y lujo frente al mar, con apartamentos de 2 y 3 recámaras perfectos tanto para vivir como para invertir en alquileres vacacionales.',
        'Unidades modernas con distribución funcional y acabados de calidad, vistas espectaculares al Océano Pacífico con ventanales panorámicos y techos altos, materiales diseñados para resistir el clima costero, y acceso directo a la playa — ideal para surfistas, familias y amantes de la naturaleza.',
        'Está compuesto por un hotel, club y apartamentos. Su extraordinaria ubicación permite que sea lo suficientemente reservado para brindar tranquilidad, pero a la vez lo suficientemente cerca de todo para ofrecer acceso a los principales servicios, lugares de compras y aventuras. El proyecto ofrece la oportunidad de escoger entre comprar un apartamento o invertir en una habitación del aparthotel.',
        'Al ser parte de la comunidad de Playa Caracol, los residentes de Surfside disfrutan de un club de surf exclusivo con olas perfectas para todos los niveles, piscinas para adultos y niños, áreas sociales, deportivas y parques infantiles, y seguridad 24/7 en un entorno planificado y privado.',
        'En Chame, Panamá Oeste, a poco más de 1 hora de Ciudad de Panamá, a minutos de Coronado y sus servicios — supermercados, hospitales, colegios y comercios — en una zona con importante flujo turístico nacional e internacional.'
      ],
      distribucionTitle: 'Razones para invertir en Surfside, Playa Caracol',
      distribucionIntro: 'Más que un hogar vacacional: una inversión inteligente en recreación, bienestar y calidad de vida en el Pacífico panameño.',
      modelos: [
        'Estilo de vida activo: surf, deportes de playa y contacto directo con la naturaleza',
        'Alta plusvalía y demanda turística, clave para rentabilidad en alquileres vacacionales',
        'Amenidades de resort dirigidas a familias, jubilados y turistas internacionales',
        'Oportunidad de compra en una comunidad vibrante en constante crecimiento',
        'Respaldo de un desarrollo planificado con gran proyección en el mercado costero'
      ],
      distribucionFooter: 'Apartamentos de 2 y 3 recámaras entre 81 m² y 107 m², desde $314,000 USD — cap rate de 6% a 7.8% anual. Comprar en Surfside es invertir en calidad de vida, recreación y un estilo de vida soñado junto al mar.'
    }
  },
  {
    name: 'Beachwalk',
    category: 'Playa',
    zone: 'Playa Caracol, Chame',
    type: 'disfrute',
    price: 297000,
    priceM2: '3,300',
    rentM2: '13-17',
    capRate: '6.2-7.8%',
    vacancy: '8%',
    area: '85-97 m²',
    beds: '2-3 rec.',
    amenities: ['Paseo marítimo peatonal', 'Spa & sauna wellness', 'Yoga deck al atardecer', 'Piscinas de nado'],
    tenant: 'Parejas, Amantes del bienestar',
    velocity: '2-3 meses',
    appreciation: '4.5%',
    tag: 'Bienestar Marino',
    delivery: 'Q1 2027',
    shortDesc: 'Paseo marítimo peatonal, spa y yoga al atardecer — bienestar frente al mar en Playa Caracol.',
    story: {
      paragraphs: [
        'Beachwalk te invita a vivir una experiencia única que redefine el bienestar. Es la propuesta definitiva para quienes desean disfrutar el lujo de un resort de playa con propiedad privada, en Playa Caracol, Chame — combinando diseño contemporáneo, privacidad y acceso directo a la orilla del mar.',
        'Este exclusivo proyecto está diseñado bajo el concepto de well-being, donde cada detalle está pensado para conectar cuerpo, mente y espíritu con la naturaleza y el lujo contemporáneo: condominios exclusivos de arquitectura moderna, piscinas estilo infinity con vistas al Pacífico, espacios gourmet, gimnasio equipado y terrazas panorámicas.',
        '34 residencias privadas desde 68 m², distribuidas en 6 torres de condominio junto al océano, con 4 apartamentos por piso — un diseño biofílico y materiales sostenibles que promueven armonía ambiental y bienestar.',
        'Vivir en Beachwalk es tener acceso a una comunidad cerrada y segura, ideal tanto para familias que buscan un entorno funcional, como para parejas y jubilados que desean calma frente al mar, o inversionistas interesados en plusvalía y turismo costero.',
        'A tan solo 1 hora de Ciudad de Panamá por la Carretera Panamericana, conectado con otras provincias y playas del interior como San Carlos y Coronado, dentro de una de las comunidades playeras mejor valoradas de Panamá Oeste.'
      ],
      distribucionTitle: 'Razones para invertir en Beachwalk, Playa Caracol',
      distribucionIntro: 'Apostar por un estilo de vida costero exclusivo, sostenible y con alto potencial de rentabilidad:',
      modelos: [
        'Resort living en propiedad privada con acceso directo al mar',
        'Amenidades de primer nivel: pabellón de masajes en la playa, gimnasio, área de juegos, anfiteatro',
        'Plusvalía sostenida por la creciente demanda de segundas residencias',
        'Entorno seguro dentro de un proyecto planificado con infraestructura completa',
        'Sustentabilidad y diseño biofílico que garantizan valor a largo plazo'
      ],
      distribucionFooter: '34 residencias privadas desde 68 m², desde $297,000 USD — cap rate de 6.2% a 7.8% anual.'
    }
  },
]

// ─── Project Photo Mapping ─────────────────────────────────────
export const PROJECT_IMG: Record<string, { main: string; gallery: string[] }> = {
  'Armonia': { main: 'https://glp.com.pa/wp-content/uploads/2026/05/armonia-1.webp', gallery: ['https://glp.com.pa/wp-content/uploads/2026/05/armonia-1.webp'] },
  'Ventu': { main: 'https://glp.com.pa/wp-content/uploads/2026/05/armonia-1.webp', gallery: ['https://glp.com.pa/wp-content/uploads/2026/05/armonia-1.webp'] },
  'Oceana': { main: '/img/projects/oceana.jpg', gallery: ['/img/projects/oceana-g_1.jpg', '/img/projects/oceana-g_2.jpg', '/img/projects/oceana-g_3.jpg'] },
  'Ipanema': { main: '/img/projects/ipanema.jpg', gallery: ['/img/projects/ipanema-g_1.jpg', '/img/projects/ipanema-g_2.jpg', '/img/projects/ipanema-g_3.jpg'] },
  'Bosco di Santa Maria': { main: 'https://glp.com.pa/wp-content/uploads/2026/05/casabosco.webp', gallery: ['https://glp.com.pa/wp-content/uploads/2026/05/casabosco.webp', 'https://glp.com.pa/wp-content/uploads/2026/05/bosco-torres.webp', 'https://glp.com.pa/wp-content/uploads/2025/11/bosco.webp'] },
  'The Palms': { main: '/img/projects/the-palms.jpg', gallery: ['/img/projects/the-palms-g_1.jpg'] },
  'Ocean Reef Park': { main: 'https://glp.com.pa/wp-content/uploads/2026/05/ocean_reef.webp', gallery: ['https://glp.com.pa/wp-content/uploads/2026/05/ocean_reef.webp', 'https://glp.com.pa/wp-content/uploads/2025/07/apartamentos-de-lujo-en-panama-1.webp'] },
  'Aires del Mar': { main: '/img/projects/aires-del-mar.jpg', gallery: ['/img/projects/aires-del-mar-g_1.jpg', '/img/projects/aires-del-mar-g_2.jpg', '/img/projects/aires-del-mar-g_3.jpg'] },
  'The Tides': { main: '/img/projects/the-tides.jpg', gallery: ['/img/projects/the-tides-g_1.jpg', '/img/projects/the-tides-g_2.jpg', '/img/projects/the-tides-g_3.jpg'] },
  'Brisas del Mar': { main: '/img/projects/surfside.jpg', gallery: ['/img/projects/surfside-g_1.jpg', '/img/projects/surfside-g_2.jpg', '/img/projects/surfside-g_3.jpg'] },
  'Olas del Mar': { main: '/img/projects/olas-del-mar.jpg', gallery: ['/img/projects/olas-del-mar-g_1.jpg', '/img/projects/olas-del-mar-g_2.jpg', '/img/projects/olas-del-mar-g_3.jpg'] },
  'Surfside': { main: '/img/projects/surfside.jpg', gallery: ['/img/projects/surfside-g_1.jpg', '/img/projects/surfside-g_2.jpg', '/img/projects/surfside-g_3.jpg'] },
  'Beachwalk': { main: '/img/projects/beachwalk.jpg', gallery: ['/img/projects/beachwalk-g_1.jpg', '/img/projects/beachwalk-g_2.jpg', '/img/projects/beachwalk-g_3.jpg'] }
}
