import React, { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

const CallListener = () => {
  const navigation = useNavigation();
  const processedCalls = useRef(new Set()); 

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // --- 1. Query for Private Chats ---
    const chatQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );

    // --- 2. Query for Groups ---
    const groupQuery = query(
      collection(db, "groups"),
      where("participants", "array-contains", user.uid)
    );

    // --- HELPER FUNCTION TO HANDLE INCOMING DATA ---
    const handleSnapshot = (snapshot, isGroup) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const roomId = change.doc.id; // Chat ID or Group ID

        // DETECT STARTING CALL
        if (
          change.type === "modified" &&
          data.callActive === true &&
          data.callerId !== user.uid && // Don't ring myself
          data.callRoomId
        ) {
          // Check if we already processed this specific call ID
          if (processedCalls.current.has(data.callRoomId)) return;

          // Mark as processed
          processedCalls.current.add(data.callRoomId);

          // Navigate to Incoming Call Screen
          navigation.navigate("IncomingCallScreen", {
            callId: data.callRoomId, // The WebRTC Room ID
            roomId: roomId, // The Chat/Group ID
            callerName:
              data.callerName || (isGroup ? data.groupName : "Unknown"),
            callerAvatar:
              data.callerAvatar ||
              data.groupImage ||
              "https://via.placeholder.com/150",
            callType: data.callType,
            isGroup: isGroup, 
          });
        }

        // DETECT ENDING CALL (Cleanup)
        if (data.callActive === false && data.callRoomId) {
          if (processedCalls.current.has(data.callRoomId)) {
            processedCalls.current.delete(data.callRoomId);
          }
        }
      });
    };

    // --- 3. Subscribe to Both ---
    const unsubscribeChats = onSnapshot(chatQuery, (snapshot) => {
      handleSnapshot(snapshot, false); // isGroup = false
    });

    const unsubscribeGroups = onSnapshot(groupQuery, (snapshot) => {
      handleSnapshot(snapshot, true); // isGroup = true
    });

    // Cleanup both listeners on unmount
    return () => {
      unsubscribeChats();
      unsubscribeGroups();
    };
  }, []);

  return null;
};

export default CallListener;
