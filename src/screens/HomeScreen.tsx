import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocus } from '../context/FocusContext';
import { useAuth } from '../context/AuthContext';
import { QueueItem } from '../lib/notificationGating';

const { width, height } = Dimensions.get('window');
const RING_SIZE = width * 0.72;
const CENTER = RING_SIZE / 2;
const RADIUS = CENTER - 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Tick marks around ring
const TICKS = Array.from({ length: 36 }, (_, i) => i * 10);

const FAKE_NOTIFICATIONS = [
  { app: 'WhatsApp', body: 'Hey are you free later today?' },
  { app: 'WhatsApp', body: 'Can you call me when you get a chance' },
  { app: 'Instagram', body: 'John liked your photo' },
  { app: 'Gmail', body: 'Your meeting starts in 10 minutes' },
  { app: 'Slack', body: 'New message in #general' },
];

const C = {
  BG: '#020407',
  GREEN: '#00FF94',
  RED: '#FF2D55',
  AMBER: '#FFD60A',
  DIM: '#0A1A12',
  GRID: '#00FF9408',
  TEXT: '#00FF9460',
  BORDER: '#00FF9420',
};

export default function HomeScreen({ navigation }: any) {
  const { score, shieldActive, recovering, recoveryCountdown, phoneDistraction, distractionSource } = useFocus();
  const { userId } = useAuth();
  const animatedScore = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [queueCount, setQueueCount] = useState(0);
  const [secretTaps, setSecretTaps] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [time, setTime] = useState(new Date());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Queue poll
  useEffect(() => {
    const interval = setInterval(async () => {
      const raw = await AsyncStorage.getItem('notif_queue');
      const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
      setQueueCount(queue.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Score ring animation
  useEffect(() => {
    Animated.timing(animatedScore, { toValue: score, duration: 1000, useNativeDriver: false }).start();
  }, [score]);

  // Scan line rotation
  useEffect(() => {
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 4000, useNativeDriver: true })
    ).start();
  }, []);

  // Pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Auto-show secret panel when shield activates (for demo convenience)
  useEffect(() => {
    if (shieldActive && !recovering) {
      setShowSecret(true);
    }
  }, [shieldActive, recovering]);

  const strokeDashoffset = animatedScore.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const scanRotate = scanAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Three visual states: RED (shield active), AMBER (recovering), GREEN (nominal)
  const ACCENT = shieldActive
    ? (recovering ? C.AMBER : C.RED)
    : C.GREEN;

  const stateLabel = () => {
    if (!shieldActive) return 'SYSTEM NOMINAL';
    if (recovering) return 'RECOVERING';
    if (distractionSource === 'phone') return '📱 PHONE DISTRACTION';
    if (distractionSource === 'both') return '⚠ DUAL DISTRACTION';
    return 'THREAT DETECTED';
  };
  const STATE = stateLabel();

  const STATE_SHORT = shieldActive
    ? (recovering ? 'COOLDOWN' : distractionSource === 'phone' ? '📱 PHONE' : 'SHIELD ON')
    : 'ACTIVE';

  const handleSecretTap = () => {
    const n = secretTaps + 1;
    setSecretTaps(n);
    if (n >= 3) { setShowSecret(true); setSecretTaps(0); }
  };

  const simulateNotification = async (app: string, body: string) => {
    const raw = await AsyncStorage.getItem('notif_queue');
    const queue: QueueItem[] = raw ? JSON.parse(raw) : [];
    queue.push({ id: String(Date.now()), app, body, receivedAt: Date.now() });
    await AsyncStorage.setItem('notif_queue', JSON.stringify(queue));
    setQueueCount(queue.length);
  };

  const padTime = (n: number) => String(n).padStart(2, '0');

  return (
    <View style={styles.container}>

      {/* Grid background lines */}
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.gridLine, { top: (height / 8) * i }]} />
        ))}
      </View>

      {/* TOP HUD */}
      <View style={styles.topHud}>
        <TouchableOpacity onPress={handleSecretTap} activeOpacity={1}>
          <Text style={[styles.hudLabel, { color: ACCENT }]}>FOCUS<Text style={styles.hudLabelDim}>OS</Text></Text>
        </TouchableOpacity>
        <View style={styles.clockBox}>
          <Text style={[styles.clockText, { color: ACCENT }]}>
            {padTime(time.getHours())}:{padTime(time.getMinutes())}:{padTime(time.getSeconds())}
          </Text>
        </View>
        <View style={[styles.statusChip, { borderColor: ACCENT + '60' }]}>
          <Animated.View style={[styles.statusDot, { backgroundColor: ACCENT, transform: [{ scale: pulseAnim }] }]} />
          <Text style={[styles.statusChipText, { color: ACCENT }]}>{STATE_SHORT}</Text>
        </View>
      </View>

      {/* STATE BANNER */}
      {shieldActive && (
        <View style={[styles.threatBanner, {
          backgroundColor: recovering ? '#FFD60A10' : '#FF2D5510',
          borderColor: recovering ? '#FFD60A40' : '#FF2D5540',
        }]}>
          <Text style={[styles.threatText, { color: recovering ? C.AMBER : C.RED }]}>
            {recovering
              ? `⏳  RECOVERING — ${recoveryCountdown}s UNTIL RELEASE`
              : phoneDistraction
                ? `📱  ${phoneDistraction.appPackage.split('.').pop()?.toUpperCase()} — ${phoneDistraction.minutesInForeground.toFixed(0)}m`
                : `⚠  FOCUS SHIELD ENGAGED — ${queueCount} HELD`
            }
          </Text>
        </View>
      )}

      {/* RADAR RING */}
      <View style={styles.radarWrapper}>
        {/* Scan sweep */}
        <Animated.View style={[styles.scanSweep, { transform: [{ rotate: scanRotate }] }]} />

        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Outer tick ring */}
          {TICKS.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const outerR = RADIUS + 14;
            const innerR = RADIUS + (deg % 90 === 0 ? 6 : 10);
            return (
              <Line
                key={deg}
                x1={CENTER + outerR * Math.cos(rad)}
                y1={CENTER + outerR * Math.sin(rad)}
                x2={CENTER + innerR * Math.cos(rad)}
                y2={CENTER + innerR * Math.sin(rad)}
                stroke={ACCENT}
                strokeWidth={deg % 90 === 0 ? 2 : 0.5}
                opacity={deg % 90 === 0 ? 0.6 : 0.2}
              />
            );
          })}

          {/* Outer ring border */}
          <Circle cx={CENTER} cy={CENTER} r={RADIUS + 14} stroke={ACCENT} strokeWidth={0.5} fill="none" opacity={0.2} />

          {/* Track */}
          <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={ACCENT} strokeWidth={1} fill="none" opacity={0.1} />

          {/* Glow ring */}
          <AnimatedCircle
            cx={CENTER} cy={CENTER} r={RADIUS}
            stroke={ACCENT}
            strokeWidth={14}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
            rotation="-90"
            origin={`${CENTER}, ${CENTER}`}
            opacity={0.15}
          />

          {/* Main progress */}
          <AnimatedCircle
            cx={CENTER} cy={CENTER} r={RADIUS}
            stroke={ACCENT}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
            rotation="-90"
            origin={`${CENTER}, ${CENTER}`}
          />

          {/* Inner concentric rings */}
          <Circle cx={CENTER} cy={CENTER} r={RADIUS * 0.7} stroke={ACCENT} strokeWidth={0.3} fill="none" opacity={0.08} />
          <Circle cx={CENTER} cy={CENTER} r={RADIUS * 0.4} stroke={ACCENT} strokeWidth={0.3} fill="none" opacity={0.08} />

          {/* Cross hairs */}
          <Line x1={CENTER} y1={CENTER - RADIUS * 0.35} x2={CENTER} y2={CENTER + RADIUS * 0.35} stroke={ACCENT} strokeWidth={0.3} opacity={0.15} />
          <Line x1={CENTER - RADIUS * 0.35} y1={CENTER} x2={CENTER + RADIUS * 0.35} y2={CENTER} stroke={ACCENT} strokeWidth={0.3} opacity={0.15} />
        </Svg>

        {/* Score center */}
        <View style={styles.scoreCenter} pointerEvents="none">
          <Text style={[styles.scoreNumber, { color: ACCENT }]}>{score}</Text>
          <Text style={[styles.scoreUnit, { color: ACCENT + '60' }]}>/ 100</Text>
          <View style={styles.scoreDivider} />
          <Text style={[styles.scoreState, { color: ACCENT }]}>{STATE}</Text>
        </View>
      </View>

      {/* DATA GRID */}
      <View style={styles.dataGrid}>
        <TouchableOpacity style={[styles.dataCell, { borderColor: ACCENT + '30' }]} onPress={() => navigation.navigate('NotificationQueue')}>
          <Text style={[styles.dataCellLabel, { color: ACCENT + '60' }]}>HELD</Text>
          <Text style={[styles.dataCellValue, { color: ACCENT }]}>{queueCount}</Text>
          <Text style={[styles.dataCellSub, { color: ACCENT + '40' }]}>TAP TO VIEW</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.dataCell, styles.dataCellMain, { borderColor: ACCENT + '60', backgroundColor: ACCENT + '08' }]} onPress={() => navigation.navigate('Override')}>
          <Text style={[styles.dataCellLabel, { color: ACCENT + '60' }]}>SHIELD</Text>
          <Text style={[styles.dataCellValue, { color: ACCENT }]}>{shieldActive ? (recovering ? '⏳' : 'ON') : 'OFF'}</Text>
          <Text style={[styles.dataCellSub, { color: ACCENT + '40' }]}>OVERRIDE →</Text>
        </TouchableOpacity>

        <View style={[styles.dataCell, { borderColor: ACCENT + '30' }]}>
          <Text style={[styles.dataCellLabel, { color: ACCENT + '60' }]}>SCORE</Text>
          <Text style={[styles.dataCellValue, { color: ACCENT }]}>{score >= 70 ? 'A' : score >= 50 ? 'B' : 'C'}</Text>
          <Text style={[styles.dataCellSub, { color: ACCENT + '40' }]}>GRADE</Text>
        </View>
      </View>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <View style={[styles.bottomInfoBox, { borderColor: ACCENT + '20' }]}>
          <Text style={[styles.bottomInfoLabel, { color: ACCENT + '40' }]}>USER</Text>
          <Text style={[styles.bottomInfoValue, { color: ACCENT + '80' }]} numberOfLines={1}>
            {userId ? userId.slice(0, 8).toUpperCase() + '...' : 'UNLINKED'}
          </Text>
        </View>
        <View style={[styles.bottomInfoBox, { borderColor: ACCENT + '20' }]}>
          <Text style={[styles.bottomInfoLabel, { color: ACCENT + '40' }]}>REALTIME</Text>
          <Text style={[styles.bottomInfoValue, { color: C.GREEN + '80' }]}>LINKED</Text>
        </View>
        <View style={[styles.bottomInfoBox, { borderColor: ACCENT + '20' }]}>
          <Text style={[styles.bottomInfoLabel, { color: ACCENT + '40' }]}>PHONE</Text>
          <Text style={[styles.bottomInfoValue, { color: phoneDistraction ? (C.RED + '80') : (C.GREEN + '80') }]}>
            {phoneDistraction ? '⚠' : '✓'}
          </Text>
        </View>
      </View>

      {/* SECRET PANEL */}
      {showSecret && (
        <View style={styles.secretPanel}>
          <Text style={styles.secretTitle}>// DEMO INJECT</Text>
          {FAKE_NOTIFICATIONS.map((n, i) => (
            <TouchableOpacity key={i} style={styles.secretBtn} onPress={() => simulateNotification(n.app, n.body)}>
              <Text style={styles.secretBtnTxt}>+ {n.app}: {n.body.slice(0, 28)}...</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShowSecret(false)}>
            <Text style={styles.closeTxt}>[CLOSE]</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG, alignItems: 'center', paddingTop: 52, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 16 },
  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.GRID },
  topHud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  hudLabel: { fontSize: 14, fontWeight: '900', letterSpacing: 3 },
  hudLabelDim: { color: '#00FF9430' },
  clockBox: { backgroundColor: '#00FF940A', borderWidth: 1, borderColor: '#00FF9415', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  clockText: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1, backgroundColor: '#00FF940A' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  threatBanner: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 4, width: '100%', alignItems: 'center', borderWidth: 1 },
  threatText: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  radarWrapper: { alignItems: 'center', justifyContent: 'center' },
  scanSweep: { position: 'absolute', width: RING_SIZE * 0.5, height: 2, left: CENTER, top: CENTER - 1, backgroundColor: 'transparent', borderTopWidth: 0, transformOrigin: 'left center' },
  scoreCenter: { position: 'absolute', alignItems: 'center' },
  scoreNumber: { fontSize: 72, fontWeight: '900', letterSpacing: -4, lineHeight: 72 },
  scoreUnit: { fontSize: 12, letterSpacing: 2, marginTop: -4 },
  scoreDivider: { width: 40, height: 1, backgroundColor: '#00FF9430', marginVertical: 8 },
  scoreState: { fontSize: 9, fontWeight: '700', letterSpacing: 3 },
  dataGrid: { flexDirection: 'row', gap: 8, width: '100%' },
  dataCell: { flex: 1, backgroundColor: '#00FF9405', borderWidth: 1, borderRadius: 6, padding: 14, alignItems: 'center', gap: 3 },
  dataCellMain: { flex: 1.2 },
  dataCellLabel: { fontSize: 8, letterSpacing: 2 },
  dataCellValue: { fontSize: 22, fontWeight: '900' },
  dataCellSub: { fontSize: 7, letterSpacing: 1 },
  bottomBar: { flexDirection: 'row', gap: 8, width: '100%' },
  bottomInfoBox: { flex: 1, borderWidth: 1, borderRadius: 4, padding: 10, alignItems: 'center', gap: 3, backgroundColor: '#00FF9403' },
  bottomInfoLabel: { fontSize: 7, letterSpacing: 2 },
  bottomInfoValue: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  secretPanel: { position: 'absolute', bottom: 80, left: 16, right: 16, backgroundColor: '#020407', borderWidth: 1, borderColor: '#FF2D5530', borderRadius: 6, padding: 14 },
  secretTitle: { color: '#FF2D55', fontSize: 10, fontWeight: '700', marginBottom: 10, letterSpacing: 2 },
  secretBtn: { backgroundColor: '#FF2D5508', padding: 9, borderRadius: 4, marginBottom: 5, borderWidth: 1, borderColor: '#FF2D5520' },
  secretBtnTxt: { color: '#FF2D5580', fontSize: 10 },
  closeBtn: { marginTop: 4, alignItems: 'center', padding: 6 },
  closeTxt: { color: '#FF2D5540', fontSize: 10 },
});
