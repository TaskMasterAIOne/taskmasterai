import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface PartnerApplicationData {
  name: string;
  email: string;
  tiktokHandle: string;
  instagramHandle?: string;
  creatorCode: string;
  whyPartner: string;
  referral?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export async function savePartnerApplication(data: Omit<PartnerApplicationData, 'createdAt' | 'status'>): Promise<string> {
  try {
    const applicationsRef = collection(db, 'partnerApplications');
    const applicationData: PartnerApplicationData = {
      ...data,
      status: 'pending',
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(applicationsRef, applicationData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving partner application:', error);
    throw new Error('Failed to submit your application. Please try again.');
  }
}
