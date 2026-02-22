import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OpenMicFinderScreen from './src/screens/OpenMicFinderScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import TonightsLineupScreen from './src/screens/TonightsLineupScreen';
import CritiqueFeedbackScreen from './src/screens/CritiqueFeedbackScreen';
import BitManagerScreen from './src/screens/BitManagerScreen';
import GoPremiumScreen from './src/screens/GoPremiumScreen';
import ComedyCoachScreen from './src/screens/ComedyCoachScreen';
import HostDashboardScreen from './src/screens/HostDashboardScreen';
import JoinEventScreen from './src/screens/JoinEventScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import TipsCritiquesScreen from './src/screens/TipsCritiquesScreen';
import RecentsScreen from './src/screens/RecentsScreen';
import WhatsNewScreen from './src/screens/WhatsNewScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ShareSetScreen from './src/screens/ShareSetScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import AccountScreen from './src/screens/AccountScreen';
import ConnectionsScreen from './src/screens/ConnectionsScreen';
import ViewProfileScreen from './src/screens/ViewProfileScreen';
import ClipDetailScreen from './src/screens/ClipDetailScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';

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
  GoPremium: undefined;
  ComedyCoach: undefined;
  HostDashboard: undefined;
  JoinEvent: { roomCode: string };
  WhatsNew: undefined;
  Settings: undefined;
  ShareSet: undefined;
  Notifications: undefined;
  Account: undefined;
  Connections: { type: 'jokers' | 'audience'; userId?: string };
  ViewProfile: { userId: string };
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
      ComedyCoach: 'coach',
      GoPremium: 'premium',
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

  // Handle deep links when app is already open
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('Deep link received:', url);
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#f5f1e8' },
        headerTintColor: '#5c4a3a',
        contentStyle: { backgroundColor: '#f5f1e8' },
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
            name="GoPremium"
            component={GoPremiumScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ComedyCoach"
            component={ComedyCoachScreen}
            options={{ title: 'AI Coach' }}
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
            name="ClipDetail"
            component={ClipDetailScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fdfcfa',
  },
});
