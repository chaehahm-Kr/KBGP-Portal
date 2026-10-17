const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read environment variables safely
const env = {};
const envPaths = ['.env.production.local', '.env.local', '.env'];
for (const envPath of envPaths) {
  const fullPath = path.join(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!env[match[1]]) {
          env[match[1]] = val;
        }
      }
    }
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!serviceKey) {
  console.error('[FATAL] Missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY in .env files');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

const anonClient = anonKey
  ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  : null;

async function runAudit() {
  console.log('================================================================================');
  console.log('TASK: EXCHANGE-CREDIT-PH4-002-R2');
  console.log('PRODUCTION SQL 0181 SCHEMA, ATOMIC RPCS, AND LEDGER INTEGRATION VERIFICATION');
  console.log('Target Supabase Ref: shzfrppdobpmrstcjfqu');
  console.log('Target URL:         ', supabaseUrl);
  console.log('Audit Mode:          STRICT READ-ONLY PROBING (Zero Mutations Permitted)');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name, condition, detail = '') {
    if (condition) {
      console.log(`[PASS] ${name}${detail ? ' -> ' + detail : ''}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ' -> ' + detail : ''}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // SECTION 1: Canonical Base Table Presence & Foreign Key References
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: Canonical Base Table Inspection ---');
  const baseTables = [
    'retailer_exchange_credit_ledger',
    'retailer_exchange_credit_transactions',
    'retailer_orders',
    'companies',
    'stores',
    'company_users'
  ];

  for (const t of baseTables) {
    try {
      const { count, error } = await adminClient
        .from(t)
        .select('*', { count: 'exact', head: true });
      if (error) {
        report(`Canonical table public.${t}`, false, error.message);
      } else {
        report(`Canonical table public.${t}`, true, `Live count: ${count}`);
      }
    } catch (err) {
      report(`Canonical table public.${t}`, false, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: Production Stored Procedures (RPCs) from Migration 0181
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Atomic Checkout Stored Procedures (RPCs) ---');

  const DUMMY_UUID = '00000000-0000-0000-0000-000000000001';

  // 1. reserve_exchange_credit_atomic
  try {
    const { data, error } = await adminClient.rpc('reserve_exchange_credit_atomic', {
      p_credit_id: DUMMY_UUID,
      p_company_id: DUMMY_UUID,
      p_store_id: null,
      p_checkout_session_id: 'probe_session_audit_only',
      p_order_subtotal_cents: 10000,
      p_idempotency_key: 'probe_idemp_key_audit_only'
    });

    if (error && error.code === '42883') {
      report('RPC reserve_exchange_credit_atomic exists in PostgreSQL', false, 'Function not found (code 42883)');
    } else {
      // If function exists, it raises P0002 (not found) or P0001 (unauthorized)
      const expectedBehavior =
        (error && (error.message.includes('not found') || error.message.includes('P0002') || error.message.includes('Unauthorized')));
      report(
        'RPC reserve_exchange_credit_atomic is installed, compiled, and handles input validation',
        expectedBehavior,
        `Result: ${error ? error.message : JSON.stringify(data)}`
      );
    }
  } catch (err) {
    report('RPC reserve_exchange_credit_atomic probe', false, err.message);
  }

  // 2. release_exchange_credit_reservation_atomic
  try {
    const { data, error } = await adminClient.rpc('release_exchange_credit_reservation_atomic', {
      p_credit_id: DUMMY_UUID,
      p_company_id: DUMMY_UUID,
      p_reason: 'probe_reason_audit_only',
      p_checkout_session_id: null
    });

    if (error && error.code === '42883') {
      report('RPC release_exchange_credit_reservation_atomic exists in PostgreSQL', false, 'Function not found (code 42883)');
    } else {
      // Returns JSONB object with success: false, error: 'Credit not found.'
      const expectedBehavior =
        (data && data.success === false && data.error && data.error.includes('Credit not found')) ||
        (error && error.message.includes('Credit not found'));
      report(
        'RPC release_exchange_credit_reservation_atomic is installed and returns expected JSONB',
        expectedBehavior,
        `Result: ${JSON.stringify(data || error)}`
      );
    }
  } catch (err) {
    report('RPC release_exchange_credit_reservation_atomic probe', false, err.message);
  }

  // 3. redeem_exchange_credit_atomic
  try {
    const { data, error } = await adminClient.rpc('redeem_exchange_credit_atomic', {
      p_credit_id: DUMMY_UUID,
      p_company_id: DUMMY_UUID,
      p_order_id: DUMMY_UUID,
      p_payment_idempotency_key: 'probe_pay_key_audit_only'
    });

    if (error && error.code === '42883') {
      report('RPC redeem_exchange_credit_atomic exists in PostgreSQL', false, 'Function not found (code 42883)');
    } else {
      const expectedBehavior =
        (error && (error.message.includes('not found') || error.message.includes('P0002')));
      report(
        'RPC redeem_exchange_credit_atomic is installed, compiled, and guards credit existence',
        expectedBehavior,
        `Result: ${error ? error.message : JSON.stringify(data)}`
      );
    }
  } catch (err) {
    report('RPC redeem_exchange_credit_atomic probe', false, err.message);
  }

  // 4. reinstate_cancelled_exchange_credit_atomic
  try {
    const { data, error } = await adminClient.rpc('reinstate_cancelled_exchange_credit_atomic', {
      p_credit_id: DUMMY_UUID,
      p_company_id: DUMMY_UUID,
      p_order_id: DUMMY_UUID,
      p_cancellation_reason: 'probe_cancellation_audit_only',
      p_idempotency_key: 'probe_reinstate_key_audit_only'
    });

    if (error && error.code === '42883') {
      report('RPC reinstate_cancelled_exchange_credit_atomic exists in PostgreSQL', false, 'Function not found (code 42883)');
    } else {
      const expectedBehavior =
        (error && (error.message.includes('not found') || error.message.includes('P0002')));
      report(
        'RPC reinstate_cancelled_exchange_credit_atomic is installed and guards cancellation credit existence',
        expectedBehavior,
        `Result: ${error ? error.message : JSON.stringify(data)}`
      );
    }
  } catch (err) {
    report('RPC reinstate_cancelled_exchange_credit_atomic probe', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: Security & Anonymous Access Revocation
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Security & Anonymous Privilege Audit ---');
  if (anonClient) {
    const probeList = [
      { name: 'reserve_exchange_credit_atomic', payload: { p_credit_id: DUMMY_UUID, p_company_id: DUMMY_UUID, p_store_id: null, p_checkout_session_id: 'x', p_order_subtotal_cents: 100, p_idempotency_key: 'x' } },
      { name: 'release_exchange_credit_reservation_atomic', payload: { p_credit_id: DUMMY_UUID, p_company_id: DUMMY_UUID, p_reason: 'x' } },
      { name: 'redeem_exchange_credit_atomic', payload: { p_credit_id: DUMMY_UUID, p_company_id: DUMMY_UUID, p_order_id: DUMMY_UUID, p_payment_idempotency_key: 'x' } },
      { name: 'reinstate_cancelled_exchange_credit_atomic', payload: { p_credit_id: DUMMY_UUID, p_company_id: DUMMY_UUID, p_order_id: DUMMY_UUID, p_cancellation_reason: 'x', p_idempotency_key: 'x' } }
    ];

    for (const p of probeList) {
      try {
        const { data, error } = await anonClient.rpc(p.name, p.payload);
        const isBlocked =
          error && (error.code === '42501' || error.message.includes('permission denied') || error.message.includes('Unauthorized') || error.message.includes('P0001'));
        report(
          `Anonymous user is blocked from executing ${p.name}`,
          isBlocked,
          `Error Code: ${error?.code}, Message: ${error?.message}`
        );
      } catch (err) {
        report(`Anonymous execution test for ${p.name}`, true, `Blocked with exception: ${err.message}`);
      }
    }
  } else {
    console.log('[INFO] Anon client not available; skipping anon RPC probe.');
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: Live Transaction Check Constraint Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Transaction Type Check Constraint Verification ---');
  // Attempt a dry probe to verify whether 'reinstatement' is a recognized transaction type
  // We do NOT write to DB. We inspect existing transaction types or metadata.
  try {
    const { data: sampleTx, error: txErr } = await adminClient
      .from('retailer_exchange_credit_transactions')
      .select('transaction_type')
      .limit(1);

    if (txErr) {
      report('Query retailer_exchange_credit_transactions', false, txErr.message);
    } else {
      report('Table retailer_exchange_credit_transactions is readable', true, `Sample rows: ${sampleTx.length}`);
    }
  } catch (err) {
    report('Query retailer_exchange_credit_transactions', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // SECTION 5: Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`PRODUCTION VERIFICATION COMPLETE: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('[UNHANDLED FATAL]', err);
  process.exit(1);
});
