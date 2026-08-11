import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const TENANT_ID = 'tenant-glp-001';
export const BUCKET = 'glp-assets';

// Sube un archivo a Supabase Storage en una ruta arbitraria dentro del bucket del tenant
// y devuelve su URL pública — helper genérico reutilizado por catálogo, legal, etc.
export async function uploadFile(path: string, file: File): Promise<string | null> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error('Upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProjectImage(
  proyectoId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop();
  return uploadFile(`${TENANT_ID}/catalogo/${proyectoId}/portada.${ext}`, file);
}

export async function saveProjectImageUrl(
  proyectoId: string,
  imageUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ imagen_url: imageUrl })
    .eq('id', proyectoId)
    .eq('tenant_id', TENANT_ID);

  if (error) console.error('DB update error:', error.message);
}
