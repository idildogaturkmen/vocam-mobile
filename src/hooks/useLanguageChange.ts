import { useEffect, useState } from 'react';
import i18n from '../i18n/i18n';

export const useLanguageChange = () => {
    const [, setTrigger] = useState(0);

    useEffect(() => {
        const handleLanguageChange = () => {
            setTrigger(prev => prev + 1);
        };

        i18n.on('languageChanged', handleLanguageChange);

        return () => {
            i18n.off('languageChanged', handleLanguageChange);
        };
    }, []);
};