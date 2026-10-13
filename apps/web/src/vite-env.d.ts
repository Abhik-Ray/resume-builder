/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase project URL and publishable key; both are public by design
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
