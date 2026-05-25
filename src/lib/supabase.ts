import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Returns the branch ID for the currently logged-in user or stored device preference.
 */
export async function getActiveBranchId(): Promise<string | null> {
  // 1. Check localStorage first (for device-specific binding like Kiosk/Kitchen)
  if (typeof window !== 'undefined') {
    const storedBranchId = localStorage.getItem('rms_branch_id');
    if (storedBranchId) return storedBranchId;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('staff') // Changed from 'profiles' to 'staff' as per schema
        .select('branch_id')
        .eq('auth_user_id', session.user.id)
        .single();
      if (profile?.branch_id) return profile.branch_id;
    }
  } catch {
    // Session check failed
  }

  // Fallback: first branch in DB
  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .limit(1);
  
  const fallbackId = branches?.[0]?.id ?? null;
  
  // Store fallback if we found one
  if (fallbackId && typeof window !== 'undefined') {
    localStorage.setItem('rms_branch_id', fallbackId);
  }
  
  return fallbackId;
}

export function setStoredBranchId(id: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('rms_branch_id', id);
  }
}
