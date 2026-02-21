import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Recordings directory
const RECORDINGS_DIR = FileSystem.documentDirectory + 'recordings/';

// API for AI Comedy Coach - Update to your backend URL
const API_BASE_URL = 'https://u-funny-app-production.up.railway.app';

// Type for saved recordings
type SavedRecording = {
  id: string;
  uri: string;
  thumbnailUri?: string;
  duration: number;
  setDuration: number;
  createdAt: string;
  title: string;
  tags?: string[];
};

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
  premium: '#6b8e6f',      // Changed to green
  premiumBg: 'rgba(107, 142, 111, 0.1)',  // Green with transparency
};

// Types
type Tag = {
  id: string;
  name: string;
  color: string;
  isCustom: boolean;
};

type Bit = {
  id: string;
  title: string;
  content: string;
  tags: string[]; // Array of tag IDs
  createdAt: string;
  updatedAt: string;
};

type Routine = {
  id: string;
  name: string;
  bitIds: string[];
  createdAt: string;
};

type AIResponse = {
  suggestion: string;
  type: 'improvement' | 'punchline' | 'alternative' | 'generated';
};

// Tag colors for custom tags
const TAG_COLORS = [
  '#6b8e6f', // Green (primary)
  '#e8b944', // Gold (accent)
  '#5c9ead', // Teal
  '#e07a5f', // Coral
  '#9b59b6', // Purple
  '#3498db', // Blue
  '#e74c3c', // Red
  '#1abc9c', // Turquoise
  '#f39c12', // Orange
  '#8e44ad', // Deep Purple
];

// Default tags
const DEFAULT_TAGS: Tag[] = [
  { id: 'family', name: 'Family', color: '#6b8e6f', isCustom: false },
  { id: 'job', name: 'Job', color: '#5c9ead', isCustom: false },
  { id: 'relationships', name: 'Relationships', color: '#e07a5f', isCustom: false },
  { id: 'observations', name: 'Observations', color: '#e8b944', isCustom: false },
  { id: 'politics', name: 'Politics', color: '#3498db', isCustom: false },
  { id: 'self-deprecating', name: 'Self-Deprecating', color: '#9b59b6', isCustom: false },
  { id: 'storytelling', name: 'Storytelling', color: '#1abc9c', isCustom: false },
  { id: 'one-liners', name: 'One-Liners', color: '#f39c12', isCustom: false },
];

const WORDS_PER_MINUTE = 150;

// Utility functions
const calculateTime = (content: string): string => {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.floor(wordCount / WORDS_PER_MINUTE);
  const seconds = Math.round((wordCount % WORDS_PER_MINUTE) / WORDS_PER_MINUTE * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const calculateTotalTime = (bits: Bit[]): string => {
  const totalWords = bits.reduce((sum, bit) => {
    return sum + bit.content.trim().split(/\s+/).filter(Boolean).length;
  }, 0);
  const minutes = Math.floor(totalWords / WORDS_PER_MINUTE);
  const seconds = Math.round((totalWords % WORDS_PER_MINUTE) / WORDS_PER_MINUTE * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const generateId = (): string => Math.random().toString(36).substr(2, 9);

// Sample data
const sampleBits: Bit[] = [
  {
    id: '1',
    title: 'Airplane Mode',
    content: "Why do they call it airplane mode? My phone doesn't fly any better. I tried throwing it and it still hit the ground. Maybe I'm doing it wrong. The flight attendant was not amused when I asked if I could put my phone on helicopter mode instead.",
    tags: ['observations', 'one-liners'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Pet Peeves',
    content: "You know what really grinds my gears? People who say 'it is what it is.' Yeah, I know it is what it is. That's how things work. My coffee is what it is. My rent is what it is. Specifically, too expensive.",
    tags: ['observations'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Family Dinner',
    content: "My family has this tradition where we all get together for dinner and argue about who's the biggest disappointment. It's me. It's always me. But at least I'm winning at something.",
    tags: ['family', 'self-deprecating'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============================================
// AI API FUNCTIONS - Connect to Comedy Coach Backend
// ============================================

type CoachMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const sendChatMessage = async (
  messages: CoachMessage[],
  userMessage: string
): Promise<string> => {
  const historyForApi = messages
    .filter((m) => m.id !== '0')
    .map((m) => ({ role: m.role, content: m.content }));

  console.log('BitManager: Sending to:', `${API_BASE_URL}/chat`);
  console.log('BitManager: Message:', userMessage.slice(0, 50) + '...');

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: historyForApi,
        user_message: userMessage,
      }),
    });

    console.log('BitManager: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('BitManager: API Error:', errorText);
      throw new Error('Failed to get response from AI coach');
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('BitManager: Fetch error:', error);
    throw error;
  }
};

const analyzeBit = async (
  bitText: string,
  context: string = ''
): Promise<{ analysis: string; bit: string }> => {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bit_text: bitText,
      context: context,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to analyze bit');
  }

  return response.json();
};

const aiSuggestImprovement = async (bit: Bit): Promise<AIResponse> => {
  const prompt = `Please review this bit and suggest improvements:\n\nTitle: ${bit.title}\n\n${bit.content}`;
  const response = await sendChatMessage([], prompt);
  return {
    suggestion: response,
    type: 'improvement',
  };
};

const aiPunchUpPunchline = async (bit: Bit): Promise<AIResponse> => {
  const prompt = `Please punch up the punchlines in this bit. Suggest stronger, funnier endings:\n\nTitle: ${bit.title}\n\n${bit.content}`;
  const response = await sendChatMessage([], prompt);
  return {
    suggestion: response,
    type: 'punchline',
  };
};

const aiAlternativeWording = async (bit: Bit): Promise<AIResponse> => {
  const prompt = `Please suggest alternative wording and phrasing for this bit:\n\nTitle: ${bit.title}\n\n${bit.content}`;
  const response = await sendChatMessage([], prompt);
  return {
    suggestion: response,
    type: 'alternative',
  };
};

const aiGenerateMaterial = async (topic: string): Promise<AIResponse> => {
  const prompt = `Generate some comedy material on the topic: ${topic}. Give me a few joke ideas or a short bit I can work with.`;
  const response = await sendChatMessage([], prompt);
  return {
    suggestion: response,
    type: 'generated',
  };
};

const aiSuggestBitOrder = async (bits: Bit[]): Promise<string[]> => {
  const bitSummary = bits.map((b, i) => `${i + 1}. "${b.title}" - ${b.content.slice(0, 50)}...`).join('\n');
  const prompt = `I have these bits for my set. Suggest the best order to perform them for maximum impact:\n\n${bitSummary}\n\nRespond with just the numbers in your suggested order, separated by commas.`;
  const response = await sendChatMessage([], prompt);

  // Parse the response to extract order
  const numbers = response.match(/\d+/g);
  if (numbers) {
    return numbers.map(n => bits[parseInt(n) - 1]?.id).filter(Boolean);
  }
  return bits.map(b => b.id);
};

const aiBuildSetForTime = async (bits: Bit[], targetMinutes: number): Promise<string[]> => {
  const bitSummary = bits.map((b, i) => {
    const time = calculateTime(b.content);
    return `${i + 1}. "${b.title}" (~${time}) - ${b.content.slice(0, 50)}...`;
  }).join('\n');

  const prompt = `Help me build a ${targetMinutes} minute set from these bits:\n\n${bitSummary}\n\nWhich bits should I include and in what order? Respond with just the numbers separated by commas.`;
  const response = await sendChatMessage([], prompt);

  // Parse the response to extract selections
  const numbers = response.match(/\d+/g);
  if (numbers) {
    return numbers.map(n => bits[parseInt(n) - 1]?.id).filter(Boolean);
  }

  // Fallback: simple time-based selection
  let totalWords = 0;
  const targetWords = targetMinutes * WORDS_PER_MINUTE;
  const selectedIds: string[] = [];

  for (const bit of bits) {
    const wordCount = bit.content.split(/\s+/).length;
    if (totalWords + wordCount <= targetWords) {
      selectedIds.push(bit.id);
      totalWords += wordCount;
    }
  }
  return selectedIds;
};

// ============================================
// COMPONENTS
// ============================================

// Create Tag Modal
type CreateTagModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreateTag: (name: string, color: string) => void;
  existingTags: Tag[];
};

function CreateTagModal({ visible, onClose, onCreateTag, existingTags }: CreateTagModalProps) {
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [error, setError] = useState('');

  const handleCreate = () => {
    const trimmedName = tagName.trim();
    if (!trimmedName) {
      setError('Please enter a tag name');
      return;
    }
    if (trimmedName.length > 20) {
      setError('Tag name must be 20 characters or less');
      return;
    }
    if (existingTags.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('A tag with this name already exists');
      return;
    }

    onCreateTag(trimmedName, selectedColor);
    setTagName('');
    setSelectedColor(TAG_COLORS[0]);
    setError('');
    onClose();
  };

  const handleClose = () => {
    setTagName('');
    setSelectedColor(TAG_COLORS[0]);
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.tagModalOverlay}>
        <View style={styles.tagModalContent}>
          <Text style={styles.tagModalTitle}>Create New Tag</Text>

          <Text style={styles.inputLabel}>Tag Name</Text>
          <TextInput
            style={styles.tagNameInput}
            placeholder="e.g., Dating, Travel, Food..."
            placeholderTextColor={colors.textMuted}
            value={tagName}
            onChangeText={(text) => {
              setTagName(text);
              setError('');
            }}
            maxLength={20}
            autoFocus
          />
          <Text style={styles.charCount}>{tagName.length}/20</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.inputLabel}>Choose Color</Text>
          <View style={styles.colorGrid}>
            {TAG_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorOptionSelected,
                ]}
                onPress={() => setSelectedColor(color)}
              >
                {selectedColor === color && <Text style={styles.colorCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          {tagName.trim() && (
            <View style={styles.tagPreviewSection}>
              <Text style={styles.previewLabel}>Preview:</Text>
              <View style={[styles.tagPreview, { backgroundColor: selectedColor + '25', borderColor: selectedColor }]}>
                <Text style={[styles.tagPreviewText, { color: selectedColor }]}>{tagName.trim()}</Text>
              </View>
            </View>
          )}

          <View style={styles.tagModalActions}>
            <TouchableOpacity style={styles.tagModalCancel} onPress={handleClose}>
              <Text style={styles.tagModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tagModalCreate} onPress={handleCreate}>
              <Text style={styles.tagModalCreateText}>Create Tag</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Tag Picker (replaces Category Picker)
type TagPickerProps = {
  allTags: Tag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string, color: string) => void;
};

function TagPicker({ allTags, selectedTagIds, onToggleTag, onCreateTag }: TagPickerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <View style={styles.tagPickerContainer}>
      <View style={styles.tagPickerHeader}>
        <Text style={styles.inputLabel}>Tags (select multiple)</Text>
        <TouchableOpacity
          style={styles.addTagButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.addTagButtonText}>+ New Tag</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tagRow}>
          {allTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: isSelected ? tag.color + '25' : colors.background,
                    borderColor: isSelected ? tag.color : colors.cardBorder,
                  },
                ]}
                onPress={() => onToggleTag(tag.id)}
              >
                {isSelected && <Text style={[styles.tagCheckmark, { color: tag.color }]}>✓</Text>}
                <Text
                  style={[
                    styles.tagChipText,
                    { color: isSelected ? tag.color : colors.textMuted },
                    isSelected && styles.tagChipTextSelected,
                  ]}
                >
                  {tag.name}
                </Text>
                {tag.isCustom && (
                  <View style={[styles.customBadge, { backgroundColor: tag.color }]}>
                    <Text style={styles.customBadgeText}>★</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {selectedTagIds.length > 0 && (
        <Text style={styles.selectedTagsCount}>
          {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''} selected
        </Text>
      )}

      <CreateTagModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateTag={onCreateTag}
        existingTags={allTags}
      />
    </View>
  );
}

// Tag Display (for bit cards)
type TagDisplayProps = {
  tagIds: string[];
  allTags: Tag[];
  compact?: boolean;
};

function TagDisplay({ tagIds, allTags, compact }: TagDisplayProps) {
  const tags = tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean) as Tag[];

  if (tags.length === 0) return null;

  if (compact && tags.length > 2) {
    const visibleTags = tags.slice(0, 2);
    const moreCount = tags.length - 2;
    return (
      <View style={styles.tagDisplayRow}>
        {visibleTags.map((tag) => (
          <View
            key={tag.id}
            style={[styles.tagDisplayChip, { backgroundColor: tag.color + '20', borderColor: tag.color }]}
          >
            <Text style={[styles.tagDisplayText, { color: tag.color }]}>{tag.name}</Text>
          </View>
        ))}
        <View style={styles.moreTagsBadge}>
          <Text style={styles.moreTagsText}>+{moreCount}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.tagDisplayRow}>
      {tags.map((tag) => (
        <View
          key={tag.id}
          style={[styles.tagDisplayChip, { backgroundColor: tag.color + '20', borderColor: tag.color }]}
        >
          <Text style={[styles.tagDisplayText, { color: tag.color }]}>{tag.name}</Text>
        </View>
      ))}
    </View>
  );
}

// Bit Card
type BitCardProps = {
  bit: Bit;
  allTags: Tag[];
  onEdit: () => void;
  onDelete: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  selectable?: boolean;
};

function BitCard({ bit, allTags, onEdit, onDelete, isSelected, onSelect, selectable }: BitCardProps) {
  const estimatedTime = calculateTime(bit.content);
  const preview = bit.content.length > 80 ? bit.content.substring(0, 80) + '...' : bit.content;

  return (
    <TouchableOpacity
      style={[
        styles.bitCard,
        isSelected && styles.bitCardSelected,
      ]}
      onPress={selectable ? onSelect : undefined}
      activeOpacity={selectable ? 0.7 : 1}
    >
      <View style={styles.bitCardHeader}>
        <View style={styles.bitCardTitleRow}>
          {selectable && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          )}
          <Text style={styles.bitTitle}>{bit.title}</Text>
        </View>
        <View style={styles.bitMetaRow}>
          <TagDisplay tagIds={bit.tags} allTags={allTags} compact />
          <Text style={styles.bitTime}>{estimatedTime}</Text>
        </View>
      </View>
      <Text style={styles.bitPreview}>{preview}</Text>
      {!selectable && (
        <View style={styles.bitActions}>
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// Premium Badge
function PremiumBadge() {
  return (
    <View style={styles.premiumBadge}>
      <Text style={styles.premiumBadgeText}>PREMIUM</Text>
    </View>
  );
}

// Locked Feature Overlay
type LockedFeatureProps = {
  title: string;
  description: string;
  onUpgrade: () => void;
};

function LockedFeature({ title, description, onUpgrade }: LockedFeatureProps) {
  return (
    <View style={styles.lockedFeature}>
      <Text style={styles.lockedIcon}>🔒</Text>
      <Text style={styles.lockedTitle}>{title}</Text>
      <Text style={styles.lockedDescription}>{description}</Text>
      <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
        <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
      </TouchableOpacity>
    </View>
  );
}

// AI Comedy Coach Modal - Full chat interface with bit selection
type AICoachModalProps = {
  visible: boolean;
  onClose: () => void;
  bits: Bit[];
  selectedBit: Bit | null;
  isPremium: boolean;
  onNavigateToPremium?: () => void;
};

function AIAssistantModal({ visible, onClose, bits, selectedBit, isPremium, onNavigateToPremium }: AICoachModalProps) {
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hey! I'm here to help you work on your material. You can select one of your saved bits, paste in some text, or just chat with me about your comedy. What would you like to work on?",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'select-bit' | 'type-bit'>('chat');
  const [customBitText, setCustomBitText] = useState('');
  const [workingBit, setWorkingBit] = useState<Bit | null>(selectedBit);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (selectedBit) {
      setWorkingBit(selectedBit);
      // Send initial message about the selected bit (handleSendMessage adds the user message)
      handleSendMessage(`I want to work on my bit called "${selectedBit.title}":\n\n${selectedBit.content}`);
    }
  }, [selectedBit]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setMessages([
        {
          id: '0',
          role: 'assistant',
          content: "Hey! I'm here to help you work on your material. You can select one of your saved bits, paste in some text, or just chat with me about your comedy. What would you like to work on?",
        },
      ]);
      setInputText('');
      setMode('chat');
      setCustomBitText('');
      setWorkingBit(null);
    }
  }, [visible]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: CoachMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(messages, text.trim());

      const assistantMessage: CoachMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: CoachMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to my brain right now. Make sure the backend server is running. In the meantime, keep writing!",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBit = (bit: Bit) => {
    setWorkingBit(bit);
    setMode('chat');
    const message = `I want to work on my bit called "${bit.title}":\n\n${bit.content}`;
    handleSendMessage(message);
  };

  const handleSubmitCustomBit = () => {
    if (!customBitText.trim()) return;
    setMode('chat');
    const message = `Here's a bit I'm working on:\n\n${customBitText.trim()}`;
    handleSendMessage(message);
    setCustomBitText('');
  };

  const handleAnalyzeBit = async () => {
    if (!workingBit && !customBitText.trim()) {
      Alert.alert('No bit selected', 'Please select a bit or type one in first.');
      return;
    }

    const bitToAnalyze = workingBit?.content || customBitText.trim();
    setIsLoading(true);

    try {
      const result = await analyzeBit(bitToAnalyze);

      const analysisMessage: CoachMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: result.analysis,
      };

      setMessages((prev) => [...prev, analysisMessage]);
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze bit. Make sure the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'How can I make this funnier?',
    'Punch up my punchlines',
    'Suggest alternative wording',
    'Help with the structure',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={styles.coachModalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.coachKeyboardView}
        >
          {/* Header */}
          <View style={styles.coachHeader}>
            <View style={styles.coachHeaderLeft}>
              <Text style={styles.coachHeaderEmoji}>🎭</Text>
              <View>
                <Text style={styles.coachHeaderTitle}>AI Comedy Coach</Text>
                <Text style={styles.coachHeaderSubtitle}>
                  {workingBit ? `Working on: ${workingBit.title}` : 'Ready to help'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.coachCloseButton} onPress={onClose}>
              <Text style={styles.coachCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {!isPremium ? (
            <View style={styles.coachLockedContainer}>
              <LockedFeature
                title="AI Comedy Coach"
                description="Get personalized coaching, bit analysis, and help improving your material with AI."
                onUpgrade={() => {
                  onClose();
                  onNavigateToPremium?.();
                }}
              />
            </View>
          ) : (
            <>
              {/* Mode Tabs */}
              <View style={styles.coachModeTabs}>
                <TouchableOpacity
                  style={[styles.coachModeTab, mode === 'chat' && styles.coachModeTabActive]}
                  onPress={() => setMode('chat')}
                >
                  <Text style={[styles.coachModeTabText, mode === 'chat' && styles.coachModeTabTextActive]}>
                    Chat
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.coachModeTab, mode === 'select-bit' && styles.coachModeTabActive]}
                  onPress={() => setMode('select-bit')}
                >
                  <Text style={[styles.coachModeTabText, mode === 'select-bit' && styles.coachModeTabTextActive]}>
                    My Bits ({bits.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.coachModeTab, mode === 'type-bit' && styles.coachModeTabActive]}
                  onPress={() => setMode('type-bit')}
                >
                  <Text style={[styles.coachModeTabText, mode === 'type-bit' && styles.coachModeTabTextActive]}>
                    Paste Text
                  </Text>
                </TouchableOpacity>
              </View>

              {mode === 'chat' && (
                <>
                  {/* Messages */}
                  <ScrollView
                    ref={scrollViewRef}
                    style={styles.coachMessagesContainer}
                    contentContainerStyle={styles.coachMessagesContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {messages.map((message) => (
                      <View
                        key={message.id}
                        style={[
                          styles.coachMessageBubble,
                          message.role === 'user' ? styles.coachUserBubble : styles.coachAssistantBubble,
                        ]}
                      >
                        {message.role === 'assistant' && (
                          <Text style={styles.coachLabel}>Coach</Text>
                        )}
                        <Text
                          style={[
                            styles.coachMessageText,
                            message.role === 'user' ? styles.coachUserText : styles.coachAssistantText,
                          ]}
                        >
                          {message.content}
                        </Text>
                      </View>
                    ))}

                    {isLoading && (
                      <View style={[styles.coachMessageBubble, styles.coachAssistantBubble]}>
                        <Text style={styles.coachLabel}>Coach</Text>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.coachTypingText}>Thinking...</Text>
                      </View>
                    )}
                  </ScrollView>

                  {/* Quick Prompts */}
                  {messages.length <= 3 && workingBit && !isLoading && (
                    <View style={styles.coachQuickPromptsContainer}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {quickPrompts.map((prompt, index) => (
                          <TouchableOpacity
                            key={index}
                            style={styles.coachQuickPromptButton}
                            onPress={() => handleSendMessage(prompt)}
                          >
                            <Text style={styles.coachQuickPromptText}>{prompt}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Analyze Button */}
                  {workingBit && (
                    <TouchableOpacity
                      style={styles.coachAnalyzeButton}
                      onPress={handleAnalyzeBit}
                      disabled={isLoading}
                    >
                      <Text style={styles.coachAnalyzeEmoji}>📊</Text>
                      <Text style={styles.coachAnalyzeText}>Get Full Analysis</Text>
                    </TouchableOpacity>
                  )}

                  {/* Input Area */}
                  <View style={styles.coachInputContainer}>
                    <TextInput
                      style={styles.coachTextInput}
                      placeholder="Ask your coach..."
                      placeholderTextColor={colors.textMuted}
                      value={inputText}
                      onChangeText={setInputText}
                      multiline
                      maxLength={2000}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      style={[styles.coachSendButton, (!inputText.trim() || isLoading) && styles.coachSendButtonDisabled]}
                      onPress={() => handleSendMessage(inputText)}
                      disabled={!inputText.trim() || isLoading}
                    >
                      <Text style={styles.coachSendButtonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {mode === 'select-bit' && (
                <ScrollView style={styles.coachBitSelectContainer}>
                  <Text style={styles.coachBitSelectTitle}>Select a bit to work on:</Text>
                  {bits.length === 0 ? (
                    <View style={styles.coachEmptyState}>
                      <Text style={styles.coachEmptyEmoji}>📝</Text>
                      <Text style={styles.coachEmptyText}>No bits yet. Create one first!</Text>
                    </View>
                  ) : (
                    bits.map((bit) => (
                      <TouchableOpacity
                        key={bit.id}
                        style={[
                          styles.coachBitSelectItem,
                          workingBit?.id === bit.id && styles.coachBitSelectItemActive,
                        ]}
                        onPress={() => handleSelectBit(bit)}
                      >
                        <Text style={styles.coachBitSelectItemTitle}>{bit.title}</Text>
                        <Text style={styles.coachBitSelectItemPreview} numberOfLines={2}>
                          {bit.content}
                        </Text>
                        <Text style={styles.coachBitSelectItemTime}>{calculateTime(bit.content)}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}

              {mode === 'type-bit' && (
                <View style={styles.coachTypeBitContainer}>
                  <Text style={styles.coachTypeBitTitle}>Paste or type your bit:</Text>
                  <TextInput
                    style={styles.coachTypeBitInput}
                    placeholder="Enter your comedy bit here..."
                    placeholderTextColor={colors.textMuted}
                    value={customBitText}
                    onChangeText={setCustomBitText}
                    multiline
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[
                      styles.coachTypeBitSubmit,
                      !customBitText.trim() && styles.coachTypeBitSubmitDisabled,
                    ]}
                    onPress={handleSubmitCustomBit}
                    disabled={!customBitText.trim()}
                  >
                    <Text style={styles.coachTypeBitSubmitText}>Get Coach Feedback</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// Routine Builder Modal
type RoutineBuilderModalProps = {
  visible: boolean;
  onClose: () => void;
  bits: Bit[];
  isPremium: boolean;
  onSaveRoutine: (routine: Routine) => void;
  onNavigateToPremium?: () => void;
};

function RoutineBuilderModal({ visible, onClose, bits, isPremium, onSaveRoutine, onNavigateToPremium }: RoutineBuilderModalProps) {
  const [selectedBitIds, setSelectedBitIds] = useState<string[]>([]);
  const [routineName, setRoutineName] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedBits = bits.filter(b => selectedBitIds.includes(b.id));
  const totalTime = calculateTotalTime(selectedBits);

  const toggleBit = (bitId: string) => {
    setSelectedBitIds(prev =>
      prev.includes(bitId)
        ? prev.filter(id => id !== bitId)
        : [...prev, bitId]
    );
  };

  const moveBit = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...selectedBitIds];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newOrder.length) return;
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setSelectedBitIds(newOrder);
  };

  const handleAISuggestOrder = async () => {
    if (!isPremium || selectedBits.length < 2) return;
    setLoading(true);
    try {
      const suggestedOrder = await aiSuggestBitOrder(selectedBits);
      setSelectedBitIds(suggestedOrder);
    } catch (error) {
      Alert.alert('Error', 'Failed to get AI suggestion');
    } finally {
      setLoading(false);
    }
  };

  const handleAIBuildSet = async (targetMinutes: number) => {
    if (!isPremium) return;
    setLoading(true);
    try {
      const suggestedBits = await aiBuildSetForTime(bits, targetMinutes);
      setSelectedBitIds(suggestedBits);
    } catch (error) {
      Alert.alert('Error', 'Failed to build set');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!routineName.trim() || selectedBitIds.length === 0) {
      Alert.alert('Error', 'Please enter a name and select at least one bit');
      return;
    }
    const routine: Routine = {
      id: generateId(),
      name: routineName.trim(),
      bitIds: selectedBitIds,
      createdAt: new Date().toISOString(),
    };
    onSaveRoutine(routine);
    setRoutineName('');
    setSelectedBitIds([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.routineModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Build Routine</Text>
            <PremiumBadge />
          </View>

          {!isPremium ? (
            <LockedFeature
              title="Routine Builder"
              description="Create and save custom routines by combining your bits. Reorder, time, and perfect your sets."
              onUpgrade={() => {
                onClose();
                onNavigateToPremium?.();
              }}
            />
          ) : (
            <ScrollView style={styles.routineContent}>
              {/* Routine Name */}
              <TextInput
                style={styles.routineNameInput}
                placeholder="Routine name (e.g., '5 Min Set')"
                placeholderTextColor={colors.textMuted}
                value={routineName}
                onChangeText={setRoutineName}
              />

              {/* AI Quick Build */}
              <View style={styles.quickBuildSection}>
                <Text style={styles.quickBuildTitle}>AI Quick Build</Text>
                <View style={styles.quickBuildRow}>
                  {[5, 10, 15, 20].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={styles.quickBuildButton}
                      onPress={() => handleAIBuildSet(mins)}
                      disabled={loading}
                    >
                      <Text style={styles.quickBuildText}>{mins} min</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Selected Bits */}
              {selectedBitIds.length > 0 && (
                <View style={styles.selectedBitsSection}>
                  <View style={styles.selectedHeader}>
                    <Text style={styles.selectedTitle}>
                      Your Set ({totalTime})
                    </Text>
                    <TouchableOpacity onPress={handleAISuggestOrder} disabled={loading}>
                      <Text style={styles.aiSuggestText}>AI Suggest Order</Text>
                    </TouchableOpacity>
                  </View>
                  {selectedBitIds.map((bitId, index) => {
                    const bit = bits.find(b => b.id === bitId);
                    if (!bit) return null;
                    return (
                      <View key={bitId} style={styles.selectedBitItem}>
                        <Text style={styles.selectedBitNumber}>{index + 1}</Text>
                        <Text style={styles.selectedBitTitle}>{bit.title}</Text>
                        <Text style={styles.selectedBitTime}>{calculateTime(bit.content)}</Text>
                        <View style={styles.reorderButtons}>
                          <TouchableOpacity
                            onPress={() => moveBit(index, 'up')}
                            disabled={index === 0}
                          >
                            <Text style={[styles.reorderText, index === 0 && styles.reorderDisabled]}>↑</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => moveBit(index, 'down')}
                            disabled={index === selectedBitIds.length - 1}
                          >
                            <Text style={[styles.reorderText, index === selectedBitIds.length - 1 && styles.reorderDisabled]}>↓</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Available Bits */}
              <Text style={styles.availableBitsTitle}>Available Bits</Text>
              {bits.map((bit) => (
                <TouchableOpacity
                  key={bit.id}
                  style={[
                    styles.availableBitItem,
                    selectedBitIds.includes(bit.id) && styles.availableBitSelected,
                  ]}
                  onPress={() => toggleBit(bit.id)}
                >
                  <View style={[
                    styles.checkbox,
                    selectedBitIds.includes(bit.id) && styles.checkboxSelected,
                  ]}>
                    {selectedBitIds.includes(bit.id) && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.availableBitInfo}>
                    <Text style={styles.availableBitTitle}>{bit.title}</Text>
                    <Text style={styles.availableBitMeta}>
                      {bit.tags.length} tag{bit.tags.length !== 1 ? 's' : ''} • {calculateTime(bit.content)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}

              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.premium} />
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.routineActions}>
            {isPremium && (
              <TouchableOpacity style={styles.saveRoutineButton} onPress={handleSave}>
                <Text style={styles.saveRoutineText}>Save Routine</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Set Duration Options
const FREE_RECORD_INDEX = 0; // First option is free record
const SET_DURATIONS = [
  { label: 'Free', minutes: 0, seconds: 0 }, // Free record - no time limit
  { label: '5 min', minutes: 5, seconds: 300 },
  { label: '10 min', minutes: 10, seconds: 600 },
  { label: '15 min', minutes: 15, seconds: 900 },
  { label: '20 min', minutes: 20, seconds: 1200 },
  { label: '30 min', minutes: 30, seconds: 1800 },
  { label: 'Custom', minutes: 0, seconds: 0 },
];

// Initialize recordings directory
const ensureRecordingsDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
};

// Video Recording Modal
type RecordingModalProps = {
  visible: boolean;
  onClose: () => void;
  isPremium: boolean;
  onNavigateToPremium?: () => void;
  onRecordingSaved: (recording: SavedRecording) => void;
};

function RecordingModal({ visible, onClose, isPremium, onNavigateToPremium, onRecordingSaved }: RecordingModalProps) {
  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
  const [mediaLibraryPermission, setMediaLibraryPermission] = useState<boolean | null>(null);

  // Recording state
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');

  // Refs
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const totalDurationRef = useRef<number>(0);
  const recordedTimeRef = useRef<number>(0);

  // Request permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      // Request audio permission
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      setAudioPermission(audioStatus === 'granted');

      // Request media library permission
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      setMediaLibraryPermission(mediaStatus === 'granted');

      // Ensure recordings directory exists
      await ensureRecordingsDir();
    };

    if (visible && isPremium) {
      requestPermissions();
    }
  }, [visible, isPremium]);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Timer logic - handles both timed and free recording
  useEffect(() => {
    const isFreeRecord = totalDurationRef.current === 0;

    if (isRecording) {
      timerRef.current = setInterval(() => {
        // For timed recording, count down
        if (!isFreeRecord) {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              // Time's up - stop recording
              if (cameraRef.current) {
                cameraRef.current.stopRecording();
              }
              return 0;
            }
            return prev - 1;
          });
        }

        // Always count up the recording time
        setRecordingTime(prev => {
          const newTime = prev + 1;
          recordedTimeRef.current = newTime;
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectDuration = (index: number) => {
    setSelectedDuration(index);
    if (index !== SET_DURATIONS.length - 1) {
      setCustomMinutes('');
    }
  };

  const handleRequestPermissions = async () => {
    await requestCameraPermission();
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    setAudioPermission(audioStatus === 'granted');
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    setMediaLibraryPermission(mediaStatus === 'granted');
  };

  const handleProceedToCamera = () => {
    if (selectedDuration === null) {
      Alert.alert('Select Duration', 'Please select a set duration before recording');
      return;
    }

    let totalSeconds: number;

    // Free record mode - no time limit
    if (selectedDuration === FREE_RECORD_INDEX) {
      totalSeconds = 0; // 0 means unlimited
    } else if (selectedDuration === SET_DURATIONS.length - 1) {
      const mins = parseInt(customMinutes, 10);
      if (isNaN(mins) || mins <= 0) {
        Alert.alert('Invalid Duration', 'Please enter a valid number of minutes');
        return;
      }
      totalSeconds = mins * 60;
    } else {
      totalSeconds = SET_DURATIONS[selectedDuration].seconds;
    }

    totalDurationRef.current = totalSeconds;
    setTimeRemaining(totalSeconds);
    setRecordingTime(0);
    setShowCamera(true);
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current) {
      console.log('No camera ref available');
      return;
    }

    try {
      console.log('Starting recording...');

      // Configure audio mode for video recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setIsRecording(true);
      recordedTimeRef.current = 0;

      // Ensure recordings directory exists
      await ensureRecordingsDir();

      // Start video recording - this promise resolves when recording stops
      console.log('Calling recordAsync with maxDuration:', totalDurationRef.current);
      const video = await cameraRef.current.recordAsync({
        maxDuration: totalDurationRef.current,
      });

      console.log('Recording finished, video result:', JSON.stringify(video, null, 2));

      // Recording finished (either by timer or manual stop)
      // At this point, the recording has stopped
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (video && video.uri) {
        console.log('Video URI received:', video.uri);
        await saveRecording(video.uri, recordedTimeRef.current);
      } else {
        console.error('No video URI returned, video object:', video);
        Alert.alert('Recording Error', 'No video was captured. Please try again.');
      }

      setIsRecording(false);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Recording Error', `Failed to record video: ${error}`);
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleStopRecording = () => {
    if (cameraRef.current && isRecording) {
      // Just stop recording - the recordAsync promise will resolve
      // and handle saving in handleStartRecording
      cameraRef.current.stopRecording();
    }
  };

  const saveRecording = async (videoUri: string, finalRecordedTime: number) => {
    try {
      console.log('Saving recording from:', videoUri);

      // Check source file exists and has content
      const sourceInfo = await FileSystem.getInfoAsync(videoUri, { size: true });
      console.log('Source file info:', JSON.stringify(sourceInfo, null, 2));

      if (!sourceInfo.exists) {
        throw new Error('Source video file does not exist');
      }

      if (sourceInfo.size === 0) {
        throw new Error('Source video file is empty (0 bytes)');
      }

      const timestamp = Date.now();
      const filename = `recording_${timestamp}.mp4`;
      const localUri = RECORDINGS_DIR + filename;

      // Ensure recordings directory exists
      await ensureRecordingsDir();

      // Copy to app's recordings directory for reliable playback
      console.log('Copying to local storage:', localUri);
      await FileSystem.copyAsync({
        from: videoUri,
        to: localUri,
      });

      // Verify the copy worked
      const localInfo = await FileSystem.getInfoAsync(localUri, { size: true });
      console.log('Local file info:', JSON.stringify(localInfo, null, 2));

      if (!localInfo.exists || localInfo.size === 0) {
        throw new Error('Failed to copy video file');
      }

      // Also save to Photos as backup (non-blocking)
      if (mediaLibraryPermission) {
        MediaLibrary.createAssetAsync(videoUri).catch((err) => {
          console.log('Could not save to Photos:', err);
        });
      }

      // Use the recorded time, with a minimum of 1 second
      const recordedDuration = Math.max(finalRecordedTime, 1);

      // Create recording object - use local URI for playback
      const isFreeRecord = totalDurationRef.current === 0;
      const newRecording: SavedRecording = {
        id: timestamp.toString(),
        uri: localUri,
        duration: recordedDuration,
        setDuration: isFreeRecord ? recordedDuration : totalDurationRef.current,
        createdAt: new Date().toISOString(),
        title: isFreeRecord
          ? `Free Recording ${new Date().toLocaleDateString()}`
          : `Set Recording ${new Date().toLocaleDateString()}`,
      };

      console.log('New recording saved:', JSON.stringify(newRecording, null, 2));

      // Notify parent
      onRecordingSaved(newRecording);

      Alert.alert(
        'Recording Saved!',
        `Your ${formatTime(recordedDuration)} video has been saved.`,
        [{ text: 'OK', onPress: () => {
          resetModal();
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Error', `Failed to save recording: ${error}`);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleClose = () => {
    if (isRecording) {
      Alert.alert(
        'Stop Recording?',
        'You have an active recording. Do you want to stop and discard it?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop & Discard',
            style: 'destructive',
            onPress: async () => {
              if (cameraRef.current) {
                cameraRef.current.stopRecording();
              }
              setIsRecording(false);
              if (timerRef.current) clearInterval(timerRef.current);
              resetModal();
              onClose();
            },
          },
        ]
      );
    } else {
      resetModal();
      onClose();
    }
  };

  const resetModal = () => {
    setSelectedDuration(null);
    setCustomMinutes('');
    setTimeRemaining(0);
    setRecordingTime(0);
    setShowCamera(false);
    setIsRecording(false);
  };

  const getProgressPercentage = (): number => {
    if (totalDurationRef.current === 0) return 0;
    return ((totalDurationRef.current - timeRemaining) / totalDurationRef.current) * 100;
  };

  const hasAllPermissions = cameraPermission?.granted && audioPermission && mediaLibraryPermission;

  return (
    <Modal visible={visible} animationType="slide" transparent={!showCamera}>
      {showCamera ? (
        // Full screen camera view - overlay is positioned absolutely, not as child of CameraView
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
          />
          {/* Camera overlay UI - positioned absolutely on top of camera */}
          <SafeAreaView style={styles.cameraOverlayAbsolute}>
            {/* Top section - controls and timer */}
            <View>
              {/* Top bar */}
              <View style={styles.cameraTopBar}>
                <TouchableOpacity onPress={handleClose} style={styles.cameraCloseButton}>
                  <Text style={styles.cameraCloseText}>✕</Text>
                </TouchableOpacity>

                {isRecording && (
                  <Animated.View style={[styles.recordingBadge, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={styles.recordingBadgeDot} />
                    <Text style={styles.recordingBadgeText}>REC</Text>
                  </Animated.View>
                )}

                <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipCameraButton}>
                  <Text style={styles.flipCameraText}>🔄</Text>
                </TouchableOpacity>
              </View>

              {/* Timer display - positioned at top */}
              <View style={styles.cameraTimerContainerTop}>
                {totalDurationRef.current === 0 ? (
                  // Free recording mode - show elapsed time
                  <>
                    <Text style={styles.cameraTimerLabelSmall}>
                      {isRecording ? 'Recording' : 'Free Record'}
                    </Text>
                    <Text style={styles.cameraTimerTextSmall}>{formatTime(recordingTime)}</Text>
                  </>
                ) : (
                  // Timed recording mode
                  <>
                    <Text style={styles.cameraTimerLabelSmall}>
                      {isRecording ? 'Remaining' : 'Duration'}
                    </Text>
                    <Text style={styles.cameraTimerTextSmall}>{formatTime(timeRemaining)}</Text>
                    {isRecording && (
                      <View style={styles.cameraProgressBarSmall}>
                        <View style={[styles.cameraProgressFillSmall, { width: `${getProgressPercentage()}%` }]} />
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Spacer to push bottom controls down */}
            <View style={{ flex: 1 }} />

            {/* Bottom controls */}
            <View style={styles.cameraBottomBar}>
              {!isRecording ? (
                <TouchableOpacity style={styles.recordButton} onPress={handleStartRecording}>
                  <View style={styles.recordButtonInner} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.stopRecordButton} onPress={handleStopRecording}>
                  <View style={styles.stopRecordButtonInner} />
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>
      ) : (
        // Setup modal
        <View style={styles.modalOverlay}>
          <View style={styles.recordingModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Your Set</Text>
              <PremiumBadge />
            </View>

            {!isPremium ? (
              <LockedFeature
                title="Video Recording"
                description="Record yourself performing with a countdown timer. Review your performances and track your improvement over time."
                onUpgrade={() => {
                  onClose();
                  onNavigateToPremium?.();
                }}
              />
            ) : !hasAllPermissions ? (
              // Permission request UI
              <View style={styles.permissionContainer}>
                <Text style={styles.permissionEmoji}>📹</Text>
                <Text style={styles.permissionTitle}>Camera & Audio Access</Text>
                <Text style={styles.permissionDescription}>
                  To record your performance, we need access to your camera and microphone.
                </Text>

                <View style={styles.permissionStatus}>
                  <Text style={styles.permissionItem}>
                    📷 Camera: {cameraPermission?.granted ? '✅ Granted' : '❌ Not granted'}
                  </Text>
                  <Text style={styles.permissionItem}>
                    🎤 Microphone: {audioPermission ? '✅ Granted' : '❌ Not granted'}
                  </Text>
                  <Text style={styles.permissionItem}>
                    📁 Save to Library: {mediaLibraryPermission ? '✅ Granted' : '❌ Not granted'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.grantPermissionButton} onPress={handleRequestPermissions}>
                  <Text style={styles.grantPermissionText}>Grant Permissions</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.recordingContent} showsVerticalScrollIndicator={false}>
                {/* Duration Selection */}
                <Text style={styles.recordingLabel}>Select Set Duration</Text>
                <View style={styles.durationGrid}>
                  {SET_DURATIONS.map((duration, index) => (
                    <TouchableOpacity
                      key={duration.label}
                      style={[
                        styles.durationButton,
                        selectedDuration === index && styles.durationButtonSelected,
                      ]}
                      onPress={() => handleSelectDuration(index)}
                    >
                      <Text
                        style={[
                          styles.durationButtonText,
                          selectedDuration === index && styles.durationButtonTextSelected,
                        ]}
                      >
                        {duration.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Duration Input */}
                {selectedDuration === SET_DURATIONS.length - 1 && (
                  <View style={styles.customDurationContainer}>
                    <TextInput
                      style={styles.customDurationInput}
                      placeholder="Enter minutes"
                      placeholderTextColor={colors.textMuted}
                      value={customMinutes}
                      onChangeText={setCustomMinutes}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Text style={styles.customDurationLabel}>minutes</Text>
                  </View>
                )}

                {/* Tips */}
                <View style={styles.recordingTips}>
                  <Text style={styles.recordingTipsTitle}>Tips for Video Recording</Text>
                  <Text style={styles.recordingTip}>• Use front camera to see yourself perform</Text>
                  <Text style={styles.recordingTip}>• Prop your phone up at eye level</Text>
                  <Text style={styles.recordingTip}>• Ensure good lighting on your face</Text>
                  <Text style={styles.recordingTip}>• Find a quiet space with minimal background noise</Text>
                </View>

                {/* Start Button */}
                <TouchableOpacity
                  style={[
                    styles.startRecordingButton,
                    selectedDuration === null && styles.startRecordingButtonDisabled,
                  ]}
                  onPress={handleProceedToCamera}
                  disabled={selectedDuration === null}
                >
                  <Text style={styles.startRecordingEmoji}>🎬</Text>
                  <Text style={styles.startRecordingText}>Open Camera</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
}

// Video Player Modal
type VideoPlayerModalProps = {
  visible: boolean;
  onClose: () => void;
  recording: SavedRecording | null;
};

function VideoPlayerModal({ visible, onClose, recording }: VideoPlayerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  // Get the video URI
  const videoUri = recording?.uri || '';

  console.log('VideoPlayerModal render - URI:', videoUri, 'visible:', visible);

  // Create video player with the recording URI
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    console.log('Video player callback - initialized');
  });

  // Handle player status changes and auto-play
  useEffect(() => {
    if (!player) {
      console.log('No player available');
      return;
    }

    console.log('Setting up player listeners');

    const subscription = player.addListener('statusChange', (newStatus: any) => {
      console.log('Player status:', JSON.stringify(newStatus));

      if (newStatus.status === 'readyToPlay') {
        console.log('Player ready to play! Starting playback...');
        setIsLoading(false);
        setVideoError(null);
        setPlayerReady(true);
        // Auto-play when ready
        player.play();
      } else if (newStatus.status === 'error') {
        console.log('Player error:', newStatus.error);
        setIsLoading(false);
        setVideoError(`Failed to load: ${newStatus.error || 'Unknown error'}`);
      } else if (newStatus.status === 'loading') {
        console.log('Player loading...');
        setIsLoading(true);
      }
    });

    return () => {
      console.log('Cleaning up player listeners');
      subscription.remove();
    };
  }, [player]);

  // Pause when modal closes
  useEffect(() => {
    if (!visible && player) {
      player.pause();
      setPlayerReady(false);
    }
  }, [visible, player]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (player) {
      player.pause();
    }
    onClose();
  };

  if (!recording || !visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.videoPlayerContainer}>
        {/* Header */}
        <SafeAreaView style={styles.videoPlayerHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.videoCloseButton}>
            <Text style={styles.videoCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.videoPlayerTitle} numberOfLines={1}>
            {recording.title}
          </Text>
          <View style={{ width: 44 }} />
        </SafeAreaView>

        {/* Video */}
        <View style={styles.videoWrapper}>
          {videoError ? (
            <View style={styles.videoErrorContainer}>
              <Text style={styles.videoErrorEmoji}>⚠️</Text>
              <Text style={styles.videoErrorText}>Could not load video</Text>
              <Text style={styles.videoErrorSubtext}>{videoError}</Text>
            </View>
          ) : player ? (
            <VideoView
              player={player}
              style={{
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT * 0.6,
                backgroundColor: '#000',
              }}
              contentFit="contain"
              nativeControls={true}
              allowsPictureInPicture={false}
            />
          ) : (
            <View style={styles.videoErrorContainer}>
              <Text style={styles.videoErrorText}>Initializing player...</Text>
            </View>
          )}
          {isLoading && !videoError && !playerReady && (
            <View style={styles.videoLoadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: '#fff', marginTop: 10 }}>Loading video...</Text>
            </View>
          )}
        </View>

        {/* Recording info */}
        <SafeAreaView style={styles.videoControls}>
          <View style={styles.videoInfoBar}>
            <Text style={styles.videoInfoText}>
              Recorded: {formatTime(recording.duration)} • Set: {formatTime(recording.setDuration)}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// Recordings Library Modal
type RecordingsLibraryProps = {
  visible: boolean;
  onClose: () => void;
  recordings: SavedRecording[];
  onDeleteRecording: (id: string) => void;
  onUpdateRecording: (id: string, updates: Partial<SavedRecording>) => void;
};

// Edit Recording Modal
type EditRecordingModalProps = {
  visible: boolean;
  onClose: () => void;
  recording: SavedRecording | null;
  onSave: (id: string, updates: Partial<SavedRecording>) => void;
};

function EditRecordingModal({ visible, onClose, recording, onSave }: EditRecordingModalProps) {
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Reset form when recording changes or modal opens
  useEffect(() => {
    if (visible && recording) {
      setTitle(recording.title);
      setTags(recording.tags || []);
      setTagInput('');
    }
  }, [visible, recording]);

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    if (recording && title.trim()) {
      onSave(recording.id, { title: title.trim(), tags });
      onClose();
    }
  };

  return (
    <Modal visible={visible && !!recording} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.editRecordingModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Recording</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editFormSection}>
            <Text style={styles.editFormLabel}>Title</Text>
            <TextInput
              style={styles.editFormInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Recording title"
              placeholderTextColor="#9b8b7a"
            />
          </View>

          <View style={styles.editFormSection}>
            <Text style={styles.editFormLabel}>Tags</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInput}
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add a tag..."
                placeholderTextColor="#9b8b7a"
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addTagButton} onPress={handleAddTag}>
                <Text style={styles.addTagButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.tagChip}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <Text style={styles.tagChipRemove}>×</Text>
                </TouchableOpacity>
              ))}
              {tags.length === 0 && (
                <Text style={styles.noTagsText}>No tags added</Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function RecordingsLibrary({ visible, onClose, recordings, onDeleteRecording, onUpdateRecording }: RecordingsLibraryProps) {
  const [selectedRecording, setSelectedRecording] = useState<SavedRecording | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [editingRecording, setEditingRecording] = useState<SavedRecording | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setShowVideoPlayer(false);
      setSelectedRecording(null);
      setIsEditing(false);
      setEditingRecording(null);
    }
  }, [visible]);

  // Populate edit form when editing starts
  useEffect(() => {
    if (editingRecording && isEditing) {
      setEditTitle(editingRecording.title);
      setEditTags(editingRecording.tags || []);
      setEditTagInput('');
    }
  }, [editingRecording, isEditing]);

  const handleStartEdit = (recording: SavedRecording) => {
    setEditingRecording(recording);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingRecording(null);
  };

  const handleSaveEdit = () => {
    if (editingRecording && editTitle.trim()) {
      onUpdateRecording(editingRecording.id, { title: editTitle.trim(), tags: editTags });
      setIsEditing(false);
      setEditingRecording(null);
    }
  };

  const handleAddEditTag = () => {
    const trimmedTag = editTagInput.trim().toLowerCase();
    if (trimmedTag && !editTags.includes(trimmedTag)) {
      setEditTags([...editTags, trimmedTag]);
      setEditTagInput('');
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  const handleCloseLibrary = () => {
    setShowVideoPlayer(false);
    setSelectedRecording(null);
    onClose();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handlePlayRecording = async (recording: SavedRecording) => {
    try {
      console.log('Playing video from:', recording.uri);

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(recording.uri);
      console.log('File exists:', fileInfo.exists);

      if (!fileInfo.exists) {
        Alert.alert(
          'Video Not Found',
          'This video file no longer exists. It may have been deleted.',
          [{ text: 'OK' }]
        );
        return;
      }

      setSelectedRecording(recording);
      setShowVideoPlayer(true);
    } catch (error) {
      console.error('Error preparing playback:', error);
      Alert.alert('Error', `Could not access video file: ${error}`);
    }
  };

  const handleDelete = (recording: SavedRecording) => {
    Alert.alert(
      'Delete Recording',
      `Are you sure you want to delete "${recording.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the local file
              await FileSystem.deleteAsync(recording.uri, { idempotent: true });
              console.log('Deleted file:', recording.uri);
              onDeleteRecording(recording.id);
            } catch (error) {
              console.error('Delete error:', error);
              // Still remove from list even if file delete fails
              onDeleteRecording(recording.id);
            }
          }
        },
      ]
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.libraryModal, isEditing && styles.libraryModalEdit]}>
            {isEditing && editingRecording ? (
              // Edit View
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={handleCancelEdit}>
                    <Text style={styles.modalCloseText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Edit Recording</Text>
                  <TouchableOpacity onPress={handleSaveEdit}>
                    <Text style={styles.modalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.libraryContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.editFormSection}>
                    <Text style={styles.editFormLabel}>Title</Text>
                    <TextInput
                      style={styles.editFormInput}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      placeholder="Recording title"
                      placeholderTextColor="#9b8b7a"
                    />
                  </View>

                  <View style={styles.editFormSection}>
                    <Text style={styles.editFormLabel}>Tags</Text>
                    <View style={styles.tagInputRow}>
                      <TextInput
                        style={styles.tagInput}
                        value={editTagInput}
                        onChangeText={setEditTagInput}
                        placeholder="Add a tag..."
                        placeholderTextColor="#9b8b7a"
                        onSubmitEditing={handleAddEditTag}
                        returnKeyType="done"
                      />
                      <TouchableOpacity style={styles.addTagButton} onPress={handleAddEditTag}>
                        <Text style={styles.addTagButtonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.tagsContainer}>
                      {editTags.map((tag, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.tagChip}
                          onPress={() => handleRemoveEditTag(tag)}
                        >
                          <Text style={styles.tagChipText}>{tag}</Text>
                          <Text style={styles.tagChipRemove}>×</Text>
                        </TouchableOpacity>
                      ))}
                      {editTags.length === 0 && (
                        <Text style={styles.noTagsText}>No tags added</Text>
                      )}
                    </View>
                  </View>

                  {/* Extra padding for keyboard */}
                  <View style={{ height: 100 }} />
                </ScrollView>
              </>
            ) : (
              // List View
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>My Recordings</Text>
                  <Text style={styles.recordingCount}>{recordings.length} videos</Text>
                </View>

                <ScrollView style={styles.libraryContent} showsVerticalScrollIndicator={false}>
                  {recordings.length === 0 ? (
                    <View style={styles.emptyRecordings}>
                      <Text style={styles.emptyRecordingsEmoji}>🎬</Text>
                      <Text style={styles.emptyRecordingsText}>No recordings yet</Text>
                      <Text style={styles.emptyRecordingsSubtext}>
                        Record your first set to see it here!
                      </Text>
                    </View>
                  ) : (
                    recordings.map((recording) => (
                      <View key={recording.id} style={styles.recordingCard}>
                        <TouchableOpacity
                          style={styles.recordingPlayArea}
                          onPress={() => handlePlayRecording(recording)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.recordingThumbnail}>
                            <Text style={styles.recordingThumbnailIcon}>▶</Text>
                          </View>
                          <View style={styles.recordingInfo}>
                            <Text style={styles.recordingTitle}>{recording.title}</Text>
                            <Text style={styles.recordingMeta}>
                              {formatDuration(recording.duration)} recorded • {formatDuration(recording.setDuration)} set
                            </Text>
                            <Text style={styles.recordingDate}>{formatDate(recording.createdAt)}</Text>
                            {recording.tags && recording.tags.length > 0 && (
                              <View style={styles.recordingTags}>
                                {recording.tags.slice(0, 3).map((tag, index) => (
                                  <View key={index} style={styles.recordingTagChip}>
                                    <Text style={styles.recordingTagText}>{tag}</Text>
                                  </View>
                                ))}
                                {recording.tags.length > 3 && (
                                  <Text style={styles.moreTagsText}>+{recording.tags.length - 3}</Text>
                                )}
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                        <View style={styles.recordingActions}>
                          <TouchableOpacity
                            style={styles.editRecordingButton}
                            onPress={() => handleStartEdit(recording)}
                          >
                            <Text style={styles.editRecordingText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteRecordingButton}
                            onPress={() => handleDelete(recording)}
                          >
                            <Text style={styles.deleteRecordingText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.closeButton} onPress={handleCloseLibrary}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {selectedRecording && showVideoPlayer && (
        <VideoPlayerModal
          key={selectedRecording.id}
          visible={showVideoPlayer}
          onClose={() => {
            setShowVideoPlayer(false);
            setTimeout(() => setSelectedRecording(null), 100);
          }}
          recording={selectedRecording}
        />
      )}
    </>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function BitManagerScreen({ navigation }: any) {
  // State
  const [bits, setBits] = useState<Bit[]>(sampleBits);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [isPremium, setIsPremium] = useState(true); // Toggle for testing - set to true for access
  const [customTags, setCustomTags] = useState<Tag[]>([]); // User-created tags

  // All tags = default + custom
  const allTags = [...DEFAULT_TAGS, ...customTags];

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingBit, setEditingBit] = useState<Bit | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Modal state
  const [showAIModal, setShowAIModal] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [showRecordingsLibrary, setShowRecordingsLibrary] = useState(false);
  const [selectedBitForAI, setSelectedBitForAI] = useState<Bit | null>(null);
  const [showManageTags, setShowManageTags] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState<'bits' | 'routines'>('bits');

  // Load saved recordings on mount
  useEffect(() => {
    const loadRecordings = async () => {
      try {
        const recordingsFile = RECORDINGS_DIR + 'recordings.json';
        const fileInfo = await FileSystem.getInfoAsync(recordingsFile);
        if (fileInfo.exists) {
          const data = await FileSystem.readAsStringAsync(recordingsFile);
          setRecordings(JSON.parse(data));
        }
      } catch (error) {
        console.log('No saved recordings found');
      }
    };
    loadRecordings();
  }, []);

  // Save recordings when updated
  const saveRecordingsToFile = async (updatedRecordings: SavedRecording[]) => {
    try {
      await ensureRecordingsDir();
      const recordingsFile = RECORDINGS_DIR + 'recordings.json';
      await FileSystem.writeAsStringAsync(recordingsFile, JSON.stringify(updatedRecordings));
    } catch (error) {
      console.error('Failed to save recordings:', error);
    }
  };

  const handleRecordingSaved = (recording: SavedRecording) => {
    const updatedRecordings = [recording, ...recordings];
    setRecordings(updatedRecordings);
    saveRecordingsToFile(updatedRecordings);
  };

  const handleDeleteRecording = (id: string) => {
    const updatedRecordings = recordings.filter(r => r.id !== id);
    setRecordings(updatedRecordings);
    saveRecordingsToFile(updatedRecordings);
  };

  const handleUpdateRecording = (id: string, updates: Partial<SavedRecording>) => {
    const updatedRecordings = recordings.map(r =>
      r.id === id ? { ...r, ...updates } : r
    );
    setRecordings(updatedRecordings);
    saveRecordingsToFile(updatedRecordings);
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setSelectedTagIds([]);
    setEditingBit(null);
    setShowForm(false);
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = (name: string, color: string) => {
    const newTag: Tag = {
      id: generateId(),
      name,
      color,
      isCustom: true,
    };
    setCustomTags(prev => [...prev, newTag]);
  };

  const handleDeleteTag = (tagId: string) => {
    // Only allow deleting custom tags
    const tag = customTags.find(t => t.id === tagId);
    if (!tag) return;

    Alert.alert(
      'Delete Tag',
      `Are you sure you want to delete "${tag.name}"? This will remove it from all bits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setCustomTags(prev => prev.filter(t => t.id !== tagId));
          // Remove tag from all bits
          setBits(prev => prev.map(bit => ({
            ...bit,
            tags: bit.tags.filter(t => t !== tagId),
          })));
        }},
      ]
    );
  };

  const handleSaveBit = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Please enter a title and content');
      return;
    }

    if (selectedTagIds.length === 0) {
      Alert.alert('Error', 'Please select at least one tag');
      return;
    }

    const now = new Date().toISOString();

    if (editingBit) {
      // Update existing bit
      setBits(prev => prev.map(b =>
        b.id === editingBit.id
          ? { ...b, title, content, tags: selectedTagIds, updatedAt: now }
          : b
      ));
    } else {
      // Create new bit
      const newBit: Bit = {
        id: generateId(),
        title,
        content,
        tags: selectedTagIds,
        createdAt: now,
        updatedAt: now,
      };
      setBits(prev => [...prev, newBit]);
    }

    resetForm();
  };

  const handleEditBit = (bit: Bit) => {
    setEditingBit(bit);
    setTitle(bit.title);
    setContent(bit.content);
    setSelectedTagIds(bit.tags);
    setShowForm(true);
  };

  const handleDeleteBit = (bitId: string) => {
    Alert.alert(
      'Delete Bit',
      'Are you sure you want to delete this bit?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setBits(prev => prev.filter(b => b.id !== bitId));
        }},
      ]
    );
  };

  const handleOpenAI = (bit: Bit) => {
    setSelectedBitForAI(bit);
    setShowAIModal(true);
  };

  const handleSaveRoutine = (routine: Routine) => {
    setRoutines(prev => [...prev, routine]);
  };

  const handleDeleteRoutine = (routineId: string) => {
    Alert.alert(
      'Delete Routine',
      'Are you sure you want to delete this routine?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setRoutines(prev => prev.filter(r => r.id !== routineId));
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bits</Text>
        {/* Premium toggle for testing */}
        <TouchableOpacity onPress={() => setIsPremium(!isPremium)}>
          <Text style={[styles.premiumToggle, isPremium && styles.premiumActive]}>
            {isPremium ? '★ PRO' : '☆ FREE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bits' && styles.tabActive]}
          onPress={() => setActiveTab('bits')}
        >
          <Text style={[styles.tabText, activeTab === 'bits' && styles.tabTextActive]}>
            Bits ({bits.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'routines' && styles.tabActive]}
          onPress={() => setActiveTab('routines')}
        >
          <Text style={[styles.tabText, activeTab === 'routines' && styles.tabTextActive]}>
            Routines ({routines.length})
          </Text>
          {!isPremium && <Text style={styles.lockIcon}>🔒</Text>}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'bits' ? (
          <>
            {/* Create/Edit Form */}
            {showForm ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>
                  {editingBit ? 'Edit Bit' : 'Create New Bit'}
                </Text>

                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Give your bit a name"
                  placeholderTextColor={colors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={styles.inputLabel}>Content</Text>
                <TextInput
                  style={[styles.input, styles.contentInput]}
                  placeholder="Write your bit here..."
                  placeholderTextColor={colors.textMuted}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />

                {content.length > 0 && (
                  <Text style={styles.timeEstimate}>
                    Estimated time: {calculateTime(content)}
                  </Text>
                )}

                <TagPicker
                  allTags={allTags}
                  selectedTagIds={selectedTagIds}
                  onToggleTag={handleToggleTag}
                  onCreateTag={handleCreateTag}
                />

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelFormButton} onPress={resetForm}>
                    <Text style={styles.cancelFormText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveFormButton} onPress={handleSaveBit}>
                    <Text style={styles.saveFormText}>
                      {editingBit ? 'Update' : 'Save'} Bit
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.createButton} onPress={() => setShowForm(true)}>
                <Text style={styles.createButtonIcon}>+</Text>
                <Text style={styles.createButtonText}>Create New Bit</Text>
              </TouchableOpacity>
            )}

            {/* Premium Actions - Row 1 */}
            <View style={styles.premiumActionsRow}>
              <TouchableOpacity
                style={[styles.premiumActionButton, !isPremium && styles.premiumActionLocked]}
                onPress={() => setShowRoutineModal(true)}
              >
                <Text style={styles.premiumActionEmoji}>📋</Text>
                <Text style={styles.premiumActionText}>Routine</Text>
                {!isPremium && <Text style={styles.lockIconSmall}>🔒</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.premiumActionButton, !isPremium && styles.premiumActionLocked]}
                onPress={() => {
                  if (bits.length > 0) {
                    setSelectedBitForAI(bits[0]);
                    setShowAIModal(true);
                  }
                }}
              >
                <Text style={styles.premiumActionEmoji}>🤖</Text>
                <Text style={styles.premiumActionText}>AI</Text>
                {!isPremium && <Text style={styles.lockIconSmall}>🔒</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.premiumActionButton, !isPremium && styles.premiumActionLocked]}
                onPress={() => setShowRecordingModal(true)}
              >
                <Text style={styles.premiumActionEmoji}>🎬</Text>
                <Text style={styles.premiumActionText}>Record</Text>
                {!isPremium && <Text style={styles.lockIconSmall}>🔒</Text>}
              </TouchableOpacity>
            </View>

            {/* My Videos Button */}
            {recordings.length > 0 && (
              <TouchableOpacity
                style={styles.myVideosButton}
                onPress={() => setShowRecordingsLibrary(true)}
              >
                <Text style={styles.myVideosEmoji}>🎥</Text>
                <Text style={styles.myVideosText}>My Videos ({recordings.length})</Text>
                <Text style={styles.myVideosArrow}>→</Text>
              </TouchableOpacity>
            )}

            {/* Manage Tags */}
            {customTags.length > 0 && (
              <View style={styles.manageTagsSection}>
                <Text style={styles.manageTagsTitle}>Your Custom Tags</Text>
                <View style={styles.customTagsList}>
                  {customTags.map((tag) => (
                    <View key={tag.id} style={styles.customTagItem}>
                      <View style={[styles.customTagDot, { backgroundColor: tag.color }]} />
                      <Text style={styles.customTagName}>{tag.name}</Text>
                      <TouchableOpacity onPress={() => handleDeleteTag(tag.id)}>
                        <Text style={styles.deleteTagText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Bits List */}
            <Text style={styles.sectionTitle}>Your Bits</Text>
            {bits.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={styles.emptyText}>No bits yet. Create your first one!</Text>
              </View>
            ) : (
              bits.map((bit) => (
                <View key={bit.id}>
                  <BitCard
                    bit={bit}
                    allTags={allTags}
                    onEdit={() => handleEditBit(bit)}
                    onDelete={() => handleDeleteBit(bit.id)}
                  />
                  {isPremium && (
                    <TouchableOpacity
                      style={styles.aiHelpButton}
                      onPress={() => handleOpenAI(bit)}
                    >
                      <Text style={styles.aiHelpText}>✨ Get AI Help</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {/* Routines Tab */}
            {!isPremium ? (
              <LockedFeature
                title="Routines"
                description="Create, save, and manage your comedy routines. Perfect your sets for any time slot."
                onUpgrade={() => navigation.navigate('GoPremium')}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => setShowRoutineModal(true)}
                >
                  <Text style={styles.createButtonIcon}>+</Text>
                  <Text style={styles.createButtonText}>Build New Routine</Text>
                </TouchableOpacity>

                {routines.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>📋</Text>
                    <Text style={styles.emptyText}>No routines yet. Build your first set!</Text>
                  </View>
                ) : (
                  routines.map((routine) => {
                    const routineBits = bits.filter(b => routine.bitIds.includes(b.id));
                    return (
                      <View key={routine.id} style={styles.routineCard}>
                        <View style={styles.routineHeader}>
                          <Text style={styles.routineName}>{routine.name}</Text>
                          <Text style={styles.routineTime}>{calculateTotalTime(routineBits)}</Text>
                        </View>
                        <Text style={styles.routineBitCount}>
                          {routine.bitIds.length} bits
                        </Text>
                        <View style={styles.routineBitsList}>
                          {routine.bitIds.map((bitId, index) => {
                            const bit = bits.find(b => b.id === bitId);
                            return bit ? (
                              <Text key={bitId} style={styles.routineBitItem}>
                                {index + 1}. {bit.title}
                              </Text>
                            ) : null;
                          })}
                        </View>
                        <TouchableOpacity
                          style={styles.deleteRoutineButton}
                          onPress={() => handleDeleteRoutine(routine.id)}
                        >
                          <Text style={styles.deleteRoutineText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </>
            )}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Modals */}
      <AIAssistantModal
        visible={showAIModal}
        onClose={() => setShowAIModal(false)}
        bits={bits}
        selectedBit={selectedBitForAI}
        isPremium={isPremium}
        onNavigateToPremium={() => navigation.navigate('GoPremium')}
      />

      <RoutineBuilderModal
        visible={showRoutineModal}
        onClose={() => setShowRoutineModal(false)}
        bits={bits}
        isPremium={isPremium}
        onSaveRoutine={handleSaveRoutine}
        onNavigateToPremium={() => navigation.navigate('GoPremium')}
      />

      <RecordingModal
        visible={showRecordingModal}
        onClose={() => setShowRecordingModal(false)}
        isPremium={isPremium}
        onNavigateToPremium={() => navigation.navigate('GoPremium')}
        onRecordingSaved={handleRecordingSaved}
      />

      <RecordingsLibrary
        visible={showRecordingsLibrary}
        onClose={() => setShowRecordingsLibrary(false)}
        recordings={recordings}
        onDeleteRecording={handleDeleteRecording}
        onUpdateRecording={handleUpdateRecording}
      />
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

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
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  premiumToggle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
  },
  premiumActive: {
    color: colors.premium,
    backgroundColor: colors.premiumBg,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  lockIcon: {
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  createButtonIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  createButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  premiumActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  premiumActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.premiumBg,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.premium,
    gap: 6,
  },
  premiumActionLocked: {
    opacity: 0.6,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg,
  },
  premiumActionEmoji: {
    fontSize: 18,
  },
  premiumActionText: {
    fontSize: 14,
    color: colors.premium,
    fontWeight: '600',
  },
  lockIconSmall: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 12,
  },
  // Form styles
  formCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  contentInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  timeEstimate: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: -8,
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  // Tag picker styles
  tagPickerContainer: {
    marginBottom: 16,
  },
  tagPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.premiumBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.premium,
  },
  addTagButtonText: {
    fontSize: 13,
    color: colors.premium,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  tagCheckmark: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tagChipText: {
    fontSize: 14,
  },
  tagChipTextSelected: {
    fontWeight: '600',
  },
  customBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  customBadgeText: {
    fontSize: 8,
    color: '#fff',
  },
  selectedTagsCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  // Tag display styles
  tagDisplayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagDisplayChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagDisplayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreTagsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  moreTagsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  // Create tag modal styles
  tagModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tagModalContent: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  tagModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 20,
    textAlign: 'center',
  },
  tagNameInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.textDark,
  },
  colorCheck: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tagPreviewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  previewLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  tagPreview: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagPreviewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  tagModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tagModalCancelText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  tagModalCreate: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  tagModalCreateText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Manage tags section
  manageTagsSection: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  manageTagsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  customTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  customTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  customTagDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  customTagName: {
    fontSize: 13,
    color: colors.textDark,
  },
  deleteTagText: {
    fontSize: 18,
    color: colors.error,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelFormButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cancelFormText: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  saveFormButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveFormText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Bit card styles
  bitCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  bitCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(107, 142, 111, 0.05)',
  },
  bitCardHeader: {
    marginBottom: 8,
  },
  bitCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  bitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    flex: 1,
  },
  bitMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  bitTime: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '600',
  },
  bitPreview: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  bitActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  editButtonText: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(217, 83, 79, 0.1)',
  },
  deleteButtonText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
  },
  aiHelpButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 8,
  },
  aiHelpText: {
    fontSize: 13,
    color: colors.premium,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Premium/Locked feature
  premiumBadge: {
    backgroundColor: colors.premium,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  premiumBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  lockedFeature: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  lockedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  lockedDescription: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradeButton: {
    backgroundColor: colors.premium,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  aiModal: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 20,
  },
  routineModal: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  aiContent: {
    maxHeight: 400,
  },
  aiSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  aiButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  aiActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  aiActionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  aiActionText: {
    fontSize: 12,
    color: colors.textDark,
    fontWeight: '600',
  },
  generateSection: {
    marginTop: 8,
  },
  topicInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
  },
  generateButton: {
    backgroundColor: colors.premium,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
  resultContainer: {
    backgroundColor: colors.premiumBg,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.premium,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.premium,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    color: colors.textDark,
    lineHeight: 22,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  // Routine builder styles
  routineContent: {
    maxHeight: 450,
  },
  routineNameInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  quickBuildSection: {
    marginBottom: 20,
  },
  quickBuildTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 10,
  },
  quickBuildRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBuildButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.premiumBg,
    borderWidth: 1,
    borderColor: colors.premium,
  },
  quickBuildText: {
    fontSize: 14,
    color: colors.premium,
    fontWeight: '600',
  },
  selectedBitsSection: {
    marginBottom: 20,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  aiSuggestText: {
    fontSize: 13,
    color: colors.premium,
    fontWeight: '600',
  },
  selectedBitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  selectedBitNumber: {
    width: 24,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  selectedBitTitle: {
    flex: 1,
    fontSize: 14,
    color: colors.textDark,
  },
  selectedBitTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 10,
  },
  reorderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  reorderText: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: 'bold',
  },
  reorderDisabled: {
    color: colors.cardBorder,
  },
  availableBitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  availableBitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    marginBottom: 8,
    gap: 12,
  },
  availableBitSelected: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
  },
  availableBitInfo: {
    flex: 1,
  },
  availableBitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  availableBitMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  routineActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  saveRoutineButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveRoutineText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  // Routine card styles
  routineCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  routineName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  routineTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
  },
  routineBitCount: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 10,
  },
  routineBitsList: {
    marginBottom: 12,
  },
  routineBitItem: {
    fontSize: 14,
    color: colors.textDark,
    paddingVertical: 3,
  },
  deleteRoutineButton: {
    alignSelf: 'flex-start',
  },
  deleteRoutineText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  // Recording Modal styles
  recordingModal: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  recordingContent: {
    paddingVertical: 8,
  },
  recordingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  durationButton: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  durationButtonSelected: {
    backgroundColor: colors.premiumBg,
    borderColor: colors.premium,
    borderWidth: 2,
  },
  durationButtonText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '600',
  },
  durationButtonTextSelected: {
    color: colors.premium,
  },
  customDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  customDurationInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  customDurationLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  recordingTips: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  recordingTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  recordingTip: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
    lineHeight: 18,
  },
  startRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  startRecordingButtonDisabled: {
    opacity: 0.5,
  },
  startRecordingEmoji: {
    fontSize: 24,
  },
  startRecordingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  recordingActiveContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  recordingIndicator: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(217, 83, 79, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  recordingIndicatorPaused: {
    backgroundColor: 'rgba(155, 139, 122, 0.15)',
  },
  recordingDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error,
  },
  recordingDotPaused: {
    backgroundColor: colors.textMuted,
  },
  recordingStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.error,
    letterSpacing: 2,
    marginBottom: 20,
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  recordedTimeText: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
  recordingControls: {
    flexDirection: 'row',
    gap: 16,
  },
  pauseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  pauseButtonEmoji: {
    fontSize: 20,
  },
  pauseButtonText: {
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  stopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
  },
  stopButtonEmoji: {
    fontSize: 20,
  },
  stopButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  // My Videos Button
  myVideosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  myVideosEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  myVideosText: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    fontWeight: '600',
  },
  myVideosArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraOverlayAbsolute: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  cameraCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 83, 79, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  recordingBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  recordingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  flipCameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipCameraText: {
    fontSize: 24,
  },
  cameraTimerContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    marginHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 16,
  },
  cameraTimerContainerTop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginHorizontal: 60,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  cameraTimerLabelSmall: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 2,
  },
  cameraTimerTextSmall: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  cameraProgressBarSmall: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  cameraProgressFillSmall: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  cameraTimerLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  cameraTimerText: {
    color: '#fff',
    fontSize: 56,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  cameraProgressBar: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  cameraProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  cameraRecordedTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 8,
  },
  freeRecordIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  freeRecordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  freeRecordText: {
    color: '#ff3b30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraBottomBar: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.error,
  },
  stopRecordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stopRecordButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  // Permission styles
  permissionContainer: {
    alignItems: 'center',
    padding: 24,
  },
  permissionEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  permissionDescription: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  permissionStatus: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  permissionItem: {
    fontSize: 14,
    color: colors.textDark,
    marginBottom: 8,
  },
  grantPermissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  grantPermissionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Library modal styles
  libraryModal: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
  },
  libraryModalEdit: {
    maxHeight: '60%',
  },
  recordingCount: {
    fontSize: 14,
    color: colors.textMuted,
  },
  libraryContent: {
    maxHeight: 450,
  },
  emptyRecordings: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyRecordingsEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyRecordingsText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 4,
  },
  emptyRecordingsSubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 10,
    paddingRight: 8,
  },
  recordingPlayArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  recordingThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordingThumbnailIcon: {
    fontSize: 24,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 4,
  },
  recordingMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 2,
  },
  recordingDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  deleteRecordingButton: {
    padding: 8,
  },
  deleteRecordingText: {
    fontSize: 20,
  },
  recordingActions: {
    flexDirection: 'column',
    gap: 4,
  },
  editRecordingButton: {
    padding: 8,
  },
  editRecordingText: {
    fontSize: 18,
  },
  recordingTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  recordingTagChip: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recordingTagText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 11,
    color: colors.textMuted,
    alignSelf: 'center',
  },
  // Edit Recording Modal styles
  editRecordingModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  editFormSection: {
    marginTop: 20,
  },
  editFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  editFormInput: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textDark,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textDark,
  },
  addTagButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addTagButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    minHeight: 32,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagChipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tagChipRemove: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noTagsText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Video Player styles
  videoPlayerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  videoCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCloseText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  videoPlayerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  videoWrapper: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoPlayer: {
    ...StyleSheet.absoluteFillObject,
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  videoErrorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  videoErrorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  videoErrorSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  videoRetryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  videoRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoControls: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  videoProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  videoTimeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    width: 45,
  },
  videoProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  videoProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  videoButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  videoControlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoControlIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoPlayPauseButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayPauseIcon: {
    color: '#fff',
    fontSize: 28,
  },
  videoInfoBar: {
    alignItems: 'center',
  },
  videoInfoText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  // AI Coach Modal Styles
  coachModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  coachKeyboardView: {
    flex: 1,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  coachHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coachHeaderEmoji: {
    fontSize: 36,
  },
  coachHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  coachHeaderSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  coachCloseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  coachCloseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  coachLockedContainer: {
    flex: 1,
    padding: 20,
  },
  coachModeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  coachModeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  coachModeTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  coachModeTabText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  coachModeTabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  coachMessagesContainer: {
    flex: 1,
  },
  coachMessagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  coachMessageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
  },
  coachUserBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  coachAssistantBubble: {
    backgroundColor: colors.cardBg,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  coachLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coachMessageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  coachUserText: {
    color: '#fff',
  },
  coachAssistantText: {
    color: colors.textDark,
  },
  coachTypingText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  coachQuickPromptsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  coachQuickPromptButton: {
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  coachQuickPromptText: {
    fontSize: 13,
    color: colors.textDark,
  },
  coachAnalyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.premiumBg,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.premium,
    gap: 8,
  },
  coachAnalyzeEmoji: {
    fontSize: 18,
  },
  coachAnalyzeText: {
    fontSize: 14,
    color: colors.premium,
    fontWeight: '600',
  },
  coachInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: 10,
  },
  coachTextInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textDark,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  coachSendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  coachSendButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  coachSendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  coachBitSelectContainer: {
    flex: 1,
    padding: 16,
  },
  coachBitSelectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 16,
  },
  coachEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  coachEmptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  coachEmptyText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  coachBitSelectItem: {
    backgroundColor: colors.cardBg,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  coachBitSelectItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.premiumBg,
  },
  coachBitSelectItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 6,
  },
  coachBitSelectItemPreview: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 8,
  },
  coachBitSelectItemTime: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  coachTypeBitContainer: {
    flex: 1,
    padding: 16,
  },
  coachTypeBitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 16,
  },
  coachTypeBitInput: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  coachTypeBitSubmit: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  coachTypeBitSubmitDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  coachTypeBitSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
