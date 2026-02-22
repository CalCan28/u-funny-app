import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import RecentCheckInCard, { CheckInData } from '../components/RecentCheckInCard';

const colors = {
  background: '#fdfcfa',
  cardBg: '#e8e4da',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  starFilled: '#e8b944',
};

interface RecentCritique {
  id: string;
  rating: number;
  feedback_text: string | null;
  created_at: string;
  receiver_display_name: string | null;
  receiver_stage_name: string | null;
}

export default function RecentsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInData[]>([]);
  const [allCheckIns, setAllCheckIns] = useState<CheckInData[]>([]);
  const [recentCritiques, setRecentCritiques] = useState<RecentCritique[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllCheckIns, setShowAllCheckIns] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch recent check-ins with event details
      const { data: checkInsData, error: checkInsError } = await supabase
        .from('event_participants')
        .select(`
          id,
          event_id,
          scanned_at,
          lineup_position,
          has_performed,
          events (
            venue_name,
            city,
            state,
            event_date,
            event_time,
            room_code
          )
        `)
        .eq('user_id', user.id)
        .order('scanned_at', { ascending: false })
        .limit(50);

      if (checkInsError) throw checkInsError;

      // Transform the data to flatten the events join
      const transformedCheckIns: CheckInData[] = (checkInsData || [])
        .filter((item: any) => item.events) // Filter out any with missing event data
        .map((item: any) => ({
          id: item.id,
          event_id: item.event_id,
          scanned_at: item.scanned_at,
          lineup_position: item.lineup_position,
          has_performed: item.has_performed,
          venue_name: item.events.venue_name,
          city: item.events.city,
          state: item.events.state,
          event_date: item.events.event_date,
          event_time: item.events.event_time,
          room_code: item.events.room_code,
        }));

      setAllCheckIns(transformedCheckIns);
      setRecentCheckIns(transformedCheckIns.slice(0, 10));

      // Fetch recent critiques given
      const { data: critiquesData, error: critiquesError } = await supabase
        .from('feedback_with_profiles')
        .select('id, rating, feedback_text, created_at, receiver_display_name, receiver_stage_name')
        .eq('giver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (critiquesError) throw critiquesError;

      setRecentCritiques(critiquesData || []);
    } catch (error: any) {
      console.error('Error fetching recents:', error);
      Alert.alert('Error', 'Failed to load recent activity');
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    loadData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCheckInPress = (checkIn: CheckInData) => {
    // Navigate to tonight's lineup for that event
    navigation.navigate('TonightsLineup', {
      eventId: checkIn.event_id,
      venueName: checkIn.venue_name,
    });
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? colors.starFilled : colors.textMuted}
        />
      );
    }
    return stars;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  };

  const displayedCheckIns = showAllCheckIns ? allCheckIns : recentCheckIns;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recents</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Section 1: Recent Check-ins */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Check-ins</Text>
            {allCheckIns.length > 10 && (
              <TouchableOpacity onPress={() => setShowAllCheckIns(!showAllCheckIns)}>
                <Text style={styles.seeAllText}>
                  {showAllCheckIns ? 'Show Less' : 'See All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {displayedCheckIns.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="qr-code-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Check-ins Yet</Text>
              <Text style={styles.emptyText}>
                Scan a QR code at an open mic to check in and see your history here.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('CheckIn')}
              >
                <Text style={styles.emptyButtonText}>Scan QR Code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            displayedCheckIns.map((checkIn) => (
              <RecentCheckInCard
                key={checkIn.id}
                checkIn={checkIn}
                onPress={() => handleCheckInPress(checkIn)}
              />
            ))
          )}
        </View>

        {/* Section 2: Recent Critiques Given */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Critiques Given</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TipsAndCritiques')}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentCritiques.length === 0 ? (
            <View style={styles.emptyStateSmall}>
              <Ionicons name="chatbubble-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyTextSmall}>
                No critiques given yet. Support fellow comedians by sharing feedback!
              </Text>
            </View>
          ) : (
            recentCritiques.map((critique) => (
              <TouchableOpacity
                key={critique.id}
                style={styles.critiqueCard}
                onPress={() => navigation.navigate('TipsAndCritiques')}
              >
                <View style={styles.critiqueHeader}>
                  <Text style={styles.critiqueName} numberOfLines={1}>
                    {critique.receiver_stage_name || critique.receiver_display_name || 'Unknown'}
                  </Text>
                  <Text style={styles.critiqueTime}>{formatTimeAgo(critique.created_at)}</Text>
                </View>
                <View style={styles.critiqueStars}>{renderStars(critique.rating)}</View>
                {critique.feedback_text && (
                  <Text style={styles.critiqueText} numberOfLines={2}>
                    "{critique.feedback_text}"
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBg,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textDark,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  emptyStateSmall: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  emptyTextSmall: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  critiqueCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  critiqueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  critiqueName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
    flex: 1,
  },
  critiqueTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 8,
  },
  critiqueStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  critiqueText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
