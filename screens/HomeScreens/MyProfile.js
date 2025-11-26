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
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../firebaseConfig";
import { signOut, updateProfile, deleteUser } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

import { uploadToCloudinary } from "../../cloudinaryConfig";

export default function MyProfile() {
  const [displayName, setDisplayName] = useState("");
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      setDisplayName(auth.currentUser.displayName || "");
      setImage(auth.currentUser.photoURL);
    }
  }, []);

  const handleLogout = async () => {
    try {
      // 1. Set User to OFFLINE in Firestore
      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userRef, {
          isOnline: false,
          lastSeen: serverTimestamp()
        }, { merge: true });
      }

      // 2. Sign Out
      await signOut(auth);
    } catch (error) {
      Alert.alert("Logout Error", error.message);
    }
  };

  // --- HANDLE DELETE ACCOUNT (Firestore + Auth) ---
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const user = auth.currentUser;
            if (user) {
              try {
                // 1. DELETE FROM FIRESTORE
                await deleteDoc(doc(db, "users", user.uid));

                // 2. DELETE FROM AUTH
                await deleteUser(user);

                Alert.alert(
                  "Account Deleted",
                  "Your account has been deleted."
                );
              } catch (error) {
                console.log("Delete Error: ", error);
                if (error.code === "auth/requires-recent-login") {
                  Alert.alert(
                    "Security Check",
                    "Please Log Out and Log In again."
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

  // --- AUTO UPLOAD & SAVE IMAGE ---
  const uploadAndSaveImage = async (localUri) => {
    if (!auth.currentUser) return;
    setImageUploading(true);

    try {
      // 1. Upload to Cloudinary
      const cloudUrl = await uploadToCloudinary(localUri);

      // 2. Update Firebase Auth Profile
      await updateProfile(auth.currentUser, { photoURL: cloudUrl });

      // 3. Update Firestore Database
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(userRef, { photoURL: cloudUrl }, { merge: true });

      // 4. Update UI
      setImage(cloudUrl);
    } catch (error) {
      console.error("Image Upload Error:", error);
      Alert.alert("Error", "Failed to update profile photo.");
      // Revert to previous image if failed
      setImage(auth.currentUser.photoURL);
    } finally {
      setImageUploading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const selectedUri = result.assets[0].uri;
      setImage(selectedUri);

      // Trigger the auto-upload logic
      await uploadAndSaveImage(selectedUri);
    }
  };

  // --- HANDLE TEXT UPDATE ONLY ---
  // Since image handles itself now, this mostly handles Display Name
  const handleUpdateProfile = async () => {
    if (!auth.currentUser) return;
    setUploading(true);

    try {
      // Update Auth
      await updateProfile(auth.currentUser, {
        displayName: displayName,
        // We ensure photoURL is consistent, though uploadAndSaveImage handles it too
        photoURL: auth.currentUser.photoURL,
      });

      // Update Firestore
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(
        userRef,
        {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          displayName: displayName,
          // Sync photoURL just in case
          photoURL: auth.currentUser.photoURL,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );

      Alert.alert("Success", "Profile details updated.");
    } catch (error) {
      Alert.alert("Update Error", error.message);
    } finally {
      setUploading(false);
    }
  };

  // --- STYLISH HEADER ---
  const CustomHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={["#A8E063", "#56AB2F"]}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Profile</Text>
      </LinearGradient>

      {/* Avatar overlaps the header */}
      <View style={styles.avatarWrapper}>
        <TouchableOpacity onPress={pickImage} disabled={imageUploading}>
          <View style={styles.avatarBorder}>
            {image ? (
              <Image source={{ uri: image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <MaterialCommunityIcons
                  name="camera-plus"
                  size={40}
                  color="#999"
                />
              </View>
            )}

            {/* Loading Spinner overlay */}
            {imageUploading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#56AB2F" />
              </View>
            )}
          </View>

          {/* Edit Icon Badge */}
          <View style={styles.editIconBadge}>
            <MaterialCommunityIcons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <StatusBar style="light" />

      <CustomHeader />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.profileContainer}>
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
                <Text style={styles.buttonText}>Update Name</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
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
    </View>
  );
}

const styles = StyleSheet.create({

  // --- MAIN CONTENT ---
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  profileContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 40,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  headerGradient: {
    width: "100%",
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
  },
  avatarWrapper: {
    position: "absolute",
    bottom: -70, // Pulls the avatar down 60px
    zIndex: 10,
  },
  avatarBorder: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#fff",
    padding: 4, // Creates the white border effect
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  avatarPlaceholder: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  editIconBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#56AB2F",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 4,
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
    marginTop: 10,
    shadowColor: "#56AB2F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
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
    marginBottom: 20,
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
