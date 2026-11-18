import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  PanResponder,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from './GlassCard';
import { type, useTheme } from './theme';
import WeatherIcon from './WeatherIcon';

const POD = 64;
const GAP = 8;
const THUMB = 24;

// Determine the time of day without depending on weather.js
function getPhaseLabel(min, srMin, ssMin) {
  if (min == null || srMin == null || ssMin == null) {
    return 'Weather';
  }

  if (min < srMin || min > ssMin) {
    return 'Night';
  }

  if (min <= srMin + 45) {
    return 'Morning golden hour';
  }

  if (min >= ssMin - 45) {
    return 'Evening golden hour';
  }

  return 'Daylight';
}

export default function HourlyStrip({
  hours = [],
  sel,
  onSelect,
  srMin,
  ssMin,
}) {
  const { t } = useTheme();

  const scroller = useRef(null);
  const [railW, setRailW] = useState(200);

  const n = hours.length;
  const idx = sel == null ? 0 : Math.min(sel, n - 1);

  const pick = (i) => {
    if (n === 0) return;

    const k = Math.max(0, Math.min(n - 1, i));

    if (typeof onSelect === 'function') {
      onSelect(k === 0 ? null : k);
    }

    if (scroller.current) {
      scroller.current.scrollTo({
        x: Math.max(0, k * (POD + GAP) - 80),
        animated: true,
      });
    }
  };

  const pickRef = useRef(pick);
  pickRef.current = pick;

  const wRef = useRef(railW);
  wRef.current = railW;

  const startX = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => n > 1,
      onMoveShouldSetPanResponder: () => n > 1,

      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;

        if (wRef.current > 0) {
          pickRef.current(
            Math.round(
              (startX.current / wRef.current) * (n - 1)
            )
          );
        }
      },

      onPanResponderMove: (e, gesture) => {
        if (wRef.current > 0) {
          pickRef.current(
            Math.round(
              ((startX.current + gesture.dx) / wRef.current) *
                (n - 1)
            )
          );
        }
      },
    })
  ).current;

  if (n === 0) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={[type.bodySm, { color: t.soft }]}>
          Hourly forecast is unavailable.
        </Text>
      </View>
    );
  }

  const pct = n > 1 ? idx / (n - 1) : 0;
  const h = hours[idx] || hours[0];

  return (
    <View>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {hours.map((hr, i) => {
          const active = i === idx;

          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.8}
              onPress={() => pick(i)}
              style={{ marginRight: GAP }}
            >
              <GlassCard level={active ? 'glow' : 1} pad={10}>
                <View
                  style={{
                    width: POD - 20,
                    alignItems: 'center',
                  }}
                >
                  <Text style={[type.labelMd, { color: t.soft }]}>
                    {hr.label}
                  </Text>

                  <View style={{ marginVertical: 8 }}>
                    <WeatherIcon
                      condition={hr.condition}
                      night={hr.mood === 'night'}
                      size={28}
                    />
                  </View>

                  <Text style={[type.headlineSm, { color: t.text }]}>
                    {Math.round(hr.temp)}°
                  </Text>

                  {hr.pop != null && (
                    <Text
                      style={[
                        type.bodySm,
                        { color: t.pop, marginTop: 2 },
                      ]}
                    >
                      {Math.round(hr.pop)}%
                    </Text>
                  )}
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Scrim slider */}
      <View style={{ marginTop: 18 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text style={[type.labelMd, { color: t.accentText }]}>
            {h.label}
          </Text>

          <Text style={[type.labelMd, { color: t.soft }]}>
            {getPhaseLabel(h.min, srMin, ssMin)}
          </Text>
        </View>

        <View
          {...pan.panHandlers}
          onLayout={(e) => setRailW(e.nativeEvent.layout.width)}
          style={{
            height: 32,
            justifyContent: 'center',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: t.rail.bg,
              borderWidth: 1,
              borderColor: t.rail.border,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={['#D95D39', '#F59E0B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 8,
                width: pct * railW,
              }}
            />
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={['#FBBF24', '#F59E0B']}
            style={{
              position: 'absolute',
              top: 4,
              left: pct * (railW - THUMB),
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              shadowColor: '#F59E0B',
              shadowOpacity: 0.8,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        </View>
      </View>
    </View>
  );
}