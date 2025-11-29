import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";

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
        <Text style={styles.groupName}>{item.groupName}</Text>
        <Text style={styles.lastMsg} numberOfLines={1}>
          {item.lastMessage?.text || "No messages yet"}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function Group({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const groupsRef = collection(db, "groups");
    const q = query(
      groupsRef,
      where("participants", "array-contains", auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedGroups = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(fetchedGroups);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#56AB2F" />
      </View>
    );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Groups</Text>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupItem item={item} navigation={navigation} />
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ color: "#999", marginTop: 50 }}>No groups yet.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("CreateGroup")}
      >
        <MaterialCommunityIcons name="plus" size={30} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#333" },
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
    backgroundColor: "#A8E063",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  lastMsg: { fontSize: 14, color: "#888" },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#56AB2F",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
});
