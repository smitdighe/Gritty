/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_POLL_INTERVAL_MS: string;
  readonly VITE_FEATURE_OBJECT_EXPLORER: string;
  readonly VITE_FEATURE_DIFF_SCRUBBER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
