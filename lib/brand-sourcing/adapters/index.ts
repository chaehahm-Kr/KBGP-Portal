import { SourceAdapter } from "./base.adapter";
import { IntercharmAdapter } from "./intercharm.adapter";
import { IndieBeautyShowAdapter } from "./indie-beauty-show.adapter";
import { sourceRegistry } from "../source-registry";

export * from "./base.adapter";
export * from "./intercharm.adapter";
export * from "./indie-beauty-show.adapter";

/**
 * Resolves the appropriate SourceAdapter for a given URL via the centralized Source Registry.
 */
export function resolveSourceAdapter(url: string): SourceAdapter {
  return sourceRegistry.resolveAdapter(url);
}
