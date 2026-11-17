
export interface PositionstackResult {
  latitude: number;
  longitude: number;
  label: string;
  name: string;
  type: string;
  number?: string;
  street?: string;
  postal_code?: string;
  confidence: number;
  region: string;
  region_code: string;
  administrative_area?: string;
  neighbourhood?: string;
  country: string;
  country_code: string;
  map_url?: string;
}

export interface PositionstackResponse {
  data: PositionstackResult[];
}

/**
 * Fetches forward geocoding data from Positionstack.
 * Designed for server-side usage.
 * 
 * @param query - The address or place name to geocode
 * @returns A promise that resolves to an array of geocoding results
 */
const GEOCODE_TIMEOUT_MS = 6000;

export async function forwardGeocode(query: string): Promise<PositionstackResult[]> {
  const positionstackKey = process.env.POSITIONSTACK_API_KEY;
  const apilayerKey = process.env.APILAYER_API_KEY;
  const apiKey = positionstackKey || apilayerKey;
  const encodedQuery = encodeURIComponent(query);

  if (apiKey) {
    // 1. Try APILayer gateway
    try {
      const apilayerUrl = `https://api.apilayer.com/positionstack_api/forward?query=${encodedQuery}&limit=20`;
      const response = await fetch(apilayerUrl, {
        headers: { 'apikey': apilayerKey || apiKey },
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS)
      });
      
      if (response.ok) {
        const data: PositionstackResponse = await response.json();
        if (data && data.data) return data.data;
      }
    } catch {
      console.warn('APILayer forward geocode failed or timed out, trying direct...');
    }

    // 2. Fallback to Direct Positionstack API
    const directUrl = `http://api.positionstack.com/v1/forward?access_key=${positionstackKey || apiKey}&query=${encodedQuery}&limit=20`;
    try {
      const response = await fetch(directUrl, {
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS)
      });
      if (response.ok) {
        const data: PositionstackResponse = await response.json();
        return data?.data || [];
      }
    } catch {
      // Fallback silently without leaking URL/key
    }
  }

  // 3. Fallback to Nominatim (OpenStreetMap) if keys missing or APIs failed
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=20`, {
      headers: { 'User-Agent': 'AvartahProspectFinder/3.0 (contact@avartah.com)' },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS)
    });
    if (response.ok) {
      const data = await response.json();
      return (Array.isArray(data) ? data : []).map((item: any) => ({
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        label: item.display_name,
        name: item.name || item.display_name?.split(',')[0] || query,
        type: item.type || 'business',
        confidence: 1,
        region: '',
        region_code: '',
        country: '',
        country_code: ''
      }));
    }
  } catch (error) {
    console.error('Nominatim fallback failed:', error instanceof Error ? error.message : 'Request failed');
  }

  throw new Error('All geocoding services failed. Please configure a valid API key.');
}

/**
 * Fetches reverse geocoding data from Positionstack.
 * 
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns A promise that resolves to an array of address results
 */
export async function reverseGeocode(lat: number, lng: number): Promise<PositionstackResult[]> {
  const positionstackKey = process.env.POSITIONSTACK_API_KEY;
  const apilayerKey = process.env.APILAYER_API_KEY;
  const apiKey = positionstackKey || apilayerKey;

  if (apiKey) {
    // 1. Try APILayer gateway
    try {
      const apilayerUrl = `https://api.apilayer.com/positionstack_api/reverse?query=${lat},${lng}`;
      const response = await fetch(apilayerUrl, {
        headers: { 'apikey': apilayerKey || apiKey },
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS)
      });
  
      if (response.ok) {
        const data: PositionstackResponse = await response.json();
        if (data && data.data) return data.data;
      }
    } catch {
      console.warn('APILayer reverse geocode failed or timed out, trying direct...');
    }
  
    // 2. Fallback to Direct Positionstack API
    const directUrl = `http://api.positionstack.com/v1/reverse?access_key=${positionstackKey || apiKey}&query=${lat},${lng}`;
    try {
      const response = await fetch(directUrl, {
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS)
      });
      if (response.ok) {
        const data: PositionstackResponse = await response.json();
        return data?.data || [];
      }
    } catch {
      // Fallback silently without leaking URL/key
    }
  }

  // 3. Fallback to Nominatim (OpenStreetMap) if keys missing or APIs failed
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'User-Agent': 'AvartahProspectFinder/3.0 (contact@avartah.com)' },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS)
    });
    if (response.ok) {
      const data = await response.json();
      return [{
        latitude: parseFloat(data.lat),
        longitude: parseFloat(data.lon),
        label: data.display_name,
        name: data.name || data.display_name?.split(',')[0] || '',
        type: data.type || 'business',
        confidence: 1,
        region: '',
        region_code: '',
        country: '',
        country_code: ''
      }];
    }
  } catch (error) {
    console.error('Nominatim fallback failed:', error instanceof Error ? error.message : 'Request failed');
  }

  throw new Error('All geocoding services failed. Please configure a valid API key.');
}
