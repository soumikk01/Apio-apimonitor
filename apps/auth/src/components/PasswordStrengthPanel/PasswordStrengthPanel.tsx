'use client';

import { motion, AnimatePresence } from 'motion/react';
import React from 'react';

// ── Requirements ─────────────────────────────────────────────────────────────
export const PW_RULES = [
  { id: 'length',    label: '6 – 15 characters',        test: (p: string) => p.length >= 6 && p.length <= 15 },
  { id: 'upper',     label: 'One uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'number',    label: 'One number (0-9)',           test: (p: string) => /[0-9]/.test(p) },
  { id: 'special',   label: 'One special character (!@#…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function isPasswordValid(p: string) {
  return PW_RULES.every(r => r.test(p));
}

// ── Icons ────────────────────────────────────────────────────────────────────
function TickIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
interface Props {
  password: string;
  /** Show panel only when password field has been touched */
  visible: boolean;
}

export default function PasswordStrengthPanel({ password, visible }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 10, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 10, scale: 0.97 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: 'calc(100% + 12px)',
            top: 0,
            width: 220,
            background: 'rgba(18,18,22,0.96)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(16px)',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            left: -6, top: 16,
            width: 10, height: 10,
            background: 'rgba(18,18,22,0.96)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRight: 'none', borderBottom: 'none',
            transform: 'rotate(-45deg)',
          }} />

          <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10, textTransform: 'uppercase' }}>
            Password must have
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {PW_RULES.map((rule, i) => {
              const met = rule.test(password);
              return (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.18 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {/* Icon badge */}
                  <motion.span
                    animate={{
                      background: met ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.15)',
                      color: met ? '#4ade80' : '#f87171',
                    }}
                    transition={{ duration: 0.25 }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {met ? (
                        <motion.span key="tick"
                          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.18 }}
                        >
                          <TickIcon />
                        </motion.span>
                      ) : (
                        <motion.span key="cross"
                          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.18 }}
                        >
                          <CrossIcon />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>

                  {/* Label */}
                  <motion.span
                    animate={{ color: met ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.45)' }}
                    transition={{ duration: 0.25 }}
                    style={{ fontSize: '0.76rem', lineHeight: 1.3 }}
                  >
                    {rule.label}
                  </motion.span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
