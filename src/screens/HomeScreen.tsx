import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ImageSourcePropType,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import VideoPlayerModal from '../components/VideoPlayerModal';
import AudienceButton, { AudienceCount } from '../components/AudienceButton';

// Local assets
const logoImage = require('../../assets/logo.png');
const canYouTopThisImage = require('../../assets/can-you-top-this.png');
const dadJokesImage = require('../../assets/dad-jokes.png');
const smileyIcon = require('../../assets/smiley-icon.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design colors from Figma
const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  navBar: '#3d3126',
  live: '#e85d4c',
};

// Helper to get YouTube thumbnail from video ID
const getYouTubeThumbnail = (videoId: string) => {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

// Format date for display
const formatVideoDate = (dateString: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Static sample data (fallback)
const staticFeedData = [
  {
    id: 'static-1',
    title: 'Stand-Up Comedy Set',
    subtitle: 'Featured Performance',
    description: 'Check out this hilarious stand-up set! Perfect timing and killer punchlines.',
    likes: '12.4K',
    comments: '892',
    views: '45.2K',
    featured: true,
    youtubeId: 'ahgukMEcoy4',
    youtubeUrl: 'https://youtu.be/ahgukMEcoy4',
    image: null,
    creator: {
      name: 'Comedy Club TV',
      avatar: null,
      verified: true,
    },
    duration: '5:32',
    isLive: false,
  },
  {
    id: 'static-2',
    title: 'Can you top this?',
    subtitle: 'Community Challenge',
    description: 'Think you can do better? Submit your take on this classic setup...',
    likes: '2.4K',
    comments: '182',
    views: '8.1K',
    featured: false,
    youtubeId: null,
    youtubeUrl: null,
    image: canYouTopThisImage,
    creator: {
      name: 'U Funny Team',
      avatar: null,
      verified: true,
    },
    duration: '2:15',
    isLive: false,
  },
];

type CommunityVideo = {
  id: string;
  user_id: string;
  youtube_url: string | null;
  youtube_video_id: string | null;
  title: string;
  venue_name: string | null;
  performance_date: string | null;
  thumbnail_url: string;
  created_at: string;
  storage_video_url?: string | null;
  profiles: {
    display_name: string | null;
    stage_name: string | null;
    avatar_url: string | null;
    audience_count: number | null;
  } | null;
};

type VideoPlayerState = {
  visible: boolean;
  videoId: string | null;
  videoUri?: string | null;
  title?: string;
  creatorName?: string;
};

type FeedItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  likes: string;
  comments: string;
  views: string;
  featured: boolean;
  youtubeId: string | null;
  youtubeUrl: string | null;
  image: ImageSourcePropType | null;
  creator: {
    name: string;
    avatar: string | null;
    verified: boolean;
  };
  duration: string;
  isLive: boolean;
  isCommunity?: boolean;
  venueName?: string | null;
  performanceDate?: string | null;
};

function CommunityVideoCard({
  video,
  onPlay,
  onCreatorPress,
}: {
  video: CommunityVideo;
  onPlay: (video: CommunityVideo) => void;
  onCreatorPress: (userId: string) => void;
}) {
  const creatorName =
    video.profiles?.stage_name ||
    video.profiles?.display_name ||
    'Anonymous Comedian';
  const audienceCount = video.profiles?.audience_count || 0;

  return (
    <View style={styles.communityCard}>
      {/* Thumbnail - Tappable to play */}
      <TouchableOpacity
        style={styles.communityThumbnailContainer}
        onPress={() => onPlay(video)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: video.thumbnail_url }}
          style={styles.communityThumbnail}
          resizeMode="cover"
        />
        <View style={styles.communityPlayOverlay}>
          <View style={styles.communityPlayButton}>
            <Ionicons name="play" size={24} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.communityInfo}>
        <TouchableOpacity
          style={styles.communityCreatorRow}
          onPress={() => onCreatorPress(video.user_id)}
          activeOpacity={0.7}
        >
          <View style={styles.communityAvatar}>
            <Text style={styles.communityAvatarText}>
              {creatorName[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.communityCreatorInfo}>
            <Text style={styles.communityCreatorName} numberOfLines={1}>
              {creatorName}
            </Text>
            {audienceCount > 0 && (
              <Text style={styles.communityAudienceCount}>
                🎭 {audienceCount}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.communityTitle} numberOfLines={2}>
          {video.title}
        </Text>
        {video.venue_name && (
          <Text style={styles.communityVenue} numberOfLines={1}>
            📍 {video.venue_name}
          </Text>
        )}
        {/* Audience Button */}
        <View style={styles.communityActions}>
          <AudienceButton
            comedianId={video.user_id}
            size="small"
          />
        </View>
      </View>
    </View>
  );
}

function VideoCard({ item, onPlay }: { item: FeedItem; onPlay: (item: FeedItem) => void }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes);

  const handleLike = () => {
    if (!liked) {
      const numLikes = parseFloat(likeCount.replace('K', '')) * (likeCount.includes('K') ? 1000 : 1);
      const newCount = numLikes + 1;
      if (newCount >= 1000) {
        setLikeCount((newCount / 1000).toFixed(1) + 'K');
      } else {
        setLikeCount(newCount.toString());
      }
    }
    setLiked(!liked);
  };

  const thumbnailSource = item.youtubeId
    ? { uri: getYouTubeThumbnail(item.youtubeId) }
    : item.image;

  return (
    <View style={[styles.card, item.featured && styles.featuredCard]}>
      <TouchableOpacity
        style={styles.thumbnailContainer}
        onPress={() => onPlay(item)}
        activeOpacity={0.9}
      >
        {thumbnailSource && (
          <Image source={thumbnailSource} style={styles.thumbnail} resizeMode="cover" />
        )}
        {!thumbnailSource && (
          <View style={styles.placeholderThumbnail}>
            <Text style={styles.placeholderEmoji}>🎭</Text>
          </View>
        )}
        <View style={styles.thumbnailOverlay} />

        <View style={styles.playButton}>
          <Text style={styles.playIcon}>▶</Text>
        </View>

        <View style={[styles.durationBadge, item.isLive && styles.liveBadge]}>
          {item.isLive && <View style={styles.liveDot} />}
          <Text style={[styles.durationText, item.isLive && styles.liveText]}>
            {item.duration}
          </Text>
        </View>

        {item.featured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>⭐ FEATURED</Text>
          </View>
        )}

        <View style={styles.viewsOverlay}>
          <Text style={styles.viewsText}>👁 {item.views}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.cardContent}>
        <View style={styles.creatorRow}>
          <View style={styles.creatorAvatar}>
            <Text style={styles.creatorInitial}>{item.creator.name[0]}</Text>
          </View>
          <View style={styles.creatorInfo}>
            <View style={styles.creatorNameRow}>
              <Text style={styles.creatorName}>{item.creator.name}</Text>
              {item.creator.verified && (
                <Text style={styles.verifiedBadge}>✓</Text>
              )}
            </View>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <Text style={[styles.actionIcon, liked && styles.likedIcon]}>
              {liked ? '❤️' : '🤍'}
            </Text>
            <Text style={[styles.actionText, liked && styles.likedText]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionText}>{item.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>↗️</Text>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>🔖</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [communityVideos, setCommunityVideos] = useState<CommunityVideo[]>([]);
  const [communityIdeas, setCommunityIdeas] = useState<CommunityVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userInitial, setUserInitial] = useState('?');
  const [videoPlayer, setVideoPlayer] = useState<VideoPlayerState>({
    visible: false,
    videoId: null,
  });

  const fetchCommunityVideos = useCallback(async () => {
    try {
      // Fetch Community Sets (category = 'community_sets' or null for backwards compatibility)
      const { data: setsVideos, error: setsError } = await supabase
        .from('community_videos')
        .select('id, user_id, youtube_url, youtube_video_id, title, venue_name, performance_date, thumbnail_url, created_at, category, storage_video_url')
        .eq('status', 'approved')
        .or('category.eq.community_sets,category.is.null')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch Community Ideas
      const { data: ideasVideos, error: ideasError } = await supabase
        .from('community_videos')
        .select('id, user_id, youtube_url, youtube_video_id, title, venue_name, performance_date, thumbnail_url, created_at, category, storage_video_url')
        .eq('status', 'approved')
        .eq('category', 'community_ideas')
        .order('created_at', { ascending: false })
        .limit(10);

      if (setsError) {
        console.error('Error fetching community sets:', setsError);
      }
      if (ideasError) {
        console.error('Error fetching community ideas:', ideasError);
      }

      // Process Community Sets
      if (setsVideos && setsVideos.length > 0) {
        const userIds = [...new Set(setsVideos.map(v => v.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, stage_name, avatar_url, audience_count')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const videosWithProfiles = setsVideos.map(video => ({
          ...video,
          profiles: profileMap.get(video.user_id) || null,
        }));

        const shuffled = videosWithProfiles.sort(() => Math.random() - 0.5);
        setCommunityVideos(shuffled.slice(0, 8));
      } else {
        setCommunityVideos([]);
      }

      // Process Community Ideas
      if (ideasVideos && ideasVideos.length > 0) {
        const userIds = [...new Set(ideasVideos.map(v => v.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, stage_name, avatar_url, audience_count')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const videosWithProfiles = ideasVideos.map(video => ({
          ...video,
          profiles: profileMap.get(video.user_id) || null,
        }));

        const shuffled = videosWithProfiles.sort(() => Math.random() - 0.5);
        setCommunityIdeas(shuffled.slice(0, 8));
      } else {
        setCommunityIdeas([]);
      }
    } catch (error) {
      console.error('Error fetching community videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunityVideos();
  }, [fetchCommunityVideos]);

  // Fetch user profile for initial
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('display_name, stage_name')
        .eq('id', user.id)
        .single();

      if (data) {
        const name = data.stage_name || data.display_name || user.email || '?';
        setUserInitial(name[0]?.toUpperCase() || '?');
      }
    };

    fetchUserProfile();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommunityVideos();
  };

  const handlePlayVideo = (item: FeedItem) => {
    const videoId = item.youtubeId;
    if (videoId) {
      setVideoPlayer({
        visible: true,
        videoId,
        title: item.title,
        creatorName: item.creator.name,
      });
    }
  };

  const handlePlayCommunityVideo = (video: CommunityVideo) => {
    const creatorName =
      video.profiles?.stage_name ||
      video.profiles?.display_name ||
      'Anonymous Comedian';

    // Navigate to ClipDetail screen for reviews
    navigation.navigate('ClipDetail', {
      clipId: video.id,
      clipOwnerId: video.user_id,
      title: video.title,
      creatorName,
      videoId: video.youtube_video_id,
      videoUri: video.storage_video_url,
      thumbnailUrl: video.thumbnail_url,
    });
  };

  const handleCreatorPress = (userId: string) => {
    if (userId === user?.id) {
      navigation.navigate('Account');
    } else {
      navigation.navigate('ViewProfile', { userId });
    }
  };

  const closeVideoPlayer = () => {
    setVideoPlayer({ visible: false, videoId: null, videoUri: null });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={logoImage}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.headerIcon}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileInitial}>{userInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity style={[styles.categoryPill, styles.categoryPillActive]}>
            <Text style={[styles.categoryText, styles.categoryTextActive]}>For You</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryPill}>
            <Text style={styles.categoryText}>Trending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryPill}>
            <Text style={styles.categoryText}>Open Mics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryPill}>
            <Text style={styles.categoryText}>Challenges</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryPill}>
            <Text style={styles.categoryText}>Jokers</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Feed */}
      <ScrollView
        style={styles.feed}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Community Videos Section */}
        {communityVideos.length > 0 && (
          <View style={styles.communitySection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Image source={smileyIcon} style={styles.smileyIcon} resizeMode="contain" />
                <Text style={styles.sectionTitle}>Community Sets</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('ShareSet')}>
                <Text style={styles.sectionLink}>Share Yours</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.communityScroll}
            >
              {communityVideos.map((video) => (
                <CommunityVideoCard
                  key={video.id}
                  video={video}
                  onPlay={handlePlayCommunityVideo}
                  onCreatorPress={handleCreatorPress}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {loading && communityVideos.length === 0 && communityIdeas.length === 0 && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading community videos...</Text>
          </View>
        )}

        {/* Community Ideas Section */}
        {communityIdeas.length > 0 && (
          <View style={styles.communitySection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Image source={smileyIcon} style={styles.smileyIcon} resizeMode="contain" />
                <Text style={styles.sectionTitle}>Community Ideas</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('ShareSet')}>
                <Text style={styles.sectionLink}>Share Yours</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.communityScroll}
            >
              {communityIdeas.map((video) => (
                <CommunityVideoCard
                  key={video.id}
                  video={video}
                  onPlay={handlePlayCommunityVideo}
                  onCreatorPress={handleCreatorPress}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Up & Coming Section Header */}
        <View style={styles.upcomingSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Image source={smileyIcon} style={styles.smileyIcon} resizeMode="contain" />
              <Text style={styles.sectionTitle}>Up & Coming</Text>
            </View>
          </View>
        </View>

        {/* Static Featured Content */}
        {staticFeedData.map((item) => (
          <VideoCard key={item.id} item={item} onPlay={handlePlayVideo} />
        ))}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ShareSet')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Bottom Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navTextActive}>Home</Text>
          <View style={styles.navDot} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('OpenMicFinder')}
        >
          <Text style={styles.navIcon}>🔍</Text>
          <Text style={styles.navText}>Discover</Text>
        </TouchableOpacity>
        <View style={styles.navLogoContainer}>
          <Image source={smileyIcon} style={styles.navLogo} resizeMode="contain" />
        </View>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('BitManager')}
        >
          <Text style={styles.navIcon}>📚</Text>
          <Text style={styles.navText}>Library</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('GoPremium')}
        >
          <Text style={styles.navIcon}>⭐</Text>
          <Text style={styles.navText}>Premium</Text>
        </TouchableOpacity>
      </View>

      {/* Video Player Modal */}
      <VideoPlayerModal
        visible={videoPlayer.visible}
        videoId={videoPlayer.videoId}
        videoUri={videoPlayer.videoUri}
        title={videoPlayer.title}
        creatorName={videoPlayer.creatorName}
        onClose={closeVideoPlayer}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(245, 241, 232, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  logo: {
    width: 120,
    height: 45,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerIcon: {
    fontSize: 18,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  profileInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryContainer: {
    backgroundColor: colors.background,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  categoryTextActive: {
    color: '#fff',
  },
  feed: {
    flex: 1,
    paddingTop: 16,
  },
  // Community Videos Section
  communitySection: {
    marginBottom: 20,
  },
  upcomingSection: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smileyIcon: {
    width: 24,
    height: 24,
    marginRight: 6,
  },
  sectionEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  communityScroll: {
    paddingHorizontal: 16,
  },
  communityCard: {
    width: 180,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  communityThumbnailContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#000',
    position: 'relative',
  },
  communityThumbnail: {
    width: '100%',
    height: '100%',
  },
  communityPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  communityPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(107, 142, 111, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityInfo: {
    padding: 10,
  },
  communityCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  communityAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  communityAvatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  communityCreatorInfo: {
    flex: 1,
  },
  communityCreatorName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  communityAudienceCount: {
    fontSize: 10,
    color: colors.textMuted,
  },
  communityVenue: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  communityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    lineHeight: 17,
  },
  communityDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  communityActions: {
    marginTop: 8,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 140,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  // Existing styles
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  featuredCard: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  thumbnailContainer: {
    height: 200,
    backgroundColor: '#e8e4da',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -28,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(107, 142, 111, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playIcon: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 3,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveBadge: {
    backgroundColor: colors.live,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  liveText: {
    fontWeight: 'bold',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredText: {
    color: colors.textDark,
    fontSize: 12,
    fontWeight: 'bold',
  },
  viewsOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  viewsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  cardContent: {
    padding: 16,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  creatorInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  verifiedBadge: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(92, 74, 58, 0.8)',
    marginBottom: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionIcon: {
    fontSize: 18,
  },
  likedIcon: {
    transform: [{ scale: 1.1 }],
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  likedText: {
    color: colors.live,
  },
  bottomPadding: {
    height: 100,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.navBar,
    paddingVertical: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#000',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navIconActive: {
    fontSize: 20,
    marginBottom: 4,
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  navTextActive: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  navLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navLogo: {
    width: 36,
    height: 36,
  },
});
