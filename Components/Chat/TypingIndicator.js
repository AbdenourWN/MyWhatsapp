import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Updated Props: typingUsers array, recordingUsers array
export default function TypingIndicator({
  typingUsers = [],
  recordingUsers = [],
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Determine what to show. Recording takes priority.
  const isRecording = recordingUsers.length > 0;
  const isTyping = typingUsers.length > 0;

  const showIndicator = isRecording || isTyping;

  useEffect(() => {
    if (showIndicator) {
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
  }, [showIndicator]);

  if (!showIndicator) return null;

  // Get active users list based on priority
  const activeUsers = isRecording ? recordingUsers : typingUsers;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.bubble}>
        {/* Avatars Row */}
        <View style={styles.avatarRow}>
          {activeUsers.slice(0, 3).map((user, index) => (
            <Image
              key={index}
              source={{ uri: user.avatar || "https://via.placeholder.com/30" }}
              style={[
                styles.miniAvatar,
                { marginLeft: index > 0 ? -8 : 0 }, // Overlap effect
              ]}
            />
          ))}
        </View>

        {isRecording ? (
          <>
            <MaterialCommunityIcons
              name="microphone"
              size={16}
              color="#56AB2F"
              style={{ marginLeft: 5 }}
            />
            <Text style={styles.text}>
              {activeUsers.length > 1
                ? "People are recording..."
                : "Recording..."}
            </Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={16}
              color="#888"
              style={{ marginLeft: 5 }}
            />
            <Text style={styles.text}>
              {activeUsers.length > 1 ? "People are typing..." : "Typing..."}
            </Text>
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    marginBottom: 5,
    marginLeft: 5,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 5,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fff",
  },
  text: {
    color: "#666",
    fontSize: 12,
    fontStyle: "italic",
    marginLeft: 5,
  },
});
