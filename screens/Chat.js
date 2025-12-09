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
  StatusBar,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import moment from "moment";

import { auth } from "../firebaseConfig";
import { uploadToCloudinary } from "../cloudinaryConfig";
import {
  sendMessage,
  clearChatHistory,
  blockUser,
  setTypingStatus,
  setRecordingStatus,
  listenForIncomingCalls,
} from "../services/chatServices";

// Components
import ChatHeader from "../Components/Chat/ChatHeader";
import AudioMessage from "../Components/Chat/AudioMessage";
import RecordingBar from "../Components/Chat/RecordingBar";
import TypingIndicator from "../Components/Chat/TypingIndicator";
import LocationMessage from "../Components/Chat/LocationMessage";

// Hooks
import { useChatLogic } from "../hooks/useChatLogic";
import CallMessage from "../Components/Chat/CallMessage";

export default function Chat({ route, navigation }) {
  const { roomId, otherUser, type } = route.params;
  const {
    messages,
    isLoadingMessages,
    typingUsers,
    recordingUsers,
    headerInfo,
    loadEarlier,
    isLoadingEarlier,
  } = useChatLogic(roomId, type);
  const insets = useSafeAreaInsets();

  const displayUser = headerInfo
    ? {
        ...otherUser,
        displayName: headerInfo.displayName,
        photoURL: headerInfo.photoURL,
      }
    : otherUser;

  // State
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [attachmentVisible, setAttachmentVisible] = useState(false);

  // Recording State
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const durationInterval = useRef(null);
  const soundManager = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    (async () => await Audio.requestPermissionsAsync())();
    return () => {
      if (soundManager.current?.sound) soundManager.current.sound.unloadAsync();
    };
  }, []);

  // --- TYPING LOGIC ---
  const handleHeaderPress = () => {
    if (type === "group") {
      navigation.navigate("GroupSettings", { groupId: roomId });
    }
  };

  const handleTextChange = useCallback(
    async (newText) => {
      setInputText(newText);
      if (newText.length > 0) {
        if (!isTypingRef.current) {
          isTypingRef.current = true;
          await setTypingStatus(roomId, auth.currentUser.uid, true, type);
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(async () => {
          isTypingRef.current = false;
          await setTypingStatus(roomId, auth.currentUser.uid, false, type);
        }, 2000);
      } else if (newText.length === 0 && isTypingRef.current) {
        isTypingRef.current = false;
        await setTypingStatus(roomId, auth.currentUser.uid, false, type);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    },
    [roomId, type]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current)
        setTypingStatus(roomId, auth.currentUser.uid, false, type);
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
          setIsClearing(true);
          try {
            await clearChatHistory(roomId, auth.currentUser.uid, type);
            navigation.goBack();
          } catch (error) {
            console.error(error);
            setIsClearing(false);
            Alert.alert("Error", "Could not clear chat.");
          }
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

  const handleSend = async () => {
    if (!inputText.trim()) return;
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
    setInputText("");
    sendMessage(roomId, messageToSend, type);
  };

  // --- LOCATION LOGIC ---
  const handleSendLocation = async () => {
    setAttachmentVisible(false); // Close menu
    setIsUploading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Allow location access to share.");
        setIsUploading(false);
        return;
      }

      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert("GPS Disabled", "Please turn on your location services.");
        setIsUploading(false);
        return;
      }

      let location = null;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 5000,
        });
      } catch (error) {
        console.log("Location timeout, using last known...");
        location = await Location.getLastKnownPositionAsync();
      }

      if (!location) throw new Error("Unable to retrieve location");

      const messageToSend = {
        _id: Math.random().toString(36).substring(7),
        text: "",
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        createdAt: new Date(),
        user: {
          _id: auth.currentUser.uid,
          name: auth.currentUser.displayName,
          avatar: auth.currentUser.photoURL,
        },
      };

      sendMessage(roomId, messageToSend, type);
    } catch (error) {
      console.error("Location Error:", error);
      Alert.alert("Error", "Could not fetch location.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- MEDIA HANDLERS ---
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
      sendMessage(roomId, msg, type);
    } catch (error) {
      Alert.alert("Error", "Failed to send media");
    } finally {
      setIsUploading(false);
    }
  };

  const pickImage = async () => {
    setAttachmentVisible(false);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) handleUploadAndSend(result.assets[0].uri, "image");
  };

  const launchCamera = async () => {
    setAttachmentVisible(false);
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled) handleUploadAndSend(result.assets[0].uri, "image");
  };

  // --- RECORDING ---
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

  // --- RENDER HELPERS ---
  const formatTime = (date) => {
    if (!date) return "";
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return moment(d).format("LT");
  };

  const renderLoadingEarlier = () => {
    if (!isLoadingEarlier) return null;
    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator size="small" color="#56AB2F" />
      </View>
    );
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
          {item.callInfo ? (
            <CallMessage item={item} isMe={isMe} />
          ) : (
            // 2. STANDARD MESSAGES (Text, Image, Audio, Location)
            <>
              {item.image && (
                <TouchableOpacity onPress={() => setSelectedImage(item.image)}>
                  <Image
                    source={{ uri: item.image }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}

              {item.audio && (
                <AudioMessage
                  currentMessage={item}
                  soundManager={soundManager}
                />
              )}

              {item.location && (
                <LocationMessage location={item.location} isMe={isMe} />
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
            </>
          )}

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
        user={displayUser}
        chatId={roomId}
        onMenuPress={() => setMenuVisible(true)}
        typingUsers={typingUsers}
        recordingUsers={recordingUsers}
        onHeaderPress={handleHeaderPress}
        type={type}
      />

      {isLoadingMessages || isClearing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#56AB2F" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={-15}
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item._id.toString()}
            renderItem={renderMessageItem}
            inverted
            contentContainerStyle={styles.flatListContent}
            keyboardShouldPersistTaps="handled"
            onEndReached={loadEarlier}
            onEndReachedThreshold={0.1}
            ListFooterComponent={renderLoadingEarlier}
            ListHeaderComponent={
              <View style={{ paddingBottom: 5, paddingLeft: 10 }}>
                <TypingIndicator
                  typingUsers={typingUsers}
                  recordingUsers={recordingUsers}
                />
              </View>
            }
          />

          <View
            style={{ backgroundColor: "#f2f2f2", paddingBottom: insets.bottom }}
          >
            {isRecording ? (
              <RecordingBar
                onCancel={cancelRecording}
                onSend={stopRecording}
                duration={recordingDuration}
              />
            ) : (
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  onPress={() => setAttachmentVisible(true)}
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
          </View>
        </KeyboardAvoidingView>
      )}

      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#56AB2F" />
        </View>
      )}

      {/* --- MENU MODAL --- */}
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

      {/* --- ATTACHMENT MODAL --- */}
      <Modal
        visible={attachmentVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachmentVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAttachmentVisible(false)}
        >
          <View style={styles.attachmentContainer}>
            <TouchableOpacity
              style={styles.attachmentItem}
              onPress={launchCamera}
            >
              <View style={[styles.attachIcon, { backgroundColor: "#ff5252" }]}>
                <MaterialCommunityIcons name="camera" size={24} color="#fff" />
              </View>
              <Text style={styles.attachText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachmentItem} onPress={pickImage}>
              <View style={[styles.attachIcon, { backgroundColor: "#7c4dff" }]}>
                <MaterialCommunityIcons name="image" size={24} color="#fff" />
              </View>
              <Text style={styles.attachText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentItem}
              onPress={handleSendLocation}
            >
              <View style={[styles.attachIcon, { backgroundColor: "#0f9d58" }]}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={24}
                  color="#fff"
                />
              </View>
              <Text style={styles.attachText}>Location</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* --- FULL SCREEN IMAGE --- */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.fullImageModal}>
          <StatusBar backgroundColor="black" barStyle="light-content" />
          <TouchableOpacity
            style={[styles.closeImageBtn, { top: insets.top + 10 }]}
            onPress={() => setSelectedImage(null)}
          >
            <MaterialCommunityIcons name="close" size={30} color="white" />
          </TouchableOpacity>
          <TouchableWithoutFeedback onPress={() => setSelectedImage(null)}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f2f2" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  flatListContent: { paddingVertical: 10, paddingHorizontal: 10 },
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
  bubbleLeft: { backgroundColor: "#fff", borderBottomLeftRadius: 5 },
  bubbleRight: { backgroundColor: "#56AB2F", borderBottomRightRadius: 5 },
  messageText: { fontSize: 16 },
  textLeft: { color: "#000" },
  textRight: { color: "#fff" },
  messageImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 5 },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 2,
  },
  timeText: { fontSize: 10 },
  timeLeft: { color: "#aaa" },
  timeRight: { color: "#e0e0e0" },
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
  iconButton: { padding: 5 },
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
  modalOverlay: { flex: 1, backgroundColor: "transparent" },
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
  attachmentContainer: {
    position: "absolute",
    bottom: 80,
    left: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    width: 150,
    gap: 15,
  },
  attachmentItem: { flexDirection: "row", alignItems: "center" },
  attachIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  attachText: { fontSize: 16, fontWeight: "500", color: "#333" },
  fullImageModal: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: { width: "100%", height: "100%" },
  closeImageBtn: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 5,
  },
});
