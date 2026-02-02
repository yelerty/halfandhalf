import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import i18n from '../../i18n';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const sessionIdFromParams = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [postInfo, setPostInfo] = useState<any>(null);
  const [chatSessionId, setChatSessionId] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);

  // 채팅 세션 정보 가져오기
  useEffect(() => {
    let isMounted = true;

    const loadChatSession = async () => {
      if (!sessionIdFromParams || !auth.currentUser) {
        console.error('sessionId 또는 currentUser가 없습니다');
        return;
      }

      try {
        if (!isMounted) return;
        setChatSessionId(sessionIdFromParams);

        // 채팅 세션 정보 가져오기
        const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
        const sessionDoc = await getDoc(sessionDocRef);

        if (!isMounted) return;

        if (!sessionDoc.exists()) {
          Alert.alert(i18n.t('common.confirm'), i18n.t('chat.sessionNotFound'));
          router.back();
          return;
        }

        const sessionData = sessionDoc.data();
        const postId = sessionData.postId;

        // 게시글 정보 가져오기
        const postDoc = await getDoc(doc(db, 'posts', postId));

        if (!isMounted) return;

        if (postDoc.exists()) {
          const postData = { id: postDoc.id, ...postDoc.data() };
          setPostInfo(postData);

          // 읽음 처리 (채팅방 진입 시)
          if (auth.currentUser) {
            const mySessionRef = doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionIdFromParams);
            await setDoc(mySessionRef, {
              unreadCount: 0,
              lastReadAt: serverTimestamp(),
            }, { merge: true });
          }
        } else {
          // 게시글이 삭제되었으면 세션도 정리
          if (auth.currentUser) {
            await deleteDoc(sessionDocRef);
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionIdFromParams));
          }

          Alert.alert(i18n.t('common.confirm'), i18n.t('chat.postDeleted'));
          router.back();
        }
      } catch (error) {
        console.error('채팅 세션 로드 오류:', error);
        if (isMounted) {
          Alert.alert(i18n.t('common.error'), i18n.t('chat.sendError'));
        }
      }
    };

    loadChatSession();

    return () => {
      isMounted = false;
    };
  }, [sessionIdFromParams]);

  // 메시지 실시간 구독 및 읽음 처리
  useEffect(() => {
    if (!chatSessionId || !auth.currentUser) return;

    const currentUserId = auth.currentUser.uid;
    const messagesCollectionRef = collection(db, 'chatSessions', chatSessionId, 'messages');
    const q = query(messagesCollectionRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];

        setMessages(messagesData);

        // 채팅방에 있으면 읽음 처리 (최적화: unreadCount가 0이 아닐 때만)
        try {
          const mySessionRef = doc(db, 'users', currentUserId, 'chatSessions', chatSessionId);
          const mySession = await getDoc(mySessionRef);

          // unreadCount가 0보다 크면 읽음 처리 (불필요한 쓰기 방지)
          if (mySession.exists() && (mySession.data()?.unreadCount || 0) > 0) {
            await setDoc(mySessionRef, {
              unreadCount: 0,
              lastReadAt: serverTimestamp(),
            }, { merge: true });
          }
        } catch (error) {
          console.error('읽음 처리 오류:', error);
        }

        // 새 메시지가 오면 스크롤 맨 아래로
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (error) => {
        console.error('메시지 구독 오류:', error);
        if (error.code === 'permission-denied') {
          Alert.alert(i18n.t('common.error'), i18n.t('errors.firebaseConfig'));
        }
      }
    );

    return () => unsubscribe();
  }, [chatSessionId]);

  const handleSend = async () => {
    if (!message.trim() || !chatSessionId || !postInfo || !auth.currentUser) return;

    const messageText = message.trim();
    const currentUserId = auth.currentUser.uid;

    try {
      // 0. 채팅 세션이 여전히 존재하는지 확인 (게시글 삭제 등으로 세션이 사라질 수 있음)
      const sessionDoc = await getDoc(doc(db, 'chatSessions', chatSessionId));
      if (!sessionDoc.exists()) {
        Alert.alert(i18n.t('common.error'), i18n.t('chat.sessionNotFound'));
        router.back();
        return;
      }

      // 1. 메시지 저장
      const messagesCollectionRef = collection(db, 'chatSessions', chatSessionId, 'messages');
      await addDoc(messagesCollectionRef, {
        text: messageText,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
      });

      // 2. 세션의 lastMessage 업데이트
      await setDoc(doc(db, 'chatSessions', chatSessionId), {
        lastMessageAt: serverTimestamp(),
        lastMessage: messageText,
      }, { merge: true });

      // 3. 상대방의 unreadCount 증가 (active인 경우에만)
      const participants = sessionDoc.data()?.participants || [];
      const otherUserId = participants.find((id: string) => id !== currentUserId);

      if (otherUserId) {
        const otherUserSessionRef = doc(db, 'users', otherUserId, 'chatSessions', chatSessionId);
        const otherUserSession = await getDoc(otherUserSessionRef);

        // 상대방이 채팅방에 참여 중이고 active 상태일 때만 unreadCount 증가
        if (otherUserSession.exists() && otherUserSession.data()?.active !== false) {
          const currentUnreadCount = otherUserSession.data()?.unreadCount || 0;
          await setDoc(otherUserSessionRef, {
            unreadCount: currentUnreadCount + 1,
          }, { merge: true });
        }
      }

      setMessage('');
    } catch (error: any) {
      console.error('메시지 전송 오류:', error);

      // 구체적인 오류 메시지 제공
      let errorMessage = i18n.t('chat.sendError');
      if (error.code === 'permission-denied') {
        errorMessage = i18n.t('errors.firebaseConfig');
      } else if (error.code === 'unavailable') {
        errorMessage = i18n.t('errors.network');
      }

      Alert.alert(i18n.t('common.error'), errorMessage);

      // 메시지 전송 실패 시 입력창 복구 (재시도 가능하도록)
      // setMessage는 비우지 않음
    }
  };

  const handleLeaveChat = () => {
    if (!chatSessionId || !postInfo || !auth.currentUser) {
      Alert.alert(i18n.t('common.error'), i18n.t('chat.sendError'));
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
              // 내 채팅 세션 참조를 비활성화로 표시
              await setDoc(doc(db, 'users', auth.currentUser.uid, 'chatSessions', chatSessionId), {
                active: false,
                leftAt: serverTimestamp(),
              }, { merge: true });

              // 상대방 ID 찾기
              const participants = [auth.currentUser.uid, postInfo.userId];
              const otherUserId = participants.find(id => id !== auth.currentUser?.uid);

              if (otherUserId) {
                const otherUserSessionDoc = await getDoc(
                  doc(db, 'users', otherUserId, 'chatSessions', chatSessionId)
                );

                // 둘 다 나갔으면 채팅 세션 전체 삭제
                if (!otherUserSessionDoc.exists() || otherUserSessionDoc.data()?.active === false) {
                  // 메시지 모두 삭제
                  const messagesSnapshot = await getDocs(
                    collection(db, 'chatSessions', chatSessionId, 'messages')
                  );
                  const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
                  await Promise.all(deletePromises);

                  // 세션 삭제
                  await deleteDoc(doc(db, 'chatSessions', chatSessionId));

                  // 양쪽 사용자의 채팅 세션 참조도 삭제
                  if (auth.currentUser) {
                    await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'chatSessions', chatSessionId));
                  }
                  await deleteDoc(doc(db, 'users', otherUserId, 'chatSessions', chatSessionId));
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
          title: postInfo ? `${postInfo.store} - ${postInfo.item}` : '채팅',
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
        {/* 게시글 정보 */}
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
          messages.map((msg) => (
            <View
              key={msg.id}
              style={msg.senderId === auth.currentUser?.uid ? styles.messageSelf : styles.messageOther}
            >
              <Text style={msg.senderId === auth.currentUser?.uid ? styles.messageTextSelf : styles.messageText}>
                {msg.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={i18n.t('chat.sendPlaceholder')}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
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
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 14,
  },
  messageOther: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  messageSelf: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  messageTextSelf: {
    fontSize: 16,
    color: 'white',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
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
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 16,
    maxHeight: 100,
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
