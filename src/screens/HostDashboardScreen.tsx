import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { containsOffensiveContent } from '../services/moderationService';

// Design colors matching the app
const colors = {
  background: '#f5f1e8',
  cardBg: '#fdfcfa',
  cardBorder: '#d9d1c3',
  primary: '#6b8e6f',
  accent: '#e8b944',
  textDark: '#5c4a3a',
  textMuted: '#9b8b7a',
  error: '#d9534f',
  success: '#5cb85c',
};

// US States for picker
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Generate random room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Format date for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Format time for display
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

type EventData = {
  id?: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  eventDate: Date;
  eventTime: Date;
  roomCode: string;
  description: string;
};

type SavedEvent = {
  id: string;
  venue_name: string;
  address: string;
  city: string;
  state: string;
  event_date: string;
  event_time: string;
  room_code: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

type OpenMicVenue = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  event_time: string;
  day_of_week?: string | null;
  sign_up_notes?: string | null;
};

export default function HostDashboardScreen({ navigation }: any) {
  const [eventData, setEventData] = useState<EventData>({
    venueName: '',
    address: '',
    city: '',
    state: '',
    eventDate: new Date(),
    eventTime: new Date(),
    roomCode: generateRoomCode(),
    description: '',
  });

  const [showQRModal, setShowQRModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

  const qrRef = useRef<any>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [venueResults, setVenueResults] = useState<OpenMicVenue[]>([]);
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false);

  // Load saved events on mount
  useEffect(() => {
    loadSavedEvents();
  }, []);

  const loadSavedEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', user.id)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setSavedEvents(data || []);
    } catch (error) {
      // Sentry captures this automatically
    }
  };

  const searchVenues = useCallback((query: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) {
      setVenueResults([]);
      setShowVenueSuggestions(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('open_mics')
          .select('id, name, address, latitude, longitude, event_time, day_of_week, sign_up_notes')
          .ilike('name', `%${query}%`)
          .limit(5);
        if (!error && data && data.length > 0) {
          setVenueResults(data);
          setShowVenueSuggestions(true);
        } else {
          setVenueResults([]);
          setShowVenueSuggestions(false);
        }
      } catch {
        setVenueResults([]);
        setShowVenueSuggestions(false);
      }
    }, 300);
  }, []);

  const handleSelectVenue = (venue: OpenMicVenue) => {
    // Parse city and state from address (format: "123 Main St, Chicago, IL 60601" or similar)
    let city = '';
    let state = '';
    let streetAddress = venue.address;

    const parts = venue.address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      streetAddress = parts[0];
      city = parts[1];
      // State might be "IL 60601" — extract just the state abbreviation
      const stateMatch = parts[2].match(/^([A-Z]{2})/);
      if (stateMatch) state = stateMatch[1];
    } else if (parts.length === 2) {
      streetAddress = parts[0];
      const stateMatch = parts[1].match(/^([A-Z]{2})/);
      if (stateMatch) {
        state = stateMatch[1];
      } else {
        city = parts[1];
      }
    }

    // Parse event time
    let eventTime = new Date();
    if (venue.event_time) {
      const timeParts = venue.event_time.match(/(\d+):(\d+)/);
      if (timeParts) {
        eventTime.setHours(parseInt(timeParts[1]), parseInt(timeParts[2]), 0, 0);
      }
    }

    // Build description from day_of_week + sign_up_notes
    let description = '';
    if (venue.day_of_week) description += `Every ${venue.day_of_week}`;
    if (venue.sign_up_notes) {
      description += description ? '. ' : '';
      description += venue.sign_up_notes;
    }

    setEventData(prev => ({
      ...prev,
      venueName: venue.name,
      address: streetAddress,
      city,
      state,
      eventTime,
      description,
    }));

    setShowVenueSuggestions(false);
    setVenueResults([]);
  };

  const handleVenueNameChange = (text: string) => {
    setEventData(prev => ({ ...prev, venueName: text }));
    searchVenues(text);
  };

  const validateForm = () => {
    if (!eventData.venueName.trim()) {
      Alert.alert('Missing Info', 'Please enter the venue name');
      return false;
    }
    if (!eventData.address.trim()) {
      Alert.alert('Missing Info', 'Please enter the address');
      return false;
    }
    if (!eventData.city.trim()) {
      Alert.alert('Missing Info', 'Please enter the city');
      return false;
    }
    if (!eventData.state) {
      Alert.alert('Missing Info', 'Please select a state');
      return false;
    }
    return true;
  };

  const generateDeepLink = () => {
    return `ufunny://join-event?room=${eventData.roomCode}`;
  };

  const generateQRUrl = () => {
    // Build a proper HTTPS URL with all event data for iPhone camera compatibility
    const params = new URLSearchParams({
      room: eventData.roomCode,
      venue: eventData.venueName,
      address: eventData.address,
      city: eventData.city,
      state: eventData.state,
      date: eventData.eventDate.toISOString().split('T')[0],
      time: eventData.eventTime.toTimeString().split(' ')[0].slice(0, 5),
    });

    const url = `https://ufunny.app/join?${params.toString()}`;
    return url;
  };

  const generateWebLink = () => {
    // Fallback web URL for users who don't have the app
    return `https://ufunny.app/join?room=${eventData.roomCode}`;
  };

  const handleGenerateQR = () => {
    if (!validateForm()) return;
    setShowQRModal(true);
  };

  const handleSaveEvent = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to save events');
        return;
      }

      const textToCheck = [eventData.venueName, eventData.description].filter(Boolean).join(' ');
      if (containsOffensiveContent(textToCheck)) {
        Alert.alert('Content Not Allowed', 'Your event contains language that violates our Community Guidelines. Please revise.');
        setIsSaving(false);
        return;
      }

      // Geocode the address to get lat/lon for map display
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const fullAddress = `${eventData.address.trim()}, ${eventData.city.trim()}, ${eventData.state}`;
        const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyDdNWpM50n_0AKQKR3qhDaehhoNzZYVQuw';
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_API_KEY}`;
        const geoResponse = await fetch(geocodeUrl);
        const geoData = await geoResponse.json();
        if (geoData.results && geoData.results.length > 0) {
          latitude = geoData.results[0].geometry.location.lat;
          longitude = geoData.results[0].geometry.location.lng;
        }
      } catch {
        // Geocoding failed — save without coordinates
      }

      const eventPayload: Record<string, any> = {
        host_id: user.id,
        venue_name: eventData.venueName.trim(),
        address: eventData.address.trim(),
        city: eventData.city.trim(),
        state: eventData.state,
        event_date: eventData.eventDate.toISOString().split('T')[0],
        event_time: eventData.eventTime.toTimeString().split(' ')[0].slice(0, 5),
        room_code: eventData.roomCode,
        description: eventData.description.trim(),
      };

      // Add coordinates if geocoding succeeded
      if (latitude !== null && longitude !== null) {
        eventPayload.latitude = latitude;
        eventPayload.longitude = longitude;
      }

      let data: any;
      let error: any;

      if (eventData.id) {
        // Editing an existing event — update it
        ({ data, error } = await supabase
          .from('events')
          .update(eventPayload)
          .eq('id', eventData.id)
          .select()
          .single());
      } else {
        // Creating a new event
        ({ data, error } = await supabase
          .from('events')
          .insert(eventPayload)
          .select()
          .single());
      }

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - active room code already exists
          const newCode = generateRoomCode();
          setEventData(prev => ({ ...prev, roomCode: newCode }));
          Alert.alert('Room Code Taken', 'Generated a new room code. Please try again.');
        } else {
          throw error;
        }
        return;
      }

      Alert.alert('Success!', 'Event saved successfully. You can now share the QR code.');
      setEventData(prev => ({ ...prev, id: data.id }));
      loadSavedEvents();
      setShowQRModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    const link = generateDeepLink();
    await Clipboard.setStringAsync(link);
    Alert.alert('Copied!', 'Deep link copied to clipboard');
  };

  const handleCopyWebLink = async () => {
    const link = generateWebLink();
    await Clipboard.setStringAsync(link);
    Alert.alert('Copied!', 'Web link copied to clipboard');
  };

  const handleShareQR = async () => {
    if (!qrRef.current) return;

    setIsLoading(true);
    try {
      // Get QR code as base64
      qrRef.current.toDataURL(async (dataURL: string) => {
        const filename = `${FileSystem.cacheDirectory}ufunny_qr_${eventData.roomCode}.png`;

        // Convert base64 to file
        await FileSystem.writeAsStringAsync(filename, dataURL, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filename, {
            mimeType: 'image/png',
            dialogTitle: `U Funny Event: ${eventData.venueName}`,
          });
        } else {
          Alert.alert('Sharing not available', 'Sharing is not available on this device');
        }
        setIsLoading(false);
      });
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Failed to share QR code');
    }
  };

  const handleSaveToPhotos = async () => {
    if (!qrRef.current) return;

    setIsLoading(true);
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save photos');
        setIsLoading(false);
        return;
      }

      // Get QR code as base64
      qrRef.current.toDataURL(async (dataURL: string) => {
        const filename = `${FileSystem.cacheDirectory}ufunny_qr_${eventData.roomCode}.png`;

        // Convert base64 to file
        await FileSystem.writeAsStringAsync(filename, dataURL, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Save to media library
        const asset = await MediaLibrary.createAssetAsync(filename);
        await MediaLibrary.createAlbumAsync('U Funny', asset, false);

        Alert.alert('Saved!', 'QR code saved to your photos in the "U Funny" album');
        setIsLoading(false);
      });
    } catch (error) {
      setIsLoading(false);
      Alert.alert('Error', 'Failed to save QR code');
    }
  };

  const handleRegenerateCode = () => {
    const newCode = generateRoomCode();
    setEventData(prev => ({ ...prev, roomCode: newCode }));
  };

  const handleLoadEvent = (event: SavedEvent) => {
    const eventDate = new Date(event.event_date + 'T00:00:00');
    const [hours, minutes] = event.event_time.split(':');
    const eventTime = new Date();
    eventTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    setEventData({
      id: event.id,
      venueName: event.venue_name,
      address: event.address,
      city: event.city,
      state: event.state,
      eventDate,
      eventTime,
      roomCode: event.room_code,
      description: event.description || '',
    });
    setActiveTab('create');
  };

  const handleReuseEvent = async (event: SavedEvent) => {
    Alert.alert(
      'Start Next Event',
      `Create a new event at ${event.venue_name} with the same QR code? The previous event will be marked as past.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Next Event',
          onPress: async () => {
            setIsSaving(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Error', 'Please sign in');
                return;
              }

              // Deactivate old event
              await supabase
                .from('events')
                .update({ is_active: false })
                .eq('id', event.id);

              // Create new event with same room_code and venue details
              const today = new Date();
              const { data, error } = await supabase
                .from('events')
                .insert({
                  host_id: user.id,
                  venue_name: event.venue_name,
                  address: event.address,
                  city: event.city,
                  state: event.state,
                  event_date: today.toISOString().split('T')[0],
                  event_time: event.event_time,
                  room_code: event.room_code,
                  description: event.description || '',
                })
                .select()
                .single();

              if (error) throw error;

              // Load the new event into the form and show QR
              handleLoadEvent(data);
              loadSavedEvents();
              setShowQRModal(true);

              Alert.alert('Event Created!', 'New event started with the same QR code. Your old QR still works!');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to create new event');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteEvent = async (eventId: string) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', eventId);

              if (error) throw error;
              loadSavedEvents();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  // Simple date picker simulation (in production, use @react-native-community/datetimepicker)
  const renderDatePicker = () => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    return (
      <Modal visible={showDatePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {dates.map((date, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.pickerItem,
                    eventData.eventDate.toDateString() === date.toDateString() && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setEventData(prev => ({ ...prev, eventDate: date }));
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    eventData.eventDate.toDateString() === date.toDateString() && styles.pickerItemTextActive,
                  ]}>
                    {formatDate(date)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Simple time picker simulation
  const renderTimePicker = () => {
    const times: Date[] = [];
    for (let hour = 17; hour <= 23; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        times.push(time);
      }
    }
    // Add late night times
    for (let hour = 0; hour <= 2; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        times.push(time);
      }
    }

    return (
      <Modal visible={showTimePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Time</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {times.map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.pickerItem,
                    eventData.eventTime.getHours() === time.getHours() &&
                    eventData.eventTime.getMinutes() === time.getMinutes() && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setEventData(prev => ({ ...prev, eventTime: time }));
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    eventData.eventTime.getHours() === time.getHours() &&
                    eventData.eventTime.getMinutes() === time.getMinutes() && styles.pickerItemTextActive,
                  ]}>
                    {formatTime(time)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host Dashboard</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.tabActive]}
          onPress={() => setActiveTab('create')}
        >
          <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>
            Create Event
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'manage' && styles.tabActive]}
          onPress={() => setActiveTab('manage')}
        >
          <Text style={[styles.tabText, activeTab === 'manage' && styles.tabTextActive]}>
            My Events ({savedEvents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'create' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Venue Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 Venue Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Venue Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., The Comedy Store"
                placeholderTextColor={colors.textMuted}
                value={eventData.venueName}
                onChangeText={handleVenueNameChange}
                onBlur={() => setTimeout(() => setShowVenueSuggestions(false), 200)}
              />
              {showVenueSuggestions && venueResults.length > 0 && (
                <View style={styles.suggestionsDropdown}>
                  {venueResults.map(venue => (
                    <TouchableOpacity
                      key={venue.id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectVenue(venue)}
                    >
                      <Text style={styles.suggestionName}>{venue.name}</Text>
                      <Text style={styles.suggestionAddress} numberOfLines={1}>{venue.address}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 8433 Sunset Blvd"
                placeholderTextColor={colors.textMuted}
                value={eventData.address}
                onChangeText={(text) => setEventData(prev => ({ ...prev, address: text }))}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 2, marginRight: 12 }]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Los Angeles"
                  placeholderTextColor={colors.textMuted}
                  value={eventData.city}
                  onChangeText={(text) => setEventData(prev => ({ ...prev, city: text }))}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>State *</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowStateModal(true)}
                >
                  <Text style={[styles.selectText, !eventData.state && styles.selectPlaceholder]}>
                    {eventData.state || 'Select'}
                  </Text>
                  <Text style={styles.selectArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Event Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Event Details</Text>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Date *</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.selectText}>{formatDate(eventData.eventDate)}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Time *</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.selectText}>{formatTime(eventData.eventTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., Weekly open mic, 5 min sets, sign up at 7pm"
                placeholderTextColor={colors.textMuted}
                value={eventData.description}
                onChangeText={(text) => setEventData(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Room Code Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔑 Room Code</Text>
            <View style={styles.roomCodeContainer}>
              <Text style={styles.roomCode}>{eventData.roomCode}</Text>
              <TouchableOpacity style={styles.regenerateButton} onPress={handleRegenerateCode}>
                <Text style={styles.regenerateText}>🔄 New Code</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.roomCodeHint}>
              Comedians will use this code to join your event
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
              onPress={handleSaveEvent}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>💾 Save & Generate QR</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleGenerateQR}
            >
              <Text style={styles.secondaryButtonText}>👁 Preview QR Code</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {savedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No Events Yet</Text>
              <Text style={styles.emptyText}>
                Create your first event to generate a QR code for comedians to scan
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setActiveTab('create')}
              >
                <Text style={styles.emptyButtonText}>Create Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            savedEvents.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View>
                    <Text style={styles.eventVenue}>{event.venue_name}</Text>
                    <Text style={styles.eventLocation}>
                      {event.city}, {event.state}
                    </Text>
                  </View>
                  <View style={[styles.eventBadge, !event.is_active && styles.eventBadgeInactive]}>
                    <Text style={styles.eventBadgeText}>
                      {event.is_active ? 'Active' : 'Past'}
                    </Text>
                  </View>
                </View>

                <View style={styles.eventDetails}>
                  <Text style={styles.eventDate}>
                    📅 {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.eventTime}>
                    🕐 {event.event_time.slice(0, 5)}
                  </Text>
                  <Text style={styles.eventCode}>
                    🔑 {event.room_code}
                  </Text>
                </View>

                <View style={styles.eventActions}>
                  <TouchableOpacity
                    style={styles.eventActionButton}
                    onPress={() => handleLoadEvent(event)}
                  >
                    <Text style={styles.eventActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.eventActionButton}
                    onPress={() => {
                      handleLoadEvent(event);
                      setShowQRModal(true);
                    }}
                  >
                    <Text style={styles.eventActionText}>QR Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.eventActionButton, styles.eventActionDelete]}
                    onPress={() => handleDeleteEvent(event.id)}
                  >
                    <Text style={styles.eventActionDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
                {!event.is_active && (
                  <TouchableOpacity
                    style={[styles.eventActionButton, styles.eventActionReuse, { marginTop: 8 }]}
                    onPress={() => handleReuseEvent(event)}
                  >
                    <Text style={styles.eventActionReuseText}>🔄 Start Next Event (Same QR)</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* State Picker Modal */}
      <Modal visible={showStateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setShowStateModal(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {US_STATES.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={[styles.pickerItem, eventData.state === state && styles.pickerItemActive]}
                  onPress={() => {
                    setEventData(prev => ({ ...prev, state }));
                    setShowStateModal(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    eventData.state === state && styles.pickerItemTextActive,
                  ]}>
                    {state}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {renderDatePicker()}

      {/* Time Picker Modal */}
      {renderTimePicker()}

      {/* QR Code Modal */}
      <Modal visible={showQRModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModal}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrTitle}>Event QR Code</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <Text style={styles.qrClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrContent}>
              <View style={styles.qrContainer}>
                <QRCode
                  value={generateQRUrl()}
                  size={220}
                  color={colors.textDark}
                  backgroundColor={colors.cardBg}
                  getRef={(ref) => (qrRef.current = ref)}
                />
              </View>
              <Text style={styles.qrUrlDebug} numberOfLines={3}>
                {generateQRUrl()}
              </Text>

              <View style={styles.qrInfo}>
                <Text style={styles.qrVenue}>{eventData.venueName}</Text>
                <Text style={styles.qrLocation}>
                  {eventData.city}, {eventData.state}
                </Text>
                <Text style={styles.qrDateTime}>
                  {formatDate(eventData.eventDate)} at {formatTime(eventData.eventTime)}
                </Text>
                <View style={styles.qrCodeBadge}>
                  <Text style={styles.qrCodeText}>Room: {eventData.roomCode}</Text>
                </View>
              </View>
            </View>

            <View style={styles.qrActions}>
              <TouchableOpacity
                style={[styles.qrActionButton, styles.qrActionPrimary]}
                onPress={handleSaveToPhotos}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.qrActionPrimaryText}>📷 Save to Photos</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qrActionButton}
                onPress={handleShareQR}
                disabled={isLoading}
              >
                <Text style={styles.qrActionText}>↗️ Share QR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qrActionButton}
                onPress={handleCopyLink}
              >
                <Text style={styles.qrActionText}>🔗 Copy Deep Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qrActionButton}
                onPress={handleCopyWebLink}
              >
                <Text style={styles.qrActionText}>🌐 Copy Web Link</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.qrHint}>
              Print this QR code or display it at your venue. Comedians scan it to join the lineup!
            </Text>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  selectButton: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 16,
    color: colors.textDark,
  },
  selectPlaceholder: {
    color: colors.textMuted,
  },
  selectArrow: {
    fontSize: 12,
    color: colors.textMuted,
  },
  roomCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 4,
  },
  regenerateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  regenerateText: {
    fontSize: 14,
    color: colors.textDark,
  },
  roomCodeHint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomPadding: {
    height: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  pickerList: {
    padding: 16,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: colors.primary,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.textDark,
  },
  pickerItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // QR Modal styles
  qrModal: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  qrClose: {
    fontSize: 24,
    color: colors.textMuted,
    padding: 4,
  },
  qrContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrContainer: {
    backgroundColor: colors.cardBg,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  qrUrlDebug: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  qrInfo: {
    alignItems: 'center',
  },
  qrVenue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 4,
  },
  qrLocation: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 4,
  },
  qrDateTime: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 12,
  },
  qrCodeBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  qrActions: {
    gap: 10,
  },
  qrActionButton: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  qrActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  qrActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  qrActionPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  qrHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textDark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Event cards
  eventCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventVenue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  eventLocation: {
    fontSize: 14,
    color: colors.textMuted,
  },
  eventBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventBadgeInactive: {
    backgroundColor: colors.textMuted,
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  eventDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  eventDate: {
    fontSize: 14,
    color: colors.textDark,
  },
  eventTime: {
    fontSize: 14,
    color: colors.textDark,
  },
  eventCode: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },
  eventActionButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  eventActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  eventActionDelete: {
    backgroundColor: 'rgba(217, 83, 79, 0.1)',
    borderColor: colors.error,
  },
  eventActionDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  eventActionReuse: {
    backgroundColor: 'rgba(107, 142, 111, 0.1)',
    borderColor: colors.primary,
  },
  eventActionReuseText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  // Venue suggestions dropdown
  suggestionsDropdown: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 2,
  },
  suggestionAddress: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
