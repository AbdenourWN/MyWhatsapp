import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AppState, LogBox } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebaseConfig";
import { doc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";

import AuthStack from "./screens/AuthStack";
import HomeStack from "./navigation/HomeStack";
import { KeyboardProvider } from "react-native-keyboard-controller";

LogBox.ignoreLogs(["Setting a timer"]);

export default function App() {
  const [user, setUser] = useState(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

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

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (auth.currentUser) {
          const userRef = doc(db, "users", auth.currentUser.uid);

          if (
            appState.current.match(/inactive|background/) &&
            nextAppState === "active"
          ) {
            try {
              await updateDoc(userRef, { isOnline: true });
            } catch (e) {
              console.log(e);
            }
          } else if (nextAppState.match(/inactive|background/)) {
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
