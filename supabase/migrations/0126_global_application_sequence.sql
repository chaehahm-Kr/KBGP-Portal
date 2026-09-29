-- Migration 0126: Global Application Sequence & Business Application Number Counter

CREATE TABLE IF NOT EXISTS public.application_sequence_counter (
  id int PRIMARY KEY DEFAULT 1,
  current_val int NOT NULL DEFAULT 16,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row_app_seq CHECK (id = 1)
);

INSERT INTO public.application_sequence_counter (id, current_val)
VALUES (1, 16)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_application_sequence()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  next_val int;
BEGIN
  UPDATE public.application_sequence_counter
  SET current_val = current_val + 1,
      updated_at = now()
  WHERE id = 1
  RETURNING current_val INTO next_val;

  IF next_val > 9999 THEN
    RAISE EXCEPTION 'Application global sequence limit reached (9999)';
  END IF;

  RETURN next_val;
END;
$$;
