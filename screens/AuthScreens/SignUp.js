import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { saveUserToFirestore } from "../../services/userServices";

export default function SignUp({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignUp = () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Incomplete Form", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "The passwords do not match.");
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {

        const user = userCredential.user;
        console.log("User account created:", user.uid);
        await saveUserToFirestore(user, "New User");
        Alert.alert(
          "Account Created!",
          "You have been signed up successfully."
        );
      })
      .catch((error) => {
        // Handle specific errors
        let errorMessage = "An error occurred during sign up.";
        if (error.code === "auth/email-already-in-use") {
          errorMessage = "This email address is already in use.";
        } else if (error.code === "auth/invalid-email") {
          errorMessage = "That email address is invalid!";
        } else if (error.code === "auth/weak-password") {
          errorMessage =
            "The password is too weak. It must be at least 6 characters long.";
        }
        Alert.alert("Sign Up Error", errorMessage);
        console.error(error);
      });
  };

  return (
    <LinearGradient colors={["#A8E063", "#56AB2F"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingContainer}
      >
        <View style={styles.signUpContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us and start your journey</Text>

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#999"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleSignUp}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>

          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Auth")}>
              <Text style={[styles.loginText, styles.loginLink]}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      <StatusBar style="light" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  keyboardAvoidingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  signUpContainer: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 30,
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  button: {
    width: "100%",
    backgroundColor: "#4a934a",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  loginLinkContainer: {
    flexDirection: "row",
    marginTop: 20,
  },
  loginText: {
    color: "#555",
    fontSize: 14,
  },
  loginLink: {
    color: "#4a934a",
    fontWeight: "bold",
  },
});
