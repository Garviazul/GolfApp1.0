ALTER TABLE public.rounds
  DROP COLUMN IF EXISTS holes_planned;

ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rounds_status_check'
      AND conrelid = 'public.rounds'::regclass
  ) THEN
    ALTER TABLE public.rounds
      ADD CONSTRAINT rounds_status_check CHECK (status IN ('in_progress', 'finished'));
  END IF;
END
$$;

UPDATE public.rounds r
SET status = 'finished',
    finished_at = COALESCE(r.finished_at, r.created_at)
WHERE r.status = 'in_progress'
  AND EXISTS (
    SELECT 1
    FROM public.round_holes rh
    WHERE rh.round_id = r.id
      AND rh.score IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.round_holes rh
    WHERE rh.round_id = r.id
      AND rh.score IS NULL
  );
