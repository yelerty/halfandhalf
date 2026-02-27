export default {
  // Common
  common: {
    confirm: '확인',
    cancel: '취소',
    delete: '삭제',
    edit: '수정',
    save: '저장',
    close: '닫기',
    loading: '로딩 중...',
    error: '오류',
    success: '성공',
  },

  // App Info
  app: {
    name: 'HalfAndHalf',
    subtitle: '대용량 공동구매 매칭',
  },

  // Auth
  auth: {
    email: '이메일',
    password: '비밀번호',
    login: '로그인',
    register: '회원가입',
    logout: '로그아웃',
    emailPlaceholder: 'example@email.com',
    passwordPlaceholder: '비밀번호를 입력하세요',
    loginButton: '로그인',
    registerButton: '회원가입',
    noAccount: '계정이 없으신가요?',
    hasAccount: '이미 계정이 있으신가요?',
    fillAllFields: '모든 필드를 입력해주세요',
    loginSuccess: '로그인 성공!',
    registerSuccess: '회원가입 성공!',
  },

  // Tabs
  tabs: {
    home: '홈',
    myPosts: '내 게시글',
    chats: '채팅',
    profile: '프로필',
  },

  // Home Screen
  home: {
    title: 'HalfAndHalf',
    subtitle: '대용량 공동구매 매칭',
    searchPlaceholder: '매장 검색 (예: 코스트코)',
    noResults: '검색 결과가 없습니다',
    noPosts: '아직 게시글이 없습니다',
    viewDetail: '상세 보기',
    cannotChatOwnPost: '본인이 작성한 게시글에는 채팅할 수 없습니다.',
    addedToBlacklist: '님을 블랙리스트에 추가했습니다.',
    loadMore: '더 보기',
  },

  // My Posts Screen
  myPosts: {
    title: '내 게시글',
    activePosts: '활성 게시글',
    archive: '보관함',
    noActivePosts: '등록한 게시글이 없습니다',
    noArchivedPosts: '보관된 게시글이 없습니다',
    editPost: '수정하기',
    repost: '재등록',
    expired: '만료됨',
    deleteArchivedTitle: '보관된 게시글 삭제',
    deleteArchivedMessage: '정말 삭제하시겠습니까?',
    deleteSuccess: '게시글이 삭제되었습니다.',
  },

  // Chats Screen
  chats: {
    title: '채팅',
    noChats: '아직 채팅이 없습니다',
    startChatting: '게시글을 통해 채팅을 시작하세요!',
    deleteTitle: '채팅 삭제',
    deleteConfirm: '정말 이 채팅을 삭제하시겠습니까?',
  },

  // Chat Screen
  chat: {
    title: '채팅',
    sendPlaceholder: '메시지 입력...',
    emptyMessage: '메시지를 보내서 대화를 시작하세요!',
    leaveChat: '채팅방 나가기',
    leaveChatConfirm: '정말 나가시겠습니까?',
    leftChat: '채팅방에서 나갔습니다.',
    partnerLeft: '상대방이 채팅방을 나갔습니다.',
    partnerTyping: '상대방이 입력 중...',
    sessionNotFound: '채팅 세션이 존재하지 않습니다.',
    sessionDeleted: '채팅 세션이 삭제되었습니다.',
    postDeleted: '게시글이 삭제되어 채팅을 시작할 수 없습니다.',
    sendError: '메시지 전송에 실패했습니다.',
  },

  // Profile Screen
  profile: {
    title: '프로필',
    email: '이메일',
    blacklist: '블랙리스트',
    noBlacklistedUsers: '블랙리스트에 추가된 사용자가 없습니다',
    removeFromBlacklist: '블랙리스트에서 제거',
    removeConfirm: '정말 제거하시겠습니까?',
    removeSuccess: '블랙리스트에서 제거되었습니다.',
    logout: '로그아웃',
  },

  // Create Post Screen
  createPost: {
    title: '공동구매 등록',
    store: '매장',
    storePlaceholder: '예: 코스트코 양재점',
    item: '나눔 물건',
    itemPlaceholder: '예: 키친타올 12롤',
    date: '날짜',
    startTime: '시작 시간',
    endTime: '종료 시간',
    submit: '등록하기',
    submitting: '등록 중...',
    fillAllFields: '모든 필드를 입력해주세요',
    locationRequired: '위치 정보를 가져오는 중입니다. 잠시 후 다시 시도해주세요.',
    success: '게시글이 등록되었습니다!',
    permissionRequired: '위치 권한이 필요합니다.',
  },

  // Edit Post Screen
  editPost: {
    title: '게시글 수정',
    update: '수정하기',
    updating: '수정 중...',
    repost: '수정해서 재등록',
    reposting: '재등록 중...',
    deletePost: '게시글 삭제',
    deleteConfirm: '정말 삭제하시겠습니까? (관련 채팅도 모두 삭제됩니다)',
    updateSuccess: '게시글이 수정되었습니다!',
    repostSuccess: '게시글이 재등록되었습니다!',
    deleteSuccess: '게시글과 관련 채팅이 모두 삭제되었습니다.',
    loadError: '게시글을 불러올 수 없습니다.',
  },

  // Post Detail Screen
  postDetail: {
    itemInfo: '물건 정보',
    schedule: '시간 정보',
    location: '위치',
    item: '물건',
    date: '날짜',
    time: '시간',
    coordinates: '좌표',
    startChat: '채팅 시작',
    notFound: '게시글을 찾을 수 없습니다.',
    loadError: '게시글을 불러올 수 없습니다.',
  },

  // Errors
  errors: {
    generic: '오류가 발생했습니다.',
    network: '네트워크 오류가 발생했습니다.',
    firebaseConfig: 'Firebase 보안 규칙을 확인해주세요.',
  },
};
