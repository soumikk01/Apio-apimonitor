'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
// lucide-react icons imported on demand — none currently referenced in JSX
import { SiNodedotjs, SiPython, SiGo } from "react-icons/si";
import { FaJava } from "react-icons/fa6";
import styles from './LandingPage.module.scss';
import { ArchitectureDiagram } from './ArchitectureDiagram';
import DashboardMockSection from './DashboardMockSection';
import BentoSection from './BentoSection';

const CanvasBackground = dynamic(() => import('./CanvasBackground'), { ssr: false });

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? 'http://localhost:3002';

// Lazy load TerminalDemo — it starts setInterval timers immediately on mount.
// Deferring it prevents timer overhead during the critical render path.
const TerminalDemo = dynamic(() => import('./TerminalDemo'), {
  ssr: false,
  loading: () => <div className={styles.terminal} style={{ minHeight: 200 }} />,
});

/* ─────────────────────────────────────────────
   Scroll-reveal hook
───────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ─────────────────────────────────────────────
   Magnetic button hook (subtle pull-toward-cursor)
───────────────────────────────────────────── */
function useMagnetic(strength = 0.3) {
  const ref = useRef<HTMLElement | null>(null);

  const onMove = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  }, [strength]);

  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = '';
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('mousemove', onMove as EventListener);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove as EventListener);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [onMove, onLeave]);

  return ref;
}

/* ─────────────────────────────────────────────
   Animated counter
───────────────────────────────────────────── */
function useCounter(target: string, running: boolean) {
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!running) return;
    const numeric = parseFloat(target.replace(/[^0-9.]/g, ''));
    const suffix  = target.replace(/[0-9.]/g, '');
    if (isNaN(numeric)) { 
      const t = setTimeout(() => setDisplay(target), 0); 
      return () => clearTimeout(t); 
    }
    const start = Date.now();
    const dur   = 1400;
    let raf: number;
    const tick = () => {
      const t = Math.min((Date.now() - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val   = numeric * eased;
      const fmt   = numeric < 10 ? val.toFixed(2) : Math.round(val).toString();
      setDisplay(`${fmt}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, target]);

  return display;
}

/* TerminalDemo is now in TerminalDemo.tsx and lazy-loaded above */

/* ─────────────────────────────────────────────
   Spring background (unchanged)
───────────────────────────────────────────── */
const SpringBackground = () => (
  <div className={styles.springBg} aria-hidden="true">
    {/* Floral branches and petals removed completely */}

    {[styles.sp1,styles.sp2,styles.sp3,styles.sp4,styles.sp5,styles.sp6].map((s,i) => (
      <svg key={i} className={`${styles.sparkle} ${s}`} viewBox="0 0 20 20" fill="none">
        <path d="M10,1 L11.2,8.8 L19,10 L11.2,11.2 L10,19 L8.8,11.2 L1,10 L8.8,8.8 Z" fill="currentColor" opacity="0.5"/>
      </svg>
    ))}

    <svg className={styles.curly1} viewBox="0 0 70 35" fill="none">
      <path d="M5,28 C12,6 22,6 28,18 C34,30 44,30 50,18 C56,6 62,8 66,14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.18"/>
    </svg>
    <svg className={styles.curly2} viewBox="0 0 55 28" fill="none">
      <path d="M3,22 C9,5 17,5 22,13 C27,22 35,22 40,13 C45,4 51,7 53,13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.15"/>
    </svg>
    <svg className={styles.dots1} viewBox="0 0 60 20" fill="none">
      <circle cx="5" cy="10" r="2.5" fill="currentColor" opacity="0.22"/>
      <circle cx="18" cy="10" r="1.8" fill="currentColor" opacity="0.18"/>
      <circle cx="31" cy="10" r="2.5" fill="currentColor" opacity="0.22"/>
      <circle cx="44" cy="10" r="1.8" fill="currentColor" opacity="0.18"/>
    </svg>
    <svg className={styles.dots2} viewBox="0 0 40 14" fill="none">
      <circle cx="4" cy="7" r="2" fill="currentColor" opacity="0.2"/>
      <circle cx="15" cy="7" r="1.5" fill="currentColor" opacity="0.16"/>
      <circle cx="26" cy="7" r="2" fill="currentColor" opacity="0.2"/>
      <circle cx="37" cy="7" r="1.5" fill="currentColor" opacity="0.16"/>
    </svg>
  </div>
);

/* ─────────────────────────────────────────────
   SVG illustrations (unchanged)
───────────────────────────────────────────── */
const IlluApiGlobe = () => (
  <svg viewBox="0 0 100 100" fill="none" className={styles.cardSvg}>
    <path d="M20,70 Q20,55 35,55 Q40,40 55,40 Q70,40 75,55 Q90,55 90,70 Z" fill="#ffffff" opacity="0.5"/>
    <circle cx="55" cy="52" r="22" fill="#E8F4FF" stroke="#1A1A1A" strokeWidth="2.5"/>
    <ellipse cx="55" cy="52" rx="22" ry="10" stroke="#1A1A1A" strokeWidth="1.5" opacity="0.3"/>
    <line x1="55" y1="30" x2="55" y2="74" stroke="#1A1A1A" strokeWidth="1.5" opacity="0.3"/>
    <circle cx="77" cy="52" r="4" fill="#A8D8FF" stroke="#1A1A1A" strokeWidth="1.5"/>
    <path d="M47,52 Q51,56 55,52" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M59,52 Q63,56 67,52" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="45" cy="56" r="3" fill="#FFB38A" opacity="0.6"/>
    <circle cx="69" cy="56" r="3" fill="#FFB38A" opacity="0.6"/>
    <path d="M40,42 Q47,24 63,28 Q60,37 66,42 Z" fill="#6B6B6B" stroke="#1A1A1A" strokeWidth="2" strokeLinejoin="round"/>
    <circle cx="63" cy="28" r="3.5" fill="#F6D55C" stroke="#1A1A1A" strokeWidth="1.5"/>
    <text x="55" y="82" textAnchor="middle" fill="#1A1A1A" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.7">99.99% uptime</text>
  </svg>
);

const IlluApiPulse = () => (
  <svg viewBox="0 0 100 100" fill="none" className={styles.cardSvg}>
    <path d="M25,62 Q20,48 35,43 Q40,28 55,33 Q70,28 76,43 Q91,48 86,62 Z" fill="#ffffff" stroke="#1A1A1A" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M31,52 Q55,22 79,52" fill="none" stroke="#6B6B6B" strokeWidth="3"/>
    <rect x="24" y="46" width="10" height="14" rx="5" fill="#B8F2D6" stroke="#1A1A1A" strokeWidth="2"/>
    <rect x="79" y="46" width="10" height="14" rx="5" fill="#B8F2D6" stroke="#1A1A1A" strokeWidth="2"/>
    <path d="M43,52 Q47,49 51,52" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M60,52 Q64,49 68,52" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="40" cy="56" r="3" fill="#FFB38A" opacity="0.6"/>
    <circle cx="71" cy="56" r="3" fill="#FFB38A" opacity="0.6"/>
    <path d="M17,38 L22,33 L22,43 Z" fill="#1A1A1A"/>
    <path d="M22,33 L27,36" stroke="#1A1A1A" strokeWidth="1.5"/>
    <path d="M84,28 L89,23 L89,36 Z" fill="#1A1A1A"/>
    <path d="M89,23 L95,26 L95,33" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
    <text x="55" y="85" textAnchor="middle" fill="#1A1A1A" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.7">Real-time alerts</text>
  </svg>
);

const IlluApiShield = () => (
  <svg viewBox="0 0 100 100" fill="none" className={styles.cardSvg}>
    <path d="M35,50 Q50,38 65,50 L70,68 Q50,82 30,68 Z" fill="#F6D55C" stroke="#1A1A1A" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M30,56 Q20,46 34,46" fill="none" stroke="#F6D55C" strokeWidth="6" strokeLinecap="round"/>
    <path d="M30,56 Q20,46 34,46" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M70,52 Q80,57 70,70" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M40,45 C40,36 62,36 62,45 Z" fill="#F6D55C" stroke="#1A1A1A" strokeWidth="2"/>
    <circle cx="51" cy="37" r="3" fill="#1A1A1A"/>
    <path d="M50,55 L58,59 L58,65 L50,69 L42,65 L42,59 Z" fill="#FFB38A" stroke="#1A1A1A" strokeWidth="1.5"/>
    <path d="M47,62 L49.5,64.5 L54,59" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M43,32 Q46,22 40,26" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
    <path d="M51,28 Q54,18 48,22" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
    <text x="50" y="92" textAnchor="middle" fill="#1A1A1A" fontSize="8" fontWeight="700" fontFamily="Inter,sans-serif" opacity="0.7">Zero breaches</text>
  </svg>
);

/* ─────────────────────────────────────────────
   Stat item with counter
───────────────────────────────────────────── */
function StatItem({ v, l }: { v: string; l: string }) {
  const { ref, visible } = useInView(0.3);
  const display = useCounter(v, visible);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`${styles.statItem} ${visible ? styles.statVisible : ''}`}
    >
      <span className={styles.statVal}>{display}</span>
      <span className={styles.statLbl}>{l}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function LandingPage() {
  const [dark, setDark] = useState(false);
  
  // Custom Cursor State
  const [cursorText, setCursorText] = useState('');
  const cursorRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }
  }, []);

  const handleMouseEnterIcon = (e: React.MouseEvent, text: string) => {
    setCursorText(text);
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }
  };

  const handleMouseLeaveIcon = () => {
    setCursorText('');
  };

  // Magnetic refs for CTA buttons
  const magPrimary   = useMagnetic(0.25);
  const magSecondary = useMagnetic(0.25);
  const magToggle    = useMagnetic(0.35);

  // ── Scroll restoration fix & Pill Navbar ──────────────────────────────────────
  const [isScrolled, setIsScrolled] = useState(false);
  const pageContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the actual container element to top
    if (pageContentRef.current) {
      pageContentRef.current.scrollTop = 0;
    }
    // Also disable browser-level scroll restoration as a safety net
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const handleScroll = () => {
      if (!pageContentRef.current) return;
      setIsScrolled(pageContentRef.current.scrollTop > 50);
    };

    const el = pageContentRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Scroll-reveal sections
  const { ref: badgeRef, visible: badgeVisible } = useInView(0.2);
  const { ref: headlineRef, visible: headlineVisible } = useInView(0.2);
  const { ref: subRef, visible: subVisible } = useInView(0.2);
  const { ref: ctasRef, visible: ctasVisible } = useInView(0.2);
  const { ref: terminalRef, visible: terminalVisible } = useInView(0.15);
  const { ref: cardsRef, visible: cardsVisible } = useInView(0.1);
  const { ref: statsRef, visible: statsVisible } = useInView(0.15);
  const { ref: footerRef, visible: footerVisible } = useInView(0.1);

  return (
    <div className={`${styles.layout}${dark ? ' dark ' + styles.dark : ''}`}>
      {/* ── NAVBAR ── */}
      <header className={`${styles.navWrap} ${isScrolled ? styles.scrolledWrap : ''}`}>
        <div className={`${styles.logoAbsolute} ${isScrolled ? styles.scrolledHidden : ''}`}>
          <svg viewBox="0 0 20 20" fill="none" width="22" height="22" className={styles.logoSvg}>
            <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <circle cx="10" cy="10" r="3" fill="currentColor"/>
          </svg>
          <span className={styles.logoMark}>
            <span className={styles.logoApi}>Api</span>
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={styles.logoAiSvg}>
              {/* Outer O ring */}
              <path d="M 10 53 A 40 40 0 0 1 63 12" />
              <path d="M 85 30 A 40 40 0 0 1 18 73" />
              <circle cx="12" cy="64" r="4.5" fill="currentColor" stroke="none" />
              {/* Inner a */}
              <path d="M 54 60 A 12 12 0 1 1 30 60 A 12 12 0 1 1 54 60" />
              <path d="M 54 48 L 54 66 C 54 72, 57 72, 60 72" />
              {/* Inner i — hexagon dot echoes the main logo mark */}
              <path d="M 75 35 L 75 72" />
              <polygon points="75,12 80,15.5 80,22.5 75,26 70,22.5 70,15.5" fill="currentColor" stroke="none" />
            </svg>
          </span>
        </div>
        <nav className={`${styles.nav} ${styles.navIn} ${isScrolled ? styles.navScrolled : ''}`}>
          <div className={styles.navLinks}>
            {['Products','Solutions','Pricing','Company','Support','Docs'].map((link, i) => (
              <Link key={link} href={link === 'Docs' ? DOCS_URL : link === 'Solutions' ? '#features' : link === 'Pricing' ? '#stats' : '#'}
                className={styles.navLink}
                style={{ animationDelay: `${0.05 * i}s` }}>
                {link}
              </Link>
            ))}
          </div>
          <div className={`${styles.navRight} ${isScrolled ? styles.scrolledHidden : ''}`}>
            <Link href={`${AUTH_URL}/login`} className={styles.navPill}>Try for free</Link>
            <div className={styles.navDivider} />
            <button
              id="theme-toggle"
              ref={magToggle as React.RefObject<HTMLButtonElement>}
              className={styles.themeToggle}
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              {dark ? (
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2"/>
                  {[0,60,120,180,240,300].map((deg) => (
                    <line key={deg} x1="12" y1="2" x2="12" y2="5"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      transform={`rotate(${deg} 12 12)`}/>
                  ))}
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </nav>
      </header>

      <div className={styles.pageContent} ref={pageContentRef}>
        <div className={styles.noiseOverlay} />
        <CanvasBackground />
        <SpringBackground />

      {/* ── HERO ── */}
      <main className={styles.hero}>

        {/* Badge */}
        <div
          ref={badgeRef as React.RefObject<HTMLDivElement>}
          className={`${styles.socialProof} ${badgeVisible ? styles.fadeUp : styles.hidden}`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className={styles.avatarRow}>
            {['#A8D8FF','#B8F2D6','#FFB38A','#F6D55C'].map((color, i) => (
              <div key={i} className={styles.avatar} style={{ backgroundColor: color, zIndex: 4 - i }}>
                <svg viewBox="0 0 20 20" fill="none" width="11" height="11" opacity="0.65">
                  <circle cx="10" cy="7" r="4" fill="#1A1A1A"/>
                  <path d="M4,18 Q10,12 16,18" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
            ))}
          </div>
          <span className={styles.socialText}>Over <strong>1k</strong> engineers online</span>
        </div>

        {/* Headline */}
        <h1
          ref={headlineRef as React.RefObject<HTMLHeadingElement>}
          className={`${styles.headline} ${headlineVisible ? styles.fadeUp : styles.hidden}`}
          style={{ animationDelay: '0.2s' }}
        >
          Monitor Your APIs<br />
          <span className={styles.hlAccent}>in Real-Time</span>
        </h1>

        {/* Sub */}
        <p
          ref={subRef as React.RefObject<HTMLParagraphElement>}
          className={`${styles.sub} ${subVisible ? styles.fadeUp : styles.hidden}`}
          style={{ animationDelay: '0.3s' }}
        >
          Instantly track uptime, errors, and performance with a single command.<br />
          The command center for high-performance engineering teams.
        </p>

        {/* CTAs */}
        <div
          ref={ctasRef as React.RefObject<HTMLDivElement>}
          className={`${styles.ctaRow} ${ctasVisible ? styles.fadeUp : styles.hidden}`}
          style={{ animationDelay: '0.42s' }}
        >
          <Link
            href={`${AUTH_URL}/login`}
            ref={magPrimary as React.RefObject<HTMLAnchorElement>}
            className={styles.ctaPrimary}
            id="cta-get-started"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
              <polygon points="5,3 13,8 5,13"/>
            </svg>
            Get Started
            <span className={styles.ctaShine} aria-hidden="true" />
          </Link>
          <a
            href="#terminal-demo"
            ref={magSecondary as React.RefObject<HTMLAnchorElement>}
            className={styles.ctaSecondary}
            id="cta-view-demo"
          >
            View Demo
            <svg viewBox="0 0 16 16" fill="none" width="11" height="11">
              <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <polyline points="9,4 13,8 9,12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </a>
        </div>

        {/* Architecture Diagram */}
        <div
          className={`${styles.diagramWrap} ${terminalVisible ? styles.fadeUp : styles.hidden}`}
          style={{ animationDelay: '0.45s', marginBottom: '40px', width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'center' }}
        >
          <ArchitectureDiagram dark={dark} isVisible={terminalVisible} />
        </div>

        {/* Integration Frameworks */}
        <div
          className={`${styles.integrationRow} ${terminalVisible ? styles.fadeUp : styles.hidden}`}
          style={{ animationDelay: '0.6s' }}
        >
          <div className={styles.integrationText}>
            Works Across All Major Backend<br />
            <span>Languages & Frameworks</span>
            <div className={styles.integrationSubtext}>
              More agents coming soon (PHP, Rust, .NET...)
            </div>
          </div>
          <div 
            className={styles.integrationIcons}
            onMouseMove={handleMouseMove}
          >
            <div 
              className={styles.logoWrapper} 
              onMouseEnter={(e) => handleMouseEnterIcon(e, "Node Agent")}
              onMouseLeave={handleMouseLeaveIcon}
            >
              <SiNodedotjs size={48} aria-label="Node.js" />
            </div>
            <div 
              className={styles.logoWrapper} 
              onMouseEnter={(e) => handleMouseEnterIcon(e, "Python Agent")}
              onMouseLeave={handleMouseLeaveIcon}
            >
              <SiPython size={48} aria-label="Python" />
            </div>
            <div 
              className={styles.logoWrapper} 
              onMouseEnter={(e) => handleMouseEnterIcon(e, "Java Agent")}
              onMouseLeave={handleMouseLeaveIcon}
            >
              <FaJava size={48} aria-label="Java" />
            </div>
            <div 
              className={styles.logoWrapper} 
              onMouseEnter={(e) => handleMouseEnterIcon(e, "Go Agent")}
              onMouseLeave={handleMouseLeaveIcon}
            >
              <div className={styles.goIconAdjust}>
                <SiGo size={56} aria-label="Go" />
              </div>
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div
          id="terminal-demo"
          ref={terminalRef as React.RefObject<HTMLDivElement>}
          className={`${styles.terminalWrap} ${terminalVisible ? styles.fadeUp : styles.hidden}`}
          style={{ animationDelay: '0.55s' }}
        >
          <TerminalDemo />
        </div>

        {/* Feature cards */}
        <div
          ref={cardsRef as React.RefObject<HTMLDivElement>}
          className={`${styles.cardRow} ${cardsVisible ? styles.cardsIn : ''}`}
          id="features"
        >
          {[
            { cls: styles.cardBlue,   delay: '0s',    Illu: IlluApiGlobe,  tag: 'Auto Detection', title: 'Always Online',    desc: 'Our engine crawls your infrastructure to identify and map all active API routes automatically.' },
            { cls: styles.cardGreen,  delay: '0.12s', Illu: IlluApiPulse,  tag: 'Live Monitoring', title: 'Real-Time Pulse', desc: 'Sub-second precision on uptime and status changes. Get notified before your users notice.' },
            { cls: styles.cardOrange, delay: '0.24s', Illu: IlluApiShield, tag: 'Secure Vault',     title: 'Zero Breach',    desc: 'P99 latency distribution across global regions. Identify bottlenecks and threats instantly.' },
          ].map(({ cls, delay, Illu, tag, title, desc }, i) => (
            <div
              key={i}
              className={`${styles.card} ${cls} ${i === 1 ? styles.cardCenter : ''}`}
              style={{ '--card-delay': delay } as React.CSSProperties}
            >
              <div className={styles.cardVisual}><Illu /></div>
              <div className={styles.cardBody}>
                <span className={styles.cardTag}>{tag}</span>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── PRODUCT DEMO (Terminal → Dashboard mock) ── */}
      <DashboardMockSection />

      {/* ── BENTO + FEATURES ── */}
      <BentoSection />

      {/* ── STATS ── */}
      <section
        id="stats"
        ref={statsRef as React.RefObject<HTMLElement>}
        className={`${styles.statsBar} ${statsVisible ? styles.statsIn : ''}`}
      >
        {[
          { v: '99.99%', l: 'Platform Uptime' },
          { v: '1.2B+',  l: 'Requests Scanned' },
          { v: '< 5ms',  l: 'Latency Overhead' },
          { v: '25+',    l: 'Global Nodes' },
        ].map((s) => <StatItem key={s.l} v={s.v} l={s.l} />)}
      </section>

      {/* ── FOOTER ── */}
      <footer
        ref={footerRef as React.RefObject<HTMLElement>}
        className={`${styles.footer} ${footerVisible ? styles.fadeUp : styles.hidden}`}
      >
        <span className={styles.footerCopy}>© 2025 Apio · apio.one</span>
        <div className={styles.footerLinks}>
          <a href="#" className={styles.footerLink}>Legal</a>
          <a href="#" className={styles.footerLink}>Docs</a>
          <Link href={`${AUTH_URL}/login`} className={styles.footerCta}>Initialize Session →</Link>
        </div>
      </footer>

      {/* Custom Figma-Style Cursor for Logos */}
      <div 
        ref={cursorRef}
        className={`${styles.customCursor} ${cursorText ? styles.visible : ''}`}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" className={styles.cursorArrow}>
          <path d="M0 0L16.4 7.27a.5.5 0 0 1 .08.9l-5.35 2.37a.5.5 0 0 0-.25.25L8.51 16.14a.5.5 0 0 1-.9-.08L0 0z" />
        </svg>
        <div className={styles.cursorTag}>{cursorText}</div>
      </div>
      </div>
    </div>
  );
}
