ALTER TABLE public.round_holes
  ADD COLUMN IF NOT EXISTS approach_penalty_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_approach_penalty_type_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_approach_penalty_type_check
      CHECK (
        approach_penalty_type IN ('agua', 'fuera_limites')
        OR approach_penalty_type IS NULL
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS round_holes_round_approach_penalty_idx
  ON public.round_holes (round_id, approach_penalty_type)
  WHERE approach_penalty_type IS NOT NULL;
