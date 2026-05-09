'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import styles from './ApioTypeWriter.module.scss';

// ── Timing constants ──────────────────────────────────────────────────────────
const LETTER_DELAY   = 0.028;   // stagger per character
const BOX_DURATION   = 0.12;    // cursor-box flash duration
const FADE_DELAY     = 4.5;     // seconds before the whole line fades out
const FADE_DURATION  = 0.3;     // fade out duration
const SWAP_DELAY     = 5800;    // ms between phrases

// ── Apio-themed API monitoring queries ───────────────────────────────────────
const QUERIES = [
  'why is my /payments endpoint spiking at 3 AM?',
  'how do i detect cascading failures across services?',
  'which endpoints have the highest p99 latency today?',
  'set an alert when error rate exceeds 2% on /checkout',
  'show me all 5xx errors from the last 30 minutes',
  'which api key is hitting my rate limit right now?',
  'how do i monitor webhook delivery success rates?',
  'detect anomalies in my /auth/login response times',
];

// ── Dashed SVG arrow that points to the text ─────────────────────────────────
const ArrowDecoration = () => (
  <div className={styles.arrowWrap} aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
      <defs>
        <marker
          id="apio-arrow-head"
          markerWidth={5} markerHeight={5}
          refX="2.5" refY="2.5"
          viewBox="0 0 5 5"
          orient="auto"
        >
          <polygon points="0,5 1.667,2.5 0,0 5,2.5" fill="rgba(255,255,255,0.25)" />
        </marker>
      </defs>

      {/* dashed background path */}
      <path
        strokeWidth={8}
        stroke="rgba(255,255,255,0.18)"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="10 22"
        transform="rotate(20, 400, 400)"
        d="M260 195 Q620 280 445 368 Q-160 705 615 540"
        markerEnd="url(#apio-arrow-head)"
      />

      {/* glowing dot that travels the path */}
      <path
        strokeWidth={14}
        stroke="rgba(99,179,237,0.55)"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 103"
        strokeDashoffset={-100}
        pathLength={100}
        transform="rotate(20, 400, 400)"
        d="M260 195 Q620 280 445 368 Q-160 705 615 540"
      />
    </svg>
  </div>
);

// ── Single animated character ─────────────────────────────────────────────────
interface CharProps {
  ch: string;
  index: number;
  seqKey: number;
}

const AnimChar = ({ ch, index, seqKey }: CharProps) => (
  <motion.span
    key={`${seqKey}-${index}`}
    className={styles.charOuter}
    initial={{ opacity: 1 }}
    animate={{ opacity: 0 }}
    transition={{ delay: FADE_DELAY, duration: FADE_DURATION, ease: 'easeInOut' }}
  >
    {/* the character itself — appears with stagger */}
    <motion.span
      className={styles.charInner}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * LETTER_DELAY, duration: 0 }}
    >
      {ch}
    </motion.span>

    {/* cursor block that flashes then disappears */}
    <motion.span
      className={styles.cursorBlock}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{
        delay: index * LETTER_DELAY,
        times: [0, 0.1, 1],
        duration: BOX_DURATION,
      }}
    />
  </motion.span>
);

// ── Main component ────────────────────────────────────────────────────────────
const ApioTypeWriter = () => {
  const [sequence, setSequence] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setSequence((prev) => (prev + 1) % QUERIES.length),
      SWAP_DELAY,
    );
    return () => clearInterval(id);
  }, []);

  const currentText = QUERIES[sequence] ?? '';

  return (
    <div className={styles.root}>
      <ArrowDecoration />

      <div className={styles.textWrap}>
        {/* Label prefix */}
        <p className={styles.line}>
          <span className={styles.squareDot} />
          <span className={styles.prefix}>Query: </span>

          <AnimatePresence mode="wait">
            <motion.span
              key={sequence}
              className={styles.phrase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {currentText.split('').map((ch, i) => (
                <AnimChar key={`${sequence}-${i}`} ch={ch} index={i} seqKey={sequence} />
              ))}
            </motion.span>
          </AnimatePresence>
        </p>

        {/* subtle sub-label */}
        <motion.p
          className={styles.subLabel}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          Real-time API intelligence, powered by Apio
        </motion.p>
      </div>
    </div>
  );
};

export { ApioTypeWriter };
