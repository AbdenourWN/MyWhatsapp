import { StyleSheet, View } from "react-native";
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import List from "./HomeScreens/List";
import Group from "./HomeScreens/Group";
import MyProfile from "./HomeScreens/MyProfile";

// 1. Import the Listener
import CallListener from "../Components/CallListener";

const Tab = createBottomTabNavigator();

export default function Home() {
  return (
    <View style={{ flex: 1 }}>
      <CallListener />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === "List") {
              iconName = focused
                ? "format-list-bulleted"
                : "format-list-bulleted-type";
            } else if (route.name === "Group") {
              iconName = focused ? "account-group" : "account-group-outline";
            } else if (route.name === "MyProfile") {
              iconName = focused ? "account-circle" : "account-circle-outline";
            }

            return (
              <MaterialCommunityIcons
                name={iconName}
                size={size}
                color={color}
              />
            );
          },
          tabBarActiveTintColor: "#56AB2F",
          tabBarInactiveTintColor: "gray",
          headerStyle: {
            backgroundColor: "#56AB2F",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#f0f0f0",
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
          },
          tabBarStyle: {
            marginBottom: 5,
            shadowColor: "white",
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="List" component={List} options={{ title: "List" }} />
        <Tab.Screen
          name="Group"
          component={Group}
          options={{ title: "Groups" }}
        />
        <Tab.Screen
          name="MyProfile"
          component={MyProfile}
          options={{ title: "My Profile" }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({});
