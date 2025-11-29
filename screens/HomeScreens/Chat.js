import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  TouchableOpacity,
  Text,
  TouchableWithoutFeedback,
  FlatList,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import moment from "moment";

// Configs
import { db, auth } from "../../firebaseConfig";
import { uploadToCloudinary } from "../../cloudinaryConfig";
import {
  sendMessage,
  clearChatHistory,
  blockUser,
  setTypingStatus,
  setRecordingStatus,
} from "../../services/chatServices";

// Components
import ChatHeader from "../../Components/Chat/ChatHeader";
import AudioMessage from "../../Components/Chat/AudioMessage";
import RecordingBar from "../../Components/Chat/RecordingBar";
import TypingIndicator from "../../Components/Chat/TypingIndicator";

// Hooks
import { useChatLogic } from "../../hooks/useChatLogic";

export default function Chat({ route, navigation }) {
  const { roomId, otherUser, type } = route.params;
  const {
    messages,
    isLoadingMessages,
    isOtherUserTyping,
    isOtherUserRecording,
  } = useChatLogic(roomId, type);

  // State
  const [isUploading, setIsUploading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [inputText, setInputText] = useState("");

  // Recording State
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const durationInterval = useRef(null);
  const soundManager = useRef(null);

  // Refs for Typing Logic
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    (async () => await Audio.requestPermissionsAsync())();
    return () => {
      if (soundManager.current?.sound) soundManager.current.sound.unloadAsync();
    };
  }, []);

  // Handle typing status based on text changes
  const handleTextChange = useCallback(
    async (newText) => {
      setInputText(newText);

      // User is typing
      if (newText.length > 0) {
        if (!isTypingRef.current) {
          isTypingRef.current = true;
          await setTypingStatus(roomId, auth.currentUser.uid, true, type);
        }

        // Reset timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        // Stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(async () => {
          isTypingRef.current = false;
          await setTypingStatus(roomId, auth.currentUser.uid, false, type);
        }, 2000);
      }
      // User cleared the input
      else if (newText.length === 0 && isTypingRef.current) {
        isTypingRef.current = false;
        await setTypingStatus(roomId, auth.currentUser.uid, false, type);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    },
    [roomId, type]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        setTypingStatus(roomId, auth.currentUser.uid, false, type);
      }
    };
  }, [roomId, type]);

  // --- MENU HANDLERS ---
  const handleClearChat = () => {
    setMenuVisible(false);
    Alert.alert("Clear Chat", "Delete all messages?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearChatHistory(roomId, auth.currentUser.uid);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleBlockUser = () => {
    setMenuVisible(false);
    Alert.alert("Block User", `Block ${otherUser?.displayName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await blockUser(auth.currentUser.uid, otherUser.uid);
          navigation.goBack();
        },
      },
    ]);
  };

  // --- CHAT HANDLERS ---
  const handleSend = async () => {
    if (!inputText.trim()) return;

    // Clear typing status immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    await setTypingStatus(roomId, auth.currentUser.uid, false, type);

    const messageToSend = {
      _id: Math.random().toString(36).substring(7),
      text: inputText.trim(),
      createdAt: new Date(),
      user: {
        _id: auth.currentUser.uid,
        name: auth.currentUser.displayName,
        avatar: auth.currentUser.photoURL,
      },
    };

    setInputText(""); // Clear input
    sendMessage(roomId, messageToSend);
  };

  const handleUploadAndSend = async (uri, mediaType, audioDuration = 0) => {
    setIsUploading(true);
    try {
      const cloudUrl = await uploadToCloudinary(uri, mediaType);
      const msg = {
        _id: Math.random().toString(36).substring(7),
        text: "",
        createdAt: new Date(),
        user: {
          _id: auth.currentUser.uid,
          name: auth.currentUser.displayName,
          avatar: auth.currentUser.photoURL,
        },
      };
      if (mediaType === "image") msg.image = cloudUrl;
      if (mediaType === "audio") {
        msg.audio = cloudUrl;
        msg.audioDuration = audioDuration;
      }
      sendMessage(roomId, msg);
    } catch (error) {
      Alert.alert("Error", "Failed to send media");
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) handleUploadAndSend(result.assets[0].uri, "image");
  };

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    Keyboard.dismiss();
    try {
      setRecordingStatus(roomId, auth.currentUser.uid, true, type);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      durationInterval.current = setInterval(
        () => setRecordingDuration((p) => p + 1000),
        1000
      );
    } catch (err) {
      console.error("Rec Error", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecordingStatus(roomId, auth.currentUser.uid, false, type);
    setIsRecording(false);
    clearInterval(durationInterval.current);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const status = await recording.getStatusAsync();
    setRecording(null);
    if (uri) handleUploadAndSend(uri, "audio", status.durationMillis);
  };

  const cancelRecording = async () => {
    if (!recording) return;
    setRecordingStatus(roomId, auth.currentUser.uid, false, type);
    setIsRecording(false);
    clearInterval(durationInterval.current);
    await recording.stopAndUnloadAsync();
    setRecording(null);
  };

  // --- CUSTOM RENDERERS ---
  const formatTime = (date) => {
    if (!date) return "";
    // Handle Firestore timestamp or JS Date
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return moment(d).format("LT");
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.user._id === auth.currentUser.uid;

    return (
      <View
        style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}
      >
        {!isMe && (
          <Image
            source={{
              uri: item.user.avatar || "https://via.placeholder.com/150",
            }}
            style={styles.avatar}
          />
        )}

        <View
          style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}
        >
          {item.image && (
            <Image
              source={{ uri: item.image }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}

          {item.audio && (
            <AudioMessage
              currentMessage={item}
              soundManager={soundManager}
              containerStyle={{ width: 150 }}
            />
          )}

          {item.text ? (
            <Text
              style={[
                styles.messageText,
                isMe ? styles.textRight : styles.textLeft,
              ]}
            >
              {item.text}
            </Text>
          ) : null}

          <View style={styles.footerContainer}>
            <Text
              style={[
                styles.timeText,
                isMe ? styles.timeRight : styles.timeLeft,
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
            {isMe && (
              <MaterialCommunityIcons
                name={item.received ? "check-all" : "check"}
                size={14}
                color={item.received ? "#4FC3F7" : "#e0e0e0"}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ChatHeader
        navigation={navigation}
        user={otherUser}
        onMenuPress={() => setMenuVisible(true)}
        isTyping={isOtherUserTyping}
        isRecording={isOtherUserRecording}
      />

      {isLoadingMessages ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#56AB2F" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item._id.toString()}
            renderItem={renderMessageItem}
            inverted
            contentContainerStyle={styles.flatListContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={{ paddingBottom: 5, paddingLeft: 10 }}>
                <TypingIndicator
                  isTyping={isOtherUserTyping}
                  isRecording={isOtherUserRecording}
                />
              </View>
            }
          />

          {/* Input Area */}
          <SafeAreaView edges={["bottom"]}>
            {isRecording ? (
              <RecordingBar
                onCancel={cancelRecording}
                onSend={stopRecording}
                duration={recordingDuration}
              />
            ) : (
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={styles.iconButton}
                >
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={28}
                    color="#56AB2F"
                  />
                </TouchableOpacity>

                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#999"
                  multiline
                  value={inputText}
                  onChangeText={handleTextChange}
                  maxHeight={100}
                />

                {inputText.trim().length > 0 ? (
                  <TouchableOpacity
                    onPress={handleSend}
                    style={styles.iconButton}
                  >
                    <MaterialCommunityIcons
                      name="send-circle"
                      size={40}
                      color="#56AB2F"
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={startRecording}
                    style={styles.iconButton}
                  >
                    <MaterialCommunityIcons
                      name="microphone"
                      size={28}
                      color="#56AB2F"
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      )}

      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#56AB2F" />
        </View>
      )}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleClearChat}
              >
                <Text style={styles.menuText}>Clear Chat</Text>
              </TouchableOpacity>
              {type !== "group" && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleBlockUser}
                >
                  <Text style={[styles.menuText, { color: "#d9534f" }]}>
                    Block User
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: {
    flex: 1,
  },
  flatListContent: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },

  // Custom Message Styles
  messageRow: {
    flexDirection: "row",
    marginVertical: 4,
    alignItems: "flex-end",
  },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    elevation: 1,
  },
  bubbleLeft: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 5,
  },
  bubbleRight: {
    backgroundColor: "#56AB2F",
    borderBottomRightRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  textLeft: { color: "#000" },
  textRight: { color: "#fff" },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
    marginBottom: 5,
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 2,
  },
  timeText: {
    fontSize: 10,
  },
  timeLeft: { color: "#aaa" },
  timeRight: { color: "#e0e0e0" },

  // Input Area Styles
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#f2f2f2",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 10,
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  iconButton: {
    padding: 5,
  },

  // Existing Overlays
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  modalOverlay: { flex: 1 },
  menuContainer: {
    position: "absolute",
    top: 50,
    right: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 8,
    paddingVertical: 5,
    width: 160,
  },
  menuItem: { paddingVertical: 12, paddingHorizontal: 15 },
  menuText: { fontSize: 16, color: "#333" },
});
