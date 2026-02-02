import { collection, query, where, getDocs, deleteDoc, doc, writeBatch, DocumentReference } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * 문서 참조 배열을 500개씩 나눠서 batch 삭제합니다.
 */
const deleteBatchInChunks = async (docRefs: DocumentReference[]) => {
  const BATCH_LIMIT = 500;

  for (let i = 0; i < docRefs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = docRefs.slice(i, i + BATCH_LIMIT);

    for (const docRef of chunk) {
      batch.delete(docRef);
    }

    try {
      await batch.commit();
      console.log(`Batch ${Math.floor(i / BATCH_LIMIT) + 1} 완료: ${chunk.length}개 문서 삭제`);
    } catch (error: any) {
      // 권한 에러는 무시 (다른 사용자의 문서는 삭제할 수 없음)
      if (error.code === 'permission-denied') {
        console.log(`Batch ${Math.floor(i / BATCH_LIMIT) + 1} 권한 없음 (일부 문서 삭제 실패, 정상)`);
      } else {
        console.error(`Batch ${Math.floor(i / BATCH_LIMIT) + 1} 삭제 오류:`, error);
      }
    }
  }
};

/**
 * 게시글 삭제 시 관련된 모든 채팅 세션과 메시지를 삭제합니다.
 * Firestore batch 500개 제한을 고려하여 여러 batch로 나눠 처리합니다.
 */
export const deleteChatSessionsForPost = async (postId: string) => {
  try {
    // 1. 해당 게시글과 관련된 모든 채팅 세션 찾기
    const chatSessionsQuery = query(
      collection(db, 'chatSessions'),
      where('postId', '==', postId)
    );
    const chatSessionsSnapshot = await getDocs(chatSessionsQuery);

    if (chatSessionsSnapshot.empty) {
      return; // 채팅 세션이 없으면 종료
    }

    const docsToDelete: DocumentReference[] = [];
    const sessionIds: string[] = [];

    // 2. 삭제할 문서 참조 수집
    for (const sessionDoc of chatSessionsSnapshot.docs) {
      sessionIds.push(sessionDoc.id);
      const sessionId = sessionDoc.id;
      const sessionData = sessionDoc.data();

      // 채팅 세션의 메시지 삭제
      const messagesQuery = query(
        collection(db, 'chatSessions', sessionId, 'messages')
      );
      const messagesSnapshot = await getDocs(messagesQuery);

      for (const messageDoc of messagesSnapshot.docs) {
        docsToDelete.push(messageDoc.ref);
      }

      // 채팅 세션 삭제
      docsToDelete.push(sessionDoc.ref);

      // 사용자들의 chatSessions 참조 삭제
      if (sessionData?.participants) {
        for (const userId of sessionData.participants) {
          try {
            const userChatSessionRef = doc(db, 'users', userId, 'chatSessions', sessionId);
            docsToDelete.push(userChatSessionRef);
          } catch (error) {
            console.error(`사용자 ${userId}의 채팅 세션 참조 삭제 오류:`, error);
          }
        }
      }
    }

    // 3. 500개씩 나눠서 일괄 삭제
    if (docsToDelete.length > 0) {
      await deleteBatchInChunks(docsToDelete);
    }

    console.log(`게시글 ${postId}의 채팅 세션 ${sessionIds.length}개 삭제 완료 (총 ${docsToDelete.length}개 문서)`);
  } catch (error: any) {
    // 권한 에러는 무시 (다른 사용자의 채팅 세션은 삭제할 수 없음)
    if (error.code === 'permission-denied') {
      console.log('일부 채팅 세션 삭제 권한 없음 (정상)');
      return;
    }
    console.error('채팅 세션 삭제 오류:', error);
    // 에러를 throw하지 않고 계속 진행
  }
};
