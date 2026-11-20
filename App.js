
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';

import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans';

import BonsaiView from './src/BonsaiView';

import GlassCard, {
  Button,
  FilterChip,
  MoodChip,
  SearchBar,
  ThemeToggle,
} from './src/GlassCard';

import HourlyStrip from './src/HourlyStrip';
import WeeklyForecast from './src/WeeklyForecast';
import SolarArc from './src/SolarArc';
import WeatherIcon from './src/WeatherIcon';

import {
  locateMe,
  searchPlace,
  fetchWeather,
  getPreset,
  MODES,
  CONDITION_LABEL,
} from './src/weather';

import {
  type,
  ThemeProvider,
  useTheme,
} from './src/theme';


// ======================================================
// CONSTANTS
// ======================================================

const TOP = 150;

const uvLevel = (u) =>
  u < 3
    ? 'Low'
    : u < 6
      ? 'Moderate'
      : u < 8
        ? 'High'
        : u < 11
          ? 'Very high'
          : 'Extreme';


// ======================================================
// MAIN APP
// ======================================================

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}


// ======================================================
// ROOT COMPONENT
// ======================================================

function Root() {
  const { t, mode } = useTheme();

  const [loaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    PlusJakartaSans_400Regular,
  });

  const { height } = useWindowDimensions();

  const treeH = Math.round(height * 0.36);


  // ----------------------------------------------------
  // APP STATES
  // ----------------------------------------------------

  const [phase, setPhase] = useState('intro');

  const [liveOn, setLiveOn] = useState(true);

  const [presetKey, setPresetKey] = useState('golden');

  const [live, setLive] = useState(null);

  const [sel, setSel] = useState(null);

  const [err, setErr] = useState('');

  const [loading, setLoading] = useState(false);

  const [treeStage, setTreeStage] = useState(null);


  // ----------------------------------------------------
  // REFERENCES
  // ----------------------------------------------------

  const bonsaiRef = useRef(null);

  const progress = useRef(
    new Animated.Value(0)
  ).current;

  const pulse = useRef(
    new Animated.Value(0.4)
  ).current;

  const started = useRef(false);


  // ----------------------------------------------------
  // WEATHER LOADING
  // ----------------------------------------------------

  const load = async (placePromise) => {
    if (loading) return;

    setErr('');
    setLoading(true);

    try {
      const place = await placePromise;

      const weather = await fetchWeather(place);

      setLive(weather);
      setLiveOn(true);

      setSel(null);
      setTreeStage(null);

      bonsaiRef.current?.clearStage?.();

    } catch (error) {
      console.log('Weather/location error:', error);

      setErr(
        error?.message ||
        'Could not load weather. Please try again.'
      );

    } finally {
      setLoading(false);
    }
  };


  // ----------------------------------------------------
  // CITY SEARCH
  // ----------------------------------------------------

  const handleSearch = (query) => {
    const city = String(query || '').trim();

    if (!city) {
      setErr('Please enter a city name.');
      return;
    }

    if (loading) return;

    load(searchPlace(city));
  };


  // ----------------------------------------------------
  // CURRENT LOCATION
  // ----------------------------------------------------

  const handleLocation = () => {
    if (loading) return;

    load(locateMe());
  };


  // ----------------------------------------------------
  // LOAD WEATHER WHEN APP STARTS
  // ----------------------------------------------------

  useEffect(() => {
    load(locateMe());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ----------------------------------------------------
  // PULSE ANIMATION
  // ----------------------------------------------------

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),

        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);


  // ----------------------------------------------------
  // INTRO TO HERO ANIMATION
  // ----------------------------------------------------

  const goHero = () => {
    if (started.current) return;

    started.current = true;

    setPhase('hero');

    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };


  // Safety timer in case BonsaiView does not call onDone

  useEffect(() => {
    const timer = setTimeout(goHero, 9000);

    return () => clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ----------------------------------------------------
  // BONSAI GROWTH STAGES
  // ----------------------------------------------------

  const handleStageSelect = (day) => {
    if (treeStage === day) {
      setTreeStage(null);

      bonsaiRef.current?.clearStage?.();

    } else {
      setTreeStage(day);

      bonsaiRef.current?.setStage?.(day);
    }
  };


  // ----------------------------------------------------
  // RESET BONSAI
  // ----------------------------------------------------

  const handleReset = () => {
    setTreeStage(null);

    bonsaiRef.current?.reset?.();
  };


  // ----------------------------------------------------
  // WEATHER DATA
  // ----------------------------------------------------

  const data = useMemo(() => {
    if (liveOn && live) {
      return live;
    }

    return getPreset(
      liveOn ? 'clear' : presetKey
    );

  }, [liveOn, live, presetKey]);


  // Reset selected hour when weather changes

  useEffect(() => {
    setSel(null);
  }, [data]);


  // ----------------------------------------------------
  // SELECTED HOURLY WEATHER
  // ----------------------------------------------------

  const hour =
    sel == null
      ? null
      : data.hourly?.[sel] || null;


  // Current climate or selected hour climate

  const climate = hour
    ? {
        ...data,
        temp: hour.temp,
        condition: hour.condition,
        wind: hour.wind,
        mood: hour.mood,
      }
    : data;


  // Sun path position

  const arcMin = hour
    ? hour.min
    : data.nowMin;


  // ----------------------------------------------------
  // WAIT FOR FONTS
  // ----------------------------------------------------

  if (!loaded) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingText}>
          Loading Golden Hour...
        </Text>
      </View>
    );
  }


  // ----------------------------------------------------
  // ANIMATION VALUES
  // ----------------------------------------------------

  const treeY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      height / 2 - (TOP + treeH / 2),
      0,
    ],
  });

  const treeScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1.25, 1],
  });

  const heroOpacity = progress.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0, 1],
  });

  const heroShift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const introOpacity = progress.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
  });


  // ====================================================
  // MAIN UI
  // ====================================================

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: t.bg.day[0] },
      ]}
    >

      <StatusBar style={t.statusBar} />

      <LinearGradient
        colors={t.bg[climate.mood] || t.bg.day}
        style={StyleSheet.absoluteFill}
      />


      {/* ==============================================
          3D BONSAI TREE
      ============================================== */}

      <Animated.View
        style={[
          styles.tree,
          {
            height: treeH,
            transform: [
              { translateY: treeY },
              { scale: treeScale },
            ],
          },
        ]}
      >

        <BonsaiView
          ref={bonsaiRef}

          climate={{
            condition: climate.condition,
            temp: climate.temp,
            wind: climate.wind,
            mood: climate.mood,
            light: mode === 'light',
            growth: data.growth,
          }}

          onDone={goHero}
        />

      </Animated.View>


      {/* ==============================================
          INTRO SCREEN
      ============================================== */}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.intro,
          { opacity: introOpacity },
        ]}
      >

        <Text
          style={[
            type.labelSm,
            {
              color: t.accent,
              letterSpacing: 2,
            },
          ]}
        >
          Golden hour
        </Text>

        <Text
          style={[
            type.headlineLg,
            {
              color: t.text,
              marginTop: 6,
            },
          ]}
        >
          Growing your forecast
        </Text>

      </Animated.View>


      {/* ==============================================
          HERO SCREEN
      ============================================== */}

      <Animated.View
        pointerEvents={
          phase === 'hero' ? 'box-none' : 'none'
        }

        style={[
          StyleSheet.absoluteFill,
          {
            opacity: heroOpacity,
            transform: [
              { translateY: heroShift },
            ],
          },
        ]}
      >


        {/* ============================================
            HEADER AND CITY SEARCH
        ============================================ */}

        <View style={styles.header}>

          <View style={styles.searchRow}>

            <View style={styles.searchContainer}>
              <SearchBar
                placeholder="Search a city"
                onSubmit={handleSearch}
              />
            </View>

            <ThemeToggle />

          </View>


          <View style={styles.headerRow}>

            <Text
              style={[
                type.labelMd,
                { color: t.soft },
              ]}
            >
              {(climate.label || '').toUpperCase()}
            </Text>

            <MoodChip
              mood={climate.mood}
              pulse={pulse}
            />

          </View>


          {!!err && (
            <Text
              style={[
                type.bodySm,
                {
                  color: t.err,
                  marginTop: 6,
                },
              ]}
            >
              {err}
            </Text>
          )}


          {loading && (
            <Text
              style={[
                type.bodySm,
                {
                  color: t.soft,
                  marginTop: 6,
                },
              ]}
            >
              Loading weather...
            </Text>
          )}

        </View>


        {/* ============================================
            BONSAI GROWTH STAGE SELECTOR
        ============================================ */}

        {phase === 'hero' && (

          <View
            style={[
              styles.stageBar,
              { top: TOP + treeH - 38 },
            ]}
            pointerEvents="box-none"
          >

            <View style={styles.stageRow}>

              {(data.weekly || [])
                .slice(0, 7)
                .map((day, i) => (

                  <TouchableOpacity
                    key={day.date || i}

                    onPress={() => handleStageSelect(i)}

                    activeOpacity={0.75}

                    style={[
                      styles.stageChip,

                      {
                        backgroundColor: t.chip.bg,
                        borderColor: t.chip.border,
                      },

                      treeStage === i && {
                        backgroundColor: t.accent,
                        borderColor: t.accent,
                      },
                    ]}
                  >

                    <Text
                      style={[
                        type.labelSm,
                        {
                          color:
                            treeStage === i
                              ? t.onAccent
                              : t.soft,
                        },
                      ]}
                    >
                      {i + 1}
                    </Text>

                  </TouchableOpacity>

                ))}


              {/* RESET BUTTON */}

              <TouchableOpacity
                onPress={handleReset}
                activeOpacity={0.75}

                style={[
                  styles.stageChip,
                  styles.resetChip,
                  {
                    backgroundColor: t.chip.bg,
                    borderColor: t.chip.border,
                  },
                ]}
              >

                <Text
                  style={{
                    color: t.soft,
                    fontSize: 16,
                    lineHeight: 18,
                  }}
                >
                  ↺
                </Text>

              </TouchableOpacity>

            </View>

          </View>

        )}


        {/* ============================================
            WEATHER INFORMATION
        ============================================ */}

        <ScrollView
          style={{
            marginTop: TOP + treeH,
          }}

          contentContainerStyle={styles.content}

          showsVerticalScrollIndicator={false}
        >


          {/* TEMPERATURE */}

          <Text
            style={[
              type.display,
              { color: t.text },
            ]}
          >
            {Math.round(climate.temp)}°
          </Text>


          {/* WEATHER CONDITION */}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >

            <WeatherIcon
              condition={climate.condition}
              night={climate.mood === 'night'}
              size={30}
            />

            <Text
              style={[
                type.bodyLg,
                {
                  color: t.soft,
                  marginLeft: 8,
                },
              ]}
            >
              {CONDITION_LABEL[climate.condition] || 'Weather'}

              {hour ? '  ·  ' + hour.label : ''}
            </Text>

          </View>


          {/* HIGH AND LOW TEMPERATURE */}

          <Text
            style={[
              type.bodySm,
              { color: t.mute },
            ]}
          >
            H {Math.round(data.hi)}°   L {Math.round(data.lo)}°
          </Text>


          {/* ==========================================
              GOLDEN HOUR CARD
          ========================================== */}

          <GlassCard
            level="glow"
            style={{ marginTop: 20 }}
          >

            <Text
              style={[
                type.labelSm,
                { color: t.accentText },
              ]}
            >
              Golden hour window
            </Text>


            <Text
              style={[
                type.headlineMd,
                {
                  color: t.text,
                  marginTop: 6,
                },
              ]}
            >
              {data.goldenStart} to {data.goldenEnd}
            </Text>


            <Text
              style={[
                type.bodyMd,
                {
                  color: t.soft,
                  marginTop: 2,
                },
              ]}
            >
              {data.goldenText}
            </Text>


            <Button
              title={
                loading
                  ? 'Loading...'
                  : 'Use my location'
              }

              onPress={handleLocation}

              style={{ marginTop: 14 }}
            />

          </GlassCard>


          {/* ==========================================
              HOURLY FORECAST
          ========================================== */}

          <Text
            style={[
              type.labelSm,
              styles.section,
              { color: t.soft },
            ]}
          >
            Hourly
          </Text>

          <HourlyStrip
            hours={data.hourly}
            sel={sel}
            onSelect={setSel}
            srMin={data.srMin}
            ssMin={data.ssMin}
          />


          {/* ==========================================
              7 DAY FORECAST
          ========================================== */}

          <Text
            style={[
              type.labelSm,
              styles.section,
              { color: t.soft },
            ]}
          >
            7-Day Forecast
          </Text>

          <WeeklyForecast
            days={data.weekly}
          />


          {/* ==========================================
              SUN PATH
          ========================================== */}

          <Text
            style={[
              type.labelSm,
              styles.section,
              { color: t.soft },
            ]}
          >
            Sun path
          </Text>

          <GlassCard level="1">

            <SolarArc
              sunrise={data.sunrise}
              sunset={data.sunset}
              srMin={data.srMin}
              ssMin={data.ssMin}
              min={arcMin}
            />

          </GlassCard>


          {/* ==========================================
              WEATHER CONDITIONS
          ========================================== */}

          <Text
            style={[
              type.labelSm,
              styles.section,
              { color: t.soft },
            ]}
          >
            Conditions
          </Text>


          <View style={styles.grid}>

            <Metric
              label="UV index"
              value={String(data.uv)}
              sub={uvLevel(data.uv)}
            />

            <Metric
              label="Humidity"
              value={Math.round(data.humidity) + '%'}
            />

            <Metric
              label="Wind"
              value={String(Math.round(climate.wind))}
              sub="km/h"
            />

            <Metric
              label="Feels like"
              value={Math.round(data.feels) + '°'}
            />

          </View>


          {/* ==========================================
              LIVE WEATHER / SIMULATION MODE
          ========================================== */}

          <GlassCard
            level="1"
            style={{ marginTop: 8 }}
          >

            <View style={styles.toggleRow}>

              <View style={{ flex: 1 }}>

                <Text
                  style={[
                    type.headlineSm,
                    { color: t.text },
                  ]}
                >
                  Live weather
                </Text>

                <Text
                  style={[
                    type.bodySm,
                    { color: t.mute },
                  ]}
                >
                  Turn off to test how the bonsai reacts
                </Text>

              </View>


              <Switch
                value={liveOn}
                onValueChange={(value) => {
                  setLiveOn(value);
                  setSel(null);
                  setTreeStage(null);

                  bonsaiRef.current?.clearStage?.();
                }}

                trackColor={{
                  false: t.switchOff,
                  true: t.accent,
                }}

                thumbColor="#FFFDF8"

                ios_backgroundColor={t.switchOff}
              />

            </View>


            {/* SIMULATION PRESETS */}

            {!liveOn && (

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 14 }}
              >

                {MODES.map((item) => (

                  <FilterChip
                    key={item.key}

                    label={item.label}

                    on={presetKey === item.key}

                    onPress={() => {
                      setPresetKey(item.key);
                      setSel(null);
                      setTreeStage(null);

                      bonsaiRef.current?.clearStage?.();
                    }}
                  />

                ))}

              </ScrollView>

            )}

          </GlassCard>

        </ScrollView>

      </Animated.View>

    </View>
  );
}


// ======================================================
// WEATHER METRIC CARD
// ======================================================

function Metric({ label, value, sub }) {
  const { t } = useTheme();

  return (
    <GlassCard
      level={2}
      style={styles.metric}
      pad={16}
    >

      <View
        style={{
          minHeight: 100,
          justifyContent: 'space-between',
        }}
      >

        <Text
          style={[
            type.labelMd,
            { color: t.soft },
          ]}
        >
          {label.toUpperCase()}
        </Text>


        <View>

          <Text
            style={[
              type.headlineLg,
              { color: t.value },
            ]}
          >
            {value}
          </Text>


          {!!sub && (

            <Text
              style={[
                type.bodySm,
                { color: t.soft },
              ]}
            >
              {sub}
            </Text>

          )}

        </View>

      </View>

    </GlassCard>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({

  root: {
    flex: 1,
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F0E8',
  },

  loadingText: {
    color: '#53634C',
    fontSize: 16,
  },

  tree: {
    position: 'absolute',
    top: TOP,
    left: 0,
    right: 0,
  },

  intro: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '12%',
    alignItems: 'center',
  },

  header: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchContainer: {
    flex: 1,
    marginRight: 8,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },

  section: {
    marginTop: 28,
    marginBottom: 12,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  metric: {
    width: '48%',
    marginBottom: 16,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stageBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stageChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },

  resetChip: {
    marginLeft: 10,
  },

});
