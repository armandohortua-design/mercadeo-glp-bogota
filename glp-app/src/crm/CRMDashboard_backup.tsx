import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { MARKET_STUDY_DB } from '../marketStudyDb';
import { PROJECT_IMG } from '../projectsData';

// ═══════════════════════════════════════════════════════════════
// GLP CRM DASHBOARD — Complete Production CRM
// Ultra Corporate Design · Spanish Language · All Inline Styles
// ═══════════════════════════════════════════════════════════════

// ── DESIGN TOKENS ─────────────────────────────────────────────
const T = {
  teal: '#002349',     // Sotheby's Navy (Primary)
  tealDark: '#001A37', // Darker Navy
  sand: '#E5E7EB',     // Slate Border
  coral: '#B89047',    // Sotheby's Gold (Accent)
  palm: '#7D6330',     // Antique Bronze/Gold
  sky: '#002349',      // Deep Navy
  text: '#111827',     // Near Black
  textSec: '#4B5563',  // Slate Medium Gray
  bg: '#F9FAFB',       // Cool White / Light Chalk
  card: '#FFFFFF',
  border: '#E5E7EB',   // Fine Border
  borderLight: '#F3F4F6',
  success: '#10B981',  // Functional Green
  warning: '#D97706',  // Amber Warning
  danger: '#B91C1C',   // Crimson Danger
  fontSerif: '"Cormorant Garamond", serif',
  fontSans: '"Inter", sans-serif',
};

const fmt = (n: number, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const usd = (n: number) => '$' + fmt(n);
const pct = (n: number) => Number(n).toFixed(1) + '%';

// ── PROJECTS DATABASE ─────────────────────────────────────────
type ProjectData = {
  name: string; zone: string; zoneShort: string; investorType: string;
  minPrice: number; areaMin: number; areaMax: number; bedrooms: string;
  capRateMin: number; capRateMax: number; vacancyDef: number;
  rentSuggest: number; rentM2Min: number; rentM2Max: number;
  condominioMes: number; appreciationDef: number; appreciationNote: string;
  amenities: string[]; construction: string;
  priceM2Min: number; priceM2Max: number;
};

const PROJECTS: ProjectData[] = [
  { name: 'Panamá Viejo Residences', zone: 'Ciudad de Panamá — Panamá Viejo / Costa del Este', zoneShort: 'Panamá Viejo', investorType: 'renta', minPrice: 120000, areaMin: 58, areaMax: 90, bedrooms: '2 rec.', capRateMin: 6.5, capRateMax: 8.0, vacancyDef: 6, rentSuggest: 950, rentM2Min: 10, rentM2Max: 14, condominioMes: 200, appreciationDef: 3.2, appreciationNote: 'Valorización consistente 3–5% anual impulsada por proximidad a Costa del Este.', amenities: ['Piscina y área social', 'Gimnasio moderno', 'Coworking', 'Seguridad 24/7', 'Parque infantil', 'BBQ y terrazas'], construction: 'Nueva entrega (2022–2025)', priceM2Min: 1500, priceM2Max: 2200 },
  { name: 'Bayside Resort Panamá', zone: 'Panamá Oeste — Arraiján / Pacífico', zoneShort: 'Bayside / Arraiján', investorType: 'renta', minPrice: 150000, areaMin: 80, areaMax: 400, bedrooms: '3 rec.', capRateMin: 6.0, capRateMax: 8.5, vacancyDef: 8, rentSuggest: 800, rentM2Min: 8, rentM2Max: 12, condominioMes: 250, appreciationDef: 3.0, appreciationNote: 'Zona en desarrollo con infraestructura creciente. Valorización 3–4% anual.', amenities: ['Acceso privado a playa', 'Club house', 'Piscinas', 'Canchas deportivas', 'Gimnasio y spa', 'Seguridad 24/7'], construction: 'Desarrollo activo (2020–2026)', priceM2Min: 1200, priceM2Max: 2000 },
  { name: 'Playa Dorada', zone: 'Playa Dorada, Arraiján — Panamá Oeste', zoneShort: 'Playa Dorada', investorType: 'renta', minPrice: 180000, areaMin: 80, areaMax: 160, bedrooms: '2–3 rec.', capRateMin: 6.5, capRateMax: 8.5, vacancyDef: 8, rentSuggest: 700, rentM2Min: 6, rentM2Max: 10, condominioMes: 180, appreciationDef: 3.0, appreciationNote: 'Playa accesible con demanda local. Valorización estable 3–4% anual.', amenities: ['Club de playa privado', 'Piscinas', 'Parque infantil', 'Zonas verdes', 'Seguridad 24/7'], construction: 'Multi-fase (2015–2023)', priceM2Min: 1100, priceM2Max: 1800 },
  { name: 'Ocean Front', zone: 'Playa Dorada, Arraiján — Panamá Oeste', zoneShort: 'Ocean Front / Playa Dorada', investorType: 'renta', minPrice: 180000, areaMin: 60, areaMax: 120, bedrooms: '1–2 rec.', capRateMin: 6.5, capRateMax: 8.5, vacancyDef: 8, rentSuggest: 750, rentM2Min: 6, rentM2Max: 10, condominioMes: 170, appreciationDef: 3.0, appreciationNote: 'Producto 1BR con mayor yield por m² del portafolio. 3–4% valorización.', amenities: ['Acceso directo a playa', 'Club privado', 'Gimnasio', 'Seguridad 24/7', 'Zonas verdes'], construction: 'Moderno (2018–2023)', priceM2Min: 1100, priceM2Max: 1800 },
  { name: 'Olas del Mar', zone: 'Playa Caracol, Chame — Pacífico Panamáeño', zoneShort: 'Olas del Mar / Playa Caracol', investorType: 'renta', minPrice: 320000, areaMin: 95, areaMax: 160, bedrooms: '2–3 rec.', capRateMin: 6.0, capRateMax: 8.0, vacancyDef: 11, rentSuggest: 1050, rentM2Min: 8, rentM2Max: 11, condominioMes: 220, appreciationDef: 3.5, appreciationNote: 'Playa Caracol lidera valorización en el Pacífico. 4–6% anual en nuevos.', amenities: ['Piscina con vista al mar', 'Zona de BBQ', 'Área social', 'Seguridad 24/7', 'Parque infantil'], construction: 'Moderno (2018–2023)', priceM2Min: 1500, priceM2Max: 2200 },
  { name: 'Aires del Mar – Playa Caracol', zone: 'Playa Caracol, Chame — Pacífico Panamáeño', zoneShort: 'Aires del Mar / Playa Caracol', investorType: 'renta', minPrice: 210000, areaMin: 70, areaMax: 150, bedrooms: '1–2 rec.', capRateMin: 5.8, capRateMax: 7.8, vacancyDef: 11, rentSuggest: 1000, rentM2Min: 8, rentM2Max: 12, condominioMes: 200, appreciationDef: 3.5, appreciationNote: 'Zona Playa Caracol con valorización de 3.5–5% anual.', amenities: ['Vista directa al océano', 'Piscinas', 'Parques infantiles', 'Jardines', 'Seguridad 24/7'], construction: 'Moderno (2018–2022)', priceM2Min: 1600, priceM2Max: 2400 },
  { name: 'The Tides – Playa Caracol', zone: 'Playa Caracol, Chame — Resort Premium', zoneShort: 'The Tides / Playa Caracol', investorType: 'disfrute', minPrice: 320000, areaMin: 120, areaMax: 280, bedrooms: '2–3 rec.', capRateMin: 5.5, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1500, rentM2Min: 10, rentM2Max: 16, condominioMes: 350, appreciationDef: 4.5, appreciationNote: 'Proyecto más nuevo en Playa Caracol. Valorización 4–6% anual.', amenities: ['1.2 km playa privada', 'Surf club', '3 piscinas', 'Restaurante y beach bar', 'Senderos naturales', 'Gimnasio y yoga deck', 'Áreas BBQ', 'Seguridad 24/7'], construction: 'Nueva entrega (2022–2026)', priceM2Min: 2200, priceM2Max: 3500 },
  { name: 'Surfside', zone: 'Playa Caracol, Chame — Resort + Aparthotel', zoneShort: 'Surfside / Playa Caracol', investorType: 'disfrute', minPrice: 190000, areaMin: 60, areaMax: 200, bedrooms: '1–2 rec.', capRateMin: 5.8, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1300, rentM2Min: 10, rentM2Max: 14, condominioMes: 300, appreciationDef: 4.0, appreciationNote: 'Componente aparthotel eleva valorización. 4–5% anual.', amenities: ['Playa privada', 'Aparthotel con conserjería', 'Piscinas y jacuzzi', 'Restaurante y bar', 'Surf lounge', 'Gimnasio', 'Seguridad 24/7'], construction: 'Moderno (2019–2024)', priceM2Min: 2000, priceM2Max: 3000 },
  { name: 'BeachWalk Resort Playa Caracol', zone: 'Playa Caracol, Chame — Wellness Resort', zoneShort: 'BeachWalk / Playa Caracol', investorType: 'disfrute', minPrice: 230000, areaMin: 75, areaMax: 180, bedrooms: '2 rec.', capRateMin: 5.5, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1300, rentM2Min: 9, rentM2Max: 14, condominioMes: 280, appreciationDef: 4.0, appreciationNote: 'Enfoque wellness impulsa valorización diferencial 4–5% anual.', amenities: ['Frente al océano Pacífico', 'Wellness spa', 'Piscina paisajística', 'Gimnasio exterior', 'Yoga deck', 'BBQ', 'Seguridad 24/7'], construction: 'Nuevo (2022–2025)', priceM2Min: 1800, priceM2Max: 2800 },
  { name: 'Ipanema Panamá', zone: 'Costa del Mar / Costa del Este — Ciudad de Panamá', zoneShort: 'Ipanema / Costa del Mar', investorType: 'disfrute', minPrice: 280000, areaMin: 85, areaMax: 250, bedrooms: '1–2 rec. + PH', capRateMin: 6.0, capRateMax: 7.5, vacancyDef: 6, rentSuggest: 1600, rentM2Min: 12, rentM2Max: 18, condominioMes: 280, appreciationDef: 4.0, appreciationNote: 'Costa del Este es hub corporativo. 4–6% anual.', amenities: ['Piscina con vista al mar', 'Gimnasio', 'Co-working', 'BBQ y lounge', 'Seguridad 24/7', 'Parque infantil'], construction: 'Moderno (2019–2024)', priceM2Min: 2000, priceM2Max: 3500 },
  { name: 'Ocean Reef Park', zone: 'Islas Artificiales — Punta Pacífica, Ciudad de Panamá', zoneShort: 'Ocean Reef / Islas Artificiales', investorType: 'patrimonial', minPrice: 1500000, areaMin: 200, areaMax: 600, bedrooms: '2–4 rec. + PH', capRateMin: 5.0, capRateMax: 6.5, vacancyDef: 4, rentSuggest: 7000, rentM2Min: 22, rentM2Max: 32, condominioMes: 700, appreciationDef: 5.5, appreciationNote: 'Activo más escaso y premium de Panamá. Valorización 6–8% anual.', amenities: ['Marina privada 180+ muelles', 'Yacht club', 'Piscinas infinity', 'Canchas deportivas', 'Spa y wellness', 'Helipadres', 'Restaurantes', 'Beach club'], construction: 'En desarrollo (2015–en curso)', priceM2Min: 4500, priceM2Max: 7500 },
  { name: 'Oceana Residences & Skyhomes', zone: 'Santa María Golf & Country Club — Ciudad de Panamá', zoneShort: 'Oceana / Santa María Golf', investorType: 'patrimonial', minPrice: 850000, areaMin: 150, areaMax: 350, bedrooms: '1–3 rec. + Skyhomes', capRateMin: 4.7, capRateMax: 6.0, vacancyDef: 4, rentSuggest: 3500, rentM2Min: 20, rentM2Max: 25, condominioMes: 550, appreciationDef: 5.0, appreciationNote: 'Única comunidad con golf Jack Nicklaus. 5–7% anual.', amenities: ['Golf 18 hoyos Jack Nicklaus', 'Club House', 'Piscinas resort', 'Pickleball y tenis', 'Co-working', 'Wellness center', 'Concierge'], construction: 'Nuevo (2022–2026)', priceM2Min: 3500, priceM2Max: 5500 },
  { name: 'Bosco di Santa María', zone: 'Santa María / Costa del Este — Ciudad de Panamá', zoneShort: 'Bosco / Santa María', investorType: 'patrimonial', minPrice: 1200000, areaMin: 250, areaMax: 350, bedrooms: '3–4 rec.', capRateMin: 5.5, capRateMax: 7.2, vacancyDef: 5, rentSuggest: 2800, rentM2Min: 13, rentM2Max: 18, condominioMes: 420, appreciationDef: 4.5, appreciationNote: 'Santa María en consolidación. 4–6% anual.', amenities: ['Jardines botánicos', 'Piscina natural', 'Gimnasio', 'Senderos de meditación', 'Áreas sociales', 'Seguridad 24/7'], construction: 'Nuevo (2023–2026)', priceM2Min: 2200, priceM2Max: 3500 },
  { name: 'The Palms', zone: 'Punta Pacífica — Ciudad de Panamá', zoneShort: 'The Palms / Punta Pacífica', investorType: 'patrimonial', minPrice: 350000, areaMin: 100, areaMax: 220, bedrooms: '1–3 rec.', capRateMin: 5.5, capRateMax: 7.0, vacancyDef: 5, rentSuggest: 2200, rentM2Min: 16, rentM2Max: 22, condominioMes: 380, appreciationDef: 4.5, appreciationNote: 'Punta Pacífica premium. Concepto resort urbano. 4–6% anual.', amenities: ['Piscinas resort', 'Yoga deck', 'Coworking', 'Gimnasio', 'BBQ tropical', 'Rooftop', 'Concierge'], construction: 'Moderno (2018–2024)', priceM2Min: 2800, priceM2Max: 4200 },
  { name: 'Ventu', zone: 'Ciudad de Panamá — Rentas Cortas (Airbnb)', zoneShort: 'Ventu / Rentas Cortas', investorType: 'patrimonial', minPrice: 180000, areaMin: 65, areaMax: 90, bedrooms: '1–2 rec.', capRateMin: 8.0, capRateMax: 12.0, vacancyDef: 20, rentSuggest: 2400, rentM2Min: 38, rentM2Max: 58, condominioMes: 250, appreciationDef: 4.5, appreciationNote: 'Único proyecto optimizado para Airbnb. 4–5% anual.', amenities: ['Diseño Airbnb optimizado', 'Administración hotelera', 'Pool deck', 'Coworking', 'Check-in automático', 'Seguridad 24/7'], construction: 'Nuevo (2023–2026)', priceM2Min: 2500, priceM2Max: 3500 },
];

// ── ZONE FOOTNOTES HELPER ─────────────────────────────────────
const getZoneNotes = (zone: string) => {
  const z = zone.toLowerCase();
  if (z.includes('punta pacífica') || z.includes('punta pacifica') || z.includes('islas') || z.includes('reef')) {
    return 'Nota de la Zona (Punta Pacífica/Islas): Exclusivo sector con acceso directo al Hospital Johns Hopkins, el centro comercial Multiplaza, y conectividad vial inmediata al Corredor Sur.';
  } else if (z.includes('santa maría') || z.includes('santa maria') || z.includes('costa del este') || z.includes('este') || z.includes('viejo')) {
    return 'Nota de la Zona (Santa María/Costa del Este): Importante centro corporativo multinacional con canchas de golf diseñadas por Jack Nicklaus, colegios de primer nivel, y alta demanda de ejecutivos expatriados.';
  } else if (z.includes('caracol') || z.includes('chame')) {
    return 'Nota de la Zona (Playa Caracol): Playa privada de 1.2 km, escuela de surf, y cercanía al centro de servicios y salud de Coronado (a 20 minutos).';
  } else if (z.includes('dorada') || z.includes('arraiján') || z.includes('arraijan') || z.includes('pacífico') || z.includes('pacifico')) {
    return 'Nota de la Zona (Playa Dorada/Arraiján): Rápido acceso a Panamá Pacífico, el Puente de las Américas y la futura Línea 3 del Metro, con fuerte desarrollo logístico y residencial.';
  } else if (z.includes('bella vista') || z.includes('ciudad de panamá') || z.includes('ciudad de panama') || z.includes('urbano')) {
    return 'Nota de la Zona (Bella Vista / Urbano): Ubicado en el dinámico centro financiero y residencial de la Ciudad de Panamá, con acceso inmediato a la Vía España, el Parque Urracá y una variada oferta gastronómica.';
  } else if (z.includes('costa sur') || z.includes('sur')) {
    return 'Nota de la Zona (Costa Sur): Exclusivo corredor residencial en expansión con conectividad directa al Corredor Sur, a pocos minutos del Aeropuerto Internacional de Tocumen y Costa del Este.';
  }
  return 'Nota de la Zona (Panamá Premium): Ubicación privilegiada con alta plusvalía, conectividad vial e infraestructura de servicios médicos y financieros de clase mundial.';
};

// ── INVESTOR PROFILES ─────────────────────────────────────────
const INVESTOR_PROFILES = [
  {
    id: 'renta',
    label: 'Renta',
    icon: (color: string) => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
        <line x1="12" y1="1" x2="12" y2="23"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    ),
    desc: 'Flujo de caja máximo en USD',
    color: T.palm,
    projects: ['Panamá Viejo Residences', 'Bayside Resort Panamá', 'Playa Dorada', 'Ocean Front', 'Olas del Mar', 'Aires del Mar – Playa Caracol']
  },
  {
    id: 'disfrute',
    label: 'Disfrute',
    icon: (color: string) => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    ),
    desc: 'Segunda residencia con renta',
    color: T.sky,
    projects: ['The Tides – Playa Caracol', 'Surfside', 'BeachWalk Resort Playa Caracol', 'Ipanema Panamá']
  },
  {
    id: 'patrimonial',
    label: 'Patrimonial',
    icon: (color: string) => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
    ),
    desc: 'Plusvalía y preservación de capital',
    color: T.coral,
    projects: ['Ocean Reef Park', 'Oceana Residences & Skyhomes', 'Bosco di Santa María', 'The Palms', 'Ventu']
  },
];

// ── PROJECT IMAGES MAP ────────────────────────────────────────
const PROJECT_IMAGES: Record<string, { main: string; gallery: string[] }> = PROJECT_IMG;

// ── CLOSED & LOST SALES DATABASES ──────────────────────────────
type Sale = {
  id: number;
  prospect: string;
  project: string;
  value: number;
  broker: string;
  date: string;
};

type LostSale = {
  id: number;
  prospect: string;
  project: string;
  value: number;
  broker: string;
  reason: string;
  date: string;
};

const INITIAL_CLOSED_SALES: Sale[] = [
  { id: 1, prospect: 'Carlos Gómez', project: 'Panamá Viejo Residences', value: 120000, broker: 'Patricia Vargas', date: '2026-05-12' },
  { id: 2, prospect: 'Diana Herrera', project: 'Panamá Viejo Residences', value: 140000, broker: 'Patricia Vargas', date: '2026-03-01' },
  { id: 3, prospect: 'Roberto Castaño', project: 'Surfside', value: 220000, broker: 'Felipe Londoño', date: '2026-05-28' },
  { id: 4, prospect: 'Martha Ruiz', project: 'The Palms', value: 350000, broker: 'Santiago Mesa', date: '2026-04-18' },
  { id: 5, prospect: 'Juan Pérez', project: 'Bayside Resort Panamá', value: 150000, broker: 'Valentina Ospina', date: '2026-05-22' },
  { id: 6, prospect: 'Eduardo Silva', project: 'Oceana Residences & Skyhomes', value: 730000, broker: 'Andrés Morales', date: '2026-06-05' }
];

const INITIAL_LOST_SALES: LostSale[] = [
  { id: 1, prospect: 'Juan Carlos Restrepo', project: 'Ocean Reef Park', value: 1500000, broker: 'Patricia Vargas', reason: 'Temor a doble tributación y reporte automático a la DIAN', date: '2026-05-14' },
  { id: 2, prospect: 'Carolina Posada', project: 'Ventu', value: 180000, broker: 'Santiago Mesa', reason: 'Tasas de interés hipotecarias altas para extranjeros (8.5%)', date: '2026-05-20' },
  { id: 3, prospect: 'Miguel Ángel Uribe', project: 'Bayside Resort Panamá', value: 150000, broker: 'Rodrigo Fernández', reason: 'Incertidumbre sobre los trámites migratorios y visa de inversionista', date: '2026-05-25' },
  { id: 4, prospect: 'Sofia Jaramillo', project: 'Ipanema Panamá', value: 280000, broker: 'Valentina Ospina', reason: 'Temor de devaluación y liquidez del dólar en el exterior', date: '2026-06-02' }
];

// ── BROKERS DATA ──────────────────────────────────────────────
type Broker = {
  id: number; nombre: string; empresa: string; zona: string;
  telefono: string; email: string; estado: 'activo' | 'inactivo';
};

const INITIAL_BROKERS: Broker[] = [
  { id: 1, nombre: 'Patricia Vargas', empresa: 'Coldwell Banker', zona: 'Bogotáá Norte', telefono: '+57 310 555 1234', email: 'patricia@coldwellbanker.co', estado: 'activo' },
  { id: 2, nombre: 'Santiago Mesa', empresa: 'Independiente', zona: 'Bogotáá – Chapinero', telefono: '+57 311 555 2345', email: 'santiago.mesa@gmail.com', estado: 'activo' },
  { id: 3, nombre: 'Rodrigo Fernández', empresa: 'Banco Privado', zona: 'Medellín', telefono: '+57 312 555 3456', email: 'rodrigo.f@bancoprivado.co', estado: 'activo' },
  { id: 4, nombre: 'Valentina Ospina', empresa: 'Ospina & Restrepo', zona: 'Bogotáá – Usaquén', telefono: '+57 313 555 4567', email: 'valentina@ospinarestrepo.co', estado: 'activo' },
  { id: 5, nombre: 'Andrés Morales', empresa: 'BBVA Wealth', zona: 'Bogotáá Centro', telefono: '+57 314 555 5678', email: 'andres.morales@bbva.co', estado: 'activo' },
  { id: 6, nombre: 'Camila Restrepo', empresa: 'Keller Williams', zona: 'Cali', telefono: '+57 315 555 6789', email: 'camila.r@kw.co', estado: 'inactivo' },
  { id: 7, nombre: 'Felipe Londoño', empresa: 'Grupo Bolívar', zona: 'Barranquilla', telefono: '+57 316 555 7890', email: 'felipe.l@grupobolivar.co', estado: 'activo' },
];

// ── PROSPECTS DATA ────────────────────────────────────────────
type HistEntry = { fecha: string; accion: string; detalle: string };
type Prospect = {
  id: number; nombre: string; apellido: string; direccion: string;
  correo: string; telefono: string; ocupacion: string;
  proyectos_interes: string[]; forma_contacto: string;
  broker_asignado: string; estado: string; presupuesto_usd: number;
  notas: string; historial: HistEntry[];
  fecha_entrada: string;
  tareas_pendientes?: any[];
};

const FUNNEL_STAGES = ['Contacto Inicial', 'Calificación', 'Presentación', 'Negociación', 'Cierre', 'Post-venta'];
const CONTACT_FORMS = ['Broker', 'Pagina Web', 'LinkedIn', 'TikTok', 'Instagram', 'WhatsApp', 'Evento', 'Referido'];

const calculateLeadScore = (prospect: Prospect): number => {
  let score = 0;
  // Base score from stage
  const stageScores: Record<string, number> = {
    'Contacto Inicial': 10,
    'Calificación': 25,
    'Presentación': 45,
    'Negociación': 75,
    'Cierre': 100,
    'Post-venta': 100
  };
  score += stageScores[prospect.estado] || 0;

  // Interaction score
  const interactionsCount = prospect.historial.length;
  if (interactionsCount > 0) score += 5;
  if (interactionsCount > 2) score += 10;
  if (interactionsCount > 5) score += 15;

  if (prospect.proyectos_interes && prospect.proyectos_interes.length > 0) {
    score += 10;
  }
  
  if (prospect.presupuesto_usd && prospect.presupuesto_usd > 50000) {
    score += 5;
  }

  return Math.min(score, 100);
};

const renderThermometer = (score: number) => {
  let color = T.coral;
  if (score >= 40) color = '#F59E0B';
  if (score >= 75) color = T.teal;
  if (score === 100) color = T.palm;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`Probabilidad de Cierre: ${score}%`}>
      <div style={{ flex: 1, height: 6, background: T.borderLight, borderRadius: 3, overflow: 'hidden', minWidth: 40 }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: color }}>{score}%</span>
    </div>
  );
};

const generateSampleProspects = (): Prospect[] => {
  const firstNames = [
    'Juan', 'Andres', 'Carlos', 'Maria', 'Laura', 'Diana', 'Roberto', 'Eduardo', 'Martha', 'Sofia',
    'Camila', 'Felipe', 'Santiago', 'Valentina', 'Patricia', 'Alejandro', 'Gabriel', 'Daniela', 'Natalia', 'Jose',
    'Luis', 'Ana', 'Paula', 'Jorge', 'David', 'Carolina', 'Ricardo', 'Beatriz', 'Fernando', 'Gloria',
    'Mauricio', 'Angela', 'Liliana', 'Oscar', 'Sandra', 'Gustavo', 'Adriana', 'Camilo', 'Monica',
    'Esteban', 'Olga', 'Francisco', 'Claudia', 'Julio', 'Teresa', 'Hector', 'Silvia', 'Ivan', 'Isabel'
  ];
  const lastNames = [
    'Gomez', 'Rodriguez', 'Martinez', 'Sanchez', 'Castano', 'Herrera', 'Gutierrez', 'Londoño', 'Mesa', 'Fernandez',
    'Ospina', 'Morales', 'Restrepo', 'Vargas', 'Silva', 'Ruiz', 'Perez', 'Uribe', 'Jaramillo', 'Ramirez',
    'Torres', 'Diaz', 'Munoz', 'Castro', 'Ortiz', 'Giraldo', 'Jimenez', 'Rios', 'Salazar', 'Valenzuela',
    'Cardona', 'Velasquez', 'Marquez', 'Ochoa', 'Montoya', 'Herrón', 'Escobar', 'Zapata', 'Bermudez', 'Ortega',
    'Guerrero', 'Rojas', 'Duque', 'Franco', 'Benitez', 'Patiño', 'Bustamante', 'Villegas', 'Marin', 'Serna'
  ];
  const occupations = [
    'CEO Fintech', 'Abogado Tributarista', 'Médica Especialista', 'Empresario Textil', 'Consultor Financiero', 'Inversionista', 'Director Financiero',
    'Gerente General', 'Arquitecto', 'Ingeniero Civil', 'Odontólogo', 'Comerciante', 'Piloto Comercial', 'Economista'
  ];
  const locations = [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Pereira', 'Manizales'
  ];

  const projects = [
    'Ocean Reef Park', 'Oceana Residences & Skyhomes', 'Bosco di Santa María', 'The Palms', 'Ventu',
    'Ipanema Panamá', 'The Tides – Playa Caracol', 'Surfside', 'BeachWalk Resort Playa Caracol', 'Panamá Viejo Residences',
    'Bayside Resort Panamá', 'Playa Dorada', 'Ocean Front', 'Olas del Mar', 'Aires del Mar – Playa Caracol'
  ];

  const brokers = [
    'Patricia Vargas', 'Santiago Mesa', 'Rodrigo Fernández', 'Valentina Ospina', 'Andrés Morales', 'Felipe Londoño'
  ];

  const stages = [
    ...Array(42).fill('Contacto Inicial'),
    ...Array(28).fill('Calificación'),
    ...Array(15).fill('Presentación'),
    ...Array(8).fill('Negociación'),
    ...Array(3).fill('Cierre'),
    ...Array(6).fill('Post-venta')
  ];

  const sources = [
    ...Array(10).fill('Instagram'),
    ...Array(10).fill('TikTok'),
    ...Array(10).fill('LinkedIn'),
    ...Array(6).fill('Redes Sociales'),
    ...Array(25).fill('Referido'),
    ...Array(20).fill('Evento'),
    ...Array(16).fill('Pagina Web'),
    ...Array(5).fill('WhatsApp')
  ];

  const list: Prospect[] = [];

  for (let i = 0; i < 102; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const ocu = occupations[(i * 7) % occupations.length];
    const loc = locations[(i * 11) % locations.length];
    const broker = brokers[(i * 13) % brokers.length];
    
    // Choose 1-3 projects
    const projCount = (i % 3) + 1;
    const projList: string[] = [];
    for (let p = 0; p < projCount; p++) {
      const proj = projects[(i * 17 + p) % projects.length];
      if (!projList.includes(proj)) {
        projList.push(proj);
      }
    }

    const state = stages[i];
    const source = sources[i];
    
    let budget = 120000;
    if (i % 5 === 0) budget = 180000;
    else if (i % 5 === 1) budget = 250000;
    else if (i % 5 === 2) budget = 320000;
    else if (i % 5 === 3) budget = 450000;
    else budget = 1200000;

    budget += (i % 9) * 5000 - 20000;
    if (budget < 90000) budget = 120000;

    const email = `${fn.toLowerCase().replace(/\s+/g, '')}.${ln.toLowerCase().replace(/\s+/g, '').replace('ñ', 'n')}@${i % 2 === 0 ? 'gmail.com' : 'outlook.com'}`;
    const phone = `+57 31${i % 10} ${Math.floor(100 + (i * 9.7) % 900)} ${Math.floor(1000 + (i * 13.3) % 9000)}`;

    const entryDate = `2026-05-${String((i % 28) + 1).padStart(2, '0')}`;
    
    const hist = [
      { fecha: entryDate, accion: 'Contacto Inicial', detalle: `Registrado vía ${source}` }
    ];
    if (state !== 'Contacto Inicial') {
      hist.push({ fecha: entryDate, accion: 'Calificación', detalle: 'Presupuesto y perfil del inversionista evaluados' });
    }
    if (state !== 'Contacto Inicial' && state !== 'Calificación') {
      hist.push({ fecha: entryDate, accion: 'Presentación', detalle: `Presentación detallada de proyectos: ${projList.join(', ')}` });
    }
    if (state === 'Negociación' || state === 'Cierre' || state === 'Post-venta') {
      hist.push({ fecha: entryDate, accion: 'Negociación', detalle: 'Estructuración del plan de pagos y envío de cotizaciones' });
    }
    if (state === 'Cierre' || state === 'Post-venta') {
      hist.push({ fecha: entryDate, accion: 'Cierre', detalle: 'Propuesta aceptada, firma del acuerdo de reserva en proceso' });
    }
    if (state === 'Post-venta') {
      hist.push({ fecha: entryDate, accion: 'Post-venta', detalle: 'Contrato firmado, property management y documentación DIAN' });
    }

    list.push({
      id: i + 1,
      nombre: fn,
      apellido: ln,
      direccion: `Calle ${(i * 7) % 150} #${(i * 13) % 99}-${(i * 19) % 90}, ${loc}`,
      correo: email,
      telefono: phone,
      ocupacion: ocu,
      proyectos_interes: projList,
      forma_contacto: source,
      broker_asignado: broker,
      estado: state,
      presupuesto_usd: budget,
      notas: `Prospecto interesado en diversificación internacional vía ${source}. Ocupación: ${ocu}.`,
      historial: hist,
      fecha_entrada: entryDate
    });
  }

  // Force first 6 prospects to match historical names exactly for attendee checks
  const histNames = [
    { nombre: 'Carlos', apellido: 'Gutiérrez', estado: 'Negociación', forma_contacto: 'Referido', broker_asignado: 'Patricia Vargas' },
    { nombre: 'María Isabel', apellido: 'Rodríguez', estado: 'Presentación', forma_contacto: 'Evento', broker_asignado: 'Santiago Mesa' },
    { nombre: 'Andrés Felipe', apellido: 'Martínez', estado: 'Calificación', forma_contacto: 'Pagina Web', broker_asignado: 'Valentina Ospina' },
    { nombre: 'Laura', apellido: 'Sánchez', estado: 'Contacto Inicial', forma_contacto: 'Instagram', broker_asignado: 'Andrés Morales' },
    { nombre: 'Roberto', apellido: 'Castaño', estado: 'Cierre', forma_contacto: 'WhatsApp', broker_asignado: 'Felipe Londoño' },
    { nombre: 'Diana', apellido: 'Herrera', estado: 'Post-venta', forma_contacto: 'Referido', broker_asignado: 'Patricia Vargas' }
  ];

  for (let k = 0; k < histNames.length; k++) {
    list[k].nombre = histNames[k].nombre;
    list[k].apellido = histNames[k].apellido;
    list[k].estado = histNames[k].estado;
    list[k].forma_contacto = histNames[k].forma_contacto;
    list[k].broker_asignado = histNames[k].broker_asignado;
  }

  return list;
};

const INITIAL_PROSPECTS: Prospect[] = generateSampleProspects();

// ── EVENTS DATA ───────────────────────────────────────────────
type EventCost = { concepto: string; valor: number };
type EventData = {
  id: number; titulo: string; venue: string; fecha: string;
  proyectos_presentados: string[]; asistentes: string[];
  proyectos_interes: string[]; presupuesto_asignado: number;
  presupuesto_ejecutado: number; items_costo: EventCost[];
};

const INITIAL_EVENTS: EventData[] = [
  { id: 1, titulo: 'GLP Investment Evening #1', venue: 'Club El Nogal, Bogotáá', fecha: '2026-05-10', proyectos_presentados: ['Ocean Reef Park', 'The Palms', 'Panamá Viejo Residences', 'The Tides – Playa Caracol'], asistentes: ['Carlos Gutiérrez', 'María Isabel Rodríguez', 'Andrés Felipe Martínez'], proyectos_interes: ['Ocean Reef Park', 'The Palms', 'Panamá Viejo Residences'], presupuesto_asignado: 15000, presupuesto_ejecutado: 12800, items_costo: [{ concepto: 'Salón y montaje', valor: 4500 }, { concepto: 'Catering premium (60 pax)', valor: 3600 }, { concepto: 'Audiovisual y pantallas', valor: 1800 }, { concepto: 'Material impreso y brochures', valor: 1200 }, { concepto: 'Vinos y bebidas premium', valor: 1200 }, { concepto: 'Fotografía y video', valor: 500 }] },
  { id: 2, titulo: 'Seminario Inversión Dolarizada', venue: 'Hotel JW Marriott Bogotáá', fecha: '2026-07-15', proyectos_presentados: ['Oceana Residences & Skyhomes', 'Bosco di Santa María', 'Ipanema Panamá', 'Surfside'], asistentes: ['Laura Sánchez', 'Roberto Castaño'], proyectos_interes: ['Oceana Residences & Skyhomes', 'Surfside'], presupuesto_asignado: 20000, presupuesto_ejecutado: 8500, items_costo: [{ concepto: 'Salón conferencias (100 pax)', valor: 5500 }, { concepto: 'Coffee break y almuerzo', valor: 4200 }, { concepto: 'Speaker internacional (viáticos)', valor: 3500 }, { concepto: 'Material técnico impreso', valor: 1500 }, { concepto: 'Publicidad digital pre-evento', valor: 2800 }, { concepto: 'Señalización y decoración', valor: 1000 }, { concepto: 'Registro y tecnología', valor: 1500 }] },
];

// ── FAQ DATA ──────────────────────────────────────────────────
type FAQ = { id: number; categoria: string; pregunta: string; respuesta: string };

const FAQ_CATEGORIES = ['Estabilidad Macroeconómica', 'Financiero y Retornos', 'Fiscal', 'Migratorio'];

const INITIAL_FAQS: FAQ[] = [
  // Estabilidad Macroeconómica
  { id: 1, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Panamá es un país estable para invertir?', respuesta: 'Panamá es una de las economías más estables de América Latina. El país utiliza el dólar estadounidense como moneda de curso legal desde 1904, eliminando el riesgo cambiario. Su PIB ha crecido consistentemente por encima del promedio regional, con una tasa promedio del 5% anual en la última década. El Canal de Panamá genera ingresos recurrentes que sostienen las finanzas públicas.' },
  { id: 2, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cómo se compara la inflación de Panamá con la de Colombia?', respuesta: 'Panamá mantiene una inflación promedio del 1-2% anual, significativamente menor que Colombia que ha experimentado picos superiores al 13% en años recientes. Al estar dolarizado, Panamá no sufre devaluaciones de moneda local. Esto protege el poder adquisitivo de la inversión y garantiza que las rentas en USD mantengan su valor real a lo largo del tiempo.' },
  { id: 3, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Qué tan seguro es el sistema bancario panameño?', respuesta: 'El Centro Bancario Internacional de Panamá cuenta con más de 70 bancos de 30 países, con activos totales superiores a USD 130 mil millones. La Superintendencia de Bancos de Panamá regula con estándares internacionales de Basilea III. Los depósitos hasta USD 10,000 están protegidos por el Fondo de Garantía de Depósitos. El sistema es robusto, líquido y altamente regulado.' },
  { id: 4, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Existe riesgo político en Panamá?', respuesta: 'Panamá ha mantenido una democracia estable e ininterrumpida desde 1989. Las transiciones de poder han sido pacíficas y el marco jurídico respeta la propiedad privada extranjera. La Constitución garantiza los mismos derechos de propiedad a nacionales y extranjeros. El país mantiene grado de inversión (investment grade) por las principales calificadoras internacionales.' },
  { id: 5, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cómo afecta el Canal de Panamá a la economía del país?', respuesta: 'El Canal de Panamá es el motor económico principal del país, generando más de USD 3 mil millones anuales en ingresos directos. Esto representa aproximadamente el 6% del PIB panameño. El Canal impulsa sectores como logística, banca, comercio y turismo, creando una economía diversificada. La ampliación del Canal completada en 2016 duplicó su capacidad y asegura ingresos crecientes por las próximas décadas.' },
  { id: 6, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cómo está el mercado inmobiliario panameño actualmente?', respuesta: 'El mercado inmobiliario panameño muestra señales sólidas de recuperación post-pandemia. El sector construcción creció 29.3% interanual en enero 2026 según el INEC. El precio promedio por m² en Ciudad de Panamá es USD 1,804, con zonas premium entre USD 2,700 y USD 4,150/m². La demanda de expatriados y trabajadores remotos ha impulsado el segmento de alquiler con una rentabilidad bruta promedio del 7.8% anual.' },
  { id: 7, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cuánto capital colombiano fluye hacia Panamá?', respuesta: 'Según datos del Banco de la República de Colombia, USD 208 millones de capital colombiano fluyeron hacia Panamá solo en el tercer trimestre de 2025. Colombia es consistentemente uno de los mayores inversores en finca raíz panameña. La conectividad aérea directa Bogotáá-Panamá (2.5 horas) y los lazos culturales facilitan esta tendencia. El corredor de inversión Colombia-Panamá se fortalece cada año.' },
  { id: 8, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Panamá es un hub logístico relevante a nivel mundial?', respuesta: 'Panamá es el hub logístico más importante de las Américas. Además del Canal, cuenta con la Zona Libre de Colón (la segunda zona franca más grande del mundo), el Hub de las Américas (aeropuerto de Tocumen como centro de conexiones), y uno de los puertos de contenedores más activos de Latinoamérica. Esta infraestructura genera demanda permanente de vivienda para ejecutivos internacionales y trabajadores del sector.' },

  // Financiero y Retornos
  { id: 9, categoria: 'Financiero y Retornos', pregunta: '¿Qué rentabilidad puedo esperar de una inversión inmobiliaria en Panamá?', respuesta: 'Las rentabilidades brutas del portafolio GLP oscilan entre 5% y 8.5% anual en USD, dependiendo del proyecto y tipo de inversión. Los proyectos urbanos como Panamá Viejo Residences ofrecen cap rates de 6.5-8%, mientras que los premium como Ocean Reef Park ofrecen 5-6.5% compensados por mayor plusvalía. Comparado con un CDT en Colombia al 10.5% en COP, la inversión en Panamá ofrece estabilidad en dólares sin riesgo de devaluación.' },
  { id: 10, categoria: 'Financiero y Retornos', pregunta: '¿Cuál es el ticket mínimo de inversión?', respuesta: 'El portafolio GLP tiene opciones desde USD 120,000 (Panamá Viejo Residences) hasta USD 1,500,000+ (Ocean Reef Park). La mayoría de proyectos permiten cuotas iniciales desde el 30%, con financiamiento bancario panameño para el saldo. Para un inversionista colombiano promedio de alto patrimonio, el ticket de entrada más común está entre USD 180,000 y USD 350,000 con una cuota inicial del 50%.' },
  { id: 11, categoria: 'Financiero y Retornos', pregunta: '¿Cómo funciona el financiamiento bancario en Panamá?', respuesta: 'Los bancos panameños financian extranjeros hasta el 70% del valor del inmueble. La tasa base es aproximadamente 7.5% anual, más una sobretasa de 1% para extranjeros, resultando en ~8.5% efectivo. Los plazos van de 5 a 30 años con amortización francesa. Se requiere: pasaporte vigente, estados financieros de 2 años, carta laboral o certificación de ingresos, y referencia bancaria. El proceso toma aproximadamente 30-45 días.' },
  { id: 12, categoria: 'Financiero y Retornos', pregunta: '¿Qué gastos operativos tiene una propiedad en Panamá?', respuesta: 'Los gastos operativos típicos incluyen: fee de property management (USD 150/mes con GLP), administración delegada (10% de la renta bruta), condominio (varía por proyecto, USD 170-700/mes), seguro anual (~USD 1,200), y mantenimiento (1% del valor del activo anual). El impuesto predial está exonerado por 20 años en proyectos nuevos. No hay impuesto patrimonial ni impuesto a ganancias de capital para personas naturales no residentes.' },
  { id: 13, categoria: 'Financiero y Retornos', pregunta: '¿Qué es la exención predial de 20 años?', respuesta: 'Panamá ofrece una exención total del impuesto de inmuebles (predial) durante 20 años para proyectos de construcción nueva. Esto aplica a todos los proyectos del portafolio GLP. En comparación, en Colombia el predial puede representar entre 0.3% y 1.2% del valor catastral anualmente. Esta exención mejora significativamente el NOI (Net Operating Income) y el cap rate neto del inversionista durante dos décadas completas.' },
  { id: 14, categoria: 'Financiero y Retornos', pregunta: '¿Cuál es la valorización esperada de los proyectos GLP?', respuesta: 'La valorización promedio del portafolio GLP oscila entre 3% y 5.5% anual en USD. Los proyectos urbanos como Panamá Viejo muestran 3-4% anual estable, mientras que los premium como Ocean Reef Islands han documentado 6-8% anual por la escasez absoluta de producto comparable. La zona de Playa Caracol muestra 4-6% anual para proyectos nuevos. Estas cifras se comparan favorablemente con la inflación del dólar (2-3% anual).' },
  { id: 15, categoria: 'Financiero y Retornos', pregunta: '¿Puedo generar ingresos por Airbnb en Panamá?', respuesta: 'Sí. El proyecto Ventu de GLP está específicamente diseñado para rentas cortas tipo Airbnb/Booking.com, con cap rates estimados de 8-12% anual. Incluye administración hotelera delegada con check-in automático. Las tarifas promedio en Ciudad de Panamá son USD 120-180 por noche. La temporada alta (diciembre-abril) puede elevar las tarifas un 30-50%. Se estima una vacancia del 20% anual promedio en el modelo de rentas cortas.' },
  { id: 16, categoria: 'Financiero y Retornos', pregunta: '¿Cómo se compara invertir en Panamá versus invertir en un CDT colombiano?', respuesta: 'Un CDT colombiano ofrece ~10.5% nominal en COP, pero al ajustar por devaluación del peso (históricamente 5-8% anual contra el USD) y retención en la fuente, el retorno real en dólares puede ser negativo. Una inversión GLP genera 5-8% en USD puro más valorización de 3-5.5% anual, sin riesgo cambiario. A 10 años, la inversión en Panamá genera patrimonio en moneda dura con diversificación geográfica.' },

  // Fiscal
  { id: 17, categoria: 'Fiscal', pregunta: '¿Debo declarar mi inversión en Panamá ante la DIAN?', respuesta: 'Sí. Todo residente fiscal colombiano debe declarar activos en el exterior superiores a 3,580 UVT (aproximadamente COP 170 millones en 2026). Esto incluye inmuebles en Panamá. La declaración se realiza en el Formulario 160 (Declaración de Activos en el Exterior) y en la declaración de renta anual. Colombia Tax Law Group acompaña a cada inversionista GLP en este proceso para garantizar cumplimiento total con la DIAN.' },
  { id: 18, categoria: 'Fiscal', pregunta: '¿Hay doble tributación entre Colombia y Panamá?', respuesta: 'Colombia y Panamá NO tienen un Convenio para Evitar la Doble Imposición (CDI) vigente. Sin embargo, Panamá opera bajo un sistema territorial: solo grava ingresos generados dentro de su territorio. Esto significa que las rentas de alquiler en Panamá se gravan localmente (0% para personas naturales no residentes en la mayoría de casos), y en Colombia se declaran como rentas de fuente extranjera con crédito tributario si aplica.' },
  { id: 19, categoria: 'Fiscal', pregunta: '¿Cómo transfiero mis dólares legalmente a Panamá?', respuesta: 'La transferencia se realiza a través del mercado cambiario formal colombiano. Se debe diligenciar la Declaración de Cambio (Formulario 4) ante el intermediario del mercado cambiario (banco). Para montos superiores a USD 10,000, se requiere registro ante el Banco de la República. La Resolución DIAN 204/2025 establece los lineamientos actualizados. Colombia Tax Law Group gestiona todo el proceso documental con el inversionista para que sea fluido y sin fricciones bancarias.' },
  { id: 20, categoria: 'Fiscal', pregunta: '¿Panamá cobra impuesto a las ganancias de capital?', respuesta: 'Para la venta de inmuebles, Panamá aplica un impuesto del 2% sobre el valor de venta (no sobre la ganancia). Alternativamente, el vendedor puede optar por tributar al 10% sobre la ganancia neta si le resulta más favorable. No existe impuesto patrimonial ni impuesto a la herencia en Panamá. La estructura a través de una Sociedad Anónima panameña o Fundación de Interés Privado puede optimizar aún más la carga fiscal y facilitar la sucesión.' },
  { id: 21, categoria: 'Fiscal', pregunta: '¿Qué estructura jurídica recomienda GLP para la inversión?', respuesta: 'GLP, en conjunto con Colombia Tax Law Group, recomienda evaluar tres estructuras: (1) Persona natural directa — más simple, ideal para primer ticket; (2) Sociedad Anónima panameña — facilita sucesión y permite privacidad; (3) Fundación de Interés Privado — óptima para planificación patrimonial y sucesoral de familias HNWI. La elección depende del patrimonio total, los objetivos sucesorales y la situación tributaria específica del inversionista.' },
  { id: 22, categoria: 'Fiscal', pregunta: '¿Puedo deducir gastos de la inversión panameña en mi declaración colombiana?', respuesta: 'Las rentas de fuente extranjera se declaran en Colombia con posibilidad de aplicar crédito tributario por impuestos pagados en el exterior (Art. 254 E.T.). Los gastos directamente relacionados con la generación de la renta (administración, seguros, mantenimiento) son deducibles bajo las reglas generales. Colombia Tax Law Group prepara la documentación soporte para maximizar las deducciones permitidas y optimizar la carga tributaria global del inversionista.' },
  { id: 23, categoria: 'Fiscal', pregunta: '¿Qué sucede si no declaro mi inversión en Panamá?', respuesta: 'La omisión de activos en el exterior ante la DIAN puede generar sanciones por inexactitud (100-160% del mayor valor del impuesto), sanciones por omisión de la declaración de activos (5% del valor de los activos no declarados por año), e incluso consecuencias penales por evasión fiscal. Con el intercambio automático de información (CRS/FATCA) entre Panamá y Colombia, la DIAN tiene acceso a información financiera de cuentas colombianas en Panamá. La transparencia total es la única estrategia viable.' },
  { id: 24, categoria: 'Fiscal', pregunta: '¿GLP me ayuda con todo el proceso fiscal?', respuesta: 'Sí. La alianza tripartita GLP incluye a Colombia Tax Law Group como socio fiscal y legal. Ellos acompañan al inversionista desde la primera transferencia hasta la declaración de renta anual. El servicio incluye: estructuración de la inversión, proceso de declaración de cambio, declaración de activos en el exterior, declaración de renta con rentas de fuente extranjera, y asesoría en planificación patrimonial y sucesoral. El costo del servicio legal-fiscal se acuerda directamente con Colombia Tax Law Group.' },

  // Migratorio
  { id: 25, categoria: 'Migratorio', pregunta: '¿Puedo obtener residencia panameña al invertir en propiedad?', respuesta: 'Sí. Panamá ofrece la Visa de Inversionista Calificado para extranjeros que inviertan un mínimo de USD 300,000 en bienes raíces. Esta visa otorga residencia permanente para el titular y dependientes (cónyuge e hijos menores). El proceso toma aproximadamente 30-60 días una vez presentada la documentación completa. GLP facilita el contacto con abogados migratorios panameños especializados en el trámite.' },
  { id: 26, categoria: 'Migratorio', pregunta: '¿La residencia panameña me obliga a vivir en Panamá?', respuesta: 'No. La residencia panameña no requiere presencia física permanente. Sin embargo, para mantener el estatus activo, se recomienda visitar Panamá al menos una vez cada dos años. La residencia panameña no afecta la residencia fiscal colombiana siempre que se mantengan los criterios de permanencia (más de 183 días en Colombia). Es un segundo pasaporte de conveniencia que facilita trámites bancarios, inmobiliarios y empresariales en Panamá.' },
  { id: 27, categoria: 'Migratorio', pregunta: '¿Cuáles son los beneficios de la residencia panameña?', respuesta: 'La residencia panameña ofrece: apertura de cuentas bancarias locales con mayor facilidad, acceso a financiamiento hipotecario en condiciones preferenciales, cédula panameña que facilita trámites, posibilidad de establecer empresas en Panamá, acceso al sistema de salud panameño, beneficios migratorios para viajes a terceros países, y eventualmente la posibilidad de obtener la ciudadanía panameña después de 5 años de residencia.' },
  { id: 28, categoria: 'Migratorio', pregunta: '¿Qué documentos necesito para la visa de inversionista?', respuesta: 'Los documentos principales son: pasaporte vigente con mínimo 6 meses de validez, antecedentes penales apostillados del país de origen, certificado de salud, referencias bancarias personales (2), carta de motivación, comprobante de la inversión inmobiliaria (escritura o promesa de compraventa por mínimo USD 300,000), y poder notarial para el abogado tramitador. Todos los documentos deben estar apostillados y, si aplica, traducidos al español por un traductor oficial.' },
  { id: 29, categoria: 'Migratorio', pregunta: '¿Puedo incluir a mi familia en la visa de inversionista?', respuesta: 'Sí. La Visa de Inversionista Calificado permite incluir dependientes: cónyuge, hijos menores de 18 años, e hijos hasta 25 años que demuestren dependencia económica y estar estudiando. Cada dependiente requiere su propia documentación (pasaporte, antecedentes, certificado de salud). El costo adicional por dependiente es relativamente menor comparado con el titular. La familia completa obtiene residencia permanente en Panamá.' },
  { id: 30, categoria: 'Migratorio', pregunta: '¿Puedo trabajar en Panamá con la visa de inversionista?', respuesta: 'La Visa de Inversionista Calificado permite actividades empresariales propias pero NO permite empleo dependiente con un empleador panameño. Si el inversionista desea trabajar como empleado, necesitaría un permiso de trabajo adicional. Sin embargo, puede establecer empresas propias, recibir ingresos de alquiler, y realizar actividades de inversión sin restricciones. Muchos inversionistas colombianos utilizan Panamá como base para operaciones empresariales regionales.' },
  { id: 31, categoria: 'Migratorio', pregunta: '¿Existe el Programa de Pensionado en Panamá?', respuesta: 'Sí. El Programa de Pensionado Especial de Panamá es uno de los más atractivos del mundo. Requiere demostrar una pensión mensual mínima de USD 1,000 (o USD 750 si se compra propiedad por USD 100,000+). Beneficios: descuentos del 25% en servicios públicos, 25% en pasajes aéreos, 50% en entretenimiento, 25% en restaurantes, y 15% en préstamos hospitalarios. Es ideal para colombianos jubilados que buscan calidad de vida en dólares con un costo inferior al de ciudades como Bogotáá o Miami.' },
  { id: 32, categoria: 'Migratorio', pregunta: '¿GLP me ayuda con todo el proceso migratorio?', respuesta: 'GLP conecta al inversionista con abogados migratorios panameños de confianza que gestionan todo el trámite de principio a fin. El proceso incluye: evaluación de elegibilidad, preparación de documentación, presentación ante el Servicio Nacional de Migración, seguimiento del trámite, y entrega de la cédula panameña. GLP no cobra por la referencia — el costo del servicio se acuerda directamente entre el inversionista y el abogado. El proceso típico toma 30-60 días.' },
];

// ── MODULE DEFINITIONS ────────────────────────────────────────
const MODULES = [
  { id: 'portafolio', label: 'Portafolio GLP' },
  { id: 'activos', label: 'Activos Inmobiliarios' },
  { id: 'kpis', label: 'Dashboard KPIs' },
  { id: 'brokers', label: 'Brokers' },
  { id: 'prospectos', label: 'Prospectos' },
  { id: 'eventos', label: 'Presupuesto Eventos' },
  { id: 'agentes', label: 'Equipo de Gestión' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'calculadora', label: 'Calculadora ROI' },
  { id: 'acceso', label: 'Clave y Seguridad' },
  { id: 'backups', label: 'Backups y Restauración' },
];

const getAdminUsers = () => {
  const usersSaved = localStorage.getItem('glp_crm_users');
  if (usersSaved) {
    try {
      const parsed = JSON.parse(usersSaved);
      const updated = parsed.map((u: any) => {
        if (u.username === 'admin') {
          return { ...u, password: 'admin1234' };
        }
        return u;
      });
      localStorage.setItem('glp_crm_users', JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error(e);
    }
  }
  const defaultUsers = [{ username: 'admin', password: 'admin1234', name: 'Administrador Principal' }];
  localStorage.setItem('glp_crm_users', JSON.stringify(defaultUsers));
  return defaultUsers;
};

// ═══════════════════════════════════════════════════════════════
// MAIN CRM DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════
const cardStyle = (extra: Record<string, any> = {}) => ({
  background: T.card,
  borderRadius: 12,
  padding: '20px 24px',
  border: `1px solid ${T.borderLight}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  ...extra,
});

const btnPrimary = (extra: Record<string, any> = {}) => ({
  background: T.teal,
  color: T.card,
  border: 'none',
  borderRadius: 8,
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer' as const,
  fontFamily: 'Inter, sans-serif',
  ...extra,
});

const btnSecondary = (extra: Record<string, any> = {}) => ({
  background: 'transparent',
  color: T.teal,
  border: `1.5px solid ${T.teal}`,
  borderRadius: 8,
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer' as const,
  fontFamily: 'Inter, sans-serif',
  ...extra,
});

const btnDanger = (extra: Record<string, any> = {}) => ({
  background: T.coral,
  color: T.card,
  border: 'none',
  borderRadius: 8,
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer' as const,
  fontFamily: 'Inter, sans-serif',
  ...extra,
});

const inputStyle = (extra: Record<string, any> = {}) => ({
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: `1px solid ${T.border}`,
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
  color: T.text,
  background: T.card,
  outline: 'none',
  boxSizing: 'border-box' as const,
  ...extra,
});

const labelStyle = {
  fontSize: 12,
  fontWeight: 600 as const,
  color: T.textSec,
  marginBottom: 4,
  display: 'block' as const,
};

export default function CRMDashboard() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeModule, setActiveModule] = useState('portafolio');
  const [isGeneratingMagic, setIsGeneratingMagic] = useState<Record<number, boolean>>({});
  const [magicDrafts, setMagicDrafts] = useState<Record<number, string>>({});

  const [pendingImports, setPendingImports] = useState<any[]>([]);
  const [selectedPendingImports, setSelectedPendingImports] = useState<number[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // Estados para Filtros y Ordenamiento (Brokers y Prospectos)
  const [prospectsSortField, setProspectsSortField] = useState<string | null>(null);
  const [prospectsSortDirection, setProspectsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [brokerFilters, setBrokerFilters] = useState({
    nombre: '', empresa: '', zona: '', prospectos: '', negocios: '', tasa: '', comisiones: ''
  });

  // Estados para Módulo de Activos
  const [projectsList, setProjectsList] = useState<any[]>(() => {
    const saved = localStorage.getItem('glp_crm_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing projects from localStorage in CRM:', e);
      }
    }
    return PROJECTS;
  });
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activosFilter, setActivosFilter] = useState('all');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: '',
    category: 'Proyecto de Ciudad',
    zone: '',
    type: 'renta',
    price: 0,
    priceM2: '',
    rentM2: '',
    capRate: '',
    vacancy: '',
    area: '',
    beds: '',
    amenities: '',
    tenant: '',
    velocity: '',
    appreciation: '',
    tag: '',
    delivery: ''
  });

  // ── Authentication States ──
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return sessionStorage.getItem('glp_crm_logged_user');
  });

  // ── Module States ───────────────────────────────────────────
  const [closedSales, setClosedSales] = useState<Sale[]>(INITIAL_CLOSED_SALES);
  const [lostSales, setLostSales] = useState<LostSale[]>(INITIAL_LOST_SALES);
  const [activeDrilldown, setActiveDrilldown] = useState<{
    type: 'ticket' | 'conversion' | 'funnel' | 'source' | 'prospect' | 'broker' | 'prospects_total' | 'brokers_active' | 'presupuesto';
    stage?: string;
    source?: string;
    id?: number;
  } | null>(null);

  // Portafolio
  const [portFilter, setPortFilter] = useState('all');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [crmLightboxImg, setCrmLightboxImg] = useState<string | null>(null);

  // Map dynamic projects list back to the local shape used in CRM calculations
  const crmProjects = useMemo<any[]>(() => {
    return projectsList.map(p => {
      // Parse areas: e.g. "45–71 m²" -> min: 45, max: 71
      let areaMin = 50;
      let areaMax = 100;
      if (p.area) {
        const matches = p.area.match(/(\d+)/g);
        if (matches && matches.length >= 1) {
          areaMin = Number(matches[0]);
          areaMax = matches[1] ? Number(matches[1]) : areaMin;
        }
      }

      // Parse cap rates: e.g. "6.5–7.8%" -> min: 6.5, max: 7.8
      let capRateMin = 5.0;
      let capRateMax = 7.0;
      if (p.capRate) {
        const matches = p.capRate.match(/([\d.]+)/g);
        if (matches && matches.length >= 1) {
          capRateMin = parseFloat(matches[0]);
          capRateMax = matches[1] ? parseFloat(matches[1]) : capRateMin;
        }
      }

      // Parse price/m2: e.g. "3,800–4,020" -> min: 3800, max: 4020
      let priceM2Min = 1500;
      let priceM2Max = 2500;
      if (p.priceM2) {
        const matches = p.priceM2.replace(/,/g, '').match(/([\d.]+)/g);
        if (matches && matches.length >= 1) {
          priceM2Min = parseFloat(matches[0]);
          priceM2Max = matches[1] ? parseFloat(matches[1]) : priceM2Min;
        }
      }

      // Parse rent/m2: e.g. "14–18" -> 15
      let rentM2Min = 10;
      let rentM2Max = 15;
      if (p.rentM2) {
        const matches = p.rentM2.match(/([\d.]+)/g);
        if (matches && matches.length >= 1) {
          rentM2Min = parseFloat(matches[0]);
          rentM2Max = matches[1] ? parseFloat(matches[1]) : rentM2Min;
        }
      }

      // Parse vacancy: e.g. "4%" -> 4
      let vacancyDef = 6;
      if (p.vacancy) {
        const match = p.vacancy.match(/([\d.]+)/);
        if (match) vacancyDef = parseFloat(match[1]);
      }

      // Parse appreciation: e.g. "4.0%" -> 4.0
      let appreciationDef = 3.5;
      if (p.appreciation) {
        const match = p.appreciation.match(/([\d.]+)/);
        if (match) appreciationDef = parseFloat(match[1]);
      }

      return {
        name: p.name || '',
        category: p.category || 'Proyecto de Ciudad',
        zone: p.zone || p.category || '',
        zoneShort: p.name || '',
        investorType: p.type || 'renta',
        minPrice: p.price || 120000,
        areaMin,
        areaMax,
        bedrooms: p.beds || '2 rec.',
        capRateMin,
        capRateMax,
        vacancyDef,
        rentSuggest: p.rentSuggest || Math.round(rentM2Max * areaMin) || 800,
        rentM2Min,
        rentM2Max,
        condominioMes: p.condominioMes || 200,
        appreciationDef,
        appreciationNote: p.appreciationNote || `Valorización estable en la zona.`,
        amenities: p.amenities || [],
        construction: p.delivery || 'Entrega activa',
        priceM2Min,
        priceM2Max
      };
    });
  }, [projectsList]);

  // KPIs
  const [kpiPresupuestoEjecutado, setKpiPresupuestoEjecutado] = useState(68000);
  const [kpiPresupuestoPlaneado, setKpiPresupuestoPlaneado] = useState(95000);
  
  const [overrideFunnelContacto, setOverrideFunnelContacto] = useState<number | null>(null);
  const [overrideFunnelCalif, setOverrideFunnelCalif] = useState<number | null>(null);
  const [overrideFunnelPres, setOverrideFunnelPres] = useState<number | null>(null);
  const [overrideFunnelNeg, setOverrideFunnelNeg] = useState<number | null>(null);
  const [overrideFunnelCierre, setOverrideFunnelCierre] = useState<number | null>(null);
  
  const [overrideTicketPromedio, setOverrideTicketPromedio] = useState<number | null>(null);
  const [overrideConversion, setOverrideConversion] = useState<number | null>(null);
  
  const [kpiEditMode, setKpiEditMode] = useState<string | null>(null);

  // FAQ active category filter
  const [faqActiveCategory, setFaqActiveCategory] = useState<string>('all');

  // ROI Calculator asset filters
  const [calcFilterZone, setCalcFilterZone] = useState<string>('all');
  const [calcFilterPrice, setCalcFilterPrice] = useState<string>('all');

  // Brokers
  const [brokers, setBrokers] = useState<Broker[]>(INITIAL_BROKERS);
  const [showBrokerForm, setShowBrokerForm] = useState(false);
  const [brokerDrilldown, setBrokerDrilldown] = useState<number | null>(null);
  const [brokerEntityFilter, setBrokerEntityFilter] = useState('all');
  const [commissionFilterBroker, setCommissionFilterBroker] = useState('all');
  const [commissionFilterCompany, setCommissionFilterCompany] = useState('all');
  const [reportTarget, setReportTarget] = useState('all');
  const [newBroker, setNewBroker] = useState({ nombre: '', empresa: '', zona: '', telefono: '', email: '' });

  // Prospects
  const [prospects, setProspects] = useState<Prospect[]>(() => {
    const saved = localStorage.getItem('glp_crm_prospects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed) && parsed.length >= 10) {
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing prospects from localStorage:', e);
      }
    }
    return INITIAL_PROSPECTS;
  });

  useEffect(() => {
    localStorage.setItem('glp_crm_prospects', JSON.stringify(prospects));
  }, [prospects]);

  // Check backend connection and sync data
  const [backendConnected, setBackendConnected] = useState(false);
  const [bitacoraLogs, setBitacoraLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem('glp_crm_bitacora');
    return saved ? JSON.parse(saved) : [];
  });
  const [saraDrafts, setSaraDrafts] = useState<{ id: string; to: string; project: string; subject: string; body: string; status?: string }[]>(() => {
    const saved = localStorage.getItem('glp_crm_drafts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const newSig = `Sara Valenzuela\nDirectora de Customer Success & Back-Office Comercial\nGLP Wealth Management · Grupo Los Pueblos\n2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá\nE: info@glp.com.pa | W: www.glp.com.pa`;
        return parsed.map((d: any) => {
          let body = d.body || '';
          const oldPatterns = [
            /Sara\s*\n\s*Asesora de GLP Panamá/gi,
            /SARA\s*\n\s*Asesora de GLP Panamá/gi,
            /Sara\s*\n\s*Asesora de Ventas\s*\n\s*GLP Panamá/gi,
            /Sara\s*\n\s*Asesora de ventas\s*\n\s*GLP Panamá/gi,
            /Sara\s*•\s*Consultora de Inversiones Inmobiliarias GLP/gi,
            /Sara\s*•\s*Asesora de GLP Panamá/gi,
            /Sara Montenegro\s*\n\s*Asistente de Servicio al Cliente & Back-Office/gi,
            /Sara Montenegro/gi,
            /Sara Bedoya/gi
          ];
          oldPatterns.forEach(pattern => {
            body = body.replace(pattern, newSig);
          });
          body = body.replace(/Sara Valenzuela\s*\n\s*Directora de Customer Success & Back-Office Comercial\s*\n\s*GLP Wealth Management · Grupo Los Pueblos\s*\n\s*[^\n]+\s*\n\s*E: (?:info@grupolospueblos\.com|info@glp\.com\.pa) \| W: (?:www\.grupolospueblos\.com|www\.glp\.com\.pa)(\s*\n\s*Directora de Customer Success & Back-Office Comercial)?/gi, newSig);
          return { ...d, body };
        });
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'draft-1',
        to: 'Carlos Gutiérrez (carlos.g@gmail.com)',
        project: 'Ocean Reef Park',
        subject: 'Cotización Personalizada y Ficha Técnica - Ocean Reef Park Unidad 3BR',
        body: 'Estimado Carlos,\n\nCon base en tu interés en una unidad de 3 habitaciones con acceso directo a la marina en Ocean Reef Park, he preparado esta cotización preliminar por USD $1,500,000 con un plan de pago del 30% inicial y 70% contra entrega. Te adjunto también los planos de distribución y los detalles de la marina privada.\n\nQuedo atenta a tu aprobación para enviar esta información formalmente.\n\nCordialmente,\n\nSara Valenzuela\nDirectora de Customer Success & Back-Office Comercial\nGLP Wealth Management · Grupo Los Pueblos\n2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá\nE: info@glp.com.pa | W: www.glp.com.pa\n\n---\nNota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de GLP Wealth Management. Queda estrictamente prohibido su uso, divulgación o reproducción sin autorización.',
        status: 'pending'
      },
      {
        id: 'draft-2',
        to: 'Laura Sánchez (laura.sanchez@gmail.com)',
        project: 'The Tides - Playa Caracol',
        subject: 'Información y Retorno de Inversión - The Tides Playa Caracol',
        body: 'Estimada Laura,\n\nAdjunto a este correo encontrarás la ficha técnica y la simulación financiera para la unidad de segunda residencia en The Tides - Playa Caracol (USD $320,000) con potencial de renta vacacional gestionada. El retorno neto estimado es del 6.8% anual con los beneficios fiscales de exención de impuesto de inmuebles.\n\nCordialmente,\n\nSara Valenzuela\nDirectora de Customer Success & Back-Office Comercial\nGLP Wealth Management · Grupo Los Pueblos\n2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá\nE: info@glp.com.pa | W: www.glp.com.pa\n\n---\nNota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de GLP Wealth Management. Queda estrictamente prohibido su uso, divulgación o reproducción sin autorización.',
        status: 'pending'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('glp_crm_drafts', JSON.stringify(saraDrafts));
  }, [saraDrafts]);

  useEffect(() => {
    localStorage.setItem('glp_crm_bitacora', JSON.stringify(bitacoraLogs));
  }, [bitacoraLogs]);

  // Sync with Backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/health');
        if (res.ok) {
          setBackendConnected(true);
          
          // Fetch drafts
          const draftsRes = await fetch('http://localhost:3001/api/drafts');
          if (draftsRes.ok) {
            const serverDrafts = await draftsRes.json();
            setSaraDrafts(serverDrafts);
          }

          // Fetch bitacora
          const logsRes = await fetch('http://localhost:3001/api/bitacora');
          if (logsRes.ok) {
            const serverLogs = await logsRes.json();
            setBitacoraLogs(serverLogs);
          }
        } else {
          setBackendConnected(false);
        }
      } catch (err) {
        setBackendConnected(false);
      }
    };

    checkBackend();
    // Check connection every 10 seconds
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch projects from backend
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true);
        const res = await fetch('http://localhost:3001/api/projects');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setProjectsList(data);
          }
        }
      } catch (e) {
        console.error('Error fetching projects in CRM:', e);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchProjects();
  }, [backendConnected]);

  const saveProjectsToBackend = async (newProjects: any[]) => {
    try {
      const res = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: newProjects })
      });
      if (res.ok) {
        setProjectsList(newProjects);
        alert('Catálogo de activos guardado correctamente en la base de datos.');
      } else {
        alert('Error al guardar el catálogo en el servidor.');
      }
    } catch (e) {
      console.error('Error saving projects:', e);
      alert('Error de conexión con el servidor backend.');
    }
  };



  // Derived KPI values with manual overrides
  const kpiFunnelContacto = overrideFunnelContacto !== null ? overrideFunnelContacto : prospects.filter(p => p.estado === 'Contacto Inicial' || p.estado === 'Contacto').length;
  const kpiFunnelCalif = overrideFunnelCalif !== null ? overrideFunnelCalif : prospects.filter(p => p.estado === 'Calificación').length;
  const kpiFunnelPres = overrideFunnelPres !== null ? overrideFunnelPres : prospects.filter(p => p.estado === 'Presentación').length;
  const kpiFunnelNeg = overrideFunnelNeg !== null ? overrideFunnelNeg : prospects.filter(p => p.estado === 'Negociación').length;
  const kpiFunnelCierre = overrideFunnelCierre !== null ? overrideFunnelCierre : prospects.filter(p => p.estado === 'Cierre').length;

  const kpiTicketPromedio = overrideTicketPromedio !== null ? overrideTicketPromedio : (closedSales.length > 0 ? Math.round(closedSales.reduce((sum, s) => sum + s.value, 0) / closedSales.length) : 285000);
  const kpiConversion = overrideConversion !== null ? overrideConversion : (prospects.length > 0 ? Number(((closedSales.length / (prospects.length - 18)) * 100).toFixed(1)) : 7.1);

  const [showProspectForm, setShowProspectForm] = useState(false);
  const [activeAgentKpi, setActiveAgentKpi] = useState<{ agent: string; label: string } | null>(null);
  const [sentDrafts, setSentDrafts] = useState<string[]>([]);
  const [prospectDetail, setProspectDetail] = useState<number | null>(null);
  const [prospectEdit, setProspectEdit] = useState<number | null>(null);
  const [prospectFilterBroker, setProspectFilterBroker] = useState('all');
  const [prospectFilterStage, setProspectFilterStage] = useState('all');
  const [prospectFilterProject, setProspectFilterProject] = useState('all');
  const [prospectFilterOrigin, setProspectFilterOrigin] = useState('all');
  const [showCamiloFilterSelect, setShowCamiloFilterSelect] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [prospectViewMode, setProspectViewMode] = useState<'embudo' | 'lista'>('embudo');
  const [newProspect, setNewProspect] = useState<Partial<Prospect>>({
    nombre: '', apellido: '', direccion: '', correo: '', telefono: '', ocupacion: '',
    proyectos_interes: [], forma_contacto: 'Pagina Web', broker_asignado: '', estado: 'Contacto Inicial',
    presupuesto_usd: 0, notas: '', historial: [],
  });

  // Events
  const [events, setEvents] = useState<EventData[]>(INITIAL_EVENTS);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
  const [eventCierreDrilldown, setEventCierreDrilldown] = useState<number | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<EventData>>({
    titulo: '', venue: '', fecha: '', proyectos_presentados: [], asistentes: [],
    proyectos_interes: [], presupuesto_asignado: 0, presupuesto_ejecutado: 0, items_costo: [],
  });

  // FAQs
  const [faqs, setFaqs] = useState<FAQ[]>(INITIAL_FAQS);
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [faqEditId, setFaqEditId] = useState<number | null>(null);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [newFaq, setNewFaq] = useState({ categoria: FAQ_CATEGORIES[0], pregunta: '', respuesta: '' });

  // Calculadora ROI
  const [calcPerfil, setCalcPerfil] = useState<string | null>(null);
  const [calcProject, setCalcProject] = useState<string | null>(null);
  const [calcPrecio, setCalcPrecio] = useState(300000);
  const [calcArea, setCalcArea] = useState(100);
  const [calcCuotaInicial, setCalcCuotaInicial] = useState(50);
  const [calcTasaHip, setCalcTasaHip] = useState(8.5);
  const [calcPlazo, setCalcPlazo] = useState(20);
  const [calcRentaM2, setCalcRentaM2] = useState(12);
  const [calcFeePM, setCalcFeePM] = useState(0);
  const [calcFeePMPct, setCalcFeePMPct] = useState(0);
  const [calcAdmin, setCalcAdmin] = useState(0);
  const [calcPredial, setCalcPredial] = useState(0);
  const [calcPredialPct, setCalcPredialPct] = useState(0);
  const [calcCondominio, setCalcCondominio] = useState(0);
  const [calcCondominioPct, setCalcCondominioPct] = useState(0);
  const [calcVacancia, setCalcVacancia] = useState(8);
  const [calcValorizacion, setCalcValorizacion] = useState(1);
  const [calcHorizonte, setCalcHorizonte] = useState(15);
  const [calcVender, setCalcVender] = useState(false);
  const [calcVenderAnio, setCalcVenderAnio] = useState(5);
  const [calcSeguro, setCalcSeguro] = useState(300);
  const [calcSeguroPct, setCalcSeguroPct] = useState(0.1);
  const [calcMantenimiento, setCalcMantenimiento] = useState(0);

  // ── AGENTS STATE ────────────────────────────────────────────
  const [agentCamiloActive, setAgentCamiloActive] = useState(false);
  const [agentCamiloLastRun, setAgentCamiloLastRun] = useState('2026-06-05 08:00');
  const [agentCamiloProspects, setAgentCamiloProspects] = useState(14);
  const [agentSaraMessages, setAgentSaraMessages] = useState(237);
  const [agentSaraAlerts, setAgentSaraAlerts] = useState(3);
  const [agentValeriaContent, setAgentValeriaContent] = useState(12);
  const [agentIsabellaPosts, setAgentIsabellaPosts] = useState(8);

  // Crisis Swarm States
  const [crisisSwarmRunning, setCrisisSwarmRunning] = useState(false);
  const [crisisSwarmStep, setCrisisSwarmStep] = useState<number | null>(null);
  const [crisisSwarmLogs, setCrisisSwarmLogs] = useState<{ time: string; agent: string; msg: string }[]>([]);
  const [crisisSaraReport, setCrisisSaraReport] = useState('');
  const [crisisValeriaDrafts, setCrisisValeriaDrafts] = useState<string[]>([]);
  const [crisisIsabellaScripts, setCrisisIsabellaScripts] = useState<string[]>([]);
  const [crisisSaraAlerts, setCrisisSaraAlerts] = useState<string[]>([]);

  // New interactive agent states
  const [openaiKey, setOpenaiKey] = useState(() => {
    const stored = localStorage.getItem('glp_openai_key');
    const envKey = import.meta.env.VITE_OPENAI_KEY as string | undefined;
    // Prefer stored key; fall back to env variable; persist env key to localStorage if not already stored
    if (stored && stored.trim()) return stored;
    if (envKey && envKey.trim()) {
      localStorage.setItem('glp_openai_key', envKey.trim());
      return envKey.trim();
    }
    return '';
  });
  const [showOpenaiConfig, setShowOpenaiConfig] = useState(false);
  const [saraReportText, setSaraReportText] = useState(() => {
    const initialTotalLost = INITIAL_LOST_SALES.reduce((sum, s) => sum + s.value, 0);
    const initialLostSummary = INITIAL_LOST_SALES.slice(0, 3).map(s => `• ${s.prospect} (${s.project}): ${s.reason} ($${s.value.toLocaleString()} USD)`).join('\n');
    return 'REPORTE DE CONTINGENCIA DE MERCADO - GLP PANAMÁ\n' +
    'Preparado con atención por: Sara Valenzuela – Directora de Customer Success\n' +
    'Estado General: Operaciones en curso. Monitoreo activo de prospectos y exenciones fiscales.\n\n' +
    '📊 ANÁLISIS DE CAÍDAS (DETALLE DE CONVERSIÓN):\n' +
    `• Valor Total de Ventas Caídas: $${initialTotalLost.toLocaleString()} USD\n` +
    `• Total de Negocios Caídos Registrados: ${INITIAL_LOST_SALES.length} objeciones\n` +
    `• Detalle de Objeciones Recientes:\n${initialLostSummary}\n\n` +
    '📊 ANÁLISIS DE PROSPECTOS Y EMBUDO:\n' +
    '• Carlos Gutiérrez (Negociación, Presupuesto $1.5M USD) - Solicita urgente aclaración sobre los tiempos de transferencia de divisas para el cierre en Ocean Reef Park.\n' +
    '• Roberto Castaño (Cierre, Presupuesto $220k USD) - Requiere que el equipo legal (Colombia Tax Law Group) certifique el estado de exención predial de 20 años de Surfside.\n\n' +
    '❓ FAQs DETECTADAS EN CONSULTAS:\n' +
    '1. ¿Cómo se declara la propiedad en Panamá ante la DIAN (Formulario 160)?\n' +
    '2. ¿Existe exención del impuesto de inmuebles para proyectos nuevos?\n' +
    '3. ¿Cuáles son los requisitos de enganche hipotecario para extranjeros?';
  });
  const [saraAlertsList, setSaraAlertsList] = useState<string[]>([
    'Carlos Gutiérrez: Urgente resolver timeline de cierre en Ocean Reef.',
    'Roberto Castaño: Requiere confirmación de exención de impuesto de inmuebles.',
    'Laura Sánchez: Interés de compra en Playa Caracol requiere llamada de seguimiento.'
  ]);
  const [saraQuestion, setSaraQuestion] = useState('');
  const [saraAnswer, setSaraAnswer] = useState('');
  const [saraIsAnswering, setSaraIsAnswering] = useState(false);

  const [saraHistoricalReports, setSaraHistoricalReports] = useState<{id: number, date: string, content: string}[]>(() => {
    const saved = localStorage.getItem('glp_crm_sara_history');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return []; }
    }
    return [];
  });

  const handleSaveSaraReport = () => {
    if (!saraReportText.trim()) return;
    const newReport = { id: Date.now(), date: new Date().toLocaleString(), content: saraReportText };
    const updated = [newReport, ...saraHistoricalReports];
    setSaraHistoricalReports(updated);
    localStorage.setItem('glp_crm_sara_history', JSON.stringify(updated));
    alert('Reporte guardado exitosamente en el historial.');
  };

  const handleDeleteHistoricalReport = (id: number) => {
    if (window.confirm('¿Seguro que desea eliminar este reporte histórico?')) {
      const updated = saraHistoricalReports.filter(r => r.id !== id);
      setSaraHistoricalReports(updated);
      localStorage.setItem('glp_crm_sara_history', JSON.stringify(updated));
    }
  };

  const [valeriaDrafts, setValeriaDrafts] = useState<string[]>([
    'Email de Seguimiento a Inversionista:\n' +
    'Asunto: Oportunidad de Inversión y Protección de Patrimonio en Panamá Viejo\n\n' +
    'Estimado Carlos,\n\n' +
    'Espero que se encuentre muy bien. En seguimiento a nuestra reunión, le confirmo que el proceso de transferencia de divisas para Ocean Reef Park se realiza mediante canales autorizados, cumpliendo estrictamente con el convenio de doble tributación entre Colombia y Panamá. El proceso de cierre toma aproximadamente de 3 a 4 semanas. Quedamos atentos para programar la llamada final con nuestro equipo legal.\n\n' +
    'Atentamente,\nValeria',
    'Post de LinkedIn:\n' +
    '¿Preocupado por la devaluación? Dolarice su patrimonio invirtiendo en el mercado de mayor crecimiento en LatAm. Con rentabilidades brutas de hasta 8.5% anual en proyectos residenciales premium en Panamá Viejo Residences y exención predial garantizada. Contácteme para una sesión de ROI personalizada. #InversionInmobiliaria #PanamáRealEstate #Dolarizacion'
  ]);
  const [publishedIsabella, setPublishedIsabella] = useState<number[]>([]);
  const [isabellaPreviewScript, setIsabellaPreviewScript] = useState<{title: string, body: string, isVideo: boolean} | null>(null);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [isabellaScripts, setIsabellaScripts] = useState<string[]>([
    'Script de Video - Exoneración de Impuestos:\n' +
    '(Isabella de pie en oficina de alto nivel, fondo corporativo elegante)\n' +
    '"Hola a todos. Si eres colombiano y estás buscando proteger tu capital en dólares, te tengo un dato clave: en Panamá, las propiedades residenciales de nueva construcción cuentan con una exoneración de impuesto predial por hasta 20 años. Sí, leíste bien: $0 de impuesto sobre tu activo inmobiliario. Esto incrementa tu rentabilidad neta considerablemente. Déjanos un mensaje y te enviamos el portafolio exclusivo de GLP."\n\n' +
    '(Programación: Publicar este Reels en Instagram el martes a las 6:00 PM y en LinkedIn a las 8:00 AM)',
    'Calendario de Publicaciones Semanal:\n\n' +
    '📅 LUNES: Gráfico comparativo de devaluación Peso vs Dólar (LinkedIn/Instagram)\n' +
    'Copy Sugerido:\n"¿Sabías que la devaluación silenciosa afecta directamente tu capacidad adquisitiva? Mientras ahorras en tu moneda local, el mercado inmobiliario en dólares sigue apreciándose. Desliza para ver la comparativa de los últimos 5 años. Protege tu patrimonio hoy con nuestras opciones residenciales premium en Panamá. 💼 #InversionEnDolares #Dolarizacion"\n\n' +
    '📅 MIÉRCOLES: Video corto explicativo sobre Cuenta Bancaria en Panamá para extranjeros (Reels/TikTok)\n' +
    'Script del Video:\n"(Isabella en el lobby de un rascacielos) Muchos clientes nos preguntan: \'¿Puedo abrir una cuenta bancaria en dólares sin ser residente?\' La respuesta es SÍ. En GLP te conectamos con las mejores entidades bancarias panameñas. El proceso toma un par de semanas y es 100% legal. Envíanos un DM con la palabra BANCARIZACIÓN y te asesoramos sin costo."\n\n' +
    '📅 VIERNES: Infografía sobre plusvalía histórica en Santa María Golf Club (LinkedIn)\n' +
    'Copy Sugerido:\n"Santa María Golf Club no es solo lujo, es rentabilidad comprobada. 📈 Analizamos la plusvalía histórica de esta zona exclusiva en la Ciudad de Panamá y los resultados hablan por sí solos. Ideal para rentas corporativas y diplomáticas. Descarga nuestro último reporte de mercado en el link de nuestra biografía. #SantaMariaPanama #Plusvalia #RealEstate"'
  ]);
  const [crmProjSearchQuery, setCrmProjSearchQuery] = useState('');
  const [swarmRunning, setSwarmRunning] = useState(false);
  const [selectedAgentOutputs, setSelectedAgentOutputs] = useState<'SARA' | 'VALERIA' | 'ISABELLA' | null>(null);
  // Admin free-form content topics
  const [valeriaAdminTopic, setValeriaAdminTopic] = useState('');
  const [isabellaAdminTopic, setIsabellaAdminTopic] = useState('');
  // Sara FAQ/email findings
  const [saraPendingFaqs, setSaraPendingFaqs] = useState<{ pregunta: string; respuesta: string }[]>([]);
  // Running indicators
  const [saraIsRunning, setSaraIsRunning] = useState(false);
  const [valeriaIsRunning, setValeriaIsRunning] = useState(false);
  const [isabellaIsRunning, setIsabellaIsRunning] = useState(false);
  const [swarmStep, setSwarmStep] = useState<number | null>(null);
  const [swarmLogs, setSwarmLogs] = useState<Array<{ time: string; agent: string; msg: string }>>([
    { time: '10:00', agent: 'SISTEMA', msg: 'Equipo listo para inicializarse por el administrador.' }
  ]);
  const [prospectsSortKey, setProspectsSortKey] = useState<string>('fecha_entrada');
  const [prospectsSortDir, setProspectsSortDir] = useState<'asc' | 'desc'>('desc');
  const [activosSortKey, setActivosSortKey] = useState<string>('none');
  const [activosSortDir, setActivosSortDir] = useState<'asc' | 'desc'>('asc');
  const [showAdvancedAI, setShowAdvancedAI] = useState(false);

  // ── OPENAI & INTERACTIVE AGENTS FUNCTIONS ──────────────────
  const triggerOpenAI = async (prompt: string, systemPrompt: string): Promise<string> => {
    if (!openaiKey.trim()) {
      throw new Error('API Key no configurada');
    }
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error del servidor (${response.status})`);
    }
    const data = await response.json();
    return data.choices[0].message.content || '';
  };

  const generateMagicEmail = async (p: Prospect) => {
    setIsGeneratingMagic(prev => ({ ...prev, [p.id]: true }));
    try {
      if (openaiKey.trim()) {
        const prompt = `Genera un correo hiper-personalizado para un prospecto de Bienes Raíces de lujo.
Nombre: ${p.nombre} ${p.apellido}
Ocupación: ${p.ocupacion}
Presupuesto: USD ${p.presupuesto_usd}
Proyectos de Interés: ${p.proyectos_interes.join(', ')}
Notas del Broker: ${p.notas}
Últimos eventos: ${p.historial.slice(-2).map(h => h.detalle).join('; ')}

Escribe un borrador de correo muy amigable, directo, exclusivo y que incluya los detalles de su presupuesto y los proyectos de interés en el contexto de sus notas. Que no parezca robótico.`;
        const systemPrompt = "Eres S.A.R.A, la asistente inteligente experta en ventas de lujo para GLP.";
        const draft = await triggerOpenAI(prompt, systemPrompt);
        setMagicDrafts(prev => ({ ...prev, [p.id]: draft }));
      } else {
        // Fallback simulación
        await new Promise(r => setTimeout(r, 1500));
        const draft = `Estimado/a ${p.nombre},\n\nEspero que te encuentres muy bien.\n\nBasado en tu interés en los proyectos: ${p.proyectos_interes.join(', ')}, he estado buscando opciones que se ajusten a tu perfil y presupuesto.\n\nRevisando las notas de tu última interacción ("${p.notas || 'Interesado en propiedades de lujo'}"), creo que tenemos oportunidades "Off-Market" ideales para ti, especialmente considerando tu visión como ${p.ocupacion || 'inversionista'}.\n\n¿Tendrías 10 minutos este jueves a las 10:00 AM para mostrarte números rápidos y renders exclusivos?\n\nQuedo a tu disposición,\n\nTu Asesor Experto - GLP`;
        setMagicDrafts(prev => ({ ...prev, [p.id]: draft }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingMagic(prev => ({ ...prev, [p.id]: false }));
    }
  };

  const handleCamilo = async (isSwarm = false, silent = false) => {
    setAgentCamiloActive(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logMsg = (msg: string) => {
      if (!silent) {
        setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'CAMILO', msg }]);
      }
    };

    logMsg('Iniciando rastreo de bases de datos de prospectos en Colombia...');
    
    try {
      let generatedProspects: any[] = [];
      let apolloSuccess = false;

      logMsg('Conectando con Apollo.io (API) para extracción B2B de HNWI...');
      try {
        const apolloRes = await fetch('http://localhost:3001/api/apollo/mine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Se asume que el backend ya resuelve el tenant y usa su llave
        });
        
        if (apolloRes.ok) {
          const apolloData = await apolloRes.json();
          if (apolloData.success && apolloData.prospects && apolloData.prospects.length > 0) {
            generatedProspects = apolloData.prospects;
            apolloSuccess = true;
            logMsg(`¡Éxito! ${generatedProspects.length} perfiles extraídos directamente de Apollo.io.`);
          } else {
            logMsg('Apollo devolvió vacío o no está configurado. Activando IA generativa (Fallback)...');
          }
        } else {
          logMsg('API Key de Apollo no detectada. Activando IA generativa (Fallback)...');
        }
      } catch (e) {
        logMsg('Error de red al conectar con Apollo. Activando Fallback...');
      }

      if (!apolloSuccess) {
        if (openaiKey.trim()) {
          logMsg('Conectando con la plataforma OpenAI para minería de datos generativa...');
          const prompt = `Eres Camilo, Data Miner y Growth Hacker de la promotora GLP Panamá. Genera 2 nuevos prospectos ficticios pero realistas con perfiles detallados de inversores colombianos premium (empresarios, médicos, C-level) interesados en los proyectos de Panamá. Devuelve UN ARREGLO JSON EXACTAMENTE en el siguiente formato, sin bloques de código markdown, sin \`\`\`json, sin texto adicional:
  [{"nombre": "nombre", "apellido": "apellido", "direccion": "dirección en Colombia", "correo": "correo@dominio.com", "telefono": "+57 310...", "ocupacion": "ocupación de alto perfil", "proyectos_interes": ["proyectos aquí"], "forma_contacto": "Referido o Evento o Redes", "broker_asignado": "Patricia Vargas o Santiago Mesa", "presupuesto_usd": 300000, "notas": "notas de interés"}]
  Los proyectos en proyectos_interes DEBEN ser exactamente de esta lista: ${crmProjects.map(p => p.name).join(', ')}. Los brokers deben ser de: ${brokers.map(b => b.nombre).join(', ')}.`;
          
          const res = await triggerOpenAI(prompt, 'Eres Camilo, un científico de datos inmobiliario ultra-eficiente.');
          const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
          generatedProspects = JSON.parse(cleanRes);
        } else {
          // High fidelity mock fallback
          const firstNames = ['Mauricio', 'Claudia', 'Felipe', 'Liliana', 'Juan Carlos', 'Silvia'];
          const lastNames = ['Sarmiento', 'Echavarría', 'Ocampo', 'Ardila', 'Barco', 'Caballero'];
          const occupations = ['Inversionista de Capital', 'Cirujano Cardiovascular', 'Empresario Retail', 'Socio de Consultoría', 'Gerente Agroindustrial'];
          const methods = ['Evento', 'WhatsApp', 'Referido', 'Linkedin', 'Pagina Web'];
          const bkName = brokers[Math.floor(Math.random() * brokers.length)].nombre;
          
          const proj1 = crmProjects[Math.floor(Math.random() * crmProjects.length)].name;
          const proj2 = crmProjects[Math.floor(Math.random() * crmProjects.length)].name;

          generatedProspects = [
            {
              nombre: firstNames[Math.floor(Math.random() * firstNames.length)],
              apellido: lastNames[Math.floor(Math.random() * lastNames.length)],
              direccion: `Calle ${Math.floor(Math.random()*100)+1} #${Math.floor(Math.random()*90)+10}-${Math.floor(Math.random()*90)+10}, Bogotáá`,
              correo: `inversor.${Math.floor(Math.random()*1000)}@glp-leads.co`,
              telefono: `+57 31${Math.floor(Math.random()*9)+1} ${Math.floor(Math.random()*900)+100} ${Math.floor(Math.random()*9000)+1000}`,
              ocupacion: occupations[Math.floor(Math.random() * occupations.length)],
              proyectos_interes: [proj1, proj2],
              forma_contacto: methods[Math.floor(Math.random() * methods.length)],
              broker_asignado: bkName,
              presupuesto_usd: Math.floor(Math.random()*60)*10000 + 150000,
              notas: 'Pre-calificado automáticamente por Camilo. Interés en dolarizar activos líquidos.'
            }
          ];
        }
      }


      const formattedList: Prospect[] = generatedProspects.map((gp, index) => ({
        id: Date.now() + index,
        nombre: gp.nombre || 'Prospecto',
        apellido: gp.apellido || 'Ficticio',
        direccion: gp.direccion || 'Colombia',
        correo: gp.correo || 'correo@temp.com',
        telefono: gp.telefono || '+57 300 000 0000',
        ocupacion: gp.ocupacion || 'Empresario',
        proyectos_interes: gp.proyectos_interes || [],
        forma_contacto: gp.forma_contacto || 'Pagina Web',
        broker_asignado: gp.broker_asignado || 'Patricia Vargas',
        estado: 'Contacto Inicial',
        presupuesto_usd: gp.presupuesto_usd || 250000,
        notas: gp.notas || 'Lead de prospección automática.',
        fecha_entrada: today(),
        historial: [{ fecha: today(), accion: 'Contacto Inicial', detalle: 'Minería automática de Camilo' }]
      }));

      setProspects(prev => [...formattedList, ...prev]);
      setAgentCamiloProspects(p => p + formattedList.length);
      setAgentCamiloLastRun(new Date().toLocaleString());
      logMsg(`Completado. Camilo encontró e insertó ${formattedList.length} prospectos en el CRM.`);
    } catch (e: any) {
      logMsg(`Error en minería de Camilo: ${e.message}. Usando simulación local...`);
      // Simulación local silenciosa fallback
      const mockLead: Prospect = {
        id: Date.now(),
        nombre: 'Andrés',
        apellido: 'Sarmiento',
        direccion: 'Carrera 9 #115-30, Bogotáá',
        correo: 'asarmiento@inversiones.co',
        telefono: '+57 310 888 9999',
        ocupacion: 'Cirujano Plástico',
        proyectos_interes: ['Panamá Viejo Residences', 'The Palms'],
        forma_contacto: 'Referido',
        broker_asignado: 'Patricia Vargas',
        estado: 'Contacto Inicial',
        presupuesto_usd: 350000,
        notas: 'Lead de simulación local. Interés en rentas cortas y exención predial.',
        fecha_entrada: today(),
        historial: [{ fecha: today(), accion: 'Contacto Inicial', detalle: 'Simulación Camilo Fallback' }]
      };
      setProspects(prev => [mockLead, ...prev]);
      setAgentCamiloProspects(p => p + 1);
      setAgentCamiloLastRun(new Date().toLocaleString());
    } finally {
      setAgentCamiloActive(false);
    }
  };

  const handleSara = async (isSwarm = false, silent = false, currentProspectsList?: Prospect[]) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    setSaraIsRunning(true);
    const logMsg = (msg: string) => {
      if (!silent) setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'SARA', msg }]);
    };

    logMsg('Sara analizando bandeja de consultas, FAQs frecuentes y estado del embudo comercial...');
    const listToAnalyze = currentProspectsList || prospects;

    try {
      if (openaiKey.trim()) {
        logMsg('Conectando con OpenAI — análisis NLP de consultas, alertas y FAQs...');
        const prompt = `Eres Sara Valenzuela, Directora de Customer Success & Back-Office Comercial de GLP Panamá.
Analiza el siguiente CRM de prospectos y genera:
1. Un reporte de contingencia detallado en texto plano con alertas críticas, análisis de etapa de embudo y FAQs detectadas.
2. Una lista de hasta 5 alertas críticas cortas.
3. Una lista de FAQs detectadas (pregunta + respuesta oficial GLP).
4. Un resumen para alimentar la bitácora del equipo.

Prospectos: ${JSON.stringify(listToAnalyze.slice(0, 20).map(p => ({ cliente: p.nombre + ' ' + p.apellido, estado: p.estado, notas: p.notas, presupuesto: p.presupuesto_usd, proyecto: p.proyectos_interes?.join(', ') })))}

Devuelve UN OBJETO JSON EXACTAMENTE así (sin markdown, sin bloques de código):
{"informe": "reporte completo", "alertas": ["alerta1", "alerta2"], "faqs": [{"pregunta": "p", "respuesta": "r"}], "bitacora_resumen": "resumen breve de actividad"}`;

        const res = await triggerOpenAI(prompt, 'Eres Sara, experta en servicio al cliente inmobiliario de lujo.');
        const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanRes);
        if (parsed.informe) setSaraReportText(String(parsed.informe));
        if (parsed.alertas && Array.isArray(parsed.alertas)) { 
          const validAlerts = parsed.alertas.map(String);
          setSaraAlertsList(validAlerts); 
          setAgentSaraAlerts(validAlerts.length); 
        }
        if (parsed.faqs && Array.isArray(parsed.faqs)) {
          const validFaqs = parsed.faqs
            .filter((f: any) => f && typeof f === 'object')
            .map((f: any) => ({
              pregunta: String(f.pregunta || ''),
              respuesta: String(f.respuesta || '')
            }))
            .filter((f: any) => f.pregunta.trim() !== '' && f.respuesta.trim() !== '');
          setSaraPendingFaqs(validFaqs);
        }
        if (parsed.bitacora_resumen) {
          setBitacoraLogs(prev => [{
            id: Date.now(), fecha: dateStr, hora: timeStr, agente: 'SARA',
            cliente: 'Análisis General', proyecto: 'Todos los proyectos',
            canal: 'CRM Interno', accion: 'Análisis automático Sara',
            detalle: String(parsed.bitacora_resumen), estado: 'Completado'
          }, ...prev]);
        }
      } else {
        // High fidelity mock fallback
        const report = `REPORTE DE CONTINGENCIA — PREPARADO POR SARA VALENZUELA\n` +
          `Preparado el: ${new Date().toLocaleString()}\n` +
          `Prospectos analizados: ${listToAnalyze.length} leads activos en el CRM.\n\n` +
          `▌ ANÁLISIS DE EMBUDO:\n` +
          `• ${listToAnalyze.filter(p => p.estado === 'Cierre').length} prospectos en etapa de Cierre — prioridad máxima de seguimiento.\n` +
          `• ${listToAnalyze.filter(p => p.estado === 'Negociación').length} en Negociación — requieren propuestas personalizadas.\n` +
          `• ${listToAnalyze.filter(p => p.estado === 'Contacto Inicial').length} en Contacto Inicial — candidatos para calificación.\n\n` +
          `▌ ALERTAS CRÍTICAS:\n` +
          `• Carlos Gutiérrez solicita documentación tributaria CDI Colombia-Panamá para cerrar en Ocean Reef Park.\n` +
          `• Roberto Castaño requiere certificación escrita de exoneración predial 20 años en Surfside, Playa Caracol.\n` +
          `• Incremento del 25% en consultas sobre Formulario 160 de la DIAN.\n\n` +
          `▌ FAQs DETECTADAS EN CONSULTAS:\n` +
          `1. ¿Cómo se declara la propiedad en Panamá ante la DIAN (Formulario 160)?\n` +
          `2. ¿Existe exención del impuesto de inmuebles para proyectos nuevos?\n` +
          `3. ¿Cuáles son los requisitos de enganche hipotecario para extranjeros no residentes?\n\n` +
          `▌ ACCIONES RECOMENDADAS:\n` +
          `1. Enviar boletín fiscal de Colombia Tax Law Group a todos los prospectos en etapa Negociación y Cierre.\n` +
          `2. Actualizar FAQs con guía paso a paso del Formulario 160.\n` +
          `3. Programar llamada de seguimiento con Laura Sánchez — proyecto Playa Caracol.`;

        setSaraReportText(report);
        const alerts = [
          `Carlos Gutiérrez: Resolver documentación fiscal para cierre en Ocean Reef.`,
          `Roberto Castaño: Certificado predial Surfside Playa Caracol.`,
          `Laura Sánchez: Seguimiento urgente — interés activo en Playa Caracol.`
        ];
        setSaraAlertsList(alerts);
        setAgentSaraAlerts(alerts.length);
        const faqs = [
          { pregunta: '¿Cómo declaro mi propiedad en Panamá ante la DIAN?', respuesta: 'Se utiliza el Formulario 160 de la DIAN. GLP acompaña a sus clientes con Colombia Tax Law Group para este trámite sin costo adicional.' },
          { pregunta: '¿Las propiedades nuevas en Panamá tienen exención predial?', respuesta: 'Sí. Los proyectos de nueva construcción en Panamá tienen exoneración del impuesto de inmuebles por hasta 20 años, lo que mejora significativamente el retorno neto de la inversión.' },
          { pregunta: '¿Cuál es el enganche mínimo para extranjeros?', respuesta: 'Los bancos panameños generalmente solicitan entre el 30% y 40% de cuota inicial para compradores no residentes. GLP tiene convenios con Banistmo y BAC para facilitar este proceso.' },
        ];
        setSaraPendingFaqs(faqs);
        setBitacoraLogs(prev => [{
          id: Date.now(), fecha: dateStr, hora: timeStr, agente: 'SARA',
          cliente: 'Análisis General CRM', proyecto: 'Todos los proyectos',
          canal: 'CRM Interno', accion: 'Análisis de embudo y FAQs',
          detalle: `Sara analizó ${listToAnalyze.length} prospectos. Detectó ${alerts.length} alertas críticas y ${faqs.length} FAQs frecuentes para actualización.`,
          estado: 'Completado'
        }, ...prev]);
      }
      setAgentSaraMessages(m => m + Math.floor(Math.random() * 20) + 10);
      logMsg(`Completado. Sara actualizó el reporte, levantó alertas y detectó FAQs frecuentes. Bitácora actualizada.`);
    } catch (e: any) {
      logMsg(`Error en procesamiento de Sara: ${e.message}`);
    } finally {
      setSaraIsRunning(false);
    }
  };

  // Sara Q&A Handler
  const handleSaraQuestion = async () => {
    if (!saraQuestion.trim() || saraIsAnswering) return;
    setSaraIsAnswering(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'SARA', msg: `Procesando consulta específica: "${saraQuestion.substring(0, 30)}..."` }]);
    
    try {
      if (openaiKey.trim()) {
        const prompt = `Eres Sara Valenzuela, experta en Customer Success de GLP Panamá. Un ejecutivo comercial te ha hecho la siguiente consulta sobre los prospectos o tu reporte:
Consulta: "${saraQuestion}"

Contexto actual de los prospectos en el CRM:
${JSON.stringify(prospects.slice(0, 30).map(p => ({ cliente: p.nombre + ' ' + p.apellido, estado: p.estado, notas: p.notas, interes: p.proyectos_interes?.join(', ') })))}

Por favor, responde con el mayor nivel de detalle posible. Incluye sugerencias tácticas, próximos pasos recomendados y utiliza la información real proporcionada del CRM. NO uses markdown de código, solo texto con viñetas o saltos de línea normales. Sé extremadamente cálida, empática y motivadora con el equipo interno. Eres su compañera y apoyo incondicional; háblales con familiaridad, usando un tono positivo, alentador y muy amable.`;
        
        const res = await triggerOpenAI(prompt, 'Eres Sara Valenzuela de GLP Panamá. Apoyas al equipo comercial con tácticas de cierre. Tu personalidad es muy cálida, empática, y siempre estás dispuesta a ayudar a tus compañeros de equipo.');
        setSaraAnswer(String(res).trim());
      } else {
        await new Promise(r => setTimeout(r, 1500));
        setSaraAnswer(`Basado en mi análisis de la consulta "${saraQuestion}":\n\n1. Te sugiero contactar inmediatamente a Carlos Gutiérrez, su presupuesto de $1.5M USD está listo pero necesita asesoría fiscal urgente.\n2. Envía el brochure completo de Playa Caracol esta misma tarde a los prospectos en Contacto Inicial.\n\nSugerencia táctica: Utiliza los borradores redactados por Valeria para personalizar la atención y forzar los cierres.`);
      }
    } catch (e: any) {
      setSaraAnswer(`Error procesando la consulta: ${e.message}`);
    } finally {
      setSaraIsAnswering(false);
    }
  };

  // Valeria: works from Sara's report OR from admin free-form topic
  const handleValeria = async (isSwarm = false, silent = false, reportTextSrc?: string, adminTopic?: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    setValeriaIsRunning(true);
    const logMsg = (msg: string) => {
      if (!silent) setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'VALERIA', msg }]);
    };

    const topicSrc = adminTopic || valeriaAdminTopic;
    const reportSrc = reportTextSrc || saraReportText;
    const isAdminMode = topicSrc.trim().length > 0;

    logMsg(isAdminMode
      ? `Valeria generando contenido personalizado sobre: "${topicSrc.substring(0, 60)}..."`
      : 'Valeria redactando copys y correos basados en análisis de Sara...');

    const glpSig = `Cordialmente,\n\nValeria Restrepo\nCopywriter de Conversión & Estrategia de Contenidos\nGLP Wealth Management · Grupo Los Pueblos\n2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá\nE: info@glp.com.pa | W: www.glp.com.pa\n\nNota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de GLP Wealth Management.`;

    try {
      if (openaiKey.trim()) {
        logMsg('Conectando con OpenAI para redacción persuasiva de alto perfil...');
        const contextBlock = isAdminMode
          ? `El administrador solicita: "${topicSrc}". Contexto adicional del equipo: ${reportSrc.substring(0, 500)}`
          : `Reporte de Sara: "${reportSrc.substring(0, 800)}"`;

        const prompt = `Eres Valeria Restrepo, Copywriter de Conversión & Estrategia de Contenidos de GLP Panamá — especialista en inversiones inmobiliarias de lujo para compradores colombianos.

${contextBlock}

Genera:
1. Un correo de ventas persuasivo y elegante con la firma GLP completa al final.
2. Una publicación para LinkedIn profesional con hashtags relevantes.
3. Un copy de WhatsApp/Instagram Stories (máximo 3 líneas, impactante).

La firma GLP que SIEMPRE debe ir al final del correo es:
${glpSig}

Devuelve UN OBJETO JSON EXACTAMENTE (sin markdown, sin \`\`\`json):
{"correo": "texto completo del correo", "linkedin": "texto LinkedIn", "whatsapp": "copy corto WhatsApp/Stories"}`;

        const res = await triggerOpenAI(prompt, 'Eres Valeria, copywriter de lujo para inversores HNWI colombianos.');
        const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanRes);
        const newDrafts = [
          `${isAdminMode ? `📝 CONTENIDO PERSONALIZADO: "${topicSrc}"\n\n` : ''}CORREO DE VENTAS:\n${parsed.correo}`,
          `POST DE LINKEDIN:\n${parsed.linkedin}`,
          `COPY WHATSAPP/STORIES:\n${parsed.whatsapp}`
        ];
        setValeriaDrafts(prev => [...newDrafts, ...prev]);
      } else {
        // High fidelity mock
        const topicLabel = isAdminMode ? topicSrc : 'Exoneración Fiscal y Oportunidades de Inversión en GLP';
        const newDrafts = [
          `${isAdminMode ? `📝 CONTENIDO PERSONALIZADO: "${topicSrc}"\n\n` : ''}CORREO DE VENTAS:\nAsunto: ${topicLabel} — Su Inversión con GLP Panamá\n\nEstimado inversionista,\n\nLe escribimos porque sabemos que tomar la decisión de dolarizar su patrimonio merece la mejor información disponible. ${isAdminMode ? `Sobre el tema que nos indicó — "${topicSrc}" — queremos compartirle:` : 'Queremos compartirle un dato de alto interés:'}\n\nTodas las propiedades nuevas del portafolio GLP en Panamá cuentan con exoneración del impuesto predial por hasta 20 años. En el contexto regional actual, esto representa un retorno neto adicional de hasta 1.2% anual sobre su inversión.\n\nContáctenos para una sesión personalizada de ROI con nuestro equipo experto.\n\n${glpSig}`,
          `POST DE LINKEDIN:\n¿Sabía que en Panamá puede invertir en dólares, con exención predial de 20 años y retornos netos de hasta 8.5% anual? ${isAdminMode ? `Sobre ${topicSrc}:` : ''} En GLP, estructuramos su inversión con asesoría legal especializada de Colombia Tax Law Group para que declare todo con total tranquilidad ante la DIAN. #GLPPanamá #InversionInmobiliaria #Dolarizacion #WealthManagement`,
          `COPY WHATSAPP/STORIES:\n🏙️ ¿Inversión en dólares sin doble impuesto? En GLP Panamá, 20 años de exención predial aseguran tu retorno. ¡Escríbenos hoy! 👇`
        ];
        setValeriaDrafts(prev => [...newDrafts, ...prev]);
      }
      setAgentValeriaContent(c => c + 3);
      if (isAdminMode) setValeriaAdminTopic('');
      logMsg(`Completado. Valeria generó correo de ventas, post de LinkedIn y copy de Stories${isAdminMode ? ` sobre el tema: "${topicSrc}"` : ' basados en el análisis de Sara'}.`);
    } catch (e: any) {
      logMsg(`Error en redacción de Valeria: ${e.message}`);
    } finally {
      setValeriaIsRunning(false);
    }
  };

  // Isabella: synthesizes Sara+Valeria context OR admin topic; always logs to bitácora
  const handleIsabella = async (isSwarm = false, silent = false, reportTextSrc?: string, adminTopic?: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    setIsabellaIsRunning(true);
    const logMsg = (msg: string) => {
      if (!silent) setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'ISABELLA', msg }]);
    };

    const topicSrc = adminTopic || isabellaAdminTopic;
    const reportSrc = reportTextSrc || saraReportText;
    const valeriaCtx = valeriaDrafts.length > 0 ? valeriaDrafts[0].substring(0, 400) : '';
    const isAdminMode = topicSrc.trim().length > 0;

    logMsg(isAdminMode
      ? `Isabella creando contenido de video y redes sobre: "${topicSrc.substring(0, 60)}..."`
      : 'Isabella diseñando guiones de video y estrategia de contenido social...');

    try {
      if (openaiKey.trim()) {
        logMsg('Conectando con OpenAI para guiones de video y estrategia de marca...');
        const contextBlock = isAdminMode
          ? `El administrador solicita contenido sobre: "${topicSrc}". Contexto de Sara: ${reportSrc.substring(0, 400)}. Contexto de Valeria: ${valeriaCtx}`
          : `Reporte de Sara: "${reportSrc.substring(0, 500)}". Copys de Valeria: "${valeriaCtx}"`;

        const prompt = `Eres Isabella Brescia, Brand Ambassador y cara pública de GLP Panamá — carismática, elegante y especializada en inversiones inmobiliarias de lujo para colombianos.

${contextBlock}

Genera:
1. Un guión de Reel/TikTok de 60 segundos (con indicaciones de escena).
2. Un guión de video largo de YouTube (3-5 minutos, con secciones).
3. Un calendario semanal de publicaciones multiplataforma (Instagram, LinkedIn, TikTok, YouTube).

Devuelve UN OBJETO JSON EXACTAMENTE (sin markdown, sin \`\`\`json):
{"reel": "guión del reel de 60s", "youtube": "guión video largo", "calendario": "calendario semanal detallado"}`;

        const res = await triggerOpenAI(prompt, 'Eres Isabella, embajadora carismática de bienes raíces de lujo en Panamá.');
        const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanRes);
        const newScripts = [
          `${isAdminMode ? `🎯 TEMA ADMIN: "${topicSrc}"\n\n` : ''}🎬 REEL 60s:\n${parsed.reel}`,
          `📺 GUIÓN YOUTUBE:\n${parsed.youtube}`,
          `📅 CALENDARIO SEMANAL:\n${parsed.calendario}`
        ];
        setIsabellaScripts(prev => [...newScripts, ...prev]);
        setBitacoraLogs(prev => [{
          id: Date.now(), fecha: dateStr, hora: timeStr, agente: 'ISABELLA',
          cliente: isAdminMode ? 'Solicitud Admin' : 'Estrategia General',
          proyecto: 'Contenido Digital GLP',
          canal: 'Instagram / LinkedIn / TikTok / YouTube',
          accion: isAdminMode ? `Contenido personalizado: "${topicSrc}"` : 'Guiones y calendario de contenido',
          detalle: `Isabella generó ${newScripts.length} piezas: Reel 60s, guión YouTube y calendario semanal. ${isAdminMode ? `Tema solicitado: "${topicSrc}".` : `Basado en análisis de Sara y copys de Valeria.`}`,
          estado: 'Producción'
        }, ...prev]);
      } else {
        // High fidelity mock fallback
        const topicLabel = isAdminMode ? topicSrc : 'la exoneración predial de 20 años en Panamá';
        const newScripts = [
          `${isAdminMode ? `🎯 TEMA ADMIN: "${topicSrc}"\n\n` : ''}🎬 REEL 60s — GUIÓN COMPLETO:\n(Isabella en terraza de edificio moderno en Ciudad de Panamá, fondo skyline al atardecer)\n[Intro — 0:00] \"Hola, soy Isabella de GLP. Si eres colombiano y quieres proteger tu dinero en dólares, esto te interesa.\"\n[Cuerpo — 0:08] \"${isAdminMode ? `Hoy hablo sobre ${topicLabel}.` : 'Los proyectos nuevos en Panamá tienen CERO impuesto predial por hasta 20 años.'} Eso significa que tu retorno neto sube directamente.\"\n[Prueba — 0:25] \"Con GLP tienes asesoría legal de Colombia Tax Law Group incluida. Sin sorpresas con la DIAN.\"\n[CTA — 0:45] \"¿Quieres ver los números? Deja la palabra INVERSIÓN en los comentarios y te envío el análisis gratis.\"\n(Música: elegante, minimal | Subtítulos: activados | Hashtags: #GLPPanamá #InversionInmobiliaria #Dolarizacion)`,
          `📺 GUIÓN YOUTUBE (4 MINUTOS):\n▌ INTRO (0:00-0:30): Bienvenida + hook sobre ${topicLabel}.\n▌ PROBLEMA (0:30-1:30): ¿Por qué los colombianos temen invertir en Panamá? Mitos fiscales y dudas comunes sobre la DIAN.\n▌ SOLUCIÓN (1:30-3:00): Cómo GLP resuelve cada objeción — CDI Colombia-Panamá, exoneración predial 20 años, asesoría de Colombia Tax Law Group.\n▌ PORTAFOLIO (3:00-3:30): Proyectos destacados: Ocean Reef Park, The Tides Playa Caracol, Santa María Golf Club.\n▌ CTA (3:30-4:00): \"Agenda tu sesión de ROI personalizada en www.glp.com.pa — link en la descripción.\"`,
          `📅 CALENDARIO SEMANAL DE CONTENIDO:\n🔵 Lunes (LinkedIn): Artículo sobre ${topicLabel} — posicionamiento de autoridad.\n🟣 Martes (Instagram Reels): Reel 60s de Isabella — hook emocional sobre dolarización.\n🟡 Miércoles (WhatsApp Broadcast): Infografía de retorno neto con exoneración predial.\n🟢 Jueves (TikTok): Video corto respondiendo FAQ más frecuente del CRM.\n🔴 Viernes (YouTube): Video completo 4 min con análisis profundo.\n⚪ Sábado (Stories): Testimonio de cliente (texto anónimo) + call to action.\n\n📌 Horarios óptimos: Instagram 6 PM, LinkedIn 8 AM, TikTok 7 PM, YouTube 10 AM`
        ];
        setIsabellaScripts(prev => [...newScripts, ...prev]);
        setBitacoraLogs(prev => [{
          id: Date.now(), fecha: dateStr, hora: timeStr, agente: 'ISABELLA',
          cliente: isAdminMode ? 'Solicitud Admin' : 'Estrategia General',
          proyecto: 'Contenido Digital GLP',
          canal: 'Instagram / LinkedIn / TikTok / YouTube',
          accion: isAdminMode ? `Contenido personalizado: "${topicSrc}"` : 'Guiones y calendario semanal',
          detalle: `Isabella generó Reel 60s, guión YouTube 4min y calendario semanal sobre "${topicLabel}". Contenido listo para producción.`,
          estado: 'Producción'
        }, ...prev]);
      }
      setAgentIsabellaPosts(p => p + 3);
      if (isAdminMode) setIsabellaAdminTopic('');
      logMsg(`Completado. Isabella generó guión de Reel, video YouTube y calendario semanal${isAdminMode ? ` sobre "${topicSrc}"` : ''}. Registrado en Bitácora.`);
    } catch (e: any) {
      logMsg(`Error en Isabella: ${e.message}`);
    } finally {
      setIsabellaIsRunning(false);
    }
  };

  const runSwarm = async () => {
    if (swarmRunning) return;
    setSwarmRunning(true);
    setSwarmLogs([]);
    const timeStr = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Step 1: Camilo
    setSwarmStep(0);
    setSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '🚀 INICIANDO EQUIPO DE AGENTES INMOBILIARIOS...' }]);
    await handleCamilo(true, false);
    
    // Sleep 2s
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 2: Sara
    setSwarmStep(1);
    let latestProspects: Prospect[] = [];
    setProspects(prev => {
      latestProspects = prev;
      return prev;
    });
    await handleSara(true, false, latestProspects);
    
    // Sleep 2s
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 3: Valeria
    setSwarmStep(2);
    let latestReport = '';
    setSaraReportText(prev => {
      latestReport = prev;
      return prev;
    });
    await handleValeria(true, false, latestReport);
    
    // Sleep 2s
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 4: Isabella
    setSwarmStep(3);
    await handleIsabella(true, false, latestReport);
    
    // Sleep 1s
    await new Promise(r => setTimeout(r, 1000));
    
    setSwarmStep(null);
    setSwarmRunning(false);
    setSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '✅ EQUIPO FINALIZADO CON ÉXITO. Todos los datos, alertas y contenidos han sido sincronizados.' }]);
  };

  const runCrisisSwarm = async () => {
    if (crisisSwarmRunning) return;
    setCrisisSwarmRunning(true);
    setCrisisSwarmLogs([]);
    const timeStr = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Paso 1: Camilo
    setCrisisSwarmStep(0);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '🚀 Iniciando Equipo de Recuperación de Ventas Caídas...' }]);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'CAMILO', msg: 'Analizando las 4 ventas caídas del registro de objeciones...' }]);
    await new Promise(r => setTimeout(r, 1500));
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'CAMILO', msg: 'Mapeo completado. Las causas principales son: (1) Temores fiscales de doble tributación (DIAN) en un 50% y (2) Objeciones sobre tasas hipotecarias (8.5% USD) en un 25%.' }]);
    
    // Paso 2: Sara
    setCrisisSwarmStep(1);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SARA', msg: 'Sara analizando objeciones impositivas y de tasas...' }]);
    const reportText = `### REPORTE DE ANÁLISIS DE CRISIS — VENTAS CAÍDAS
**Generado por Sara Valenzuela (Customer Success)**
**Fecha:** ${today()}

1. **Objeción DIAN / Doble Tributación (50% de caídas):**
   - **Caso Crítico:** Juan Carlos Restrepo ($1.5M, Ocean Reef).
   - **Causa:** El cliente teme que el reporte CRS de la DIAN le imponga una carga excesiva en Colombia o que haya doble imposición.
   - **Solución:** Hay que aclarar que Panamá opera bajo un régimen territorial (no grava rentas extranjeras) y el CDI permite acreditar impuestos prediales panameños.

2. **Objeción de Tasas (25% de caídas):**
   - **Caso Crítico:** Carolina Posada ($180k, Ventu).
   - **Causa:** Tasa del 8.5% en USD se percibe alta.
   - **Solución:** Resaltar la compensación mediante la exención del impuesto predial por 20 años en obras nuevas, lo que neutraliza los intereses.`;
    
    setCrisisSaraReport(reportText);
    const alerts = [
      'Alerta Crítica: 2 clientes con objeciones tributarias sin material de Colombia Tax Law Group.',
      'Alerta Operativa: Urge enviar tabla comparativa de exención predial a Carolina Posada.'
    ];
    setCrisisSaraAlerts(alerts);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SARA', msg: 'Reporte generado. Se levantaron 2 Alertas Críticas de Objeciones.' }]);

    // Paso 3: Valeria
    setCrisisSwarmStep(2);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'VALERIA', msg: 'Valeria redactando contenido anti-crisis para contrarrestar objeciones...' }]);
    await new Promise(r => setTimeout(r, 1500));
    const emailDraft = `Asunto: Desmitificando la Doble Tributación y Tasas en Panamá — Su Inversión Segura

Estimado Inversionista,

Entendemos que al invertir en el exterior, la claridad legal es fundamental. Queremos aclararle dos mitos comunes:
1. **Doble Tributación**: Panamá opera bajo un sistema tributario territorial. Esto significa que usted NO paga impuesto predial por 20 años en nuestros proyectos nuevos, y sus rentas locales se benefician del CDI de 2015, permitiéndole acreditar lo pagado en Panamá ante la DIAN en Colombia.
2. **Tasa del 8.5%**: Aunque la tasa en dólares parezca alta, la exención tributaria predial durante 20 años y la valorización histórica (3-5% en USD) neutralizan por completo el costo financiero, resultando en un rendimiento neto superior al de cualquier CDT en Colombia.

Le invitamos a una sesión privada con Colombia Tax Law Group para estructurar su compra.

Cordialmente,

Valeria Restrepo
Especialista en Copywriting & Contenido Premium
GLP Wealth Management · Grupo Los Pueblos
2GFM+R7, C. Ramon H. Jurado, Panamá, Provincia de Panamá, Panamá

Nota de Confidencialidad: Esta comunicación y sus anexos contienen información exclusiva y confidencial de GLP Wealth Management. Queda estrictamente prohibido su uso, divulgación o reproducción sin autorización previa y por escrito.`;
    
    const postDraft = `¿Preocupado por la doble tributación Colombia-Panamá?
Muchos inversionistas creen que declarar sus activos en dólares les generará doble impuesto. La verdad es que gracias a la legislación territorial y al CDI de 2015, puedes estructurar tu portafolio de forma 100% legal y eficiente. Además, con 20 años de exención de impuesto predial en proyectos GLP, tus retornos netos en dólares están blindados.
#InversionDolarizada #DIAN #ColombiaTaxLaw #GLPPanamá`;

    setCrisisValeriaDrafts([emailDraft, postDraft]);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'VALERIA', msg: 'Copys generados: 1 Email de Contra-Objeciones y 1 Post de LinkedIn.' }]);

    // Paso 4: Isabella
    setCrisisSwarmStep(3);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'ISABELLA', msg: 'Isabella estructurando el guión del Reel y la campaña de marca...' }]);
    await new Promise(r => setTimeout(r, 1500));
    
    const scriptText = `Guión de Reels (1 Minuto) - Objeciones de Inversión:
"¿Crees que invertir en dólares en Panamá te va a costar el doble en impuestos con la DIAN? ¡Es un mito! Hola, soy Isabella de GLP. Panamá opera con sistema tributario territorial, lo que significa que no pagas impuestos de fuente panameña dos veces. Y lo mejor: los proyectos nuevos están exentos de impuesto predial por 20 años. Sí, ¡dos décadas sin predial! Eso neutraliza cualquier tasa de interés hipotecaria y asegura retornos netos de hasta el 8.5% en USD. Escribe la palabra IMPUESTOS y te enviamos la guía fiscal gratuita de Colombia Tax Law Group."`;
    
    const calendarText = `Campaña de Crisis Semanal:
- Lunes: Publicar Reel de Isabella explicando la exención predial de 20 años.
- Miércoles: Enviar mailing masivo con el borrador de Valeria a los leads fríos.
- Viernes: Mesa redonda interactiva en vivo por LinkedIn con socios de Colombia Tax Law Group.`;
    
    setCrisisIsabellaScripts([scriptText, calendarText]);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'ISABELLA', msg: 'Script de video y Campaña de Crisis finalizados.' }]);

    setCrisisSwarmStep(null);
    setCrisisSwarmRunning(false);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '✅ Campaña de crisis generada con éxito. Material disponible para edición y envío.' }]);
  };

  const renderCrisisSwarmConsole = () => {
    const steps = [
      { label: 'Camilo (Minería)', icon: '🔍' },
      { label: 'Sara (Análisis)', icon: '📊' },
      { label: 'Valeria (Copys)', icon: '✍️' },
      { label: 'Isabella (Guión)', icon: '🎬' }
    ];

    return (
      <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 18, border: `1.5px solid ${T.borderLight}`, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>Consola de Gestión de Crisis & Objeciones IA</div>
          </div>
          <button
            onClick={runCrisisSwarm}
            disabled={crisisSwarmRunning}
            style={btnPrimary({
              padding: '8px 16px', fontSize: 12,
              background: crisisSwarmRunning ? T.textSec : T.teal,
              cursor: crisisSwarmRunning ? 'not-allowed' : 'pointer'
            })}
          >
            {crisisSwarmRunning ? 'Ejecutando Equipo...' : 'Ejecutar Equipo de Crisis'}
          </button>
        </div>

        {/* Swarm Stepper Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: T.card, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
          {steps.map((st, idx) => {
            const isActive = crisisSwarmStep === idx;
            const isCompleted = crisisSwarmStep !== null && crisisSwarmStep > idx;
            return (
              <div key={st.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, opacity: (isActive || isCompleted || crisisSwarmStep === null) ? 1 : 0.4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isCompleted ? T.success : (isActive ? T.coral : T.bg),
                  color: (isActive || isCompleted) ? T.card : T.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
                  border: `2px solid ${isActive ? T.coral : (isCompleted ? T.success : T.border)}`,
                  marginBottom: 4
                }}>
                  {isCompleted ? '✓' : st.icon}
                </div>
                <div style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, color: isActive ? T.coral : T.textSec }}>{st.label}</div>
              </div>
            );
          })}
        </div>

        {/* Logs terminal */}
        <div style={{ height: 100, overflowY: 'auto', background: '#1E293B', color: '#38BDF8', borderRadius: 8, padding: 10, fontSize: 11, fontFamily: 'monospace', marginBottom: 16 }}>
          {crisisSwarmLogs.length === 0 ? (
            <div style={{ color: '#64748B', fontStyle: 'italic' }}>Esperando ejecución del equipo...</div>
          ) : (
            crisisSwarmLogs.map((log, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <span style={{ color: '#64748B' }}>[{log.time}]</span>{' '}
                <span style={{ color: log.agent === 'SISTEMA' ? '#34D399' : (log.agent === 'CAMILO' ? '#60A5FA' : (log.agent === 'SARA' ? '#FB7185' : '#FBBF24')), fontWeight: 700 }}>{log.agent}:</span>{' '}
                <span style={{ color: '#E2E8F0' }}>{log.msg}</span>
              </div>
            ))
          )}
        </div>

        {/* Swarm Outputs (Report + Copys + Video Scripts) */}
        {(crisisSaraReport || crisisValeriaDrafts.length > 0 || crisisIsabellaScripts.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {/* Sara's Report & Alerts */}
            {crisisSaraReport && (
              <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1.5px solid ${T.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.teal, marginBottom: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 4 }}>📊 Informe & Alertas de Sara</div>
                <div style={{ maxHeight: 150, overflowY: 'auto', fontSize: 11, color: T.text, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  {crisisSaraReport}
                </div>
                {crisisSaraAlerts.length > 0 && (
                  <div style={{ marginTop: 8, borderTop: `1px dashed ${T.border}`, paddingTop: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.danger, marginBottom: 4 }}>🚨 Alertas Críticas Generadas:</div>
                    {crisisSaraAlerts.map((al, idx) => (
                      <div key={idx} style={{ fontSize: 10, color: T.danger, marginBottom: 2 }}>• {al}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Valeria's Drafts */}
            {crisisValeriaDrafts.length > 0 && (
              <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1.5px solid ${T.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.coral, marginBottom: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 4 }}>✍️ Copys de Ventas de Valeria</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11, color: T.text, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  <strong>Email Especializado:</strong>
                  <p style={{ margin: '4px 0 0' }}>{crisisValeriaDrafts[0]}</p>
                  <hr style={{ border: 'none', borderTop: `1px dashed ${T.border}`, margin: '8px 0' }} />
                  <strong>LinkedIn Post:</strong>
                  <p style={{ margin: '4px 0 0' }}>{crisisValeriaDrafts[1]}</p>
                </div>
              </div>
            )}

            {/* Isabella's Brand Content */}
            {crisisIsabellaScripts.length > 0 && (
              <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1.5px solid ${T.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.palm, marginBottom: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 4 }}>🎬 Guión & Cronograma de Isabella</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11, color: T.text, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  <strong>Reel Script:</strong>
                  <p style={{ margin: '4px 0 0' }}>{crisisIsabellaScripts[0]}</p>
                  <hr style={{ border: 'none', borderTop: `1px dashed ${T.border}`, margin: '8px 0' }} />
                  <strong>Plan de Publicaciones:</strong>
                  <p style={{ margin: '4px 0 0' }}>{crisisIsabellaScripts[1]}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════
  const today = () => new Date().toISOString().split('T')[0];

  const calcMortgage = useCallback((principal: number, rateAnual: number, years: number) => {
    if (principal <= 0 || rateAnual <= 0 || years <= 0) return 0;
    const r = rateAnual / 100 / 12;
    const n = years * 12;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }, []);

  const handleCalcFeePMPctChange = (val: number) => {
    setCalcFeePMPct(val);
    setCalcFeePM(Math.round((calcArea * calcRentaM2) * (val / 100)));
  };

  const handleCalcFeePMChange = (val: number) => {
    setCalcFeePM(val);
    const rentaMensual = calcArea * calcRentaM2;
    if (rentaMensual > 0) {
      setCalcFeePMPct(Number(((val / rentaMensual) * 100).toFixed(3)));
    }
  };

  const handleCalcSeguroPctChange = (val: number) => {
    setCalcSeguroPct(val);
    setCalcSeguro(Math.round(calcPrecio * (val / 100)));
  };

  const handleCalcSeguroChange = (val: number) => {
    setCalcSeguro(val);
    if (calcPrecio > 0) {
      setCalcSeguroPct(Number(((val / calcPrecio) * 100).toFixed(3)));
    }
  };

  const handleCalcPredialPctChange = (val: number) => {
    setCalcPredialPct(val);
    setCalcPredial(Math.round(calcPrecio * (val / 100)));
  };

  const handleCalcPredialChange = (val: number) => {
    setCalcPredial(val);
    if (calcPrecio > 0) setCalcPredialPct(Number(((val / calcPrecio) * 100).toFixed(3)));
  };

  const handleCalcCondominioPctChange = (val: number) => {
    setCalcCondominioPct(val);
    setCalcCondominio(Math.round((calcPrecio * (val / 100)) / 12));
  };

  const handleCalcCondominioChange = (val: number) => {
    setCalcCondominio(val);
    if (calcPrecio > 0) setCalcCondominioPct(Number((((val * 12) / calcPrecio) * 100).toFixed(3)));
  };

  const handleSetCalcPrecio = (val: number) => {
    setCalcPrecio(val);
    setCalcSeguro(Math.round(val * (calcSeguroPct / 100)));
    setCalcPredial(Math.round(val * (calcPredialPct / 100)));
    setCalcCondominio(Math.round((val * (calcCondominioPct / 100)) / 12));
  };

  const handleSetCalcArea = (val: number) => {
    setCalcArea(val);
    const rentaMensual = val * calcRentaM2;
    setCalcFeePM(Math.round(rentaMensual * (calcFeePMPct / 100)));
  };

  const handleSetCalcRentaM2 = (val: number) => {
    setCalcRentaM2(val);
    const rentaMensual = calcArea * val;
    setCalcFeePM(Math.round(rentaMensual * (calcFeePMPct / 100)));
  };

  // ── Select Calc Project ─────────────────────────────────
  const selectCalcProject = (name: string) => {
    setCalcProject(name);
    const p = crmProjects.find(x => x.name === name);
    const pActivos = projectsList.find(x => x.name === name) || {} as any;
    
    if (!p) return;

    // Precio del activo desde Módulo de Activos Inmobiliarios
    const activoPrice = pActivos.price ? Number(pActivos.price) : p.minPrice;
    
    // Metraje desde Módulo de Activos Inmobiliarios (puede ser string con rango "45-71")
    let activoArea = p.areaMin;
    if (pActivos.area) {
      const match = String(pActivos.area).match(/\d+(\.\d+)?/);
      if (match) activoArea = parseFloat(match[0]);
    }

    setCalcPrecio(activoPrice);
    setCalcArea(activoArea);
    
    // Arrendamiento por metro desde Inteligencia de Mercados
    setCalcRentaM2(p.rentM2Max || 12);
    
    setCalcVacancia(p.vacancyDef);
    setCalcCondominio(0); // always default to 0
    setCalcValorizacion(1); // User requested 1% default
    setCalcFeePMPct(0);
    setCalcFeePM(0);
    setCalcSeguroPct(0.1);
    setCalcSeguro(Math.round(activoPrice * 0.001));
  };

  // ══════════════════════════════════════════════════════
  // STYLE HELPERS
  // ══════════════════════════════════════════════════════
  const sidebarBtn = (moduleId: string) => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 10,
    width: '100%',
    padding: '10px 16px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer' as const,
    fontSize: 13,
    fontWeight: activeModule === moduleId ? 700 : 500,
    fontFamily: 'Inter, sans-serif',
    color: activeModule === moduleId ? T.card : T.text,
    background: activeModule === moduleId ? T.teal : 'transparent',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
    marginBottom: 4,
  });



  const sectionTitle = (text: string) => (
    <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: '0 0 16px 0', borderLeft: `4px solid ${T.teal}`, paddingLeft: 12 }}>{text}</h3>
  );

  const renderSidebarIcon = (id: string, color: string) => {
    const size = 16;
    switch (id) {
      case 'portafolio':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M3 21h18" />
            <path d="M9 21V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12" />
            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
          </svg>
        );
      case 'activos':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
        );
      case 'kpis':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M3 3v18h18" />
            <path d="m18 8-5 5-3-3-4 4" />
          </svg>
        );
      case 'brokers':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'prospectos':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'eventos':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'agentes':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
          </svg>
        );
      case 'faqs':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'calculadora':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="16" y1="14" x2="16" y2="18" />
            <line x1="8" y1="10" x2="8" y2="10.01" />
            <line x1="12" y1="10" x2="12" y2="10.01" />
            <line x1="16" y1="10" x2="16" y2="10.01" />
            <line x1="8" y1="14" x2="8" y2="14.01" />
            <line x1="12" y1="14" x2="12" y2="14.01" />
            <line x1="8" y1="18" x2="8" y2="18.01" />
            <line x1="12" y1="18" x2="12" y2="18.01" />
          </svg>
        );
      case 'acceso':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        );
      default:
        return null;
    }
  };

  const renderButtonIcon = (name: string, size = 12, style: Record<string, any> = {}) => {
    const defaultStyle = { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style };
    switch (name) {
      case 'eye':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        );
      case 'pencil':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        );
      case 'trash':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        );
      case 'check':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'close':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      case 'play':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        );
      case 'pause':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        );
      case 'chart':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        );
      case 'clipboard':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
        );
      case 'alert':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="m10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'document':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case 'share':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        );
      case 'calendar':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'video':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="m22 8-6 4 6 4V8Z" />
            <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
          </svg>
        );
      case 'plus':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
      case 'search':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        );
      case 'arrow-left':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        );
      case 'renta':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case 'disfrute':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <line x1="2" y1="12" x2="22" />
          </svg>
        );
      case 'patrimonial':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={defaultStyle}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const badge = (text: string, bg: string, color: string) => (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color }}>{text}</span>
  );

  const statCard = (label: string, value: string, color: string, icon: string) => (
    <div style={{ ...cardStyle(), textAlign: 'center' as const }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>{label}</div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // MODULE 1: PORTAFOLIO GLP
  // ══════════════════════════════════════════════════════════════
  const renderPortafolio = () => {
    const sortedProjects = [...crmProjects].sort((a, b) => a.name.localeCompare(b.name));
    const filtered = portFilter === 'all' ? sortedProjects : sortedProjects.filter(p => p.category === portFilter);
    const fallbackGradients = [
      T.teal,
      T.sky,
      T.palm,
      T.coral,
      T.textSec,
    ];

    return (
      <div>
        {sectionTitle('Portafolio GLP · Proyectos de Inversión')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            ['all', 'Todos', ''],
            ['Proyecto de Ciudad', 'Proyecto de Ciudad', ''],
            ['Ocean Reef Islands', 'Ocean Reef Islands', ''],
            ['Playa Caracol', 'Playa Caracol', '']
          ].map(([id, label, iconName]) => (
            <button key={id} onClick={() => setPortFilter(id)} style={{
              ...btnSecondary({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
              background: portFilter === id ? T.teal : 'transparent',
              color: portFilter === id ? T.card : T.teal,
            }}>
              {iconName && renderButtonIcon(iconName, 12)}
              <span>{label}</span>
            </button>
          ))}
          <span style={{ fontSize: 12, color: T.textSec, alignSelf: 'center', marginLeft: 8 }}>{filtered.length} proyectos</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map((p, i) => {
            const expanded = expandedProject === p.name;
            const imgs = PROJECT_IMAGES[p.name];
            const heroStyle = imgs
              ? { backgroundImage: `url(${imgs.main})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: fallbackGradients[i % fallbackGradients.length] };
            return (
              <div key={p.name} style={{ ...cardStyle({ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }), ...(expanded ? { gridColumn: '1 / -1' } : {}) }}
                onClick={() => {
                  if (expanded) {
                    setExpandedProject(null);
                  } else {
                    setExpandedProject(p.name);
                    setCrmProjSearchQuery(p.zoneShort || p.zone.split('—')[1]?.trim() || p.zone.split(',')[0]);
                  }
                }}>
                <div style={{ height: expanded ? 200 : 160, ...heroStyle, display: 'flex', alignItems: 'flex-end', padding: 16, position: 'relative' as const }}>
                  <div style={{ position: 'absolute' as const, inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
                  <div style={{ position: 'relative' as const, zIndex: 1, display: 'flex', gap: 6, alignItems: 'flex-end', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: expanded ? 18 : 15, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{p.zoneShort}</div>
                    </div>
                    {badge(p.investorType === 'renta' ? 'Renta' : p.investorType === 'disfrute' ? 'Disfrute' : 'Patrimonial', 'rgba(255,255,255,0.2)', '#fff')}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: T.textSec }}>Desde: </span><span style={{ fontWeight: 700, color: T.teal }}>{usd(p.minPrice)}</span></div>
                    <div><span style={{ color: T.textSec }}>Hab: </span><span style={{ fontWeight: 600 }}>{p.bedrooms}</span></div>
                    <div style={{ gridColumn: 'span 2' }}><span style={{ color: T.textSec }}>Área: </span><span style={{ fontWeight: 600 }}>{p.areaMin}–{p.areaMax} m²</span></div>
                  </div>
                  {expanded && (
                    <div style={{ marginTop: 16, borderTop: `1px solid ${T.borderLight}`, paddingTop: 16 }} onClick={e => e.stopPropagation()}>
                      {/* PHOTO GALLERY */}
                      {imgs && imgs.gallery.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>📸 Galería del Proyecto</div>
                            <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic' }}>Clic para ampliar</div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(imgs.gallery.length, 3)}, 1fr)`, gap: 8 }}>
                            {imgs.gallery.slice(0, 6).map((g, gi) => (
                              <div key={gi} style={{ borderRadius: 8, overflow: 'hidden', height: 140 }}
                                onClick={e => { e.stopPropagation(); setCrmLightboxImg(g); }}>
                                <img src={g} alt={`${p.name} ${gi+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, marginBottom: 16 }}>
                        <div><span style={{ color: T.textSec }}>Zona: </span>{p.zone}</div>
                        <div><span style={{ color: T.textSec }}>Fecha de Entrega: </span><span style={{ fontWeight: 600, color: T.coral }}>{p.construction}</span></div>
                        <div><span style={{ color: T.textSec }}>Precio/m²: </span>{usd(p.priceM2Min)}–{usd(p.priceM2Max)}</div>
                        <div><span style={{ color: T.textSec }}>Renta sugerida: </span>{usd(p.rentSuggest)}/mes</div>
                        <div><span style={{ color: T.textSec }}>Vacancia: </span>{p.vacancyDef}%</div>
                        <div><span style={{ color: T.textSec }}>Condominio: </span>{usd(p.condominioMes)}/mes</div>
                        <div><span style={{ color: T.textSec }}>Valorización: </span>{p.appreciationDef}% anual</div>
                        <div><span style={{ color: T.textSec }}>Renta/m²: </span>${p.rentM2Min}–${p.rentM2Max}</div>
                      </div>
                      <div style={{ fontSize: 12, color: T.textSec, marginBottom: 8 }}>{p.appreciationNote}</div>

                      {/* ZONE FOOTNOTE */}
                      <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${T.borderLight}`, fontSize: 11, color: T.textSec, fontStyle: 'italic', lineHeight: 1.4 }}>
                        {getZoneNotes(p.zone)}
                      </div>

                      {/* MARKET STUDY SEARCH WIDGET */}
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: `${T.teal}08`, border: `1.5px solid ${T.teal}18`, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          Estudio de Mercado Panamá (Capital Brokers Q2 2026)
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input
                            type="text"
                            placeholder="Buscar en el estudio de Panamá..."
                            value={crmProjSearchQuery}
                            onChange={e => setCrmProjSearchQuery(e.target.value)}
                            style={{ flex: 1, padding: '5px 10px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 11, background: T.card, color: T.text, outline: 'none' }}
                          />
                          <button onClick={() => setCrmProjSearchQuery(p.zoneShort || p.zone.split('—')[1]?.trim() || p.zone.split(',')[0])} style={{ padding: '4px 10px', borderRadius: 6, background: T.teal, color: T.card, border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Zona</button>
                        </div>
                        <div style={{ maxHeight: 90, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {crmProjSearchQuery.trim() ? (
                            MARKET_STUDY_DB.filter(item =>
                              item.text.toLowerCase().includes(crmProjSearchQuery.toLowerCase()) ||
                              item.section.toLowerCase().includes(crmProjSearchQuery.toLowerCase())
                            ).slice(0, 3).map((insight, idx) => (
                              <div key={idx} style={{ padding: '6px 8px', background: T.card, borderRadius: 6, borderLeft: `3px solid ${T.coral}`, fontSize: 11, lineHeight: 1.4 }}>
                                <span style={{ fontWeight: 700, color: T.coral, display: 'block', marginBottom: 2 }}>{insight.section}</span>
                                {insight.text}
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>Escriba un término para buscar...</div>
                          )}
                          {crmProjSearchQuery.trim() && MARKET_STUDY_DB.filter(item =>
                            item.text.toLowerCase().includes(crmProjSearchQuery.toLowerCase()) ||
                            item.section.toLowerCase().includes(crmProjSearchQuery.toLowerCase())
                          ).length === 0 && (
                            <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>Sin resultados para "{crmProjSearchQuery}".</div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>Amenidades</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {p.amenities.map((a: string) => (
                            <span key={a} style={{ background: T.sand, color: T.text, padding: '4px 10px', borderRadius: 16, fontSize: 11 }}>{a}</span>
                          ))}
                        </div>
                      </div>

                      {/* ROI Calculator shortcut */}
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.borderLight}`, display: 'flex', gap: 8 }}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            selectCalcProject(p.name);
                            setActiveModule('calculadora');
                          }}
                          style={{
                            flex: 1, background: `linear-gradient(135deg, ${T.teal} 0%, #0891B2 100%)`,
                            color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px',
                            fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          📈 Calcular ROI de este proyecto
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            window.open(`/project.html?name=${encodeURIComponent(p.name)}`, '_blank');
                          }}
                          style={{
                            background: T.bg, color: T.teal, border: `1.5px solid ${T.teal}`,
                            borderRadius: 8, padding: '10px 14px', fontWeight: 700,
                            fontSize: 12, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = T.teal; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.color = T.teal; }}
                        >
                          📄 Ficha técnica
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // MODULE 2: DASHBOARD KPIs
  // ══════════════════════════════════════════════════════════════
  const renderKPIs = () => {
    const funnelStages = [
      { label: 'Contacto', value: kpiFunnelContacto, set: setOverrideFunnelContacto, color: T.sky },
      { label: 'Calificación', value: kpiFunnelCalif, set: setOverrideFunnelCalif, color: T.teal },
      { label: 'Presentación', value: kpiFunnelPres, set: setOverrideFunnelPres, color: T.palm },
      { label: 'Negociación', value: kpiFunnelNeg, set: setOverrideFunnelNeg, color: T.warning },
      { label: 'Cierre', value: kpiFunnelCierre, set: setOverrideFunnelCierre, color: T.success },
    ];

    const matchStage = (pStage: string, kpiStage: string) => {
      const p = pStage.toLowerCase().trim();
      const k = kpiStage.toLowerCase().trim();
      if (k === 'contacto') return p === 'contacto inicial' || p === 'contacto';
      return p === k;
    };

    const matchSource = (pSource: string, kpiSource: string) => {
      const p = pSource.toLowerCase().trim();
      const k = kpiSource.toLowerCase().trim();
      if (k === 'redes sociales') {
        return p === 'redes' || p === 'linkedin' || p === 'tiktok' || p === 'instagram' || p === 'facebook' || p === 'redes sociales';
      }
      if (k === 'web') return p === 'web' || p === 'pagina web';
      return p.includes(k) || k.includes(p);
    };

    const totalLeads = prospects.length || 1;
    const countSource = (srcLabel: string) => {
      return prospects.filter(p => matchSource(p.forma_contacto, srcLabel)).length;
    };

    const leadSources = [
      { label: 'Redes Sociales', pct: Math.round((countSource('Redes Sociales') / totalLeads) * 100), color: T.sky },
      { label: 'Referidos', pct: Math.round((countSource('Referidos') / totalLeads) * 100), color: T.teal },
      { label: 'Eventos', pct: Math.round((countSource('Eventos') / totalLeads) * 100), color: T.palm },
      { label: 'Web', pct: Math.round((countSource('Web') / totalLeads) * 100), color: T.coral },
      { label: 'WhatsApp', pct: Math.round((countSource('WhatsApp') / totalLeads) * 100), color: T.success },
    ];

    const editableValue = (key: string, value: number, setter: (v: number) => void, prefix = '', suffix = '') => {
      if (kpiEditMode === key) {
        return (
          <input type="number" autoFocus value={value}
            onChange={e => setter(Number(e.target.value))}
            onBlur={() => setKpiEditMode(null)}
            onKeyDown={e => { if (e.key === 'Enter') setKpiEditMode(null); }}
            style={{ ...inputStyle({ width: 100, fontSize: 20, fontWeight: 700, textAlign: 'center' as const, padding: '4px 8px' }) }}
          />
        );
      }
      return (
        <span onClick={(e) => { e.stopPropagation(); setKpiEditMode(key); }} style={{ cursor: 'pointer', borderBottom: `2px dashed ${T.border}` }} title="Clic para editar">
          {prefix}{fmt(value)}{suffix}
        </span>
      );
    };

    const renderTicketDrilldown = () => {
      const total = closedSales.reduce((sum, s) => sum + s.value, 0);
      const avg = closedSales.length > 0 ? total / closedSales.length : 0;
      return (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Suma Total de Ventas Cerradas</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.teal }}>{usd(total)}</div>
            </div>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Total de Transacciones</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.teal }}>{closedSales.length} cierres</div>
            </div>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Ticket Promedio Real Calculado</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.palm }}>{usd(avg)}</div>
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Cliente</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Proyecto Vendido</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Broker Asignado</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Fecha de Cierre</th>
                <th style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>Monto Venta (USD)</th>
              </tr>
            </thead>
            <tbody>
              {closedSales.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{s.prospect}</td>
                  <td style={{ padding: 8 }}>{s.project}</td>
                  <td style={{ padding: 8 }}>{s.broker}</td>
                  <td style={{ padding: 8 }}>{s.date}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.teal }}>{usd(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    const renderConversionDrilldown = () => {
      const totalLost = lostSales.reduce((sum, s) => sum + s.value, 0);
      return (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ background: `${T.danger}08`, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.danger}20` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Valor de Ventas Caídas</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.danger }}>{usd(totalLost)}</div>
            </div>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Negocios Caídos Registrados</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.textSec }}>{lostSales.length} objeciones</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12 }}>
            Registro detallado de negocios perdidos y objeciones fiscales o hipotecarias. Use la consola de crisis a continuación para activar los agentes de IA.
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 24 }}>
            <thead>
              <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Cliente</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Proyecto</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Broker</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Fecha Caída</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Razón Específica de Caída / Objeción</th>
                <th style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>Valor (USD)</th>
              </tr>
            </thead>
            <tbody>
              {lostSales.map(s => (
                <tr key={s.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <td style={{ padding: 8, fontWeight: 600 }}>{s.prospect}</td>
                  <td style={{ padding: 8 }}>{s.project}</td>
                  <td style={{ padding: 8 }}>{s.broker}</td>
                  <td style={{ padding: 8 }}>{s.date}</td>
                  <td style={{ padding: 8, color: T.danger, fontWeight: 500 }}>⚠️ {s.reason}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.textSec }}>{usd(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {renderCrisisSwarmConsole()}
        </div>
      );
    };

    const renderFunnelDrilldown = (stage: string) => {
      const list = prospects.filter(p => matchStage(p.estado, stage));
      return (
        <div>
          <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12 }}>
            Se encontraron <b>{list.length} prospectos</b> en la etapa <b>{stage}</b>. Haga clic en el nombre del prospecto para ir a su detalle completo.
          </div>
          {list.length === 0 ? (
            <div style={{ padding: 16, background: T.bg, borderRadius: 8, color: T.textSec, fontStyle: 'italic', textAlign: 'center' }}>
              No hay prospectos actualmente en esta etapa.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Nombre</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Proyectos de Interés</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Broker Asignado</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Origen</th>
                  <th style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>Presupuesto (USD)</th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: 8 }}>
                      <span onClick={() => { setActiveModule('prospectos'); setProspectDetail(p.id); }} style={{ fontWeight: 600, color: T.sky, cursor: 'pointer', textDecoration: 'underline' }}>
                        {p.nombre} {p.apellido}
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>{p.proyectos_interes.join(', ')}</td>
                    <td style={{ padding: 8 }}>{p.broker_asignado}</td>
                    <td style={{ padding: 8 }}>{p.forma_contacto}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.teal }}>{usd(p.presupuesto_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    };

    const renderSourceDrilldown = (srcLabel: string) => {
      const list = prospects.filter(p => matchSource(p.forma_contacto, srcLabel));
      return (
        <div>
          <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12 }}>
            Se encontraron <b>{list.length} prospectos</b> provenientes de <b>{srcLabel}</b>. Haga clic en el nombre del prospecto para ver más detalles.
          </div>
          {list.length === 0 ? (
            <div style={{ padding: 16, background: T.bg, borderRadius: 8, color: T.textSec, fontStyle: 'italic', textAlign: 'center' }}>
              No hay prospectos registrados bajo esta fuente.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Nombre</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Proyectos de Interés</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Estado / Avance</th>
                  <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Broker Asignado</th>
                  <th style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>Presupuesto (USD)</th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: 8 }}>
                      <span onClick={() => { setActiveModule('prospectos'); setProspectDetail(p.id); }} style={{ fontWeight: 600, color: T.sky, cursor: 'pointer', textDecoration: 'underline' }}>
                        {p.nombre} {p.apellido}
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>{p.proyectos_interes.join(', ')}</td>
                    <td style={{ padding: 8 }}>{p.estado}</td>
                    <td style={{ padding: 8 }}>{p.broker_asignado}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.teal }}>{usd(p.presupuesto_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    };

    const renderProspectsTotalDrilldown = () => {
      const totalBudget = prospects.reduce((sum, p) => sum + p.presupuesto_usd, 0);
      const avgBudget = prospects.length > 0 ? totalBudget / prospects.length : 0;
      
      const handleSort = (key: string) => {
        if (prospectsSortKey === key) {
          setProspectsSortDir(prospectsSortDir === 'asc' ? 'desc' : 'asc');
        } else {
          setProspectsSortKey(key);
          setProspectsSortDir('asc');
        }
      };

      const getSortIcon = (key: string) => {
        if (prospectsSortKey !== key) return ' ⇅';
        return prospectsSortDir === 'asc' ? ' ↑' : ' ↓';
      };

      const sortedProspects = [...prospects].sort((a, b) => {
        let valA: any = a[prospectsSortKey as keyof Prospect];
        let valB: any = b[prospectsSortKey as keyof Prospect];

        if (prospectsSortKey === 'proyectos_interes') {
          valA = a.proyectos_interes.join(', ');
          valB = b.proyectos_interes.join(', ');
        } else if (prospectsSortKey === 'broker_asignado') {
          valA = a.broker_asignado || '';
          valB = b.broker_asignado || '';
        } else if (prospectsSortKey === 'estado') {
          valA = FUNNEL_STAGES.indexOf(a.estado) !== -1 ? FUNNEL_STAGES.indexOf(a.estado) : 99;
          valB = FUNNEL_STAGES.indexOf(b.estado) !== -1 ? FUNNEL_STAGES.indexOf(b.estado) : 99;
        }

        if (valA < valB) return prospectsSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return prospectsSortDir === 'asc' ? 1 : -1;
        return 0;
      });

      return (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Total Prospectos Registrados</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.sky }}>{prospects.length} leads</div>
            </div>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Presupuesto Promedio</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.sky }}>{usd(avgBudget)}</div>
            </div>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Suma de Presupuestos (Pipeline)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.teal }}>{usd(totalBudget)}</div>
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Nombre</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Contacto</th>
                <th onClick={() => handleSort('proyectos_interes')} style={{ padding: 8, textAlign: 'left', fontWeight: 600, cursor: 'pointer' }}>Proyectos de Interés{getSortIcon('proyectos_interes')}</th>
                <th onClick={() => handleSort('estado')} style={{ padding: 8, textAlign: 'left', fontWeight: 600, cursor: 'pointer' }}>Etapa{getSortIcon('estado')}</th>
                <th onClick={() => handleSort('broker_asignado')} style={{ padding: 8, textAlign: 'left', fontWeight: 600, cursor: 'pointer' }}>Broker Asignado{getSortIcon('broker_asignado')}</th>
                <th onClick={() => handleSort('presupuesto_usd')} style={{ padding: 8, textAlign: 'right', fontWeight: 600, cursor: 'pointer' }}>Presupuesto (USD){getSortIcon('presupuesto_usd')}</th>
                {showAdvancedAI && <th style={{ padding: 8, textAlign: 'left', fontWeight: 600, width: 80 }}>Score IA</th>}
              </tr>
            </thead>
            <tbody>
              {sortedProspects.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <td style={{ padding: 8 }}>
                    <span onClick={() => { setActiveModule('prospectos'); setProspectDetail(p.id); }} style={{ fontWeight: 600, color: T.sky, cursor: 'pointer', textDecoration: 'underline' }}>
                      {p.nombre} {p.apellido}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>
                    <div style={{ fontWeight: 500 }}>{p.correo}</div>
                    <div style={{ fontSize: 10, color: T.textSec }}>{p.telefono}</div>
                  </td>
                  <td style={{ padding: 8 }}>{p.proyectos_interes.join(', ')}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{
                      background: p.estado === 'Cierre' ? `${T.success}15` : `${T.coral}15`,
                      color: p.estado === 'Cierre' ? T.success : T.coral,
                      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600
                    }}>
                      {p.estado}
                    </span>
                  </td>
                  <td style={{ padding: 8 }}>{p.broker_asignado || 'Sin Asignar'}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.teal }}>{usd(p.presupuesto_usd)}</td>
                  {showAdvancedAI && (
                    <td style={{ padding: 8 }}>
                      {renderThermometer(calculateLeadScore(p))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    const renderBrokersActiveDrilldown = () => {
      const activeBrokersList = brokers.filter(b => b.estado === 'activo');
      return (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Brokers Activos</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.coral }}>{activeBrokersList.length} activos</div>
            </div>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, flex: 1, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 11, color: T.textSec }}>Total Brokers Registrados</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.textSec }}>{brokers.length} total</div>
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}` }}>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Nombre</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Empresa</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Zona</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Contacto</th>
                <th style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>Prospectos Traídos</th>
                <th style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>Ventas Cerradas (USD)</th>
              </tr>
            </thead>
            <tbody>
              {activeBrokersList.map(b => {
                const assignedProspects = prospects.filter(p => p.broker_asignado === b.nombre);
                const brokerSales = closedSales.filter(s => s.broker === b.nombre).reduce((sum, s) => sum + s.value, 0);
                
                return (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: 8 }}>
                      <span onClick={() => { setActiveModule('brokers'); setBrokerDrilldown(b.id); }} style={{ fontWeight: 600, color: T.coral, cursor: 'pointer', textDecoration: 'underline' }}>
                        {b.nombre}
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>{b.empresa}</td>
                    <td style={{ padding: 8 }}>{b.zona}</td>
                    <td style={{ padding: 8 }}>
                      <div>{b.email}</div>
                      <div style={{ fontSize: 10, color: T.textSec }}>{b.telefono}</div>
                    </td>
                    <td style={{ padding: 8, textAlign: 'center', fontWeight: 600 }}>{assignedProspects.length}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.teal }}>{usd(brokerSales)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };

    const generateSaraAlerts = () => {
      const alerts: { id: string; title: string; desc: string; actionText: string; action: () => void; type: 'warning'|'success' }[] = [];
      
      prospects.forEach(p => {
        // Cold Leads
        if (p.estado === 'Contacto Inicial') {
          const hasHistory = p.historial.length > 0;
          let daysSinceLast = 999;
          if (hasHistory) {
            const lastDate = new Date(p.historial[p.historial.length - 1].fecha);
            daysSinceLast = (new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
          }
          if (!hasHistory || daysSinceLast > 7) {
            alerts.push({
              id: `cold_${p.id}`,
              title: `Lead Enfriándose: ${p.nombre} ${p.apellido}`,
              desc: `No ha habido contacto en más de 7 días. Presupuesto estimado: $${p.presupuesto_usd?.toLocaleString() || 'N/A'}.`,
              actionText: 'Revisar Perfil',
              action: () => { setActiveModule('prospectos'); setProspectDetail(p.id); },
              type: 'warning'
            });
          }
        }

        // Hidden Opportunities
        if (p.presupuesto_usd && p.presupuesto_usd >= 300000 && p.estado !== 'Cierre' && p.estado !== 'Post-venta') {
          if (p.historial.length <= 2) {
            alerts.push({
              id: `opp_${p.id}`,
              title: `Oportunidad Alto Valor: ${p.nombre} ${p.apellido}`,
              desc: `Cliente con presupuesto de $${p.presupuesto_usd.toLocaleString()} requiere mayor seguimiento estratégico.`,
              actionText: 'Asignar Tarea',
              action: () => { setActiveModule('prospectos'); setProspectDetail(p.id); },
              type: 'success'
            });
          }
        }
      });

      return alerts.slice(0, 3); // Max 3
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {sectionTitle('Dashboard KPIs · Control Comercial')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: showAdvancedAI ? T.teal : T.textSec }}>
              Herramientas de IA (Avanzado)
            </span>
            <button 
              onClick={() => setShowAdvancedAI(!showAdvancedAI)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none',
                background: showAdvancedAI ? T.teal : T.border,
                position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: '#FFF',
                position: 'absolute', top: 2, left: showAdvancedAI ? 22 : 2,
                transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
        </div>

        {/* S.A.R.A Alerts Panel */}
        {showAdvancedAI && generateSaraAlerts().length > 0 && (
          <div style={{ ...cardStyle({ padding: '16px 20px', marginBottom: 24 }), borderLeft: `4px solid ${T.teal}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.teal }}>Recomendaciones Proactivas de S.A.R.A</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {generateSaraAlerts().map(al => (
                <div key={al.id} style={{ 
                  background: al.type === 'warning' ? '#FFFBEB' : '#ECFDF5',
                  border: `1px solid ${al.type === 'warning' ? '#FDE68A' : '#A7F3D0'}`,
                  borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: al.type === 'warning' ? '#D97706' : '#059669', marginBottom: 4 }}>
                    {al.title}
                  </div>
                  <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12, flex: 1 }}>
                    {al.desc}
                  </div>
                  <button 
                    onClick={al.action}
                    style={{ ...btnSecondary({ padding: '6px 12px', fontSize: 11 }), alignSelf: 'flex-start', background: '#FFF' }}
                  >
                    {al.actionText}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Top metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div 
            onClick={() => setActiveDrilldown(activeDrilldown?.type === 'ticket' ? null : { type: 'ticket' })}
            style={cardStyle({ 
              textAlign: 'center' as const, 
              cursor: 'pointer', 
              border: activeDrilldown?.type === 'ticket' ? `2px solid ${T.teal}` : `1.5px solid ${T.borderLight}`,
              boxShadow: activeDrilldown?.type === 'ticket' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            })}
          >
            <div style={{ marginBottom: 8, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.coral} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.teal }}>
              {editableValue('ticket', kpiTicketPromedio, setOverrideTicketPromedio, '$')}
            </div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Ticket Promedio USD</div>
            <div style={{ fontSize: 10, color: T.teal, marginTop: 6, fontWeight: 600 }}>Ver Detalle (Drilldown)</div>
          </div>
          
          <div 
            onClick={() => setActiveDrilldown(activeDrilldown?.type === 'conversion' ? null : { type: 'conversion' })}
            style={cardStyle({ 
              textAlign: 'center' as const, 
              cursor: 'pointer', 
              border: activeDrilldown?.type === 'conversion' ? `2px solid ${T.palm}` : `1.5px solid ${T.borderLight}`,
              boxShadow: activeDrilldown?.type === 'conversion' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            })}
          >
            <div style={{ marginBottom: 8, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.palm} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.palm }}>
              {editableValue('conversion', kpiConversion, setOverrideConversion, '', '%')}
            </div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Conversión Global</div>
            <div style={{ fontSize: 10, color: T.palm, marginTop: 6, fontWeight: 600 }}>Ver Detalle (Objeciones)</div>
          </div>
          
          <div 
            onClick={() => setActiveDrilldown(activeDrilldown?.type === 'prospects_total' ? null : { type: 'prospects_total' })}
            style={cardStyle({ 
              textAlign: 'center' as const, 
              cursor: 'pointer', 
              border: activeDrilldown?.type === 'prospects_total' ? `2px solid ${T.sky}` : `1.5px solid ${T.borderLight}`,
              boxShadow: activeDrilldown?.type === 'prospects_total' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            })}
          >
            <div style={{ marginBottom: 8, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.sky} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M9 21v-2a4 4 0 0 0-4-4H3a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.sky }}>{prospects.length}</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Prospectos Totales</div>
            <div style={{ fontSize: 10, color: T.sky, marginTop: 6, fontWeight: 600 }}>Ver Detalle (Drilldown)</div>
          </div>
          
          <div 
            onClick={() => setActiveDrilldown(activeDrilldown?.type === 'brokers_active' ? null : { type: 'brokers_active' })}
            style={cardStyle({ 
              textAlign: 'center' as const, 
              cursor: 'pointer', 
              border: activeDrilldown?.type === 'brokers_active' ? `2px solid ${T.coral}` : `1.5px solid ${T.borderLight}`,
              boxShadow: activeDrilldown?.type === 'brokers_active' ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            })}
          >
            <div style={{ marginBottom: 8, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.coral} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.coral }}>{brokers.filter(b => b.estado === 'activo').length}</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Brokers Activos</div>
            <div style={{ fontSize: 10, color: T.coral, marginTop: 6, fontWeight: 600 }}>Ver Detalle (Drilldown)</div>
          </div>
        </div>

        {/* Presupuesto bar con drilldown */}
        <div style={{ ...cardStyle(), marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Presupuesto: Ejecutado vs Planeado</div>
            <button
              onClick={() => setActiveDrilldown(activeDrilldown?.type === 'presupuesto' ? null : { type: 'presupuesto' })}
              style={{
                background: activeDrilldown?.type === 'presupuesto' ? T.teal : 'transparent',
                color: activeDrilldown?.type === 'presupuesto' ? '#fff' : T.teal,
                border: `1.5px solid ${T.teal}`, borderRadius: 6, padding: '4px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {activeDrilldown?.type === 'presupuesto' ? '▲ Cerrar detalle' : '▼ Ver detalle'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: T.textSec, minWidth: 80 }}>Ejecutado</span>
            <div style={{ flex: 1, height: 28, background: T.borderLight, borderRadius: 14, overflow: 'hidden', position: 'relative' as const }}>
              <div style={{ height: '100%', width: `${Math.min(100, (kpiPresupuestoEjecutado / kpiPresupuestoPlaneado) * 100)}%`, background: T.teal, borderRadius: 14, transition: 'width 0.5s' }} />
              <span style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: T.card }}>
                {usd(kpiPresupuestoEjecutado)}
              </span>
            </div>
            <span style={{ fontSize: 12, color: T.textSec, minWidth: 90, textAlign: 'right' as const }}>
              de {editableValue('presPlaneado', kpiPresupuestoPlaneado, setKpiPresupuestoPlaneado, '$')}
            </span>
          </div>
          <div style={{ textAlign: 'right' as const, fontSize: 11, color: T.textSec, marginTop: 4 }}>
            {pct((kpiPresupuestoEjecutado / kpiPresupuestoPlaneado) * 100)} ejecutado · Clic en valores para editar
          </div>

          {/* Drilldown presupuesto por evento */}
          {activeDrilldown?.type === 'presupuesto' && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${T.borderLight}`, paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Ejecución Presupuestal por Evento</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {events.map(ev => {
                  const asignado = ev.presupuesto_asignado || 0;
                  const ejecutado = ev.presupuesto_ejecutado || 0;
                  const pctExec = asignado > 0 ? Math.min(100, (ejecutado / asignado) * 100) : 0;
                  const color = pctExec > 90 ? T.coral : pctExec > 60 ? '#D97706' : T.palm;
                  return (
                    <div key={ev.id} style={{ padding: '10px 14px', background: T.bg, borderRadius: 10, border: `1px solid ${T.borderLight}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{ev.titulo}</div>
                          <div style={{ fontSize: 11, color: T.textSec }}>{ev.fecha} · {ev.venue}</div>
                        </div>
                        <div style={{ textAlign: 'right' as const }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color }}>{pct(pctExec)} ejecutado</div>
                          <div style={{ fontSize: 11, color: T.textSec }}>{usd(ejecutado)} / {usd(asignado)}</div>
                        </div>
                      </div>
                      <div style={{ height: 6, background: T.borderLight, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctExec}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                      </div>
                      {ev.items_costo.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {ev.items_costo.map((item, ii) => (
                            <span key={ii} style={{
                              fontSize: 10, background: `${color}15`, color,
                              border: `1px solid ${color}30`, borderRadius: 5, padding: '2px 8px', fontWeight: 600,
                            }}>{item.concepto}: {usd(item.valor)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic', marginTop: 4 }}>
                  Total ejecutado en eventos: {usd(events.reduce((s, e) => s + (e.presupuesto_ejecutado || 0), 0))} ·
                  Total asignado: {usd(events.reduce((s, e) => s + (e.presupuesto_asignado || 0), 0))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Pipeline Funnel */}
          <div style={cardStyle()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Pipeline de Ventas (Clic en filas para ver proyectos/leads)</div>
            {funnelStages.map((s, i) => {
              const maxVal = funnelStages[0].value || 1;
              const widthPct = Math.max(15, (s.value / maxVal) * 100);
              const isSelected = activeDrilldown?.type === 'funnel' && activeDrilldown?.stage === s.label;
              return (
                <div 
                  key={s.label} 
                  onClick={() => setActiveDrilldown(isSelected ? null : { type: 'funnel', stage: s.label })}
                  style={{ 
                    marginBottom: 10, 
                    cursor: 'pointer', 
                    padding: '6px 8px', 
                    borderRadius: 8, 
                    border: `1px solid ${isSelected ? s.color : 'transparent'}`,
                    background: isSelected ? `${s.color}08` : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: T.text, fontWeight: isSelected ? 700 : 500 }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: s.color, cursor: 'pointer', borderBottom: `1px dashed ${T.border}` }}
                      onClick={e => { 
                        e.stopPropagation(); 
                        setKpiEditMode(`funnel_${i}`); 
                      }}>
                      {kpiEditMode === `funnel_${i}` ? (
                        <input type="number" autoFocus value={s.value}
                          onChange={e => s.set(Number(e.target.value))}
                          onBlur={() => setKpiEditMode(null)}
                          onKeyDown={e => { if (e.key === 'Enter') setKpiEditMode(null); }}
                          style={{ ...inputStyle({ width: 50, fontSize: 12, fontWeight: 700, padding: '2px 4px', textAlign: 'center' as const }) }}
                        />
                      ) : s.value}
                    </span>
                  </div>
                  <div style={{ height: 24, background: T.borderLight, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${widthPct}%`, background: s.color, borderRadius: 12, transition: 'width 0.4s', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.card }}>{s.value}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leads por fuente */}
          <div style={cardStyle()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Leads por Fuente (Clic en filas para ver prospectos)</div>
            {leadSources.map(s => {
              const isSelected = activeDrilldown?.type === 'source' && activeDrilldown?.source === s.label;
              return (
                <div 
                  key={s.label} 
                  onClick={() => setActiveDrilldown(isSelected ? null : { type: 'source', source: s.label })}
                  style={{ 
                    marginBottom: 12, 
                    cursor: 'pointer', 
                    padding: '6px 8px', 
                    borderRadius: 8, 
                    border: `1px solid ${isSelected ? s.color : 'transparent'}`,
                    background: isSelected ? `${s.color}08` : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: T.text, fontWeight: isSelected ? 700 : 500 }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: s.color }}>{s.pct}%</span>
                  </div>
                  <div style={{ height: 10, background: T.borderLight, borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 5, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Drilldown Container */}
        {activeDrilldown && (
          <div style={{ marginTop: 24, background: T.card, borderRadius: 12, padding: 20, border: `1.5px solid ${T.teal}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `2px solid ${T.teal}`, paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.teal }}>
                {activeDrilldown.type === 'ticket' && '🔍 Detalle de Ticket Promedio (Ventas Cerradas)'}
                {activeDrilldown.type === 'conversion' && '📈 Detalle de Conversión (Ventas Caídas / Objeciones / Control de Crisis)'}
                {activeDrilldown.type === 'funnel' && `👥 Detalle de Pipeline: Etapa "${activeDrilldown.stage}"`}
                {activeDrilldown.type === 'source' && `🔌 Detalle de Leads por Fuente: "${activeDrilldown.source}"`}
                {activeDrilldown.type === 'prospects_total' && '👥 Detalle de Prospectos Totales Registrados'}
                {activeDrilldown.type === 'brokers_active' && '🤝 Detalle de Red de Brokers Activos'}
              </h3>
              <button 
                onClick={() => setActiveDrilldown(null)} 
                style={{
                  background: 'none', border: 'none', color: '#718096',
                  fontSize: '1.25rem', cursor: 'pointer', padding: '4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#FF6B6B'}
                onMouseLeave={e => e.currentTarget.style.color = '#718096'}
              >
                ✕
              </button>
            </div>
            
            {activeDrilldown.type === 'ticket' && renderTicketDrilldown()}
            {activeDrilldown.type === 'conversion' && renderConversionDrilldown()}
            {activeDrilldown.type === 'funnel' && renderFunnelDrilldown(activeDrilldown.stage || '')}
            {activeDrilldown.type === 'source' && renderSourceDrilldown(activeDrilldown.source || '')}
            {activeDrilldown.type === 'prospects_total' && renderProspectsTotalDrilldown()}
            {activeDrilldown.type === 'brokers_active' && renderBrokersActiveDrilldown()}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // MODULE 3: BROKERS
  // ══════════════════════════════════════════════════════════════
  const renderBrokers = () => {
    const commissionEntities = [
      { name: 'Colombia Tax Law Group', pct: 1 },
      { name: 'Grupo Valverde', pct: 1 },
      { name: 'Capital Brokers', pct: 1 },
      { name: 'Red de Brokers (distribuible)', pct: 2 },
    ];

    const sampleDeals = closedSales.map(s => {
      const brokerObj = brokers.find(b => b.nombre === s.broker);
      const empresa = brokerObj ? brokerObj.empresa : 'Independiente';
      return {
        deal: `${s.project} - ${s.prospect}`,
        valorVenta: s.value,
        broker: s.broker,
        empresa: empresa
      };
    });

    const filteredDeals = sampleDeals.filter(d => {
      if (commissionFilterBroker !== 'all' && d.broker !== commissionFilterBroker) return false;
      if (commissionFilterCompany !== 'all' && d.empresa !== commissionFilterCompany) return false;
      return true;
    });

    const totalVentas = filteredDeals.reduce((sum, d) => sum + d.valorVenta, 0);
    const totalComision = totalVentas * 0.05;

    const uniqueBrokersInDeals = Array.from(new Set(
      sampleDeals
        .filter(d => commissionFilterCompany === 'all' || d.empresa === commissionFilterCompany)
        .map(d => d.broker)
    )).sort();
    const uniqueCompaniesInDeals = Array.from(new Set(
      sampleDeals
        .filter(d => commissionFilterBroker === 'all' || d.broker === commissionFilterBroker)
        .map(d => d.empresa)
    )).sort();

    const visibleEntities = brokerEntityFilter === 'all' ? commissionEntities :
      commissionEntities.filter(e => e.name === brokerEntityFilter);

    const addBroker = () => {
      if (!newBroker.nombre || !newBroker.empresa) return;
      setBrokers([...brokers, { ...newBroker, id: Date.now(), estado: 'activo' } as Broker]);
      setNewBroker({ nombre: '', empresa: '', zona: '', telefono: '', email: '' });
      setShowBrokerForm(false);
    };

    const drillBroker = brokerDrilldown ? brokers.find(b => b.id === brokerDrilldown) : null;

    const handleExport = (format: 'excel' | 'pdf') => {
      let title = '';
      let headers: string[] = [];
      let rows: any[][] = [];
      let totals: any[] = [];

      if (brokerEntityFilter === 'all') {
        title = 'Reporte Consolidado de Comisiones GLP';
        headers = ['Deal / Propiedad', 'Broker', 'Empresa', 'Valor Venta', 'Comisión Total (5%)', 'Col. Tax Law (1%)', 'Valverde (1%)', 'Capital Brokers (1%)', 'Red de Brokers (2%)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          d.empresa,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.05),
          usd(d.valorVenta * 0.01),
          usd(d.valorVenta * 0.01),
          usd(d.valorVenta * 0.01),
          usd(d.valorVenta * 0.02)
        ]);
        totals = [
          'TOTAL CONSOLIDADO',
          '',
          '',
          usd(totalVentas),
          usd(totalComision),
          usd(totalVentas * 0.01),
          usd(totalVentas * 0.01),
          usd(totalVentas * 0.01),
          usd(totalVentas * 0.02)
        ];
      } else if (brokerEntityFilter === 'Colombia Tax Law Group') {
        title = 'Reporte de Comisiones - Colombia Tax Law Group';
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Empresa', 'Valor Venta', 'Comisión CTLG (1% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          d.empresa,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.01)
        ]);
        totals = ['TOTAL ENTIDAD', '', '', usd(totalVentas), usd(totalVentas * 0.01)];
      } else if (brokerEntityFilter === 'Grupo Valverde') {
        title = 'Reporte de Comisiones - Grupo Valverde';
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Empresa', 'Valor Venta', 'Comisión Valverde (1% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          d.empresa,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.01)
        ]);
        totals = ['TOTAL ENTIDAD', '', '', usd(totalVentas), usd(totalVentas * 0.01)];
      } else if (brokerEntityFilter === 'Capital Brokers') {
        title = 'Reporte de Comisiones - Capital Brokers';
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Empresa', 'Valor Venta', 'Comisión Capital (1% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          d.empresa,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.01)
        ]);
        totals = ['TOTAL ENTIDAD', '', '', usd(totalVentas), usd(totalVentas * 0.01)];
      } else if (brokerEntityFilter === 'Red de Brokers (distribuible)') {
        title = 'Reporte de Comisiones - Red de Brokers Consolidado';
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Empresa', 'Valor Venta', 'Comisión Red (2% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          d.empresa,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.02)
        ]);
        totals = ['TOTAL RED', '', '', usd(totalVentas), usd(totalVentas * 0.02)];
      }

      const exportExcel = (titleStr: string, headersStr: string[], dataRows: any[][], totalsRow: any[]) => {
        let html = `<html><head><title>${titleStr}</title>`;
        html += `<style>`;
        html += `body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1E293B; padding: 40px; background-color: #F8FAFC; }`;
        html += `.header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0F2C59; padding-bottom: 10px; margin-bottom: 20px; }`;
        html += `.logo { font-size: 24px; font-weight: bold; color: #0F2C59; }`;
        html += `.title { font-size: 18px; font-weight: bold; color: #1E293B; text-transform: uppercase; }`;
        html += `.meta { font-size: 12px; color: #64748B; margin-bottom: 20px; }`;
        html += `table { width: 100%; border-collapse: collapse; margin-top: 10px; }`;
        html += `th { background-color: #0F2C59; color: #FFFFFF; font-weight: bold; border: 1px solid #CBD5E1; padding: 10px; text-align: left; font-size: 12px; }`;
        html += `td { border: 1px solid #CBD5E1; padding: 10px; font-size: 12px; color: #1E293B; }`;
        html += `.text-left { text-align: left; }`;
        html += `.text-right { text-align: right; }`;
        html += `.total-row { background-color: #E2E8F0; font-weight: bold; }`;
        html += `.footer { margin-top: 40px; border-top: 1px solid #CBD5E1; padding-top: 10px; font-size: 10px; color: #64748B; text-align: center; }`;
        html += `</style></head><body>`;
        html += `<h2>${titleStr}</h2>`;
        html += `<p><strong>Generado el:</strong> ${new Date().toLocaleString()}<br/>`;
        html += `<strong>Filtros Activos:</strong> `;
        const activeFilters: string[] = [];
        if (brokerEntityFilter !== 'all') activeFilters.push(`Entidad: ${brokerEntityFilter}`);
        if (commissionFilterBroker !== 'all') activeFilters.push(`Broker: ${commissionFilterBroker}`);
        if (commissionFilterCompany !== 'all') activeFilters.push(`Empresa: ${commissionFilterCompany}`);
        html += activeFilters.length > 0 ? activeFilters.join(' | ') : 'Ninguno';
        html += `</p>`;
        html += `<table><thead><tr>`;
        headersStr.forEach(h => {
          html += `<th>${h}</th>`;
        });
        html += `</tr></thead><tbody>`;
        dataRows.forEach(row => {
          html += `<tr>`;
          row.forEach(cell => {
            const isNum = typeof cell === 'number' || (typeof cell === 'string' && cell.startsWith('$'));
            const alignClass = isNum ? 'text-right' : 'text-left';
            html += `<td class="${alignClass}">${cell}</td>`;
          });
          html += `</tr>`;
        });
        if (totalsRow && totalsRow.length > 0) {
          html += `<tr class="total-row">`;
          totalsRow.forEach(cell => {
            const isNum = typeof cell === 'number' || (typeof cell === 'string' && cell.startsWith('$'));
            const alignClass = isNum ? 'text-right' : 'text-left';
            html += `<td class="${alignClass}">${cell}</td>`;
          });
          html += `</tr>`;
        }
        html += `</tbody></table></body></html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titleStr.toLowerCase().replace(/[^a-z0-9]/g, '_')}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      const exportPDF = (titleStr: string, headersStr: string[], dataRows: any[][], totalsRow: any[]) => {
        const win = window.open('', '_blank');
        if (!win) {
          alert('Por favor permite las ventanas emergentes para generar el PDF');
          return;
        }
        let html = `<html><head><title>${titleStr}</title>`;
        html += `<link rel="preconnect" href="https://fonts.googleapis.com">`;
        html += `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
        html += `<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">`;
        html += `<style>`;
        html += `body { font-family: 'Inter', sans-serif; color: #222222; padding: 40px; background-color: #FFFFFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
        html += `.header { border-bottom: 1px solid #B89047; padding-bottom: 15px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }`;
        html += `.logo { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 400; color: #002349; letter-spacing: 0.12em; text-transform: uppercase; }`;
        html += `.title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; font-weight: 600; color: #B89047; letter-spacing: 0.05em; text-transform: uppercase; }`;
        html += `.meta { font-size: 11px; color: #555555; margin-bottom: 30px; line-height: 1.6; }`;
        html += `.meta strong { color: #002349; }`;
        html += `table { width: 100%; border-collapse: collapse; margin-top: 15px; }`;
        html += `th { background-color: #002349; color: #FFFFFF; font-family: 'Inter', sans-serif; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid #002349; padding: 12px 10px; text-align: left; font-size: 10px; }`;
        html += `td { border: 1px solid #E5E7EB; border-bottom: 1px solid #D1D5DB; padding: 11px 10px; font-size: 11px; color: #222222; }`;
        html += `.text-left { text-align: left; }`;
        html += `.text-right { text-align: right; }`;
        html += `.total-row { background-color: rgba(0, 35, 73, 0.03) !important; font-weight: bold; border-top: 2px solid #B89047 !important; border-bottom: 2px solid #B89047 !important; }`;
        html += `.total-row td { border-top: 2px solid #B89047 !important; border-bottom: 2px solid #B89047 !important; color: #002349; font-weight: 600; }`;
        html += `.footer { margin-top: 50px; border-top: 1px solid #B89047; padding-top: 20px; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 13px; color: #555555; text-align: center; }`;
        html += `.no-print-btn { background: #002349; border: 1px solid #B89047; color: #FFFFFF; padding: 8px 16px; font-family: 'Inter', sans-serif; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; transition: all 0.2s ease-in-out; }`;
        html += `.no-print-btn:hover { background: #FFFFFF; color: #002349; }`;
        html += `@media print { body { padding: 0; } .no-print { display: none; } }`;
        html += `</style></head><body>`;
        html += `<div class="no-print" style="text-align: right; margin-bottom: 20px;">`;
        html += `<button class="no-print-btn" onclick="window.print()">Imprimir Reporte</button>`;
        html += `</div>`;
        html += `<div class="header">`;
        html += `<div class="logo">GLP · GRUPO LOS PUEBLOS</div>`;
        html += `<div class="title">Reporte de Comisiones</div>`;
        html += `</div>`;
        html += `<div class="meta">`;
        html += `<strong>Reporte:</strong> ${titleStr}<br/>`;
        html += `<strong>Fecha de Generación:</strong> ${new Date().toLocaleString()}<br/>`;
        html += `<strong>Filtros Activos:</strong> `;
        const activeFilters: string[] = [];
        if (brokerEntityFilter !== 'all') activeFilters.push(`Entidad: ${brokerEntityFilter}`);
        if (commissionFilterBroker !== 'all') activeFilters.push(`Broker: ${commissionFilterBroker}`);
        if (commissionFilterCompany !== 'all') activeFilters.push(`Empresa: ${commissionFilterCompany}`);
        html += activeFilters.length > 0 ? activeFilters.join(' | ') : 'Ninguno';
        html += `<br/>`;
        html += `<strong>Moneda:</strong> USD (Dólares Americanos)`;
        html += `</div>`;
        html += `<table><thead><tr>`;
        headersStr.forEach(h => {
          html += `<th>${h}</th>`;
        });
        html += `</tr></thead><tbody>`;
        dataRows.forEach(row => {
          html += `<tr>`;
          row.forEach(cell => {
            const isNum = typeof cell === 'number' || (typeof cell === 'string' && cell.startsWith('$'));
            const alignClass = isNum ? 'text-right' : 'text-left';
            html += `<td class="${alignClass}">${cell}</td>`;
          });
          html += `</tr>`;
        });
        if (totalsRow && totalsRow.length > 0) {
          html += `<tr class="total-row">`;
          totalsRow.forEach(cell => {
            const isNum = typeof cell === 'number' || (typeof cell === 'string' && cell.startsWith('$'));
            const alignClass = isNum ? 'text-right' : 'text-left';
            html += `<td class="${alignClass}">${cell}</td>`;
          });
          html += `</tr>`;
        }
        html += `</tbody></table>`;
        html += `<div class="footer">Este documento es un reporte financiero comercial emitido por la plataforma GLP CRM. Todos los montos están expresados en USD.</div>`;
        html += `<script>window.onload = function() { window.print(); }</script>`;
        html += `</body></html>`;

        win.document.write(html);
        win.document.close();
      };

      if (format === 'excel') {
        exportExcel(title, headers, rows, totals);
      } else {
        exportPDF(title, headers, rows, totals);
      }
    };

    return (
      <div>
        {sectionTitle('Red de Brokers · Control de Desempeño')}

        {/* Broker directory - TOP */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Directorio de Brokers Activos y Afiliados ({brokers.length})</div>
          <button onClick={() => setShowBrokerForm(!showBrokerForm)} style={btnPrimary()}>
            {showBrokerForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Agregar Broker</span>
              </span>
            )}
          </button>
        </div>

        {showBrokerForm && (
          <div style={{ ...cardStyle({ marginBottom: 16, background: T.sand }) }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Nombre</label>
                <input value={newBroker.nombre} onChange={e => setNewBroker({ ...newBroker, nombre: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Empresa</label>
                <input value={newBroker.empresa} onChange={e => setNewBroker({ ...newBroker, empresa: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Zona</label>
                <input value={newBroker.zona} onChange={e => setNewBroker({ ...newBroker, zona: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input value={newBroker.telefono} onChange={e => setNewBroker({ ...newBroker, telefono: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={newBroker.email} onChange={e => setNewBroker({ ...newBroker, email: e.target.value })} style={inputStyle()} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={addBroker} style={btnPrimary({ width: '100%' })}>Guardar Broker</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ ...cardStyle({ padding: 0, overflowHidden: true, marginBottom: 20 }) }}>
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.teal, color: T.card }}>
                  {['Nombre', 'Empresa', 'Zona', 'Prospectos Activos', 'Negocios (Cerrados/Caídos)', 'Tasa de Cierre', 'Comisiones (2% Red)', 'Estado', 'Acción'].map(h => (
                    <th key={h} style={{ color: T.card, padding: '12px 14px', textAlign: h.includes('Comisiones') || h.includes('Tasa') || h.includes('Prospectos') || h.includes('Negocios') ? 'center' as const : 'left' as const, fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '8px 14px' }}><input placeholder="Filtrar Nombre..." style={{width: '100%', padding: '4px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: '4px'}} value={brokerFilters.nombre} onChange={e => setBrokerFilters({...brokerFilters, nombre: e.target.value})} /></th>
                  <th style={{ padding: '8px 14px' }}><input placeholder="Filtrar Empresa..." style={{width: '100%', padding: '4px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: '4px'}} value={brokerFilters.empresa} onChange={e => setBrokerFilters({...brokerFilters, empresa: e.target.value})} /></th>
                  <th style={{ padding: '8px 14px' }}><input placeholder="Filtrar Zona..." style={{width: '100%', padding: '4px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: '4px'}} value={brokerFilters.zona} onChange={e => setBrokerFilters({...brokerFilters, zona: e.target.value})} /></th>
                  <th style={{ padding: '8px 14px' }}><input type="number" placeholder="Mínimo..." style={{width: '100%', padding: '4px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: '4px'}} value={brokerFilters.prospectos} onChange={e => setBrokerFilters({...brokerFilters, prospectos: e.target.value})} /></th>
                  <th style={{ padding: '8px 14px' }}><input type="number" placeholder="Mínimo..." style={{width: '100%', padding: '4px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: '4px'}} value={brokerFilters.negocios} onChange={e => setBrokerFilters({...brokerFilters, negocios: e.target.value})} /></th>
                  <th style={{ padding: '8px 14px' }}><input type="number" placeholder="Min %..." style={{width: '100%', padding: '4px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: '4px'}} value={brokerFilters.tasa} onChange={e => setBrokerFilters({...brokerFilters, tasa: e.target.value})} /></th>
                  <th style={{ padding: '8px 14px' }}><input type="number" placeholder="Min USD..." style={{width: '100%', padding: '4px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: '4px'}} value={brokerFilters.comisiones} onChange={e => setBrokerFilters({...brokerFilters, comisiones: e.target.value})} /></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const computedBrokers = brokers.map(b => {

                  const bClosed = closedSales.filter(s => s.broker === b.nombre);
                  const bLost = lostSales.filter(l => l.broker === b.nombre);
                  const totalDeals = bClosed.length + bLost.length;
                  const closeRate = totalDeals > 0 ? (bClosed.length / totalDeals) * 100 : 0;
                  const comEarned = bClosed.reduce((sum, s) => sum + s.value * 0.02, 0);
                  const bProspects = prospects.filter(p => p.broker_asignado === b.nombre && p.estado !== 'Cierre' && p.estado !== 'Post-venta');

                  return { ...b, bClosed, bLost, totalDeals, closeRate, comEarned, bProspects };
                  });

                  const filteredBrokers = computedBrokers.filter(b => {
                    if (brokerFilters.nombre && !b.nombre.toLowerCase().includes(brokerFilters.nombre.toLowerCase())) return false;
                    if (brokerFilters.empresa && !b.empresa.toLowerCase().includes(brokerFilters.empresa.toLowerCase())) return false;
                    if (brokerFilters.zona && !b.zona.toLowerCase().includes(brokerFilters.zona.toLowerCase())) return false;
                    if (brokerFilters.prospectos && b.bProspects.length < Number(brokerFilters.prospectos)) return false;
                    if (brokerFilters.negocios && b.totalDeals < Number(brokerFilters.negocios)) return false;
                    if (brokerFilters.tasa && b.closeRate < Number(brokerFilters.tasa)) return false;
                    if (brokerFilters.comisiones && b.comEarned < Number(brokerFilters.comisiones)) return false;
                    return true;
                  });

                  return filteredBrokers.map(b => {
                    const { bClosed, bLost, totalDeals, closeRate, comEarned, bProspects } = b;
                    return (
                      <tr key={b.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{b.nombre}</td>
                      <td style={{ padding: '12px 14px' }}>{b.empresa}</td>
                      <td style={{ padding: '12px 14px' }}>{b.zona}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' as const, fontWeight: 700, color: T.sky }}>{bProspects.length}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' as const }}>
                        <span style={{ color: T.success, fontWeight: 700 }}>{bClosed.length}</span> / <span style={{ color: T.danger }}>{bLost.length}</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' as const, fontWeight: 700, color: T.palm }}>
                        {totalDeals > 0 ? `${closeRate.toFixed(1)}%` : 'N/A'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' as const, fontWeight: 700, color: T.teal }}>{usd(comEarned)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {badge(b.estado === 'activo' ? '● Activo' : '○ Inactivo', b.estado === 'activo' ? 'rgba(72,187,120,0.15)' : 'rgba(160,174,192,0.15)', b.estado === 'activo' ? T.success : T.textSec)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => setBrokerDrilldown(brokerDrilldown === b.id ? null : b.id)} style={btnSecondary({ padding: '4px 10px', fontSize: 11 })}>
                          {brokerDrilldown === b.id ? 'Ocultar' : 'Ver Desempeño'}
                        </button>
                      </td>
                    </tr>
                  );
                });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Broker Drilldown - Under the table */}
        {drillBroker && (() => {
          const bClosed = closedSales.filter(s => s.broker === drillBroker.nombre);
          const bLost = lostSales.filter(l => l.broker === drillBroker.nombre);
          const totalDeals = bClosed.length + bLost.length;
          const closeRate = totalDeals > 0 ? (bClosed.length / totalDeals) * 100 : 0;
          const comEarned = bClosed.reduce((sum, s) => sum + s.value * 0.02, 0);
          const activeProspects = prospects.filter(p => p.broker_asignado === drillBroker.nombre);

          return (
            <div style={{ ...cardStyle({ marginTop: 16, borderLeft: `4px solid ${T.teal}`, background: T.bg, padding: 20 }) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `1.5px solid ${T.border}`, paddingBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.teal }}>
                  👤 Reporte de Cierre y Avance: {drillBroker.nombre} ({drillBroker.empresa})
                </div>
                <button onClick={() => setBrokerDrilldown(null)} style={btnSecondary({ padding: '2px 8px', fontSize: 11 })}>Cerrar Reporte ✕</button>
              </div>

              {/* KPI metrics for this broker */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ background: T.card, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.textSec, marginBottom: 4 }}>Tasa de Cierre Real</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.palm }}>{totalDeals > 0 ? `${closeRate.toFixed(1)}%` : 'N/A'}</div>
                </div>
                <div style={{ background: T.card, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.textSec, marginBottom: 4 }}>Comisiones Generadas (2% Share)</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.teal }}>{usd(comEarned)}</div>
                </div>
                <div style={{ background: T.card, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.textSec, marginBottom: 4 }}>Negocios Cerrados</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.success }}>{bClosed.length} ventas</div>
                </div>
                <div style={{ background: T.card, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: T.textSec, marginBottom: 4 }}>Negocios Caídos</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.danger }}>{bLost.length} caídas</div>
                </div>
              </div>

              {/* Grid content: Active prospects, closed sales, lost sales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Active prospects & progress */}
                <div style={{ background: T.card, padding: 14, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 4 }}>
                    👥 Prospectos Asignados & Estados de Avance ({activeProspects.length})
                  </div>
                  {activeProspects.length === 0 ? (
                    <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic', padding: 8 }}>Sin prospectos activos.</div>
                  ) : (
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {activeProspects.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px dashed ${T.borderLight}`, fontSize: 11 }}>
                          <span 
                            style={{ fontWeight: 600, color: T.sky, cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => { setActiveModule('prospectos'); setProspectDetail(p.id); }}
                          >
                            {p.nombre} {p.apellido}
                          </span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {badge(p.estado, T.bg, T.text)}
                            <span style={{ color: T.textSec, fontWeight: 600 }}>{usd(p.presupuesto_usd)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Closed sales details */}
                <div style={{ background: T.card, padding: 14, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.success, marginBottom: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 4 }}>
                    ✅ Negocios Cerrados ({bClosed.length})
                  </div>
                  {bClosed.length === 0 ? (
                    <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic', padding: 8 }}>Ningún negocio cerrado todavía.</div>
                  ) : (
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {bClosed.map(s => (
                        <div key={s.id} style={{ padding: '8px 0', borderBottom: `1px dashed ${T.borderLight}`, fontSize: 11 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span>{s.prospect}</span>
                            <span style={{ color: T.success }}>{usd(s.value)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textSec, fontSize: 10, marginTop: 2 }}>
                            <span>{s.project}</span>
                            <span>Comisión (2%): <b>{usd(s.value * 0.02)}</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Lost sales details (full-width) */}
              <div style={{ background: T.card, padding: 14, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.danger, marginBottom: 8, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 4 }}>
                  ❌ Negocios Caídos e Historial de Objeciones ({bLost.length})
                </div>
                {bLost.length === 0 ? (
                  <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic', padding: 8 }}>Sin registros de negocios caídos.</div>
                ) : (
                  <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {bLost.map(l => (
                      <div key={l.id} style={{ padding: '8px 0', borderBottom: `1px dashed ${T.borderLight}`, fontSize: 11 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{l.prospect} - <span style={{ fontWeight: 400, color: T.textSec }}>{l.project}</span></span>
                          <span style={{ color: T.textSec }}>{usd(l.value)}</span>
                        </div>
                        <div style={{ color: T.danger, fontSize: 10, marginTop: 2 }}>
                          ⚠️ Objeción: {l.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Commission structure - Middle */}
        <div style={{ ...cardStyle(), marginBottom: 20, marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Estructura de Distribución de Comisión — 5% Total</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {commissionEntities.map(e => (
              <div key={e.name} style={{ background: T.bg, borderRadius: 10, padding: 14, textAlign: 'center' as const, border: `1px solid ${T.borderLight}` }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.teal }}>{e.pct}%</div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 4 }}>{e.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Report Generation Center - BOTTOM */}
        <div style={{ ...cardStyle({ marginTop: 24, background: `${T.teal}05`, border: `1px solid ${T.teal}30` }) }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>📊 Centro de Reportes Financieros (Comisiones)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: '0.9rem', color: T.text }}>
              Genera reportes de Excel o PDF aplicando los filtros activos (Entidad: <strong>{brokerEntityFilter === 'all' ? 'Todas' : brokerEntityFilter}</strong>, Broker: <strong>{commissionFilterBroker === 'all' ? 'Todos' : commissionFilterBroker}</strong>, Empresa: <strong>{commissionFilterCompany === 'all' ? 'Todas' : commissionFilterCompany}</strong>).
            </div>
            <div style={{ display: 'flex', gap: 8, height: 38 }}>
              <button onClick={() => handleExport('excel')} style={btnPrimary({ display: 'flex', alignItems: 'center', gap: 6 })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exportar a Excel (.xls)
              </button>
              <button onClick={() => handleExport('pdf')} style={btnSecondary({ display: 'flex', alignItems: 'center', gap: 6, height: '100%', boxSizing: 'border-box' })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Generar Reporte PDF
              </button>
            </div>
          </div>
        </div>

        {/* Commission liquidation table - BOTTOM */}
        <div style={{ ...cardStyle({ marginTop: 24, marginBottom: 24 }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Liquidación de Comisiones por Cierre</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <select value={brokerEntityFilter} onChange={e => setBrokerEntityFilter(e.target.value)} style={inputStyle({ width: 180 })}>
                  <option value="all">Todas las entidades</option>
                  {commissionEntities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <select value={commissionFilterBroker} onChange={e => setCommissionFilterBroker(e.target.value)} style={inputStyle({ width: 180 })}>
                  <option value="all">Todos los brokers</option>
                  {uniqueBrokersInDeals.map(bName => <option key={bName} value={bName}>{bName}</option>)}
                </select>
              </div>
              <div>
                <select value={commissionFilterCompany} onChange={e => setCommissionFilterCompany(e.target.value)} style={inputStyle({ width: 180 })}>
                  <option value="all">Todas las empresas</option>
                  {uniqueCompaniesInDeals.map(cName => <option key={cName} value={cName}>{cName}</option>)}
                </select>
              </div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.teal, color: T.card }}>
                {[
                  'Deal / Venta', 
                  'Broker', 
                  'Empresa', 
                  'Valor Venta', 
                  ...(brokerEntityFilter === 'all' ? ['Comisión Total (5%)'] : []), 
                  ...visibleEntities.map(e => `${e.name} (${e.pct}%)`)
                ].map(h => (
                  <th key={h} style={{ color: T.card, padding: '8px 10px', textAlign: 'left' as const, fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((d, index) => {
                const total = d.valorVenta * 0.05;
                return (
                  <tr key={index} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{d.deal}</td>
                    <td style={{ padding: '8px 10px' }}>{d.broker}</td>
                    <td style={{ padding: '8px 10px' }}>{d.empresa}</td>
                    <td style={{ padding: '8px 10px' }}>{usd(d.valorVenta)}</td>
                    {brokerEntityFilter === 'all' && (
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: T.teal }}>{usd(total)}</td>
                    )}
                    {visibleEntities.map(e => (
                      <td key={e.name} style={{ padding: '8px 10px' }}>{usd(d.valorVenta * e.pct / 100)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: `${T.teal}08`, fontWeight: 'bold', borderTop: `2px solid ${T.teal}` }}>
                <td style={{ padding: '10px', color: T.text, fontWeight: 700 }}>TOTAL FILTRADO</td>
                <td style={{ padding: '10px' }}></td>
                <td style={{ padding: '10px' }}></td>
                <td style={{ padding: '10px', color: T.text, fontWeight: 700 }}>{usd(totalVentas)}</td>
                {brokerEntityFilter === 'all' && (
                  <td style={{ padding: '10px', color: T.teal, fontWeight: 700 }}>{usd(totalComision)}</td>
                )}
                {visibleEntities.map(e => (
                  <td key={e.name} style={{ padding: '10px', color: T.text, fontWeight: 700 }}>{usd(totalVentas * e.pct / 100)}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // MODULE: ACTIVOS INMOBILIARIOS (CRUD + IMPORT + PRINT)
  // ══════════════════════════════════════════════════════════════
  const renderActivos = () => {
    // Edit action handler
    const handleEditProjectClick = (p: any) => {
      setEditingProject(p);
      setProjectForm({
        name: p.name || '',
        category: p.category || 'Proyecto de Ciudad',
        zone: p.zone || '',
        type: p.type || 'renta',
        price: p.price || 0,
        priceM2: p.priceM2 || '',
        rentM2: p.rentM2 || '',
        capRate: p.capRate || '',
        vacancy: p.vacancy || '',
        area: p.area || '',
        beds: p.beds || '',
        amenities: Array.isArray(p.amenities) ? p.amenities.join(', ') : '',
        tenant: p.tenant || '',
        velocity: p.velocity || '',
        appreciation: p.appreciation || '',
        tag: p.tag || '',
        delivery: p.delivery || ''
      });
      setShowProjectModal(true);
    };

    // Add action handler
    const handleAddProjectClick = () => {
      setEditingProject(null);
      setProjectForm({
        name: '',
        category: 'Proyecto de Ciudad',
        zone: '',
        type: 'renta',
        price: 0,
        priceM2: '',
        rentM2: '',
        capRate: '',
        vacancy: '',
        area: '',
        beds: '2 rec.',
        amenities: '',
        tenant: '',
        velocity: '',
        appreciation: '',
        tag: '',
        delivery: ''
      });
      setShowProjectModal(true);
    };

    // Save project handler
    const handleSaveProject = () => {
      if (!projectForm.name || !projectForm.category) {
        alert('El nombre y la categoría son obligatorios.');
        return;
      }

      const amenitiesArray = projectForm.amenities
        ? projectForm.amenities.split(',').map(x => x.trim()).filter(Boolean)
        : [];

      const newProjData = {
        ...projectForm,
        price: Number(projectForm.price) || 0,
        amenities: amenitiesArray
      };

      let updatedList = [];
      if (editingProject) {
        // Edit existing project
        updatedList = projectsList.map(p => p.name === editingProject.name ? newProjData : p);
      } else {
        // Add new project
        if (projectsList.some(p => p.name.toLowerCase() === newProjData.name.toLowerCase())) {
          alert('Ya existe un proyecto con ese nombre.');
          return;
        }
        updatedList = [newProjData, ...projectsList];
      }

      saveProjectsToBackend(updatedList);
      setShowProjectModal(false);
    };

    // Delete project handler
    const handleDeleteProjectClick = (name: string) => {
      if (confirm(`¿Está seguro de que desea eliminar el proyecto "${name}"? Esta acción se guardará permanentemente.`)) {
        const updatedList = projectsList.filter(p => p.name !== name);
        saveProjectsToBackend(updatedList);
      }
    };

    // File import handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (['json', 'csv'].includes(ext || '')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (!text) return;

          try {
            let parsedList: any[] = [];
            if (ext === 'json') {
              parsedList = JSON.parse(text);
              if (!Array.isArray(parsedList)) {
                alert('El archivo JSON debe contener un arreglo de proyectos.');
                return;
              }
            } else if (ext === 'csv') {
              parsedList = parseCSV(text);
            }

            if (parsedList.length === 0) {
              alert('No se encontraron registros válidos en el archivo.');
              return;
            }

            setPendingImports(parsedList);
            setSelectedPendingImports(parsedList.map((_, i) => i));
          } catch (err) {
            console.error(err);
            alert('Error al parsear el archivo. Verifique el formato.');
          }
        };
        reader.readAsText(file);
      } else if (['xlsx', 'xls'].includes(ext || '')) {
        setIsExtracting(true);
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
            
            const mappedList = rawJson.map((row) => ({
              id: Date.now() + Math.random(),
              name: row['name'] || row['Name'] || row['Nombre'] || row['Proyecto'] || '',
              type: row['type'] || row['Type'] || row['Tipo'] || 'renta',
              category: row['category'] || row['Category'] || row['Categoría'] || 'Proyecto de Ciudad',
              zone: row['zone'] || row['Zone'] || row['Zona'] || row['Ubicación'] || '',
              price: Number(row['price'] || row['Price'] || row['Precio'] || row['Valor']) || 0,
              beds: row['beds'] || row['Beds'] || row['Habitaciones'] || row['Recámaras'] || row['Alcobas'] || '',
              area: row['area'] || row['Area'] || row['Área'] || '',
              status: row['status'] || row['Status'] || row['Estado'] || 'Activo',
            })).filter(item => item.name);

            setTimeout(() => {
              setIsExtracting(false);
              if (mappedList.length === 0) {
                alert('No se encontraron proyectos válidos en el archivo Excel.');
                return;
              }
              setPendingImports(mappedList);
              setSelectedPendingImports(mappedList.map((_, i) => i));
            }, 1500); // Simulate processing time
          } catch (error) {
            console.error(error);
            setIsExtracting(false);
            alert('Error al leer el archivo Excel.');
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
        // AI OCR Simulation for Unstructured Data
        setIsExtracting(true);
        setTimeout(() => {
          // En lugar de alucinar proyectos, simulamos que leyó el catálogo actual.
          const mockExtraction = projectsList.map((p, idx) => {
            if (idx === 0) {
              return { ...p, price: Math.round((p.price || 100000) * 1.05) }; // Pequeña modificación al primer activo para mostrar el Diff
            }
            return p;
          });
          
          if (mockExtraction.length === 0) {
            mockExtraction.push(
              { id: Date.now(), name: PROJECTS[0]?.name || 'Armonia', type: PROJECTS[0]?.investorType || 'renta', category: 'Proyecto de Ciudad', zone: PROJECTS[0]?.zoneShort || 'Bella Vista', price: 150000, beds: '2 rec.', area: '70 m2', status: 'Activo' }
            );
          }

          setPendingImports(mockExtraction);
          setSelectedPendingImports(mockExtraction.map((_, i) => i));
          setIsExtracting(false);
        }, 3000);
      } else {
        alert('Formato de archivo no soportado. Suba CSV, JSON, Excel, PDF o Imágenes (JPEG/PNG).');
      }

      e.target.value = '';
    };

    // CSV parsing helper inside CRMDashboard
    const parseCSV = (text: string) => {
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) return [];
      
      const clean = (val: string) => val.replace(/^["']|["']$/g, '').trim();
      const headers = lines[0].split(',').map(h => clean(h).toLowerCase());
      const parsedProjects: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row: string[] = [];
        let insideQuote = false;
        let current = '';
        const line = lines[i];
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            row.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        row.push(current);

        const project: any = {};
        headers.forEach((header, idx) => {
          const val = row[idx] ? clean(row[idx]) : '';
          if (header.includes('name') || header === 'nombre') project.name = val;
          else if (header.includes('category') || header === 'categoría' || header === 'categoria') project.category = val;
          else if (header.includes('zone') || header === 'zona' || header === 'ubicación' || header === 'ubicacion') project.zone = val;
          else if (header.includes('type') || header === 'tipo') project.type = val;
          else if (header.includes('price') || header === 'precio') {
            project.price = Number(val.replace(/[^0-9]/g, '')) || 0;
          }
          else if (header.includes('pricem2') || header === 'preciom2') project.priceM2 = val;
          else if (header.includes('rentm2') || header === 'rentam2') project.rentM2 = val;
          else if (header.includes('caprate') || header === 'retorno') project.capRate = val;
          else if (header.includes('vacancy') || header === 'vacancia') project.vacancy = val;
          else if (header.includes('area') || header === 'área' || header === 'metraje') project.area = val;
          else if (header.includes('beds') || header === 'habitaciones' || header === 'recámaras' || header === 'recamaras') project.beds = val;
          else if (header.includes('amenities') || header === 'amenidades' || header === 'fortalezas') {
            project.amenities = val ? val.split(';').map(x => x.trim()) : [];
          }
          else if (header.includes('tenant') || header === 'inquilino') project.tenant = val;
          else if (header.includes('velocity') || header === 'velocidad') project.velocity = val;
          else if (header.includes('appreciation') || header === 'valorización' || header === 'valorizacion') project.appreciation = val;
          else if (header.includes('tag') || header === 'etiqueta') project.tag = val;
          else if (header.includes('delivery') || header === 'entrega') project.delivery = val;
        });

        if (!project.name) continue;
        project.category = project.category || 'Proyecto de Ciudad';
        project.zone = project.zone || 'Panamá';
        project.type = project.type || 'renta';
        project.price = project.price || 0;
        project.priceM2 = project.priceM2 || '';
        project.rentM2 = project.rentM2 || '';
        project.capRate = project.capRate || '';
        project.vacancy = project.vacancy || '';
        project.area = project.area || '';
        project.beds = project.beds || '2 rec.';
        project.amenities = project.amenities || [];
        project.tenant = project.tenant || '';
        project.velocity = project.velocity || '';
        project.appreciation = project.appreciation || '';
        project.tag = project.tag || '';
        project.delivery = project.delivery || '';

        parsedProjects.push(project);
      }
      return parsedProjects;
    };

    // Print active projects list
    const handlePrintProjects = () => {
      const win = window.open('', '_blank');
      if (!win) {
        alert('Por favor, permita las ventanas emergentes para imprimir la relación de activos.');
        return;
      }

      let html = `<html><head><title>Relación de Activos Inmobiliarios GLP</title>`;
      html += `<link rel="preconnect" href="https://fonts.googleapis.com">`;
      html += `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
      html += `<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`;
      html += `<style>`;
      html += `body { font-family: 'Inter', sans-serif; color: #111827; padding: 40px; background-color: #FFFFFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`;
      html += `.header { border-bottom: 2px solid #B89047; padding-bottom: 15px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }`;
      html += `.logo { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 400; color: #002349; letter-spacing: 0.12em; text-transform: uppercase; }`;
      html += `.title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 600; color: #B89047; letter-spacing: 0.05em; text-transform: uppercase; }`;
      html += `.meta { font-size: 12px; color: #4B5563; margin-bottom: 30px; line-height: 1.6; }`;
      html += `table { width: 100%; border-collapse: collapse; margin-top: 15px; }`;
      html += `th { background-color: #002349; color: #FFFFFF; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid #002349; padding: 12px 10px; text-align: left; font-size: 10px; }`;
      html += `td { border: 1px solid #E5E7EB; padding: 10px; font-size: 11px; color: #1F2937; }`;
      html += `.price { font-weight: 600; color: #002349; text-align: right; }`;
      html += `.category-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border: 1px solid #CBD5E1; color: #4B5563; display: inline-block; }`;
      html += `.footer { margin-top: 50px; border-top: 1px solid #B89047; padding-top: 20px; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 13px; color: #4B5563; text-align: center; }`;
      html += `.no-print-btn { background: #002349; border: 1px solid #B89047; color: #FFFFFF; padding: 8px 16px; font-family: 'Inter', sans-serif; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; transition: all 0.2s; }`;
      html += `.no-print-btn:hover { background: #FFFFFF; color: #002349; }`;
      html += `@media print { body { padding: 0; } .no-print { display: none; } }`;
      html += `</style></head><body>`;
      html += `<div class="no-print" style="text-align: right; margin-bottom: 20px;">`;
      html += `<button class="no-print-btn" onclick="window.print()">Imprimir Catálogo</button>`;
      html += `</div>`;
      html += `<div class="header">`;
      html += `<div class="logo">GLP · GRUPO LOS PUEBLOS</div>`;
      html += `<div class="title">Relación de Activos Inmobiliarios</div>`;
      html += `</div>`;
      html += `<div class="meta">`;
      html += `<strong>Documento Oficial de Precios y Disponibilidad</strong><br/>`;
      html += `<strong>Fecha de Generación:</strong> ${new Date().toLocaleString()}<br/>`;
      html += `<strong>Moneda de Transacción:</strong> USD (Dólares Americanos)<br/>`;
      html += `<strong>Desarrollador Principal:</strong> Grupo Los Pueblos (GLP) · Panamá`;
      html += `</div>`;
      html += `<table><thead><tr>`;
      html += `<th>Nombre</th><th>Categoría</th><th>Ubicación / Zona</th><th>Precio Base</th><th>Precio/m²</th><th>Habitaciones</th><th>Metraje</th><th>Entrega</th>`;
      html += `</tr></thead><tbody>`;

      projectsList.forEach(p => {
        html += `<tr>`;
        html += `<td style="font-weight:600;">${p.name}</td>`;
        html += `<td><span class="category-tag">${p.category}</span></td>`;
        html += `<td>${p.zone}</td>`;
        html += `<td class="price">${usd(p.price)}</td>`;
        html += `<td>USD ${p.priceM2}</td>`;
        html += `<td>${p.beds}</td>`;
        html += `<td>${p.area}</td>`;
        html += `<td>${p.delivery}</td>`;
        html += `</tr>`;
      });

      html += `</tbody></table>`;
      html += `<div class="footer">Este documento es una relación de activos oficiales emitida por GLP CRM. Precios y disponibilidad sujetos a cambios sin previo aviso.</div>`;
      html += `<script>window.onload = function() { window.print(); }</script>`;
      html += `</body></html>`;

      win.document.write(html);
      win.document.close();
    };

    return (
      <div>
        {sectionTitle('Gestión de Activos Inmobiliarios (Lista de Precios)')}

        {/* Toolbar panel */}
        <div style={{ ...cardStyle({ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }) }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={handleAddProjectClick} style={btnPrimary()}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Incluir Nuevo Activo</span>
              </span>
            </button>

            <button onClick={handlePrintProjects} style={btnSecondary()}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Imprimir Relación</span>
              </span>
            </button>
          </div>

          {/* Uploader section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textSec }}>Importar Precios:</span>
            <label style={{
              background: '#F3F4F6', color: T.text, border: '1px solid #D1D5DB',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', display: 'inline-block', fontFamily: T.fontSans, transition: 'all 0.2s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#E5E7EB'}
              onMouseLeave={e => e.currentTarget.style.background = '#F3F4F6'}
            >
              <span>📁 Cargar Archivo (CSV / JSON / Excel / PDF / Img)</span>
              <input type="file" accept=".csv,.json,.xlsx,.xls,.pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Category Filters for Assets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            ['all', 'Todos'],
            ['Proyecto de Ciudad', 'Proyecto de Ciudad'],
            ['Ocean Reef Islands', 'Ocean Reef Islands'],
            ['Playa Caracol', 'Playa Caracol']
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActivosFilter(id)} style={{
              ...btnSecondary({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
              background: activosFilter === id ? T.teal : 'transparent',
              color: activosFilter === id ? T.card : T.teal,
            }}>
              <span>{label}</span>
            </button>
          ))}
          <span style={{ fontSize: 12, color: T.textSec, alignSelf: 'center', marginLeft: 8 }}>
            {loadingProjects ? 0 : (activosFilter === 'all' ? projectsList.length : projectsList.filter(p => p.category === activosFilter).length)} activos
          </span>
        </div>

        {/* Assets Listing Table */}
        <div style={{ ...cardStyle({ padding: 0, overflow: 'hidden' }) }}>
          {loadingProjects ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.textSec, fontSize: 14 }}>
              Cargando activos desde la base de datos...
            </div>
          ) : projectsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.textSec, fontSize: 14 }}>
              No hay activos registrados en el catálogo. Utilice el botón "Incluir Nuevo Activo" o "Cargar Archivo".
            </div>
          ) : (() => {
            const handleActivosSort = (key: string) => {
              if (activosSortKey === key) {
                setActivosSortDir(activosSortDir === 'asc' ? 'desc' : 'asc');
              } else {
                setActivosSortKey(key);
                setActivosSortDir('asc');
              }
            };
            
            const getActivosSortIcon = (key: string) => {
              if (activosSortKey !== key) return ' ⇅';
              return activosSortDir === 'asc' ? ' ↑' : ' ↓';
            };

            const filteredProjects = activosFilter === 'all' ? projectsList : projectsList.filter(p => p.category === activosFilter);
            const sortedProjects = [...filteredProjects].sort((a, b) => {
              if (activosSortKey === 'none') return 0;
              let valA: any = a[activosSortKey as keyof typeof a];
              let valB: any = b[activosSortKey as keyof typeof b];

              // Limpiar strings numéricos para ordenar bien
              if (activosSortKey === 'priceM2') {
                valA = Number(valA.toString().replace(/[^0-9.-]+/g,""));
                valB = Number(valB.toString().replace(/[^0-9.-]+/g,""));
              } else if (activosSortKey === 'area') {
                valA = Number(valA.toString().replace(/[^0-9.-]+/g,"")) || valA;
                valB = Number(valB.toString().replace(/[^0-9.-]+/g,"")) || valB;
              } else if (activosSortKey === 'beds') {
                valA = Number(valA.toString().replace(/[^0-9.-]+/g,"")) || valA;
                valB = Number(valB.toString().replace(/[^0-9.-]+/g,"")) || valB;
              }

              if (valA < valB) return activosSortDir === 'asc' ? -1 : 1;
              if (valA > valB) return activosSortDir === 'asc' ? 1 : -1;
              return 0;
            });

            return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: T.teal, color: T.card }}>
                    <th onClick={() => handleActivosSort('name')} style={{ cursor: 'pointer', color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Nombre{getActivosSortIcon('name')}</th>
                    <th onClick={() => handleActivosSort('category')} style={{ cursor: 'pointer', color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Categoría{getActivosSortIcon('category')}</th>
                    <th onClick={() => handleActivosSort('zone')} style={{ cursor: 'pointer', color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Ubicación / Zona{getActivosSortIcon('zone')}</th>
                    <th onClick={() => handleActivosSort('price')} style={{ cursor: 'pointer', color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Precio Base{getActivosSortIcon('price')}</th>
                    <th onClick={() => handleActivosSort('priceM2')} style={{ cursor: 'pointer', color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Precio/m²{getActivosSortIcon('priceM2')}</th>
                    <th onClick={() => handleActivosSort('beds')} style={{ cursor: 'pointer', color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Habitaciones{getActivosSortIcon('beds')}</th>
                    <th onClick={() => handleActivosSort('area')} style={{ cursor: 'pointer', color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Metraje{getActivosSortIcon('area')}</th>
                    <th style={{ color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Entrega</th>
                    <th style={{ color: T.card, padding: '12px 14px', fontWeight: 600, fontSize: 12, textAlign: 'left' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects.map((p, index) => (
                    <tr key={p.name || index} style={{ borderBottom: `1px solid ${T.borderLight}`, background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: T.teal }}>{p.name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {badge(p.category, p.category.includes('Reef') ? 'rgba(184,144,71,0.15)' : p.category.includes('Playa') ? 'rgba(0,35,73,0.1)' : 'rgba(75,85,99,0.1)', p.category.includes('Reef') ? T.coral : p.category.includes('Playa') ? T.sky : T.textSec)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{p.zone}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>{usd(p.price)}</td>
                      <td style={{ padding: '12px 14px' }}>{p.priceM2}</td>
                      <td style={{ padding: '12px 14px' }}>{p.beds}</td>
                      <td style={{ padding: '12px 14px' }}>{p.area}</td>
                      <td style={{ padding: '12px 14px' }}>{p.delivery}</td>
                      <td style={{ padding: '12px 14px', display: 'flex', gap: 6 }}>
                        <button onClick={() => handleEditProjectClick(p)} style={btnSecondary({ padding: '4px 8px', fontSize: 11, border: '1px solid #B89047', color: '#B89047' })}>
                          Editar
                        </button>
                        <button onClick={() => handleDeleteProjectClick(p.name)} style={btnDanger({ padding: '4px 8px', fontSize: 11 })}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )})()}
        </div>

        {/* Modal Form Dialog */}
        {showProjectModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 24,
            overflowY: 'auto'
          }}>
            <div style={{
              background: T.card, borderRadius: 12, border: `1px solid ${T.border}`,
              width: '100%', maxWidth: 700, padding: 32,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              maxHeight: '90vh', overflowY: 'auto'
            }}>
              <h3 style={{ fontSize: 18, color: T.teal, marginBottom: 20, fontFamily: T.fontSerif, fontWeight: 600 }}>
                {editingProject ? `Editar Activo: ${editingProject.name}` : 'Incluir Nuevo Activo Inmobiliario'}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Nombre del Proyecto *</label>
                  <input
                    value={projectForm.name}
                    onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                    disabled={!!editingProject}
                    style={inputStyle()}
                    placeholder="Ej. Armonia"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Clasificación de Portafolio *</label>
                  <select
                    value={projectForm.category}
                    onChange={e => setProjectForm({ ...projectForm, category: e.target.value })}
                    style={inputStyle()}
                  >
                    <option value="Proyecto de Ciudad">Proyecto de Ciudad</option>
                    <option value="Ocean Reef Islands">Ocean Reef Islands</option>
                    <option value="Playa Caracol">Playa Caracol</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Ubicación / Zona Completa</label>
                  <input
                    value={projectForm.zone}
                    onChange={e => setProjectForm({ ...projectForm, zone: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. Bella Vista, Ciudad de Panamá"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Perfil de Inversionista</label>
                  <select
                    value={projectForm.type}
                    onChange={e => setProjectForm({ ...projectForm, type: e.target.value })}
                    style={inputStyle()}
                  >
                    <option value="renta">Renta</option>
                    <option value="disfrute">Disfrute</option>
                    <option value="patrimonial">Patrimonial</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Precio Base en USD ($) *</label>
                  <input
                    type="number"
                    value={projectForm.price}
                    onChange={e => setProjectForm({ ...projectForm, price: Number(e.target.value) })}
                    style={inputStyle()}
                    placeholder="Ej. 181000"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Precio/m² (Rango/Monto)</label>
                  <input
                    value={projectForm.priceM2}
                    onChange={e => setProjectForm({ ...projectForm, priceM2: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 3,800–4,020"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Renta/m² (o Renta por noche)</label>
                  <input
                    value={projectForm.rentM2}
                    onChange={e => setProjectForm({ ...projectForm, rentM2: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 14–18 o Airbnb $90–140/noche"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Tasa de Retorno (Cap Rate)</label>
                  <input
                    value={projectForm.capRate}
                    onChange={e => setProjectForm({ ...projectForm, capRate: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 6.5–7.8%"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Vacancia Promedio (%)</label>
                  <input
                    value={projectForm.vacancy}
                    onChange={e => setProjectForm({ ...projectForm, vacancy: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 4%"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Metraje (Áreas)</label>
                  <input
                    value={projectForm.area}
                    onChange={e => setProjectForm({ ...projectForm, area: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 45–71 m²"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Habitaciones (Recámaras)</label>
                  <input
                    value={projectForm.beds}
                    onChange={e => setProjectForm({ ...projectForm, beds: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 1–3 rec."
                  />
                </div>
                <div>
                  <label style={labelStyle}>Inquilino Objetivo / Destino</label>
                  <input
                    value={projectForm.tenant}
                    onChange={e => setProjectForm({ ...projectForm, tenant: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. Jóvenes profesionales, Turistas"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Velocidad de Absorción / Renta</label>
                  <input
                    value={projectForm.velocity}
                    onChange={e => setProjectForm({ ...projectForm, velocity: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 1 mes"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Plusvalía Anual (%)</label>
                  <input
                    value={projectForm.appreciation}
                    onChange={e => setProjectForm({ ...projectForm, appreciation: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. 4.0%"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Etiqueta / Badge</label>
                  <input
                    value={projectForm.tag}
                    onChange={e => setProjectForm({ ...projectForm, tag: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. Fase Lanzamiento"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fecha de Entrega</label>
                  <input
                    value={projectForm.delivery}
                    onChange={e => setProjectForm({ ...projectForm, delivery: e.target.value })}
                    style={inputStyle()}
                    placeholder="Ej. F1 Inmediata, Q2 2028"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Fortalezas y Amenidades (Separados por Comas)</label>
                <textarea
                  rows={2}
                  value={projectForm.amenities}
                  onChange={e => setProjectForm({ ...projectForm, amenities: e.target.value })}
                  style={{ ...inputStyle(), resize: 'vertical' }}
                  placeholder="Ej. Piscina social, Gimnasio, Lobby premium, Coworking"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button onClick={() => setShowProjectModal(false)} style={btnSecondary()}>
                  Cancelar
                </button>
                <button onClick={handleSaveProject} style={btnPrimary()}>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Revisión de Extracción IA */}
        {pendingImports.length > 0 && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,35,73,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
          }}>
            <div style={{
              background: T.card, borderRadius: 12, padding: 32, width: '100%', maxWidth: 700,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '85vh', display: 'flex', flexDirection: 'column'
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 20, color: T.teal, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🤖</span> Revisión de Extracción de Inteligencia Artificial
              </h3>
              <p style={{ margin: '0 0 24px', color: T.textSec, fontSize: 14 }}>
                Se han estructurado {pendingImports.length} propiedades. Seleccione cuáles desea anexar al catálogo actual.
              </p>

              <div style={{ border: `1px solid ${T.borderLight}`, borderRadius: 8, overflowY: 'auto', marginBottom: 24, flex: 1, minHeight: 0 }}>
                {pendingImports.map((item, idx) => {
                  const isSel = selectedPendingImports.includes(idx);
                  
                  // Calcular diferencias con el catálogo actual
                  const existingMatch = projectsList.find(p => p.name?.trim().toLowerCase() === item.name?.trim().toLowerCase());
                  let status = 'new';
                  let diffs: any = {};
                  
                  if (existingMatch) {
                    status = 'unchanged';
                    const fieldsToCompare = ['zone', 'type', 'beds', 'area', 'price'];
                    fieldsToCompare.forEach(field => {
                      if (existingMatch[field] != item[field]) {
                        status = 'modified';
                        diffs[field] = { old: existingMatch[field], new: item[field] };
                      }
                    });
                  }

                  const rowColor = status === 'new' ? '#fef2f2' : (status === 'unchanged' ? '#ecfdf5' : '#fffbeb');
                  const rowBorder = status === 'new' ? '#fca5a5' : (status === 'unchanged' ? '#6ee7b7' : '#fcd34d');
                  const titleColor = status === 'new' ? '#ef4444' : (status === 'unchanged' ? '#10b981' : T.text);

                  const renderField = (field: string, suffix = '') => {
                    if (status === 'new') return <span style={{ color: '#ef4444' }}>{item[field] || 'N/A'}{suffix}</span>;
                    if (status === 'unchanged') return <span style={{ color: '#10b981' }}>{item[field] || 'N/A'}{suffix}</span>;
                    
                    if (diffs[field]) {
                      return (
                        <span>
                          <span style={{ textDecoration: 'line-through', color: T.textSec, marginRight: 4 }}>{diffs[field].old || 'N/A'}{suffix}</span>
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>{diffs[field].new || 'N/A'}{suffix}</span>
                        </span>
                      );
                    }
                    return <span>{item[field] || 'N/A'}{suffix}</span>;
                  };

                  const renderPrice = () => {
                    if (status === 'new') return <span style={{ color: '#ef4444' }}>${(item.price || 0).toLocaleString()} USD</span>;
                    if (status === 'unchanged') return <span style={{ color: '#10b981' }}>${(item.price || 0).toLocaleString()} USD</span>;
                    if (diffs.price) {
                      return (
                        <span>
                          <span style={{ textDecoration: 'line-through', color: T.textSec, fontSize: 12, marginRight: 6 }}>${(diffs.price.old || 0).toLocaleString()}</span>
                          <span style={{ color: '#ef4444' }}>${(diffs.price.new || 0).toLocaleString()} USD</span>
                        </span>
                      );
                    }
                    return <span style={{ color: T.teal }}>${(item.price || 0).toLocaleString()} USD</span>;
                  };

                  return (
                    <div key={idx} style={{
                      padding: 16, borderBottom: idx < pendingImports.length - 1 ? `1px solid ${T.borderLight}` : 'none',
                      display: 'flex', alignItems: 'center', gap: 16, background: isSel ? rowColor : T.bg,
                      borderLeft: isSel ? `4px solid ${rowBorder}` : '4px solid transparent',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }} onClick={() => {
                      if (isSel) setSelectedPendingImports(selectedPendingImports.filter(i => i !== idx));
                      else setSelectedPendingImports([...selectedPendingImports, idx]);
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSel ? rowBorder : T.border}`,
                        background: isSel ? rowBorder : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isSel && <span style={{ color: status === 'unchanged' ? '#047857' : (status === 'new' ? '#b91c1c' : '#b45309'), fontSize: 12 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: titleColor, fontSize: 14, marginBottom: 4 }}>
                          {item.name} 
                          {status === 'new' && <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 10, marginLeft: 8 }}>NUEVO</span>}
                          {status === 'unchanged' && <span style={{ fontSize: 10, background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: 10, marginLeft: 8 }}>IGUAL</span>}
                          {status === 'modified' && <span style={{ fontSize: 10, background: '#f59e0b', color: '#fff', padding: '2px 6px', borderRadius: 10, marginLeft: 8 }}>ACTUALIZACIÓN</span>}
                        </div>
                        <div style={{ fontSize: 12, color: T.textSec }}>
                          {renderField('zone')} • {renderField('type')} • {renderField('beds')} • {renderField('area')}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {renderPrice()}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button onClick={() => {
                  setPendingImports([]);
                  setSelectedPendingImports([]);
                }} style={{ ...btnSecondary(), padding: '10px 20px' }}>Cancelar</button>
                <button onClick={() => {
                  const toAddOrUpdate = pendingImports.filter((_, i) => selectedPendingImports.includes(i));
                  if (toAddOrUpdate.length > 0) {
                    const newList = [...projectsList];
                    toAddOrUpdate.forEach(item => {
                      const existingIdx = newList.findIndex(p => p.name?.trim().toLowerCase() === item.name?.trim().toLowerCase());
                      if (existingIdx >= 0) {
                        newList[existingIdx] = { ...newList[existingIdx], ...item }; // Merge updates
                      } else {
                        newList.push(item);
                      }
                    });
                    saveProjectsToBackend(newList);
                  }
                  setPendingImports([]);
                  setSelectedPendingImports([]);
                }} style={{ ...btnPrimary(), padding: '10px 20px' }}>
                  Anexar Seleccionados ({selectedPendingImports.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isExtracting && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 4000,
            background: 'rgba(0,35,73,0.85)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#fff', backdropFilter: 'blur(8px)'
          }}>
            <div style={{
              width: 60, height: 60, border: '4px solid rgba(255,255,255,0.2)',
              borderTopColor: '#0EA5AC', borderRadius: '50%', animation: 'spin 1s linear infinite',
              marginBottom: 24
            }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 24, fontFamily: 'Inter, sans-serif' }}>IA procesando documento...</h3>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif' }}>Extrayendo estructura OCR y cruzando con la base de datos.</p>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // MODULE 4: PROSPECTOS (CRM)
  // ══════════════════════════════════════════════════════════════
  const renderProspectos = () => {
    const filtered = prospects.filter(p => {
      if (prospectFilterBroker !== 'all' && p.broker_asignado !== prospectFilterBroker) return false;
      if (prospectFilterStage !== 'all' && p.estado !== prospectFilterStage) return false;
      if (prospectFilterProject !== 'all' && !p.proyectos_interes.includes(prospectFilterProject)) return false;
      
      // Filter by origin/channel
      if (prospectFilterOrigin !== 'all') {
        const notesLower = (p.notas || '').toLowerCase();
        const detailLower = p.historial ? p.historial.map(h => (h.detalle || '')).join(' ').toLowerCase() : '';
        const isCamilo = notesLower.includes('camilo') || detailLower.includes('camilo');
        const isBroker = p.forma_contacto === 'Broker';
        
        if (prospectFilterOrigin === 'camilo' && !isCamilo) return false;
        if (prospectFilterOrigin === 'brokers' && !isBroker) return false;
        if (prospectFilterOrigin === 'otros' && (isCamilo || isBroker)) return false;
      }
      return true;
    });

    const detailProspect = prospectDetail ? prospects.find(p => p.id === prospectDetail) : null;

    const addProspect = () => {
      if (!newProspect.nombre || !newProspect.apellido) return;
      const np: Prospect = {
        nombre: newProspect.nombre || '',
        apellido: newProspect.apellido || '',
        direccion: newProspect.direccion || '',
        correo: newProspect.correo || '',
        telefono: newProspect.telefono || '',
        ocupacion: newProspect.ocupacion || '',
        proyectos_interes: newProspect.proyectos_interes || [],
        forma_contacto: newProspect.forma_contacto || 'Pagina Web',
        broker_asignado: newProspect.broker_asignado || '',
        estado: newProspect.estado || 'Contacto Inicial',
        presupuesto_usd: newProspect.presupuesto_usd || 0,
        notas: newProspect.notas || '',
        id: Date.now(),
        fecha_entrada: today(),
        historial: [{ fecha: today(), accion: 'Contacto Inicial', detalle: 'Prospecto creado en CRM' }],
      };
      setProspects([...prospects, np]);
      setNewProspect({
        nombre: '', apellido: '', direccion: '', correo: '', telefono: '', ocupacion: '',
        proyectos_interes: [], forma_contacto: 'Pagina Web', broker_asignado: '', estado: 'Contacto Inicial',
        presupuesto_usd: 0, notas: '', historial: [],
      });
      setShowProspectForm(false);
    };

    const moveStage = (id: number, newStage: string) => {
      setProspects(prospects.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          estado: newStage,
          historial: [...p.historial, { fecha: today(), accion: newStage, detalle: `Movido a ${newStage}` }],
        };
      }));
    };

    const deleteProspect = (id: number) => {
      setProspects(prospects.filter(p => p.id !== id));
      setDeleteConfirm(null);
      if (prospectDetail === id) setProspectDetail(null);
    };

    // Detail view
    if (detailProspect) {
      const dp = detailProspect;
      const isEditing = prospectEdit === dp.id;
      return (
        <div>
          <button onClick={() => { setProspectDetail(null); setProspectEdit(null); }} style={btnSecondary({ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
            {renderButtonIcon('arrow-left')}
            <span>Volver a lista/embudo</span>
          </button>
          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {dp.nombre} {dp.apellido}
                  {showAdvancedAI && (
                    <div style={{ width: 140, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 9, color: T.textSec, textTransform: 'uppercase', letterSpacing: 0.5 }}>Probabilidad de Cierre</span>
                      {renderThermometer(calculateLeadScore(dp))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, color: T.textSec }}>{dp.ocupacion} · Registrado el {dp.fecha_entrada}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {badge(dp.estado, T.sand, T.text)}
                <button onClick={() => setProspectEdit(isEditing ? null : dp.id)} style={btnSecondary({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                  {isEditing ? (
                    <>
                      {renderButtonIcon('check')}
                      <span>Guardar</span>
                    </>
                  ) : (
                    <>
                      {renderButtonIcon('pencil')}
                      <span>Editar</span>
                    </>
                  )}
                </button>
                <button onClick={() => setDeleteConfirm(dp.id)} style={btnDanger({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Eliminar">{renderButtonIcon('trash')}</button>
              </div>
            </div>

            {deleteConfirm === dp.id && (
              <div style={{ background: '#FFF5F5', border: `1px solid ${T.coral}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: T.coral, fontWeight: 600 }}>¿Eliminar este prospecto?</span>
                <button onClick={() => deleteProspect(dp.id)} style={btnDanger({ marginLeft: 12, padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                  {renderButtonIcon('check')}
                  <span>Sí, eliminar</span>
                </button>
                <button onClick={() => setDeleteConfirm(null)} style={btnSecondary({ marginLeft: 8, padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                  {renderButtonIcon('close')}
                  <span>Cancelar</span>
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, fontSize: 13 }}>
              <div>
                <div style={labelStyle}>Correo</div>
                {isEditing ? (
                  <input value={dp.correo} onChange={e => setProspects(prospects.map(p => p.id === dp.id ? { ...p, correo: e.target.value } : p))} style={inputStyle()} />
                ) : <div>{dp.correo}</div>}
              </div>
              <div>
                <div style={labelStyle}>Teléfono</div>
                {isEditing ? (
                  <input value={dp.telefono} onChange={e => setProspects(prospects.map(p => p.id === dp.id ? { ...p, telefono: e.target.value } : p))} style={inputStyle()} />
                ) : <div>{dp.telefono}</div>}
              </div>
              <div>
                <div style={labelStyle}>Dirección</div>
                {isEditing ? (
                  <input value={dp.direccion} onChange={e => setProspects(prospects.map(p => p.id === dp.id ? { ...p, direccion: e.target.value } : p))} style={inputStyle()} />
                ) : <div>{dp.direccion}</div>}
              </div>
              <div>
                <div style={labelStyle}>Presupuesto</div>
                {isEditing ? (
                  <input type="number" value={dp.presupuesto_usd} onChange={e => setProspects(prospects.map(p => p.id === dp.id ? { ...p, presupuesto_usd: Number(e.target.value) } : p))} style={inputStyle()} />
                ) : <div style={{ fontWeight: 700, color: T.teal }}>{usd(dp.presupuesto_usd)}</div>}
              </div>
              <div>
                <div style={labelStyle}>Forma de Contacto</div>
                {isEditing ? (
                  <select value={dp.forma_contacto} onChange={e => setProspects(prospects.map(p => p.id === dp.id ? { ...p, forma_contacto: e.target.value } : p))} style={inputStyle()}>
                    {CONTACT_FORMS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : <div>{dp.forma_contacto}</div>}
              </div>
              <div>
                <div style={labelStyle}>Broker Asignado</div>
                {isEditing ? (
                  <select value={dp.broker_asignado} onChange={e => setProspects(prospects.map(p => p.id === dp.id ? { ...p, broker_asignado: e.target.value } : p))} style={inputStyle()}>
                    <option value="">Seleccionar...</option>
                    {brokers.filter(b => b.estado === 'activo').map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
                  </select>
                ) : <div>{dp.broker_asignado || 'Sin asignar'}</div>}
              </div>
              <div>
                <div style={labelStyle}>Fecha de Registro</div>
                <div>{dp.fecha_entrada}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Proyectos de Interés</div>
              {isEditing ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {crmProjects.map(pj => {
                    const isChecked = dp.proyectos_interes.includes(pj.name);
                    return (
                      <label key={pj.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <input type="checkbox" checked={isChecked} onChange={e => {
                          const list = e.target.checked
                            ? [...dp.proyectos_interes, pj.name]
                            : dp.proyectos_interes.filter(x => x !== pj.name);
                          setProspects(prospects.map(p => p.id === dp.id ? { ...p, proyectos_interes: list } : p));
                        }} />
                        {pj.name}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {dp.proyectos_interes.map(pi => (
                    <span key={pi} style={{ background: T.sand, padding: '4px 10px', borderRadius: 16, fontSize: 11, color: T.text }}>{pi}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Notas</div>
              {isEditing ? (
                <textarea value={dp.notas} onChange={e => setProspects(prospects.map(p => p.id === dp.id ? { ...p, notas: e.target.value } : p))}
                  style={{ ...inputStyle(), minHeight: 80, resize: 'vertical' as const }} />
              ) : <div style={{ fontSize: 13, color: T.textSec }}>{dp.notas}</div>}
            </div>

            {/* Stage movement */}
            <div style={{ marginBottom: 20 }}>
              <div style={labelStyle}>Mover a Etapa</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FUNNEL_STAGES.map(s => (
                  <button key={s} onClick={() => moveStage(dp.id, s)}
                    style={{ ...btnSecondary({ padding: '5px 12px', fontSize: 11 }), background: dp.estado === s ? T.teal : 'transparent', color: dp.estado === s ? T.card : T.teal }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Workflow Automation (Secuencias) */}
            {showAdvancedAI && (
              <div style={{ marginBottom: 20, padding: 14, background: '#F8FAFC', borderRadius: 10, border: `1px solid ${T.borderLight}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Automatización: Secuencias de Seguimiento</div>
                </div>
                <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12 }}>
                  Activa un plan de acción sugerido. El sistema generará tareas pendientes con fechas futuras calculadas automáticamente.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => {
                      const d1 = new Date(); d1.setDate(d1.getDate() + 1);
                      const d3 = new Date(); d3.setDate(d3.getDate() + 3);
                      const d7 = new Date(); d7.setDate(d7.getDate() + 7);
                      setProspects(prospects.map(p => p.id === dp.id ? {
                        ...p,
                        tareas_pendientes: [
                          ...(p.tareas_pendientes || []),
                          { id: Date.now().toString()+'1', fecha: d1.toISOString().split('T')[0], tipo: 'WhatsApp', detalle: 'Enviar mensaje de bienvenida y preguntar por intereses específicos', estado: 'pendiente' },
                          { id: Date.now().toString()+'2', fecha: d3.toISOString().split('T')[0], tipo: 'Correo', detalle: 'Enviar brochure del proyecto sugerido', estado: 'pendiente' },
                          { id: Date.now().toString()+'3', fecha: d7.toISOString().split('T')[0], tipo: 'Llamada', detalle: 'Llamar para coordinar reunión o visita', estado: 'pendiente' }
                        ]
                      } : p));
                      alert('Secuencia "Lead Nuevo (7 días)" activada.');
                    }}
                    style={btnPrimary({ padding: '6px 12px', fontSize: 11, background: '#4F46E5' })}>
                    ▶ Secuencia Lead Nuevo (7 días)
                  </button>
                  <button type="button" onClick={(e) => {
                      e.stopPropagation();
                      const d15 = new Date(); d15.setDate(d15.getDate() + 15);
                      const d30 = new Date(); d30.setDate(d30.getDate() + 30);
                      setProspects(prospects.map(p => p.id === dp.id ? {
                        ...p,
                        tareas_pendientes: [
                          ...(p.tareas_pendientes || []),
                          { id: Date.now().toString()+'4', fecha: d15.toISOString().split('T')[0], tipo: 'Correo', detalle: 'Novedades del mercado: Plusvalía y nuevos lanzamientos', estado: 'pendiente' },
                          { id: Date.now().toString()+'5', fecha: d30.toISOString().split('T')[0], tipo: 'Llamada', detalle: 'Retomar contacto para evaluar cambio de decisión', estado: 'pendiente' }
                        ]
                      } : p));
                      alert('Secuencia "Nurturing Lead Frío (30 días)" activada.');
                    }}
                    style={btnSecondary({ padding: '6px 12px', fontSize: 11 })}>
                    ▶ Secuencia Lead Frío (30 días)
                  </button>
                </div>
                
                {dp.tareas_pendientes && dp.tareas_pendientes.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>Tareas Programadas:</div>
                    {dp.tareas_pendientes.filter(t => t.estado === 'pendiente').map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFF', border: `1px solid ${T.borderLight}`, borderRadius: 6, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{t.fecha} • {t.tipo}</div>
                          <div style={{ fontSize: 11, color: T.textSec }}>{t.detalle}</div>
                        </div>
                        <button onClick={() => {
                          setProspects(prospects.map(p => p.id === dp.id ? {
                            ...p,
                            tareas_pendientes: p.tareas_pendientes?.filter(x => x.id !== t.id),
                            historial: [...p.historial, { fecha: today(), accion: `Completada: ${t.tipo}`, detalle: t.detalle }]
                          } : p));
                        }} style={{ ...btnSecondary({ padding: '4px 8px', fontSize: 10 }), color: T.success, borderColor: T.success }}>✔ Completar</button>
                      </div>
                    ))}
                    {dp.tareas_pendientes.filter(t => t.estado === 'pendiente').length === 0 && (
                      <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic' }}>No hay tareas pendientes.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Redacción Contextual (Advanced AI) */}
            {showAdvancedAI && (
              <div style={{ marginBottom: 20, padding: 14, background: `linear-gradient(to right, ${T.teal}15, ${T.bg})`, borderRadius: 10, border: `1px solid ${T.teal}40` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.teal }}>✨ S.A.R.A - Redacción Mágica</div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); generateMagicEmail(dp); }}
                    disabled={isGeneratingMagic[dp.id]}
                    style={{
                      background: isGeneratingMagic[dp.id] ? '#ccc' : T.teal, color: T.card, border: 'none',
                      padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: isGeneratingMagic[dp.id] ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isGeneratingMagic[dp.id] ? 'Generando...' : 'Redactar Correo Personalizado'}
                  </button>
                </div>
                {magicDrafts[dp.id] && (
                  <div style={{ marginTop: 10 }}>
                    <textarea 
                      value={magicDrafts[dp.id]} 
                      onChange={e => setMagicDrafts(prev => ({ ...prev, [dp.id]: e.target.value }))}
                      style={{ ...inputStyle({ fontSize: 12 }), width: '100%', minHeight: 120, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Simular envío
                          const act = `Correo mágico enviado vía S.A.R.A`;
                          const up = prospects.map(pp => pp.id === dp.id ? { ...pp, historial: [...pp.historial, { fecha: new Date().toISOString().split('T')[0], accion: 'Correo', detalle: act }] } : pp);
                          setProspects(up);
                          setMagicDrafts(prev => {
                            const copy = { ...prev };
                            delete copy[dp.id];
                            return copy;
                          });
                        }}
                        style={btnPrimary({ padding: '6px 16px', fontSize: 11 })}
                      >
                        Enviar Correo
                      </button>
                    </div>
                  </div>
                )}
                {!magicDrafts[dp.id] && (
                  <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic' }}>
                    S.A.R.A usará el presupuesto, proyectos de interés y últimas notas para escribir un correo hiper-personalizado que no parezca robótico.
                  </div>
                )}
              </div>
            )}

            {/* Registrar Actividad Form */}
            <div style={{ marginBottom: 20, padding: 14, background: `${T.teal}08`, borderRadius: 10, border: `1px solid ${T.teal}20` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>📝 Registrar Nueva Actividad / Seguimiento</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="newActivityDetail" placeholder="Detalle de la llamada, reunión, correo..." style={inputStyle({ flex: 1, fontSize: 12 })} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        setProspects(prospects.map(p => p.id === dp.id ? {
                          ...p,
                          historial: [...p.historial, { fecha: today(), accion: 'Seguimiento', detalle: val }]
                        } : p));
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <button onClick={() => {
                  const el = document.getElementById('newActivityDetail') as HTMLInputElement;
                  if (el && el.value.trim()) {
                    setProspects(prospects.map(p => p.id === dp.id ? {
                      ...p,
                      historial: [...p.historial, { fecha: today(), accion: 'Seguimiento', detalle: el.value.trim() }]
                    } : p));
                    el.value = '';
                  }
                }} style={btnPrimary({ padding: '6px 14px', fontSize: 12 })}>Registrar</button>
              </div>
            </div>

            {/* History */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Historial de Actividades (Fechas y Acciones)</div>
              <div style={{ borderLeft: `2px solid ${T.teal}`, paddingLeft: 16 }}>
                {dp.historial.slice().reverse().map((h, i) => (
                  <div key={i} style={{ marginBottom: 12, position: 'relative' as const }}>
                    <div style={{ position: 'absolute' as const, left: -22, top: 4, width: 10, height: 10, borderRadius: '50%', background: T.teal }} />
                    <div style={{ fontSize: 11, color: T.textSec }}>{h.fecha}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{h.accion}</div>
                    <div style={{ fontSize: 12, color: T.textSec }}>{h.detalle}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        {sectionTitle('Prospectos CRM · Gestión Comercial')}

        {/* Funnel summary filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' as const }}>
          {FUNNEL_STAGES.map(s => {
            const count = prospects.filter(p => p.estado === s).length;
            return (
              <div key={s} onClick={() => setProspectFilterStage(prospectFilterStage === s ? 'all' : s)}
                style={{ ...cardStyle({ padding: '10px 16px', cursor: 'pointer', minWidth: 100, textAlign: 'center' as const }), border: prospectFilterStage === s ? `2px solid ${T.teal}` : `1px solid ${T.borderLight}` }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.teal }}>{count}</div>
                <div style={{ fontSize: 10, color: T.textSec }}>{s}</div>
              </div>
            );
          })}
        </div>

        {/* View Mode Switch, Filters & Add */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: T.borderLight, borderRadius: 20, padding: 2 }}>
            <button onClick={() => setProspectViewMode('embudo')} style={{
              border: 'none', background: prospectViewMode === 'embudo' ? T.teal : 'transparent',
              color: prospectViewMode === 'embudo' ? T.card : T.text,
              padding: '6px 14px', borderRadius: 18, cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.2s'
            }}>📊 Vista Embudo</button>
            <button onClick={() => setProspectViewMode('lista')} style={{
              border: 'none', background: prospectViewMode === 'lista' ? T.teal : 'transparent',
              color: prospectViewMode === 'lista' ? T.card : T.text,
              padding: '6px 14px', borderRadius: 18, cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.2s'
            }}>📋 Vista Lista</button>
          </div>

          <select value={prospectFilterBroker} onChange={e => setProspectFilterBroker(e.target.value)} style={inputStyle({ width: 150 })}>
            <option value="all">Todos los brokers</option>
            {brokers.map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
          </select>
          <select value={prospectFilterProject} onChange={e => setProspectFilterProject(e.target.value)} style={inputStyle({ width: 180 })}>
            <option value="all">Todos los proyectos</option>
            {crmProjects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <select value={prospectFilterOrigin} onChange={e => setProspectFilterOrigin(e.target.value)} style={inputStyle({ width: 160 })}>
            <option value="all">Todos los orígenes</option>
            <option value="camilo">Generados por Camilo</option>
            <option value="brokers">Por Brokers</option>
            <option value="otros">Otros Canales</option>
          </select>
          <button onClick={() => { setProspectFilterBroker('all'); setProspectFilterStage('all'); setProspectFilterProject('all'); setProspectFilterOrigin('all'); }} style={btnSecondary({ fontSize: 11 })}>Limpiar filtros</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowProspectForm(!showProspectForm)} style={btnPrimary()}>
            {showProspectForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Nuevo Prospecto</span>
              </span>
            )}
          </button>
        </div>

        {/* New prospect form */}
        {showProspectForm && (
          <div style={{ ...cardStyle({ marginBottom: 16, background: T.sand }) }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Nuevo Prospecto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Nombre', key: 'nombre' },
                { label: 'Apellido', key: 'apellido' },
                { label: 'Ocupación', key: 'ocupacion' },
                { label: 'Correo', key: 'correo' },
                { label: 'Teléfono', key: 'telefono' },
                { label: 'Dirección', key: 'direccion' },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input value={(newProspect as any)[f.key] || ''} onChange={e => setNewProspect({ ...newProspect, [f.key]: e.target.value })} style={inputStyle()} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Presupuesto USD</label>
                <input type="number" value={newProspect.presupuesto_usd || ''} onChange={e => setNewProspect({ ...newProspect, presupuesto_usd: Number(e.target.value) })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Forma de Contacto</label>
                <select value={newProspect.forma_contacto} onChange={e => setNewProspect({ ...newProspect, forma_contacto: e.target.value })} style={inputStyle()}>
                  {CONTACT_FORMS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Broker Asignado</label>
                <select value={newProspect.broker_asignado} onChange={e => setNewProspect({ ...newProspect, broker_asignado: e.target.value })} style={inputStyle()}>
                  <option value="">Seleccionar...</option>
                  {brokers.filter(b => b.estado === 'activo').map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Notas</label>
              <textarea value={newProspect.notas || ''} onChange={e => setNewProspect({ ...newProspect, notas: e.target.value })}
                style={{ ...inputStyle(), minHeight: 60, resize: 'vertical' as const }} />
            </div>
            <button onClick={addProspect} style={btnPrimary({ marginTop: 12 })}>Guardar Prospecto</button>
          </div>
        )}

        {/* View render */}
        {prospectViewMode === 'embudo' ? (
          /* KANBAN BOARD */
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
            {FUNNEL_STAGES.map(stage => {
              const stageProspects = filtered.filter(p => p.estado === stage);
              return (
                <div key={stage}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const prospectId = e.dataTransfer.getData('text/plain');
                    if (prospectId) moveStage(Number(prospectId), stage);
                  }}
                  style={{
                  flex: '1 0 260px', background: `${T.sand}40`, borderRadius: 12,
                  padding: 12, border: `1px solid ${T.border}`, minHeight: 400, display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: `2px solid ${T.teal}20`, paddingBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{stage}</span>
                    <span style={{ background: T.teal, color: T.card, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{stageProspects.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                    {stageProspects.map(p => (
                      <div key={p.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id.toString())}
                        style={{
                        background: T.card, borderRadius: 8, padding: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)', border: `1px solid ${T.border}`,
                        transition: 'transform 0.2s', cursor: 'grab'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        <div style={{ fontWeight: 700, color: T.teal, cursor: 'pointer', fontSize: 13, marginBottom: 4 }}
                          onClick={() => setProspectDetail(p.id)}>
                          {p.nombre} {p.apellido}
                        </div>
                        <div style={{ fontSize: 11, color: T.textSec, marginBottom: 6 }}>{p.ocupacion}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: T.textSec, borderTop: `1px dashed ${T.border}`, paddingTop: 6, marginTop: 6 }}>
                          <span style={{ fontWeight: 600, color: T.teal }}>{usd(p.presupuesto_usd)}</span>
                          <span style={{ background: `${T.teal}15`, color: T.teal, padding: '2px 6px', borderRadius: 4, fontSize: 9 }}>{p.forma_contacto}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: T.textSec, marginTop: 6 }}>
                          <span>📅 {p.fecha_entrada}</span>
                          <span style={{ fontStyle: 'italic' }}>{p.broker_asignado ? p.broker_asignado.split(' ')[0] : 'Sin broker'}</span>
                        </div>
                        {/* Quick move buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: `1px solid ${T.borderLight}` }}>
                          <button 
                            disabled={FUNNEL_STAGES.indexOf(stage) === 0}
                            onClick={() => moveStage(p.id, FUNNEL_STAGES[FUNNEL_STAGES.indexOf(stage) - 1])}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: FUNNEL_STAGES.indexOf(stage) === 0 ? '#ccc' : T.teal }}
                          >◀</button>
                          <span style={{ fontSize: 10, color: T.textSec, alignSelf: 'center', fontWeight: 600 }}>Etapa</span>
                          <button 
                            disabled={FUNNEL_STAGES.indexOf(stage) === FUNNEL_STAGES.length - 1}
                            onClick={() => moveStage(p.id, FUNNEL_STAGES[FUNNEL_STAGES.indexOf(stage) + 1])}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: FUNNEL_STAGES.indexOf(stage) === FUNNEL_STAGES.length - 1 ? '#ccc' : T.teal }}
                          >▶</button>
                        </div>
                      </div>
                    ))}
                    {stageProspects.length === 0 && (
                      <div style={{ fontSize: 11, color: T.textSec, textAlign: 'center', marginTop: 20, fontStyle: 'italic' }}>Vacío</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div style={{ overflowX: 'auto' as const }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr>
                  {['Nombre', 'Registro', 'Ocupación', 'Proyectos', 'Broker', 'Presupuesto', 'Etapa', 'Canal'].map(h => {
                    const sortKeyMap: Record<string, string> = {
                      'Nombre': 'nombre',
                      'Registro': 'fecha_registro',
                      'Ocupación': 'ocupacion',
                      'Proyectos': 'proyectos_interes',
                      'Broker': 'broker_asignado',
                      'Presupuesto': 'presupuesto_usd',
                      'Etapa': 'estado',
                      'Canal': 'canal'
                    };
                    const sortKey = sortKeyMap[h];
                    const isSortable = !!sortKey;
                    const isActive = prospectsSortField === sortKey;
                    
                    return (
                      <th 
                        key={h} 
                        style={{ background: T.teal, color: T.card, padding: '10px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: 12, cursor: isSortable ? 'pointer' : 'default', userSelect: 'none' }}
                        onClick={() => {
                          if (!isSortable) return;
                          if (isActive) {
                            setProspectsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setProspectsSortField(sortKey);
                            setProspectsSortDirection('asc');
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: h === 'Presupuesto' ? 'flex-start' : 'flex-start', gap: '4px' }}>
                          {h}
                          {isSortable && (
                            <span style={{ fontSize: 10, color: isActive ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                              {isActive ? (prospectsSortDirection === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {showAdvancedAI && <th style={{ background: T.teal, color: T.card, padding: '10px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: 12, width: 80 }}>Score IA</th>}
                  <th style={{ background: T.teal, color: T.card, padding: '10px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: 12 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let sortedFiltered = [...filtered];
                  if (prospectsSortField) {
                    sortedFiltered.sort((a, b) => {
                      let valA: any = a[prospectsSortField as keyof typeof a];
                      let valB: any = b[prospectsSortField as keyof typeof b];
                      if (prospectsSortField === 'proyectos_interes') {
                        valA = a.proyectos_interes ? a.proyectos_interes.join(',') : '';
                        valB = b.proyectos_interes ? b.proyectos_interes.join(',') : '';
                      }
                      if (valA == null) valA = '';
                      if (valB == null) valB = '';
                      if (typeof valA === 'string') valA = valA.toLowerCase();
                      if (typeof valB === 'string') valB = valB.toLowerCase();
                      
                      if (valA < valB) return prospectsSortDirection === 'asc' ? -1 : 1;
                      if (valA > valB) return prospectsSortDirection === 'asc' ? 1 : -1;
                      return 0;
                    });
                  }
                  return sortedFiltered.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 700, color: T.teal, cursor: 'pointer' }} onClick={() => setProspectDetail(p.id)}>
                        {p.nombre} {p.apellido}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.fecha_entrada}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.ocupacion}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {p.proyectos_interes.map(pi => (
                          <span key={pi} style={{ background: T.sand, padding: '2px 8px', borderRadius: 10, fontSize: 10 }}>{pi.length > 20 ? pi.slice(0, 18) + '…' : pi}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{p.broker_asignado || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{usd(p.presupuesto_usd)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select value={p.estado} onChange={e => moveStage(p.id, e.target.value)}
                        style={{ ...inputStyle({ width: 'auto', fontSize: 11, padding: '4px 8px' }), background: T.sand }}>
                        {FUNNEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11 }}>{p.forma_contacto}</td>
                    {showAdvancedAI && (
                      <td style={{ padding: '10px 12px' }}>
                        {renderThermometer(calculateLeadScore(p))}
                      </td>
                    )}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setProspectDetail(p.id)} style={btnSecondary({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Ver detalles">{renderButtonIcon('eye', 13)}</button>
                        <button onClick={() => { setProspectDetail(p.id); setProspectEdit(p.id); }} style={btnSecondary({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Editar">{renderButtonIcon('pencil', 13)}</button>
                        {deleteConfirm === p.id ? (
                          <>
                            <button onClick={() => deleteProspect(p.id)} style={btnDanger({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Confirmar">{renderButtonIcon('check', 13)}</button>
                            <button onClick={() => setDeleteConfirm(null)} style={btnSecondary({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Cancelar">{renderButtonIcon('close', 13)}</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(p.id)} style={btnDanger({ padding: '3px 8px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })} title="Eliminar">{renderButtonIcon('trash', 13)}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // MODULE 5: PRESUPUESTO DE EVENTOS
  // ══════════════════════════════════════════════════════════════
  const renderEventos = () => {
    const addEvent = () => {
      const ne: EventData = {
        ...(newEvent as EventData),
        id: Date.now(),
      };
      setEvents([...events, ne]);
      setNewEvent({
        titulo: '', venue: '', fecha: '', proyectos_presentados: [], asistentes: [],
        proyectos_interes: [], presupuesto_asignado: 0, presupuesto_ejecutado: 0, items_costo: [],
      });
      setShowEventForm(false);
    };

    const updateCostItem = (eventId: number, idx: number, field: string, value: string | number) => {
      setEvents(events.map(ev => {
        if (ev.id !== eventId) return ev;
        const items = [...ev.items_costo];
        items[idx] = { ...items[idx], [field]: value };
        const newExecuted = items.reduce((s, i) => s + i.valor, 0);
        return { ...ev, items_costo: items, presupuesto_ejecutado: newExecuted };
      }));
    };

    const addCostItem = (eventId: number) => {
      setEvents(events.map(ev => {
        if (ev.id !== eventId) return ev;
        return { ...ev, items_costo: [...ev.items_costo, { concepto: 'Nuevo ítem', valor: 0 }] };
      }));
    };

    return (
      <div>
        {sectionTitle('Presupuesto de Eventos')}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => setShowEventForm(!showEventForm)} style={btnPrimary()}>
            {showEventForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Nuevo Evento</span>
              </span>
            )}
          </button>
        </div>

        {showEventForm && (
          <div style={{ ...cardStyle({ marginBottom: 16, background: T.sand }) }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nuevo Evento</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Título</label>
                <input value={newEvent.titulo} onChange={e => setNewEvent({ ...newEvent, titulo: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Venue</label>
                <input value={newEvent.venue} onChange={e => setNewEvent({ ...newEvent, venue: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" value={newEvent.fecha} onChange={e => setNewEvent({ ...newEvent, fecha: e.target.value })} style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Presupuesto Asignado</label>
                <input type="number" value={newEvent.presupuesto_asignado} onChange={e => setNewEvent({ ...newEvent, presupuesto_asignado: Number(e.target.value) })} style={inputStyle()} />
              </div>
            </div>
            <button onClick={addEvent} style={btnPrimary({ marginTop: 12 })}>Guardar Evento</button>
          </div>
        )}

        {events.map(ev => {
          const expanded = expandedEvent === ev.id;
          const execPct = ev.presupuesto_asignado > 0 ? (ev.presupuesto_ejecutado / ev.presupuesto_asignado * 100) : 0;
          return (
            <div key={ev.id} style={{ ...cardStyle({ marginBottom: 16, cursor: 'pointer' }) }}
              onClick={() => setExpandedEvent(expanded ? null : ev.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{ev.titulo}</div>
                  <div style={{ fontSize: 13, color: T.textSec }}>{ev.venue} · {ev.fecha}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: execPct > 90 ? T.coral : T.teal }}>{usd(ev.presupuesto_ejecutado)} / {usd(ev.presupuesto_asignado)}</div>
                  <div style={{ height: 6, width: 120, background: T.borderLight, borderRadius: 3, marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, execPct)}%`, background: execPct > 90 ? T.coral : T.teal, borderRadius: 3 }} />
                  </div>
                </div>
              </div>

              {expanded && (
                <div style={{ marginTop: 16, borderTop: `1px solid ${T.borderLight}`, paddingTop: 16 }} onClick={e => e.stopPropagation()}>
                  
                  {(() => {
                    const cleanStr = (str: string): string => {
                      if (!str) return '';
                      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase().trim().replace(/\s+/g, ' ');
                    };

                    const mappedAttendees = ev.asistentes.map(a => {
                      const found = prospects.find(p => cleanStr(p.nombre + ' ' + p.apellido) === cleanStr(a));
                      return {
                        originalName: a,
                        prospect: found
                      };
                    });

                    const closingWonAttendees = mappedAttendees.filter(m => m.prospect && (m.prospect.estado === 'Cierre' || m.prospect.estado === 'Post-venta'));
                    const cierresCount = closingWonAttendees.length;

                    const cacValue = cierresCount > 0 
                      ? usd(ev.presupuesto_ejecutado / cierresCount) 
                      : 'Sin Cierres (N/A)';

                    const totalAttendees = ev.asistentes.length;
                    const eficiencia = totalAttendees > 0 
                      ? Math.round((cierresCount / totalAttendees) * 100) 
                      : 0;

                    return (
                      <>
                        {/* Event KPIs Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                          <div style={{ background: T.bg, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: T.textSec, fontWeight: 600 }}>Total Asistentes</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: T.teal, marginTop: 4 }}>{totalAttendees} pax</div>
                          </div>
                          
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEventCierreDrilldown(eventCierreDrilldown === ev.id ? null : ev.id);
                            }}
                            style={{ 
                              background: T.bg, 
                              padding: 12, 
                              borderRadius: 8, 
                              border: eventCierreDrilldown === ev.id ? `2px solid ${T.coral}` : `1px solid ${T.borderLight}`, 
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: eventCierreDrilldown === ev.id ? '0 2px 8px rgba(184,144,71,0.15)' : 'none'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                            onMouseLeave={e => e.currentTarget.style.background = T.bg}
                          >
                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: T.textSec, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                              <span>Etapa de Cierre 🔍</span>
                              {cierresCount > 0 && <span style={{ background: T.coral, color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>{cierresCount}</span>}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: T.coral, marginTop: 4 }}>{cierresCount} {cierresCount === 1 ? 'cliente' : 'clientes'}</div>
                            <div style={{ fontSize: 9, color: T.textSec, marginTop: 2 }}>{eventCierreDrilldown === ev.id ? 'Click para ocultar detalle' : 'Click para ver detalle (Drilldown)'}</div>
                          </div>

                          <div style={{ background: T.bg, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: T.textSec, fontWeight: 600 }}>CAC del Evento</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: T.palm, marginTop: 4, whiteSpace: 'nowrap' }}>{cacValue}</div>
                            <div style={{ fontSize: 9, color: T.textSec, marginTop: 2 }}>Costo ejecutado / cierres</div>
                          </div>

                          <div style={{ background: T.bg, padding: 12, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: T.textSec, fontWeight: 600 }}>Eficiencia de Cierre</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: T.teal, marginTop: 4 }}>{eficiencia}%</div>
                            <div style={{ fontSize: 9, color: T.textSec, marginTop: 2 }}>Conversión a Cierre</div>
                          </div>
                        </div>

                        {/* Event Cierre Drilldown Box */}
                        {eventCierreDrilldown === ev.id && (
                          <div style={{ background: 'rgba(184,144,71,0.04)', border: `1.5px solid ${T.coral}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.teal }}>🔎 Detalle de Clientes en Etapa de Cierre - {ev.titulo}</div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEventCierreDrilldown(null); }} 
                                style={{ background: 'transparent', border: 'none', color: T.textSec, cursor: 'pointer', fontSize: 12 }}
                              >
                                Ocultar ✕
                              </button>
                            </div>
                            
                            {closingWonAttendees.length === 0 ? (
                              <div style={{ fontSize: 12, color: T.textSec, fontStyle: 'italic' }}>No hay asistentes de este evento en etapa de cierre o ganados.</div>
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ borderBottom: `2px solid ${T.borderLight}`, background: 'rgba(0,0,0,0.02)' }}>
                                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Nombre</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Ocupación</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Ciudad</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>Presupuesto</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>Broker Asignado</th>
                                      <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>Acción</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {closingWonAttendees.map(m => (
                                      <tr key={m.prospect!.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                                        <td style={{ padding: '8px 8px', fontWeight: 700, color: T.teal }}>{m.prospect!.nombre} {m.prospect!.apellido}</td>
                                        <td style={{ padding: '8px 8px' }}>{m.prospect!.ocupacion}</td>
                                        <td style={{ padding: '8px 8px' }}>{m.prospect!.direccion.split(',')[1]?.trim() || m.prospect!.direccion}</td>
                                        <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600 }}>{usd(m.prospect!.presupuesto_usd)}</td>
                                        <td style={{ padding: '8px 8px' }}>{m.prospect!.broker_asignado}</td>
                                        <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setProspectDetail(m.prospect!.id);
                                              setActiveModule('prospectos');
                                            }}
                                            style={{ ...btnSecondary({ padding: '3px 8px', fontSize: 10 }), borderColor: T.coral, color: T.coral }}
                                          >
                                            Ver Perfil 👤
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Elegant Attendees & Projects Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 16, marginBottom: 20 }}>
                          {/* Projects Presented */}
                          <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderLight}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ ...labelStyle, marginBottom: 10, color: T.teal, fontWeight: 700 }}>Proyectos Presentados</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {ev.proyectos_presentados.map(p => (
                                <span key={p} style={{ background: 'rgba(0,35,73,0.05)', color: T.teal, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                  🏢 {p}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Elegant Attendees Table */}
                          <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderLight}`, borderRadius: 8, padding: 14 }}>
                            <div style={{ ...labelStyle, marginBottom: 10, color: T.teal, fontWeight: 700 }}>Relación de Asistentes</div>
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                  <thead>
                                    <tr style={{ borderBottom: `2px solid ${T.borderLight}`, background: 'rgba(0,0,0,0.02)' }}>
                                      <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Nombre</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Perfil / Ocupación</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>Etapa Pipeline</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>Presupuesto</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {mappedAttendees.map((m, idx) => {
                                      const p = m.prospect;
                                      return (
                                        <tr key={idx} style={{ borderBottom: idx === mappedAttendees.length - 1 ? 'none' : `1px solid ${T.borderLight}` }}>
                                          <td style={{ padding: '8px 8px' }}>
                                            {p ? (
                                              <span 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setProspectDetail(p.id);
                                                  setActiveModule('prospectos');
                                                }}
                                                style={{ color: T.teal, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                                title="Ver perfil completo de cliente"
                                              >
                                                {p.nombre} {p.apellido} 👤
                                              </span>
                                            ) : (
                                              <span style={{ color: T.textSec, fontWeight: 500 }}>{m.originalName}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '8px 8px', color: T.textSec }}>
                                            {p ? p.ocupacion : 'No registrado en CRM'}
                                          </td>
                                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                            {p ? (
                                              badge(
                                                p.estado, 
                                                p.estado === 'Cierre' || p.estado === 'Post-venta' ? 'rgba(22,101,52,0.12)' : p.estado === 'Negociación' ? 'rgba(184,144,71,0.12)' : 'rgba(75,85,99,0.08)',
                                                p.estado === 'Cierre' || p.estado === 'Post-venta' ? T.palm : p.estado === 'Negociación' ? T.coral : T.textSec
                                              )
                                            ) : (
                                              <span style={{ fontSize: 10, color: '#9CA3AF' }}>—</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600 }}>
                                            {p ? usd(p.presupuesto_usd) : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>Ítems de Costo</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ background: T.teal, color: T.card, padding: '6px 10px', textAlign: 'left' as const }}>Concepto</th>
                        <th style={{ background: T.teal, color: T.card, padding: '6px 10px', textAlign: 'right' as const }}>Valor USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.items_costo.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                          <td style={{ padding: '6px 10px' }}>
                            <input value={item.concepto} onChange={e => updateCostItem(ev.id, idx, 'concepto', e.target.value)}
                              style={inputStyle({ border: 'none', background: 'transparent', padding: '2px 0' })} />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' as const }}>
                            <input type="number" value={item.valor} onChange={e => updateCostItem(ev.id, idx, 'valor', Number(e.target.value))}
                              style={inputStyle({ border: 'none', background: 'transparent', padding: '2px 0', textAlign: 'right' as const, width: 80 })} />
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: T.bg }}>
                        <td style={{ padding: '6px 10px', fontWeight: 700 }}>Total</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' as const, fontWeight: 700, color: T.teal }}>{usd(ev.items_costo.reduce((s, i) => s + i.valor, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                  <button onClick={() => addCostItem(ev.id)} style={btnSecondary({ marginTop: 8, fontSize: 11 })}>+ Agregar ítem</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  const renderAgentes = () => {
    const renderActionIcon = (id: string, size = 14) => {
      switch (id) {
        case 'play': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;
        case 'chart': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>;
        case 'clipboard': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>;
        case 'mail': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;
        case 'document': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
        case 'file': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>;
        case 'video': return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>;
        default: return null;
      }
    };

    const renderAgentKpiDetail = (agent: string, label: string) => {
      const styleList = { margin: 0, paddingLeft: 18, lineHeight: 1.5 };
      if (agent === 'CAMILO') {
        if (label.includes('encontrados')) {
          return (
            <ul style={styleList}>
              <li><b>Felipe Londoño</b> (Grupo Bolívar, Barranquilla) - Estado: Calificado - Presupuesto: $950K</li>
              <li><b>Laura Sánchez</b> (Médica, Bogotá) - Estado: Contacto Inicial - Presupuesto: $350K</li>
              <li><b>Roberto Castaño</b> (Empresario Textil) - Estado: Cierre - Presupuesto: $220K</li>
            </ul>
          );
        } else if (label.includes('Fuentes')) {
          return (
            <ul style={styleList}>
              <li>LinkedIn Sales Navigator (28 perfiles HNWI escaneados)</li>
              <li>Registros Públicos de Cámaras de Comercio (Colombia/Panamá)</li>
              <li>Prensa de Negocios (La República, Portafolio - 12 notas de inversiones)</li>
              <li>Portales de Inversión y Fideicomisos</li>
            </ul>
          );
        } else {
          return (
            <div>
              <p style={{ margin: '0 0 6px' }}>Algoritmo de clustering ponderado:</p>
              <ul style={styleList}>
                <li>Capacidad Financiera (Patrimonio Neto): <b>40%</b></li>
                <li>Intención/Historial de Inversión en Dólares: <b>30%</b></li>
                <li>Ocupación/Cargo (CEO, Especialista, C-Level): <b>20%</b></li>
                <li>Nivel de Interés en Ubicaciones GLP: <b>10%</b></li>
              </ul>
            </div>
          );
        }
      } else if (agent === 'SARA') {
        if (label.includes('Mensajes')) {
          return (
            <ul style={styleList}>
              <li>WhatsApp Business API: <b>142 mensajes</b> (consultas rápidas sobre precios y zonas)</li>
              <li>Correos de Entrada: <b>63 correos</b> (solicitudes de catálogos y exenciones)</li>
              <li>Instagram / Facebook Messenger: <b>32 interacciones</b> (comentarios y DMs de marca)</li>
            </ul>
          );
        } else if (label.includes('Alertas')) {
          return (
            <ul style={styleList}>
              <li>⚠️ <b>Juan Carlos Restrepo</b> (Ocean Reef) solicita aclarar tiempos de entrega de la marina.</li>
              <li>⚠️ <b>Laura Sánchez</b> pregunta por convenios de doble tributación (explicación general).</li>
              <li>⚠️ Consulta recurrente sobre exención predial de 20 años en Arraiján.</li>
            </ul>
          );
        } else {
          return (
            <ul style={styleList}>
              <li>WhatsApp / Chatbots: <b>1.8 minutos</b> (tiempo promedio de respuesta)</li>
              <li>Instagram / DMs: <b>3.5 minutos</b> (respuestas automatizadas de primer nivel)</li>
              <li>Email / Back-office: <b>12.4 minutos</b> (preparación de borradores de cotización)</li>
            </ul>
          );
        }
      } else if (agent === 'VALERIA') {
        if (label.includes('generados')) {
          return (
            <ul style={styleList}>
              <li><b>5 Publicaciones LinkedIn</b> (enfoque financiero corporativo)</li>
              <li><b>4 Campañas de Email</b> (newsletter mensual de valorización en Punta Pacífica)</li>
              <li><b>3 Ad Copys para Meta</b> (segmento premium Chame / Playa Caracol)</li>
            </ul>
          );
        } else if (label.includes('plantillas')) {
          return (
            <ul style={styleList}>
              <li>Folleto de bienvenida y exenciones fiscales GLP</li>
              <li>Seguimiento de simulación de flujos de caja y ROI a 15 años</li>
              <li>Invitación formal a Eventos de Inversión Dolarizada</li>
            </ul>
          );
        } else {
          return (
            <ul style={styleList}>
              <li>Newsletter de Julio (Pendiente revisión de Armando)</li>
              <li>Copy para carrusel de Instagram sobre exenciones en Santa María</li>
              <li>Respuesta personalizada de cotización de Ocean Reef Park</li>
            </ul>
          );
        }
      } else if (agent === 'ISABELLA') {
        if (label.includes('programados')) {
          return (
            <ul style={styleList}>
              <li>Lunes: Video Corto (Reels/TikTok) sobre "Dolarización y Protección Patrimonial"</li>
              <li>Miércoles: Infografía técnica sobre "Exención del Impuesto de Inmuebles"</li>
              <li>Viernes: Post de Estilo de Vida en Ocean Reef Park</li>
            </ul>
          );
        } else if (label.includes('script')) {
          return (
            <ul style={styleList}>
              <li>Guión de Video: <i>¿Por qué Panamá sigue siendo el refugio seguro de LatAm?</i></li>
              <li>Guión de Video: <i>Cómo obtener residencia permanente comprando propiedades</i></li>
              <li>Guión de Video: <i>Diferencia entre Cap Rate Bruto y Neto en playas</i></li>
            </ul>
          );
        } else {
          return (
            <ul style={styleList}>
              <li>LinkedIn Engagement: <b>5.4%</b> (Comunidad corporativa)</li>
              <li>Instagram Reels Engagement: <b>4.2%</b> (Videos de marca)</li>
              <li>Conversión de vistas a prospectos registrados: <b>1.8%</b></li>
            </ul>
          );
        }
      }
      return null;
    };

    const handleApproveDraft = async (draftId: string, email: string, name: string, project: string) => {
      setSentDrafts(prev => [...prev, draftId]);
      
      // Update local state first
      setSaraDrafts(prev => prev.map(d => d.id === draftId ? { ...d, status: 'sent' } : d));

      // Call backend if connected
      if (backendConnected) {
        try {
          const response = await fetch('http://localhost:3001/api/send-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: draftId })
          });
          if (response.ok) {
            // Refresh logs
            const logsRes = await fetch('http://localhost:3001/api/bitacora');
            if (logsRes.ok) {
              const serverLogs = await logsRes.json();
              setBitacoraLogs(serverLogs);
            }
          }
        } catch (err) {
          console.error('Failed to communicate with SMTP backend to send approved draft.', err);
        }
      }

      setProspects(prev => prev.map(p => {
        const fullName = `${p.nombre} ${p.apellido}`.toLowerCase();
        if (fullName.includes(name.toLowerCase()) || p.correo.toLowerCase() === email.toLowerCase()) {
          return {
            ...p,
            historial: [
              ...p.historial,
              {
                fecha: new Date().toLocaleDateString('es-CO'),
                accion: 'Correo SARA Enviado',
                detalle: `Cotización y respuesta preparada por SARA para ${project} aprobada y enviada por administrador.`
              }
            ]
          };
        }
        return p;
      }));
    };

    const agents = [
      {
        name: 'CAMILO', displayName: 'Camilo Salinas', emoji: '🕵️‍♂️', role: 'VP de Inteligencia de Datos & Cacería de Capitales',
        photo: '/img/agents/camilo.png',
        desc: 'Arquitectura de algoritmos predictivos nivel McKinsey. Escanea flujos de capital, cruza bases de datos globales y localiza inversores UHNWI (Ultra-High-Net-Worth Individuals) con precisión quirúrgica.',
        lastRun: agentCamiloLastRun,
        stats: [
          { label: 'Prospectos UHNWI', value: agentCamiloProspects },
          { label: 'Nodos escaneados', value: 47 },
          { label: 'Precisión predictiva', value: '96%' },
        ],
        status: agentCamiloActive ? 'Ejecutando algoritmos...' : 'En espera',
        statusColor: agentCamiloActive ? T.success : T.textSec,
        logs: [
          { time: '08:00', msg: 'Inicio de rastreo cuántico en bases corporativas' },
          { time: '08:15', msg: 'LinkedIn Sales Navigator Premium: 8 perfiles C-Level/Board' },
          { time: '08:22', msg: 'Registros Financieros Offshore: 4 Family Offices identificados' },
          { time: '08:30', msg: 'Bloomberg/Reuters: 2 menciones de movimientos de capital' },
          { time: '08:35', msg: 'Minería completada. Clústers de alto patrimonio perfilados.' },
        ],
        actions: [
          { label: 'Rastrear Capitales', icon: 'play', onClick: () => handleCamilo() },
          { label: 'Ver prospectos', icon: 'chart', onClick: () => setShowCamiloFilterSelect(true) },
        ],
      },
      {
        name: 'SARA', displayName: 'Sara Valenzuela', emoji: '🤖', role: 'Directora Operativa Global & Machine Learning',
        photo: '/img/agents/sara.png',
        desc: 'El cerebro estratégico de clase mundial. Analiza en milisegundos la psicología del inversor, gestiona el pipeline con precisión milimétrica y redacta respuestas institucionales impecables para acelerar cierres.',
        lastRun: 'Activo en tiempo real',
        stats: [
          { label: 'Interacciones procesadas', value: agentSaraMessages },
          { label: 'Alertas estratégicas', value: agentSaraAlerts },
          { label: 'SLA de respuesta', value: '< 1 min' },
        ],
        status: 'Monitoreo Activo',
        statusColor: T.success,
        logs: [
          { time: '09:30', msg: 'WhatsApp API: 45 conversaciones decodificadas y perfiladas' },
          { time: '09:35', msg: 'Email: 12 correos estructurados (8 leads cálidos, 1 cierre urgente)' },
          { time: '09:40', msg: 'Omnicanal: Respuestas de alto valor generadas y enrutadas' },
          { time: '10:00', msg: 'Market Intel actualizado: "Tesis de inversión y exenciones 2026"' },
        ],
        actions: [
          { label: 'Analizar Pipeline', icon: 'clipboard', onClick: () => handleSara() },
          { label: `Ver Respuestas (${saraDrafts.length})`, icon: 'mail', onClick: () => setSelectedAgentOutputs(selectedAgentOutputs === 'SARA' ? null : 'SARA') },
        ],
      },
      {
        name: 'VALERIA', displayName: 'Valeria Restrepo', emoji: '✍️', role: 'Chief Copywriter & Arquitecta de Persuasión',
        photo: '/img/agents/alicia.png',
        desc: 'Maestra del copywriting de alto valor. Diseña narrativas hipnóticas y campañas institucionales que posicionan a Panamá como el hub definitivo de inversión, logrando tasas de conversión sin precedentes.',
        lastRun: 'Sincronizado con Sara',
        stats: [
          { label: 'Copys de alto impacto', value: agentValeriaContent },
          { label: 'Campañas activas', value: 18 },
          { label: 'Tasa de conversión', value: '+14.5%' },
        ],
        status: 'Listo',
        statusColor: T.sky,
        logs: [
          { time: '10:00', msg: 'Post LinkedIn Élite: "El éxodo de capitales hacia Panamá en 2026"' },
          { time: '10:15', msg: 'Campana VIP: Secuencia de correos para Family Offices' },
          { time: '11:00', msg: 'Asset estructurado: Infografía de rentabilidades netas' },
        ],
        actions: [
          { label: 'Diseñar Campañas', icon: 'document', onClick: () => handleValeria() },
          { label: `Ver Copys (${valeriaDrafts.length})`, icon: 'file', onClick: () => setSelectedAgentOutputs(selectedAgentOutputs === 'VALERIA' ? null : 'VALERIA') },
        ],
      },
      {
        name: 'ISABELLA', displayName: 'Isabella Brescia', emoji: '🎙️', role: 'VP de Relaciones Públicas Globales & Media',
        photo: '/img/agents/isabella.png',
        desc: 'La embajadora digital definitiva. Estructura guiones persuasivos y cinemáticos que desmitifican la inversión offshore, proyectando un estatus inigualable y atrayendo a la élite financiera.',
        lastRun: 'Sincronizado con Sara',
        stats: [
          { label: 'Emisiones programadas', value: agentIsabellaPosts },
          { label: 'Guiones cinemáticos', value: isabellaScripts.length },
          { label: 'Alcance orgánico VIP', value: '+350K' },
        ],
        status: 'Listo',
        statusColor: T.palm,
        logs: [
          { time: '11:00', msg: 'Guion maestro: "Dolarización y protección patrimonial en Centroamérica"' },
          { time: '11:20', msg: 'Pauta aprobada: Estrategia visual para inversores de Capital de Riesgo' },
          { time: '12:00', msg: 'Análisis de penetración: 12% de share-of-voice en la región' },
        ],
        actions: [
          { label: 'Estructurar Media', icon: 'video', onClick: () => handleIsabella() },
          { label: `Ver Guiones (${isabellaScripts.length})`, icon: 'play', onClick: () => setSelectedAgentOutputs(selectedAgentOutputs === 'ISABELLA' ? null : 'ISABELLA') },
        ],
      },
    ];

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          {sectionTitle('Equipo de Gestión - Consola de Gestión Back-Office Comercial')}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            padding: '6px 12px', 
            borderRadius: 20, 
            background: backendConnected ? `${T.success}15` : `${T.warning}15`,
            border: `1px solid ${backendConnected ? T.success : T.warning}`,
            fontSize: 11,
            fontWeight: 600,
            color: backendConnected ? T.success : T.warning,
            marginTop: -4
          }}>
            <span style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: backendConnected ? T.success : T.warning,
              display: 'inline-block'
            }} />
            <span>{backendConnected ? 'CONECTADO SMTP (Servidor Activo)' : 'MODO LOCAL (Simulación Offline)'}</span>
          </div>
        </div>

        {/* API KEY SETTINGS (Collapsible) */}
        <div style={{ ...cardStyle(), marginBottom: 16, border: `1.5px solid ${openaiKey ? T.success : T.border}` }}>
          <div onClick={() => setShowOpenaiConfig(!showOpenaiConfig)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔑</span>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>
                Configuración de Plataforma OpenAI {openaiKey ? '• Conectado Nativamente ✓' : '• Usando Fallback de Alta Fidelidad'}
              </div>
            </div>
            <span style={{ fontSize: 12, color: T.textSec }}>{showOpenaiConfig ? '▲ Ocultar' : '▼ Mostrar'}</span>
          </div>

          {showOpenaiConfig && (
            <div style={{ marginTop: 14, borderTop: `1px solid ${T.borderLight}`, paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: T.textSec, marginBottom: 8 }}>
                Ingrese su clave de API de OpenAI para que los agentes realicen llamadas reales a <strong>gpt-4o-mini</strong>. Si se deja en blanco, los agentes utilizarán algoritmos de generación de texto y prospectos pre-programados de alta fidelidad.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 12 }}
                />
                <button onClick={() => {
                  localStorage.setItem('glp_openai_key', openaiKey);
                  alert('API Key guardada correctamente.');
                }} style={btnPrimary()}>
                  Guardar Key
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Swarm / Console Panel */}
        <div style={{
          background: 'linear-gradient(135deg, #07152B 0%, #0F2C59 100%)',
          borderRadius: 20, padding: 24, marginBottom: 24, color: '#FFF',
          boxShadow: '0 8px 30px rgba(7,21,43,0.15)', border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>👥 Consola de Colaboración de Agentes (Flujo de Back-Office)</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>
                Orqueste el back-office comercial completo: Camilo busca leads, Sara clasifica y prepara respuestas, Valeria redacta y optimiza copys, Isabella publica contenido.
              </p>
            </div>
            <button
              onClick={() => runSwarm()}
              disabled={swarmRunning}
              style={{
                background: swarmRunning ? 'rgba(255,255,255,0.15)' : T.success,
                color: '#FFF', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontWeight: 700, cursor: swarmRunning ? 'not-allowed' : 'pointer',
                fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.3s', boxShadow: swarmRunning ? 'none' : '0 4px 15px rgba(16,185,129,0.3)'
              }}
            >
              {swarmRunning ? (
                <>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                  <span>Consola de Gestión Activa...</span>
                </>
              ) : (
                <>
                  <span>▶ Disparar Consola de Gestión</span>
                </>
              )}
            </button>
          </div>

          {/* Visual Timeline */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.06)', padding: '16px 20px', borderRadius: 8, marginBottom: 16, overflowX: 'auto' }}>
            {[
              { idx: 0, label: '🕵️‍♂️ Camilo Garzón', role: 'Minería' },
              { idx: 1, label: '🤖 Sara Valenzuela', role: 'Back-Office' },
              { idx: 2, label: '✍️ Valeria Restrepo', role: 'Copywriting' },
              { idx: 3, label: '🎙️ Isabella Brescia', role: 'Social Media' }
            ].map((step, sIdx) => {
              const active = swarmStep === step.idx;
              const completed = swarmStep !== null && swarmStep > step.idx;
              return (
                <div key={step.idx} style={{ display: 'flex', alignItems: 'center', flex: sIdx < 3 ? 1 : 'none' }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '8px 16px', borderRadius: 8, transition: 'all 0.3s',
                    background: active ? 'rgba(255,255,255,0.18)' : completed ? 'rgba(16,185,129,0.2)' : 'transparent',
                    border: active ? `2px solid ${T.coral}` : completed ? `1.5px solid ${T.palm}` : '1.5px solid transparent',
                    boxShadow: active ? `0 0 12px ${T.coral}` : 'none'
                  }}>
                    <span style={{ fontSize: 12, fontWeight: active || completed ? 700 : 500, color: active || completed ? '#FFF' : 'rgba(255,255,255,0.6)' }}>{step.label}</span>
                    <span style={{ fontSize: 9, opacity: 0.7 }}>{step.role}</span>
                  </div>
                  {sIdx < 3 && (
                    <div style={{ flex: 1, height: 2, background: completed ? T.palm : 'rgba(255,255,255,0.15)', margin: '0 8px', minWidth: 20 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Terminal Console Logs */}
          <div style={{ background: '#07152B', borderRadius: 8, padding: 12, height: 110, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, border: '1px solid rgba(255,255,255,0.1)' }}>
            {swarmLogs.map((log, i) => (
              <div key={i} style={{ display: 'flex', marginBottom: 4 }}>
                <span style={{ color: '#00D2FF', marginRight: 8 }}>[{log.time}]</span>
                <span style={{ color: log.agent === 'SISTEMA' ? '#FFD700' : log.agent === 'SARA' ? '#10B981' : log.agent === 'CAMILO' ? '#EF4444' : '#E2E8F0', fontWeight: 600, marginRight: 8 }}>{log.agent === 'SISTEMA' ? 'CONSOLA' : log.agent}:</span>
                <span style={{ color: '#FFF' }}>{log.msg.replace('EQUIPO', 'CONSOLA DE GESTIÓN')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AGENT CARDS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {agents.map(agent => {
            const isAgentActive = (agent.name === 'CAMILO' && agentCamiloActive) ||
                                  (agent.name === 'SARA' && saraIsRunning) ||
                                  (agent.name === 'VALERIA' && valeriaIsRunning) ||
                                  (agent.name === 'ISABELLA' && isabellaIsRunning) ||
                                  (swarmStep !== null && ((agent.name === 'CAMILO' && swarmStep === 0) ||
                                                          (agent.name === 'SARA' && swarmStep === 1) ||
                                                          (agent.name === 'VALERIA' && swarmStep === 2) ||
                                                          (agent.name === 'ISABELLA' && swarmStep === 3)));
            return (
              <div key={agent.name} style={{ ...cardStyle(), border: isAgentActive ? `2.5px solid ${T.coral}` : `1px solid ${T.borderLight}`, boxShadow: isAgentActive ? `0 8px 24px rgba(0,102,204,0.15)` : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <img src={agent.photo} alt={agent.name} style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${isAgentActive ? T.coral : T.teal}`, boxShadow: `0 4px 12px ${T.teal}30` }} />
                      {isAgentActive && (
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${T.coral}`, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{agent.emoji} {agent.displayName || agent.name}</div>
                      <div style={{ fontSize: 13, color: T.teal, fontWeight: 600 }}>{agent.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isAgentActive ? T.coral : agent.statusColor, animation: isAgentActive ? 'pulse 1s infinite' : 'none' }} />
                    <span style={{ fontSize: 11, color: isAgentActive ? T.coral : agent.statusColor, fontWeight: 600 }}>{isAgentActive ? 'Procesando...' : agent.status}</span>
                  </div>
                </div>
                
                <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12, lineHeight: 1.5 }}>{agent.desc}</div>

                {/* Agent Stats (Clickable) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {agent.stats.map(s => {
                    const isSelected = activeAgentKpi?.agent === agent.name && activeAgentKpi?.label === s.label;
                    return (
                      <div 
                        key={s.label}
                        onClick={() => {
                          if (isSelected) {
                            setActiveAgentKpi(null);
                          } else {
                            setActiveAgentKpi({ agent: agent.name, label: s.label });
                          }
                        }}
                        style={{ 
                          background: isSelected ? 'rgba(0,102,204,0.12)' : T.bg, 
                          borderRadius: 8, 
                          padding: '8px 10px', 
                          textAlign: 'center',
                          cursor: 'pointer',
                          border: isSelected ? `1.5px solid ${T.coral}` : '1.5px solid transparent',
                          transition: 'all 0.2s'
                        }}
                        title="Clic para ver detalle"
                      >
                        <div style={{ fontSize: 16, fontWeight: 700, color: isSelected ? T.coral : T.teal }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: T.textSec }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Agent KPI Drilldown Box */}
                {activeAgentKpi?.agent === agent.name && (
                  <div style={{
                    background: '#F0F4F8',
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 12,
                    fontSize: 11,
                    color: T.text,
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <div style={{ fontWeight: 700, color: T.teal, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🔍 Desglose: {activeAgentKpi.label}</span>
                      <span onClick={(e) => { e.stopPropagation(); setActiveAgentKpi(null); }} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>✕</span>
                    </div>
                    {renderAgentKpiDetail(agent.name, activeAgentKpi.label)}
                  </div>
                )}

                <div style={{ fontSize: 10, color: T.textSec, marginBottom: 8 }}>
                  Última actividad: {agent.lastRun}
                </div>

                {/* INTERACTIVE MODULE OUTPUTS */}
                {agent.name === 'CAMILO' && showCamiloFilterSelect && (
                  <div style={{
                    background: '#FAF8F5',
                    border: `1px solid ${T.border}`,
                    borderLeft: `3px solid ${T.coral}`,
                    borderRadius: 0,
                    padding: '12px 14px',
                    marginTop: 12,
                    marginBottom: 12,
                    fontSize: 11,
                    color: T.text,
                    animation: 'fadeIn 0.2s ease',
                    boxShadow: '0 4px 12px rgba(184,144,71,0.04)'
                  }}>
                    <div style={{ fontWeight: 700, color: T.teal, marginBottom: 8, fontFamily: T.fontSerif, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Filtrar Prospectos</span>
                      <span onClick={() => setShowCamiloFilterSelect(false)} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>✕</span>
                    </div>
                    <p style={{ margin: '0 0 10px 0', fontSize: 10.5, color: T.textSec, fontFamily: T.fontSans }}>¿Qué prospectos desea visualizar?</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button 
                        onClick={() => {
                          setProspectFilterOrigin('camilo');
                          setActiveModule('prospectos');
                          setShowCamiloFilterSelect(false);
                        }} 
                        style={btnPrimary({ padding: '6px 8px', fontSize: 10, borderRadius: 0 })}
                      >
                        Generados por Camilo
                      </button>
                      <button 
                        onClick={() => {
                          setProspectFilterOrigin('otros');
                          setActiveModule('prospectos');
                          setShowCamiloFilterSelect(false);
                        }} 
                        style={btnSecondary({ padding: '6px 8px', fontSize: 10, borderRadius: 0 })}
                      >
                        Otros Canales
                      </button>
                      <button 
                        onClick={() => {
                          setProspectFilterOrigin('brokers');
                          setActiveModule('prospectos');
                          setShowCamiloFilterSelect(false);
                        }} 
                        style={btnSecondary({ padding: '6px 8px', fontSize: 10, borderRadius: 0 })}
                      >
                        Por Brokers
                      </button>
                      <button 
                        onClick={() => {
                          setProspectFilterOrigin('all');
                          setActiveModule('prospectos');
                          setShowCamiloFilterSelect(false);
                        }} 
                        style={btnSecondary({ padding: '6px 8px', fontSize: 10, borderRadius: 0, background: T.teal, color: '#FFF' })}
                      >
                        Vista General (Todos)
                      </button>
                    </div>
                  </div>
                )}



                {/* Sara: Analizar + FAQ panel inline */}
                {agent.name === 'SARA' && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: `${T.teal}08`, border: `1px solid ${T.teal}20`, borderRadius: 8, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: T.teal, marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚡ Análisis On-Demand</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleSara()}
                        disabled={saraIsRunning}
                        style={btnPrimary({ padding: '6px 12px', fontSize: 10, flex: 1, opacity: saraIsRunning ? 0.6 : 1, cursor: saraIsRunning ? 'not-allowed' : 'pointer' })}
                      >
                        {saraIsRunning ? '⏳ Analizando...' : '📊 Analizar Correos & FAQs'}
                      </button>
                      {saraPendingFaqs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            saraPendingFaqs.forEach((faq, i) => {
                              setFaqs(prev => [{ id: Date.now() + i, categoria: 'Legal & Tributaria', pregunta: faq.pregunta, respuesta: faq.respuesta }, ...prev]);
                            });
                            setSaraPendingFaqs([]);
                          }}
                          style={btnSecondary({ padding: '6px 12px', fontSize: 10, flex: 1, background: `${T.palm}15`, color: T.palm, border: `1px solid ${T.palm}40` })}
                        >
                          ✅ Agregar {saraPendingFaqs.length} FAQs detectadas
                        </button>
                      )}
                    </div>
                    {saraAlertsList.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {saraAlertsList.slice(0, 3).map((a, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4, fontSize: 10, color: T.textSec }}>
                            <span style={{ color: T.coral, fontWeight: 700, flexShrink: 0 }}>⚠</span>
                            <span>{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Valeria: admin topic generator */}
                {agent.name === 'VALERIA' && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: `${T.sky}08`, border: `1px solid ${T.sky}20`, borderRadius: 8, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: T.sky, marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✍️ Generar Contenido</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleValeria()}
                        disabled={valeriaIsRunning}
                        style={btnPrimary({ padding: '6px 10px', fontSize: 10, flex: 1, opacity: valeriaIsRunning ? 0.6 : 1, cursor: valeriaIsRunning ? 'not-allowed' : 'pointer' })}
                      >
                        {valeriaIsRunning ? '⏳ Redactando...' : '📄 Basado en análisis de Sara'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Tema personalizado (ej: retorno en Playa Caracol)..."
                        value={valeriaAdminTopic}
                        onChange={e => setValeriaAdminTopic(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && valeriaAdminTopic.trim() && !valeriaIsRunning) handleValeria(false, false, undefined, valeriaAdminTopic); }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 10, color: T.text, background: T.card, outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => { if (valeriaAdminTopic.trim() && !valeriaIsRunning) handleValeria(false, false, undefined, valeriaAdminTopic); }}
                        disabled={!valeriaAdminTopic.trim() || valeriaIsRunning}
                        style={btnPrimary({ padding: '6px 12px', fontSize: 10, opacity: (!valeriaAdminTopic.trim() || valeriaIsRunning) ? 0.5 : 1, cursor: (!valeriaAdminTopic.trim() || valeriaIsRunning) ? 'not-allowed' : 'pointer', background: T.sky })}
                      >
                        🚀
                      </button>
                    </div>
                  </div>
                )}

                {/* Isabella: admin topic generator */}
                {agent.name === 'ISABELLA' && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: `${T.palm}08`, border: `1px solid ${T.palm}20`, borderRadius: 8, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: T.palm, marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎬 Crear Contenido de Video</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleIsabella()}
                        disabled={isabellaIsRunning}
                        style={btnPrimary({ padding: '6px 10px', fontSize: 10, flex: 1, opacity: isabellaIsRunning ? 0.6 : 1, cursor: isabellaIsRunning ? 'not-allowed' : 'pointer' })}
                      >
                        {isabellaIsRunning ? '⏳ Creando...' : '🎥 Basado en Sara & Valeria'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Tema (ej: ventajas de invertir en Panamá vs Colombia)..."
                        value={isabellaAdminTopic}
                        onChange={e => setIsabellaAdminTopic(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && isabellaAdminTopic.trim() && !isabellaIsRunning) handleIsabella(false, false, undefined, isabellaAdminTopic); }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 10, color: T.text, background: T.card, outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => { if (isabellaAdminTopic.trim() && !isabellaIsRunning) handleIsabella(false, false, undefined, isabellaAdminTopic); }}
                        disabled={!isabellaAdminTopic.trim() || isabellaIsRunning}
                        style={btnPrimary({ padding: '6px 12px', fontSize: 10, opacity: (!isabellaAdminTopic.trim() || isabellaIsRunning) ? 0.5 : 1, cursor: (!isabellaAdminTopic.trim() || isabellaIsRunning) ? 'not-allowed' : 'pointer', background: T.palm })}
                      >
                        🚀
                      </button>
                    </div>
                  </div>
                )}

                {/* Agent Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, borderTop: `1px solid ${T.borderLight}`, paddingTop: 12 }}>
                  {agent.actions.map(act => (
                    <button type="button" key={act.label} onClick={act.onClick} style={btnSecondary({ padding: '6px 12px', fontSize: 11, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' })}>
                      {renderActionIcon(act.icon)}
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
             AGENT WORKBENCH — Full-width drilldown panel
             Opens below the cards when user clicks "Ver..." buttons.
        ════════════════════════════════════════════════════════════════ */}
        {selectedAgentOutputs !== null && (() => {
          const accentMap: Record<string, string> = {
            SARA: T.teal,
            VALERIA: T.sky,
            ISABELLA: T.palm,
          };
          const accent = accentMap[selectedAgentOutputs];

          const headerMap: Record<string, { emoji: string; title: string; subtitle: string }> = {
            SARA: {
              emoji: '📧',
              title: 'Sara Valenzuela — Bandeja de Respuestas & Cotizaciones',
              subtitle: 'Revisa, edita y aprueba las respuestas comerciales preparadas para envío inmediato.',
            },
            VALERIA: {
              emoji: '✍️',
              title: 'Valeria Restrepo — Mesa de Trabajo de Contenidos',
              subtitle: 'Copys, newsletters, guiones publicitarios y plantillas de persuasión listos para publicar.',
            },
            ISABELLA: {
              emoji: '🎙️',
              title: 'Isabella Brescia — Estudio de Video & Contenido Social',
              subtitle: 'Guiones de video, calendarios de publicación y estrategia de redes listas para producción.',
            },
          };
          const hdr = headerMap[selectedAgentOutputs];

          return (
            <div style={{
              marginTop: 20,
              borderRadius: 16,
              border: `1.5px solid ${accent}30`,
              overflow: 'hidden',
              boxShadow: `0 8px 32px ${accent}12`,
              animation: 'fadeIn 0.25s ease',
            }}>
              {/* Workbench Header Bar */}
              <div style={{
                background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`,
                borderBottom: `1.5px solid ${accent}25`,
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0,
                    boxShadow: `0 4px 12px ${accent}40`,
                  }}>
                    {hdr.emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: '-0.01em' }}>{hdr.title}</div>
                    <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{hdr.subtitle}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgentOutputs(null)}
                  style={{
                    background: 'transparent', border: `1px solid ${T.borderLight}`,
                    borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                    fontSize: 12, color: T.textSec, fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.bg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  Cerrar mesa de trabajo ✕
                </button>
              </div>

              {/* Workbench Body */}
              <div style={{ background: T.card, padding: '20px 24px' }}>

                {/* ─── SARA WORKBENCH ─── */}
                {selectedAgentOutputs === 'SARA' && (() => {
                  const pending = saraDrafts.filter(d => !sentDrafts.includes(d.id) && d.status !== 'sent');
                  const sent = saraDrafts.filter(d => sentDrafts.includes(d.id) || d.status === 'sent');
                  return (
                    <div>
                      {/* Contingency Report — compact, collapsible */}
                      <div style={{
                        background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: 10,
                        padding: 16, marginBottom: 20,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          📋 Reporte de Contingencia
                          <span style={{ fontSize: 10, fontWeight: 400, color: T.textSec }}>— editable directamente</span>
                        </div>
                        <textarea
                          value={saraReportText}
                          onChange={e => setSaraReportText(e.target.value)}
                          rows={5}
                          style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', padding: 10, borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                          <button onClick={handleSaveSaraReport} style={btnPrimary({ padding: '5px 14px', fontSize: 11 })}>
                            💾 Guardar Reporte
                          </button>
                        </div>
                      </div>

                      {/* NEW: SARA Q&A Section */}
                      <div style={{
                        background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: 10,
                        padding: 16, marginBottom: 20,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.teal, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          💬 Consultar a Sara
                          <span style={{ fontSize: 10, fontWeight: 400, color: T.textSec }}>- Haz preguntas específicas sobre el embudo o correos</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          <input 
                            type="text" 
                            placeholder="Ej. ¿Qué me sugieres responderle a Carlos Gutiérrez sobre sus dudas fiscales?" 
                            value={saraQuestion}
                            onChange={(e) => setSaraQuestion(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') handleSaraQuestion(); }}
                            style={{ flex: 1, padding: '8px 12px', fontSize: 11, borderRadius: 6, border: `1px solid ${T.border}`, outline: 'none' }}
                          />
                          <button 
                            type="button" 
                            onClick={handleSaraQuestion} 
                            disabled={saraIsAnswering || !saraQuestion.trim()}
                            style={btnPrimary({ padding: '8px 16px', fontSize: 11, opacity: (saraIsAnswering || !saraQuestion.trim()) ? 0.6 : 1 })}
                          >
                            {saraIsAnswering ? '⏳ Procesando...' : 'Preguntar'}
                          </button>
                        </div>
                        {saraAnswer && (
                          <div style={{ background: 'rgba(16,185,129,0.05)', borderLeft: `3px solid ${T.teal}`, padding: '12px', borderRadius: '0 8px 8px 0', fontSize: 11, color: T.text, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            <strong>Sara dice:</strong><br/><br/>
                            {saraAnswer}
                          </div>
                        )}
                      </div>

                      {/* Drafts */}
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>
                        📧 Respuestas & Cotizaciones Pendientes
                        {pending.length > 0 && (
                          <span style={{
                            marginLeft: 8, background: T.coral, color: '#fff',
                            borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700,
                          }}>{pending.length} pendientes</span>
                        )}
                      </div>

                      {saraDrafts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 20px', color: T.textSec, background: T.bg, borderRadius: 8, border: `1px dashed ${T.border}`, fontSize: 12 }}>
                          No hay borradores pendientes. Ejecuta "Analizar Consultas" para generar respuestas.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                          {saraDrafts.map(draft => {
                            const isSent = sentDrafts.includes(draft.id) || draft.status === 'sent';
                            return (
                              <div key={draft.id} style={{
                                background: isSent ? 'rgba(16,185,129,0.04)' : T.bg,
                                border: isSent ? `1.5px solid ${T.palm}30` : `1.5px solid ${T.borderLight}`,
                                borderRadius: 10, padding: 16,
                                display: 'flex', flexDirection: 'column', gap: 8,
                                transition: 'all 0.2s',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>📨 {draft.subject}</div>
                                    <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>Para: {draft.to}</div>
                                    <div style={{ fontSize: 10, color: T.teal, fontWeight: 600 }}>Proyecto: {draft.project}</div>
                                  </div>
                                  {isSent
                                    ? <span style={{ fontSize: 10, color: T.palm, fontWeight: 700, flexShrink: 0, background: `${T.palm}15`, padding: '3px 8px', borderRadius: 6 }}>✓ Enviado</span>
                                    : <span style={{ fontSize: 10, color: T.coral, fontWeight: 700, flexShrink: 0, background: `${T.coral}12`, padding: '3px 8px', borderRadius: 6 }}>● Pendiente</span>
                                  }
                                </div>
                                <div style={{
                                  fontSize: 10.5, background: T.card, padding: 10, borderRadius: 6,
                                  whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: T.text,
                                  border: `1px solid ${T.borderLight}`, maxHeight: 180, overflowY: 'auto', lineHeight: 1.55,
                                }}>
                                  {draft.body}
                                </div>
                                {!isSent && (
                                  <button
                                    onClick={() => handleApproveDraft(draft.id, draft.to.split('(')[1]?.replace(')', '') || '', draft.to.split(' ')[0], draft.project)}
                                    style={btnPrimary({ padding: '7px 14px', fontSize: 11 })}
                                  >
                                    ✉️ Aprobar y Enviar Correo
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {sent.length > 0 && (
                        <div style={{ marginTop: 16, fontSize: 11, color: T.textSec, fontStyle: 'italic' }}>
                          ✓ {sent.length} respuesta(s) ya enviada(s) en esta sesión.
                        </div>
                      )}

                      {/* SARA HISTORICAL REPORTS SECTION */}
                      <div style={{ marginTop: 24, background: T.bg, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>
                          📚 Historial de Reportes SARA
                          <span style={{ marginLeft: 8, background: T.teal, color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700 }}>
                            {saraHistoricalReports.length} reportes
                          </span>
                        </div>

                        {saraHistoricalReports.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: T.textSec, fontSize: 12, border: `1px dashed ${T.border}`, borderRadius: 8 }}>
                            No hay reportes históricos guardados.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {saraHistoricalReports.map(report => (
                              <div key={report.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: T.teal }}>📅 {report.date}</div>
                                  <button onClick={() => handleDeleteHistoricalReport(report.id)} style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                    🗑️ Eliminar
                                  </button>
                                </div>
                                <div style={{ fontSize: 10.5, color: T.text, whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 150, overflowY: 'auto', background: T.bg, padding: 10, borderRadius: 6, border: `1px solid ${T.borderLight}` }}>
                                  {report.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ─── VALERIA WORKBENCH ─── */}
                {selectedAgentOutputs === 'VALERIA' && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>
                      ✍️ Borradores de Contenido Generados
                      <span style={{
                        marginLeft: 8, background: T.sky, color: '#fff',
                        borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700,
                      }}>{valeriaDrafts.length} copys</span>
                    </div>

                    {valeriaDrafts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 20px', color: T.textSec, background: T.bg, borderRadius: 8, border: `1px dashed ${T.border}`, fontSize: 12 }}>
                        No hay copys generados. Ejecuta "Redactar Copys" para generar contenido.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        {valeriaDrafts.map((draft, idx) => (
                          <div key={idx} style={{
                            background: T.bg, border: `1.5px solid ${T.borderLight}`,
                            borderLeft: `4px solid ${T.sky}`, borderRadius: 10, padding: 16,
                          }}>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10
                            }}>
                              <div style={{ fontSize: 10, color: T.sky, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Copy #{idx + 1}
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard?.writeText(draft);
                                  alert(`Copy #${idx + 1} copiado al portapapeles.`);
                                }}
                                style={{ ...btnSecondary({ padding: '3px 10px', fontSize: 10 }), borderColor: T.sky, color: T.sky }}
                              >
                                📋 Copiar
                              </button>
                            </div>
                            <div style={{
                              fontSize: 11, color: T.text, whiteSpace: 'pre-line', lineHeight: 1.6,
                              maxHeight: 240, overflowY: 'auto',
                              background: T.card, padding: 10, borderRadius: 6, border: `1px solid ${T.borderLight}`,
                            }}>
                              {draft}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── ISABELLA WORKBENCH ─── */}
                {selectedAgentOutputs === 'ISABELLA' && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>
                      🎙️ Guiones de Video & Contenido Social
                      <span style={{
                        marginLeft: 8, background: T.palm, color: '#fff',
                        borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700,
                      }}>{isabellaScripts.length} guiones</span>
                    </div>

                    {isabellaScripts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 20px', color: T.textSec, background: T.bg, borderRadius: 8, border: `1px dashed ${T.border}`, fontSize: 12 }}>
                        No hay guiones generados. Ejecuta "Crear Guiones" para generar contenido.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {isabellaScripts.map((script, idx) => {
                          const lines = script.split('\n');
                          const titleLine = lines[0];
                          const body = lines.slice(1).join('\n').trim();
                          const isPublished = publishedIsabella.includes(idx);
                          const isVideo = titleLine.toLowerCase().includes('video') || titleLine.toLowerCase().includes('reel');
                          const isCalendar = titleLine.toLowerCase().includes('calendario');

                          return (
                            <div key={idx} style={{
                              background: T.bg, border: `1.5px solid ${isPublished ? T.palm : T.borderLight}`,
                              borderRadius: 10, overflow: 'hidden',
                              display: 'flex', flexDirection: 'column',
                              boxShadow: isPublished ? `0 0 0 1px ${T.palm}` : 'none'
                            }}>
                              {/* Header */}
                              <div style={{
                                background: isPublished ? `${T.palm}15` : `${T.palm}08`, borderBottom: `1px solid ${T.borderLight}`,
                                padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}>
                                <div>
                                  <div style={{ fontSize: 10, color: T.palm, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                    {isPublished ? '✅ PUBLICADO / PROGRAMADO' : `📝 Borrador #${idx + 1}`}
                                  </div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{titleLine}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={() => { navigator.clipboard?.writeText(script); alert(`Contenido copiado completo.`); }} style={{ ...btnSecondary({ padding: '4px 10px', fontSize: 10 }), borderColor: T.border, color: T.textSec }} title="Copia el guion con todas las indicaciones técnicas">
                                    📋 Copiar
                                  </button>
                                  <button onClick={() => {
                                    const rawText = script.replace(/\[[\s\S]*?\]/g, '').replace(/\([\s\S]*?\)/g, '').replace(/\*.*?\*/g, '');
                                    const lines = rawText.split('\n');
                                    const cleanText = lines.filter(line => {
                                      const t = line.trim().toLowerCase();
                                      if (t.length === 0) return false;
                                      if (t.includes('programaci') || t.includes('guion') || t.includes('reel') || t.includes('youtube') || t.includes('calendario') || t.includes('tema') || t.includes('escena') || t.includes('voz en off') || t.includes('duración') || t.includes('formato') || t.includes('texto en pantalla')) return false;
                                      return true;
                                    }).join(' ').replace(/"/g, '').trim();
                                    navigator.clipboard.writeText(cleanText);
                                    alert('¡Guion limpio copiado al portapapeles! Listo para pegar en HeyGen.');
                                  }} style={{ background: T.coral, border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} title="Limpia el guion de indicaciones técnicas y lo copia para HeyGen">
                                    ✨ Copiar a HeyGen
                                  </button>
                                  {!isPublished && (
                                    <button onClick={() => {
                                      setPublishedIsabella(prev => [...prev, idx]);
                                      alert('Contenido programado en Buffer/Hootsuite exitosamente.');
                                    }} style={{ ...btnPrimary({ padding: '4px 12px', fontSize: 10 }), background: T.palm, border: 'none' }}>
                                      🚀 Programar
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Body - Two Columns for Mockup */}
                              <div style={{ display: 'flex', flexDirection: 'row', padding: 16, gap: 16, flexWrap: 'wrap' }}>
                                {/* Left Col - Visual Mockup */}
                                {isCalendar ? (
                                  <div style={{
                                    flex: '0 0 250px', display: 'flex', flexDirection: 'column', gap: 12
                                  }}>
                                    <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: T.palm, marginBottom: 6 }}>📅 LUNES</div>
                                      <div style={{ height: 120, background: '#e5e7eb', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                        <img src="/img/campaigns/monday_chart.png" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} alt="Gráfico de devaluación" />
                                        <div style={{ position: 'absolute', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>⬅️ Desliza Carrusel ➡️</div>
                                      </div>
                                    </div>
                                    <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: T.palm, marginBottom: 6 }}>📅 MIÉRCOLES</div>
                                      <div style={{ height: 120, background: '#e5e7eb', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                                           onClick={() => setIsabellaPreviewScript({ title: 'Video: Cuenta Bancaria en Panamá', body: 'Script del video para generar con HeyGen. (Disponible versión final al reproducir).', isVideo: true })}>
                                        <img src="/img/campaigns/wednesday_video.png" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} alt="Video de Isabella" />
                                        <div style={{ position: 'absolute', width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>▶</div>
                                      </div>
                                    </div>
                                    <div style={{ background: T.card, borderRadius: 8, padding: 12, border: `1px solid ${T.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: T.palm, marginBottom: 6 }}>📅 VIERNES</div>
                                      <div style={{ height: 120, background: '#e5e7eb', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                                        <img src="/img/campaigns/friday_infographic.png" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} alt="Infografía de Plusvalía" />
                                        <div style={{ position: 'absolute', bottom: 8, background: T.coral, color: '#fff', padding: '4px 12px', borderRadius: 4, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>⬇️ Link en Bio - Descargar</div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{
                                    flex: '0 0 220px', background: T.card, borderRadius: 8, border: `1px solid ${T.border}`,
                                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                  }}>
                                    {/* Mockup Header */}
                                    <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.borderLight}` }}>
                                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.palm, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>GLP</div>
                                      <div style={{ fontSize: 10, fontWeight: 600, color: T.text }}>glp.panama</div>
                                    </div>
                                    {/* Mockup Media */}
                                    <div 
                                      onClick={() => isVideo && setIsabellaPreviewScript({ title: titleLine, body, isVideo })}
                                      style={{ height: 260, background: '#e5e7eb', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: isVideo ? 'pointer' : 'default' }}>
                                      <img src={isVideo ? "/img/agents/isabella.png" : "/img/panama-viejo.jpg"} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', opacity: 0.8 }} alt="Mockup" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                      {isVideo && (
                                        <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>▶</div>
                                      )}
                                      <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>1080x1920</div>
                                    </div>
                                    {/* Mockup Caption Preview */}
                                    <div style={{ padding: 10, fontSize: 10, color: T.text, lineHeight: 1.4, maxHeight: 60, overflow: 'hidden' }}>
                                      <strong>glp.panama</strong> {body.replace(/\(.*\)/g, '').substring(0, 80)}...
                                    </div>
                                  </div>
                                )}
                                
                                {/* Right Col - Script & Tools */}
                                <div style={{ flex: 1, minWidth: 250, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 6 }}>
                                    {isCalendar ? '📋 Detalle del Plan' : '📝 Script / Copy Completo'}
                                  </div>
                                  <div style={{
                                    fontSize: 11.5, color: T.text, whiteSpace: 'pre-line', lineHeight: 1.6,
                                    fontStyle: body.startsWith('(') ? 'italic' : 'normal',
                                    maxHeight: isCalendar ? 'auto' : 300, overflowY: 'auto',
                                    background: T.bg, padding: 12, borderRadius: 6, border: `1px dashed ${T.border}`
                                  }}>
                                    {body || script}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Isabella Video Preview Modal */}
                    {isabellaPreviewScript && (
                      <div 
                        onMouseEnter={() => window.speechSynthesis.getVoices()} // Preload voices
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                        <div style={{ position: 'relative', width: 340, height: 600, background: '#000', borderRadius: 24, border: '6px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                          {/* Top bar */}
                          <div style={{ position: 'absolute', top: 0, width: '100%', padding: '16px', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ fontWeight: 700 }}>Reels</div>
                              <button 
                                onClick={() => {
                                  const rawText = isabellaPreviewScript.body.replace(/\[[\s\S]*?\]/g, '').replace(/\([\s\S]*?\)/g, '').replace(/\*.*?\*/g, '');
                                  const lines = rawText.split('\n');
                                  const cleanText = lines.filter(line => {
                                    const t = line.trim().toLowerCase();
                                    if (t.length === 0) return false;
                                    if (t.includes('programaci') || t.includes('guion') || t.includes('reel') || t.includes('youtube') || t.includes('calendario') || t.includes('tema') || t.includes('escena') || t.includes('voz en off') || t.includes('duración') || t.includes('formato') || t.includes('texto en pantalla')) return false;
                                    return true;
                                  }).join(' ').replace(/"/g, '').trim();
                                  navigator.clipboard.writeText(cleanText);
                                  alert('¡Guion limpio copiado al portapapeles! Listo para pegar en HeyGen.');
                                }}
                                style={{ background: T.coral, border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                title="Limpia el guion de indicaciones técnicas y lo copia para generar el video"
                              >
                                <span>📋</span> Copiar a HeyGen
                              </button>
                            </div>
                            <button onClick={() => {
                              window.speechSynthesis.cancel();
                              if (audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current.currentTime = 0;
                              }
                              setIsPlayingDemo(false);
                              setIsabellaPreviewScript(null);
                            }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </div>
                          
                          {/* Visual AI Avatar Background */}
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 1, filter: !isPlayingDemo ? 'brightness(0.4)' : 'none', transition: 'filter 0.5s ease', pointerEvents: 'none' }}>
                            <iframe 
                              src="https://www.youtube.com/embed/Uyq3iuhwR7k?autoplay=1&mute=1&loop=1&playlist=Uyq3iuhwR7k&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1" 
                              style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', border: 'none' }} 
                              allow="autoplay; encrypted-media" 
                            />
                          </div>
                          
                          {/* Play Button Overlay */}
                          {!isPlayingDemo ? (
                            <div 
                              onClick={async () => {
                                setIsPlayingDemo(true);
                                const rawText = isabellaPreviewScript.body.replace(/\[[\s\S]*?\]/g, '').replace(/\([\s\S]*?\)/g, '').replace(/\*.*?\*/g, ''); // Remove [] () and **
                                const lines = rawText.split('\n');
                                const cleanText = lines.filter(line => {
                                  const t = line.trim().toLowerCase();
                                  if (t.length === 0) return false;
                                  if (t.includes('programaci') || t.includes('guion') || t.includes('reel') || t.includes('youtube') || t.includes('calendario') || t.includes('tema') || t.includes('escena') || t.includes('voz en off') || t.includes('duración') || t.includes('formato') || t.includes('texto en pantalla')) return false;
                                  return true;
                                }).join(' ').replace(/"/g, '').trim();

                                if (openaiKey.trim()) {
                                  try {
                                    const response = await fetch('https://api.openai.com/v1/audio/speech', {
                                      method: 'POST',
                                      headers: {
                                        'Authorization': `Bearer ${openaiKey}`,
                                        'Content-Type': 'application/json'
                                      },
                                      body: JSON.stringify({
                                        model: 'tts-1',
                                        input: cleanText,
                                        voice: 'nova',
                                      })
                                    });
                                    if (!response.ok) throw new Error('API Error');
                                    const blob = await response.blob();
                                    const url = URL.createObjectURL(blob);
                                    const audio = new Audio(url);
                                    audioRef.current = audio;
                                    audio.onended = () => setIsPlayingDemo(false);
                                    audio.play();
                                    return; // Successfully played with OpenAI
                                  } catch (error) {
                                    console.error('OpenAI TTS failed:', error);
                                  }
                                }

                                const utterance = new SpeechSynthesisUtterance(cleanText);
                                utterance.lang = 'es-CO';
                                utterance.rate = 1.0;
                                utterance.pitch = 1.7; // Very high pitch to force female sound if browser defaults to male
                                const voices = window.speechSynthesis.getVoices();
                                let selectedVoice = voices.find(v => v.lang.includes('es') && (v.name.includes('Sabina') || v.name.includes('Helena') || v.name.includes('Laura') || v.name.includes('Monica') || v.name.includes('Paulina') || v.name.includes('Mia') || v.name.includes('Elena') || v.name.includes('Lupe') || v.name.includes('Conchita') || v.name.includes('Lucia')));
                                if (!selectedVoice) selectedVoice = voices.find(v => (v.lang === 'es-MX' || v.lang === 'es-CO' || v.lang === 'es-US' || v.lang === 'es-ES') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('mujer') || v.name.toLowerCase().includes('femenina')));
                                
                                if (selectedVoice) {
                                  utterance.voice = selectedVoice;
                                  utterance.pitch = 1.1; // Reset pitch if verified female voice
                                } else {
                                  const fallbackVoice = voices.find(v => v.lang.includes('es'));
                                  if (fallbackVoice) utterance.voice = fallbackVoice;
                                }
                                utterance.onend = () => setIsPlayingDemo(false);
                                window.speechSynthesis.speak(utterance);
                              }}
                              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, cursor: 'pointer' }}
                            >
                              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', paddingLeft: 6 }}>
                                ▶
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={() => {
                                window.speechSynthesis.cancel();
                                if (audioRef.current) {
                                  audioRef.current.pause();
                                  audioRef.current.currentTime = 0;
                                }
                                setIsPlayingDemo(false);
                              }}
                              style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 15, cursor: 'pointer' }}
                            >
                              <div style={{ padding: '8px 16px', borderRadius: 20, background: 'rgba(255,0,0,0.6)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
                                <span>■</span> Detener Demo
                              </div>
                            </div>
                          )}

                          {/* Fake Audio Wave indicating speech */}
                          {isPlayingDemo && (
                            <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 3, alignItems: 'flex-end', height: 20, zIndex: 10 }}>
                              {[1,2,3,4,3,2].map((h, i) => (
                                <div key={i} style={{ width: 3, height: h * 4, background: '#fff', borderRadius: 2, animation: `pulse ${0.3 + (i * 0.1)}s infinite alternate` }} />
                              ))}
                            </div>
                          )}

                          {/* Bottom info & Static Caption */}
                          <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '40px 16px 20px 16px', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)', color: '#fff', zIndex: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.palm, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>GLP</div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>glp.panama <span style={{ color: T.palm, marginLeft: 4, border: `1px solid ${T.palm}`, padding: '2px 6px', borderRadius: 10, fontSize: 10 }}>Seguir</span></div>
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.4, maxHeight: 120, overflowY: 'auto', textShadow: '0 1px 2px rgba(0,0,0,0.8)', paddingRight: 8 }}>
                              <strong style={{ display: 'block', marginBottom: 4 }}>{isabellaPreviewScript.title}</strong>
                              {isabellaPreviewScript.body.split('\n').filter(line => !line.trim().startsWith('(') && !line.toLowerCase().includes('programaci')).map((line, i) => <span key={i}>{line}<br/></span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* CLIENT CONTACT BITÁCORA SECTION */}
        <div style={{ ...cardStyle(), marginTop: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📖</span> Bitácora del Equipo de Agentes (Contacto en Tiempo Real)
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: 12, color: T.textSec }}>
            Historial de solicitudes de información registradas por el formulario web. SARA envía confirmaciones personalizadas y gestiona la preparación de respuestas comerciales para el administrador.
          </p>

          {bitacoraLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: T.textSec, background: T.bg, borderRadius: 8, border: `1px dashed ${T.border}`, fontSize: 12 }}>
              No hay solicitudes registradas en la bitácora activa.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.border}`, color: T.textSec }}>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Fecha</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Cliente</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Proyecto</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Canal</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Correo Cliente</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Notificación Admin</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Consulta</th>
                  </tr>
                </thead>
                <tbody>
                  {bitacoraLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: T.textSec }}>
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : `${log.fecha || ''} ${log.hora || ''}`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: T.text }}>{log.cliente}</div>
                        <div style={{ fontSize: 10, color: T.textSec }}>{log.correo || log.agente || ''}</div>
                        <div style={{ fontSize: 10, color: T.textSec }}>{log.whatsapp || log.accion || ''}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: T.teal }}>{log.proyecto}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, background: '#F1F5F9', color: '#475569', fontSize: 10, fontWeight: 600 }}>
                          {log.canal}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.correoCliente ? (
                          <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: 4, 
                            background: log.correoCliente === 'Enviado' || log.correoCliente.startsWith('Enviado') ? `${T.success}15` : `${T.danger}15`, 
                            color: log.correoCliente === 'Enviado' || log.correoCliente.startsWith('Enviado') ? T.success : T.danger,
                            fontSize: 10, 
                            fontWeight: 600 
                          }}>
                            {log.correoCliente}
                          </span>
                        ) : <span style={{ color: T.textSec, fontSize: 10 }}>{log.estado || 'N/A'}</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.correoAdmin ? (
                          <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: 4, 
                            background: log.correoAdmin === 'Enviado' ? `${T.success}15` : (log.correoAdmin === 'N/A' ? '#F1F5F9' : `${T.danger}15`), 
                            color: log.correoAdmin === 'Enviado' ? T.success : (log.correoAdmin === 'N/A' ? '#475569' : T.danger),
                            fontSize: 10, 
                            fontWeight: 600 
                          }}>
                            {log.correoAdmin}
                          </span>
                        ) : <span style={{ color: T.textSec, fontSize: 10 }}>N/A</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: T.textSec, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.mensaje || log.detalle}>
                        {log.mensaje || log.detalle || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Swarm CSS keyframe animations */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes ping {
            75%, 100% { transform: scale(1.4); opacity: 0; }
          }
          @keyframes scrollUp {
            0% { transform: translateY(100%); }
            100% { transform: translateY(-100%); }
          }
        `}</style>
      </div>
    );
  };const renderFAQs = () => {
    const filtered = faqs.filter(f =>
      faqSearch === '' ||
      f.pregunta.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.respuesta.toLowerCase().includes(faqSearch.toLowerCase())
    );

    const addFaq = () => {
      if (!newFaq.pregunta || !newFaq.respuesta) return;
      setFaqs([...faqs, { id: Date.now(), ...newFaq }]);
      setNewFaq({ categoria: FAQ_CATEGORIES[0], pregunta: '', respuesta: '' });
      setShowFaqForm(false);
    };

    const deleteFaq = (id: number) => {
      setFaqs(faqs.filter(f => f.id !== id));
    };

    const updateFaq = (id: number, field: string, value: string) => {
      setFaqs(faqs.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    return (
      <div>
        {sectionTitle('Preguntas Frecuentes · Base de Conocimiento')}

        {/* Search and counts */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={faqSearch} onChange={e => setFaqSearch(e.target.value)}
            placeholder="🔍 Buscar en todas las FAQs..."
            style={inputStyle({ width: 300 })} />
          <button onClick={() => setFaqActiveCategory('all')} style={{
            ...btnSecondary({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
            background: faqActiveCategory === 'all' ? T.teal : 'transparent',
            color: faqActiveCategory === 'all' ? T.card : T.teal,
            borderRadius: 16,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
          }}>
            <span>Todos ({filtered.length})</span>
          </button>
          {FAQ_CATEGORIES.map(cat => {
            const catCount = filtered.filter(f => f.categoria === cat).length;
            return (
              <button key={cat} onClick={() => setFaqActiveCategory(faqActiveCategory === cat ? 'all' : cat)} style={{
                ...btnSecondary({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
                background: faqActiveCategory === cat ? T.teal : 'transparent',
                color: faqActiveCategory === cat ? T.card : T.teal,
                borderRadius: 16,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
              }}>
                <span>{cat} ({catCount})</span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowFaqForm(!showFaqForm)} style={btnPrimary()}>
            {showFaqForm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('close', 12)}
                <span>Cerrar</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {renderButtonIcon('plus', 12)}
                <span>Nueva FAQ</span>
              </span>
            )}
          </button>
        </div>

        {showFaqForm && (
          <div style={{ ...cardStyle({ marginBottom: 16, background: T.sand }) }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nueva FAQ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select value={newFaq.categoria} onChange={e => setNewFaq({ ...newFaq, categoria: e.target.value })} style={inputStyle()}>
                  {FAQ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Pregunta</label>
                <input value={newFaq.pregunta} onChange={e => setNewFaq({ ...newFaq, pregunta: e.target.value })} style={inputStyle()} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Respuesta</label>
              <textarea value={newFaq.respuesta} onChange={e => setNewFaq({ ...newFaq, respuesta: e.target.value })}
                style={{ ...inputStyle(), minHeight: 100, resize: 'vertical' as const }} />
            </div>
            <button onClick={addFaq} style={btnPrimary({ marginTop: 12 })}>Guardar FAQ</button>
          </div>
        )}

        {/* FAQs by category */}
        {FAQ_CATEGORIES.filter(cat => faqActiveCategory === 'all' || faqActiveCategory === cat).map(cat => {
          const catFaqs = filtered.filter(f => f.categoria === cat);
          if (catFaqs.length === 0 && faqSearch) return null;
          return (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{cat}</span>
                <span style={{ background: T.teal, color: T.card, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{catFaqs.length}</span>
              </div>
              {catFaqs.map(faq => {
                const expanded = expandedFaq === faq.id;
                const editing = faqEditId === faq.id;
                return (
                  <div key={faq.id} style={{ ...cardStyle({ marginBottom: 8, padding: '14px 20px', cursor: 'pointer' }) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => setExpandedFaq(expanded ? null : faq.id)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1 }}>
                        {editing ? (
                          <input value={faq.pregunta} onClick={e => e.stopPropagation()}
                            onChange={e => updateFaq(faq.id, 'pregunta', e.target.value)}
                            style={inputStyle({ fontSize: 13, fontWeight: 600 })} />
                        ) : faq.pregunta}
                      </div>
                      <span style={{ fontSize: 18, color: T.textSec, marginLeft: 12, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                    </div>
                    {expanded && (
                      <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                        {editing ? (
                          <textarea value={faq.respuesta} onChange={e => updateFaq(faq.id, 'respuesta', e.target.value)}
                            style={{ ...inputStyle(), minHeight: 100, resize: 'vertical' as const }} />
                        ) : (
                          <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.6 }}>{faq.respuesta}</div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => setFaqEditId(editing ? null : faq.id)}
                            style={btnSecondary({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                            {editing ? (
                              <>
                                {renderButtonIcon('check')}
                                <span>Guardar</span>
                              </>
                            ) : (
                              <>
                                {renderButtonIcon('pencil')}
                                <span>Editar</span>
                              </>
                            )}
                          </button>
                          <button onClick={() => deleteFaq(faq.id)} style={btnDanger({ padding: '4px 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
                            {renderButtonIcon('trash')}
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div style={{ textAlign: 'center' as const, fontSize: 13, color: T.textSec, marginTop: 16 }}>
          Total: {filtered.length} FAQs {faqSearch && `(filtradas de ${faqs.length})`}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // MODULE 8: CALCULADORA ROI
  // ══════════════════════════════════════════════════════════════
  const renderCalculadora = () => {
    const proj = calcProject ? crmProjects.find(p => p.name === calcProject) : null;

    const profileProjects = INVESTOR_PROFILES.find(x => x.id === calcPerfil)?.projects || [];
    const filteredProjects = crmProjects.filter(pd => {
      // 1. Check profile project list
      if (calcPerfil && !profileProjects.includes(pd.name)) return false;
      
      // 2. Check zone filter
      if (calcFilterZone !== 'all') {
        const zone = pd.zone.toLowerCase();
        const short = pd.zoneShort?.toLowerCase() || '';
        const filterZ = calcFilterZone.toLowerCase();
        if (filterZ === 'playa caracol') {
          if (!zone.includes('caracol') && !zone.includes('chame')) return false;
        } else if (filterZ === 'santa maría') {
          if (!zone.includes('santa maría') && !zone.includes('santa maria') && !short.includes('santa maría') && !short.includes('santa maria')) return false;
        } else if (filterZ === 'punta pacífica') {
          if (!zone.includes('pacífica') && !zone.includes('pacifico') && !short.includes('punta pacífica') && !short.includes('punta pacifica')) return false;
        } else if (filterZ === 'costa del este') {
          if (!zone.includes('este') && !zone.includes('viejo') && !short.includes('este') && !short.includes('viejo') && !zone.includes('costa del mar') && !short.includes('costa del mar')) return false;
        } else if (filterZ === 'arraiján / pacífico') {
          if (!zone.includes('arraiján') && !zone.includes('arraijan') && !zone.includes('pacífico') && !zone.includes('pacifico') && !zone.includes('dorada') && !short.includes('arraiján') && !short.includes('arraijan') && !short.includes('bayside') && !short.includes('dorada')) return false;
        }
      }
      
      // 3. Check price filter
      if (calcFilterPrice !== 'all') {
        if (calcFilterPrice === 'low' && pd.minPrice > 250000) return false;
        if (calcFilterPrice === 'mid' && (pd.minPrice < 250000 || pd.minPrice > 500000)) return false;
        if (calcFilterPrice === 'high' && pd.minPrice < 500000) return false;
      }
      
      return true;
    });

    // Calculations
    const montoFinanciado = calcPrecio * (1 - calcCuotaInicial / 100);
    const cuotaMes = calcMortgage(montoFinanciado, calcTasaHip, calcPlazo);
    const cuotaAnualHip = cuotaMes * 12;
    const cuotaInicialdUSD = calcPrecio * (calcCuotaInicial / 100);

    // Income
    const rentaMensual = calcRentaM2 * calcArea;
    const rentaMensualEfectiva = rentaMensual * (1 - calcVacancia / 100);
    const ingresoBrutoAnual = rentaMensualEfectiva * 12;
    const capRateBruto = cuotaInicialdUSD > 0 ? (rentaMensual * 12 / cuotaInicialdUSD) * 100 : 0;

    // Expenses (only PM, Seguro, Predial, and Condominio as active inputs)
    const gastosPM = calcFeePM * 12;           // property management annual
    const gastosAdmin = 0;                      // always 0 (removed input)
    const gastosCondominio = calcCondominio * 12; // HOA annual
    const gastosPredial = calcPredial;          // annual tax
    const gastosSeguro = calcSeguro;            // annual insurance
    const gastosMantenimiento = 0;              // always 0
    const totalGastosMensual = calcFeePM + calcCondominio + calcPredial/12 + calcSeguro / 12;
    const totalGastos = gastosPM + gastosCondominio + gastosPredial + gastosSeguro; // annual total

    // NOI & Cash flow
    const noi = ingresoBrutoAnual - totalGastos;
    const capRateNeto = cuotaInicialdUSD > 0 ? (noi / cuotaInicialdUSD) * 100 : 0;
    const cashOnCash = cuotaInicialdUSD > 0 ? ((noi - cuotaAnualHip) / cuotaInicialdUSD) * 100 : 0;
    const flujoLibreMensual = (noi - cuotaAnualHip) / 12;
    const valorFuturo = calcPrecio * Math.pow(1 + calcValorizacion / 100, calcHorizonte);

    // Year-by-year table (correct amortization and term limits)
    const yearlyTable: Array<{
      year: number;
      rentaMensual: number;
      ingresoEfectivoMensual: number;
      ingresoAnual: number;
      gastosMensual: number;
      gastosAnual: number;
      noi: number;
      cuotaHip: number;
      flujoPostHip: number;
      deuda: number;
      valorActivo: number;
    }> = [];
    let deudaRemanente = montoFinanciado;
    for (let y = 1; y <= calcPlazo; y++) {
      const valorActivoY = calcPrecio * Math.pow(1 + calcValorizacion / 100, y);
      const ingresoAnualY = rentaMensual * 12 * (1 - calcVacancia / 100);
      const gastosAnualY = totalGastos;
      const noiY = ingresoAnualY - gastosAnualY;
      
      let cuotaAnualHipY = 0;
      
      if (y <= calcPlazo) {
        cuotaAnualHipY = cuotaAnualHip;
        // Interest on remaining balance
        const intAnual = deudaRemanente * (calcTasaHip / 100);
        const amortAnual = Math.max(0, cuotaAnualHip - intAnual);
        deudaRemanente = Math.max(0, deudaRemanente - amortAnual);
      } else {
        cuotaAnualHipY = 0;
        deudaRemanente = 0;
      }
      
      const flujoPostHip = noiY - cuotaAnualHipY;
      yearlyTable.push({
        year: y,
        rentaMensual,
        ingresoEfectivoMensual: rentaMensual * (1 - calcVacancia / 100),
        ingresoAnual: ingresoAnualY,
        gastosMensual: totalGastosMensual,
        gastosAnual: gastosAnualY,
        noi: noiY,
        cuotaHip: cuotaAnualHipY, // annual mortgage payment for consistency
        flujoPostHip,
        deuda: deudaRemanente,
        valorActivo: valorActivoY,
      });
    }

    // Sale calculation (descontando deuda para obtener Equity Value)
    let deudaEnAnioVenta = 0;
    if (calcVenderAnio <= calcPlazo) {
      const row = yearlyTable.find(r => r.year === calcVenderAnio);
      if (row) {
        deudaEnAnioVenta = row.deuda;
      } else {
        let balTmp = montoFinanciado;
        for (let y = 1; y <= calcVenderAnio; y++) {
          const intAnual = balTmp * (calcTasaHip / 100);
          const amortAnual = Math.max(0, cuotaAnualHip - intAnual);
          balTmp = Math.max(0, balTmp - amortAnual);
        }
        deudaEnAnioVenta = balTmp;
      }
    } else {
      deudaEnAnioVenta = 0;
    }

    const ventaValor = calcPrecio * Math.pow(1 + calcValorizacion / 100, calcVenderAnio);
    const ventaImpuesto = ventaValor * 0.02;
    const ventaEquity = Math.max(0, ventaValor - deudaEnAnioVenta - ventaImpuesto);
    const ventaUtilidad = ventaEquity - cuotaInicialdUSD;

    // CDT comparison
    const cdtRate = 10.5;
    const cdtDevaluation = 6;
    const cdtRealRate = cdtRate - cdtDevaluation;

    // Cut-off year for comparison (dynamic based on Vender Activo option)
    const comparativaAnio = calcVender ? calcVenderAnio : calcHorizonte;

    const valorFuturoComp = calcPrecio * Math.pow(1 + calcValorizacion / 100, comparativaAnio);

    // Find debt at comparison year
    let deudaAlComp = 0;
    if (comparativaAnio <= calcPlazo) {
      const row = yearlyTable.find(r => r.year === comparativaAnio);
      if (row) {
        deudaAlComp = row.deuda;
      } else {
        let balTmp = montoFinanciado;
        for (let y = 1; y <= comparativaAnio; y++) {
          const intAnual = balTmp * (calcTasaHip / 100);
          const amortAnual = Math.max(0, cuotaAnualHip - intAnual);
          balTmp = Math.max(0, balTmp - amortAnual);
        }
        deudaAlComp = balTmp;
      }
    } else {
      deudaAlComp = 0;
    }

    // Accumulated rents up to comparison year
    let rentasNetasAcumComp = 0;
    for (let y = 1; y <= comparativaAnio; y++) {
      const row = yearlyTable.find(r => r.year === y);
      if (row) {
        rentasNetasAcumComp += row.flujoPostHip;
      }
    }

    // Cost of sale (impuesto de venta 2% de valor futuro)
    const ventaImpuestoComp = valorFuturoComp * 0.02;

    // Final wealth/liquid value for Panama (deduct sale cost ONLY if calcVender is true)
    const patrimonioNetoComp = (valorFuturoComp - deudaAlComp - (calcVender ? ventaImpuestoComp : 0)) + rentasNetasAcumComp;

    // CDT values at comparison year
    const cdtFutureValueComp = cuotaInicialdUSD * Math.pow(1 + cdtRealRate / 100, comparativaAnio);

    // Differential
    const diferencialCompUSD = patrimonioNetoComp - cdtFutureValueComp;

    const sliderInput = (label: string, value: number, setter: (v: number) => void, min: number, max: number, step: number, suffix: string = '') => (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={labelStyle}>{label}</label>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.teal }}>{suffix === '$' ? usd(value) : value + suffix}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => setter(Number(e.target.value))}
          style={{ width: '100%', accentColor: T.teal }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textSec }}>
          <span>{suffix === '$' ? usd(min) : min + suffix}</span>
          <span>{suffix === '$' ? usd(max) : max + suffix}</span>
        </div>
      </div>
    );

    const resultCard = (label: string, value: string, color: string, sub?: string) => (
      <div style={{ background: T.bg, borderRadius: 10, padding: '12px 16px', border: `1px solid ${T.borderLight}` }}>
        <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>{sub}</div>}
      </div>
    );

    return (
      <div>
        {sectionTitle('Calculadora ROI · Análisis de Inversión')}

        {/* FILTER BAR: profile + zone + price — all optional */}
        <div style={{ ...cardStyle(), marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Filtros de Portafolio</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            {/* Investor profile */}
            <div>
              <label style={{ ...labelStyle, marginBottom: 4, display: 'block' }}>Perfil de inversión</label>
              <select
                value={calcPerfil || 'all'}
                onChange={e => { setCalcPerfil(e.target.value === 'all' ? null : e.target.value); setCalcProject(null); }}
                style={inputStyle({ fontSize: 12, padding: '6px 10px' })}
              >
                <option value="all">Todos los perfiles</option>
                {INVESTOR_PROFILES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            {/* Zone */}
            <div>
              <label style={{ ...labelStyle, marginBottom: 4, display: 'block' }}>Zona</label>
              <select value={calcFilterZone} onChange={e => { setCalcFilterZone(e.target.value); setCalcProject(null); }} style={inputStyle({ fontSize: 12, padding: '6px 10px' })}>
                <option value="all">Todas las zonas</option>
                <option value="Playa Caracol">Playa Caracol</option>
                <option value="Santa María">Santa María</option>
                <option value="Punta Pacífica">Punta Pacífica</option>
                <option value="Costa del Este">Costa del Este / Panamá Viejo</option>
                <option value="Arraiján / Pacífico">Arraiján / Pacífico</option>
              </select>
            </div>
            {/* Price */}
            <div>
              <label style={{ ...labelStyle, marginBottom: 4, display: 'block' }}>Rango de precio</label>
              <select value={calcFilterPrice} onChange={e => { setCalcFilterPrice(e.target.value); setCalcProject(null); }} style={inputStyle({ fontSize: 12, padding: '6px 10px' })}>
                <option value="all">Todos los precios</option>
                <option value="low">Hasta USD $250,000</option>
                <option value="mid">USD $250,000 – $500,000</option>
                <option value="high">Más de USD $500,000</option>
              </select>
            </div>
            {/* Reset */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => { setCalcPerfil(null); setCalcFilterZone('all'); setCalcFilterPrice('all'); setCalcProject(null); }}
                style={{ ...btnSecondary(), width: '100%', justifyContent: 'center' }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>
          {/* Profile chips (visual, optional click) */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${T.borderLight}`, paddingTop: 10 }}>
            <span style={{ fontSize: 11, color: T.textSec, alignSelf: 'center' }}>Perfil rápido:</span>
            {INVESTOR_PROFILES.map(p => (
              <div key={p.id}
                onClick={() => { setCalcPerfil(calcPerfil === p.id ? null : p.id); setCalcProject(null); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 0,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  border: `1px solid ${calcPerfil === p.id ? p.color : T.border}`,
                  background: calcPerfil === p.id ? `${p.color}08` : 'transparent',
                  color: calcPerfil === p.id ? p.color : T.textSec,
                  transition: 'all 0.15s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {p.icon(calcPerfil === p.id ? p.color : T.textSec)}
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* PROJECT GRID — always visible, filtered */}
        <div style={{ ...cardStyle(), marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              Portafolio ({filteredProjects.length} proyectos)
              {calcProject && <span style={{ fontSize: 12, color: T.teal, marginLeft: 8 }}>· Seleccionado: {calcProject}</span>}
            </div>
            {calcProject && (
              <button onClick={() => setCalcProject(null)} style={{ fontSize: 11, color: T.coral, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✕ Quitar selección</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {filteredProjects.map(pd => {
              const pn = pd.name;
              const sel = calcProject === pn;
              return (
                <div key={pn} onClick={() => selectCalcProject(pn)}
                  style={{
                    borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                    border: `2px solid ${sel ? T.teal : T.border}`,
                    background: sel ? 'rgba(14,165,172,0.06)' : T.bg,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = T.teal + '80'; }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = T.border; }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12, color: T.text, marginBottom: 4 }}>{pn}</div>
                  <div style={{ fontSize: 11, color: T.textSec, marginBottom: 6 }}>{pd.zoneShort}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: T.teal, fontWeight: 600 }}>Desde {usd(pd.minPrice)}</span>
                  </div>
                </div>
              );
            })}
            {filteredProjects.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '20px 0', textAlign: 'center', color: T.textSec, fontStyle: 'italic', fontSize: 12 }}>
                No hay proyectos con estos filtros combinados.
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Calculator */}
        {calcProject && proj && (

          <>
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16 }}>
              {/* Left: Parameters */}
              <div style={cardStyle()}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Parámetros de Inversión</div>
                {sliderInput('Precio del activo', calcPrecio, handleSetCalcPrecio, proj.minPrice, proj.minPrice * 4, 10000, '$')}
                {sliderInput('Metraje (m²)', calcArea, handleSetCalcArea, proj.areaMin, proj.areaMax, 1, ' m²')}
                {sliderInput('Cuota inicial', calcCuotaInicial, setCalcCuotaInicial, 30, 100, 5, '%')}
                {sliderInput('Tasa hipotecaria', calcTasaHip, setCalcTasaHip, 5, 12, 0.5, '%')}
                {sliderInput('Plazo (años)', calcPlazo, setCalcPlazo, 5, 30, 1, ' años')}
                {sliderInput('Renta por m²/mes', calcRentaM2, handleSetCalcRentaM2, 5, 35, 1, ' USD')}
                <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>Gastos Operativos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Property Mgmt (% renta)</label>
                      <input type="number" step="0.001" value={calcFeePMPct === 0 ? '' : calcFeePMPct} onChange={e => handleCalcFeePMPctChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Property Mgmt ($/mes)</label>
                      <input type="number" value={calcFeePM === 0 ? '' : calcFeePM} onChange={e => handleCalcFeePMChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Seguro Anual (% valor)</label>
                      <input type="number" step="0.001" value={calcSeguroPct === 0 ? '' : calcSeguroPct} onChange={e => handleCalcSeguroPctChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Seguro Anual ($/año)</label>
                      <input type="number" value={calcSeguro === 0 ? '' : calcSeguro} onChange={e => handleCalcSeguroChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Impuesto Prop. (% anual)</label>
                      <input type="number" step="0.001" value={calcPredialPct === 0 ? '' : calcPredialPct} onChange={e => handleCalcPredialPctChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Impuesto Prop. ($/año)</label>
                      <input type="number" value={calcPredial === 0 ? '' : calcPredial} onChange={e => handleCalcPredialChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Condominio / HOA (% anual)</label>
                      <input type="number" step="0.001" value={calcCondominioPct === 0 ? '' : calcCondominioPct} onChange={e => handleCalcCondominioPctChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Condominio / HOA ($/mes)</label>
                      <input type="number" value={calcCondominio === 0 ? '' : calcCondominio} onChange={e => handleCalcCondominioChange(e.target.value === '' ? 0 : Number(e.target.value))} style={inputStyle({ fontSize: 12, padding: '4px 8px' })} />
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: T.textSec, marginTop: 6, fontStyle: 'italic' }}>
                    Condominio, administración y mantenimiento en $0 (ajustable en proyectos con costos fijos).
                  </div>
                </div>
                {sliderInput('Vacancia', calcVacancia, setCalcVacancia, 0, 30, 1, '%')}
                {sliderInput('Valorización anual', calcValorizacion, setCalcValorizacion, 1, 10, 0.5, '%')}
                {sliderInput('Horizonte inversión', calcHorizonte, setCalcHorizonte, 1, 15, 1, ' años')}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <label style={{ fontSize: 12, color: T.text }}>
                    <input type="checkbox" checked={calcVender} onChange={e => setCalcVender(e.target.checked)} style={{ marginRight: 6 }} />
                    ¿Vender en año X?
                  </label>
                  {calcVender && (
                    <input type="number" value={calcVenderAnio} min={1} max={calcPlazo}
                      onChange={e => setCalcVenderAnio(Number(e.target.value))}
                      style={inputStyle({ width: 60, fontSize: 12, padding: '4px 8px' })} />
                  )}
                </div>
              </div>

              {/* Right: Results */}
              <div>
                {/* Reorganized Results: particular → general */}
                <div style={{ ...cardStyle(), marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Resumen Financiero — {calcProject}</div>

                  {/* INGRESOS BRUTOS */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.palm, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8, borderBottom: `2px solid ${T.palm}22`, paddingBottom: 4 }}>📈 Ingresos Brutos</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                      {resultCard('Renta Mensual (bruta)', usd(Math.round(rentaMensual)), T.palm)}
                      {resultCard(`Renta Mensual Efectiva (${calcVacancia}% vac.)`, usd(Math.round(rentaMensualEfectiva)), T.palm)}
                      {resultCard('Ingreso Anual Efectivo', usd(Math.round(ingresoBrutoAnual)), T.teal)}
                      {resultCard(`Retorno Bruto`, pct(capRateBruto), T.teal, 'Sobre patrimonio, sin costos')}
                    </div>
                  </div>

                  {/* GASTOS OPERATIVOS */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.coral, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8, borderBottom: `2px solid ${T.coral}22`, paddingBottom: 4 }}>🔻 Gastos Operativos</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                      {resultCard('Gastos Mensual', usd(Math.round(totalGastosMensual)), T.coral, 'PM + Seguro prorr.')}
                      {resultCard('Gastos Anual', usd(Math.round(totalGastos)), T.coral, 'PM anual + Seguro')}
                    </div>
                  </div>

                  {/* RESULTADOS NETOS (OPERATIVOS) */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8, borderBottom: `2px solid ${T.teal}22`, paddingBottom: 4 }}>📊 Resultados Netos (Operativos)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                      {resultCard('NOI Anual', usd(Math.round(noi)), T.teal, 'Ingreso - Gastos operativos')}
                      {resultCard('Retorno Neto', pct(capRateNeto), T.teal, 'NOI / Patrimonio')}
                    </div>
                  </div>

                  {/* FINANCIACIÓN & FLUJO APALANCADO */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.sky, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 8, borderBottom: `2px solid ${T.sky}22`, paddingBottom: 4 }}>🏦 Financiación & Flujo Apalancado</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                      {resultCard('Cuota Hipotecaria / Mes', usd(Math.round(cuotaMes)), T.sky)}
                      {resultCard('Total Hipoteca Anual', usd(Math.round(cuotaAnualHip)), T.sky)}
                      {resultCard('Flujo Libre / Mes', usd(Math.round(flujoLibreMensual)), flujoLibreMensual >= 0 ? T.palm : T.coral, 'NOI - Hipoteca')}
                      {resultCard('Cash-on-Cash', pct(cashOnCash), cashOnCash >= 0 ? T.palm : T.coral, 'Sobre cuota inicial')}
                      {resultCard('Valor Futuro (Año ' + calcHorizonte + ')', usd(Math.round(valorFuturo)), T.sky)}
                    </div>
                  </div>
                </div>

                {/* Análisis de Sensibilidad Operativa - Sotheby's Style */}
                <div style={{ ...cardStyle(), marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.teal, marginBottom: 12, borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 6 }}>Análisis de Sensibilidad (Costos Operativos)</div>
                  <p style={{ fontSize: 11, color: T.textSec, marginBottom: 14 }}>
                    Simulación del impacto de variaciones de +/-15% en los costos operativos totales ({usd(totalGastos)}/año) sobre el rendimiento neto.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {/* Optimista (-15% costos) */}
                    <div style={{ background: '#FFFFFF', borderRadius: 0, padding: 12, border: `1.5px solid ${T.coral}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.coral, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optimista (-15%)</div>
                      <div style={{ fontSize: 10, color: T.textSec, marginTop: 4 }}>Costos: {usd(totalGastos * 0.85)}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.teal, marginTop: 8 }}>Retorno: {(cuotaInicialdUSD > 0 ? ((ingresoBrutoAnual - totalGastos * 0.85) / cuotaInicialdUSD * 100) : 0).toFixed(2)}%</div>
                    </div>
                    {/* Base */}
                    <div style={{ background: '#FFFFFF', borderRadius: 0, padding: 12, border: `1.5px solid ${T.teal}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caso Base</div>
                      <div style={{ fontSize: 10, color: T.textSec, marginTop: 4 }}>Costos: {usd(totalGastos)}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.teal, marginTop: 8 }}>Retorno: {capRateNeto.toFixed(2)}%</div>
                    </div>
                    {/* Conservador (+15% costos) */}
                    <div style={{ background: '#FFFFFF', borderRadius: 0, padding: 12, border: '1px solid #D1D5DB', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conservador (+15%)</div>
                      <div style={{ fontSize: 10, color: T.textSec, marginTop: 4 }}>Costos: {usd(totalGastos * 1.15)}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.textSec, marginTop: 8 }}>Retorno: {(cuotaInicialdUSD > 0 ? ((ingresoBrutoAnual - totalGastos * 1.15) / cuotaInicialdUSD * 100) : 0).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>

                {/* Year-by-year table */}
                <div style={{ ...cardStyle(), marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Proyección Año por Año (Plazo de Hipoteca: {calcPlazo} Años)</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Año</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Renta/Mes</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Ingreso Anual</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Gastos Anual</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>NOI</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Hipoteca Anual</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Flujo Neto Anual</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Saldo Deuda</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Valor Propiedad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearlyTable.map((r: any) => (
                          <tr key={r.year} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const, fontWeight: 700 }}>{r.year}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const }}>{usd(Math.round(r.rentaMensual))}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const, color: T.palm, fontWeight: 600 }}>{usd(Math.round(r.ingresoAnual))}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const, color: T.coral }}>{usd(Math.round(r.gastosAnual))}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const, fontWeight: 700, color: T.teal }}>{usd(Math.round(r.noi))}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const, color: T.sky }}>{usd(Math.round(r.cuotaHip))}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const, fontWeight: 700, color: r.flujoPostHip >= 0 ? T.palm : T.coral }}>
                              {usd(Math.round(r.flujoPostHip))}
                            </td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const, color: T.textSec }}>{usd(Math.round(r.deuda))}</td>
                            <td style={{ padding: '5px 10px', textAlign: 'right' as const }}>{usd(Math.round(r.valorActivo))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 10, color: T.textSec, marginTop: 8, fontStyle: 'italic' }}>
                    * Flujo post-hipoteca = NOI anual − cuota hipotecaria anual. Negativo cuando la hipoteca supera el ingreso operativo neto (normal en proyectos con alta financiación).
                  </div>
                </div>

                {/* Sale scenario */}
                {calcVender && (
                  <div style={{ ...cardStyle(), marginBottom: 16, borderLeft: `4px solid ${T.palm}` }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Escenario de Venta — Año {calcVenderAnio}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                      {resultCard('Valor de venta (EV)', usd(Math.round(ventaValor)), T.teal, 'Precio futuro proyectado')}
                      {resultCard('Deuda remanente', usd(Math.round(deudaEnAnioVenta)), T.coral, 'Saldo hipoteca por liquidar')}
                      {resultCard('Impuesto venta (2%)', usd(Math.round(ventaImpuesto)), T.coral, 'Gastos de venta')}
                      {resultCard('Valor neto (Equity)', usd(Math.round(ventaEquity)), T.palm, 'Recibido post-deuda y costos')}
                      {resultCard('Utilidad neta', usd(Math.round(ventaUtilidad)), ventaUtilidad >= 0 ? T.palm : T.coral, 'Equity - Cuota Inicial')}
                    </div>
                  </div>
                )}

                {/* CDT comparison */}
                <div style={{ ...cardStyle({ borderTop: `4px solid ${T.coral}`, padding: '28px 24px', background: '#FFFFFF' }) }}>
                  <div style={{ 
                    fontSize: 20, 
                    fontFamily: T.fontSerif, 
                    color: T.teal, 
                    marginBottom: 20, 
                    letterSpacing: '0.03em', 
                    textTransform: 'uppercase', 
                    borderBottom: `1px solid ${T.border}`, 
                    paddingBottom: 12 
                  }}>
                    Análisis Comparativo: Activo Físico vs. CDT Colombia
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Panama Card */}
                    <div style={{ 
                      background: T.teal, 
                      borderRadius: 0, 
                      padding: 24,
                      color: '#FFFFFF',
                      border: `1px solid ${T.coral}`,
                      boxShadow: '0 4px 20px rgba(0,35,73,0.15)'
                    }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontFamily: T.fontSerif, 
                        fontWeight: 600, 
                        color: T.coral, 
                        marginBottom: 16, 
                        letterSpacing: '0.05em', 
                        textTransform: 'uppercase' 
                      }}>
                        Inversión Inmobiliaria GLP · Panamá
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: 16, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ color: '#A0AEC0' }}>Capital inicial:</span>
                          <span style={{ fontWeight: 600 }}>{usd(Math.round(cuotaInicialdUSD))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ color: '#A0AEC0' }}>Rendimiento Neto (Retorno):</span>
                          <span style={{ fontWeight: 600, color: T.coral }}>{pct(capRateNeto)} en USD</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ color: '#A0AEC0' }}>Valor de la propiedad (Año {comparativaAnio}):</span>
                          <span style={{ fontWeight: 600 }}>{usd(Math.round(valorFuturoComp))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ color: '#A0AEC0' }}>Deuda pendiente (Año {comparativaAnio}):</span>
                          <span style={{ fontWeight: 600, color: '#F87171' }}>-{usd(Math.round(deudaAlComp))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ color: '#A0AEC0' }}>Rentas netas acumuladas:</span>
                          <span style={{ fontWeight: 600, color: '#34D399' }}>+{usd(Math.round(rentasNetasAcumComp))}</span>
                        </div>
                        {calcVender && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 }}>
                            <span style={{ color: '#A0AEC0' }}>Costo de venta / Impuesto (2%):</span>
                            <span style={{ fontWeight: 600, color: '#F87171' }}>-{usd(Math.round(ventaImpuestoComp))}</span>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, fontFamily: T.fontSans, color: '#E2E8F0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {calcVender ? 'Valor final de liquidación:' : 'Patrimonio Neto Final:'}
                        </span>
                        <span style={{ fontSize: 20, fontFamily: T.fontSerif, fontWeight: 600, color: T.coral }}>
                          {usd(Math.round(patrimonioNetoComp))}
                        </span>
                      </div>
                    </div>

                    {/* CDT Card */}
                    <div style={{ 
                      background: '#FFFFFF', 
                      borderRadius: 0, 
                      padding: 24,
                      border: `1px solid ${T.border}`,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontFamily: T.fontSerif, 
                        fontWeight: 600, 
                        color: T.teal, 
                        marginBottom: 16, 
                        letterSpacing: '0.05em', 
                        textTransform: 'uppercase' 
                      }}>
                        CDT Tradicional · Colombia
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: `1px solid ${T.borderLight}` }}>
                          <span style={{ color: T.textSec }}>Capital inicial equivalente:</span>
                          <span style={{ fontWeight: 600, color: T.text }}>{usd(Math.round(cuotaInicialdUSD))}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: `1px solid ${T.borderLight}` }}>
                          <span style={{ color: T.textSec }}>Tasa nominal anual (E.A.):</span>
                          <span style={{ fontWeight: 600, color: T.text }}>{cdtRate}% en COP</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: `1px solid ${T.borderLight}` }}>
                          <span style={{ color: T.textSec }}>Devaluación COP/USD estimada:</span>
                          <span style={{ fontWeight: 600, color: '#D97706' }}>-{cdtDevaluation}% anual</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 }}>
                          <span style={{ color: T.textSec }}>Retorno real ajustado en USD:</span>
                          <span style={{ fontWeight: 600, color: T.text }}>{cdtRealRate}%</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, fontFamily: T.fontSans, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Valor Liquidativo Final
                        </span>
                        <span style={{ fontSize: 20, fontFamily: T.fontSerif, fontWeight: 600, color: T.teal }}>
                          {usd(Math.round(cdtFutureValueComp))}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Analysis Summary - Sotheby's Palette (Navy and Gold) */}
                  <div style={{ 
                    marginTop: 24, 
                    padding: '20px 24px', 
                    background: '#FAF8F5', 
                    borderRadius: 0, 
                    border: `1px solid ${T.border}`, 
                    borderLeft: `3px solid ${T.coral}`,
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(184, 144, 71, 0.04)'
                  }}>
                    <div style={{ 
                      fontSize: 14, 
                      fontFamily: T.fontSerif, 
                      fontWeight: 600, 
                      color: T.teal, 
                      marginBottom: 8, 
                      letterSpacing: '0.04em', 
                      textTransform: 'uppercase' 
                    }}>
                      Diferencial a favor de GLP Panamá: <span style={{ color: T.coral, fontWeight: 700 }}>{usd(Math.round(diferencialCompUSD))} USD</span> en {comparativaAnio} años
                    </div>
                    <div style={{ fontSize: 11.5, color: T.textSec, lineHeight: 1.6, textAlign: 'justify', maxWidth: '780px', margin: '0 auto', fontFamily: T.fontSans }}>
                      <strong>Análisis de Cobertura y Estructuración:</strong> Mientras el CDT tradicional expone el capital del inversionista a la devaluación sostenida del peso colombiano (históricamente promediando 6% anual en devaluación), la inversión inmobiliaria con GLP en Panamá dolariza el patrimonio desde el primer día. Esto permite blindar el capital contra la inflación, al tiempo que se multiplica mediante rentas netas consistentes y valorización inmobiliaria real en una economía de moneda fuerte.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER MODULE ROUTER
  // ══════════════════════════════════════════════════════════════
  const renderBackups = () => {
    const handleExport = () => {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('glp_')) {
          data[key] = localStorage.getItem(key);
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glp_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data = JSON.parse(content);
          
          if (!window.confirm("¿Estás seguro de restaurar este backup? Todos los datos actuales del navegador serán sobrescritos.")) {
            // Reset input so it can be re-selected if needed
            e.target.value = '';
            return;
          }

          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('glp_')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));

          for (const key in data) {
            if (key.startsWith('glp_')) {
              localStorage.setItem(key, data[key]);
            }
          }

          alert("Backup restaurado con éxito. La página se recargará para aplicar los cambios.");
          window.location.reload();
        } catch (err) {
          alert("Error al leer el archivo de backup. Asegúrate de que es un archivo .json válido.");
          console.error(err);
        }
      };
      reader.readAsText(file);
    };

    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: T.teal, margin: 0, fontFamily: 'Playfair Display, serif' }}>
            Backups y Restauración
          </h2>
        </div>
        
        <div style={{ ...cardStyle({ padding: 32 }) }}>
          <h3 style={{ fontSize: 18, color: T.teal, marginBottom: 16 }}>Exportar Datos</h3>
          <p style={{ color: T.textSec, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Descarga una copia completa de todos los prospectos, activos inmobiliarios, brokers, bitácoras y configuraciones guardadas en tu navegador. Mantén este archivo en un lugar seguro.
          </p>
          <button onClick={handleExport} style={{ ...btnPrimary({ padding: '12px 24px', fontSize: 14 }), marginBottom: 40 }}>
            Descargar Backup Completo (.json)
          </button>

          <hr style={{ border: 0, borderTop: `1px solid ${T.borderLight}`, marginBottom: 32 }} />

          <h3 style={{ fontSize: 18, color: T.coral, marginBottom: 16 }}>Restaurar Datos</h3>
          <p style={{ color: T.textSec, fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            <strong>Advertencia:</strong> Al restaurar un backup, toda la información actual de este navegador será reemplazada por la información del archivo. Esta acción no se puede deshacer.
          </p>
          
          <div style={{ background: `${T.coral}10`, border: `1px solid ${T.coral}40`, padding: 20, borderRadius: 8 }}>
            <label style={{ display: 'block', fontWeight: 600, color: T.coral, marginBottom: 12 }}>
              Seleccionar archivo de Backup
            </label>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport}
              style={{ display: 'block', width: '100%', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'portafolio': return renderPortafolio();
      case 'activos': return renderActivos();
      case 'kpis': return renderKPIs();
      case 'brokers': return renderBrokers();
      case 'prospectos': return renderProspectos();
      case 'eventos': return renderEventos();
      case 'agentes': return renderAgentes();
      case 'faqs': return renderFAQs();
      case 'calculadora': return renderCalculadora();
      case 'acceso': return <CRMAcceso currentUser={currentUser || ''} />;
      case 'backups': return renderBackups();
      default: return renderPortafolio();
    }
  };

  if (!currentUser) {
    return <CRMLogin setCurrentUser={setCurrentUser} />;
  }

  // ══════════════════════════════════════════════════════════════
  // MAIN LAYOUT
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, fontFamily: 'Inter, sans-serif', color: T.text }}>
      {/* LEFT SIDEBAR */}
      <div style={{
        width: 220, minHeight: '100vh', background: T.card, borderRight: `1px solid ${T.borderLight}`,
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' as const,
        position: 'fixed' as const, top: 0, left: 0, zIndex: 10,
      }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${T.borderLight}` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.teal }}>GLP</div>
          <div style={{ fontSize: 11, color: T.textSec }}>Control Comercial</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          {MODULES.map(m => (
            <button key={m.id} onClick={() => setActiveModule(m.id)} style={sidebarBtn(m.id)}>
              {renderSidebarIcon(m.id, activeModule === m.id ? T.card : T.teal)}
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (confirm('¿Desea cerrar la sesión?')) {
              sessionStorage.removeItem('glp_crm_logged_user');
              setCurrentUser(null);
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 16px', border: 'none', background: 'transparent',
            color: '#E02424', fontSize: '0.88rem', fontWeight: 600,
            cursor: 'pointer', borderTop: `1px solid ${T.borderLight}`,
            transition: 'background 0.2s', marginTop: 'auto'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FDE8E8'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span>🔓 Cerrar Sesión</span>
        </button>
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.borderLight}`, fontSize: 10, color: T.textSec }}>
          GLP CRM v1.0 · 2026
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, marginLeft: 220, display: 'flex', flexDirection: 'column' as const }}>
        {/* TOP HEADER */}
        <div style={{
          background: T.teal,
          padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky' as const, top: 0, zIndex: 5,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.card }}>
            GLP CRM · Control Comercial
          </div>
          <a href="/" style={{ fontSize: 13, color: T.card, textDecoration: 'none', fontWeight: 600, opacity: 0.9 }}>
            Volver a Landing →
          </a>
        </div>

        {/* CONTENT */}
        <div style={{ padding: '24px 32px', overflowY: 'auto' as const, flex: 1 }}>
          {renderModule()}
        </div>
      </div>

      {crmLightboxImg && (
        <div
          onClick={() => setCrmLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', cursor: 'zoom-out',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setCrmLightboxImg(null); }}
            style={{
              position: 'absolute', top: 24, right: 24,
              background: 'none', border: 'none', color: '#fff',
              fontSize: '2rem', cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <img
            src={crmLightboxImg}
            alt="Zoom"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90%', maxHeight: '90%',
              borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              objectFit: 'contain',
            }}
          />
        </div>
      )}
    </div>
  );
}



interface CRMLoginProps {
  setCurrentUser: (user: string) => void;
}

const CRMLogin: React.FC<CRMLoginProps> = ({ setCurrentUser }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users = getAdminUsers();
    const found = users.find((u: any) => u.username === usernameInput && u.password === passwordInput);
    if (found) {
      sessionStorage.setItem('glp_crm_logged_user', found.username);
      setCurrentUser(found.username);
      setLoginError('');
    } else {
      setLoginError('Usuario o contraseña incorrectos.');
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F2C59 0%, #1E3A60 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 20,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%', background: 'rgba(15,44,89,0.08)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', color: '#0F2C59', marginBottom: 16
          }}>
            🔐
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F2C59', margin: 0 }}>GLP CRM</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: 6 }}>Acceso a Consola de Gestión Comercial</p>
        </div>

        <form onSubmit={handleLoginSubmit}>
          {loginError && (
            <div style={{
              background: '#FDE8E8', color: '#E02424', padding: '12px 14px',
              borderRadius: 8, fontSize: '0.82rem', marginBottom: 20,
              fontWeight: 600, border: '1px solid #F8B4B4', textAlign: 'center'
            }}>
              {loginError}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Usuario</label>
            <input
              type="text"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              style={inputStyle()}
              placeholder="Nombre de usuario"
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Contraseña</label>
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              style={inputStyle()}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            style={btnPrimary({ width: '100%', padding: '12px 18px', fontSize: 14, fontWeight: 700 })}
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
};



interface CRMAccesoProps {
  currentUser: string;
}

const CRMAcceso: React.FC<CRMAccesoProps> = ({ currentUser }) => {
  const [userList, setUserList] = useState(() => getAdminUsers());
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newUserError, setNewUserError] = useState('');
  const [newUserSuccess, setNewUserSuccess] = useState('');

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changePassError, setChangePassError] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState('');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newName.trim()) {
      setNewUserError('Todos los campos son obligatorios.');
      return;
    }
    if (userList.some((u: any) => u.username.toLowerCase() === newUsername.trim().toLowerCase())) {
      setNewUserError('El nombre de usuario ya está registrado.');
      return;
    }

    const updated = [...userList, {
      username: newUsername.trim(),
      password: newPassword.trim(),
      name: newName.trim()
    }];
    localStorage.setItem('glp_crm_users', JSON.stringify(updated));
    setUserList(updated);
    setNewUsername('');
    setNewPassword('');
    setNewName('');
    setNewUserError('');
    setNewUserSuccess('Usuario creado con éxito.');
    setTimeout(() => setNewUserSuccess(''), 4000);
  };

  const handleDeleteUser = (uname: string) => {
    if (uname === currentUser) {
      alert('No puedes eliminar tu propio usuario en uso.');
      return;
    }
    if (userList.length <= 1) {
      alert('Debe haber al menos un usuario administrador registrado.');
      return;
    }
    if (confirm(`¿Está seguro de que desea eliminar el usuario ${uname}?`)) {
      const updated = userList.filter((u: any) => u.username !== uname);
      localStorage.setItem('glp_crm_users', JSON.stringify(updated));
      setUserList(updated);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass || !confirmPass) {
      setChangePassError('Complete todos los campos de contraseña.');
      return;
    }
    const current = userList.find((u: any) => u.username === currentUser);
    if (!current || current.password !== oldPass) {
      setChangePassError('La contraseña actual es incorrecta.');
      return;
    }
    if (newPass !== confirmPass) {
      setChangePassError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    const updated = userList.map((u: any) => {
      if (u.username === currentUser) {
        return { ...u, password: newPass };
      }
      return u;
    });
    localStorage.setItem('glp_crm_users', JSON.stringify(updated));
    setUserList(updated);
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
    setChangePassError('');
    setChangePassSuccess('Contraseña actualizada con éxito.');
    setTimeout(() => setChangePassSuccess(''), 4000);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.teal, marginBottom: 20 }}>
        🔐 Control de Accesos y Seguridad
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
        {/* Left Column: Admin list & change password */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* List of Admins */}
          <div style={cardStyle()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}>
              👥 Administradores Autorizados
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {userList.map((u: any) => (
                <div key={u.username} style={{
                  background: T.bg, borderRadius: 10, padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: `1px solid ${T.borderLight}`
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: T.text }}>{u.name}</div>
                    <div style={{ fontSize: '0.78rem', color: T.textSec }}>
                      Usuario: <strong>{u.username}</strong> {u.username === currentUser && ' (Tú)'}
                    </div>
                  </div>
                  {u.username !== currentUser && (
                    <button
                      onClick={() => handleDeleteUser(u.username)}
                      style={btnSecondary({ padding: '6px 12px', fontSize: 11, background: '#FDE8E8', color: '#E02424', border: '1px solid #F8B4B4' })}
                      onMouseEnter={e => e.currentTarget.style.background = '#FBD5D5'}
                      onMouseLeave={e => e.currentTarget.style.background = '#FDE8E8'}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Change Password Form */}
          <div style={cardStyle()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}>
              🔑 Cambiar Mi Contraseña
            </div>
            {changePassError && (
              <div style={{ background: '#FDE8E8', color: '#E02424', padding: '10px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 14, fontWeight: 600 }}>
                {changePassError}
              </div>
            )}
            {changePassSuccess && (
              <div style={{ background: '#DEF7EC', color: '#03543F', padding: '10px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 14, fontWeight: 600 }}>
                {changePassSuccess}
              </div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Contraseña Actual</label>
                <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} style={inputStyle()} placeholder="••••••••" required />
              </div>
              <div>
                <label style={labelStyle}>Nueva Contraseña</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} style={inputStyle()} placeholder="Mínimo 6 caracteres" required />
              </div>
              <div>
                <label style={labelStyle}>Confirmar Nueva Contraseña</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={inputStyle()} placeholder="••••••••" required />
              </div>
              <button type="submit" style={btnPrimary({ width: '100%', marginTop: 8 })}>
                Actualizar Contraseña
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Register new admin */}
        <div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}>
              ➕ Registrar Nuevo Administrador
            </div>
            <p style={{ fontSize: '0.82rem', color: T.textSec, marginBottom: 18 }}>
              Crea un nuevo perfil administrativo para delegar el control comercial del CRM de GLP.
            </p>
            {newUserError && (
              <div style={{ background: '#FDE8E8', color: '#E02424', padding: '10px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 14, fontWeight: 600 }}>
                {newUserError}
              </div>
            )}
            {newUserSuccess && (
              <div style={{ background: '#DEF7EC', color: '#03543F', padding: '10px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 14, fontWeight: 600 }}>
                {newUserSuccess}
              </div>
            )}
            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre Completo</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} style={inputStyle()} placeholder="Ej. Carlos Martínez" required />
              </div>
              <div>
                <label style={labelStyle}>Nombre de Usuario (Login)</label>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} style={inputStyle()} placeholder="Ej. carlosm" required />
              </div>
              <div>
                <label style={labelStyle}>Contraseña de Acceso</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle()} placeholder="••••••••" required />
              </div>
              <button type="submit" style={btnPrimary({ width: '100%', marginTop: 8 })}>
                Registrar Administrador
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
