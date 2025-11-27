import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from "react-native";
import {
  GiftedChat,
  Bubble,
  InputToolbar,
  Send,
} from "react-native-gifted-chat";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { sendMessage, markMessagesAsRead } from "../../services/chatServices";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { db, auth } from "../../firebaseConfig";

export default function Chat({ route, navigation }) {
  const { roomId, otherUser } = route.params;
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const messagesRef = collection(db, "chats", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hasUnreadMessages = snapshot.docs.some((doc) => {
        const data = doc.data();
        return data.user._id !== auth.currentUser.uid && !data.received;
      });

      if (hasUnreadMessages) {
        markMessagesAsRead(roomId, auth.currentUser.uid);
      }

      const allMessages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          _id: doc.id,
          text: data.text,
          createdAt: data.createdAt?.toDate(),
          user: data.user,
          sent: data.sent,
          received: data.received,
        };
      });
      setMessages(allMessages);
    });

    return () => unsubscribe();
  }, [roomId]);

  const onSend = useCallback(
    (messages = []) => {
      const msg = messages[0];
      const messageToSend = {
        _id: msg._id,
        text: msg.text,
        user: {
          _id: auth.currentUser.uid,
          name: auth.currentUser.displayName,
          avatar: auth.currentUser.photoURL,
        },
      };
      sendMessage(roomId, messageToSend);
    },
    [roomId]
  );

  // --- UI RENDERERS ---

  const renderTicks = (message) => {
    if (message.user._id !== auth.currentUser.uid) return null;
    if (message.received) {
      return (
        <MaterialCommunityIcons
          name="check-all"
          size={16}
          color="#4FC3F7"
          style={{ marginRight: 5 }}
        />
      );
    }
    if (message.sent) {
      return (
        <MaterialCommunityIcons
          name="check"
          size={16}
          color="#999"
          style={{ marginRight: 5 }}
        />
      );
    }
    return (
      <MaterialCommunityIcons
        name="clock-outline"
        size={16}
        color="#999"
        style={{ marginRight: 5 }}
      />
    );
  };

  const renderBubble = (props) => (
    <Bubble
      {...props}
      wrapperStyle={{
        right: { backgroundColor: "#56AB2F" },
        left: { backgroundColor: "#fff" },
      }}
      renderTicks={renderTicks}
    />
  );

  const renderSend = (props) => (
    <Send {...props}>
      <View style={styles.sendingContainer}>
        <MaterialCommunityIcons name="send-circle" size={40} color="#56AB2F" />
      </View>
    </Send>
  );

  const renderInputToolbar = (props) => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={{ alignItems: "center" }}
    />
  );

  const renderHeader = () => (
    <LinearGradient colors={["#A8E063", "#56AB2F"]} style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.headerInfo}>
        <Image
          source={{
            uri: otherUser?.photoURL || "https://via.placeholder.com/50",
          }}
          style={styles.headerAvatar}
        />
        <Text style={styles.headerTitle}>
          {otherUser?.displayName || "Chat"}
        </Text>
      </View>

      <View style={styles.headerIcons}>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialCommunityIcons name="video" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialCommunityIcons name="phone" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      {renderHeader()}

      <GiftedChat
        messages={messages}
        onSend={(messages) => onSend(messages)}
        user={{
          _id: auth.currentUser.uid,
        }}
        renderBubble={renderBubble}
        renderSend={renderSend}
        renderInputToolbar={renderInputToolbar}
        alwaysShowSend
        scrollToBottom
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: {
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    zIndex: 100,
  },
  backButton: { marginRight: 10 },
  headerInfo: { flex: 1, flexDirection: "row", alignItems: "center" },
  headerAvatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#fff",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerIcons: { flexDirection: "row", gap: 15 },
  iconBtn: { padding: 5 },

  inputToolbar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingHorizontal: 5,
    paddingBottom: 5,
    maxHeight: 100,
  },
  sendingContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginBottom: 5,
  },
});
