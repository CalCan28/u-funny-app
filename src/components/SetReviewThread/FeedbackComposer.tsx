import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FeedbackFormData,
  ToneTag,
  IntentTag,
  RATING_CATEGORIES,
  TONE_TAGS,
  INTENT_TAGS,
  RATING_DESCRIPTIONS,
  Feedback,
} from './types';
import { upsertFeedback, validateFeedback } from './feedbackService';

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
  error: '#d9534f',
};

interface FeedbackComposerProps {
  clipId: string;
  existingFeedback?: Feedback | null;
  onSuccess: (feedback: Feedback) => void;
  onCancel?: () => void;
}

export default function FeedbackComposer({
  clipId,
  existingFeedback,
  onSuccess,
  onCancel,
}: FeedbackComposerProps) {
  const [formData, setFormData] = useState<FeedbackFormData>({
    what_worked: '',
    what_to_improve: '',
    next_rep: '',
    punch_up_idea: '',
    tone_tag: 'SUPPORTIVE',
    intent_tag: 'FUNNIER',
    rating_joke_craft: 0,
    rating_timing_pacing: 0,
    rating_stage_presence: 0,
    rating_originality: 0,
    rating_crowd_connection: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingFeedback) {
      setFormData({
        what_worked: existingFeedback.what_worked,
        what_to_improve: existingFeedback.what_to_improve,
        next_rep: existingFeedback.next_rep,
        punch_up_idea: existingFeedback.punch_up_idea || '',
        tone_tag: existingFeedback.tone_tag,
        intent_tag: existingFeedback.intent_tag,
        rating_joke_craft: existingFeedback.rating_joke_craft,
        rating_timing_pacing: existingFeedback.rating_timing_pacing,
        rating_stage_presence: existingFeedback.rating_stage_presence,
        rating_originality: existingFeedback.rating_originality,
        rating_crowd_connection: existingFeedback.rating_crowd_connection,
      });
    }
  }, [existingFeedback]);

  const updateField = <K extends keyof FeedbackFormData>(
    field: K,
    value: FeedbackFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    const validationError = validateFeedback(formData);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await upsertFeedback(clipId, formData);
      onSuccess(result);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarPicker = (
    category: typeof RATING_CATEGORIES[number],
    value: number
  ) => {
    const fieldKey = `rating_${category.key}` as keyof FeedbackFormData;

    return (
      <View style={styles.ratingRow} key={category.key}>
        <Text style={styles.ratingLabel}>{category.label}</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => updateField(fieldKey, star as any)}
              style={styles.starButton}
            >
              <Ionicons
                name={star <= value ? 'star' : 'star-outline'}
                size={28}
                color={star <= value ? colors.star : colors.starEmpty}
              />
            </TouchableOpacity>
          ))}
        </View>
        {value > 0 && (
          <Text style={styles.ratingDescription}>
            {RATING_DESCRIPTIONS[value]}
          </Text>
        )}
      </View>
    );
  };

  const renderTagSelector = <T extends string>(
    title: string,
    options: { value: T; label: string; emoji: string }[],
    currentValue: T,
    onChange: (value: T) => void
  ) => (
    <View style={styles.tagSection}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.tagsGrid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.tagOption,
              currentValue === option.value && styles.tagOptionActive,
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text style={styles.tagEmoji}>{option.emoji}</Text>
            <Text
              style={[
                styles.tagLabel,
                currentValue === option.value && styles.tagLabelActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const isEditing = !!existingFeedback;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEditing ? 'Edit Your Review' : 'Leave a Set Review'}
          </Text>
          <Text style={styles.subtitle}>
            Help this comedian level up with structured coaching feedback
          </Text>
        </View>

        {/* Ratings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate This Set</Text>
          {RATING_CATEGORIES.map((cat) =>
            renderStarPicker(
              cat,
              formData[`rating_${cat.key}` as keyof FeedbackFormData] as number
            )
          )}
        </View>

        {/* Tone & Intent Tags */}
        <View style={styles.section}>
          {renderTagSelector(
            'Your Coaching Tone',
            TONE_TAGS,
            formData.tone_tag,
            (value) => updateField('tone_tag', value)
          )}
          {renderTagSelector(
            'Your Goal for Them',
            INTENT_TAGS,
            formData.intent_tag,
            (value) => updateField('intent_tag', value)
          )}
        </View>

        {/* Text Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Feedback</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>What Worked *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="What landed well? Strong moments..."
              placeholderTextColor={colors.textMuted}
              value={formData.what_worked}
              onChangeText={(text) => updateField('what_worked', text)}
              multiline
              maxLength={250}
            />
            <Text style={styles.charCount}>
              {formData.what_worked.length}/250
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>What To Improve *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Areas to work on, things that fell flat..."
              placeholderTextColor={colors.textMuted}
              value={formData.what_to_improve}
              onChangeText={(text) => updateField('what_to_improve', text)}
              multiline
              maxLength={250}
            />
            <Text style={styles.charCount}>
              {formData.what_to_improve.length}/250
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Next Rep *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Specific thing to try next time..."
              placeholderTextColor={colors.textMuted}
              value={formData.next_rep}
              onChangeText={(text) => updateField('next_rep', text)}
              multiline
              maxLength={250}
            />
            <Text style={styles.charCount}>
              {formData.next_rep.length}/250
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Punch-Up Idea (optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Got a joke rewrite or tag suggestion?"
              placeholderTextColor={colors.textMuted}
              value={formData.punch_up_idea}
              onChangeText={(text) => updateField('punch_up_idea', text)}
              multiline
              maxLength={250}
            />
            <Text style={styles.charCount}>
              {formData.punch_up_idea.length}/250
            </Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>
                  {isEditing ? 'Update Review' : 'Submit Review'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  section: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 10,
  },
  ratingRow: {
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingDescription: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  tagSection: {
    marginBottom: 16,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  tagOptionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
  },
  tagEmoji: {
    fontSize: 16,
  },
  tagLabel: {
    fontSize: 14,
    color: colors.textDark,
  },
  tagLabelActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.textDark,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  charCount: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 83, 79, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.error,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
});
