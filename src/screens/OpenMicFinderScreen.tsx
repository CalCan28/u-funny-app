import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  mapBg: '#e8e4da',
  error: '#d9534f',
};

type OpenMic = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  event_date: string | null;
  event_time: string;
  spots_left: number;
  day_of_week?: string | null;
  sign_up_notes?: string | null;
  distance?: string;
};

// Day order helpers for recurring weekly mics
const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function daysUntilNext(dayOfWeek: string): number {
  const today = new Date().getDay();
  const target = DAY_ORDER.indexOf(dayOfWeek);
  if (target === -1) return 7;
  const diff = (target - today + 7) % 7;
  return diff;
}

function getNextDateForDay(dayOfWeek: string): string {
  const days = daysUntilNext(dayOfWeek);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDayLabel(dayOfWeek: string): string {
  const days = daysUntilNext(dayOfWeek);
  if (days === 0) return 'Tonight';
  if (days === 1) return 'Tomorrow';
  return dayOfWeek;
}

// Haversine distance in miles between two coordinates
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d < 10 ? `${d.toFixed(1)} mi` : `${Math.round(d)} mi`;
}

type SavedEvent = {
  id: string;
  venueId: string;
  name: string;
  address: string;
  date: string;
  time: string;
  savedAt: string;
};

type TabType = 'discover' | 'calendar';
type CalendarViewType = 'list' | 'calendar';

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatFullDate = (dateString: string) => {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

// Storage key for saved events
const SAVED_EVENTS_KEY = 'ufunny_saved_events';

// Calendar helper functions
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type VenueCardProps = {
  venue: OpenMic;
  onSignUp: (venue: OpenMic) => void;
  isSaved: boolean;
};

function VenueCard({ venue, onSignUp, isSaved }: VenueCardProps) {
  return (
    <View style={styles.venueCard}>
      <View style={styles.venueInfo}>
        <Text style={styles.venueName}>{venue.name}</Text>
        <Text style={styles.venueAddress} numberOfLines={1}>
          📍 {venue.address}
        </Text>
        <View style={styles.venueDateTimeRow}>
          <View style={styles.dateTimeBadge}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={styles.dateTimeText}>
              {venue.day_of_week ? getDayLabel(venue.day_of_week) : venue.event_date ? formatDate(venue.event_date) : ''}
            </Text>
          </View>
          <View style={styles.dateTimeBadge}>
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={styles.dateTimeText}>{venue.event_time}</Text>
          </View>
        </View>
        {venue.sign_up_notes ? (
          <Text style={styles.signUpNotes} numberOfLines={2}>{venue.sign_up_notes}</Text>
        ) : null}
        <Text style={styles.spotsLeft}>
          {venue.spots_left} spots{venue.distance ? ` • ${venue.distance}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.signUpButton, isSaved && styles.signUpButtonSaved]}
        onPress={() => onSignUp(venue)}
      >
        <Text style={[styles.signUpButtonText, isSaved && styles.signUpButtonTextSaved]}>
          {isSaved ? '✓ Signed Up' : 'Sign Up'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

type CalendarEventCardProps = {
  event: SavedEvent;
  onRemove: (eventId: string) => void;
  compact?: boolean;
};

function CalendarEventCard({ event, onRemove, compact = false }: CalendarEventCardProps) {
  const isPast = new Date(event.date) < new Date();

  if (compact) {
    return (
      <View style={[styles.compactEventCard, isPast && styles.calendarEventCardPast]}>
        <View style={styles.compactEventDot} />
        <View style={styles.compactEventInfo}>
          <Text style={styles.compactEventName} numberOfLines={1}>{event.name}</Text>
          <Text style={styles.compactEventTime}>{event.time}</Text>
        </View>
        <TouchableOpacity onPress={() => onRemove(event.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.calendarEventCard, isPast && styles.calendarEventCardPast]}>
      <View style={styles.calendarEventDate}>
        <Text style={styles.calendarEventDay}>
          {new Date(event.date + 'T00:00:00').getDate()}
        </Text>
        <Text style={styles.calendarEventMonth}>
          {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
        </Text>
      </View>
      <View style={styles.calendarEventInfo}>
        <Text style={styles.calendarEventName}>{event.name}</Text>
        <Text style={styles.calendarEventAddress} numberOfLines={1}>
          {event.address}
        </Text>
        <View style={styles.calendarEventTimeRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.calendarEventTime}>{event.time}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemove(event.id)}
      >
        <Ionicons name="close-circle" size={24} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

// Calendar Grid Component
type CalendarGridProps = {
  currentDate: Date;
  events: SavedEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function CalendarGrid({
  currentDate,
  events,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: CalendarGridProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date().toISOString().split('T')[0];

  // Create array of day cells
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // Get events for a specific date
  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  };

  const isToday = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === today;
  };

  const isSelected = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === selectedDate;
  };

  return (
    <View style={styles.calendarGrid}>
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={onPrevMonth} style={styles.monthNavButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={onNextMonth} style={styles.monthNavButton}>
          <Ionicons name="chevron-forward" size={24} color={colors.textDark} />
        </TouchableOpacity>
      </View>

      {/* Day Headers */}
      <View style={styles.dayHeaders}>
        {DAY_NAMES.map((day) => (
          <View key={day} style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Days */}
      <View style={styles.daysGrid}>
        {days.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const dayEvents = getEventsForDate(day);
          const hasEvents = dayEvents.length > 0;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayCell,
                isToday(day) && styles.dayCellToday,
                isSelected(day) && styles.dayCellSelected,
              ]}
              onPress={() => onSelectDate(dateStr)}
            >
              <Text
                style={[
                  styles.dayCellText,
                  isToday(day) && styles.dayCellTextToday,
                  isSelected(day) && styles.dayCellTextSelected,
                ]}
              >
                {day}
              </Text>
              {hasEvents && (
                <View style={styles.eventDots}>
                  {dayEvents.slice(0, 3).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.eventDot,
                        isSelected(day) && styles.eventDotSelected,
                      ]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function OpenMicFinderScreen({ navigation }: any) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [calendarView, setCalendarView] = useState<CalendarViewType>('calendar');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; venue: OpenMic | null }>({
    visible: false,
    venue: null,
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openMics, setOpenMics] = useState<OpenMic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingMics, setLoadingMics] = useState(true);

  const defaultRegion = {
    latitude: 41.8781,
    longitude: -87.6298,
    latitudeDelta: 0.3,
    longitudeDelta: 0.3,
  };

  // Fetch open mics from Supabase
  const fetchOpenMics = async (userLocation?: Location.LocationObject) => {
    setLoadingMics(true);
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('open_mics')
      .select('*');

    if (!error && data) {
      const mics: OpenMic[] = data.map((mic: any) => ({
        ...mic,
        distance:
          userLocation && mic.latitude && mic.longitude
            ? getDistanceMiles(
                userLocation.coords.latitude,
                userLocation.coords.longitude,
                mic.latitude,
                mic.longitude
              )
            : undefined,
      }));

      // Sort: recurring mics by days until next occurrence, one-time events by date
      mics.sort((a, b) => {
        const aDays = a.day_of_week ? daysUntilNext(a.day_of_week) : 0;
        const bDays = b.day_of_week ? daysUntilNext(b.day_of_week) : 0;
        if (aDays !== bDays) return aDays - bDays;
        return (a.event_time || '').localeCompare(b.event_time || '');
      });

      setOpenMics(mics);
    }
    setLoadingMics(false);
  };

  // Load saved events from storage
  useEffect(() => {
    loadSavedEvents();
  }, []);

  // Get location then fetch open mics
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let userLocation: Location.LocationObject | undefined;
      if (status === 'granted') {
        try {
          userLocation = await Location.getCurrentPositionAsync({});
          setLocation(userLocation);
        } catch (error) {
          console.log('Could not get location, using default');
        }
      }
      fetchOpenMics(userLocation);
    })();
  }, []);

  // Filter open mics by search query
  const filteredMics = openMics.filter((mic) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      mic.name.toLowerCase().includes(q) ||
      mic.address.toLowerCase().includes(q)
    );
  });

  const loadSavedEvents = async () => {
    try {
      const stored = await AsyncStorage.getItem(SAVED_EVENTS_KEY);
      if (stored) {
        setSavedEvents(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading saved events:', error);
    }
  };

  const saveSavedEvents = async (events: SavedEvent[]) => {
    try {
      await AsyncStorage.setItem(SAVED_EVENTS_KEY, JSON.stringify(events));
      setSavedEvents(events);
    } catch (error) {
      console.error('Error saving events:', error);
    }
  };

  const handleSignUpPress = (venue: OpenMic) => {
    const isAlreadySaved = savedEvents.some((e) => e.venueId === venue.id && e.date === venue.event_date);

    if (isAlreadySaved) {
      Alert.alert(
        'Already Signed Up',
        `You're already signed up for ${venue.name} on ${formatDate(venue.event_date)}.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setConfirmModal({ visible: true, venue });
  };

  const handleConfirmSignUp = async () => {
    if (!confirmModal.venue) return;

    const venue = confirmModal.venue;
    const newEvent: SavedEvent = {
      id: `${venue.id}-${venue.event_date}-${Date.now()}`,
      venueId: venue.id,
      name: venue.name,
      address: venue.address,
      date: venue.event_date,
      time: venue.event_time,
      savedAt: new Date().toISOString(),
    };

    const updatedEvents = [...savedEvents, newEvent].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    saveSavedEvents(updatedEvents);
    setConfirmModal({ visible: false, venue: null });

    // Create notification for event sign-up
    if (user) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'event_signup',
        title: 'Open Mic Sign-Up Confirmed! 🎤',
        body: `You're signed up for ${venue.name} on ${formatDate(venue.event_date)} at ${venue.event_time}`,
        data: {
          venue_id: venue.id,
          venue_name: venue.name,
          event_date: venue.event_date,
          event_time: venue.event_time,
        },
      });
    }

    Alert.alert(
      'Success! 🎭',
      `You're signed up for ${venue.name} on ${formatDate(venue.event_date)} at ${venue.event_time}!`,
      [
        { text: 'View Calendar', onPress: () => setActiveTab('calendar') },
        { text: 'OK' },
      ]
    );
  };

  const handleRemoveEvent = (eventId: string) => {
    Alert.alert(
      'Remove from Calendar',
      'Are you sure you want to remove this event from your calendar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedEvents = savedEvents.filter((e) => e.id !== eventId);
            saveSavedEvents(updatedEvents);
          },
        },
      ]
    );
  };

  const isVenueSaved = (venueId: string, eventDate: string) => {
    return savedEvents.some((e) => e.venueId === venueId && e.date === eventDate);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(selectedDate === date ? null : date);
  };

  const mapRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : defaultRegion;

  // Separate upcoming and past events
  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = savedEvents.filter((e) => e.date >= today);
  const pastEvents = savedEvents.filter((e) => e.date < today);

  // Events for selected date
  const selectedDateEvents = selectedDate
    ? savedEvents.filter((e) => e.date === selectedDate)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Ionicons
            name="search"
            size={18}
            color={activeTab === 'discover' ? '#fff' : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Find Open Mics
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={activeTab === 'calendar' ? '#fff' : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
            My Calendar
          </Text>
          {upcomingEvents.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{upcomingEvents.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'discover' ? (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or city"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={defaultRegion}
              region={mapRegion}
              showsUserLocation
              showsMyLocationButton
            >
              {openMics
                .filter((mic) => mic.latitude !== null && mic.longitude !== null)
                .map((mic) => (
                  <Marker
                    key={mic.id}
                    coordinate={{
                      latitude: mic.latitude!,
                      longitude: mic.longitude!,
                    }}
                    title={mic.name}
                    description={`${formatDate(mic.event_date)} at ${mic.event_time}`}
                    pinColor={colors.primary}
                  />
                ))}
            </MapView>
          </View>

          {/* Venue List */}
          <View style={styles.venueListContainer}>
            <Text style={styles.sectionTitle}>
              {searchQuery.trim()
                ? `Results for "${searchQuery}"`
                : 'Upcoming Open Mics'}
            </Text>
            <ScrollView style={styles.venueList} showsVerticalScrollIndicator={false}>
              {loadingMics ? (
                <View style={styles.loadingState}>
                  <Text style={styles.loadingText}>Finding open mics...</Text>
                </View>
              ) : filteredMics.length === 0 ? (
                <View style={styles.loadingState}>
                  <Text style={styles.loadingText}>
                    {searchQuery.trim()
                      ? 'No open mics match your search.'
                      : 'No upcoming open mics found.\nCheck back soon!'}
                  </Text>
                </View>
              ) : (
                filteredMics.map((mic) => (
                  <VenueCard
                    key={mic.id}
                    venue={mic}
                    onSignUp={handleSignUpPress}
                    isSaved={isVenueSaved(mic.id, mic.event_date)}
                  />
                ))
              )}
              <View style={styles.bottomPadding} />
            </ScrollView>
          </View>

          {/* Scan QR Button */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => navigation.navigate('CheckIn')}
          >
            <Ionicons name="qr-code" size={20} color="#fff" />
            <Text style={styles.scanButtonText}>Scan to check in</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Calendar View Toggle */}
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarHeaderTitle}>My Events</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleButton, calendarView === 'calendar' && styles.viewToggleButtonActive]}
                onPress={() => setCalendarView('calendar')}
              >
                <Ionicons
                  name="calendar"
                  size={18}
                  color={calendarView === 'calendar' ? '#fff' : colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleButton, calendarView === 'list' && styles.viewToggleButtonActive]}
                onPress={() => setCalendarView('list')}
              >
                <Ionicons
                  name="list"
                  size={18}
                  color={calendarView === 'list' ? '#fff' : colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {calendarView === 'calendar' ? (
            <ScrollView style={styles.calendarContainer} showsVerticalScrollIndicator={false}>
              {/* Calendar Grid */}
              <CalendarGrid
                currentDate={currentMonth}
                events={savedEvents}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
              />

              {/* Selected Date Events */}
              {selectedDate && (
                <View style={styles.selectedDateSection}>
                  <Text style={styles.selectedDateTitle}>
                    {formatFullDate(selectedDate)}
                  </Text>
                  {selectedDateEvents.length === 0 ? (
                    <Text style={styles.noEventsText}>No events on this day</Text>
                  ) : (
                    selectedDateEvents.map((event) => (
                      <CalendarEventCard
                        key={event.id}
                        event={event}
                        onRemove={handleRemoveEvent}
                        compact
                      />
                    ))
                  )}
                </View>
              )}

              {/* Quick Overview */}
              {!selectedDate && upcomingEvents.length > 0 && (
                <View style={styles.quickOverview}>
                  <Text style={styles.quickOverviewTitle}>Upcoming Events</Text>
                  {upcomingEvents.slice(0, 3).map((event) => (
                    <CalendarEventCard
                      key={event.id}
                      event={event}
                      onRemove={handleRemoveEvent}
                      compact
                    />
                  ))}
                  {upcomingEvents.length > 3 && (
                    <TouchableOpacity
                      style={styles.viewAllButton}
                      onPress={() => setCalendarView('list')}
                    >
                      <Text style={styles.viewAllText}>
                        View all {upcomingEvents.length} events
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={styles.bottomPadding} />
            </ScrollView>
          ) : (
            <ScrollView style={styles.calendarContainer} showsVerticalScrollIndicator={false}>
              {savedEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
                  <Text style={styles.emptyStateTitle}>No Events Yet</Text>
                  <Text style={styles.emptyStateText}>
                    Sign up for open mics to see them in your calendar
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => setActiveTab('discover')}
                  >
                    <Text style={styles.emptyStateButtonText}>Find Open Mics</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* Upcoming Events */}
                  {upcomingEvents.length > 0 && (
                    <View style={styles.calendarSection}>
                      <Text style={styles.calendarSectionTitle}>
                        📅 Upcoming ({upcomingEvents.length})
                      </Text>
                      {upcomingEvents.map((event) => (
                        <CalendarEventCard
                          key={event.id}
                          event={event}
                          onRemove={handleRemoveEvent}
                        />
                      ))}
                    </View>
                  )}

                  {/* Past Events */}
                  {pastEvents.length > 0 && (
                    <View style={styles.calendarSection}>
                      <Text style={styles.calendarSectionTitle}>
                        🕐 Past Events ({pastEvents.length})
                      </Text>
                      {pastEvents.map((event) => (
                        <CalendarEventCard
                          key={event.id}
                          event={event}
                          onRemove={handleRemoveEvent}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
              <View style={styles.bottomPadding} />
            </ScrollView>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <Modal visible={confirmModal.visible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="calendar" size={48} color={colors.primary} />
            </View>
            <Text style={styles.confirmTitle}>Sign Up for Open Mic?</Text>
            {confirmModal.venue && (
              <View style={styles.confirmDetails}>
                <Text style={styles.confirmVenue}>{confirmModal.venue.name}</Text>
                <Text style={styles.confirmDateTime}>
                  📅 {formatFullDate(confirmModal.venue.event_date)}
                </Text>
                <Text style={styles.confirmDateTime}>🕐 {confirmModal.venue.event_time}</Text>
                <Text style={styles.confirmAddress}>{confirmModal.venue.address}</Text>
              </View>
            )}
            <Text style={styles.confirmMessage}>
              This will be added to your calendar.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setConfirmModal({ visible: false, venue: null })}
              >
                <Text style={styles.confirmCancelText}>No, Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmYesButton}
                onPress={handleConfirmSignUp}
              >
                <Text style={styles.confirmYesText}>Yes, Sign Up!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  // Calendar Header
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  calendarHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  viewToggleButton: {
    width: 36,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  // Calendar Grid
  calendarGrid: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textDark,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayCellToday: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellText: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: '500',
  },
  dayCellTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  dayCellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  eventDots: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    gap: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  eventDotSelected: {
    backgroundColor: '#fff',
  },
  // Selected Date Section
  selectedDateSection: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  noEventsText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  // Compact Event Card
  compactEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  compactEventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 10,
  },
  compactEventInfo: {
    flex: 1,
  },
  compactEventName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  compactEventTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  // Quick Overview
  quickOverview: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  quickOverviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 12,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
  },
  // Map
  mapContainer: {
    height: 180,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  map: {
    flex: 1,
  },
  // Venue List
  venueListContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 12,
  },
  venueList: {
    flex: 1,
  },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 2,
  },
  venueAddress: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  venueDateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  dateTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  dateTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  signUpNotes: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  spotsLeft: {
    fontSize: 12,
    color: colors.textMuted,
  },
  signUpButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  signUpButtonSaved: {
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  signUpButtonTextSaved: {
    color: colors.primary,
  },
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomPadding: {
    height: 40,
  },
  scanButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Calendar Tab
  calendarContainer: {
    flex: 1,
  },
  calendarSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  calendarSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 12,
  },
  calendarEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  calendarEventCardPast: {
    opacity: 0.6,
  },
  calendarEventDate: {
    width: 50,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  calendarEventDay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  calendarEventMonth: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
  },
  calendarEventInfo: {
    flex: 1,
  },
  calendarEventName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 2,
  },
  calendarEventAddress: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  calendarEventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calendarEventTime: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Confirmation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModal: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    alignItems: 'center',
    width: '85%',
  },
  confirmIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(107, 142, 111, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 16,
  },
  confirmDetails: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  confirmVenue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  confirmDateTime: {
    fontSize: 15,
    color: colors.textDark,
    marginBottom: 4,
  },
  confirmAddress: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  confirmMessage: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  confirmYesButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmYesText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
