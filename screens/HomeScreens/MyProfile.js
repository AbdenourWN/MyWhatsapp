import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { auth, db } from "../../firebaseConfig";
import { signOut, updateProfile, deleteUser } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, setDoc } from "firebase/firestore";

import { uploadToCloudinary } from "../../cloudinaryConfig";

export default function MyProfile() {
  const [displayName, setDisplayName] = useState("");
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setDisplayName(auth.currentUser.displayName || "");
      setImage(auth.currentUser.photoURL);
    }
  }, []);

  const handleLogout = () => {
    signOut(auth).catch((error) => Alert.alert("Logout Error", error.message));
  };

  // 2. Add Handle Delete Logic
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive", // Shows red on iOS
          onPress: async () => {
            const user = auth.currentUser;
            if (user) {
              try {
                await deleteUser(user);
                Alert.alert(
                  "Account Deleted",
                  "Your account has been successfully deleted."
                );
                // Navigation to login is handled automatically by your App.js auth listener
              } catch (error) {
                console.log("Delete Error: ", error);
                // Firebase security: Sensitive actions require recent login
                if (error.code === "auth/requires-recent-login") {
                  Alert.alert(
                    "Security Check",
                    "For security reasons, please Log Out and Log In again before deleting your account."
                  );
                } else {
                  Alert.alert("Error", error.message);
                }
              }
            }
          },
        },
      ]
    );
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpdateProfile = async () => {
    if (!auth.currentUser) return;
    setUploading(true);

    let photoURL = auth.currentUser.photoURL;

    const isLocalImage = image && !image.startsWith("http");

    if (isLocalImage) {
      try {
        photoURL = await uploadToCloudinary(image);
      } catch (error) {
        Alert.alert("Upload Error", "Failed to upload image.");
        setUploading(false);
        return;
      }
    }

    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName,
        photoURL: photoURL,
      });

      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(
        userRef,
        {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          displayName: displayName,
          photoURL: photoURL,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );

      Alert.alert(
        "Profile Updated",
        "Your profile has been updated successfully."
      );
    } catch (error) {
      Alert.alert("Update Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {image ? (
              <Image source={{ uri: image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialCommunityIcons
                  name="camera-plus"
                  size={40}
                  color="#fff"
                />
              </View>
            )}
            <View style={styles.editIcon}>
              <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={auth.currentUser?.email}
            editable={false}
          />

          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your display name"
            value={displayName}
            onChangeText={setDisplayName}
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleUpdateProfile}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Update Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Updated Action Section with Delete Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={22} color="#555" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={22}
              color="#d9534f"
            />
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
    justifyContent: "space-between",
  },
  profileContainer: {
    width: "100%",
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 30,
    position: "relative",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  editIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#56AB2F",
    padding: 8,
    borderRadius: 15,
  },
  label: {
    alignSelf: "flex-start",
    marginLeft: "5%",
    marginBottom: 5,
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  input: {
    width: "90%",
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  disabledInput: {
    backgroundColor: "#e9ecef",
    color: "#6c757d",
  },
  button: {
    width: "90%",
    backgroundColor: "#56AB2F",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  actionSection: {
    width: "100%",
    alignItems: "center",
    marginTop: 40,
    gap: 15,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    width: "90%",
    justifyContent: "center",
  },
  logoutButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8d7da",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    width: "90%",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#d9534f",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
});
