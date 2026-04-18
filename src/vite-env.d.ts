/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TURSO_DATABASE_URL: string;
  readonly VITE_TURSO_AUTH_TOKEN: string;
  readonly VITE_PIN_HASH: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_SYNC_INTERVAL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
