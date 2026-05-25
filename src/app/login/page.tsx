"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Lock, 
  ArrowRight, 
  Loader2,
  AlertCircle,
  UtensilsCrossed
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const DUMMY_USERS = [
  { name: 'ceo', password: 'ceo', role: 'CEO', path: '/ceo' },
  { name: 'manager', password: 'manager', role: 'Manager', path: '/manager' },
  { name: 'reception1', password: 'reception1', role: 'Receptionist', path: '/reception' },
  { name: 'reception2', password: 'reception2', role: 'Receptionist', path: '/reception' },
  { name: 'reception3', password: 'reception3', role: 'Receptionist', path: '/reception' },
  { name: 'reception4', password: 'reception4', role: 'Receptionist', path: '/reception' },
  { name: 'dispatch', password: 'dispatch', role: 'Dispatcher', path: '/delivery' },
  { name: 'rider', password: 'rider', role: 'Rider', path: '/rider' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const user = DUMMY_USERS.find(
      u => u.name.toLowerCase() === username.trim().toLowerCase() && u.password === password.trim()
    );

    console.log("[Auth] Attempt:", { inputUser: username, inputPass: password });
    console.log("[Auth] Match found:", user ? user.name : "None");

    if (user) {
      const sessionData = {
        username: user.name,
        role: user.role,
        authenticated: true,
        timestamp: new Date().getTime()
      };
      
      // Save to sessionStorage for backward compatibility/client hooks
      sessionStorage.setItem('rms_dummy_session', JSON.stringify(sessionData));
      
      // Save to document.cookie for Next.js Middleware route guards
      // Expiry 1 day
      document.cookie = `rms_dummy_session=${encodeURIComponent(JSON.stringify(sessionData))}; path=/; max-age=86400; SameSite=Strict`;

      router.push(user.path);
    } else {
      setError('Invalid Access Credentials');
      setIsLoading(false);
    }
  };

  // Standard Tailwind Animation Classes (defined in globals.css or ad-hoc)
  // Instead of styled-jsx, we use Tailwind classes.

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans selection:bg-primary selection:text-black relative overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 z-10" />
        <img 
          src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop" 
          className="w-full h-full object-cover scale-110 blur-[2px] opacity-40"
          alt=""
        />
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="w-full max-w-[1200px] grid lg:grid-cols-2 gap-12 items-center relative z-10">
        {/* Branding Section */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={isMounted ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="hidden lg:flex flex-col gap-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)]">
              <UtensilsCrossed size={32} className="text-black" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
                Royal <span className="text-primary">RMS</span>
              </h2>
              <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em] mt-1 opacity-60">Elite Hospitality Systems</p>
            </div>
          </div>

          <div className="space-y-12 mt-4">
            <div>
              <h1 className="text-7xl font-black text-white leading-[0.85] tracking-tighter uppercase italic mb-8">
                THE FUTURE OF <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-400 to-primary">GASTRONOMY.</span>
              </h1>
              <p className="text-muted text-lg max-w-md font-medium leading-relaxed opacity-80">
                Experience seamless orchestration of flavors and efficiency with our next-generation restaurant management ecosystem.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 max-w-sm">
              <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 backdrop-blur-md">
                <p className="text-2xl font-black text-white mb-0.5 tracking-tighter">99.9%</p>
                <p className="text-[9px] text-muted font-black uppercase tracking-widest opacity-60">System Uptime</p>
              </div>
              <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 backdrop-blur-md">
                <p className="text-2xl font-black text-white mb-0.5 tracking-tighter">50ms</p>
                <p className="text-[9px] text-muted font-black uppercase tracking-widest opacity-60">Global Latency</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Auth Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={isMounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[480px] mx-auto lg:mx-0 lg:ml-auto"
        >
          <Card className="bg-black/60 backdrop-blur-3xl border-white/10 p-10 lg:p-14 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="mb-12 text-center lg:text-left">
              <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Welcome</h3>
              <p className="text-muted text-sm font-medium opacity-70">Security protocol required for entry</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative group/input">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted group-focus-within/input:text-primary transition-colors">
                  <User size={22} />
                </div>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-primary/50 focus:bg-white/[0.07] rounded-2xl py-6 pl-16 pr-8 text-white outline-none transition-all placeholder:text-muted/20 font-bold text-lg"
                  required
                />
              </div>

              <div className="relative group/input">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted group-focus-within/input:text-primary transition-colors">
                  <Lock size={22} />
                </div>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white/[0.03] border border-white/10 focus:border-primary/50 focus:bg-white/[0.07] rounded-2xl py-6 pl-16 pr-8 text-white outline-none transition-all placeholder:text-muted/20 font-bold text-lg"
                  required
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 text-[10px] font-black uppercase tracking-widest"
                  >
                    <AlertCircle size={18} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button 
                type="submit"
                disabled={isLoading}
                className="w-full h-20 rounded-2xl bg-primary hover:bg-primary/90 text-black font-black text-xl uppercase tracking-tighter shadow-2xl shadow-primary/20 transition-all active:scale-[0.97] flex items-center justify-center gap-4 group"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={32} />
                ) : (
                  <>
                    AUTHENTICATE <ArrowRight size={28} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>

      <footer className="absolute bottom-10 left-10 opacity-30 hidden lg:block">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.5em]">v2.4.0 MASTER BUILD</p>
      </footer>
      <footer className="absolute bottom-10 right-10 opacity-30 hidden lg:block">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.5em]">SECURE CHANNEL 01</p>
      </footer>
    </div>
  );
}
