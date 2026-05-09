import { promises as dns } from 'dns';

// ── Disposable / Temporary email domain blocklist ─────────────────────────────
// Covers the most common throwaway email services.
// Add more as you discover them.
const DISPOSABLE_DOMAINS = new Set([
  // ── Mailinator family ──
  'mailinator.com',
  'trashmail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'guerrillamail.info',
  // ── Temp-mail family ──
  'temp-mail.org',
  'tempmail.com',
  'tempmail.net',
  'temp-mail.io',
  'tempr.email',
  'tempinbox.com',
  'tempmailaddress.com',
  // ── 10-minute mail ──
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '10minutemail.de',
  '10minutemail.co.uk',
  '10minemail.com',
  // ── YOPmail ──
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  // ── Throw Away Mail ──
  'throwam.com',
  'throwam.net',
  'throwaway.email',
  // ── Fake / Invalid ──
  'fakeinbox.com',
  'fakemailgenerator.com',
  'fakemail.net',
  'mailnull.com',
  'mailnesia.com',
  'mailnull.com',
  // ── Sharklasers / Guerrilla ──
  'sharklasers.com',
  'grr.la',
  'guerrillamailblock.com',
  'spam4.me',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',
  // ── Discard.email ──
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  // ── Spamex ──
  'spam.la',
  'spamex.com',
  // ── GishPuppy ──
  'gishpuppy.com',
  // ── Mailexpire ──
  'mailexpire.com',
  // ── SpamSalad ──
  'spamsalad.in',
  // ── Getairmail ──
  'getairmail.com',
  // ── Jetable ──
  'jetable.fr.nf',
  'jetable.net',
  'jetable.org',
  // ── Nwldx ──
  'nwldx.com',
  // ── Trashmail ──
  'trashmail.at',
  'trashmail.io',
  'trashmail.me',
  'trashmail.net',
  'trashmail.xyz',
  // ── Maildrop ──
  'maildrop.cc',
  // ── Anonaddy ──
  'anonaddy.com',
  'anonaddy.me',
  // ── Cock.li ──
  'cock.li',
  'airmail.cc',
  'cumallover.me',
  'dicksinhisan.us',
  'tfwno.gf',
  'waifu.club',
  // ── Others ──
  'mailnull.com',
  'spamfree24.org',
  'mytrashmail.com',
  'spaml.de',
  'spaml.com',
  'mt2015.com',
  'mt2009.com',
  'courriel.fr.nf',
  'trash-mail.at',
  'trashdevil.com',
  'inoutmail.de',
  'inoutmail.eu',
  'inoutmail.info',
  'inoutmail.net',
  'einrot.com',
  'chogmail.com',
  'mail-filter.com',
  'objectmail.com',
  'rejectmail.com',
  'opayq.com',
  'shortmail.net',
  'vomoto.com',
  'iroid.com',
  'boximail.com',
  'clrmail.com',
  'fromru.com',
  'binkmail.com',
  'boxformail.in',
  'nomail.pw',
  'throwam.com',
  'crapmail.org',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',
]);

// ── Free webmail domains (allowed by default — remove if you want business-only) ──
// Comment this set out and return false below if you want to block free emails too.
// const FREE_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', ...]);

// ── Validation result ─────────────────────────────────────────────────────────
export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates an email address:
 *  1. Basic format check (regex)
 *  2. Disposable domain blocklist
 *  3. DNS MX record check (confirms domain can receive email)
 */
export async function validateEmail(
  email: string,
): Promise<EmailValidationResult> {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required.' };
  }

  const normalized = email.trim().toLowerCase();

  // 1. Basic format check
  const FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!FORMAT_RE.test(normalized)) {
    return { valid: false, reason: 'Please enter a valid email address.' };
  }

  const domain = normalized.split('@')[1];

  // 2. Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason:
        'Disposable email addresses are not allowed. Please use a real email.',
    };
  }

  // 3. DNS MX record check — confirms domain actually receives email
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return {
        valid: false,
        reason: `The domain "${domain}" does not have email configured. Please use a valid email address.`,
      };
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    // Only hard-reject when the domain definitively doesn't exist or has no MX.
    // For timeouts / network issues we fail open to avoid blocking real users.
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'ESERVFAIL') {
      return {
        valid: false,
        reason: `The domain "${domain}" does not exist or cannot receive emails. Please check your email address.`,
      };
    }
    // Transient error (ETIMEOUT, ECONNREFUSED, etc.) → allow through
  }

  return { valid: true };
}
