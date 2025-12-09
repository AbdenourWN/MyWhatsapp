import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  where,
  limit,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { markMessagesAsRead } from "../services/chatServices";

export function useChatLogic(roomId, type) {
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // Real-time Header Info
  const [headerInfo, setHeaderInfo] = useState(null);

  // Pagination
  const [limitCount, setLimitCount] = useState(20);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [allMessagesLoaded, setAllMessagesLoaded] = useState(false);

  // Clear Chat Logic
  const [lastCleared, setLastCleared] = useState(null);

  // Block rendering until we know the clear status ---
  const [isMetaDataLoaded, setIsMetaDataLoaded] = useState(false);

  // Typing/Recording Users
  const [typingUsers, setTypingUsers] = useState([]);
  const [recordingUsers, setRecordingUsers] = useState([]);

  const collectionName = type === "group" ? "groups" : "chats";
  const currentUserId = auth.currentUser.uid;

  // --- HELPER: Resolve UIDs to Avatars ---
  const resolveUsers = async (uids) => {
    if (!uids || uids.length === 0) return [];
    const users = await Promise.all(
      uids.map(async (uid) => {
        const userSnap = await getDoc(doc(db, "users", uid));
        return userSnap.exists()
          ? { uid, avatar: userSnap.data().photoURL }
          : { uid, avatar: null };
      })
    );
    return users;
  };

  // 1. LISTEN TO ROOM METADATA
  useEffect(() => {
    const roomRef = doc(db, collectionName, roomId);
    const unsub = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // A. Handle Group Info
        if (type === "group") {
          setHeaderInfo({
            displayName: data.groupName,
            photoURL: data.groupImage,
            participants: data.participants,
          });
        }

        // B. Handle Last Cleared Timestamp
        if (
          data.participantMetadata &&
          data.participantMetadata[currentUserId]
        ) {
          setLastCleared(data.participantMetadata[currentUserId].lastCleared);
        }

        // C. Typing & Recording Logic
        const typingMap = data.typing || {};
        const activeTypingUids = Object.keys(typingMap).filter(
          (uid) => uid !== currentUserId && typingMap[uid] === true
        );

        if (activeTypingUids.length > 0) {
          const resolved = await resolveUsers(activeTypingUids);
          setTypingUsers(resolved);
        } else {
          setTypingUsers([]);
        }

        const recordingMap = data.recording || {};
        const activeRecordingUids = Object.keys(recordingMap).filter(
          (uid) => uid !== currentUserId && recordingMap[uid] === true
        );

        if (activeRecordingUids.length > 0) {
          const resolved = await resolveUsers(activeRecordingUids);
          setRecordingUsers(resolved);
        } else {
          setRecordingUsers([]);
        }
      }
      setIsMetaDataLoaded(true);
    });

    return () => unsub();
  }, [roomId, type]);

  // 2. LISTEN TO MESSAGES
  useEffect(() => {
    // --- CRITICAL FIX: Stop if metadata isn't ready ---
    if (!isMetaDataLoaded) return;

    const messagesRef = collection(db, collectionName, roomId, "messages");

    let qConstraints = [orderBy("createdAt", "desc"), limit(limitCount)];

    if (lastCleared) {
      qConstraints.push(where("createdAt", ">", lastCleared));
    }

    const q = query(messagesRef, ...qConstraints);

    const unsub = onSnapshot(q, (snapshot) => {
      if (snapshot.docs.length < limitCount) {
        setAllMessagesLoaded(true);
      } else {
        setAllMessagesLoaded(false);
      }

      const hasUnread = snapshot.docs.some(
        (d) => d.data().user._id !== auth.currentUser.uid && !d.data().received
      );
      if (hasUnread) markMessagesAsRead(roomId, auth.currentUser.uid, type);

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
          location: data.location,
          callInfo: data.callInfo,
        };
      });

      setMessages(msgs);
      setIsLoadingMessages(false);
      setIsLoadingEarlier(false);
    });

    return () => unsub();
  }, [roomId, limitCount, lastCleared, isMetaDataLoaded]); 

  const loadEarlier = () => {
    if (isLoadingEarlier || allMessagesLoaded) return;
    if (messages.length < limitCount) {
      setAllMessagesLoaded(true);
      return;
    }
    setIsLoadingEarlier(true);
    setLimitCount((prev) => prev + 20);
  };

  return {
    messages,
    isLoadingMessages,
    typingUsers,
    recordingUsers,
    headerInfo,
    loadEarlier,
    isLoadingEarlier,
  };
}
