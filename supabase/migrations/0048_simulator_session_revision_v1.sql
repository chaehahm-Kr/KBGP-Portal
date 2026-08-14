-- Migration: Add Session & Revision Architecture columns to simulation_results
ALTER TABLE public.simulation_results
  ADD COLUMN IF NOT EXISTS simulation_code TEXT,
  ADD COLUMN IF NOT EXISTS base_simulation_id UUID REFERENCES public.simulation_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision_no INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;

-- Create indexes for fast Session & Revision lookup and Admin Latest filtering
CREATE INDEX IF NOT EXISTS idx_simulation_results_code ON public.simulation_results (simulation_code);
CREATE INDEX IF NOT EXISTS idx_simulation_results_base_id ON public.simulation_results (base_simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_latest ON public.simulation_results (is_latest) WHERE is_latest = TRUE;
