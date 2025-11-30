import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  updateGroupInfo,
  leaveGroup,
  addGroupParticipants,
  kickGroupParticipant,
  updateGroupAdmin,
} from "../services/chatServices";
import { subscribeToUsers } from "../services/userServices";
import { uploadToCloudinary } from "../cloudinaryConfig";

export default function GroupSettings({ route, navigation }) {
  const { groupId } = route.params;
  const currentUserUid = auth.currentUser.uid;

  const [groupData, setGroupData] = useState(null);
  const [participantsDetails, setParticipantsDetails] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modals
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [adminTransferModalVisible, setAdminTransferModalVisible] =
    useState(false);

  const [allUsers, setAllUsers] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);

  const amIAdmin = groupData?.adminId === currentUserUid;

  // 1. Fetch Group Data
  useEffect(() => {
    const fetchGroupAndMembers = async () => {
      try {
        const docRef = doc(db, "groups", groupId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setGroupData(data);
          setNewName(data.groupName);

          const memberPromises = data.participants.map(async (uid) => {
            const userSnap = await getDoc(doc(db, "users", uid));
            return userSnap.exists() ? userSnap.data() : null;
          });

          const members = await Promise.all(memberPromises);
          setParticipantsDetails(members.filter((m) => m !== null));
        }
      } catch (error) {
        console.error("Error fetching group:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupAndMembers();
  }, [groupId, updating]);

  // 2. Fetch All Users (for adding members)
  useEffect(() => {
    const sub = subscribeToUsers(currentUserUid, (users) => {
      setAllUsers(users);
    });
    return sub;
  }, []);

  // --- ACTIONS ---

  const handleUpdateImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled) {
      setUpdating(true);
      try {
        const url = await uploadToCloudinary(result.assets[0].uri, "image");
        await updateGroupInfo(groupId, newName, url);
        setGroupData((prev) => ({ ...prev, groupImage: url }));
        Alert.alert("Success", "Group photo updated");
      } catch (e) {
        Alert.alert("Error", "Failed to update image");
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleUpdateName = async () => {
    if (newName.trim() === "") return;
    setUpdating(true);
    try {
      await updateGroupInfo(groupId, newName, null);
      Alert.alert("Success", "Group name updated");
    } catch (e) {
      Alert.alert("Error", "Failed to update name");
    } finally {
      setUpdating(false);
    }
  };

  const handleKickUser = (userToKick) => {
    Alert.alert(
      "Remove Participant",
      `Remove ${userToKick.displayName} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            try {
              await kickGroupParticipant(groupId, userToKick.uid);
              Alert.alert("Removed", `${userToKick.displayName} was removed.`);
            } catch (e) {
              Alert.alert("Error", "Failed to remove user");
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    // If I am admin and there are other people, I must transfer admin rights first
    if (amIAdmin && groupData.participants.length > 1) {
      setAdminTransferModalVisible(true);
      return;
    }

    // Normal Leave (or I am the last person)
    Alert.alert("Exit Group", "Are you sure you want to leave this group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Exit",
        style: "destructive",
        onPress: async () => {
          setUpdating(true);
          await leaveGroup(groupId, currentUserUid);
          navigation.popToTop();
        },
      },
    ]);
  };

  const handleTransferAndLeave = async (newAdminId) => {
    setUpdating(true);
    try {
      // 1. Assign new admin
      await updateGroupAdmin(groupId, newAdminId);
      // 2. Remove myself
      await leaveGroup(groupId, currentUserUid);
      setAdminTransferModalVisible(false);
      navigation.popToTop();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to transfer admin rights");
      setUpdating(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    setUpdating(true);
    try {
      await addGroupParticipants(groupId, selectedNewMembers);
      setAddMemberModalVisible(false);
      setSelectedNewMembers([]);
      Alert.alert("Success", "Members added!");
    } catch (e) {
      Alert.alert("Error", "Could not add members");
    } finally {
      setUpdating(false);
    }
  };

  const toggleSelectUser = (uid) => {
    if (selectedNewMembers.includes(uid)) {
      setSelectedNewMembers((p) => p.filter((id) => id !== uid));
    } else {
      setSelectedNewMembers((p) => [...p, uid]);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#56AB2F" />
      </View>
    );

  const potentialNewMembers = allUsers.filter(
    (u) => !groupData?.participants?.includes(u.uid)
  );

  const otherMembers = participantsDetails.filter(
    (u) => u.uid !== currentUserUid
  );

  return (
    <View style={styles.container}>
      {/* --- GREEN GRADIENT HEADER --- */}
      <LinearGradient
        colors={["#A8E063", "#56AB2F"]}
        style={[styles.header, { paddingTop: 60 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* --- PROFILE SECTION --- */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={handleUpdateImage}
            disabled={updating}
            style={styles.imageWrapper}
          >
            {groupData?.groupImage ? (
              <Image
                source={{ uri: groupData.groupImage }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar]}>
                <MaterialCommunityIcons
                  name="image-plus"
                  size={40}
                  color="#fff"
                />
              </View>
            )}
            <View style={styles.editBadge}>
              <MaterialCommunityIcons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.nameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Group Name"
            />
            {newName !== groupData?.groupName && (
              <TouchableOpacity onPress={handleUpdateName} disabled={updating}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={28}
                  color="#56AB2F"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* --- PARTICIPANTS SECTION --- */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Participants ({participantsDetails.length})
            </Text>
            <TouchableOpacity
              onPress={() => setAddMemberModalVisible(true)}
              style={styles.addMemberBtnSmall}
            >
              <MaterialCommunityIcons
                name="account-plus"
                size={20}
                color="#56AB2F"
              />
              <Text style={styles.addMemberText}>Add</Text>
            </TouchableOpacity>
          </View>

          {participantsDetails.map((member, index) => (
            <View key={index} style={styles.memberCard}>
              <Image
                source={{
                  uri: member.photoURL || "https://via.placeholder.com/50",
                }}
                style={styles.memberAvatar}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.uid === currentUserUid ? "You" : member.displayName}
                </Text>
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>

              {/* Status Icons: Admin Crown or Kick Button */}
              {groupData.adminId === member.uid ? (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminText}>Admin</Text>
                </View>
              ) : (
                amIAdmin && (
                  <TouchableOpacity
                    onPress={() => handleKickUser(member)}
                    style={styles.kickBtn}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={20}
                      color="#ff4444"
                    />
                  </TouchableOpacity>
                )
              )}
            </View>
          ))}
        </View>

        {/* --- DANGER ZONE --- */}
        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={handleLeaveGroup}
          disabled={updating}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#d9534f" />
          <Text style={styles.leaveText}>Exit Group</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* --- ADD MEMBERS MODAL --- */}
      <Modal
        visible={addMemberModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Participants</Text>
            <TouchableOpacity onPress={() => setAddMemberModalVisible(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={potentialNewMembers}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => {
              const isSel = selectedNewMembers.includes(item.uid);
              return (
                <TouchableOpacity
                  style={[styles.userRow, isSel && styles.userRowSelected]}
                  onPress={() => toggleSelectUser(item.uid)}
                >
                  <Image
                    source={{ uri: item.photoURL }}
                    style={styles.smallAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalUserName}>{item.displayName}</Text>
                    <Text style={styles.modalUserEmail}>{item.email}</Text>
                  </View>
                  {isSel && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color="#56AB2F"
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text
                style={{ textAlign: "center", marginTop: 20, color: "#888" }}
              >
                No new contacts available.
              </Text>
            }
          />
          {selectedNewMembers.length > 0 && (
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={handleAddMembers}
            >
              <Text style={styles.modalDoneText}>
                Add {selectedNewMembers.length} Members
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* --- SELECT NEW ADMIN MODAL --- */}
      <Modal
        visible={adminTransferModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAdminTransferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>Select New Admin</Text>
            <Text style={styles.alertMessage}>
              You must select a new admin before leaving the group.
            </Text>

            <FlatList
              data={otherMembers}
              keyExtractor={(item) => item.uid}
              style={{ maxHeight: 200, width: "100%" }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.adminSelectRow}
                  onPress={() =>
                    Alert.alert(
                      "Transfer & Leave",
                      `Make ${item.displayName} admin and leave?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Confirm",
                          style: "destructive",
                          onPress: () => handleTransferAndLeave(item.uid),
                        },
                      ]
                    )
                  }
                >
                  <Image
                    source={{ uri: item.photoURL }}
                    style={styles.miniAvatar}
                  />
                  <Text style={styles.adminSelectName}>{item.displayName}</Text>
                  <MaterialCommunityIcons
                    name="crown-outline"
                    size={20}
                    color="#56AB2F"
                  />
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setAdminTransferModalVisible(false)}
            >
              <Text style={{ color: "#666" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {updating && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // --- HEADER ---
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  backBtn: { padding: 5 },

  // --- PROFILE ---
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 20,
  },
  imageWrapper: { position: "relative", marginBottom: 20 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#fff",
  },
  placeholderAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  editBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "#56AB2F",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FB",
    borderRadius: 15,
    paddingHorizontal: 15,
    width: "85%",
    height: 50,
  },
  nameInput: { flex: 1, fontSize: 18, fontWeight: "600", color: "#333" },

  // --- PARTICIPANTS ---
  sectionContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#666" },
  addMemberBtnSmall: { flexDirection: "row", alignItems: "center", padding: 5 },
  addMemberText: { color: "#56AB2F", fontWeight: "bold", marginLeft: 5 },

  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  memberAvatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 15 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: "600", color: "#333" },
  memberEmail: { fontSize: 13, color: "#999" },

  adminBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  adminText: { color: "#56AB2F", fontSize: 10, fontWeight: "bold" },

  kickBtn: { padding: 8 },

  // --- LEAVE BTN ---
  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 18,
    marginHorizontal: 20,
    borderRadius: 15,
    marginBottom: 40,
    elevation: 2,
  },
  leaveText: {
    color: "#d9534f",
    marginLeft: 10,
    fontWeight: "bold",
    fontSize: 16,
  },

  // --- MODALS ---
  modalContainer: { flex: 1, backgroundColor: "#fff", paddingTop: 20 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  closeText: { color: "#007AFF", fontSize: 16 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#f9f9f9",
  },
  userRowSelected: { backgroundColor: "#F0F9F4" },
  smallAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
  modalUserName: { fontSize: 16, fontWeight: "600", color: "#333" },
  modalUserEmail: { fontSize: 13, color: "#888" },
  modalDoneBtn: {
    backgroundColor: "#56AB2F",
    margin: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  modalDoneText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  // --- ADMIN TRANSFER MODAL ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    elevation: 5,
  },
  alertTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  alertMessage: { color: "#666", textAlign: "center", marginBottom: 15 },
  adminSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    width: "100%",
  },
  miniAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  adminSelectName: { flex: 1, fontWeight: "600" },
  cancelBtn: { marginTop: 15, padding: 10 },

  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});
