import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage 폴더 아래의 모든 파일을 지운다(하위 폴더 포함). DB 행 삭제 후 남는
 * 업로드 파일을 정리하는 용도라, 실패해도 호출한 작업은 실패시키지 않고 로그만 남긴다.
 */
export async function removeStorageFolder(
  admin: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<void> {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  if (!cleanPrefix) return; // 버킷 전체 삭제 방지

  try {
    const paths: string[] = [];
    const queue = [cleanPrefix];
    while (queue.length > 0) {
      const dir = queue.shift()!;
      const { data, error } = await admin.storage.from(bucket).list(dir, { limit: 1000 });
      if (error) throw error;
      for (const entry of data ?? []) {
        const full = `${dir}/${entry.name}`;
        // 폴더 항목은 id가 null로 내려온다.
        if (entry.id === null) queue.push(full);
        else paths.push(full);
      }
    }

    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
  } catch (err) {
    console.error(`[storage-folder] cleanup failed for ${bucket}/${cleanPrefix}`, err);
  }
}
