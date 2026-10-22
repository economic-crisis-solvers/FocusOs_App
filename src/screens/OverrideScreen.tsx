import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

const C = { BG: '#020407', GREEN: '#00FF94', RED: '#FF2D55', YELLOW: '#FFD60A' };

export default function OverrideScreen({ navigation }: any) {
  const [selected, setSelected] = useState<number | null>(null);

  const durations = [
    { mins: 15, label: '15 MIN', sub: 'SHORT BREAK' },
    { mins: 30, label: '30 MIN', sub: 'MEDIUM BREAK' },
    { mins: 60, label: '01 HR', sub: 'LONG BREAK' },
  ];

  if (!selected) return (
    <View style={styles.container}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.gridLine, { top: `${i * 18}%` as any }]} />
      ))}

      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← ABORT</Text>
      </TouchableOpacity>

      <View style={styles.centerContent}>
        <View style={styles.warningBlock}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerBR} />
          <Text style={styles.warningTag}>// OVERRIDE REQUEST</Text>
          <Text style={styles.warningTitle}>DISABLE{'\n'}SHIELD?</Text>
          <View style={styles.divider} />
          <Text style={styles.warningSub}>This will temporarily suspend focus protection and release all held notifications.</Text>
        </View>

        <Text style={styles.selectLabel}>SELECT DURATION</Text>

        <View style={styles.durationList}>
          {durations.map((d) => (
            <TouchableOpacity key={d.mins} style={styles.durationBtn} onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelected(d.mins);
            }}>
              <View style={styles.durationLeft}>
                <Text style={styles.durationLabel}>{d.label}</Text>
                <Text style={styles.durationSub}>{d.sub}</Text>
              </View>
              <Text style={styles.durationArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.gridLine, { top: `${i * 18}%` as any }]} />
      ))}

      <View style={styles.centerContent}>
        <View style={styles.confirmBlock}>
          <View style={styles.cornerTLRed} />
          <View style={styles.cornerBRRed} />
          <Text style={styles.confirmTag}>// CONFIRM OVERRIDE</Text>
          <Text style={styles.confirmDuration}>{selected} MIN</Text>
          <Text style={styles.confirmTitle}>SHIELD DOWN</Text>
          <View style={styles.dividerRed} />
          <Text style={styles.confirmSub}>
            All held notifications will be released.{'\n'}
            +5 min attention residue will be added.{'\n'}
            Shield auto-reactivates after {selected} minutes.
          </Text>
        </View>

        <TouchableOpacity style={styles.confirmBtn} onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          navigation.replace('Main');
        }}>
          <Text style={styles.confirmBtnText}>[ CONFIRM OVERRIDE ]</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}>
          <Text style={styles.cancelText}>← GO BACK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#00FF9406' },
  backRow: { marginBottom: 20 },
  backText: { color: '#00FF9050', fontSize: 10, letterSpacing: 2 },
  centerContent: { flex: 1, justifyContent: 'center', gap: 24 },
  warningBlock: { borderWidth: 1, borderColor: '#FFD60A30', backgroundColor: '#FFD60A05', padding: 24, borderRadius: 4, gap: 12, position: 'relative' },
  cornerTL: { position: 'absolute', top: -1, left: -1, width: 16, height: 16, borderTopWidth: 2, borderLeftWidth: 2, borderColor: C.YELLOW },
  cornerBR: { position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderBottomWidth: 2, borderRightWidth: 2, borderColor: C.YELLOW },
  warningTag: { color: '#FFD60A60', fontSize: 9, letterSpacing: 3 },
  warningTitle: { color: C.YELLOW, fontSize: 44, fontWeight: '900', letterSpacing: 2, lineHeight: 48 },
  divider: { width: 32, height: 2, backgroundColor: C.YELLOW, opacity: 0.4 },
  warningSub: { color: '#FFD60A60', fontSize: 12, lineHeight: 18 },
  selectLabel: { color: '#00FF9040', fontSize: 9, letterSpacing: 4 },
  durationList: { gap: 10 },
  durationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#00FF9408', borderWidth: 1, borderColor: '#00FF9425', padding: 16, borderRadius: 4 },
  durationLeft: { gap: 2 },
  durationLabel: { color: C.GREEN, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  durationSub: { color: '#00FF9040', fontSize: 8, letterSpacing: 2 },
  durationArrow: { color: '#00FF9050', fontSize: 16 },
  confirmBlock: { borderWidth: 1, borderColor: '#FF2D5530', backgroundColor: '#FF2D5508', padding: 24, borderRadius: 4, gap: 12, position: 'relative' },
  cornerTLRed: { position: 'absolute', top: -1, left: -1, width: 16, height: 16, borderTopWidth: 2, borderLeftWidth: 2, borderColor: C.RED },
  cornerBRRed: { position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderBottomWidth: 2, borderRightWidth: 2, borderColor: C.RED },
  confirmTag: { color: '#FF2D5550', fontSize: 9, letterSpacing: 3 },
  confirmDuration: { color: '#FF2D5580', fontSize: 13, letterSpacing: 4 },
  confirmTitle: { color: C.RED, fontSize: 44, fontWeight: '900', letterSpacing: 2 },
  dividerRed: { width: 32, height: 2, backgroundColor: C.RED, opacity: 0.4 },
  confirmSub: { color: '#FF2D5560', fontSize: 11, lineHeight: 18 },
  confirmBtn: { backgroundColor: C.RED, padding: 18, borderRadius: 4, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { color: '#00FF9040', fontSize: 10, letterSpacing: 2 },
});
