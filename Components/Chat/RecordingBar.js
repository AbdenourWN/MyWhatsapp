import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// 1. Blinking Red Dot Component
const BlinkingDot = () => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#ff3b30",
        marginRight: 8,
        opacity: fadeAnim,
      }}
    />
  );
};

// 2. Wave Animation Component
const RecordingWaves = () => {
  const animations = useRef(
    [...Array(6)].map(() => new Animated.Value(5))
  ).current;

  useEffect(() => {
    const animateBar = (anim, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 15 + 10, // Random height between 10-25
            duration: 300,
            useNativeDriver: false, // height layout property doesn't support native driver
            delay,
          }),
          Animated.timing(anim, {
            toValue: 5,
            duration: 300,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };
    animations.forEach((anim, idx) => animateBar(anim, idx * 100));
  }, []);

  return (
    <View style={styles.wavesContainer}>
      {animations.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.wave,
            { height: a, backgroundColor: i % 2 === 0 ? "#56AB2F" : "#8bc34a" }, // Alternating shades of green
          ]}
        />
      ))}
    </View>
  );
};

export default function RecordingBar({ onCancel, onSend, duration }) {
  const format = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <View style={styles.container}>
      {/* Delete Button */}
      <TouchableOpacity onPress={onCancel} style={styles.trashBtn}>
        <MaterialCommunityIcons
          name="delete-outline"
          size={28}
          color="#d9534f"
        />
      </TouchableOpacity>

      {/* The "Pill" Container (Matches Text Input Look) */}
      <View style={styles.recordingPill}>
        <View style={styles.leftPillContent}>
          <BlinkingDot />
          <Text style={styles.timer}>{format(duration)}</Text>
        </View>
        <RecordingWaves />
      </View>

      {/* Send Button */}
      <TouchableOpacity onPress={onSend} style={styles.sendBtn}>
        <MaterialCommunityIcons
          name="send"
          size={24}
          color="#fff"
          style={{ marginLeft: 2 }}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2", // Matches chat background
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  trashBtn: {
    padding: 10,
  },
  recordingPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff", // White pill background
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 5,
    height: 45, // Fixed height to match TextInput
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  leftPillContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  timer: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
    fontVariant: ["tabular-nums"], // Prevents numbers from jumping width
    minWidth: 40,
  },
  wavesContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    justifyContent: "flex-end",
  },
  wave: {
    width: 4,
    borderRadius: 2,
  },
  sendBtn: {
    backgroundColor: "#56AB2F", // Your App Theme Green
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#56AB2F",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});
