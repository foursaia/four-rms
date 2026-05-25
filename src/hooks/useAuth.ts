"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function useAuth(requiredRole?: string) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // ── 1. Try real Supabase Auth first ───────────────────────────────
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: staffProfile } = await supabase
            .from('staff')
            .select('id, full_name, role, branch_id')
            .eq('auth_user_id', session.user.id)
            .single();

          if (staffProfile) {
            // Role check
            if (requiredRole && staffProfile.role !== requiredRole) {
              router.push('/login');
              return;
            }

            setUser({
              id: staffProfile.id,
              username: staffProfile.full_name,
              role: staffProfile.role,
              branch_id: staffProfile.branch_id,
              authType: 'supabase',
            });
            setLoading(false);
            return;
          }
        }

        // ── 2. Fall back to dummy session (dev / testing) ─────────────────
        let sessionStr = null;
        if (typeof window !== 'undefined') {
          // Try to get from cookies first (for middleware compatibility)
          const match = document.cookie.match(new RegExp('(^| )rms_dummy_session=([^;]+)'));
          if (match) {
            sessionStr = decodeURIComponent(match[2]);
          } else {
            // Fallback to sessionStorage
            sessionStr = sessionStorage.getItem('rms_dummy_session');
          }
        }

        if (!sessionStr) {
          router.push('/login');
          return;
        }

        const userData = JSON.parse(sessionStr);

        // Expire after 24 hours
        const now = new Date().getTime();
        if (now - userData.timestamp > 24 * 60 * 60 * 1000) {
          document.cookie = 'rms_dummy_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          sessionStorage.removeItem('rms_dummy_session');
          router.push('/login');
          return;
        }

        if (requiredRole && userData.role !== requiredRole) {
          router.push('/login');
          return;
        }

        setUser({ ...userData, authType: 'dummy' });
        setLoading(false);
      } catch (error) {
        console.error("Auth Check Error:", error);
        router.push('/login');
        setLoading(false);
      }
    };

    checkAuth();
  }, [requiredRole, router]);

  return { user, loading };
}
