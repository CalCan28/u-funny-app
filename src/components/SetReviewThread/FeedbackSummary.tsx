import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedbackSummary as FeedbackSummaryType, RATING_CATEGORIES } from './types';

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

interface FeedbackSummaryProps {
  summary: FeedbackSummaryType;
}

export default function FeedbackSummary({ summary }: FeedbackSummaryProps) {
  if (summary.total_reviews === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Reviews Yet</Text>
        <Text style={styles.emptyText}>
          Be the first to leave feedback on this set!
        </Text>
      </View>
    );
  }

  const renderBar = (value: number, label: string) => {
    const percentage = (value / 5) * 100;
    return (
      <View style={styles.barRow} key={label}>
        <Text style={styles.barLabel}>{label}</Text>
        <View style={styles.barContainer}>
          <View style={[styles.barFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.barValue}>{value.toFixed(1)}</Text>
      </View>
    );
  };

  const categoryAverages = [
    { key: 'joke_craft', value: summary.avg_joke_craft },
    { key: 'timing_pacing', value: summary.avg_timing_pacing },
    { key: 'stage_presence', value: summary.avg_stage_presence },
    { key: 'originality', value: summary.avg_originality },
    { key: 'crowd_connection', value: summary.avg_crowd_connection },
  ];

  return (
    <View style={styles.container}>
      {/* Overall Score */}
      <View style={styles.overallSection}>
        <View style={styles.overallScoreCircle}>
          <Text style={styles.overallScoreValue}>
            {summary.avg_overall.toFixed(1)}
          </Text>
          <View style={styles.overallStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= Math.round(summary.avg_overall) ? 'star' : 'star-outline'}
                size={12}
                color={colors.star}
              />
            ))}
          </View>
        </View>
        <View style={styles.overallInfo}>
          <Text style={styles.reviewCount}>
            {summary.total_reviews} {summary.total_reviews === 1 ? 'Review' : 'Reviews'}
          </Text>
          <Text style={styles.overallLabel}>Overall Rating</Text>
        </View>
      </View>

      {/* Category Breakdown */}
      <View style={styles.breakdownSection}>
        {categoryAverages.map((cat) => {
          const category = RATING_CATEGORIES.find(c => c.key === cat.key);
          return renderBar(cat.value, category?.label || cat.key);
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyContainer: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  overallSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  overallScoreCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  overallScoreValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
  },
  overallStars: {
    flexDirection: 'row',
    marginTop: 2,
  },
  overallInfo: {
    marginLeft: 16,
    flex: 1,
  },
  reviewCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  overallLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  breakdownSection: {
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    width: 110,
    fontSize: 12,
    color: colors.textMuted,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  barValue: {
    width: 28,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
    textAlign: 'right',
  },
});
