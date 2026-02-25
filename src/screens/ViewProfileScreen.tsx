import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import AudienceButton, { AudienceCount } from '../components/AudienceButton';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { ComedyStyleProfile, TipsAndCritiques } from '../components/SetReviewThread';

const smileyIcon = require('../../assets/smiley-icon.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 8;
const NUM_COLUMNS = 3;
const THUMBNAIL_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
};

type Profile = {
  id: string;
  display_name: string | null;
  stage_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_city: string | null;
  years_experience: string | null;
  audience_count: number | null;
};

type Upload = {
  id: string;
  title: string;
  thumbnail_url: string;
  youtube_video_id: string | null;
  storage_video_url: string | null;
  created_at: string;
};

type ViewProfileRouteParams = {
  ViewProfile: {
    userId: string;
  };
};

export default function ViewProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ViewProfileRouteParams, 'ViewProfile'>>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [jokersCount, setJokersCount] = useState(0);
  const [audienceCount, setAudienceCount] = useState(0);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [videoPlayer, setVideoPlayer] = useState<{
    visible: boolean;
    videoId: string | null;
    videoUri?: string | null;
    title?: string;
  }>({
    visible: false,
    videoId: null,
    videoUri: null,
  });

  const userId = route.params?.userId;

  // Redirect to own account if viewing self
  useEffect(() => {
    if (userId && user && userId === user.id) {
      (navigation as any).replace('Account');
    }
  }, [userId, user, navigation]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, stage_name, avatar_url, bio, home_city, years_experience, audience_count')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
        setAudienceCount(data.audience_count || 0);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [userId]);

  // Fetch counts for jokers
  useEffect(() => {
    const fetchCounts = async () => {
      if (!userId) return;

      const { count: jokersCountResult } = await supabase
        .from('audience_members')
        .select('*', { count: 'exact', head: true })
        .eq('audience_member_id', userId);

      setJokersCount(jokersCountResult || 0);
    };

    fetchCounts();
  }, [userId]);

  // Fetch user's uploads
  useEffect(() => {
    const fetchUploads = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from('community_videos')
        .select('id, title, thumbnail_url, youtube_video_id, storage_video_url, created_at')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setUploads(data);
      }
      setLoadingUploads(false);
    };

    fetchUploads();
  }, [userId]);

  const displayName = profile?.display_name || 'User';
  const stageName = profile?.stage_name;
  const avatarInitial = (stageName || displayName).charAt(0).toUpperCase();

  const handlePlayVideo = (upload: Upload) => {
    // Navigate to ClipDetail for viewing with reviews
    (navigation as any).navigate('ClipDetail', {
      clipId: upload.id,
      clipOwnerId: userId,
      title: upload.title,
      creatorName: stageName || displayName,
      videoId: upload.youtube_video_id,
      videoUri: upload.storage_video_url,
      thumbnailUrl: upload.thumbnail_url,
    });
  };

  const closeVideoPlayer = () => {
    setVideoPlayer({ visible: false, videoId: null, videoUri: null });
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Profile Not Found</Text>
          <Text style={styles.errorText}>This user doesn't exist or has been removed.</Text>
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
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header Card */}
        <View style={styles.profileHeader}>
          <View style={styles.profileTopRow}>
            {/* Avatar or Initial */}
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{avatarInitial}</Text>
              </View>
            )}

            {/* Name Info */}
            <View style={styles.nameContainer}>
              <Text style={styles.displayName}>{displayName}</Text>
              {stageName && (
                <Text style={styles.stageName}>{stageName}</Text>
              )}
            </View>

            {/* App Icon */}
            <Image source={smileyIcon} style={styles.appIcon} resizeMode="contain" />
          </View>

          {/* Bio */}
          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {profile.home_city && (
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>📍</Text>
                <Text style={styles.statText}>{profile.home_city}</Text>
              </View>
            )}
            {profile.years_experience ? (
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🎭</Text>
                <Text style={styles.statText}>
                  {`${profile.years_experience} ${Number(profile.years_experience) === 1 ? 'year' : 'years'} of performing`}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Audience Count & Join Button */}
          <View style={styles.audienceSection}>
            {(profile.audience_count ?? 0) > 0 && (
              <AudienceCount count={profile.audience_count || 0} />
            )}
            <View style={styles.joinButtonContainer}>
              <AudienceButton comedianId={userId} size="medium" />
            </View>
          </View>
        </View>

        {/* Jokers / Audience Buttons */}
        <View style={styles.connectionsButtons}>
          <TouchableOpacity
            style={styles.connectionButton}
            onPress={() => (navigation as any).navigate('Connections', { type: 'jokers', userId })}
          >
            <Text style={styles.connectionButtonText}>🎭 Jokers</Text>
            <Text style={styles.connectionCount}>{jokersCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.connectionButton}
            onPress={() => (navigation as any).navigate('Connections', { type: 'audience', userId })}
          >
            <Text style={styles.connectionButtonText}>👥 Audience</Text>
            <Text style={styles.connectionCount}>{audienceCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Uploads Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uploads</Text>

          {loadingUploads ? (
            <View style={styles.uploadsLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : uploads.length === 0 ? (
            <View style={styles.uploadsEmpty}>
              <Ionicons name="videocam-outline" size={40} color={colors.textMuted} />
              <Text style={styles.uploadsEmptyTitle}>No Uploads Yet</Text>
              <Text style={styles.uploadsEmptyText}>
                This comedian hasn't shared any sets yet
              </Text>
            </View>
          ) : (
            <View style={styles.uploadsGrid}>
              {uploads.map((upload) => (
                <TouchableOpacity
                  key={upload.id}
                  style={styles.uploadThumbnail}
                  onPress={() => handlePlayVideo(upload)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: upload.thumbnail_url }}
                    style={styles.uploadImage}
                    resizeMode="cover"
                  />
                  <View style={styles.uploadOverlay}>
                    <Ionicons name="play" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Comedy Style Profile */}
        {userId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comedy Style Profile</Text>
            <ComedyStyleProfile userId={userId} />
          </View>
        )}

        {/* Tips & Critiques */}
        {userId && (
          <View style={styles.section}>
            <TipsAndCritiques userId={userId} />
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Video Player Modal */}
      <VideoPlayerModal
        visible={videoPlayer.visible}
        videoId={videoPlayer.videoId}
        videoUri={videoPlayer.videoUri}
        title={videoPlayer.title}
        onClose={closeVideoPlayer}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
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
  profileHeader: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  nameContainer: {
    flex: 1,
    marginLeft: 14,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  stageName: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 2,
  },
  appIcon: {
    width: 40,
    height: 40,
  },
  bio: {
    fontSize: 14,
    color: colors.textDark,
    lineHeight: 20,
    marginTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 14,
  },
  statText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  audienceSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  joinButtonContainer: {
    marginTop: 12,
  },
  connectionsButtons: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  connectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  connectionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  connectionCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 12,
  },
  uploadsLoading: {
    padding: 40,
    alignItems: 'center',
  },
  uploadsEmpty: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  uploadsEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 12,
    marginBottom: 4,
  },
  uploadsEmptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  uploadsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  uploadThumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE * 1.3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.cardBorder,
  },
  uploadImage: {
    width: '100%',
    height: '100%',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPadding: {
    height: 40,
  },
});
