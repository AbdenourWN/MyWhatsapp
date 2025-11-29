import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  where,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { markMessagesAsRead } from "../services/chatServices";

export function useChatLogic(roomId, type) {
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [limitCount, setLimitCount] = useState(40);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [lastCleared, setLastCleared] = useState(null);

  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isOtherUserRecording, setIsOtherUserRecording] = useState(false);

  const collectionName = type === "group" ? "groups" : "chats";
  const currentUserId = auth.currentUser.uid;

  // 1. LISTEN TO ROOM METADATA (Typing, Recording, LastCleared)
  useEffect(() => {
    const roomRef = doc(db, collectionName, roomId);
    const unsub = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // 1. Handle Last Cleared
        if (
          data.participantMetadata &&
          data.participantMetadata[currentUserId]
        ) {
          setLastCleared(data.participantMetadata[currentUserId].lastCleared);
        }

        // 2. Handle Typing Logic
        // Check if ANYONE else is typing (useful for groups too)
        const typingMap = data.typing || {};
        const isSomeoneElseTyping = Object.keys(typingMap).some(
          (uid) => uid !== currentUserId && typingMap[uid] === true
        );
        setIsOtherUserTyping(isSomeoneElseTyping);

        // 3. Handle Recording Logic
        const recordingMap = data.recording || {};
        const isSomeoneElseRecording = Object.keys(recordingMap).some(
          (uid) => uid !== currentUserId && recordingMap[uid] === true
        );
        setIsOtherUserRecording(isSomeoneElseRecording);
      }
    });
    return () => unsub();
  }, [roomId]);

  // 2. LISTEN TO MESSAGES (Existing logic...)
  useEffect(() => {
    const messagesRef = collection(db, collectionName, roomId, "messages");
    let qConstraints = [orderBy("createdAt", "desc"), limit(limitCount)];
    if (lastCleared) qConstraints.push(where("createdAt", ">", lastCleared));

    const q = query(messagesRef, ...qConstraints);
    const unsub = onSnapshot(q, (snapshot) => {
      // (Keep existing markAsRead logic...)
      const hasUnread = snapshot.docs.some(
        (d) => d.data().user._id !== currentUserId && !d.data().received
      );
      if (hasUnread) markMessagesAsRead(roomId, currentUserId, type);

      const msgs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          _id: doc.id,
          text: data.text,
          createdAt: data.createdAt?.toDate(),
          user: data.user,
          sent: data.sent,
          received: data.received,
          image: data.image,
          audio: data.audio,
          audioDuration: data.audioDuration,
        };
      });
      setMessages(msgs);
      setIsLoadingMessages(false);
      setIsLoadingEarlier(false);
    });
    return () => unsub();
  }, [roomId, lastCleared, limitCount]);

  const loadEarlier = () => {
    if (isLoadingEarlier) return;
    setIsLoadingEarlier(true);
    setLimitCount((prev) => prev + 20);
  };

  const canLoadMore = messages.length > 0 && messages.length >= limitCount;

  return {
    messages,
    isLoadingMessages,
    loadEarlier,
    isLoadingEarlier,
    canLoadMore,
    isOtherUserTyping, 
    isOtherUserRecording, 
  };
}
