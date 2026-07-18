/**
 * Lightweight protocol identity registry.
 *
 * Response headers need these immutable identifiers on every route. Keeping them in
 * a dependency-free module prevents the HTTP response layer from initializing Ajv,
 * Cheerio, Undici and operational subsystems merely to read version strings.
 */
export const VALORAE_HTML_PARSER_SHADOW_VERSION = '2026.07.15-checkpoint109-v1';
export const VALORAE_STRUCTURED_DATA_VERSION = '2026.07.15-checkpoint110-v1';
export const VALORAE_DYNAMIC_RENDER_VERSION = '2026.07.15-checkpoint111-v1';
export const VALORAE_FORMAL_SCHEMA_VERSION = '2026.07.15-checkpoint112-v1';
export const VALORAE_HTTP_TRANSPORT_VERSION = '2026.07.15-checkpoint113-v1';
export const VALORAE_SHARED_STATE_VERSION = '2026.07.15-checkpoint114-v1';
export const VALORAE_REAL_CANARY_VERSION = '2026.07.15-checkpoint115-v1';
export const VALORAE_FINAL_DECOMPOSITION_VERSION = '2026.07.15-checkpoint116-v1';
export const VALORAE_HYBRID_DOCUMENT_VERSION = '2026.07.16-checkpoint117-v1';
