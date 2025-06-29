import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#3498db',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'camera' : 'camera-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocabulary',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'game-controller' : 'game-controller-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistics',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'mic' : 'mic-outline'} size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}