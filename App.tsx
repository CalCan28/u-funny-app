import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import ErrorBoundary from './src/components/ErrorBoundary';

// Sentry: use native SDK on mobile, skip on web (can add @sentry/react later)
let Sentry: any = { init: () => {}, wrap: (c: any) => c, captureException: () => {} };
if (Platform.OS !== 'web') {
  try {
    Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
      debug: __DEV__,
      enabled: !__DEV__,
      tracesSampleRate: 0.2,
    });
  } catch {
    // Sentry not available
  }
}
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OpenMicFinderScreen from './src/screens/OpenMicFinderScreen';
import TonightsLineupScreen from './src/screens/TonightsLineupScreen';
import CritiqueFeedbackScreen from './src/screens/CritiqueFeedbackScreen';
import JoinEventScreen from './src/screens/JoinEventScreen';
import TipsCritiquesScreen from './src/screens/TipsCritiquesScreen';
import RecentsScreen from './src/screens/RecentsScreen';
import WhatsNewScreen from './src/screens/WhatsNewScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AccountScreen from './src/screens/AccountScreen';
import ConnectionsScreen from './src/screens/ConnectionsScreen';
import ViewProfileScreen from './src/screens/ViewProfileScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { logScreenView } from './src/services/analytics';
import CommunityDirectoryScreen from './src/screens/CommunityDirectoryScreen';
import InboxScreen from './src/screens/InboxScreen';
import ChatScreen from './src/screens/ChatScreen';
import NativeOnlyScreen from './src/components/NativeOnlyScreen';

// Screens with native-only imports: lazy-load on native, placeholder on web
let CheckInScreen: any;
let BitManagerScreen: any;
let HostDashboardScreen: any;
let ClipDetailScreen: any;
let EditProfileScreen: any;
let ShareSetScreen: any;
let SettingsScreen: any;

if (Platform.OS === 'web') {
  // Web placeholders for fully native screens
  CheckInScreen = ({ navigation }: any) => (
    <NativeOnlyScreen
      title="QR Check-In"
      description="QR code scanning requires the mobile app. Download U Funny on iOS to check in at venues."
      icon="qr-code-outline"
      navigation={navigation}
    />
  );
  BitManagerScreen = ({ navigation }: any) => (
    <NativeOnlyScreen
      title="Record Your Set"
      description="Video recording requires the mobile app. Download U Funny on iOS to record and manage your bits."
      icon="videocam-outline"
      navigation={navigation}
    />
  );
  HostDashboardScreen = ({ navigation }: any) => (
    <NativeOnlyScreen
      title="Host Dashboard"
      description="The full host dashboard with QR codes and media sharing is available on the mobile app."
      icon="desktop-outline"
      navigation={navigation}
    />
  );
  // These screens can work on web later, but need native imports removed first
  ClipDetailScreen = ({ navigation }: any) => (
    <NativeOnlyScreen
      title="Clip Player"
      description="Video playback is coming soon to the web version. Use the iOS app for the full experience."
      icon="play-circle-outline"
      navigation={navigation}
    />
  );
  EditProfileScreen = ({ navigation }: any) => (
    <NativeOnlyScreen
      title="Edit Profile"
      description="Profile editing with photo upload is coming soon to the web version."
      icon="person-outline"
      navigation={navigation}
    />
  );
  ShareSetScreen = ({ navigation }: any) => (
    <NativeOnlyScreen
      title="Share Your Set"
      description="Video uploading requires the mobile app. Download U Funny on iOS to share your sets."
      icon="cloud-upload-outline"
      navigation={navigation}
    />
  );
  SettingsScreen = ({ navigation }: any) => (
    <NativeOnlyScreen
      title="Settings"
      description="App settings and permissions are managed through the mobile app."
      icon="settings-outline"
      navigation={navigation}
    />
  );
} else {
  CheckInScreen = require('./src/screens/CheckInScreen').default;
  BitManagerScreen = require('./src/screens/BitManagerScreen').default;
  HostDashboardScreen = require('./src/screens/HostDashboardScreen').default;
  ClipDetailScreen = require('./src/screens/ClipDetailScreen').default;
  EditProfileScreen = require('./src/screens/EditProfileScreen').default;
  ShareSetScreen = require('./src/screens/ShareSetScreen').default;
  SettingsScreen = require('./src/screens/SettingsScreen').default;
}

// Define navigation types
export type RootStackParamList = {
  Auth: undefined;
  ResetPassword: undefined;
  Home: undefined;
  Profile: undefined;
  EditProfile: undefined;
  TipsAndCritiques: undefined;
  Recents: undefined;
  OpenMicFinder: undefined;
  CheckIn: undefined;
  TonightsLineup: { eventId?: string; venueName?: string };
  CritiqueFeedback: { eventId?: string; venueName?: string };
  BitManager: undefined;
  HostDashboard: undefined;
  JoinEvent: { roomCode: string };
  WhatsNew: undefined;
  Settings: undefined;
  ShareSet: undefined;
  Notifications: undefined;
  Account: undefined;
  Connections: { type: 'jokers' | 'audience'; userId?: string };
  ViewProfile: { userId: string };
  CommunityDirectory: undefined;
  Inbox: undefined;
  Chat: { conversationId?: string; otherUserId?: string; otherUserName?: string };
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

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

// Deep linking configuration
const prefix = Linking.createURL('/');

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'ufunny://', 'https://ufunny.app'],
  config: {
    screens: {
      Auth: 'auth',
      Home: '',
      JoinEvent: {
        path: 'join-event',
        parse: {
          roomCode: (roomCode: string) => roomCode,
        },
      },
      Profile: 'profile',
      EditProfile: 'edit-profile',
      TipsAndCritiques: 'tips-critiques',
      Recents: 'recents',
      OpenMicFinder: 'open-mics',
      BitManager: 'library',
      HostDashboard: 'host',
      TonightsLineup: 'lineup/:eventId?',
      CritiqueFeedback: 'feedback/:eventId?',
      CheckIn: 'checkin',
      WhatsNew: 'whats-new',
    },
  },
};

function AppNavigator() {
  const { user, loading, passwordRecovery } = useAuth();
  const { theme } = useTheme();

  // Handle deep links when app is already open
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      // Deep link handling - Sentry breadcrumb tracks this automatically
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b8e6f" />
      </View>
    );
  }

  if (passwordRecovery) {
    return (
      <Stack.Navigator id="PasswordReset" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      id="RootStack"
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.textDark,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      {!user ? (
        // Auth screens
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
      ) : (
        // Authenticated screens
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TipsAndCritiques"
            component={TipsCritiquesScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Recents"
            component={RecentsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OpenMicFinder"
            component={OpenMicFinderScreen}
            options={{ title: 'Find Open Mics' }}
          />
          <Stack.Screen
            name="CheckIn"
            component={CheckInScreen}
            options={{ title: 'Check In' }}
          />
          <Stack.Screen
            name="TonightsLineup"
            component={TonightsLineupScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CritiqueFeedback"
            component={CritiqueFeedbackScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BitManager"
            component={BitManagerScreen}
            options={{ title: 'My Bits' }}
          />
          <Stack.Screen
            name="HostDashboard"
            component={HostDashboardScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="JoinEvent"
            component={JoinEventScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WhatsNew"
            component={WhatsNewScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ShareSet"
            component={ShareSetScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Connections"
            component={ConnectionsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ViewProfile"
            component={ViewProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CommunityDirectory"
            component={CommunityDirectoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Inbox"
            component={InboxScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ClipDetail"
            component={ClipDetailScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <NavigationContainer
                linking={linking}
                onStateChange={(state) => {
                  if (state) {
                    const route = state.routes[state.index];
                    if (route?.name) {
                      logScreenView(route.name);
                    }
                  }
                }}
              >
                <AppNavigator />
              </NavigationContainer>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fdfcfa',
  },
});
