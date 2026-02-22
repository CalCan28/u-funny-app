import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  background: '#fdfcfa',
  cardBg: '#e8e4da',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
};

export interface CheckInData {
  id: string;
  event_id: string;
  scanned_at: string;
  lineup_position: number | null;
  has_performed: boolean;
  // Joined from events table
  venue_name: string;
  city: string;
  state: string;
  event_date: string;
  event_time: string;
  room_code: string;
}

interface RecentCheckInCardProps {
  checkIn: CheckInData;
  onPress?: () => void;
}

export default function RecentCheckInCard({ checkIn, onPress }: RecentCheckInCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    // Handle HH:MM format
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name="location" size={24} color={colors.primary} />
      </View>

      <View style={styles.content}>
        <Text style={styles.venueName} numberOfLines={1}>
          {checkIn.venue_name}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          {checkIn.city}, {checkIn.state}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatDate(checkIn.event_date)}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.time}>{formatTime(checkIn.event_time)}</Text>
          {checkIn.lineup_position && (
            <>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.position}>#{checkIn.lineup_position}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={styles.timeAgo}>{getTimeAgo(checkIn.scanned_at)}</Text>
        {checkIn.has_performed && (
          <View style={styles.performedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 2,
  },
  location: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: colors.textMuted,
  },
  dot: {
    fontSize: 13,
    color: colors.textMuted,
    marginHorizontal: 6,
  },
  time: {
    fontSize: 13,
    color: colors.textMuted,
  },
  position: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  timeAgo: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  performedBadge: {
    marginBottom: 4,
  },
});
