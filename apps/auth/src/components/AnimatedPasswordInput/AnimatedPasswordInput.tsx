'use client';

import { motion } from 'motion/react';
import React, { InputHTMLAttributes, useState } from 'react';
import AnimatedEye from '../AnimatedEye/AnimatedEye';

interface AnimatedPasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
    wrapperClassName?: string;
}

export default function AnimatedPasswordInput({ wrapperClassName, value, onChange, placeholder, ...props }: AnimatedPasswordInputProps) {
    const [showPassword, setShowPassword] = useState(false);
    
    const strValue = (value as string) || '';
    const chars = strValue.split('');

    return (
        <div className={wrapperClassName}>
            <style dangerouslySetInnerHTML={{__html: `
                .apio-animated-pwd:-webkit-autofill,
                .apio-animated-pwd:-webkit-autofill:hover, 
                .apio-animated-pwd:-webkit-autofill:focus, 
                .apio-animated-pwd:-webkit-autofill:active {
                    transition: background-color 5000s ease-in-out 0s, color 5000s ease-in-out 0s !important;
                }
            `}} />
            {/* The actual native input */}
            <input
                {...props}
                className={`apio-animated-pwd ${props.className || ''}`}
                type={showPassword ? "text" : "password"}
                value={strValue}
                onChange={onChange}
                suppressHydrationWarning
                style={{
                    ...props.style,
                    color: 'transparent',
                    caretColor: '#e5e7eb', 
                    zIndex: 2,
                    position: 'relative',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    width: '100%',
                    height: '100%',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    letterSpacing: 'inherit',
                }}
            />

            {/* The Visual Overlay */}
            <div 
                aria-hidden="true" 
                style={{ 
                    position: 'absolute', 
                    top: 0, left: 0, bottom: 0, right: '40px',
                    pointerEvents: 'none', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '0 1rem', // Match .input padding-left
                    color: strValue.length > 0 ? 'inherit' : 'rgba(107, 107, 107, 0.45)', // placeholder color
                    zIndex: 1,
                    overflow: 'hidden',
                    whiteSpace: 'pre',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    letterSpacing: 'inherit',
                }}
            >
                {strValue.length === 0 ? (
                    <span>{placeholder}</span>
                ) : (
                    chars.map((char, i) => {
                        // Delay direction based on state
                        // If showing, animate left-to-right. If hiding, right-to-left.
                        const delay = showPassword ? i * 0.02 : (chars.length - 1 - i) * 0.02;

                        return (
                            <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
                                {/* The Dot */}
                                <motion.span
                                    initial={false}
                                    animate={{ 
                                        opacity: showPassword ? 0 : 1, 
                                        y: showPassword ? 8 : 0, 
                                        filter: showPassword ? 'blur(2px)' : 'blur(0px)' 
                                    }}
                                    transition={{ delay, duration: 0.2 }}
                                    style={{ position: 'absolute', left: 0, top: 0 }}
                                >
                                    •
                                </motion.span>
                                
                                {/* The Actual Character */}
                                <motion.span
                                    initial={false}
                                    animate={{ 
                                        opacity: showPassword ? 1 : 0, 
                                        y: showPassword ? 0 : -8, 
                                        filter: showPassword ? 'blur(0px)' : 'blur(2px)' 
                                    }}
                                    transition={{ delay, duration: 0.2 }}
                                    style={{ position: 'absolute', left: 0, top: 0 }}
                                >
                                    {char}
                                </motion.span>
                                
                                {/* Spacer to keep exact width in flow */}
                                <span style={{ opacity: 0, pointerEvents: 'none', display: 'inline-block' }}>
                                    {showPassword ? char : '•'}
                                </span>
                            </span>
                        );
                    })
                )}
            </div>

            {/* Eye Button */}
            <div suppressHydrationWarning style={{ position: 'absolute', right: '6px', zIndex: 3, display: 'flex', alignItems: 'center', height: '100%' }}>
                <AnimatedEye isVisible={showPassword} onClick={() => setShowPassword(!showPassword)} />
            </div>
        </div>
    );
}
