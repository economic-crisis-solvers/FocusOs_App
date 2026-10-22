import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { FocusProvider } from './src/context/FocusContext';
import AppNavigator from './src/navigation/AppNavigator';
import * as Linking from 'expo-linking';
import { supabase } from './src/lib/supabase';

// Suppress known Expo Go limitations (not real errors)
LogBox.ignoreLogs([
  'expo-notifications',
  'React Native\'s New Architecture',
  '`expo-notifications` functionality is not fully supported',
]);

export default function App() {
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (url.includes('access_token') || url.includes('code=')) {
const hashParams = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
const accessToken = hashParams.get('access_token');
const refreshToken = hashParams.get('refresh_token');
if (accessToken && refreshToken) {
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <FocusProvider>
        <AppNavigator />
      </FocusProvider>
    </AuthProvider>
  );
}