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
  const { id: postId } = useLocalSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [postInfo, setPostInfo] = useState<any>(null);
  const [chatSessionId, setChatSessionId] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);

  // 게시글 정보 가져오기 및 채팅 세션 생성
  useEffect(() => {
    const loadPostAndCreateSession = async () => {
      try {
        const postDoc = await getDoc(doc(db, 'posts', postId as string));
        if (postDoc.exists()) {
          const postData = { id: postDoc.id, ...postDoc.data() };
          setPostInfo(postData);

          // 채팅 세션 ID 생성 (게시글ID_참여자1_참여자2를 정렬)
          const participants = [auth.currentUser!.uid, postData.userId].sort();
          const sessionId = `${postId}_${participants.join('_')}`;
          setChatSessionId(sessionId);

          // 채팅 세션에 참여자 등록
          await setDoc(doc(db, 'chatSessions', sessionId), {
            postId,
            postStore: postData.store,
            postItem: postData.item,
            participants: participants,
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp(),
          }, { merge: true });

          // 각 참여자별 채팅 세션 참조 생성
          await setDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', sessionId), {
            postId,
            sessionId,
            active: true,
            joinedAt: serverTimestamp(),
          }, { merge: true });

          await setDoc(doc(db, 'users', postData.userId, 'chatSessions', sessionId), {
            postId,
            sessionId,
            active: true,
            joinedAt: serverTimestamp(),
          }, { merge: true });
        }
      } catch (error) {
        console.error('게시글 정보 로드 오류:', error);
      }
    };

    if (postId) {
      loadPostAndCreateSession();
    }
  }, [postId]);

  // 메시지 실시간 구독
  useEffect(() => {
    if (!chatSessionId) return;

    const q = query(
      collection(db, 'chatSessions', chatSessionId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(messagesData);

      // 새 메시지가 오면 스크롤 맨 아래로
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return unsubscribe;
  }, [chatSessionId]);

  const handleSend = async () => {
    if (!message.trim() || !chatSessionId) return;

    try {
      // 채팅 세션에 메시지 저장
      await addDoc(collection(db, 'chatSessions', chatSessionId, 'messages'), {
        text: message.trim(),
        senderId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });

      // 세션의 lastMessageAt 업데이트
      await setDoc(doc(db, 'chatSessions', chatSessionId), {
        lastMessageAt: serverTimestamp(),
        lastMessage: message.trim(),
      }, { merge: true });

      setMessage('');
    } catch (error) {
      console.error('메시지 전송 오류:', error);
    }
  };

  const handleLeaveChat = () => {
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
              // 내 채팅 세션 참조 삭제
              await deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', chatSessionId));

              // 상대방도 나갔는지 확인
              const otherUserId = postInfo.userId === auth.currentUser!.uid
                ? chatSessionId.split('_').find(id => id !== postId && id !== auth.currentUser!.uid)
                : postInfo.userId;

              if (otherUserId) {
                const otherUserSessionDoc = await getDoc(
                  doc(db, 'users', otherUserId, 'chatSessions', chatSessionId)
                );

                // 둘 다 나갔으면 채팅 세션 전체 삭제
                if (!otherUserSessionDoc.exists()) {
                  // 메시지 모두 삭제
                  const messagesSnapshot = await getDocs(
                    collection(db, 'chatSessions', chatSessionId, 'messages')
                  );
                  const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
                  await Promise.all(deletePromises);

                  // 세션 삭제
                  await deleteDoc(doc(db, 'chatSessions', chatSessionId));
                }
              }

              Alert.alert('알림', '채팅방에서 나갔습니다.');
              router.back();
            } catch (error: any) {
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
