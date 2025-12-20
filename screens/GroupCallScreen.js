import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Alert,
  Image,
} from "react-native";
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from "react-native-webrtc";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { db, auth } from "../firebaseConfig";
import {
  doc,
  updateDoc,
  collection,
  onSnapshot,
  addDoc,
  arrayRemove,
  getDoc,
  serverTimestamp,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { sendCallSystemMessage } from "../services/chatServices";

const { width } = Dimensions.get("window");

const configuration = {
  iceServers: [
    {
      urls: "turn:global.turn.metered.ca:443?transport=tcp",
      username: "58c6ec9d3449f6a7600ccf90",
      credential: "FSivOnN8oshmas/X",
    },
    {
      urls: "turn:global.turn.metered.ca:80?transport=tcp",
      username: "58c6ec9d3449f6a7600ccf90",
      credential: "FSivOnN8oshmas/X",
    },
  ],
};

export default function GroupCallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { roomId, chatId, isVideoCall } = route.params;
  const currentUser = auth.currentUser;

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(isVideoCall);

  // NEW: Track camera status of everyone { uid: true/false }
  const [cameraStates, setCameraStates] = useState({});

  const pcPeers = useRef(new Map());
  const candidatesQueue = useRef(new Map());
  const localStreamRef = useRef(null);

  // NEW: Prevents auto-closing before anyone joins
  const hasSomeoneJoined = useRef(false);

  useEffect(() => {
    let unsubscribeSignals = () => {};
    let unsubscribeParticipants = () => {};

    const startGroupCall = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: isVideoCall
            ? { width: 480, height: 640, frameRate: 30 }
            : false,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        // NEW: Register my initial camera state in Firestore
        const callRef = doc(db, "calls", roomId);
        await setDoc(
          callRef,
          {
            cameraStatus: { [currentUser.uid]: isVideoCall },
          },
          { merge: true }
        );
      } catch (e) {
        console.error("Media Error:", e);
        return;
      }

      // 1. Listen for Signals
      const signalsRef = collection(db, "calls", roomId, "signals");
      unsubscribeSignals = onSnapshot(signalsRef, async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (data.targetId === currentUser.uid) {
              await handleSignal(data);
            }
          }
        });
      });

      // 2. Listen for Participants & Camera Status
      unsubscribeParticipants = onSnapshot(
        doc(db, "calls", roomId),
        async (snapshot) => {
          const data = snapshot.data();
          if (!data || data.active === false) {
            hangup(false);
            return;
          }

          const currentParticipants = data.activeParticipants || [];

          // A. UPDATE CAMERA STATES
          if (data.cameraStatus) {
            setCameraStates(data.cameraStatus);
          }

          // B. CLEANUP LEAVERS
          // Check if anyone in my 'pcPeers' is NOT in 'currentParticipants'
          pcPeers.current.forEach((pc, userId) => {
            if (!currentParticipants.includes(userId)) {
              removePeer(userId); // <--- This removes the frozen frame
            }
          });

          // C. AUTO-END LOGIC
          // If > 1 person is here, mark that the call has "started" properly
          if (currentParticipants.length > 1) {
            hasSomeoneJoined.current = true;
          }

          // If everyone left and I am alone (and someone HAD joined previously)
          if (hasSomeoneJoined.current && currentParticipants.length === 1) {
            Alert.alert("Call Ended", "Everyone left the call.");
            hangup(true);
          }
        }
      );

      // 3. JOIN LOGIC
      const roomDoc = await getDoc(doc(db, "calls", roomId));
      if (roomDoc.exists()) {
        const participants = roomDoc.data().activeParticipants || [];
        participants.forEach((userId) => {
          if (userId !== currentUser.uid) {
            createPeerConnection(userId, true);
          }
        });
      }
    };

    startGroupCall();

    return () => {
      unsubscribeSignals();
      unsubscribeParticipants();
      hangup(false);
    };
  }, []);

  // --- WEBRTC CORE ---

  const createPeerConnection = async (targetUserId, isInitiator) => {
    if (pcPeers.current.has(targetUserId))
      return pcPeers.current.get(targetUserId);

    const pc = new RTCPeerConnection(configuration);
    pcPeers.current.set(targetUserId, pc);

    if (!candidatesQueue.current.has(targetUserId)) {
      candidatesQueue.current.set(targetUserId, []);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(targetUserId, "candidate", event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStreams((prev) => {
          
          const filtered = prev.filter((p) => p.id !== targetUserId);
          return [...filtered, { id: targetUserId, stream: event.streams[0] }];
        });
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(targetUserId, "offer", { type: offer.type, sdp: offer.sdp });
    }

    return pc;
  };

  const handleSignal = async (data) => {
    const { senderId, type, signalData } = data;
    let pc = pcPeers.current.get(senderId);
    if (!pc && type === "offer") {
      pc = await createPeerConnection(senderId, false);
    }

    if (pc) {
      if (type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(senderId, "answer", { type: answer.type, sdp: answer.sdp });
        processCandidateQueue(senderId, pc);
      } else if (type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData));
        processCandidateQueue(senderId, pc);
      } else if (type === "candidate") {
        const candidate = new RTCIceCandidate(signalData);
        if (pc.remoteDescription) await pc.addIceCandidate(candidate);
        else candidatesQueue.current.get(senderId).push(candidate);
      }
    }
  };

  const processCandidateQueue = (userId, pc) => {
    const queue = candidatesQueue.current.get(userId) || [];
    queue.forEach((cand) => pc.addIceCandidate(cand).catch((e) => {}));
    candidatesQueue.current.set(userId, []);
  };

  const sendSignal = async (targetUserId, type, data) => {
    await addDoc(collection(db, "calls", roomId, "signals"), {
      senderId: currentUser.uid,
      targetId: targetUserId,
      type: type,
      signalData: data,
      createdAt: serverTimestamp(),
    });
  };

  // --- REMOVE PEER (Clears Video Frame) ---
  const removePeer = (userId) => {
    const pc = pcPeers.current.get(userId);
    if (pc) {
      pc.close();
      pcPeers.current.delete(userId);
    }
    // Strictly remove from state
    setRemoteStreams((prev) => prev.filter((p) => p.id !== userId));
  };

// --- HANGUP WITH TRANSACTION (PREVENTS DUPLICATES) ---
  const hangup = async (shouldUpdateDb = true) => {
    // 1. Cleanup WebRTC (Local actions)
    pcPeers.current.forEach((pc) => pc.close());
    pcPeers.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current.release();
    }

    if (navigation.canGoBack()) navigation.goBack();

    if (shouldUpdateDb) {
      try {
        const callRef = doc(db, "calls", roomId);
        let shouldSaveHistory = false;
        let finalDuration = 0;

        // 2. RUN TRANSACTION
        await runTransaction(db, async (transaction) => {
          const callDoc = await transaction.get(callRef);
          if (!callDoc.exists()) return;

          const data = callDoc.data();
          const participants = data.activeParticipants || [];

          // Filter myself out locally to see who would remain
          const remainingParticipants = participants.filter(
            (uid) => uid !== currentUser.uid
          );

          if (remainingParticipants.length === 0) {
            // I AM THE LAST ONE. CLOSE THE ROOM.
            shouldSaveHistory = true;

            // Calculate Duration
            if (data.createdAt) {
              const startTime = data.createdAt.toDate();
              const endTime = new Date();
              finalDuration = Math.floor((endTime - startTime) / 1000);
            }

            // Update Doc: Remove me AND set active=false
            transaction.update(callRef, {
              activeParticipants: remainingParticipants,
              active: false,
            });
          } else {
            // OTHERS REMAIN. JUST LEAVE.
            transaction.update(callRef, {
              activeParticipants: remainingParticipants,
            });
          }
        });

        // 3. IF I WAS THE LAST ONE, SAVE HISTORY OUTSIDE TRANSACTION
        if (shouldSaveHistory) {
          await sendCallSystemMessage(
            chatId,
            isVideoCall ? "video" : "audio",
            finalDuration,
            currentUser,
            true // isGroup = true
          );
        }
      } catch (e) {
        console.log("Hangup Transaction Error:", e);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
        setIsMuted(!t.enabled);
      });
    }
  };

  // --- NEW: UPDATE FIRESTORE ON CAMERA TOGGLE ---
  const toggleCamera = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
        setIsCameraOn(t.enabled);
      });

      // Update DB
      const newStatus = !isCameraOn;
      try {
        await setDoc(
          doc(db, "calls", roomId),
          {
            cameraStatus: { [currentUser.uid]: newStatus },
          },
          { merge: true }
        );
      } catch (e) {}
    }
  };

  // --- RENDER GRID ITEM ---
  const renderItem = ({ item }) => {
    // Check if this user has their camera ON in Firestore
    // item.id is the userId
    const isRemoteCamOn = cameraStates[item.id] !== false; // Default to true if undefined
    
    return (
      <View style={styles.gridItem}>
        {isRemoteCamOn ? (
          <RTCView
            streamURL={item.stream.toURL()}
            style={styles.gridVideo}
            objectFit="cover"
            zOrder={0}
          />
        ) : (
          // AVATAR PLACEHOLDER
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: "https://via.placeholder.com/150" }}
              style={styles.gridAvatar}
            />
            <Text style={styles.camOffText}>Camera Off</Text>
          </View>
        )}

        <View style={styles.nameTag}>
          <Text style={styles.nameText}>User</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gridContainer}>
        <FlatList
          data={remoteStreams}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        />
        {remoteStreams.length === 0 && (
          <View style={styles.waiting}>
            <Text style={{ color: "white", fontSize: 16 }}>
              Waiting for others...
            </Text>
          </View>
        )}
      </View>

      {/* LOCAL VIDEO */}
      {localStream && isCameraOn && (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={{ flex: 1 }}
            objectFit="cover"
            zOrder={1}
            mirror
          />
        </View>
      )}

      <View style={styles.buttonsWrapper}>
        <TouchableOpacity
          onPress={toggleMic}
          style={[styles.btn, isMuted ? styles.btnActive : styles.btnInactive]}
        >
          <MaterialCommunityIcons
            name={isMuted ? "microphone-off" : "microphone"}
            size={28}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => hangup(true)} style={styles.endBtn}>
          <MaterialCommunityIcons name="phone-hangup" size={32} color="white" />
        </TouchableOpacity>

        {isVideoCall && (
          <TouchableOpacity
            onPress={toggleCamera}
            style={[
              styles.btn,
              !isCameraOn ? styles.btnActive : styles.btnInactive,
            ]}
          >
            <MaterialCommunityIcons
              name={isCameraOn ? "video" : "video-off"}
              size={28}
              color="white"
            />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#202124" },
  gridContainer: { flex: 1, padding: 5 },
  gridItem: {
    flex: 1,
    margin: 5,
    height: 250,
    backgroundColor: "#333",
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  gridVideo: { width: "100%", height: "100%" },

  // Avatar Styles
  avatarContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#444",
    width: "100%",
  },
  gridAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 10 },
  camOffText: { color: "#ccc", fontSize: 12 },

  waiting: { position: "absolute", top: "45%", alignSelf: "center" },
  nameTag: {
    position: "absolute",
    bottom: 5,
    left: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 3,
    borderRadius: 4,
  },
  nameText: { color: "white", fontSize: 12 },
  localVideoContainer: {
    position: "absolute",
    right: 20,
    bottom: 120,
    width: 100,
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "white",
  },
  buttonsWrapper: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  btn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  btnInactive: { backgroundColor: "rgba(255,255,255,0.2)" },
  btnActive: { backgroundColor: "white" },
  endBtn: {
    width: 65,
    height: 65,
    borderRadius: 35,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
});
