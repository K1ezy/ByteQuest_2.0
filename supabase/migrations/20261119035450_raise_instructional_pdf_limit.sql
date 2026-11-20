UPDATE storage.buckets
SET file_size_limit = 50 * 1024 * 1024
WHERE id = 'bytequest-instructional-pdfs';

UPDATE public.platform_settings
SET label = 'PDF upload size limit (MiB)',
    value = CASE WHEN value = '10'::jsonb THEN '50'::jsonb ELSE value END
WHERE key = 'pdf_upload_max_mb';
