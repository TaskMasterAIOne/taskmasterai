import React from 'react';
import { motion } from 'framer-motion';
import { Youtube, Mic, FileText as FileTextIcon, BookOpen, Brain, MessageCircle, CheckCircle, Star, Zap, Edit3 } from 'lucide-react';
import { SectionSeparator } from '../App'; // Adjusted path to correctly point to App.tsx if it's in the parent 'src' directory

const universityLogos = [
  { name: "Oxford", src: "https://i.imgur.com/J7fB2zI.png", alt: "University of Oxford Logo" },
  { name: "MIT", src: "https://i.imgur.com/uSOwa2A.png", alt: "MIT Logo" },
  { name: "Texas", src: "https://i.imgur.com/sLDBNxa.png", alt: "University of Texas at Austin Logo" },
  { name: "Duke", src: "https://i.imgur.com/xIH7zT0.png", alt: "Duke University Logo" },
  { name: "Princeton", src: "https://i.imgur.com/g5s8hHk.png", alt: "Princeton University Logo" },
  { name: "Stanford", src: "https://i.imgur.com/4V3r8eA.png", alt: "Stanford University Logo" },
];

const testimonials = [
  {
    quote: "TaskMaster AI has revolutionized how I prepare for meetings. Transcribing and summarizing client calls saves me hours each week.",
    name: "Alex Chen",
    role: "Project Manager, Tech Solutions Inc.",
    avatar: "https://i.pravatar.cc/150?img=32",
    stars: 5,
  },
  {
    quote: "I can focus on understanding concepts, not just jotting down notes. It's like having a personal study assistant that's always available.",
    name: "Sheryl Berge",
    role: "Physics Major at MIT",
    avatar: "https://i.pravatar.cc/150?img=1",
    stars: 5,
  },
  {
    quote: "The flashcards are tailored to my learning style. It's like the AI knows exactly what I need to study. A real game-changer!",
    name: "Yash Sharma",
    role: "Public Policy Student at Duke",
    avatar: "https://i.pravatar.cc/150?img=5",
    stars: 5,
  },
];

const features = [
  {
    icon: <Edit3 className="w-8 h-8 text-indigo-400" />,
    title: "Rich Notes",
    description: "Our notes include tables, diagrams, emojis, equations, and markdown formatting for clarity.",
    illustration: (
        <div className="mt-5 p-4 bg-gray-800/70 rounded-xl border border-gray-700/90 text-sm shadow-inner">
          <code className="text-green-400 block text-center text-base font-mono">
            <span className="text-purple-400">∂u</span>/<span className="text-purple-400">∂t</span> + u ⋅ ∇u = -∇p + μ∇²u + f
          </code>
        </div>
      ),
  },
  {
    icon: <Zap className="w-8 h-8 text-purple-400" />,
    title: "Multimodality",
    description: "Create comprehensive notes instantly from any audio, video, or PDF document.",
    illustration: (
      <div className="mt-5 flex justify-around items-center space-x-4 py-2.5">
        <Youtube className="w-11 h-11 text-red-500/90 opacity-80 hover:opacity-100 transition-opacity duration-200 transform hover:scale-110" />
        <Mic className="w-11 h-11 text-blue-500/90 opacity-80 hover:opacity-100 transition-opacity duration-200 transform hover:scale-110" />
        <FileTextIcon className="w-11 h-11 text-purple-500/90 opacity-80 hover:opacity-100 transition-opacity duration-200 transform hover:scale-110" />
      </div>
    ),
  },
  {
    icon: <Brain className="w-8 h-8 text-pink-400" />,
    title: "Flashcards & Quizzes",
    description: "Reinforce your learning with AI-generated flashcards and quizzes tailored to your notes.",
    illustration: (
        <div className="mt-5 flex justify-around items-center space-x-4 py-2.5">
            <BookOpen className="w-11 h-11 text-yellow-500/90 opacity-80 hover:opacity-100 transition-opacity duration-200 transform hover:scale-110" />
            <CheckCircle className="w-11 h-11 text-green-500/90 opacity-80 hover:opacity-100 transition-opacity duration-200 transform hover:scale-110" />
        </div>
    ),
  },
  {
    icon: <MessageCircle className="w-8 h-8 text-teal-400" />,
    title: "AI Chatbot",
    description: "Chat with your uploaded content to get context-dependent answers and deepen understanding.",
    illustration: (
        <div className="mt-5 p-3 bg-gray-800/70 rounded-xl border border-gray-700/90 shadow-inner">
            <input type="text" placeholder="Ask your AI assistant..." className="w-full bg-gray-700/80 text-gray-200 placeholder-gray-500 px-4 py-3 rounded-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 border-transparent transition-all" />
        </div>
    ),
  },
];

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};

const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

function TrustedBySection() {
  return (
    <section id="trusted-by" className="pt-20 sm:pt-24 pb-10 sm:pb-12 bg-[#0A0B0F]">
      <div className="container mx-auto px-5 sm:px-6">
        <h2 className="text-center text-lg sm:text-xl font-medium text-gray-500 mb-12">
          Trusted by professionals and students at leading institutions
        </h2>
        <motion.div 
          className="flex flex-wrap justify-center items-center gap-x-12 gap-y-10 sm:gap-x-20"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
          {universityLogos.map((logo, index) => (
            <motion.div key={index} variants={itemVariants}>
              <img 
                src={logo.src} 
                alt={logo.alt} 
                className="h-7 sm:h-9 opacity-40 hover:opacity-75 transition-opacity duration-300"
                style={{ filter: 'grayscale(100%) contrast(0%) brightness(2.5)' }} 
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 sm:py-28 bg-[#0A0B0F]">
      <div className="container mx-auto px-5 sm:px-6">
        <motion.div 
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-5">
            Join <span className="bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">2,000,000+</span> Learners & Professionals
          </h2>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto">
            Discover how TaskMaster AI is transforming productivity and learning efficiency worldwide.
          </p>
        </motion.div>
        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="bg-gray-800/60 p-7 rounded-2xl border border-gray-700/90 shadow-xl flex flex-col hover:border-purple-500/50 transition-colors duration-300 transform hover:-translate-y-1"
            >
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-5 h-5 ${i < testimonial.stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
                ))}
              </div>
              <p className="text-gray-300 italic text-base leading-relaxed mb-7 flex-grow">"{testimonial.quote}"</p>
              <div className="flex items-center mt-auto pt-4 border-t border-gray-700/60">
                <img src={testimonial.avatar} alt={testimonial.name} className="w-12 h-12 rounded-full mr-4 border-2 border-purple-500/80"/>
                <div>
                  <h3 className="font-semibold text-white text-lg">{testimonial.name}</h3>
                  <p className="text-sm text-gray-400">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesGridSection() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-[#101116]">
      <div className="container mx-auto px-5 sm:px-6">
        <motion.div 
          className="text-center mb-16 sm:mb-20"
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-5">Everything You Need to Excel</h2>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto">
            TaskMaster AI offers a suite of powerful tools to streamline your workflow and boost your understanding.
          </p>
        </motion.div>
        <motion.div 
          className="grid md:grid-cols-2 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          {features.map((feature, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="bg-gray-800/60 p-8 rounded-2xl border border-gray-700/90 shadow-xl hover:border-purple-500/60 transition-all duration-300 group transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-5">
                <div className="p-4 rounded-full bg-gray-700/70 mr-5 group-hover:bg-purple-500/25 transition-colors duration-300">
                    {feature.icon}
                </div>
                <h3 className="text-2xl font-semibold text-white">{feature.title}</h3>
              </div>
              <p className="text-gray-400 text-base leading-relaxed mb-6">{feature.description}</p>
              {feature.illustration && <div className="min-h-[90px] flex items-center justify-center">{feature.illustration}</div>}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTASection() {
    return (
      <section className="py-0 bg-[#0A0B0F] relative overflow-hidden">
        <div className="container mx-auto px-5 sm:px-6 py-24 sm:py-32 relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <Zap className="w-14 h-14 text-indigo-400 mx-auto mb-8 p-3 bg-indigo-500/20 rounded-full border-2 border-indigo-500/50 shadow-lg" />
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-7 !leading-tight">
              Ready to Transform Your Productivity?
            </h2>
            <p className="text-xl text-gray-400 mb-12 max-w-xl mx-auto">
              Join thousands of professionals and learners simplifying their tasks and achieving more with TaskMaster AI.
            </p>
            <a
              href="/signup"
              className="inline-block px-12 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full text-xl font-semibold shadow-xl hover:shadow-purple-500/70 hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:-translate-y-1"
            >
              Get Started for Free Today
            </a>
          </motion.div>
        </div>
      </section>
    );
  }

export default function MainContent() {
  return (
    <>
      <TrustedBySection />
      <TestimonialsSection />
      <FeaturesGridSection />
      <SectionSeparator />
      <FinalCTASection />
    </>
  );
}