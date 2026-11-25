ALTER TABLE public.workshops
    ADD COLUMN cover_image varchar(160),
    ADD CONSTRAINT workshops_cover_image_local_asset
        CHECK (cover_image IS NULL OR cover_image ~ '^/workshop-covers/[a-z0-9][a-z0-9-]*[.]webp$');
