import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';

// Clipboard: web uses navigator.clipboard, native uses expo-clipboard
const Clipboard = {
  setStringAsync: async (text: string) => {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
    } else {
      const ExpoClipboard = require('expo-clipboard');
      await ExpoClipboard.setStringAsync(text);
    }
  },
};

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
};

type Props = {
  videoTitle: string;
  creatorName: string;
  videoId?: string | null;
  videoUri?: string | null;
  clipId?: string;
  size?: 'small' | 'normal';
};

export default function ShareClipButton({
  videoTitle,
  creatorName,
  videoId,
  videoUri,
  clipId,
  size = 'normal',
}: Props) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Build the share message with U Funny branding
  const getShareMessage = (platform?: string) => {
    const watermark = '🎤 Watch the full set on U Funny App';
    const hashtags = '#UFunny #StandUpComedy #Comedy #OpenMic';

    let deepLink = 'https://ufunny.app';
    if (clipId) {
      deepLink = `https://ufunny.app/clip/${clipId}`;
    }

    if (platform === 'tiktok' || platform === 'instagram') {
      return `"${videoTitle}" by ${creatorName}\n\n${watermark}\n${hashtags}\n\n${deepLink}`;
    }

    return `Check out "${videoTitle}" by ${creatorName} on U Funny! 🎭\n\n${watermark}\n${deepLink}`;
  };

  const handleNativeShare = async () => {
    setShowShareMenu(false);
    setSharing(true);
    try {
      await Share.share({
        message: getShareMessage(),
        title: `${videoTitle} - U Funny`,
      });
    } catch {
      // User cancelled
    }
    setSharing(false);
  };

  const handleCopyForSocial = async (platform: string) => {
    setShowShareMenu(false);
    const message = getShareMessage(platform);
    await Clipboard.setStringAsync(message);
    Alert.alert(
      'Copied!',
      `Caption copied to clipboard. Open ${platform === 'tiktok' ? 'TikTok' : platform === 'instagram' ? 'Instagram' : platform} and paste it as your caption.`,
      [{ text: 'Got it' }]
    );
  };

  const handleCopyLink = async () => {
    setShowShareMenu(false);
    let link = 'https://ufunny.app';
    if (clipId) link = `https://ufunny.app/clip/${clipId}`;
    await Clipboard.setStringAsync(link);
    Alert.alert('Link Copied!', 'Share it anywhere you like.');
  };

  const isSmall = size === 'small';

  return (
    <>
      <TouchableOpacity
        style={[styles.button, isSmall && styles.buttonSmall]}
        onPress={() => setShowShareMenu(true)}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Text style={[styles.emoji, isSmall && styles.emojiSmall]}>↗️</Text>
            <Text style={[styles.label, isSmall && styles.labelSmall]}>Share</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal visible={showShareMenu} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareMenu(false)}
        >
          <View style={styles.shareSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Share This Clip</Text>
            <Text style={styles.sheetSubtitle}>
              Share to social media with U Funny branding
            </Text>

            <View style={styles.shareOptions}>
              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handleCopyForSocial('tiktok')}
              >
                <View style={[styles.shareIcon, { backgroundColor: '#000' }]}>
                  <Text style={styles.shareIconText}>🎵</Text>
                </View>
                <Text style={styles.shareOptionText}>TikTok</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={() => handleCopyForSocial('instagram')}
              >
                <View style={[styles.shareIcon, { backgroundColor: '#E1306C' }]}>
                  <Text style={styles.shareIconText}>📸</Text>
                </View>
                <Text style={styles.shareOptionText}>Instagram</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={handleCopyLink}
              >
                <View style={[styles.shareIcon, { backgroundColor: colors.primary }]}>
                  <Text style={styles.shareIconText}>🔗</Text>
                </View>
                <Text style={styles.shareOptionText}>Copy Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareOption}
                onPress={handleNativeShare}
              >
                <View style={[styles.shareIcon, { backgroundColor: colors.accent }]}>
                  <Text style={styles.shareIconText}>↗️</Text>
                </View>
                <Text style={styles.shareOptionText}>More</Text>
              </TouchableOpacity>
            </View>

            {/* Preview of what gets shared */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Preview:</Text>
              <Text style={styles.previewText}>
                "{videoTitle}" by {creatorName}{'\n'}
                🎤 Watch the full set on U Funny App{'\n'}
                #UFunny #StandUpComedy #Comedy #OpenMic
              </Text>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowShareMenu(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  buttonSmall: {
    gap: 2,
  },
  emoji: {
    fontSize: 20,
  },
  emojiSmall: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  labelSmall: {
    fontSize: 11,
  },
  // Share sheet modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shareSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  shareOption: {
    alignItems: 'center',
    gap: 8,
  },
  shareIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIconText: {
    fontSize: 24,
  },
  shareOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  previewBox: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewText: {
    fontSize: 13,
    color: colors.textDark,
    lineHeight: 20,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
