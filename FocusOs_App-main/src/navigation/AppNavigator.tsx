import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import HomeScreen from "../screens/HomeScreen";
import NotificationQueueScreen from "../screens/NotificationQueueScreen";
import DailySummaryScreen from "../screens/DailySummaryScreen";
import SettingsScreen from "../screens/SettingsScreen";
import OverrideScreen from "../screens/OverrideScreen";
import OnboardingScreen from "../screens/OnboardingScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#020407',
          borderTopColor: '#00FF9415',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#00FF94',
        tabBarInactiveTintColor: '#00FF9030',
        tabBarLabelStyle: {
          fontFamily: 'monospace',
          fontSize: 8,
          letterSpacing: 2,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: any = 'radio-button-on';
          if (route.name === 'Home') iconName = 'radio-button-on';
          if (route.name === 'Summary') iconName = 'pulse';
          if (route.name === 'Settings') iconName = 'terminal';
          return <Ionicons name={iconName} size={18} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: "SHIELD" }} />
      <Tab.Screen name="Summary" component={DailySummaryScreen} options={{ tabBarLabel: "INTEL" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: "CONFIG" }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoggedIn } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
        }}
      >
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="NotificationQueue" component={NotificationQueueScreen} />
            <Stack.Screen name="Override" component={OverrideScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
