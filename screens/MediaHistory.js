import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useChatLogic } from "../hooks/useChatLogic";
import { uploadToCloudinary } from "../cloudinaryConfig"; 
import { updateChatBackground } from "../services/chatServices"; 

const { width } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const IMAGE_SIZE = width / COLUMN_COUNT;

export default function MediaHistory({ route, navigation }) {
  const { roomId, type } = route.params;
  const { messages, isLoadingMessages } = useChatLogic(roomId, type);

  const mediaMessages = useMemo(() => {
    return messages.filter((msg) => msg.image);
  }, [messages]);

  const [selectedImage, setSelectedImage] = useState(null);
  const [isSettingWallpaper, setIsSettingWallpaper] = useState(false);

  // --- NEW: PICK AND SET BACKGROUND ---
  const handleSetBackground = async () => {
    try {
      // 1. Pick Image
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true, 
        aspect: [9, 16], 
      });

      if (result.canceled) return;

      setIsSettingWallpaper(true);

      // 2. Upload to Cloudinary
      const uri = result.assets[0].uri;
      const uploadedUrl = await uploadToCloudinary(uri, "image", "chat_bg");

      // 3. Update Firestore
      await updateChatBackground(roomId, uploadedUrl, type);

      Alert.alert("Success", "Chat wallpaper updated!");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update wallpaper.");
    } finally {
      setIsSettingWallpaper(false);
    }
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        onPress={() => setSelectedImage(item.image)}
        activeOpacity={0.8}
        style={styles.imageContainer}
      >
        <Image
          source={{ uri: item.image }}
          style={styles.gridImage}
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Media & Wallpaper</Text>

        {/* NEW: WALLPAPER BUTTON */}
        <TouchableOpacity
          onPress={handleSetBackground}
          style={styles.actionBtn}
          disabled={isSettingWallpaper}
        >
          {isSettingWallpaper ? (
            <ActivityIndicator size="small" color="#56AB2F" />
          ) : (
            <MaterialCommunityIcons
              name="format-paint"
              size={26}
              color="#56AB2F"
            />
          )}
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      {isLoadingMessages ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#56AB2F" />
        </View>
      ) : (
        <>
          {mediaMessages.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons
                name="image-off-outline"
                size={60}
                color="#ccc"
              />
              <Text style={styles.emptyText}>No media shared yet</Text>
            </View>
          ) : (
            <FlatList
              data={mediaMessages}
              keyExtractor={(item) => item._id.toString()}
              renderItem={renderItem}
              numColumns={COLUMN_COUNT}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* FULL SCREEN IMAGE MODAL */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.fullImageModal}>
          <StatusBar backgroundColor="black" barStyle="light-content" />
          <TouchableOpacity
            style={styles.closeImageBtn}
            onPress={() => setSelectedImage(null)}
          >
            <MaterialCommunityIcons name="close" size={30} color="white" />
          </TouchableOpacity>
          <Image
            source={{ uri: selectedImage }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  backBtn: {
    padding: 5,
  },
  actionBtn: {
    padding: 5,
  },
  listContent: {
    paddingBottom: 20,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderWidth: 0.5,
    borderColor: "#fff",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 10,
    color: "#999",
    fontSize: 16,
  },
  fullImageModal: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },
  closeImageBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 5,
  },
});
