import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Feedback, TONE_TAGS, INTENT_TAGS } from './types';
import { getUserFeedbackStats } from './feedbackService';

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  star: '#f4c430',
};

interface TipsAndCritiquesProps {
  userId: string;
  onViewAll?: () => void;
}

export default function TipsAndCritiques({ userId, onViewAll }: TipsAndCritiquesProps) {
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const result = await getUserFeedbackStats(userId);
        setFeedback(result.recentFeedback);
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (feedback.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bulb-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Tips Yet</Text>
        <Text style={styles.emptyText}>
          Feedback from the community will appear here
        </Text>
      </View>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderFeedbackCard = (item: Feedback) => {
    const isExpanded = expanded === item.id;
    const authorName =
      item.author?.stage_name ||
      item.author?.display_name ||
      'Anonymous';
    const toneInfo = TONE_TAGS.find(t => t.value === item.tone_tag);
    const intentInfo = INTENT_TAGS.find(t => t.value === item.intent_tag);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.feedbackCard}
        onPress={() => setExpanded(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreText}>{item.overall_score.toFixed(1)}</Text>
            </View>
            <View>
              <Text style={styles.authorName}>{authorName}</Text>
              <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
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

        {/* Preview or Full Content */}
        {!isExpanded ? (
          <Text style={styles.previewText} numberOfLines={2}>
            {item.what_to_improve}
          </Text>
        ) : (
          <View style={styles.expandedContent}>
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionLabel}>What Worked</Text>
              <Text style={styles.sectionText}>{item.what_worked}</Text>
            </View>
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionLabel}>What To Improve</Text>
              <Text style={styles.sectionText}>{item.what_to_improve}</Text>
            </View>
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionLabel}>Next Rep</Text>
              <Text style={styles.sectionText}>{item.next_rep}</Text>
            </View>
            {item.punch_up_idea && (
              <View style={[styles.feedbackSection, styles.punchUpSection]}>
                <Text style={styles.sectionLabel}>Punch-Up Idea</Text>
                <Text style={styles.sectionText}>{item.punch_up_idea}</Text>
              </View>
            )}
          </View>
        )}

        {item.helpful_count > 0 && (
          <View style={styles.helpfulBadge}>
            <Ionicons name="thumbs-up" size={12} color={colors.primary} />
            <Text style={styles.helpfulText}>{item.helpful_count} found helpful</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tips & Critiques</Text>
        <Text style={styles.count}>{feedback.length}</Text>
      </View>

      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator={false}
        style={styles.feedbackList}
      >
        {feedback.slice(0, 5).map(renderFeedbackCard)}
      </ScrollView>

      {feedback.length > 5 && onViewAll && (
        <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
          <Text style={styles.viewAllText}>View All {feedback.length} Reviews</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  loadingContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  feedbackList: {
    maxHeight: 400,
  },
  feedbackCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  intentTag: {
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
  },
  tagText: {
    fontSize: 11,
    color: colors.textDark,
  },
  previewText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  expandedContent: {
    gap: 10,
  },
  feedbackSection: {},
  punchUpSection: {
    backgroundColor: 'rgba(232, 185, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  sectionText: {
    fontSize: 14,
    color: colors.textDark,
    lineHeight: 20,
  },
  helpfulBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  helpfulText: {
    fontSize: 12,
    color: colors.primary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 6,
    gap: 6,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
