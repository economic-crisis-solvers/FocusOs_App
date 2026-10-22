/**
 * Phone Activity Tracker
 * Polls foreground app every 30s using UsageStatsManager.
 * If distracting app detected, sends POST /api/phone-activity to backend.
 * Backend decides whether to broadcast phone_distraction event.
 */
import { getForegroundApp, isScreenOn, hasUsageAccess } from '../../modules/usage-stats';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const NUDGE_THRESHOLD_MINUTES = 1.5; // Send to backend after 1.5 min on distracting app

// ── App category map ──────────────────────────────────────────────
// Maps known package names to categories
const APP_CATEGORIES: Record<string, string> = {
  // Social
  'com.instagram.android': 'social',
  'com.facebook.katana': 'social',
  'com.facebook.orca': 'social',
  'com.twitter.android': 'social',
  'com.snapchat.android': 'social',
  'com.linkedin.android': 'social',
  'com.pinterest': 'social',
  'com.reddit.frontpage': 'social',
  'com.tumblr': 'social',
  'org.telegram.messenger': 'social',
  'com.discord': 'social',

  // Messaging (social-adjacent)
  'com.whatsapp': 'social',
  'com.whatsapp.w4b': 'social',
  'com.viber.voip': 'social',

  // Entertainment
  'com.google.android.youtube': 'entertainment',
  'com.netflix.mediaclient': 'entertainment',
  'com.amazon.avod.thirdpartyclient': 'entertainment',
  'in.startv.hotstar': 'entertainment',
  'com.spotify.music': 'entertainment',
  'tv.twitch.android.app': 'entertainment',
  'com.zhiliaoapp.musically': 'entertainment', // TikTok
  'com.ss.android.ugc.trill': 'entertainment', // TikTok alternate
  'com.mxtech.videoplayer': 'entertainment',

  // Gaming
  'com.supercell.clashofclans': 'entertainment',
  'com.kiloo.subwaysurf': 'entertainment',
  'com.mojang.minecraftpe': 'entertainment',
  'com.activision.callofduty.shooter': 'entertainment',
  'com.pubg.imobile': 'entertainment',
  'com.dts.freefireth': 'entertainment',

  // Shopping (mild distraction)
  'com.amazon.mShop.android.shopping': 'entertainment',
  'com.flipkart.android': 'entertainment',
  'in.amazon.mShop.android.shopping': 'entertainment',
  'com.myntra.android': 'entertainment',

  // Work / productive (whitelist — won't trigger distraction)
  'com.google.android.gm': 'work',
  'com.microsoft.office.outlook': 'work',
  'com.slack': 'work',
  'com.microsoft.teams': 'work',
  'com.google.android.apps.docs': 'work',
  'com.google.android.apps.docs.editors.sheets': 'work',
  'com.google.android.apps.docs.editors.slides': 'work',
  'com.google.android.calendar': 'work',
  'com.microsoft.office.word': 'work',
  'com.microsoft.office.excel': 'work',
  'com.notion.id': 'work',
  'com.todoist': 'work',
  'com.google.android.keep': 'work',

  // Educational
  'com.duolingo': 'educational',
  'com.google.android.apps.classroom': 'educational',
  'us.zoom.videomeetings': 'educational',
  'com.udemy.android': 'educational',
  'org.coursera.android': 'educational',
  'com.linkedin.android.learning': 'educational',
};

// Categories that count as distracting
const DISTRACTING_CATEGORIES = ['social', 'entertainment'];

function categorizeApp(packageName: string): string {
  // Direct lookup
  if (APP_CATEGORIES[packageName]) {
    return APP_CATEGORIES[packageName];
  }
  // Heuristic: game-like packages
  if (packageName.includes('game') || packageName.includes('puzzle')) {
    return 'entertainment';
  }
  // Unknown — don't flag as distraction
  return 'unknown';
}

// ── Tracker state ─────────────────────────────────────────────────
let pollInterval: ReturnType<typeof setInterval> | null = null;
let currentDistractionStart: number | null = null;
let currentDistractionPackage: string | null = null;
let lastSentPackage: string | null = null;
let lastSentTime: number = 0;

type TrackerCallbacks = {
  getToken: () => Promise<string | null>;
  onPhoneDistraction: (pkg: string, category: string, minutes: number) => void;
  onPhoneClear: () => void;
};

let callbacks: TrackerCallbacks | null = null;

export function startPhoneActivityTracker(cbs: TrackerCallbacks) {
  if (pollInterval) return; // Already running
  callbacks = cbs;

  console.log('📱 Phone activity tracker started');

  pollInterval = setInterval(async () => {
    try {
      // Check if we have permission
      const hasAccess = await hasUsageAccess();
      if (!hasAccess) return;

      // Check if screen is on
      const screenOn = await isScreenOn();
      if (!screenOn) {
        // Screen off = not distracted on phone
        if (currentDistractionPackage) {
          currentDistractionPackage = null;
          currentDistractionStart = null;
          callbacks?.onPhoneClear();
        }
        return;
      }

      const app = await getForegroundApp();
      if (!app) {
        // On launcher/home or our own app — clear distraction
        if (currentDistractionPackage) {
          currentDistractionPackage = null;
          currentDistractionStart = null;
          callbacks?.onPhoneClear();
        }
        return;
      }

      const category = categorizeApp(app.packageName);
      const isDistraction = DISTRACTING_CATEGORIES.includes(category);

      if (isDistraction) {
        // Track how long on this distracting app
        if (currentDistractionPackage !== app.packageName) {
          // Switched to a new distracting app
          currentDistractionPackage = app.packageName;
          currentDistractionStart = Date.now();
        }

        const minutesOnApp = currentDistractionStart
          ? (Date.now() - currentDistractionStart) / 60_000
          : 0;

        // Notify UI immediately about phone distraction
        callbacks?.onPhoneDistraction(app.packageName, category, minutesOnApp);

        // Send to backend if past threshold + don't spam (max once per 60s per app)
        if (minutesOnApp >= NUDGE_THRESHOLD_MINUTES) {
          const now = Date.now();
          const shouldSend = lastSentPackage !== app.packageName ||
            (now - lastSentTime) > 60_000;

          if (shouldSend) {
            const token = await callbacks?.getToken();
            if (token) {
              sendPhoneActivity(token, app.packageName, category, minutesOnApp);
              lastSentPackage = app.packageName;
              lastSentTime = now;
            }
          }
        }
      } else {
        // Not on distracting app
        if (currentDistractionPackage) {
          currentDistractionPackage = null;
          currentDistractionStart = null;
          callbacks?.onPhoneClear();
        }
      }
    } catch (e) {
      console.log('Phone tracker poll error:', e);
    }
  }, POLL_INTERVAL_MS);
}

export function stopPhoneActivityTracker() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  currentDistractionPackage = null;
  currentDistractionStart = null;
  callbacks = null;
  console.log('📱 Phone activity tracker stopped');
}

async function sendPhoneActivity(
  token: string,
  appPackage: string,
  appCategory: string,
  minutesInForeground: number
) {
  try {
    const res = await fetch(`${API_URL}/api/phone-activity`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appPackage,
        appCategory,
        minutesInForeground: Math.round(minutesInForeground * 10) / 10,
      }),
    });
    const data = await res.json();
    console.log('📱 Phone activity sent:', data);
  } catch (e) {
    console.log('📱 Phone activity send failed:', e);
  }
}
