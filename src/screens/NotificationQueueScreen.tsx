import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueueItem } from '../lib/notificationGating';
import * as Notifications from 'expo-notifications';

const C = { BG: '#020407', GREEN: '#00FF94', RED: '#FF2D55' };

export default function NotificationQueueScreen({ navigation }: any) {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const loadQueue = async () => {
    const raw = await AsyncStorage.getItem('notif_queue');
    setQueue(raw ? JSON.parse(raw) : []);
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 1000);
    return () => clearInterval(interval);
  }, []);

  const releaseAll = async () => {
    if (queue.length === 0) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `FocusOS: ${queue.length} notifications held`,
        body: 'Tap to see what you missed during deep focus',
        data: { type: 'queue_release' },
      },
      trigger: null,
    });
    await AsyncStorage.removeItem('notif_queue');
    setQueue([]);
    navigation.goBack();
  };

  const dismissAll = async () => {
    await AsyncStorage.removeItem('notif_queue');
    setQueue([]);
    navigation.goBack();
  };

  const timeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}S AGO`;
    return `${Math.floor(diff / 60)}M AGO`;
  };

  return (
    <View style={styles.container}>
      {/* Grid */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.gridLine, { top: `${i * 18}%` as any }]} />
      ))}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HELD QUEUE</Text>
        <View style={[styles.countBadge, queue.length > 0 && styles.countBadgeActive]}>
          <Text style={[styles.countText, queue.length > 0 && styles.countTextActive]}>{queue.length}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.releaseBtn} onPress={releaseAll}>
          <Text style={styles.releaseBtnText}>[ RELEASE ALL ]</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dismissBtn} onPress={dismissAll}>
          <Text style={styles.dismissBtnText}>[ DISMISS ALL ]</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.sectionDivider}>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionLabel}>INTERCEPTED SIGNALS</Text>
        <View style={styles.sectionLine} />
      </View>

      {queue.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>[ — ]</Text>
          <Text style={styles.emptyText}>QUEUE CLEAR</Text>
          <Text style={styles.emptySub}>No signals intercepted</Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.queueItem}>
              <View style={styles.queueItemIndex}>
                <Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <View style={styles.queueItemContent}>
                <View style={styles.queueItemTop}>
                  <Text style={styles.appName}>{item.app.toUpperCase()}</Text>
                  <Text style={styles.timeText}>{timeAgo(item.receivedAt)}</Text>
                </View>
                <Text style={styles.bodyText}>{item.body.slice(0, 50)}{item.body.length > 50 ? '...' : ''}</Text>
              </View>
              <View style={styles.interceptedBadge}>
                <Text style={styles.interceptedText}>HELD</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG, paddingTop: 56, paddingHorizontal: 20 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#00FF9406' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 4 },
  backText: { color: '#00FF9060', fontSize: 10, letterSpacing: 2 },
  headerTitle: { color: C.GREEN, fontSize: 14, fontWeight: '900', letterSpacing: 4 },
  countBadge: { backgroundColor: '#00FF9410', borderWidth: 1, borderColor: '#00FF9430', width: 28, height: 28, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  countBadgeActive: { backgroundColor: '#FF2D5520', borderColor: '#FF2D5560' },
  countText: { color: '#00FF9060', fontSize: 12, fontWeight: '700' },
  countTextActive: { color: C.RED },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  releaseBtn: { flex: 1, borderWidth: 1, borderColor: '#00FF9440', backgroundColor: '#00FF9410', padding: 13, borderRadius: 4, alignItems: 'center' },
  releaseBtnText: { color: C.GREEN, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  dismissBtn: { flex: 1, borderWidth: 1, borderColor: '#FF2D5530', backgroundColor: '#FF2D5508', padding: 13, borderRadius: 4, alignItems: 'center' },
  dismissBtnText: { color: '#FF2D5580', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#00FF9415' },
  sectionLabel: { color: '#00FF9030', fontSize: 8, letterSpacing: 3 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { color: '#00FF9030', fontSize: 24 },
  emptyText: { color: '#00FF9050', fontSize: 14, fontWeight: '700', letterSpacing: 4 },
  emptySub: { color: '#00FF9025', fontSize: 10, letterSpacing: 2 },
  listContent: { gap: 8, paddingBottom: 40 },
  queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00FF9406', borderWidth: 1, borderColor: '#00FF9415', borderRadius: 4, padding: 12, gap: 12 },
  queueItemIndex: { width: 28, alignItems: 'center' },
  indexText: { color: '#00FF9030', fontSize: 10 },
  queueItemContent: { flex: 1, gap: 4 },
  queueItemTop: { flexDirection: 'row', justifyContent: 'space-between' },
  appName: { color: C.GREEN, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  timeText: { color: '#00FF9040', fontSize: 9 },
  bodyText: { color: '#00FF9050', fontSize: 11, lineHeight: 16 },
  interceptedBadge: { backgroundColor: '#FF2D5515', borderWidth: 1, borderColor: '#FF2D5530', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3 },
  interceptedText: { color: '#FF2D5570', fontSize: 7, letterSpacing: 1 },
});
