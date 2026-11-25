/** Supabase is used only when both build-time variables are set; otherwise the app runs in local DEMO mode. */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
export const LIVE_MODE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Where Supabase email links (invite, magic link, password reset) should land. */
export const siteUrl = () => window.location.origin + window.location.pathname;
