import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import CritiqueCard, { FeedbackData } from '../components/CritiqueCard';

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

type TabType = 'received' | 'given';

export default function TipsAndCritiquesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('received');
  const [receivedFeedback, setReceivedFeedback] = useState<FeedbackData[]>([]);
  const [givenFeedback, setGivenFeedback] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<FeedbackData | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFeedback = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch received feedback
      const { data: received, error: receivedError } = await supabase
        .from('feedback_with_profiles')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (receivedError) throw receivedError;

      // Fetch given feedback
      const { data: given, error: givenError } = await supabase
        .from('feedback_with_profiles')
        .select('*')
        .eq('giver_id', user.id)
        .order('created_at', { ascending: false });

      if (givenError) throw givenError;

      setReceivedFeedback(received || []);
      setGivenFeedback(given || []);

      // Calculate average rating from received feedback
      if (received && received.length > 0) {
        const sum = received.reduce((acc, f) => acc + f.rating, 0);
        setAverageRating(sum / received.length);
      } else {
        setAverageRating(null);
      }
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
      Alert.alert('Error', 'Failed to load feedback');
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchFeedback();
      setLoading(false);
    };
    loadData();
  }, [fetchFeedback]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeedback();
    setRefreshing(false);
  }, [fetchFeedback]);

  const handleEdit = (feedback: FeedbackData) => {
    setEditingFeedback(feedback);
    setEditRating(feedback.rating);
    setEditText(feedback.feedback_text || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingFeedback) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('feedback')
        .update({
          rating: editRating,
          feedback_text: editText.trim() || null,
        })
        .eq('id', editingFeedback.id);

      if (error) throw error;

      setEditModalVisible(false);
      setEditingFeedback(null);
      await fetchFeedback();
      Alert.alert('Success', 'Feedback updated');
    } catch (error: any) {
      console.error('Error updating feedback:', error);
      Alert.alert('Error', error.message || 'Failed to update feedback');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (feedbackId: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackId);

      if (error) throw error;

      await fetchFeedback();
      Alert.alert('Success', 'Feedback deleted');
    } catch (error: any) {
      console.error('Error deleting feedback:', error);
      Alert.alert('Error', error.message || 'Failed to delete feedback');
    }
  };

  const renderStars = (rating: number, onPress?: (rating: number) => void) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => onPress?.(i)}
          disabled={!onPress}
          style={styles.starButton}
        >
          <Ionicons
            name={i <= rating ? 'star' : 'star-outline'}
            size={onPress ? 32 : 20}
            color={i <= rating ? colors.starFilled : colors.starEmpty}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const currentData = activeTab === 'received' ? receivedFeedback : givenFeedback;

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={activeTab === 'received' ? 'chatbubble-ellipses-outline' : 'create-outline'}
        size={64}
        color={colors.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'received' ? 'No Feedback Yet' : 'No Critiques Given'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'received'
          ? "When other comedians give you feedback, it'll show up here."
          : "Feedback you give to other comedians will appear here."}
      </Text>
    </View>
  );

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
        <Text style={styles.headerTitle}>Tips & Critiques</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Average Rating Card (only on Received tab) */}
      {activeTab === 'received' && averageRating !== null && (
        <View style={styles.ratingCard}>
          <Text style={styles.ratingLabel}>Your Average Rating</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingNumber}>{averageRating.toFixed(1)}</Text>
            <View style={styles.ratingStars}>{renderStars(Math.round(averageRating))}</View>
          </View>
          <Text style={styles.ratingCount}>
            Based on {receivedFeedback.length} critique{receivedFeedback.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            Received ({receivedFeedback.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'given' && styles.tabActive]}
          onPress={() => setActiveTab('given')}
        >
          <Text style={[styles.tabText, activeTab === 'given' && styles.tabTextActive]}>
            Given ({givenFeedback.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feedback List */}
      <FlatList
        data={currentData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CritiqueCard
            feedback={item}
            type={activeTab}
            currentUserId={user?.id || ''}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <SafeAreaView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Feedback</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.modalSave}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>Rating</Text>
              <View style={styles.modalStars}>
                {renderStars(editRating, setEditRating)}
              </View>

              <Text style={styles.modalLabel}>Feedback (optional)</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Share your thoughts on their performance..."
                placeholderTextColor={colors.textMuted}
                value={editText}
                onChangeText={setEditText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
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
  ratingCard: {
    backgroundColor: colors.cardBg,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingCount: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  starButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBg,
  },
  modalCancel: {
    fontSize: 16,
    color: colors.textMuted,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textDark,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  modalStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  modalTextInput: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textDark,
    minHeight: 140,
  },
});
