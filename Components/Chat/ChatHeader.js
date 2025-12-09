import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initiateGroupCall } from "../../services/chatServices";

export default function ChatHeader({
  navigation,
  user,
  chatId,
  onMenuPress,
  typingUsers = [],
  recordingUsers = [],
  onHeaderPress,
  type = "private",
}) {
  const getStatusContent = () => {
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

    if (type === "group") {
      return <Text style={styles.statusText}>Tap for group info</Text>;
    }
    return (
      <Text style={styles.statusText}>
        {user?.isOnline ? "Online" : "Offline"}
      </Text>
    );
  };

  // --- LOGIC TO START CALL  ---
  const startCallSequence = async (isVideo) => {
    try {
      const currentUser = auth.currentUser;

      if (type === "group") {
        // --- GROUP CALL LOGIC ---
        const callId = await initiateGroupCall(
          chatId,
          isVideo ? "video" : "audio",
          currentUser
        );

        navigation.navigate("GroupCallScreen", {
          roomId: callId,
          chatId: chatId,
          userName: user?.displayName || "Group",
          isVideoCall: isVideo,
        });
      } else {
        // --- CHAT CALL LOGIC ---
        // 1. Generate a Unique Call ID
        const callId = `${chatId}_${Date.now()}`;

        // 2. SIGNALING: Update Firestore so the other user sees the call
        if (chatId) {
          await setDoc(
            doc(db, "chats", chatId),
            {
              callActive: true,
              callRoomId: callId,
              callType: isVideo ? "video" : "audio",
              callerName: currentUser?.displayName || "User",
              callerId: currentUser?.uid,
              callerAvatar: currentUser?.photoURL,
              callStartTime: serverTimestamp(),
            },
            { merge: true }
          );
        }

        // 3. Navigate Local User to the WebRTC Screen
        navigation.navigate("CallScreen", {
          roomId: callId,
          chatId: chatId,
          isCaller: true,
          userName: user?.displayName || "User",
          otherUserAvatar: user?.photoURL,
          isVideoCall: isVideo,
        });
      }
    } catch (error) {
      console.error(
        `Error starting ${isVideo ? "video" : "voice"} call:`,
        error
      );
      Alert.alert("Error", "Failed to start call.");
    }
  };

  const handleVideoCall = () => {
    startCallSequence(true);
  };

  const startVoiceCall = () => {
    startCallSequence(false);
  };

  const handleVoiceCallOptions = () => {
    Alert.alert("Start Call", "Choose call type", [
      {
        text: "Voice Only",
        onPress: () => startVoiceCall(),
      },
      {
        text: "Video Call",
        onPress: () => handleVideoCall(),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
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
        <TouchableOpacity style={styles.iconBtn} onPress={handleVideoCall}>
          <MaterialCommunityIcons name="video" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleVoiceCallOptions}
        >
          <MaterialCommunityIcons name="phone" size={24} color="#fff" />
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
    borderWidth: 1,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f38e8eff",
    marginRight: 10,
  },
});
