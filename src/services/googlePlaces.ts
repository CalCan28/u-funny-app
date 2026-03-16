const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyDdNWpM50n_0AKQKR3qhDaehhoNzZYVQuw';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

type GooglePlaceResult = {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  location: {
    latitude: number;
    longitude: number;
  };
};

type GooglePlacesResponse = {
  places?: GooglePlaceResult[];
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

export async function searchOpenMics(
  query: string,
  latitude?: number,
  longitude?: number,
): Promise<GooglePlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Google Places API key not configured');
    return [];
  }

  try {
    const body: Record<string, any> = {
      textQuery: query,
      pageSize: 20,
    };

    // Only add location bias if we have coordinates
    if (latitude !== undefined && longitude !== undefined) {
      body.locationBias = {
        circle: {
          center: { latitude, longitude },
          radius: 50000.0,
        },
      };
    }

    const response = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Google Places API error:', response.status);
      return [];
    }

    const data: GooglePlacesResponse = await response.json();
    return data.places ?? [];
  } catch (error) {
    console.error('Google Places search failed:', error);
    return [];
  }
}

export async function searchOpenMicsNearby(
  latitude: number,
  longitude: number,
): Promise<GooglePlaceResult[]> {
  return searchOpenMics('open mic comedy', latitude, longitude);
}

// Search by city/location name without GPS coordinates
export async function searchOpenMicsByCity(
  cityQuery: string,
): Promise<GooglePlaceResult[]> {
  // Clean up the query — extract the city/location part
  const cleaned = cityQuery
    .replace(/\b(open mic|comedy|stand[- ]?up|in|near|around)\b/gi, '')
    .trim();

  // If there's a city name left, search for comedy venues in that city
  // If the user just typed "comedy" or "open mic", search as-is
  const searchCity = cleaned.length >= 2 ? cleaned : cityQuery;

  // Run multiple searches to maximize results
  const queries = [
    `comedy club ${searchCity}`,
    `open mic ${searchCity}`,
    `comedy show ${searchCity}`,
  ];

  const allResults: GooglePlaceResult[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    const results = await searchOpenMics(query);
    for (const place of results) {
      if (!seenIds.has(place.id)) {
        seenIds.add(place.id);
        allResults.push(place);
      }
    }
  }

  return allResults;
}

export function convertGooglePlaceToOpenMic(place: GooglePlaceResult): OpenMic {
  return {
    id: `google_${place.id}`,
    name: place.displayName.text,
    address: place.formattedAddress,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    event_date: null,
    event_time: 'Check venue for times',
    spots_left: 0,
    day_of_week: null,
    sign_up_notes: 'Found via Google — contact venue for details',
  };
}

export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,#\-]/g, '')
    .replace(/\s+/g, ' ')
    .replace(
      /\b(street|st|avenue|ave|boulevard|blvd|drive|dr|road|rd|lane|ln|court|ct)\b/g,
      (match) => {
        const abbrevs: Record<string, string> = {
          street: 'st', st: 'st',
          avenue: 'ave', ave: 'ave',
          boulevard: 'blvd', blvd: 'blvd',
          drive: 'dr', dr: 'dr',
          road: 'rd', rd: 'rd',
          lane: 'ln', ln: 'ln',
          court: 'ct', ct: 'ct',
        };
        return abbrevs[match] || match;
      },
    )
    .trim();
}
