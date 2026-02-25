import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { supabase } from '../services/supabase';

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  success: '#6b8e6f',
  pending: '#e8b944',
};

type Performer = {
  id: string;
  user_id: string;
  lineup_position: number;
  has_performed: boolean;
  name: string;
  isCurrentUser: boolean;
};

type EventInfo = {
  venue_name: string;
  event_time: string;
};

function calcSlotTime(eventTime: string, position: number): string {
  const [h, m] = eventTime.split(':').map(Number);
  const totalMinutes = h * 60 + m + (position - 1) * 10;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

type PerformerCardProps = {
  performer: Performer;
  slotTime: string;
};

function PerformerCard({ performer, slotTime }: PerformerCardProps) {
  const statusBadge = performer.has_performed ? (
    <View style={[styles.statusBadge, styles.performedBadge]}>
      <Text style={styles.performedText}>Done</Text>
    </View>
  ) : (
    <View style={[styles.statusBadge, styles.checkedInBadge]}>
      <Text style={styles.checkedInText}>Checked in</Text>
    </View>
  );

  return (
    <View style={[styles.performerCard, performer.isCurrentUser && styles.currentUserCard]}>
      <View style={styles.slotNumber}>
        <Text style={styles.slotText}>{performer.lineup_position}</Text>
      </View>
      <View style={styles.performerInfo}>
        <Text style={[styles.performerName, performer.isCurrentUser && styles.currentUserName]}>
          {performer.name}
          {performer.isCurrentUser ? ' (You)' : ''}
        </Text>
        <Text style={styles.performerTime}>{slotTime}</Text>
      </View>
      {statusBadge}
    </View>
  );
}

export default function TonightsLineupScreen({ navigation, route }: any) {
  const { eventId, venueName: paramVenueName } = route?.params || {};

  const [performers, setPerformers] = useState<Performer[]>([]);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const venueName = eventInfo?.venue_name || paramVenueName || 'Comedy Club';

  const loadLineup = useCallback(async (showRefreshing = false) => {
    if (!eventId) {
      setError('No event selected');
      setIsLoading(false);
      return;
    }

    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      // Fetch event info
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('venue_name, event_time')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      setEventInfo(eventData);

      // Fetch participants ordered by lineup position
      const { data: participants, error: participantsError } = await supabase
        .from('event_participants')
        .select('id, user_id, lineup_position, has_performed')
        .eq('event_id', eventId)
        .order('lineup_position', { ascending: true });

      if (participantsError) throw participantsError;
      if (!participants || participants.length === 0) {
        setPerformers([]);
        return;
      }

      // Fetch profiles for all participants
      const userIds = participants.map((p) => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, stage_name')
        .in('id', userIds);

      // Merge into performer list
      const merged: Performer[] = participants.map((p) => {
        const profile = profiles?.find((pr) => pr.id === p.user_id);
        const name =
          profile?.stage_name ||
          profile?.display_name ||
          'Comedian';
        return {
          id: p.id,
          user_id: p.user_id,
          lineup_position: p.lineup_position,
          has_performed: p.has_performed,
          name,
          isCurrentUser: user?.id === p.user_id,
        };
      });

      setPerformers(merged);
    } catch (err: any) {
      // Sentry captures this automatically
      setError(err.message || 'Failed to load lineup');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadLineup();
    // Refresh every 30 seconds so the lineup stays live
    const interval = setInterval(() => loadLineup(false), 30000);
    return () => clearInterval(interval);
  }, [loadLineup]);

  const userEntry = performers.find((p) => p.isCurrentUser);
  const performersAhead = userEntry ? userEntry.lineup_position - 1 : 0;
  const checkedInCount = performers.length;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading lineup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorTitle}>Couldn't load lineup</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadLineup()}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLinkButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.backLinkText}>← Go home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Venue Header */}
      <View style={styles.venueHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
        <Text style={styles.venueName}>Live at {venueName}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadLineup(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Tonight's Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tonight's Data</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{checkedInCount}</Text>
              <Text style={styles.statLabel}>Checked In</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {performers.filter((p) => p.has_performed).length}
              </Text>
              <Text style={styles.statLabel}>Performed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {performers.filter((p) => !p.has_performed).length}
              </Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          </View>

          {userEntry && (
            <View style={styles.userPositionCard}>
              <Text style={styles.userPositionTitle}>Your spot</Text>
              <Text style={styles.userPositionNumber}>#{userEntry.lineup_position}</Text>
              <Text style={styles.userPositionSubtext}>
                {userEntry.has_performed
                  ? 'You already crushed it!'
                  : performersAhead === 0
                  ? "You're up next!"
                  : `${performersAhead} performer${performersAhead > 1 ? 's' : ''} ahead of you`}
              </Text>
            </View>
          )}
        </View>

        {/* Lineup */}
        <View style={styles.lineupSection}>
          <Text style={styles.sectionTitle}>Lineup</Text>

          {performers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎤</Text>
              <Text style={styles.emptyText}>No one's checked in yet.</Text>
              <Text style={styles.emptySubtext}>Be the first on the list!</Text>
            </View>
          ) : (
            performers.map((performer) => (
              <PerformerCard
                key={performer.id}
                performer={performer}
                slotTime={
                  eventInfo
                    ? calcSlotTime(eventInfo.event_time, performer.lineup_position)
                    : `Slot ${performer.lineup_position}`
                }
              />
            ))
          )}

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* Give Feedback Button */}
      <TouchableOpacity
        style={styles.feedbackButton}
        onPress={() => navigation.navigate('CritiqueFeedback', { eventId, venueName })}
      >
        <Text style={styles.feedbackButtonText}>Give Feedback</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textMuted,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  backLinkButton: {
    paddingVertical: 8,
  },
  backLinkText: {
    color: colors.primary,
    fontSize: 15,
  },
  venueHeader: {
    backgroundColor: colors.primary,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
    position: 'relative',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  venueName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  userPositionCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  userPositionTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  userPositionNumber: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  userPositionSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 4,
  },
  lineupSection: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  performerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  currentUserCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(107, 142, 111, 0.08)',
  },
  slotNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  slotText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 2,
  },
  currentUserName: {
    color: colors.primary,
  },
  performerTime: {
    fontSize: 14,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  checkedInBadge: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
  },
  checkedInText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  performedBadge: {
    backgroundColor: 'rgba(92, 74, 58, 0.1)',
  },
  performedText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  feedbackButtonText: {
    color: colors.textDark,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
