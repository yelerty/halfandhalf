export default {
  // Common
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
  },

  // App Info
  app: {
    name: 'HalfAndHalf',
    subtitle: 'Bulk Purchase Sharing',
  },

  // Auth
  auth: {
    email: 'Email',
    password: 'Password',
    login: 'Login',
    register: 'Sign Up',
    logout: 'Logout',
    emailPlaceholder: 'example@email.com',
    passwordPlaceholder: 'Enter your password',
    loginButton: 'Login',
    registerButton: 'Sign Up',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    fillAllFields: 'Please fill in all fields',
    loginSuccess: 'Login successful!',
    registerSuccess: 'Sign up successful!',
  },

  // Tabs
  tabs: {
    home: 'Home',
    myPosts: 'My Posts',
    chats: 'Chats',
    profile: 'Profile',
  },

  // Home Screen
  home: {
    title: 'HalfAndHalf',
    subtitle: 'Bulk Purchase Sharing',
    searchPlaceholder: 'Search stores (e.g., Costco)',
    noResults: 'No results found',
    noPosts: 'No posts yet',
    viewDetail: 'View Details',
    cannotChatOwnPost: 'You cannot chat on your own post.',
    addedToBlacklist: ' has been added to your blacklist.',
    loadMore: 'Load More',
  },

  // My Posts Screen
  myPosts: {
    title: 'My Posts',
    activePosts: 'Active Posts',
    archive: 'Archive',
    noActivePosts: 'No active posts',
    noArchivedPosts: 'No archived posts',
    editPost: 'Edit',
    repost: 'Repost',
    expired: 'Expired',
    deleteArchivedTitle: 'Delete Archived Post',
    deleteArchivedMessage: 'Are you sure you want to delete this?',
    deleteSuccess: 'Post has been deleted.',
  },

  // Chats Screen
  chats: {
    title: 'Chats',
    noChats: 'No chats yet',
    startChatting: 'Start chatting through posts!',
    deleteTitle: 'Delete Chat',
    deleteConfirm: 'Are you sure you want to delete this chat?',
  },

  // Chat Screen
  chat: {
    title: 'Chat',
    sendPlaceholder: 'Type a message...',
    emptyMessage: 'Send a message to start the conversation!',
    leaveChat: 'Leave Chat',
    leaveChatConfirm: 'Are you sure you want to leave?',
    leftChat: 'You have left the chat.',
    partnerLeft: 'Your partner has left the chat.',
    partnerTyping: 'Partner is typing...',
    sessionNotFound: 'Chat session does not exist.',
    sessionDeleted: 'Chat session has been deleted.',
    postDeleted: 'The post has been deleted and chat cannot be started.',
    sendError: 'Failed to send message.',
  },

  // Profile Screen
  profile: {
    title: 'Profile',
    email: 'Email',
    blacklist: 'Blacklist',
    noBlacklistedUsers: 'No blacklisted users',
    removeFromBlacklist: 'Remove from Blacklist',
    removeConfirm: 'Are you sure you want to remove?',
    removeSuccess: 'Removed from blacklist.',
    logout: 'Logout',
  },

  // Create Post Screen
  createPost: {
    title: 'Create Post',
    store: 'Store',
    storePlaceholder: 'e.g., Costco Yangjae',
    item: 'Item to Share',
    itemPlaceholder: 'e.g., Paper Towels 12-pack',
    date: 'Date',
    startTime: 'Start Time',
    endTime: 'End Time',
    submit: 'Submit',
    submitting: 'Submitting...',
    fillAllFields: 'Please fill in all fields',
    locationRequired: 'Getting your location. Please try again in a moment.',
    success: 'Post has been created!',
    permissionRequired: 'Location permission is required.',
  },

  // Edit Post Screen
  editPost: {
    title: 'Edit Post',
    update: 'Update',
    updating: 'Updating...',
    repost: 'Edit and Repost',
    reposting: 'Reposting...',
    deletePost: 'Delete Post',
    deleteConfirm: 'Are you sure? (All related chats will be deleted)',
    updateSuccess: 'Post has been updated!',
    repostSuccess: 'Post has been reposted!',
    deleteSuccess: 'Post and related chats have been deleted.',
    loadError: 'Failed to load post.',
  },

  // Post Detail Screen
  postDetail: {
    itemInfo: 'Item Info',
    schedule: 'Schedule',
    location: 'Location',
    item: 'Item',
    date: 'Date',
    time: 'Time',
    coordinates: 'Coordinates',
    startChat: 'Start Chat',
    notFound: 'Post not found.',
    loadError: 'Failed to load post.',
  },

  // Errors
  errors: {
    generic: 'An error occurred.',
    network: 'A network error occurred.',
    firebaseConfig: 'Please check Firebase security rules.',
  },
};
