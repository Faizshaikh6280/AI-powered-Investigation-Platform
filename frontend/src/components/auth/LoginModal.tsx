'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Mail, Key, AlertCircle, Loader2, 
  ChevronRight, ArrowLeft, RefreshCw, Eye, EyeOff, ShieldAlert, Sparkles, Smartphone
} from 'lucide-react';
import { useAuth, SEEDED_DEV_ACCOUNTS } from '../../context/AuthContext';

export default function LoginModal() {
  const { login, verifyMfa, isLoginModalOpen, setIsLoginModalOpen, switchDevRole, isAuthenticated, user } = useAuth();
  
  const [identifier, setIdentifier] = useState('admin@cyber.gov.in');
  const [password, setPassword] = useState('Admin#Cyber2026!Secure');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // MFA Challenge state
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);

  if (!isLoginModalOpen && isAuthenticated) return null;

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(identifier, password);
      if (res.mfa_required && res.challenge_token) {
        setMfaChallengeToken(res.challenge_token);
        setTotpCode('');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallengeToken) return;
    setError(null);
    setLoading(true);

    try {
      await verifyMfa(mfaChallengeToken, totpCode, isBackupMode);
      setMfaChallengeToken(null);
      setTotpCode('');
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please check your authenticator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-card/95 border border-border/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Obsidian Glowing Top Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-cyan-500 to-indigo-500" />

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-xl text-primary">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground font-mono">
                  TRACE INTELLIGENCE
                </h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                  Law Enforcement Access Gateway
                </p>
              </div>
            </div>

            {isAuthenticated && (
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground bg-secondary px-2.5 py-1 rounded-md border border-border"
              >
                Close
              </button>
            )}
          </div>

          {/* Security Alert Banner */}
          <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5 text-xs text-amber-400">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <span>
              Restricted system. Access logged under statutory chain-of-custody. Unauthorized access is subject to criminal prosecution.
            </span>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2.5 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Step: Password Authentication */}
          {!mfaChallengeToken ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Official Email or Employee Badge ID
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. admin@cyber.gov.in or EMP-ADMIN-001"
                    className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-10 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying Credentials...
                  </>
                ) : (
                  <>
                    Authenticate Session <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/80" /></div>
                <span className="relative bg-card px-2 text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Or Contactless</span>
              </div>

              <a
                href="/nfc-login"
                className="w-full py-2.5 px-4 bg-secondary/80 hover:bg-secondary border border-border text-foreground font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-2 group shadow-sm"
              >
                <Smartphone className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Tap Police NFC Card (4-Digit PIN)</span>
              </a>
            </form>
          ) : (
            /* Form Step: MFA Verification */
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary flex items-center gap-2">
                <Key className="w-4 h-4 flex-shrink-0" />
                <span>Two-Factor Authentication required for this personnel rank.</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isBackupMode ? '10-Character Emergency Backup Code' : '6-Digit TOTP Authenticator Code'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBackupMode(!isBackupMode);
                      setTotpCode('');
                    }}
                    className="text-[11px] text-primary hover:underline font-mono"
                  >
                    {isBackupMode ? 'Use Authenticator App' : 'Use Backup Recovery Code'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.toUpperCase())}
                  placeholder={isBackupMode ? 'XXXXX-XXXXX' : '123456'}
                  maxLength={isBackupMode ? 15 : 6}
                  className="w-full text-center tracking-widest font-mono text-xl bg-secondary/50 border border-border rounded-lg py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/30"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMfaChallengeToken(null)}
                  className="py-2.5 px-3 bg-secondary text-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 border border-border flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading || totpCode.trim().length === 0}
                  className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Enter Platform'}
                </button>
              </div>
            </form>
          )}

          {/* Quick Role Switcher for Development & Review */}
          <div className="mt-8 pt-6 border-t border-border/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Test Officer Accounts (1-Click Switcher)
              </span>
              <span className="text-[10px] text-muted-foreground/70 font-mono">Dev Sandbox</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {Object.entries(SEEDED_DEV_ACCOUNTS).map(([key, acc]) => {
                const isActive = user?.role === acc.role;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchDevRole(key)}
                    className={`text-left p-2 rounded-lg border text-xs transition-all ${
                      isActive 
                        ? 'bg-primary/15 border-primary/50 text-primary font-semibold' 
                        : 'bg-secondary/40 border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="font-semibold truncate text-[11px]">{acc.display_name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{acc.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
