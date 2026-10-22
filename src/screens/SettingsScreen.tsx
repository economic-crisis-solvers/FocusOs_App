import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { hasDNDAccess, openDNDSettings } from '../../modules/dnd';
import { hasUsageAccess, openUsageSettings } from '../../modules/usage-stats';

const C = { BG: '#020407', GREEN: '#00FF94', RED: '#FF2D55', YELLOW: '#FFD60A' };
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// ─── Tiny inline time stepper ────────────────────────────────────────────────
function TimeStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // "HH:MM"
  onChange: (v: string) => void;
}) {
  const [h, m] = value.split(':').map(Number);

  const pad = (n: number) => String(n).padStart(2, '0');

  const changeHour = (delta: number) => {
    const next = ((h + delta + 24) % 24);
    onChange(`${pad(next)}:${pad(m)}`);
  };
  const changeMin = (delta: number) => {
    const next = ((m + delta + 60) % 60);
    onChange(`${pad(h)}:${pad(next)}`);
  };

  return (
    <View style={ts.wrapper}>
      <Text style={ts.label}>{label}</Text>
      <View style={ts.row}>
        {/* Hour */}
        <View style={ts.unitGroup}>
          <TouchableOpacity style={ts.arrowBtn} onPress={() => changeHour(1)}>
            <Text style={ts.arrowText}>▲</Text>
          </TouchableOpacity>
          <View style={ts.valueBox}>
            <Text style={ts.valueText}>{pad(h)}</Text>
            <Text style={ts.unitLabel}>HR</Text>
          </View>
          <TouchableOpacity style={ts.arrowBtn} onPress={() => changeHour(-1)}>
            <Text style={ts.arrowText}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={ts.colon}>:</Text>

        {/* Minute */}
        <View style={ts.unitGroup}>
          <TouchableOpacity style={ts.arrowBtn} onPress={() => changeMin(15)}>
            <Text style={ts.arrowText}>▲</Text>
          </TouchableOpacity>
          <View style={ts.valueBox}>
            <Text style={ts.valueText}>{pad(m)}</Text>
            <Text style={ts.unitLabel}>MIN</Text>
          </View>
          <TouchableOpacity style={ts.arrowBtn} onPress={() => changeMin(-15)}>
            <Text style={ts.arrowText}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const ts = StyleSheet.create({
  wrapper: { flex: 1 },
  label: { color: '#00FF9040', fontSize: 8, letterSpacing: 3, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unitGroup: { alignItems: 'center', gap: 4 },
  arrowBtn: {
    width: 32,
    height: 24,
    borderWidth: 1,
    borderColor: '#00FF9425',
    borderRadius: 3,
    backgroundColor: '#00FF9408',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { color: '#00FF9070', fontSize: 9 },
  valueBox: { alignItems: 'center', gap: 2 },
  valueText: { color: '#00FF94', fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  unitLabel: { color: '#00FF9030', fontSize: 7, letterSpacing: 2 },
  colon: { color: '#00FF9060', fontSize: 26, fontWeight: '900', marginBottom: 8 },
});
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [threshold, setThreshold] = useState(45);
  const [overrideLimit, setOverrideLimit] = useState(3);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [saved, setSaved] = useState(false);
  const [loadingHours, setLoadingHours] = useState(false);
  const [dndGranted, setDndGranted] = useState(false);
  const [usageGranted, setUsageGranted] = useState(false);
  const { userId, token, logout } = useAuth();

  // Check DND permission on mount
  useEffect(() => {
    hasDNDAccess().then(setDndGranted).catch(() => setDndGranted(false));
    hasUsageAccess().then(setUsageGranted).catch(() => setUsageGranted(false));
  }, []);

  // Load local prefs
  useEffect(() => {
    AsyncStorage.getItem('threshold').then((v) => { if (v) setThreshold(Number(v)); });
    AsyncStorage.getItem('overrideLimit').then((v) => { if (v) setOverrideLimit(Number(v)); });
  }, []);

  // Load settings from backend (threshold + work hours)
  useEffect(() => {
    if (!token) return;
    setLoadingHours(true);
    const fetchSettings = async () => {
      try {
        const { data } = await (await import('../lib/supabase')).supabase.auth.getSession();
        const freshToken = data.session?.access_token || token;
        const res = await fetch(`${API_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        if (!res.ok) return;
        const settings = await res.json();
        console.log('Settings loaded:', settings);
        if (settings?.workHours?.start) setWorkStart(settings.workHours.start);
        if (settings?.workHours?.end) setWorkEnd(settings.workHours.end);
        if (settings?.focusThreshold !== undefined) {
          setThreshold(settings.focusThreshold);
          await AsyncStorage.setItem('threshold', String(settings.focusThreshold));
        }
      } catch (e) {
        console.log('Settings fetch error:', e);
      } finally {
        setLoadingHours(false);
      }
    };
    fetchSettings();
  }, [token]);

  const save = async () => {
    // Save local prefs
    await AsyncStorage.setItem('threshold', String(threshold));
    await AsyncStorage.setItem('overrideLimit', String(overrideLimit));

    // Save threshold + work hours to backend
    if (token) {
      try {
        const { data } = await (await import('../lib/supabase')).supabase.auth.getSession();
        const freshToken = data.session?.access_token || token;
        const res = await fetch(`${API_URL}/api/settings`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${freshToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            focusThreshold: threshold,
            workHours: { start: workStart, end: workEnd },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log('Settings saved to backend:', { threshold, workStart, workEnd });
      } catch (e: any) {
        Alert.alert('SAVE FAILED', `Settings not saved: ${e.message}`);
        return;
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = () => {
    Alert.alert('LOGOUT', 'Terminate session?', [
      { text: 'CANCEL', style: 'cancel' },
      { text: 'LOGOUT', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.gridLine, { top: i * 120 }]} />
      ))}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTag}>// CONFIGURATION</Text>
        <Text style={styles.headerTitle}>SYSTEM SETTINGS</Text>
      </View>

      {/* User info */}
      <View style={styles.userCard}>
        <View style={styles.userCardLeft}>
          <Text style={styles.userCardLabel}>OPERATOR ID</Text>
          <Text style={styles.userCardValue} numberOfLines={1}>
            {userId ? userId.slice(0, 16).toUpperCase() + '...' : 'UNLINKED'}
          </Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>ONLINE</Text>
        </View>
      </View>

      {/* Work Hours */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardLabel}>WORK HOURS</Text>
            <Text style={styles.cardSub}>Active monitoring window</Text>
          </View>
          {loadingHours && <ActivityIndicator size="small" color="#00FF9460" />}
        </View>

        <View style={styles.timeRow}>
          <TimeStepper label="WORK STARTS" value={workStart} onChange={setWorkStart} />
          <View style={styles.timeDivider} />
          <TimeStepper label="WORK ENDS" value={workEnd} onChange={setWorkEnd} />
        </View>

        <View style={styles.timePreview}>
          <Text style={styles.timePreviewText}>
            {workStart} → {workEnd}
          </Text>
        </View>
      </View>

      {/* Threshold */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardLabel}>SHIELD THRESHOLD</Text>
            <Text style={styles.cardSub}>Activates when score drops below</Text>
          </View>
          <Text style={[styles.cardBigValue, { color: C.GREEN }]}>{threshold}</Text>
        </View>
        <Slider
          style={{ width: '100%', height: 36, marginTop: 4 }}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={threshold}
          onValueChange={setThreshold}
          minimumTrackTintColor={C.GREEN}
          maximumTrackTintColor="#00FF9415"
          thumbTintColor={C.GREEN}
        />
        <View style={styles.sliderScale}>
          <Text style={styles.sliderScaleText}>0 — STRICT</Text>
          <Text style={styles.sliderScaleText}>100 — LENIENT</Text>
        </View>
      </View>

      {/* Override limit */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>MAX DAILY OVERRIDES</Text>
        <Text style={styles.cardSub}>Prevents shield abuse</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setOverrideLimit(Math.max(1, overrideLimit - 1))}>
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.stepValueBox}>
            <Text style={styles.stepValue}>{overrideLimit}</Text>
            <Text style={styles.stepValueSub}>PER DAY</Text>
          </View>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setOverrideLimit(Math.min(10, overrideLimit + 1))}>
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* DND Permission */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardLabel}>DO NOT DISTURB</Text>
            <Text style={styles.cardSub}>Block ALL notifications when shield is active</Text>
          </View>
          <Text style={[styles.cardBigValue, { color: dndGranted ? C.GREEN : C.RED, fontSize: 14, letterSpacing: 2 }]}>
            {dndGranted ? 'ON' : 'OFF'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.dndBtn, dndGranted && styles.dndBtnGranted]}
          onPress={async () => {
            if (dndGranted) return;
            openDNDSettings();
            // Re-check after a delay (user comes back from settings)
            setTimeout(() => hasDNDAccess().then(setDndGranted), 3000);
          }}
        >
          <Text style={[styles.dndBtnText, dndGranted && styles.dndBtnTextGranted]}>
            {dndGranted ? 'ACCESS GRANTED' : '[ GRANT DND ACCESS ]'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Usage Stats Permission */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardLabel}>PHONE MONITORING</Text>
            <Text style={styles.cardSub}>Track distracting apps in foreground</Text>
          </View>
          <Text style={[styles.cardBigValue, { color: usageGranted ? C.GREEN : C.RED, fontSize: 14, letterSpacing: 2 }]}>
            {usageGranted ? 'ON' : 'OFF'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.dndBtn, usageGranted && styles.dndBtnGranted]}
          onPress={async () => {
            if (usageGranted) return;
            openUsageSettings();
            setTimeout(() => hasUsageAccess().then(setUsageGranted), 3000);
          }}
        >
          <Text style={[styles.dndBtnText, usageGranted && styles.dndBtnTextGranted]}>
            {usageGranted ? 'ACCESS GRANTED' : '[ GRANT USAGE ACCESS ]'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* System info */}
      <View style={styles.infoGrid}>
        {[
          { label: 'VERSION', value: '2.0.0' },
          { label: 'MODE', value: 'AUTO' },
          { label: 'BUILD', value: 'PROD' },
        ].map((item) => (
          <View key={item.label} style={styles.infoCell}>
            <Text style={styles.infoCellLabel}>{item.label}</Text>
            <Text style={styles.infoCellValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Save */}
      <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnSaved]} onPress={save}>
        <Text style={styles.saveBtnText}>{saved ? 'SAVED' : '[ SAVE CONFIG ]'}</Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>[ TERMINATE SESSION ]</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40, gap: 12 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#00FF9406' },
  header: { gap: 4, marginBottom: 8 },
  headerTag: { color: '#00FF9040', fontSize: 9, letterSpacing: 4 },
  headerTitle: { color: C.GREEN, fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  userCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#00FF9425', backgroundColor: '#00FF9408', padding: 16, borderRadius: 4 },
  userCardLeft: { flex: 1, gap: 3 },
  userCardLabel: { color: '#00FF9040', fontSize: 8, letterSpacing: 3 },
  userCardValue: { color: C.GREEN, fontSize: 12, fontWeight: '700' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#00FF9415', borderWidth: 1, borderColor: '#00FF9430', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3 },
  onlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.GREEN },
  onlineText: { color: C.GREEN, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  card: { borderWidth: 1, borderColor: '#00FF9418', backgroundColor: '#00FF9405', padding: 16, borderRadius: 4, gap: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: '#00FF9050', fontSize: 9, letterSpacing: 3 },
  cardSub: { color: '#00FF9030', fontSize: 9, marginTop: 2 },
  cardBigValue: { fontSize: 40, fontWeight: '900' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timeDivider: { width: 1, backgroundColor: '#00FF9418', alignSelf: 'stretch', marginHorizontal: 4 },
  timePreview: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#00FF9415', paddingTop: 8 },
  timePreviewText: { color: '#00FF9060', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  sliderScale: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderScaleText: { color: '#00FF9025', fontSize: 7, letterSpacing: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
  stepBtn: { width: 44, height: 44, borderWidth: 1, borderColor: '#00FF9430', borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00FF9408' },
  stepBtnText: { color: C.GREEN, fontSize: 20, fontWeight: '700' },
  stepValueBox: { flex: 1, alignItems: 'center', gap: 2 },
  stepValue: { color: C.GREEN, fontSize: 36, fontWeight: '900' },
  stepValueSub: { color: '#00FF9030', fontSize: 7, letterSpacing: 2 },
  infoGrid: { flexDirection: 'row', gap: 8 },
  infoCell: { flex: 1, borderWidth: 1, borderColor: '#00FF9415', backgroundColor: '#00FF9403', padding: 12, borderRadius: 4, alignItems: 'center', gap: 4 },
  infoCellLabel: { color: '#00FF9030', fontSize: 7, letterSpacing: 2 },
  infoCellValue: { color: '#00FF9060', fontSize: 12, fontWeight: '700' },
  saveBtn: { backgroundColor: C.GREEN, padding: 16, borderRadius: 4, alignItems: 'center' },
  saveBtnSaved: { backgroundColor: '#00FF9440' },
  saveBtnText: { color: C.BG, fontWeight: '900', fontSize: 12, letterSpacing: 3 },
  logoutBtn: { borderWidth: 1, borderColor: '#FF2D5530', backgroundColor: '#FF2D5508', padding: 15, borderRadius: 4, alignItems: 'center' },
  logoutText: { color: '#FF2D5560', fontSize: 11, letterSpacing: 2 },
  dndBtn: { backgroundColor: '#FF2D55', padding: 14, borderRadius: 4, alignItems: 'center' },
  dndBtnGranted: { backgroundColor: '#00FF9420', borderWidth: 1, borderColor: '#00FF9440' },
  dndBtnText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 3 },
  dndBtnTextGranted: { color: '#00FF94' },
});