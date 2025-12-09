import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { joinGroupCall } from "../services/chatServices";

const { width } = Dimensions.get("window");

export default function IncomingCallScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    callId,
    roomId,
    callerName,
    callerAvatar,
    callType,
    isGroup = false,
  } = route.params;

  const handleAccept = () => {
    if (route.params.isGroup) {
      // ADD ME TO THE GROUP CALL
      joinGroupCall(callId, auth.currentUser);

      navigation.replace("GroupCallScreen", {
        roomId: callId,
        chatId: roomId,
        isVideoCall: callType === "video",
      });
    } else {
      navigation.replace("CallScreen", {
        roomId: callId,
        chatId: roomId,
        isCaller: false,
        userName: callerName,
        otherUserAvatar: callerAvatar,
        isVideoCall: callType === "video",
      });
    }
  };

  const handleDecline = async () => {
    if (isGroup) {
      // --- GROUP CALL DECLINE ---
      
      console.log("Ignored Group Call");
      navigation.goBack();
    } else {
      // --- PRIVATE CALL DECLINE ---
      try {
        // 1. Signal Caller to Stop Ringing
        const callRef = doc(db, "calls", callId);
        await updateDoc(callRef, { 
          active: false,
          rejected: true 
        });

        // 2. Remove Banner from Chat
        const chatRef = doc(db, "chats", roomId);
        await updateDoc(chatRef, {
          callActive: false,
          callRoomId: null,
        });

        navigation.goBack();
      } catch (error) {
        console.error("Error declining:", error);
        navigation.goBack();
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Image
          source={{ uri: callerAvatar || "https://via.placeholder.com/150" }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{callerName}</Text>
        <Text style={styles.type}>
          Incoming {callType === "video" ? "Video" : "Voice"} Call...
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleDecline} style={styles.declineBtn}>
          <MaterialCommunityIcons name="phone-hangup" size={32} color="white" />
          <Text style={styles.btnText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleAccept} style={styles.acceptBtn}>
          <MaterialCommunityIcons name="phone" size={32} color="white" />
          <Text style={styles.btnText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1c24",
    justifyContent: "space-between",
    paddingVertical: 60,
    alignItems: "center",
  },
  infoContainer: { alignItems: "center", marginTop: 50 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "white",
  },
  name: { fontSize: 30, fontWeight: "bold", color: "white", marginBottom: 10 },
  type: { fontSize: 18, color: "#aaa" },
  buttonContainer: {
    flexDirection: "row",
    width: width * 0.8,
    justifyContent: "space-between",
    marginBottom: 40,
  },
  declineBtn: {
    alignItems: "center",
    backgroundColor: "#FF3B30",
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
  },
  acceptBtn: {
    alignItems: "center",
    backgroundColor: "#4CD964",
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
  },
  btnText: {
    color: "white",
    marginTop: 5,
    fontSize: 12,
    position: "absolute",
    bottom: -25,
  },
});
