import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3498db',
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}>📷</Text>
          ),
        }}
      />
    </Tabs>
  );
}