import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors, spacing } from '../theme';
import type { RatingValue } from '../storage/ratingStore';

const STARS: RatingValue[] = [1, 2, 3, 4, 5];

/** Horizontal padding around each icon, so every star occupies an equal cell. */
const STAR_PADDING = 3;

type StarRatingProps = {
  value?: number;
  onChange?: (value: RatingValue) => void;
  size?: number;
  /** Smaller, dimmer stars for list rows. */
  compact?: boolean;
};

function clampStar(index: number): RatingValue {
  return Math.min(Math.max(index, 1), STARS.length) as RatingValue;
}

export function StarRating({ value, onChange, size = 32, compact = false }: StarRatingProps) {
  const [preview, setPreview] = useState<RatingValue | null>(null);
  const rowRef = useRef<ComponentRef<typeof View>>(null);
  const rowLeft = useRef(0);

  const cellSize = size + STAR_PADDING * 2;
  const displayed = preview ?? value ?? 0;

  const measureRow = useCallback(() => {
    rowRef.current?.measureInWindow((x: number) => {
      rowLeft.current = x;
    });
  }, []);

  const starAt = useCallback(
    (windowX: number) => clampStar(Math.ceil((windowX - rowLeft.current) / cellSize)),
    [cellSize],
  );

  // Dragging across the row behaves like a slider; a plain tap still lands on its star.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          if (onChange) {
            setPreview(clampStar(value ?? 1));
          }
        },
        onPanResponderMove: (_event, gesture) => {
          setPreview(starAt(gesture.moveX));
        },
        onPanResponderRelease: (_event, gesture) => {
          setPreview(null);
          onChange?.(starAt(gesture.moveX));
        },
        onPanResponderTerminate: () => setPreview(null),
        onPanResponderTerminationRequest: () => false,
      }),
    [onChange, starAt, value],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.width > 0) {
      measureRow();
    }
  };

  if (!onChange) {
    return (
      <View
        style={styles.row}
        accessibilityLabel={value ? `Rated ${value} of 5` : 'Not rated'}
        onLayout={handleLayout}
      >
        {STARS.map((star) => (
          <View key={star} style={[styles.cell, { width: cellSize }]}>
            <Ionicons
              name={star <= displayed ? 'star' : 'star-outline'}
              size={size}
              color={star <= displayed ? colors.primaryStrong : colors.border}
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row} onLayout={handleLayout} ref={rowRef} {...panResponder.panHandlers}>
      {STARS.map((star) => (
        <View key={star} style={[styles.cell, { width: cellSize }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} of 5`}
            hitSlop={4}
            onPress={() => onChange(star)}
            style={({ pressed }) => [styles.starButton, pressed && styles.starPressed]}
          >
            <Ionicons
              name={star <= displayed ? 'star' : 'star-outline'}
              size={size}
              color={star <= displayed ? colors.primaryStrong : colors.border}
            />
          </Pressable>
        </View>
      ))}
      {compact || displayed ? null : <Text style={styles.hint}>Tap to rate</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButton: {
    padding: 1,
  },
  starPressed: {
    opacity: 0.6,
  },
  hint: {
    marginLeft: spacing.sm,
    color: colors.textMuted,
    fontSize: 13,
  },
});
