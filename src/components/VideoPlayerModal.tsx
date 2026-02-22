import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const colors = {
  background: '#000',
  cardBg: '#1a1a1a',
  primary: '#6b8e6f',
  textLight: '#fff',
  textMuted: '#999',
};

type VideoPlayerModalProps = {
  visible: boolean;
  videoId: string | null;
  videoUri?: string | null; // For local/library videos
  title?: string;
  creatorName?: string;
  onClose: () => void;
};

export default function VideoPlayerModal({
  visible,
  videoId,
  videoUri,
  title,
  creatorName,
  onClose,
}: VideoPlayerModalProps) {
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<Video>(null);

  // Determine if this is a non-YouTube video (local or storage) or YouTube
  const isStorageOrLocalVideo = videoUri && (videoUri.startsWith('file://') || videoUri.startsWith('ph://') || videoUri.startsWith('https://'));
  const isYouTubeVideo = videoId && !videoId.startsWith('local_');

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setPlaying(false);
    }
  }, []);

  const handleReady = () => {
    setLoading(false);
  };

  const handleLocalVideoLoad = () => {
    setLoading(false);
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      setPlaying(false);
    }
  };

  const togglePlaying = async () => {
    if (isStorageOrLocalVideo && videoRef.current) {
      if (playing) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
    setPlaying(!playing);
  };

  if (!videoId && !videoUri) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={colors.textLight} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            {title && (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            )}
            {creatorName && (
              <Text style={styles.creator} numberOfLines={1}>
                {creatorName}
              </Text>
            )}
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Video Player */}
        <View style={styles.playerContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}

          {isStorageOrLocalVideo && videoUri ? (
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.localVideo}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={playing}
              isLooping={false}
              onLoad={handleLocalVideoLoad}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              useNativeControls
            />
          ) : isYouTubeVideo && videoId ? (
            <YoutubePlayer
              height={SCREEN_WIDTH * (9 / 16)}
              width={SCREEN_WIDTH}
              play={playing}
              videoId={videoId}
              onChangeState={onStateChange}
              onReady={handleReady}
              webViewProps={{
                allowsFullscreenVideo: true,
                mediaPlaybackRequiresUserAction: false,
              }}
            />
          ) : null}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={togglePlaying}>
            <Ionicons
              name={playing ? 'pause-circle' : 'play-circle'}
              size={56}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          {title && (
            <Text style={styles.infoTitle}>{title}</Text>
          )}
          {creatorName && (
            <Text style={styles.infoCreator}>by {creatorName}</Text>
          )}
        </View>

        {/* Back to Feed Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Ionicons name="arrow-back" size={20} color={colors.textLight} />
            <Text style={styles.backButtonText}>Back to Feed</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  creator: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  playerContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 10,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 12,
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  controlButton: {
    padding: 8,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textLight,
    marginBottom: 4,
  },
  infoCreator: {
    fontSize: 15,
    color: colors.textMuted,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  backButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});
