-- Importa Flow - Storage buckets e políticas
-- Nota: criação de buckets pode ser feita pelo Dashboard (Storage) ou via API.
-- Aqui estão as políticas SQL para os buckets (executar após criar os buckets pelo Dashboard ou MCP).

-- Inserir buckets via SQL (Supabase permite isso em algumas versões)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('product-images', 'product-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('importadora-logos', 'importadora-logos', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']),
  ('media', 'media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Políticas Storage: leitura pública, escrita apenas authenticated

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

CREATE POLICY "avatars_authenticated_write" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'product-images');

CREATE POLICY "product_images_authenticated_write" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "importadora_logos_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'importadora-logos');

CREATE POLICY "importadora_logos_authenticated_write" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'importadora-logos') WITH CHECK (bucket_id = 'importadora-logos');

CREATE POLICY "media_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'media');

CREATE POLICY "media_authenticated_write" ON storage.objects
  FOR ALL TO authenticated USING (bucket_id = 'media') WITH CHECK (bucket_id = 'media');
