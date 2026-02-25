import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { decode } from 'base64-arraybuffer';

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  error: '#d9534f',
  success: '#5cb85c',
};

type UploadMethod = 'youtube' | 'library' | null;

type VideoData = {
  title: string;
  thumbnail_url: string;
  video_id: string;
  local_uri?: string;
};

type CategoryTag = 'community_sets' | 'community_ideas';

const CATEGORY_TAGS = [
  { id: 'community_sets', label: 'Community Sets', icon: '🎭', description: 'Full stand-up performances' },
  { id: 'community_ideas', label: 'Community Ideas', icon: '💡', description: 'Bits, concepts & work-in-progress' },
];

const THEME_TAGS = [
  'Observational',
  'Self-Deprecating',
  'Political',
  'Dark Humor',
  'Clean Comedy',
  'Storytelling',
  'One-Liners',
  'Improv',
  'Roast',
  'Absurdist',
  'Crowd Work',
  'Physical Comedy',
];

// Extract YouTube video ID from various URL formats
const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Format date for display
const formatDateForPicker = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function ShareSetScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [uploadMethod, setUploadMethod] = useState<UploadMethod>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [venueName, setVenueName] = useState('');
  const [performanceDate, setPerformanceDate] = useState<Date | null>(null);
  const [categoryTag, setCategoryTag] = useState<CategoryTag>('community_sets');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [customTheme, setCustomTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchYouTubeData = async (url: string) => {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      Alert.alert('Invalid URL', 'Please enter a valid YouTube video URL');
      return;
    }

    setFetching(true);
    try {
      // Use YouTube oEmbed API to get video info
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);

      if (!response.ok) {
        throw new Error('Could not fetch video info');
      }

      const data = await response.json();

      setVideoData({
        title: data.title,
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        video_id: videoId,
      });
      setCustomTitle(data.title);
      setUploadMethod('youtube');
    } catch (error) {
      // Sentry captures this automatically
      // Still allow submission with manual thumbnail
      setVideoData({
        title: '',
        thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        video_id: videoId,
      });
      setUploadMethod('youtube');
      Alert.alert('Note', 'Could not auto-fetch video title. Please enter it manually.');
    } finally {
      setFetching(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setYoutubeUrl(url);

    // Auto-fetch when a valid URL is detected
    if (url.length > 10 && (url.includes('youtube.com') || url.includes('youtu.be'))) {
      const videoId = extractYouTubeId(url);
      if (videoId && (!videoData || videoData.video_id !== videoId)) {
        fetchYouTubeData(url);
      }
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant access to your photo library to upload videos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {} },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const video = result.assets[0];

        // Generate thumbnail from video
        let thumbnailUri = video.uri;
        try {
          const thumbnail = await VideoThumbnails.getThumbnailAsync(video.uri, {
            time: 1000, // 1 second into the video
          });
          thumbnailUri = thumbnail.uri;
        } catch (thumbError) {
          // Sentry captures this automatically
        }

        setVideoData({
          title: '',
          thumbnail_url: thumbnailUri,
          video_id: `local_${Date.now()}`,
          local_uri: video.uri,
        });
        setUploadMethod('library');
      }
    } catch (error) {
      // Sentry captures this automatically
      Alert.alert('Error', 'Failed to pick video from library');
    }
  };

  // Upload video to Supabase Storage
  const uploadVideoToStorage = async (localUri: string, userId: string): Promise<{ videoUrl: string; thumbnailUrl: string } | null> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Generate unique filename
      const timestamp = Date.now();
      const videoFileName = `${userId}/${timestamp}_video.mp4`;
      const thumbnailFileName = `${userId}/${timestamp}_thumb.jpg`;

      // Read video file as base64
      setUploadProgress(10);
      const videoBase64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setUploadProgress(30);

      // Upload video to Supabase Storage
      const { data: videoData, error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoFileName, decode(videoBase64), {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (videoError) {
        throw new Error('Failed to upload video');
      }

      setUploadProgress(70);

      // Get public URL for video
      const { data: videoUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(videoFileName);

      // Generate and upload thumbnail
      let thumbnailUrl = '';
      try {
        const thumbnail = await VideoThumbnails.getThumbnailAsync(localUri, {
          time: 1000,
        });

        const thumbBase64 = await FileSystem.readAsStringAsync(thumbnail.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: thumbError } = await supabase.storage
          .from('videos')
          .upload(thumbnailFileName, decode(thumbBase64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!thumbError) {
          const { data: thumbUrlData } = supabase.storage
            .from('videos')
            .getPublicUrl(thumbnailFileName);
          thumbnailUrl = thumbUrlData.publicUrl;
        }
      } catch (thumbError) {
        // Sentry captures this automatically
      }

      setUploadProgress(100);

      return {
        videoUrl: videoUrlData.publicUrl,
        thumbnailUrl: thumbnailUrl || videoUrlData.publicUrl,
      };
    } catch (error) {
      // Sentry captures this automatically
      return null;
    } finally {
      setUploading(false);
    }
  };

  const toggleTheme = (theme: string) => {
    setSelectedThemes(prev =>
      prev.includes(theme)
        ? prev.filter(t => t !== theme)
        : prev.length < 5
          ? [...prev, theme]
          : prev
    );
  };

  const addCustomTheme = () => {
    const trimmed = customTheme.trim();
    if (trimmed && !selectedThemes.includes(trimmed) && selectedThemes.length < 5) {
      setSelectedThemes(prev => [...prev, trimmed]);
      setCustomTheme('');
    }
  };

  const removeTheme = (theme: string) => {
    setSelectedThemes(prev => prev.filter(t => t !== theme));
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to share your set');
      return;
    }

    if (!videoData?.video_id) {
      Alert.alert('Missing Video', 'Please enter a valid YouTube URL or select a video');
      return;
    }

    if (!customTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your video');
      return;
    }

    setLoading(true);
    try {
      const insertData: any = {
        user_id: user.id,
        title: customTitle.trim(),
        venue_name: venueName.trim() || null,
        performance_date: performanceDate?.toISOString().split('T')[0] || null,
        status: 'approved',
        category: categoryTag,
        themes: selectedThemes,
      };

      // Add YouTube-specific fields if uploading from YouTube
      if (uploadMethod === 'youtube') {
        insertData.youtube_url = youtubeUrl;
        insertData.youtube_video_id = videoData.video_id;
        insertData.thumbnail_url = videoData.thumbnail_url;
      } else if (uploadMethod === 'library' && videoData.local_uri) {
        // Upload video to Supabase Storage
        const uploadResult = await uploadVideoToStorage(videoData.local_uri, user.id);

        if (!uploadResult) {
          Alert.alert('Upload Failed', 'Failed to upload video. Please try again.');
          setLoading(false);
          return;
        }

        // Store the cloud URLs
        insertData.storage_video_url = uploadResult.videoUrl;
        insertData.thumbnail_url = uploadResult.thumbnailUrl;
        insertData.youtube_video_id = null; // No YouTube ID for library uploads
      }

      const { error } = await supabase.from('community_videos').insert(insertData);

      if (error) throw error;

      setShowSuccess(true);
    } catch (error: any) {
      // Sentry captures this automatically
      Alert.alert('Error', error.message || 'Failed to share your set. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessDismiss = () => {
    setShowSuccess(false);
    navigation.goBack();
  };

  const clearForm = () => {
    setUploadMethod(null);
    setYoutubeUrl('');
    setVideoData(null);
    setCustomTitle('');
    setVenueName('');
    setPerformanceDate(null);
    setCategoryTag('community_sets');
    setSelectedThemes([]);
    setCustomTheme('');
  };

  // Generate date options for picker (past 2 years)
  const generateDateOptions = () => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 730; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    return dates;
  };

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
        <Text style={styles.headerTitle}>Share Your Set</Text>
        <TouchableOpacity onPress={clearForm}>
          <Text style={styles.clearButton}>Clear</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Upload Method Selection */}
          {!uploadMethod && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Upload Method</Text>
              <View style={styles.uploadMethodContainer}>
                <TouchableOpacity
                  style={styles.uploadMethodCard}
                  onPress={() => setUploadMethod('youtube')}
                  activeOpacity={0.7}
                >
                  <View style={styles.uploadMethodIconContainer}>
                    <Ionicons name="logo-youtube" size={40} color="#FF0000" />
                  </View>
                  <Text style={styles.uploadMethodTitle}>YouTube Link</Text>
                  <Text style={styles.uploadMethodDescription}>
                    Paste a link to your YouTube video
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.uploadMethodCard}
                  onPress={handlePickFromLibrary}
                  activeOpacity={0.7}
                >
                  <View style={styles.uploadMethodIconContainer}>
                    <Ionicons name="folder-open" size={40} color={colors.primary} />
                  </View>
                  <Text style={styles.uploadMethodTitle}>From Library</Text>
                  <Text style={styles.uploadMethodDescription}>
                    Upload from your device
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* YouTube URL Input */}
          {uploadMethod === 'youtube' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>YouTube Video</Text>
                <TouchableOpacity onPress={() => { setUploadMethod(null); setVideoData(null); setYoutubeUrl(''); }}>
                  <Text style={styles.changeMethodText}>Change</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.card}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Paste YouTube URL *</Text>
                  <View style={styles.urlInputContainer}>
                    <Ionicons name="logo-youtube" size={24} color="#FF0000" style={styles.youtubeIcon} />
                    <TextInput
                      style={styles.urlInput}
                      placeholder="https://youtube.com/watch?v=..."
                      placeholderTextColor={colors.textMuted}
                      value={youtubeUrl}
                      onChangeText={handleUrlChange}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    {fetching && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </View>
                </View>

                {/* Video Preview */}
                {videoData && (
                  <View style={styles.preview}>
                    <Image
                      source={{ uri: videoData.thumbnail_url }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                    <View style={styles.playOverlay}>
                      <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Library Video Preview */}
          {uploadMethod === 'library' && videoData && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Selected Video</Text>
                <TouchableOpacity onPress={() => { setUploadMethod(null); setVideoData(null); }}>
                  <Text style={styles.changeMethodText}>Change</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.card}>
                <View style={styles.preview}>
                  <Image
                    source={{ uri: videoData.thumbnail_url }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.libraryBadge}>
                    <Ionicons name="folder" size={16} color="#fff" />
                    <Text style={styles.libraryBadgeText}>From Library</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Video Details */}
          {videoData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Video Details</Text>
              <View style={styles.card}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Name your set"
                    placeholderTextColor={colors.textMuted}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                    maxLength={100}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Venue (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., The Comedy Store"
                    placeholderTextColor={colors.textMuted}
                    value={venueName}
                    onChangeText={setVenueName}
                    maxLength={100}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Performance Date (optional)</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                    <Text style={[styles.dateText, !performanceDate && styles.datePlaceholder]}>
                      {performanceDate ? formatDateForPicker(performanceDate) : 'Select date'}
                    </Text>
                    {performanceDate && (
                      <TouchableOpacity onPress={() => setPerformanceDate(null)}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Category Tags */}
          {videoData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.card}>
                {CATEGORY_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.categoryOption,
                      categoryTag === tag.id && styles.categoryOptionActive,
                    ]}
                    onPress={() => setCategoryTag(tag.id as CategoryTag)}
                  >
                    <Text style={styles.categoryIcon}>{tag.icon}</Text>
                    <View style={styles.categoryInfo}>
                      <Text style={[
                        styles.categoryLabel,
                        categoryTag === tag.id && styles.categoryLabelActive,
                      ]}>
                        {tag.label}
                      </Text>
                      <Text style={styles.categoryDescription}>{tag.description}</Text>
                    </View>
                    {categoryTag === tag.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Theme Tags */}
          {videoData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Themes (Select up to 5)</Text>
              <View style={styles.card}>
                {/* Selected themes */}
                {selectedThemes.length > 0 && (
                  <View style={styles.selectedThemesContainer}>
                    {selectedThemes.map((theme) => (
                      <TouchableOpacity
                        key={theme}
                        style={styles.selectedThemeChip}
                        onPress={() => removeTheme(theme)}
                      >
                        <Text style={styles.selectedThemeText}>{theme}</Text>
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Theme options */}
                <View style={styles.themeGrid}>
                  {THEME_TAGS.map((theme) => (
                    <TouchableOpacity
                      key={theme}
                      style={[
                        styles.themeChip,
                        selectedThemes.includes(theme) && styles.themeChipActive,
                      ]}
                      onPress={() => toggleTheme(theme)}
                      disabled={selectedThemes.length >= 5 && !selectedThemes.includes(theme)}
                    >
                      <Text style={[
                        styles.themeChipText,
                        selectedThemes.includes(theme) && styles.themeChipTextActive,
                        selectedThemes.length >= 5 && !selectedThemes.includes(theme) && styles.themeChipTextDisabled,
                      ]}>
                        {theme}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom theme input */}
                <View style={styles.customThemeContainer}>
                  <TextInput
                    style={styles.customThemeInput}
                    placeholder="Add custom theme..."
                    placeholderTextColor={colors.textMuted}
                    value={customTheme}
                    onChangeText={setCustomTheme}
                    onSubmitEditing={addCustomTheme}
                    maxLength={30}
                    editable={selectedThemes.length < 5}
                  />
                  <TouchableOpacity
                    style={[
                      styles.addThemeButton,
                      (!customTheme.trim() || selectedThemes.length >= 5) && styles.addThemeButtonDisabled,
                    ]}
                    onPress={addCustomTheme}
                    disabled={!customTheme.trim() || selectedThemes.length >= 5}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Preview Card */}
          {videoData && customTitle && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preview</Text>
              <View style={styles.previewCard}>
                <Image
                  source={{ uri: videoData.thumbnail_url }}
                  style={styles.previewThumbnail}
                  resizeMode="cover"
                />
                <View style={styles.previewInfo}>
                  {/* Category Badge */}
                  <View style={styles.previewCategoryBadge}>
                    <Text style={styles.previewCategoryText}>
                      {CATEGORY_TAGS.find(t => t.id === categoryTag)?.icon}{' '}
                      {CATEGORY_TAGS.find(t => t.id === categoryTag)?.label}
                    </Text>
                  </View>
                  <Text style={styles.previewTitle} numberOfLines={2}>
                    {customTitle}
                  </Text>
                  {venueName && (
                    <Text style={styles.previewVenue}>
                      📍 {venueName}
                    </Text>
                  )}
                  {performanceDate && (
                    <Text style={styles.previewDate}>
                      📅 {formatDateForPicker(performanceDate)}
                    </Text>
                  )}
                  {/* Theme Tags */}
                  {selectedThemes.length > 0 && (
                    <View style={styles.previewThemes}>
                      {selectedThemes.map((theme) => (
                        <View key={theme} style={styles.previewThemeChip}>
                          <Text style={styles.previewThemeText}>{theme}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Upload Progress */}
          {uploading && (
            <View style={styles.uploadProgressContainer}>
              <View style={styles.uploadProgressBar}>
                <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={styles.uploadProgressText}>
                Uploading video... {uploadProgress}%
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!videoData || !customTitle.trim() || loading || uploading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!videoData || !customTitle.trim() || loading || uploading}
          >
            {loading || uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Share with Community</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Performance Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {generateDateOptions().map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.pickerItem,
                    performanceDate?.toDateString() === date.toDateString() && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setPerformanceDate(date);
                    setShowDatePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      performanceDate?.toDateString() === date.toDateString() && styles.pickerItemTextActive,
                    ]}
                  >
                    {formatDateForPicker(date)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Set Shared!</Text>
            <Text style={styles.successMessage}>
              Your set has been shared with the U Funny community!
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleSuccessDismiss}
            >
              <Text style={styles.successButtonText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  clearButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
  },
  changeMethodText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  // Upload method selection
  uploadMethodContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadMethodCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  uploadMethodIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadMethodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 4,
  },
  uploadMethodDescription: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  libraryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  libraryBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
  },
  youtubeIcon: {
    marginRight: 8,
  },
  urlInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textDark,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    marginLeft: 8,
  },
  datePlaceholder: {
    color: colors.textMuted,
  },
  preview: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  previewCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  previewThumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  previewInfo: {
    padding: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 4,
  },
  previewVenue: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  previewDate: {
    fontSize: 14,
    color: colors.textMuted,
  },
  previewCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  previewCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  previewThemes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  previewThemeChip: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  previewThemeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  // Category Tags
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryOptionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(107, 142, 111, 0.08)',
  },
  categoryIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 2,
  },
  categoryLabelActive: {
    color: colors.primary,
  },
  categoryDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  // Theme Tags
  selectedThemesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  selectedThemeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  selectedThemeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  themeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  themeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeChipText: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: '500',
  },
  themeChipTextActive: {
    color: '#fff',
  },
  themeChipTextDisabled: {
    color: colors.cardBorder,
  },
  customThemeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customThemeInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  addThemeButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addThemeButtonDisabled: {
    backgroundColor: colors.cardBorder,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  pickerList: {
    padding: 16,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.textDark,
  },
  pickerItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Success modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModal: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 32,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Upload progress
  uploadProgressContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  uploadProgressBar: {
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  uploadProgressText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
