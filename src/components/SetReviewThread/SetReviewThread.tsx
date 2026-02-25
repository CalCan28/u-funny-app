import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Feedback, FeedbackSummary as FeedbackSummaryType, SortMode } from './types';
import {
  getFeedback,
  getFeedbackSummary,
  getMyFeedback,
} from './feedbackService';
import FeedbackCard from './FeedbackCard';
import FeedbackSummary from './FeedbackSummary';
import FeedbackComposer from './FeedbackComposer';

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
};

interface SetReviewThreadProps {
  clipId: string;
  clipOwnerId: string;
  focusFeedbackId?: string;
  ListHeaderComponent?: React.ReactElement;
}

export default function SetReviewThread({
  clipId,
  clipOwnerId,
  focusFeedbackId,
  ListHeaderComponent,
}: SetReviewThreadProps) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [summary, setSummary] = useState<FeedbackSummaryType | null>(null);
  const [myFeedback, setMyFeedback] = useState<Feedback | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('helpful');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      }

      const [feedbackResult, summaryResult, myFeedbackResult] = await Promise.all([
        getFeedback(clipId, sortMode),
        getFeedbackSummary(clipId),
        user ? getMyFeedback(clipId) : Promise.resolve(null),
      ]);

      setFeedback(feedbackResult.data);
      setNextCursor(feedbackResult.nextCursor);
      setSummary(summaryResult);
      setMyFeedback(myFeedbackResult);
    } catch (error) {
      // Sentry captures this automatically
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clipId, sortMode, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle focus feedback
  useEffect(() => {
    if (focusFeedbackId && feedback.length > 0) {
      const index = feedback.findIndex(f => f.id === focusFeedbackId);
      if (index !== -1) {
        setHighlightedId(focusFeedbackId);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: true });
        }, 500);
        setTimeout(() => {
          setHighlightedId(null);
        }, 2500);
      }
    }
  }, [focusFeedbackId, feedback]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const result = await getFeedback(clipId, sortMode, nextCursor);
      setFeedback(prev => [...prev, ...result.data]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      // Sentry captures this automatically
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFeedbackSuccess = (newFeedback: Feedback) => {
    setShowComposer(false);
    setMyFeedback(newFeedback);
    fetchData(true);
  };

  const handleFeedbackDeleted = () => {
    fetchData(true);
  };

  const handleVoteChanged = (
    feedbackId: string,
    newCount: number,
    hasVoted: boolean
  ) => {
    setFeedback(prev =>
      prev.map(f =>
        f.id === feedbackId
          ? { ...f, helpful_count: newCount, has_voted_helpful: hasVoted }
          : f
      )
    );
  };

  const isOwnClip = user?.id === clipOwnerId;

  if (showComposer) {
    return (
      <FeedbackComposer
        clipId={clipId}
        existingFeedback={myFeedback}
        onSuccess={handleFeedbackSuccess}
        onCancel={() => setShowComposer(false)}
      />
    );
  }

  const renderHeader = () => (
    <View>
      {/* External header component (e.g., video player) */}
      {ListHeaderComponent}

      {/* Summary */}
      {summary && <FeedbackSummary summary={summary} />}

      {/* Sort & Add Review */}
      <View style={styles.controlsRow}>
        <View style={styles.sortButtons}>
          {(['helpful', 'newest', 'highestRated'] as SortMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.sortButton,
                sortMode === mode && styles.sortButtonActive,
              ]}
              onPress={() => setSortMode(mode)}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  sortMode === mode && styles.sortButtonTextActive,
                ]}
              >
                {mode === 'helpful'
                  ? 'Helpful'
                  : mode === 'newest'
                  ? 'Newest'
                  : 'Top Rated'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {user && !isOwnClip && (
          <TouchableOpacity
            style={styles.addReviewButton}
            onPress={() => setShowComposer(true)}
          >
            <Ionicons
              name={myFeedback ? 'create-outline' : 'add-circle-outline'}
              size={20}
              color="#fff"
            />
            <Text style={styles.addReviewText}>
              {myFeedback ? 'Edit' : 'Review'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Own clip notice */}
      {isOwnClip && (
        <View style={styles.ownerNotice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.ownerNoticeText}>
            This is your clip. You can view and manage feedback here.
          </Text>
        </View>
      )}

      {/* Not logged in notice */}
      {!user && (
        <View style={styles.loginNotice}>
          <Text style={styles.loginNoticeText}>
            Sign in to leave a review
          </Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyList}>
        <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={feedback}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedbackCard
            feedback={item}
            currentUserId={user?.id}
            clipOwnerId={clipOwnerId}
            isHighlighted={item.id === highlightedId}
            onEdit={() => setShowComposer(true)}
            onDeleted={handleFeedbackDeleted}
            onVoteChanged={handleVoteChanged}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
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
    </View>
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
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sortButtons: {
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
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.primary,
    gap: 6,
  },
  addReviewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  ownerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  ownerNoticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
  },
  loginNotice: {
    backgroundColor: colors.cardBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  loginNoticeText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyList: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
