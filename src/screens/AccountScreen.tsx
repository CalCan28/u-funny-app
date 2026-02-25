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
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AudienceCount } from '../components/AudienceButton';
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

export default function AccountScreen() {
  const navigation = useNavigation();
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
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, stage_name, avatar_url, bio, home_city, years_experience, audience_count')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        setAudienceCount(data.audience_count || 0);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  // Fetch counts for jokers and audience
  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) return;

      // Count jokers (comedians the user follows)
      const { count: jokersCountResult } = await supabase
        .from('audience_members')
        .select('*', { count: 'exact', head: true })
        .eq('audience_member_id', user.id);

      setJokersCount(jokersCountResult || 0);
    };

    fetchCounts();
  }, [user]);

  // Fetch user's uploads
  useEffect(() => {
    const fetchUploads = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('community_videos')
        .select('id, title, thumbnail_url, youtube_video_id, storage_video_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setUploads(data);
      }
      setLoadingUploads(false);
    };

    fetchUploads();
  }, [user]);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const stageName = profile?.stage_name;
  const avatarInitial = (stageName || displayName).charAt(0).toUpperCase();

  const handlePlayVideo = (upload: Upload) => {
    if (!user) return;

    // Navigate to ClipDetail for viewing with reviews
    (navigation as any).navigate('ClipDetail', {
      clipId: upload.id,
      clipOwnerId: user.id,
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

  const handleOpenMenu = (upload: Upload) => {
    setSelectedUpload(upload);
    setShowUploadMenu(true);
  };

  const handleCloseMenu = () => {
    setShowUploadMenu(false);
    setSelectedUpload(null);
  };

  const handleDeleteVideo = () => {
    Alert.alert(
      'Delete Video',
      'Are you sure you want to delete this video? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteVideo,
        },
      ]
    );
  };

  const confirmDeleteVideo = async () => {
    if (!selectedUpload || !user) return;

    setDeleting(true);
    try {
      // If it's a storage video, delete from storage first
      if (selectedUpload.storage_video_url) {
        // Extract the file path from the URL
        const urlParts = selectedUpload.storage_video_url.split('/videos/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('videos').remove([filePath]);

          // Also try to delete the thumbnail
          const thumbPath = filePath.replace('_video.mp4', '_thumb.jpg');
          await supabase.storage.from('videos').remove([thumbPath]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('community_videos')
        .delete()
        .eq('id', selectedUpload.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setUploads(prev => prev.filter(u => u.id !== selectedUpload.id));
      handleCloseMenu();
      Alert.alert('Success', 'Video deleted successfully');
    } catch (error: any) {
      // Sentry captures this automatically
      Alert.alert('Error', 'Failed to delete video. Please try again.');
    } finally {
      setDeleting(false);
    }
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
        <Text style={styles.headerTitle}>My Account</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => (navigation as any).navigate('EditProfile')}
        >
          <Ionicons name="pencil" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header Card */}
        <View style={styles.profileHeader}>
          <View style={styles.profileTopRow}>
            {/* Avatar or Initial */}
            {profile?.avatar_url ? (
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
          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {profile?.home_city && (
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>📍</Text>
                <Text style={styles.statText}>{profile.home_city}</Text>
              </View>
            )}
            {profile?.years_experience ? (
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>🎭</Text>
                <Text style={styles.statText}>
                  {`${profile.years_experience} ${Number(profile.years_experience) === 1 ? 'year' : 'years'} of performing`}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Audience Count */}
          {(profile?.audience_count ?? 0) > 0 && (
            <View style={styles.audienceContainer}>
              <AudienceCount count={profile?.audience_count || 0} />
            </View>
          )}
        </View>

        {/* Jokers / Audience Buttons */}
        <View style={styles.connectionsButtons}>
          <TouchableOpacity
            style={styles.connectionButton}
            onPress={() => (navigation as any).navigate('Connections', { type: 'jokers' })}
          >
            <Text style={styles.connectionButtonText}>🎭 Jokers</Text>
            <Text style={styles.connectionCount}>{jokersCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.connectionButton}
            onPress={() => (navigation as any).navigate('Connections', { type: 'audience' })}
          >
            <Text style={styles.connectionButtonText}>👥 Audience</Text>
            <Text style={styles.connectionCount}>{audienceCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || 'Not set'}</Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Unknown'}
              </Text>
            </View>
          </View>
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
                Share your comedy sets to see them here
              </Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => (navigation as any).navigate('ShareSet')}
              >
                <Text style={styles.uploadButtonText}>Share a Set</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.uploadsGrid}>
              {uploads.map((upload) => (
                <View key={upload.id} style={styles.uploadThumbnail}>
                  <TouchableOpacity
                    style={styles.uploadTouchable}
                    onPress={() => handlePlayVideo(upload)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: upload.thumbnail_url }}
                      style={styles.uploadImage}
                      resizeMode="cover"
                    />
                    <View style={styles.uploadPlayOverlay}>
                      <Ionicons name="play" size={20} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.uploadMenuButton}
                    onPress={() => handleOpenMenu(upload)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Comedy Style Profile */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comedy Style Profile</Text>
            <ComedyStyleProfile
              userId={user.id}
              onViewTipsCritiques={() => (navigation as any).navigate('TipsAndCritiques')}
            />
          </View>
        )}

        {/* Tips & Critiques */}
        {user && (
          <View style={styles.section}>
            <TipsAndCritiques
              userId={user.id}
              onViewAll={() => (navigation as any).navigate('TipsAndCritiques')}
            />
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

      {/* Upload Options Menu Modal */}
      <Modal
        visible={showUploadMenu}
        animationType="fade"
        transparent
        onRequestClose={handleCloseMenu}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={handleCloseMenu}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {selectedUpload?.title || 'Video Options'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                handleCloseMenu();
                if (selectedUpload) handlePlayVideo(selectedUpload);
              }}
            >
              <Ionicons name="play-circle-outline" size={24} color={colors.textDark} />
              <Text style={styles.menuOptionText}>Play Video</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={[styles.menuOption, styles.menuOptionDanger]}
              onPress={handleDeleteVideo}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#d9534f" />
              ) : (
                <Ionicons name="trash-outline" size={24} color="#d9534f" />
              )}
              <Text style={styles.menuOptionTextDanger}>
                {deleting ? 'Deleting...' : 'Delete Video'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancelButton}
              onPress={handleCloseMenu}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  editButton: {
    padding: 4,
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
  audienceContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
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
  infoCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 4,
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
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    position: 'relative',
  },
  uploadTouchable: {
    width: '100%',
    height: '100%',
  },
  uploadImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadMenuButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPadding: {
    height: 40,
  },
  // Menu Modal Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuOptionText: {
    fontSize: 16,
    color: colors.textDark,
  },
  menuOptionDanger: {
    // No extra styles needed, color handled by text
  },
  menuOptionTextDanger: {
    fontSize: 16,
    color: '#d9534f',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 16,
  },
  menuCancelButton: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
