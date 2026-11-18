
import { Platform } from 'react-native';
import * as Location from 'expo-location';

// ======================================================
// WEATHER LABELS AND SIMULATION MODES
// ======================================================

export const CONDITION_LABEL = {
  clear: 'Clear Sky',
  cloudy: 'Cloudy',
  partlyCloudy: 'Partly Cloudy',
  rain: 'Rainy',
  drizzle: 'Light Rain',
  thunderstorm: 'Thunderstorm',
  snow: 'Snow',
  fog: 'Foggy',
  wind: 'Windy',
};

export const MODES = [
  { key: 'golden', label: 'Golden Hour' },
  { key: 'clear', label: 'Clear Sky' },
  { key: 'cloudy', label: 'Cloudy' },
  { key: 'rain', label: 'Rain' },
  { key: 'storm', label: 'Storm' },
  { key: 'night', label: 'Night' },
];

// ======================================================
// API CONFIGURATION
// ======================================================

const GEOCODING_URL =
  'https://geocoding-api.open-meteo.com/v1/search';

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast';

const REVERSE_GEOCODING_URL =
  'https://geocoding-api.open-meteo.com/v1/reverse';

const REQUEST_TIMEOUT = 15000;

// ======================================================
// HELPER FUNCTIONS
// ======================================================

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const pad = (value) => String(value).padStart(2, '0');

const getLocalMinutes = (dateString) => {
  if (!dateString) return 12 * 60;

  const match = String(dateString).match(/T(\d{2}):(\d{2})/);

  if (!match) return 12 * 60;

  return Number(match[1]) * 60 + Number(match[2]);
};

const formatTime = (dateString) => {
  if (!dateString) return '--:--';

  const match = String(dateString).match(/T(\d{2}):(\d{2})/);

  if (!match) return '--:--';

  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${suffix}`;
};

const formatDay = (dateString) => {
  if (!dateString) return '';

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
  });
};

const getCondition = (code, windSpeed = 0) => {
  if (code === 0) return 'clear';

  if (code === 1 || code === 2) return 'partlyCloudy';

  if (code === 3) return 'cloudy';

  if (code === 45 || code === 48) return 'fog';

  if (code >= 51 && code <= 57) return 'drizzle';

  if (code >= 61 && code <= 67) return 'rain';

  if (code >= 71 && code <= 77) return 'snow';

  if (code >= 80 && code <= 82) return 'rain';

  if (code >= 85 && code <= 86) return 'snow';

  if (code >= 95) return 'thunderstorm';

  if (windSpeed >= 30) return 'wind';

  return 'clear';
};

const getMood = (condition, hour, sunrise, sunset) => {
  if (condition === 'thunderstorm' || condition === 'rain') {
    return 'rain';
  }

  if (condition === 'snow') return 'snow';

  if (hour < sunrise || hour >= sunset) return 'night';

  if (hour >= sunrise && hour <= sunrise + 1) {
    return 'golden';
  }

  if (hour >= sunset - 1 && hour <= sunset) {
    return 'golden';
  }

  if (condition === 'cloudy' || condition === 'fog') {
    return 'cloudy';
  }

  return 'day';
};

const getGoldenHour = (sunrise, sunset) => {
  const sunriseMinutes = getLocalMinutes(sunrise);
  const sunsetMinutes = getLocalMinutes(sunset);

  return {
    sunrise: formatTime(sunrise),
    sunset: formatTime(sunset),
    srMin: sunriseMinutes,
    ssMin: sunsetMinutes,
    goldenStart: Math.max(0, sunriseMinutes - 30),
    goldenEnd: Math.min(1440, sunriseMinutes + 60),
    nowMin: getLocalMinutes(
      new Date().toISOString()
    ),
  };
};

const fetchJson = async (url) => {
  const controller =
    typeof AbortController !== 'undefined'
      ? new AbortController()
      : null;

  let timeout;

  try {
    if (controller) {
      timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT
      );
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) {
      throw new Error(
        `Weather service error (${response.status}). Please try again.`
      );
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }

    if (
      error instanceof TypeError ||
      error.message === 'Network request failed'
    ) {
      throw new Error(
        'Unable to connect. Please check your internet connection.'
      );
    }

    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

// ======================================================
// SEARCH A CITY
// ======================================================

export const searchPlace = async (query) => {
  const city = String(query || '').trim();

  if (!city) {
    throw new Error('Please enter a city name.');
  }

  const url =
    `${GEOCODING_URL}?name=${encodeURIComponent(city)}` +
    '&count=1&language=en&format=json';

  const data = await fetchJson(url);

  if (!data.results || data.results.length === 0) {
    throw new Error('Place not found. Try another city.');
  }

  const place = data.results[0];

  return {
    name: place.name,
    country: place.country || '',
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || 'auto',
    label: [place.name, place.country]
      .filter(Boolean)
      .join(', '),
  };
};

// ======================================================
// GET CURRENT LOCATION
// ======================================================

export const locateMe = async () => {
  try {
    let latitude;
    let longitude;
    let placeLabel = 'Your Location';

    if (Platform.OS === 'web') {
      if (
        typeof navigator === 'undefined' ||
        !navigator.geolocation
      ) {
        throw new Error(
          'Location is not supported by this browser.'
        );
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            if (error.code === 1) {
              reject(
                new Error(
                  'Location permission denied. Please allow location access in your browser.'
                )
              );
            } else if (error.code === 2) {
              reject(
                new Error('Your current location is unavailable.')
              );
            } else {
              reject(
                new Error(
                  'Location request timed out. Please try again.'
                )
              );
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 60000,
          }
        );
      });

      latitude = position.coords.latitude;
      longitude = position.coords.longitude;

      try {
        const reverseUrl =
          `${REVERSE_GEOCODING_URL}?latitude=${latitude}` +
          `&longitude=${longitude}&language=en&format=json`;

        const reverseData = await fetchJson(reverseUrl);

        if (reverseData.results?.length) {
          const result = reverseData.results[0];

          placeLabel = [
            result.name,
            result.admin1,
            result.country,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch (reverseError) {
        console.log(
          'Reverse geocoding unavailable:',
          reverseError.message
        );
      }
    } else {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        throw new Error(
          'Location permission denied. Please allow location access.'
        );
      }

      const position =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      latitude = position.coords.latitude;
      longitude = position.coords.longitude;

      try {
        const addresses =
          await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });

        if (addresses?.length) {
          const address = addresses[0];

          placeLabel = [
            address.city ||
              address.subregion ||
              address.district,
            address.region,
            address.country,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch (reverseError) {
        console.log(
          'Reverse geocoding unavailable:',
          reverseError.message
        );
      }
    }

    return {
      name: placeLabel,
      label: placeLabel,
      latitude,
      longitude,
      timezone: 'auto',
    };
  } catch (error) {
    console.log('Location error:', error);

    if (error.message) throw error;

    throw new Error(
      'Could not detect your location. Please try again.'
    );
  }
};

// ======================================================
// FETCH WEATHER DATA
// ======================================================

export const fetchWeather = async (place) => {
  if (!place) {
    throw new Error('Please select a location.');
  }

  const latitude = safeNumber(place.latitude, NaN);
  const longitude = safeNumber(place.longitude, NaN);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Invalid location coordinates.');
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index',
    hourly:
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
  });

  const data = await fetchJson(
    `${WEATHER_URL}?${params.toString()}`
  );

  if (!data.current || !data.hourly || !data.daily) {
    throw new Error('Weather data is currently unavailable.');
  }

  const current = data.current;
  const hourly = data.hourly;
  const daily = data.daily;

  const condition = getCondition(
    current.weather_code,
    current.wind_speed_10m
  );

  const sunrise = daily.sunrise?.[0];
  const sunset = daily.sunset?.[0];

  const sun = getGoldenHour(sunrise, sunset);

  const currentTime = current.time || new Date().toISOString();

  const currentMinutes = getLocalMinutes(currentTime);

  const currentHourIndex = Math.max(
    0,
    hourly.time.findIndex((time) => time >= currentTime)
  );

  const hourlyForecast = hourly.time
    .slice(currentHourIndex, currentHourIndex + 24)
    .map((time, index) => {
      const actualIndex = currentHourIndex + index;

      const temp = Math.round(
        safeNumber(hourly.temperature_2m?.[actualIndex])
      );

      const wind = Math.round(
        safeNumber(hourly.wind_speed_10m?.[actualIndex])
      );

      const hourCondition = getCondition(
        hourly.weather_code?.[actualIndex],
        wind
      );

      const hour = getLocalMinutes(time) / 60;

      return {
        time,
        label: formatTime(time),
        temp,
        temperature: temp,
        condition: hourCondition,
        wind,
        humidity: safeNumber(
          hourly.relative_humidity_2m?.[actualIndex]
        ),
        rain: safeNumber(
          hourly.precipitation_probability?.[actualIndex]
        ),
        uv: safeNumber(
          hourly.uv_index?.[actualIndex]
        ),
        mood: getMood(
          hourCondition,
          hour,
          sun.srMin / 60,
          sun.ssMin / 60
        ),
        min: getLocalMinutes(time),
      };
    });

  const weeklyForecast = daily.time.map((date, index) => {
    const dayCondition = getCondition(
      daily.weather_code?.[index]
    );

    return {
      date,
      day: formatDay(date),
      condition: dayCondition,
      temp: Math.round(
        safeNumber(daily.temperature_2m_max?.[index])
      ),
      hi: Math.round(
        safeNumber(daily.temperature_2m_max?.[index])
      ),
      lo: Math.round(
        safeNumber(daily.temperature_2m_min?.[index])
      ),
      uv: safeNumber(daily.uv_index_max?.[index]),
      rain: safeNumber(
        daily.precipitation_probability_max?.[index]
      ),
      growth: clamp(
        100 -
          safeNumber(
            daily.precipitation_probability_max?.[index]
          ) * 0.35,
        20,
        100
      ),
    };
  });

  const goldenText =
    currentMinutes >= sun.goldenStart &&
    currentMinutes <= sun.goldenEnd
      ? 'Golden hour is happening now'
      : 'Golden hour around sunrise';

  const result = {
    label: place.label || place.name || 'Your Location',
    name: place.name || place.label || 'Your Location',

    temp: Math.round(
      safeNumber(current.temperature_2m)
    ),

    feels: Math.round(
      safeNumber(current.apparent_temperature)
    ),

    humidity: Math.round(
      safeNumber(current.relative_humidity_2m)
    ),

    wind: Math.round(
      safeNumber(current.wind_speed_10m)
    ),

    uv: safeNumber(current.uv_index),

    condition,

    mood: getMood(
      condition,
      currentMinutes / 60,
      sun.srMin / 60,
      sun.ssMin / 60
    ),

    hi: Math.round(
      safeNumber(daily.temperature_2m_max?.[0])
    ),

    lo: Math.round(
      safeNumber(daily.temperature_2m_min?.[0])
    ),

    sunrise: sun.sunrise,
    sunset: sun.sunset,

    srMin: sun.srMin,
    ssMin: sun.ssMin,

    nowMin: currentMinutes,

    goldenStart: sun.goldenStart,
    goldenEnd: sun.goldenEnd,

    goldenText,

    hourly: hourlyForecast,
    weekly: weeklyForecast,

    growth: clamp(
      100 - safeNumber(current.relative_humidity_2m) * 0.3,
      20,
      100
    ),

    latitude,
    longitude,
    timezone: data.timezone || place.timezone || 'auto',

    updatedAt: current.time || new Date().toISOString(),
  };

  return result;
};

// ======================================================
// SIMULATION / DEMO WEATHER PRESETS
// ======================================================

export const getPreset = (presetKey = 'clear') => {
  const presets = {
    golden: {
      temp: 27,
      feels: 28,
      humidity: 58,
      wind: 8,
      uv: 3,
      condition: 'clear',
      hi: 29,
      lo: 21,
      sunrise: '6:05 AM',
      sunset: '5:30 PM',
      mood: 'golden',
      growth: 85,
    },

    clear: {
      temp: 28,
      feels: 29,
      humidity: 55,
      wind: 9,
      uv: 5,
      condition: 'clear',
      hi: 31,
      lo: 22,
      sunrise: '6:05 AM',
      sunset: '5:30 PM',
      mood: 'day',
      growth: 90,
    },

    cloudy: {
      temp: 24,
      feels: 25,
      humidity: 72,
      wind: 12,
      uv: 2,
      condition: 'cloudy',
      hi: 26,
      lo: 20,
      sunrise: '6:05 AM',
      sunset: '5:30 PM',
      mood: 'cloudy',
      growth: 75,
    },

    rain: {
      temp: 22,
      feels: 23,
      humidity: 88,
      wind: 16,
      uv: 1,
      condition: 'rain',
      hi: 24,
      lo: 19,
      sunrise: '6:05 AM',
      sunset: '5:30 PM',
      mood: 'rain',
      growth: 65,
    },

    storm: {
      temp: 20,
      feels: 19,
      humidity: 94,
      wind: 32,
      uv: 0,
      condition: 'thunderstorm',
      hi: 22,
      lo: 17,
      sunrise: '6:05 AM',
      sunset: '5:30 PM',
      mood: 'rain',
      growth: 45,
    },

    night: {
      temp: 18,
      feels: 17,
      humidity: 70,
      wind: 6,
      uv: 0,
      condition: 'clear',
      hi: 25,
      lo: 17,
      sunrise: '6:05 AM',
      sunset: '5:30 PM',
      mood: 'night',
      growth: 80,
    },
  };

  const selected = presets[presetKey] || presets.clear;

  const hourly = Array.from({ length: 24 }, (_, index) => {
    const hour = index;
    const daylight = Math.sin(
      ((hour - 6) / 12) * Math.PI
    );

    const temp = Math.round(
      selected.temp + daylight * 4
    );

    return {
      label: `${pad(hour)}:00`,
      time: `${pad(hour)}:00`,
      temp,
      temperature: temp,
      condition: selected.condition,
      wind: selected.wind,
      humidity: selected.humidity,
      rain:
        selected.condition === 'rain' ||
        selected.condition === 'thunderstorm'
          ? 75
          : 5,
      uv: selected.uv,
      mood: getMood(
        selected.condition,
        hour,
        6,
        17.5
      ),
      min: hour * 60,
    };
  });

  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    const dateString = [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-');

    return {
      date: dateString,
      day: formatDay(dateString),
      condition: selected.condition,
      temp: selected.hi,
      hi: selected.hi,
      lo: selected.lo,
      uv: selected.uv,
      rain:
        selected.condition === 'rain' ||
        selected.condition === 'thunderstorm'
          ? 70
          : 5,
      growth: selected.growth,
    };
  });

  return {
    label: 'Simulation Mode',
    name: 'Simulation Mode',

    ...selected,

    srMin: 365,
    ssMin: 1050,
    nowMin: 12 * 60,

    goldenStart: 335,
    goldenEnd: 425,

    goldenText: 'Golden hour simulation',

    hourly,
    weekly,

    updatedAt: new Date().toISOString(),
  };
};
