import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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
          height: 100,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}>
      
      {/* 1. Camera Tab - DEFAULT/FIRST */}
      <Tabs.Screen
        name="detection"
        name="detection"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}><Entypo name="camera" size={24} color="black" /></Text>
          ),
        }}
      />
      
      {/* 2. Vocabulary Tab */}
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocabulary',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}><MaterialCommunityIcons name="bookshelf" size={24} color="black" /></Text>
          ),
        }}
      />
      
      {/* 3. Progress Tab */}
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}><Entypo name="bar-graph" size={24} color="black" /></Text>
          ),
        }}
      />
      
      {/* 4. Quiz Tab */}
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}><Entypo name="game-controller" size={24} color="black" /></Text>
          ),
        }}
      />
      
      {/* 5. Pronunciation Practice Tab */}
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ color, fontSize: 20 }}><FontAwesome name="microphone" size={24} color="black" /></Text>
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