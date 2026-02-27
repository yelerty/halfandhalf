import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 이미 인증됨
        setUser(user);
        setLoading(false);
      } else {
        // 인증되지 않음 → 익명 인증 시도
        try {
          const result = await signInAnonymously(auth);
          const anonymousUser = result.user;

          // 익명 사용자 문서 초기화
          await setDoc(doc(db, 'users', anonymousUser.uid), {
            email: `anonymous-${anonymousUser.uid.substring(0, 8)}@app.local`,
            isAnonymous: true,
            createdAt: new Date().toISOString(),
            blacklist: [],
          }, { merge: true });

          setUser(anonymousUser);
          console.log('익명 사용자로 자동 로그인됨:', anonymousUser.uid);
        } catch (error: any) {
          console.error('익명 인증 실패:', error);
          // 실패해도 사용자에게 로그인 화면 표시
          setUser(null);
        }
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'create-post' || segments[0] === 'edit-post' || segments[0] === 'chat';

    if (!user && !segments[0]) {
      // 초기 로드 시 로그인 화면으로
      router.replace('/login');
    } else if (!user && inAuthGroup) {
      // 로그인 안되어있으면 로그인 화면으로
      router.replace('/login');
    } else if (user && segments[0] === 'login') {
      // 로그인 되어있으면 메인으로
      router.replace('/(tabs)');
    }
  }, [user, segments, loading]);

  // 로딩 중이거나 로그인 안된 상태에서는 최소한의 스택만 렌더링
  if (loading) {
    return null;
  }

  // 로그인 안된 상태에서는 login 화면만 렌더링 (권한 에러 완전 방지)
  if (!user) {
    return (
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    );
  }

  // 로그인된 상태에서만 전체 스택 렌더링
  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ title: '공동구매 등록', presentation: 'modal' }} />
      <Stack.Screen name="post-detail/[id]" options={{ title: '게시글 상세' }} />
      <Stack.Screen name="edit-post/[id]" options={{ title: '게시글 수정' }} />
      <Stack.Screen name="chat/[id]" options={{ title: '채팅' }} />
    </Stack>
  );
}
