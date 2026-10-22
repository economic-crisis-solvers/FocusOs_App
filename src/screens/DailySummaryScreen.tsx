import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocus } from '../context/FocusContext';
import { useAuth } from '../context/AuthContext';

const C = { BG: '#020407', GREEN: '#00FF94', RED: '#FF2D55', YELLOW: '#FFD60A' };
const API_URL = process.env.EXPO_PUBLIC_API_URL;

type Distraction = { triggerCategory: string; eventCount: number; totalResidue: number };
type PeakHour = { hour: number; avgScore: number };
type ResidueStats = { residueMinutesRemaining: number; minutesProtected: number; distractionCount: number };
type HistoryEntry = { period: string; avgScore: number; state: string };

export default function DailySummaryScreen() {
  const { score } = useFocus();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [heldCount, setHeldCount] = useState(0);
  const [distractions, setDistractions] = useState<Distraction[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHour[]>([]);
  const [residue, setResidue] = useState<ResidueStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load held notification count
  useEffect(() => {
    AsyncStorage.getItem('notif_queue').then((raw) => {
      setHeldCount(raw ? JSON.parse(raw).length : 0);
    });
  }, []);

  // Fetch real data from backend
  useEffect(() => {
    if (!token) return;
    setLoading(true);

    // Get a fresh token from Supabase (stored token may be expired)
    const getToken = async () => {
      const { data } = await (await import('../lib/supabase')).supabase.auth.getSession();
      return data.session?.access_token || token;
    };

    getToken().then((freshToken) => {
      return Promise.all([
        fetch(`${API_URL}/api/insights`, { headers: { Authorization: `Bearer ${freshToken}` } })
          .then((r) => {
            console.log('Insights response:', r.status);
            return r.ok ? r.json() : null;
          }),
        fetch(`${API_URL}/api/score/history`, { headers: { Authorization: `Bearer ${freshToken}` } })
          .then((r) => {
            console.log('History response:', r.status);
            return r.ok ? r.json() : null;
          }),
      ]);
    })
      .then(([insightsData, historyData]) => {
        console.log('Insights data:', JSON.stringify(insightsData)?.slice(0, 100));
        console.log('History data:', Array.isArray(historyData) ? `${historyData.length} entries` : 'null');
        if (insightsData) {
          setDistractions(insightsData.topDistractions || []);
          setPeakHours(insightsData.peakFocusHours || []);
          setResidue(insightsData.residueStats || null);
        }
        if (historyData && Array.isArray(historyData)) {
          setHistory(historyData);
        }
      })
      .catch((e) => console.log('Insights fetch error:', e))
      .finally(() => setLoading(false));
  }, [token]);

  // Compute stats from history
  const todayScores = history.map((h) => h.avgScore);
  const avg = todayScores.length > 0 ? Math.round(todayScores.reduce((a, b) => a + b, 0) / todayScores.length) : score;
  const focusEntries = todayScores.filter((s) => s >= 60).length;
  const distractedEntries = todayScores.filter((s) => s < 60).length;
  const total = focusEntries + distractedEntries || 1;
  const focusPct = Math.round((focusEntries / total) * 100);
  const grade = avg >= 80 ? 'A+' : avg >= 70 ? 'A' : avg >= 60 ? 'B' : avg >= 50 ? 'C' : 'D';
  const scoreColor = avg >= 70 ? C.GREEN : avg >= 50 ? C.YELLOW : C.RED;

  // Peak focus window
  const topPeak = peakHours.length > 0 ? peakHours[0] : null;
  const secondPeak = peakHours.length > 1 ? peakHours[1] : null;
  const peakWindowText = topPeak
    ? `${String(topPeak.hour).padStart(2, '0')}:00 — ${String((topPeak.hour + 1) % 24).padStart(2, '0')}:00`
    : '--:-- — --:--';

  // Text tags instead of emojis
  const categoryTag = (cat: string) => {
    switch (cat) {
      case 'entertainment': return 'ENT';
      case 'social': return 'SOC';
      case 'gaming': return 'GAM';
      default: return 'OTH';
    }
  };

  const categoryAccent = (i: number) =>
    i === 0 ? C.RED : i === 1 ? C.YELLOW : '#00FF9460';

  const protectedMinutes = residue?.minutesProtected ?? 0;
  const residueRemaining = residue?.residueMinutesRemaining ?? 0;
  const totalDistractions = residue?.distractionCount ?? distractions.reduce((sum, d) => sum + d.eventCount, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.gridLine, { top: i * 120 }]} />
      ))}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTag}>// DAILY REPORT</Text>
        <Text style={styles.headerTitle}>INTEL SUMMARY</Text>
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={C.GREEN} />
          <Text style={styles.loadingText}>FETCHING INTEL...</Text>
        </View>
      )}

      {/* Big score + grade */}
      <View style={styles.scoreBlock}>
        <View style={styles.cornerTL} />
        <View style={styles.cornerBR} />
        <View style={styles.scoreRow}>
          <View>
            <Text style={styles.scoreBlockLabel}>AVG FOCUS SCORE</Text>
            <Text style={[styles.scoreBlockValue, { color: scoreColor }]}>{avg}</Text>
          </View>
          <View style={styles.gradeBox}>
            <Text style={styles.gradeLabel}>GRADE</Text>
            <Text style={[styles.gradeValue, { color: scoreColor }]}>{grade}</Text>
          </View>
        </View>
      </View>

      {/* Focus vs Distracted */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>FOCUS EFFICIENCY</Text>
          <Text style={[styles.cardValue, { color: C.GREEN }]}>{focusPct}%</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { flex: focusPct, backgroundColor: C.GREEN }]} />
          <View style={[styles.barFill, { flex: 100 - focusPct, backgroundColor: C.RED + '40' }]} />
        </View>
        <View style={styles.barLegend}>
          <Text style={[styles.legendText, { color: C.GREEN }]}>FOCUS {focusEntries}h</Text>
          <Text style={[styles.legendText, { color: C.RED }]}>DISTRACTED {distractedEntries}h</Text>
        </View>
      </View>

      {/* Top Distractions */}
      {distractions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>TOP DISTRACTIONS</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>TYPE</Text>
            <Text style={[styles.tableHeaderCell, { width: 60, textAlign: 'right' }]}>EVENTS</Text>
            <Text style={[styles.tableHeaderCell, { width: 80, textAlign: 'right' }]}>RESIDUE</Text>
          </View>
          {distractions.map((d, i) => (
            <View key={i} style={[styles.tableRow, i < distractions.length - 1 && styles.tableRowBorder]}>
              <View style={styles.tableRowLeft}>
                <View style={[styles.categoryTag, { borderColor: categoryAccent(i) + '60', backgroundColor: categoryAccent(i) + '10' }]}>
                  <Text style={[styles.categoryTagText, { color: categoryAccent(i) }]}>{categoryTag(d.triggerCategory)}</Text>
                </View>
                <Text style={styles.tableRowName}>{d.triggerCategory.toUpperCase()}</Text>
              </View>
              <Text style={[styles.tableRowValue, { width: 60, textAlign: 'right' }]}>{d.eventCount}</Text>
              <Text style={[styles.tableRowValue, { width: 80, textAlign: 'right', color: C.YELLOW }]}>{Math.round(d.totalResidue)}m</Text>
            </View>
          ))}
        </View>
      )}

      {/* Score timeline — REAL DATA */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>SCORE TIMELINE</Text>
        <View style={styles.chart}>
          {history.length > 0 ? history.slice(-24).map((h, i) => (
            <View key={i} style={styles.chartBarWrap}>
              <View style={[styles.chartBar, {
                height: Math.max(2, h.avgScore * 0.72),
                backgroundColor: h.avgScore >= 60 ? C.GREEN : h.avgScore >= 40 ? C.YELLOW : C.RED,
                opacity: 0.7 + (i / Math.max(1, history.length)) * 0.3,
              }]} />
            </View>
          )) : (
            <Text style={styles.noDataText}>NO DATA YET</Text>
          )}
        </View>
        {history.length > 0 && (
          <View style={styles.timeLabels}>
            <Text style={styles.timeLabelText}>
              {new Date(history[0].period).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.timeLabelText}>
              {new Date(history[history.length - 1].period).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      </View>

      {/* Notifications held */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>SIGNALS INTERCEPTED</Text>
        <View style={styles.heldRow}>
          <Text style={[styles.heldNumber, { color: heldCount > 0 ? C.RED : C.GREEN }]}>{heldCount}</Text>
          <View style={styles.heldMeta}>
            <Text style={styles.heldMetaText}>NOTIFICATIONS</Text>
            <Text style={styles.heldMetaText}>HELD TODAY</Text>
          </View>
        </View>
      </View>

      {/* Peak focus window — REAL DATA */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>PEAK FOCUS WINDOW</Text>
        <Text style={styles.windowValue}>{peakWindowText}</Text>
        <Text style={styles.windowSub}>
          {topPeak ? `AVG SCORE ${topPeak.avgScore} — HIGHEST COGNITIVE OUTPUT` : 'CALCULATING...'}
        </Text>
      </View>

      {/* Status grid — REAL DATA */}
      <View style={styles.statusGrid}>
        {[
          { label: 'PROTECTED', value: `${Math.round(protectedMinutes)}m` },
          { label: 'RESIDUE', value: `${Math.round(residueRemaining)}m` },
          { label: 'EVENTS', value: String(totalDistractions) },
        ].map((item) => (
          <View key={item.label} style={styles.statusCell}>
            <Text style={styles.statusCellLabel}>{item.label}</Text>
            <Text style={styles.statusCellValue}>{item.value}</Text>
          </View>
        ))}
      </View>

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
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', padding: 12 },
  loadingText: { color: '#00FF9040', fontSize: 9, letterSpacing: 3 },
  scoreBlock: { borderWidth: 1, borderColor: '#00FF9425', backgroundColor: '#00FF9408', padding: 20, borderRadius: 4, position: 'relative' },
  cornerTL: { position: 'absolute', top: -1, left: -1, width: 14, height: 14, borderTopWidth: 2, borderLeftWidth: 2, borderColor: C.GREEN },
  cornerBR: { position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderBottomWidth: 2, borderRightWidth: 2, borderColor: C.GREEN },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreBlockLabel: { color: '#00FF9050', fontSize: 8, letterSpacing: 3 },
  scoreBlockValue: { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  gradeBox: { alignItems: 'center', borderWidth: 1, borderColor: '#00FF9430', padding: 16, borderRadius: 4, backgroundColor: '#00FF9408' },
  gradeLabel: { color: '#00FF9040', fontSize: 7, letterSpacing: 2 },
  gradeValue: { fontSize: 36, fontWeight: '900' },
  card: { borderWidth: 1, borderColor: '#00FF9418', backgroundColor: '#00FF9405', padding: 16, borderRadius: 4, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: '#00FF9045', fontSize: 8, letterSpacing: 3 },
  cardValue: { fontSize: 14, fontWeight: '700' },
  barTrack: { flexDirection: 'row', height: 6, borderRadius: 2, overflow: 'hidden', backgroundColor: '#00FF9410' },
  barFill: { height: '100%' },
  barLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { fontSize: 9, letterSpacing: 1 },
  // Table style
  tableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#00FF9415' },
  tableHeaderCell: { color: '#00FF9025', fontSize: 7, letterSpacing: 2 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: '#00FF940C' },
  tableRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryTag: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2 },
  categoryTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  tableRowName: { color: '#00FF9070', fontSize: 11, letterSpacing: 1 },
  tableRowValue: { color: C.GREEN, fontSize: 12, fontWeight: '700' },
  // Held
  heldRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heldNumber: { fontSize: 52, fontWeight: '900' },
  heldMeta: { gap: 2 },
  heldMetaText: { color: '#00FF9040', fontSize: 9, letterSpacing: 2 },
  // Chart
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 2 },
  chartBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 72 },
  chartBar: { width: '100%', borderRadius: 1 },
  noDataText: { color: '#00FF9020', fontSize: 10, letterSpacing: 3, flex: 1, textAlign: 'center', alignSelf: 'center' },
  timeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  timeLabelText: { color: '#00FF9025', fontSize: 7, letterSpacing: 1 },
  // Window
  windowValue: { color: C.GREEN, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  windowSub: { color: '#00FF9030', fontSize: 8, letterSpacing: 3 },
  // Status
  statusGrid: { flexDirection: 'row', gap: 8 },
  statusCell: { flex: 1, borderWidth: 1, borderColor: '#00FF9418', backgroundColor: '#00FF9405', padding: 14, borderRadius: 4, alignItems: 'center', gap: 4 },
  statusCellLabel: { color: '#00FF9040', fontSize: 7, letterSpacing: 2 },
  statusCellValue: { color: C.GREEN, fontSize: 18, fontWeight: '900' },
});