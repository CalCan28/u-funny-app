import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';

// Design colors from Figma
const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  error: '#d9534f',
  disabled: '#c4bdb0',
};

// Types
type CheckInResult = {
  success: boolean;
  userId: string;
  venueName: string;
  checkedInAt: string;
};

type Performer = {
  id: string;
  name: string;
  hasPerformed: boolean;
  slot: number;
  isCurrentUser: boolean;
};

type Reaction = 'laughed' | 'chuckled' | 'silence' | 'groaned' | 'killed_it';

type CritiqueData = {
  performerId: string;
  reaction: Reaction;
  note: string;
};

// Mock data
const mockPerformers: Performer[] = [
  { id: '1', name: 'Sarah "FireStarter"', hasPerformed: true, slot: 1, isCurrentUser: false },
  { id: '2', name: 'Mike Yunkers', hasPerformed: true, slot: 2, isCurrentUser: false },
  { id: '3', name: 'Calvin "C Gills P"', hasPerformed: true, slot: 3, isCurrentUser: true },
  { id: '4', name: 'Lisa Chen', hasPerformed: false, slot: 4, isCurrentUser: false },
  { id: '5', name: 'James Wilson', hasPerformed: false, slot: 5, isCurrentUser: false },
];

// Mock async functions
const checkInWithQr = async (qrToken: string): Promise<CheckInResult> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Simulate success
  return {
    success: true,
    userId: 'user_123',
    venueName: 'Comedy Club',
    checkedInAt: new Date().toISOString(),
  };
};

const submitCritique = async (critique: CritiqueData): Promise<{ success: boolean }> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return { success: true };
};

// Reaction button component
type ReactionButtonProps = {
  reaction: Reaction;
  label: string;
  emoji: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
};

function ReactionButton({ reaction, label, emoji, selected, disabled, onPress }: ReactionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.reactionButton,
        selected && styles.reactionButtonSelected,
        disabled && styles.reactionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.reactionEmoji}>{emoji}</Text>
      <Text style={[
        styles.reactionLabel,
        selected && styles.reactionLabelSelected,
        disabled && styles.reactionLabelDisabled,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Performer critique card
type PerformerCritiqueCardProps = {
  performer: Performer;
  canCritique: boolean;
  onSubmitCritique: (critique: CritiqueData) => void;
  submittedCritiques: string[];
};

function PerformerCritiqueCard({
  performer,
  canCritique,
  onSubmitCritique,
  submittedCritiques,
}: PerformerCritiqueCardProps) {
  const [selectedReaction, setSelectedReaction] = useState<Reaction | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasSubmitted = submittedCritiques.includes(performer.id);
  const isDisabled = !canCritique || performer.isCurrentUser || !performer.hasPerformed || hasSubmitted;

  const reactions: { reaction: Reaction; label: string; emoji: string }[] = [
    { reaction: 'killed_it', label: 'Killed it!', emoji: '🔥' },
    { reaction: 'laughed', label: 'Laughed', emoji: '😂' },
    { reaction: 'chuckled', label: 'Chuckled', emoji: '😄' },
    { reaction: 'silence', label: 'Silence', emoji: '😐' },
    { reaction: 'groaned', label: 'Groaned', emoji: '😬' },
  ];

  const handleSubmit = async () => {
    if (!selectedReaction) return;

    setIsSubmitting(true);
    await onSubmitCritique({
      performerId: performer.id,
      reaction: selectedReaction,
      note,
    });
    setIsSubmitting(false);
  };

  return (
    <View style={[
      styles.critiqueCard,
      performer.isCurrentUser && styles.currentUserCard,
      hasSubmitted && styles.submittedCard,
    ]}>
      {/* Performer header */}
      <View style={styles.critiqueCardHeader}>
        <View style={styles.slotBadge}>
          <Text style={styles.slotText}>#{performer.slot}</Text>
        </View>
        <View style={styles.performerInfoSection}>
          <Text style={styles.performerNameText}>
            {performer.name}
            {performer.isCurrentUser && ' (You)'}
          </Text>
          <Text style={styles.performerStatus}>
            {performer.hasPerformed ? 'Performed' : 'Waiting to perform'}
          </Text>
        </View>
        {hasSubmitted && (
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>✓ Sent</Text>
          </View>
        )}
      </View>

      {/* Critique section - only show if can critique and not self */}
      {!performer.isCurrentUser && performer.hasPerformed && !hasSubmitted && (
        <>
          {/* Locked overlay when can't critique */}
          {!canCritique && (
            <View style={styles.lockedOverlay}>
              <Text style={styles.lockedIcon}>🔒</Text>
              <Text style={styles.lockedText}>
                Check in & perform to unlock critiques
              </Text>
            </View>
          )}

          {/* Reactions */}
          <View style={[styles.reactionsSection, !canCritique && styles.sectionDisabled]}>
            <Text style={styles.reactionSectionTitle}>How was their set?</Text>
            <View style={styles.reactionsRow}>
              {reactions.map((r) => (
                <ReactionButton
                  key={r.reaction}
                  {...r}
                  selected={selectedReaction === r.reaction}
                  disabled={isDisabled}
                  onPress={() => setSelectedReaction(r.reaction)}
                />
              ))}
            </View>
          </View>

          {/* Note input */}
          <View style={[styles.noteSection, !canCritique && styles.sectionDisabled]}>
            <TextInput
              style={[styles.noteInput, isDisabled && styles.noteInputDisabled]}
              placeholder="Add a constructive note (optional)"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={2}
              editable={!isDisabled}
            />
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedReaction || isDisabled) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReaction || isDisabled || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Send Feedback</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Message for own card */}
      {performer.isCurrentUser && (
        <View style={styles.selfCardMessage}>
          <Text style={styles.selfCardText}>
            You can't critique yourself - but others can send you feedback!
          </Text>
        </View>
      )}

      {/* Message for not yet performed */}
      {!performer.hasPerformed && !performer.isCurrentUser && (
        <View style={styles.notPerformedMessage}>
          <Text style={styles.notPerformedText}>
            Waiting to perform - check back after their set
          </Text>
        </View>
      )}
    </View>
  );
}

export default function CritiqueFeedbackScreen({ navigation, route }: any) {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [hasPerformed, setHasPerformed] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [venueName, setVenueName] = useState(route?.params?.venueName || 'Comedy Club');
  const [submittedCritiques, setSubmittedCritiques] = useState<string[]>([]);

  // Get today's date formatted
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Find current user in performers
  const currentUser = mockPerformers.find(p => p.isCurrentUser);

  // Simulate that user has performed if they're past their slot
  useEffect(() => {
    if (isCheckedIn && currentUser) {
      // For demo, auto-set hasPerformed after check-in
      const timer = setTimeout(() => setHasPerformed(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCheckedIn, currentUser]);

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    setCheckInError(null);

    try {
      // Hardcoded QR token for now - will be replaced with real QR scanning
      const fakeQrToken = 'venue_comedy_club_2024';
      const result = await checkInWithQr(fakeQrToken);

      if (result.success) {
        setIsCheckedIn(true);
        setVenueName(result.venueName);
      }
    } catch (error) {
      setCheckInError('Check-in failed. Please try again.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleSubmitCritique = async (critique: CritiqueData) => {
    const result = await submitCritique(critique);
    if (result.success) {
      setSubmittedCritiques(prev => [...prev, critique.performerId]);
    }
  };

  const canCritique = isCheckedIn && hasPerformed;

  // Filter performers who have performed (excluding self) for critique
  const performersToShow = mockPerformers.filter(p => !p.isCurrentUser);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Critique & Feedback</Text>
      </View>

      {/* Venue & Date Info */}
      <View style={styles.venueInfo}>
        <Text style={styles.venueName}>{venueName}</Text>
        <Text style={styles.dateText}>{today}</Text>
      </View>

      {/* Check-in Status Section */}
      <View style={styles.checkInSection}>
        {!isCheckedIn ? (
          <>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Ready to give feedback?</Text>
              <Text style={styles.instructionsText}>
                Scan the QR code at the door, then tap the button below to check in.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.checkInButton, isCheckingIn && styles.checkInButtonLoading]}
              onPress={handleCheckIn}
              disabled={isCheckingIn}
            >
              {isCheckingIn ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.checkInButtonText}>I scanned the QR code</Text>
              )}
            </TouchableOpacity>

            {checkInError && (
              <Text style={styles.errorText}>{checkInError}</Text>
            )}
          </>
        ) : (
          <View style={styles.checkedInCard}>
            <View style={styles.checkedInHeader}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.checkedInTitle}>You're checked in!</Text>
            </View>
            {!hasPerformed ? (
              <Text style={styles.checkedInSubtext}>
                Waiting for your performance... Critiques will unlock after you perform.
              </Text>
            ) : (
              <Text style={styles.checkedInSubtext}>
                Great set! Now you can give feedback to other performers.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Status badges */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, isCheckedIn ? styles.statusActive : styles.statusInactive]}>
          <Text style={isCheckedIn ? styles.statusTextActive : styles.statusTextInactive}>
            {isCheckedIn ? '✓ Checked In' : '○ Not Checked In'}
          </Text>
        </View>
        <View style={[styles.statusBadge, hasPerformed ? styles.statusActive : styles.statusInactive]}>
          <Text style={hasPerformed ? styles.statusTextActive : styles.statusTextInactive}>
            {hasPerformed ? '✓ Performed' : '○ Not Performed'}
          </Text>
        </View>
      </View>

      {/* Performers List */}
      <View style={styles.performersSection}>
        <Text style={styles.sectionTitle}>
          Tonight's Performers
          {!canCritique && ' (Locked)'}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {performersToShow.map((performer) => (
            <PerformerCritiqueCard
              key={performer.id}
              performer={performer}
              canCritique={canCritique}
              onSubmitCritique={handleSubmitCritique}
              submittedCritiques={submittedCritiques}
            />
          ))}
          <View style={styles.bottomPadding} />
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  venueInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: colors.primary,
  },
  venueName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  checkInSection: {
    padding: 16,
  },
  instructionsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  checkInButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkInButtonLoading: {
    opacity: 0.8,
  },
  checkInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  checkedInCard: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 20,
    color: colors.primary,
    marginRight: 8,
  },
  checkedInTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  checkedInSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    borderColor: colors.primary,
  },
  statusInactive: {
    backgroundColor: colors.cardBg,
    borderColor: colors.cardBorder,
  },
  statusTextActive: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  statusTextInactive: {
    fontSize: 12,
    color: colors.textMuted,
  },
  performersSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 12,
  },
  critiqueCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  currentUserCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  submittedCard: {
    opacity: 0.7,
  },
  critiqueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  slotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  performerInfoSection: {
    flex: 1,
  },
  performerNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  performerStatus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  submittedBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  submittedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  lockedOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  lockedIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  lockedText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  reactionsSection: {
    marginTop: 16,
  },
  sectionDisabled: {
    opacity: 0.4,
  },
  reactionSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  reactionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  reactionButtonSelected: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    borderColor: colors.primary,
  },
  reactionButtonDisabled: {
    opacity: 0.5,
  },
  reactionEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  reactionLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  reactionLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  reactionLabelDisabled: {
    color: colors.disabled,
  },
  noteSection: {
    marginTop: 12,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  noteInputDisabled: {
    opacity: 0.5,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selfCardMessage: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
    borderRadius: 8,
  },
  selfCardText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  notPerformedMessage: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(232, 185, 68, 0.1)',
    borderRadius: 8,
  },
  notPerformedText: {
    fontSize: 13,
    color: colors.accent,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 24,
  },
});
