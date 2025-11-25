import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { auth } from '../../firebaseConfig';
import { getAllUsers } from '../../services/userServices';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const List = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    if (!auth.currentUser) return;
    try {
      // Call the API function
      const data = await getAllUsers(auth.currentUser.uid);
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // Render a single user item (WhatsApp style)
  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.userCard} 
      // onPress={() => navigation.navigate('Chat', { user: item })} // For future Chat implementation
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <MaterialCommunityIcons name="account" size={30} color="#fff" />
          </View>
        )}
      </View>

      {/* Text Info */}
      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.displayName}>
            {item.displayName || "Unknown User"}
          </Text>
          {/* Timestamp placeholder */}
          <Text style={styles.timestamp}>Just now</Text>
        </View>
        <Text style={styles.email} numberOfLines={1}>
          {item.email}
        </Text>
      </View>
    </TouchableOpacity>
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
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#56AB2F']} />
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  placeholderAvatar: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  email: {
    fontSize: 14,
    color: 'gray',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 50,
  }
});