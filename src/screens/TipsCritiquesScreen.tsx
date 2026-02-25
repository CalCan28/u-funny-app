import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  FeedbackWithClip,
  TipsCritiquesSummary,
  SortMode,
  ToneTag,
  IntentTag,
  TONE_TAGS,
  INTENT_TAGS,
  RATING_CATEGORIES,
  getReceivedFeedback,
  getGivenFeedback,
  getTipsCritiquesSummary,
} from '../components/SetReviewThread';

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  star: '#f4c430',
  tabActive: '#6b8e6f',
  tabInactive: '#9b8b7a',
};

type Tab = 'received' | 'given';

type RouteParams = {
  TipsCritiques: {
    initialTab?: Tab;
  };
};

// Summary Strip Component
function SummaryStrip({ summary }: { summary: TipsCritiquesSummary | null }) {
  if (!summary || summary.totalCount === 0) {
    return null;
  }

  return (
    <View style={styles.summaryStrip}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.totalCount}</Text>
          <Text style={styles.summaryLabel}>Reviews</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.avgOverall.toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>Avg Score</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValueSmall}>💪 {summary.strengthCategory}</Text>
          <Text style={styles.summaryLabel}>Strength</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValueSmall}>🎯 {summary.focusCategory}</Text>
          <Text style={styles.summaryLabel}>Focus</Text>
        </View>
      </View>

      {summary.topNextReps.length > 0 && (
        <View style={styles.topNextReps}>
          <Text style={styles.topNextRepsTitle}>Top Next Reps:</Text>
          {summary.topNextReps.map((rep, i) => (
            <Text key={i} style={styles.topNextRepItem}>
              {i + 1}. {rep.substring(0, 60)}{rep.length > 60 ? '...' : ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// Feedback Card Preview Component
function FeedbackCardPreview({
  feedback,
  tab,
  onPress,
}: {
  feedback: FeedbackWithClip;
  tab: Tab;
  onPress: () => void;
}) {
  const toneInfo = TONE_TAGS.find(t => t.value === feedback.tone_tag);
  const intentInfo = INTENT_TAGS.find(t => t.value === feedback.intent_tag);

  const personName = tab === 'received'
    ? feedback.author?.stage_name || feedback.author?.display_name || 'Anonymous'
    : feedback.clipOwner?.stage_name || feedback.clipOwner?.display_name || 'Unknown';

  const personLabel = tab === 'received' ? 'From' : 'To';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderStars = (rating: number, size: number = 10) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? colors.star : colors.cardBorder}
        />
      ))}
    </View>
  );

  return (
    <TouchableOpacity style={styles.feedbackCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.overallBadge}>
            <Text style={styles.overallBadgeText}>{feedback.overall_score.toFixed(1)}</Text>
            <Ionicons name="star" size={12} color="#fff" />
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.clipTitle} numberOfLines={1}>
              {feedback.clip?.title || 'Unknown Clip'}
            </Text>
            <Text style={styles.personInfo}>
              {personLabel}: {personName} • {formatDate(feedback.created_at)}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>

      {/* Mini ratings grid */}
      <View style={styles.miniRatings}>
        {RATING_CATEGORIES.slice(0, 3).map((cat) => {
          const rating = feedback[`rating_${cat.key}` as keyof FeedbackWithClip] as number;
          return (
            <View key={cat.key} style={styles.miniRatingItem}>
              <Text style={styles.miniRatingLabel}>{cat.label.split(' ')[0]}</Text>
              {renderStars(rating)}
            </View>
          );
        })}
      </View>

      {/* Snippets */}
      <View style={styles.snippets}>
        <Text style={styles.snippetText} numberOfLines={1}>
          <Text style={styles.snippetLabel}>✓ </Text>
          {feedback.what_worked}
        </Text>
        <Text style={styles.snippetText} numberOfLines={1}>
          <Text style={styles.snippetLabel}>→ </Text>
          {feedback.next_rep}
        </Text>
      </View>

      {/* Tags & helpful */}
      <View style={styles.cardFooter}>
        <View style={styles.tagsRow}>
          {toneInfo && (
            <View style={styles.miniTag}>
              <Text style={styles.miniTagText}>{toneInfo.emoji} {toneInfo.label}</Text>
            </View>
          )}
          {intentInfo && (
            <View style={[styles.miniTag, styles.intentTag]}>
              <Text style={styles.miniTagText}>{intentInfo.emoji} {intentInfo.label}</Text>
            </View>
          )}
        </View>
        {feedback.helpful_count > 0 && (
          <View style={styles.helpfulBadge}>
            <Ionicons name="thumbs-up" size={12} color={colors.primary} />
            <Text style={styles.helpfulCount}>{feedback.helpful_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TipsCritiquesScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'TipsCritiques'>>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>(route.params?.initialTab || 'received');
  const [feedback, setFeedback] = useState<FeedbackWithClip[]>([]);
  const [summary, setSummary] = useState<TipsCritiquesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [sortMode, setSortMode] = useState<SortMode>(activeTab === 'received' ? 'helpful' : 'newest');
  const [toneFilter, setToneFilter] = useState<ToneTag | undefined>();
  const [intentFilter, setIntentFilter] = useState<IntentTag | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [searchQuery]);

  const fetchData = useCallback(async (refresh = false) => {
    if (!user) return;

    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [feedbackResult, summaryResult] = await Promise.all([
        activeTab === 'received'
          ? getReceivedFeedback(sortMode, toneFilter, intentFilter, debouncedSearch)
          : getGivenFeedback(sortMode, toneFilter, intentFilter, debouncedSearch),
        getTipsCritiquesSummary(activeTab),
      ]);

      setFeedback(feedbackResult.data);
      setNextCursor(feedbackResult.nextCursor);
      setSummary(summaryResult);
    } catch (error) {
      // Sentry captures this automatically
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeTab, sortMode, toneFilter, intentFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset filters when changing tabs
  useEffect(() => {
    setSortMode(activeTab === 'received' ? 'helpful' : 'newest');
    setToneFilter(undefined);
    setIntentFilter(undefined);
    setSearchQuery('');
    setDebouncedSearch('');
  }, [activeTab]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const result = activeTab === 'received'
        ? await getReceivedFeedback(sortMode, toneFilter, intentFilter, debouncedSearch, nextCursor)
        : await getGivenFeedback(sortMode, toneFilter, intentFilter, debouncedSearch, nextCursor);

      setFeedback(prev => [...prev, ...result.data]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      // Sentry captures this automatically
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFeedbackPress = (item: FeedbackWithClip) => {
    if (!item.clip) return;

    (navigation as any).navigate('ClipDetail', {
      clipId: item.clip.id,
      clipOwnerId: item.clip.user_id,
      title: item.clip.title,
      thumbnailUrl: item.clip.thumbnail_url,
      focusFeedbackId: item.id,
    });
  };

  const renderHeader = () => (
    <View>
      {/* Summary Strip */}
      <SummaryStrip summary={summary} />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'received' ? 'Search by clip or reviewer...' : 'Search by clip or creator...'}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Toggle */}
      <View style={styles.filterRow}>
        <View style={styles.sortButtons}>
          {(['helpful', 'newest', 'highestRated'] as SortMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.sortButton, sortMode === mode && styles.sortButtonActive]}
              onPress={() => setSortMode(mode)}
            >
              <Text style={[styles.sortButtonText, sortMode === mode && styles.sortButtonTextActive]}>
                {mode === 'helpful' ? 'Helpful' : mode === 'newest' ? 'Newest' : 'Top'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="filter" size={16} color={showFilters ? '#fff' : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Expanded Filters */}
      {showFilters && (
        <View style={styles.filtersExpanded}>
          <Text style={styles.filterLabel}>Tone:</Text>
          <View style={styles.filterChips}>
            <TouchableOpacity
              style={[styles.filterChip, !toneFilter && styles.filterChipActive]}
              onPress={() => setToneFilter(undefined)}
            >
              <Text style={[styles.filterChipText, !toneFilter && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {TONE_TAGS.map((tone) => (
              <TouchableOpacity
                key={tone.value}
                style={[styles.filterChip, toneFilter === tone.value && styles.filterChipActive]}
                onPress={() => setToneFilter(toneFilter === tone.value ? undefined : tone.value)}
              >
                <Text style={[styles.filterChipText, toneFilter === tone.value && styles.filterChipTextActive]}>
                  {tone.emoji} {tone.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterLabel}>Intent:</Text>
          <View style={styles.filterChips}>
            <TouchableOpacity
              style={[styles.filterChip, !intentFilter && styles.filterChipActive]}
              onPress={() => setIntentFilter(undefined)}
            >
              <Text style={[styles.filterChipText, !intentFilter && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {INTENT_TAGS.map((intent) => (
              <TouchableOpacity
                key={intent.value}
                style={[styles.filterChip, intentFilter === intent.value && styles.filterChipActive]}
                onPress={() => setIntentFilter(intentFilter === intent.value ? undefined : intent.value)}
              >
                <Text style={[styles.filterChipText, intentFilter === intent.value && styles.filterChipTextActive]}>
                  {intent.emoji} {intent.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name={activeTab === 'received' ? 'chatbubbles-outline' : 'create-outline'}
          size={48}
          color={colors.textMuted}
        />
        <Text style={styles.emptyTitle}>
          {activeTab === 'received' ? 'No Reviews Received Yet' : 'No Reviews Given Yet'}
        </Text>
        <Text style={styles.emptyText}>
          {activeTab === 'received'
            ? 'Upload clips to get feedback from the community'
            : 'Leave reviews on other comedians\' clips to help them improve'}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tips & Critiques</Text>
          <View style={styles.placeholder} />
        </View>
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tips & Critiques</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            Received
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'given' && styles.tabActive]}
          onPress={() => setActiveTab('given')}
        >
          <Text style={[styles.tabText, activeTab === 'given' && styles.tabTextActive]}>
            Given
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        data={feedback}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedbackCardPreview
            feedback={item}
            tab={activeTab}
            onPress={() => handleFeedbackPress(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.cardBg,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.tabInactive,
  },
  tabTextActive: {
    color: colors.tabActive,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Summary Strip
  summaryStrip: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.cardBorder,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  summaryValueSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  topNextReps: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  topNextRepsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 6,
  },
  topNextRepItem: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15,
    color: colors.textDark,
  },
  // Filters
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sortButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  filterToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filtersExpanded: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
    marginTop: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textDark,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  // Feedback Card
  feedbackCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  overallBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  cardMeta: {
    flex: 1,
  },
  clipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  personInfo: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  miniRatings: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  miniRatingItem: {},
  miniRatingLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  snippets: {
    marginBottom: 10,
    gap: 4,
  },
  snippetText: {
    fontSize: 13,
    color: colors.textDark,
  },
  snippetLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  intentTag: {
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
  },
  miniTagText: {
    fontSize: 11,
    color: colors.textDark,
  },
  helpfulBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helpfulCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
