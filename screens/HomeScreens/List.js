import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db } from "../../firebaseConfig";
import { subscribeToUsers } from "../../services/userServices";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getChatRoomId, unblockUser } from "../../services/chatServices";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";

// --- HELPER: TIME FORMAT ---
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "Offline";
  const date = timestamp.toDate();
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} d ago`;
};

// --- HEADER COMPONENT ---
const CustomHeader = ({
  greeting,
  searchQuery,
  setSearchQuery,
  navigation,
  onOpenBlocked,
}) => {
  const userPhoto = auth.currentUser?.photoURL;
  const userName = auth.currentUser?.displayName?.split(" ")[0] || "Friend";

  return (
    <View style={styles.headerShadowContainer}>
      <LinearGradient
        colors={["#A8E063", "#56AB2F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.headerTitle}>{userName}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 15 }}>
            <TouchableOpacity style={styles.iconButton} onPress={onOpenBlocked}>
              <MaterialCommunityIcons
                name="shield-off"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("MyProfile")}>
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.myAvatar} />
              ) : (
                <View style={styles.myAvatarPlaceholder}>
                  <MaterialCommunityIcons
                    name="account"
                    size={20}
                    color="#56AB2F"
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBarContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color="#fff"
            style={{ opacity: 0.8, marginRight: 10 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color="#fff"
                style={{ opacity: 0.9 }}
              />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

// --- STANDARD USER ITEM ---
const UserItem = ({ item, navigation }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let unsubscribe;
    const fetchUnread = async () => {
      const roomId = await getChatRoomId(auth.currentUser.uid, item.uid);
      const messagesRef = collection(db, "chats", roomId, "messages");
      const q = query(
        messagesRef,
        where("user._id", "!=", auth.currentUser.uid),
        where("received", "==", false)
      );
      unsubscribe = onSnapshot(
        q,
        (snapshot) => setUnreadCount(snapshot.size),
        () => {}
      );
    };
    fetchUnread();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [item.uid]);

  const handlePress = async () => {
    const roomId = await getChatRoomId(auth.currentUser.uid, item.uid);
    navigation.navigate("Chat", { roomId, otherUser: item, type: "private" });
  };

  const isOnline = item.isOnline === true;

  return (
    <TouchableOpacity style={styles.userCard} onPress={handlePress}>
      <View style={styles.avatarContainer}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <MaterialCommunityIcons name="account" size={28} color="#fff" />
          </View>
        )}
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.displayName}>
            {item.displayName || "Unknown"}
          </Text>
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          ) : (
            <Text
              style={[
                styles.timestamp,
                { color: isOnline ? "#56AB2F" : "#888" },
              ]}
            >
              {isOnline ? "Online" : formatLastSeen(item.lastSeen)}
            </Text>
          )}
        </View>
        <Text
          style={[styles.email, unreadCount > 0 && styles.boldText]}
          numberOfLines={1}
        >
          {unreadCount > 0 ? "New messages" : item.email}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// --- BLOCKED USER ITEM ---
const BlockedUserItem = ({ item, onUnblock }) => {
  return (
    <View style={styles.blockedCard}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Image
          source={{ uri: item.photoURL || "https://via.placeholder.com/50" }}
          style={styles.smallAvatar}
        />
        <Text style={styles.blockedName}>{item.displayName}</Text>
      </View>
      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => onUnblock(item)}
      >
        <Text style={styles.unblockText}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- MAIN LIST ---
const List = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [chatTimestamps, setChatTimestamps] = useState({}); // Stores { userId: timestamp }
  const [myBlockList, setMyBlockList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Hello");
  const [timeTicker, setTimeTicker] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const [isBlockedModalVisible, setBlockedModalVisible] = useState(false);

  // 1. Listen to Users
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeToUsers(auth.currentUser.uid, (data) => {
      setUsers(data);
      // Don't set loading false yet, wait for blocklist
    });
    return unsubscribe;
  }, []);

  // 2. Listen to My Block List
  useEffect(() => {
    if (!auth.currentUser) return;
    const myDocRef = doc(db, "users", auth.currentUser.uid);
    const unsub = onSnapshot(myDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setMyBlockList(docSnap.data().blockedUsers || []);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 3. NEW: Listen to Active Chats for Sorting
  useEffect(() => {
    if (!auth.currentUser) return;
    const chatsRef = collection(db, "chats");
    // Query chats where I am a participant
    const q = query(
      chatsRef,
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const timestamps = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Identify the "Other User" ID
        const otherUserId = data.participants.find(
          (uid) => uid !== auth.currentUser.uid
        );

        // Save timestamp if it exists
        if (otherUserId && data.lastMessage?.createdAt) {
          timestamps[otherUserId] = data.lastMessage.createdAt
            .toDate()
            .getTime();
        }
      });

      setChatTimestamps(timestamps);
    });

    return unsubscribe;
  }, []);

  // Greeting & Ticker
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening"
    );
    const interval = setInterval(() => setTimeTicker((p) => p + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  // --- SORTING & FILTERING LOGIC ---
  const getSortedUsers = () => {
    // 1. Filter
    const activeUsers = users.filter((user) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (user.displayName || "").toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q);
      const iBlockedThem = myBlockList.includes(user.uid);
      const theyBlockedMe = user.blockedUsers?.includes(auth.currentUser.uid);
      return matchesSearch && !iBlockedThem && !theyBlockedMe;
    });

    // 2. Map with Timestamp
    const usersWithTime = activeUsers.map((user) => ({
      ...user,
      // If we have a chat timestamp, use it. Otherwise use 0 (far past)
      lastInteractionTime: chatTimestamps[user.uid] || 0,
    }));

    // 3. Sort Descending
    return usersWithTime.sort(
      (a, b) => b.lastInteractionTime - a.lastInteractionTime
    );
  };

  const sortedUsers = getSortedUsers();

  // Filter Blocked Users for Modal
  const blockedUsersList = users.filter((user) =>
    myBlockList.includes(user.uid)
  );

  // --- ACTIONS ---
  const handleUnblock = async (userToUnblock) => {
    Alert.alert("Unblock User", `Unblock ${userToUnblock.displayName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: async () => {
          await unblockUser(auth.currentUser.uid, userToUnblock.uid);
        },
      },
    ]);
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#56AB2F" />
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <CustomHeader
        greeting={greeting}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        navigation={navigation}
        onOpenBlocked={() => setBlockedModalVisible(true)}
      />

      <FlatList
        data={sortedUsers}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
        keyExtractor={(item) => item.uid}
        extraData={[timeTicker, searchQuery, myBlockList, chatTimestamps]} // Re-render when chat timestamps change
        renderItem={({ item }) => (
          <UserItem item={item} navigation={navigation} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#56AB2F"]}
            tintColor="#56AB2F"
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {searchQuery ? "No results found." : "No active contacts."}
            </Text>
          </View>
        }
      />

      {/* --- BLOCKED USERS MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isBlockedModalVisible}
        onRequestClose={() => setBlockedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Blocked Users</Text>
              <TouchableOpacity onPress={() => setBlockedModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {blockedUsersList.length === 0 ? (
              <View style={styles.emptyModalView}>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={50}
                  color="#ccc"
                />
                <Text style={styles.emptyText}>No blocked users.</Text>
              </View>
            ) : (
              <FlatList
                data={blockedUsersList}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                  <BlockedUserItem item={item} onUnblock={handleUnblock} />
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default List;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  headerShadowContainer: {
    backgroundColor: "#fff",
    shadowColor: "#56AB2F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  headerGradient: {
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight + 15 : 55,
    paddingBottom: 25,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greetingText: { color: "#E8F5E9", fontSize: 16, fontWeight: "600" },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#fff" },

  iconButton: {
    width: 45,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 22.5,
  },
  myAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  myAvatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 16, paddingVertical: 5 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 20,
  },

  // User Card Styles
  userCard: {
    flexDirection: "row",
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    backgroundColor: "#fff",
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: { marginRight: 15 },
  avatar: { width: 55, height: 55, borderRadius: 27.5 },
  placeholderAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#56AB2F",
    borderWidth: 2,
    borderColor: "#fff",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 5,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    alignItems: "center",
  },
  displayName: { fontSize: 17, fontWeight: "700", color: "#333" },
  timestamp: { fontSize: 12 },
  email: { fontSize: 13, color: "#888" },
  unreadBadge: {
    backgroundColor: "#56AB2F",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  boldText: { fontWeight: "bold", color: "#000" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  emptyModalView: { alignItems: "center", paddingVertical: 40 },

  // Blocked Item Styles
  blockedCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: "#ccc",
  },
  blockedName: { fontSize: 16, fontWeight: "600", color: "#333" },
  unblockBtn: {
    backgroundColor: "#ffebee",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  unblockText: { color: "#d32f2f", fontWeight: "bold", fontSize: 14 },
});
