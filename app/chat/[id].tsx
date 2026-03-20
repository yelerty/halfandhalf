import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Dimensions, SafeAreaView, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import { db, auth } from '../../config/firebase';
import { FirestoreTimestamp, getErrorMessage } from '../../utils/types';
import { formatMessageTime, getDateGroupLabel, isSameDay, toDate } from '../../utils/dateUtils';
import i18n from '../../i18n';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: FirestoreTimestamp;
  isTemp?: boolean;
}

export default function ChatScreen() {
  console.log('🔵 ChatScreen component mounted');
  const params = useLocalSearchParams();
  const sessionIdFromParams = Array.isArray(params.id) ? params.id[0] : params.id;
  const { width: screenWidth } = useWindowDimensions();
  console.log('🔵 sessionIdFromParams:', sessionIdFromParams);

  // params에서 게시글 정보 추출 (새 채팅인 경우)
  const postIdFromParams = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const postStoreFromParams = Array.isArray(params.postStore) ? params.postStore[0] : params.postStore;
  const postItemFromParams = Array.isArray(params.postItem) ? params.postItem[0] : params.postItem;
  const postUserIdFromParams = Array.isArray(params.postUserId) ? params.postUserId[0] : params.postUserId;
  const postUserEmailFromParams = Array.isArray(params.postUserEmail) ? params.postUserEmail[0] : params.postUserEmail;
  const postStartTimeFromParams = Array.isArray(params.postStartTime) ? params.postStartTime[0] : params.postStartTime;
  const postEndTimeFromParams = Array.isArray(params.postEndTime) ? params.postEndTime[0] : params.postEndTime;

  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [postInfo, setPostInfo] = useState<any>(null);
  const [sessionExists, setSessionExists] = useState(false);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const hasMarkedAsReadRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageUnsubscribeRef = useRef<(() => void) | null>(null);

  // 채팅 세션 정보 가져오기 또는 params에서 설정
  useEffect(() => {
    console.log('🟡 useEffect 1 (loadChatSession) triggered');
    let isMounted = true;

    const loadChatSession = async () => {
      console.log('🟡 loadChatSession called');
      if (!sessionIdFromParams || !auth.currentUser) {
        console.log('Chat session load skipped: missing sessionId or auth', {
          sessionIdFromParams,
          hasUser: !!auth.currentUser,
        });
        return;
      }

      try {
        console.log('Loading chat session:', { sessionIdFromParams, currentUserId: auth.currentUser.uid });
        // 먼저 기존 세션이 있는지 확인
        const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
        const sessionDoc = await getDoc(sessionDocRef);

        if (!isMounted) return;

        if (sessionDoc.exists()) {
          console.log('Chat session exists, setting sessionExists=true');
          // 기존 세션이 있으면 사용
          const sessionData = sessionDoc.data();

          setSessionExists(true);
          const postId = sessionData.postId;

          // 게시글 정보 가져오기
          const postDoc = await getDoc(doc(db, 'posts', postId));

          if (!isMounted) return;

          if (postDoc.exists()) {
            const postData = { id: postDoc.id, ...postDoc.data() };
            console.log('Post data loaded:', {
              postId: postData.id,
              userId: postData.userId,
              store: postData.store,
            });
            setPostInfo(postData);

            // 자신의 채팅 세션 참조 확인 및 생성
            if (auth.currentUser) {
              const mySessionRef = doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionIdFromParams);
              const mySessionDoc = await getDoc(mySessionRef);

              if (!mySessionDoc.exists()) {
                // 참조가 없으면 생성 (상대방이 진입하는 경우)
                await setDoc(mySessionRef, {
                  postId: postId,
                  sessionId: sessionIdFromParams,
                  active: true,
                  unreadCount: 0,
                  joinedAt: serverTimestamp(),
                });
              } else {
                // 참조가 있으면 읽음 처리
                await setDoc(mySessionRef, {
                  unreadCount: 0,
                  lastReadAt: serverTimestamp(),
                }, { merge: true });
              }
            }
          } else {
            // 게시글이 삭제됨
            if (auth.currentUser) {
              await deleteDoc(sessionDocRef);
              await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionIdFromParams));
            }
            Alert.alert(
              i18n.t('common.error'),
              i18n.t('chat.postDeleted'),
              [{ text: i18n.t('common.confirm'), onPress: () => router.back() }]
            );
          }
        } else if (postIdFromParams) {
          console.log('🔴 Chat session does not exist yet, setting sessionExists=false');
          console.log('🔴 postIdFromParams:', postIdFromParams);
          // 세션이 없지만 params에서 게시글 정보가 있으면 (새 채팅)
          setSessionExists(false);
          setPostInfo({
            id: postIdFromParams,
            store: postStoreFromParams,
            item: postItemFromParams,
            userId: postUserIdFromParams,
            userEmail: postUserEmailFromParams,
            startTime: postStartTimeFromParams,
            endTime: postEndTimeFromParams,
          });
        } else {
          // 세션도 없고 params도 없으면 에러
          // 사용자의 chatSessions 참조 삭제
          if (auth.currentUser) {
            try {
              await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionIdFromParams));
            } catch (error) {
              // 삭제 실패 무시
            }
          }
          Alert.alert(
            i18n.t('common.error'),
            i18n.t('chat.sessionNotFound'),
            [{ text: i18n.t('common.confirm'), onPress: () => router.back() }]
          );
        }
      } catch (error: any) {
        // permission-denied는 세션이 아직 없는 정상 케이스
        if (error.code === 'permission-denied' && postIdFromParams) {
          console.log('🔴 Session not found (permission-denied), setting sessionExists=false');
          setSessionExists(false);
          setPostInfo({
            id: postIdFromParams,
            store: postStoreFromParams,
            item: postItemFromParams,
            userId: postUserIdFromParams,
            userEmail: postUserEmailFromParams,
            startTime: postStartTimeFromParams,
            endTime: postEndTimeFromParams,
          });
        } else if (isMounted) {
          Alert.alert(i18n.t('common.error'), i18n.t('chat.sendError'));
        }
      }
      console.log('🔴 loadChatSession completed, sessionExists:', sessionExists);
    };

    console.log('🟡 Calling loadChatSession');
    loadChatSession();

    return () => {
      console.log('🟡 useEffect 1 cleanup');
      isMounted = false;
    };
  }, [sessionIdFromParams]);

  // 화면이 포커스될 때마다 세션 존재 여부 재확인
  useFocusEffect(
    useCallback(() => {
      console.log('🟢 useFocusEffect: Checking session existence');
      let isMounted = true;

      const checkSession = async () => {
        if (!sessionIdFromParams || !auth.currentUser || !isMounted) return;

        try {
          const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
          const sessionDoc = await getDoc(sessionDocRef);

          if (!isMounted) return;

          if (sessionDoc.exists()) {
            console.log('🟢 Session exists, setting sessionExists=true');
            setSessionExists(true);
          } else {
            console.log('🟢 Session does not exist, setting sessionExists=false');
            setSessionExists(false);
          }
        } catch (error) {
          console.log('🟢 Error checking session:', error);
        }
      };

      checkSession();

      return () => {
        isMounted = false;
      };
    }, [sessionIdFromParams])
  );

  // 상대방이 나간 것을 감지하고 입력 중 상태를 감시하는 useEffect
  useEffect(() => {
    console.log('🟠 useEffect 2 (partner left detection) triggered');
    if (!sessionIdFromParams || !auth.currentUser || !sessionExists) {
      console.log('🟠 Partner detection skipped:', { sessionIdFromParams, hasUser: !!auth.currentUser, sessionExists });
      return;
    }

    const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);

    const unsubscribe = onSnapshot(
      sessionDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // 세션이 삭제됨 (상대방도 나감)
          if (!partnerLeft) {
            setPartnerLeft(true);
          }
          return;
        }

        const sessionData = snapshot.data();
        const activeParticipants = sessionData?.activeParticipants || [];
        const isMySessionActive = activeParticipants.includes(auth.currentUser?.uid);

        // 내가 여전히 세션에 있는데 상대방이 없는 경우
        if (isMySessionActive && activeParticipants.length < 2) {
          if (!partnerLeft) {
            setPartnerLeft(true);
          }
        }

        // 상대방의 입력 중 상태 감시
        const typingByUserId = sessionData?.typingBy;
        const partnerIsTyping =
          typingByUserId &&
          typingByUserId !== auth.currentUser?.uid &&
          activeParticipants.includes(typingByUserId);

        setPartnerTyping(!!partnerIsTyping);
      },
      (error) => {
        // Session subscription error handled silently
      }
    );

    return () => unsubscribe();
  }, [sessionIdFromParams, sessionExists, partnerLeft]);

  // 상대방이 나갔을 때 처리
  useEffect(() => {
    if (!partnerLeft) return;

    console.log('Partner left detected - immediate back');

    // 메시지 구독 즉시 정리
    if (messageUnsubscribeRef.current) {
      console.log('Unsubscribing from messages');
      messageUnsubscribeRef.current();
      messageUnsubscribeRef.current = null;
    }

    // 화면 즉시 나가기 (다른 모든 것을 건너뜀)
    Alert.alert(
      i18n.t('common.confirm'),
      i18n.t('chat.partnerLeft') || '상대방이 채팅방을 나갔습니다.',
      [
        {
          text: i18n.t('common.confirm'),
          onPress: () => {
            // 알림 후 즉시 나가기
            router.back();
          },
        },
      ]
    );

    // 백그라운드에서 자신의 세션 참조만 삭제 (권한 에러 무시)
    if (auth.currentUser && sessionIdFromParams) {
      setTimeout(async () => {
        try {
          await deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', sessionIdFromParams));
          console.log('User session reference cleaned up');
        } catch (error: any) {
          // 에러 무시 - 중요하지 않음
          console.log('Could not delete user session reference (ignored)');
        }
      }, 500);
    }
  }, [partnerLeft]);

  // 메시지 실시간 구독 (세션이 존재할 때만)
  useEffect(() => {
    console.log('🟢 useEffect 3 (message subscription) triggered');
    console.log('🟢 Conditions check:', {
      sessionIdFromParams: !!sessionIdFromParams,
      hasUser: !!auth.currentUser,
      sessionExists,
    });

    // 기존 구독 정리
    if (messageUnsubscribeRef.current) {
      console.log('Cleaning up previous message subscription');
      messageUnsubscribeRef.current();
      messageUnsubscribeRef.current = null;
    }

    if (!sessionIdFromParams || !auth.currentUser || !sessionExists) {
      console.log('Message subscription skipped:', {
        sessionIdFromParams,
        hasUser: !!auth.currentUser,
        sessionExists,
      });
      setMessages([]);
      return;
    }

    console.log('Setting up message subscription for:', sessionIdFromParams);
    const currentUserId = auth.currentUser.uid;
    const messagesCollectionRef = collection(db, 'chatSessions', sessionIdFromParams, 'messages');
    const q = query(messagesCollectionRef, orderBy('createdAt', 'asc'));


    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('Message subscription fired, got', snapshot.docs.length, 'messages');
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];

        console.log('Setting messages. Count:', messagesData.length);
        setMessages(messagesData);

        // 첫 구독 시에만 읽음 처리 (중복 방지)
        if (!hasMarkedAsReadRef.current) {
          try {
            const mySessionRef = doc(db, 'users', currentUserId, 'chatSessions', sessionIdFromParams);
            // 상대방 세션 참조도 업데이트해서 읽음 표시 반영
            await setDoc(mySessionRef, {
              unreadCount: 0,
              lastReadAt: serverTimestamp(),
            }, { merge: true });

            // 상대방 세션 참조 업데이트 (상대방이 언제든 읽었는지 추적)
            const otherUserId = postInfo?.userId || '';
            if (otherUserId && otherUserId !== currentUserId) {
              const otherSessionRef = doc(db, 'users', otherUserId, 'chatSessions', sessionIdFromParams);
              await setDoc(otherSessionRef, {
                lastReadAt: serverTimestamp(),
              }, { merge: true });
            }

            hasMarkedAsReadRef.current = true;
          } catch (error) {
            // Read state update error handled silently
          }
        }

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (error) => {
        console.error('Message subscription error:', {
          code: error.code,
          message: error.message,
        });
        if (error.code === 'permission-denied') {
          // 세션이 삭제되었거나 권한이 없음
          Alert.alert(
            i18n.t('common.confirm'),
            i18n.t('chat.sessionDeleted') || '채팅 세션이 삭제되었습니다.',
            [{ text: i18n.t('common.confirm'), onPress: () => router.back() }]
          );
        }
      }
    );

    // unsubscribe를 ref에 저장 (partnerLeft에서 직접 호출 가능하게)
    messageUnsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      messageUnsubscribeRef.current = null;
    };
  }, [sessionIdFromParams, sessionExists]);

  const handleSend = async () => {
    // 메시지 유효성 체크 (공백은 허용하되, 완전히 비어있으면 거부)
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !sessionIdFromParams || !postInfo || !auth.currentUser) return;

    // 원본 메시지 사용 (공백 포함)
    const messageText = message;

    if (!messageText || messageText.length === 0) {
      Alert.alert(i18n.t('common.error'), '메시지가 비어있습니다.');
      return;
    }

    console.log('Sending message. sessionExists:', sessionExists, 'sessionId:', sessionIdFromParams);
    const currentUserId = auth.currentUser.uid;
    console.log('Sender info:', {
      currentUserId: currentUserId.substring(0, 8),
      postOwnerId: postInfo.userId?.substring(0, 8),
    });
    const participants = [currentUserId, postInfo.userId].sort();
    console.log('Message participants:', participants);

    // 낙관적 업데이트: 로컬 상태에 임시 메시지 추가
    const tempMessageId = 'temp-' + Date.now();
    const tempMessage: Message = {
      id: tempMessageId,
      text: messageText,
      senderId: currentUserId,
      createdAt: new Date(),
      isTemp: true,
    };
    setMessages(prev => [...prev, tempMessage]);
    setMessage(''); // 입력창 즉시 초기화

    try {
      // 세션 존재 여부를 실시간으로 재확인
      // (양쪽 모두 나가서 삭제된 경우를 대비)
      let actualSessionExists = sessionExists;
      try {
        const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
        const sessionDoc = await getDoc(sessionDocRef);
        actualSessionExists = sessionDoc.exists();

        // 상태 동기화
        if (actualSessionExists !== sessionExists) {
          setSessionExists(actualSessionExists);
        }
      } catch (checkError) {
        console.log('Error checking session existence:', checkError);
      }

      // 세션이 없으면 먼저 생성
      if (!actualSessionExists) {
        console.log('Creating new chat session:', {
          sessionIdFromParams,
          postId: postInfo.id,
          participants,
          currentUserId: currentUserId.substring(0, 8),
          postOwnerId: postInfo.userId.substring(0, 8),
        });

        // 1. 채팅 세션 생성 (이전 메시지는 자동으로 숨겨짐)
        await setDoc(doc(db, 'chatSessions', sessionIdFromParams), {
          postId: postInfo.id,
          postStore: postInfo.store,
          postItem: postInfo.item,
          participants,
          activeParticipants: participants, // 양쪽 모두 활성 상태로 시작
          createdAt: serverTimestamp(),
          sessionVersion: serverTimestamp(), // 세션 버전 추가 - 새 메시지는 이 버전 이후에만 표시
          lastMessageAt: serverTimestamp(),
          lastMessage: messageText,
        });
        console.log('Chat session created successfully');

        // 2. 내 채팅 세션 참조 생성
        await setDoc(doc(db, 'users', currentUserId, 'chatSessions', sessionIdFromParams), {
          postId: postInfo.id,
          postStore: postInfo.store,
          postItem: postInfo.item,
          sessionId: sessionIdFromParams,
          active: true,
          unreadCount: 0,
          joinedAt: serverTimestamp(),
        });

        // 3. 상대방 채팅 세션 참조도 생성 (merge로 안전하게)
        // 첫 메시지이므로 상대방의 unreadCount는 1
        console.log('Creating other user session reference for:', postInfo.userId);
        try {
          await setDoc(doc(db, 'users', postInfo.userId, 'chatSessions', sessionIdFromParams), {
            postId: postInfo.id,
            postStore: postInfo.store,
            postItem: postInfo.item,
            sessionId: sessionIdFromParams,
            active: true,
            unreadCount: 1,
            lastMessageAt: serverTimestamp(),
            lastMessage: messageText,
            joinedAt: serverTimestamp(),
          }, { merge: true });
          console.log('Other user session reference created successfully');
        } catch (refError) {
          console.error('Error creating other user session reference:', refError);
          // Continue anyway - message will still be created
        }

        setSessionExists(true);
      } else {
        // 세션이 있으면 - lastMessage만 업데이트 (sessionVersion은 유지)
        const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);

        await setDoc(sessionDocRef, {
          lastMessageAt: serverTimestamp(),
          lastMessage: messageText,
        }, { merge: true });

        // 상대방 세션 참조도 업데이트
        const otherUserId = postInfo.userId === currentUserId ? postInfo.userId : postInfo.userId;
        if (otherUserId && otherUserId !== currentUserId) {
          try {
            const otherSessionRef = doc(db, 'users', otherUserId, 'chatSessions', sessionIdFromParams);
            const otherSessionDoc = await getDoc(otherSessionRef);
            const currentUnreadCount = otherSessionDoc.exists() ? (otherSessionDoc.data()?.unreadCount || 0) : 0;

            await setDoc(otherSessionRef, {
              lastMessageAt: serverTimestamp(),
              lastMessage: messageText,
              unreadCount: currentUnreadCount + 1,
            }, { merge: true });
          } catch (error) {
            // Other user session update error handled silently
          }
        }
      }

      // 메시지 저장
      console.log('Adding message to collection:', sessionIdFromParams);
      const messagesCollectionRef = collection(db, 'chatSessions', sessionIdFromParams, 'messages');
      const docRef = await addDoc(messagesCollectionRef, {
        text: messageText,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        participants,
      });
      console.log('Message saved successfully:', docRef.id);

      // 상대방의 unreadCount 증가
      const otherUserId = postInfo.userId === currentUserId ? postInfo.userId : postInfo.userId;
      if (otherUserId && otherUserId !== currentUserId) {
        try {
          const otherSessionRef = doc(db, 'users', otherUserId, 'chatSessions', sessionIdFromParams);
          const otherSessionDoc = await getDoc(otherSessionRef);
          const currentUnreadCount = otherSessionDoc.exists() ? (otherSessionDoc.data()?.unreadCount || 0) : 0;

          await setDoc(otherSessionRef, {
            unreadCount: currentUnreadCount + 1,
          }, { merge: true });
        } catch (error) {
          // Other user unreadCount update error handled silently
        }
      }

      // 메시지 전송 후 입력 중 상태 해제
      try {
        const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
        await setDoc(sessionDocRef, {
          typingBy: null,
        }, { merge: true });

        // 타이머도 정리
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      } catch (error) {
        // Typing state clear error handled silently
      }

      // 구독을 통해 실제 메시지를 받으면 임시 메시지는 자동으로 대체됨
    } catch (error: any) {

      // 에러 발생 시 임시 메시지 제거
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));

      let errorMessage = i18n.t('chat.sendError');
      if (error.code === 'permission-denied') {
        errorMessage = i18n.t('errors.firebaseConfig');
      } else if (error.code === 'unavailable') {
        errorMessage = i18n.t('errors.network');
      }

      Alert.alert(i18n.t('common.error'), errorMessage);
    }
  };

  const handleMessageChange = async (text: string) => {
    setMessage(text);

    if (!sessionIdFromParams || !auth.currentUser || !sessionExists) return;

    // 입력 중 상태 업데이트 (디바운싱)
    try {
      const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
      await setDoc(sessionDocRef, {
        typingBy: text.trim() ? auth.currentUser.uid : null,
      }, { merge: true });

      // 이전 타이머 제거
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // 2초 후 입력 중 상태 해제
      typingTimeoutRef.current = setTimeout(async () => {
        try {
          await setDoc(sessionDocRef, {
            typingBy: null,
          }, { merge: true });
        } catch (error) {
          // Typing state clear error handled silently
        }
      }, 2000);
    } catch (error) {
      // Typing state update error handled silently
    }
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('', '메시지가 복사되었습니다.');
    } catch (error) {
      Alert.alert('', '메시지 복사에 실패했습니다.');
    }
  };

  const handleLeaveChat = () => {
    if (!sessionIdFromParams || !postInfo || !auth.currentUser) {
      router.back();
      return;
    }

    // 세션이 없으면 그냥 뒤로가기
    if (!sessionExists) {
      router.back();
      return;
    }

    Alert.alert(
      i18n.t('chat.leaveChat'),
      i18n.t('chat.leaveChatConfirm'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('chat.leaveChat'),
          style: 'destructive',
          onPress: async () => {
            if (!auth.currentUser) return;

            try {
              const currentUserId = auth.currentUser.uid;
              const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);

              console.log('Leaving chat session:', {
                sessionId: sessionIdFromParams,
                currentUserId: currentUserId.substring(0, 8),
              });

              // 타이머 정리
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }

              // 한쪽이 나가면 무조건 세션 삭제 (새로운 메시지 시작을 위해)
              console.log('User leaving - deleting session and references');

              try {
                // 1. 세션과 자신의 참조 삭제 (필수 - batch)
                const batch = writeBatch(db);
                batch.delete(sessionDocRef);
                batch.delete(doc(db, 'users', currentUserId, 'chatSessions', sessionIdFromParams));

                await batch.commit();
                console.log('Session and user reference deleted successfully');

                // 2. 상대방의 chatSessions 참조 삭제 시도 (별도 처리)
                const otherUserId = postInfo.userId;
                if (otherUserId && otherUserId !== currentUserId) {
                  try {
                    await deleteDoc(doc(db, 'users', otherUserId, 'chatSessions', sessionIdFromParams));
                    console.log('Other user session reference deleted');
                  } catch (refDeleteError: any) {
                    console.log('Could not delete other user session reference:', refDeleteError.code);
                  }
                }

                // 3. 자신이 보낸 메시지 삭제 (권한 제약으로 인해 별도 처리)
                const messagesCollectionRef = collection(db, 'chatSessions', sessionIdFromParams, 'messages');
                const messagesSnapshot = await getDocs(messagesCollectionRef);

                if (messagesSnapshot.docs.length > 0) {
                  console.log('Force deleting all messages:', messagesSnapshot.docs.length, 'total');
                  let deleteCount = 0;

                  // 모든 메시지 hard delete 시도 (권한 에러 무시)
                  for (const messageDoc of messagesSnapshot.docs) {
                    try {
                      await deleteDoc(messageDoc.ref);
                      deleteCount++;
                    } catch (error: any) {
                      // 권한 에러는 무시하고 계속 진행
                      console.log('Could not delete message:', error.code);
                    }
                  }

                  console.log('Force deleted', deleteCount, 'messages');
                }
              } catch (deleteError: any) {
                console.error('Error in cleanup process:', deleteError.code, deleteError.message);
                // 세션은 이미 삭제되었으므로 일부 실패해도 계속 진행
              }

              Alert.alert(i18n.t('common.success'), '채팅방을 나갔습니다.');

              // 로컬 상태 정리
              setMessages([]);
              setPostInfo(null);
              setSessionExists(false);
              setPartnerLeft(false);
              setPartnerTyping(false);
              setMessage('');
              hasMarkedAsReadRef.current = false;

              router.back();
            } catch (error: any) {
              console.error('Error leaving chat:', error);
              Alert.alert(i18n.t('common.error'), '채팅방을 나가는 중에 오류가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: postInfo ? `${postInfo.store} - ${postInfo.item}` : i18n.t('chat.title'),
          headerRight: () => (
            <TouchableOpacity onPress={handleLeaveChat} style={{ marginRight: 10 }}>
              <Ionicons name="exit-outline" size={24} color="#ff5252" />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 180 : 150}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
        >
          {postInfo && (
            <View style={styles.postInfo}>
              <Ionicons name="cart" size={16} color="#666" />
              <Text style={styles.postInfoText}>
                {postInfo.userEmail?.substring(0, 2)}*** - {postInfo.startTime}~{postInfo.endTime}
              </Text>
            </View>
          )}

          {messages.length === 0 ? (
            <Text style={styles.emptyText}>{i18n.t('chat.emptyMessage')}</Text>
          ) : (
            messages.map((msg, index) => {
              const isSelf = msg.senderId === auth.currentUser?.uid;
              const msgDate = toDate(msg.createdAt);
              const prevMsg = messages[index - 1];
              const showDateSeparator = index === 0 || !isSameDay(msgDate, toDate(prevMsg.createdAt));

              if (index === messages.length - 1) {
                console.log('Last message text:', {
                  length: msg.text.length,
                  preview: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''),
                  isSelf,
                });
              }

              return (
                <View key={msg.id}>
                  {showDateSeparator && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>{getDateGroupLabel(msg.createdAt)}</Text>
                    </View>
                  )}
                  <Pressable
                    style={[
                      isSelf ? styles.messageSelfContainer : styles.messageOtherContainer,
                      Platform.OS === 'ios' ? {
                        maxWidth: screenWidth * 0.85,
                        flexShrink: 1,
                      } : {
                        width: screenWidth * 0.82,
                      }
                    ]}
                    onLongPress={() => handleCopyMessage(msg.text)}
                  >
                    <Text
                      style={isSelf ? styles.messageTextSelf : styles.messageText}
                      numberOfLines={0}
                      allowFontScaling={false}
                    >
                      {msg.text}
                    </Text>
                    <Text style={isSelf ? styles.timestampSelf : styles.timestampOther}>
                      {formatMessageTime(msg.createdAt)}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.safeInputContainer}>
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={i18n.t('chat.sendPlaceholder')}
                value={message}
                onChangeText={handleMessageChange}
                multiline
                maxLength={2000}
              />
              {partnerTyping && (
                <Text style={styles.typingIndicator}>{i18n.t('chat.partnerTyping')}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!message.trim()}
            >
              <Ionicons name="send" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topSection: {
    flexDirection: 'column',
  },
  postInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    gap: 8,
  },
  postInfoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Platform.OS === 'android' ? 0 : 8,
    paddingTop: 8,
    paddingBottom: 8,
    flexGrow: 1,
    width: '100%',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 14,
  },
  messageOtherContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  messageSelfContainer: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  messageContent: {
    flexDirection: 'column',
    maxWidth: '100%',
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 18,
    flexWrap: 'wrap',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
      ios: {},
    }),
  },
  messageTextSelf: {
    fontSize: 15,
    color: 'white',
    lineHeight: 18,
    flexWrap: 'wrap',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
      ios: {},
    }),
  },
  timestampSelf: {
    fontSize: 11,
    color: '#e0e0e0',
    marginTop: 2,
    textAlign: 'right',
  },
  timestampOther: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    textAlign: 'left',
  },
  safeInputContainer: {
    backgroundColor: 'white',
    paddingBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  typingIndicator: {
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 16,
    paddingTop: 4,
    fontStyle: 'italic',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
