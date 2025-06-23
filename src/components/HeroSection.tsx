import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';

export function HeroSection() {
  const { user } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.18,
        delayChildren: 0.25,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-40 pb-32 bg-[#0A0B0F] overflow-hidden"> {/* Increased pt and pb */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-800/70 rounded-full filter blur-3xl opacity-25 animate-gentle-blob-slow"></div>
        <div className="absolute top-1/4 right-10 w-80 h-80 bg-indigo-800/70 rounded-full filter blur-3xl opacity-25 animate-gentle-blob-slow animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-pink-800/70 rounded-full filter blur-3xl opacity-25 animate-gentle-blob-slow animation-delay-4000"></div>
      </div>
      
      <div className="container mx-auto px-5 sm:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-x-16 gap-y-16 items-center"> {/* Increased gap-y */}
          <motion.div 
            className="text-center lg:text-left"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h1 
              className="text-5xl md:text-6xl lg:text-[4.25rem] font-extrabold mb-9 leading-tight tracking-tight" /* Increased mb, relaxed tracking */
              variants={itemVariants}
            >
              <span className="block text-white">Do More...</span>
              <span className="block bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Like, a Lot More.
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-lg md:text-xl text-gray-400 mb-14 max-w-xl mx-auto lg:mx-0" /* Increased mb */
              variants={itemVariants}
            >
              TaskMaster AI transforms any audio, video, or PDF into instant notes,
              flashcards, quizzes, and an interactive chatbot. For professionals and learners alike.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex justify-center lg:justify-start">
              <a 
                href={user ? "/dashboard" : "/signup"}
                className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full text-xl font-semibold shadow-xl hover:shadow-purple-500/60 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 transform hover:-translate-y-1"
              >
                {user ? "Go to Dashboard" : "Get Started - It's Free"}
              </a>
            </motion.div>
          </motion.div>

          <motion.div 
            className="relative mt-10 lg:mt-0"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
          >
            <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-indigo-600/80 via-purple-600/80 to-pink-600/80 opacity-20 blur-2xl"></div>
            <img 
              src="https://i.imgur.com/hG6wPqg.png"
              alt="TaskMaster AI Product Screenshot showing lecture recording" 
              className="relative rounded-2xl shadow-2xl border-2 border-gray-700/70 w-full"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}