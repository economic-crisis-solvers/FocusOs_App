import { NativeModules, Platform } from 'react-native';

const { DNDModule } = NativeModules;

let _warnedOnce = false;
function warnOnce() {
  if (!_warnedOnce) {
    console.log('DNDModule: Not available (Expo Go). Will work in dev build.');
    _warnedOnce = true;
  }
}
/**
 * Check if the app has DND (Do Not Disturb) access permission.
 * Android requires the user to manually grant "Do Not Disturb access" in Settings.
 */
export async function hasDNDAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!DNDModule) {
    warnOnce();
    return false;
  }
  return DNDModule.hasDNDAccess();
}

/**
 * Open Android system settings so user can grant DND access to FocusOS.
 */
export function openDNDSettings(): void {
  if (Platform.OS !== 'android' || !DNDModule) return;
  DNDModule.openDNDSettings();
}

/**
 * Enable DND mode (silence all notifications system-wide).
 * Requires DND access permission.
 */
export async function enableDND(): Promise<boolean> {
  if (Platform.OS !== 'android' || !DNDModule) return false;
  return DNDModule.enableDND();
}

/**
 * Disable DND mode (restore normal notification behavior).
 */
export async function disableDND(): Promise<boolean> {
  if (Platform.OS !== 'android' || !DNDModule) return false;
  return DNDModule.disableDND();
}

/**
 * Check if DND is currently active.
 */
export async function isDNDActive(): Promise<boolean> {
  if (Platform.OS !== 'android' || !DNDModule) return false;
  return DNDModule.isDNDActive();
}
