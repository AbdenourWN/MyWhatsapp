import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function TypingIndicator({ isTyping, isRecording }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTyping || isRecording) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isTyping, isRecording]);

  if (!isTyping && !isRecording) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.bubble}>
        {isRecording ? (
          <>
            <MaterialCommunityIcons
              name="microphone"
              size={16}
              color="#56AB2F"
            />
            <Text style={styles.text}>Recording audio...</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={16}
              color="#888"
            />
            <Text style={styles.text}>Typing...</Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: 10,
    paddingVertical: 5,
    backgroundColor: "transparent",
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    gap: 8,
    marginBottom: 5,
    marginLeft: 5,
  },
  text: {
    color: "#666",
    fontSize: 12,
    fontStyle: "italic",
  },
});
