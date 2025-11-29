import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";

import { subscribeToUsers } from "../services/userServices";
import { createGroup } from "../services/chatServices";
import { auth } from "../firebaseConfig";

export default function CreateGroup({ navigation }) {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [groupImage, setGroupImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch Contacts
  useEffect(() => {
    const unsubscribe = subscribeToUsers(auth.currentUser.uid, (data) => {
      setUsers(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Handle Selection
  const toggleUser = (uid) => {
    if (selectedUsers.includes(uid)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== uid));
    } else {
      setSelectedUsers([...selectedUsers, uid]);
    }
  };

  // Pick Image
  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setGroupImage(result.assets[0].uri);
    }
  };

  // Create Group
  const handleCreate = async () => {
    if (groupName.trim().length === 0)
      return Alert.alert("Missing Info", "Enter a group name");
    if (selectedUsers.length === 0)
      return Alert.alert("Missing Info", "Select members");

    setCreating(true);
    try {
      const allParticipants = [...selectedUsers, auth.currentUser.uid];
      await createGroup(groupName, allParticipants, groupImage);
      setCreating(false);
      navigation.goBack();
    } catch (error) {
      console.error(error);
      setCreating(false);
      Alert.alert("Error", "Failed to create group");
    }
  };

  const renderUser = ({ item }) => {
    const isSelected = selectedUsers.includes(item.uid);
    return (
      <TouchableOpacity
        style={[styles.userCard, isSelected && styles.selectedCard]}
        onPress={() => toggleUser(item.uid)}
      >
        <Image
          source={{ uri: item.photoURL || "https://via.placeholder.com/50" }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && (
            <MaterialCommunityIcons name="check" size={16} color="#fff" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity onPress={handleCreate} disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#56AB2F" />
          ) : (
            <Text style={styles.createBtnText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.inputSection}>
        <TouchableOpacity onPress={handlePickImage} style={styles.imagePicker}>
          {groupImage ? (
            <Image source={{ uri: groupImage }} style={styles.groupImage} />
          ) : (
            <MaterialCommunityIcons name="camera-plus" size={30} color="#888" />
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.nameInput}
          placeholder="Group Name"
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <Text style={styles.sectionTitle}>
        Participants: {selectedUsers.length}
      </Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#56AB2F"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={renderUser}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  createBtnText: { fontSize: 16, color: "#56AB2F", fontWeight: "bold" },
  inputSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f9f9f9",
  },
  imagePicker: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e1e1e1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  groupImage: { width: "100%", height: "100%" },
  nameInput: {
    flex: 1,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingVertical: 5,
  },
  sectionTitle: {
    padding: 15,
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    backgroundColor: "#fff",
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedCard: { backgroundColor: "#f0f8ff" },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "600", color: "#333" },
  userEmail: { fontSize: 13, color: "#888" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: { backgroundColor: "#56AB2F", borderColor: "#56AB2F" },
});
