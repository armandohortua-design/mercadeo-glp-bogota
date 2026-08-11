import { API_ROOT } from './apiRoot';

// Fuente única de verdad para fotos de proyecto: la tabla `projects` en la base de
// datos (la misma que usan Catálogo y Portafolio en el CRM). Antes la Landing tenía
// su propio diccionario estático (PROJECT_IMG) desalineado del CRM — esto lo reemplaza
// en tiempo de ejecución, manteniendo PROJECT_IMG solo como fallback si el fetch falla.

type LiveImageEntry = { main: string | null; gallery: string[] };
type LiveImages = Record<string, LiveImageEntry>;

let cache: LiveImages | null = null;
let inflight: Promise<LiveImages> | null = null;

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

export function fetchLiveProjectImages(): Promise<LiveImages> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch(`${API_ROOT}/api/projects`)
    .then(res => res.json())
    .then((data: any[]) => {
      const map: LiveImages = {};
      if (Array.isArray(data)) {
        data.forEach(p => {
          // Se registra el proyecto si tiene portada O galería — antes exigía portada,
          // así que un proyecto con solo galería subida (sin portada) se descartaba
          // por completo y caía al respaldo estático (bug reportado con The Tides).
          const galeria = Array.isArray(p?.galeria) ? p.galeria : [];
          if (p?.name && (p?.imagen || galeria.length > 0)) {
            map[normalize(p.name)] = { main: p.imagen || null, gallery: galeria };
          }
        });
      }
      cache = map;
      return map;
    })
    .catch(e => {
      console.error('Error cargando fotos de proyectos en vivo (usando fallback estático):', e);
      cache = {};
      return cache;
    });
  return inflight;
}

// Devuelve { main, gallery } combinando la foto en vivo (si existe) con la galería
// estática de respaldo. La galería subida desde el Catálogo del CRM (campo `galeria`
// en la BD) tiene prioridad; si el proyecto aún no tiene fotos de galería propias,
// se usa la galería estática de projectsData.ts como respaldo. La portada usa la real
// si existe, o la primera foto de galería, o la portada estática como último recurso.
export function getImageFor(
  name: string,
  fallback?: { main: string; gallery: string[] }
): { main: string; gallery: string[] } | undefined {
  const live = cache?.[normalize(name)];
  if (live) {
    const gallery = live.gallery.length > 0 ? live.gallery : (fallback?.gallery?.length ? fallback.gallery : (live.main ? [live.main] : []));
    const main = live.main || gallery[0] || fallback?.main;
    if (!main) return fallback;
    return { main, gallery };
  }
  return fallback;
}
