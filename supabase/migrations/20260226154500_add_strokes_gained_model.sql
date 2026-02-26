ALTER TABLE public.round_holes
  ADD COLUMN IF NOT EXISTS approach_lie text,
  ADD COLUMN IF NOT EXISTS sg_off_tee numeric(6, 3),
  ADD COLUMN IF NOT EXISTS sg_approach numeric(6, 3),
  ADD COLUMN IF NOT EXISTS sg_short_game numeric(6, 3),
  ADD COLUMN IF NOT EXISTS sg_putting numeric(6, 3),
  ADD COLUMN IF NOT EXISTS sg_total numeric(6, 3),
  ADD COLUMN IF NOT EXISTS sg_confidence text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS sg_model_version text NOT NULL DEFAULT 'v1_bucket_proxy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_approach_lie_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_approach_lie_check
      CHECK (approach_lie IN ('fairway', 'rough', 'bunker', 'recovery') OR approach_lie IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_sg_confidence_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_sg_confidence_check
      CHECK (sg_confidence IN ('low', 'medium', 'high'));
  END IF;
END
$$;
