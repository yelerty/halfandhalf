import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import ko from './locales/ko';
import en from './locales/en';

// i18n 인스턴스 생성
const i18n = new I18n({
  ko,
  en,
});

// 시스템 언어 설정
i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'en';

// fallback 언어 설정
i18n.enableFallback = true;
i18n.defaultLocale = 'ko';

export default i18n;
