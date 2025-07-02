import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3498db',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e9ecef',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}>
      
      {/* 1. Camera Tab - DEFAULT/FIRST */}
      <Tabs.Screen
        name="detection"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}>📷</Text>
          ),
        }}
      />
      
      {/* 2. Vocabulary Tab */}
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocabulary',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}>📚</Text>
          ),
        }}
      />
      
      {/* 3. Progress Tab */}
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}>📊</Text>
          ),
        }}
      />
      
      {/* 4. Quiz Tab */}
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}>🎮</Text>
          ),
        }}
      />
      
      {/* 5. Pronunciation Practice Tab */}
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}>🗣️</Text>
          ),
        }}
      />
      
      {/* Hide the index tab */}
      <Tabs.Screen
        name="index"
        options={{
          href: null, // This hides the tab
        }}
      />
    </Tabs>
  );
}