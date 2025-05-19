
import { db, storage } from "./firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot,
    limit,
    setDoc,
    writeBatch,
    runTransaction,
    Timestamp,
    deleteField as firestoreDeleteField,
    arrayRemove,
    arrayUnion,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, UploadTask } from "firebase/storage";

interface UserProfile {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  status?: "online" | "offline" | "away";
  lastSeen?: any;
}

// --- (setUserOnlineStatus, listenToUserOnlineStatus, listenToFriendsOnlineStatus, setupPresenceSystem - UNCHANGED) ---
export const setUserOnlineStatus = async (userId: string, status: "online" | "offline" | "away") => {
  if (!userId) return;
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      status,
      lastSeen: serverTimestamp(),
    }).catch((err) => console.warn("Failed to update status (likely offline):", err.code));
  } catch (error) {
    console.error("Error setting online status:", error);
  }
};

export const listenToUserOnlineStatus = (userId: string, callback: (status: string, lastSeen: any) => void) => {
  const userRef = doc(db, "users", userId);
  const unsubscribe = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const userData = docSnap.data();
      callback(userData.status || "offline", userData.lastSeen);
    } else {
      callback("offline", null);
    }
  }, (error) => {
    console.error("Error listening to user status:", error);
    callback("offline", null);
  });
  return unsubscribe;
};

export const listenToFriendsOnlineStatus = (userIds: string[], callback: (statuses: UserProfile[]) => void): (() => void) => {
  if (!userIds || userIds.length === 0) {
    callback([]);
    return () => {};
  }

  const usersRef = collection(db, "users");
  const chunkSize = 30; // Firestore 'in' query limit is 30
  let unsubscribes: (()=>void)[] = [];
  let allStatuses: Record<string, UserProfile> = {};

  const processChunk = (chunk: string[]) => {
      if (chunk.length === 0) return;
      const q = query(usersRef, where("__name__", "in", chunk));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const docSnap = change.doc;
            const userData = docSnap.data();
            if (change.type === "removed") {
                delete allStatuses[docSnap.id];
            } else {
                 allStatuses[docSnap.id] = {
                    id: docSnap.id,
                    name: userData.name || userData.displayName || userData.email,
                    displayName: userData.displayName,
                    email: userData.email,
                    photoURL: userData.photoURL,
                    status: userData.status || "offline",
                    lastSeen: userData.lastSeen,
                };
            }
          });
          callback(Object.values(allStatuses));
      }, (error) => {
          console.error("Error listening to friends online status chunk:", error);
      });
      unsubscribes.push(unsubscribe);
  };

  for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      processChunk(chunk);
  }

  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
};

export const setupPresenceSystem = (userId: string): (() => void) => {
    if (!userId) return () => {};
    const userStatusRef = doc(db, "users", userId);
    let isOfflineForDatabase = false;

    const setOnline = () => {
        isOfflineForDatabase = false;
        updateDoc(userStatusRef, {
            status: "online",
            lastSeen: serverTimestamp(),
        }).catch((err) => console.warn("Presence: Failed to set online (network issue?):", err.code));
    };

    const setOffline = () => {
        if (isOfflineForDatabase) return;
        isOfflineForDatabase = true;
        updateDoc(userStatusRef, {
            status: "offline",
            lastSeen: serverTimestamp(),
        }).catch((err) => console.warn("Presence: Failed to set offline (network issue?):", err.code));
    };

    setOnline(); 

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            // setOffline(); // Or "away"
        } else {
            setOnline();
        }
    };
    
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', setOffline);


    return () => {
        window.removeEventListener('online', setOnline);
        window.removeEventListener('offline', setOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', setOffline);
        if (!isOfflineForDatabase) { 
            setOffline();
        }
    };
};


const getFileInfoFromUrl = (fileURL?: string): { fileType: 'image' | 'audio' | 'video' | 'file', fileName: string } => {
    if (!fileURL) return { fileType: 'file', fileName: 'file' };
    
    let fileName = 'file';
    let fileType: 'image' | 'audio' | 'video' | 'file' = 'file';

    try {
        const url = new URL(fileURL);
        const path = decodeURIComponent(url.pathname);
        const fullStorageFileName = path.substring(path.lastIndexOf('/') + 1);
        
        const underscoreIndex = fullStorageFileName.indexOf('_');
        if (underscoreIndex > 0 && /^\d{13,}$/.test(fullStorageFileName.substring(0, underscoreIndex))) {
            fileName = fullStorageFileName.substring(underscoreIndex + 1);
        } else {
            fileName = fullStorageFileName;
        }

        const extension = (fileName.includes('.') ? fileName.split('.').pop() : '')?.toLowerCase();

        if (extension) {
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) fileType = 'image';
            else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'opus'].includes(extension)) fileType = 'audio';
            else if (['mp4', 'mov', 'avi', 'mkv', 'flv', 'ogv'].includes(extension)) fileType = 'video';
        }
    } catch (e) {
        console.warn("Could not parse file URL for info:", fileURL, e);
        fileName = fileURL.substring(fileURL.lastIndexOf('/') + 1).split('?')[0];
        if (fileName.length > 30) fileName = fileName.substring(0,27) + "...";
    }
    return { fileType, fileName: fileName || 'attachment' };
};

// --- (listenToChatsRealtime, listenToMessagesRealtime, listenToFriendRequests - UNCHANGED) ---
export const listenToChatsRealtime = (userId: string, callback: (chats: any[]) => void): (() => void) => {
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("members", "array-contains", userId), orderBy("updatedAt", "desc"));
    const userProfileCache = new Map<string, any>();

    const fetchUserProfile = async (uid: string) => {
        if (userProfileCache.has(uid)) return userProfileCache.get(uid);
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const profile = { id: uid, ...userDoc.data() };
                userProfileCache.set(uid, profile);
                return profile;
            }
        } catch (error) { console.error(`Error fetching profile for ${uid}:`, error); }
        userProfileCache.set(uid, { name: 'User', photoURL: null }); // Fallback
        return userProfileCache.get(uid);
    };

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const chatListPromises = snapshot.docs.map(async (docSnap) => {
            const chatData = docSnap.data();
            const chat = { id: docSnap.id, ...chatData };
            if (!chat.isGroup && chat.members.length === 2) {
                const otherUserId = chat.members.find((id: string) => id !== userId);
                if (otherUserId) {
                    const otherProfile = await fetchUserProfile(otherUserId);
                    chat.name = otherProfile?.name || otherProfile?.displayName || chat.memberDetails?.[otherUserId]?.name || 'User';
                    chat.photoURL = chat.photoURL || otherProfile?.photoURL; 
                }
            } else if (chat.isGroup) {
                 chat.name = chat.name || "Group Chat";
            }
            if (chat.updatedAt?.toDate) chat.updatedAt = chat.updatedAt.toDate();
            return chat;
        });
        const resolvedChats = await Promise.all(chatListPromises);
        callback(resolvedChats);
    }, (error) => {
        console.error("Error listening to chats:", error);
        callback([]);
    });
    return unsubscribe;
};

export const listenToMessagesRealtime = (chatId: string, callback: (messages: any[]) => void): (() => void) => {
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(100)); 
    const userProfileCache = new Map<string, any>();

    const fetchUserProfile = async (uid: string) => {
        if (userProfileCache.has(uid)) return userProfileCache.get(uid);
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const profile = { id: uid, ...userDoc.data() };
                userProfileCache.set(uid, profile);
                return profile;
            }
        } catch (error) { console.error(`Error fetching profile for message sender ${uid}:`, error); }
        userProfileCache.set(uid, { name: 'User', photoURL: null });
        return userProfileCache.get(uid);
    };

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const messagePromises = snapshot.docs.map(async (docSnap) => {
            const msgData = { id: docSnap.id, ...docSnap.data() };
            if (msgData.senderId && msgData.senderId !== "AI_ASSISTANT_ID") {
                if (!msgData.senderName || !msgData.senderPhotoURL) {
                    const senderProfile = await fetchUserProfile(msgData.senderId);
                    msgData.senderName = msgData.senderName || senderProfile?.name || senderProfile?.displayName || 'User';
                    msgData.senderPhotoURL = msgData.senderPhotoURL || senderProfile?.photoURL;
                }
            } else if (msgData.senderId === "AI_ASSISTANT_ID") {
                msgData.senderName = "AI Assistant";
            }

            if (msgData.fileURL && (!msgData.fileType || !msgData.fileName)) {
                const { fileType, fileName } = getFileInfoFromUrl(msgData.fileURL);
                msgData.fileType = msgData.fileType || fileType; 
                msgData.fileName = msgData.fileName || fileName;
            }
            if (msgData.timestamp?.toDate) msgData.timestamp = msgData.timestamp.toDate();
            return msgData;
        });
        const resolvedMessages = await Promise.all(messagePromises);
        callback(resolvedMessages);
    }, (error) => {
        console.error(`Error listening to messages for chat ${chatId}:`, error);
        callback([]);
    });
    return unsubscribe;
};

export const listenToFriendRequests = (userId: string, callback: (requests: any[]) => void): (() => void) => {
    const friendReqRef = collection(db, "friendRequests");
    const q = query(friendReqRef, where("toUserId", "==", userId), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    const userProfileCache = new Map<string, any>(); 

    const fetchUserProfile = async (uid: string) => {
        if (userProfileCache.has(uid)) return userProfileCache.get(uid);
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const profile = { id: uid, ...userDoc.data() };
                userProfileCache.set(uid, profile);
                return profile;
            }
        } catch (error) { console.error(`Error fetching profile for friend request sender ${uid}:`, error); }
        userProfileCache.set(uid, { name: 'Unknown User', photoURL: null });
        return userProfileCache.get(uid);
    };

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const requestPromises = snapshot.docs.map(async (docSnap) => {
            const reqData = { id: docSnap.id, ...docSnap.data() };
            if (reqData.fromUserId && (!reqData.fromUserName || !reqData.fromUserPhotoURL)) {
                const senderProfile = await fetchUserProfile(reqData.fromUserId);
                reqData.fromUserName = reqData.fromUserName || senderProfile?.name || senderProfile?.displayName || 'Unknown User';
                reqData.fromUserPhotoURL = reqData.fromUserPhotoURL || senderProfile?.photoURL;
            }
            return reqData;
        });
        const resolvedRequests = await Promise.all(requestPromises);
        callback(resolvedRequests);
    }, (error) => {
        console.error("Error listening to friend requests:", error);
        callback([]);
    });
    return unsubscribe;
};

// --- (sendFriendRequest, acceptFriendRequest, rejectFriendRequest - UNCHANGED) ---
export const sendFriendRequest = async (fromUserId: string, friendEmail: string): Promise<void> => {
  if (!friendEmail || !fromUserId) throw new Error("User ID and friend email are required.");
  const trimmedEmail = friendEmail.trim().toLowerCase();
  if (!trimmedEmail) throw new Error("Invalid friend email.");

  const usersRef = collection(db, "users");
  const qUser = query(usersRef, where("email", "==", trimmedEmail));
  const userSnap = await getDocs(qUser);

  if (userSnap.empty) throw new Error(`No user found with email: ${trimmedEmail}.`);
  const toUserDoc = userSnap.docs[0];
  const toUserId = toUserDoc.id;
  const toUserData = toUserDoc.data();

  if (toUserId === fromUserId) throw new Error("You cannot send a friend request to yourself.");

  const membersSortedForChatCheck = [fromUserId, toUserId].sort();
  const chatsRef = collection(db, "chats");
  const qDirectChat = query(chatsRef, where("isGroup", "==", false), where("members", "==", membersSortedForChatCheck));
  const existingChatsSnap = await getDocs(qDirectChat);
  if (!existingChatsSnap.empty) throw new Error(`You are already friends with ${toUserData?.name || toUserData?.displayName || trimmedEmail}.`);

  const friendReqRef = collection(db, "friendRequests");
  const qExistingReq = query(friendReqRef, 
    where("status", "==", "pending"),
    where("participants", "in", [[fromUserId, toUserId].sort(), [toUserId, fromUserId].sort()])
  );

  const existingReqSnap = await getDocs(qExistingReq);
  if (!existingReqSnap.empty) {
    const existingReqData = existingReqSnap.docs[0].data();
    if (existingReqData.fromUserId === fromUserId) throw new Error(`You already sent a pending request to ${toUserData?.name || toUserData?.displayName || trimmedEmail}.`);
    else throw new Error(`${toUserData?.name || toUserData?.displayName || trimmedEmail} has already sent you a pending request. Check your requests.`);
  }
  
  const fromUserSnap = await getDoc(doc(db, "users", fromUserId));
  const fromUserData = fromUserSnap.exists() ? fromUserSnap.data() : null;

  await addDoc(collection(db, "friendRequests"), {
    fromUserId,
    fromUserName: fromUserData?.name || fromUserData?.displayName || "A user",
    fromUserPhotoURL: fromUserData?.photoURL || null,
    toUserId,
    toUserName: toUserData?.name || toUserData?.displayName || "A user", 
    toUserPhotoURL: toUserData?.photoURL || null,
    status: "pending",
    participants: [fromUserId, toUserId].sort(), 
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const acceptFriendRequest = async (requestId: string, accepterUserId: string): Promise<void> => {
  const reqRef = doc(db, "friendRequests", requestId);
  await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error("Friend request not found or already handled.");
      
      const requestData = reqSnap.data();
      if (requestData.toUserId !== accepterUserId) throw new Error("This request is not for you.");
      if (requestData.status !== "pending") {
          if (requestData.status === 'accepted' || requestData.status === 'rejected') {
              transaction.delete(reqRef); 
          }
          throw new Error(`Request already ${requestData.status}.`);
      }

      const senderUserId = requestData.fromUserId;
      
      // Fetch user profiles within the transaction
      const fromUserDocSnap = await transaction.get(doc(db, "users", senderUserId));
      const toUserDocSnap = await transaction.get(doc(db, "users", accepterUserId));

      if (!fromUserDocSnap.exists() || !toUserDocSnap.exists()) {
          throw new Error("One or both user profiles not found.");
      }
      const fromUserData = fromUserDocSnap.data();
      const toUserData = toUserDocSnap.data();
      
      transaction.update(reqRef, { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });

      const members = [senderUserId, accepterUserId].sort();
      const newChatDocRef = doc(collection(db, "chats"));
      transaction.set(newChatDocRef, {
          members: members,
          memberDetails: { 
              [senderUserId]: { name: fromUserData?.name || fromUserData?.displayName || 'User', photoURL: fromUserData?.photoURL || null },
              [accepterUserId]: { name: toUserData?.name || toUserData?.displayName || 'User', photoURL: toUserData?.photoURL || null },
          },
          isGroup: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: "You are now friends!",
          lastMessageSenderId: null, 
          lastMessageTimestamp: serverTimestamp(),
      });
  });
};

export const rejectFriendRequest = async (requestId: string, rejecterUserId: string): Promise<void> => {
  const reqRef = doc(db, "friendRequests", requestId);
  await runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Friend request not found or already handled.");
    const requestData = reqSnap.data();

    if (requestData.toUserId !== rejecterUserId && requestData.fromUserId !== rejecterUserId) {
        throw new Error("You are not part of this friend request.");
    }
    if (requestData.status !== "pending") {
        if (requestData.status === 'accepted' || requestData.status === 'rejected') {
           transaction.delete(reqRef); 
        }
        throw new Error(`Request already ${requestData.status}.`);
    }
    transaction.delete(reqRef);
  });
};

// --- (createGroupChat, renameChat, updateGroupChatPhoto, leaveGroupChat, unfriendUser - UNCHANGED) ---
export const createGroupChat = async (groupName: string, emails: string[], ownerId: string): Promise<string> => {
  const trimmedName = groupName.trim();
  if (!trimmedName) throw new Error("Group name cannot be empty.");
  if (!ownerId) throw new Error("Owner ID is required.");

  const uniqueEmails = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))];
  
  const usersRef = collection(db, "users");
  const memberIds: string[] = [ownerId];
  const memberDetails: Record<string, { name: string; photoURL?: string | null }> = {};

  const ownerDoc = await getDoc(doc(db, "users", ownerId));
  if (!ownerDoc.exists()) throw new Error("Owner profile not found.");
  const ownerData = ownerDoc.data();
  memberDetails[ownerId] = { name: ownerData.name || ownerData.displayName || ownerData.email || 'Owner', photoURL: ownerData.photoURL || null };

  for (const email of uniqueEmails) {
    const q = query(usersRef, where("email", "==", email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const userId = userDoc.id;
        if (userId !== ownerId && !memberIds.includes(userId)) { 
            memberIds.push(userId);
            const userData = userDoc.data();
            memberDetails[userId] = { name: userData.name || userData.displayName || userData.email || 'Member', photoURL: userData.photoURL || null };
        }
    } else {
        console.warn(`No user found for email: ${email}. Skipping.`);
    }
  }

  if (memberIds.length < 2) { 
      throw new Error("A group chat needs at least one other member besides yourself.");
  }

  const chatsRef = collection(db, "chats");
  const newChatRef = await addDoc(chatsRef, {
    name: trimmedName,
    members: memberIds,
    memberDetails: memberDetails, 
    isGroup: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: ownerId,
    lastMessage: `${memberDetails[ownerId]?.name || 'Owner'} created the group.`,
    photoURL: null, 
    admins: [ownerId], 
  });
  return newChatRef.id;
};

export const renameChat = async (chatId: string, newName: string, userId: string): Promise<void> => {
  const trimmedName = newName.trim();
  if (!trimmedName) throw new Error("New name cannot be empty.");
  const chatRef = doc(db, "chats", chatId);
  
  await runTransaction(db, async (transaction) => {
    const chatSnap = await transaction.get(chatRef);
    if (!chatSnap.exists()) throw new Error("Chat not found.");
    const chatData = chatSnap.data();
    if (!chatData.isGroup) throw new Error("Only group chats can be renamed.");
    if (!chatData.admins?.includes(userId) && chatData.createdBy !== userId) throw new Error("You don't have permission to rename this group.");
    transaction.update(chatRef, { name: trimmedName, updatedAt: serverTimestamp() });
  });
};

export const updateGroupChatPhoto = async (chatId: string, file: File, userId: string): Promise<string> => {
    if (!chatId || !file) throw new Error("Chat ID and file are required.");
    if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed for group photos.");
    if (file.size > 5 * 1024 * 1024) throw new Error("File size should not exceed 5MB.");

    const chatRef = doc(db, "chats", chatId);
    await runTransaction(db, async (transaction) => {
        const chatSnap = await transaction.get(chatRef);
        if (!chatSnap.exists()) throw new Error("Chat not found.");
        const chatData = chatSnap.data();
        if (!chatData.isGroup) throw new Error("Cannot set photo for a direct chat.");
        if (!chatData.admins?.includes(userId) && chatData.createdBy !== userId && !chatData.members?.includes(userId)) {
             throw new Error("You don't have permission to change this group's photo.");
        }
    });

    const filePath = `group_photos/${chatId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const fileRef = ref(storage, filePath);
    
    const uploadTask = uploadBytesResumable(fileRef, file);
    await uploadTask; 
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
    
    await updateDoc(chatRef, { photoURL: downloadURL, updatedAt: serverTimestamp() });
    return downloadURL;
};

export const leaveGroupChat = async (chatId: string, userId: string): Promise<void> => {
  const chatRef = doc(db, "chats", chatId);
  await runTransaction(db, async (transaction) => {
      const chatSnap = await transaction.get(chatRef);
      if (!chatSnap.exists()) throw new Error("Chat not found.");
      const chatData = chatSnap.data();
      if (!chatData.isGroup) throw new Error("Cannot leave a direct chat.");
      if (!chatData.members?.includes(userId)) throw new Error("You are not a member of this group.");

      const userName = chatData.memberDetails?.[userId]?.name || 'A user';
      
      const updatePayload: any = {
          members: arrayRemove(userId), 
          [`memberDetails.${userId}`]: firestoreDeleteField(),
          updatedAt: serverTimestamp(),
          lastMessage: `${userName} left the group.`,
      };

      if (chatData.admins?.includes(userId)) {
          updatePayload.admins = arrayRemove(userId);
      }
      
      const updatedMembers = chatData.members.filter((memberId: string) => memberId !== userId);
      
      if (updatedMembers.length === 0) {
          transaction.delete(chatRef);
      } else {
        transaction.update(chatRef, updatePayload);
        if (chatData.admins?.includes(userId) && updatedMembers.length > 0 && (chatData.admins?.length === 1 || chatData.admins?.every((adminId:string) => adminId === userId) )) {
            let newAdmin = chatData.createdBy && updatedMembers.includes(chatData.createdBy) ? chatData.createdBy : updatedMembers[0];
            if (newAdmin && !updatePayload.admins?.includes(newAdmin) ) { // ensure newAdmin isn't already set by arrayRemove if multiple admins were leaving
                transaction.update(chatRef, { admins: arrayUnion(newAdmin) }); // Use arrayUnion to be safe
            }
        }
      }
  });
};

export const unfriendUser = async (currentUserId: string, friendIdToRemove: string): Promise<void> => {
    if (!currentUserId || !friendIdToRemove) throw new Error("Both user IDs are required.");
    if (currentUserId === friendIdToRemove) throw new Error("Cannot unfriend yourself.");

    const membersSorted = [currentUserId, friendIdToRemove].sort();
    const chatsRef = collection(db, "chats");
    const qChat = query(chatsRef, where("isGroup", "==", false), where("members", "==", membersSorted));
    const batch = writeBatch(db);

    const chatSnap = await getDocs(qChat);
    if (!chatSnap.empty) {
        const chatDoc = chatSnap.docs[0];
        // Note: Deleting a document does not delete its subcollections.
        // Messages would need to be deleted manually or via a Cloud Function.
        // For simplicity here, we only delete the chat document.
        batch.delete(chatDoc.ref); 
    } else {
        console.warn("No direct chat found to delete for unfriend operation.");
    }

    const reqRef = collection(db, "friendRequests");
    const qReq = query(reqRef, where("participants", "in", [membersSorted, [friendIdToRemove, currentUserId].sort()]));
    const reqSnap = await getDocs(qReq);
    reqSnap.forEach(docSnap => batch.delete(docSnap.ref));
    
    await batch.commit();
};


export const deleteMessage = async (chatId: string, messageId: string, userId: string): Promise<void> => {
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    const chatRef = doc(db, "chats", chatId);
    let fileURLToDelete: string | null = null;
    let messageWasLastInChat = false;

    // Transaction for deleting message and checking if it was the last one
    await runTransaction(db, async (transaction) => {
        // --- READS FIRST ---
        const messageSnap = await transaction.get(messageRef);
        if (!messageSnap.exists()) {
            // Message might have already been deleted, or ID is wrong.
            console.warn("DeleteMessage: Message not found, possibly already deleted.");
            return; // Exit transaction gracefully if message doesn't exist
        }
        const messageData = messageSnap.data();

        const chatSnap = await transaction.get(chatRef); // Read chat doc
        if (!chatSnap.exists()) {
            throw new Error("DeleteMessage: Chat document not found.");
        }
        const chatData = chatSnap.data();

        // --- PERMISSION CHECK ---
        if (messageData.senderId !== userId) {
            // More complex admin deletion rules could go here
            // if (!chatData.isGroup || !chatData.admins?.includes(userId)) {
            throw new Error("You can only delete your own messages.");
            // }
        }
        
        // --- WRITES LAST ---
        if (messageData.fileURL) {
            fileURLToDelete = messageData.fileURL; // Store for deletion outside transaction
        }
        transaction.delete(messageRef); // Delete the message document

        if (chatData.lastMessageId === messageId) {
            messageWasLastInChat = true;
            // Temporarily update last message; will be refined outside transaction
            transaction.update(chatRef, {
                lastMessage: "Message deleted",
                lastMessageId: null, 
                lastMessageSenderId: null,
                lastMessageTimestamp: serverTimestamp(), // Or a specific placeholder
                updatedAt: serverTimestamp(),
            });
        }
    });

    // File deletion from Storage (outside transaction)
    if (fileURLToDelete) {
        try {
            const fileStorageRef = ref(storage, fileURLToDelete);
            await deleteObject(fileStorageRef);
        } catch (error: any) {
             if (error.code === 'storage/object-not-found') {
                console.warn(`File not found in storage during delete: ${fileURLToDelete}`);
             } else {
                console.error("Error deleting file from storage:", error);
             }
        }
    }
    
    // If the deleted message was the last one, fetch the new last message (outside transaction)
    if (messageWasLastInChat) {
        try {
            const messagesQuery = query(
                collection(db, "chats", chatId, "messages"),
                orderBy("timestamp", "desc"),
                limit(1)
            );
            const lastMsgSnap = await getDocs(messagesQuery);
            
            let newLastMessageText = "Chat is empty or first message deleted.";
            let newLastMessageId = null;
            let newLastMessageSenderId = null;
            let newLastMessageTimestamp: any = serverTimestamp(); // Default to now

            const chatDocForTimestamp = await getDoc(chatRef); // get current chat data for createdAt
            if(chatDocForTimestamp.exists()) newLastMessageTimestamp = chatDocForTimestamp.data().createdAt || serverTimestamp();


            if (!lastMsgSnap.empty) {
                const lastMsgDoc = lastMsgSnap.docs[0];
                const lastMsgData = lastMsgDoc.data();
                const fileInfo = getFileInfoFromUrl(lastMsgData.fileURL);
                
                newLastMessageText = lastMsgData.text 
                    ? (lastMsgData.text.length > 50 ? lastMsgData.text.substring(0,47) + "..." : lastMsgData.text)
                    : (lastMsgData.fileURL ? `Sent ${fileInfo.fileType === 'file' ? (fileInfo.fileName || 'a file') : `a ${fileInfo.fileType}`}` : "Interaction");
                newLastMessageId = lastMsgDoc.id;
                newLastMessageSenderId = lastMsgData.senderId;
                newLastMessageTimestamp = lastMsgData.timestamp; // This will be a Firestore Timestamp from the message
            }
            
            await updateDoc(chatRef, {
                lastMessage: newLastMessageText,
                lastMessageId: newLastMessageId,
                lastMessageSenderId: newLastMessageSenderId,
                lastMessageTimestamp: newLastMessageTimestamp, 
                updatedAt: serverTimestamp() // Always update this
            });
        } catch (error) {
            console.error("Error updating chat with new last message after deletion:", error);
        }
    }
};

// --- (sendMessage, uploadChatFile, setTypingIndicator, listenToTypingIndicators - UNCHANGED) ---
export const sendMessage = async (
    chatId: string,
    text: string,
    senderId: string,
    fileURL?: string,
    fileType?: 'image' | 'audio' | 'video' | 'file', 
    fileName?: string,
    aiResponseTo?: string // ID of user's message if this is an AI response
): Promise<void> => {
    if (!chatId || !senderId) throw new Error("Chat ID and Sender ID are required.");
    const trimmedText = text.trim();
    if (!trimmedText && !fileURL) {
        console.log("Attempted to send an empty message.");
        return; 
    }

    let senderName = 'User';
    let senderPhotoURL: string | null = null;

    if (senderId !== "AI_ASSISTANT_ID") {
        const senderDoc = await getDoc(doc(db, "users", senderId));
        if (senderDoc.exists()) {
            const d = senderDoc.data();
            senderName = d.name || d.displayName || d.email || 'User';
            senderPhotoURL = d.photoURL || null;
        }
    } else {
        senderName = "AI Assistant";
    }

    const messagesRef = collection(db, "chats", chatId, "messages");
    const chatRef = doc(db, "chats", chatId);
    const currentTimestamp = serverTimestamp(); 

    const messageData: any = {
        text: trimmedText,
        senderId,
        senderName, 
        senderPhotoURL, 
        timestamp: currentTimestamp,
        reactions: {},
    };

    if (fileURL) {
        messageData.fileURL = fileURL;
        const derivedInfo = getFileInfoFromUrl(fileURL); 
        messageData.fileType = fileType || derivedInfo.fileType;
        messageData.fileName = fileName || derivedInfo.fileName;
    }
    if (aiResponseTo && senderId === "AI_ASSISTANT_ID") { // Only AI Assistant can have aiResponseTo
        messageData.aiResponseTo = aiResponseTo;
    }

    const batch = writeBatch(db);
    const newMessageRef = doc(messagesRef); 
    batch.set(newMessageRef, messageData);

    let lastMessageText = trimmedText;
    if (!lastMessageText && fileURL) { 
        const type = fileType || getFileInfoFromUrl(fileURL).fileType;
        const name = fileName || getFileInfoFromUrl(fileURL).fileName;
        lastMessageText = `Sent ${type === 'file' ? (name || 'a file') : `a ${type}`}`;
    }
    if (lastMessageText.length > 70) { 
        lastMessageText = lastMessageText.substring(0, 67) + "...";
    }

    batch.update(chatRef, {
        lastMessage: lastMessageText,
        lastMessageId: newMessageRef.id,
        lastMessageSenderId: senderId,
        lastMessageTimestamp: currentTimestamp, 
        updatedAt: currentTimestamp, 
    });
    await batch.commit();
};

export const uploadChatFile = (
  chatId: string,
  file: File,
  onProgress: (progress: number) => void,
): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!chatId || !file) {
            return reject(new Error("Chat ID and file are required for upload."));
        }
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `chat_files/${chatId}/${Date.now()}_${sanitizedFileName}`;
        const fileRef = ref(storage, filePath);
        
        const metadata = { contentType: file.type }; 
        const uploadTask: UploadTask = uploadBytesResumable(fileRef, file, metadata);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress(Math.round(progress));
            },
            (error) => {
                console.error("File upload error in 'uploadChatFile':", error);
                let userFriendlyError = `Failed to upload file: ${error.message || "Unknown error"}`;
                switch (error.code) {
                    case 'storage/unauthorized': 
                        userFriendlyError = "Permission denied. Please check storage rules or authentication.";
                        break;
                    case 'storage/canceled': 
                        userFriendlyError = "Upload canceled by the user.";
                        break;
                    case 'storage/unknown':
                        userFriendlyError = "An unknown error occurred during upload. Please try again.";
                        break;
                     case 'storage/quota-exceeded':
                        userFriendlyError = "Storage quota exceeded. Cannot upload file.";
                        break;
                    case 'storage/object-not-found': 
                        userFriendlyError = "File path not found on server. (Upload error)";
                        break;
                }
                reject(new Error(userFriendlyError));
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                } catch (error) {
                    console.error("Error getting download URL after successful upload:", error);
                    reject(new Error("Upload succeeded, but failed to get file URL."));
                }
            }
        );
    });
};

const typingTimeouts = new Map<string, NodeJS.Timeout>();
export const setTypingIndicator = (chatId: string, userId: string, isTyping: boolean, userName?: string): void => {
    if (!chatId || !userId) return;
    const typingRef = doc(db, "chats", chatId, "typing", userId);
    const timeoutKey = `${chatId}-${userId}`;

    if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey)!);
        typingTimeouts.delete(timeoutKey);
    }

    if (isTyping) {
        const nameToDisplay = userName && userName.trim() !== "" ? userName : 'Someone';
        setDoc(typingRef, { name: nameToDisplay, timestamp: serverTimestamp() }, { merge: true })
          .catch(err => console.warn("Error setting typing indicator:", err.message));
        
        const timeoutId = setTimeout(() => {
            deleteDoc(typingRef).catch(err => console.warn("Error deleting typing indicator (timeout):", err.message));
            typingTimeouts.delete(timeoutKey);
        }, 4000); 
        typingTimeouts.set(timeoutKey, timeoutId);
    } else {
        deleteDoc(typingRef).catch(err => console.warn("Error deleting typing indicator (explicit stop):", err.message));
    }
};

export const listenToTypingIndicators = (
    chatId: string,
    currentUserId: string,
    callback: (typingUsers: Record<string, { name: string }>) => void
): (() => void) => {
    const typingRef = collection(db, "chats", chatId, "typing");
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
        const now = Date.now();
        const activeTypingUsers: Record<string, { name: string }> = {};
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const userId = docSnap.id;
            if (userId === currentUserId) return; 

            const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : (typeof data.timestamp === 'number' ? data.timestamp : 0);
            
            if (timestamp && (now - timestamp < 5000)) { 
                activeTypingUsers[userId] = { name: data.name || 'Someone' };
            } else {
                deleteDoc(doc(db, "chats", chatId, "typing", userId))
                  .catch(err => console.warn("Error deleting stale typing indicator:", err.message));
            }
        });
        callback(activeTypingUsers);
    }, (error) => {
        console.error(`Error listening to typing indicators for chat ${chatId}:`, error);
        callback({}); 
    });
    return unsubscribe;
};

// --- (addReactionToMessage, removeReactionFromMessage, getUserProfile, getChatMembersProfiles, getUserFriends, getOtherUserId - UNCHANGED) ---
export const addReactionToMessage = async (chatId: string, messageId: string, userId: string, emoji: string): Promise<void> => {
    if (!chatId || !messageId || !userId || !emoji) throw new Error("Missing parameters for reaction.");
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    try {
        await updateDoc(messageRef, {
            [`reactions.${userId}`]: emoji
        });
    } catch (error) {
        console.error("Error adding reaction:", error);
        throw error; 
    }
};

export const removeReactionFromMessage = async (chatId: string, messageId: string, userId: string): Promise<void> => {
    if (!chatId || !messageId || !userId) throw new Error("Missing parameters for removing reaction.");
    const messageRef = doc(db, "chats", chatId, "messages", messageId);
    try {
        await updateDoc(messageRef, {
            [`reactions.${userId}`]: firestoreDeleteField() 
        });
    } catch (error) {
        console.error("Error removing reaction:", error);
        throw error; 
    }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!userId) return null;
  try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        return { 
            id: userId,
            name: data.name || data.displayName,
            displayName: data.displayName,
            email: data.email,
            photoURL: data.photoURL,
            status: data.status || 'offline',
            lastSeen: data.lastSeen?.toDate ? data.lastSeen.toDate() : data.lastSeen,
         };
      }
      return null;
  } catch (error) {
      console.error(`Error fetching user profile for ${userId}:`, error);
      return null;
  }
};

export const getChatMembersProfiles = async (memberIds: string[]): Promise<UserProfile[]> => {
  const uniqueIds = [...new Set(memberIds)].filter(Boolean);
  if (uniqueIds.length === 0) return [];
  
  const profiles: UserProfile[] = [];
  const usersRef = collection(db, "users");
  const chunkSize = 30; 

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      try {
          const q = query(usersRef, where("__name__", "in", chunk));
          const snapshot = await getDocs(q);
          snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              profiles.push({
                  id: docSnap.id,
                  name: data.name || data.displayName, 
                  displayName: data.displayName,
                  email: data.email, 
                  photoURL: data.photoURL,
                  status: data.status || 'offline', 
                  lastSeen: data.lastSeen?.toDate ? data.lastSeen.toDate() : data.lastSeen,
              });
          });
      } catch (error) { console.error("Error fetching member profiles chunk:", error); }
  }
  return profiles;
};

export const getUserFriends = async (userId: string): Promise<UserProfile[]> => {
    if (!userId) return [];
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("members", "array-contains", userId), where("isGroup", "==", false));
    
    const friendIdsFromChats: string[] = [];
    try {
        const chatsSnap = await getDocs(q);
        chatsSnap.forEach((chatDoc) => {
            const chatData = chatDoc.data();
            if (chatData.members && chatData.members.length === 2) {
                const friendId = chatData.members.find((id: string) => id !== userId);
                if (friendId && !friendIdsFromChats.includes(friendId)) {
                    friendIdsFromChats.push(friendId);
                }
            }
        });
    } catch (error) {
        console.error("Error fetching user chats to determine friends:", error);
        return []; 
    }

    if (friendIdsFromChats.length === 0) return [];
    
    try {
        return await getChatMembersProfiles(friendIdsFromChats);
    } catch (error) {
        console.error("Error fetching friend profiles:", error);
        return [];
    }
};

export const getOtherUserId = (chat: { members: string[], isGroup: boolean }, currentUserId: string): string | null => {
    if (!chat || chat.isGroup || !chat.members || chat.members.length !== 2) return null;
    return chat.members.find(id => id !== currentUserId) || null;
};
