import React, { useEffect, useState } from 'react';
import { Folders } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { motion } from 'framer-motion';
import { auth } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

export function FoldersMaintenance() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userName, setUserName] = useState<string>("Learner");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setUserName(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Learner");
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <Sidebar
        userName={userName}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        userProfile={null}
      />

      {/* Main Content Area */}
      <div 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        } pt-14 md:pt-0`}
      >
        <div className="h-full flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-4xl"
          >
            <div className="text-center">
              {/* Icon and Title */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex items-center justify-center gap-3 mb-4"
              >
                <Folders className="w-8 h-8 text-[var(--text-primary)]" />
                <h1 className="text-4xl font-semibold text-[var(--text-primary)] font-[var(--font-heading)] whitespace-nowrap">
                  Folders Under Maintenance
                </h1>
              </motion.div>

              {/* Status Info */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mb-4"
              >
                <p className="text-xl text-[var(--text-muted)] font-[var(--font-body)] whitespace-nowrap">
                  <span className="font-semibold text-[var(--text-primary)]">Estimated Return:</span>{' '}
                  <span className="text-[var(--status-info)]">2-3 weeks</span>
                </p>
              </motion.div>


            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
