import { Stack } from 'expo-router';

export default function RootLayout() {
    return (
        <Stack>
            <Stack.Screen name="App" options={{ headerShown: false }} />
        </Stack>
    );
}
