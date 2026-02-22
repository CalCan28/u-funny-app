import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Feedback, RATING_CATEGORIES, TONE_TAGS, INTENT_TAGS } from './types';
import { toggleHelpfulVote, deleteFeedback } from './feedbackService';

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  star: '#f4c430',
  starEmpty: '#d9d1c3',
  helpful: '#6b8e6f',
  danger: '#d9534f',
};

interface FeedbackCardProps {
  feedback: Feedback;
  currentUserId?: string;
  clipOwnerId?: string;
  isHighlighted?: boolean;
  onEdit?: () => void;
  onDeleted?: () => void;
  onVoteChanged?: (feedbackId: string, newCount: number, hasVoted: boolean) => void;
}

export default function FeedbackCard({
  feedback,
  currentUserId,
  clipOwnerId,
  isHighlighted,
  onEdit,
  onDeleted,
  onVoteChanged,
}: FeedbackCardProps) {
  const [helpfulCount, setHelpfulCount] = useState(feedback.helpful_count);
  const [hasVoted, setHasVoted] = useState(feedback.has_voted_helpful || false);
  const [voting, setVoting] = useState(false);

  const authorName =
    feedback.author?.stage_name ||
    feedback.author?.display_name ||
    'Anonymous';
  const authorInitial = authorName[0]?.toUpperCase() || '?';

  const isOwn = currentUserId === feedback.author_id;
  const canDelete = isOwn || currentUserId === clipOwnerId;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      if (diffHours < 1) {
        const mins = Math.floor(diffMs / (1000 * 60));
        return `${mins}m ago`;
      }
      return `${Math.floor(diffHours)}h ago`;
    }
    if (diffHours < 24 * 7) {
      return `${Math.floor(diffHours / 24)}d ago`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleToggleHelpful = async () => {
    if (!currentUserId || isOwn) return;

    setVoting(true);
    try {
      const nowVoted = await toggleHelpfulVote(feedback.id);
      const newCount = nowVoted ? helpfulCount + 1 : helpfulCount - 1;
      setHasVoted(nowVoted);
      setHelpfulCount(newCount);
      onVoteChanged?.(feedback.id, newCount, nowVoted);
    } catch (error) {
      console.error('Error toggling vote:', error);
    } finally {
      setVoting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Feedback',
      'Are you sure you want to delete this feedback?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFeedback(feedback.id);
              onDeleted?.();
            } catch (error) {
              console.error('Error deleting feedback:', error);
              Alert.alert('Error', 'Failed to delete feedback');
            }
          },
        },
      ]
    );
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={12}
            color={star <= rating ? colors.star : colors.starEmpty}
          />
        ))}
      </View>
    );
  };

  const toneInfo = TONE_TAGS.find(t => t.value === feedback.tone_tag);
  const intentInfo = INTENT_TAGS.find(t => t.value === feedback.intent_tag);

  return (
    <View style={[styles.card, isHighlighted && styles.cardHighlighted]}>
      {/* Header */}
      <View style={styles.header}>
        {feedback.author?.avatar_url ? (
          <Image source={{ uri: feedback.author.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{authorInitial}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.timestamp}>{formatDate(feedback.created_at)}</Text>
        </View>
        <View style={styles.overallScore}>
          <Text style={styles.overallScoreValue}>{feedback.overall_score.toFixed(1)}</Text>
          <Ionicons name="star" size={14} color={colors.star} />
        </View>
      </View>

      {/* Ratings Grid */}
      <View style={styles.ratingsGrid}>
        {RATING_CATEGORIES.map((cat) => {
          const rating = feedback[`rating_${cat.key}` as keyof Feedback] as number;
          return (
            <View key={cat.key} style={styles.ratingItem}>
              <Text style={styles.ratingLabel}>{cat.label}</Text>
              {renderStars(rating)}
            </View>
          );
        })}
      </View>

      {/* Tags */}
      <View style={styles.tagsRow}>
        {toneInfo && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{toneInfo.emoji} {toneInfo.label}</Text>
          </View>
        )}
        {intentInfo && (
          <View style={[styles.tag, styles.intentTag]}>
            <Text style={styles.tagText}>{intentInfo.emoji} {intentInfo.label}</Text>
          </View>
        )}
      </View>

      {/* Feedback Sections */}
      <View style={styles.feedbackSection}>
        <Text style={styles.feedbackLabel}>What Worked</Text>
        <Text style={styles.feedbackText}>{feedback.what_worked}</Text>
      </View>

      <View style={styles.feedbackSection}>
        <Text style={styles.feedbackLabel}>What To Improve</Text>
        <Text style={styles.feedbackText}>{feedback.what_to_improve}</Text>
      </View>

      <View style={styles.feedbackSection}>
        <Text style={styles.feedbackLabel}>Next Rep</Text>
        <Text style={styles.feedbackText}>{feedback.next_rep}</Text>
      </View>

      {feedback.punch_up_idea && (
        <View style={[styles.feedbackSection, styles.punchUpSection]}>
          <Text style={styles.feedbackLabel}>Punch-Up Idea</Text>
          <Text style={styles.feedbackText}>{feedback.punch_up_idea}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.helpfulButton,
            hasVoted && styles.helpfulButtonActive,
            (isOwn || !currentUserId) && styles.helpfulButtonDisabled,
          ]}
          onPress={handleToggleHelpful}
          disabled={voting || isOwn || !currentUserId}
        >
          <Ionicons
            name={hasVoted ? 'thumbs-up' : 'thumbs-up-outline'}
            size={16}
            color={hasVoted ? colors.helpful : colors.textMuted}
          />
          <Text style={[styles.helpfulText, hasVoted && styles.helpfulTextActive]}>
            Helpful {helpfulCount > 0 && `(${helpfulCount})`}
          </Text>
        </TouchableOpacity>

        {isOwn && onEdit && (
          <TouchableOpacity style={styles.actionButton} onPress={onEdit}>
            <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
        )}

        {canDelete && (
          <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHighlighted: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(107, 142, 111, 0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  overallScore: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  overallScoreValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
  },
  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  ratingItem: {
    width: '48%',
  },
  ratingLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  intentTag: {
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
  },
  tagText: {
    fontSize: 12,
    color: colors.textDark,
  },
  feedbackSection: {
    marginBottom: 10,
  },
  punchUpSection: {
    backgroundColor: 'rgba(232, 185, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  feedbackLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 3,
  },
  feedbackText: {
    fontSize: 14,
    color: colors.textDark,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: 16,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  helpfulButtonActive: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
  },
  helpfulButtonDisabled: {
    opacity: 0.5,
  },
  helpfulText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  helpfulTextActive: {
    color: colors.helpful,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  actionText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
