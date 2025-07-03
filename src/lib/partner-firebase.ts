import { addDoc, collection, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
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

export interface ReferralApplicationData {
    name: string;
    email: string;
    tiktokHandle: string;
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

export async function saveReferral(referrerEmail: string, newApplicant: ReferralApplicationData): Promise<string> {
  const applicationsRef = collection(db, 'partnerApplications');
  
  const q = query(
    applicationsRef,
    where('email', '==', referrerEmail),
    where('status', '==', 'approved'),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    throw new Error('Referrer not found. Please check the email and try again.');
  }
  
  const referrerData = querySnapshot.docs[0].data() as PartnerApplicationData;

  const existingApplicantQuery = query(applicationsRef, where('email', '==', newApplicant.email), limit(1));
  const existingApplicantSnapshot = await getDocs(existingApplicantQuery);
  if (!existingApplicantSnapshot.empty) {
      throw new Error('This user has already applied to the partner program.');
  }

  const newApplicationData: Omit<PartnerApplicationData, 'createdAt' | 'status'> = {
    name: newApplicant.name,
    email: newApplicant.email,
    tiktokHandle: newApplicant.tiktokHandle,
    instagramHandle: '',
    creatorCode: '',
    whyPartner: `Referred by ${referrerData.name} (${referrerData.email})`,
    referral: referrerData.email,
  };

  return savePartnerApplication(newApplicationData);
}
