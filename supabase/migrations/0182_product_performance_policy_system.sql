-- Migration: 0182_product_performance_policy_system.sql
-- Task ID: ADM-SALES-PERF-005-R3
-- Description: Product Performance Settings V1.0 — Policy Architecture, Audit Logging, and Historical Evaluations
-- Note: Do NOT execute in Production without explicit Owner authorization.

-- 1. Create Policy Master Table
CREATE TABLE IF NOT EXISTS public.product_performance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(32) NOT NULL, -- e.g. 'v1.0.0', 'v1.1.0' (generated on publish)
    draft_title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('draft', 'published', 'superseded', 'archived')),
    is_active BOOLEAN NOT NULL DEFAULT false,
    
    -- Effective date boundaries
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    
    -- Evaluation Period (default 60 days)
    evaluation_period_days INT NOT NULL DEFAULT 60 CHECK (evaluation_period_days > 0),
    
    -- Eligibility Criteria (JSONB)
    eligibility_criteria JSONB NOT NULL DEFAULT '{
        "min_operating_history_days": 60,
        "min_completed_orders": 3,
        "min_distinct_stores": 3,
        "require_historical_landed_cost": true,
        "missing_cost_policy": "N/A"
    }'::jsonb,
    
    -- 7 Pillar Dimension Weights (JSONB)
    dimension_weights JSONB NOT NULL DEFAULT '{
        "profitability": 25,
        "sales_performance": 20,
        "inventory_efficiency": 20,
        "exchange_risk": 15,
        "retail_velocity": 10,
        "growth_potential": 5,
        "operational_reliability": 5
    }'::jsonb,
    
    -- Contiguous Grade Bands (JSONB)
    grade_bands JSONB NOT NULL DEFAULT '{
        "A": { "min": 80, "max": 100, "label": "A: 80–100" },
        "B": { "min": 65, "max": 80,  "label": "B: 65–<80" },
        "C": { "min": 50, "max": 65,  "label": "C: 50–<65" },
        "D": { "min": 0,  "max": 50,  "label": "D: 0–<50" }
    }'::jsonb,
    
    -- Automatic Grading Gate (Default: false; locked until scoring normalization approval)
    -- Database CHECK constraint physically prevents accidental or unauthorized grading activation
    automatic_grading_enabled BOOLEAN NOT NULL DEFAULT false CHECK (automatic_grading_enabled = false),
    
    -- Optimistic Concurrency & Audit Metadata
    lock_version INT NOT NULL DEFAULT 1,
    change_summary TEXT,
    created_by UUID REFERENCES auth.users(id),
    published_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    published_at TIMESTAMPTZ
);

-- Partial Unique Index: At most one policy can be active at any given moment
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_performance_policies_active 
ON public.product_performance_policies (is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_product_performance_policies_status 
ON public.product_performance_policies (status, created_at DESC);

-- 2. Create Policy Audit Log Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.product_performance_policy_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES public.product_performance_policies(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL CHECK (action IN ('create_draft', 'update_draft', 'discard_draft', 'publish', 'rollback')),
    actor_id UUID REFERENCES auth.users(id),
    actor_email VARCHAR(255),
    previous_state JSONB,
    new_state JSONB NOT NULL,
    change_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_product_performance_policy_audit_logs_policy 
ON public.product_performance_policy_audit_logs (policy_id, created_at DESC);

-- Audit Log Immutability Trigger
CREATE OR REPLACE FUNCTION public.trg_prevent_policy_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Policy audit log entries are append-only audit records and cannot be deleted.';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Policy audit log entries are append-only audit records and cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_policy_audit_append_only ON public.product_performance_policy_audit_logs;
CREATE TRIGGER trg_policy_audit_append_only
    BEFORE UPDATE OR DELETE ON public.product_performance_policy_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_prevent_policy_audit_mutation();

-- 3. Create Historical Evaluations Snapshot Table (Frozen Historical Reproducibility)
CREATE TABLE IF NOT EXISTS public.product_performance_historical_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.product_performance_policies(id),
    policy_version VARCHAR(32) NOT NULL,
    evaluation_date DATE NOT NULL,
    evaluation_status VARCHAR(32) NOT NULL,
    business_grade VARCHAR(8),
    overall_score NUMERIC(5, 2),
    pillar_scores JSONB,
    metrics_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_historical_evaluations_product_date 
ON public.product_performance_historical_evaluations (product_id, evaluation_date DESC);

-- Historical Evaluations Immutability Trigger
CREATE OR REPLACE FUNCTION public.trg_prevent_historical_eval_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Historical performance evaluations are frozen snapshots and cannot be deleted.';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Historical performance evaluations are frozen snapshots and cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historical_eval_frozen ON public.product_performance_historical_evaluations;
CREATE TRIGGER trg_historical_eval_frozen
    BEFORE UPDATE OR DELETE ON public.product_performance_historical_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_prevent_historical_eval_mutation();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.product_performance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_performance_policy_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_performance_historical_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies for product_performance_policies (Uses canonical public.auth_is_admin() and public.auth_is_super_admin())
DROP POLICY IF EXISTS "Admins and Staff can view policies" ON public.product_performance_policies;
CREATE POLICY "Admins and Staff can view policies"
ON public.product_performance_policies
FOR SELECT
TO authenticated
USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins can insert draft policies" ON public.product_performance_policies;
CREATE POLICY "Admins can insert draft policies"
ON public.product_performance_policies
FOR INSERT
TO authenticated
WITH CHECK (
    public.auth_is_admin()
    AND status = 'draft'
    AND is_active = false
);

DROP POLICY IF EXISTS "Admins can update draft policies" ON public.product_performance_policies;
CREATE POLICY "Admins can update draft policies"
ON public.product_performance_policies
FOR UPDATE
TO authenticated
USING (
    public.auth_is_admin()
    AND (status = 'draft' OR public.auth_is_super_admin())
)
WITH CHECK (
    public.auth_is_admin()
    AND (
        (status = 'draft' AND is_active = false)
        OR public.auth_is_super_admin()
    )
);

-- Policies for audit logs (Append-only)
DROP POLICY IF EXISTS "Admins can view policy audit logs" ON public.product_performance_policy_audit_logs;
CREATE POLICY "Admins can view policy audit logs"
ON public.product_performance_policy_audit_logs
FOR SELECT
TO authenticated
USING (public.auth_is_admin());

DROP POLICY IF EXISTS "Admins can insert policy audit logs" ON public.product_performance_policy_audit_logs;
CREATE POLICY "Admins can insert policy audit logs"
ON public.product_performance_policy_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.auth_is_admin());

-- Policies for historical evaluations (Read-only for Admins)
DROP POLICY IF EXISTS "Admins can view historical evaluations" ON public.product_performance_historical_evaluations;
CREATE POLICY "Admins can view historical evaluations"
ON public.product_performance_historical_evaluations
FOR SELECT
TO authenticated
USING (public.auth_is_admin());

-- 5. Atomic RPC Functions for Safe Publishing and Rollback
CREATE OR REPLACE FUNCTION public.publish_product_performance_policy_atomic(
    p_draft_id UUID,
    p_change_summary TEXT,
    p_actor_id UUID,
    p_actor_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_draft RECORD;
    v_prev_active RECORD;
    v_next_version VARCHAR(32);
    v_published RECORD;
    v_weight_sum NUMERIC;
BEGIN
    -- 1. Security Check: Only Super Admin (Owner) can execute policy publishing
    IF NOT (public.auth_is_super_admin() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin') THEN
        RAISE EXCEPTION 'Forbidden: Only the Owner (Super Admin) is authorized to publish Product Performance evaluation policies.';
    END IF;

    -- 2. Fetch and lock draft record
    SELECT * INTO v_draft
    FROM public.product_performance_policies
    WHERE id = p_draft_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target draft policy % not found.', p_draft_id;
    END IF;

    IF v_draft.status <> 'draft' THEN
        RAISE EXCEPTION 'Only draft policies can be published. Current status: %', v_draft.status;
    END IF;

    -- 3. Validate dimension weights sum to exactly 100
    SELECT COALESCE(SUM((val)::numeric), 0) INTO v_weight_sum
    FROM jsonb_each_text(v_draft.dimension_weights) AS t(key, val);

    IF v_weight_sum <> 100 THEN
        RAISE EXCEPTION 'Pillar weights must sum to exactly 100. Current sum: %', v_weight_sum;
    END IF;

    -- 4. Calculate next version string (v1.x.0)
    SELECT COALESCE(
        'v1.' || (COALESCE(MAX(SPLIT_PART(REPLACE(version, 'v1.', ''), '.', 1)::int), 0) + 1)::text || '.0',
        'v1.1.0'
    ) INTO v_next_version
    FROM public.product_performance_policies
    WHERE status = 'published' AND version LIKE 'v1.%';

    -- 5. Fetch and lock current active policy
    SELECT * INTO v_prev_active
    FROM public.product_performance_policies
    WHERE is_active = true
    FOR UPDATE;

    -- 6. Deactivate current active policy
    IF FOUND THEN
        UPDATE public.product_performance_policies
        SET is_active = false,
            status = 'superseded',
            effective_to = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_prev_active.id;
    END IF;

    -- 7. Activate new policy
    UPDATE public.product_performance_policies
    SET version = v_next_version,
        status = 'published',
        is_active = true,
        effective_from = timezone('utc'::text, now()),
        published_at = timezone('utc'::text, now()),
        published_by = p_actor_id,
        change_summary = TRIM(p_change_summary),
        lock_version = v_draft.lock_version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_draft_id
    RETURNING * INTO v_published;

    -- 8. Append immutable audit log
    INSERT INTO public.product_performance_policy_audit_logs (
        policy_id,
        action,
        actor_id,
        actor_email,
        previous_state,
        new_state,
        change_reason
    ) VALUES (
        p_draft_id,
        'publish',
        p_actor_id,
        p_actor_email,
        CASE WHEN v_prev_active.id IS NOT NULL THEN to_jsonb(v_prev_active) ELSE NULL END,
        to_jsonb(v_published),
        TRIM(p_change_summary)
    );

    RETURN jsonb_build_object(
        'success', true,
        'version', v_next_version,
        'policy_id', p_draft_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_product_performance_policy_atomic(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_product_performance_policy_atomic(UUID, TEXT, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_product_performance_policy_atomic(UUID, TEXT, UUID, TEXT) TO authenticated;

-- 6. Seed Initial Approved Baseline Policy (v1.0.0)
DO $$
DECLARE
    v_active_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.product_performance_policies WHERE is_active = true
    ) INTO v_active_exists;

    IF NOT v_active_exists THEN
        INSERT INTO public.product_performance_policies (
            version,
            draft_title,
            status,
            is_active,
            effective_from,
            evaluation_period_days,
            eligibility_criteria,
            dimension_weights,
            grade_bands,
            automatic_grading_enabled,
            change_summary,
            created_at,
            published_at
        ) VALUES (
            'v1.0.0',
            'Initial Approved Baseline Policy',
            'published',
            true,
            timezone('utc'::text, now()),
            60,
            '{
                "min_operating_history_days": 60,
                "min_completed_orders": 3,
                "min_distinct_stores": 3,
                "require_historical_landed_cost": true,
                "missing_cost_policy": "N/A"
            }'::jsonb,
            '{
                "profitability": 25,
                "sales_performance": 20,
                "inventory_efficiency": 20,
                "exchange_risk": 15,
                "retail_velocity": 10,
                "growth_potential": 5,
                "operational_reliability": 5
            }'::jsonb,
            '{
                "A": { "min": 80, "max": 100, "label": "A: 80–100" },
                "B": { "min": 65, "max": 80,  "label": "B: 65–<80" },
                "C": { "min": 50, "max": 65,  "label": "C: 50–<65" },
                "D": { "min": 0,  "max": 50,  "label": "D: 0–<50" }
            }'::jsonb,
            false,
            'Initial Owner-approved Product Performance V2.0 baseline policy.',
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );
    END IF;
END $$;
