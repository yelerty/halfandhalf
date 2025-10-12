import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

interface ChatSession {
  sessionId: string;
  postId: string;
  postTitle: string;
  lastMessage: string;
  lastMessageTime: any;
}

export default function ChatsScreen() {
  const router = useRouter();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // 내 채팅 세션 실시간 구독
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'chatSessions')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const sessions: ChatSession[] = [];

      for (const sessionDoc of snapshot.docs) {
        const sessionData = sessionDoc.data();
        const sessionId = sessionData.sessionId;

        try {
          // 채팅 세션 정보 가져오기
          const chatSessionDoc = await getDoc(doc(db, 'chatSessions', sessionId));
          if (chatSessionDoc.exists()) {
            const chatData = chatSessionDoc.data();

            // lastMessage가 있는 세션만 표시 (빈 채팅 세션 제외)
            if (chatData.lastMessage) {
              sessions.push({
                sessionId,
                postId: sessionData.postId,
                postTitle: `${chatData.postStore} - ${chatData.postItem}`,
                lastMessage: chatData.lastMessage,
                lastMessageTime: chatData.lastMessageAt,
              });
            }
          }
        } catch (error) {
          console.error('채팅 세션 로드 오류:', error);
        }
      }

      // 최신 메시지 순으로 정렬
      sessions.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
      });

      setChatSessions(sessions);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>채팅</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
        ) : chatSessions.length === 0 ? (
          <Text style={styles.emptyText}>채팅 세션이 없습니다</Text>
        ) : (
          chatSessions.map((session) => (
            <TouchableOpacity
              key={session.sessionId}
              style={styles.chatCard}
              onPress={() => router.push(`/chat/${session.postId}`)}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="chatbubbles" size={40} color="#4CAF50" />
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.postTitle}>{session.postTitle}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {session.lastMessage}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#ccc" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  chatCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconContainer: {
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
});
