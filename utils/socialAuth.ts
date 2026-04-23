import { AuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../config/firebase';

WebBrowser.maybeCompleteAuthSession();

// ============================================================
// 소셜 로그인 설정
// .env 파일에 아래 환경변수를 추가하세요:
//
// EXPO_PUBLIC_KAKAO_REST_API_KEY=your_kakao_rest_api_key
// EXPO_PUBLIC_NAVER_CLIENT_ID=your_naver_client_id
// EXPO_PUBLIC_INSTAGRAM_APP_ID=your_instagram_app_id
// EXPO_PUBLIC_CLOUD_FUNCTIONS_URL=https://your-region-your-project.cloudfunctions.net
// ============================================================

const CLOUD_FUNCTIONS_URL = process.env.EXPO_PUBLIC_CLOUD_FUNCTIONS_URL || '';

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '';
const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '';
const INSTAGRAM_APP_ID = process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID || '';

const redirectUri = makeRedirectUri({ preferLocalhost: false });

/**
 * 카카오 로그인
 */
export async function signInWithKakao(): Promise<void> {
  const request = new AuthRequest({
    clientId: KAKAO_REST_API_KEY,
    redirectUri,
    responseType: ResponseType.Code,
    scopes: [],
  });

  const result = await request.promptAsync({
    authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  });

  if (result.type !== 'success' || !result.params.code) {
    throw new Error('카카오 로그인이 취소되었습니다.');
  }

  const response = await fetch(`${CLOUD_FUNCTIONS_URL}/kakaoAuth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: result.params.code,
      redirectUri,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '카카오 인증에 실패했습니다.');
  }

  await signInWithCustomToken(auth, data.token);
}

/**
 * 네이버 로그인
 */
export async function signInWithNaver(): Promise<void> {
  const state = Math.random().toString(36).substring(7);

  const request = new AuthRequest({
    clientId: NAVER_CLIENT_ID,
    redirectUri,
    responseType: ResponseType.Code,
    scopes: [],
    extraParams: { state },
  });

  const result = await request.promptAsync({
    authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  });

  if (result.type !== 'success' || !result.params.code) {
    throw new Error('네이버 로그인이 취소되었습니다.');
  }

  const response = await fetch(`${CLOUD_FUNCTIONS_URL}/naverAuth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: result.params.code,
      state: result.params.state || state,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '네이버 인증에 실패했습니다.');
  }

  await signInWithCustomToken(auth, data.token);
}

/**
 * 인스타그램 로그인
 */
export async function signInWithInstagram(): Promise<void> {
  const request = new AuthRequest({
    clientId: INSTAGRAM_APP_ID,
    redirectUri,
    responseType: ResponseType.Code,
    scopes: ['user_profile'],
  });

  const result = await request.promptAsync({
    authorizationEndpoint: 'https://api.instagram.com/oauth/authorize',
  });

  if (result.type !== 'success' || !result.params.code) {
    throw new Error('인스타그램 로그인이 취소되었습니다.');
  }

  const response = await fetch(`${CLOUD_FUNCTIONS_URL}/instagramAuth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: result.params.code,
      redirectUri,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '인스타그램 인증에 실패했습니다.');
  }

  await signInWithCustomToken(auth, data.token);
}
