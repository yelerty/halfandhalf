# HalfAndHalf 보안 가이드

## 🔐 Firebase 보안 규칙 배포

### 1. Firebase CLI 설치

```bash
npm install -g firebase-tools
```

### 2. Firebase 로그인

```bash
firebase login
```

### 3. Firebase 프로젝트 초기화

```bash
firebase init
```

다음 항목을 선택:
- ✅ Firestore
- ✅ Storage

프로젝트 선택: `halfandhalf-15e51`

### 4. Firestore 보안 규칙 배포

```bash
firebase deploy --only firestore:rules
```

### 5. Storage 보안 규칙 배포

```bash
firebase deploy --only storage:rules
```

### 6. 모든 규칙 한 번에 배포

```bash
firebase deploy --only firestore:rules,storage:rules
```

---

## 🛡️ 보안 규칙 설명

### Firestore 보안 규칙

#### 1. **users 컬렉션**
- ✅ 본인 데이터만 읽기/쓰기 가능
- ✅ 다른 사용자의 개인정보 접근 차단

```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}
```

#### 2. **posts 컬렉션**
- ✅ 모든 인증된 사용자가 게시글 읽기 가능
- ✅ 작성자만 게시글 수정/삭제 가능
- ✅ 게시글 작성 시 필수 필드 검증

```javascript
match /posts/{postId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
  allow update, delete: if resource.data.userId == request.auth.uid;
}
```

#### 3. **chatSessions 컬렉션**
- ✅ 채팅 참여자만 세션 접근 가능
- ✅ 참여자가 아닌 사용자의 채팅 엿보기 차단
- ✅ 채팅 세션은 정확히 2명의 참여자만 가능

```javascript
match /chatSessions/{sessionId} {
  allow read: if request.auth.uid in resource.data.participants;
  allow create: if request.auth.uid in request.resource.data.participants
    && request.resource.data.participants.size() == 2;
}
```

#### 4. **messages 하위 컬렉션**
- ✅ 채팅 참여자만 메시지 읽기 가능
- ✅ 메시지 작성자 ID 검증 (위조 방지)
- ✅ 메시지 수정/삭제 불가 (채팅 기록 보존)

```javascript
match /messages/{messageId} {
  allow read: if request.auth.uid in get(/databases/$(database)/documents/chatSessions/$(sessionId)).data.participants;
  allow create: if request.resource.data.senderId == request.auth.uid;
  allow update, delete: if false;  // 메시지는 불변
}
```

### Storage 보안 규칙

#### 1. **파일 크기 제한**
- ✅ 최대 5MB로 제한
- ✅ 대용량 파일 업로드로 인한 비용 증가 방지

#### 2. **파일 형식 검증**
- ✅ 이미지 파일만 업로드 가능
- ✅ 악성 파일 업로드 차단

#### 3. **접근 권한**
- ✅ 사용자 프로필 이미지: 본인만 업로드/읽기 가능
- ✅ 게시글 이미지: 인증된 사용자만 업로드, 모든 인증 사용자 읽기 가능

---

## ⚠️ 차단된 공격 시나리오

### 1. **채팅 엿보기 공격**
**공격 시나리오:**
- 공격자가 채팅 세션 ID를 추측하여 다른 사람의 대화 내용을 읽으려 시도

**방어:**
```javascript
// 참여자가 아니면 접근 불가
allow read: if request.auth.uid in resource.data.participants;
```

### 2. **메시지 위조 공격**
**공격 시나리오:**
- 공격자가 다른 사용자 ID로 메시지를 작성하려 시도

**방어:**
```javascript
// senderId가 현재 사용자와 일치하는지 검증
allow create: if request.resource.data.senderId == request.auth.uid;
```

### 3. **게시글 무단 삭제 공격**
**공격 시나리오:**
- 공격자가 다른 사용자의 게시글을 삭제하려 시도

**방어:**
```javascript
// 작성자만 삭제 가능
allow delete: if resource.data.userId == request.auth.uid;
```

### 4. **개인정보 탈취 공격**
**공격 시나리오:**
- 공격자가 다른 사용자의 블랙리스트, 채팅 세션 목록 등을 읽으려 시도

**방어:**
```javascript
// users/{userId} 경로는 본인만 접근 가능
allow read, write: if request.auth.uid == userId;
```

---

## 🧪 보안 규칙 테스트

### Firebase Console에서 테스트

1. Firebase Console → Firestore Database → Rules
2. "시뮬레이터로 테스트" 클릭
3. 다음 시나리오 테스트:

#### 테스트 케이스 1: 다른 사용자 채팅 읽기 시도 (실패해야 함)
```
Location: /chatSessions/post123_user1_user2/messages/msg1
Read: true
Auth: user3의 UID
Expected: ❌ Denied
```

#### 테스트 케이스 2: 본인 채팅 읽기 (성공해야 함)
```
Location: /chatSessions/post123_user1_user2/messages/msg1
Read: true
Auth: user1의 UID
Expected: ✅ Allowed
```

#### 테스트 케이스 3: 다른 사용자 게시글 삭제 시도 (실패해야 함)
```
Location: /posts/post123
Delete: true
Auth: user2의 UID (작성자는 user1)
Expected: ❌ Denied
```

---

## 📝 환경 변수 설정

### .env 파일 (로컬 개발용)

`.env` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### EAS Build 환경 변수 설정

EAS Build를 사용할 때는 `eas.json`에 환경 변수를 설정하거나 EAS Secrets를 사용합니다:

```bash
# EAS Secret 설정
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value your_api_key
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value your_auth_domain
# ... 나머지 환경 변수도 동일하게 설정
```

---

## ✅ 보안 체크리스트

배포 전 반드시 확인:

- [ ] Firestore 보안 규칙 배포 완료
- [ ] Storage 보안 규칙 배포 완료
- [ ] `.env` 파일이 `.gitignore`에 포함됨
- [ ] Firebase Console에서 보안 규칙 시뮬레이터로 테스트 완료
- [ ] 프로덕션 환경 변수 설정 완료
- [ ] Firebase API 키가 코드에 하드코딩되지 않음

---

## 🆘 문제 발생 시

### 규칙 배포 후 앱이 작동하지 않는 경우

1. Firebase Console → Firestore Database → Rules에서 규칙 확인
2. 에러 로그 확인: `permission-denied` 에러가 있는지 확인
3. 시뮬레이터로 테스트하여 어떤 규칙이 문제인지 확인

### 긴급 롤백이 필요한 경우

```bash
# 이전 버전으로 롤백
firebase deploy --only firestore:rules --force
```

또는 Firebase Console에서 수동으로 이전 규칙 복원 가능합니다.
