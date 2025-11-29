import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { auth } from "../../firebaseConfig";

const formatDuration = (millis) => {
  const minutes = Math.floor(millis / 60000);
  const seconds = ((millis % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

export default function AudioMessage({ currentMessage, soundManager }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(currentMessage.audioDuration || 0);
  const [position, setPosition] = useState(0);

  // Check if the message belongs to the current user
  const isMe = currentMessage.user._id === auth.currentUser.uid;

  // Dynamic Colors based on Bubble Type
  const theme = {
    playBtnBg: isMe ? "#fff" : "#56AB2F",
    playIcon: isMe ? "#56AB2F" : "#fff",
    trackBg: isMe ? "rgba(255, 255, 255, 0.3)" : "#e0e0e0",
    trackFill: isMe ? "#fff" : "#56AB2F",
    textColor: isMe ? "#eee" : "#555",
  };

  const handleInterruption = async () => {
    if (soundManager.current && soundManager.current.sound !== sound) {
      try {
        await soundManager.current.sound.pauseAsync();
        if (soundManager.current.setUI) soundManager.current.setUI(false);
      } catch (e) {
        console.log("Error pausing previous sound", e);
      }
    }
  };

  async function playSound() {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await handleInterruption();
        soundManager.current = { sound, setUI: setIsPlaying };
        await sound.playAsync();
        setIsPlaying(true);
      }
    } else {
      setIsLoading(true);
      try {
        await handleInterruption();
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: currentMessage.audio },
          { shouldPlay: true }
        );

        soundManager.current = { sound: newSound, setUI: setIsPlaying };
        setSound(newSound);
        setIsPlaying(true);
        if (!duration) setDuration(status.durationMillis);

        newSound.setOnPlaybackStatusUpdate(async (status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis);
            if (status.didJustFinish) {
              setIsPlaying(false);
              await newSound.stopAsync();
              await newSound.setPositionAsync(0);
              setPosition(0);
            }
          }
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
        if (soundManager.current && soundManager.current.sound === sound) {
          soundManager.current = null;
        }
      }
    };
  }, [sound]);

  return (
    <View style={styles.container}>
      {/* Play/Pause Button in a Circle */}
      <TouchableOpacity
        onPress={playSound}
        disabled={isLoading}
        style={[styles.playBtn, { backgroundColor: theme.playBtnBg }]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.playIcon} />
        ) : (
          <MaterialCommunityIcons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={theme.playIcon}
            style={{ marginLeft: isPlaying ? 0 : 2 }}
          />
        )}
      </TouchableOpacity>

      {/* Progress Bar and Timer */}
      <View style={styles.visuals}>
        <View style={[styles.bgBar, { backgroundColor: theme.trackBg }]}>
          <View
            style={[
              styles.fillBar,
              {
                width: `${(position / (duration || 1)) * 100}%`,
                backgroundColor: theme.trackFill,
              },
            ]}
          />
        </View>
        <Text style={[styles.text, { color: theme.textColor }]}>
          {formatDuration(isPlaying ? position : duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 0,
    paddingHorizontal: 5,
    width: 160, 
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  visuals: {
    flex: 1,
    justifyContent: "center",
  },
  bgBar: {
    height: 4,
    width: "100%",
    borderRadius: 2,
    marginBottom: 4,
    overflow: "hidden",
  },
  fillBar: {
    height: "100%",
    borderRadius: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
