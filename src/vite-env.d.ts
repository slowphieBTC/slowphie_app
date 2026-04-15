/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SLOWPHIE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
