import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Home from './screens/Home';
import AuthStack from './screens/AuthStack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebaseConfig';

const Stack = createStackNavigator();

export default function App() {

  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  return (
    <NavigationContainer>
      {user ? <Home /> : <AuthStack />}
    </NavigationContainer>
  );
}