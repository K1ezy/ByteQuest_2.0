-- Public avatar storage bucket.
--
-- Avatars are small images served over the public storage URL so a plain <img>
-- tag can render them without a signed link. Uploads go through the API service
-- key (which bypasses storage RLS); public read is granted by the bucket flag.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'bytequest-avatars',
    'bytequest-avatars',
    true,
    1048576,
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
