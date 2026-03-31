import { useState, useEffect } from 'react';
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
  StatusBar,
  Modal,
} from 'react-native';
import { supabase } from '../services/supabase';

// ImagePicker: native on mobile, file input on web
let ImagePicker: any = null;
if (Platform.OS !== 'web') {
  ImagePicker = require('expo-image-picker');
}
import { containsOffensiveContent } from '../services/moderationService';
import { uploadImage } from '../services/imageUpload';
import { useTheme } from '../contexts/ThemeContext';

// Design colors matching the app
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

// Mapping: display label -> database value (integer)
const EXPERIENCE_OPTIONS = [
  { label: 'Less than 1 year', value: 0 },
  { label: '1-2 years', value: 1 },
  { label: '3-5 years', value: 3 },
  { label: '5+ years', value: 5 },
];

// Helper to convert database number to display value
const experienceNumToDisplay = (num: number | null): number | null => {
  if (num === null || num === undefined) return null;
  // Find the closest match
  const option = EXPERIENCE_OPTIONS.find(opt => opt.value === num);
  return option ? option.value : null;
};

// Helper to get label from value
const getExperienceLabelFromValue = (value: number | null): string => {
  if (value === null || value === undefined) return 'Select experience level';
  const option = EXPERIENCE_OPTIONS.find(opt => opt.value === value);
  return option?.label || 'Select experience level';
};

const MAX_BIO_LENGTH = 200;

type ProfileData = {
  display_name: string;
  stage_name: string;
  bio: string;
  years_experience: number | null;
  home_city: string;
  instagram_handle: string;
  tiktok_handle: string;
  avatar_url: string;
};

export default function EditProfileScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showExperiencePicker, setShowExperiencePicker] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData>({
    display_name: '',
    stage_name: '',
    bio: '',
    years_experience: null,
    home_city: '',
    instagram_handle: '',
    tiktok_handle: '',
    avatar_url: '',
  });

  const [originalProfile, setOriginalProfile] = useState<ProfileData | null>(null);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to edit your profile');
        navigation.goBack();
        return;
      }

      setUserId(user.id);

      // Fetch profile data
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const profileData: ProfileData = {
          display_name: data.display_name || '',
          stage_name: data.stage_name || '',
          bio: data.bio || '',
          years_experience: experienceNumToDisplay(data.years_experience),
          home_city: data.home_city || '',
          instagram_handle: data.instagram_handle || '',
          tiktok_handle: data.tiktok_handle || '',
          avatar_url: data.avatar_url || '',
        };
        setProfile(profileData);
        setOriginalProfile(profileData);
      }
    } catch (error: any) {
      // Sentry captures this automatically
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  // Web: trigger a hidden file input for image selection
  const handleWebFilePick = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file || !userId) return;
      setIsUploadingImage(true);
      try {
        const uri = URL.createObjectURL(file);
        const { publicUrl, error } = await uploadImage(uri, 'avatars', userId);
        if (error) {
          Alert.alert('Upload Failed', error);
        } else if (publicUrl) {
          setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
        }
      } catch {
        Alert.alert('Error', 'Failed to upload image');
      } finally {
        setIsUploadingImage(false);
      }
    };
    input.click();
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'web') {
      handleWebFilePick();
      return;
    }
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to change your profile picture'
        );
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const selectedImage = result.assets[0];
      setIsUploadingImage(true);

      // Upload to Supabase Storage
      if (!userId) {
        Alert.alert('Error', 'User not found');
        return;
      }

      const { publicUrl, error } = await uploadImage(
        selectedImage.uri,
        'avatars',
        userId
      );

      if (error) {
        Alert.alert('Upload Failed', error);
        return;
      }

      if (publicUrl) {
        setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to select image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      // Web: fall back to file picker (no native camera access)
      handleWebFilePick();
      return;
    }
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow camera access to take a profile photo'
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const selectedImage = result.assets[0];
      setIsUploadingImage(true);

      if (!userId) {
        Alert.alert('Error', 'User not found');
        return;
      }

      const { publicUrl, error } = await uploadImage(
        selectedImage.uri,
        'avatars',
        userId
      );

      if (error) {
        Alert.alert('Upload Failed', error);
        return;
      }

      if (publicUrl) {
        setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      }
    } catch (error: any) {
      // Sentry captures this automatically
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const validateForm = (): boolean => {
    if (!profile.display_name.trim()) {
      Alert.alert('Required Field', 'Please enter your display name');
      return false;
    }
    return true;
  };

  const hasChanges = (): boolean => {
    if (!originalProfile) return true;
    return JSON.stringify(profile) !== JSON.stringify(originalProfile);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    if (!hasChanges()) {
      navigation.goBack();
      return;
    }

    setIsSaving(true);
    try {
      if (!userId) {
        Alert.alert('Error', 'User not found');
        return;
      }

      const textToCheck = [profile.display_name, profile.stage_name, profile.bio].filter(Boolean).join(' ');
      if (containsOffensiveContent(textToCheck)) {
        Alert.alert('Content Not Allowed', 'Your profile contains language that violates our Community Guidelines. Please revise and try again.');
        setIsSaving(false);
        return;
      }

      // Clean up social handles (remove @ if present)
      const cleanInstagram = profile.instagram_handle.replace(/^@/, '').trim();
      const cleanTikTok = profile.tiktok_handle.replace(/^@/, '').trim();

      const updates = {
        id: userId,
        display_name: profile.display_name.trim(),
        stage_name: profile.stage_name.trim(),
        bio: profile.bio.trim(),
        years_experience: profile.years_experience,
        home_city: profile.home_city.trim(),
        instagram_handle: cleanInstagram,
        tiktok_handle: cleanTikTok,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;

      Alert.alert(
        'Profile Updated',
        'Your profile has been saved successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      // Sentry captures this automatically
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };


  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textDark }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.saveButton}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Photo */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={showImageOptions}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <View style={styles.photoPlaceholder}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={styles.photo}
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>
                    {(profile.display_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.photoEditBadge}>
                <Text style={styles.photoEditIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Tap to change photo</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {/* Display Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textDark }]}>Display Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="How you want to be known"
                placeholderTextColor={colors.textMuted}
                value={profile.display_name}
                onChangeText={(text) => setProfile(prev => ({ ...prev, display_name: text }))}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            {/* Stage Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Stage Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your performer name (optional)"
                placeholderTextColor={colors.textMuted}
                value={profile.stage_name}
                onChangeText={(text) => setProfile(prev => ({ ...prev, stage_name: text }))}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Bio</Text>
                <Text style={[
                  styles.charCount,
                  profile.bio.length >= MAX_BIO_LENGTH && styles.charCountMax
                ]}>
                  {profile.bio.length}/{MAX_BIO_LENGTH}
                </Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us about yourself and your comedy style..."
                placeholderTextColor={colors.textMuted}
                value={profile.bio}
                onChangeText={(text) => {
                  if (text.length <= MAX_BIO_LENGTH) {
                    setProfile(prev => ({ ...prev, bio: text }));
                  }
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={MAX_BIO_LENGTH}
              />
            </View>

            {/* Years of Experience */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Years of Experience</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowExperiencePicker(true)}
              >
                <Text style={[
                  styles.selectText,
                  profile.years_experience === null && styles.selectPlaceholder
                ]}>
                  {getExperienceLabelFromValue(profile.years_experience)}
                </Text>
                <Text style={styles.selectArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Home City */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Home City</Text>
              <TextInput
                style={styles.input}
                placeholder="Where you're based"
                placeholderTextColor={colors.textMuted}
                value={profile.home_city}
                onChangeText={(text) => setProfile(prev => ({ ...prev, home_city: text }))}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            {/* Social Links Section */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textDark }]}>Social Links</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>Optional - help fans find you</Text>
            </View>

            {/* Instagram */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instagram</Text>
              <View style={styles.socialInputContainer}>
                <Text style={styles.socialPrefix}>@</Text>
                <TextInput
                  style={styles.socialInput}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  value={profile.instagram_handle}
                  onChangeText={(text) => setProfile(prev => ({
                    ...prev,
                    instagram_handle: text.replace(/^@/, '')
                  }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
              </View>
            </View>

            {/* TikTok */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TikTok</Text>
              <View style={styles.socialInputContainer}>
                <Text style={styles.socialPrefix}>@</Text>
                <TextInput
                  style={styles.socialInput}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  value={profile.tiktok_handle}
                  onChangeText={(text) => setProfile(prev => ({
                    ...prev,
                    tiktok_handle: text.replace(/^@/, '')
                  }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
              </View>
            </View>
          </View>

          {/* Save Button (bottom) */}
          <TouchableOpacity
            style={[styles.saveButtonBottom, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonBottomText}>Save Profile</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Experience Picker Modal */}
      <Modal visible={showExperiencePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Years of Experience</Text>
              <TouchableOpacity onPress={() => setShowExperiencePicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {EXPERIENCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value.toString()}
                  style={[
                    styles.pickerItem,
                    profile.years_experience === option.value && styles.pickerItemActive
                  ]}
                  onPress={() => {
                    setProfile(prev => ({ ...prev, years_experience: option.value }));
                    setShowExperiencePicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    profile.years_experience === option.value && styles.pickerItemTextActive
                  ]}>
                    {option.label}
                  </Text>
                  {profile.years_experience === option.value && (
                    <Text style={styles.pickerCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  cancelButton: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  saveButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.cardBorder,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  photoEditIcon: {
    fontSize: 16,
  },
  photoHint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  charCountMax: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  selectButton: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    color: colors.textDark,
  },
  selectPlaceholder: {
    color: colors.textMuted,
  },
  selectArrow: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  socialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  socialPrefix: {
    paddingLeft: 16,
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  socialInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textDark,
  },
  saveButtonBottom: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonBottomText: {
    fontSize: 16,
    fontWeight: 'bold',
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
    maxHeight: '50%',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.textDark,
  },
  pickerItemTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  pickerCheck: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: 'bold',
  },
});
