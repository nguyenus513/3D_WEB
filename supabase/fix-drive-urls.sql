-- Fix Google Drive image URLs in products table
-- Changes old drive.google.com URLs to lh3.googleusercontent.com format

-- First, let's see what we have
SELECT id, name, images FROM products WHERE images IS NOT NULL LIMIT 5;

-- Update products table - fix URL format in images JSONB array
-- This updates the 'url' field in each image object

-- Function to extract fileId from old URL and create new URL
-- Old format: https://drive.google.com/uc?export=view&id=XXXX
-- New format: https://lh3.googleusercontent.com/d/XXXX

UPDATE products
SET images = (
    SELECT jsonb_agg(
        CASE 
            WHEN img->>'url' LIKE 'https://drive.google.com/%' THEN
                jsonb_set(
                    jsonb_set(
                        img,
                        '{url}',
                        to_jsonb('https://lh3.googleusercontent.com/d/' || 
                            COALESCE(
                                -- Extract ID from uc?export=view&id=XXX
                                regexp_replace(img->>'url', '.*[?&]id=([^&]+).*', '\1'),
                                -- Extract ID from thumbnail?id=XXX
                                regexp_replace(img->>'url', '.*[?&]id=([^&]+).*', '\1')
                            )
                        )
                    ),
                    '{thumbnail}',
                    to_jsonb('https://lh3.googleusercontent.com/d/' || 
                        COALESCE(
                            regexp_replace(img->>'url', '.*[?&]id=([^&]+).*', '\1'),
                            regexp_replace(img->>'url', '.*[?&]id=([^&]+).*', '\1')
                        ) || '=w400'
                    )
                )
            ELSE img
        END
    )
    FROM jsonb_array_elements(products.images) AS img
)
WHERE images IS NOT NULL 
  AND images::text LIKE '%drive.google.com%';

-- Verify changes
SELECT id, name, images FROM products WHERE images IS NOT NULL LIMIT 5;
