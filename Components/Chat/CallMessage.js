import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function CallMessage({ item, isMe }) {
  const isVideo = item.callInfo.type === "video";
  const duration = item.text.split("•")[1] || "Ended";

  const textColor = isMe ? "#fff" : "#000";
  const subTextColor = isMe ? "#e0e0e0" : "#666";
  const iconColor = isMe ? "#fff" : isVideo ? "#0288D1" : "#2E7D32"; 

  const iconBg = isMe
    ? "rgba(255,255,255,0.2)"
    : isVideo
    ? "#E1F5FE"
    : "#E8F5E9";

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons
          name={isVideo ? "video" : "phone"}
          size={24}
          color={iconColor}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.callTitle, { color: textColor }]}>
          {isVideo ? "Video Call" : "Voice Call"}
        </Text>
        <Text style={[styles.callDuration, { color: subTextColor }]}>
          {duration.trim() === "0:00" ? "Missed Call" : duration}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 150,
    paddingVertical: 5,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    justifyContent: "center",
  },
  callTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  callDuration: {
    fontSize: 13,
    marginTop: 2,
  },
});
