import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './ru.json';
import kk from './kk.json';

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
  },
  lng: localStorage.getItem('language') || 'ru',
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
