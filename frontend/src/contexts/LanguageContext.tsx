// src/contexts/LanguageContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n';

interface LanguageContextType {
  currentLang: string;          // ✅ بدلاً من language
  changeLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLang, setCurrentLang] = useState(i18n.language || 'ar');

  useEffect(() => {
    const handleChange = (lng: string) => setCurrentLang(lng);
    i18n.on('languageChanged', handleChange);
    return () => i18n.off('languageChanged', handleChange);
  }, []);

  useEffect(() => {
    const direction = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = direction;
  }, [currentLang]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
    localStorage.setItem('preferred_language', lang);
  };

  return (
    <LanguageContext.Provider value={{ currentLang, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
