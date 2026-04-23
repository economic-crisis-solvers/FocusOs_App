import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import * as Notifications from 'expo-notifications';
import {
  activateGating,
  releaseNotificationQueue,
  releaseNotificationQueueQuiet,
  setupNotificationHandler,
} from '../lib/notificationGating';
import { enableDND, disableDND } from '../../modules/dnd';
import { startPhoneActivityTracker, stopPhoneActivityTracker } from '../lib/phoneActivityTracker';
import { startMonitorService, stopMonitorService, getDistractionState } from '../../modules/phone-monitor';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const RECOVERY_DELAY_MS = 60_000; // 60 seconds sustained above-threshold before release

// States that mean user is distracted → shield should be ON
const DISTRACTED_STATES = ['drifting', 'distracted', 'collapsed'];

// Phone distraction penalty scores (OR logic: final score = min(browser, phone))
const PHONE_PENALTY: Record<string, number> = {
  social: 20,        // Instagram, Facebook etc → score drops to 20
  entertainment: 30, // Netflix, YouTube etc → score drops to 30
};

type FocusContextType = {
  score: number;          // COMPOSITE score: min(browserScore, phoneScore)
  browserScore: number;   // Raw browser-only score
  shieldActive: boolean;
  recovering: boolean;
  recoveryCountdown: number;
  state: string | null;
  phoneDistraction: PhoneDistractionInfo | null;
  distractionSource: 'browser' | 'phone' | 'both' | null;
};

type PhoneDistractionInfo = {
  appPackage: string;
  appCategory: string;
  minutesInForeground: number;
};

const FocusContext = createContext<FocusContextType | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [browserScore, setBrowserScore] = useState(0);
  // shieldActive = true means "shield is ON, holding notifications" (user is distracted)
  const [shieldActive, setShieldActive] = useState(false);
  const [state, setState] = useState<string | null>(null);
  const wasShieldActive = useRef(false);
  const pendingQuietRelease = useRef(false);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecovering = useRef(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryCountdown, setRecoveryCountdown] = useState(0);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const { userId, token } = useAuth();

  // Phone distraction state
  const [phoneDistraction, setPhoneDistraction] = useState<PhoneDistractionInfo | null>(null);
  const phoneDistractedRef = useRef(false);

  // Gradual phone score decay
  const phoneDistractionStart = useRef<number | null>(null);
  const [phoneDecayScore, setPhoneDecayScore] = useState(100); // 100 = no penalty
  const phoneDecayInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Score decay constants
  const ASSESS_PERIOD_S = 30;  // 30 seconds assessment before penalty starts
  const DECAY_DURATION_S = 120; // 2 minutes to reach floor after assessment

  // Start/stop the decay ticker
  const startPhoneDecay = useCallback((category: string) => {
    phoneDistractionStart.current = Date.now();
    setPhoneDecayScore(100); // Start at no penalty
    // Clear any existing interval
    if (phoneDecayInterval.current) clearInterval(phoneDecayInterval.current);
    // Tick every second to smoothly decay the score
    phoneDecayInterval.current = setInterval(() => {
      if (!phoneDistractionStart.current) return;
      const elapsedS = (Date.now() - phoneDistractionStart.current) / 1000;
      const floor = PHONE_PENALTY[category] ?? 35;

      if (elapsedS <= ASSESS_PERIOD_S) {
        // Assessment period — no penalty yet, but score starts to waver slightly
        const waver = Math.max(0, (elapsedS / ASSESS_PERIOD_S) * 10);
        setPhoneDecayScore(100 - waver);
      } else {
        // Decay period — linear drop from (100-10)=90 to floor
        const decayElapsed = elapsedS - ASSESS_PERIOD_S;
        const decayProgress = Math.min(1, decayElapsed / DECAY_DURATION_S);
        const decayed = Math.round(90 - (90 - floor) * decayProgress);
        setPhoneDecayScore(decayed);
      }
    }, 1000);
  }, []);

  const stopPhoneDecay = useCallback(() => {
    phoneDistractionStart.current = null;
    setPhoneDecayScore(100);
    if (phoneDecayInterval.current) {
      clearInterval(phoneDecayInterval.current);
      phoneDecayInterval.current = null;
    }
  }, []);

  // COMPOSITE SCORE: min(browserScore, phoneDecayScore)
  // Phone score gradually drops from 100 → floor over time
  const score = useMemo(() => {
    return Math.min(browserScore, phoneDecayScore);
  }, [browserScore, phoneDecayScore]);

  // Distraction source for UI (phone counts as distracting once past assessment period)
  const distractionSource = useMemo((): 'browser' | 'phone' | 'both' | null => {
    const browserBad = DISTRACTED_STATES.includes(state || '');
    const phoneBad = phoneDecayScore < 80; // Phone is "distracting" once score drops meaningfully
    if (browserBad && phoneBad) return 'both';
    if (browserBad) return 'browser';
    if (phoneBad) return 'phone';
    return null;
  }, [state, phoneDecayScore]);

  // Cancel any pending recovery timer
  const cancelRecovery = useCallback(() => {
    if (recoveryTimer.current) {
      clearTimeout(recoveryTimer.current);
      recoveryTimer.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    isRecovering.current = false;
    setRecovering(false);
    setRecoveryCountdown(0);
  }, []);

  // Decide shield state based on BOTH browser score AND phone usage
  // Shield ON if: browser says distracted OR phone is on distracting app
  // Shield OFF only if: browser says focused AND phone is NOT distracting
  const processState = useCallback((newState: string) => {
    const browserDistracted = DISTRACTED_STATES.includes(newState);
    const phoneDistracted = phoneDistractedRef.current;
    const shouldShield = browserDistracted || phoneDistracted;

    if (shouldShield) {
      cancelRecovery();
      setShieldActive(true);
    } else if (!shouldShield && shieldActive && !isRecovering.current) {
      // RECOVERY: both sources clear, start countdown
      isRecovering.current = true;
      setRecovering(true);
      setRecoveryCountdown(RECOVERY_DELAY_MS / 1000);
      console.log('Recovery started — 60s countdown...');
      countdownInterval.current = setInterval(() => {
        setRecoveryCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
      recoveryTimer.current = setTimeout(() => {
        if (!phoneDistractedRef.current) {
          console.log('Recovery confirmed — releasing shield');
          setShieldActive(false);
        } else {
          console.log('Recovery cancelled — phone still distracting');
        }
        isRecovering.current = false;
        setRecovering(false);
        setRecoveryCountdown(0);
        recoveryTimer.current = null;
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
      }, RECOVERY_DELAY_MS);
    }
  }, [shieldActive, cancelRecovery]);

  // Track current browser state
  const currentBrowserState = useRef<string>('deep_focus');

  // Setup notification handler on app start
  useEffect(() => {
    try { setupNotificationHandler(); } catch (e) {
      console.log('Notification handler setup skipped');
    }
  }, []);

  // Fetch initial live score
  useEffect(() => {
    if (!userId || !token) return;
    fetch(`${API_URL}/api/score/live`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          console.log('INITIAL SCORE:', data);
          if (data.score !== undefined) setBrowserScore(data.score);
          if (data.state) {
            setState(data.state);
            currentBrowserState.current = data.state;
            setShieldActive(DISTRACTED_STATES.includes(data.state));
          }
        }
      })
      .catch((e) => console.log('Initial score fetch failed:', e));
  }, [userId, token]);

  // Start phone activity tracker + background service
  useEffect(() => {
    if (!userId || !token) return;

    // 1. Start NATIVE foreground service (survives app background/kill)
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const freshToken = data.session?.access_token || token;
        const started = await startMonitorService(freshToken, API_URL || '');
        console.log('📱 Background monitor service started:', started);
      } catch (e) {
        console.log('📱 Background monitor service failed (Expo Go?):', e);
      }
    })();

    // 2. Start JS-based tracker (for UI updates when app is in foreground)
    startPhoneActivityTracker({
      getToken: async () => {
        try {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token || token;
        } catch {
          return token;
        }
      },
      onPhoneDistraction: (pkg, category, minutes) => {
        console.log(`📱 PHONE DISTRACTION: ${pkg} (${category}) — ${minutes.toFixed(1)}min`);
        phoneDistractedRef.current = true;
        setPhoneDistraction({ appPackage: pkg, appCategory: category, minutesInForeground: minutes });
        // Start gradual score decay (only on first detection for this session)
        if (!phoneDistractionStart.current) {
          startPhoneDecay(category);
        }
        // Don't activate shield instantly — let the score decay naturally
        // Shield will activate when processState sees the composite score is low
      },
      onPhoneClear: () => {
        console.log('📱 Phone clear');
        phoneDistractedRef.current = false;
        setPhoneDistraction(null);
        stopPhoneDecay();
        // Re-evaluate with current browser state
        const browserOk = !DISTRACTED_STATES.includes(currentBrowserState.current);
        if (browserOk && shieldActive && !isRecovering.current) {
          processState(currentBrowserState.current);
        }
      },
    });

    return () => {
      stopPhoneActivityTracker();
      stopMonitorService().catch(() => null);
      stopPhoneDecay();
    };
  }, [userId, token]);

  // Watch phone decay score — activate shield when it drops below threshold
  // This connects the gradual decay to actual shield activation
  useEffect(() => {
    if (phoneDecayScore < 80 && phoneDistraction && !shieldActive) {
      console.log('📱 Phone score dropped below threshold — activating shield');
      cancelRecovery();
      setShieldActive(true);
    }
  }, [phoneDecayScore, phoneDistraction, shieldActive, cancelRecovery]);

  // When app comes back to foreground, query native service for what happened
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        try {
          const state = await getDistractionState();
          console.log('📱 Resume sync:', state);
          if (state.isDistracted && state.elapsedSeconds && state.category) {
            // Retroactively apply the decay from when distraction started
            phoneDistractedRef.current = true;
            setPhoneDistraction({
              appPackage: state.packageName || 'unknown',
              appCategory: state.category,
              minutesInForeground: (state.elapsedSeconds || 0) / 60,
            });
            // Calculate what the decay score should be NOW
            const elapsed = state.elapsedSeconds || 0;
            const floor = PHONE_PENALTY[state.category] ?? 35;
            let decayScore = 100;
            if (elapsed > 30) {
              const decayElapsed = elapsed - 30;
              const progress = Math.min(1, decayElapsed / 120);
              decayScore = Math.round(90 - (90 - floor) * progress);
            } else {
              decayScore = Math.round(100 - (elapsed / 30) * 10);
            }
            setPhoneDecayScore(decayScore);
            // Restart the live ticker from current position
            if (!phoneDistractionStart.current) {
              phoneDistractionStart.current = Date.now() - (elapsed * 1000);
              startPhoneDecay(state.category);
              // Override the start time so decay continues from correct position
              phoneDistractionStart.current = Date.now() - (elapsed * 1000);
            }
            if (!shieldActive && decayScore < 80) {
              cancelRecovery();
              setShieldActive(true);
            }
          } else if (!state.isDistracted && phoneDistractedRef.current) {
            // Distraction ended while we were in background
            phoneDistractedRef.current = false;
            setPhoneDistraction(null);
            stopPhoneDecay();
            const browserOk = !DISTRACTED_STATES.includes(currentBrowserState.current);
            if (browserOk && shieldActive && !isRecovering.current) {
              processState(currentBrowserState.current);
            }
          }
        } catch (e) {
          console.log('Resume sync error:', e);
        }
      }
    });
    return () => sub.remove();
  }, [shieldActive, cancelRecovery, processState, startPhoneDecay, stopPhoneDecay]);

  // When shieldActive changes — gating + DND + alert
  useEffect(() => {
    if (shieldActive && !wasShieldActive.current) {
      activateGating();
      enableDND().then((ok) => console.log('DND enabled:', ok)).catch(() => null);
      // Fire alert notification
      const isPhone = phoneDistractedRef.current;
      Notifications.scheduleNotificationAsync({
        content: {
          title: isPhone ? '📱 Phone Distraction Detected' : '⚠ Focus Dropping',
          body: isPhone
            ? `You're on a distracting app — your score is dropping!`
            : 'You seem to be drifting — refocus!',
          data: { type: 'focus_drop_alert' },
        },
        trigger: null,
      }).catch(() => null);
    } else if (!shieldActive && wasShieldActive.current) {
      disableDND().then((ok) => console.log('DND disabled:', ok)).catch(() => null);
      if (pendingQuietRelease.current) {
        releaseNotificationQueueQuiet();
        pendingQuietRelease.current = false;
      } else {
        releaseNotificationQueue();
      }
    }
    wasShieldActive.current = shieldActive;
  }, [shieldActive]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('focus-' + userId)
      .on('broadcast', { event: 'focus_score_update' }, ({ payload }: { payload: any }) => {
        console.log('SCORE UPDATE (tick):', payload);
        if (payload.score !== undefined) setBrowserScore(payload.score);
        if (payload.state) {
          setState(payload.state);
          currentBrowserState.current = payload.state;
          processState(payload.state);
        }
      })
      .on('broadcast', { event: 'focus_active_change' }, ({ payload }: { payload: any }) => {
        console.log('FOCUS ACTIVE CHANGE:', payload);
        if (payload.score !== undefined) setBrowserScore(payload.score);
        if (payload.state) {
          setState(payload.state);
          currentBrowserState.current = payload.state;
          processState(payload.state);
        }
        if (payload.release_mode === 'quiet') {
          pendingQuietRelease.current = true;
        }
      })
      // Phone distraction from backend
      .on('broadcast', { event: 'phone_distraction' }, ({ payload }: { payload: any }) => {
        console.log('📱 BACKEND PHONE DISTRACTION:', payload);
        phoneDistractedRef.current = true;
        const cat = payload.app_category || 'social';
        setPhoneDistraction({
          appPackage: payload.app_package || 'unknown',
          appCategory: cat,
          minutesInForeground: payload.minutes_in_foreground || 0,
        });
        if (!phoneDistractionStart.current) {
          startPhoneDecay(cat);
        }
      })
      .subscribe((status: string) => {
        console.log('Realtime subscription status:', status);
      });
    return () => {
      supabase.removeChannel(channel);
      cancelRecovery();
    };
  }, [userId, processState, cancelRecovery]);

  return (
    <FocusContext.Provider value={{
      score, browserScore, shieldActive, recovering, recoveryCountdown,
      state, phoneDistraction, distractionSource
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be inside FocusProvider');
  return ctx;
}