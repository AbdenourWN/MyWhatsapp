import { db } from "../firebaseConfig";
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
} from "firebase/firestore";

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

// --- UPDATED MARK AS READ FUNCTION ---
export const markMessagesAsRead = async (roomId, currentUserId) => {
  try {
    const messagesRef = collection(db, "chats", roomId, "messages");
    
    // SIMPLIFIED QUERY: Just get all messages that are not received yet.
    // We removed the 'user._id != ...' check to avoid index crashes.
    const q = query(messagesRef, where("received", "==", false));

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const batch = writeBatch(db);
      let hasUpdates = false;

      snapshot.forEach((doc) => {
        const data = doc.data();
        // CLIENT-SIDE FILTER: Only update messages sent by the OTHER person
        if (data.user._id !== currentUserId) {
          batch.update(doc.ref, { received: true });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        await batch.commit();
        console.log("Marked messages as read");
      }
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
};