import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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
};

type UserListItem = {
  id: string;
  display_name: string | null;
  stage_name: string | null;
  avatar_url: string | null;
};

type ConnectionsRouteParams = {
  Connections: {
    type: 'jokers' | 'audience';
    userId?: string;
  };
};

export default function ConnectionsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ConnectionsRouteParams, 'Connections'>>();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const type = route.params?.type || 'jokers';
  const targetUserId = route.params?.userId || user?.id;
  const isJokers = type === 'jokers';
  const title = isJokers ? 'Jokers' : 'Audience';

  const handleUserPress = (userId: string) => {
    if (userId === user?.id) {
      (navigation as any).navigate('Account');
    } else {
      (navigation as any).navigate('ViewProfile', { userId });
    }
  };

  const fetchUsers = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);

    try {
      if (isJokers) {
        // Get all comedian IDs where target user is an audience member
        const { data: audienceData, error: audienceError } = await supabase
          .from('audience_members')
          .select('comedian_id')
          .eq('audience_member_id', targetUserId);

        if (audienceError) {
          // Sentry captures this automatically
          setLoading(false);
          return;
        }

        if (!audienceData || audienceData.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }

        const comedianIds = audienceData.map(a => a.comedian_id);

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, stage_name, avatar_url')
          .in('id', comedianIds);

        setUsers(profiles || []);
      } else {
        // Get all audience member IDs where target user is the comedian
        const { data: audienceData, error: audienceError } = await supabase
          .from('audience_members')
          .select('audience_member_id')
          .eq('comedian_id', targetUserId);

        if (audienceError) {
          // Sentry captures this automatically
          setLoading(false);
          return;
        }

        if (!audienceData || audienceData.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }

        const memberIds = audienceData.map(a => a.audience_member_id);

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, stage_name, avatar_url')
          .in('id', memberIds);

        setUsers(profiles || []);
      }
    } catch (error) {
      // Sentry captures this automatically
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isJokers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>{isJokers ? '🎭' : '👥'}</Text>
          <Text style={styles.emptyTitle}>
            {isJokers ? 'No Jokers Yet' : 'No Audience Yet'}
          </Text>
          <Text style={styles.emptyText}>
            {isJokers
              ? "Join comedians' audiences to see them here"
              : 'Share your sets to grow your audience'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {users.map((person) => (
            <TouchableOpacity
              key={person.id}
              style={styles.listItem}
              onPress={() => handleUserPress(person.id)}
              activeOpacity={0.7}
            >
              {person.avatar_url ? (
                <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {(person.stage_name || person.display_name || '?')[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.personInfo}>
                <Text style={styles.personName}>
                  {person.stage_name || person.display_name || 'Anonymous'}
                </Text>
                {person.stage_name && person.display_name && (
                  <Text style={styles.personSubtext}>{person.display_name}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
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
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    flex: 1,
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  personInfo: {
    flex: 1,
    marginLeft: 14,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  personSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  bottomPadding: {
    height: 40,
  },
});
