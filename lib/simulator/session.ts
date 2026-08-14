import { createAdminClient } from "@/lib/supabase/admin";

export interface SessionResult {
  simulation_id: string;
  simulation_code: string;
  base_simulation_id: string;
  revision_no: number;
  is_latest: boolean;
  is_no_change: boolean;
}

export function generateSimulationCode(date: Date = new Date()): string {
  const yy = String(date.getUTCFullYear()).slice(2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GS-${yy}${mm}${dd}-${hh}${min}${ss}-${suffix}`;
}

export function areAnswersEqual(ans1: any, ans2: any): boolean {
  if (!ans1 || !ans2) return false;
  const str1 = JSON.stringify(sortObject(ans1));
  const str2 = JSON.stringify(sortObject(ans2));
  return str1 === str2;
}

function sortObject(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  const sorted: Record<string, any> = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObject(obj[key]);
  });
  return sorted;
}

export async function persistSimulationSession(params: {
  email?: string | null;
  answers: Record<string, any>;
  result: Record<string, any>;
  baseSimulationIdInput?: string | null;
}): Promise<SessionResult> {
  const supabase = createAdminClient();
  const { email, answers, result, baseSimulationIdInput } = params;

  // 1. Check if base_simulation_id is provided for Revision lookup
  if (baseSimulationIdInput) {
    let query = supabase.from("simulation_results").select("*");
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseSimulationIdInput)) {
      query = query.eq("id", baseSimulationIdInput);
    } else {
      query = query.eq("simulation_code", baseSimulationIdInput);
    }

    const { data: parentRecords } = await query.limit(1);
    const parentRecord = parentRecords && parentRecords.length > 0 ? parentRecords[0] : null;

    if (parentRecord) {
      const parentMeta = parentRecord.result_snapshot?.session_meta || {};
      const baseId = parentRecord.base_simulation_id || parentMeta.base_simulation_id || parentRecord.id;
      const rawCode = parentRecord.simulation_code || parentMeta.simulation_code || "";
      const baseCode = (rawCode.split("-R")[0] || "").trim() || `GS-BASE-${baseId.substring(0, 8).toUpperCase()}`;

      // Fetch candidate revisions safely and filter in memory by base_simulation_id / session_meta
      let candidates: any[] = [];

      // 1. Primary Query: Try selecting by base_simulation_id and id
      const { data: dbRevs } = await supabase
        .from("simulation_results")
        .select("id, revision_no, answers_snapshot, is_latest, simulation_code, base_simulation_id, result_snapshot, created_at, email")
        .or(`id.eq.${baseId},base_simulation_id.eq.${baseId}${parentRecord.email ? `,email.eq.${parentRecord.email}` : ""}`)
        .order("created_at", { ascending: false });

      if (dbRevs && dbRevs.length > 0) {
        candidates = dbRevs;
      } else {
        // 2. Fallback Query: Fetch recent 100 simulations
        const { data: recentRevs } = await supabase
          .from("simulation_results")
          .select("id, revision_no, answers_snapshot, is_latest, simulation_code, base_simulation_id, result_snapshot, created_at, email")
          .order("created_at", { ascending: false })
          .limit(100);
        candidates = recentRevs || [];
      }

      // Filter in memory for matching session (baseId match or email match)
      const revisionsRaw = candidates.filter((r: any) => {
        if (r.id === baseId || r.base_simulation_id === baseId) return true;
        let snap = r.result_snapshot;
        if (typeof snap === "string") {
          try { snap = JSON.parse(snap); } catch (e) {}
        }
        const meta = snap?.session_meta || {};
        if (meta.base_simulation_id === baseId) return true;
        if (parentRecord.email && r.email && r.email === parentRecord.email) return true;
        return false;
      });

      const revisions = (revisionsRaw || []).map((r: any) => {
        let snapshot = r.result_snapshot;
        if (typeof snapshot === "string") {
          try { snapshot = JSON.parse(snapshot); } catch (e) {}
        }
        const meta = snapshot?.session_meta || {};
        const code = r.simulation_code || meta.simulation_code || "";
        const codeRevMatch = code.match(/-R(\d+)$/i);
        const codeRevNo = codeRevMatch ? parseInt(codeRevMatch[1], 10) : 0;

        const numR = Number(r.revision_no);
        const numMeta = Number(meta.revision_no);

        const effectiveRevNo = (!isNaN(numR) && numR > 0)
          ? numR
          : ((!isNaN(numMeta) && numMeta > 0)
            ? numMeta
            : codeRevNo);

        return {
          ...r,
          revision_no: effectiveRevNo,
          base_simulation_id: r.base_simulation_id || meta.base_simulation_id || r.id,
          simulation_code: code || meta.simulation_code || `GS-REV-${r.id.slice(0, 4)}`
        };
      });

      let parentSnap = parentRecord.result_snapshot;
      if (typeof parentSnap === "string") {
        try { parentSnap = JSON.parse(parentSnap); } catch (e) {}
      }
      const parentMetaResolved = parentSnap?.session_meta || parentMeta || {};

      const parentCodeMatch = (parentRecord.simulation_code || parentMetaResolved.simulation_code || "").match(/-R(\d+)$/i);
      const parentCodeRevNo = parentCodeMatch ? parseInt(parentCodeMatch[1], 10) : 0;
      const numPR = Number(parentRecord.revision_no);
      const numPM = Number(parentMetaResolved.revision_no);

      const parentRevNo = (!isNaN(numPR) && numPR > 0)
        ? numPR
        : ((!isNaN(numPM) && numPM > 0)
          ? numPM
          : parentCodeRevNo);

      const latestRev = revisions && revisions.length > 0 ? revisions[0] : parentRecord;
      const maxRevNo = Math.max(
        parentRevNo,
        ...(revisions?.map(r => r.revision_no || 0) || [0])
      );

      // Check for answer equality with latest revision
      if (latestRev && areAnswersEqual(latestRev.answers_snapshot, answers)) {
        console.log(`[Session] No answer change detected for Base ${baseId}. Returning latest revision.`);
        return {
          simulation_id: latestRev.id,
          simulation_code: latestRev.simulation_code || `${baseCode}-R${latestRev.revision_no || 0}`,
          base_simulation_id: baseId,
          revision_no: latestRev.revision_no || 0,
          is_latest: true,
          is_no_change: true
        };
      }

      // Answer changed -> Create New Revision!
      const nextRevNo = maxRevNo + 1;
      const newRevCode = `${baseCode}-R${nextRevNo}`;

      // Mark previous revisions as is_latest = false
      try {
        await supabase
          .from("simulation_results")
          .update({ is_latest: false })
          .or(`id.eq.${baseId},base_simulation_id.eq.${baseId}`);
      } catch (e) {}

      const sessionMetaObj = {
        base_simulation_id: baseId,
        simulation_code: newRevCode,
        revision_no: nextRevNo,
        is_latest: true
      };

      const insertPayload: Record<string, any> = {
        email: email || parentRecord.email || null,
        answers_snapshot: answers,
        result_snapshot: {
          ...result,
          session_meta: sessionMetaObj
        },
        questionnaire_id: result.versions?.questionnaire_id || null,
        calculation_trace: result.trace || null,
        questionnaire_version: result.versions?.questionnaire_version || null,
        mapping_version: result.versions?.mapping_version || null,
        calibration_version: result.versions?.calibration_version || null,
        engine_version: result.versions?.engine_version || null,
        financial_assumption_version: result.versions?.financial_assumption_version || null,
        base_simulation_id: baseId,
        revision_no: nextRevNo,
        simulation_code: newRevCode,
        is_latest: true
      };

      // Try inserting with new DDL columns
      const { data: inserted, error: insErr } = await supabase
        .from("simulation_results")
        .insert(insertPayload)
        .select("id, simulation_code, revision_no, base_simulation_id")
        .single();

      if (!insErr && inserted) {
        return {
          simulation_id: inserted.id,
          simulation_code: inserted.simulation_code || newRevCode,
          base_simulation_id: baseId,
          revision_no: nextRevNo,
          is_latest: true,
          is_no_change: false
        };
      } else {
        console.warn("⚠️ Revision DDL column pending, saving resiliently via JSONB snapshot:", insErr?.message);
        delete insertPayload.base_simulation_id;
        delete insertPayload.revision_no;
        delete insertPayload.simulation_code;
        delete insertPayload.is_latest;

        const { data: fbInserted } = await supabase
          .from("simulation_results")
          .insert(insertPayload)
          .select("id")
          .single();

        return {
          simulation_id: fbInserted?.id || "SIM-" + Math.floor(10000 + Math.random() * 90000),
          simulation_code: newRevCode,
          base_simulation_id: baseId,
          revision_no: nextRevNo,
          is_latest: true,
          is_no_change: false
        };
      }
    }
  }

  // 2. New Base Simulation (Original / R0)
  const newBaseCode = generateSimulationCode();
  const baseMetaObj = {
    base_simulation_id: null, // Will set below or use self id
    simulation_code: newBaseCode,
    revision_no: 0,
    is_latest: true
  };

  const baseInsertPayload: Record<string, any> = {
    email: email || null,
    answers_snapshot: answers,
    result_snapshot: {
      ...result,
      session_meta: baseMetaObj
    },
    questionnaire_id: result.versions?.questionnaire_id || null,
    calculation_trace: result.trace || null,
    questionnaire_version: result.versions?.questionnaire_version || null,
    mapping_version: result.versions?.mapping_version || null,
    calibration_version: result.versions?.calibration_version || null,
    engine_version: result.versions?.engine_version || null,
    financial_assumption_version: result.versions?.financial_assumption_version || null,
    revision_no: 0,
    simulation_code: newBaseCode,
    is_latest: true
  };

  const { data: insertedBase, error: baseErr } = await supabase
    .from("simulation_results")
    .insert(baseInsertPayload)
    .select("id, simulation_code, revision_no")
    .single();

  if (baseErr || !insertedBase) {
    console.warn("⚠️ Base Insert Column missing error, attempting core insert:", baseErr?.message);
    delete baseInsertPayload.revision_no;
    delete baseInsertPayload.simulation_code;
    delete baseInsertPayload.is_latest;

    const { data: fbBase } = await supabase
      .from("simulation_results")
      .insert(baseInsertPayload)
      .select("id")
      .single();

    const finalId = fbBase?.id || "SIM-" + Math.floor(10000 + Math.random() * 90000);
    return {
      simulation_id: finalId,
      simulation_code: newBaseCode,
      base_simulation_id: finalId,
      revision_no: 0,
      is_latest: true,
      is_no_change: false
    };
  }

  // Update session_meta and base_simulation_id to self ID
  try {
    result.session_meta.base_simulation_id = insertedBase.id;
    await supabase
      .from("simulation_results")
      .update({
        base_simulation_id: insertedBase.id,
        result_snapshot: result
      })
      .eq("id", insertedBase.id);
  } catch (e) {}

  return {
    simulation_id: insertedBase.id,
    simulation_code: insertedBase.simulation_code || newBaseCode,
    base_simulation_id: insertedBase.id,
    revision_no: 0,
    is_latest: true,
    is_no_change: false
  };
}
