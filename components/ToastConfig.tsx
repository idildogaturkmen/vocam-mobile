import { BaseToast, ErrorToast } from 'react-native-toast-message';

export const toastConfig = {
    success: (props: any) => (
        <BaseToast
            {...props}
            style={{ borderLeftColor: 'green' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{
                fontSize: 16,
                fontWeight: 'bold',
            }}
            text2Style={{
                fontSize: 14,
                color: 'gray',
            }}
        />
    ),

    error: (props: any) => (
        <ErrorToast
            {...props}
            text1Style={{
                fontSize: 18,
            }}
            text2Style={{
                fontSize: 16,
            }}
        />
    ),
};
