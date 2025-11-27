import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import Home from '../screens/Home';
import Chat from '../screens/HomeScreens/Chat';

const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* The Main Tabs */}
      <Stack.Screen name="Home" component={Home} />
      
      {/* The Chat Screen (Covers the tabs) */}
      <Stack.Screen 
        name="Chat" 
        component={Chat} 
        options={{ headerShown: false }} 
      />
    </Stack.Navigator>
  );
}