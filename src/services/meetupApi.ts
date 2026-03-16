const MEETUP_GQL_URL = 'https://api.meetup.com/gql-ext';
const MEETUP_OAUTH_TOKEN = process.env.EXPO_PUBLIC_MEETUP_OAUTH_TOKEN || '';
const GOOGLE_GEOCODING_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

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

type MeetupVenue = {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

type MeetupEvent = {
  id: string;
  title: string;
  dateTime: string;
  eventUrl: string;
  description: string | null;
  going: number;
  venue: MeetupVenue | null;
  group: {
    name: string;
  } | null;
};

type MeetupSearchResponse = {
  data?: {
    keywordSearch?: {
      edges: Array<{
        node: {
          result: MeetupEvent;
        };
      }>;
    };
  };
  errors?: Array<{ message: string }>;
};

const SEARCH_EVENTS_QUERY = `
  query SearchEvents($filter: KeywordSearchFilter!, $first: Int) {
    keywordSearch(filter: $filter, input: { first: $first }) {
      edges {
        node {
          result {
            ... on Event {
              id
              title
              dateTime
              eventUrl
              description
              going
              venue {
                name
                address
                city
                state
                lat
                lng
              }
              group {
                name
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Search Meetup for comedy / open mic events near a location.
 */
export async function searchMeetupEvents(
  query: string,
  latitude: number,
  longitude: number,
  radiusMiles: number = 25,
): Promise<MeetupEvent[]> {
  try {
    const keywords = `${query} open mic comedy stand-up`;

    const response = await fetch(MEETUP_GQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MEETUP_OAUTH_TOKEN
          ? { Authorization: `Bearer ${MEETUP_OAUTH_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        query: SEARCH_EVENTS_QUERY,
        variables: {
          filter: {
            query: keywords,
            source: 'EVENTS',
            lat: latitude,
            lon: longitude,
            radius: radiusMiles,
          },
          first: 30,
        },
      }),
    });

    if (!response.ok) {
      console.error(
        `[MeetupAPI] HTTP ${response.status}: ${response.statusText}`,
      );
      return [];
    }

    const json: MeetupSearchResponse = await response.json();

    if (json.errors && json.errors.length > 0) {
      console.error('[MeetupAPI] GraphQL errors:', json.errors);
      return [];
    }

    const edges = json.data?.keywordSearch?.edges ?? [];
    return edges.map((edge) => edge.node.result).filter(Boolean);
  } catch (error) {
    console.error('[MeetupAPI] searchMeetupEvents failed:', error);
    return [];
  }
}

/**
 * Geocode a city name via the Google Geocoding API, then search Meetup
 * for comedy / open mic events near those coordinates.
 */
export async function searchMeetupEventsByCity(
  cityQuery: string,
): Promise<MeetupEvent[]> {
  try {
    // Geocode the city first
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      cityQuery,
    )}&key=${GOOGLE_GEOCODING_API_KEY}`;

    const geoResponse = await fetch(geocodeUrl);
    if (!geoResponse.ok) {
      console.error(
        `[MeetupAPI] Geocoding HTTP ${geoResponse.status}: ${geoResponse.statusText}`,
      );
      return [];
    }

    const geoJson = await geoResponse.json();
    const location = geoJson.results?.[0]?.geometry?.location;

    if (!location) {
      console.error(
        '[MeetupAPI] Could not geocode city:',
        cityQuery,
        geoJson.status,
      );
      return [];
    }

    return searchMeetupEvents('open mic comedy', location.lat, location.lng);
  } catch (error) {
    console.error('[MeetupAPI] searchMeetupEventsByCity failed:', error);
    return [];
  }
}

/**
 * Convert a raw Meetup event into the app's OpenMic type.
 */
export function convertMeetupEventToOpenMic(event: MeetupEvent): OpenMic {
  const dt = new Date(event.dateTime);

  // Format time as "7:00 PM"
  const eventTime = dt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Date portion as YYYY-MM-DD
  const eventDate = dt.toISOString().split('T')[0];

  // Day of week
  const dayOfWeek = dt.toLocaleDateString('en-US', { weekday: 'long' });

  // Build a readable address from venue fields
  const venue = event.venue;
  const addressParts = [
    venue?.name,
    venue?.address,
    venue?.city,
    venue?.state,
  ].filter(Boolean);
  const address = addressParts.join(', ') || 'See Meetup for location';

  return {
    id: `meetup_${event.id}`,
    name: event.title,
    address,
    latitude: venue?.lat ?? null,
    longitude: venue?.lng ?? null,
    event_date: eventDate,
    event_time: eventTime,
    spots_left: 0,
    day_of_week: dayOfWeek,
    sign_up_notes: 'via Meetup \u2014 tap for details',
  };
}
