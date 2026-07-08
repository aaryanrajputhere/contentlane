-- Backfill existing scene JSON from videoPrompt to imagePrompt.
-- ScriptGeneration.scenes is a JSON array, so this preserves scene order and removes the old key.
UPDATE "ScriptGeneration"
SET "scenes" = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(scene) = 'object' THEN
          (scene - 'videoPrompt') ||
          CASE
            WHEN scene ? 'imagePrompt' THEN '{}'::jsonb
            WHEN scene ? 'videoPrompt' THEN jsonb_build_object('imagePrompt', scene->'videoPrompt')
            ELSE '{}'::jsonb
          END
        ELSE scene
      END
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements("ScriptGeneration"."scenes"::jsonb) WITH ORDINALITY AS item(scene, ord)
)
WHERE "scenes"::text LIKE '%videoPrompt%';
