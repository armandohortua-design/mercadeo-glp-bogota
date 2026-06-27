import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MARKET_STUDY_DB } from '../marketStudyDb';
import { uploadProjectImage, saveProjectImageUrl } from '../lib/supabase';

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

// ── ELEGANT SVG ICON LIBRARY ─────────────────────────────────
const Icon = ({ name, size = 24, color = 'currentColor', style = {} }: { name: string; size?: number; color?: string; style?: React.CSSProperties }) => {
  const s = { width: size, height: size, display: 'inline-block', flexShrink: 0, ...style };
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: s };
  switch (name) {
    case 'currency':   return <svg {...props}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case 'trend-up':   return <svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case 'trend-down': return <svg {...props}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>;
    case 'users':      return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'user':       return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'handshake':  return <svg {...props}><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 7.65l.77.77L12 21.23l7.65-8.22.77-.77a5.4 5.4 0 0 0 0-7.66z"/></svg>;
    case 'building':   return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 21V9"/></svg>;
    case 'chart-bar':  return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
    case 'portfolio':  return <svg {...props}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
    case 'calendar':   return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'mail':       return <svg {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
    case 'search':     return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case 'shield':     return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'star':       return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'key':        return <svg {...props}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
    case 'lock':       return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case 'database':   return <svg {...props}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;
    case 'ai':         return <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>;
    case 'faq':        return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'calculator': return <svg {...props}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="18"/></svg>;
    case 'backup':     return <svg {...props}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>;
    case 'plug':       return <svg {...props}><path d="M18 6L6 18"/><path d="M6 6l3.5 3.5"/><path d="M10.5 10.5L14 14"/><circle cx="18.5" cy="5.5" r="2.5"/><circle cx="5.5" cy="18.5" r="2.5"/></svg>;
    case 'wave':       return <svg {...props}><path d="M2 12c0-4 2-6 5-6s5 3 5 3 2 3 5 3 5-2 5-6"/><path d="M2 19c0-1.5 1-2.5 2.5-2.5S7 17.5 7 19"/></svg>;
    case 'diamond':    return <svg {...props}><polygon points="12 2 22 12 12 22 2 12"/></svg>;
    case 'chart-line': return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case 'events':     return <svg {...props}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
    case 'warning':    return <svg {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'check':      return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'list':       return <svg {...props}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    case 'funnel':     return <svg {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case 'send':       return <svg {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
    case 'draft':      return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case 'globe':      return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
    default:           return <svg {...props}><circle cx="12" cy="12" r="10"/></svg>;
  }
};

const fmt = (n: number, d = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const usd = (n: number) => '$' + fmt(n);
const pct = (n: number) => Number(n).toFixed(1) + '%';

// ── PROJECTS DATABASE ─────────────────────────────────────────
type ProjectData = {
  name: string; zone: string; zoneShort: string; investorType: string;
  category: string; tipo: string; entrega: string;
  minPrice: number; maxPrice: number; areaMin: number; areaMax: number; bedrooms: string;
  capRateMin: number; capRateMax: number; vacancyDef: number;
  rentSuggest: number; rentM2Min: number; rentM2Max: number;
  condominioMes: number; appreciationDef: number; appreciationNote: string;
  amenities: string[]; construction: string;
  priceM2Min: number; priceM2Max: number;
  imagen?: string;
};

const PROJECTS: ProjectData[] = [
  // ── PROYECTO DE CIUDAD ──────────────────────────────────────
  { name: 'Armonía', category: 'Proyecto de Ciudad', tipo: 'Residencia', zone: 'Bella Vista — Ciudad de Panamá', zoneShort: 'Armonía / Bella Vista', investorType: 'renta', entrega: 'F1 Inmediata · F2 Q2 2026 · F3 Q2 2028', minPrice: 181000, maxPrice: 235000, areaMin: 45, areaMax: 71, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, vacancyDef: 6, rentSuggest: 1100, rentM2Min: 12, rentM2Max: 16, condominioMes: 220, appreciationDef: 4.0, appreciationNote: 'Bella Vista es uno de los corredores más demandados de Ciudad de Panamá. Valorización 4–6% anual. F1 con entrega inmediata ofrece plusvalía desde el primer día.', amenities: ['Piscina y área social', 'Gimnasio moderno', 'Lobby de diseño', 'Seguridad 24/7', 'Parqueo'], construction: 'Multi-fase · F1 entregada', priceM2Min: 2550, priceM2Max: 3300 },
  { name: 'Ventu', category: 'Proyecto de Ciudad', tipo: 'Hotelero', zone: 'Bella Vista — Ciudad de Panamá', zoneShort: 'Ventu / Bella Vista', investorType: 'patrimonial', entrega: 'Q2 2028', minPrice: 136000, maxPrice: 259000, areaMin: 40, areaMax: 63, bedrooms: '1 y 2 rec.', capRateMin: 8.0, capRateMax: 12.0, vacancyDef: 20, rentSuggest: 2400, rentM2Min: 0, rentM2Max: 0, condominioMes: 250, appreciationDef: 4.5, appreciationNote: 'Único proyecto hotelero optimizado para renta corta (Airbnb/Booking) en Bella Vista. Administración profesional incluida. 4–5% valorización anual.', amenities: ['Diseño Airbnb optimizado', 'Administración hotelera', 'Pool deck', 'Coworking', 'Check-in automático', 'Seguridad 24/7'], construction: 'En construcción (entrega Q2 2028)', priceM2Min: 2100, priceM2Max: 3200 },
  { name: 'Ocena', category: 'Proyecto de Ciudad', tipo: 'Residencia', zone: 'Santa María — Ciudad de Panamá', zoneShort: 'Ocena / Santa María', investorType: 'patrimonial', entrega: 'Q4 2027', minPrice: 446000, maxPrice: 1200000, areaMin: 100, areaMax: 270, bedrooms: '2 y 3 rec.', capRateMin: 4.7, capRateMax: 6.0, vacancyDef: 4, rentSuggest: 3500, rentM2Min: 20, rentM2Max: 25, condominioMes: 550, appreciationDef: 5.0, appreciationNote: 'Única comunidad con golf Jack Nicklaus en Santa María. Demanda de ejecutivos y familias expat. 5–7% valorización anual.', amenities: ['Golf 18 hoyos Jack Nicklaus', 'Club House', 'Piscinas resort', 'Pickleball y tenis', 'Co-working', 'Wellness center', 'Concierge'], construction: 'En construcción (entrega Q4 2027)', priceM2Min: 3200, priceM2Max: 5000 },
  { name: 'Ipanema', category: 'Proyecto de Ciudad', tipo: 'Residencia', zone: 'Costa Sur — Ciudad de Panamá', zoneShort: 'Ipanema / Costa Sur', investorType: 'disfrute', entrega: 'F1 Q1 2028 · F2 Q4 2028', minPrice: 283000, maxPrice: 519000, areaMin: 72, areaMax: 163, bedrooms: '1, 2 y 3 rec.', capRateMin: 6.0, capRateMax: 7.5, vacancyDef: 6, rentSuggest: 1600, rentM2Min: 12, rentM2Max: 18, condominioMes: 280, appreciationDef: 4.0, appreciationNote: 'Costa del Este es hub corporativo multinacional. Alta demanda de ejecutivos expat. 4–6% valorización anual.', amenities: ['Piscina con vista al mar', 'Gimnasio', 'Co-working', 'BBQ y lounge', 'Seguridad 24/7', 'Parque infantil'], construction: 'En construcción · F1 Q1 2028', priceM2Min: 2500, priceM2Max: 3800 },
  { name: 'Bosco', category: 'Proyecto de Ciudad', tipo: 'Residencia', zone: 'Santa María — Ciudad de Panamá', zoneShort: 'Bosco / Santa María', investorType: 'patrimonial', entrega: '2030', minPrice: 474000, maxPrice: 1100000, areaMin: 100, areaMax: 296, bedrooms: '2, 3 y 4 rec.', capRateMin: 5.5, capRateMax: 7.2, vacancyDef: 5, rentSuggest: 2800, rentM2Min: 13, rentM2Max: 18, condominioMes: 420, appreciationDef: 4.5, appreciationNote: 'Santa María en consolidación definitiva. Proyecto de lujo con jardines botánicos. 4–6% valorización anual.', amenities: ['Jardines botánicos', 'Piscina natural', 'Gimnasio', 'Senderos de meditación', 'Áreas sociales', 'Seguridad 24/7'], construction: 'En preventa (entrega 2030)', priceM2Min: 2800, priceM2Max: 4200 },
  { name: 'Panama Viejo Residence', category: 'Proyecto de Ciudad', tipo: 'Residencia', zone: 'Panamá Viejo — Ciudad de Panamá', zoneShort: 'Panama Viejo Residence', investorType: 'renta', entrega: 'ENTREGA INMEDIATA', minPrice: 160000, maxPrice: 182000, areaMin: 58, areaMax: 58, bedrooms: '2 rec.', capRateMin: 6.5, capRateMax: 8.0, vacancyDef: 6, rentSuggest: 950, rentM2Min: 10, rentM2Max: 14, condominioMes: 200, appreciationDef: 3.2, appreciationNote: 'Entrega inmediata con valorización consistente 3–5% anual impulsada por proximidad a Costa del Este.', amenities: ['Piscina y área social', 'Gimnasio', 'Coworking', 'Seguridad 24/7', 'Parque infantil'], construction: 'Entrega inmediata', priceM2Min: 2750, priceM2Max: 3140 },
  // ── OCEAN REEF ISLANDS ──────────────────────────────────────
  { name: 'The Palms', category: 'Ocean Reef Islands', tipo: 'Residencia', zone: 'Punta Pacífica — Ciudad de Panamá', zoneShort: 'The Palms / Punta Pacífica', investorType: 'patrimonial', entrega: 'ENTREGA INMEDIATA', minPrice: 1200000, maxPrice: 1400000, areaMin: 169, areaMax: 239, bedrooms: '2 rec.', capRateMin: 5.5, capRateMax: 7.0, vacancyDef: 4, rentSuggest: 5500, rentM2Min: 22, rentM2Max: 30, condominioMes: 700, appreciationDef: 5.5, appreciationNote: 'Isla artificial exclusiva con acceso a marina privada. Activo de mayor plusvalía del portafolio. 6–8% valorización anual.', amenities: ['Marina privada 180+ muelles', 'Yacht club', 'Piscinas infinity', 'Spa y wellness', 'Restaurantes', 'Beach club', 'Seguridad 24/7'], construction: 'Entrega inmediata', priceM2Min: 5020, priceM2Max: 5860 },
  { name: 'Ocean Reef Park', category: 'Ocean Reef Islands', tipo: 'Residencia', zone: 'Punta Pacífica — Ciudad de Panamá', zoneShort: 'Ocean Reef Park / Punta Pacífica', investorType: 'patrimonial', entrega: 'Q2 2028', minPrice: 1700000, maxPrice: 2100000, areaMin: 491, areaMax: 569, bedrooms: '3 y 4 rec.', capRateMin: 5.0, capRateMax: 6.5, vacancyDef: 4, rentSuggest: 9000, rentM2Min: 18, rentM2Max: 25, condominioMes: 900, appreciationDef: 6.0, appreciationNote: 'La unidad de mayor tamaño y valor del portafolio. Acceso directo al Johns Hopkins. 6–9% valorización anual.', amenities: ['Marina privada', 'Yacht club', 'Piscinas infinity', 'Helipuerto', 'Spa y wellness', 'Restaurantes', 'Club privado'], construction: 'En construcción (entrega Q2 2028)', priceM2Min: 3460, priceM2Max: 3690 },
  { name: 'O Club Residences', category: 'Ocean Reef Islands', tipo: 'Residencia', zone: 'Punta Pacífica — Ciudad de Panamá', zoneShort: 'O Club / Punta Pacífica', investorType: 'patrimonial', entrega: 'Q4 2027', minPrice: 1000000, maxPrice: 1400000, areaMin: 183, areaMax: 236, bedrooms: '2 rec.', capRateMin: 5.0, capRateMax: 6.5, vacancyDef: 4, rentSuggest: 5000, rentM2Min: 20, rentM2Max: 28, condominioMes: 750, appreciationDef: 5.5, appreciationNote: 'Isla artificial de Punta Pacífica. Acceso exclusivo a club privado y marina. 5–7% valorización.', amenities: ['Club privado O Club', 'Marina', 'Piscinas', 'Restaurantes', 'Spa', 'Seguridad 24/7'], construction: 'En construcción (entrega Q4 2027)', priceM2Min: 4230, priceM2Max: 5930 },
  // ── PLAYA CARACOL ───────────────────────────────────────────
  { name: 'Aires del Mar', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'Aires del Mar / Playa Caracol', investorType: 'renta', entrega: 'INMEDIATA · Q4 2026', minPrice: 143000, maxPrice: 207000, areaMin: 42, areaMax: 71, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.8, vacancyDef: 11, rentSuggest: 950, rentM2Min: 9, rentM2Max: 13, condominioMes: 180, appreciationDef: 3.5, appreciationNote: 'Producto de entrada a Playa Caracol. Alta demanda vacacional de colombianos y panameños. 3.5–5% valorización.', amenities: ['Vista al océano Pacífico', 'Piscinas', 'Parques infantiles', 'Jardines', 'Seguridad 24/7'], construction: 'Entrega inmediata / Q4 2026', priceM2Min: 2010, priceM2Max: 2915 },
  { name: 'The Tides', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'The Tides / Playa Caracol', investorType: 'disfrute', entrega: 'ENTREGA INMEDIATA', minPrice: 278000, maxPrice: 308000, areaMin: 99, areaMax: 99, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1500, rentM2Min: 10, rentM2Max: 16, condominioMes: 320, appreciationDef: 4.5, appreciationNote: 'Frente a playa de 1.2 km. Uno de los proyectos más nuevos en Playa Caracol. Valorización 4–6% anual.', amenities: ['1.2 km playa privada', 'Surf club', '3 piscinas', 'Restaurante y beach bar', 'Senderos naturales', 'Gimnasio', 'Seguridad 24/7'], construction: 'Entrega inmediata', priceM2Min: 2810, priceM2Max: 3110 },
  { name: 'Brisas del Mar', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'Brisas del Mar / Playa Caracol', investorType: 'renta', entrega: 'ENTREGA INMEDIATA', minPrice: 276000, maxPrice: 332000, areaMin: 93, areaMax: 108, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1300, rentM2Min: 9, rentM2Max: 13, condominioMes: 260, appreciationDef: 4.0, appreciationNote: 'Entrega inmediata con flujo de renta activo desde el primer mes. Playa Caracol lidera valorización en el Pacífico.', amenities: ['Frente al mar', 'Piscina', 'BBQ', 'Área social', 'Seguridad 24/7', 'Parque infantil'], construction: 'Entrega inmediata', priceM2Min: 2555, priceM2Max: 3080 },
  { name: 'Olas del Mar', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'Olas del Mar / Playa Caracol', investorType: 'renta', entrega: 'ENTREGA INMEDIATA', minPrice: 267000, maxPrice: 398000, areaMin: 69, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 6.0, capRateMax: 8.0, vacancyDef: 11, rentSuggest: 1050, rentM2Min: 8, rentM2Max: 12, condominioMes: 220, appreciationDef: 3.5, appreciationNote: 'Playa Caracol lidera valorización en el Pacífico panameño. Entrega inmediata. 4–6% anual en proyectos nuevos.', amenities: ['Piscina con vista al mar', 'Zona de BBQ', 'Área social', 'Seguridad 24/7', 'Parque infantil'], construction: 'Entrega inmediata', priceM2Min: 2750, priceM2Max: 3875 },
  { name: 'Surfside', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'Surfside / Playa Caracol', investorType: 'disfrute', entrega: 'ENTREGA INMEDIATA', minPrice: 314000, maxPrice: 413000, areaMin: 81, areaMax: 107, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1400, rentM2Min: 10, rentM2Max: 14, condominioMes: 300, appreciationDef: 4.0, appreciationNote: 'Frente al mar con componente aparthotel. Renta vacacional activa desde entrega inmediata. 4–5% anual.', amenities: ['Playa privada', 'Piscinas y jacuzzi', 'Restaurante y bar', 'Surf lounge', 'Gimnasio', 'Seguridad 24/7'], construction: 'Entrega inmediata', priceM2Min: 2930, priceM2Max: 3860 },
  { name: 'Beachwalk', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'Beachwalk / Playa Caracol', investorType: 'disfrute', entrega: 'Q1 2027', minPrice: 297000, maxPrice: 386000, areaMin: 85, areaMax: 97, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1300, rentM2Min: 9, rentM2Max: 14, condominioMes: 280, appreciationDef: 4.0, appreciationNote: 'Enfoque wellness frente al Pacífico. Entrega Q1 2027 — ventana de preventa activa. 4–5% valorización anual.', amenities: ['Frente al océano Pacífico', 'Wellness spa', 'Piscina paisajística', 'Gimnasio exterior', 'Yoga deck', 'BBQ', 'Seguridad 24/7'], construction: 'En construcción (entrega Q1 2027)', priceM2Min: 3060, priceM2Max: 3980 },
  { name: 'Seashore', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'Seashore / Playa Caracol', investorType: 'renta', entrega: 'Q4 2027', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.8, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1350, rentM2Min: 9, rentM2Max: 13, condominioMes: 270, appreciationDef: 4.0, appreciationNote: 'Amplio rango de área permite diversificación. Entrega Q4 2027. Valorización esperada 4–5% anual.', amenities: ['Vista al Pacífico', 'Piscina', 'Área social y BBQ', 'Gimnasio', 'Seguridad 24/7'], construction: 'En construcción (entrega Q4 2027)', priceM2Min: 2440, priceM2Max: 3870 },
  { name: 'Seashore Reserve', category: 'Playa Caracol', tipo: 'Residencia', zone: 'Playa Caracol, Chame — Pacífico', zoneShort: 'Seashore Reserve / Playa Caracol', investorType: 'renta', entrega: 'Q4 2028', minPrice: 290000, maxPrice: 490000, areaMin: 84, areaMax: 150, bedrooms: '2 y 3 rec.', capRateMin: 5.5, capRateMax: 7.5, vacancyDef: 10, rentSuggest: 1350, rentM2Min: 9, rentM2Max: 13, condominioMes: 270, appreciationDef: 4.5, appreciationNote: 'Versión Reserve con acabados superiores. Mayor plusvalía por preventa larga. 4.5–6% valorización anual.', amenities: ['Vista Pacífico reservada', 'Club de playa', 'Piscinas', 'Wellness area', 'Seguridad 24/7'], construction: 'En preventa (entrega Q4 2028)', priceM2Min: 2440, priceM2Max: 3870 },
];

// ── ZONE FOOTNOTES HELPER ─────────────────────────────────────
const getZoneNotes = (zone: string) => {
  const z = zone.toLowerCase();
  if (z.includes('punta pacífica') || z.includes('punta pacifica') || z.includes('islas')) {
    return 'Nota de la Zona (Punta Pacífica/Islas): Exclusivo sector con acceso directo al Hospital Johns Hopkins, el centro comercial Multiplaza, y conectividad vial inmediata al Corredor Sur.';
  } else if (z.includes('santa maría') || z.includes('santa maria') || z.includes('costa del este')) {
    return 'Nota de la Zona (Santa María/Costa del Este): Importante centro corporativo multinacional con canchas de golf diseñadas por Jack Nicklaus, colegios de primer nivel, y alta demanda de ejecutivos expatriados.';
  } else if (z.includes('caracol') || z.includes('chame')) {
    return 'Nota de la Zona (Playa Caracol): Playa privada de 1.2 km, escuela de surf, y cercanía al centro de servicios y salud de Coronado (a 20 minutos).';
  } else if (z.includes('dorada') || z.includes('arraiján') || z.includes('arraijan') || z.includes('pacífico') || z.includes('pacifico')) {
    return 'Nota de la Zona (Playa Dorada/Arraiján): Rápido acceso a Panamáá Pacífico, el Puente de las Américas y la futura Línea 3 del Metro, con fuerte desarrollo logístico y residencial.';
  }
  return '';
};

// ── INVESTOR PROFILES ─────────────────────────────────────────
const INVESTOR_PROFILES = [
  { id: 'renta', label: 'Renta', desc: 'Flujo de caja máximo en USD', color: T.palm, projects: ['Panama Viejo Residence', 'Armonía', 'Aires del Mar', 'Brisas del Mar', 'Olas del Mar', 'Seashore', 'Seashore Reserve'] },
  { id: 'disfrute', label: 'Disfrute', desc: 'Segunda residencia con renta', color: T.sky, projects: ['The Tides', 'Surfside', 'Beachwalk', 'Ipanema'] },
  { id: 'patrimonial', label: 'Patrimonial', desc: 'Plusvalía y preservación de capital', color: T.coral, projects: ['Ocean Reef Park', 'O Club Residences', 'The Palms', 'Bosco', 'Ocena', 'Ventu'] },
];

// ── PROJECT IMAGES MAP ────────────────────────────────────────
const PROJECT_IMAGES: Record<string, { main: string; gallery: string[] }> = {
  'Ocean Reef Park': { main: 'https://glp.com.pa/wp-content/uploads/2026/05/ocean_reef.webp', gallery: ['https://glp.com.pa/wp-content/uploads/2026/05/ocean_reef.webp', 'https://glp.com.pa/wp-content/uploads/2025/07/apartamentos-de-lujo-en-panama-1.webp'] },
  'Oceana Residences & Skyhomes': { main: '/img/projects/oceana.jpg', gallery: ['/img/projects/oceana-g_1.jpg', '/img/projects/oceana-g_2.jpg', '/img/projects/oceana-g_3.jpg'] },
  'Bosco di Santa María': { main: 'https://glp.com.pa/wp-content/uploads/2026/05/casabosco.webp', gallery: ['https://glp.com.pa/wp-content/uploads/2026/05/casabosco.webp', 'https://glp.com.pa/wp-content/uploads/2026/05/bosco-torres.webp', 'https://glp.com.pa/wp-content/uploads/2025/11/bosco.webp', 'https://glp.com.pa/wp-content/uploads/2026/03/palada-bosco-di-santa-maria.jpg'] },
  'The Palms': { main: '/img/projects/the-palms.jpg', gallery: ['/img/projects/the-palms-g_1.jpg'] },
  'Ventu': { main: 'https://glp.com.pa/wp-content/uploads/2026/05/armonia-1.webp', gallery: ['https://glp.com.pa/wp-content/uploads/2026/05/armonia-1.webp', 'https://glp.com.pa/wp-content/uploads/2025/07/apartamentos-de-lujo-en-panama-1.webp'] },
  'Ipanema Panamáá': { main: '/img/projects/ipanema.jpg', gallery: ['/img/projects/ipanema-g_1.jpg', '/img/projects/ipanema-g_2.jpg', '/img/projects/ipanema-g_3.jpg'] },
  'Panamáa Viejo Residences': { main: '/img/projects/panama-viejo.jpg', gallery: ['/img/projects/panama-viejo-g_1.jpg', '/img/projects/panama-viejo-g_2.jpg', '/img/projects/panama-viejo-g_3.jpg'] },
  'Bayside Resort Panamáá': { main: '/img/projects/bayside.jpg', gallery: ['/img/projects/bayside-g_1.jpg', '/img/projects/bayside-g_2.jpg', '/img/projects/bayside-g_3.jpg'] },
  'The Tides – Playa Caracol': { main: '/img/projects/the-tides.jpg', gallery: ['/img/projects/the-tides-g_1.jpg', '/img/projects/the-tides-g_2.jpg', '/img/projects/the-tides-g_3.jpg'] },
  'Surfside': { main: '/img/projects/surfside.jpg', gallery: ['/img/projects/surfside-g_1.jpg', '/img/projects/surfside-g_2.jpg', '/img/projects/surfside-g_3.jpg'] },
  'BeachWalk Resort Playa Caracol': { main: '/img/projects/beachwalk.jpg', gallery: ['/img/projects/beachwalk-g_1.jpg', '/img/projects/beachwalk-g_2.jpg', '/img/projects/beachwalk-g_3.jpg'] },
  'Playa Dorada': { main: '/img/projects/playa-dorada.jpg', gallery: ['/img/projects/playa-dorada-g_1.jpg', '/img/projects/playa-dorada-g_2.jpg', '/img/projects/playa-dorada-g_3.jpg'] },
  'Ocean Front': { main: '/img/projects/ocean-front.jpg', gallery: ['/img/projects/ocean-front-g_1.jpg', '/img/projects/ocean-front-g_2.jpg', '/img/projects/ocean-front-g_3.jpg'] },
  'Olas del Mar': { main: '/img/projects/olas-del-mar.jpg', gallery: ['/img/projects/olas-del-mar-g_1.jpg', '/img/projects/olas-del-mar-g_2.jpg', '/img/projects/olas-del-mar-g_3.jpg'] },
  'Aires del Mar – Playa Caracol': { main: '/img/projects/aires-del-mar.jpg', gallery: ['/img/projects/aires-del-mar-g_1.jpg', '/img/projects/aires-del-mar-g_2.jpg', '/img/projects/aires-del-mar-g_3.jpg'] },
};

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
  { id: 1, prospect: 'Carlos Gómez', project: 'Panamáa Viejo Residences', value: 120000, broker: 'Patricia Vargas', date: '2026-05-12' },
  { id: 2, prospect: 'Diana Herrera', project: 'Panamáa Viejo Residences', value: 140000, broker: 'Patricia Vargas', date: '2026-03-01' },
  { id: 3, prospect: 'Roberto Castaño', project: 'Surfside', value: 220000, broker: 'Felipe Londoño', date: '2026-05-28' },
  { id: 4, prospect: 'Martha Ruiz', project: 'The Palms', value: 350000, broker: 'Santiago Mesa', date: '2026-04-18' },
  { id: 5, prospect: 'Juan Pérez', project: 'Bayside Resort Panamáá', value: 150000, broker: 'Valentina Ospina', date: '2026-05-22' },
  { id: 6, prospect: 'Eduardo Silva', project: 'Oceana Residences & Skyhomes', value: 730000, broker: 'Andrés Morales', date: '2026-06-05' }
];

const INITIAL_LOST_SALES: LostSale[] = [
  { id: 1, prospect: 'Juan Carlos Restrepo', project: 'Ocean Reef Park', value: 1500000, broker: 'Patricia Vargas', reason: 'Temor a doble tributación y reporte automático a la DIAN', date: '2026-05-14' },
  { id: 2, prospect: 'Carolina Posada', project: 'Ventu', value: 180000, broker: 'Santiago Mesa', reason: 'Tasas de interés hipotecarias altas para extranjeros (8.5%)', date: '2026-05-20' },
  { id: 3, prospect: 'Miguel Ángel Uribe', project: 'Bayside Resort Panamáá', value: 150000, broker: 'Rodrigo Fernández', reason: 'Incertidumbre sobre los trámites migratorios y visa de inversionista', date: '2026-05-25' },
  { id: 4, prospect: 'Sofia Jaramillo', project: 'Ipanema Panamáá', value: 280000, broker: 'Valentina Ospina', reason: 'Temor de devaluación y liquidez del dólar en el exterior', date: '2026-06-02' }
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
export type EmailThreadItem = {
  id: string;
  date: string;
  subject: string;
  body: string;
  status: 'incoming' | 'draft' | 'sent';
  direction: 'in' | 'out';
};

export type AgentDraft = {
  id: string;
  date: string;
  content: string;
  type: string;
  status: 'pending' | 'approved' | 'active';
  canal?: string;
  asunto?: string;
  contexto?: string;
  tags?: string[];
  aprobado_por?: string;
  fecha_aprobacion?: string;
  notas_admin?: string;
};

type GlpBrandProfile = {
  audiencias: string[];
  tonos: string[];
  objetivos: string[];
  objeciones: string[];
  activos_visuales: string[];
  diferenciadores: string[];
  hashtags_instagram: string[];
  hashtags_linkedin: string[];
  hashtags_whatsapp: string[];
  cta_principal: string;
  propuesta_valor: string;
  notas_adicionales: string;
};

const DEFAULT_BRAND_PROFILE: GlpBrandProfile = {
  audiencias: [
    'Colombianos 35-55 años con capital disponible ($50K-$500K USD)',
    'Empresarios e independientes que buscan dolarizar patrimonio',
    'Inversionistas con experiencia en finca raíz local buscando diversificar',
    'Profesionales jóvenes 28-38 aspiracionales (primera inversión internacional)',
  ],
  tonos: [
    'Experto y sólido en lo financiero (datos duros, % reales, cifras)',
    'Aspiracional y visual en el gancho (imágenes mentales de vida y libertad)',
    'Directo y sin adornos — confianza sin arrogancia',
    'Sofisticado pero accesible — no corporativo genérico',
  ],
  objetivos: [
    'Construir autoridad y confianza antes de vender',
    'Generar leads directos (DM / link en bio / formulario)',
    'Nutrir prospectos ya en el CRM (top-of-mind)',
    'Rebatir objeciones sin mencionarlas directamente',
  ],
  objeciones: [
    '¿Es seguro llevar plata a otro país? → Panamá dolarizado, banca top-10 mundial, Ley de Exención Predial',
    '¿Cómo lo manejo con la DIAN? → Activos en el exterior son legales y declarables; GLP asesora',
    '¿Y si el proyecto no se entrega? → Solo constructores con historial verificado y fiducia de garantía',
    '¿Puedo usarlo o es solo para arrendar? → Doble beneficio: uso propio + renta garantizada',
  ],
  activos_visuales: [
    'Renders y fotos profesionales de proyectos (Ocean Reef Park, Ventu, Santa María, Playa Caracol)',
    'Video drone de zonas: Punta Pacífica, Costa del Este, Playa Caracol',
    'Fotos del equipo en eventos y reuniones con clientes',
    'Infografías de rentabilidad y comparativas de mercado',
  ],
  diferenciadores: [
    'Exención predial por 20 años en todos los proyectos nuevos',
    'Rentabilidad neta superior al 8% anual en USD',
    'Panamá dolarizado — sin riesgo cambiario',
    'GLP solo trabaja proyectos con fiducia de garantía',
    'Asesoría integral: desde selección hasta declaración en Colombia',
  ],
  hashtags_instagram: [
    '#GLP', '#PanamaRealEstate', '#InversionInmobiliaria', '#DolarizaTuPatrimonio',
    '#PanamáInversión', '#WealthManagement', '#InversionEnDolares', '#GlpWealthManagement',
    '#OceanReefPark', '#VentuPanama', '#PuntaPacifica', '#CostaDelEste',
    '#LibertadFinanciera', '#InvierteEnPanama', '#PatrimonioEnDolares',
  ],
  hashtags_linkedin: [
    '#InversionInmobiliaria', '#WealthManagement', '#PanamaRealEstate', '#GLP',
    '#PatrimonioDolarizado', '#RealEstatePanama', '#InversionInternacional',
    '#FinanzasPersonales', '#Inmobiliaria', '#InversionInteligente',
  ],
  hashtags_whatsapp: [],
  cta_principal: 'Escríbenos PANAMÁ al DM y te enviamos el análisis completo de rentabilidad',
  propuesta_valor: 'GLP Wealth Management conecta a inversionistas colombianos con los mejores proyectos inmobiliarios de Panamá: rentabilidad en dólares, exención predial por 20 años y acompañamiento integral desde la compra hasta la declaración tributaria en Colombia.',
  notas_adicionales: '',
};

type HistEntry = { fecha: string; accion: string; detalle: string };
type Prospect = {
  id: number; nombre: string; apellido: string; direccion: string;
  correo: string; telefono: string; ocupacion: string;
  proyectos_interes: string[]; forma_contacto: string;
  broker_asignado: string; estado: string; presupuesto_usd: number;
  notas: string; historial: HistEntry[];
  fecha_entrada: string;
  emailHistory?: EmailThreadItem[];
};

const FUNNEL_STAGES = ['Contacto Inicial', 'Calificación', 'Presentación', 'Negociación', 'Cierre', 'Post-venta'];
const CONTACT_FORMS = ['Broker', 'Pagina Web', 'LinkedIn', 'TikTok', 'Instagram', 'WhatsApp', 'Evento', 'Referido'];

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
  { id: 1, titulo: 'GLP Investment Evening #1', venue: 'Club El Nogal, Bogotáá', fecha: '2026-05-10', proyectos_presentados: ['Ocean Reef Park', 'The Palms', 'Panamáa Viejo Residences', 'The Tides – Playa Caracol'], asistentes: ['Carlos Gutiérrez', 'María Isabel Rodríguez', 'Andrés Felipe Martínez'], proyectos_interes: ['Ocean Reef Park', 'The Palms', 'Panamáa Viejo Residences'], presupuesto_asignado: 15000, presupuesto_ejecutado: 12800, items_costo: [{ concepto: 'Salón y montaje', valor: 4500 }, { concepto: 'Catering premium (60 pax)', valor: 3600 }, { concepto: 'Audiovisual y pantallas', valor: 1800 }, { concepto: 'Material impreso y brochures', valor: 1200 }, { concepto: 'Vinos y bebidas premium', valor: 1200 }, { concepto: 'Fotografía y video', valor: 500 }] },
  { id: 2, titulo: 'Seminario Inversión Dolarizada', venue: 'Hotel JW Marriott Bogotáá', fecha: '2026-07-15', proyectos_presentados: ['Oceana Residences & Skyhomes', 'Bosco di Santa María', 'Ipanema Panamáá', 'Surfside'], asistentes: ['Laura Sánchez', 'Roberto Castaño'], proyectos_interes: ['Oceana Residences & Skyhomes', 'Surfside'], presupuesto_asignado: 20000, presupuesto_ejecutado: 8500, items_costo: [{ concepto: 'Salón conferencias (100 pax)', valor: 5500 }, { concepto: 'Coffee break y almuerzo', valor: 4200 }, { concepto: 'Speaker internacional (viáticos)', valor: 3500 }, { concepto: 'Material técnico impreso', valor: 1500 }, { concepto: 'Publicidad digital pre-evento', valor: 2800 }, { concepto: 'Señalización y decoración', valor: 1000 }, { concepto: 'Registro y tecnología', valor: 1500 }] },
];

// ── FAQ DATA ──────────────────────────────────────────────────
type FAQ = { id: number; categoria: string; pregunta: string; respuesta: string };

const FAQ_CATEGORIES = ['Estabilidad Macroeconómica', 'Financiero y Retornos', 'Fiscal', 'Migratorio'];

const INITIAL_FAQS: FAQ[] = [
  // Estabilidad Macroeconómica
  { id: 1, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Panamáá es un país estable para invertir?', respuesta: 'Panamáá es una de las economías más estables de América Latina. El país utiliza el dólar estadounidense como moneda de curso legal desde 1904, eliminando el riesgo cambiario. Su PIB ha crecido consistentemente por encima del promedio regional, con una tasa promedio del 5% anual en la última década. El Canal de Panamáá genera ingresos recurrentes que sostienen las finanzas públicas.' },
  { id: 2, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cómo se compara la inflación de Panamáá con la de Colombia?', respuesta: 'Panamáá mantiene una inflación promedio del 1-2% anual, significativamente menor que Colombia que ha experimentado picos superiores al 13% en años recientes. Al estar dolarizado, Panamáá no sufre devaluaciones de moneda local. Esto protege el poder adquisitivo de la inversión y garantiza que las rentas en USD mantengan su valor real a lo largo del tiempo.' },
  { id: 3, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Qué tan seguro es el sistema bancario panameño?', respuesta: 'El Centro Bancario Internacional de Panamáá cuenta con más de 70 bancos de 30 países, con activos totales superiores a USD 130 mil millones. La Superintendencia de Bancos de Panamáá regula con estándares internacionales de Basilea III. Los depósitos hasta USD 10,000 están protegidos por el Fondo de Garantía de Depósitos. El sistema es robusto, líquido y altamente regulado.' },
  { id: 4, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Existe riesgo político en Panamáá?', respuesta: 'Panamáá ha mantenido una democracia estable e ininterrumpida desde 1989. Las transiciones de poder han sido pacíficas y el marco jurídico respeta la propiedad privada extranjera. La Constitución garantiza los mismos derechos de propiedad a nacionales y extranjeros. El país mantiene grado de inversión (investment grade) por las principales calificadoras internacionales.' },
  { id: 5, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cómo afecta el Canal de Panamáá a la economía del país?', respuesta: 'El Canal de Panamáá es el motor económico principal del país, generando más de USD 3 mil millones anuales en ingresos directos. Esto representa aproximadamente el 6% del PIB panameño. El Canal impulsa sectores como logística, banca, comercio y turismo, creando una economía diversificada. La ampliación del Canal completada en 2016 duplicó su capacidad y asegura ingresos crecientes por las próximas décadas.' },
  { id: 6, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cómo está el mercado inmobiliario panameño actualmente?', respuesta: 'El mercado inmobiliario panameño muestra señales sólidas de recuperación post-pandemia. El sector construcción creció 29.3% interanual en enero 2026 según el INEC. El precio promedio por m² en Ciudad de Panamáá es USD 1,804, con zonas premium entre USD 2,700 y USD 4,150/m². La demanda de expatriados y trabajadores remotos ha impulsado el segmento de alquiler con una rentabilidad bruta promedio del 7.8% anual.' },
  { id: 7, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Cuánto capital colombiano fluye hacia Panamáá?', respuesta: 'Según datos del Banco de la República de Colombia, USD 208 millones de capital colombiano fluyeron hacia Panamáá solo en el tercer trimestre de 2025. Colombia es consistentemente uno de los mayores inversores en finca raíz panameña. La conectividad aérea directa Bogotáá-Panamáá (2.5 horas) y los lazos culturales facilitan esta tendencia. El corredor de inversión Colombia-Panamáá se fortalece cada año.' },
  { id: 8, categoria: 'Estabilidad Macroeconómica', pregunta: '¿Panamáá es un hub logístico relevante a nivel mundial?', respuesta: 'Panamáá es el hub logístico más importante de las Américas. Además del Canal, cuenta con la Zona Libre de Colón (la segunda zona franca más grande del mundo), el Hub de las Américas (aeropuerto de Tocumen como centro de conexiones), y uno de los puertos de contenedores más activos de Latinoamérica. Esta infraestructura genera demanda permanente de vivienda para ejecutivos internacionales y trabajadores del sector.' },

  // Financiero y Retornos
  { id: 9, categoria: 'Financiero y Retornos', pregunta: '¿Qué rentabilidad puedo esperar de una inversión inmobiliaria en Panamáá?', respuesta: 'Las rentabilidades brutas del portafolio GLP oscilan entre 5% y 8.5% anual en USD, dependiendo del proyecto y tipo de inversión. Los proyectos urbanos como Panamáa Viejo Residences ofrecen cap rates de 6.5-8%, mientras que los premium como Ocean Reef Park ofrecen 5-6.5% compensados por mayor plusvalía. Comparado con un CDT en Colombia al 10.5% en COP, la inversión en Panamáá ofrece estabilidad en dólares sin riesgo de devaluación.' },
  { id: 10, categoria: 'Financiero y Retornos', pregunta: '¿Cuál es el ticket mínimo de inversión?', respuesta: 'El portafolio GLP tiene opciones desde USD 120,000 (Panamáa Viejo Residences) hasta USD 1,500,000+ (Ocean Reef Park). La mayoría de proyectos permiten cuotas iniciales desde el 30%, con financiamiento bancario panameño para el saldo. Para un inversionista colombiano promedio de alto patrimonio, el ticket de entrada más común está entre USD 180,000 y USD 350,000 con una cuota inicial del 50%.' },
  { id: 11, categoria: 'Financiero y Retornos', pregunta: '¿Cómo funciona el financiamiento bancario en Panamáá?', respuesta: 'Los bancos panameños financian extranjeros hasta el 70% del valor del inmueble. La tasa base es aproximadamente 7.5% anual, más una sobretasa de 1% para extranjeros, resultando en ~8.5% efectivo. Los plazos van de 5 a 30 años con amortización francesa. Se requiere: pasaporte vigente, estados financieros de 2 años, carta laboral o certificación de ingresos, y referencia bancaria. El proceso toma aproximadamente 30-45 días.' },
  { id: 12, categoria: 'Financiero y Retornos', pregunta: '¿Qué gastos operativos tiene una propiedad en Panamáá?', respuesta: 'Los gastos operativos típicos incluyen: fee de property management (USD 150/mes con GLP), administración delegada (10% de la renta bruta), condominio (varía por proyecto, USD 170-700/mes), seguro anual (~USD 1,200), y mantenimiento (1% del valor del activo anual). El impuesto predial está exonerado por 20 años en proyectos nuevos. No hay impuesto patrimonial ni impuesto a ganancias de capital para personas naturales no residentes.' },
  { id: 13, categoria: 'Financiero y Retornos', pregunta: '¿Qué es la exención predial de 20 años?', respuesta: 'Panamáá ofrece una exención total del impuesto de inmuebles (predial) durante 20 años para proyectos de construcción nueva. Esto aplica a todos los proyectos del portafolio GLP. En comparación, en Colombia el predial puede representar entre 0.3% y 1.2% del valor catastral anualmente. Esta exención mejora significativamente el NOI (Net Operating Income) y el cap rate neto del inversionista durante dos décadas completas.' },
  { id: 14, categoria: 'Financiero y Retornos', pregunta: '¿Cuál es la valorización esperada de los proyectos GLP?', respuesta: 'La valorización promedio del portafolio GLP oscila entre 3% y 5.5% anual en USD. Los proyectos urbanos como Panamáa Viejo muestran 3-4% anual estable, mientras que los premium como Ocean Reef Islands han documentado 6-8% anual por la escasez absoluta de producto comparable. La zona de Playa Caracol muestra 4-6% anual para proyectos nuevos. Estas cifras se comparan favorablemente con la inflación del dólar (2-3% anual).' },
  { id: 15, categoria: 'Financiero y Retornos', pregunta: '¿Puedo generar ingresos por Airbnb en Panamáá?', respuesta: 'Sí. El proyecto Ventu de GLP está específicamente diseñado para rentas cortas tipo Airbnb/Booking.com, con cap rates estimados de 8-12% anual. Incluye administración hotelera delegada con check-in automático. Las tarifas promedio en Ciudad de Panamáá son USD 120-180 por noche. La temporada alta (diciembre-abril) puede elevar las tarifas un 30-50%. Se estima una vacancia del 20% anual promedio en el modelo de rentas cortas.' },
  { id: 16, categoria: 'Financiero y Retornos', pregunta: '¿Cómo se compara invertir en Panamáá versus invertir en un CDT colombiano?', respuesta: 'Un CDT colombiano ofrece ~10.5% nominal en COP, pero al ajustar por devaluación del peso (históricamente 5-8% anual contra el USD) y retención en la fuente, el retorno real en dólares puede ser negativo. Una inversión GLP genera 5-8% en USD puro más valorización de 3-5.5% anual, sin riesgo cambiario. A 10 años, la inversión en Panamáá genera patrimonio en moneda dura con diversificación geográfica.' },

  // Fiscal
  { id: 17, categoria: 'Fiscal', pregunta: '¿Debo declarar mi inversión en Panamáá ante la DIAN?', respuesta: 'Sí. Todo residente fiscal colombiano debe declarar activos en el exterior superiores a 3,580 UVT (aproximadamente COP 170 millones en 2026). Esto incluye inmuebles en Panamáá. La declaración se realiza en el Formulario 160 (Declaración de Activos en el Exterior) y en la declaración de renta anual. Colombia Tax Law Group acompaña a cada inversionista GLP en este proceso para garantizar cumplimiento total con la DIAN.' },
  { id: 18, categoria: 'Fiscal', pregunta: '¿Hay doble tributación entre Colombia y Panamáá?', respuesta: 'Colombia y Panamáá NO tienen un Convenio para Evitar la Doble Imposición (CDI) vigente. Sin embargo, Panamáá opera bajo un sistema territorial: solo grava ingresos generados dentro de su territorio. Esto significa que las rentas de alquiler en Panamáá se gravan localmente (0% para personas naturales no residentes en la mayoría de casos), y en Colombia se declaran como rentas de fuente extranjera con crédito tributario si aplica.' },
  { id: 19, categoria: 'Fiscal', pregunta: '¿Cómo transfiero mis dólares legalmente a Panamáá?', respuesta: 'La transferencia se realiza a través del mercado cambiario formal colombiano. Se debe diligenciar la Declaración de Cambio (Formulario 4) ante el intermediario del mercado cambiario (banco). Para montos superiores a USD 10,000, se requiere registro ante el Banco de la República. La Resolución DIAN 204/2025 establece los lineamientos actualizados. Colombia Tax Law Group gestiona todo el proceso documental con el inversionista para que sea fluido y sin fricciones bancarias.' },
  { id: 20, categoria: 'Fiscal', pregunta: '¿Panamáá cobra impuesto a las ganancias de capital?', respuesta: 'Para la venta de inmuebles, Panamáá aplica un impuesto del 2% sobre el valor de venta (no sobre la ganancia). Alternativamente, el vendedor puede optar por tributar al 10% sobre la ganancia neta si le resulta más favorable. No existe impuesto patrimonial ni impuesto a la herencia en Panamáá. La estructura a través de una Sociedad Anónima panameña o Fundación de Interés Privado puede optimizar aún más la carga fiscal y facilitar la sucesión.' },
  { id: 21, categoria: 'Fiscal', pregunta: '¿Qué estructura jurídica recomienda GLP para la inversión?', respuesta: 'GLP, en conjunto con Colombia Tax Law Group, recomienda evaluar tres estructuras: (1) Persona natural directa — más simple, ideal para primer ticket; (2) Sociedad Anónima panameña — facilita sucesión y permite privacidad; (3) Fundación de Interés Privado — óptima para planificación patrimonial y sucesoral de familias HNWI. La elección depende del patrimonio total, los objetivos sucesorales y la situación tributaria específica del inversionista.' },
  { id: 22, categoria: 'Fiscal', pregunta: '¿Puedo deducir gastos de la inversión panameña en mi declaración colombiana?', respuesta: 'Las rentas de fuente extranjera se declaran en Colombia con posibilidad de aplicar crédito tributario por impuestos pagados en el exterior (Art. 254 E.T.). Los gastos directamente relacionados con la generación de la renta (administración, seguros, mantenimiento) son deducibles bajo las reglas generales. Colombia Tax Law Group prepara la documentación soporte para maximizar las deducciones permitidas y optimizar la carga tributaria global del inversionista.' },
  { id: 23, categoria: 'Fiscal', pregunta: '¿Qué sucede si no declaro mi inversión en Panamáá?', respuesta: 'La omisión de activos en el exterior ante la DIAN puede generar sanciones por inexactitud (100-160% del mayor valor del impuesto), sanciones por omisión de la declaración de activos (5% del valor de los activos no declarados por año), e incluso consecuencias penales por evasión fiscal. Con el intercambio automático de información (CRS/FATCA) entre Panamáá y Colombia, la DIAN tiene acceso a información financiera de cuentas colombianas en Panamáá. La transparencia total es la única estrategia viable.' },
  { id: 24, categoria: 'Fiscal', pregunta: '¿GLP me ayuda con todo el proceso fiscal?', respuesta: 'Sí. La alianza tripartita GLP incluye a Colombia Tax Law Group como socio fiscal y legal. Ellos acompañan al inversionista desde la primera transferencia hasta la declaración de renta anual. El servicio incluye: estructuración de la inversión, proceso de declaración de cambio, declaración de activos en el exterior, declaración de renta con rentas de fuente extranjera, y asesoría en planificación patrimonial y sucesoral. El costo del servicio legal-fiscal se acuerda directamente con Colombia Tax Law Group.' },

  // Migratorio
  { id: 25, categoria: 'Migratorio', pregunta: '¿Puedo obtener residencia panameña al invertir en propiedad?', respuesta: 'Sí. Panamáá ofrece la Visa de Inversionista Calificado para extranjeros que inviertan un mínimo de USD 300,000 en bienes raíces. Esta visa otorga residencia permanente para el titular y dependientes (cónyuge e hijos menores). El proceso toma aproximadamente 30-60 días una vez presentada la documentación completa. GLP facilita el contacto con abogados migratorios panameños especializados en el trámite.' },
  { id: 26, categoria: 'Migratorio', pregunta: '¿La residencia panameña me obliga a vivir en Panamáá?', respuesta: 'No. La residencia panameña no requiere presencia física permanente. Sin embargo, para mantener el estatus activo, se recomienda visitar Panamáá al menos una vez cada dos años. La residencia panameña no afecta la residencia fiscal colombiana siempre que se mantengan los criterios de permanencia (más de 183 días en Colombia). Es un segundo pasaporte de conveniencia que facilita trámites bancarios, inmobiliarios y empresariales en Panamáá.' },
  { id: 27, categoria: 'Migratorio', pregunta: '¿Cuáles son los beneficios de la residencia panameña?', respuesta: 'La residencia panameña ofrece: apertura de cuentas bancarias locales con mayor facilidad, acceso a financiamiento hipotecario en condiciones preferenciales, cédula panameña que facilita trámites, posibilidad de establecer empresas en Panamáá, acceso al sistema de salud panameño, beneficios migratorios para viajes a terceros países, y eventualmente la posibilidad de obtener la ciudadanía panameña después de 5 años de residencia.' },
  { id: 28, categoria: 'Migratorio', pregunta: '¿Qué documentos necesito para la visa de inversionista?', respuesta: 'Los documentos principales son: pasaporte vigente con mínimo 6 meses de validez, antecedentes penales apostillados del país de origen, certificado de salud, referencias bancarias personales (2), carta de motivación, comprobante de la inversión inmobiliaria (escritura o promesa de compraventa por mínimo USD 300,000), y poder notarial para el abogado tramitador. Todos los documentos deben estar apostillados y, si aplica, traducidos al español por un traductor oficial.' },
  { id: 29, categoria: 'Migratorio', pregunta: '¿Puedo incluir a mi familia en la visa de inversionista?', respuesta: 'Sí. La Visa de Inversionista Calificado permite incluir dependientes: cónyuge, hijos menores de 18 años, e hijos hasta 25 años que demuestren dependencia económica y estar estudiando. Cada dependiente requiere su propia documentación (pasaporte, antecedentes, certificado de salud). El costo adicional por dependiente es relativamente menor comparado con el titular. La familia completa obtiene residencia permanente en Panamáá.' },
  { id: 30, categoria: 'Migratorio', pregunta: '¿Puedo trabajar en Panamáá con la visa de inversionista?', respuesta: 'La Visa de Inversionista Calificado permite actividades empresariales propias pero NO permite empleo dependiente con un empleador panameño. Si el inversionista desea trabajar como empleado, necesitaría un permiso de trabajo adicional. Sin embargo, puede establecer empresas propias, recibir ingresos de alquiler, y realizar actividades de inversión sin restricciones. Muchos inversionistas colombianos utilizan Panamáá como base para operaciones empresariales regionales.' },
  { id: 31, categoria: 'Migratorio', pregunta: '¿Existe el Programa de Pensionado en Panamáá?', respuesta: 'Sí. El Programa de Pensionado Especial de Panamáá es uno de los más atractivos del mundo. Requiere demostrar una pensión mensual mínima de USD 1,000 (o USD 750 si se compra propiedad por USD 100,000+). Beneficios: descuentos del 25% en servicios públicos, 25% en pasajes aéreos, 50% en entretenimiento, 25% en restaurantes, y 15% en préstamos hospitalarios. Es ideal para colombianos jubilados que buscan calidad de vida en dólares con un costo inferior al de ciudades como Bogotáá o Miami.' },
  { id: 32, categoria: 'Migratorio', pregunta: '¿GLP me ayuda con todo el proceso migratorio?', respuesta: 'GLP conecta al inversionista con abogados migratorios panameños de confianza que gestionan todo el trámite de principio a fin. El proceso incluye: evaluación de elegibilidad, preparación de documentación, presentación ante el Servicio Nacional de Migración, seguimiento del trámite, y entrega de la cédula panameña. GLP no cobra por la referencia — el costo del servicio se acuerda directamente entre el inversionista y el abogado. El proceso típico toma 30-60 días.' },
];

// ── MODULE DEFINITIONS ────────────────────────────────────────
const MODULES = [
  { id: 'portafolio', label: 'Portafolio GLP' },
  { id: 'catalogo', label: 'Carga de Catálogo de Proyectos' },
  { id: 'kpis', label: 'Dashboard KPIs' },
  { id: 'brokers', label: 'Brokers' },
  { id: 'prospectos', label: 'Prospectos' },
  { id: 'eventos', label: 'Presupuesto Eventos' },
  { id: 'agentes', label: 'Agentes IA' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'calculadora', label: 'Calculadora Inmobiliaria' },
  { id: 'configuracion', label: 'Configuración' },
];

const getAdminUsers = () => {
  const usersSaved = localStorage.getItem('glp_crm_users');
  if (usersSaved) {
    try {
      return JSON.parse(usersSaved);
    } catch (e) {
      console.error(e);
    }
  }
  const defaultUsers = [{ username: 'admin', password: 'admin123', name: 'Administrador Principal' }];
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
  const [activeModule, setActiveModule] = useState('portafolio');

  // ── Authentication States ──
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return sessionStorage.getItem('glp_crm_logged_user');
  });

  // ── Module States ───────────────────────────────────────────
  const [closedSales, setClosedSales] = useState<Sale[]>(INITIAL_CLOSED_SALES);
  const [lostSales, setLostSales] = useState<LostSale[]>(INITIAL_LOST_SALES);
  const [activeDrilldown, setActiveDrilldown] = useState<{
    type: 'ticket' | 'conversion' | 'funnel' | 'source' | 'prospect' | 'broker' | 'prospects_total' | 'brokers_active' | 'presupuesto' | 'camilo_prospects' | 'sara_history';
    stage?: string;
    source?: string;
    id?: number;
  } | null>(null);

  // Portafolio
  const [portFilter, setPortFilter] = useState('all');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [projectImageOverrides, setProjectImageOverrides] = useState<Record<string, string>>({});
  const [uploadingProject, setUploadingProject] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [crmLightboxImg, setCrmLightboxImg] = useState<string | null>(null);
  const [editableProjects, setEditableProjects] = useState<ProjectData[]>(PROJECTS);
  const [commissionEntities, setCommissionEntities] = useState<{name:string;pct:number}[]>([
    { name: 'Colombia Tax Law Group', pct: 1 },
    { name: 'Grupo Valverde', pct: 1 },
    { name: 'Capital Brokers', pct: 1 },
    { name: 'Red de Brokers (distribuible)', pct: 2 },
  ]);
  const [editingProject, setEditingProject] = useState<string | null>(null);

  const updateProject = (name: string, field: keyof ProjectData, value: any) => {
    setEditableProjects(prev => prev.map(p => p.name === name ? { ...p, [field]: value } : p));
  };

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
  const [brokerFilters, setBrokerFilters] = useState({ nombre: '', empresa: '', zona: '' });
  const [brokerSort, setBrokerSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'nombre', dir: 'asc' });
  const [reportTarget, setReportTarget] = useState('all');
  const [newBroker, setNewBroker] = useState({ nombre: '', empresa: '', zona: '', telefono: '', email: '' });

  // Prospects
  const [prospects, setProspects] = useState<Prospect[]>([]);

  useEffect(() => {
    const applyMigration = (data: Prospect[]) => {
      let needsMigration = false;
      const migrated = data.map((p: any) => {
        if (!p.emailHistory || p.emailHistory.length === 0) {
          needsMigration = true;
          let history: any[] = [];
          if (p.nombre.includes('Carlos')) {
            history = [
              { id: 'inc_c1', date: new Date().toISOString().split('T')[0], subject: 'Información sobre Ocean Reef', body: 'Deseo cotizar una unidad en Ocean Reef Park para inversión.', status: 'incoming', direction: 'in' },
              { id: 'dr_c1', date: new Date().toISOString().split('T')[0], subject: 'Cotización Personalizada y Ficha Técnica - Ocean Reef Park Unidad 3BR', body: 'Estimado Carlos,\n\nCon base en tu interés en una unidad de 3 habitaciones con acceso directo a la marina en Ocean Reef Park, he preparado esta cotización preliminar por USD $1,500,000 con un plan de pago del 30% inicial y 70% contra entrega.\n\nQuedo atenta.\n\nSARA (Asistente de Ventas GLP)', status: 'draft', direction: 'out' }
            ];
          } else if (p.nombre.includes('Laura')) {
            history = [
              { id: 'inc_l1', date: new Date().toISOString().split('T')[0], subject: 'Retorno de inversión en Playa Caracol (FAQ)', body: 'Hola, me gustaría entender cómo funciona el retorno vacacional.', status: 'incoming', direction: 'in' },
              { id: 'dr_l1', date: new Date().toISOString().split('T')[0], subject: 'Información y Retorno de Inversión - The Tides Playa Caracol', body: 'Estimada Laura,\n\nAdjunto a este correo encontrarás la simulación financiera para The Tides (USD $320,000) con potencial de renta vacacional. El retorno neto estimado es del 6.8% anual.\n\nSARA (Servicio al Cliente GLP)', status: 'draft', direction: 'out' }
            ];
          } else {
             // 30% chance of random incoming faq for testing
             if (Math.random() > 0.7) {
                history = [
                  { id: 'inc_r' + p.id, date: new Date().toISOString().split('T')[0], subject: 'Duda sobre exención de impuestos (FAQ)', body: 'Hola, ¿Cómo aplico a la exención fiscal?', status: 'incoming', direction: 'in' },
                  { id: 'dr_r' + p.id, date: new Date().toISOString().split('T')[0], subject: 'Respuesta automática de soporte', body: 'Hola,\n\nPara aplicar, el trámite toma 30 días con nuestros abogados.\n\nSARA', status: 'draft', direction: 'out' }
                ];
             }
          }
          return { ...p, emailHistory: history };
        }
        return p;
      });
      
      // Inject TEST PROSPECTS
      const testProspects = [
        {
          id: 999001,
          nombre: 'TEST-1', apellido: 'Inicial',
          direccion: 'Bogotá', correo: 'test1.inicial@gmail.com', telefono: '+57 300 000 0001',
          ocupacion: 'Piloto Comercial', proyectos_interes: ['Ocean Reef Park'],
          forma_contacto: 'WhatsApp', broker_asignado: 'Patricia Vargas', estado: 'Contacto Inicial',
          presupuesto_usd: 120000, notas: 'Prospecto de prueba para validar Contacto Inicial',
          fecha_entrada: new Date().toISOString().split('T')[0],
          historial: [{ fecha: new Date().toISOString().split('T')[0], accion: 'Creación', detalle: 'Prospecto inyectado' }],
          emailHistory: [
            { id: 't1_1', date: new Date().toISOString().split('T')[0], subject: 'Consulta desde WhatsApp', body: 'Hola, quiero el brochure', status: 'incoming', direction: 'in' },
            { id: 't1_2', date: new Date().toISOString().split('T')[0], subject: 'Envío de Brochure - SARA', body: 'Adjunto brochure de Ocean Reef', status: 'draft', direction: 'out' }
          ]
        },
        {
          id: 999002,
          nombre: 'TEST-2', apellido: 'Calificación',
          direccion: 'Medellín', correo: 'test2.calificacion@gmail.com', telefono: '+57 300 000 0002',
          ocupacion: 'CEO', proyectos_interes: ['The Palms'],
          forma_contacto: 'LinkedIn', broker_asignado: 'Santiago Mesa', estado: 'Calificación',
          presupuesto_usd: 350000, notas: 'Prospecto de prueba para validar Calificación y Termómetro SARA',
          fecha_entrada: new Date().toISOString().split('T')[0],
          historial: [{ fecha: new Date().toISOString().split('T')[0], accion: 'Creación', detalle: 'Prospecto inyectado' }],
          emailHistory: [
            { id: 't2_1', date: new Date().toISOString().split('T')[0], subject: 'FAQ - Retorno de inversión', body: '¿Cuál es el ROI esperado?', status: 'incoming', direction: 'in' },
            { id: 't2_2', date: new Date().toISOString().split('T')[0], subject: 'Información de ROI - The Palms', body: 'El ROI esperado es del 7% anual.', status: 'draft', direction: 'out' }
          ]
        },
        {
          id: 999003,
          nombre: 'TEST-3', apellido: 'Presentación',
          direccion: 'Cali', correo: 'test3.presentacion@gmail.com', telefono: '+57 300 000 0003',
          ocupacion: 'Inversionista', proyectos_interes: ['Panamá Viejo Residences'],
          forma_contacto: 'Referido', broker_asignado: 'Felipe Londoño', estado: 'Presentación',
          presupuesto_usd: 500000, notas: 'Prospecto de prueba para Presentación',
          fecha_entrada: new Date().toISOString().split('T')[0],
          historial: [{ fecha: new Date().toISOString().split('T')[0], accion: 'Creación', detalle: 'Prospecto inyectado' }],
          emailHistory: [
             { id: 't3_1', date: new Date().toISOString().split('T')[0], subject: 'Resumen de Zoom', body: 'Fue una buena reunión, espero el resumen.', status: 'incoming', direction: 'in' },
             { id: 't3_2', date: new Date().toISOString().split('T')[0], subject: 'Resumen de Presentación - SARA', body: 'Gracias por asistir a la presentación. Adjunto los detalles.', status: 'draft', direction: 'out' }
          ]
        },
        {
          id: 999004,
          nombre: 'TEST-4', apellido: 'Negociación',
          direccion: 'Barranquilla', correo: 'test4.negociacion@gmail.com', telefono: '+57 300 000 0004',
          ocupacion: 'Abogado', proyectos_interes: ['Ocean Reef Park'],
          forma_contacto: 'Web', broker_asignado: 'Patricia Vargas', estado: 'Negociación',
          presupuesto_usd: 1200000, notas: 'Validar colores de advertencia/amarillo en el termómetro',
          fecha_entrada: new Date().toISOString().split('T')[0],
          historial: [{ fecha: new Date().toISOString().split('T')[0], accion: 'Creación', detalle: 'Prospecto inyectado' }],
          emailHistory: [
             { id: 't4_1', date: new Date().toISOString().split('T')[0], subject: 'Contraoferta y FAQ Tributaria', body: '¿Me pueden confirmar el tema tributario para firmar?', status: 'incoming', direction: 'in' },
             { id: 't4_2', date: new Date().toISOString().split('T')[0], subject: 'Confirmación Legal y Tributaria', body: 'Confirmamos la exención de 20 años.', status: 'draft', direction: 'out' }
          ]
        },
        {
          id: 999005,
          nombre: 'TEST-5', apellido: 'Cierre',
          direccion: 'Bogotá', correo: 'test5.cierre@gmail.com', telefono: '+57 300 000 0005',
          ocupacion: 'Médico', proyectos_interes: ['Surfside'],
          forma_contacto: 'Web', broker_asignado: 'Andrés Morales', estado: 'Cierre',
          presupuesto_usd: 400000, notas: 'Validar color verde y completitud en embudo',
          fecha_entrada: new Date().toISOString().split('T')[0],
          historial: [{ fecha: new Date().toISOString().split('T')[0], accion: 'Creación', detalle: 'Prospecto inyectado' }],
          emailHistory: [
             { id: 't5_1', date: new Date().toISOString().split('T')[0], subject: 'Comprobante de Transferencia', body: 'Adjunto Swift de la reserva.', status: 'incoming', direction: 'in' },
             { id: 't5_2', date: new Date().toISOString().split('T')[0], subject: '¡Felicidades por su Inversión!', body: 'Hemos recibido los fondos. Bienvenido a Surfside.', status: 'sent', direction: 'out' }
          ]
        }
      ];

      // Add them if they don't exist
      testProspects.forEach(tp => {
        if (!migrated.find(p => p.id === tp.id)) {
          migrated.unshift(tp);
        }
      });

      return migrated;
    };

    fetch('http://localhost:3001/api/prospectos')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProspects(data.map((p: any) => ({
            ...p,
            emailHistory: p.emailHistory || [],
            estado: FUNNEL_STAGES.includes(p.estado) ? p.estado : 'Contacto Inicial',
            proyectos_interes: Array.isArray(p.proyectos_interes) ? p.proyectos_interes : (typeof p.proyectos_interes === 'string' ? JSON.parse(p.proyectos_interes || '[]') : []),
            historial: Array.isArray(p.historial) ? p.historial : (typeof p.historial === 'string' ? JSON.parse(p.historial || '[]') : []),
          })));
        }
      })
      .catch(e => {
        console.error('Error fetching prospects:', e);
      });
  }, []);

  useEffect(() => {
    fetch('http://localhost:3001/api/drafts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setApiDrafts(data); })
      .catch(() => {});
    fetch('http://localhost:3001/api/alerts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProspectAlerts(data); })
      .catch(() => {});
    loadCrisisAlerts();
  }, []);

  const refreshAlerts = () => {
    fetch('http://localhost:3001/api/alerts')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProspectAlerts(data); })
      .catch(() => {});
  };

  const dismissAlert = (alertId: string) => {
    fetch(`http://localhost:3001/api/alerts/${alertId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'gestionada' })
    }).then(() => setProspectAlerts(prev => prev.filter(a => a.id !== alertId)));
  };

  // localStorage desactivado — fuente de verdad es Supabase

  const postNewProspectBackend = (p: Prospect) => {
    fetch('http://localhost:3001/api/prospectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(e => console.error('Error creating prospect:', e));
  };

  const updateProspectBackend = (p: Prospect) => {
    fetch(`http://localhost:3001/api/prospectos/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(e => console.error('Error updating prospect:', e));
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
  const [agentHistoryDetail, setAgentHistoryDetail] = useState<string | null>(null);
  const [agentHistoryTab, setAgentHistoryTab] = useState<'pending' | 'approved' | 'active'>('pending');
  const [prospectEdit, setProspectEdit] = useState<number | null>(null);
  const [prospectFilterBroker, setProspectFilterBroker] = useState('all');
  const [prospectFilterStage, setProspectFilterStage] = useState('all');
  const [prospectFilterProject, setProspectFilterProject] = useState('all');
  const [prospectSort, setProspectSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'fecha_entrada', dir: 'desc' });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [previousModule, setPreviousModule] = useState<string | null>(null);
  const [prospectViewMode, setProspectViewMode] = useState<'embudo' | 'lista'>('embudo');
  const [newProspect, setNewProspect] = useState<Partial<Prospect>>({
    nombre: '', apellido: '', direccion: '', correo: '', telefono: '', ocupacion: '',
    proyectos_interes: [], forma_contacto: 'Pagina Web', broker_asignado: '', estado: 'Contacto Inicial',
    presupuesto_usd: 0, notas: '', historial: [],
  });

  // Events
  const [events, setEvents] = useState<EventData[]>(INITIAL_EVENTS);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
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
  const [calcFeePM, setCalcFeePM] = useState(10);          // % sobre renta efectiva
  const [calcFeePMFixed, setCalcFeePMFixed] = useState(0);  // $ mensual fijo (sincronizado con %)
  const [calcValorFiscal, setCalcValorFiscal] = useState(0); // valor fiscal; 0 = usar 70% del comercial
  const [calcAdmin, setCalcAdmin] = useState(0);
  const [calcPredial, setCalcPredial] = useState(1);         // % sobre valor fiscal
  const [calcCondominio, setCalcCondominio] = useState(0);
  const [calcVacancia, setCalcVacancia] = useState(8);
  const [calcValorizacion, setCalcValorizacion] = useState(1);
  const [calcVender, setCalcVender] = useState(false);
  const [calcVenderAnio, setCalcVenderAnio] = useState(5);
  const [calcSeguro, setCalcSeguro] = useState(0.3);         // % sobre valor fiscal
  const [calcMantenimiento, setCalcMantenimiento] = useState(0);

  // ── AGENTS STATE ────────────────────────────────────────────
  const [agentCamiloActive, setAgentCamiloActive] = useState(false);
  const [agentSaraActive, setAgentSaraActive] = useState(false);
  const [agentValeriaActive, setAgentValeriaActive] = useState(false);
  const [agentIsabellaActive, setAgentIsabellaActive] = useState(false);
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
    const saved = localStorage.getItem('glp_openai_key');
    if (saved) return saved;
    const envKey = import.meta.env.VITE_OPENAI_KEY as string | undefined;
    if (envKey) return envKey;
    return 'sk-gpt-4o-mini-always-on';
  });
  const [showOpenaiConfig, setShowOpenaiConfig] = useState(false);
  const [apiDrafts, setApiDrafts] = useState<Array<{id:string;destinatario:string;project:string;subject:string;body:string;status:string;created_at:string;prioridad?:string}>>([]);
  const [prospectAlerts, setProspectAlerts] = useState<Array<{
    id:string; prospecto_id:number; nivel:string; motivo:string;
    dias_sin_actividad:number; tareas:any[]; borrador_asunto:string;
    borrador_cuerpo:string; status:string; created_at:string;
    nombre:string; apellido:string; correo:string; etapa:string;
    proyectos_interes:any; presupuesto_usd:number;
  }>>([]);
  const [isabellaScripts, setIsabellaScripts] = useState<AgentDraft[]>([]);

  // ── CAMILO INSIGHTS ─────────────────────────────────────────
  const [camiloInsights, setCamiloInsights] = useState<{
    id: string; fecha: string; tipo: 'mercado' | 'crisis' | 'oportunidad' | 'audiencia';
    titulo: string; resumen: string; datos: string; fuentes: string[];
    impacto: 'alto' | 'medio' | 'bajo'; status: 'nuevo' | 'revisado' | 'aplicado';
    aplicado_por?: string[];
  }[]>([]);
  const [camiloMode, setCamiloMode] = useState<'prospectos' | 'research'>('research');

  // ── WORKFLOW CROSS-AGENT ─────────────────────────────────────
  const [workflowTasks, setWorkflowTasks] = useState<{
    id: string; fecha: string;
    from: string; to: string;
    tipo: string; titulo: string; contenido: string;
    status: 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'completado';
    prioridad: 'alta' | 'media' | 'baja';
    ref_id?: string;
  }[]>([]);
  const [workflowTab, setWorkflowTab] = useState<'pendiente' | 'completado'>('pendiente');

  // ── CRISIS ALERTS ────────────────────────────────────────────
  type CrisisAlert = {
    id: string; tenant_id: string;
    tipo: 'prospectos_nuevos' | 'estancamiento' | 'valor_pipeline';
    nivel: 'leve' | 'moderada' | 'grave';
    titulo: string; descripcion: string;
    metrica_actual: number; metrica_baseline: number; variacion_pct: number;
    status: 'nueva' | 'notificada' | 'en_contingencia' | 'resuelta' | 'descartada';
    campana_generada: boolean;
    created_at: string; updated_at: string;
  };
  const [crisisAlerts, setCrisisAlerts] = useState<CrisisAlert[]>([]);
  const [crisisLoading, setCrisisLoading] = useState(false);
  const [crisisDetecting, setCrisisDetecting] = useState(false);

  // ── BROKER OBJECTIONS ────────────────────────────────────────
  type BrokerObjection = {
    id: string; broker: string; prospecto?: string;
    tipo: 'peso_dolar'|'dian'|'competencia'|'entrega'|'precio'|'otro';
    descripcion: string; canal: string; proyecto?: string; created_at: string;
  };
  const OBJECTION_TIPOS: {value: BrokerObjection['tipo']; label: string; icon: string}[] = [
    { value: 'peso_dolar',   label: 'Peso/Dólar (tasa de cambio)',      icon: '💱' },
    { value: 'dian',         label: 'DIAN / Impuestos Colombia',         icon: '🏛' },
    { value: 'competencia',  label: 'Competencia (CR, Portugal, Miami)', icon: '🏆' },
    { value: 'entrega',      label: 'Dudas de entrega / construcción',   icon: '🏗' },
    { value: 'precio',       label: 'Precio / Presupuesto',              icon: '💰' },
    { value: 'otro',         label: 'Otra objeción',                     icon: '💬' },
  ];
  const [objections, setObjections] = useState<BrokerObjection[]>([]);
  const [objStats, setObjStats] = useState<{tipo:string;total:number;ultimos_7d:number}[]>([]);
  const [objLoading, setObjLoading] = useState(false);
  const [objForm, setObjForm] = useState({ broker:'', prospecto:'', tipo:'peso_dolar' as BrokerObjection['tipo'], descripcion:'', canal:'llamada', proyecto:'' });
  const [objSaving, setObjSaving] = useState(false);
  const [objSuccess, setObjSuccess] = useState(false);

  const loadObjections = async () => {
    setObjLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch('http://localhost:3001/api/broker-objections').then(r=>r.json()),
        fetch('http://localhost:3001/api/broker-objections/stats').then(r=>r.json()),
      ]);
      setObjections(Array.isArray(r1) ? r1 : []);
      setObjStats(Array.isArray(r2) ? r2 : []);
    } catch { } finally { setObjLoading(false); }
  };

  const submitObjection = async () => {
    if (!objForm.broker || !objForm.descripcion) return;
    setObjSaving(true);
    try {
      await fetch('http://localhost:3001/api/broker-objections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(objForm),
      });
      setObjForm({ broker:'', prospecto:'', tipo:'peso_dolar', descripcion:'', canal:'llamada', proyecto:'' });
      setObjSuccess(true);
      setTimeout(() => setObjSuccess(false), 3000);
      await loadObjections();
    } catch { } finally { setObjSaving(false); }
  };

  const loadCrisisAlerts = async () => {
    setCrisisLoading(true);
    try {
      const r = await fetch('http://localhost:3001/api/crisis-alerts');
      const data = await r.json();
      setCrisisAlerts(Array.isArray(data) ? data : []);
    } catch { /* silencioso */ } finally { setCrisisLoading(false); }
  };

  const updateCrisisStatus = async (id: string, status: string) => {
    await fetch(`http://localhost:3001/api/crisis-alerts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setCrisisAlerts(prev => prev.map(a => a.id === id ? { ...a, status: status as CrisisAlert['status'] } : a));
  };

  const triggerCrisisDetect = async () => {
    setCrisisDetecting(true);
    try {
      const r = await fetch('http://localhost:3001/api/crisis/detect', { method: 'POST' });
      const data = await r.json();
      await loadCrisisAlerts();
      if (data.alertas_creadas === 0) alert('✅ KPIs dentro de rangos normales. Sin alertas nuevas.');
      else alert(`🚨 ${data.alertas_creadas} alerta(s) de crisis detectada(s).`);
    } catch { alert('Error ejecutando detección'); } finally { setCrisisDetecting(false); }
  };

  const addWorkflowTask = (task: Omit<typeof workflowTasks[0], 'id' | 'fecha'>) => {
    setWorkflowTasks(prev => [{
      ...task, id: `wf-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, fecha: today()
    }, ...prev]);
  };

  // ── CAMILO PANEL STATE ───────────────────────────────────────
  const [camiloTab, setCamiloTab] = useState<'insights'|'ranking'|'radar'|'objeciones'|'reporte'>('insights');
  const [expandedInsight, setExpandedInsight] = useState<string|null>(null);
  const [marketReport, setMarketReport] = useState<{texto:string;fecha:string}|null>(null);
  const [radarData, setRadarData] = useState<{titulo:string;descripcion:string;argumentos:string[];precio_ref?:string}[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingRadar, setGeneratingRadar] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  // Aprobar insight → crear tareas en workflow
  const approveInsight = (ins: typeof camiloInsights[0]) => {
    setCamiloInsights(prev => prev.map(i => i.id === ins.id ? { ...i, status: 'revisado' as const } : i));
    const prioridad = ins.impacto === 'alto' ? 'alta' : ins.impacto === 'medio' ? 'media' : 'baja';
    if ((ins as any).acciones_valeria) addWorkflowTask({ from:'CAMILO', to:'VALERIA', tipo:`Insight ${ins.tipo}`, titulo:`📊 ${ins.titulo}`, contenido:`DATOS:\n${ins.datos}\n\n➡️ TAREA PARA VALERIA:\n${(ins as any).acciones_valeria}`, status:'pendiente', prioridad, ref_id:ins.id });
    if ((ins as any).acciones_isabella) addWorkflowTask({ from:'CAMILO', to:'ISABELLA', tipo:`Video ${ins.tipo}`, titulo:`🎬 ${ins.titulo}`, contenido:`DATOS:\n${ins.datos}\n\n➡️ TAREA PARA ISABELLA:\n${(ins as any).acciones_isabella}`, status:'pendiente', prioridad, ref_id:ins.id });
    if ((ins as any).acciones_sara) addWorkflowTask({ from:'CAMILO', to:'SARA', tipo:'FAQ / Respuesta', titulo:`💬 ${ins.titulo}`, contenido:`DATOS:\n${ins.datos}\n\n➡️ TAREA PARA SARA:\n${(ins as any).acciones_sara}`, status:'pendiente', prioridad:'media', ref_id:ins.id });
  };
  const rejectInsight = (id: string) => setCamiloInsights(prev => prev.map(i => i.id === id ? { ...i, status: 'aplicado' as const } : i));

  // Score de conversión: (presupuesto normalizado 40%) + (etapa avanzada 35%) + (actividad reciente 15%) + (interés multi-proyecto 10%)
  const getProspectScore = (p: Prospect) => {
    const maxBudget = Math.max(...prospects.map(x => x.presupuesto_usd || 0), 1);
    const budgetScore = ((p.presupuesto_usd || 0) / maxBudget) * 40;
    const stageScores: Record<string,number> = { 'Contacto Inicial':5,'Calificación':15,'Presentación':25,'Negociación':30,'Cierre':35,'Post-venta':35 };
    const stageScore = stageScores[p.estado] || 5;
    const lastActivity = new Date(p.fecha_ultima_actividad || p.fecha_registro || Date.now());
    const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
    const activityScore = Math.max(0, 15 - daysSince * 1.5);
    const projectScore = Array.isArray(p.proyectos_interes) && p.proyectos_interes.length > 1 ? 10 : 5;
    return Math.min(99, Math.round(budgetScore + stageScore + activityScore + projectScore));
  };

  // Días estimados para cierre según etapa
  const getTimingDays = (p: Prospect) => {
    const base: Record<string,number> = { 'Contacto Inicial':45,'Calificación':30,'Presentación':21,'Negociación':10,'Cierre':3,'Post-venta':0 };
    const days = base[p.estado] || 30;
    const lastActivity = new Date(p.fecha_ultima_actividad || p.fecha_registro || Date.now());
    const stale = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
    return days + Math.floor(stale * 0.5);
  };

  const generateMarketReport = async () => {
    setGeneratingReport(true);
    try {
      const kpiSummary = `Prospectos: ${prospects.length}, en Negociación/Cierre: ${prospects.filter(p=>['Negociación','Cierre'].includes(p.estado)).length}, presupuesto promedio $${prospects.length>0?Math.round(prospects.reduce((s,p)=>s+(p.presupuesto_usd||0),0)/prospects.length).toLocaleString():0} USD`;
      const objSummary = objStats.map(s=>`${s.tipo}: ${s.total} reportes (${s.ultimos_7d} esta semana)`).join(', ') || 'Sin objeciones registradas';
      const prompt = `Eres Camilo, analista de mercado de GLP Wealth Management Panamá.

Genera el REPORTE SEMANAL DE COLOR DEL MERCADO para la semana del ${today()}.

CONTEXTO INTERNO GLP:
- ${kpiSummary}
- Objeciones de brokers: ${objSummary}

El reporte debe cubrir:
1. PANORAMA MACRO (economía panameña, tipo de cambio USD/COP, condiciones de crédito)
2. MERCADO INMOBILIARIO PANAMÁ (tendencias de precios, zonas activas, demanda extranjera)
3. COMPETENCIA (proyectos activos en Costa Rica, Portugal, Miami, otras opciones de panamá)
4. SEÑALES DE RIESGO (lo que podría frenar ventas esta semana)
5. OPORTUNIDADES (lo que el equipo debería aprovechar esta semana)
6. RECOMENDACIÓN TÁCTICA (una acción concreta que el equipo comercial puede tomar HOY)

Formato: texto profesional, párrafos cortos, en español. Máximo 600 palabras. Tono de analista senior, no genérico.`;

      const texto = await triggerOpenAI(prompt, 'Eres Camilo, analista de mercado inmobiliario y financiero para Panamá y Colombia, 2025-2026.', 1500);
      const report = { texto, fecha: today() };
      setMarketReport(report);

      // Guardar en Supabase como contexto global
      await fetch('http://localhost:3001/api/settings/market-report', {
        method: 'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(report)
      }).catch(()=>{}); // silencioso si falla
    } catch(e:any) {
      alert('Error generando reporte: ' + e.message);
    } finally { setGeneratingReport(false); }
  };

  const generateRadar = async () => {
    setGeneratingRadar(true);
    try {
      const prompt = `Eres Camilo, analista competitivo de GLP Wealth Management.

Genera un RADAR DE COMPETENCIA actualizado para la semana del ${today()}.
Analiza los principales destinos que compiten con GLP Panamá para inversores colombianos:
1. Costa Rica (proyectos de playa, Guanacaste, Jacó)
2. Portugal (Golden Visa, Lisboa, Algarve)
3. Miami/Orlando (Florida, condominios, inversión en USD)
4. Otros proyectos en Panamá (Ciudad de Panamá, Coronado, Chiriquí)

Para cada competidor devuelve un JSON array con esta estructura EXACTA:
[
  {
    "titulo": "nombre del destino/competidor",
    "descripcion": "situación actual en 2 oraciones",
    "precio_ref": "rango de precios típico en USD",
    "argumentos": ["argumento GLP que lo supera 1", "argumento GLP que lo supera 2", "argumento GLP que lo supera 3"]
  }
]

Sin markdown, solo el JSON array.`;

      const res = await triggerOpenAI(prompt, 'Eres Camilo, analista competitivo inmobiliario LatAm 2025-2026.', 1200);
      const clean = res.replace(/```json/g,'').replace(/```/g,'').trim();
      const data = JSON.parse(clean);
      setRadarData(Array.isArray(data) ? data : []);
    } catch(e:any) {
      alert('Error generando radar: ' + e.message);
    } finally { setGeneratingRadar(false); }
  };

  const sendReportEmail = async () => {
    if (!marketReport) return;
    setSendingReport(true);
    try {
      await fetch('http://localhost:3001/api/email/send', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          to: 'armandohortua@gmail.com',
          subject: `📊 Reporte Semanal de Mercado GLP — ${marketReport.fecha}`,
          body: marketReport.texto,
        })
      });
      alert('✅ Reporte enviado por correo.');
    } catch { alert('Error enviando correo'); } finally { setSendingReport(false); }
  };
  const [saraReportText, setSaraReportText] = useState(
    'REPORTE DE CONTINGENCIA DE MERCADO - GLP PANAMÁ\n' +
    'Generado por: Sara (Customer Success)\n' +
    'Estado General: Operaciones en curso. Monitoreo activo de prospectos y exenciones fiscales.\n\n' +
    'Alertas Críticas:\n' +
    '• Carlos Gutiérrez (Negociación, Presupuesto $1.5M USD) - Solicita urgente aclaración sobre los tiempos de transferencia de divisas para el cierre en Ocean Reef Park.\n' +
    '• Roberto Castaño (Cierre, Presupuesto $220k USD) - Requiere que el equipo legal (Colombia Tax Law Group) certifique el estado de exención predial de 20 años de Surfside.\n\n' +
    'FAQs Frecuentes detectadas en consultas:\n' +
    '1. ¿Cómo se declara la propiedad en Panamáá ante la DIAN (Formulario 160)?\n' +
    '2. ¿Existe exención del impuesto de inmuebles para proyectos nuevos?\n' +
    '3. ¿Cuáles son los requisitos de enganche hipotecario para extranjeros?'
  );
  const [saraAlertsList, setSaraAlertsList] = useState<string[]>([
    'Carlos Gutiérrez: Urgente resolver timeline de cierre en Ocean Reef.',
    'Roberto Castaño: Requiere confirmación de exención de impuesto de inmuebles.',
    'Laura Sánchez: Interés de compra en Playa Caracol requiere llamada de seguimiento.'
  ]);
  const [valeriaDrafts, setValeriaDrafts] = useState<AgentDraft[]>([]);
  const [valeriaGenerating, setValeriaGenerating] = useState(false);
  const [valeriaSelectedCanal, setValeriaSelectedCanal] = useState<string>('Reel Instagram');
  const [valeriaFilterCanal, setValeriaFilterCanal] = useState<string>('todos');
  const [valeriaTab, setValeriaTab] = useState<'contenido' | 'perfil'>('contenido');
  const [brandProfile, setBrandProfile] = useState<GlpBrandProfile>(DEFAULT_BRAND_PROFILE);
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Cargar perfil desde Supabase al montar
  useEffect(() => {
    fetch('http://localhost:3001/api/brand-profile')
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setBrandProfile({ ...DEFAULT_BRAND_PROFILE, ...data });
        }
      })
      .catch(() => {
        // fallback localStorage
        try {
          const saved = localStorage.getItem('glp_brand_profile');
          if (saved) setBrandProfile({ ...DEFAULT_BRAND_PROFILE, ...JSON.parse(saved) });
        } catch {}
      });
  }, []);

  const updateProfile = (field: keyof GlpBrandProfile, value: any) => {
    setBrandProfile(prev => ({ ...prev, [field]: value }));
    setProfileDirty(true);
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await fetch('http://localhost:3001/api/brand-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandProfile)
      });
      localStorage.setItem('glp_brand_profile', JSON.stringify(brandProfile));
      setProfileDirty(false);
    } catch {
      // Si falla el servidor, al menos guarda en localStorage
      localStorage.setItem('glp_brand_profile', JSON.stringify(brandProfile));
      setProfileDirty(false);
    } finally {
      setProfileSaving(false);
    }
  };

  const resetProfile = () => {
    setBrandProfile(DEFAULT_BRAND_PROFILE);
    localStorage.removeItem('glp_brand_profile');
    setProfileDirty(false);
  };
  const [crmProjSearchQuery, setCrmProjSearchQuery] = useState('');
  const [swarmRunning, setSwarmRunning] = useState(false);
  const [swarmStep, setSwarmStep] = useState<number | null>(null);
  const [swarmLogs, setSwarmLogs] = useState<Array<{ time: string; agent: string; msg: string }>>([
    { time: '10:00', agent: 'SISTEMA', msg: 'Enjambre listo para inicializarse por el administrador.' }
  ]);

  // ── OPENAI & INTERACTIVE AGENTS FUNCTIONS ──────────────────
  const triggerOpenAI = async (prompt: string, systemPrompt: string, max_tokens?: number): Promise<string> => {
    const response = await fetch('http://localhost:3001/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        ...(max_tokens ? { max_tokens } : {})
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error del servidor (${response.status})`);
    }
    const data = await response.json();
    return data.choices[0].message.content || '';
  };

  const handleCamilo = async (isSwarm = false, silent = false, modeOverride?: 'prospectos' | 'research') => {
    setAgentCamiloActive(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logMsg = (msg: string) => {
      if (!silent) setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'CAMILO', msg }]);
    };

    const mode = modeOverride || camiloMode;

    // ── MODO RESEARCH DE MERCADO ────────────────────────────
    if (mode === 'research') {
      logMsg('Camilo iniciando research de mercado e inteligencia competitiva...');

      const kpiCtx = `
KPIs actuales del dashboard GLP:
- Prospectos activos: ${prospects.length}
- En Negociación/Cierre: ${prospects.filter(p => ['Negociación','Cierre'].includes(p.estado)).length}
- Presupuesto promedio: $${prospects.length > 0 ? Math.round(prospects.reduce((s,p) => s + (p.presupuesto_usd||0), 0) / prospects.length).toLocaleString() : 0} USD
- Proyectos más solicitados: ${PROJECTS.slice(0,3).map(p=>p.name).join(', ')}
- Alertas activas SARA: ${prospectAlerts.length}`;

      const brandCtxSummary = `
Audiencia GLP: ${brandProfile.audiencias.slice(0,2).join(' | ')}
Objeciones frecuentes: ${brandProfile.objeciones.slice(0,3).map(o=>o.split('→')[0].trim()).join(' / ')}
Diferenciadores: ${brandProfile.diferenciadores.slice(0,3).join(' · ')}`;

      try {
        logMsg('Conectando con OpenAI — generando inteligencia de mercado...');
        const prompt = `Eres Camilo, Científico de Datos y Estratega de Inteligencia de Mercado de GLP Wealth Management.

Tu misión: generar un reporte de inteligencia accionable que alimentará a los agentes SARA (respuestas), VALERIA (contenido) e ISABELLA (video).

CONTEXTO OPERATIVO GLP:
${kpiCtx}

PERFIL DE MARCA Y AUDIENCIA:
${brandCtxSummary}

PORTAFOLIO ACTUAL:
${PROJECTS.map(p=>`• ${p.name} (${p.zone}) desde $${p.minPrice?.toLocaleString()||'consultar'} USD`).join('\n')}

Genera un reporte de inteligencia con EXACTAMENTE esta estructura JSON (sin markdown):
{
  "resumen_ejecutivo": "párrafo de 3-4 líneas con el estado del mercado ahora mismo",
  "insights": [
    {
      "tipo": "mercado|crisis|oportunidad|audiencia",
      "titulo": "título del insight (máx 10 palabras)",
      "datos": "los datos concretos, cifras, tendencias — mínimo 150 palabras con datos reales de Panamá y Colombia 2024-2026",
      "impacto": "alto|medio|bajo",
      "acciones_sara": "qué debe hacer SARA con este insight (respuestas, FAQs a actualizar)",
      "acciones_valeria": "qué contenido debe crear Valeria con este insight",
      "acciones_isabella": "qué video debe crear Isabella con este insight",
      "fuentes": ["fuente 1", "fuente 2"]
    }
  ],
  "señales_crisis": "descripción de riesgos actuales para ventas GLP (tasa de cambio, competencia, mercado)",
  "oportunidades_inmediatas": "top 3 oportunidades concretas para cerrar más negocios esta semana"
}

Genera 4-5 insights variados (mercado macro, oportunidad de proyecto, audiencia colombiana, señal de crisis/riesgo). Usa datos reales y actuales de Panamá y Colombia.`;

        const res = await triggerOpenAI(prompt, 'Eres Camilo, analista de datos inmobiliarios con conocimiento profundo del mercado panameño y colombiano 2024-2026.', 3500);
        const clean = res.replace(/```json/g,'').replace(/```/g,'').trim();
        let parsed: any;
        try {
          parsed = JSON.parse(clean);
        } catch {
          // JSON truncado — intentar extraer los insights completos que sí cerraron
          const insightsMatch = clean.match(/"insights"\s*:\s*(\[[\s\S]*)/);
          if (insightsMatch) {
            let arr = insightsMatch[1];
            // Cerrar el array en el último objeto completo
            const lastClose = arr.lastIndexOf('}');
            arr = arr.slice(0, lastClose + 1) + ']';
            try {
              parsed = { insights: JSON.parse(arr), resumen_ejecutivo: '', señales_crisis: '', oportunidades_inmediatas: '' };
            } catch {
              throw new Error('Respuesta de OpenAI incompleta — intenta de nuevo');
            }
          } else {
            throw new Error('Respuesta de OpenAI incompleta — intenta de nuevo');
          }
        }

        // Guardar insights
        const nuevosInsights = (parsed.insights || []).map((ins: any, i: number) => ({
          id: `ci-${Date.now()}-${i}`,
          fecha: today(),
          tipo: ins.tipo || 'mercado',
          titulo: ins.titulo,
          resumen: ins.datos.slice(0, 120) + '...',
          datos: ins.datos,
          fuentes: ins.fuentes || [],
          impacto: ins.impacto || 'medio',
          status: 'nuevo' as const,
          acciones_sara: ins.acciones_sara,
          acciones_valeria: ins.acciones_valeria,
          acciones_isabella: ins.acciones_isabella,
        }));

        setCamiloInsights(prev => [...nuevosInsights, ...prev]);

        // Actualizar reporte SARA con el contexto de Camilo
        setSaraReportText(
          `REPORTE DE INTELIGENCIA — GLP PANAMÁ · ${today()}\nGenerado por: Camilo (Research & Data Intelligence)\n\n` +
          `RESUMEN EJECUTIVO:\n${parsed.resumen_ejecutivo}\n\n` +
          `SEÑALES DE RIESGO/CRISIS:\n${parsed.señales_crisis}\n\n` +
          `OPORTUNIDADES INMEDIATAS:\n${parsed.oportunidades_inmediatas}\n\n` +
          nuevosInsights.map((ins: any) => `[${ins.tipo.toUpperCase()}] ${ins.titulo}\n${ins.datos}`).join('\n\n')
        );

        // Los insights quedan en status 'nuevo' — el admin los aprueba desde la Bitácora
        // para que se conviertan en tareas de workflow (ver approveInsight)
        nuevosInsights.forEach((_ins: any) => {
          if (false) {
            addWorkflowTask({
              from: 'CAMILO', to: 'SARA',
              tipo: '', titulo: '', contenido: '', status: 'pendiente', prioridad: 'media',
              ref_id: '',
            });
          }
        });

        setAgentCamiloLastRun(new Date().toLocaleString());
        logMsg(`✅ Research completo — ${nuevosInsights.length} insights generados, tareas enviadas a Valeria, Isabella y Sara.`);
      } catch (e: any) {
        logMsg(`Error en research de Camilo: ${e.message}`);
      } finally {
        setAgentCamiloActive(false);
      }
      return;
    }

    // ── MODO PROSPECCIÓN ────────────────────────────────────
    logMsg('Iniciando rastreo de bases de datos de prospectos en Colombia...');
    
    try {
      let generatedProspects: any[] = [];
      if (true) {
        logMsg('Conectando con la plataforma OpenAI para minería de datos...');
        const prompt = `Eres Camilo, Data Miner y Growth Hacker de la promotora GLP Panamáá. Genera 2 nuevos prospectos ficticios pero realistas con perfiles detallados de inversores colombianos premium (empresarios, médicos, C-level) interesados en los proyectos de Panamáá. Devuelve UN ARREGLO JSON EXACTAMENTE en el siguiente formato, sin bloques de código markdown, sin \`\`\`json, sin texto adicional:
[{"nombre": "nombre", "apellido": "apellido", "direccion": "dirección en Colombia", "correo": "correo@dominio.com", "telefono": "+57 310...", "ocupacion": "ocupación de alto perfil", "proyectos_interes": ["proyectos aquí"], "forma_contacto": "Referido o Evento o Redes", "broker_asignado": "Patricia Vargas o Santiago Mesa", "presupuesto_usd": 300000, "notas": "notas de interés"}]
Los proyectos en proyectos_interes DEBEN ser exactamente de esta lista: ${PROJECTS.map(p => p.name).join(', ')}. Los brokers deben ser de: ${brokers.map(b => b.nombre).join(', ')}.`;
        
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
        
        const proj1 = PROJECTS[Math.floor(Math.random() * PROJECTS.length)].name;
        const proj2 = PROJECTS[Math.floor(Math.random() * PROJECTS.length)].name;

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
        fecha_entrada: new Date().toISOString().split('T')[0],
        historial: [{ fecha: new Date().toISOString().split('T')[0], accion: 'Contacto Inicial', detalle: 'Minería automática de Camilo' }]
      }));

      setProspects(prev => [...formattedList, ...prev]);
      formattedList.forEach(p => postNewProspectBackend(p));
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
        proyectos_interes: ['Panamáa Viejo Residences', 'The Palms'],
        forma_contacto: 'Referido',
        broker_asignado: 'Patricia Vargas',
        estado: 'Contacto Inicial',
        presupuesto_usd: 350000,
        notas: 'Lead de simulación local. Interés en rentas cortas y exención predial.',
        fecha_entrada: new Date().toISOString().split('T')[0],
        historial: [{ fecha: new Date().toISOString().split('T')[0], accion: 'Contacto Inicial', detalle: 'Simulación Camilo Fallback' }]
      };
      setProspects(prev => [mockLead, ...prev]);
      postNewProspectBackend(mockLead);
      setAgentCamiloProspects(p => p + 1);
      setAgentCamiloLastRun(new Date().toLocaleString());
    } finally {
      setAgentCamiloActive(false);
    }
  };

    const handleSara = async (isSwarm = false, silent = false, currentProspectsList?: Prospect[]) => {
    setAgentSaraActive(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logMsg = (msg: string) => {
      if (!silent) {
        setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'SARA', msg }]);
      }
    };

    logMsg('Sara analizando prospectos del CRM y generando borradores con GPT-4...');
    
    try {
      // Enviar prospectos actuales al backend para que SARA los analice con GPT-4
      const prospectList = currentProspectsList || prospects;
      const response = await fetch('http://localhost:3001/api/sara/process-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: prospectList })
      });
      
      const data = await response.json();
      
      if (!data.success) {
         throw new Error(data.error || 'Error al procesar prospectos con SARA');
      }

      const processedResults = data.results || [];
      const reactivationPlans = data.reactivationPlans || [];
      let updatedList = [...prospectList];
      let reportStr = saraReportText;

      if (processedResults.length > 0) {
        logMsg(`SARA procesó ${processedResults.length} prospectos del CRM y generó borradores hipercontextualizados con GPT-4.`);
        
        let newAlerts: string[] = [];

        processedResults.forEach((result: any) => {
           const existingIdx = updatedList.findIndex(p => (p.correo || '') === result.correo);
           
           // Crear entrada de borrador para el historial del prospecto
           const newDraftMsg = {
               id: result.draft?.id || ('draft_' + Date.now()),
               date: new Date().toISOString().split('T')[0],
               subject: result.draft?.subject || 'Borrador SARA',
               body: result.draft?.body || '',
               status: 'draft' as const,
               direction: 'out' as const
           };

           if (existingIdx >= 0) {
               const updatedProspect = JSON.parse(JSON.stringify(updatedList[existingIdx]));
               updatedProspect.emailHistory = [...(updatedProspect.emailHistory || []), newDraftMsg];
               // Agregar nota de reactivación si existe
               if (result.reactivationPlan) {
                 updatedProspect.notas = (updatedProspect.notas || '') + `\n[SARA ${new Date().toLocaleDateString()}] Plan: ${result.reactivationPlan}`;
               }
               updatedList[existingIdx] = updatedProspect;
               logMsg(`Borrador generado para prospecto existente: ${result.nombre} (${result.correo})`);
               newAlerts.push(`📧 Borrador listo para: ${result.nombre} – Prioridad: ${result.prioridad}`);
           } else {
               logMsg(`Prospecto ${result.nombre} procesado (borrador almacenado en servidor).`);
               newAlerts.push(`📧 Borrador generado: ${result.nombre}`);
           }
        });

        // Construir reporte con planes de reactivación
        const plansStr = reactivationPlans.map((p: any) => 
          `• ${p.nombre} (${p.email}) [${p.prioridad?.toUpperCase()}]: ${p.plan}`
        ).join('\n');

        reportStr = `REPORTE DE ANÁLISIS DE PROSPECTOS CRM – SARA\nGenerado el: ${new Date().toLocaleString()}\n\n` +
          `Se analizaron ${data.totalProspects} prospectos. Se generaron ${processedResults.length} borradores nuevos.\n\n` +
          `PLANES DE REACTIVACIÓN Y SEGUIMIENTO:\n` +
          (plansStr || 'Sin planes adicionales.') + `\n\n` +
          `ACCIONES RECOMENDADAS:\n1. Revisar y aprobar los ${processedResults.length} borradores en el módulo de correos.\n2. Aplicar planes de reactivación sugeridos.\n3. El envío de correos aprobados se realiza vía Gmail/SMTP configurado.`;

        setSaraReportText(reportStr);
        setSaraAlertsList(prev => [...newAlerts, ...prev].slice(0, 8));
        setAgentSaraAlerts(prev => prev + newAlerts.length);
        
        setProspects(updatedList);
        // Persistir actualizaciones
        processedResults.forEach((result: any) => {
            const p = updatedList.find(x => (x.correo || '') === result.correo);
            if (p) updateProspectBackend(p);
        });

      } else {
        logMsg('Todos los prospectos del CRM ya tienen borradores pendientes o no requieren atención.');
        reportStr = `REPORTE DE MONITOREO SARA\nGenerado el: ${new Date().toLocaleString()}\n\n` +
          `Se revisaron ${data.totalProspects} prospectos. No se generaron borradores nuevos.\n\n` +
          `PLAN DE REACTIVACIÓN GLOBAL:\n` +
          `• Se recomienda contactar a leads inactivos con más de 30 días en el embudo ofreciendo incentivos fiscales.\n` +
          `• Revisar borradores pendientes existentes y aprobar para envío vía Gmail.`;
        setSaraReportText(reportStr);
      }

      setAgentSaraMessages(m => m + processedResults.length);
      logMsg('Completado. SARA terminó el análisis de prospectos del CRM con GPT-4 real.');

    } catch (e: any) {
      logMsg(`Error en SARA: ${e.message}. Verifica que el servidor esté corriendo y la API Key de OpenAI sea válida.`);
      console.error(e);
    } finally {
      setAgentSaraActive(false);
    }
  };


  const handleValeria = async (isSwarm = false, silent = false, reportTextSrc?: string, canalOverride?: string) => {
    setAgentValeriaActive(true);
    setValeriaGenerating(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logMsg = (msg: string) => {
      if (!silent) setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'VALERIA', msg }]);
    };

    const canal = canalOverride || valeriaSelectedCanal;
    logMsg(`Valeria preparando ${canal} con contexto real de proyectos y prospectos...`);

    // Contexto real: catálogo de proyectos
    const catalogoReal = PROJECTS.map(p =>
      `• ${p.name} (${p.zone}) — desde $${p.minPrice?.toLocaleString() || 'consultar'} USD — ${p.tipo} — entrega ${p.entrega} — ${p.category}`
    ).join('\n');

    // Contexto real: prospectos activos con perfil
    const prospectosActivos = prospects.slice(0, 5).map(p =>
      `• ${p.nombre} ${p.apellido} — ${p.estado} — presupuesto $${p.presupuesto_usd?.toLocaleString() || 0} — interés: ${(p.proyectos_interes || []).join(', ') || 'general'}`
    ).join('\n') || 'Sin prospectos activos aún.';

    // Contexto de Sara (reporte si hay)
    const saraCtx = reportTextSrc || saraReportText || 'Monitoreo activo de prospectos. Sin contingencias críticas actuales.';

    // Contexto de marca dinámico — viene del perfil editable por el admin
    const BRAND_CTX = `
PROPUESTA DE VALOR GLP:
${brandProfile.propuesta_valor}

AUDIENCIAS OBJETIVO:
${brandProfile.audiencias.map(a => `- ${a}`).join('\n')}

TONO DE MARCA:
${brandProfile.tonos.map(t => `- ${t}`).join('\n')}

OBJETIVOS DEL CONTENIDO:
${brandProfile.objetivos.map(o => `- ${o}`).join('\n')}

DIFERENCIADORES CLAVE GLP:
${brandProfile.diferenciadores.map(d => `- ${d}`).join('\n')}

OBJECIONES A REBATIR (sin mencionarlas directamente, disueltas en el contenido):
${brandProfile.objeciones.map(o => `- ${o}`).join('\n')}

ACTIVOS VISUALES DISPONIBLES:
${brandProfile.activos_visuales.map(a => `- ${a}`).join('\n')}

HASHTAGS POR RED:
- Instagram: ${brandProfile.hashtags_instagram.join(' ')}
- LinkedIn: ${brandProfile.hashtags_linkedin.join(' ')}

CTA PRINCIPAL: ${brandProfile.cta_principal}
${brandProfile.notas_adicionales ? `\nNOTAS ADICIONALES DEL EQUIPO:\n${brandProfile.notas_adicionales}` : ''}
`;

    const toneByCanal: Record<string, string> = {
      'LinkedIn Post': `
Tono ejecutivo-financiero. Audiencia: directivos y empresarios colombianos.
Estructura: dato impactante de apertura → desarrollo con contexto → CTA profesional.
Máx 280 palabras. Incluye 4-6 hashtags estratégicos al final.
Formato: texto plano, sin bullets excesivos, párrafos cortos.`,

      'Newsletter': `
Tono editorial premium. Estructura obligatoria:
1. TITULAR (gancho emocional + dato financiero)
2. CONTEXTO (por qué esto importa ahora para un colombiano)
3. OPORTUNIDAD CONCRETA (proyecto específico con datos reales)
4. DATO EXCLUSIVO (algo que no encuentran en Google)
5. CTA (agendar llamada o descargar brochure)
Máx 450 palabras. Incluir sección "Número de la semana" con dato financiero relevante.`,

      'Email Masivo': `
Asunto magnético (máx 8 palabras, que genere curiosidad o urgencia genuina).
Cuerpo: personalizado con [NOMBRE]. Un dato de valor concreto. Un beneficio claro. Un CTA único.
Máx 180 palabras. Sin múltiples CTAs. Sin listar proyectos — enfocarse en UN beneficio.`,

      'Email Seguimiento': `
Tono: asesor de confianza que recuerda al cliente.
Referencia algo específico de la conversación anterior si es posible.
Máx 120 palabras. Zero presión. Alta calidez. Cierre con pregunta abierta.`,

      'Reel Instagram': `
AUDIENCIA: Colombianos 35-55 que ya tienen capital pero no conocen Panamá como destino de inversión.
OBJETIVO: Que el video genere guardados y compartidos, no solo likes.

Estructura del guion (video 30-45 segundos):
GANCHO (0-3s): Frase disruptiva que detenga el scroll. Debe hablar de dinero, Colombia o un miedo común.
  - Ejemplos de ganchos que funcionan: "Lo que no te dijeron de sacar plata de Colombia", "8.5% de rentabilidad anual en dólares y no es crypto", "El impuesto predial que pagas vs el que NO pagas en Panamá"
DESARROLLO (3-35s): 3 datos concretos presentados visualmente (texto en pantalla + voz en off)
  - Dato 1: estadístico o comparativo (ej: "Mientras en Colombia el predial sube cada año, en Panamá es $0 por 20 años")
  - Dato 2: del portafolio real (nombre de proyecto, precio de entrada, ubicación)
  - Dato 3: beneficio aspiracional (uso propio + renta, dolarización, calidad de vida)
CTA (35-45s): Acción específica y fácil. Nunca "visita nuestra web". Sí: "Escríbenos PANAMÁ al DM y te mandamos el análisis completo".

INDICACIONES DE VIDEO (para el equipo de producción):
- Tipo de plano sugerido por sección
- Texto en pantalla para cada segmento (máx 6 palabras por texto)
- Sugerencia de música/ambiente
- Subtítulos completos del audio

Formato de respuesta en el campo "contenido":
GANCHO: [texto]
---
SECCIÓN 1 - [tiempo]:
  Texto en pantalla: [máx 6 palabras]
  Audio/voz en off: [frase completa]
  Plano sugerido: [tipo de imagen/video a usar]
---
[repetir para cada sección]
---
CTA FINAL: [texto]
SUBTÍTULOS COMPLETOS: [transcripción completa del audio]
HASHTAGS: [8-10 hashtags estratégicos]`,

      'Post Estático Instagram': `
AUDIENCIA: Colombianos 35-55 que siguen a GLP o llegaron por anuncio.
OBJETIVO: Guardar el post (señal de alta intención) + DM o link en bio.

Estructura del caption:
LÍNEA 1 (gancho): La frase que aparece antes del "ver más". Máx 125 caracteres. Debe generar curiosidad o impacto inmediato.
CUERPO: 3-5 párrafos cortos. Cada párrafo = una idea. Usa emojis como viñetas (máx 1 emoji por párrafo, solo si aporta). Rebate un miedo real o presenta un dato del portafolio.
SEPARADOR: línea con puntos o guiones para separar visualmente.
CTA: Frase de cierre con acción específica (comentar, guardar, DM).
HASHTAGS: 20-25 hashtags en comentario aparte, mezcla de alto y bajo volumen.

INDICACIONES DE IMAGEN (para el diseñador/fotógrafo):
- Descripción de la imagen o render ideal para este post
- Elementos de texto a superponer en la imagen (si aplica)
- Paleta de color sugerida (acorde a la marca GLP: navy, dorado, blanco)

Formato de respuesta en el campo "contenido":
CAPTION:
[Línea de gancho]

[Párrafo 1]

[Párrafo 2]

[Párrafo 3]

[CTA]
---
HASHTAGS (pegar como primer comentario):
[lista de hashtags]
---
INDICACIONES PARA LA IMAGEN:
[descripción detallada]`,

      'Instagram Story': `
AUDIENCIA: Seguidores actuales de GLP en Instagram (ya nos conocen).
OBJETIVO: Mantener top-of-mind, generar respuestas/DMs, llevar al link de bio.

Diseña una secuencia de 4-5 stories:
Story 1 — GANCHO: Pregunta o dato que genere respuesta (usar sticker de encuesta o pregunta)
Story 2 — VALOR: Dato educativo o de portafolio (imagen + texto corto)
Story 3 — PRUEBA SOCIAL o DATO EXCLUSIVO: Testimonio, cifra, ranking
Story 4 — CTA: Swipe up / Link / DM / Encuesta de intención

Para cada story:
- Texto principal (máx 15 palabras, que se lea en 2 segundos)
- Descripción de la imagen/video de fondo sugerida
- Sticker o elemento interactivo recomendado
- Duración sugerida (3-7 segundos)`,

      'WhatsApp Masivo': `
Tono: directo, como un mensaje de un conocido que te da un tip valioso (no publicidad obvia).
Apertura con emoji. Un solo dato impactante. Un beneficio claro. Link o CTA al final.
Máx 100 palabras. Sin saludos corporativos. Sin "estimado cliente".`,

      'Guion Video': `
Guion completo para video 60-90 segundos (YouTube, LinkedIn o presentación).
Estructura: Gancho (10s) → Problema que resuelve GLP (20s) → Solución/Portafolio (40s) → CTA (10s).
Incluir: indicaciones de plano, texto en pantalla, voz en off completa.`,
    };

    const instruccionCanal = toneByCanal[canal] || 'tono profesional y persuasivo';

    try {
      logMsg('Conectando con OpenAI — construyendo copy con contexto real y estrategia de marca...');
      const prompt = `Eres Valeria, Copywriter estrella y Estratega de Contenidos de GLP Wealth Management, firma de inversión inmobiliaria de lujo en Panamá.

${BRAND_CTX}

CANAL A REDACTAR: ${canal}
INSTRUCCIONES ESPECÍFICAS DEL CANAL:
${instruccionCanal}

PORTAFOLIO GLP ACTUAL (usa estos datos reales, no inventes precios):
${catalogoReal}

CONTEXTO DE PROSPECTOS ACTIVOS (para personalización):
${prospectosActivos}

CONTEXTO OPERATIVO (Reporte SARA):
${saraCtx}

REGLAS ABSOLUTAS:
- USA datos REALES del portafolio (nombres exactos de proyectos, precios reales, zonas reales)
- NUNCA escribas "[Proyecto X]" ni "[precio]" — usa los datos del portafolio arriba
- NUNCA prometas "la mejor inversión" — sé específico con datos
- El contenido debe hacer que un colombiano de 45 años con $200K USD piense "esto es para mí"
- Idioma: Español colombiano sofisticado (no panameño, no neutro genérico)

Responde SOLO con JSON sin bloques de código markdown:
{"asunto": "título o asunto del contenido", "contenido": "el copy completo con toda la estructura pedida", "tags": ["tag1","tag2","tag3"], "contexto_generacion": "qué dato real del portafolio o de los prospectos motivó este contenido específico"}`;

      const res = await triggerOpenAI(prompt, 'Eres Valeria, la copywriter más efectiva del sector inmobiliario de lujo en Latinoamérica.');
      const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanRes);

      const newDraft: AgentDraft = {
        id: 'vd_' + Date.now(),
        date: today(),
        type: canal,
        canal,
        asunto: parsed.asunto,
        content: parsed.contenido,
        tags: parsed.tags || [],
        contexto: parsed.contexto_generacion || '',
        status: 'pending',
        notas_admin: ''
      };

      setValeriaDrafts(prev => [newDraft, ...prev]);
      setAgentValeriaContent(c => c + 1);
      logMsg(`✅ ${canal} generado: "${parsed.asunto}" — listo para revisión del administrador.`);
    } catch (e: any) {
      logMsg(`Error en redacción de Valeria: ${e.message}`);
      // Fallback con contexto real
      const fallback: AgentDraft = {
        id: 'vd_' + Date.now(),
        date: today(),
        type: canal,
        canal,
        asunto: `GLP Panamá — Oportunidad en ${PROJECTS[0]?.name || 'nuestros proyectos'}`,
        content: `${canal === 'LinkedIn Post' ? '🏙️' : '✉️'} [Borrador sin IA — editar]\n\n${canal === 'LinkedIn Post'
          ? `¿Sabías que invertir en ${PROJECTS[0]?.name || 'Panamá'} te da exención predial por 20 años en USD?\n\nMientras las tasas en Latinoamérica fluctúan, tu capital trabaja seguro, rentable y libre de impuestos prediales.\n\nPortafolio GLP: desde $${PROJECTS[0]?.minPrice?.toLocaleString() || '150,000'} USD.\n\n#GLP #PanamaRealEstate #InversionInmobiliaria`
          : `Estimado/a [NOMBRE],\n\nQueremos compartirle una oportunidad concreta en ${PROJECTS[0]?.name || 'nuestros proyectos'}: rentabilidad superior al 8% anual en USD, con exención predial por 20 años.\n\nAgendemos una llamada de 20 minutos.\n\nValeria · GLP Wealth Management`
        }`,
        tags: ['GLP', 'Panama', 'InversionInmobiliaria'],
        contexto: 'Generado sin IA — API no disponible',
        status: 'pending',
        notas_admin: ''
      };
      setValeriaDrafts(prev => [fallback, ...prev]);
    } finally {
      setAgentValeriaActive(false);
      setValeriaGenerating(false);
    }
  };

  // Genera video de Isabella a partir de un contenido aprobado de Valeria
  const handleIsabellaFromValeria = async (valeriaDraft: AgentDraft) => {
    setAgentIsabellaActive(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logMsg = (msg: string) => setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'ISABELLA', msg }]);
    logMsg(`Isabella adaptando contenido de Valeria a video: "${valeriaDraft.asunto}"...`);

    const catalogoReal = PROJECTS.map(p =>
      `• ${p.name} (${p.zone}) — desde $${p.minPrice?.toLocaleString()||'consultar'} USD`
    ).join('\n');

    try {
      const prompt = `Eres Isabella, Brand Ambassador de GLP Wealth Management. Valeria (tu compañera copywriter) acaba de producir el siguiente contenido de marketing:

CANAL ORIGINAL: ${valeriaDraft.canal || valeriaDraft.type}
TÍTULO: ${valeriaDraft.asunto}
CONTENIDO DE VALERIA:
"""
${valeriaDraft.content}
"""

PERFIL DE MARCA:
- Audiencia: ${brandProfile.audiencias[0]}
- Tono: ${brandProfile.tonos.slice(0,2).join(' + ')}
- CTA: ${brandProfile.cta_principal}
- Activos disponibles: ${brandProfile.activos_visuales.slice(0,3).join(' · ')}

PORTAFOLIO:
${catalogoReal}

Tu misión: Convierte este contenido de Valeria en un Reel de 45 segundos que Isabella presentará en cámara. El guion debe:
1. Respetar los mensajes clave del texto de Valeria
2. Adaptarlos al formato de video (frases más cortas, más impacto visual, lenguaje hablado)
3. Incluir indicaciones de producción completas

Responde SOLO con JSON sin bloques de código:
{"titulo": "título del reel", "duracion": "45s", "contenido": "guion completo con secciones GANCHO/DESARROLLO/CTA, texto en pantalla por sección, planos sugeridos y activos de video a usar", "notas_produccion": "notas para el equipo de producción", "assets_requeridos": ["asset 1", "asset 2"]}`;

      const res = await triggerOpenAI(prompt, 'Eres Isabella, presentadora de GLP. Adaptas copies de marketing a guiones de video ejecutables.');
      const parsed = JSON.parse(res.replace(/```json/g,'').replace(/```/g,'').trim());

      const newScript: AgentDraft = {
        id: 'is_vd_' + Date.now(),
        date: today(), type: 'Reel desde Valeria', canal: 'Reel Instagram',
        asunto: parsed.titulo,
        content: `🔗 Basado en: "${valeriaDraft.asunto}" (Valeria)\n\nDURACIÓN: ${parsed.duracion}\n\n${parsed.contenido}\n\n---\n📋 NOTAS DE PRODUCCIÓN:\n${parsed.notas_produccion}\n\n🎬 ASSETS:\n${(parsed.assets_requeridos||[]).map((a:string)=>`• ${a}`).join('\n')}`,
        tags: ['Isabella','Valeria','Coordinado','Reel'],
        contexto: `Adaptado desde contenido de Valeria: ${valeriaDraft.asunto}`,
        status: 'pending', notas_admin: ''
      };
      setIsabellaScripts(prev => [newScript, ...prev]);

      // Marcar la tarea de workflow como completada si existía
      setWorkflowTasks(prev => prev.map(t =>
        t.ref_id === valeriaDraft.id ? { ...t, status: 'completado' } : t
      ));

      // Registrar en workflow
      addWorkflowTask({
        from: 'VALERIA', to: 'ISABELLA',
        tipo: 'Adaptación a Video', titulo: `🎬 Reel desde: "${valeriaDraft.asunto}"`,
        contenido: `Isabella adaptó el contenido de Valeria a Reel de 45s.\nGuion: "${parsed.titulo}"`,
        status: 'completado', prioridad: 'alta', ref_id: newScript.id,
      });

      logMsg(`✅ Reel generado desde contenido de Valeria: "${parsed.titulo}"`);
    } catch(e: any) {
      logMsg(`Error adaptando contenido de Valeria: ${e.message}`);
    } finally {
      setAgentIsabellaActive(false);
    }
  };

  const handleIsabella = async (isSwarm = false, silent = false, reportTextSrc?: string, tipoVideoOverride?: string) => {
    setAgentIsabellaActive(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logMsg = (msg: string) => {
      if (!silent) setSwarmLogs(prev => [...prev, { time: timeStr, agent: 'ISABELLA', msg }]);
    };

    const tipoVideo = tipoVideoOverride || 'Reel 45s';
    logMsg(`Isabella preparando producción de ${tipoVideo} con perfil de marca GLP...`);

    // Contexto de marca compartido con Valeria
    const catalogoReal = PROJECTS.map(p =>
      `• ${p.name} (${p.zone}) — desde $${p.minPrice?.toLocaleString() || 'consultar'} USD — ${p.tipo} — entrega ${p.entrega}`
    ).join('\n');

    const saraCtx = reportTextSrc || saraReportText || 'Sin alertas críticas activas. Prospectos en monitoreo.';

    // Contexto del perfil de marca (mismo que Valeria)
    const brandCtx = `
PROPUESTA DE VALOR GLP: ${brandProfile.propuesta_valor}
AUDIENCIA: ${brandProfile.audiencias.slice(0, 3).join(' | ')}
TONO: ${brandProfile.tonos.slice(0, 2).join(' | ')}
DIFERENCIADORES: ${brandProfile.diferenciadores.join(' · ')}
OBJECIONES A DISOLVER: ${brandProfile.objeciones.map(o => o.split('→')[0].trim()).join(' / ')}
CTA PRINCIPAL: ${brandProfile.cta_principal}
ACTIVOS VISUALES: ${brandProfile.activos_visuales.join(' · ')}
${brandProfile.notas_adicionales ? `NOTAS DEL EQUIPO: ${brandProfile.notas_adicionales}` : ''}`;

    const TIPOS_VIDEO: Record<string, string> = {
      'Reel 45s': `
Reel de Instagram/TikTok de 45 segundos.
Estructura obligatoria:
SECCIÓN 1 — GANCHO (0-5s): Una frase que detenga el scroll. Texto en pantalla grande. Isabella de pie, cámara directa.
SECCIÓN 2 — TENSIÓN (5-15s): Dato que genera intriga o contraste. Ej: comparativa Colombia vs Panamá. B-roll recomendado.
SECCIÓN 3 — SOLUCIÓN (15-35s): Isabella explica el diferenciador GLP con datos reales. Texto en pantalla por dato.
SECCIÓN 4 — CTA (35-45s): Acción específica (DM, link, comentar palabra clave). Isabella de frente, energía alta.

Para cada sección incluir:
- AUDIO (voz en off de Isabella — texto completo listo para grabar)
- TEXTO EN PANTALLA (máx 6 palabras, fuente grande, contraste alto)
- PLANO SUGERIDO (tipo de toma, ángulo, movimiento)
- ACTIVO VISUAL (qué imagen/video del banco usar)
- DURACIÓN EXACTA`,

      'Video Educativo 90s': `
Video educativo de 90 segundos para Instagram/LinkedIn/YouTube Shorts.
Isabella como experta — no como vendedora.
Estructura:
INTRO (0-8s): Isabella se presenta + promesa de valor ("En los próximos 90 segundos vas a entender X")
PUNTO 1 (8-35s): Primer concepto clave con dato real
PUNTO 2 (35-60s): Segundo concepto — giro o contraste inesperado
PUNTO 3 (60-80s): Tercer concepto — el que genera el "aha moment"
CTA (80-90s): Acción específica + urgencia genuina

Incluir por sección: audio completo, texto pantalla, plano, activo visual, prop/elemento visual si aplica.`,

      'Testimonial 60s': `
Video de testimonio/caso de éxito de 60 segundos.
Formato: Isabella presenta el caso → datos del cliente (anónimo) → resultado → invitación.
IMPORTANTE: El cliente debe ser un colombiano anónimo ("un cliente de Bogotá", "empresario de Medellín").
Incluir: guion de Isabella + preguntas sugeridas para el entrevistado + b-roll para cada segmento.`,

      'Historia de Proyecto 120s': `
Mini-documental de 2 minutos sobre un proyecto específico del portafolio GLP.
Estructura cinematográfica: Establecimiento → Conflicto/Necesidad → Solución (el proyecto) → Transformación → CTA.
Isabella como narradora principal. Incluir escenas sugeridas en ubicación real del proyecto.`,

      'Calendario Semanal': `
Calendario completo de producción para la semana siguiente (lunes a viernes + fin de semana).
Para cada día: tipo de contenido, plataforma, tema, activos necesarios, hora de publicación sugerida, caption corto, CTA.
Formato tabla con columnas: DÍA | PLATAFORMA | FORMATO | TEMA | ASSET NECESARIO | HORA | CTA.
Incluir también: 1 Reel principal (con guion), 2 Stories, 1 carrusel educativo, 1 post estático.`,
    };

    const instrucciones = TIPOS_VIDEO[tipoVideo] || TIPOS_VIDEO['Reel 45s'];

    try {
      logMsg('Conectando con OpenAI — generando guion de producción profesional...');
      const prompt = `Eres Isabella, Brand Ambassador y Presentadora Principal de GLP Wealth Management. Eres la cara visible de la firma — elegante, experta, cercana. Hablas de inversión inmobiliaria en Panamá de manera que un colombiano de 45 años con patrimonio entiende y confía en ti.

PERFIL DE MARCA GLP:
${brandCtx}

PORTAFOLIO REAL GLP (usa estos datos — no inventes precios ni proyectos):
${catalogoReal}

CONTEXTO OPERATIVO (SARA):
${saraCtx}

TIPO DE CONTENIDO A GENERAR: ${tipoVideo}
INSTRUCCIONES ESPECÍFICAS:
${instrucciones}

REGLAS ABSOLUTAS:
- Usa proyectos y precios REALES del portafolio arriba
- El audio de Isabella debe sonar natural — como habla una persona, no como lee un texto
- Cada dato financiero que menciones debe ser real y verificable (% de rentabilidad, años de exención, precios)
- Los textos en pantalla deben poder leerse en 2 segundos
- El guion debe ser ejecutable por un equipo de producción sin preguntas adicionales

Responde SOLO con JSON sin bloques de código:
{"titulo": "título del video", "duracion": "duración total", "contenido": "el guion completo con todas las secciones estructuradas", "notas_produccion": "notas técnicas para el equipo de producción (equipamiento, locación sugerida, vestuario Isabella, etc.)", "assets_requeridos": ["lista de activos visuales necesarios del banco de contenido"]}`;

      const res = await triggerOpenAI(prompt, 'Eres Isabella, presentadora y brand ambassador de GLP Wealth Management. Tu guion debe ser ejecutable en producción real.');
      const cleanRes = res.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanRes);

      // Si contenido viene como objeto JSON (secciones), lo formateamos como texto
      const contenidoRaw = parsed.contenido;
      let contenidoTexto = '';
      if (typeof contenidoRaw === 'string') {
        contenidoTexto = contenidoRaw;
      } else if (Array.isArray(contenidoRaw)) {
        contenidoTexto = contenidoRaw.map((s: any, i: number) => {
          const nombre = s.nombre || s.titulo || s.seccion || `Sección ${i+1}`;
          const duracion = s.duracion || '';
          const audio = s.audio || s.gancho?.audio || '';
          const texto = s.texto_pantalla || s.texto || s.gancho?.texto || '';
          const plano = s.plano || s.gancho?.plano || '';
          const asset = s.activo_visual || s.asset || '';
          return [
            `── ${nombre.toUpperCase()} ${duracion ? `(${duracion})` : ''} ──`,
            audio ? `🎙 AUDIO: "${audio}"` : '',
            texto ? `📺 TEXTO PANTALLA: ${texto}` : '',
            plano ? `🎬 PLANO: ${plano}` : '',
            asset ? `🖼 ASSET: ${asset}` : '',
          ].filter(Boolean).join('\n');
        }).join('\n\n');
      } else if (typeof contenidoRaw === 'object' && contenidoRaw !== null) {
        contenidoTexto = Object.entries(contenidoRaw).map(([k,v]) =>
          `── ${k.toUpperCase()} ──\n${typeof v === 'object' ? JSON.stringify(v, null, 2) : v}`
        ).join('\n\n');
      }

      const newScript: AgentDraft = {
        id: 'is_' + Date.now(),
        date: today(),
        type: tipoVideo,
        canal: tipoVideo,
        asunto: parsed.titulo,
        content: `DURACIÓN: ${parsed.duracion}\n\n${contenidoTexto}\n\n${'─'.repeat(40)}\n📋 NOTAS DE PRODUCCIÓN:\n${parsed.notas_produccion}\n\n🎬 ASSETS REQUERIDOS:\n${(parsed.assets_requeridos || []).map((a: string) => `• ${a}`).join('\n')}`,
        tags: ['Isabella', 'Video', tipoVideo.replace(' ', ''), 'Producción'],
        contexto: `Generado con perfil de marca GLP · ${brandProfile.audiencias[0]?.slice(0, 40) || 'Audiencia colombiana'}`,
        status: 'pending',
        notas_admin: ''
      };

      setIsabellaScripts(prev => [newScript, ...prev]);

      // También notificar a Valeria si el tipo es Reel (coordinación cross-agent)
      if (tipoVideo === 'Reel 45s' || tipoVideo === 'Video Educativo 90s') {
        const coordinationNote: AgentDraft = {
          id: 'vd_coord_' + Date.now(),
          date: today(),
          type: 'Coordinación Isabella→Valeria',
          canal: 'Coordinación',
          asunto: `Copy para acompañar: "${parsed.titulo}"`,
          content: `[PENDIENTE — Valeria debe generar el caption y hashtags para este video de Isabella]\n\nTítulo del video: ${parsed.titulo}\nDuración: ${parsed.duracion}\nCanal: ${tipoVideo}\n\nGenera un Post Estático Instagram o Reel caption que acompañe este video.`,
          tags: ['Coordinación', 'Isabella', 'PendienteValeria'],
          contexto: 'Tarea de coordinación generada automáticamente por Isabella',
          status: 'pending',
          notas_admin: 'Isabella generó el guion de video — Valeria debe generar el copy de acompañamiento'
        };
        setValeriaDrafts(prev => [coordinationNote, ...prev]);
        logMsg(`✅ Coordinación activada: Valeria recibió tarea de copy para "${parsed.titulo}"`);
      }

      setAgentIsabellaPosts(p => p + 1);
      logMsg(`✅ Guion de producción "${parsed.titulo}" listo para revisión del administrador.`);
    } catch (e: any) {
      logMsg(`Error en Isabella: ${e.message}`);
      // Fallback
      setIsabellaScripts(prev => [{
        id: 'is_' + Date.now(), date: today(), type: tipoVideo, canal: tipoVideo,
        asunto: `Reel GLP — ${PROJECTS[0]?.name || 'Inversión en Panamá'}`,
        content: `SECCIÓN 1 — GANCHO (0-5s)\nAUDIO: "¿Sabías que en Panamá llevas 20 años sin pagar impuesto predial?"\nTEXTO PANTALLA: $0 PREDIAL · 20 AÑOS\nPLANO: Plano medio Isabella, cámara directa, fondo neutro o proyecto\n\nSECCIÓN 2 — DATO (5-25s)\nAUDIO: "Mientras en Colombia el predial sube cada año, en ${PROJECTS[0]?.name || 'nuestros proyectos'} desde $${PROJECTS[0]?.minPrice?.toLocaleString() || '150,000'} USD, tu rentabilidad en dólares supera el 8% anual sin ese costo."\nTEXTO PANTALLA: +8% USD · SIN PREDIAL\nPLANO: B-roll del proyecto o render\n\nSECCIÓN 3 — CTA (25-45s)\nAUDIO: "${brandProfile.cta_principal}"\nTEXTO PANTALLA: ESCRÍBENOS "PANAMÁ"\nPLANO: Isabella de frente, sonríe, gesto hacia cámara`,
        tags: ['Isabella', 'Video', 'Fallback'],
        contexto: 'Generado sin IA — editar antes de producción',
        status: 'pending', notas_admin: ''
      }, ...prev]);
    } finally {
      setAgentIsabellaActive(false);
    }
  };

  const runSwarm = async () => {
    if (swarmRunning) return;
    setSwarmRunning(true);
    setSwarmLogs([]);
    const timeStr = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // PASO 1: Camilo — Research de mercado (alimenta todo el enjambre)
    setSwarmStep(0);
    setSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '🚀 ENJAMBRE INICIADO — Camilo hace research primero para alimentar a Sara, Valeria e Isabella...' }]);
    await handleCamilo(true, false, 'research');
    await new Promise(r => setTimeout(r, 2000));

    // PASO 2: Sara — Usa el reporte de Camilo para monitorear prospectos
    setSwarmStep(1);
    setSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '📡 Sara recibe inteligencia de Camilo y actualiza monitoreo de prospectos...' }]);
    let latestProspects: Prospect[] = [];
    setProspects(prev => { latestProspects = prev; return prev; });
    await handleSara(true, false, latestProspects);
    await new Promise(r => setTimeout(r, 2000));

    // PASO 3: Valeria — Genera contenido con los insights de Camilo + reporte Sara
    setSwarmStep(2);
    let latestReport = '';
    setSaraReportText(prev => { latestReport = prev; return prev; });
    setSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '✍️ Valeria recibe insights de Camilo + reporte Sara y genera contenido...' }]);
    await handleValeria(true, false, latestReport);
    await new Promise(r => setTimeout(r, 2000));

    // PASO 4: Isabella — Genera video usando el reporte enriquecido por Camilo
    setSwarmStep(3);
    setSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '🎬 Isabella recibe briefing completo y genera guion de producción...' }]);
    await handleIsabella(true, false, latestReport, 'Reel 45s');
    await new Promise(r => setTimeout(r, 1000));

    setSwarmStep(null);
    setSwarmRunning(false);

    const totalTasks = workflowTasks.filter(t => t.status === 'pendiente').length;
    setSwarmLogs(prev => [...prev, {
      time: timeStr(), agent: 'SISTEMA',
      msg: `✅ ENJAMBRE COMPLETO — Insights generados, prospectos monitoreados, contenido creado, video en producción. ${totalTasks} tareas pendientes en el Flujo de Trabajo.`
    }]);
  };

  const runCrisisSwarm = async () => {
    if (crisisSwarmRunning) return;
    setCrisisSwarmRunning(true);
    setCrisisSwarmLogs([]);
    const timeStr = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Paso 1: Camilo
    setCrisisSwarmStep(0);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '🚀 Iniciando Enjambre de Recuperación de Ventas Caídas...' }]);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'CAMILO', msg: 'Analizando las 4 ventas caídas del registro de objeciones...' }]);
    await new Promise(r => setTimeout(r, 1500));
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'CAMILO', msg: 'Mapeo completado. Las causas principales son: (1) Temores fiscales de doble tributación (DIAN) en un 50% y (2) Objeciones sobre tasas hipotecarias (8.5% USD) en un 25%.' }]);
    
    // Paso 2: Sara
    setCrisisSwarmStep(1);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SARA', msg: 'Sara analizando objeciones impositivas y de tasas e inyectando correos en el CRM...' }]);
    await new Promise(r => setTimeout(r, 1500));
    const reportText = `### REPORTE DE ANÁLISIS DE CRISIS — VENTAS CAÍDAS
**Generado por Sara (Customer Success)**
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
    
    // INTEGRATION: Push targeted email drafts into their respective prospects
    setProspects(prev => prev.map(p => {
      if (p.nombre.includes('Juan') || p.apellido.includes('Restrepo') || p.nombre.includes('Carolina')) {
        return {
          ...p,
          emailHistory: [
            ...(p.emailHistory || []),
            {
              id: 'sara_crisis_' + Date.now() + Math.random(),
              date: today(),
              subject: 'Respuesta a su inquietud sobre la inversión con GLP',
              body: p.nombre.includes('Juan') 
                ? 'Estimado Juan Carlos,\n\nComprendemos sus reservas respecto al reporte CRS. Le confirmamos que Panamá opera bajo un régimen territorial y el CDI con Colombia permite acreditar impuestos prediales, previniendo doble imposición.\n\nQuedamos atentos,\nEquipo Legal GLP'
                : 'Estimada Carolina,\n\nEntendemos su preocupación por la tasa del 8.5%. Recuerde que al invertir en Ventu cuenta con exención del impuesto predial por 20 años, lo cual neutraliza completamente el costo de los intereses.\n\nQuedamos a su disposición,\nValeria, GLP',
              status: 'draft',
              direction: 'out'
            }
          ]
        };
      }
      return p;
    }));

    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SARA', msg: 'Reporte generado. Se levantaron 2 Alertas Críticas y se insertaron correos en borrador para Juan Carlos y Carolina.' }]);

    // Paso 3: Valeria
    setCrisisSwarmStep(2);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'VALERIA', msg: 'Valeria redactando contenido anti-crisis para contrarrestar objeciones...' }]);
    await new Promise(r => setTimeout(r, 1500));
    const emailDraft = `Asunto: Desmitificando la Doble Tributación y Tasas en Panamá — Su Inversión Segura\n\nEstimado Inversionista,\n\nEntendemos que al invertir en el exterior, la claridad legal es fundamental. Queremos aclararle dos mitos comunes:\n1. **Doble Tributación**: Panamá opera bajo un sistema tributario territorial. Esto significa que usted NO paga impuesto predial por 20 años en nuestros proyectos nuevos, y sus rentas locales se benefician del CDI de 2015, permitiéndole acreditar lo pagado en Panamá ante la DIAN en Colombia.\n2. **Tasa del 8.5%**: Aunque la tasa en dólares parezca alta, la exención tributaria predial durante 20 años y la valorización histórica (3-5% en USD) neutralizan por completo el costo financiero, resultando en un rendimiento neto superior al de cualquier CDT en Colombia.\n\nLe invitamos a una sesión privada con Colombia Tax Law Group para estructurar su compra.\n\nAtentamente,\nEquipo de Wealth Management GLP`;
    
    const postDraft = `¿Preocupado por la doble tributación Colombia-Panamá? 🇨🇴🇵🇦\nMuchos inversionistas creen que declarar sus activos en dólares les generará doble impuesto. La verdad es que gracias a la legislación territorial y al CDI de 2015, puedes estructurar tu portafolio de forma 100% legal y eficiente. Además, con 20 años de exención de impuesto predial en proyectos GLP, tus retornos netos en dólares están blindados. \n#InversionDolarizada #DIAN #ColombiaTaxLaw #GLPPanama`;
    
    setCrisisValeriaDrafts([emailDraft, postDraft]);
    // INTEGRATION: Push to Valeria's queue
    setValeriaDrafts(prev => [
      { id: 'vd_c_' + Date.now(), date: today(), type: 'Email Masivo (Crisis)', status: 'pending', content: emailDraft },
      { id: 'vd_c_' + (Date.now() + 1), date: today(), type: 'LinkedIn Post (Crisis)', status: 'pending', content: postDraft },
      ...prev
    ]);
    
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'VALERIA', msg: 'Copys generados en el historial de Valeria: 1 Email Masivo y 1 Post de LinkedIn.' }]);

    // Paso 4: Isabella
    setCrisisSwarmStep(3);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'ISABELLA', msg: 'Isabella estructurando el guión del Reel y la campaña de marca...' }]);
    await new Promise(r => setTimeout(r, 1500));
    
    const scriptText = `Guión de Reels (1 Minuto) - Objeciones de Inversión:\n"¿Crees que invertir en dólares en Panamá te va a costar el doble en impuestos con la DIAN? ¡Es un mito! Hola, soy Isabella de GLP. Panamá opera con sistema tributario territorial, lo que significa que no pagas impuestos de fuente panameña dos veces. Y lo mejor: los proyectos nuevos están exentos de impuesto predial por 20 años. Sí, ¡dos décadas sin predial! Eso neutraliza cualquier tasa de interés hipotecaria y asegura retornos netos de hasta el 8.5% en USD. Escribe la palabra IMPUESTOS y te enviamos la guía fiscal gratuita de Colombia Tax Law Group."`;
    
    const calendarText = `Campaña de Crisis Semanal:\n- Lunes: Publicar Reel de Isabella explicando la exención predial de 20 años.\n- Miércoles: Enviar mailing masivo con el borrador de Valeria a los leads fríos.\n- Viernes: Mesa redonda interactiva en vivo por LinkedIn con socios de Colombia Tax Law Group.`;
    
    setCrisisIsabellaScripts([scriptText, calendarText]);
    // INTEGRATION: Push to Isabella's queue
    setIsabellaScripts(prev => [
      { id: 'is_c_' + Date.now(), date: today(), type: 'Video Script (Crisis)', status: 'pending', content: scriptText },
      { id: 'is_c_' + (Date.now() + 1), date: today(), type: 'Campaña Semanal (Crisis)', status: 'pending', content: calendarText },
      ...prev
    ]);
    
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'ISABELLA', msg: 'Script de video y Campaña de Crisis añadidos al historial de Isabella.' }]);

    setCrisisSwarmStep(null);
    setCrisisSwarmRunning(false);
    setCrisisSwarmLogs(prev => [...prev, { time: timeStr(), agent: 'SISTEMA', msg: '✅ Campaña de crisis generada con éxito. Revisa el módulo de Agentes para aprobar el material.' }]);
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
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); runCrisisSwarm(); }}
            disabled={crisisSwarmRunning}
            style={btnPrimary({
              padding: '8px 16px', fontSize: 12,
              background: crisisSwarmRunning ? T.textSec : T.teal,
              cursor: crisisSwarmRunning ? 'not-allowed' : 'pointer'
            })}
          >
            {crisisSwarmRunning ? 'Ejecutando Enjambre...' : 'Ejecutar Enjambre de Crisis'}
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
            <div style={{ color: '#64748B', fontStyle: 'italic' }}>Esperando ejecución del enjambre...</div>
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

  const calcIRR = (cashFlows: number[]): number | null => {
    const npv = (r: number) => cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
    let lo = -0.999, hi = 10;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (Math.abs(npv(mid)) < 1e-6) return mid;
      npv(lo) * npv(mid) < 0 ? (hi = mid) : (lo = mid);
    }
    return (lo + hi) / 2;
  };

  const calcMortgage = useCallback((principal: number, rateAnual: number, years: number) => {
    if (principal <= 0 || rateAnual <= 0 || years <= 0) return 0;
    const r = rateAnual / 100 / 12;
    const n = years * 12;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }, []);

  // ── Select Calc Project ─────────────────────────────────
  const selectCalcProject = (name: string) => {
    setCalcProject(name);
    const p = PROJECTS.find(x => x.name === name);
    if (!p) return;
    setCalcPrecio(p.minPrice);
    setCalcArea(p.areaMin);
    setCalcRentaM2(p.rentM2Max || p.rentM2Min || 12);
    setCalcVacancia(p.vacancyDef);
    setCalcCondominio(0); // always default to 0
    setCalcValorizacion(p.appreciationDef);
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
      case 'catalogo': return <Icon name="database" size={size} color={color} style={{ flexShrink: 0 }} />;
      case 'portafolio':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M3 21h18" />
            <path d="M9 21V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12" />
            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
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
      case 'configuracion':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
    const sortedProjects = [...editableProjects].sort((a, b) => a.name.localeCompare(b.name));
    const filtered = portFilter === 'all' ? sortedProjects : sortedProjects.filter(p => p.category === portFilter);
    const catColors: Record<string, string> = { 'Proyecto de Ciudad': T.teal, 'Ocean Reef Islands': T.sky, 'Playa Caracol': T.palm };
    const fallbackGradients = [
      T.teal,
      T.sky,
      T.palm,
      T.coral,
      T.textSec,
    ];

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !uploadingProject) return;
      const proyectoId = uploadingProject.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const url = await uploadProjectImage(proyectoId, file);
      if (url) {
        setProjectImageOverrides(prev => ({ ...prev, [uploadingProject]: url }));
        await saveProjectImageUrl(proyectoId, url);
      }
      setUploadingProject(null);
      e.target.value = '';
    };

    return (
      <div>
        <input ref={uploadInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        {sectionTitle('Portafolio GLP · Proyectos de Inversión')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['all', 'Todos'], ['Proyecto de Ciudad', 'Ciudad'], ['Ocean Reef Islands', 'Ocean Reef Islands'], ['Playa Caracol', 'Playa Caracol']].map(([id, label]) => (
            <button key={id} onClick={() => setPortFilter(id)} style={{
              padding: '6px 14px', borderRadius: 16, border: `1px solid ${id === 'all' ? T.teal : catColors[id] || T.teal}`,
              background: portFilter === id ? (id === 'all' ? T.teal : catColors[id]) : 'transparent',
              color: portFilter === id ? '#fff' : T.text,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
          <span style={{ fontSize: 12, color: T.textSec, alignSelf: 'center', marginLeft: 8 }}>{filtered.length} proyectos</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map((p, i) => {
            const expanded = expandedProject === p.name;
            const imgs = PROJECT_IMAGES[p.name];
            const heroUrl = projectImageOverrides[p.name] || imgs?.main;
            const heroStyle = heroUrl
              ? { backgroundImage: `url(${heroUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: fallbackGradients[i % fallbackGradients.length] };
            const isUploading = uploadingProject === p.name;
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
                  {/* Upload button */}
                  <button onClick={e => {
                    e.stopPropagation();
                    setUploadingProject(p.name);
                    uploadInputRef.current?.click();
                  }} title="Subir imagen de portada" style={{
                    position: 'absolute' as const, top: 8, right: 8, zIndex: 10,
                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 6,
                    color: '#fff', fontSize: 16, width: 32, height: 32, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isUploading ? '⏳' : '📷'}
                  </button>
                  <div style={{ position: 'relative' as const, zIndex: 1, display: 'flex', gap: 6, alignItems: 'flex-end', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: expanded ? 18 : 15, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{p.zoneShort}</div>
                    </div>
                    {badge(p.category, 'rgba(255,255,255,0.2)', '#fff')}
                    {p.entrega && <span style={{ fontSize: 9, background: 'rgba(0,0,0,0.4)', color: '#fff', padding: '2px 6px', borderRadius: 8, whiteSpace: 'nowrap' }}>🗓 {p.entrega}</span>}
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
                      {/* Edit toggle */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button onClick={e => { e.stopPropagation(); setEditingProject(editingProject === p.name ? null : p.name); }}
                          style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '5px 14px', border: `1px solid ${T.teal}`, background: editingProject === p.name ? T.teal : 'transparent', color: editingProject === p.name ? '#fff' : T.teal, cursor: 'pointer', borderRadius: 3 }}>
                          {editingProject === p.name ? '✓ Guardar' : '✏️ Editar proyecto'}
                        </button>
                      </div>

                      {editingProject === p.name ? (
                        /* ── MODO EDICIÓN ── */
                        <div onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, marginBottom: 14 }}>
                            {([
                              { label: 'Nombre', field: 'name', type: 'text' },
                              { label: 'Entrega', field: 'entrega', type: 'text' },
                              { label: 'Zona completa', field: 'zone', type: 'text' },
                              { label: 'Zona corta', field: 'zoneShort', type: 'text' },
                              { label: 'Tipo', field: 'tipo', type: 'text' },
                              { label: 'Categoría', field: 'category', type: 'text' },
                              { label: 'Habitaciones', field: 'bedrooms', type: 'text' },
                              { label: 'Precio mín (USD)', field: 'minPrice', type: 'number' },
                              { label: 'Precio máx (USD)', field: 'maxPrice', type: 'number' },
                              { label: 'Área mín (m²)', field: 'areaMin', type: 'number' },
                              { label: 'Área máx (m²)', field: 'areaMax', type: 'number' },
                              { label: 'Precio/m² mín', field: 'priceM2Min', type: 'number' },
                              { label: 'Precio/m² máx', field: 'priceM2Max', type: 'number' },
                              { label: 'Renta sugerida/mes', field: 'rentSuggest', type: 'number' },
                              { label: 'Renta/m² mín', field: 'rentM2Min', type: 'number' },
                              { label: 'Renta/m² máx', field: 'rentM2Max', type: 'number' },
                              { label: 'Condominio/mes', field: 'condominioMes', type: 'number' },
                              { label: 'Vacancia (%)', field: 'vacancyDef', type: 'number' },
                              { label: 'Valorización (% anual)', field: 'appreciationDef', type: 'number' },
                              { label: 'Cap rate mín (%)', field: 'capRateMin', type: 'number' },
                              { label: 'Cap rate máx (%)', field: 'capRateMax', type: 'number' },
                            ] as { label: string; field: keyof ProjectData; type: string }[]).map(({ label, field, type }) => (
                              <div key={field as string}>
                                <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3, fontWeight: 600 }}>{label}</div>
                                <input
                                  type={type}
                                  value={p[field] as string | number}
                                  onChange={e => updateProject(p.name, field, type === 'number' ? Number(e.target.value) : e.target.value)}
                                  style={{ ...inputStyle({ fontSize: 11, padding: '5px 8px' }), width: '100%', boxSizing: 'border-box' as const }}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3, fontWeight: 600 }}>Nota de valorización</div>
                            <textarea value={p.appreciationNote} onChange={e => updateProject(p.name, 'appreciationNote', e.target.value)}
                              style={{ ...inputStyle(), width: '100%', boxSizing: 'border-box' as const, fontSize: 11, minHeight: 60, resize: 'vertical' as const }} />
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3, fontWeight: 600 }}>Amenidades (separadas por coma)</div>
                            <input value={p.amenities.join(', ')} onChange={e => updateProject(p.name, 'amenities', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                              style={{ ...inputStyle({ fontSize: 11, padding: '5px 8px' }), width: '100%', boxSizing: 'border-box' as const }} />
                          </div>
                        </div>
                      ) : (
                        /* ── MODO LECTURA ── */
                        <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, marginBottom: 16 }}>
                          <div><span style={{ color: T.textSec }}>Categoría: </span><b style={{ color: catColors[p.category] || T.teal }}>{p.category}</b></div>
                          <div><span style={{ color: T.textSec }}>Entrega: </span><b>{p.entrega}</b></div>
                          <div><span style={{ color: T.textSec }}>Zona: </span>{p.zone}</div>
                          <div><span style={{ color: T.textSec }}>Tipo: </span>{p.tipo}</div>
                          <div><span style={{ color: T.textSec }}>Precio/m²: </span>{usd(p.priceM2Min)}–{usd(p.priceM2Max)}</div>
                          <div><span style={{ color: T.textSec }}>Renta sugerida: </span>{usd(p.rentSuggest)}/mes</div>
                          <div><span style={{ color: T.textSec }}>Vacancia: </span>{p.vacancyDef}%</div>
                          <div><span style={{ color: T.textSec }}>Condominio: </span>{usd(p.condominioMes)}/mes</div>
                          <div><span style={{ color: T.textSec }}>Valorización: </span>{p.appreciationDef}% anual</div>
                          <div><span style={{ color: T.textSec }}>Renta/m²: </span>${p.rentM2Min}–${p.rentM2Max}</div>
                        </div>
                        <div style={{ fontSize: 12, color: T.textSec, marginBottom: 8 }}>{p.appreciationNote}</div>
                        </>
                      )}

                      {/* ZONE FOOTNOTE */}
                      <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${T.borderLight}`, fontSize: 11, color: T.textSec, fontStyle: 'italic', lineHeight: 1.4 }}>
                        {getZoneNotes(p.zone)}
                      </div>

                      {/* MARKET STUDY SEARCH WIDGET */}
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: `${T.teal}08`, border: `1.5px solid ${T.teal}18`, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          Estudio de Mercado Panamáá (Capital Brokers Q2 2026)
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input
                            type="text"
                            placeholder="Buscar en el estudio de Panamáá..."
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
                          {p.amenities.map(a => (
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
                      <span onClick={() => { if (activeModule !== 'prospectos') setPreviousModule(activeModule); setActiveModule('prospectos'); setProspectDetail(p.id); }} style={{ fontWeight: 600, color: T.sky, cursor: 'pointer', textDecoration: 'underline' }}>
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
                      <span onClick={() => { if (activeModule !== 'prospectos') setPreviousModule(activeModule); setActiveModule('prospectos'); setProspectDetail(p.id); }} style={{ fontWeight: 600, color: T.sky, cursor: 'pointer', textDecoration: 'underline' }}>
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
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Proyectos de Interés</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Etapa</th>
                <th style={{ padding: 8, textAlign: 'left', fontWeight: 600 }}>Broker Asignado</th>
                <th style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>Presupuesto (USD)</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                  <td style={{ padding: 8 }}>
                    <span onClick={() => { if (activeModule !== 'prospectos') setPreviousModule(activeModule); setActiveModule('prospectos'); setProspectDetail(p.id); }} style={{ fontWeight: 600, color: T.sky, cursor: 'pointer', textDecoration: 'underline' }}>
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

    return (
      <div>
        {sectionTitle('Dashboard KPIs · Control Comercial')}
        
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Icon name="currency" size={28} color={T.teal} /></div>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Icon name="trend-up" size={28} color={T.palm} /></div>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Icon name="users" size={28} color={T.sky} /></div>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Icon name="handshake" size={28} color={T.coral} /></div>
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
                {activeDrilldown.type === 'camilo_prospects' && '🤖 Prospectos Minados por Camilo'}
                {activeDrilldown.type === 'sara_history' && '📧 Historial de Correos y Registros de Sara'}
              </h3>
              <button type="button"
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
            {activeDrilldown.type === 'camilo_prospects' && renderCamiloProspectsDrilldown()}
            {activeDrilldown.type === 'sara_history' && renderSaraHistoryDrilldown()}
          </div>
        )}
      </div>
    );
  };

  const renderCamiloProspectsDrilldown = () => {
    const camiloProspects = prospects.filter(p => p.historial && Array.isArray(p.historial) && p.historial.some(h => h.detalle.includes('Camilo') || h.detalle.includes('Minería')));
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <p style={{ fontSize: 13, color: T.textSec, marginBottom: 16 }}>
          Estos son los prospectos de alto valor que <b>Camilo</b> ha extraído de LinkedIn, Registros Públicos y otras fuentes de datos estructurados, listos para que los Brokers interactúen.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {camiloProspects.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textSec, padding: 12 }}>No hay prospectos minados por Camilo aún. Presiona "Buscar Prospectos" en la consola de agentes.</div>
          ) : (
            camiloProspects.map(p => (
              <div key={p.id} style={{ background: T.bg, padding: 16, borderRadius: 10, border: `1px solid ${T.borderLight}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{p.nombre} {p.apellido}</div>
                  <div style={{ background: '#E6FFFA', color: '#047857', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>{p.estado}</div>
                </div>
                <div style={{ fontSize: 11, color: T.textSec }}>💼 {p.ocupacion} | Presupuesto: ${p.presupuesto_usd.toLocaleString()} USD</div>
                <div style={{ fontSize: 11, color: T.textSec }}>📍 {p.direccion}</div>
                <div style={{ fontSize: 11, color: T.textSec }}>🏢 Interés: {p.proyectos_interes.join(', ')}</div>
                <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic', marginTop: 4, padding: 6, background: '#F8FAFC', borderRadius: 6, border: `1px solid ${T.border}` }}>
                  📝 {p.notas}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderSaraHistoryDrilldown = () => {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <p style={{ fontSize: 13, color: T.textSec, marginBottom: 16 }}>
          Historial de interacciones, reportes de contingencia y alertas levantadas por <b>Sara</b> en sus revisiones automatizadas.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {saraAlertsList.length === 0 && !saraReportText ? (
             <div style={{ fontSize: 13, color: T.textSec, padding: 12 }}>No hay registros de Sara aún. Presiona "Analizar Consultas" en la consola de Agentes.</div>
          ) : null}
          
          {saraReportText && (
            <div style={{ background: T.bg, padding: 16, borderRadius: 10, border: `1px solid ${T.borderLight}`, display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.teal }}>Último Reporte Generado</div>
                  <div style={{ background: '#E6FFFA', color: '#047857', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>Completado</div>
                </div>
                <div style={{ fontSize: 11, color: T.textSec, whiteSpace: 'pre-wrap', lineHeight: 1.5, background: '#F8FAFC', padding: 12, borderRadius: 6, border: `1px solid ${T.border}` }}>
                  {saraReportText}
                </div>
            </div>
          )}

          {saraAlertsList.map((alert, idx) => (
             <div key={idx} style={{ background: T.bg, padding: 16, borderRadius: 10, border: `1px solid #FCA5A5`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#991B1B' }}>Alerta Crítica</div>
                  <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>Pendiente</div>
                </div>
                <div style={{ fontSize: 11, color: T.textSec }}>{alert}</div>
             </div>
          ))}

          {sentDrafts.map((draftId, idx) => (
             <div key={`draft-${idx}`} style={{ background: T.bg, padding: 16, borderRadius: 10, border: `1px solid ${T.borderLight}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Borrador Aprobado</div>
                  <div style={{ background: '#E6FFFA', color: '#047857', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>Enviado</div>
                </div>
                <div style={{ fontSize: 11, color: T.textSec }}>Id: {draftId}</div>
                <div style={{ fontSize: 11, color: T.textSec }}>Gestionado por Sara</div>
             </div>
          ))}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // ── CLOSING PROBABILITY ────────────────────────────────────────
  const calcClosingProb = (p: Prospect): number => {
    const stageBase: Record<string, number> = {
      'Contacto Inicial': 8, 'Calificación': 25, 'Presentación': 45,
      'Negociación': 68, 'Cierre': 95, 'Post-venta': 100,
    };
    let score = stageBase[p.estado] ?? 5;
    if ((p.emailHistory || []).length >= 3) score += 8;
    else if ((p.emailHistory || []).length >= 1) score += 4;
    if (p.broker_asignado) score += 6;
    if ((p.proyectos_interes || []).length >= 2) score += 5;
    if (p.notas && p.notas.length > 40) score += 4;
    if (p.presupuesto_usd >= 300000) score += 4;
    return Math.min(score, 99);
  };

  const ThermometerBar = ({ prob }: { prob: number }) => {
    const color = prob >= 70 ? '#48BB78' : prob >= 40 ? '#ECC94B' : '#FC8181';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${prob}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{prob}%</span>
      </div>
    );
  };

  // MODULE 3: BROKERS
  // ══════════════════════════════════════════════════════════════
  const renderBrokers = () => {
    // commissionEntities viene del state global (editable en Configuración)

    const filteredBrokers = brokers
      .filter(b => {
        const matchNombre = b.nombre.toLowerCase().includes(brokerFilters.nombre.toLowerCase());
        const matchEmpresa = b.empresa.toLowerCase().includes(brokerFilters.empresa.toLowerCase());
        const matchZona = brokerFilters.zona === '' || b.zona === brokerFilters.zona;
        return matchNombre && matchEmpresa && matchZona;
      })
      .sort((a, b) => {
        const getVal = (br: typeof a): number | string => {
          const bClosed = closedSales.filter(s => s.broker === br.nombre);
          const bLost = lostSales.filter(l => l.broker === br.nombre);
          const totalDeals = bClosed.length + bLost.length;
          switch (brokerSort.field) {
            case 'nombre': return br.nombre;
            case 'empresa': return br.empresa;
            case 'zona': return br.zona || '';
            case 'estado': return br.estado || '';
            case 'prospectos': return prospects.filter(p => p.broker_asignado === br.nombre && p.estado !== 'Cierre' && p.estado !== 'Post-venta').length;
            case 'cerrados': return bClosed.length;
            case 'tasaCierre': return totalDeals > 0 ? bClosed.length / totalDeals : 0;
            case 'comisiones': return bClosed.reduce((sum, s) => sum + s.value * 0.02, 0);
            default: return br.nombre;
          }
        };
        const av = getVal(a), bv = getVal(b);
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return brokerSort.dir === 'asc' ? cmp : -cmp;
      });

    const validBrokerNames = new Set(filteredBrokers.map(b => b.nombre));

    const sampleDeals = closedSales
      .filter(s => validBrokerNames.has(s.broker))
      .map(s => {
        const brokerObj = filteredBrokers.find(b => b.nombre === s.broker);
        return {
          deal: `${s.project} - ${s.prospect}`,
          valorVenta: s.value,
          broker: s.broker,
          empresa: brokerObj ? brokerObj.empresa : 'Independiente'
        };
      });

    // Contexto activo: broker individual o empresa buscada
    const drillBrokerObj = brokerDrilldown ? brokers.find(b => b.id === brokerDrilldown) : null;
    const empresaContexto = brokerFilters.empresa.trim().length >= 2 ? brokerFilters.empresa.trim() : null;

    const contextLabel: string | null = drillBrokerObj
      ? `${drillBrokerObj.nombre} · ${drillBrokerObj.empresa}`
      : empresaContexto
        ? `Empresa: ${empresaContexto}`
        : null;

    const contextFilteredDeals = sampleDeals.filter(d => {
      if (drillBrokerObj) return d.broker === drillBrokerObj.nombre;
      if (empresaContexto) return d.empresa.toLowerCase().includes(empresaContexto.toLowerCase());
      return true;
    });

    const totalVentas = contextFilteredDeals.reduce((sum, d) => sum + d.valorVenta, 0);
    const totalComision = totalVentas * 0.05;

    const filteredDeals = contextFilteredDeals;
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

      const contextSuffix = contextLabel ? ` · ${contextLabel}` : '';
      if (brokerEntityFilter === 'all') {
        title = `Reporte Consolidado de Comisiones GLP${contextSuffix}`;
        headers = ['Deal / Propiedad', 'Broker', 'Valor Venta', 'Comisión Total (5%)', 'Col. Tax Law (1%)', 'Valverde (1%)', 'Capital Brokers (1%)', 'Red de Brokers (2%)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
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
          usd(totalVentas),
          usd(totalComision),
          usd(totalVentas * 0.01),
          usd(totalVentas * 0.01),
          usd(totalVentas * 0.01),
          usd(totalVentas * 0.02)
        ];
      } else if (brokerEntityFilter === 'Colombia Tax Law Group') {
        title = `Reporte de Comisiones - Colombia Tax Law Group${contextSuffix}`;
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Valor Venta', 'Comisión CTLG (1% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.01)
        ]);
        totals = ['TOTAL ENTIDAD', '', usd(totalVentas), usd(totalVentas * 0.01)];
      } else if (brokerEntityFilter === 'Grupo Valverde') {
        title = `Reporte de Comisiones - Grupo Valverde${contextSuffix}`;
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Valor Venta', 'Comisión Valverde (1% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.01)
        ]);
        totals = ['TOTAL ENTIDAD', '', usd(totalVentas), usd(totalVentas * 0.01)];
      } else if (brokerEntityFilter === 'Capital Brokers') {
        title = `Reporte de Comisiones - Capital Brokers${contextSuffix}`;
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Valor Venta', 'Comisión Capital (1% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.01)
        ]);
        totals = ['TOTAL ENTIDAD', '', usd(totalVentas), usd(totalVentas * 0.01)];
      } else if (brokerEntityFilter === 'Red de Brokers (distribuible)') {
        title = `Reporte de Comisiones - Red de Brokers${contextSuffix}`;
        headers = ['Deal / Propiedad', 'Broker Asignado', 'Valor Venta', 'Comisión Red (2% Share)'];
        rows = filteredDeals.map(d => [
          d.deal,
          d.broker,
          usd(d.valorVenta),
          usd(d.valorVenta * 0.02)
        ]);
        totals = ['TOTAL RED', '', usd(totalVentas), usd(totalVentas * 0.02)];
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
        html += `<p>Generado el: ${new Date().toLocaleString()}</p>`;
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
        if (!win) { alert('Por favor permite las ventanas emergentes para generar el PDF'); return; }

        const totalVentasDoc = dataRows.reduce((s, r) => {
          const v = r.find((c: any) => typeof c === 'string' && c.startsWith('$') && !c.includes('0.0'));
          return s + (v ? parseFloat(v.replace(/[$,]/g, '')) : 0);
        }, 0);
        const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

        let html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titleStr}</title><style>
          @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #FAFAF8; color: #1C1917; }
          .page { max-width: 860px; margin: 0 auto; padding: 56px 48px; background: #FFFFFF; min-height: 100vh; }

          /* Header */
          .masthead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 1px solid #1C1917; margin-bottom: 32px; }
          .brand { font-family: 'EB Garamond', Georgia, serif; font-size: 22px; font-weight: 600; letter-spacing: 0.08em; color: #1C1917; text-transform: uppercase; }
          .brand-sub { font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 500; letter-spacing: 0.22em; color: #78716C; text-transform: uppercase; margin-top: 3px; }
          .doc-label { text-align: right; }
          .doc-label .type { font-size: 9px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #78716C; margin-bottom: 4px; }
          .doc-label .ref { font-family: 'Inter', sans-serif; font-size: 11px; color: #44403C; }

          /* Report title block */
          .title-block { margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid #E7E5E4; }
          .report-title { font-family: 'EB Garamond', Georgia, serif; font-size: 28px; font-weight: 500; color: #1C1917; letter-spacing: -0.01em; line-height: 1.2; margin-bottom: 8px; }
          .report-meta { display: flex; gap: 32px; margin-top: 12px; }
          .meta-item { }
          .meta-label { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #A8A29E; margin-bottom: 2px; }
          .meta-value { font-size: 12px; color: #44403C; font-weight: 500; }

          /* Context badge */
          .context-badge { display: inline-block; border: 1px solid #1C1917; padding: 4px 14px; font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #1C1917; margin-top: 10px; }

          /* Table */
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          thead tr { border-top: 1.5px solid #1C1917; border-bottom: 1px solid #1C1917; }
          th { padding: 10px 14px; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #44403C; text-align: left; background: transparent; }
          th.num { text-align: right; }
          tbody tr { border-bottom: 1px solid #E7E5E4; }
          tbody tr:nth-child(even) { background: #FAFAF8; }
          td { padding: 11px 14px; font-size: 12px; color: #1C1917; vertical-align: middle; }
          td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
          td.deal { font-weight: 500; }
          td.broker-name { color: #44403C; }
          td.amount { font-weight: 600; }
          td.commission { color: #1C1917; font-weight: 700; }

          /* Totals */
          .total-row { border-top: 1.5px solid #1C1917 !important; border-bottom: 1.5px solid #1C1917 !important; background: #F5F4F2 !important; }
          .total-row td { font-size: 12px; font-weight: 700; padding: 13px 14px; letter-spacing: 0.01em; }

          /* Summary strip */
          .summary { display: flex; gap: 0; margin: 28px 0 36px; border: 1px solid #E7E5E4; }
          .summary-item { flex: 1; padding: 16px 20px; border-right: 1px solid #E7E5E4; }
          .summary-item:last-child { border-right: none; }
          .summary-label { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #A8A29E; margin-bottom: 6px; }
          .summary-value { font-size: 20px; font-family: 'EB Garamond', serif; font-weight: 500; color: #1C1917; }

          /* Footer */
          .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #1C1917; display: flex; justify-content: space-between; align-items: center; }
          .footer-brand { font-size: 9px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #78716C; }
          .footer-note { font-size: 9px; color: #A8A29E; text-align: right; max-width: 320px; line-height: 1.5; }

          @media print {
            body { background: #fff; }
            .page { padding: 32px 40px; }
            .no-print { display: none; }
          }
        </style></head><body><div class="page">`;

        // Masthead
        html += `<div class="masthead">
          <div>
            <div class="brand">GLP · Grupo Los Pueblos</div>
            <div class="brand-sub">Panama · Real Estate &amp; Investment</div>
          </div>
          <div class="doc-label">
            <div class="type">Documento Confidencial</div>
            <div class="ref">Fecha: ${fecha}</div>
            <div class="ref" style="margin-top:2px">Moneda: USD</div>
          </div>
        </div>`;

        // Title block
        const cleanTitle = titleStr.replace(/·.*$/, '').trim();
        const contextPart = contextLabel ? contextLabel : null;
        html += `<div class="title-block">
          <div class="report-title">Liquidación de Comisiones</div>
          <div class="report-meta">
            <div class="meta-item"><div class="meta-label">Entidad</div><div class="meta-value">${brokerEntityFilter === 'all' ? 'Consolidado General — 5% Total' : brokerEntityFilter}</div></div>
            <div class="meta-item"><div class="meta-label">Operaciones</div><div class="meta-value">${dataRows.length} cierres</div></div>
            <div class="meta-item"><div class="meta-label">Período</div><div class="meta-value">Acumulado al ${fecha}</div></div>
          </div>
          ${contextPart ? `<div class="context-badge">Filtrado: ${contextPart}</div>` : ''}
        </div>`;

        // Summary strip
        const comTotal = totalsRow.find((c: any) => typeof c === 'string' && c.startsWith('$') && c !== totalsRow[2]);
        html += `<div class="summary">
          <div class="summary-item"><div class="summary-label">Valor Total Transacciones</div><div class="summary-value">${totalsRow[2] ?? '—'}</div></div>
          <div class="summary-item"><div class="summary-label">Comisiones Totales</div><div class="summary-value">${totalsRow[3] ?? '—'}</div></div>
          <div class="summary-item"><div class="summary-label">Operaciones Incluidas</div><div class="summary-value">${dataRows.length}</div></div>
        </div>`;

        // Table
        html += `<table><thead><tr>`;
        headersStr.forEach((h, i) => {
          const isNum = i > 1;
          html += `<th class="${isNum ? 'num' : ''}">${h}</th>`;
        });
        html += `</tr></thead><tbody>`;
        dataRows.forEach((row, ri) => {
          html += `<tr>`;
          row.forEach((cell: any, ci: number) => {
            const isNum = ci > 1;
            const cls = ci === 0 ? 'deal' : ci === 1 ? 'broker-name' : ci === 2 ? 'amount num' : 'commission num';
            html += `<td class="${cls}">${cell}</td>`;
          });
          html += `</tr>`;
        });
        if (totalsRow && totalsRow.length > 0) {
          html += `<tr class="total-row">`;
          totalsRow.forEach((cell: any, ci: number) => {
            const isNum = ci > 1;
            html += `<td class="${isNum ? 'num' : ''}">${cell}</td>`;
          });
          html += `</tr>`;
        }
        html += `</tbody></table>`;

        // Footer
        html += `<div class="footer">
          <div class="footer-brand">GLP · Grupo Los Pueblos · Panama</div>
          <div class="footer-note">Este documento es de carácter confidencial. Emitido por la plataforma GLP CRM. Todos los montos expresados en dólares americanos (USD).</div>
        </div>`;

        html += `<script>window.onload = function() { window.print(); }</script>`;
        html += `</div></body></html>`;
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

        {/* BROKER FILTERS */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input 
            placeholder="Buscar por Nombre..." 
            value={brokerFilters.nombre} 
            onChange={e => setBrokerFilters({ ...brokerFilters, nombre: e.target.value })} 
            style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, width: 200 }}
          />
          <input 
            placeholder="Buscar por Empresa..." 
            value={brokerFilters.empresa} 
            onChange={e => setBrokerFilters({ ...brokerFilters, empresa: e.target.value })} 
            style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, width: 200 }}
          />
          <select
            value={brokerFilters.zona}
            onChange={e => setBrokerFilters({ ...brokerFilters, zona: e.target.value })}
            style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13, width: 200 }}
          >
            <option value="">Todas las Zonas</option>
            {Array.from(new Set(brokers.map(b => b.zona))).filter(Boolean).map(z => (
              <option key={z as string} value={z as string}>{z as string}</option>
            ))}
          </select>
          <select
            value={brokerSort.field}
            onChange={e => setBrokerSort(s => ({ ...s, field: e.target.value }))}
            style={{ padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, background: T.card, color: T.text }}
          >
            <option value="nombre">Ordenar: Nombre</option>
            <option value="empresa">Ordenar: Empresa</option>
            <option value="zona">Ordenar: Zona</option>
            <option value="prospectos">Ordenar: Prospectos</option>
            <option value="cerrados">Ordenar: Negocios Cerrados</option>
            <option value="tasaCierre">Ordenar: Tasa de Cierre</option>
            <option value="comisiones">Ordenar: Comisiones</option>
            <option value="estado">Ordenar: Estado</option>
          </select>
          <button
            onClick={() => setBrokerSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
            style={{ padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, background: T.card, color: T.teal, fontWeight: 700, cursor: 'pointer' }}
            title={brokerSort.dir === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            {brokerSort.dir === 'asc' ? '↑' : '↓'}
          </button>
        </div>

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
              <tbody>
                {filteredBrokers.map(b => {
                  const bClosed = closedSales.filter(s => s.broker === b.nombre);
                  const bLost = lostSales.filter(l => l.broker === b.nombre);
                  const totalDeals = bClosed.length + bLost.length;
                  const closeRate = totalDeals > 0 ? (bClosed.length / totalDeals) * 100 : 0;
                  const comEarned = bClosed.reduce((sum, s) => sum + s.value * 0.02, 0);
                  const bProspects = prospects.filter(p => p.broker_asignado === b.nombre && p.estado !== 'Cierre' && p.estado !== 'Post-venta');

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
                })}
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
                          <button
                            type="button"
                            onClick={() => { if (activeModule !== 'prospectos') setPreviousModule(activeModule); setActiveModule('prospectos'); setProspectDetail(p.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: T.sky, textDecoration: 'underline', padding: 0 }}
                          >
                            {p.nombre} {p.apellido}
                          </button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Centro de Reportes Financieros · Comisiones</div>
            {contextLabel && (
              <div style={{ fontSize: 11, fontWeight: 700, color: T.teal, background: `${T.teal}12`, border: `1px solid ${T.teal}30`, borderRadius: 20, padding: '3px 12px' }}>
                Contexto: {contextLabel}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: '0.9rem', color: T.text }}>
              {contextLabel
                ? <>Reporte filtrado para <strong>{contextLabel}</strong> · entidad: <strong>{brokerEntityFilter === 'all' ? 'Consolidado' : brokerEntityFilter}</strong> · <strong>{filteredDeals.length} deals</strong> · <strong>{usd(totalVentas)}</strong> en ventas.</>
                : <>Genera reportes filtrados por entidad: <strong>{brokerEntityFilter === 'all' ? 'Consolidado General (5% Total)' : brokerEntityFilter}</strong>.</>
              }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Liquidación de Comisiones por Cierre</div>
              {contextLabel && <div style={{ fontSize: 11, color: T.teal, marginTop: 2 }}>Filtrado por: {contextLabel} · {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}</div>}
            </div>
            <select value={brokerEntityFilter} onChange={e => setBrokerEntityFilter(e.target.value)} style={inputStyle({ width: 200 })}>
              <option value="all">Todas las entidades</option>
              {commissionEntities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.teal, color: T.card }}>
                {['Deal / Venta', 'Broker', 'Valor Venta', 'Comisión Total (5%)', ...visibleEntities.map(e => `${e.name} (${e.pct}%)`)].map(h => (
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
                    <td style={{ padding: '8px 10px' }}>{usd(d.valorVenta)}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: T.teal }}>{usd(total)}</td>
                    {visibleEntities.map(e => (
                      <td key={e.name} style={{ padding: '8px 10px' }}>{usd(d.valorVenta * e.pct / 100)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // MODULE 4: PROSPECTOS (CRM)
  // ══════════════════════════════════════════════════════════════
  const renderProspectos = () => {
    const filtered = prospects
      .filter(p => {
        if (prospectFilterBroker !== 'all' && p.broker_asignado !== prospectFilterBroker) return false;
        if (prospectFilterStage !== 'all' && p.estado !== prospectFilterStage) return false;
        if (prospectFilterProject !== 'all' && !p.proyectos_interes.includes(prospectFilterProject)) return false;
        return true;
      })
      .sort((a, b) => {
        const stageOrder = Object.fromEntries(FUNNEL_STAGES.map((s, i) => [s, i]));
        const av: any = prospectSort.field === 'etapa' ? stageOrder[a.estado] ?? 0
          : prospectSort.field === 'probCierre' ? calcClosingProb(a)
          : (a as any)[prospectSort.field] ?? '';
        const bv: any = prospectSort.field === 'etapa' ? stageOrder[b.estado] ?? 0
          : prospectSort.field === 'probCierre' ? calcClosingProb(b)
          : (b as any)[prospectSort.field] ?? '';
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return prospectSort.dir === 'asc' ? cmp : -cmp;
      });

    const detailProspect = prospectDetail ? prospects.find(p => p.id === prospectDetail) : null;

    const saveProspectBackend = (p: Prospect) => {
      fetch(`http://localhost:3001/api/prospectos/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      }).catch(e => console.error('Error saving prospect:', e));
    };

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
      fetch('http://localhost:3001/api/prospectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(np)
      }).catch(e => console.error('Error creating prospect:', e));

      setNewProspect({
        nombre: '', apellido: '', direccion: '', correo: '', telefono: '', ocupacion: '',
        proyectos_interes: [], forma_contacto: 'Pagina Web', broker_asignado: '', estado: 'Contacto Inicial',
        presupuesto_usd: 0, notas: '', historial: [],
      });
      setShowProspectForm(false);
    };

    const moveStage = (id: number, newStage: string) => {
      const pToUpdate = prospects.find(p => p.id === id);
      if (pToUpdate) {
         const updatedP = {
            ...pToUpdate,
            estado: newStage,
            historial: [...pToUpdate.historial, { fecha: today(), accion: newStage, detalle: `Movido a ${newStage}` }],
         };
         setProspects(prospects.map(p => p.id === id ? updatedP : p));
         saveProspectBackend(updatedP);
      }
    };

    const deleteProspect = (id: number) => {
      setProspects(prospects.filter(p => p.id !== id));
      fetch(`http://localhost:3001/api/prospectos/${id}`, { method: 'DELETE' }).catch(e => console.error('Error deleting prospect', e));
      setDeleteConfirm(null);
      if (prospectDetail === id) setProspectDetail(null);
    };

    // Detail view
    if (detailProspect) {
      const dp = detailProspect;
      const isEditing = prospectEdit === dp.id;
      const dpAlerta = prospectAlerts.find(a => Number(a.prospecto_id) === Number(dp.id));
      const ALERT_BG: Record<string,string> = { critico: '#FEF2F2', frio: '#FFF7ED', tibio: '#FEFCE8', oportunidad: '#EFF6FF' };
      const ALERT_BORDER: Record<string,string> = { critico: '#DC2626', frio: '#EA580C', tibio: '#CA8A04', oportunidad: '#0284C7' };
      const ALERT_LABEL: Record<string,string> = { critico: '🔴 CRÍTICO', frio: '🟠 FRÍO', tibio: '🟡 TIBIO', oportunidad: '🔵 OPORTUNIDAD' };
      const TASK_ICONS: Record<string,string> = { email: '✉️', llamada: '📞', whatsapp: '💬', reunion: '🤝', escalacion: '⚡', decision: '⚖️' };

      return (
        <div>
          <button onClick={() => { setProspectDetail(null); setProspectEdit(null); if (previousModule) { setActiveModule(previousModule); setPreviousModule(null); } }} style={btnSecondary({ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
            {renderButtonIcon('arrow-left')}
            <span>Volver a lista/embudo</span>
          </button>

          {/* ALERTA SARA */}
          {dpAlerta && (
            <div style={{ background: ALERT_BG[dpAlerta.nivel], border: `2px solid ${ALERT_BORDER[dpAlerta.nivel]}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: ALERT_BORDER[dpAlerta.nivel], marginBottom: 4 }}>
                    {ALERT_LABEL[dpAlerta.nivel]} — Alerta SARA
                  </div>
                  <div style={{ fontSize: 13, color: T.text }}>{dpAlerta.motivo}</div>
                </div>
                <button onClick={() => dismissAlert(dpAlerta.id)} style={{ fontSize: 10, padding: '4px 10px', background: ALERT_BORDER[dpAlerta.nivel], color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  Marcar gestionada
                </button>
              </div>

              {/* Tareas sugeridas */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Plan de Acción Sugerido</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(Array.isArray(dpAlerta.tareas) ? dpAlerta.tareas : JSON.parse(dpAlerta.tareas || '[]')).map((t: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(255,255,255,0.6)', padding: '8px 12px', borderRadius: 8 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{TASK_ICONS[t.tipo] || '📌'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{t.titulo}</div>
                        <div style={{ fontSize: 11, color: T.textSec }}>{t.detalle}</div>
                      </div>
                      <div style={{ fontSize: 10, color: ALERT_BORDER[dpAlerta.nivel], fontWeight: 700, whiteSpace: 'nowrap' }}>{t.fecha}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Borrador de recuperación */}
              {dpAlerta.borrador_asunto && (
                <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>✉️ Borrador de Reactivación (SARA)</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Asunto: {dpAlerta.borrador_asunto}</div>
                  <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: T.text, margin: 0, fontFamily: 'inherit', lineHeight: 1.5 }}>{dpAlerta.borrador_cuerpo}</pre>
                  <button
                    onClick={() => {
                      fetch('http://localhost:3001/api/drafts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          id: `draft-recovery-${Date.now()}`,
                          destinatario: `${dp.nombre} (${dp.correo})`,
                          project: 'Reactivación',
                          subject: dpAlerta.borrador_asunto,
                          body: dpAlerta.borrador_cuerpo,
                          status: 'pending',
                          prioridad: dpAlerta.nivel
                        })
                      }).then(() => alert('Borrador enviado al Buzón SARA para aprobación'));
                    }}
                    style={{ ...btnPrimary({ marginTop: 10, fontSize: 11, padding: '6px 14px' }), background: ALERT_BORDER[dpAlerta.nivel] }}
                  >
                    Enviar al Buzón para Aprobación
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{dp.nombre} {dp.apellido}</div>
                <div style={{ fontSize: 13, color: T.textSec }}>{dp.ocupacion} · Registrado el {dp.fecha_entrada}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ fontSize: 10, color: T.textSec, fontWeight: 600 }}>
                    Análisis IA SARA: Probabilidad de Cierre ({dp.estado === 'Contacto Inicial' ? 10 : dp.estado === 'Calificación' ? 30 : dp.estado === 'Presentación' ? 50 : dp.estado === 'Negociación' ? 75 : dp.estado === 'Cierre' ? 100 : 0}%)
                  </div>
                  <div style={{ width: 120, height: 8, background: T.borderLight, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${dp.estado === 'Contacto Inicial' ? 10 : dp.estado === 'Calificación' ? 30 : dp.estado === 'Presentación' ? 50 : dp.estado === 'Negociación' ? 75 : dp.estado === 'Cierre' ? 100 : 0}%`, height: '100%', background: dp.estado === 'Cierre' ? T.success : dp.estado === 'Negociación' ? T.warning : T.teal, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
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
                  {PROJECTS.map(pj => {
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

            {/* Hilo de Correos SARA */}
            <div style={{ marginBottom: 20 }}>
              <div style={labelStyle}>Hilo de Correos (SARA)</div>
              {dp.emailHistory && dp.emailHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dp.emailHistory.map(email => (
                    <div key={email.id} style={{ padding: 12, borderRadius: 8, background: email.status === 'draft' ? '#FFFBEB' : (email.direction === 'in' ? '#F0F9FF' : '#F8FAFC'), border: `1px solid ${email.status === 'draft' ? T.warning : (email.direction === 'in' ? T.sky : T.borderLight)}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{email.subject}</div>
                          <div style={{ fontSize: 11, color: T.textSec }}>
                            {email.direction === 'in' ? 'Recibido de: ' + dp.correo : 'De: Sara (CS GLP)'} · {email.date}
                          </div>
                        </div>
                        {badge(email.status.toUpperCase(), email.status === 'draft' ? T.warning : (email.status === 'incoming' ? T.sky : T.success), T.card)}
                      </div>
                      <div style={{ fontSize: 13, color: T.text, whiteSpace: 'pre-wrap', lineHeight: 1.5, background: 'rgba(255,255,255,0.5)', padding: 8, borderRadius: 4 }}>
                        {email.body}
                      </div>
                      {email.status === 'draft' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                          <button onClick={() => {
                             setProspects(prospects.map(p => p.id === dp.id ? {
                               ...p,
                               emailHistory: p.emailHistory?.filter(e => e.id !== email.id)
                             } : p));
                          }} style={btnSecondary({ padding: '4px 12px', fontSize: 11 })}>Descartar</button>
                          <button onClick={() => {
                             setProspects(prospects.map(p => p.id === dp.id ? {
                               ...p,
                               emailHistory: p.emailHistory?.map(e => e.id === email.id ? { ...e, status: 'sent' } : e),
                               historial: [...p.historial, { fecha: today(), accion: 'Correo SARA Enviado', detalle: 'Se envió correo: ' + email.subject }]
                             } : p));
                          }} style={btnPrimary({ padding: '4px 12px', fontSize: 11, background: T.teal, color: T.card })}>Aprobar y Enviar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: T.textSec, padding: 16, background: '#F8FAFC', borderRadius: 8, textAlign: 'center', border: `1px dashed ${T.borderLight}` }}>
                  No hay historial de correos para este cliente.
                </div>
              )}

              {/* Historial de respuestas enviadas (desde DB) */}
              {dp.historial && dp.historial.filter((h: any) => h.tipo === 'respuesta_enviada').length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Respuestas Enviadas</div>
                  {dp.historial.filter((h: any) => h.tipo === 'respuesta_enviada').map((h: any) => (
                    <div key={h.id} style={{ padding: 12, borderRadius: 8, background: '#F0FDF4', border: `1px solid ${T.success}`, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>✓ {h.asunto}</div>
                        <div style={{ fontSize: 10, color: T.textSec }}>{new Date(h.fecha).toLocaleDateString('es-CO')} · Aprobado por {h.aprobado_por}</div>
                      </div>
                      <textarea
                        defaultValue={h.cuerpo || h.resumen}
                        style={{ ...inputStyle(), fontSize: 11, minHeight: 60, width: '100%', resize: 'vertical' as const }}
                        onChange={e => {
                          const updated = dp.historial.map((item: any) => item.id === h.id ? { ...item, cuerpo: e.target.value } : item);
                          setProspects(prospects.map(p => p.id === dp.id ? { ...p, historial: updated } : p));
                          updateProspectBackend({ ...dp, historial: updated });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
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
            }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="funnel" size={12} color={prospectViewMode === 'embudo' ? T.card : T.text} /> Vista Embudo</span></button>
            <button onClick={() => setProspectViewMode('lista')} style={{
              border: 'none', background: prospectViewMode === 'lista' ? T.teal : 'transparent',
              color: prospectViewMode === 'lista' ? T.card : T.text,
              padding: '6px 14px', borderRadius: 18, cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.2s'
            }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="list" size={12} color={prospectViewMode === 'lista' ? T.card : T.text} /> Vista Lista</span></button>
          </div>

          <select value={prospectFilterBroker} onChange={e => setProspectFilterBroker(e.target.value)} style={inputStyle({ width: 150 })}>
            <option value="all">Todos los brokers</option>
            {brokers.map(b => <option key={b.id} value={b.nombre}>{b.nombre}</option>)}
          </select>
          <select value={prospectFilterProject} onChange={e => setProspectFilterProject(e.target.value)} style={inputStyle({ width: 180 })}>
            <option value="all">Todos los proyectos</option>
            {PROJECTS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button onClick={() => { setProspectFilterBroker('all'); setProspectFilterStage('all'); setProspectFilterProject('all'); }} style={btnSecondary({ fontSize: 11 })}>Limpiar filtros</button>
          <select
            value={prospectSort.field}
            onChange={e => setProspectSort(s => ({ ...s, field: e.target.value }))}
            style={inputStyle({ width: 170 })}
          >
            <option value="nombre">Ordenar: Nombre</option>
            <option value="fecha_entrada">Ordenar: Registro</option>
            <option value="ocupacion">Ordenar: Ocupación</option>
            <option value="broker_asignado">Ordenar: Broker</option>
            <option value="presupuesto_usd">Ordenar: Presupuesto</option>
            <option value="etapa">Ordenar: Etapa</option>
            <option value="forma_contacto">Ordenar: Canal</option>
            <option value="probCierre">Ordenar: Prob. Cierre</option>
          </select>
          <button
            onClick={() => setProspectSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
            style={{ ...btnSecondary({ fontSize: 13 }), color: T.teal, fontWeight: 700, minWidth: 34 }}
            title={prospectSort.dir === 'asc' ? 'Ascendente' : 'Descendente'}
          >
            {prospectSort.dir === 'asc' ? '↑' : '↓'}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => {
            if(confirm('¿Restaurar la base de datos a los prospectos de prueba iniciales? Esto combinará los actuales con la data original.')) {
              const applyMigration = (data: any[]) => {
                return data.map(p => {
                  if (!p.emailHistory) {
                    return { ...p, emailHistory: [] };
                  }
                  return p;
                });
              };
              const merged = [...prospects, ...applyMigration(INITIAL_PROSPECTS)];
              // deduplicate by id
              const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
              setProspects(unique);
              alert('Prospectos inyectados correctamente.');
            }
          }} style={{ ...btnSecondary(), marginRight: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {renderButtonIcon('database', 12)}
              <span>Inyectar Data Original</span>
            </span>
          </button>
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
              const ALERT_COLORS: Record<string,string> = { critico: '#DC2626', frio: '#EA580C', tibio: '#CA8A04', oportunidad: '#0284C7' };
              const ALERT_ICONS: Record<string,string> = { critico: '🔴', frio: '🟠', tibio: '🟡', oportunidad: '🔵' };
              return (
                <div key={stage} style={{
                  flex: '1 0 260px', background: `${T.sand}40`, borderRadius: 12,
                  padding: 12, border: `1px solid ${T.border}`, minHeight: 400, display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: `2px solid ${T.teal}20`, paddingBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{stage}</span>
                    <span style={{ background: T.teal, color: T.card, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{stageProspects.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                    {stageProspects.map(p => (
                      <div key={p.id} style={{
                        background: T.card, borderRadius: 8, padding: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)', border: `1px solid ${T.border}`,
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                        {(() => {
                          const alerta = prospectAlerts.find(a => Number(a.prospecto_id) === Number(p.id));
                          if (!alerta) return null;
                          return (
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: ALERT_COLORS[alerta.nivel], padding: '2px 7px', borderRadius: 4, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {ALERT_ICONS[alerta.nivel]} {alerta.nivel.toUpperCase()} · {alerta.dias_sin_actividad}d
                            </div>
                          );
                        })()}
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
                        {/* Thermometer */}
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 9, color: T.textSec, fontWeight: 600, marginBottom: 3 }}>Prob. Cierre · Sara</div>
                          <ThermometerBar prob={calcClosingProb(p)} />
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
                  {['Nombre', 'Registro', 'Ocupación', 'Proyectos', 'Broker', 'Presupuesto', 'Etapa', 'P. Cierre', 'Canal', 'Acciones'].map(h => (
                    <th key={h} style={{ background: T.teal, color: T.card, padding: '10px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
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
                    <td style={{ padding: '10px 12px', minWidth: 110 }}>
                      <ThermometerBar prob={calcClosingProb(p)} />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11 }}>{p.forma_contacto}</td>
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
                ))}
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
        return { ...ev, items_costo: [...ev.items_costo, { concepto: 'Nuevo Ítem', valor: 0 }] };
      }));
    };

    const sStyle = {
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      headingFont: '"Playfair Display", "Times New Roman", serif',
      border: '#E5E7EB',
      bg: '#FFFFFF',
      text: '#111827',
      textMuted: '#6B7280',
      accent: '#000000',
    };

    return (
      <div style={{ fontFamily: sStyle.fontFamily, color: sStyle.text, maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>
        <div style={{ borderBottom: `1px solid ${sStyle.border}`, paddingBottom: 20, marginBottom: 30, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ fontFamily: sStyle.headingFont, fontSize: 28, fontWeight: 400, margin: '0 0 8px 0', letterSpacing: '0.5px' }}>
              Control de Eventos
            </h2>
            <div style={{ fontSize: 13, color: sStyle.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Presupuestos y Retorno de Inversión (CAC)
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setShowEventForm(!showEventForm)} 
            style={{ 
              background: showEventForm ? 'transparent' : sStyle.accent, 
              color: showEventForm ? sStyle.text : '#FFF', 
              border: `1px solid ${sStyle.accent}`, 
              padding: '8px 24px', 
              fontSize: 12, 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {showEventForm ? 'Cerrar Panel' : 'Nuevo Evento'}
          </button>
        </div>

        {showEventForm && (
          <div style={{ background: '#F9FAFB', border: `1px solid ${sStyle.border}`, padding: 30, marginBottom: 40 }}>
            <div style={{ fontFamily: sStyle.headingFont, fontSize: 18, marginBottom: 20 }}>Registrar Nuevo Evento</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: sStyle.textMuted, marginBottom: 8 }}>Título</label>
                <input value={newEvent.titulo} onChange={e => setNewEvent({ ...newEvent, titulo: e.target.value })} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: `1px solid ${sStyle.border}`, background: 'transparent', outline: 'none', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: sStyle.textMuted, marginBottom: 8 }}>Ubicación (Venue)</label>
                <input value={newEvent.venue} onChange={e => setNewEvent({ ...newEvent, venue: e.target.value })} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: `1px solid ${sStyle.border}`, background: 'transparent', outline: 'none', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: sStyle.textMuted, marginBottom: 8 }}>Fecha</label>
                <input type="date" value={newEvent.fecha} onChange={e => setNewEvent({ ...newEvent, fecha: e.target.value })} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: `1px solid ${sStyle.border}`, background: 'transparent', outline: 'none', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: sStyle.textMuted, marginBottom: 8 }}>Presupuesto Asignado (USD)</label>
                <input type="number" value={newEvent.presupuesto_asignado} onChange={e => setNewEvent({ ...newEvent, presupuesto_asignado: Number(e.target.value) })} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: `1px solid ${sStyle.border}`, background: 'transparent', outline: 'none', fontSize: 14 }} />
              </div>
            </div>
            <button type="button" onClick={addEvent} style={{ marginTop: 30, background: sStyle.accent, color: '#FFF', border: 'none', padding: '10px 30px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer' }}>
              Guardar Evento
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {events.map(ev => {
            const expanded = expandedEvent === ev.id;
            
            let closedCount = 0;
            const processedAttendees = ev.asistentes.map(a => {
              const cleanStr = (str: string): string => {
                if (!str) return '';
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase().trim().replace(/\s+/g, ' ');
              };
              const found = prospects.find(p => cleanStr(p.nombre + ' ' + p.apellido) === cleanStr(a));
              let isClosed = false;
              if (found) {
                const st = found.estado.toLowerCase();
                if (st.includes('cierre') || st.includes('cerrado') || st.includes('post-venta')) {
                  isClosed = true;
                  closedCount++;
                }
              }
              return { name: a, found, isClosed };
            });

            const cac = closedCount > 0 ? (ev.presupuesto_ejecutado / closedCount) : 0;

            return (
              <div key={ev.id} style={{ border: `1px solid ${sStyle.border}`, background: sStyle.bg, cursor: 'pointer', transition: 'box-shadow 0.3s ease' }}
                onClick={() => setExpandedEvent(expanded ? null : ev.id)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ padding: '24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: sStyle.headingFont, fontSize: 20, fontWeight: 400, color: sStyle.text, marginBottom: 4 }}>{ev.titulo}</div>
                    <div style={{ fontSize: 12, color: sStyle.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{ev.venue} • {ev.fecha}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: sStyle.textMuted, marginBottom: 4 }}>Ejecutado / Asignado</div>
                    <div style={{ fontSize: 16, fontFamily: sStyle.headingFont, fontWeight: 400 }}>{usd(ev.presupuesto_ejecutado)} <span style={{ color: sStyle.textMuted, fontSize: 14 }}>/ {usd(ev.presupuesto_asignado)}</span></div>
                  </div>
                </div>

                {expanded && (
                  <div style={{ borderTop: `1px solid ${sStyle.border}`, padding: '30px', background: '#FAFAFA' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
                      
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: sStyle.textMuted, borderBottom: `1px solid ${sStyle.border}`, paddingBottom: 8, marginBottom: 16 }}>Asistentes y Retorno</div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                          <div style={{ background: '#FFF', padding: 16, border: `1px solid ${sStyle.border}`, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: sStyle.textMuted, letterSpacing: '1px', marginBottom: 8 }}>Negocios Cerrados</div>
                            <div style={{ fontFamily: sStyle.headingFont, fontSize: 24 }}>{closedCount}</div>
                          </div>
                          <div style={{ background: '#FFF', padding: 16, border: `1px solid ${sStyle.border}`, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: sStyle.textMuted, letterSpacing: '1px', marginBottom: 8 }}>C.A.C. por Cliente</div>
                            <div style={{ fontFamily: sStyle.headingFont, fontSize: 24 }}>{usd(cac)}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {processedAttendees.map((att, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '8px 12px', background: '#FFF', border: `1px solid ${sStyle.border}` }}>
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (att.found) {
                                    setProspectDetail(att.found.id);
                                    setActiveModule('prospectos');
                                  }
                                }}
                                style={{ 
                                  color: att.found ? sStyle.text : sStyle.textMuted,
                                  cursor: att.found ? 'pointer' : 'default',
                                  textDecoration: att.found ? 'underline' : 'none'
                                }}
                                title={att.found ? "Ver perfil de cliente" : "Cliente no registrado"}
                              >
                                {att.name}
                              </span>
                              {att.isClosed && (
                                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', border: `1px solid ${sStyle.text}`, padding: '2px 6px', borderRadius: 2 }}>Cerrado</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: sStyle.textMuted, borderBottom: `1px solid ${sStyle.border}`, paddingBottom: 8, marginBottom: 16 }}>Desglose de Costos</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '0 0 12px 0', textAlign: 'left', fontSize: 11, color: sStyle.textMuted, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '1px' }}>Concepto</th>
                              <th style={{ padding: '0 0 12px 0', textAlign: 'right', fontSize: 11, color: sStyle.textMuted, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '1px' }}>Valor USD</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ev.items_costo.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: `1px solid ${sStyle.border}` }}>
                                <td style={{ padding: '12px 0' }}>
                                  <input value={item.concepto} onChange={e => updateCostItem(ev.id, idx, 'concepto', e.target.value)}
                                    style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: sStyle.fontFamily }} />
                                </td>
                                <td style={{ padding: '12px 0', textAlign: 'right' }}>
                                  <input type="number" value={item.valor} onChange={e => updateCostItem(ev.id, idx, 'valor', Number(e.target.value))}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', textAlign: 'right', width: 100, fontSize: 13, fontFamily: sStyle.fontFamily }} />
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td style={{ padding: '16px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px', fontSize: 11 }}>Total Ejecutado</td>
                              <td style={{ padding: '16px 0 0 0', textAlign: 'right', fontFamily: sStyle.headingFont, fontSize: 16 }}>{usd(ev.items_costo.reduce((s, i) => s + i.valor, 0))}</td>
                            </tr>
                          </tbody>
                        </table>
                        <button type="button" onClick={() => addCostItem(ev.id)} style={{ marginTop: 20, background: 'transparent', color: sStyle.text, border: `1px solid ${sStyle.border}`, padding: '8px 16px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer' }}>
                          Agregar Ítem
                        </button>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const renderAgentes = () => {
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

    const handleApproveDraft = (draftId: string, prospectId: number, project: string) => {
      setProspects(prev => prev.map(p => {
        if (p.id === prospectId) {
          const newEmailHistory = (p.emailHistory || []).map(eh => eh.id === draftId ? { ...eh, status: 'sent' as const } : eh);
          const updated = {
            ...p,
            emailHistory: newEmailHistory,
            historial: [
              ...p.historial,
              {
                fecha: new Date().toISOString().split('T')[0],
                accion: 'Correo SARA Enviado',
                detalle: `Respuesta/Cotización preparada por SARA para ${project} fue aprobada y enviada por el administrador.`
              }
            ]
          };
          updateProspectBackend(updated);
          return updated;
        }
        return p;
      }));
    };

    const agents = [
      {
        name: 'CAMILO', emoji: '🕵️‍♂️', role: 'VP de Investigación y Mercados',
        photo: '/img/agents/camilo.png',
        desc: 'Dual-mode: genera prospectos calificados Y produce inteligencia de mercado accionable (macro, crisis, oportunidades, audiencia). Sus insights alimentan automáticamente a Sara, Valeria e Isabella en el Flujo de Trabajo.',
        lastRun: agentCamiloLastRun,
        stats: [
          { label: 'Prospectos generados', value: agentCamiloProspects },
          { label: 'Insights producidos', value: camiloInsights.length },
          { label: 'Tareas en flujo', value: workflowTasks.filter(t => t.from === 'CAMILO' && t.status === 'pendiente').length },
        ],
        status: agentCamiloActive ? (camiloMode === 'research' ? 'Investigando...' : 'Prospectando...') : 'Listo',
        statusColor: agentCamiloActive ? T.success : T.textSec,
        logs: camiloInsights.length > 0
          ? camiloInsights.slice(0, 4).map(i => ({ time: i.fecha, msg: `[${i.tipo.toUpperCase()}] ${i.titulo} — Impacto: ${i.impacto} · ${i.status}` }))
          : [
            { time: '08:00', msg: 'Sin insights generados aún. Usa "Research de Mercado" o activa el Enjambre.' },
          ],
        actions: [
          { label: agentCamiloActive ? 'Trabajando...' : 'Research de Mercado', icon: 'chart-bar', onClick: () => handleCamilo(false, false, 'research') },
          { label: '🕵️ Panel de Inteligencia', icon: 'eye', onClick: () => setAgentHistoryDetail('CAMILO') },
        ],
      },
      {
        name: 'SARA', emoji: '🤖', role: 'Directora de Experiencia de Cliente',
        photo: '/img/agents/sara.png',
        desc: 'Gestión automatizada del back-office comercial. Monitorea y clasifica leads en tiempo real, redacta cotizaciones personalizadas y prepara respuestas comerciales listas para aprobación.',
        lastRun: 'Activo en tiempo real',
        stats: [
          { label: 'Mensajes analizados', value: agentSaraMessages },
          { label: 'Alertas activas', value: agentSaraAlerts },
          { label: 'Tiempo resp. prom.', value: '4.2 min' },
        ],
        status: agentSaraActive ? 'Analizando...' : 'Monitoreando',
        statusColor: agentSaraActive ? T.coral : T.success,
        logs: [
          { time: '09:30', msg: 'WhatsApp: 45 mensajes nuevos procesados' },
          { time: '09:35', msg: 'Email: 12 correos clasificados (8 consultas, 3 seguimiento, 1 urgente)' },
          { time: '09:40', msg: 'Instagram DM: 8 mensajes respondidos con plantilla' },
          { time: '10:00', msg: 'FAQ actualizado: "Beneficios de exención tributaria en Panamá"' },
        ],
        actions: [
          { label: agentSaraActive ? 'Analizando...' : 'Analizar Consultas', icon: 'clipboard', onClick: () => handleSara() },
          { label: 'Respuestas y Cotizaciones', icon: 'eye', onClick: () => setAgentHistoryDetail('SARA') },
        ],
      },
      {
        name: 'VALERIA', emoji: '✍️', role: 'VP de Medios',
        photo: '/img/agents/alicia.png',
        desc: 'Experta en persuasión y marketing de contenidos de lujo. Redacta copys con contexto real del portafolio GLP, datos de prospectos e insights de mercado. Todo editable y aprobable por el administrador.',
        lastRun: valeriaDrafts.length > 0 ? `Último: ${valeriaDrafts[0].canal || valeriaDrafts[0].type} · ${valeriaDrafts[0].date}` : 'Sin contenido generado aún',
        stats: [
          { label: 'Contenidos generados', value: valeriaDrafts.length },
          { label: 'Publicados / Activos', value: valeriaDrafts.filter(d => d.status === 'active').length },
          { label: 'Pendientes revisión', value: valeriaDrafts.filter(d => d.status === 'pending').length },
        ],
        status: agentValeriaActive ? 'Redactando...' : 'Listo',
        statusColor: agentValeriaActive ? T.coral : T.sky,
        logs: valeriaDrafts.length > 0
          ? valeriaDrafts.slice(0, 4).map(d => ({ time: d.date, msg: `${d.canal || d.type}: "${d.asunto || d.content.slice(0, 50)}..." — ${d.status === 'active' ? '🚀 Publicado' : d.status === 'approved' ? '✅ Aprobado' : '📝 Pendiente'}` }))
          : [{ time: '--:--', msg: 'Aún no se ha generado contenido. Usa "Gestionar Contenido" para crear tu primer copy con contexto real.' }],
        actions: [
          { label: agentValeriaActive ? 'Redactando...' : 'Gestionar Contenido', icon: 'draft', onClick: () => setAgentHistoryDetail('VALERIA') },
        ],
      },
      {
        name: 'ISABELLA', emoji: '🎙️', role: 'Embajadora de Marca GLP',
        photo: '/img/agents/isabella.png',
        desc: 'Cara visible y presentadora de GLP. Genera guiones de producción ejecutables: Reels, videos educativos, testimoniales y calendarios de contenido. Coordina automáticamente con Valeria para el copy de acompañamiento. Usa el mismo Perfil de Marca que Valeria.',
        lastRun: isabellaScripts.length > 0 ? `Último: ${isabellaScripts[0].asunto || isabellaScripts[0].type} · ${isabellaScripts[0].date}` : 'Sin guiones generados aún',
        stats: [
          { label: 'Guiones generados', value: isabellaScripts.length },
          { label: 'Listos para producción', value: isabellaScripts.filter(s => s.status === 'approved' || s.status === 'active').length },
          { label: 'Pendientes revisión', value: isabellaScripts.filter(s => s.status === 'pending').length },
        ],
        status: agentIsabellaActive ? 'Generando...' : 'Lista',
        statusColor: agentIsabellaActive ? T.coral : T.palm,
        logs: isabellaScripts.length > 0
          ? isabellaScripts.slice(0, 4).map(s => ({ time: s.date, msg: `${s.canal || s.type}: "${s.asunto || s.content.slice(0, 50)}..." — ${s.status === 'active' ? '🎬 En producción' : s.status === 'approved' ? '✅ Aprobado' : '📝 Pendiente'}` }))
          : [{ time: '--:--', msg: 'Sin guiones aún. Usa "Crear Guion" para generar producción de video con el perfil de marca GLP.' }],
        actions: [
          { label: agentIsabellaActive ? 'Generando...' : 'Crear Guion', icon: 'video', onClick: () => handleIsabella() },
          { label: 'Ver Historial', icon: 'eye', onClick: () => setAgentHistoryDetail('ISABELLA') },
        ],
      },
    ];


    if (agentHistoryDetail) {
      // ── PANEL CAMILO ────────────────────────────────────────────
      if (agentHistoryDetail === 'CAMILO') {
        const TIPO_COLOR: Record<string,string> = { mercado:'#3B82F6', crisis:'#EF4444', oportunidad:'#10B981', audiencia:'#8B5CF6' };
        const IMPACTO_COLOR: Record<string,string> = { alto:'#EF4444', medio:'#F59E0B', bajo:'#10B981' };

        // Ranking de prospectos
        const rankedProspects = [...prospects]
          .filter(p=>!['Post-venta','Perdido'].includes(p.estado))
          .map(p => ({
            ...p,
            score: getProspectScore(p),
            timing: getTimingDays(p),
            objActivasTipo: objections.filter(o => o.prospecto && p.nombre && o.prospecto.toLowerCase().includes(p.nombre.toLowerCase())).map(o=>o.tipo),
          }))
          .sort((a,b) => b.score - a.score);

        const TABS = [
          { key:'insights', label:'🧠 Insights', badge: camiloInsights.filter(i=>i.status==='nuevo').length },
          { key:'ranking', label:'📊 Ranking Prospectos', badge:0 },
          { key:'radar', label:'🎯 Radar Competencia', badge:0 },
          { key:'objeciones', label:'🗺 Mapa Objeciones', badge:0 },
          { key:'reporte', label:'📰 Reporte Semanal', badge:0 },
        ] as const;

        return (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <button onClick={() => setAgentHistoryDetail(null)}
                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:8, padding:'6px 12px', color:T.textSec, cursor:'pointer', fontSize:12 }}>
                ← Volver
              </button>
              <h2 style={{ margin:0, fontSize:20, color:T.text }}>🕵️ Camilo — VP de Investigación y Mercados</h2>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', gap:4, marginBottom:20, flexWrap:'wrap' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={()=>setCamiloTab(t.key)}
                  style={{ padding:'7px 14px', borderRadius:8, border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                    background: camiloTab===t.key ? '#3B82F6' : T.bgAlt||T.borderLight,
                    color: camiloTab===t.key ? '#fff' : T.textSec,
                    display:'flex', alignItems:'center', gap:6 }}>
                  {t.label}
                  {t.badge > 0 && <span style={{ background:'#EF4444', color:'#fff', borderRadius:10, padding:'0 6px', fontSize:10 }}>{t.badge}</span>}
                </button>
              ))}
            </div>

            {/* TAB: INSIGHTS */}
            {camiloTab === 'insights' && (
              <div>
                {camiloInsights.length === 0 && (
                  <div style={{ ...cardStyle(), textAlign:'center', color:T.textSec, padding:40 }}>
                    Sin insights aún. Ejecuta "Research de Mercado" desde la tarjeta de Camilo.
                  </div>
                )}
                {camiloInsights.map(ins => (
                  <div key={ins.id} style={{ ...cardStyle(), marginBottom:12, border:`1.5px solid ${ins.status==='nuevo'?TIPO_COLOR[ins.tipo]:T.borderLight}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                          <span style={{ fontSize:11, fontWeight:700, background:TIPO_COLOR[ins.tipo], color:'#fff', padding:'2px 8px', borderRadius:4, textTransform:'uppercase' }}>{ins.tipo}</span>
                          <span style={{ fontSize:11, fontWeight:700, color:IMPACTO_COLOR[ins.impacto] }}>Impacto {ins.impacto}</span>
                          <span style={{ fontSize:10, color:T.textSec }}>{ins.fecha}</span>
                          {ins.status !== 'nuevo' && <span style={{ fontSize:10, color:T.success, fontWeight:600 }}>✓ {ins.status}</span>}
                        </div>
                        <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:4 }}>{ins.titulo}</div>
                        <div style={{ fontSize:12, color:T.textSec }}>{expandedInsight===ins.id ? ins.datos : ins.resumen}</div>
                        {expandedInsight===ins.id && (ins as any).acciones_sara && (
                          <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                            {[{label:'Sara',val:(ins as any).acciones_sara,c:'#10B981'},{label:'Valeria',val:(ins as any).acciones_valeria,c:'#8B5CF6'},{label:'Isabella',val:(ins as any).acciones_isabella,c:'#F59E0B'}].map(a=>(
                              <div key={a.label} style={{ background:`${a.c}10`, border:`1px solid ${a.c}40`, borderRadius:8, padding:10 }}>
                                <div style={{ fontSize:10, fontWeight:700, color:a.c, marginBottom:4 }}>➡️ {a.label}</div>
                                <div style={{ fontSize:11, color:T.text }}>{a.val||'—'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button onClick={()=>setExpandedInsight(expandedInsight===ins.id?null:ins.id)}
                          style={{ background:'none', border:'none', color:'#3B82F6', fontSize:11, cursor:'pointer', marginTop:6, padding:0 }}>
                          {expandedInsight===ins.id ? '▲ Ver menos' : '▼ Ver completo + acciones por agente'}
                        </button>
                      </div>
                      {ins.status === 'nuevo' && (
                        <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:100 }}>
                          <button onClick={()=>approveInsight(ins)}
                            style={{ background:'#10B981', color:'#fff', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                            ✅ Aprobar
                          </button>
                          <button onClick={()=>rejectInsight(ins.id)}
                            style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 12px', fontSize:11, color:T.textSec, cursor:'pointer' }}>
                            ✕ Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: RANKING PROSPECTOS */}
            {camiloTab === 'ranking' && (
              <div style={{ ...cardStyle() }}>
                <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:14 }}>
                  Ranking de conversión — {rankedProspects.length} prospectos activos
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:`2px solid ${T.border}` }}>
                        {['#','Prospecto','Etapa','Score %','Cierre est.','Objeciones activas','Recomendación Sara'].map(h=>(
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:T.textSec, fontSize:11, fontWeight:700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rankedProspects.map((p, i) => {
                        const objTipos = p.objActivasTipo;
                        const scoreBg = p.score >= 70 ? '#10B98120' : p.score >= 40 ? '#F59E0B20' : '#EF444420';
                        const scoreColor = p.score >= 70 ? '#10B981' : p.score >= 40 ? '#F59E0B' : '#EF4444';
                        const rec = p.score >= 70 ? 'Llamar hoy — cierre inminente' :
                                    p.score >= 50 ? 'Enviar propuesta actualizada' :
                                    p.score >= 30 ? 'Email de valor + agenda reunión' : 'Reactivar con incentivo especial';
                        return (
                          <tr key={p.id} style={{ borderBottom:`1px solid ${T.borderLight}`, background: i%2===0?T.bg:'transparent' }}>
                            <td style={{ padding:'8px 10px', color:T.textSec, fontWeight:700 }}>{i+1}</td>
                            <td style={{ padding:'8px 10px' }}>
                              <div style={{ fontWeight:600, color:T.text }}>{p.nombre} {p.apellido}</div>
                              <div style={{ fontSize:10, color:T.textSec }}>${(p.presupuesto_usd||0).toLocaleString()} USD · {p.ocupacion||'—'}</div>
                            </td>
                            <td style={{ padding:'8px 10px', color:T.text }}>{p.estado}</td>
                            <td style={{ padding:'8px 10px' }}>
                              <div style={{ display:'inline-block', background:scoreBg, color:scoreColor, fontWeight:800, fontSize:13, padding:'3px 10px', borderRadius:6 }}>{p.score}%</div>
                            </td>
                            <td style={{ padding:'8px 10px', color:T.text }}>{p.timing > 0 ? `~${p.timing}d` : 'Cerrado'}</td>
                            <td style={{ padding:'8px 10px' }}>
                              {objTipos.length > 0
                                ? objTipos.map((t,idx)=>(
                                  <span key={idx} style={{ fontSize:10, background:'#EF444420', color:'#EF4444', padding:'2px 6px', borderRadius:4, marginRight:4 }}>
                                    {OBJECTION_TIPOS.find(o=>o.value===t)?.icon} {t}
                                  </span>
                                ))
                                : <span style={{ fontSize:10, color:T.textSec }}>Sin objeciones</span>
                              }
                            </td>
                            <td style={{ padding:'8px 10px', fontSize:11, color:T.text, maxWidth:180 }}>{rec}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: RADAR DE COMPETENCIA */}
            {camiloTab === 'radar' && (
              <div>
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
                  <button onClick={generateRadar} disabled={generatingRadar}
                    style={{ background:'#3B82F6', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                    {generatingRadar ? '⏳ Analizando...' : '🎯 Actualizar Radar'}
                  </button>
                </div>
                {radarData.length === 0 && !generatingRadar && (
                  <div style={{ ...cardStyle(), textAlign:'center', color:T.textSec, padding:40 }}>
                    Haz clic en "Actualizar Radar" para analizar la competencia.
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
                  {radarData.map((r,i) => (
                    <div key={i} style={{ ...cardStyle(), border:`1.5px solid #3B82F640` }}>
                      <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:4 }}>{r.titulo}</div>
                      {r.precio_ref && <div style={{ fontSize:11, color:'#3B82F6', fontWeight:600, marginBottom:6 }}>💰 {r.precio_ref}</div>}
                      <div style={{ fontSize:12, color:T.textSec, marginBottom:10 }}>{r.descripcion}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:T.text, marginBottom:6 }}>Argumentos GLP vs esta opción:</div>
                      {r.argumentos.map((arg,j)=>(
                        <div key={j} style={{ fontSize:11, color:T.text, padding:'4px 0', borderBottom:`1px solid ${T.borderLight}`, display:'flex', gap:6 }}>
                          <span style={{ color:'#10B981', fontWeight:700 }}>✓</span>{arg}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: MAPA DE OBJECIONES */}
            {camiloTab === 'objeciones' && (
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:T.text, marginBottom:14 }}>
                  Prospectos con objeciones activas registradas por brokers
                </div>
                {rankedProspects.filter(p=>p.objActivasTipo.length>0).length === 0 && (
                  <div style={{ ...cardStyle(), textAlign:'center', color:T.textSec, padding:40 }}>
                    Sin cruce de objeciones. Registra objeciones en el módulo 📋 Objeciones.
                  </div>
                )}
                {rankedProspects.filter(p=>p.objActivasTipo.length>0).map(p=>(
                  <div key={p.id} style={{ ...cardStyle(), marginBottom:10, border:`1.5px solid #EF444430` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:700, color:T.text }}>{p.nombre} {p.apellido}</div>
                        <div style={{ fontSize:11, color:T.textSec }}>{p.estado} · ${(p.presupuesto_usd||0).toLocaleString()} USD</div>
                      </div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {p.objActivasTipo.map((t,i)=>{
                          const info = OBJECTION_TIPOS.find(o=>o.value===t);
                          return <span key={i} style={{ fontSize:11, background:'#EF444420', color:'#EF4444', padding:'3px 8px', borderRadius:6, fontWeight:600 }}>{info?.icon} {info?.label||t}</span>;
                        })}
                      </div>
                    </div>
                    {objections.filter(o=>o.prospecto&&p.nombre&&o.prospecto.toLowerCase().includes(p.nombre.toLowerCase())).map(o=>(
                      <div key={o.id} style={{ marginTop:8, fontSize:11, color:T.text, background:T.bg, padding:'6px 10px', borderRadius:6, borderLeft:`3px solid #EF4444` }}>
                        <span style={{ fontWeight:600 }}>{o.broker}:</span> {o.descripcion}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* TAB: REPORTE SEMANAL */}
            {camiloTab === 'reporte' && (
              <div>
                <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                  <button onClick={generateMarketReport} disabled={generatingReport}
                    style={{ background:'#3B82F6', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                    {generatingReport ? '⏳ Generando...' : '📰 Generar Reporte'}
                  </button>
                  {marketReport && (
                    <button onClick={sendReportEmail} disabled={sendingReport}
                      style={{ background:'#10B981', color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                      {sendingReport ? '⏳ Enviando...' : '📧 Enviar por Correo'}
                    </button>
                  )}
                </div>
                {!marketReport && !generatingReport && (
                  <div style={{ ...cardStyle(), textAlign:'center', color:T.textSec, padding:40 }}>
                    Genera el reporte semanal de color del mercado inmobiliario y financiero de Panamá.
                  </div>
                )}
                {marketReport && (
                  <div style={{ ...cardStyle(), border:`1.5px solid #3B82F6` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:T.text }}>📊 Reporte Semanal — {marketReport.fecha}</div>
                      <span style={{ fontSize:10, background:'#3B82F620', color:'#3B82F6', padding:'3px 8px', borderRadius:4, fontWeight:600 }}>Guardado como contexto global</span>
                    </div>
                    <div style={{ fontSize:13, color:T.text, whiteSpace:'pre-wrap', lineHeight:1.7 }}>{marketReport.texto}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }

      if (agentHistoryDetail === 'SARA') {
        const S_NAVY = '#001A37';
        const S_GOLD = '#B89047';
        const S_GOLD_L = '#D4AF6A';
        const S_CREAM = '#F7F4EF';
        const S_PARCH = '#EDE8DF';

        const allDraftsFromHistory = (prospects.flatMap(p => (p.emailHistory || []).map(eh => ({
          id: eh.id, to: `${p.nombre} ${p.apellido} (${p.correo})`,
          prospectId: p.id, project: p.proyectos_interes.join(', '),
          subject: eh.subject, body: eh.body,
          status: eh.status, date: eh.date, direction: eh.direction,
          isApi: false,
        })))).filter(d => ['draft','sent','incoming'].includes(d.status));

        const apiDraftsMapped = apiDrafts.filter(d => d.status === 'pending').map(d => ({
          id: d.id, to: d.destinatario, prospectId: -1,
          project: d.project, subject: d.subject, body: d.body,
          status: 'draft', date: d.created_at, direction: 'out',
          isApi: true, prioridad: d.prioridad,
        }));

        const allMsgs = [...allDraftsFromHistory, ...apiDraftsMapped]
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const pendingCount = allMsgs.filter(m => m.status === 'draft').length;

        const ALERT_ACCENT: Record<string,string> = { critico:'#B91C1C', frio:'#C2410C', tibio:'#B45309', oportunidad: S_NAVY };
        const ALERT_LABEL: Record<string,string> = { critico:'CRÍTICO', frio:'FRÍO', tibio:'TIBIO', oportunidad:'OPORTUNIDAD' };

        return (
          <div style={{ background: S_CREAM, minHeight: '100%' }}>

            {/* Header */}
            <div style={{ background: S_NAVY, padding: '24px 32px 20px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
                <div>
                  <div style={{ fontSize:9, letterSpacing:4, color:S_GOLD, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>Sara · Directora de Experiencia de Cliente</div>
                  <h2 style={{ margin:0, fontSize:22, fontFamily:T.fontSerif, fontWeight:400, color:'#fff', letterSpacing:0.5 }}>
                    Bandeja de Comunicaciones
                  </h2>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:3, fontStyle:'italic' }}>
                    Correos entrantes · Cotizaciones pendientes · Alertas de prospectos
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  {pendingCount > 0 && (
                    <div style={{ background:`${S_GOLD}20`, border:`1px solid ${S_GOLD}`, borderRadius:3, padding:'6px 14px', display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:S_GOLD, display:'inline-block', animation:'pulse 1.5s infinite' }} />
                      <span style={{ fontSize:11, color:S_GOLD_L, fontWeight:600 }}>{pendingCount} pendiente{pendingCount>1?'s':''} de aprobación</span>
                    </div>
                  )}
                  <button onClick={() => { setAgentHistoryDetail(null); setAgentHistoryTab('pending'); }}
                    style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:3, padding:'7px 16px', color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>
                    ← Volver
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:0, minHeight:'calc(100vh - 180px)' }}>

              {/* ── LEFT SIDEBAR ── */}
              <div style={{ background: S_PARCH, borderRight:`1px solid #D6CEBC`, padding:'20px 0' }}>

                {/* Alertas de prospectos */}
                <div style={{ padding:'0 20px 20px', borderBottom:`1px solid #D6CEBC` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:9, letterSpacing:3, color:'#9CA3AF', fontWeight:700, textTransform:'uppercase' }}>Alertas de Prospectos</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      {prospectAlerts.length > 0 && <span style={{ background:S_NAVY, color:S_GOLD, fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:2 }}>{prospectAlerts.length}</span>}
                      <button onClick={() => fetch('http://localhost:3001/api/sara/monitor',{method:'POST'}).then(()=>refreshAlerts())}
                        style={{ background:'transparent', border:`1px solid #D6CEBC`, borderRadius:2, padding:'3px 8px', fontSize:9, color:'#6B7280', cursor:'pointer', fontWeight:600 }}>↻</button>
                    </div>
                  </div>
                  {prospectAlerts.length === 0 ? (
                    <div style={{ fontSize:11, color:'#9CA3AF', textAlign:'center', padding:'16px 0', fontStyle:'italic' }}>Sin alertas activas</div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:260, overflowY:'auto' }}>
                      {prospectAlerts.map(a => (
                        <div key={a.id} style={{ background:'#fff', borderLeft:`3px solid ${ALERT_ACCENT[a.nivel]||S_NAVY}`, padding:'9px 12px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:8, letterSpacing:2, fontWeight:700, color:ALERT_ACCENT[a.nivel]||S_NAVY, textTransform:'uppercase', marginBottom:2 }}>{ALERT_LABEL[a.nivel]||a.nivel}</div>
                            <div style={{ fontSize:11, fontWeight:600, color:S_NAVY, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nombre} {a.apellido}</div>
                            <div style={{ fontSize:10, color:'#6B7280', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.motivo}</div>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                            <button onClick={() => { setProspectDetail(a.prospecto_id); setActiveModule('prospectos'); }}
                              style={{ background:ALERT_ACCENT[a.nivel]||S_NAVY, color:'#fff', border:'none', borderRadius:2, padding:'3px 8px', fontSize:9, fontWeight:700, cursor:'pointer', letterSpacing:0.5 }}>Ficha</button>
                            <button onClick={() => dismissAlert(a.id)}
                              style={{ background:'transparent', color:'#9CA3AF', border:'1px solid #E5E7EB', borderRadius:2, padding:'3px 8px', fontSize:9, cursor:'pointer' }}>✓</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* FAQs frecuentes */}
                <div style={{ padding:'20px 20px 20px', borderBottom:`1px solid #D6CEBC` }}>
                  <div style={{ fontSize:9, letterSpacing:3, color:'#9CA3AF', fontWeight:700, textTransform:'uppercase', marginBottom:12 }}>FAQs Más Consultadas</div>
                  {faqs.slice(0,4).map((f,i) => (
                    <div key={f.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0', borderBottom:`1px solid #E9E4DA` }}>
                      <div style={{ fontSize:14, fontWeight:800, color:S_GOLD, fontFamily:T.fontSerif, minWidth:18, textAlign:'right', flexShrink:0 }}>{i+1}</div>
                      <div>
                        <div style={{ fontSize:11, color:S_NAVY, fontWeight:500, lineHeight:1.4 }}>{f.pregunta}</div>
                        <div style={{ fontSize:9, color:'#9CA3AF', marginTop:2 }}>{3+i*4+Math.floor(i*2.3)} consultas recientes</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reporte de contingencia */}
                <div style={{ padding:'20px' }}>
                  <div style={{ fontSize:9, letterSpacing:3, color:'#9CA3AF', fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>Reporte de Contingencia</div>
                  <textarea value={saraReportText} onChange={e => setSaraReportText(e.target.value)}
                    style={{ width:'100%', boxSizing:'border-box', height:180, fontSize:10, fontFamily:'monospace', padding:'10px', border:`1px solid #D6CEBC`, background:'#fff', color:'#374151', outline:'none', resize:'vertical', lineHeight:1.6 }} />
                  <button onClick={() => alert('Reporte guardado.')}
                    style={{ marginTop:8, background:S_NAVY, color:S_GOLD_L, border:'none', padding:'7px 14px', fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer', width:'100%' }}>
                    Guardar Reporte
                  </button>
                </div>
              </div>

              {/* ── MAIN PANEL: BANDEJA ── */}
              <div style={{ background:'#fff', padding:'0' }}>

                {/* Toolbar */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderBottom:`1px solid ${S_PARCH}` }}>
                  <div style={{ fontSize:9, letterSpacing:3, color:'#9CA3AF', fontWeight:700, textTransform:'uppercase' }}>
                    {allMsgs.length} mensaje{allMsgs.length!==1?'s':''} · {pendingCount} pendiente{pendingCount!==1?'s':''}
                  </div>
                  <button onClick={() => {
                    fetch('http://localhost:3001/api/sara/check-inbox',{method:'POST'})
                      .then(r=>r.json())
                      .then(()=>fetch('http://localhost:3001/api/drafts').then(r=>r.json()).then(data=>{ if(Array.isArray(data)) setApiDrafts(data); }))
                      .catch(e=>console.error('Error revisando bandeja:',e));
                  }} style={{ background:'transparent', border:`1px solid #D6CEBC`, borderRadius:2, padding:'6px 14px', fontSize:9, color:'#6B7280', cursor:'pointer', fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
                    ↻ Revisar bandeja
                  </button>
                </div>

                {/* Message list */}
                <div style={{ maxHeight:'calc(100vh - 260px)', overflowY:'auto' }}>
                  {allMsgs.length === 0 && (
                    <div style={{ textAlign:'center', padding:60, color:'#9CA3AF', fontStyle:'italic', fontSize:13 }}>
                      Bandeja vacía. Sin correos entrantes ni cotizaciones pendientes.
                    </div>
                  )}
                  {allMsgs.map((msg, idx) => {
                    const isDraft = msg.status === 'draft';
                    const isIncoming = msg.status === 'incoming';
                    const isSent = msg.status === 'sent';
                    const pEstado = msg.prospectId > 0 ? prospects.find(p=>p.id===msg.prospectId)?.estado || '' : '';
                    const probCierre = pEstado==='Contacto Inicial'?10:pEstado==='Calificación'?30:pEstado==='Presentación'?50:pEstado==='Negociación'?75:pEstado==='Cierre'?95:0;

                    return (
                      <div key={msg.id} style={{ borderBottom:`1px solid ${S_PARCH}`, padding:'18px 24px',
                        background: isDraft ? '#FFFDF7' : '#fff',
                        borderLeft: isDraft ? `3px solid ${S_GOLD}` : isSent ? `3px solid #10B981` : isIncoming ? `3px solid ${S_NAVY}` : '3px solid transparent' }}>

                        {/* Row 1: meta */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, gap:12 }}>
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                            {isIncoming && <span style={{ fontSize:8, letterSpacing:2, fontWeight:700, color:S_NAVY, background:`${S_NAVY}12`, padding:'2px 8px', textTransform:'uppercase' }}>Entrante</span>}
                            {isDraft && <span style={{ fontSize:8, letterSpacing:2, fontWeight:700, color:S_GOLD, background:`${S_GOLD}18`, padding:'2px 8px', textTransform:'uppercase' }}>Pendiente aprobación</span>}
                            {isSent && <span style={{ fontSize:8, letterSpacing:2, fontWeight:700, color:'#10B981', background:'#F0FDF4', padding:'2px 8px', textTransform:'uppercase' }}>Enviado</span>}
                            {(msg as any).prioridad === 'alta' && <span style={{ fontSize:8, letterSpacing:2, fontWeight:700, color:'#B91C1C', background:'#FEF2F2', padding:'2px 8px', textTransform:'uppercase' }}>Alta prioridad</span>}
                            <span style={{ fontSize:11, color:'#374151', fontWeight:500 }}>{isIncoming?'De:':'Para:'} <span style={{ fontWeight:700, color:S_NAVY }}>{msg.to}</span></span>
                          </div>
                          <div style={{ fontSize:10, color:'#9CA3AF', flexShrink:0 }}>
                            {new Date(msg.date).toLocaleDateString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                          </div>
                        </div>

                        {/* Row 2: subject */}
                        <div style={{ fontSize:13, fontWeight:600, color:S_NAVY, fontFamily:T.fontSerif, marginBottom:10, letterSpacing:0.2 }}>
                          {msg.subject}
                        </div>

                        {/* Row 3: body */}
                        {isIncoming ? (
                          <div style={{ fontSize:11, color:'#4B5563', lineHeight:1.7, whiteSpace:'pre-wrap', background:S_CREAM, padding:'12px 14px', borderLeft:`2px solid #D6CEBC`, marginBottom:12 }}>
                            {msg.body}
                          </div>
                        ) : (
                          <textarea
                            value={msg.body}
                            onChange={e => {
                              const newBody = e.target.value;
                              if ((msg as any).isApi) {
                                setApiDrafts(prev => prev.map(d => d.id === msg.id ? { ...d, body: newBody } : d));
                              } else {
                                // update in prospect emailHistory
                              }
                            }}
                            style={{ width:'100%', boxSizing:'border-box' as const, fontSize:11, color:'#374151', lineHeight:1.7, background:S_PARCH, padding:'12px 14px', borderLeft:`2px solid #D6CEBC`, border:`1px solid #D6CEBC`, marginBottom:12, minHeight:120, resize:'vertical' as const, fontFamily:'inherit', outline:'none' }}
                          />
                        )}

                        {/* Row 4: footer */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ display:'flex', gap:16, alignItems:'center' }}>
                            {pEstado && probCierre > 0 && (
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ fontSize:9, color:'#9CA3AF', letterSpacing:1, textTransform:'uppercase' }}>Probabilidad cierre</div>
                                <div style={{ width:80, height:4, background:'#E9E4DA', borderRadius:0, overflow:'hidden' }}>
                                  <div style={{ width:`${probCierre}%`, height:'100%', background: probCierre>=75?S_GOLD:probCierre>=50?'#D97706':S_NAVY }} />
                                </div>
                                <div style={{ fontSize:10, fontWeight:700, color:S_NAVY }}>{probCierre}%</div>
                              </div>
                            )}
                            {msg.project && <div style={{ fontSize:10, color:'#9CA3AF' }}>Proyecto: <span style={{ color:'#374151', fontWeight:600 }}>{msg.project}</span></div>}
                          </div>

                          <div>
                            {isSent && <span style={{ fontSize:10, color:'#10B981', fontWeight:600, letterSpacing:0.5 }}>✓ Aprobado y enviado</span>}
                            {isIncoming && <span style={{ fontSize:10, color:S_NAVY, fontWeight:500 }}>Recibido</span>}
                            {isDraft && !(msg as any).isApi && (
                              <button onClick={() => handleApproveDraft(msg.id, msg.prospectId, msg.project)}
                                style={{ background:S_NAVY, color:S_GOLD_L, border:'none', padding:'7px 18px', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', cursor:'pointer' }}>
                                Aprobar y Enviar
                              </button>
                            )}
                            {isDraft && (msg as any).isApi && (
                              <button onClick={() => {
                                fetch('http://localhost:3001/api/send-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:msg.id})})
                                  .then(()=>setApiDrafts(prev=>prev.map(d=>d.id===msg.id?{...d,status:'sent'}:d)))
                                  .catch(e=>console.error('Error enviando draft:',e));
                              }} style={{ background:S_NAVY, color:S_GOLD_L, border:'none', padding:'7px 18px', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', cursor:'pointer' }}>
                                Aprobar y Enviar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      }

      // ── VALERIA PANEL COMPLETO ───────────────────────────────
      if (agentHistoryDetail === 'VALERIA') {
        const CANALES_VALERIA = ['LinkedIn Post', 'Newsletter', 'Email Masivo', 'Email Seguimiento', 'Reel Instagram', 'Post Estático Instagram', 'Instagram Story', 'WhatsApp Masivo', 'Guion Video'];
        const CANAL_ICONS: Record<string,string> = { 'LinkedIn Post': '💼', 'Newsletter': '📰', 'Email Masivo': '📧', 'Email Seguimiento': '✉️', 'Reel Instagram': '🎬', 'Post Estático Instagram': '📸', 'Instagram Story': '📲', 'WhatsApp Masivo': '💬', 'Guion Video': '🎥' };

        const vFiltered = valeriaDrafts.filter(d =>
          (agentHistoryTab === 'pending' ? d.status === 'pending' : agentHistoryTab === 'approved' ? d.status === 'approved' : d.status === 'active') &&
          (valeriaFilterCanal === 'todos' || d.canal === valeriaFilterCanal)
        );

        const vPending = valeriaDrafts.filter(d => d.status === 'pending').length;
        const vApproved = valeriaDrafts.filter(d => d.status === 'approved').length;
        const vPublished = valeriaDrafts.filter(d => d.status === 'active').length;

        const V_NAVY = '#001A37'; const V_GOLD = '#B89047'; const V_GOLD_L = '#D4AF6A'; const V_CREAM = '#F7F4EF'; const V_PARCH = '#EDE8DF';

        return (
          <div style={{ background: V_CREAM, minHeight: '100%' }}>

            {/* Header Sotheby's */}
            <div style={{ background: V_NAVY, padding: '24px 32px 20px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontSize:9, letterSpacing:4, color:V_GOLD, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>Valeria · VP de Medios</div>
                  <h2 style={{ margin:0, fontSize:22, fontFamily:T.fontSerif, fontWeight:400, color:'#fff', letterSpacing:0.5 }}>Gestión de Contenidos</h2>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:3, fontStyle:'italic' }}>
                    Contenido IA con perfil de marca editable · Aprobable por administrador
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  {valeriaTab === 'contenido' && <>
                    <select value={valeriaSelectedCanal} onChange={e => setValeriaSelectedCanal(e.target.value)}
                      style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:2, padding:'7px 10px', color:'#fff', fontSize:11, outline:'none', minWidth:160 }}>
                      {CANALES_VALERIA.map(c => <option key={c} value={c} style={{background:V_NAVY}}>{CANAL_ICONS[c]} {c}</option>)}
                    </select>
                    <button onClick={() => handleValeria(false, false, undefined, valeriaSelectedCanal)} disabled={valeriaGenerating}
                      style={{ background: valeriaGenerating ? 'rgba(184,144,71,0.4)' : V_GOLD, color: V_NAVY, border:'none', borderRadius:2, padding:'8px 18px', fontSize:10, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase', cursor: valeriaGenerating ? 'default':'pointer' }}>
                      {valeriaGenerating ? 'Generando...' : 'Generar con IA'}
                    </button>
                  </>}
                  <button onClick={() => { setAgentHistoryDetail(null); setAgentHistoryTab('pending'); }}
                    style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:2, padding:'7px 16px', color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>
                    ← Volver
                  </button>
                </div>
              </div>

              {/* Tabs nav */}
              <div style={{ display:'flex', gap:0, marginTop:20, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
                {([
                  { key:'contenido', label:'Contenido Generado' },
                  { key:'perfil',    label:'Perfil de Marca' },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setValeriaTab(t.key)} style={{
                    padding:'10px 22px', fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', cursor:'pointer', border:'none', background:'transparent',
                    borderBottom: valeriaTab === t.key ? `2px solid ${V_GOLD}` : '2px solid transparent',
                    color: valeriaTab === t.key ? V_GOLD_L : 'rgba(255,255,255,0.4)', marginBottom:-1,
                  }}>{t.label}</button>
                ))}
                {profileDirty && (
                  <span style={{ marginLeft:'auto', fontSize:10, color:V_GOLD, alignSelf:'center', fontWeight:700, letterSpacing:1 }}>
                    ● Sin guardar
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding:'24px 32px' }}>

              {/* ── TAB PERFIL DE MARCA ── */}
              {valeriaTab === 'perfil' && (() => {
                // Opciones predefinidas por sección
                const OPTS: Record<string, string[]> = {
                  audiencias: [
                    'Colombianos 35-55 años con capital disponible ($50K-$500K USD)',
                    'Empresarios e independientes que buscan dolarizar patrimonio',
                    'Inversionistas con experiencia en finca raíz local',
                    'Profesionales jóvenes 28-38 aspiracionales',
                    'Venezolanos / venezolanos en Colombia buscando activos en dólares',
                    'Peruanos y ecuatorianos con perfil inversor internacional',
                    'Pensionados extranjeros buscando residencia + rentabilidad',
                    'Family offices latinoamericanos diversificando portafolio',
                  ],
                  tonos: [
                    'Experto y sólido en lo financiero (datos duros, % reales, cifras)',
                    'Aspiracional y visual en el gancho (imágenes mentales de vida y libertad)',
                    'Directo y sin adornos — confianza sin arrogancia',
                    'Sofisticado pero accesible — no corporativo genérico',
                    'Cercano y empático — habla de persona a persona',
                    'Urgente y exclusivo — ventanas de oportunidad reales',
                    'Educativo y transparente — explica antes de vender',
                  ],
                  objetivos: [
                    'Construir autoridad y confianza antes de vender',
                    'Generar leads directos (DM / link en bio / formulario)',
                    'Nutrir prospectos ya en el CRM (top-of-mind)',
                    'Rebatir objeciones sin mencionarlas directamente',
                    'Posicionar a Panamá como mejor destino de inversión vs Colombia',
                    'Aumentar compartidos y guardados (contenido de valor)',
                    'Convertir seguidores fríos en leads calificados',
                  ],
                  objeciones: [
                    '¿Es seguro llevar plata a otro país? → Panamá dolarizado, banca top-10 mundial',
                    '¿Cómo lo manejo con la DIAN? → Activos en el exterior son legales y declarables',
                    '¿Y si el proyecto no se entrega? → Fiducia de garantía en todos los proyectos GLP',
                    '¿Puedo usarlo o es solo para arrendar? → Doble beneficio: uso propio + renta',
                    '¿No es muy caro para mí? → Desde $150K USD con financiamiento disponible',
                    '¿El peso colombiano me afecta? → Todo en dólares, sin riesgo cambiario',
                    '¿Quién me garantiza la renta? → Operadoras con track record verificado',
                  ],
                  diferenciadores: [
                    'Exención predial por 20 años en todos los proyectos nuevos',
                    'Rentabilidad neta superior al 8% anual en USD',
                    'Panamá dolarizado — sin riesgo cambiario',
                    'GLP solo trabaja proyectos con fiducia de garantía',
                    'Asesoría integral: desde selección hasta declaración en Colombia',
                    'Acceso a preventas exclusivas antes de apertura al público',
                    'Red de brokers certificados en Bogotá, Medellín y Cali',
                  ],
                  activos_visuales: [
                    'Renders y fotos profesionales de proyectos (Ocean Reef Park, Ventu, Santa María)',
                    'Video drone de zonas: Punta Pacífica, Costa del Este, Playa Caracol',
                    'Fotos del equipo en eventos y reuniones con clientes',
                    'Infografías de rentabilidad y comparativas de mercado',
                    'Testimonios en video de clientes colombianos',
                    'Imágenes de lifestyle: playa, rooftop, amenidades premium',
                    'Datos y gráficos de valorización histórica',
                  ],
                  hashtags_instagram: [
                    '#GLP', '#PanamaRealEstate', '#InversionInmobiliaria', '#DolarizaTuPatrimonio',
                    '#PanamáInversión', '#WealthManagement', '#InversionEnDolares', '#GlpWealthManagement',
                    '#OceanReefPark', '#VentuPanama', '#PuntaPacifica', '#CostaDelEste',
                    '#LibertadFinanciera', '#InvierteEnPanama', '#PatrimonioEnDolares',
                    '#InmobiliariaLujo', '#InversionColombia', '#DolarizaciónPatrimonio',
                    '#PanamaCityLife', '#RealEstateLujo', '#InversionistaColombia',
                  ],
                  hashtags_linkedin: [
                    '#InversionInmobiliaria', '#WealthManagement', '#PanamaRealEstate', '#GLP',
                    '#PatrimonioDolarizado', '#RealEstatePanama', '#InversionInternacional',
                    '#FinanzasPersonales', '#Inmobiliaria', '#InversionInteligente',
                    '#LiderazgoFinanciero', '#EmpresariosColombia', '#PatrimonioFamiliar',
                  ],
                };

                const ProfileChips = ({ field, label, icon }: { field: keyof GlpBrandProfile, label: string, icon: string }) => {
                  const items = brandProfile[field] as string[];
                  const opts = OPTS[field] || [];
                  const available = opts.filter(o => !items.includes(o));
                  const [custom, setCustom] = useState('');
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16 }}>{icon}</span> {label}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: T.textSec, fontWeight: 400 }}>{items.length} activos</span>
                      </div>
                      {/* Chips activos */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${T.teal}12`, border: `1px solid ${T.teal}30`, borderRadius: 20, padding: '3px 10px 3px 12px', fontSize: 11, color: T.teal }}>
                            <span>{item.length > 60 ? item.slice(0, 58) + '…' : item}</span>
                            <button onClick={() => updateProfile(field, items.filter((_, j) => j !== i))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.danger, fontSize: 13, lineHeight: 1, padding: '0 2px', fontWeight: 700 }}>×</button>
                          </div>
                        ))}
                        {items.length === 0 && <span style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic' }}>Sin elementos — añade desde la lista o escribe uno personalizado</span>}
                      </div>
                      {/* Añadir desde lista + campo libre */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {available.length > 0 && (
                          <select defaultValue="" onChange={e => { if (e.target.value) { updateProfile(field, [...items, e.target.value]); e.target.value = ''; } }}
                            style={{ ...inputStyle({ fontSize: 11, padding: '5px 8px' }), flex: 1, minWidth: 180 }}>
                            <option value="">+ Agregar de la lista...</option>
                            {available.map(o => <option key={o} value={o}>{o.length > 70 ? o.slice(0, 68) + '…' : o}</option>)}
                          </select>
                        )}
                        <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 180 }}>
                          <input value={custom} onChange={e => setCustom(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { updateProfile(field, [...items, custom.trim()]); setCustom(''); } }}
                            placeholder="Escribir personalizado + Enter"
                            style={{ ...inputStyle({ fontSize: 11, padding: '5px 8px' }), flex: 1 }} />
                          <button onClick={() => { if (custom.trim()) { updateProfile(field, [...items, custom.trim()]); setCustom(''); } }}
                            style={btnPrimary({ padding: '5px 12px', fontSize: 11 })}>+</button>
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div>
                    {/* Propuesta de valor */}
                    <div style={{ marginBottom: 20, padding: 14, background: `${T.teal}06`, borderRadius: 10, border: `1px solid ${T.teal}20` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>🏆 Propuesta de Valor Principal</div>
                      <textarea value={brandProfile.propuesta_valor}
                        onChange={e => updateProfile('propuesta_valor', e.target.value)}
                        style={{ ...inputStyle(), width: '100%', minHeight: 70, fontSize: 12, resize: 'vertical' as const }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div>
                        <ProfileChips field="audiencias" label="Audiencias Objetivo" icon="👥" />
                        <ProfileChips field="tonos" label="Tonos de Marca" icon="🎙️" />
                        <ProfileChips field="objetivos" label="Objetivos del Contenido" icon="🎯" />
                        <ProfileChips field="objeciones" label="Objeciones a Disolver" icon="🛡️" />
                      </div>
                      <div>
                        <ProfileChips field="diferenciadores" label="Diferenciadores GLP" icon="⭐" />
                        <ProfileChips field="activos_visuales" label="Activos Visuales Disponibles" icon="📷" />
                        <ProfileChips field="hashtags_instagram" label="Hashtags Instagram" icon="📸" />
                        <ProfileChips field="hashtags_linkedin" label="Hashtags LinkedIn" icon="💼" />
                      </div>
                    </div>

                    {/* CTA principal */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>📣 CTA Principal</div>
                      <input value={brandProfile.cta_principal}
                        onChange={e => updateProfile('cta_principal', e.target.value)}
                        style={{ ...inputStyle({ fontSize: 12 }), width: '100%' }} />
                    </div>

                    {/* Notas adicionales */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>📋 Notas Adicionales del Equipo</div>
                      <textarea value={brandProfile.notas_adicionales}
                        onChange={e => updateProfile('notas_adicionales', e.target.value)}
                        placeholder="Contexto especial, restricciones legales, campañas activas, temporadas..."
                        style={{ ...inputStyle(), width: '100%', minHeight: 60, fontSize: 12, resize: 'vertical' as const }} />
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button onClick={resetProfile} style={btnSecondary({ padding: '8px 16px', fontSize: 12, color: T.danger, borderColor: T.danger })}>
                        ↺ Restablecer valores por defecto
                      </button>
                      <button onClick={saveProfile} disabled={profileSaving}
                        style={btnPrimary({ padding: '8px 20px', fontSize: 12, background: profileSaving ? T.textSec : profileDirty ? T.success : T.teal, opacity: profileSaving ? 0.7 : 1 })}>
                        {profileSaving ? '⏳ Guardando...' : profileDirty ? '💾 Guardar en Supabase' : '✓ Guardado en Supabase'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── TAB CONTENIDO ── */}
              {valeriaTab === 'contenido' && <>

              {/* KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
                {[
                  { label:'Borradores', value:vPending, accent:V_GOLD },
                  { label:'Aprobados', value:vApproved, accent:V_NAVY },
                  { label:'Publicados', value:vPublished, accent:'#10B981' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#fff', border:`1px solid #D6CEBC`, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:3, alignSelf:'stretch', background:s.accent, flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:28, fontWeight:300, fontFamily:T.fontSerif, color:s.accent, lineHeight:1 }}>{s.value}</div>
                      <div style={{ fontSize:9, letterSpacing:2, color:'#9CA3AF', textTransform:'uppercase', marginTop:3 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Filtros */}
              <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
                {(['pending','approved','active'] as const).map(tab => {
                  const isActive = agentHistoryTab === tab;
                  const count = tab==='pending'?vPending:tab==='approved'?vApproved:vPublished;
                  const label = tab==='pending'?'Borradores':tab==='approved'?'Aprobados':'Publicados';
                  return (
                    <button key={tab} onClick={() => setAgentHistoryTab(tab)} style={{
                      padding:'7px 16px', fontSize:9, fontWeight:700, letterSpacing:2, textTransform:'uppercase', cursor:'pointer',
                      background: isActive ? V_NAVY : 'transparent',
                      color: isActive ? V_GOLD_L : '#6B7280',
                      border:`1px solid ${isActive ? V_NAVY : '#D6CEBC'}`,
                      borderRadius:2,
                    }}>{label} ({count})</button>
                  );
                })}
                <select value={valeriaFilterCanal} onChange={e => setValeriaFilterCanal(e.target.value)}
                  style={{ marginLeft:'auto', background:'#fff', border:'1px solid #D6CEBC', borderRadius:2, padding:'6px 10px', fontSize:10, color:'#374151', outline:'none' }}>
                  <option value="todos">Todos los canales</option>
                  {CANALES_VALERIA.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Lista */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {vFiltered.length === 0 ? (
                  <div style={{ padding:40, textAlign:'center', border:`1px dashed #D6CEBC`, background:'#fff' }}>
                    <div style={{ fontFamily:T.fontSerif, fontSize:18, color:V_NAVY, marginBottom:6 }}>Sin contenido aquí</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>Selecciona un canal y pulsa "Generar con IA" para crear contenido</div>
                  </div>
                ) : vFiltered.map(item => {
                  const statusColor = item.status==='active'?'#10B981':item.status==='approved'?V_NAVY:V_GOLD;
                  const statusLabel = item.status==='active'?'Publicado':item.status==='approved'?'Aprobado':'Borrador';
                  return (
                    <div key={item.id} style={{ background:'#fff', border:`1px solid #D6CEBC`, borderLeft:`3px solid ${statusColor}` }}>
                      {/* Card header */}
                      <div style={{ padding:'14px 18px 12px', borderBottom:'1px solid #F0EDE8', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                            <span style={{ fontSize:14 }}>{CANAL_ICONS[item.canal || item.type] || '📄'}</span>
                            <span style={{ fontSize:13, fontWeight:600, color:V_NAVY, fontFamily:T.fontSerif }}>{item.asunto || item.type}</span>
                          </div>
                          <div style={{ fontSize:9, letterSpacing:2, color:'#9CA3AF', textTransform:'uppercase' }}>{item.canal || item.type} · {item.date}</div>
                          {item.contexto && <div style={{ fontSize:10, color:'#6B7280', marginTop:4, fontStyle:'italic' }}>{item.contexto}</div>}
                          {item.tags && item.tags.length > 0 && (
                            <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                              {item.tags.map(t => <span key={t} style={{ fontSize:8, background:`${V_NAVY}10`, color:V_NAVY, padding:'2px 7px', fontWeight:700, letterSpacing:1 }}>#{t}</span>)}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize:8, letterSpacing:2, fontWeight:700, color:statusColor, background:`${statusColor}12`, padding:'4px 10px', flexShrink:0, textTransform:'uppercase' }}>{statusLabel}</span>
                      </div>

                      {/* Body */}
                      <div style={{ padding:'14px 18px' }}>
                        <textarea value={item.content}
                          onChange={e => setValeriaDrafts(prev => prev.map(x => x.id === item.id ? { ...x, content: e.target.value } : x))}
                          style={{ width:'100%', boxSizing:'border-box', fontSize:12, minHeight:100, border:'1px solid #E9E4DA', padding:'10px 12px', fontFamily:T.fontSans, lineHeight:1.7, color:'#374151', outline:'none', resize:'vertical' as const, marginBottom:8 }}
                        />
                        <input placeholder="Notas del administrador..."
                          value={item.notas_admin || ''}
                          onChange={e => setValeriaDrafts(prev => prev.map(x => x.id === item.id ? { ...x, notas_admin: e.target.value } : x))}
                          style={{ width:'100%', boxSizing:'border-box', fontSize:11, border:'1px solid #E9E4DA', padding:'7px 10px', color:'#374151', outline:'none', marginBottom:12, fontStyle: !item.notas_admin ? 'italic' : 'normal' }}
                        />

                        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap', alignItems:'center' }}>
                          {item.aprobado_por && (
                            <span style={{ fontSize:9, color:'#9CA3AF', marginRight:'auto' }}>
                              Aprobado por {item.aprobado_por} · {item.fecha_aprobacion}
                            </span>
                          )}
                          <button onClick={() => setValeriaDrafts(prev => prev.filter(x => x.id !== item.id))}
                            style={{ background:'transparent', border:'1px solid #FECACA', color:'#DC2626', padding:'6px 12px', fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>
                            Eliminar
                          </button>
                          {item.status === 'pending' && (
                            <button onClick={() => setValeriaDrafts(prev => prev.map(x => x.id === item.id
                              ? { ...x, status:'approved', aprobado_por:'Admin', fecha_aprobacion:today() } : x))}
                              style={{ background:V_NAVY, color:V_GOLD_L, border:'none', padding:'6px 16px', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', cursor:'pointer' }}>
                              Aprobar
                            </button>
                          )}
                          {item.status === 'approved' && (
                            <button onClick={() => setValeriaDrafts(prev => prev.map(x => x.id === item.id ? { ...x, status:'pending' } : x))}
                              style={{ background:'transparent', border:`1px solid #D6CEBC`, color:'#6B7280', padding:'6px 12px', fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>
                              Devolver
                            </button>
                          )}
                          {(item.status === 'approved' || item.status === 'pending') && (
                            <button onClick={() => setValeriaDrafts(prev => prev.map(x => x.id === item.id
                              ? { ...x, status:'active', aprobado_por: x.aprobado_por||'Admin', fecha_aprobacion: x.fecha_aprobacion||today() } : x))}
                              style={{ background:'#10B981', color:'#fff', border:'none', padding:'6px 16px', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', cursor:'pointer' }}>
                              Publicar
                            </button>
                          )}
                          {(item.status === 'approved' || item.status === 'active') && !['Coordinación','Guion Video'].includes(item.canal||'') && (
                            <button onClick={() => { handleIsabellaFromValeria(item); setAgentHistoryDetail('ISABELLA'); }}
                              disabled={agentIsabellaActive}
                              style={{ background: agentIsabellaActive ? '#9CA3AF' : V_GOLD, color: V_NAVY, border:'none', padding:'6px 16px', fontSize:9, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase', cursor: agentIsabellaActive ? 'default':'pointer' }}>
                              Crear Video · Isabella
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>}
            </div>
          </div>
        );
      }

      // ── ISABELLA ─────────────────────────────────────────────
      const I_NAVY = '#001A37'; const I_GOLD = '#B89047'; const I_GOLD_L = '#D4AF6A'; const I_CREAM = '#F7F4EF'; const I_PARCH = '#EDE8DF';
      const historyItems = isabellaScripts;
      const setHistoryItems = setIsabellaScripts;
      const filteredItems = historyItems.filter(i => i.status === agentHistoryTab);
      const iPending = historyItems.filter(i => i.status === 'pending').length;
      const iApproved = historyItems.filter(i => i.status === 'approved').length;
      const iActive = historyItems.filter(i => i.status === 'active').length;

      return (
        <div style={{ background: I_CREAM, minHeight:'100%' }}>

          {/* Header */}
          <div style={{ background: I_NAVY, padding:'24px 32px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap', paddingBottom:20 }}>
              <div>
                <div style={{ fontSize:9, letterSpacing:4, color:I_GOLD, fontWeight:700, textTransform:'uppercase', marginBottom:5 }}>Isabella · Embajadora de Marca GLP</div>
                <h2 style={{ margin:0, fontSize:22, fontFamily:T.fontSerif, fontWeight:400, color:'#fff', letterSpacing:0.5 }}>Historial y Aprobaciones</h2>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:3, fontStyle:'italic' }}>Guiones de video · Reels · Producción audiovisual</div>
              </div>
              <button onClick={() => { setAgentHistoryDetail(null); setAgentHistoryTab('pending'); }}
                style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:2, padding:'7px 16px', color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>
                ← Volver
              </button>
            </div>

            {/* Tab nav */}
            <div style={{ display:'flex', gap:0, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
              {([
                { key:'pending',  label:`Borradores (${iPending})` },
                { key:'approved', label:`Aprobados (${iApproved})` },
                { key:'active',   label:`Publicados (${iActive})` },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setAgentHistoryTab(t.key)} style={{
                  padding:'10px 22px', fontSize:10, fontWeight:700, letterSpacing:2, textTransform:'uppercase', cursor:'pointer', border:'none', background:'transparent', marginBottom:-1,
                  borderBottom: agentHistoryTab===t.key ? `2px solid ${I_GOLD}` : '2px solid transparent',
                  color: agentHistoryTab===t.key ? I_GOLD_L : 'rgba(255,255,255,0.4)',
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          <div style={{ padding:'24px 32px' }}>
            {/* KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
              {[
                { label:'Borradores', value:iPending, accent:I_GOLD },
                { label:'Aprobados',  value:iApproved, accent:I_NAVY },
                { label:'Publicados', value:iActive,   accent:'#10B981' },
              ].map(s => (
                <div key={s.label} style={{ background:'#fff', border:'1px solid #D6CEBC', padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:3, alignSelf:'stretch', background:s.accent, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:28, fontWeight:300, fontFamily:T.fontSerif, color:s.accent, lineHeight:1 }}>{s.value}</div>
                    <div style={{ fontSize:9, letterSpacing:2, color:'#9CA3AF', textTransform:'uppercase', marginTop:3 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Lista */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {filteredItems.length === 0 ? (
                <div style={{ padding:40, textAlign:'center', border:'1px dashed #D6CEBC', background:'#fff' }}>
                  <div style={{ fontFamily:T.fontSerif, fontSize:18, color:I_NAVY, marginBottom:6 }}>Sin contenidos en esta sección</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>Los guiones de video aparecerán aquí una vez generados</div>
                </div>
              ) : filteredItems.map(item => {
                const sColor = item.status==='active'?'#10B981':item.status==='approved'?I_NAVY:I_GOLD;
                const sLabel = item.status==='active'?'Publicado':item.status==='approved'?'Aprobado':'Borrador';
                return (
                  <div key={item.id} style={{ background:'#fff', border:'1px solid #D6CEBC', borderLeft:`3px solid ${sColor}` }}>
                    {/* Header card */}
                    <div style={{ padding:'14px 18px 12px', borderBottom:'1px solid #F0EDE8', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                      <div>
                        <div style={{ fontSize:9, letterSpacing:2, color:'#9CA3AF', textTransform:'uppercase', marginBottom:3 }}>{item.type} · {item.date}</div>
                        {item.asunto && <div style={{ fontSize:13, fontWeight:600, color:I_NAVY, fontFamily:T.fontSerif }}>{item.asunto}</div>}
                      </div>
                      <span style={{ fontSize:8, letterSpacing:2, fontWeight:700, color:sColor, background:`${sColor}12`, padding:'4px 10px', textTransform:'uppercase', flexShrink:0 }}>{sLabel}</span>
                    </div>

                    {/* Contenido del guion */}
                    <div style={{ padding:'16px 18px' }}>
                      <div style={{ fontSize:12, color:'#374151', whiteSpace:'pre-wrap', lineHeight:1.8, background:I_PARCH, padding:'14px 16px', borderLeft:`2px solid #D6CEBC`, marginBottom:14 }}>
                        {item.content}
                      </div>

                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
                        {item.status !== 'active' && (
                          <button onClick={() => setHistoryItems(prev => prev.filter(x => x.id !== item.id))}
                            style={{ background:'transparent', border:'1px solid #FECACA', color:'#DC2626', padding:'6px 12px', fontSize:9, fontWeight:700, letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>
                            Descartar
                          </button>
                        )}
                        {item.status === 'pending' && (
                          <button onClick={() => setHistoryItems(prev => prev.map(x => x.id===item.id ? {...x,status:'approved'} : x))}
                            style={{ background:I_NAVY, color:I_GOLD_L, border:'none', padding:'6px 18px', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', cursor:'pointer' }}>
                            Aprobar
                          </button>
                        )}
                        {(item.status === 'approved' || item.status === 'pending') && (
                          <button onClick={() => setHistoryItems(prev => prev.map(x => x.id===item.id ? {...x,status:'active'} : x))}
                            style={{ background:'#10B981', color:'#fff', border:'none', padding:'6px 18px', fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', cursor:'pointer' }}>
                            Publicar
                          </button>
                        )}
                      </div>

                      {/* Recuadro de video al final */}
                      {item.status === 'active' && (
                        <div style={{ marginTop:16, border:'1px solid #D6CEBC', background:I_PARCH, padding:'16px 18px' }}>
                          <div style={{ fontSize:9, letterSpacing:3, color:'#9CA3AF', textTransform:'uppercase', marginBottom:10 }}>Preview de producción</div>
                          <div style={{ background:I_NAVY, aspectRatio:'16/9', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
                            <div style={{ width:48, height:48, borderRadius:'50%', border:`2px solid ${I_GOLD}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <div style={{ width:0, height:0, borderTop:'8px solid transparent', borderBottom:'8px solid transparent', borderLeft:`14px solid ${I_GOLD}`, marginLeft:3 }} />
                            </div>
                            <div style={{ fontSize:9, letterSpacing:2, color:'rgba(255,255,255,0.4)', textTransform:'uppercase' }}>Video en producción</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // ── PANEL FLUJO DE TRABAJO ───────────────────────────────
    if (agentHistoryDetail === 'WORKFLOW') {
      const AGENT_COLORS: Record<string,string> = { CAMILO: '#3B82F6', SARA: '#10B981', VALERIA: '#8B5CF6', ISABELLA: '#F59E0B', ADMIN: T.teal };
      const PRIORIDAD_COLOR: Record<string,string> = { alta: T.danger, media: T.warning, baja: T.success };
      const STATUS_LABEL: Record<string,string> = { pendiente: '⏳ Pendiente', en_revision: '🔍 En revisión', aprobado: '✅ Aprobado', rechazado: '❌ Rechazado', completado: '✓ Completado' };

      const wfFiltered = workflowTasks.filter(t =>
        workflowTab === 'pendiente' ? ['pendiente','en_revision'].includes(t.status) : ['aprobado','rechazado','completado'].includes(t.status)
      );
      const pendingCount = workflowTasks.filter(t => t.status === 'pendiente').length;

      return (
        <div>
          <button onClick={() => setAgentHistoryDetail(null)} style={btnSecondary({ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
            {renderButtonIcon('arrow-left')}<span>Volver a Agentes</span>
          </button>

          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: T.text }}>🔄 Flujo de Trabajo entre Agentes</h2>
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>
                  Tareas generadas automáticamente por Camilo → Sara / Valeria / Isabella. El admin aprueba, redirige o descarta.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleCamilo(false, false, 'research')} disabled={agentCamiloActive}
                  style={btnPrimary({ padding: '8px 14px', fontSize: 12, background: '#3B82F6', opacity: agentCamiloActive ? 0.6 : 1 })}>
                  {agentCamiloActive ? '⏳ Investigando...' : '🔍 Nuevo Research (Camilo)'}
                </button>
              </div>
            </div>

            {/* Stats flujo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Pendientes', value: workflowTasks.filter(t=>t.status==='pendiente').length, color: T.warning },
                { label: 'Para Valeria', value: workflowTasks.filter(t=>t.to==='VALERIA'&&t.status==='pendiente').length, color: '#8B5CF6' },
                { label: 'Para Isabella', value: workflowTasks.filter(t=>t.to==='ISABELLA'&&t.status==='pendiente').length, color: '#F59E0B' },
                { label: 'Completadas', value: workflowTasks.filter(t=>['completado','aprobado'].includes(t.status)).length, color: T.success },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 14px', borderRadius: 8, background: `${s.color}12`, border: `1px solid ${s.color}40`, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: T.textSec }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `2px solid ${T.borderLight}`, paddingBottom: 0 }}>
              {([
                { key: 'pendiente', label: `⏳ Por gestionar (${pendingCount})` },
                { key: 'completado', label: `✓ Historial` },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setWorkflowTab(t.key)} style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: 'transparent', marginBottom: -2,
                  borderBottom: workflowTab === t.key ? `3px solid ${T.teal}` : '3px solid transparent',
                  color: workflowTab === t.key ? T.teal : T.textSec,
                }}>{t.label}</button>
              ))}
            </div>

            {/* Lista de tareas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {wfFiltered.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: T.textSec, border: `2px dashed ${T.borderLight}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔄</div>
                  <div style={{ fontWeight: 600 }}>Sin tareas aquí</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Ejecuta "Research de Mercado" con Camilo o activa el Enjambre para generar tareas</div>
                </div>
              ) : wfFiltered.map(task => (
                <div key={task.id} style={{
                  border: `1.5px solid ${task.status === 'pendiente' ? AGENT_COLORS[task.to] || T.border : T.borderLight}`,
                  borderRadius: 12, padding: 14, background: task.status === 'completado' ? '#F9FAFB' : T.card,
                  opacity: task.status === 'rechazado' ? 0.6 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      {/* Route: FROM → TO */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, background: AGENT_COLORS[task.from]+'20', color: AGENT_COLORS[task.from], padding: '2px 8px', borderRadius: 10 }}>{task.from}</span>
                        <span style={{ fontSize: 11, color: T.textSec }}>→</span>
                        <span style={{ fontSize: 10, fontWeight: 800, background: AGENT_COLORS[task.to]+'20', color: AGENT_COLORS[task.to], padding: '2px 8px', borderRadius: 10 }}>{task.to}</span>
                        <span style={{ fontSize: 9, background: `${PRIORIDAD_COLOR[task.prioridad]}20`, color: PRIORIDAD_COLOR[task.prioridad], padding: '2px 6px', borderRadius: 6, fontWeight: 700, marginLeft: 4 }}>
                          {task.prioridad.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 9, color: T.textSec, marginLeft: 'auto' }}>{task.fecha}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{task.titulo}</div>
                      <div style={{ fontSize: 11, color: T.textSec, fontStyle: 'italic' }}>{task.tipo}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.textSec }}>{STATUS_LABEL[task.status]}</span>
                  </div>

                  {/* Contenido expandible */}
                  <div style={{ fontSize: 11, color: T.text, whiteSpace: 'pre-wrap', background: '#F9FAFB', padding: '8px 12px', borderRadius: 6, border: `1px solid ${T.borderLight}`, marginBottom: 10, maxHeight: 120, overflowY: 'auto', lineHeight: 1.6 }}>
                    {task.contenido}
                  </div>

                  {/* Acciones */}
                  {task.status === 'pendiente' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => setWorkflowTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'rechazado' } : t))}
                        style={btnSecondary({ padding: '5px 12px', fontSize: 11, color: T.danger, borderColor: T.danger })}>
                        ✕ Descartar
                      </button>
                      {task.to === 'VALERIA' && (
                        <button onClick={() => {
                          setValeriaDrafts(prev => [{
                            id: 'vd_wf_' + Date.now(), date: today(), type: task.tipo, canal: task.tipo,
                            asunto: task.titulo.replace(/^📊 /,''), content: task.contenido,
                            tags: ['Camilo','Research','Workflow'], contexto: `Insight de Camilo — ${task.tipo}`,
                            status: 'pending', notas_admin: ''
                          }, ...prev]);
                          setWorkflowTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completado' } : t));
                          setAgentHistoryDetail('VALERIA');
                        }} style={btnPrimary({ padding: '5px 12px', fontSize: 11, background: '#8B5CF6', color: '#fff' })}>
                          ✍️ Enviar a Valeria
                        </button>
                      )}
                      {task.to === 'ISABELLA' && (
                        <button onClick={() => {
                          handleIsabella(false, false, task.contenido, 'Reel 45s');
                          setWorkflowTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completado' } : t));
                          setAgentHistoryDetail('ISABELLA');
                        }} style={btnPrimary({ padding: '5px 12px', fontSize: 11, background: '#F59E0B', color: '#fff' })}>
                          🎬 Enviar a Isabella
                        </button>
                      )}
                      {task.to === 'SARA' && (
                        <button onClick={() => {
                          setSaraReportText(prev => prev + '\n\n[CAMILO] ' + task.contenido);
                          setWorkflowTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'completado' } : t));
                        }} style={btnPrimary({ padding: '5px 12px', fontSize: 11, background: '#10B981', color: '#fff' })}>
                          📡 Aplicar a Sara
                        </button>
                      )}
                      <button onClick={() => setWorkflowTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'aprobado' } : t))}
                        style={btnPrimary({ padding: '5px 12px', fontSize: 11 })}>
                        ✅ Marcar gestionado
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ── PANEL OBJECIONES DE BROKERS ──────────────────────────────
    if (agentHistoryDetail === 'OBJECTIONS') {
      const CANAL_OPTS = ['llamada','reunion','correo','whatsapp','formulario'];
      const TIPO_COLOR: Record<string,string> = {
        peso_dolar:'#3B82F6', dian:'#EF4444', competencia:'#8B5CF6',
        entrega:'#F59E0B', precio:'#10B981', otro:'#6B7280'
      };

      return (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <button onClick={() => setAgentHistoryDetail(null)}
              style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:8, padding:'6px 12px', color:T.textSec, cursor:'pointer', fontSize:12 }}>
              ← Volver
            </button>
            <h2 style={{ margin:0, fontSize:20, color:T.text }}>📋 Reporte de Objeciones de Brokers</h2>
            <button onClick={loadObjections} disabled={objLoading}
              style={{ marginLeft:'auto', background:'none', border:`1px solid ${T.border}`, borderRadius:8, padding:'6px 14px', color:T.textSec, cursor:'pointer', fontSize:12 }}>
              {objLoading ? 'Cargando...' : '↻ Actualizar'}
            </button>
          </div>

          {/* Estadísticas por tipo */}
          {objStats.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
              {objStats.map(s => {
                const info = OBJECTION_TIPOS.find(t=>t.value===s.tipo);
                return (
                  <div key={s.tipo} style={{ ...cardStyle(), textAlign:'center', border:`1.5px solid ${TIPO_COLOR[s.tipo] || T.border}` }}>
                    <div style={{ fontSize:22 }}>{info?.icon || '💬'}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:T.text, margin:'4px 0 2px' }}>{info?.label || s.tipo}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:TIPO_COLOR[s.tipo] || T.text }}>{s.total}</div>
                    <div style={{ fontSize:10, color: Number(s.ultimos_7d) >= 3 ? T.danger : T.textSec }}>
                      {s.ultimos_7d} esta semana{Number(s.ultimos_7d) >= 3 ? ' ⚠️' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulario nuevo reporte */}
          <div style={{ ...cardStyle(), marginBottom:16, border:`1.5px solid ${T.teal}` }}>
            <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:14 }}>➕ Registrar Objeción</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <div style={{ fontSize:11, color:T.textSec, marginBottom:4 }}>Broker *</div>
                <input value={objForm.broker} onChange={e=>setObjForm(p=>({...p,broker:e.target.value}))}
                  placeholder="Nombre del broker"
                  style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13 }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:T.textSec, marginBottom:4 }}>Prospecto (opcional)</div>
                <input value={objForm.prospecto} onChange={e=>setObjForm(p=>({...p,prospecto:e.target.value}))}
                  placeholder="Nombre del cliente"
                  style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13 }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:T.textSec, marginBottom:4 }}>Tipo de objeción *</div>
                <select value={objForm.tipo} onChange={e=>setObjForm(p=>({...p,tipo:e.target.value as BrokerObjection['tipo']}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13 }}>
                  {OBJECTION_TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:T.textSec, marginBottom:4 }}>Canal donde se recibió</div>
                <select value={objForm.canal} onChange={e=>setObjForm(p=>({...p,canal:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13 }}>
                  {CANAL_OPTS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:T.textSec, marginBottom:4 }}>Proyecto (opcional)</div>
                <select value={objForm.proyecto} onChange={e=>setObjForm(p=>({...p,proyecto:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13 }}>
                  <option value="">-- Todos / No específico --</option>
                  {PROJECTS.map(pr => <option key={pr.name} value={pr.name}>{pr.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:T.textSec, marginBottom:4 }}>Descripción de la objeción *</div>
              <textarea value={objForm.descripcion} onChange={e=>setObjForm(p=>({...p,descripcion:e.target.value}))}
                placeholder="¿Qué dijo exactamente el cliente? Incluye contexto, tono y si pidió algo específico..."
                rows={3}
                style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:8, border:`1px solid ${T.border}`, background:T.bg, color:T.text, fontSize:13, resize:'vertical' }} />
            </div>
            {objSuccess && <div style={{ color:T.success, fontSize:12, fontWeight:600, marginBottom:8 }}>✅ Objeción registrada correctamente.</div>}
            <button onClick={submitObjection} disabled={objSaving || !objForm.broker || !objForm.descripcion}
              style={{ background:T.teal, color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontWeight:700, fontSize:13, cursor:'pointer', opacity: (!objForm.broker||!objForm.descripcion) ? 0.5 : 1 }}>
              {objSaving ? 'Guardando...' : '📋 Registrar Objeción'}
            </button>
          </div>

          {/* Historial de objeciones */}
          <div style={{ ...cardStyle() }}>
            <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:12 }}>
              Historial ({objections.length} registros)
            </div>
            {objections.length === 0 && !objLoading && (
              <div style={{ textAlign:'center', color:T.textSec, fontSize:13, padding:24 }}>
                Sin registros aún. Sé el primero en reportar una objeción.
              </div>
            )}
            {objections.slice(0,30).map(obj => {
              const info = OBJECTION_TIPOS.find(t=>t.value===obj.tipo);
              return (
                <div key={obj.id} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'10px 0', borderBottom:`1px solid ${T.borderLight}` }}>
                  <div style={{ fontSize:22, minWidth:28 }}>{info?.icon || '💬'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:TIPO_COLOR[obj.tipo]||T.textSec, padding:'2px 8px', borderRadius:4 }}>{info?.label||obj.tipo}</span>
                      <span style={{ fontSize:11, color:T.textSec }}>{obj.broker}</span>
                      {obj.prospecto && <span style={{ fontSize:11, color:T.textSec }}>→ {obj.prospecto}</span>}
                      {obj.proyecto && <span style={{ fontSize:10, color:T.textSec, background:T.bgAlt||T.borderLight, padding:'1px 6px', borderRadius:4 }}>{obj.proyecto}</span>}
                      <span style={{ fontSize:10, color:T.textSec, marginLeft:'auto' }}>
                        {new Date(obj.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:T.text }}>{obj.descripcion}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── PANEL CRISIS ─────────────────────────────────────────────
    if (agentHistoryDetail === 'CRISIS') {
      const TIPO_INFO: Record<string,{label:string;icon:string;color:string}> = {
        prospectos_nuevos: { label: 'Caída de leads', icon: '📉', color: '#EF4444' },
        estancamiento:     { label: 'Embudo estancado', icon: '🧊', color: '#F59E0B' },
        valor_pipeline:    { label: 'Valor pipeline', icon: '💸', color: '#8B5CF6' },
      };
      const NIVEL_COLOR: Record<string,string> = { leve: '#F59E0B', moderada: '#EF4444', grave: '#DC2626' };
      const STATUS_LABEL: Record<string,string> = {
        nueva: '🆕 Nueva', notificada: '🔔 Notificada',
        en_contingencia: '🚨 En Contingencia', resuelta: '✅ Resuelta', descartada: '🗑 Descartada'
      };

      const activas = crisisAlerts.filter(a => !['resuelta','descartada'].includes(a.status));
      const resueltas = crisisAlerts.filter(a => ['resuelta','descartada'].includes(a.status));

      return (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <button onClick={() => setAgentHistoryDetail(null)}
              style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:8, padding:'6px 12px', color:T.textSec, cursor:'pointer', fontSize:12 }}>
              ← Volver
            </button>
            <h2 style={{ margin:0, fontSize:20, color:T.text }}>🚨 Monitor de Crisis de Ventas</h2>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button onClick={loadCrisisAlerts} disabled={crisisLoading}
                style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:8, padding:'6px 14px', color:T.textSec, cursor:'pointer', fontSize:12 }}>
                {crisisLoading ? 'Cargando...' : '↻ Actualizar'}
              </button>
              <button onClick={triggerCrisisDetect} disabled={crisisDetecting}
                style={{ background: crisisDetecting ? T.textSec : '#EF4444', border:'none', borderRadius:8, padding:'6px 16px', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:12 }}>
                {crisisDetecting ? '⏳ Analizando...' : '🔍 Ejecutar Análisis Ahora'}
              </button>
            </div>
          </div>

          {/* KPI summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {(['prospectos_nuevos','estancamiento','valor_pipeline'] as const).map(tipo => {
              const info = TIPO_INFO[tipo];
              const alerta = activas.find(a => a.tipo === tipo);
              return (
                <div key={tipo} style={{ ...cardStyle(), border:`2px solid ${alerta ? NIVEL_COLOR[alerta.nivel] : T.border}`, textAlign:'center' }}>
                  <div style={{ fontSize:28 }}>{info.icon}</div>
                  <div style={{ fontWeight:700, fontSize:13, color:T.text, margin:'6px 0 2px' }}>{info.label}</div>
                  {alerta ? (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:NIVEL_COLOR[alerta.nivel], textTransform:'uppercase' }}>{alerta.nivel} — {alerta.variacion_pct.toFixed(1)}%</div>
                      <div style={{ fontSize:10, color:T.textSec, marginTop:4 }}>{STATUS_LABEL[alerta.status]}</div>
                    </>
                  ) : (
                    <div style={{ fontSize:11, color:T.success, fontWeight:600 }}>✓ Normal</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Alertas activas */}
          <div style={{ ...cardStyle(), marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, color:T.text, marginBottom:12 }}>
              Alertas Activas ({activas.length})
            </div>
            {activas.length === 0 && (
              <div style={{ textAlign:'center', color:T.textSec, fontSize:13, padding:32 }}>
                ✅ No hay alertas activas. Sistema en rango normal.
              </div>
            )}
            {activas.map(alert => (
              <div key={alert.id} style={{
                border:`1.5px solid ${NIVEL_COLOR[alert.nivel]}`,
                borderRadius:10, padding:16, marginBottom:10,
                background:`${NIVEL_COLOR[alert.nivel]}0a`
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:T.text, marginBottom:4 }}>{alert.titulo}</div>
                    <div style={{ fontSize:12, color:T.textSec, marginBottom:8 }}>{alert.descripcion}</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, fontWeight:700, background:NIVEL_COLOR[alert.nivel], color:'#fff', padding:'2px 8px', borderRadius:4, textTransform:'uppercase' }}>
                        {alert.nivel}
                      </span>
                      <span style={{ fontSize:10, color:T.textSec, padding:'2px 8px', border:`1px solid ${T.borderLight}`, borderRadius:4 }}>
                        {TIPO_INFO[alert.tipo]?.icon} {TIPO_INFO[alert.tipo]?.label}
                      </span>
                      <span style={{ fontSize:10, color:T.textSec }}>
                        Detectado: {new Date(alert.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:120 }}>
                    <button onClick={() => updateCrisisStatus(alert.id, 'en_contingencia')}
                      disabled={alert.status === 'en_contingencia'}
                      style={{ background:'#EF4444', border:'none', borderRadius:6, padding:'5px 10px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', opacity: alert.status==='en_contingencia'?0.5:1 }}>
                      🚨 Activar Contingencia
                    </button>
                    <button onClick={() => updateCrisisStatus(alert.id, 'notificada')}
                      disabled={alert.status !== 'nueva'}
                      style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6, padding:'5px 10px', color:T.textSec, fontSize:11, cursor:'pointer', opacity: alert.status!=='nueva'?0.5:1 }}>
                      🔔 Marcar Notificada
                    </button>
                    <button onClick={() => updateCrisisStatus(alert.id, 'resuelta')}
                      style={{ background:'none', border:`1px solid ${T.success}`, borderRadius:6, padding:'5px 10px', color:T.success, fontSize:11, cursor:'pointer' }}>
                      ✅ Resolver
                    </button>
                    <button onClick={() => updateCrisisStatus(alert.id, 'descartada')}
                      style={{ background:'none', border:`1px solid ${T.borderLight}`, borderRadius:6, padding:'5px 10px', color:T.textSec, fontSize:11, cursor:'pointer' }}>
                      🗑 Descartar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Historial resueltas */}
          {resueltas.length > 0 && (
            <div style={{ ...cardStyle() }}>
              <div style={{ fontWeight:700, fontSize:13, color:T.textSec, marginBottom:10 }}>
                Historial Resueltas/Descartadas ({resueltas.length})
              </div>
              {resueltas.slice(0,10).map(alert => (
                <div key={alert.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${T.borderLight}` }}>
                  <div>
                    <span style={{ fontSize:12, color:T.text }}>{TIPO_INFO[alert.tipo]?.icon} {alert.titulo.slice(0,60)}…</span>
                    <span style={{ fontSize:10, color:T.textSec, marginLeft:8 }}>{new Date(alert.created_at).toLocaleDateString('es-CO')}</span>
                  </div>
                  <span style={{ fontSize:10, color: alert.status==='resuelta' ? T.success : T.textSec }}>
                    {STATUS_LABEL[alert.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Sotheby's palette constants for agents section
    const NAVY = '#001A37';
    const GOLD = '#B89047';
    const GOLD_LIGHT = '#D4AF6A';
    const CREAM = '#F7F4EF';
    const PARCHMENT = '#EDE8DF';

    return (
      <div style={{ background: CREAM, minHeight: '100%' }}>
        {/* ── HEADER ── */}
        <div style={{ background: NAVY, padding: '28px 32px 24px', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: GOLD, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>GLP Wealth Management</div>
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: T.fontSerif, fontWeight: 400, color: '#fff', letterSpacing: 0.5 }}>
                Mesa de Inteligencia Comercial
              </h2>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontStyle: 'italic' }}>
                Camilo investiga · Sara gestiona · Valeria publica · Isabella presenta
              </div>
            </div>
            {/* Status chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '5px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>GPT-4o</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '5px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>SMTP</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '5px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B7280', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>APOLLO</span>
              </div>
            </div>
          </div>

          {/* ── COMMAND BAR ── */}
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
            {/* Monitor buttons */}
            {[
              { label: 'Objeciones', onClick: () => { setAgentHistoryDetail('OBJECTIONS'); loadObjections(); }, alert: objStats.some(s=>Number(s.ultimos_7d)>=3), alertColor: GOLD },
              { label: 'Crisis', onClick: () => { setAgentHistoryDetail('CRISIS'); loadCrisisAlerts(); }, alert: crisisAlerts.filter(a=>!['resuelta','descartada'].includes(a.status)).length > 0, alertColor: '#B91C1C', alertCount: crisisAlerts.filter(a=>!['resuelta','descartada'].includes(a.status)).length },
              { label: 'Flujo de Trabajo', onClick: () => setAgentHistoryDetail('WORKFLOW'), alert: workflowTasks.filter(t=>t.status==='pendiente').length > 0, alertColor: GOLD, alertCount: workflowTasks.filter(t=>t.status==='pendiente').length },
            ].map(btn => (
              <button key={btn.label} onClick={btn.onClick}
                style={{ background: btn.alert ? 'rgba(184,144,71,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${btn.alert ? GOLD : 'rgba(255,255,255,0.15)'}`, borderRadius: 4, padding: '7px 14px', color: btn.alert ? GOLD_LIGHT : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s' }}>
                {btn.label}
                {btn.alert && btn.alertCount && btn.alertCount > 0 && (
                  <span style={{ background: btn.alertColor, color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 800 }}>{btn.alertCount}</span>
                )}
                {btn.alert && !btn.alertCount && <span style={{ color: GOLD, fontSize: 12 }}>●</span>}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => runSwarm()} disabled={swarmRunning}
              style={{ background: swarmRunning ? 'rgba(255,255,255,0.06)' : GOLD, border: `1px solid ${swarmRunning ? 'rgba(255,255,255,0.15)' : GOLD}`, borderRadius: 4, padding: '9px 22px', color: swarmRunning ? 'rgba(255,255,255,0.4)' : NAVY, fontSize: 11, fontWeight: 700, cursor: swarmRunning ? 'not-allowed' : 'pointer', letterSpacing: 1, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
              {swarmRunning ? (
                <><div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />Ejecutando...</>
              ) : '▶ Activar Consola'}
            </button>
          </div>
        </div>

        {/* ── PIPELINE TIMELINE ── */}
        <div style={{ background: PARCHMENT, borderBottom: `1px solid #D6CEBC`, padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto' }}>
            {[
              { idx: 0, name: 'CAMILO', role: 'VP de Investigación y Mercados', icon: '🕵️' },
              { idx: 1, name: 'SARA', role: 'Directora de Experiencia de Cliente', icon: '🤖' },
              { idx: 2, name: 'VALERIA', role: 'VP de Medios', icon: '✍️' },
              { idx: 3, name: 'ISABELLA', role: 'Embajadora de Marca GLP', icon: '🎙️' },
            ].map((step, sIdx) => {
              const active = swarmStep === step.idx;
              const completed = swarmStep !== null && swarmStep > step.idx;
              return (
                <div key={step.idx} style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '14px 16px', borderRight: sIdx < 3 ? `1px solid #D6CEBC` : 'none',
                    background: active ? `${GOLD}15` : 'transparent', transition: 'all 0.3s' }}>
                    <div style={{ fontSize: 9, letterSpacing: 3, color: active ? GOLD : completed ? '#10B981' : '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                      {completed ? '✓ Completado' : active ? '● Activo' : 'En espera'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: active ? NAVY : completed ? '#374151' : '#9CA3AF' }}>
                      {step.icon} {step.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{step.role}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CONSOLE LOG ── */}
        <div style={{ background: '#0A1628', padding: '10px 32px', borderBottom: `1px solid rgba(184,144,71,0.2)` }}>
          <div style={{ height: 80, overflowY: 'auto', fontFamily: 'monospace', fontSize: 10 }}>
            {swarmLogs.length === 0 ? (
              <span style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>_ Consola lista. Active el enjambre para iniciar.</span>
            ) : swarmLogs.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 3 }}>
                <span style={{ color: GOLD, opacity: 0.7, minWidth: 55 }}>{log.time}</span>
                <span style={{ color: log.agent==='SISTEMA' ? GOLD : log.agent==='SARA' ? '#34D399' : log.agent==='CAMILO' ? '#60A5FA' : log.agent==='VALERIA' ? '#A78BFA' : '#FBBF24', fontWeight: 700, minWidth: 60 }}>{log.agent}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── AGENT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#D6CEBC' }}>
          {agents.map(agent => {
            const isAgentActive = (agent.name === 'CAMILO' && agentCamiloActive) ||
              (swarmStep !== null && ((agent.name === 'CAMILO' && swarmStep === 0) || (agent.name === 'SARA' && swarmStep === 1) || (agent.name === 'VALERIA' && swarmStep === 2) || (agent.name === 'ISABELLA' && swarmStep === 3)));
            return (
              <div key={agent.name} style={{ background: '#FFFFFF', padding: '28px 28px 20px', position: 'relative', transition: 'all 0.3s',
                borderTop: isAgentActive ? `3px solid ${GOLD}` : `3px solid transparent` }}>

                {/* Active glow bar */}
                {isAgentActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT}, ${GOLD})` }} />}

                {/* Agent header */}
                <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={agent.photo} alt={agent.name}
                      style={{ width: 230, height: 230, borderRadius: 2, objectFit: 'cover', objectPosition: 'top',
                        filter: isAgentActive ? 'none' : 'grayscale(15%)',
                        boxShadow: isAgentActive ? `0 0 0 2px ${GOLD}, 0 4px 20px rgba(184,144,71,0.3)` : `0 2px 12px rgba(0,0,0,0.12)` }} />
                    <div style={{ position: 'absolute', bottom: -4, right: -4, width: 14, height: 14, borderRadius: '50%',
                      background: isAgentActive ? GOLD : '#10B981', border: '2px solid #fff',
                      animation: isAgentActive ? 'pulse 1.2s infinite' : 'none' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, letterSpacing: 3, color: GOLD, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Agente IA</div>
                    <div style={{ fontSize: 17, fontFamily: T.fontSerif, fontWeight: 600, color: NAVY, letterSpacing: 0.3, lineHeight: 1.2 }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, fontStyle: 'italic' }}>{agent.role}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: isAgentActive ? GOLD : '#10B981', display: 'inline-block' }} />
                      <span style={{ fontSize: 10, color: isAgentActive ? GOLD : '#10B981', fontWeight: 600, letterSpacing: 0.5 }}>
                        {isAgentActive ? 'Procesando' : agent.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${PARCHMENT}`, marginBottom: 16 }} />

                {/* Description */}
                <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.65, marginBottom: 18 }}>{agent.desc}</div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, borderTop: `1px solid ${PARCHMENT}`, borderLeft: `1px solid ${PARCHMENT}`, marginBottom: 16 }}>
                  {agent.stats.map(s => {
                    const isSelected = activeAgentKpi?.agent === agent.name && activeAgentKpi?.label === s.label;
                    return (
                      <div key={s.label} onClick={() => isSelected ? setActiveAgentKpi(null) : setActiveAgentKpi({ agent: agent.name, label: s.label })}
                        style={{ padding: '12px 10px', textAlign: 'center', cursor: 'pointer', borderRight: `1px solid ${PARCHMENT}`, borderBottom: `1px solid ${PARCHMENT}`,
                          background: isSelected ? `${GOLD}10` : '#fff', transition: 'background 0.15s' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: isSelected ? GOLD : NAVY, fontFamily: T.fontSerif }}>{s.value}</div>
                        <div style={{ fontSize: 9, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* KPI Drilldown */}
                {activeAgentKpi?.agent === agent.name && (
                  <div style={{ background: CREAM, border: `1px solid #D6CEBC`, borderLeft: `3px solid ${GOLD}`, padding: '12px 14px', marginBottom: 14, fontSize: 11, color: T.text }}>
                    <div style={{ fontWeight: 700, color: NAVY, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: GOLD }}>Detalle: {activeAgentKpi.label}</span>
                      <span onClick={(e) => { e.stopPropagation(); setActiveAgentKpi(null); }} style={{ cursor: 'pointer', color: '#9CA3AF', fontSize: 14 }}>×</span>
                    </div>
                    {renderAgentKpiDetail(agent.name, activeAgentKpi.label)}
                  </div>
                )}

                {/* Last run */}
                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 12, letterSpacing: 0.3 }}>
                  Última actividad: <span style={{ color: '#6B7280' }}>{agent.lastRun}</span>
                </div>

                {/* Bitácora */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Bitácora</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 100, overflowY: 'auto' }}>
                    {agent.logs.map((log, i) => (
                      <div key={i} style={{ fontSize: 10, display: 'flex', gap: 10, padding: '5px 0', borderBottom: `1px solid ${PARCHMENT}` }}>
                        <span style={{ color: GOLD, fontWeight: 600, minWidth: 38, flexShrink: 0 }}>{log.time}</span>
                        <span style={{ color: '#374151' }}>{log.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* INTERACTIVE MODULE OUTPUTS */}
                {agent.name === 'VALERIA' && valeriaDrafts.filter(d => d.status === 'pending').length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, letterSpacing: 2, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Borradores Pendientes</div>
                    {valeriaDrafts.filter(d => d.status === 'pending').slice(0, 2).map((draft, idx) => (
                      <div key={draft.id} style={{ background: CREAM, border: `1px solid #D6CEBC`, borderLeft: `3px solid ${GOLD}`, padding: '10px 12px', marginBottom: 6 }}>
                        <div style={{ fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Borrador {idx + 1} · {draft.type}</div>
                        <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5, maxHeight: 50, overflow: 'hidden' }}>{draft.content}</div>
                        <button onClick={() => setValeriaDrafts(prev => prev.map(x => x.id === draft.id ? { ...x, status: 'active' } : x))}
                          style={{ marginTop: 8, background: 'transparent', border: `1px solid ${GOLD}`, color: GOLD, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 10px', cursor: 'pointer', borderRadius: 2 }}>
                          Aprobar
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {agent.name === 'ISABELLA' && (
                  <div style={{ marginBottom: 14 }}>
                    {/* Banner video */}
                    <div style={{ position: 'relative', width: '100%', height: 110, background: NAVY, overflow: 'hidden', marginBottom: 10 }}>
                      <img src="/img/projects/isabella.png" alt="Isabella" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.4 }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '10px 14px', background: 'linear-gradient(to top, rgba(0,26,55,0.95) 0%, transparent 60%)' }}>
                        <div style={{ fontSize: 9, letterSpacing: 3, color: GOLD, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Producción de Video</div>
                        <div style={{ fontSize: 11, color: '#fff', fontFamily: T.fontSerif }}>
                          {isabellaScripts.filter(d=>d.status==='pending').length > 0
                            ? `${isabellaScripts.filter(d=>d.status==='pending').length} guión(es) pendiente(s) · ${isabellaScripts.filter(d=>d.status==='active').length} aprobado(s)`
                            : 'Sin guiones pendientes'}
                        </div>
                      </div>
                      <div style={{ position: 'absolute', top: 8, right: 8, background: GOLD, color: NAVY, fontSize: 8, fontWeight: 800, padding: '3px 8px', letterSpacing: 1 }}>HeyGen API</div>
                    </div>

                    {/* Guiones pendientes */}
                    {isabellaScripts.filter(d => d.status === 'pending').slice(0, 2).map((script, idx) => (
                      <div key={script.id} style={{ background: CREAM, border: `1px solid #D6CEBC`, borderLeft: `3px solid ${GOLD}`, marginBottom: 8 }}>
                        {/* Header guion */}
                        <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid #E9E4DA`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 8, color: GOLD, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Guión #{idx + 1} · {script.canal || script.type}</div>
                            {script.asunto && <div style={{ fontSize: 11, fontWeight: 600, color: NAVY, fontFamily: T.fontSerif, marginTop: 2 }}>{script.asunto}</div>}
                          </div>
                          <span style={{ fontSize: 8, background: `${GOLD}20`, color: GOLD, fontWeight: 700, padding: '2px 7px', letterSpacing: 1 }}>BORRADOR</span>
                        </div>

                        {/* Contenido del guion — completo y editable */}
                        <div style={{ padding: '8px 12px' }}>
                          <textarea
                            value={script.content}
                            onChange={e => setIsabellaScripts(prev => prev.map(x => x.id === script.id ? { ...x, content: e.target.value } : x))}
                            style={{ width: '100%', boxSizing: 'border-box' as const, fontSize: 10, lineHeight: 1.7, color: '#374151', background: '#fff', border: '1px solid #E9E4DA', padding: '10px', fontFamily: 'monospace', resize: 'vertical' as const, minHeight: 180, outline: 'none' }}
                          />

                          {/* Contexto si existe */}
                          {script.contexto && (
                            <div style={{ fontSize: 9, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 }}>{script.contexto}</div>
                          )}

                          {/* Acciones */}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <button onClick={() => setIsabellaScripts(prev => prev.filter(x => x.id !== script.id))}
                              style={{ background: 'transparent', border: '1px solid #FECACA', color: '#DC2626', fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer' }}>
                              Descartar
                            </button>
                            <button onClick={() => setIsabellaScripts(prev => prev.map(x => x.id === script.id ? { ...x, status: 'approved' } : x))}
                              style={{ flex: 1, background: NAVY, color: GOLD_LIGHT, border: 'none', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer' }}>
                              Aprobar Guion
                            </button>
                            <button
                              onClick={() => {
                                const payload = {
                                  titulo: script.asunto || 'Video GLP',
                                  guion: script.content,
                                  tipo: script.canal || script.type,
                                  fecha: script.date,
                                };
                                // Copiar al clipboard como JSON listo para HeyGen
                                navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
                                  .then(() => alert('✅ Guion copiado al clipboard en formato JSON.\n\nPega este contenido en HeyGen → Script → Custom para generar el avatar de Isabella.'))
                                  .catch(() => alert('Error al copiar. Usa "Ver Historial" para acceder al guion completo.'));
                                setIsabellaScripts(prev => prev.map(x => x.id === script.id ? { ...x, status: 'active', notas_admin: 'Migrado a HeyGen' } : x));
                              }}
                              style={{ flex: 1, background: GOLD, color: NAVY, border: 'none', fontSize: 8, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer' }}>
                              → HeyGen
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agent Actions */}
                <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${PARCHMENT}`, paddingTop: 14, marginTop: 4 }}>
                  {agent.actions.map((act, aIdx) => (
                    <button type="button" key={act.label} onClick={act.onClick}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                        cursor: 'pointer', borderRadius: 2, transition: 'all 0.2s',
                        background: aIdx === 0 ? NAVY : 'transparent',
                        color: aIdx === 0 ? GOLD_LIGHT : NAVY,
                        border: aIdx === 0 ? `1px solid ${NAVY}` : `1px solid #D6CEBC` }}>
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Swarm CSS keyframe animations */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
          @keyframes ping { 75%, 100% { transform: scale(1.4); opacity: 0; } }
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
    const proj = calcProject ? PROJECTS.find(p => p.name === calcProject) : null;

    const profileProjects = INVESTOR_PROFILES.find(x => x.id === calcPerfil)?.projects || [];
    const filteredProjects = PROJECTS.filter(pd => {
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

    // Expenses
    const valorFiscal = calcValorFiscal > 0 ? calcValorFiscal : calcPrecio * 0.70; // 70% del comercial si no se especifica
    // PM: % sobre renta efectiva; el $ fijo es referencia visual (sincronizado externamente)
    const feePMMensual = calcFeePMFixed > 0 ? calcFeePMFixed : rentaMensualEfectiva * (calcFeePM / 100);
    const gastosPM = feePMMensual * 12;           // property management annual
    const gastosAdmin = 0;                      // always 0 (removed input)
    const gastosCondominio = calcCondominio * 12; // Admin Conjunto annual
    const gastosPredial = valorFiscal * (calcPredial / 100); // % sobre valor fiscal
    const gastosSeguro = valorFiscal * (calcSeguro / 100);   // % sobre valor fiscal
    const gastosMantenimiento = 0;              // always 0
    const totalGastosMensual = feePMMensual + (gastosCondominio / 12) + (gastosPredial / 12) + (gastosSeguro / 12);
    const totalGastos = gastosPM + gastosCondominio + gastosPredial + gastosSeguro; // annual total

    // NOI & Cash flow
    const noi = ingresoBrutoAnual - totalGastos;
    const capRateNeto = calcPrecio > 0 ? (noi / calcPrecio) * 100 : 0;           // sobre activo total (referencia mercado)
    const roiEquity = cuotaInicialdUSD > 0 ? (noi / cuotaInicialdUSD) * 100 : 0; // NOI sobre equity real desembolsado
    const cashOnCash = cuotaInicialdUSD > 0 ? ((noi - cuotaAnualHip) / cuotaInicialdUSD) * 100 : 0; // flujo libre sobre equity
    const flujoLibreMensual = (noi - cuotaAnualHip) / 12;
    const valorFuturo = calcPrecio * Math.pow(1 + calcValorizacion / 100, calcPlazo);

    // Year-by-year table (correct amortization)
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
      const intAnual = deudaRemanente * (calcTasaHip / 100);
      const amortAnual = Math.max(0, cuotaAnualHip - intAnual);
      deudaRemanente = Math.max(0, deudaRemanente - amortAnual);
      const cuotaEsteAnio = deudaRemanente > 0 || amortAnual > 0 ? cuotaMes : 0;
      const flujoPostHip = noiY - cuotaEsteAnio * 12;
      yearlyTable.push({
        year: y,
        rentaMensual,
        ingresoEfectivoMensual: rentaMensual * (1 - calcVacancia / 100),
        ingresoAnual: ingresoAnualY,
        gastosMensual: totalGastosMensual,
        gastosAnual: gastosAnualY,
        noi: noiY,
        cuotaHip: cuotaEsteAnio,
        flujoPostHip,
        deuda: deudaRemanente,
        valorActivo: valorActivoY,
      });
    }

    // Sale calculation (EV → Equity → Net Proceeds)
    const ventaValor = calcPrecio * Math.pow(1 + calcValorizacion / 100, calcVenderAnio); // Enterprise Value
    const deudaAlVender = yearlyTable[Math.min(calcVenderAnio, calcPlazo) - 1]?.deuda ?? montoFinanciado;
    const equityValue = ventaValor - deudaAlVender; // Equity Value = EV - remaining debt
    const costoComision = ventaValor * 0.03;         // 3% broker commission
    const costoImpuesto = ventaValor * 0.02;         // 2% transfer tax
    const costoLegal = ventaValor * 0.005;            // 0.5% legal
    const totalCostosTx = costoComision + costoImpuesto + costoLegal;
    const netProceedsVenta = equityValue - totalCostosTx; // Net to seller after debt + costs
    const gananciaVsInversion = netProceedsVenta - cuotaInicialdUSD;
    const gananciaVsCostoTotal = netProceedsVenta - calcPrecio;
    const ventaImpuesto = costoImpuesto;
    const ventaUtilidad = gananciaVsInversion;

    // TIR: flujos desde perspectiva del equity (cuota inicial como inversión inicial)
    const totalFlujosCaja = yearlyTable.slice(0, calcVenderAnio).reduce((s, r) => s + r.flujoPostHip, 0);
    const moic = cuotaInicialdUSD > 0 ? (netProceedsVenta + totalFlujosCaja) / cuotaInicialdUSD : null;

    const tirFlows: number[] = [-cuotaInicialdUSD];
    for (let y = 1; y <= calcVenderAnio; y++) {
      const row = yearlyTable[y - 1];
      const flujoAnual = row ? row.flujoPostHip : (noi - cuotaAnualHip);
      tirFlows.push(y === calcVenderAnio ? flujoAnual + netProceedsVenta : flujoAnual);
    }
    const tirRaw = calcIRR(tirFlows);
    const tirPct = tirRaw !== null ? tirRaw * 100 : null;

    // CDT comparison
    const cdtRate = 10.5;
    const cdtDevaluation = 6;
    const cdtRealRate = cdtRate - cdtDevaluation;
    const cdtFutureValue = cuotaInicialdUSD * Math.pow(1 + cdtRealRate / 100, calcPlazo);

    // GLP patrimonio neto al final del plazo
    // Al final del plazo hipotecario la deuda es ~0, el activo vale valorFuturo
    // Los FCF acumulados son la suma real año a año (pueden ser negativos en años iniciales)
    const fcfAcumulado = yearlyTable.reduce((s, r) => s + r.flujoPostHip, 0);
    const deudaFinal = yearlyTable[yearlyTable.length - 1]?.deuda ?? 0;
    const patrimonioNetoGLP = valorFuturo - deudaFinal + fcfAcumulado;
    const gananciaNetaGLP = patrimonioNetoGLP - cuotaInicialdUSD;
    const diferencialVsCDT = patrimonioNetoGLP - cdtFutureValue;

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
        {sectionTitle('Calculadora Inmobiliaria · Análisis de Inversión')}

        {/* Profile chips — barra liviana encima del grid */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>Perfil rápido:</span>
          {INVESTOR_PROFILES.map(p => (
            <div key={p.id}
              onClick={() => { setCalcPerfil(calcPerfil === p.id ? null : p.id); setCalcProject(null); }}
              style={{
                borderRadius: 20, padding: '5px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${calcPerfil === p.id ? p.color : T.border}`,
                background: calcPerfil === p.id ? `${p.color}18` : T.card,
                color: calcPerfil === p.id ? p.color : T.textSec, transition: 'all 0.15s',
              }}
            >
              {p.label}
            </div>
          ))}
          {(calcPerfil || calcFilterZone !== 'all' || calcFilterPrice !== 'all') && (
            <button onClick={() => { setCalcPerfil(null); setCalcFilterZone('all'); setCalcFilterPrice('all'); setCalcProject(null); }}
              style={{ fontSize: 11, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>
              × Limpiar
            </button>
          )}
          {/* Filtros secundarios inline */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <select value={calcFilterZone} onChange={e => { setCalcFilterZone(e.target.value); setCalcProject(null); }}
              style={inputStyle({ fontSize: 11, padding: '4px 8px' })}>
              <option value="all">Todas las zonas</option>
              <option value="Playa Caracol">Playa Caracol</option>
              <option value="Santa María">Santa María</option>
              <option value="Punta Pacífica">Punta Pacífica</option>
              <option value="Costa del Este">Costa del Este / Panamá Viejo</option>
              <option value="Arraiján / Pacífico">Arraiján / Pacífico</option>
            </select>
            <select value={calcFilterPrice} onChange={e => { setCalcFilterPrice(e.target.value); setCalcProject(null); }}
              style={inputStyle({ fontSize: 11, padding: '4px 8px' })}>
              <option value="all">Todos los precios</option>
              <option value="low">Hasta $250k</option>
              <option value="mid">$250k – $500k</option>
              <option value="high">Más de $500k</option>
            </select>
          </div>
        </div>

        {/* PROJECT GRID — always visible, filtered */}
        <div style={{ ...cardStyle(), marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              Portafolio ({filteredProjects.length} proyectos)
              {calcProject && <span style={{ fontSize: 13, color: T.teal, marginLeft: 8, fontWeight: 500 }}>· Seleccionado: {calcProject}</span>}
            </div>
            {calcProject && (
              <button onClick={() => setCalcProject(null)} style={{ fontSize: 11, color: T.coral, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✕ Quitar selección</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
            {filteredProjects.map(pd => {
              const pn = pd.name;
              const sel = calcProject === pn;
              const imgs = PROJECT_IMAGES[pn];
              return (
                <div key={pn} onClick={() => selectCalcProject(pn)}
                  style={{
                    borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                    border: `2px solid ${sel ? T.teal : T.border}`,
                    background: sel ? 'rgba(14,165,172,0.04)' : T.card,
                    transition: 'all 0.15s',
                    boxShadow: sel ? `0 0 0 3px ${T.teal}28` : '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                  onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = T.teal + '70'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; } }}
                  onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; } }}
                >
                  {/* Image */}
                  <div style={{ height: 110, background: imgs ? `url(${imgs.main}) center/cover` : `linear-gradient(135deg, ${T.teal}22, ${T.sky}33)`, display: 'flex', alignItems: 'flex-start', padding: '8px 10px' }}>
                    {sel && <span style={{ fontSize: 9, fontWeight: 800, background: T.teal, color: '#fff', padding: '3px 8px', borderRadius: 5, letterSpacing: '0.05em' }}>SELECCIONADO</span>}
                  </div>
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: T.text, marginBottom: 2, lineHeight: 1.3 }}>{pn}</div>
                    <div style={{ fontSize: 10, color: T.teal, marginBottom: 6 }}>{pd.zoneShort}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: T.text, fontWeight: 600 }}>Desde {usd(pd.minPrice)}</span>
                      <span style={{ color: T.palm, fontWeight: 700 }}>{pd.capRateMin}–{pd.capRateMax}%</span>
                    </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
              {/* Left: Parameters */}
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>

                {/* Activo */}
                <div style={cardStyle()}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>Activo</div>
                  {sliderInput('Precio del activo', calcPrecio, setCalcPrecio, proj.minPrice, proj.minPrice * 4, 10000, '$')}
                  {sliderInput('Metraje (m²)', calcArea, setCalcArea, proj.areaMin, proj.areaMax, 1, ' m²')}
                  {sliderInput('Renta por m²/mes', calcRentaM2, setCalcRentaM2, 5, 35, 1, ' USD')}
                  {sliderInput('Vacancia', calcVacancia, setCalcVacancia, 0, 30, 1, '%')}
                  {sliderInput('Valorización anual', calcValorizacion, setCalcValorizacion, 1, 10, 0.5, '%')}
                </div>

                {/* Financiación */}
                <div style={cardStyle()}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 14 }}>Financiación</div>
                  {sliderInput('Cuota inicial', calcCuotaInicial, setCalcCuotaInicial, 30, 100, 5, '%')}
                  <div style={{ marginTop: -8, marginBottom: 14, padding: '8px 12px', background: `${T.teal}0D`, border: `1px solid ${T.teal}30`, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: T.textSec }}>Monto desembolsado</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: T.teal }}>{usd(Math.round(cuotaInicialdUSD))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, paddingTop: 5, borderTop: `1px solid ${T.teal}20` }}>
                      <span style={{ fontSize: 11, color: T.textSec }}>Cuota mensual hipotecaria</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{usd(Math.round(cuotaMes))}</span>
                    </div>
                  </div>
                  {sliderInput('Tasa hipotecaria', calcTasaHip, setCalcTasaHip, 5, 12, 0.5, '%')}
                  {sliderInput('Plazo (años)', calcPlazo, setCalcPlazo, 5, 30, 1, ' años')}
                  <div style={{ paddingTop: 12, borderTop: `1px solid ${T.borderLight}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text, cursor: 'pointer' }}>
                      <input type="checkbox" checked={calcVender} onChange={e => setCalcVender(e.target.checked)} style={{ accentColor: T.teal }} />
                      Simular venta en año
                    </label>
                    {calcVender && (
                      <input type="number" value={calcVenderAnio} min={1} max={calcPlazo}
                        onChange={e => setCalcVenderAnio(Number(e.target.value))}
                        style={inputStyle({ width: 56, fontSize: 13, padding: '4px 8px', fontWeight: 700 })} />
                    )}
                  </div>
                </div>

              </div>

              {/* Right: Results */}
              <div>
                {/* Reorganized Results: particular → general */}
                <div style={{ ...cardStyle(), marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 18 }}>Resumen Financiero — {calcProject}</div>
                  {/* P&L Waterfall */}
                  {(() => {
                    const COL = 'minmax(0,1fr) 110px 110px max-content';
                    const hdr = (label: string) => (
                      <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 6, padding: '5px 10px', background: T.sand, borderRadius: 6, marginTop: 10, marginBottom: 2 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{label}</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textAlign: 'right' as const, textTransform: 'uppercase' as const }}>Mensual</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textAlign: 'right' as const, textTransform: 'uppercase' as const }}>Anual</div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textAlign: 'right' as const, textTransform: 'uppercase' as const, minWidth: 72 }}>Yield</div>
                      </div>
                    );
                    const row = (label: string, monthly: number, annual: number, color: string, yield_: string | null = null, indent = false, bold = false, topLine = false) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: COL, gap: 6, padding: `${bold ? 8 : 6}px 10px`, borderTop: topLine ? `1.5px solid ${T.border}` : `1px solid ${T.borderLight}`, background: bold ? `${color}08` : 'transparent', borderRadius: bold ? 4 : 0 }}>
                        <div style={{ fontSize: bold ? 12 : 11, color: indent ? T.textSec : T.text, paddingLeft: indent ? 14 : 0, fontWeight: bold ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</div>
                        <div style={{ fontSize: bold ? 12 : 11, fontWeight: bold ? 700 : 500, color, textAlign: 'right' as const, whiteSpace: 'nowrap' as const }}>{usd(Math.round(monthly))}</div>
                        <div style={{ fontSize: bold ? 12 : 11, fontWeight: bold ? 700 : 500, color, textAlign: 'right' as const, whiteSpace: 'nowrap' as const }}>{usd(Math.round(annual))}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: yield_ ? color : 'transparent', textAlign: 'right' as const, whiteSpace: 'nowrap' as const, minWidth: 72 }}>{yield_ ?? '—'}</div>
                      </div>
                    );
                    return (
                      <div>
                        {hdr('Ingresos')}
                        {row('Ingreso Bruto (renta × m²)', rentaMensual, rentaMensual * 12, T.palm, `${capRateBruto.toFixed(1)}% bruto`, false, true)}
                        {row(`Vacancia (${calcVacancia}%)`, -(rentaMensual * calcVacancia / 100), -(rentaMensual * 12 * calcVacancia / 100), T.coral, null, true)}
                        {row('Ingreso Efectivo Neto', rentaMensualEfectiva, ingresoBrutoAnual, T.palm, `${(cuotaInicialdUSD > 0 ? (ingresoBrutoAnual / cuotaInicialdUSD) * 100 : 0).toFixed(1)}% neto`, false, true, true)}

                        {hdr('Gastos Operativos')}
                        {row('Predial', -(gastosPredial / 12), -gastosPredial, T.coral, null, true)}
                        {row('Seguros', -(gastosSeguro / 12), -gastosSeguro, T.coral, null, true)}
                        {row('Property Management', -feePMMensual, -gastosPM, T.coral, null, true)}
                        {row('Admin Conjunto', -(gastosCondominio / 12), -gastosCondominio, T.coral, null, true)}
                        {row('Total Gastos Operativos', -totalGastosMensual, -totalGastos, T.coral, null, false, true, true)}

                        {hdr('Resultado Operativo')}
                        {row('NOI (Ingreso Operativo Neto)', noi / 12, noi, T.teal, `${capRateNeto.toFixed(1)}% activo`, false, true, true)}
                        {row('', 0, 0, T.teal, `${roiEquity.toFixed(1)}% equity`, false, false)}

                        {hdr('Financiación')}
                        {row('Cuota Hipotecaria', -cuotaMes, -cuotaAnualHip, T.sky, null, true)}
                        {row('Free Cash Flow', flujoLibreMensual, noi - cuotaAnualHip, flujoLibreMensual >= 0 ? T.palm : T.coral, `${cashOnCash.toFixed(1)}% CoC`, false, true, true)}
                      </div>
                    );
                  })()}
                </div>

                {/* Análisis de Sensibilidad Operativa */}
                <div style={{ ...cardStyle(), marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4, letterSpacing: '-0.01em' }}>Sensibilidad · Costos Operativos</div>
                  <div style={{ fontSize: 11, color: T.textSec, marginBottom: 16 }}>
                    Variación ±15% sobre costos base de {usd(totalGastos)}/año — impacto en Cap Rate Neto y Cash-on-Cash.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: T.border, borderRadius: 10, overflow: 'hidden' }}>
                    {([
                      { label: 'Optimista', sub: '−15% costos', mult: 0.85, accent: T.teal },
                      { label: 'Caso Base', sub: 'costos actuales', mult: 1.00, accent: T.text },
                      { label: 'Conservador', sub: '+15% costos', mult: 1.15, accent: '#8B6914' },
                    ] as { label: string; sub: string; mult: number; accent: string }[]).map((s, i) => {
                      const gastos = totalGastos * s.mult;
                      const noiS = ingresoBrutoAnual - gastos;
                      const crNeto = calcPrecio > 0 ? (noiS / calcPrecio * 100) : 0;
                      const cocS = cuotaInicialdUSD > 0 ? ((noiS - cuotaAnualHip) / cuotaInicialdUSD * 100) : 0;
                      const fcfS = (noiS - cuotaAnualHip) / 12;
                      return (
                        <div key={s.label} style={{ background: i === 1 ? T.sand : T.card, padding: '16px 18px' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: s.accent, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 2 }}>{s.label}</div>
                          <div style={{ fontSize: 10, color: T.textSec, marginBottom: 14 }}>{s.sub}</div>
                          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 9, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Gastos Anuales</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{usd(Math.round(gastos))}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>NOI Anual</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: noiS >= 0 ? T.teal : T.coral }}>{usd(Math.round(noiS))}</div>
                            </div>
                            <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 9, color: T.textSec, letterSpacing: '0.05em', marginBottom: 2 }}>Cap Rate</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: s.accent }}>{crNeto.toFixed(2)}%</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 9, color: T.textSec, letterSpacing: '0.05em', marginBottom: 2 }}>Cash-on-Cash</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: cocS >= 0 ? T.teal : T.coral }}>{cocS.toFixed(2)}%</div>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: T.textSec, letterSpacing: '0.05em', marginBottom: 2 }}>Free Cash Flow / mes</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: fcfS >= 0 ? T.palm : T.coral }}>{usd(Math.round(fcfS))}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>{/* end right column */}
            </div>{/* end grid */}

            {/* Gastos Operativos — full width, antes de la proyección */}
            <div style={{ ...cardStyle(), marginTop: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Gastos Operativos</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: T.textSec }}>Valor fiscal del activo</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: T.textSec }}>$</span>
                    <input type="number" step="1000"
                      value={calcValorFiscal > 0 ? calcValorFiscal : Math.round(calcPrecio * 0.70)}
                      onChange={e => setCalcValorFiscal(Number(e.target.value))}
                      style={inputStyle({ fontSize: 12, padding: '4px 10px', width: 120, fontWeight: 600 })} />
                  </div>
                  <span style={{ fontSize: 10, color: T.textSec, fontStyle: 'italic' }}>
                    (ref. {usd(Math.round(calcPrecio * 0.70))} · 70% comercial)
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 20 }}>
                <div style={{ padding: '14px 16px', background: T.sand, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 10 }}>
                    Property Management · % sobre renta efectiva
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: T.textSec, display: 'block', marginBottom: 4 }}>Porcentaje (%)</label>
                      <input type="number" step="0.5" value={calcFeePM}
                        onChange={e => { setCalcFeePM(Number(e.target.value)); setCalcFeePMFixed(0); }}
                        style={inputStyle({ fontSize: 14, padding: '6px 10px', width: '100%', fontWeight: 700 })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: T.textSec, display: 'block', marginBottom: 4 }}>Monto fijo ($/mes)</label>
                      <input type="number" step="10"
                        value={calcFeePMFixed > 0 ? calcFeePMFixed : Math.round(feePMMensual)}
                        onChange={e => { setCalcFeePMFixed(Number(e.target.value)); setCalcFeePM(0); }}
                        style={inputStyle({ fontSize: 14, padding: '6px 10px', width: '100%', fontWeight: 700 })} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: T.teal, fontWeight: 600 }}>
                    {usd(Math.round(feePMMensual))}/mes · {usd(Math.round(gastosPM))}/año
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>Cuota Admin</div>
                  <div style={{ fontSize: 9, color: T.textSec, marginBottom: 6 }}>$/mes según coeficiente</div>
                  <input type="number" step="10" value={calcCondominio}
                    onChange={e => setCalcCondominio(Number(e.target.value))}
                    style={inputStyle({ fontSize: 14, padding: '6px 10px', width: '100%', fontWeight: 700 })} />
                  <div style={{ marginTop: 6, fontSize: 10, color: T.textSec }}>{usd(calcCondominio)}/mes · {usd(gastosCondominio)}/año</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>Seguro Propiedad</div>
                  <div style={{ fontSize: 9, color: T.textSec, marginBottom: 6 }}>% sobre valor fiscal</div>
                  <input type="number" step="0.05" value={calcSeguro}
                    onChange={e => setCalcSeguro(Number(e.target.value))}
                    style={inputStyle({ fontSize: 14, padding: '6px 10px', width: '100%', fontWeight: 700 })} />
                  <div style={{ marginTop: 6, fontSize: 10, color: T.textSec }}>{usd(Math.round(gastosSeguro))}/año</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>Impuesto Predial</div>
                  <div style={{ fontSize: 9, color: T.textSec, marginBottom: 6 }}>% sobre valor fiscal</div>
                  <input type="number" step="0.1" value={calcPredial}
                    onChange={e => setCalcPredial(Number(e.target.value))}
                    style={inputStyle({ fontSize: 14, padding: '6px 10px', width: '100%', fontWeight: 700 })} />
                  <div style={{ marginTop: 6, fontSize: 10, color: T.textSec }}>{usd(Math.round(gastosPredial))}/año</div>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${T.borderLight}`, display: 'flex', justifyContent: 'flex-end', gap: 32 }}>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 9, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Total mensual</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.coral }}>{usd(Math.round(totalGastosMensual))}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 9, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Total anual</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: T.coral }}>{usd(Math.round(totalGastos))}</div>
                </div>
              </div>
            </div>

            {/* Year-by-year table — full width */}
            <div style={{ ...cardStyle(), marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Proyección Año por Año — Plazo Hipoteca ({calcPlazo} Años)</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${T.border}` }}>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Año</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Renta/Mes</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Ingreso Anual</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Gastos Anual</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>NOI</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Hipoteca</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' as const }}>Flujo Neto</th>
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
                    * Flujo neto = NOI anual − cuota hipotecaria anual. La tabla cubre los {calcPlazo} años del plazo de la hipoteca; al final el activo queda libre de deuda.
                  </div>
                </div>

                {/* Sale scenario */}
                {calcVender && (
                  <div style={{ ...cardStyle(), marginBottom: 16 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: '-0.01em' }}>Análisis de Salida</div>
                        <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Escenario de venta en año {calcVenderAnio} · {calcProject}</div>
                      </div>
                      <div style={{ textAlign: 'right' as const }}>
                        <div style={{ fontSize: 10, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Retorno Total</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: (gananciaVsInversion + totalFlujosCaja) >= 0 ? T.teal : T.coral }}>
                          {(gananciaVsInversion + totalFlujosCaja) >= 0 ? '+' : '−'}{usd(Math.round(Math.abs(gananciaVsInversion + totalFlujosCaja)))}
                        </div>
                        <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>venta + flujos netos</div>
                      </div>
                    </div>

                    {/* Two waterfall columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
                      {/* EV → Equity */}
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 12 }}>Enterprise Value → Equity</div>
                        {([
                          { label: 'Enterprise Value', sub: `precio × (1 + ${calcValorizacion}%)^${calcVenderAnio}`, val: ventaValor, sign: '', color: T.text, bold: true, topLine: false },
                          { label: 'Deuda remanente', sub: `hipoteca año ${calcVenderAnio}`, val: deudaAlVender, sign: '−', color: T.coral, bold: false, topLine: false },
                          { label: 'Equity Value', sub: 'EV menos deuda', val: equityValue, sign: '', color: T.teal, bold: true, topLine: true },
                        ] as {label:string;sub:string;val:number;sign:string;color:string;bold:boolean;topLine:boolean}[]).map(r => (
                          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderTop: r.topLine ? `1.5px solid ${T.border}` : `1px solid ${T.borderLight}` }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: r.bold ? 700 : 400, color: T.text }}>{r.label}</div>
                              <div style={{ fontSize: 9, color: T.textSec, marginTop: 1 }}>{r.sub}</div>
                            </div>
                            <div style={{ fontSize: r.bold ? 13 : 12, fontWeight: r.bold ? 800 : 500, color: r.color, whiteSpace: 'nowrap' as const }}>
                              {r.sign}{usd(Math.round(r.val))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Equity → Net Proceeds */}
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 800, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.09em', marginBottom: 12 }}>Equity → Neto Inversionista</div>
                        {([
                          { label: 'Equity Value', sub: '', val: equityValue, sign: '', color: T.teal, bold: true, topLine: false },
                          { label: 'Comisión broker', sub: '3% sobre EV', val: costoComision, sign: '−', color: T.textSec, bold: false, topLine: false },
                          { label: 'Impuesto transferencia', sub: '2% sobre EV', val: costoImpuesto, sign: '−', color: T.textSec, bold: false, topLine: false },
                          { label: 'Costos legales', sub: '0.5% sobre EV', val: costoLegal, sign: '−', color: T.textSec, bold: false, topLine: false },
                          { label: 'Net Proceeds', sub: 'neto de la venta', val: netProceedsVenta, sign: '', color: T.text, bold: true, topLine: true },
                          { label: 'Cuota inicial', sub: 'capital desembolsado', val: cuotaInicialdUSD, sign: '−', color: T.textSec, bold: false, topLine: false },
                          { label: 'Ganancia por venta', sub: 'plusvalía neta', val: Math.abs(gananciaVsInversion), sign: gananciaVsInversion >= 0 ? '+' : '−', color: gananciaVsInversion >= 0 ? T.palm : T.coral, bold: true, topLine: true },
                          { label: `FCF acumulado`, sub: `flujos netos años 1–${calcVenderAnio}`, val: Math.abs(totalFlujosCaja), sign: totalFlujosCaja >= 0 ? '+' : '−', color: totalFlujosCaja >= 0 ? T.palm : T.coral, bold: false, topLine: false },
                          { label: 'Retorno Total', sub: 'venta + flujos', val: Math.abs(gananciaVsInversion + totalFlujosCaja), sign: (gananciaVsInversion + totalFlujosCaja) >= 0 ? '+' : '−', color: (gananciaVsInversion + totalFlujosCaja) >= 0 ? T.teal : T.coral, bold: true, topLine: true },
                        ] as {label:string;sub:string;val:number;sign:string;color:string;bold:boolean;topLine:boolean}[]).map(r => (
                          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderTop: r.topLine ? `1.5px solid ${T.border}` : `1px solid ${T.borderLight}` }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: r.bold ? 700 : 400, color: T.text }}>{r.label}</div>
                              {r.sub && <div style={{ fontSize: 9, color: T.textSec, marginTop: 1 }}>{r.sub}</div>}
                            </div>
                            <div style={{ fontSize: r.bold ? 13 : 12, fontWeight: r.bold ? 800 : 500, color: r.color, whiteSpace: 'nowrap' as const }}>
                              {r.sign}{usd(Math.round(r.val))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KPI strip: ROI · TIR · MOIC */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: T.border, borderRadius: 10, overflow: 'hidden' }}>
                      {([
                        { label: 'ROI Total', sub: '(Venta + FCF) ÷ cuota inicial', val: cuotaInicialdUSD > 0 ? `${(((gananciaVsInversion + totalFlujosCaja) / cuotaInicialdUSD) * 100).toFixed(1)}%` : 'N/A', good: (gananciaVsInversion + totalFlujosCaja) >= 0 },
                        { label: 'TIR Anualizada', sub: 'Sobre equity · flujos + salida', val: tirPct !== null ? `${tirPct.toFixed(2)}%` : 'N/A', good: (tirPct ?? 0) >= 6 },
                        { label: 'MOIC', sub: '(Net proceeds + FCF) ÷ equity', val: moic !== null ? `${moic.toFixed(2)}x` : 'N/A', good: (moic ?? 0) >= 1.5 },
                      ] as {label:string;sub:string;val:string;good:boolean}[]).map((k, i) => (
                        <div key={k.label} style={{ background: i === 1 ? T.sand : T.card, padding: '16px 20px' }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>{k.label}</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: k.good ? T.teal : T.coral, letterSpacing: '-0.02em' }}>{k.val}</div>
                          <div style={{ fontSize: 9, color: T.textSec, marginTop: 4 }}>{k.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CDT comparison — Sotheby's style */}
                <div style={{ ...cardStyle(), padding: 28 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, borderBottom: `1px solid ${T.border}`, paddingBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 4 }}>Análisis comparativo</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>Activo Físico GLP · Panamá&ensp;vs.&ensp;CDT Colombia</div>
                    </div>
                    <div style={{ fontSize: 10, color: T.textSec, letterSpacing: '0.04em' }}>Horizonte {calcPlazo} años</div>
                  </div>

                  {/* Comparison table */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 24 }}>

                    {/* GLP column */}
                    <div style={{ paddingRight: 28, borderRight: `1px solid ${T.borderLight}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 16 }}>Inversión GLP · Panamá</div>
                      {([
                        { label: 'Capital desembolsado (cuota inicial)', val: usd(Math.round(cuotaInicialdUSD)) },
                        { label: 'ROI anual sobre equity', val: `${roiEquity.toFixed(2)}%` },
                        { label: `Valor del activo al año ${calcPlazo}`, val: usd(Math.round(valorFuturo)) },
                        { label: 'Deuda remanente al final', val: usd(Math.round(deudaFinal)) },
                        { label: 'FCF acumulado (flujos reales)', val: usd(Math.round(fcfAcumulado)) },
                      ]).map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${T.borderLight}` }}>
                          <span style={{ fontSize: 11, color: T.textSec, maxWidth: '55%', lineHeight: 1.3 }}>{r.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{r.val}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.text, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Patrimonio neto final</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{usd(Math.round(patrimonioNetoGLP))}</span>
                      </div>
                      <div style={{ textAlign: 'right' as const, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: T.textSec, fontStyle: 'italic' }}>
                          {gananciaNetaGLP >= 0 ? '+' : ''}{usd(Math.round(gananciaNetaGLP))} sobre capital inicial
                        </span>
                      </div>
                    </div>

                    {/* CDT column */}
                    <div style={{ paddingLeft: 28 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 16 }}>CDT Tradicional · Colombia</div>
                      {([
                        { label: 'Capital equivalente (USD)', val: usd(Math.round(cuotaInicialdUSD)) },
                        { label: 'Tasa nominal E.A.', val: `${cdtRate}% COP` },
                        { label: 'Devaluación COP/USD histórica', val: `−${cdtDevaluation}% anual` },
                        { label: 'Retorno real ajustado en USD', val: `${cdtRealRate}% anual` },
                        { label: 'Apreciación del capital', val: 'Ninguna' },
                      ]).map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${T.borderLight}` }}>
                          <span style={{ fontSize: 11, color: T.textSec, maxWidth: '55%', lineHeight: 1.3 }}>{r.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{r.val}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.text, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Valor liquidativo final</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{usd(Math.round(cdtFutureValue))}</span>
                      </div>
                      <div style={{ textAlign: 'right' as const, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: T.textSec, fontStyle: 'italic' }}>
                          +{usd(Math.round(cdtFutureValue - cuotaInicialdUSD))} sobre capital inicial
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Differential strip */}
                  <div style={{ padding: '14px 20px', background: T.sand, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: T.textSec, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 3 }}>Diferencial patrimonial a {calcPlazo} años</div>
                        <div style={{ fontSize: 10, color: T.textSec, lineHeight: 1.5, maxWidth: 500 }}>
                          El CDT en COP expone el capital a la devaluación histórica del peso (~{cdtDevaluation}% anual). El activo en Panamá preserva el patrimonio en USD, genera renta en moneda fuerte y captura plusvalía inmobiliaria real.
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' as const, flexShrink: 0, paddingLeft: 24 }}>
                        <div style={{ fontSize: 9, color: T.textSec, letterSpacing: '0.06em', marginBottom: 3, textTransform: 'uppercase' as const }}>Ventaja GLP</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>
                          {diferencialVsCDT >= 0 ? '+' : ''}{usd(Math.round(diferencialVsCDT))}
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
  // RENDER BACKUPS
  // ══════════════════════════════════════════════════════════════
  const renderBackups = () => {
    const [gitStatus, setGitStatus] = React.useState<'idle'|'loading'|'ok'|'sin_cambios'|'error'>('idle');
    const [gitMsg, setGitMsg] = React.useState('');
    const [gitCommitNote, setGitCommitNote] = React.useState('');
    const [gitHistorial, setGitHistorial] = React.useState<{hash:string;subject:string;date:string}[]>([]);
    const [historialLoaded, setHistorialLoaded] = React.useState(false);

    const handleGitBackup = async () => {
      setGitStatus('loading');
      setGitMsg('');
      try {
        const res = await fetch('http://localhost:3001/api/backup/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensaje: gitCommitNote }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error desconocido');
        if (data.sin_cambios) {
          setGitStatus('sin_cambios');
          setGitMsg(`Sin cambios nuevos. Último commit: ${data.ultimo_commit?.hash} — ${data.ultimo_commit?.subject}`);
        } else {
          setGitStatus('ok');
          setGitMsg(`✅ Guardado en GitHub: ${data.commit?.hash} — ${data.commit?.subject}`);
          setGitCommitNote('');
          loadHistorial();
        }
      } catch (err: any) {
        setGitStatus('error');
        setGitMsg(err.message || 'No se pudo conectar con el servidor.');
      }
    };

    const loadHistorial = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/backup/historial');
        const data = await res.json();
        if (data.success) { setGitHistorial(data.commits); setHistorialLoaded(true); }
      } catch {}
    };

    React.useEffect(() => { loadHistorial(); }, []);

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

    const gitStatusColor = { idle:'#6B7280', loading:'#F59E0B', ok:'#10B981', sin_cambios:'#6B7280', error:'#EF4444' }[gitStatus];
    const gitStatusLabel = { idle:'Listo', loading:'Guardando...', ok:'Guardado', sin_cambios:'Sin cambios', error:'Error' }[gitStatus];

    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: T.teal, margin: 0, fontFamily: 'Playfair Display, serif' }}>
            Backups y Restauración
          </h2>
        </div>

        {/* ── GITHUB BACKUP ── */}
        <div style={{ ...cardStyle({ padding: 32 }), marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>🐙</span>
            <h3 style={{ fontSize: 18, color: T.teal, margin: 0 }}>Guardar en GitHub</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: gitStatusColor, background: `${gitStatusColor}18`, padding: '3px 10px', borderRadius: 20, letterSpacing: 1 }}>
              {gitStatusLabel}
            </span>
          </div>
          <p style={{ color: T.textSec, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            Sube todos los archivos del CRM al repositorio GitHub <strong>armandohortua-design/mercadeo-glp-bogota</strong>. El servidor debe estar corriendo en el equipo.
          </p>
          <input
            type="text"
            value={gitCommitNote}
            onChange={e => setGitCommitNote(e.target.value)}
            placeholder="Nota del backup (opcional) — ej: 'Ajuste de roles y fotos de agentes'"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: 13, border: `1px solid ${T.borderLight}`, borderRadius: 6, marginBottom: 16, fontFamily: 'inherit', background: '#FAFAFA' }}
          />
          <button
            onClick={handleGitBackup}
            disabled={gitStatus === 'loading'}
            style={{ ...btnPrimary({ padding: '12px 28px', fontSize: 14 }), opacity: gitStatus === 'loading' ? 0.6 : 1, cursor: gitStatus === 'loading' ? 'wait' : 'pointer' }}
          >
            {gitStatus === 'loading' ? '⏳ Guardando en GitHub...' : '🚀 Guardar en GitHub ahora'}
          </button>

          {gitMsg && (
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 6, fontSize: 13, background: gitStatus === 'error' ? '#FEF2F2' : '#F0FDF4', color: gitStatus === 'error' ? '#991B1B' : '#166534', border: `1px solid ${gitStatus === 'error' ? '#FECACA' : '#BBF7D0'}` }}>
              {gitMsg}
            </div>
          )}

          {/* Historial de commits */}
          {historialLoaded && gitHistorial.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textSec, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Historial de backups</div>
              {gitHistorial.map((c, i) => (
                <div key={c.hash} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: i < gitHistorial.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.coral, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{c.hash}</span>
                  <span style={{ fontSize: 12, color: T.text, flex: 1 }}>{c.subject}</span>
                  <span style={{ fontSize: 11, color: T.textSec, flexShrink: 0, whiteSpace: 'nowrap' }}>{c.date?.slice(0,10)}</span>
                </div>
              ))}
            </div>
          )}
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

  // ══════════════════════════════════════════════════════════════
  // CATÁLOGO DE PROYECTOS — CARGA Y EDICIÓN
  // ══════════════════════════════════════════════════════════════
  const [catalogProjects, setCatalogProjects] = useState<ProjectData[]>([...PROJECTS]);
  const [catalogEditIdx, setCatalogEditIdx] = useState<number | null>(null);
  const [catalogFilter, setCatalogFilter] = useState('all');
  const [catalogTab, setCatalogTab] = useState<'tabla' | 'tarjetas'>('tabla');
  const [catalogSort, setCatalogSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'name', dir: 'asc' });

  const renderCatalogo = () => {
    const cats = ['all', 'Proyecto de Ciudad', 'Ocean Reef Islands', 'Playa Caracol'];
    const sortFields: { value: string; label: string }[] = [
      { value: 'name',        label: 'Proyecto' },
      { value: 'category',    label: 'Categoría' },
      { value: 'tipo',        label: 'Tipo' },
      { value: 'areaMin',     label: 'Área m²' },
      { value: 'minPrice',    label: 'Rango Precio' },
      { value: 'bedrooms',    label: 'Rec.' },
      { value: 'entrega',     label: 'Entrega' },
      { value: 'capRateMin',  label: 'Cap Rate' },
    ];
    const base = catalogFilter === 'all' ? catalogProjects : catalogProjects.filter(p => p.category === catalogFilter);
    const filtered = [...base].sort((a, b) => {
      const f = catalogSort.field as keyof ProjectData;
      const av = a[f] ?? '';
      const bv = b[f] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return catalogSort.dir === 'asc' ? cmp : -cmp;
    });
    const catColors: Record<string, string> = { 'Proyecto de Ciudad': T.teal, 'Ocean Reef Islands': T.sky, 'Playa Caracol': T.palm };

    const handleImgUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const updated = [...catalogProjects];
        updated[idx] = { ...updated[idx], imagen: ev.target?.result as string };
        setCatalogProjects(updated);
      };
      reader.readAsDataURL(file);
    };

    const handleExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      import('xlsx').then(XLSX => {
        const reader = new FileReader();
        reader.onload = ev => {
          const wb = XLSX.read(ev.target?.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(ws);
          if (rows.length === 0) { alert('El Excel está vacío o no tiene el formato esperado.'); return; }
          const imported: ProjectData[] = rows.map((r: any) => ({
            name: r['Proyecto'] || r['nombre'] || '',
            category: r['Categoría'] || r['categoria'] || 'Proyecto de Ciudad',
            tipo: r['Tipo'] || r['tipo'] || 'Residencia',
            zone: r['Ubicación'] || r['ubicacion'] || '',
            zoneShort: r['Proyecto'] || '',
            investorType: r['investorType'] || 'renta',
            entrega: r['Fechas Estimada de Entrega'] || r['entrega'] || '',
            minPrice: Number(String(r['Rango de Precios'] || '0').replace(/[^0-9]/g, '').slice(0, 7)) || 0,
            maxPrice: Number(String(r['Rango de Precios'] || '0').replace(/[^0-9]/g, '').slice(-7)) || 0,
            areaMin: Number(String(r['Rango de Area (m2)'] || '0').split('-')[0].replace(/[^0-9]/g, '')) || 0,
            areaMax: Number(String(r['Rango de Area (m2)'] || '0').split('-').pop()?.replace(/[^0-9]/g, '')) || 0,
            bedrooms: String(r['Recamaras'] || r['recamaras'] || ''),
            capRateMin: 5.5, capRateMax: 7.5, vacancyDef: 8,
            rentSuggest: 1000, rentM2Min: 9, rentM2Max: 13,
            condominioMes: 250, appreciationDef: 4.0,
            appreciationNote: 'Datos importados desde Excel. Actualice las notas de valorización.',
            amenities: [], construction: r['Fechas Estimada de Entrega'] || '',
            priceM2Min: 0, priceM2Max: 0,
          }));
          setCatalogProjects(prev => {
            const names = new Set(imported.map(p => p.name));
            return [...prev.filter(p => !names.has(p.name)), ...imported];
          });
          alert(`${imported.length} proyectos importados correctamente.`);
        };
        reader.readAsBinaryString(file);
      });
    };

    const handlePdfView = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
    };

    const saveEdit = (idx: number, updated: ProjectData) => {
      const list = [...catalogProjects];
      list[idx] = updated;
      setCatalogProjects(list);
      setCatalogEditIdx(null);
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Carga de Catálogo de Proyectos</div>
            <div style={{ fontSize: 12, color: T.textSec }}>{catalogProjects.length} proyectos · {cats.slice(1).map(c => `${catalogProjects.filter(p=>p.category===c).length} ${c}`).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: T.teal, color: T.card, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              📊 Importar Excel
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleExcel} />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: T.coral, color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              📄 Ver PDF
              <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfView} />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={catalogSort.field}
                onChange={e => setCatalogSort(s => ({ ...s, field: e.target.value }))}
                style={{ padding: '7px 10px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12, background: T.card, color: T.text, cursor: 'pointer' }}
              >
                {sortFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <button
                onClick={() => setCatalogSort(s => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
                style={{ padding: '7px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, background: T.card, color: T.teal, cursor: 'pointer', fontWeight: 700 }}
                title={catalogSort.dir === 'asc' ? 'Ascendente' : 'Descendente'}
              >
                {catalogSort.dir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
            <button onClick={() => setCatalogTab(catalogTab === 'tabla' ? 'tarjetas' : 'tabla')} style={{ padding: '8px 14px', background: T.sand, border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.text }}>
              {catalogTab === 'tabla' ? 'Ver Tarjetas' : 'Ver Tabla'}
            </button>
          </div>
        </div>

        {/* Filtro por categoría */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCatalogFilter(c)} style={{ padding: '5px 14px', borderRadius: 16, border: `1px solid ${c === 'all' ? T.teal : catColors[c] || T.teal}`, background: catalogFilter === c ? (c === 'all' ? T.teal : catColors[c]) : 'transparent', color: catalogFilter === c ? '#fff' : T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {c === 'all' ? 'Todos' : c} {c !== 'all' && `(${catalogProjects.filter(p=>p.category===c).length})`}
            </button>
          ))}
        </div>

        {catalogTab === 'tabla' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.teal, color: '#fff' }}>
                  {['Imagen', 'Proyecto', 'Categoría', 'Tipo', 'Área m²', 'Rango Precio', 'Rec.', 'Entrega', 'Cap Rate', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, idx) => {
                  const realIdx = catalogProjects.indexOf(p);
                  const isEditing = catalogEditIdx === realIdx;
                  return isEditing ? (
                    <tr key={p.name} style={{ background: '#FFFBEB', borderBottom: `1px solid ${T.border}` }}>
                      <td colSpan={10} style={{ padding: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                          {[
                            { label: 'Nombre', key: 'name' }, { label: 'Categoría', key: 'category' },
                            { label: 'Tipo', key: 'tipo' }, { label: 'Zona', key: 'zone' },
                            { label: 'Entrega', key: 'entrega' }, { label: 'Rec.', key: 'bedrooms' },
                            { label: 'Área Min m²', key: 'areaMin' }, { label: 'Área Max m²', key: 'areaMax' },
                            { label: 'Precio Min USD', key: 'minPrice' }, { label: 'Precio Max USD', key: 'maxPrice' },
                            { label: 'Cap Rate Min %', key: 'capRateMin' }, { label: 'Cap Rate Max %', key: 'capRateMax' },
                          ].map(f => (
                            <div key={f.key}>
                              <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>{f.label}</div>
                              <input defaultValue={(p as any)[f.key]} onChange={e => { (p as any)[f.key] = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value); }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11 }} />
                            </div>
                          ))}
                          <div>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Nota Valorización</div>
                            <textarea defaultValue={p.appreciationNote} onChange={e => { p.appreciationNote = e.target.value; }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, minHeight: 60 }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Imagen del proyecto</div>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: T.sky, color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                              📷 Subir imagen
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImgUpload(realIdx, e)} />
                            </label>
                            {p.imagen && <img src={p.imagen} alt="" style={{ marginTop: 6, height: 50, borderRadius: 4, objectFit: 'cover' }} />}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button onClick={() => saveEdit(realIdx, p)} style={{ padding: '6px 16px', background: T.teal, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Guardar</button>
                          <button onClick={() => setCatalogEditIdx(null)} style={{ padding: '6px 16px', background: T.borderLight, color: T.text, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.name} style={{ borderBottom: `1px solid ${T.borderLight}`, background: realIdx % 2 === 0 ? T.card : T.bg }}>
                      <td style={{ padding: '8px 12px' }}>
                        {p.imagen
                          ? <img src={p.imagen} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                          : <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: T.borderLight, borderRadius: 4, cursor: 'pointer', fontSize: 10, color: T.textSec }}>
                              📷
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImgUpload(realIdx, e)} />
                            </label>
                        }
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>{p.name}</td>
                      <td style={{ padding: '8px 12px' }}><span style={{ background: `${catColors[p.category] || T.teal}22`, color: catColors[p.category] || T.teal, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{p.category}</span></td>
                      <td style={{ padding: '8px 12px', fontSize: 11, color: T.textSec }}>{p.tipo}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{p.areaMin}–{p.areaMax} m²</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: T.palm }}>${(p.minPrice/1000).toFixed(0)}K–${(p.maxPrice/1000).toFixed(0)}K</td>
                      <td style={{ padding: '8px 12px' }}>{p.bedrooms}</td>
                      <td style={{ padding: '8px 12px', fontSize: 11 }}>{p.entrega}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{p.capRateMin}–{p.capRateMax}%</td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => setCatalogEditIdx(realIdx)} style={{ padding: '4px 10px', background: T.sky, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Editar</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map((p, idx) => {
              const realIdx = catalogProjects.indexOf(p);
              return (
                <div key={p.name} style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', background: T.card }}>
                  <div style={{ position: 'relative', height: 140, background: T.sand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.imagen
                      ? <img src={p.imagen} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ fontSize: 40, opacity: 0.2 }}>🏢</div>
                    }
                    <span style={{ position: 'absolute', top: 8, left: 8, background: catColors[p.category] || T.teal, color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>{p.category}</span>
                    <label style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10 }}>
                      📷 Cambiar foto
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImgUpload(realIdx, e)} />
                    </label>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: T.text, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: T.textSec, marginBottom: 8 }}>{p.zoneShort}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                      <div style={{ fontSize: 11 }}><span style={{ color: T.textSec }}>Precio:</span> <b style={{ color: T.palm }}>${(p.minPrice/1000).toFixed(0)}K–${(p.maxPrice/1000).toFixed(0)}K</b></div>
                      <div style={{ fontSize: 11 }}><span style={{ color: T.textSec }}>Área:</span> <b>{p.areaMin}–{p.areaMax} m²</b></div>
                      <div style={{ fontSize: 11 }}><span style={{ color: T.textSec }}>Rec.:</span> <b>{p.bedrooms}</b></div>
                      <div style={{ fontSize: 11 }}><span style={{ color: T.textSec }}>Cap Rate:</span> <b style={{ color: T.teal }}>{p.capRateMin}–{p.capRateMax}%</b></div>
                    </div>
                    <div style={{ fontSize: 10, color: T.textSec, background: T.bg, padding: '6px 8px', borderRadius: 6, marginBottom: 10 }}>
                      🗓 {p.entrega}
                    </div>
                    <button onClick={() => { setCatalogEditIdx(realIdx); setCatalogTab('tabla'); }} style={{ width: '100%', padding: '7px', background: T.teal, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Editar proyecto</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 20, padding: 14, background: `${T.teal}10`, borderRadius: 8, border: `1px solid ${T.teal}30`, fontSize: 12, color: T.textSec }}>
          <b style={{ color: T.text }}>Cómo cargar datos:</b>
          <ul style={{ margin: '6px 0 0 16px', lineHeight: 1.8 }}>
            <li><b>Excel (.xlsx):</b> El archivo debe tener columnas: <i>Proyecto, Categoría, Tipo, Ubicación, Rango de Area (m2), Rango de Precios, Recamaras, Fechas Estimada de Entrega</i></li>
            <li><b>Imágenes (.jpg/.png):</b> Clic en el ícono 📷 de cada proyecto para subir su foto de portada</li>
            <li><b>PDF:</b> Se abre en una nueva pestaña del navegador para visualización</li>
          </ul>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER MODULE ROUTER
  // ══════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════
  // MODULE: CONFIGURACIÓN (antes "Clave y Seguridad")
  // ══════════════════════════════════════════════════════════════
  const renderConfiguracion = () => {
    const totalPct = commissionEntities.reduce((s, e) => s + e.pct, 0);

    return (
      <div>
        {sectionTitle('Configuración del Sistema')}

        {/* ── SEGURIDAD Y ACCESO ── */}
        <div style={{ ...cardStyle(), marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={16} color={T.teal} /> Seguridad y Acceso
          </div>
          <CRMAcceso currentUser={currentUser || ''} />
        </div>

        {/* ── ESTRUCTURA DE COMISIONES ── */}
        <div style={{ ...cardStyle(), marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="currency" size={16} color={T.teal} /> Estructura de Comisiones
          </div>
          <div style={{ fontSize: 12, color: T.textSec, marginBottom: 16 }}>
            Define el porcentaje total y la distribución por entidad. Total actual: <strong style={{ color: totalPct === 5 ? T.success : T.danger }}>{totalPct}%</strong>
            {totalPct !== 5 && <span style={{ color: T.danger, marginLeft: 8 }}>⚠ El total debe sumar 5%</span>}
          </div>

          {/* Tarjetas de entidades */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            {commissionEntities.map((ent, idx) => (
              <div key={idx} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input
                    value={ent.name}
                    onChange={e => setCommissionEntities(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                    style={{ ...inputStyle({ fontSize: 12, padding: '4px 8px' }), fontWeight: 600, flex: 1, marginRight: 8 }}
                  />
                  <button onClick={() => setCommissionEntities(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'transparent', border: 'none', color: T.danger, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontWeight: 700 }}>×</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" min={0} max={10} step={0.5}
                    value={ent.pct}
                    onChange={e => setCommissionEntities(prev => prev.map((x, i) => i === idx ? { ...x, pct: Number(e.target.value) } : x))}
                    style={{ ...inputStyle({ fontSize: 22, fontWeight: 700, textAlign: 'center', padding: '4px' }), width: 64 }}
                  />
                  <span style={{ fontSize: 20, fontWeight: 700, color: T.teal }}>%</span>
                  <div style={{ flex: 1, height: 6, background: T.borderLight, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(ent.pct / totalPct) * 100}%`, height: '100%', background: T.teal }} />
                  </div>
                </div>
              </div>
            ))}

            {/* Botón agregar entidad */}
            <button
              onClick={() => setCommissionEntities(prev => [...prev, { name: 'Nueva Entidad', pct: 0 }])}
              style={{ background: 'transparent', border: `2px dashed ${T.border}`, borderRadius: 10, padding: '14px 16px', color: T.textSec, fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              + Agregar entidad
            </button>
          </div>

          {/* Resumen total */}
          <div style={{ background: totalPct === 5 ? `${T.success}10` : `${T.danger}10`, border: `1px solid ${totalPct === 5 ? T.success : T.danger}30`, borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Total distribución de comisión</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: totalPct === 5 ? T.success : T.danger }}>{totalPct}%</span>
          </div>
        </div>

        {/* ── PARÁMETROS GENERALES ── */}
        <div style={{ ...cardStyle(), marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="key" size={16} color={T.teal} /> Parámetros Generales del CRM
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12 }}>
            {[
              { label: 'Tenant ID', value: 'tenant-glp-001' },
              { label: 'Moneda base', value: 'USD' },
              { label: 'País de operación principal', value: 'Panamá' },
              { label: 'Modelo IA activo', value: 'gpt-4o-mini' },
            ].map(param => (
              <div key={param.label} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: T.textSec, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{param.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: 'monospace' }}>{param.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BACKUPS Y RESTAURACIÓN ── */}
        <div style={{ ...cardStyle() }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="backup" size={16} color={T.teal} /> Backups y Restauración
          </div>
          {renderBackups()}
        </div>
      </div>
    );
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'portafolio': return renderPortafolio();
      case 'catalogo': return renderCatalogo();
      case 'kpis': return renderKPIs();
      case 'brokers': return renderBrokers();
      case 'prospectos': return renderProspectos();
      case 'eventos': return renderEventos();
      case 'agentes': return renderAgentes();
      case 'faqs': return renderFAQs();
      case 'calculadora': return renderCalculadora();
      case 'configuracion': return renderConfiguracion();
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="lock" size={14} color="#E02424" /> Cerrar Sesión</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', padding: '4px 12px', borderRadius: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 6px #10B981' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.card }}>IA Activa</span>
            </div>
            <a href="/" style={{ fontSize: 13, color: T.card, textDecoration: 'none', fontWeight: 600, opacity: 0.9 }}>
              Volver a Landing →
            </a>
          </div>
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
