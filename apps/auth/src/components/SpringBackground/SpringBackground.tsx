/**
 * Shared sparkle/spring background decoration.
 * Used in check-email and verify-email pages.
 */
import fp from '@/features/auth/components/ForgotPasswordPage/ForgotPasswordPage.module.scss';

export default function SpringBackground() {
  return (
    <div className={fp.springBg} aria-hidden="true">
      <svg className={`${fp.sparkle} ${fp.sp1}`} viewBox="0 0 20 20" fill="none">
        <path d="M10,1 L11.2,8.8 L19,10 L11.2,11.2 L10,19 L8.8,11.2 L1,10 L8.8,8.8 Z" fill="#1A1A1A" opacity="0.65"/>
      </svg>
      <svg className={`${fp.sparkle} ${fp.sp2}`} viewBox="0 0 14 14" fill="none">
        <path d="M7,1 L7.8,6.2 L13,7 L7.8,7.8 L7,13 L6.2,7.8 L1,7 L6.2,6.2 Z" fill="#1A1A1A" opacity="0.5"/>
      </svg>
      <svg className={`${fp.sparkle} ${fp.sp3}`} viewBox="0 0 18 18" fill="none">
        <path d="M9,1.5 L10,7.8 L16.5,9 L10,10.2 L9,16.5 L8,10.2 L1.5,9 L8,7.8 Z" fill="#7C6050" opacity="0.4"/>
      </svg>
      <svg className={`${fp.sparkle} ${fp.sp4}`} viewBox="0 0 10 10" fill="none">
        <path d="M5,0.5 L5.6,4.4 L9.5,5 L5.6,5.6 L5,9.5 L4.4,5.6 L0.5,5 L4.4,4.4 Z" fill="#1A1A1A" opacity="0.45"/>
      </svg>
      <svg className={`${fp.sparkle} ${fp.sp5}`} viewBox="0 0 16 16" fill="none">
        <path d="M8,1 L9,6.8 L15,8 L9,9.2 L8,15 L7,9.2 L1,8 L7,6.8 Z" fill="#1A1A1A" opacity="0.55"/>
      </svg>
    </div>
  );
}
