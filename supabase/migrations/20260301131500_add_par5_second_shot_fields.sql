ALTER TABLE public.round_holes
  ADD COLUMN IF NOT EXISTS tee_miss_detail text,
  ADD COLUMN IF NOT EXISTS second_shot_strategy text,
  ADD COLUMN IF NOT EXISTS second_shot_start_bucket text,
  ADD COLUMN IF NOT EXISTS second_shot_lie text,
  ADD COLUMN IF NOT EXISTS second_shot_result text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_tee_miss_detail_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_tee_miss_detail_check
      CHECK (tee_miss_detail IN ('izquierda', 'derecha', 'corto', 'largo') OR tee_miss_detail IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_second_shot_strategy_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_second_shot_strategy_check
      CHECK (second_shot_strategy IN ('agresivo_green', 'colocar') OR second_shot_strategy IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_second_shot_start_bucket_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_second_shot_start_bucket_check
      CHECK (
        second_shot_start_bucket IN ('>230', '200-230', '170-200', '140-170', '<140')
        OR second_shot_start_bucket IS NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_second_shot_lie_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_second_shot_lie_check
      CHECK (second_shot_lie IN ('fairway', 'rough', 'bunker', 'recovery') OR second_shot_lie IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_second_shot_result_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_second_shot_result_check
      CHECK (
        second_shot_result IN ('green', 'fairway', 'rough', 'bunker', 'recovery', 'penalidad')
        OR second_shot_result IS NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_second_shot_par5_only_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_second_shot_par5_only_check
      CHECK (
        hole_par = 5
        OR (
          second_shot_strategy IS NULL
          AND second_shot_start_bucket IS NULL
          AND second_shot_lie IS NULL
          AND second_shot_result IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'round_holes_second_shot_consistency_check'
      AND conrelid = 'public.round_holes'::regclass
  ) THEN
    ALTER TABLE public.round_holes
      ADD CONSTRAINT round_holes_second_shot_consistency_check
      CHECK (
        second_shot_strategy IS NOT NULL
        OR (
          second_shot_start_bucket IS NULL
          AND second_shot_lie IS NULL
          AND second_shot_result IS NULL
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS round_holes_round_par_gir_idx
  ON public.round_holes (round_id, hole_par, gir);

CREATE INDEX IF NOT EXISTS round_holes_par5_strategy_idx
  ON public.round_holes (round_id, second_shot_strategy)
  WHERE hole_par = 5;
