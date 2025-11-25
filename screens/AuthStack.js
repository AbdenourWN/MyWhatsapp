import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Auth from './AuthScreens/Auth';
import SignUp from './AuthScreens/SignUp';

const Stack = createStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={Auth} />
      <Stack.Screen name="SignUp" component={SignUp} />
    </Stack.Navigator>
  );
}