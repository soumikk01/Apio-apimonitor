'use client';

import { animate, motion, useMotionValue, type AnimationPlaybackControls } from 'motion/react';
import { useEffect, useRef, useState, useId, ButtonHTMLAttributes } from 'react';
import styles from './GooeyButton.module.scss';

interface GooeyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    icon?: React.ReactNode;
    wrapperClassName?: string;
    disableGooeyFilter?: boolean;
}

const GooeyButton = ({ children, className = '', wrapperClassName = '', isLoading, icon, disableGooeyFilter, onClick, ...props }: GooeyButtonProps) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const displacementScale = useMotionValue(0);
    const gooeyId = 'gooey-' + useId().replace(/:/g, '');
    const jelloId = 'jello-' + useId().replace(/:/g, '');

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setMousePosition({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                });
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (containerRef.current && e.touches[0]) {
                const rect = containerRef.current.getBoundingClientRect();
                setMousePosition({
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top,
                });
            }
        };

        const unsubscribe = displacementScale.on('change', (latest) => {
            if (displacementRef.current) {
                displacementRef.current.scale.baseVal = latest;
            }
        });

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            unsubscribe();
        };
    }, [displacementScale]);

    // ── Reset hover on every mount (fixes reused-instance bug after client-side navigation) ──
    useEffect(() => {
        setIsHovered(false);
    }, []);

    useEffect(() => {
        let controls: AnimationPlaybackControls | undefined;
        if (isHovered && !isLoading && !props.disabled) {
            controls = animate(displacementScale, [0, 8, -6, 5, -4, 0], {
                duration: 3,
                ease: 'easeInOut',
                repeat: Infinity,
            });
        } else {
            animate(displacementScale, 0, { duration: 0.3 });
        }
        return () => controls?.stop();
    }, [isHovered, isLoading, props.disabled, displacementScale]);

    const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isLoading || props.disabled) return;
        
        animate(displacementScale, [0, 20, -30, 20, -10, 0], {
            duration: 0.6,
            ease: 'easeInOut',
        });
        
        if (onClick) onClick(e);
    };

    return (
        <div className={`${styles.wrapper} ${wrapperClassName}`}>
            <svg className={styles.hiddenSvg} aria-hidden="true">
                <defs>
                    <filter id={gooeyId}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0
                                    0 1 0 0 0
                                    0 0 1 0 0
                                    0 0 0 18 -7"
                            result="gooey"
                        />
                        <feBlend in="SourceGraphic" in2="gooey" />
                    </filter>
                    <filter id={jelloId} x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="10" result="noise" />
                        <feDisplacementMap
                            ref={displacementRef}
                            in="SourceGraphic"
                            in2="noise"
                            scale="0"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>
                </defs>
            </svg>

            <div
                ref={containerRef}
                style={!disableGooeyFilter ? { filter: `url(#${gooeyId})` } : undefined}
                className={`${styles.container} ${disableGooeyFilter ? styles.noGooey : ''}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {!isLoading && !props.disabled && (
                    <motion.div
                        className={styles.blob}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                            x: mousePosition.x - 16,
                            y: mousePosition.y - 16,
                            opacity: isHovered ? 1 : 0,
                            scale: isHovered ? 1.5 : 0.2,
                            filter: disableGooeyFilter ? 'blur(12px)' : 'none'
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 80, opacity: { duration: 0.2 } }}
                    />
                )}

                <button
                    onClick={handleButtonClick}
                    style={{ filter: `url(#${jelloId})` }}
                    className={`${styles.button} ${isLoading ? styles.loadingBtn : ''} ${className}`}
                    disabled={isLoading || props.disabled}
                    suppressHydrationWarning
                    {...props}
                >
                    {icon && !isLoading && !props.disabled ? (
                        <motion.div 
                            style={{ display: 'flex', alignItems: 'center' }}
                            initial={false}
                            animate={{ gap: isHovered ? '0.5rem' : '0rem' }}
                        >
                            <motion.div
                                initial={false}
                                animate={{ 
                                    width: isHovered ? 18 : 0, 
                                    opacity: isHovered ? 1 : 0,
                                    scale: isHovered ? 1 : 0,
                                }}
                                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                                style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}
                            >
                                {icon}
                            </motion.div>
                            <span>{children}</span>
                        </motion.div>
                    ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>{children}</span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default GooeyButton;
