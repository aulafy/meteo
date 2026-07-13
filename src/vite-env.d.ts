/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIRES_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
