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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
// 1. FIXED: Added 'db' to imports
import { auth, db } from "../../firebaseConfig"; 
import { subscribeToUsers } from "../../services/userServices";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getChatRoomId } from "../../services/chatServices";
// 2. FIXED: Added Firestore functions needed for Unread Count
import { collection, query, where, onSnapshot } from "firebase/firestore"; 

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

// --- EXTRACTED HEADER COMPONENT ---
const CustomHeader = ({
  greeting,
  searchQuery,
  setSearchQuery,
  navigation,
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

// --- USER ITEM COMPONENT ---
const UserItem = ({ item, navigation }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let unsubscribe;
    
    const fetchUnread = async () => {
      // Get Room ID
      const roomId = await getChatRoomId(auth.currentUser.uid, item.uid);
      
      const messagesRef = collection(db, 'chats', roomId, 'messages');
      
      // LISTEN for unread messages
      const q = query(
        messagesRef,
        where("user._id", "!=", auth.currentUser.uid), // Message from them
        where("received", "==", false) // Not seen yet
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        setUnreadCount(snapshot.size);
      }, (error) => {
        console.log("Unread Count Error (Check Indexes):", error);
      });
    };

    fetchUnread();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [item.uid]);

  const handlePress = async () => {
    const roomId = await getChatRoomId(auth.currentUser.uid, item.uid);
    navigation.navigate("Chat", {
      roomId: roomId,
      otherUser: item,
      type: "private",
    });
  };

  const isOnline = item.isOnline === true;
  const statusColor = isOnline ? "#56AB2F" : "#888";

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

          {/* Unread Badge OR Timestamp */}
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          ) : (
            <Text style={[styles.timestamp, { color: statusColor }]}>
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

// --- MAIN LIST COMPONENT ---
const List = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Hello");
  const [timeTicker, setTimeTicker] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const setupRealtimeListener = () => {
    if (!auth.currentUser) return;
    const unsubscribe = subscribeToUsers(auth.currentUser.uid, (data) => {
      setUsers(data);
      setLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = setupRealtimeListener();

    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTicker((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = user.displayName?.toLowerCase().includes(query);
    const emailMatch = user.email?.toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  const renderItem = ({ item }) => (
    <UserItem item={item} navigation={navigation} />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#56AB2F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <CustomHeader
        greeting={greeting}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        navigation={navigation}
      />

      <FlatList
        data={filteredUsers}
        contentContainerStyle={{ paddingTop: 10 }}
        keyExtractor={(item) => item.uid}
        extraData={[timeTicker, searchQuery]}
        renderItem={renderItem}
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
              {searchQuery ? "No results found." : "No contacts found."}
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default List;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
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
  greetingText: {
    color: "#E8F5E9",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
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
    justifyContent: 'center',
    alignItems: 'center',
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
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 5,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
  },
  placeholderAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: "#e0e0e0",
    justifyContent: 'center',
    alignItems: 'center',
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
  displayName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
  },
  timestamp: {
    fontSize: 12,
  },
  email: {
    fontSize: 13,
    color: "#888",
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 50,
  },
  unreadBadge: {
    backgroundColor: "#56AB2F",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  boldText: {
    fontWeight: "bold",
    color: "#000",
  },
});