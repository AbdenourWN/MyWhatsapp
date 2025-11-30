import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function ChatHeader({
  navigation,
  user,
  onMenuPress,
  typingUsers = [], // Expect Array
  recordingUsers = [], // Expect Array
  onHeaderPress,
  type = "private",
}) {
  const getStatusContent = () => {
    // 1. Priority: Recording
    if (recordingUsers.length > 0) {
      return (
        <View style={styles.statusRow}>
          {type === "group" &&
            recordingUsers.map((u, i) => (
              <Image
                key={i}
                source={{ uri: u.avatar || "https://via.placeholder.com/30" }}
                style={styles.miniAvatar}
              />
            ))}
          <Text style={styles.recordingText}>
            {type === "group" ? "Recording..." : "Recording audio..."}
          </Text>
        </View>
      );
    }

    // 2. Priority: Typing
    if (typingUsers.length > 0) {
      return (
        <View style={styles.statusRow}>
          {type === "group" &&
            typingUsers.map((u, i) => (
              <Image
                key={i}
                source={{ uri: u.avatar || "https://via.placeholder.com/30" }}
                style={styles.miniAvatar}
              />
            ))}
          <Text style={styles.typingText}>
            {type === "group" ? "Typing..." : "Typing..."}
          </Text>
        </View>
      );
    }

    // 3. Default Status
    if (type === "group") {
      return <Text style={styles.statusText}>Tap for group info</Text>;
    }
    return (
      <Text style={styles.statusText}>
        {user?.isOnline ? "Online" : "Offline"}
      </Text>
    );
  };

  return (
    <LinearGradient colors={["#A8E063", "#56AB2F"]} style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.info}
        onPress={onHeaderPress}
        activeOpacity={0.7}
      >
        {type === "group" ? (
          user.photoURL ? (
            <Image
              source={{
                uri: user?.photoURL || "https://via.placeholder.com/50",
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.groupAvatar, styles.placeholderAvatar]}>
              <MaterialCommunityIcons
                name="account-group"
                size={24}
                color="#fff"
              />
            </View>
          )
        ) : (
          <Image
            source={{ uri: user?.photoURL || "https://via.placeholder.com/50" }}
            style={styles.avatar}
          />
        )}
        <View>
          <Text style={styles.title} numberOfLines={1}>
            {user?.displayName || "Chat"}
          </Text>
          {getStatusContent()}
        </View>
      </TouchableOpacity>

      <View style={styles.icons}>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialCommunityIcons name="video" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onMenuPress}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: { marginRight: 10 },
  info: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#fff",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  // Status Styles
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  miniAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
    borderWidth: 1,
    borderColor: "#fff",
  },

  statusText: { color: "#e0e0e0", fontSize: 12 },
  typingText: {
    color: "#fff",
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "bold",
  },
  recordingText: {
    color: "#fff",
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "bold",
  },

  icons: { flexDirection: "row", gap: 15 },
  iconBtn: { padding: 5 },
  groupAvatar: { width: 30, height: 30, borderRadius: 27.5 },
  placeholderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999999,
    borderWidth:1,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f38e8eff",
    marginRight: 10
  },
});
