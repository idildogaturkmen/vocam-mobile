import { Tabs } from 'expo-router';
import Entypo from '@expo/vector-icons/Entypo';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import { normalizeFont, scale } from '@/utils/normalize';

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
          paddingTop: scale(8),
        },
        tabBarLabelStyle: {
          fontSize: normalizeFont(15),
          fontWeight: '500',
        },
      }}>
      
      {/* 1. Camera Tab - DEFAULT/FIRST */}
      <Tabs.Screen
        name="detection"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color }: { color: string }) => (
            <Entypo name="camera" size={scale(30)*1.2} color={color} />
          ),
        }}
      />
      
      {/* 2. Vocabulary Tab */}
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocabulary',
          tabBarIcon: ({ color }: { color: string }) => (
            <MaterialCommunityIcons name="bookshelf" size={scale(30)*1.2} color={color} />
          ),
        }}
      />
      
      {/* 3. Practice Tab */}
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color }: { color: string }) => (
            <FontAwesome6 name="brain" size={scale(30)*1.2} color={color} />
          ),
        }}
      />
      
      {/* 4. Profile Tab (formerly Settings) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }: { color: string }) => (
            <Ionicons name="person-circle" size={scale(30)*1.2} color={color} />
          ),
        }}
      />
      
      {/* Hide the index tab */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}