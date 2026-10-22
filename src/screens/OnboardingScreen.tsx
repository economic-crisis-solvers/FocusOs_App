import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = { BG: '#020407', GREEN: '#00FF94' };

const STEPS = [
  {
    id: 1,
    tag: '01 / 03',
    title: 'ATTENTION\nSECURITY',
    sub: 'FocusOS monitors your cognitive state in real-time and activates a distraction shield automatically — no manual action required.',
    bullets: ['// Real-time focus score (0–100)', '// Automatic notification gating', '// Cross-device attention tracking'],
    btn: '[ INITIALIZE ]',
  },
  {
    id: 2,
    tag: '02 / 03',
    title: 'GRANT\nACCESS',
    sub: 'FocusOS requires notification access to hold and batch-release interruptions during deep focus windows.',
    bullets: ['// Notifications held during focus', '// Released as a bundle on recovery', '// Zero interruptions while deep working'],
    btn: '[ ALLOW NOTIFICATIONS ]',
  },
  {
    id: 3,
    tag: '03 / 03',
    title: 'SET\nTHRESHOLD',
    sub: 'The shield activates when your focus score drops below this value. Default 45 is recommended.',
    bullets: null,
    btn: '[ DEPLOY SYSTEM ]',
  },
];

export default function OnboardingScreen({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [threshold, setThreshold] = useState(45);
  const s = STEPS[step];

  const handleNext = async () => {
    if (step === 1) {
      await Notifications.requestPermissionsAsync();
    }
    if (step === 2) {
      await AsyncStorage.setItem('threshold', String(threshold));
      navigation.replace('Login');
      return;
    }
    setStep(step + 1);
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={[styles.gridLine, { top: `${i * 14}%` as any }]} />
      ))}

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
        ))}
      </View>
      <Text style={styles.stepTag}>{s.tag}</Text>

      {/* Main content */}
      <View style={styles.mainContent}>
        {/* Corner decorations */}
        <View style={styles.cornerTL} />
        <View style={styles.cornerBR} />

        <Text style={styles.title}>{s.title}</Text>
        <View style={styles.titleDivider} />
        <Text style={styles.sub}>{s.sub}</Text>

        {s.bullets && (
          <View style={styles.bulletList}>
            {s.bullets.map((b, i) => (
              <Text key={i} style={styles.bullet}>{b}</Text>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.sliderBlock}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>THRESHOLD</Text>
              <Text style={styles.sliderValue}>{threshold}</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={threshold}
              onValueChange={setThreshold}
              minimumTrackTintColor={C.GREEN}
              maximumTrackTintColor="#00FF9420"
              thumbTintColor={C.GREEN}
            />
            <View style={styles.sliderScale}>
              <Text style={styles.sliderScaleText}>0</Text>
              <Text style={styles.sliderScaleText}>50</Text>
              <Text style={styles.sliderScaleText}>100</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleNext}>
        <Text style={styles.btnText}>{s.btn}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40, justifyContent: 'space-between' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#00FF9406' },
  stepRow: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 24, height: 3, borderRadius: 2, backgroundColor: '#00FF9415' },
  stepDotActive: { backgroundColor: C.GREEN },
  stepDotDone: { backgroundColor: '#00FF9440' },
  stepTag: { color: '#00FF9040', fontSize: 9, letterSpacing: 4, marginTop: 6 },
  mainContent: { flex: 1, justifyContent: 'center', paddingVertical: 40, position: 'relative' },
  cornerTL: { position: 'absolute', top: 20, left: 0, width: 20, height: 20, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#00FF9430' },
  cornerBR: { position: 'absolute', bottom: 20, right: 0, width: 20, height: 20, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#00FF9430' },
  title: { color: C.GREEN, fontSize: 42, fontWeight: '900', letterSpacing: 2, lineHeight: 48 },
  titleDivider: { width: 40, height: 2, backgroundColor: C.GREEN, marginVertical: 16, opacity: 0.6 },
  sub: { color: '#00FF9060', fontSize: 13, lineHeight: 20, letterSpacing: 0.5 },
  bulletList: { marginTop: 24, gap: 10 },
  bullet: { color: '#00FF9050', fontSize: 11, letterSpacing: 1 },
  sliderBlock: { marginTop: 30, gap: 8 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { color: '#00FF9050', fontSize: 9, letterSpacing: 3 },
  sliderValue: { color: C.GREEN, fontSize: 32, fontWeight: '900' },
  sliderScale: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderScaleText: { color: '#00FF9030', fontSize: 8 },
  btn: { backgroundColor: C.GREEN, padding: 18, borderRadius: 4, alignItems: 'center' },
  btnText: { color: C.BG, fontWeight: '900', fontSize: 13, letterSpacing: 3 },
});
