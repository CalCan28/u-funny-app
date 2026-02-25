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
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import YoutubePlayer from 'react-native-youtube-iframe';
import { SetReviewThread } from '../components/SetReviewThread';

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
  const videoRef = useRef<Video>(null);

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

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
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
        ) : isStorageOrLocalVideo && videoUri ? (
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={playing}
            isLooping={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            useNativeControls
          />
        ) : isYouTubeVideo && videoId ? (
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
  const {
    clipId,
    clipOwnerId,
    title,
    creatorName,
    videoId,
    videoUri,
    thumbnailUrl,
    focusFeedbackId,
  } = route.params;

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
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {creatorName && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              by {creatorName}
            </Text>
          )}
        </View>
        <View style={styles.placeholder} />
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
