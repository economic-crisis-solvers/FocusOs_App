import { NativeModules, Platform } from 'react-native';

const { PhoneMonitorModule } = NativeModules;

let _warnedOnce = false;
function warnOnce() {
  if (!_warnedOnce) {
    console.log('PhoneMonitorModule: Not available (Expo Go). Works in dev build.');
    _warnedOnce = true;
  }
}

/**
 * Start the background phone monitoring foreground service.
 * Runs even when app is in background/killed.
 * @param authToken - Supabase JWT for backend calls
 * @param apiUrl - Backend API URL
 */
export async function startMonitorService(authToken: string, apiUrl: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !PhoneMonitorModule) {
    warnOnce();
    return false;
  }
  return PhoneMonitorModule.startService(authToken, apiUrl);
}

/**
 * Stop the background monitoring service.
 */
export async function stopMonitorService(): Promise<boolean> {
  if (Platform.OS !== 'android' || !PhoneMonitorModule) return false;
  return PhoneMonitorModule.stopService();
}

/**
 * Check if the monitor service is currently running.
 */
export async function isMonitorRunning(): Promise<boolean> {
  if (Platform.OS !== 'android' || !PhoneMonitorModule) return false;
  return PhoneMonitorModule.isRunning();
}

/**
 * Update the auth token on a running service (for token refresh).
 */
export async function updateMonitorToken(newToken: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !PhoneMonitorModule) return false;
  return PhoneMonitorModule.updateToken(newToken);
}

export type DistractionState = {
  isDistracted: boolean;
  packageName?: string;
  category?: string;
  startTime?: number;
  elapsedSeconds?: number;
};

/**
 * Get current distraction state from background service.
 * Call this when app resumes to sync what happened while JS was asleep.
 */
export async function getDistractionState(): Promise<DistractionState> {
  if (Platform.OS !== 'android' || !PhoneMonitorModule) {
    return { isDistracted: false };
  }
  return PhoneMonitorModule.getDistractionState();
}
