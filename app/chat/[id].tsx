import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import i18n from '../../i18n';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  isTemp?: boolean;
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const sessionIdFromParams = Array.isArray(params.id) ? params.id[0] : params.id;

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
  const scrollViewRef = useRef<ScrollView>(null);
  const hasMarkedAsReadRef = useRef(false);

  // 채팅 세션 정보 가져오기 또는 params에서 설정
  useEffect(() => {
    let isMounted = true;

    const loadChatSession = async () => {
      if (!sessionIdFromParams || !auth.currentUser) {
        console.error('sessionId 또는 currentUser가 없습니다');
        return;
      }

      try {
        // 먼저 기존 세션이 있는지 확인
        const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
        const sessionDoc = await getDoc(sessionDocRef);

        if (!isMounted) return;

        if (sessionDoc.exists()) {
          // 기존 세션이 있으면 사용
          setSessionExists(true);
          const sessionData = sessionDoc.data();
          const postId = sessionData.postId;

          // 게시글 정보 가져오기
          const postDoc = await getDoc(doc(db, 'posts', postId));

          if (!isMounted) return;

          if (postDoc.exists()) {
            const postData = { id: postDoc.id, ...postDoc.data() };
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
            Alert.alert(i18n.t('common.confirm'), i18n.t('chat.postDeleted'));
            router.back();
          }
        } else if (postIdFromParams) {
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
          Alert.alert(i18n.t('common.confirm'), i18n.t('chat.sessionNotFound'));
          router.back();
        }
      } catch (error: any) {
        console.error('채팅 세션 로드 오류:', error);
        // permission-denied는 세션이 아직 없는 정상 케이스
        if (error.code === 'permission-denied' && postIdFromParams) {
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
    };

    loadChatSession();

    return () => {
      isMounted = false;
    };
  }, [sessionIdFromParams]);

  // 메시지 실시간 구독 (세션이 존재할 때만)
  useEffect(() => {
    if (!sessionIdFromParams || !auth.currentUser || !sessionExists) return;

    const currentUserId = auth.currentUser.uid;
    const messagesCollectionRef = collection(db, 'chatSessions', sessionIdFromParams, 'messages');
    const q = query(messagesCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];

        // 메시지 렌더링 디버깅
        messagesData.forEach((msg, index) => {
          console.log(`[메시지 #${index + 1}] 발신자: ${msg.senderId === auth.currentUser?.uid ? '나' : '상대'}, 길이: ${msg.text?.length || 0}, 내용: "${msg.text}"`);
        });

        setMessages(messagesData);

        // 첫 구독 시에만 읽음 처리 (중복 방지)
        if (!hasMarkedAsReadRef.current) {
          try {
            const mySessionRef = doc(db, 'users', currentUserId, 'chatSessions', sessionIdFromParams);
            await setDoc(mySessionRef, {
              unreadCount: 0,
              lastReadAt: serverTimestamp(),
            }, { merge: true });
            hasMarkedAsReadRef.current = true;
          } catch (error) {
            console.error('읽음 처리 오류:', error);
          }
        }

        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (error) => {
        console.error('메시지 구독 오류:', error);
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

    return () => unsubscribe();
  }, [sessionIdFromParams, sessionExists]);

  const handleSend = async () => {
    // 메시지 유효성 체크 (공백은 허용하되, 완전히 비어있으면 거부)
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !sessionIdFromParams || !postInfo || !auth.currentUser) return;

    // 원본 메시지 사용 (공백 포함)
    const messageText = message;

    // 디버깅: 실제 저장되는 메시지 확인
    console.log(`[메시지 전송] 길이: ${messageText.length}, 내용: "${messageText}"`);

    if (!messageText || messageText.length === 0) {
      Alert.alert(i18n.t('common.error'), '메시지가 비어있습니다.');
      return;
    }

    const currentUserId = auth.currentUser.uid;
    const participants = [currentUserId, postInfo.userId].sort();

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
      // 세션이 없으면 먼저 생성
      if (!sessionExists) {
        // 1. 채팅 세션 생성
        await setDoc(doc(db, 'chatSessions', sessionIdFromParams), {
          postId: postInfo.id,
          postStore: postInfo.store,
          postItem: postInfo.item,
          participants,
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          lastMessage: messageText,
        });

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
        await setDoc(doc(db, 'users', postInfo.userId, 'chatSessions', sessionIdFromParams), {
          postId: postInfo.id,
          postStore: postInfo.store,
          postItem: postInfo.item,
          sessionId: sessionIdFromParams,
          active: true,
          unreadCount: 1,
          joinedAt: serverTimestamp(),
        }, { merge: true });

        setSessionExists(true);
      } else {
        // 세션이 있으면 lastMessage 업데이트
        await setDoc(doc(db, 'chatSessions', sessionIdFromParams), {
          lastMessageAt: serverTimestamp(),
          lastMessage: messageText,
        }, { merge: true });
      }

      // 메시지 저장
      const messagesCollectionRef = collection(db, 'chatSessions', sessionIdFromParams, 'messages');
      const docRef = await addDoc(messagesCollectionRef, {
        text: messageText,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
      });

      // 저장 확인
      console.log(`[메시지 저장됨] ID: ${docRef.id}, 길이: ${messageText.length}`);

      // 구독을 통해 실제 메시지를 받으면 임시 메시지는 자동으로 대체됨
    } catch (error: any) {
      console.error('메시지 전송 오류:', error);

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
              await setDoc(doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionIdFromParams), {
                active: false,
                leftAt: serverTimestamp(),
              }, { merge: true });

              const participants = [auth.currentUser.uid, postInfo.userId];
              const otherUserId = participants.find(id => id !== auth.currentUser?.uid);

              if (otherUserId) {
                const otherUserSessionDoc = await getDoc(
                  doc(db, 'users', otherUserId, 'chatSessions', sessionIdFromParams)
                );

                if (!otherUserSessionDoc.exists() || otherUserSessionDoc.data()?.active === false) {
                  const messagesSnapshot = await getDocs(
                    collection(db, 'chatSessions', sessionIdFromParams, 'messages')
                  );
                  const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
                  await Promise.all(deletePromises);

                  await deleteDoc(doc(db, 'chatSessions', sessionIdFromParams));

                  if (auth.currentUser) {
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionIdFromParams));
                  }
                  await deleteDoc(doc(db, 'users', otherUserId, 'chatSessions', sessionIdFromParams));
                }
              }

              Alert.alert(i18n.t('common.confirm'), i18n.t('chat.leftChat'));
              router.back();
            } catch (error: any) {
              console.error('채팅방 나가기 오류:', error);
              Alert.alert(i18n.t('common.error'), error.message);
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
        keyboardVerticalOffset={90}
      >
        {postInfo && (
          <View style={styles.postInfo}>
            <Ionicons name="cart" size={16} color="#666" />
            <Text style={styles.postInfoText}>
              {postInfo.userEmail} - {postInfo.startTime}~{postInfo.endTime}
            </Text>
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>{i18n.t('chat.emptyMessage')}</Text>
          ) : (
            messages.map((msg, index) => {
              const isSelf = msg.senderId === auth.currentUser?.uid;
              return (
                <View
                  key={msg.id}
                  style={isSelf ? styles.messageSelfContainer : styles.messageOtherContainer}
                >
                  <Text
                    style={isSelf ? styles.messageTextSelf : styles.messageText}
                    numberOfLines={0}
                  >
                    {msg.text}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={i18n.t('chat.sendPlaceholder')}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    flexShrink: 1,
  },
  messageSelfContainer: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    flexShrink: 1,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    flexWrap: 'wrap',
    flex: 1,
  },
  messageTextSelf: {
    fontSize: 16,
    color: 'white',
    lineHeight: 22,
    flexWrap: 'wrap',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 30,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
    textAlignVertical: 'top',
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
