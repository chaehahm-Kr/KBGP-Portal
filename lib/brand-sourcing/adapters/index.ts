import { SourceAdapter } from "./base.adapter";
import { IntercharmAdapter } from "./intercharm.adapter";
import { AdapterNotFoundError } from "../errors";

export * from "./base.adapter";
export * from "./intercharm.adapter";

const registry: SourceAdapter[] = [new IntercharmAdapter()];

/**
 * Resolves the appropriate SourceAdapter for a given URL.
 */
export function resolveSourceAdapter(url: string): SourceAdapter {
  const adapter = registry.find((a) => a.canHandle(url));
  if (!adapter) {
    throw new AdapterNotFoundError(url);
  }
  return adapter;
}
