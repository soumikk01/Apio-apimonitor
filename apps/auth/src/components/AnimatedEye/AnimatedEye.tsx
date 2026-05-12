'use client';

import { motion } from 'motion/react';

export default function AnimatedEye({ isVisible, onClick }: { isVisible: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            suppressHydrationWarning
            title={isVisible ? "Hide password" : "Show password"}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isVisible ? '#f3f4f6' : '#6b7280',
                transition: 'color 0.2s',
                outline: 'none',
                margin: 0,
            }}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {/* The Top Eyelid */}
                <motion.path
                    d="M2 12C2 12 6 5 12 5C18 5 22 12 22 12"
                    initial={false}
                    animate={{
                        d: isVisible 
                            ? "M2 12C2 12 6 5 12 5C18 5 22 12 22 12" 
                            : "M2 12C2 12 6 15 12 15C18 15 22 12 22 12"
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
                
                {/* The Bottom Eyelid (only visible when open) */}
                <motion.path
                    d="M2 12C2 12 6 19 12 19C18 19 22 12 22 12"
                    initial={false}
                    animate={{
                        d: isVisible 
                            ? "M2 12C2 12 6 19 12 19C18 19 22 12 22 12" 
                            : "M2 12C2 12 6 15 12 15C18 15 22 12 22 12",
                        opacity: isVisible ? 1 : 0
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />

                {/* The Pupil */}
                <motion.circle
                    cx="12" cy="12" r="3"
                    initial={false}
                    animate={{
                        scale: isVisible ? 1 : 0,
                        opacity: isVisible ? 1 : 0,
                        y: isVisible ? 0 : 5
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />

                {/* Eyelashes for closed eye */}
                <motion.path
                    d="M12 15V18"
                    initial={false}
                    animate={{ pathLength: isVisible ? 0 : 1, opacity: isVisible ? 0 : 1 }}
                />
                <motion.path
                    d="M7 14L5 16"
                    initial={false}
                    animate={{ pathLength: isVisible ? 0 : 1, opacity: isVisible ? 0 : 1 }}
                />
                <motion.path
                    d="M17 14L19 16"
                    initial={false}
                    animate={{ pathLength: isVisible ? 0 : 1, opacity: isVisible ? 0 : 1 }}
                />
            </svg>
        </button>
    );
}
