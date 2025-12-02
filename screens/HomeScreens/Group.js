import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
  StatusBar as RNStatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";

// --- HEADER ---
const CustomHeader = ({ searchQuery, setSearchQuery }) => {
  return (
    <View style={styles.headerShadowContainer}>
      <LinearGradient
        colors={["#A8E063", "#56AB2F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>My Groups</Text>
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
            placeholder="Search groups..."
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

// --- LIST ITEM ---
const GroupItem = ({ item, navigation }) => {
  const handlePress = () => {
    navigation.navigate("Chat", {
      roomId: item.id,
      otherUser: {
        uid: item.id,
        displayName: item.groupName,
        photoURL: item.groupImage,
      },
      type: "group",
    });
  };

  // Format Time Helper
  const getDisplayTime = () => {
    if (item.lastMessage?.createdAt?.toDate) {
      return item.lastMessage.createdAt
        .toDate()
        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return "";
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.imageContainer}>
        {item.groupImage ? (
          <Image source={{ uri: item.groupImage }} style={styles.groupAvatar} />
        ) : (
          <View style={[styles.groupAvatar, styles.placeholderAvatar]}>
            <MaterialCommunityIcons
              name="account-group"
              size={28}
              color="#fff"
            />
          </View>
        )}
      </View>

      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.groupName}>{item.groupName}</Text>
          <Text style={styles.timeText}>{getDisplayTime()}</Text>
        </View>

        <Text style={styles.lastMsg} numberOfLines={1}>
          {item.participants?.length} Members
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// --- MAIN SCREEN ---
export default function Group({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!auth.currentUser) return;

    const groupsRef = collection(db, "groups");
    const q = query(
      groupsRef,
      where("participants", "array-contains", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedGroups = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          sortTime: data.lastMessage?.createdAt?.toDate
            ? data.lastMessage.createdAt.toDate().getTime()
            : data.createdAt?.toDate
            ? data.createdAt.toDate().getTime()
            : 0,
        };
      });

      // --- SORTING LOGIC ---
      fetchedGroups.sort((a, b) => b.sortTime - a.sortTime);

      setGroups(fetchedGroups);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Filter
  const filteredGroups = groups.filter((g) =>
    g.groupName?.toLowerCase().includes(searchQuery.toLowerCase())
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

      <CustomHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupItem item={item} navigation={navigation} />
        )}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {searchQuery ? "No groups found." : "No groups yet."}
            </Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior="padding"
        style={styles.fabContainer}
        pointerEvents="box-none"
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate("CreateGroup")}
        >
          <MaterialCommunityIcons name="plus" size={30} color="#fff" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  headerShadowContainer: {
    backgroundColor: "#fff",
    elevation: 5,
    zIndex: 100,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },
  headerGradient: {
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight + 15 : 55,
    paddingBottom: 25,
    paddingHorizontal: 25,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#fff" },

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

  // Items
  card: {
    flexDirection: "row",
    padding: 15,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  imageContainer: { marginRight: 15 },
  groupAvatar: { width: 55, height: 55, borderRadius: 27.5 },
  placeholderAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: "#f38e8eff",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  groupName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  timeText: { fontSize: 12, color: "#888" },
  lastMsg: { fontSize: 14, color: "#888" },

  emptyText: { color: "#999", marginTop: 50, fontSize: 16 },

  fabContainer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "flex-end",
    padding: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#56AB2F",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    marginBottom: 10,
  },
});
