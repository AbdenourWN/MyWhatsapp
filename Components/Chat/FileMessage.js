import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// 1. Import SAF and Constants from the MAIN package
import {
  StorageAccessFramework,
  cacheDirectory,
  documentDirectory,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
  downloadAsync, 
} from "expo-file-system/legacy";


export default function FileMessage({ currentMessage, isMe }) {
  const { file } = currentMessage;
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // --- ANDROID LOGIC (Save to "Downloads" or user choice) ---
      if (Platform.OS === "android") {
        // 1. Request Permission to access a folder
        const permissions =
          await StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (!permissions.granted) {
          setDownloading(false);
          return;
        }

        // 2. Download file to hidden cache first
        const tempUri = cacheDirectory + (file.name || "temp_download");
        await downloadAsync(file.url, tempUri);

        // 3. Read the file as a string (base64)
        const fileString = await readAsStringAsync(tempUri, {
          encoding: EncodingType.Base64,
        });

        // 4. Create the file in the user's chosen folder
        // infer mimetype from ext or default to octet-stream
        const mimeType = "application/octet-stream";
        const createdUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          file.name || "downloaded_file",
          mimeType
        );

        // 5. Write the data to the new file
        await writeAsStringAsync(createdUri, fileString, {
          encoding: EncodingType.Base64,
        });

        Alert.alert("Success", "File saved to your selected folder!");
      }

      // --- IOS LOGIC (Save to App Documents) ---
      else {
        const fileUri = documentDirectory + (file.name || "download.pdf");
        await downloadAsync(file.url, fileUri);
        Alert.alert("Saved", "File saved to App Documents.");
      }
    } catch (error) {
      console.error("Download Error:", error);
      Alert.alert("Error", "Could not save file.");
    } finally {
      setDownloading(false);
    }
  };

  // Helper to format bytes
  const formatSize = (bytes) => {
    if (!bytes) return "";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const iconColor = isMe ? "#fff" : "#56AB2F";
  const textColor = isMe ? "#fff" : "#000";
  const subTextColor = isMe ? "rgba(255,255,255,0.7)" : "#666";

  return (
    <TouchableOpacity onPress={handleDownload} activeOpacity={0.8}>
      <View style={styles.container}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : "#e8f5e9" },
          ]}
        >
          {downloading ? (
            <ActivityIndicator color={iconColor} size="small" />
          ) : (
            <MaterialCommunityIcons
              name="file-download-outline"
              size={28}
              color={iconColor}
            />
          )}
        </View>

        <View style={styles.textContainer}>
          <Text
            style={[styles.fileName, { color: textColor }]}
            numberOfLines={1}
          >
            {file.name}
          </Text>
          <Text style={[styles.fileSize, { color: subTextColor }]}>
            {formatSize(file.size)} • {file.ext?.toUpperCase() || "FILE"}
          </Text>
        </View>

        {!downloading && (
          <MaterialCommunityIcons
            name="download"
            size={20}
            color={subTextColor}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
    width: 200,
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 5,
  },
  fileName: {
    fontSize: 15,
    fontWeight: "600",
  },
  fileSize: {
    fontSize: 11,
    marginTop: 2,
  },
});
