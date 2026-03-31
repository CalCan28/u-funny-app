import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
// Native-only video imports — lazy loaded so web bundle skips them
let Video: any = null;
let ResizeMode: any = null;
let YoutubePlayer: any = null;

if (Platform.OS !== 'web') {
  const av = require('expo-av');
  Video = av.Video;
  ResizeMode = av.ResizeMode;
  YoutubePlayer = require('react-native-youtube-iframe').default;
}
import { SetReviewThread } from '../components/SetReviewThread';
import ReportModal from '../components/ReportModal';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
};

type ClipDetailRouteParams = {
  ClipDetail: {
    clipId: string;
    clipOwnerId: string;
    title: string;
    creatorName?: string;
    videoId?: string | null;
    videoUri?: string | null;
    thumbnailUrl?: string;
    focusFeedbackId?: string;
  };
};

// Video Header Component to be used in FlatList header
function VideoHeader({
  title,
  creatorName,
  videoId,
  videoUri,
  thumbnailUrl,
}: {
  title: string;
  creatorName?: string;
  videoId?: string | null;
  videoUri?: string | null;
  thumbnailUrl?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<any>(null);

  const isStorageOrLocalVideo = videoUri && (
    videoUri.startsWith('file://') ||
    videoUri.startsWith('ph://') ||
    videoUri.startsWith('https://')
  );
  const isYouTubeVideo = videoId && !videoId.startsWith('local_');

  const handlePlayPress = () => {
    setShowVideo(true);
    setPlaying(true);
  };

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded && status.didJustFinish) {
      setPlaying(false);
    }
  };

  const onYouTubeStateChange = (state: string) => {
    if (state === 'ended') {
      setPlaying(false);
    }
  };

  return (
    <View>
      {/* Video Player */}
      <View style={styles.videoContainer}>
        {!showVideo && thumbnailUrl ? (
          <TouchableOpacity
            style={styles.thumbnailContainer}
            onPress={handlePlayPress}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <View style={styles.playOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={32} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        ) : Platform.OS === 'web' ? (
          // Web: use iframe for YouTube, HTML video for others
          isYouTubeVideo && videoId ? (
            <iframe
              width={SCREEN_WIDTH}
              height={SCREEN_WIDTH * (9 / 16)}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ border: 'none' }}
            />
          ) : isStorageOrLocalVideo && videoUri ? (
            <video
              src={videoUri}
              style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * (9 / 16) }}
              autoPlay
              controls
              onEnded={() => setPlaying(false)}
            />
          ) : (
            <View style={styles.noVideoContainer}>
              <Ionicons name="videocam-off-outline" size={48} color={colors.textMuted} />
              <Text style={styles.noVideoText}>Video unavailable</Text>
            </View>
          )
        ) : isStorageOrLocalVideo && videoUri && Video ? (
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode={ResizeMode?.CONTAIN}
            shouldPlay={playing}
            isLooping={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            useNativeControls
          />
        ) : isYouTubeVideo && videoId && YoutubePlayer ? (
          <YoutubePlayer
            height={SCREEN_WIDTH * (9 / 16)}
            width={SCREEN_WIDTH}
            play={playing}
            videoId={videoId}
            onChangeState={onYouTubeStateChange}
            webViewProps={{
              allowsFullscreenVideo: true,
              mediaPlaybackRequiresUserAction: false,
            }}
          />
        ) : (
          <View style={styles.noVideoContainer}>
            <Ionicons name="videocam-off-outline" size={48} color={colors.textMuted} />
            <Text style={styles.noVideoText}>Video unavailable</Text>
          </View>
        )}
      </View>

      {/* Video Info */}
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle}>{title}</Text>
        {creatorName && (
          <Text style={styles.videoCreator}>by {creatorName}</Text>
        )}
      </View>

      {/* Section Title */}
      <Text style={styles.sectionTitle}>Set Reviews</Text>
    </View>
  );
}

export default function ClipDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ClipDetailRouteParams, 'ClipDetail'>>();
  const { theme } = useTheme();
  const {
    clipId = '',
    clipOwnerId = '',
    title = 'Untitled',
    creatorName = 'Unknown',
    videoId = null,
    videoUri = null,
    thumbnailUrl = null,
    focusFeedbackId = undefined,
  } = route.params || {};

  const [showReportModal, setShowReportModal] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textDark} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.textDark }]} numberOfLines={1}>
            {title}
          </Text>
          {creatorName && (
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
              by {creatorName}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowReportModal(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 4 }}
        >
          <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Set Review Thread with Video Header */}
      <SetReviewThread
        clipId={clipId}
        clipOwnerId={clipOwnerId}
        focusFeedbackId={focusFeedbackId}
        ListHeaderComponent={
          <VideoHeader
            title={title}
            creatorName={creatorName}
            videoId={videoId}
            videoUri={videoUri}
            thumbnailUrl={thumbnailUrl}
          />
        }
      />

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={clipOwnerId}
        contentType="video"
        contentId={clipId}
        userName={creatorName}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.cardBg,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 1,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
    backgroundColor: '#000',
  },
  thumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(107, 142, 111, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  noVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  videoInfo: {
    padding: 16,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  videoCreator: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    padding: 16,
    paddingBottom: 0,
  },
});
