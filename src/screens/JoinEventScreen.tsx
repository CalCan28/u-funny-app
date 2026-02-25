import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../services/supabase';

// Design colors matching the app
const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  error: '#d9534f',
  success: '#5cb85c',
};

type EventData = {
  id: string;
  venue_name: string;
  address: string;
  city: string;
  state: string;
  event_date: string;
  event_time: string;
  room_code: string;
  description: string;
  host_id: string;
  is_active: boolean;
};

type ParticipantData = {
  id: string;
  lineup_position: number;
  scanned_at: string;
  has_performed: boolean;
};

export default function JoinEventScreen({ navigation, route }: any) {
  const { roomCode } = route.params || {};

  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roomCode) {
      loadEvent();
    } else {
      setError('Invalid room code');
      setIsLoading(false);
    }
  }, [roomCode]);

  const loadEvent = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch event by room code
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('room_code', roomCode)
        .eq('is_active', true)
        .single();

      if (eventError) {
        if (eventError.code === 'PGRST116') {
          setError('Event not found or no longer active');
        } else {
          throw eventError;
        }
        return;
      }

      setEvent(eventData);

      // Check if user is already a participant
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: participantData } = await supabase
          .from('event_participants')
          .select('*')
          .eq('event_id', eventData.id)
          .eq('user_id', user.id)
          .single();

        if (participantData) {
          setParticipant(participantData);
        }
      }

      // Get participant count
      const { count } = await supabase
        .from('event_participants')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventData.id);

      setParticipantCount(count || 0);
    } catch (err: any) {
      // Sentry captures this automatically
      setError(err.message || 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinEvent = async () => {
    if (!event) return;

    setIsJoining(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Sign In Required',
          'Please sign in to join this event',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign In',
              onPress: () => navigation.navigate('Profile'),
            },
          ]
        );
        return;
      }

      // Join the event
      const { data, error } = await supabase
        .from('event_participants')
        .insert({
          event_id: event.id,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Joined', "You're already in the lineup for this event!");
        } else {
          throw error;
        }
        return;
      }

      setParticipant(data);
      setParticipantCount(prev => prev + 1);

      Alert.alert(
        'Welcome to the Lineup!',
        `You're #${data.lineup_position} in the lineup. Good luck! 🎤`,
        [
          {
            text: 'View Lineup',
            onPress: () => navigation.navigate('TonightsLineup', {
              eventId: event.id,
              venueName: event.venue_name,
            }),
          },
          { text: 'Stay Here', style: 'cancel' },
        ]
      );
    } catch (err: any) {
      // Sentry captures this automatically
      Alert.alert('Error', err.message || 'Failed to join event');
    } finally {
      setIsJoining(false);
    }
  };

  const handleViewLineup = () => {
    if (event) {
      navigation.navigate('TonightsLineup', {
        eventId: event.id,
        venueName: event.venue_name,
      });
    }
  };

  const handleGiveFeedback = () => {
    if (event) {
      navigation.navigate('CritiqueFeedback', {
        eventId: event.id,
        venueName: event.venue_name,
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Event</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.content}>
        {/* Event Card */}
        <View style={styles.eventCard}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventEmoji}>🎤</Text>
            <View style={styles.eventBadge}>
              <Text style={styles.eventBadgeText}>LIVE TONIGHT</Text>
            </View>
          </View>

          <Text style={styles.venueName}>{event.venue_name}</Text>
          <Text style={styles.venueAddress}>{event.address}</Text>
          <Text style={styles.venueLocation}>
            {event.city}, {event.state}
          </Text>

          <View style={styles.eventDetails}>
            <View style={styles.eventDetailRow}>
              <Text style={styles.eventDetailIcon}>📅</Text>
              <Text style={styles.eventDetailText}>{formatDate(event.event_date)}</Text>
            </View>
            <View style={styles.eventDetailRow}>
              <Text style={styles.eventDetailIcon}>🕐</Text>
              <Text style={styles.eventDetailText}>{formatTime(event.event_time)}</Text>
            </View>
            <View style={styles.eventDetailRow}>
              <Text style={styles.eventDetailIcon}>👥</Text>
              <Text style={styles.eventDetailText}>
                {participantCount} {participantCount === 1 ? 'comedian' : 'comedians'} in lineup
              </Text>
            </View>
          </View>

          {event.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          )}

          <View style={styles.roomCodeContainer}>
            <Text style={styles.roomCodeLabel}>Room Code</Text>
            <Text style={styles.roomCode}>{event.room_code}</Text>
          </View>
        </View>

        {/* Status & Actions */}
        {participant ? (
          <View style={styles.joinedContainer}>
            <View style={styles.joinedBadge}>
              <Text style={styles.joinedEmoji}>✅</Text>
              <Text style={styles.joinedText}>You're in the lineup!</Text>
            </View>
            <Text style={styles.positionText}>
              Your position: #{participant.lineup_position}
            </Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={handleViewLineup}
              >
                <Text style={styles.actionButtonPrimaryText}>📋 View Lineup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGiveFeedback}
              >
                <Text style={styles.actionButtonText}>💬 Give Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.joinContainer}>
            <TouchableOpacity
              style={[styles.joinButton, isJoining && styles.joinButtonDisabled]}
              onPress={handleJoinEvent}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>🎭 Join the Lineup</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.joinHint}>
              Tap to add yourself to tonight's performer list
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  eventCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  eventEmoji: {
    fontSize: 40,
  },
  eventBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textDark,
    letterSpacing: 0.5,
  },
  venueName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  venueAddress: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 4,
  },
  venueLocation: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 20,
  },
  eventDetails: {
    gap: 12,
    marginBottom: 20,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eventDetailIcon: {
    fontSize: 20,
  },
  eventDetailText: {
    fontSize: 16,
    color: colors.textDark,
  },
  descriptionContainer: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 15,
    color: colors.textDark,
    lineHeight: 22,
  },
  roomCodeContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  roomCodeLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  roomCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 6,
  },
  joinedContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(92, 184, 92, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    marginBottom: 8,
  },
  joinedEmoji: {
    fontSize: 20,
  },
  joinedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  positionText: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 24,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  actionButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  joinContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  joinHint: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
