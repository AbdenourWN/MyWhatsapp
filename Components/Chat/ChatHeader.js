import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function ChatHeader({
  navigation,
  user,
  onMenuPress,
  isTyping,
  isRecording,
}) {
  
  const getStatusText = () => {
    if (isRecording)
      return <Text style={styles.recordingText}>Recording audio...</Text>;
    if (isTyping) return <Text style={styles.typingText}>Typing...</Text>;
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

      <View style={styles.info}>
        <Image
          source={{ uri: user?.photoURL || "https://via.placeholder.com/50" }}
          style={styles.avatar}
        />
        <View>
          <Text style={styles.title}>{user?.displayName || "Chat"}</Text>
          {getStatusText()}
        </View>
      </View>

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
  info: { flex: 1, flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#fff",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "bold" },
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
});
