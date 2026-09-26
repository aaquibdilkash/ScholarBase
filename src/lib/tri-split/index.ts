/**
 * Tri-Split list architecture.
 *
 * Shared by every list page in the app. The entry point is
 * {@link createTriSplitList}, which bakes in the identity contract: the loader
 * it returns resolves the viewer from the session and exposes no identity
 * parameter.
 */
export {
  createTriSplitList,
  type TriSplitConfig,
  type TriSplitLoader,
} from "./factory";

export {
  LIST_PAGE_SIZE_DEFAULT,
  LIST_PAGE_SIZE_MAX,
  LIST_REVALIDATE_SECONDS,
  normalizePageSize,
  serializeDates,
  createCachedPage,
} from "./cache";

export { getLiveOverlay, type OverlayTables } from "./overlay";

export {
  stitchLiveState,
  type LiveOverlay,
  type StitchOptions,
} from "./stitch";
