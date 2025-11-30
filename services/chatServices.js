import { uploadToCloudinary } from "../cloudinaryConfig";
import { auth, db } from "../firebaseConfig";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  query,
  where,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

// --- PRIVATE CHAT ID GENERATOR ---
export const getChatRoomId = async (currentUserId, otherUserId) => {
  const sortedIds = [currentUserId, otherUserId].sort();
  const roomId = sortedIds.join("_");
  const chatRef = doc(db, "chats", roomId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      participants: [currentUserId, otherUserId],
      createdAt: serverTimestamp(),
      lastMessage: null,
    });
  }
  return roomId;
};

// --- SEND MESSAGE (Private & Group) ---
export const sendMessage = async (roomId, message, type = "private") => {
  const collectionName = type === "group" ? "groups" : "chats";
  const messagesRef = collection(db, collectionName, roomId, "messages");
  const roomRef = doc(db, collectionName, roomId);

  try {
    await addDoc(messagesRef, {
      ...message,
      createdAt: serverTimestamp(),
      sent: true,
      received: false,
    });

    await updateDoc(roomRef, {
      lastMessage: {
        text: message.text || (message.image ? "📷 Image" : "🎤 Audio"),
        createdAt: serverTimestamp(),
        user: message.user,
        read: false,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

// --- MARK AS READ (Private & Group) ---
export const markMessagesAsRead = async (
  roomId,
  currentUserId,
  type = "private"
) => {
  const collectionName = type === "group" ? "groups" : "chats";
  try {
    const messagesRef = collection(db, collectionName, roomId, "messages");

    // Get all messages not received yet
    const q = query(messagesRef, where("received", "==", false));

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const batch = writeBatch(db);
      let hasUpdates = false;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.user._id !== currentUserId) {
          batch.update(doc.ref, { received: true });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
};

// --- CLEAR CHAT (Private & Group) ---
export const clearChatHistory = async (roomId, userId, type = "private") => {
  const collectionName = type === "group" ? "groups" : "chats";
  const roomRef = doc(db, collectionName, roomId);

  await setDoc(
    roomRef,
    {
      participantMetadata: {
        [userId]: {
          lastCleared: serverTimestamp(),
        },
      },
    },
    { merge: true }
  );
};

// --- BLOCK USER ---
export const blockUser = async (currentUserId, targetUserId) => {
  const userRef = doc(db, "users", currentUserId);
  await updateDoc(userRef, {
    blockedUsers: arrayUnion(targetUserId),
  });
};

export const unblockUser = async (currentUserId, targetUserId) => {
  const userRef = doc(db, "users", currentUserId);
  await updateDoc(userRef, {
    blockedUsers: arrayRemove(targetUserId),
  });
};

export const setTypingStatus = async (
  roomId,
  userId,
  isTyping,
  type = "private"
) => {
  const collectionName = type === "group" ? "groups" : "chats";
  const roomRef = doc(db, collectionName, roomId);

  await setDoc(
    roomRef,
    {
      typing: {
        [userId]: isTyping,
      },
    },
    { merge: true }
  );
};

export const setRecordingStatus = async (
  roomId,
  userId,
  isRecording,
  type = "private"
) => {
  const collectionName = type === "group" ? "groups" : "chats";
  const roomRef = doc(db, collectionName, roomId);

  await setDoc(
    roomRef,
    {
      recording: {
        [userId]: isRecording,
      },
    },
    { merge: true }
  );
};

export const createGroup = async (groupName, participantIds, imageUri) => {
  try {
    let groupImageUrl = null;

    // 1. Upload Image if exists
    if (imageUri) {
      groupImageUrl = await uploadToCloudinary(imageUri, "image");
    }

    // 2. Create Group Document in "groups" collection
    const groupRef = await addDoc(collection(db, "groups"), {
      groupName: groupName,
      groupImage: groupImageUrl,
      participants: participantIds,
      adminId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      lastMessage: {
        text: "Group created",
        createdAt: serverTimestamp(),
        system: true,
      },
    });

    return groupRef.id;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};

export const updateGroupInfo = async (groupId, groupName, groupImage) => {
  const groupRef = doc(db, "groups", groupId);
  const data = { groupName };
  if (groupImage) {
    // Ideally upload to Cloudinary first if it's a new local URI
    // For this snippet, assuming image handling is done in UI or passed as URL
    data.groupImage = groupImage;
  }
  await updateDoc(groupRef, data);
};

export const leaveGroup = async (groupId, userId) => {
  const groupRef = doc(db, "groups", groupId);
  await updateDoc(groupRef, {
    participants: arrayRemove(userId),
  });
};

export const addGroupParticipants = async (groupId, newUserIds) => {
  const groupRef = doc(db, "groups", groupId);
  await updateDoc(groupRef, {
    participants: arrayUnion(...newUserIds),
  });
};

export const kickGroupParticipant = async (groupId, userId) => {
  const groupRef = doc(db, "groups", groupId);
  await updateDoc(groupRef, {
    participants: arrayRemove(userId),
  });
};

// 2. Transfer Admin Rights
export const updateGroupAdmin = async (groupId, newAdminId) => {
  const groupRef = doc(db, "groups", groupId);
  await updateDoc(groupRef, {
    adminId: newAdminId,
  });
};
