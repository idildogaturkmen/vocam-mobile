import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

const FireStreak = ({ streak }: { streak: number }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Streak</Text>
            <LottieView
                source={require('@/assets/fire.json')}
                autoPlay
                loop
                style={styles.lottie}
            />

            <View style={styles.circle}>
                <Text style={styles.streakText}>{streak}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        position: 'relative',
        flex: 1,
    },
    lottie: {
        position: 'absolute',
        right: 0,
        width: 50,
        height: 50,
    },
    circle: {
        position: 'absolute',
        right: 10,
        top: 20,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    streakText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#ff5c00',
    },
    text: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#ff5c00',
        right: 5,
    },
});

export default FireStreak;
