import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const colors = {
  background: '#fdfcfa',
  cardBg: '#e8e4da',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  error: '#d9534f',
  starFilled: '#e8b944',
  starEmpty: '#d4d0c5',
};

export interface FeedbackData {
  id: string;
  giver_id: string;
  receiver_id: string;
  event_name: string | null;
  venue: string | null;
  event_date: string | null;
  rating: number;
  feedback_text: string | null;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  // Profile info from view
  giver_display_name: string | null;
  giver_stage_name: string | null;
  giver_avatar_url: string | null;
  receiver_display_name: string | null;
  receiver_stage_name: string | null;
  receiver_avatar_url: string | null;
}

interface CritiqueCardProps {
  feedback: FeedbackData;
  type: 'received' | 'given';
  currentUserId: string;
  onEdit?: (feedback: FeedbackData) => void;
  onDelete?: (feedbackId: string) => void;
}

export default function CritiqueCard({
  feedback,
  type,
  currentUserId,
  onEdit,
  onDelete,
}: CritiqueCardProps) {
  const isWithin24Hours = () => {
    const createdAt = new Date(feedback.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  };

  const canEditDelete = type === 'given' && isWithin24Hours();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDisplayName = () => {
    if (type === 'received') {
      // Show who gave the feedback
      if (feedback.is_anonymous && feedback.giver_id !== currentUserId) {
        return 'Anonymous Comedian';
      }
      return feedback.giver_stage_name || feedback.giver_display_name || 'Unknown';
    } else {
      // Show who received the feedback
      return feedback.receiver_stage_name || feedback.receiver_display_name || 'Unknown';
    }
  };

  const getAvatarUrl = () => {
    if (type === 'received') {
      if (feedback.is_anonymous && feedback.giver_id !== currentUserId) {
        return null;
      }
      return feedback.giver_avatar_url;
    } else {
      return feedback.receiver_avatar_url;
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Feedback',
      'Are you sure you want to delete this feedback? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(feedback.id),
        },
      ]
    );
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= feedback.rating ? 'star' : 'star-outline'}
          size={18}
          color={i <= feedback.rating ? colors.starFilled : colors.starEmpty}
        />
      );
    }
    return stars;
  };

  const avatarUrl = getAvatarUrl();
  const displayName = getDisplayName();
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      {/* Header with avatar and name */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {feedback.is_anonymous && type === 'received' ? '?' : initial}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.date}>{formatDate(feedback.created_at)}</Text>
        </View>
        {canEditDelete && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEdit?.(feedback)}
            >
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Event info */}
      {(feedback.event_name || feedback.venue) && (
        <View style={styles.eventInfo}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.eventText}>
            {[feedback.event_name, feedback.venue].filter(Boolean).join(' @ ')}
            {feedback.event_date && ` · ${formatDate(feedback.event_date)}`}
          </Text>
        </View>
      )}

      {/* Star rating */}
      <View style={styles.ratingContainer}>
        <View style={styles.stars}>{renderStars()}</View>
      </View>

      {/* Feedback text */}
      {feedback.feedback_text && (
        <Text style={styles.feedbackText}>{feedback.feedback_text}</Text>
      )}

      {/* Time remaining badge for editable items */}
      {canEditDelete && (
        <View style={styles.editBadge}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.editBadgeText}>Editable for 24h</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  date: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  eventText: {
    fontSize: 14,
    color: colors.textMuted,
    flex: 1,
  },
  ratingContainer: {
    marginBottom: 10,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  feedbackText: {
    fontSize: 15,
    color: colors.textDark,
    lineHeight: 22,
  },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  editBadgeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
