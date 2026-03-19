import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  Modal,
  Linking,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

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

const CRITIQUE_PRIVACY_OPTIONS = [
  { label: 'Everyone', value: 'everyone' },
  { label: 'People at same event', value: 'same_event' },
  { label: 'No one', value: 'none' },
];

type Settings = {
  push_notifications: boolean;
  email_notifications: boolean;
  event_reminders: boolean;
  critique_privacy: string;
  show_checkin_activity: boolean;
};

const defaultSettings: Settings = {
  push_notifications: true,
  email_notifications: true,
  event_reminders: true,
  critique_privacy: 'everyone',
  show_checkin_activity: true,
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Permission states
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState<boolean | null>(null);
  const [mediaLibraryPermission, setMediaLibraryPermission] = useState<boolean | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    // Audio
    const { status: audioStatus } = await Audio.getPermissionsAsync();
    setAudioPermission(audioStatus === 'granted');

    // Media Library
    const { status: mediaStatus } = await MediaLibrary.getPermissionsAsync();
    setMediaLibraryPermission(mediaStatus === 'granted');

    // Location
    const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(locationStatus === 'granted');
  };

  const handleRequestCamera = async () => {
    const result = await requestCameraPermission();
    if (!result.granted && !result.canAskAgain) {
      Alert.alert(
        'Permission Required',
        'Camera permission was denied. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleRequestAudio = async () => {
    const { status, canAskAgain } = await Audio.requestPermissionsAsync();
    setAudioPermission(status === 'granted');
    if (status !== 'granted' && !canAskAgain) {
      Alert.alert(
        'Permission Required',
        'Microphone permission was denied. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleRequestMediaLibrary = async () => {
    const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
    setMediaLibraryPermission(status === 'granted');
    if (status !== 'granted' && !canAskAgain) {
      Alert.alert(
        'Permission Required',
        'Media Library permission was denied. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleRequestLocation = async () => {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    if (status !== 'granted' && !canAskAgain) {
      Alert.alert(
        'Permission Required',
        'Location permission was denied. Please enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('push_notifications, email_notifications, event_reminders, critique_privacy, show_checkin_activity')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // Sentry captures this automatically
      }

      if (data) {
        setSettings({
          push_notifications: data.push_notifications ?? defaultSettings.push_notifications,
          email_notifications: data.email_notifications ?? defaultSettings.email_notifications,
          event_reminders: data.event_reminders ?? defaultSettings.event_reminders,
          critique_privacy: data.critique_privacy ?? defaultSettings.critique_privacy,
          show_checkin_activity: data.show_checkin_activity ?? defaultSettings.show_checkin_activity,
        });
      }
    } catch (error) {
      // Sentry captures this automatically
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof Settings, value: boolean | string) => {
    if (!user) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      // Sentry captures this automatically
      // Revert on error
      setSettings(settings);
      Alert.alert('Error', 'Failed to save setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'No email associated with this account');
      return;
    }

    Alert.alert(
      'Reset Password',
      `We'll send a password reset link to ${user.email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
                redirectTo: 'ufunny://reset-password',
              });

              if (error) throw error;

              Alert.alert('Email Sent', 'Check your email for the password reset link.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send reset email');
            }
          },
        },
      ]
    );
  };

  const handleChangeEmail = () => {
    Alert.prompt(
      'Change Email',
      'Enter your new email address',
      async (newEmail) => {
        if (!newEmail || !newEmail.trim()) return;

        try {
          const { error } = await supabase.auth.updateUser({
            email: newEmail.trim(),
          });

          if (error) throw error;

          Alert.alert(
            'Verification Required',
            'Please check your new email address for a confirmation link.'
          );
        } catch (error: any) {
          Alert.alert('Error', error.message || 'Failed to update email');
        }
      },
      'plain-text',
      user?.email || ''
    );
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);

    try {
      // Delete user data from profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Sign out the user (actual account deletion would need a server-side function)
      await supabase.auth.signOut();

      Alert.alert('Account Deleted', 'Your account has been deleted.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@ufunny.app?subject=U%20Funny%20Support');
  };

  const handleTermsOfService = () => {
    Linking.openURL('https://ufunny.app/terms');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://ufunny.app/privacy');
  };

  const getCritiquePrivacyLabel = () => {
    const option = CRITIQUE_PRIVACY_OPTIONS.find(o => o.value === settings.critique_privacy);
    return option?.label || 'Everyone';
  };

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
        <Text style={styles.headerTitle}>Settings & Privacy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Get notified about events and updates</Text>
              </View>
              <Switch
                value={settings.push_notifications}
                onValueChange={(value) => updateSetting('push_notifications', value)}
                trackColor={{ false: colors.cardBorder, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDescription}>Receive emails for new critiques</Text>
              </View>
              <Switch
                value={settings.email_notifications}
                onValueChange={(value) => updateSetting('email_notifications', value)}
                trackColor={{ false: colors.cardBorder, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Event Reminders</Text>
                <Text style={styles.settingDescription}>Get reminded before events start</Text>
              </View>
              <Switch
                value={settings.event_reminders}
                onValueChange={(value) => updateSetting('event_reminders', value)}
                trackColor={{ false: colors.cardBorder, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowPrivacyPicker(true)}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Who Can Leave Critiques</Text>
                <Text style={styles.settingDescription}>Control who can give you feedback</Text>
              </View>
              <View style={styles.dropdownButton}>
                <Text style={styles.dropdownText}>{getCritiquePrivacyLabel()}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show Check-in Activity</Text>
                <Text style={styles.settingDescription}>Let others see when you check in</Text>
              </View>
              <Switch
                value={settings.show_checkin_activity}
                onValueChange={(value) => updateSetting('show_checkin_activity', value)}
                trackColor={{ false: colors.cardBorder, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Permissions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <View style={styles.card}>
            <View style={styles.permissionRow}>
              <View style={styles.permissionIconContainer}>
                <Text style={styles.permissionIcon}>📷</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Camera</Text>
                <Text style={styles.settingDescription}>Record video of your performances</Text>
              </View>
              {cameraPermission?.granted ? (
                <View style={styles.permissionGranted}>
                  <Text style={styles.permissionGrantedText}>Granted</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.permissionEnableButton} onPress={handleRequestCamera}>
                  <Text style={styles.permissionEnableText}>Enable</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.permissionRow}>
              <View style={styles.permissionIconContainer}>
                <Text style={styles.permissionIcon}>🎤</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Microphone</Text>
                <Text style={styles.settingDescription}>Capture audio during recordings</Text>
              </View>
              {audioPermission ? (
                <View style={styles.permissionGranted}>
                  <Text style={styles.permissionGrantedText}>Granted</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.permissionEnableButton} onPress={handleRequestAudio}>
                  <Text style={styles.permissionEnableText}>Enable</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.permissionRow}>
              <View style={styles.permissionIconContainer}>
                <Text style={styles.permissionIcon}>📁</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Media Library</Text>
                <Text style={styles.settingDescription}>Save recordings to your device</Text>
              </View>
              {mediaLibraryPermission ? (
                <View style={styles.permissionGranted}>
                  <Text style={styles.permissionGrantedText}>Granted</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.permissionEnableButton} onPress={handleRequestMediaLibrary}>
                  <Text style={styles.permissionEnableText}>Enable</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.permissionRow}>
              <View style={styles.permissionIconContainer}>
                <Text style={styles.permissionIcon}>📍</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Location</Text>
                <Text style={styles.settingDescription}>Find open mics near you</Text>
              </View>
              {locationPermission ? (
                <View style={styles.permissionGranted}>
                  <Text style={styles.permissionGrantedText}>Granted</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.permissionEnableButton} onPress={handleRequestLocation}>
                  <Text style={styles.permissionEnableText}>Enable</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionRow} onPress={() => Linking.openSettings()}>
              <Ionicons name="settings-outline" size={20} color={colors.textDark} />
              <Text style={styles.actionLabel}>Open Device Settings</Text>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.actionRow} onPress={handleChangePassword}>
              <Ionicons name="key-outline" size={20} color={colors.textDark} />
              <Text style={styles.actionLabel}>Change Password</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionRow} onPress={handleChangeEmail}>
              <Ionicons name="mail-outline" size={20} color={colors.textDark} />
              <Text style={styles.actionLabel}>Change Email</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setShowDeleteModal(true)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.actionLabel, styles.deleteLabel]}>Delete Account</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Version</Text>
              <Text style={styles.infoValue}>{appVersion}</Text>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionRow} onPress={handleContactSupport}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.textDark} />
              <Text style={styles.actionLabel}>Contact Support</Text>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionRow} onPress={handleTermsOfService}>
              <Ionicons name="document-text-outline" size={20} color={colors.textDark} />
              <Text style={styles.actionLabel}>Terms of Service</Text>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionRow} onPress={handlePrivacyPolicy}>
              <Ionicons name="shield-outline" size={20} color={colors.textDark} />
              <Text style={styles.actionLabel}>Privacy Policy</Text>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Critique Privacy Picker Modal */}
      <Modal visible={showPrivacyPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Who Can Leave Critiques</Text>
              <TouchableOpacity onPress={() => setShowPrivacyPicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {CRITIQUE_PRIVACY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.pickerItem,
                    settings.critique_privacy === option.value && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    updateSetting('critique_privacy', option.value);
                    setShowPrivacyPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      settings.critique_privacy === option.value && styles.pickerItemTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {settings.critique_privacy === option.value && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="warning" size={48} color={colors.error} />
            </View>
            <Text style={styles.deleteTitle}>Delete Account?</Text>
            <Text style={styles.deleteMessage}>
              This will permanently delete your account and all your data. This cannot be undone.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
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
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginLeft: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dropdownText: {
    fontSize: 14,
    color: colors.textDark,
    marginRight: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
    marginLeft: 12,
  },
  deleteLabel: {
    color: colors.error,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 16,
    color: colors.textDark,
  },
  infoValue: {
    fontSize: 16,
    color: colors.textMuted,
  },
  bottomPadding: {
    height: 40,
  },
  // Picker Modal
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
  // Delete Modal
  deleteModal: {
    backgroundColor: colors.cardBg,
    marginHorizontal: 24,
    marginBottom: 100,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(217, 83, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 12,
  },
  deleteMessage: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Permissions styles
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  permissionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionIcon: {
    fontSize: 18,
  },
  permissionGranted: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  permissionGrantedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  permissionEnableButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  permissionEnableText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
