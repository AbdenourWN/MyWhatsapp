import React, { useEffect, useState, useCallback } from 'react';
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
  RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../../firebaseConfig';
import { subscribeToUsers } from '../../services/userServices';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Format time helper
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

const List = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState("Hello");

  // Function to setup listener
  const setupRealtimeListener = () => {
    if (!auth.currentUser) return;
    
    // Subscribe
    const unsubscribe = subscribeToUsers(auth.currentUser.uid, (data) => {
      setUsers(data);
      setLoading(false);
      setRefreshing(false); // Stop refreshing spinner when data arrives
    });

    return unsubscribe;
  };

  useEffect(() => {
    const unsubscribe = setupRealtimeListener();

    // Time greeting logic
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // --- REFRESH LOGIC ---
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Because onSnapshot is live, we don't really need to "fetch".
    // But to simulate the effect, we just wait a moment or re-trigger logic.
    setTimeout(() => {
        setRefreshing(false);
    }, 1500); 
  }, []);

  const renderItem = ({ item }) => {
    // --- SAFE CHECKS FOR MISSING DATA ---
    const isOnline = item.isOnline === true; 
    
    // Handle display text
    let statusText = "Offline";
    if (isOnline) {
      statusText = "Online";
    } else if (item.lastSeen) {
      statusText = formatLastSeen(item.lastSeen);
    }

    const statusColor = isOnline ? '#56AB2F' : '#888';

    return (
      <TouchableOpacity style={styles.userCard}>
        <View style={styles.avatarContainer}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <MaterialCommunityIcons name="account" size={28} color="#fff" />
            </View>
          )}
          {/* Green Dot */}
          {isOnline && <View style={styles.onlineDot} />} 
        </View>

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.displayName}>
              {item.displayName || "Unknown User"}
            </Text>
            <Text style={[styles.timestamp, { color: statusColor, fontWeight: isOnline ? 'bold' : 'normal' }]}>
              {statusText}
            </Text>
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const CustomHeader = () => {
    const userPhoto = auth.currentUser?.photoURL;
    const userName = auth.currentUser?.displayName?.split(' ')[0] || "Friend";

    return (
      <View style={styles.headerShadowContainer}>
        <LinearGradient
          colors={['#A8E063', '#56AB2F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.topBar}>
            <View>
              <Text style={styles.greetingText}>{greeting},</Text>
              <Text style={styles.headerTitle}>{userName}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('MyProfile')}>
               {userPhoto ? (
                  <Image source={{ uri: userPhoto }} style={styles.myAvatar} />
               ) : (
                  <View style={styles.myAvatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={20} color="#56AB2F" />
                  </View>
               )}
            </TouchableOpacity>
          </View>
          <View style={styles.searchBarContainer}>
             <MaterialCommunityIcons name="magnify" size={20} color="#fff" style={{ opacity: 0.8 }} />
             <Text style={styles.searchText}>Search contacts...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

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
      <CustomHeader />
      <FlatList
        data={users}
        contentContainerStyle={{ paddingTop: 10 }}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        // --- ADDED REFRESH CONTROL BACK ---
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#56AB2F']} // Android spinner color
            tintColor="#56AB2F"  // iOS spinner color
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No contacts found.</Text>
          </View>
        }
      />
    </View>
  );
};

export default List;

const styles = StyleSheet.create({
  // ... (Keep your previous styles exactly the same) ...
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerShadowContainer: {
    backgroundColor: '#fff',
    shadowColor: '#56AB2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight + 15 : 55,
    paddingBottom: 25,
    paddingHorizontal: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingText: {
    color: '#E8F5E9',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  myAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  myAvatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 15,
  },
  searchText: {
    color: '#fff',
    marginLeft: 10,
    opacity: 0.9,
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 5,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
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
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#56AB2F', 
    borderWidth: 2,
    borderColor: '#fff',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    alignItems: 'center',
  },
  displayName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
  },
  email: {
    fontSize: 13,
    color: '#888',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 50,
  }
});