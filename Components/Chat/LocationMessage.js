import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Linking,
  Platform,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from "react-native-maps";

export default function LocationMessage({ location, isMe }) {
  const handlePress = () => {
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${location.latitude},${location.longitude}`;
    const label = "Shared Location";
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    Linking.openURL(url);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.container}
      activeOpacity={0.8}
    >
      <View style={styles.mapContainer}>
        <MapView
          provider={
            Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
          }
          style={styles.map}
          region={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          cacheEnabled={true}
        >
          <Marker coordinate={location} />
        </MapView>

        <View style={styles.overlay} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.text}>📍 Shared Location</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: 160,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 5,
    backgroundColor: "#f0f0f0",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  footer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
});
