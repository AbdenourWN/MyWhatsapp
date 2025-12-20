import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import Home from "../screens/Home";
import Chat from "../screens/Chat";
import CreateGroup from "../screens/createGroup";
import GroupSettings from "../screens/GroupSettings";
import CallScreen from "../screens/CallScreen";
import IncomingCallScreen from "../screens/IncomingCallScreen";
import GroupCallScreen from "../screens/GroupCallScreen";
import MediaHistory from "../screens/MediaHistory";

const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen
        name="Chat"
        component={Chat}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroup}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettings}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CallScreen"
        component={CallScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IncomingCallScreen"
        component={IncomingCallScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GroupCallScreen"
        component={GroupCallScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MediaHistory"
        component={MediaHistory}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
