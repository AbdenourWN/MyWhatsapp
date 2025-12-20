import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
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
  setDoc,
  onSnapshot,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { sendCallSystemMessage } from "../services/chatServices";

const { width, height } = Dimensions.get("window");

const configuration = {
  iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "58c6ec9d3449f6a7600ccf90",
        credential: "FSivOnN8osHmas/X",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "58c6ec9d3449f6a7600ccf90",
        credential: "FSivOnN8osHmas/X",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "58c6ec9d3449f6a7600ccf90",
        credential: "FSivOnN8osHmas/X",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "58c6ec9d3449f6a7600ccf90",
        credential: "FSivOnN8osHmas/X",
      },
  ],
};

export default function CallScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    roomId,
    isCaller = false,
    userName,
    otherUserAvatar,
    isVideoCall,
    chatId,
  } = route.params || {};

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(isVideoCall);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");

  // Keep state for UI rendering
  const [durationSecs, setDurationSecs] = useState(0);

  const pc = useRef(null);
  const candidateQueue = useRef([]);
  const isSignaling = useRef(false);
  const timerRef = useRef(null);
  const hasSavedHistory = useRef(false);

  // FIX: Add this Ref to track duration globally
  const durationRef = useRef(0);
  const ringingTimerRef = useRef(null);
  useEffect(() => {
    if (!roomId) {
      Alert.alert("Error", "Call ID missing");
      navigation.goBack();
      return;
    }

    pc.current = new RTCPeerConnection(configuration);

    let unsubscribeSignaling = () => {};
    let unsubscribeHangup = () => {};
    let unsubscribeRemoteCandidates = () => {};

    const startCall = async () => {
      try {
        setConnectionStatus(isCaller ? "Calling..." : "Connecting...");

        if (isCaller) {
          ringingTimerRef.current = setTimeout(() => {
            if (pc.current.connectionState !== "connected") {
              hangup(true);
            }
          }, 60000);
        }

        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: isVideoCall
            ? { width: 640, height: 480, frameRate: 30, facingMode: "user" }
            : false,
        });

        setLocalStream(stream);
        stream
          .getTracks()
          .forEach((track) => pc.current.addTrack(track, stream));

        pc.current.onconnectionstatechange = () => {
          const state = pc.current.connectionState;
          setConnectionStatus(state);

          if (state === "connected" && !timerRef.current) {
            timerRef.current = setInterval(() => {
              
              setDurationSecs((p) => p + 1);
              durationRef.current += 1;
            }, 1000);
          }
        };

        pc.current.ontrack = (event) => {
          if (event.streams && event.streams[0])
            setRemoteStream(event.streams[0]);
          else {
            const ns = new MediaStream();
            ns.addTrack(event.track);
            setRemoteStream(ns);
          }
        };

        const callDocRef = doc(db, "calls", roomId);
        const callerCandidatesCol = collection(callDocRef, "callerCandidates");
        const calleeCandidatesCol = collection(callDocRef, "calleeCandidates");

        pc.current.onicecandidate = (event) => {
          if (event.candidate) {
            const coll = isCaller ? callerCandidatesCol : calleeCandidatesCol;
            addDoc(coll, event.candidate.toJSON());
          }
        };

        if (isCaller) {
          const offer = await pc.current.createOffer();
          await pc.current.setLocalDescription(offer);

          await setDoc(
            callDocRef,
            {
              offer: { type: offer.type, sdp: offer.sdp },
              active: true,
              callerVideoEnabled: isVideoCall,
              calleeVideoEnabled: true,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );

          unsubscribeSignaling = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (data.calleeVideoEnabled !== undefined)
              setRemoteVideoEnabled(data.calleeVideoEnabled);

            // CALLER DETECTS HANGUP
            if (data.active === false) {
              await saveHistory();
              hangup(false);
              return;
            }

            if (
              data.answer &&
              !pc.current.currentRemoteDescription &&
              !isSignaling.current
            ) {
              isSignaling.current = true;
              await pc.current.setRemoteDescription(
                new RTCSessionDescription(data.answer)
              );
              processCandidateQueue();
            }
          });

          unsubscribeRemoteCandidates = onSnapshot(
            calleeCandidatesCol,
            (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === "added")
                  handleRemoteCandidate(change.doc.data());
              });
            }
          );
        } else {
          // RECEIVER
          unsubscribeSignaling = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            if (data.callerVideoEnabled !== undefined)
              setRemoteVideoEnabled(data.callerVideoEnabled);

            // RECEIVER DETECTS HANGUP
            if (data.active === false) {
              hangup(false);
              return;
            }

            if (
              data.offer &&
              !pc.current.currentRemoteDescription &&
              !isSignaling.current
            ) {
              isSignaling.current = true;
              await pc.current.setRemoteDescription(
                new RTCSessionDescription(data.offer)
              );
              processCandidateQueue();

              const answer = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answer);
              await updateDoc(callDocRef, {
                answer: { type: answer.type, sdp: answer.sdp },
                active: true,
                calleeVideoEnabled: isVideoCall,
              });
            }
          });

          unsubscribeRemoteCandidates = onSnapshot(
            callerCandidatesCol,
            (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                if (change.type === "added")
                  handleRemoteCandidate(change.doc.data());
              });
            }
          );
        }
      } catch (err) {
        Alert.alert("Error", err.message);
        hangup(false);
      }
    };

    startCall();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsubscribeSignaling();
      unsubscribeHangup();
      unsubscribeRemoteCandidates();
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream.release();
      }
      if (pc.current) pc.current.close();
    };
  }, []);

  const handleRemoteCandidate = (c) => {
    const cand = new RTCIceCandidate(c);
    if (pc.current.remoteDescription)
      pc.current.addIceCandidate(cand).catch((e) => {});
    else candidateQueue.current.push(cand);
  };

  const processCandidateQueue = () => {
    candidateQueue.current.forEach((c) =>
      pc.current.addIceCandidate(c).catch((e) => {})
    );
    candidateQueue.current = [];
  };

  const saveHistory = async () => {
    if (isCaller !== true) return;
    if (!chatId) return;
    if (hasSavedHistory.current) return;

    hasSavedHistory.current = true;

    try {
      await sendCallSystemMessage(
        chatId,
        isVideoCall ? "video" : "audio",
        durationRef.current, // <--- FIX: Use REF (Real-time value), not State
        auth.currentUser
      );
    } catch (e) {
      console.log("Error saving history:", e);
    }
  };

  const hangup = async (shouldUpdateDb = true) => {
    setConnectionStatus("Ended");
    if (timerRef.current) clearInterval(timerRef.current);
    if (navigation.canGoBack()) navigation.goBack();

    if (shouldUpdateDb) {
      try {
        const callRef = doc(db, "calls", roomId);
        await updateDoc(callRef, { active: false });

        if (chatId) {
          const chatRef = doc(db, "chats", chatId);
          await updateDoc(chatRef, { callActive: false, callRoomId: null });
        }

        await saveHistory();
      } catch (e) {
        console.log("Hangup error", e);
      }
    }
  };

  const toggleMic = () => {
    if (localStream)
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
        setIsMuted(!t.enabled);
      });
  };
  const toggleCamera = async () => {
    if (localStream)
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
        setIsCameraOn(t.enabled);
      });
    const newStatus = !isCameraOn;
    const field = isCaller ? "callerVideoEnabled" : "calleeVideoEnabled";
    try {
      await updateDoc(doc(db, "calls", roomId), { [field]: newStatus });
    } catch (e) {}
  };

  const formatTime = () => {
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        {remoteStream && isVideoCall && remoteVideoEnabled ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            objectFit="cover"
            style={styles.remoteVideo}
            zOrder={0}
          />
        ) : (
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: otherUserAvatar }}
              style={styles.largeAvatar}
            />
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.statusText}>
              {connectionStatus === "connected"
                ? formatTime()
                : remoteVideoEnabled
                ? connectionStatus
                : "Camera Off"}
            </Text>
          </View>
        )}
      </View>

      {localStream && isCameraOn && isVideoCall && (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            objectFit="cover"
            style={styles.localVideo}
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
  contentContainer: { flex: 1 },
  remoteVideo: { width: width, height: height },
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
  localVideo: { width: "100%", height: "100%" },
  avatarContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  largeAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "white",
  },
  userName: { color: "white", fontSize: 24, fontWeight: "bold" },
  statusText: { color: "#ccc", marginTop: 15, fontSize: 18 },
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
