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
  onSnapshot,
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
    // 1. Add the actual message to the subcollection
    await addDoc(messagesRef, {
      ...message,
      createdAt: serverTimestamp(),
      sent: true,
      received: false,
    });

    // 2. Determine the Preview Text for the Chat List
    let lastMessageText = "";

    if (message.text && message.text.trim().length > 0) {
      lastMessageText = message.text;
    } else if (message.image) {
      lastMessageText = "📷 Image";
    } else if (message.audio) {
      lastMessageText = "🎤 Audio";
    } else if (message.location) {
      lastMessageText = "📍 Location";
    } else {
      lastMessageText = "New Message";
    }

    // 3. Update the Room's Last Message
    await updateDoc(roomRef, {
      lastMessage: {
        text: lastMessageText,
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

/* Calls */
export const initiateCallSignal = async (
  roomId,
  callType,
  currentUser,
  type = "private"
) => {
  const collectionName = type === "group" ? "groups" : "chats";
  const roomRef = doc(db, collectionName, roomId);
  const callId = `${roomId}_${Date.now()}`;

  await setDoc(
    roomRef,
    {
      callActive: true,
      callRoomId: callId,
      callType: callType, // 'video' or 'audio'
      callerName: currentUser?.displayName || "User",
      callerId: currentUser?.uid,
      callStartTime: serverTimestamp(),
    },
    { merge: true }
  );

  return callId;
};

export const listenForIncomingCalls = (
  roomId,
  currentUserId,
  onIncomingCall,
  type = "private"
) => {
  const collectionName = type === "group" ? "groups" : "chats";
  const roomRef = doc(db, collectionName, roomId);

  // Return the listener (unsubscribe function)
  return onSnapshot(roomRef, (docSnapshot) => {
    const data = docSnapshot.data();

    // Check if a call is active and I am NOT the caller
    if (
      data?.callActive &&
      data?.callRoomId &&
      data?.callerId !== currentUserId
    ) {
      onIncomingCall({
        callRoomId: data.callRoomId,
        callType: data.callType,
        callerName: data.callerName,
      });
    }
  });
};

/**
 * Ends the call signal in Firestore.
 */
export const endCallSignal = async (roomId, type = "private") => {
  const collectionName = type === "group" ? "groups" : "chats";
  const roomRef = doc(db, collectionName, roomId);

  await updateDoc(roomRef, {
    callActive: false,
    callRoomId: null,
  });
};

export const sendCallSystemMessage = async (
  roomId,
  callType,
  durationSecs,
  currentUser,
  isGroup = false
) => {
  try {
    // 1. Determine Collection: "chats" or "groups"
    const collectionName = isGroup ? "groups" : "chats";

    const messagesRef = collection(db, collectionName, roomId, "messages");
    const roomRef = doc(db, collectionName, roomId);

    // Format duration (e.g., "05:23")
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    const formattedDuration = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

    const text = `${
      callType === "video" ? "Video" : "Voice"
    } Call • ${formattedDuration}`;

    // 2. Add Message
    await addDoc(messagesRef, {
      _id: Math.random().toString(36).substring(7),
      text: text,
      createdAt: serverTimestamp(),
      system: true,
      callInfo: {
        type: callType,
        duration: durationSecs,
      },
      user: {
        _id: currentUser.uid,
        name: currentUser.displayName,
        avatar: currentUser.photoURL,
      },
      sent: true,
      received: false,
    });

    // 3. Update Last Message
    await updateDoc(roomRef, {
      lastMessage: {
        text: `📞 ${text}`,
        createdAt: serverTimestamp(),
        user: { _id: currentUser.uid },
        read: false,
      },
      // If it's the end of a group call, clear the banner here too
      callActive: false,
      callRoomId: null,
    });
  } catch (error) {
    console.error("Error saving call history:", error);
  }
};

export const initiateGroupCall = async (groupId, callType, currentUser) => {
  const callId = `${groupId}_${Date.now()}`;
  const groupRef = doc(db, "groups", groupId);
  const callRef = doc(db, "calls", callId);

  // 1. Create the Call Document
  await setDoc(callRef, {
    activeParticipants: [currentUser.uid], // Start with me
    callType: callType,
    callActive: true,
    roomId: groupId,
    createdAt: serverTimestamp(),
  });

  // 2. Update Group Chat to show banner
  await updateDoc(groupRef, {
    callActive: true,
    callRoomId: callId,
    callType: callType,
    callerName: currentUser.displayName, // Who started it
    callerId: currentUser.uid,
  });

  return callId;
};

// --- JOIN GROUP CALL ---
export const joinGroupCall = async (callId, currentUser) => {
  // Add myself to the participants list
  const callRef = doc(db, "calls", callId);
  await updateDoc(callRef, {
    activeParticipants: arrayUnion(currentUser.uid),
  });
};
