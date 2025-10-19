import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

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
    const loadChatSession = async () => {
      if (!sessionIdFromParams) {
        console.error('sessionId가 없습니다');
        return;
      }

      try {
        setChatSessionId(sessionIdFromParams);

        // 채팅 세션 정보 가져오기
        const sessionDocRef = doc(db, 'chatSessions', sessionIdFromParams);
        const sessionDoc = await getDoc(sessionDocRef);

        if (!sessionDoc.exists()) {
          Alert.alert('알림', '채팅 세션이 존재하지 않습니다.');
          router.back();
          return;
        }

        const sessionData = sessionDoc.data();
        const postId = sessionData.postId;

        // 게시글 정보 가져오기
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
          const postData = { id: postDoc.id, ...postDoc.data() };
          setPostInfo(postData);

          // 읽음 처리 (채팅방 진입 시)
          const mySessionRef = doc(db, 'users', auth.currentUser!.uid, 'chatSessions', sessionIdFromParams);
          await setDoc(mySessionRef, {
            unreadCount: 0,
            lastReadAt: serverTimestamp(),
          }, { merge: true });
        } else {
          // 게시글이 삭제되었으면 세션도 정리
          await deleteDoc(sessionDocRef);
          await deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', sessionIdFromParams));

          Alert.alert('알림', '게시글이 삭제되어 채팅을 시작할 수 없습니다.');
          router.back();
        }
      } catch (error) {
        console.error('채팅 세션 로드 오류:', error);
        Alert.alert('오류', '채팅 세션을 불러올 수 없습니다.');
      }
    };

    loadChatSession();
  }, [sessionIdFromParams]);

  // 메시지 실시간 구독 및 읽음 처리
  useEffect(() => {
    if (!chatSessionId) return;

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

        // 채팅방에 있으면 읽음 처리
        try {
          await setDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', chatSessionId), {
            unreadCount: 0,
            lastReadAt: serverTimestamp(),
          }, { merge: true });
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
          Alert.alert('오류', 'Firebase 보안 규칙을 확인해주세요.');
        }
      }
    );

    return () => unsubscribe();
  }, [chatSessionId]);

  const handleSend = async () => {
    if (!message.trim() || !chatSessionId || !postInfo) return;

    try {
      // 채팅 세션에 메시지 저장
      const messagesCollectionRef = collection(db, 'chatSessions', chatSessionId, 'messages');
      await addDoc(messagesCollectionRef, {
        text: message.trim(),
        senderId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });

      // 세션의 lastMessage 업데이트
      await setDoc(doc(db, 'chatSessions', chatSessionId), {
        lastMessageAt: serverTimestamp(),
        lastMessage: message.trim(),
      }, { merge: true });

      // 상대방의 unreadCount 증가
      const sessionDoc = await getDoc(doc(db, 'chatSessions', chatSessionId));
      const participants = sessionDoc.data()?.participants || [];
      const otherUserId = participants.find((id: string) => id !== auth.currentUser!.uid);

      if (otherUserId) {
        const otherUserSessionRef = doc(db, 'users', otherUserId, 'chatSessions', chatSessionId);
        const otherUserSession = await getDoc(otherUserSessionRef);

        if (otherUserSession.exists()) {
          const currentUnreadCount = otherUserSession.data()?.unreadCount || 0;
          await setDoc(otherUserSessionRef, {
            unreadCount: currentUnreadCount + 1,
          }, { merge: true });
        }
      }

      setMessage('');
    } catch (error: any) {
      console.error('메시지 전송 오류:', error);
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
    }
  };

  const handleLeaveChat = () => {
    if (!chatSessionId || !postInfo) {
      Alert.alert('오류', '채팅 세션 정보를 불러올 수 없습니다.');
      return;
    }

    Alert.alert(
      '채팅방 나가기',
      '정말 나가시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            try {
              // 내 채팅 세션 참조를 비활성화로 표시
              await setDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', chatSessionId), {
                active: false,
                leftAt: serverTimestamp(),
              }, { merge: true });

              // 상대방 ID 찾기
              const participants = [auth.currentUser!.uid, postInfo.userId];
              const otherUserId = participants.find(id => id !== auth.currentUser!.uid);

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
                  await deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', chatSessionId));
                  await deleteDoc(doc(db, 'users', otherUserId, 'chatSessions', chatSessionId));
                }
              }

              Alert.alert('알림', '채팅방에서 나갔습니다.');
              router.back();
            } catch (error: any) {
              console.error('채팅방 나가기 오류:', error);
              Alert.alert('오류', error.message);
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
          <Text style={styles.emptyText}>메시지를 보내서 대화를 시작하세요!</Text>
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
          placeholder="메시지 입력..."
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
