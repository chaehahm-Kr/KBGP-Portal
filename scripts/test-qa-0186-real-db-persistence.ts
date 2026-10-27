import { Client } from 'pg';
import * as fs from 'fs';

// Read .env.qa.local safely
const content = fs.readFileSync('.env.qa.local', 'utf8');
const lines = content.split(/\r?\n/);
let qaDbUrl = '';
for (const line of lines) {
  if (line.startsWith('QA_DATABASE_URL=')) {
    qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

if (!qaDbUrl || qaDbUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: QA script cannot run on Production ref shzfrppdobpmrstcjfqu! Aborting.');
  process.exit(1);
}

const client = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function main() {
  await client.connect();
  console.log('================================================================================');
  console.log('ADM-BSRC-007-R1-ADD1: Real QA DB Immutability & Rejection Verification');
  console.log('Target QA DB: elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  const testCompanyId = 'd0000000-0000-4000-8000-000000000099';

  try {
    // Step 1: Insert dedicated synthetic test company into sourcing_companies
    console.log('--- Step 1: Create Isolated Synthetic Test Company ---');
    await client.query(`
      INSERT INTO public.sourcing_companies (
        id,
        company_name_kr,
        company_name_en,
        grade,
        status,
        interest_status
      ) VALUES (
        $1,
        '테스트 뷰티 코퍼레이션 (QA)',
        'Test Beauty Corp (QA)',
        'A',
        'SAVED',
        'UNKNOWN'
      )
      ON CONFLICT (id) DO UPDATE SET
        interest_status = 'UNKNOWN',
        next_followup_date = NULL,
        followup_note = NULL,
        followup_completed_at = NULL,
        last_contact_date = NULL;
    `, [testCompanyId]);
    console.log(`Synthetic company initialized with id: ${testCompanyId}`);

    // Step 2: Test Interest Status Persistence
    console.log('\n--- Step 2: Persist Interest Status Transition (UNKNOWN -> INTERESTED) ---');
    await client.query(`
      UPDATE public.sourcing_companies
      SET interest_status = 'INTERESTED', updated_at = now()
      WHERE id = $1;
    `, [testCompanyId]);

    const check1 = await client.query(`
      SELECT interest_status, updated_at 
      FROM public.sourcing_companies 
      WHERE id = $1;
    `, [testCompanyId]);
    assert(check1.rows[0].interest_status === 'INTERESTED', 'Real DB persisted interest_status = INTERESTED');

    // Step 3: Test Check Constraint Enforces Allowed Values
    console.log('\n--- Step 3: Check Constraint Integrity Enforcement ---');
    let rejected = false;
    try {
      await client.query(`
        UPDATE public.sourcing_companies
        SET interest_status = 'SUPER_INTERESTED'
        WHERE id = $1;
      `, [testCompanyId]);
    } catch (e: any) {
      rejected = true;
      console.log(`  ✓ DB correctly rejected invalid interest_status: ${e.message.slice(0, 70)}...`);
    }
    assert(rejected, 'DB check constraint chk_sourcing_companies_interest_status prevented invalid write');

    // Step 4: Test Follow-up Scheduling & last_contact_date TIMESTAMPTZ Persistence
    console.log('\n--- Step 4: Persist Follow-up Schedule, Note & last_contact_date ---');
    const followupDate = '2026-10-31';
    const followupNote = 'Call director to review distributor tier pricing';
    const contactTimestamp = '2026-10-27T14:45:00.000Z';

    await client.query(`
      UPDATE public.sourcing_companies
      SET next_followup_date = $2,
          followup_note = $3,
          last_contact_date = $4,
          updated_at = now()
      WHERE id = $1;
    `, [testCompanyId, followupDate, followupNote, contactTimestamp]);

    const check2 = await client.query(`
      SELECT next_followup_date::text, followup_note, last_contact_date
      FROM public.sourcing_companies 
      WHERE id = $1;
    `, [testCompanyId]);
    assert(check2.rows[0].next_followup_date === followupDate, `Real DB persisted next_followup_date = ${followupDate}`);
    assert(check2.rows[0].followup_note === followupNote, `Real DB persisted followup_note = "${followupNote}"`);
    assert(
      new Date(check2.rows[0].last_contact_date).toISOString() === contactTimestamp,
      `Real DB persisted last_contact_date as TIMESTAMPTZ = ${contactTimestamp}`
    );

    // Step 5: Test Append-Only Activity Timeline Logging
    console.log('\n--- Step 5: Activity Timeline Logging & Audit Immutability ---');
    const act1 = await client.query(`
      INSERT INTO public.sourcing_company_activities (
        company_id,
        activity_type,
        summary,
        details,
        staff_email
      ) VALUES (
        $1,
        'INTEREST_CHANGED',
        'Interest status set to INTERESTED',
        '{"newStatus": "INTERESTED", "actor": "qa-admin@kselect-test.local"}'::jsonb,
        'qa-admin@kselect-test.local'
      ) RETURNING id, created_at;
    `, [testCompanyId]);

    const act2 = await client.query(`
      INSERT INTO public.sourcing_company_activities (
        company_id,
        activity_type,
        summary,
        details,
        staff_email
      ) VALUES (
        $1,
        'FOLLOWUP_SCHEDULED',
        'Follow-up scheduled for 2026-10-31',
        '{"nextFollowupDate": "2026-10-31", "note": "Call director"}'::jsonb,
        'qa-admin@kselect-test.local'
      ) RETURNING id, created_at;
    `, [testCompanyId]);

    const act3 = await client.query(`
      INSERT INTO public.sourcing_company_activities (
        company_id,
        activity_type,
        summary,
        details,
        staff_email
      ) VALUES (
        $1,
        'REPLY_RECORDED',
        'Verified reply received from company contact',
        '{"notes": "Buyer replied positively"}'::jsonb,
        'qa-admin@kselect-test.local'
      ) RETURNING id, created_at;
    `, [testCompanyId]);

    const timeline = await client.query(`
      SELECT id, activity_type, summary, staff_email, created_at
      FROM public.sourcing_company_activities
      WHERE company_id = $1
      ORDER BY created_at ASC;
    `, [testCompanyId]);

    assert(timeline.rows.length === 3, 'Exactly 3 chronological activity records logged');
    assert(timeline.rows[0].activity_type === 'INTEREST_CHANGED', 'First activity is INTEREST_CHANGED');
    assert(timeline.rows[1].activity_type === 'FOLLOWUP_SCHEDULED', 'Second activity is FOLLOWUP_SCHEDULED');
    assert(timeline.rows[2].activity_type === 'REPLY_RECORDED', 'Third activity is REPLY_RECORDED');
    console.log('Chronological timeline verified: strictly append-only.');

    // Step 6: Test UPDATE/DELETE Rejection for 'authenticated' Role
    console.log('\n--- Step 6: Test UPDATE/DELETE Rejection for authenticated Role ---');
    let authUpdateBlocked = false;
    try {
      await client.query('SET ROLE authenticated;');
      await client.query(`UPDATE public.sourcing_company_activities SET summary = 'TAMPERED' WHERE id = $1;`, [act1.rows[0].id]);
    } catch (e: any) {
      authUpdateBlocked = true;
      console.log(`  ✓ authenticated UPDATE rejected: ${e.message}`);
    } finally {
      await client.query('RESET ROLE;').catch(() => {});
    }
    assert(authUpdateBlocked, 'authenticated role strictly blocked from UPDATE');

    let authDeleteBlocked = false;
    try {
      await client.query('SET ROLE authenticated;');
      await client.query(`DELETE FROM public.sourcing_company_activities WHERE id = $1;`, [act1.rows[0].id]);
    } catch (e: any) {
      authDeleteBlocked = true;
      console.log(`  ✓ authenticated DELETE rejected: ${e.message}`);
    } finally {
      await client.query('RESET ROLE;').catch(() => {});
    }
    assert(authDeleteBlocked, 'authenticated role strictly blocked from DELETE');

    // Step 7: Test UPDATE/DELETE Rejection for 'service_role' Role
    console.log('\n--- Step 7: Test UPDATE/DELETE Rejection for service_role Role ---');
    let srvUpdateBlocked = false;
    try {
      await client.query('SET ROLE service_role;');
      await client.query(`UPDATE public.sourcing_company_activities SET summary = 'TAMPERED' WHERE id = $1;`, [act1.rows[0].id]);
    } catch (e: any) {
      srvUpdateBlocked = true;
      console.log(`  ✓ service_role UPDATE rejected: ${e.message}`);
    } finally {
      await client.query('RESET ROLE;').catch(() => {});
    }
    assert(srvUpdateBlocked, 'service_role strictly blocked from UPDATE');

    let srvDeleteBlocked = false;
    try {
      await client.query('SET ROLE service_role;');
      await client.query(`DELETE FROM public.sourcing_company_activities WHERE id = $1;`, [act1.rows[0].id]);
    } catch (e: any) {
      srvDeleteBlocked = true;
      console.log(`  ✓ service_role DELETE rejected: ${e.message}`);
    } finally {
      await client.query('RESET ROLE;').catch(() => {});
    }
    assert(srvDeleteBlocked, 'service_role strictly blocked from DELETE');

    // Step 8: Test Trigger Exception for ANY Connection (Direct Trigger Guard)
    console.log('\n--- Step 8: Test Direct Trigger Guard Rejection Regardless of Role ---');
    let directUpdateBlocked = false;
    try {
      await client.query(`UPDATE public.sourcing_company_activities SET summary = 'TAMPERED' WHERE id = $1;`, [act1.rows[0].id]);
    } catch (e: any) {
      directUpdateBlocked = true;
      console.log(`  ✓ Direct UPDATE rejected by trigger: ${e.message}`);
      assert(e.message.includes('append-only audit log'), 'Trigger exception message verified');
    }
    assert(directUpdateBlocked, 'Trigger blocked UPDATE regardless of application role');

    let directDeleteBlocked = false;
    try {
      await client.query(`DELETE FROM public.sourcing_company_activities WHERE id = $1;`, [act1.rows[0].id]);
    } catch (e: any) {
      directDeleteBlocked = true;
      console.log(`  ✓ Direct DELETE rejected by trigger: ${e.message}`);
      assert(e.message.includes('append-only audit log'), 'Trigger exception message verified');
    }
    assert(directDeleteBlocked, 'Trigger blocked DELETE regardless of application role');

    // Step 9: Test ON DELETE RESTRICT foreign key protection on sourcing_companies
    console.log('\n--- Step 9: Test ON DELETE RESTRICT Preserves History (Blocks Company Deletion) ---');
    let deletionBlockedByFk = false;
    try {
      await client.query(`DELETE FROM public.sourcing_companies WHERE id = $1;`, [testCompanyId]);
    } catch (e: any) {
      deletionBlockedByFk = true;
      console.log(`  ✓ Deletion blocked by FK RESTRICT: ${e.message.slice(0, 90)}...`);
      assert(e.code === '23503', 'PostgreSQL error code is 23503 (foreign_key_violation)');
    }
    assert(deletionBlockedByFk, 'ON DELETE RESTRICT prevented accidental deletion of company with activity history');

    // Verify timeline records remain 100% intact
    const intactCheck = await client.query(`
      SELECT count(*) AS cnt 
      FROM public.sourcing_company_activities 
      WHERE company_id = $1;
    `, [testCompanyId]);
    assert(Number(intactCheck.rows[0].cnt) === 3, 'All 3 activity history records preserved intact');

    console.log('\n================================================================================');
    console.log('🎉 ALL REAL QA DATABASE PERSISTENCE, APPEND-ONLY & RESTRICT TESTS PASSED (100%)');
    console.log('================================================================================\n');
  } finally {
    // Clean up test data safely using superuser trigger control
    await client.query(`ALTER TABLE public.sourcing_company_activities DISABLE TRIGGER trg_protect_sourcing_company_activities;`).catch(() => {});
    await client.query(`DELETE FROM public.sourcing_company_activities WHERE company_id = $1;`, [testCompanyId]).catch(() => {});
    await client.query(`ALTER TABLE public.sourcing_company_activities ENABLE TRIGGER trg_protect_sourcing_company_activities;`).catch(() => {});
    await client.query(`DELETE FROM public.sourcing_companies WHERE id = $1;`, [testCompanyId]).catch(() => {});
    await client.end();
  }
}

main().catch(err => {
  console.error('Real QA persistence test failed:', err);
  process.exit(1);
});
