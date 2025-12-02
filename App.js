import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { AppState, LogBox } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebaseConfig";
import { doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";

import Home from "./screens/Home";
import AuthStack from "./screens/AuthStack";
import HomeStack from "./navigation/HomeStack";
import { KeyboardProvider } from "react-native-keyboard-controller";

LogBox.ignoreLogs(["Setting a timer"]);

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // 1. Handle Auth State & Initial Online Status
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Set user Online immediately when app loads ---
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        try {
          await setDoc(
            userRef,
            {
              isOnline: true,
              email: currentUser.email,
            },
            { merge: true }
          );
        } catch (error) {
          console.error("Error setting initial online status:", error);
        }
      }
    });

    // 2. Handle App State (Foreground/Background)
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (auth.currentUser) {
          const userRef = doc(db, "users", auth.currentUser.uid);

          if (
            appState.current.match(/inactive|background/) &&
            nextAppState === "active"
          ) {
            // App came to foreground -> Set Online
            try {
              await updateDoc(userRef, { isOnline: true });
            } catch (e) {
              console.log(e);
            }
          } else if (nextAppState.match(/inactive|background/)) {
            // App went to background -> Set Offline & Last Seen
            try {
              await updateDoc(userRef, {
                isOnline: false,
                lastSeen: serverTimestamp(),
              });
            } catch (e) {
              console.log(e);
            }
          }
        }
        appState.current = nextAppState;
      }
    );

    return () => {
      unsubscribeAuth();
      subscription.remove();
    };
  }, []);

  return (
    <KeyboardProvider>
      <NavigationContainer>
        {user ? <HomeStack /> : <AuthStack />}
      </NavigationContainer>
    </KeyboardProvider>
  );
}
