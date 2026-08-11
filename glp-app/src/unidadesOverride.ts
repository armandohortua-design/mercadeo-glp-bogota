// Sobrescribe precio/área/recámaras/baños de PROJECTS (la copia estática de marketing en
// projectsData.ts) con los rangos reales calculados desde el inventario unidad-por-unidad
// (tabla `unidades`, alimentada por el importador de Excel del Catálogo del CRM). Si un
// proyecto no tiene unidades cargadas todavía, conserva el valor manual existente.
import { PROJECTS } from './projectsData';
import { API_ROOT } from './apiRoot';

const normalizeProjName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const round1 = (n: number) => Math.round(n * 10) / 10;

let applied = false;

// Muta los objetos de PROJECTS in-place (misma referencia de array/objetos) para que
// cualquier componente que ya tenga `project` en memoria vea los valores nuevos apenas
// se dispare un re-render — mismo patrón que ya usa este archivo para fotos en vivo
// (fetchLiveProjectImages + tick de re-render).
export async function applyUnidadesToProjects(): Promise<boolean> {
  if (applied) return false;
  try {
    const res = await fetch(`${API_ROOT}/api/unidades`, { headers: { 'x-tenant-id': 'tenant-glp-001' } });
    if (!res.ok) return false;
    const rows: any[] = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return false;

    type Agg = { precioMin: number; areaMin: number; areaMax: number; recMin: number; recMax: number; banMin: number; banMax: number; count: number };
    const agg: Record<string, Agg> = {};
    rows.forEach(u => {
      const key = normalizeProjName(u.proyecto || '');
      if (!key) return;
      if (!agg[key]) agg[key] = { precioMin: Infinity, areaMin: Infinity, areaMax: -Infinity, recMin: Infinity, recMax: -Infinity, banMin: Infinity, banMax: -Infinity, count: 0 };
      const a = agg[key];
      a.count++;
      if (u.precioFinal != null) a.precioMin = Math.min(a.precioMin, u.precioFinal);
      if (u.areaTotal != null) { a.areaMin = Math.min(a.areaMin, u.areaTotal); a.areaMax = Math.max(a.areaMax, u.areaTotal); }
      if (u.recamaras != null) { a.recMin = Math.min(a.recMin, u.recamaras); a.recMax = Math.max(a.recMax, u.recamaras); }
      if (u.banos != null) { a.banMin = Math.min(a.banMin, u.banos); a.banMax = Math.max(a.banMax, u.banos); }
    });

    let anyChange = false;
    PROJECTS.forEach(p => {
      const a = agg[normalizeProjName(p.name)];
      if (!a || a.count === 0) return;
      anyChange = true;
      if (Number.isFinite(a.precioMin)) p.price = a.precioMin;
      if (Number.isFinite(a.areaMin) && Number.isFinite(a.areaMax)) {
        p.area = a.areaMin === a.areaMax ? `${round1(a.areaMin)} m²` : `${round1(a.areaMin)}-${round1(a.areaMax)} m²`;
      }
      if (Number.isFinite(a.recMin)) {
        const recLabel = a.recMin === a.recMax ? `${a.recMin} rec.` : `${a.recMin}-${a.recMax} rec.`;
        const banLabel = Number.isFinite(a.banMin) ? (a.banMin === a.banMax ? ` · ${a.banMin} baños` : ` · ${a.banMin}-${a.banMax} baños`) : '';
        p.beds = recLabel + banLabel;
      }
    });

    applied = true;
    return anyChange;
  } catch {
    return false;
  }
}
