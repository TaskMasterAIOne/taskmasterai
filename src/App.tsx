import React, { useState, useEffect } from 'react';
import { Logo } from './components/Logo';
import { useAuth } from './contexts/AuthContext';
import { ChevronDown, Youtube, Mic, FileText as FileTextIcon, Edit, BookOpen, Brain, MessageCircle, CheckCircle, Star, Zap, Edit3, Globe, Sparkles, Image as ImageIcon, User, Palette, PenSquare, Trash2, BrainCircuit, DatabaseBackup } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

const universityLogos = [
  { name: "Oxford", src: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/oxford.svg?alt=media&token=712ed46d-5d02-4835-8b15-85941eb5db73", alt: "University of Oxford Logo" },
  { name: "MIT", src: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/mit.svg?alt=media&token=168b1ae1-e90e-46ac-bc58-feb8d46b852c", alt: "MIT Logo" },
  { name: "UT Austin", src: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/utaustin.svg?alt=media&token=988de05d-403d-47c6-9073-3da63aa3ce56", alt: "University of Texas at Austin Logo" },
  { name: "Duke", src: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/duke.svg?alt=media&token=57027fc4-51ab-48c4-ad4f-534bef685311", alt: "Duke University Logo" },
  { name: "Yale", src: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/yale.svg?alt=media&token=b4335183-5d2b-4c7f-83fe-e9d3437b7578", alt: "Yale University Logo" },
  { name: "Johns Hopkins", src: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/jhulogo.png?alt=media&token=f3dc5ef0-8b1c-4645-94dd-f10fdf8fe3bf", alt: "Johns Hopkins University Logo" },
  { name: "Rice", src: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ricelogo.png?alt=media&token=1247209e-9df6-492c-8129-1e9b6c1403c1", alt: "Rice University Logo" },
];

const testimonials = [
  {
    quote: "As a premed student juggling organic chemistry, biology, and physics, TaskMaster AI's study schedule optimizer has been revolutionary. It analyzes my learning patterns and creates personalized study blocks that maximized my retention. The flashcard system with spaced repetition algorithms helped me memorize complex biochemical pathways effortlessly. I scored in the 95th percentile on my MCAT, and I credit TaskMaster for making that possible",
    name: "Mohana Dayyam",
    role: "Premed Student, Rice University",
    avatar: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/ricelogo.png?alt=media&token=1247209e-9df6-492c-8129-1e9b6c1403c1",
    stars: 5,
  },
  {
    quote: "The collaborative study feature in TaskMaster AI completely changed my medical school preparation. I connected with classmates to share annotated lecture notes and created group study guides that synced automatically. The AI-powered question generator helped identify weak areas in my understanding before exams. My professors have commented on the notable improvement in my critical thinking skills since I started using TaskMaster for my studies.",
    name: "Hrishi Chintakuntla",
    role: "Premed Student, Johns Hopkins University",
    avatar: "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/jhulogo.png?alt=media&token=f3dc5ef0-8b1c-4645-94dd-f10fdf8fe3bf",
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
    title: "Chatbot",
    description: "Chat with your uploaded content to get context-dependent answers and deepen understanding.",
    illustration: (
        <div className="mt-5 p-3 bg-gray-800/70 rounded-xl border border-gray-700/90 shadow-inner">
            <input type="text" placeholder="Ask anything..." className="w-full bg-gray-700/80 text-gray-200 placeholder-gray-500 px-4 py-3 rounded-full text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 border-transparent transition-all" />
        </div>
    ),
  },
];

const NotionIcon = (props) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path className="fill-white dark:fill-white" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
  </svg>
);

const GoogleDriveIcon = (props) => (
  <svg viewBox="0 -13.5 256 256" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA" />
      <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335" />
      <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.673354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D" />
      <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC" />
      <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47" />
      <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00" />
    </g>
  </svg>
);

const GoogleCalendarIcon = (props) => (
  <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g>
      <polygon fill="#FFFFFF" points="195.368421 60.6315789 60.6315789 60.6315789 60.6315789 195.368421 195.368421 195.368421" />
      <polygon fill="#EA4335" points="195.368421 256 256 195.368421 225.684211 190.196005 195.368421 195.368421 189.835162 223.098002" />
      <path d="M1.42108547e-14,195.368421 L1.42108547e-14,235.789474 C1.42108547e-14,246.955789 9.04421053,256 20.2105263,256 L60.6315789,256 L66.8568645,225.684211 L60.6315789,195.368421 L27.5991874,190.196005 L1.42108547e-14,195.368421 Z" fill="#188038" />
      <path d="M256,60.6315789 L256,20.2105263 C256,9.04421053 246.955789,1.42108547e-14 235.789474,1.42108547e-14 L195.368421,1.42108547e-14 C191.679582,15.0358547 189.835162,26.1010948 189.835162,33.1957202 C189.835162,40.2903456 191.679582,49.4356319 195.368421,60.6315789 C208.777986,64.4714866 218.883249,66.3914404 225.684211,66.3914404 C232.485172,66.3914404 242.590435,64.4714866 256,60.6315789 Z" fill="#1967D2" />
      <polygon fill="#FBBC04" points="256 60.6315789 195.368421 60.6315789 195.368421 195.368421 256 195.368421" />
      <polygon fill="#34A853" points="195.368421 195.368421 60.6315789 195.368421 60.6315789 256 195.368421 256" />
      <path d="M195.368421,0 L20.2105263,0 C9.04421053,0 0,9.04421053 0,20.2105263 L0,195.368421 L60.6315789,195.368421 L60.6315789,60.6315789 L195.368421,60.6315789 L195.368421,0 Z" fill="#4285F4" />
      <path d="M88.2694737,165.153684 C83.2336842,161.751579 79.7473684,156.783158 77.8442105,150.214737 L89.5326316,145.397895 C90.5936842,149.44 92.4463158,152.572632 95.0905263,154.795789 C97.7178947,157.018947 100.917895,158.113684 104.656842,158.113684 C108.48,158.113684 111.764211,156.951579 114.509474,154.627368 C117.254737,152.303158 118.635789,149.338947 118.635789,145.751579 C118.635789,142.08 117.187368,139.082105 114.290526,136.757895 C111.393684,134.433684 107.755789,133.271579 103.410526,133.271579 L96.6568421,133.271579 L96.6568421,121.701053 L102.72,121.701053 C106.458947,121.701053 109.608421,120.690526 112.168421,118.669474 C114.728421,116.648421 116.008421,113.886316 116.008421,110.366316 C116.008421,107.233684 114.863158,104.741053 112.572632,102.871579 C110.282105,101.002105 107.385263,100.058947 103.865263,100.058947 C100.429474,100.058947 97.7010526,100.968421 95.68,102.804211 C93.6602819,104.644885 92.1418208,106.968942 91.2673684,109.557895 L79.6968421,104.741053 C81.2294737,100.395789 84.0421053,96.5557895 88.1684211,93.2378947 C92.2947368,89.92 97.5663158,88.2526316 103.966316,88.2526316 C108.698947,88.2526316 112.96,89.1621053 116.732632,90.9978947 C120.505263,92.8336842 123.469474,95.3768421 125.608421,98.6105263 C127.747368,101.861053 128.808421,105.498947 128.808421,109.541053 C128.808421,113.667368 127.814737,117.153684 125.827368,120.016842 C123.84,122.88 121.397895,125.069474 118.501053,126.602105 L118.501053,127.292632 C122.241568,128.834789 125.490747,131.367752 127.898947,134.618947 C130.341053,137.903158 131.570526,141.827368 131.570526,146.408421 C131.570526,150.989474 130.408421,155.082105 128.084211,158.669474 C125.76,162.256842 122.543158,165.086316 118.467368,167.141053 C114.374737,169.195789 109.776842,170.240124 104.673684,170.240124 C98.7621053,170.256842 93.3052632,168.555789 88.2694737,165.153684 L88.2694737,165.153684 Z M160.067368,107.149474 L147.233684,116.429474 L140.816842,106.694737 L163.84,90.0884211 L172.665263,90.0884211 L172.665263,168.421053 L160.067368,168.421053 L160.067368,107.149474 Z" fill="#4285F4" />
    </g>
  </svg>
);


function TrustedBySection() {
  const duplicatedLogos = [...universityLogos, ...universityLogos];

  return (
    <>
      <style>
        {`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-scrolling-logos {
            animation: scroll 15s linear infinite;
          }
          .scrolling-logos-container:hover .animate-scrolling-logos {
            animation-play-state: paused;
          }
        `}
      </style>
      <section id="trusted-by" className="pt-16 sm:pt-20 pb-10 sm:pb-12 bg-[#0C0E1A]">
        <div className="container mx-auto px-5 sm:px-6">
          <h2 className="text-center text-base sm:text-lg font-medium text-gray-500 mb-12">
            Trusted by students at leading institutions
          </h2>
          <div
            className="scrolling-logos-container w-full overflow-hidden"
            style={{ maskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)" }}
          >
            <div className="flex animate-scrolling-logos">
              {duplicatedLogos.map((logo, index) => (
                <div key={index} className="px-10 sm:px-14 flex-shrink-0 flex justify-center items-center h-12">
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className="h-7 sm:h-9 max-w-none opacity-60 hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 sm:py-28 bg-[#0C0E1A]">
      <div className="container mx-auto px-5 sm:px-6">
        <div 
          className="text-center mb-16 sm:mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5">
            Join <span className="text-white">2,000,000+</span> Learners & Professionals
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-4xl mx-auto">
            Discover how TaskMaster AI is transforming productivity and learning efficiency worldwide.
          </p>
        </div>
        <div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <div 
              key={index} 
              className="bg-[#12141D] p-7 rounded-2xl border border-gray-700/60 shadow-xl flex flex-col hover:border-purple-500/50 transition-colors duration-300 transform hover:-translate-y-1"
            >
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-5 h-5 ${i < testimonial.stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
                ))}
              </div>
              <p className="text-gray-300 italic text-base leading-relaxed mb-7 flex-grow">"{testimonial.quote}"</p>
              <div className="flex items-center mt-auto pt-4 border-t border-gray-700/60">
                <img src={testimonial.avatar} alt={testimonial.name} className="w-10 h-12 mr-3 "/>
                <div>
                  <h3 className="font-semibold text-white text-lg">{testimonial.name}</h3>
                  <p className="text-sm text-gray-400">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesGridSection() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-[#0C0E1A]">
      <div className="container mx-auto px-5 sm:px-6">
        <div 
          className="text-center mb-16 sm:mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5">Everything You Need to Excel</h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-5xl mx-auto">
            A suite of powerful tools to streamline your workflow and boost your understanding.
          </p>
        </div>
        <div 
          className="grid md:grid-cols-2 gap-8"
        >
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-[#12141D] p-8 rounded-2xl border border-gray-700/60 shadow-xl hover:border-purple-500/60 transition-all duration-300 group transform hover:-translate-y-1"
            >
              <div className="flex items-center mb-5">
                <div className="p-4 rounded-full bg-gray-700/70 mr-5 group-hover:bg-purple-500/25 transition-colors duration-300">
                    {feature.icon}
                </div>
                <h3 className="text-2xl font-semibold text-white">{feature.title}</h3>
              </div>
              <p className="text-gray-400 text-base leading-relaxed mb-6">{feature.description}</p>
              {feature.illustration && <div className="min-h-[90px] flex items-center justify-center">{feature.illustration}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LearningSuperchargedSection() {
    const FeatureShowcase = ({ icon, title, description, children, reverse = false }) => (
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center`}>
            <div className={`lg:col-span-1 ${reverse ? 'lg:order-last' : ''}`}>
                <div className="inline-flex items-center gap-3 mb-5">
                    <span className="flex items-center justify-center w-12 h-12 bg-gray-800/60 rounded-xl border border-gray-700/80">
                        {icon}
                    </span>
                    <h3 className="text-2xl md:text-3xl font-bold text-white">{title}</h3>
                </div>
                <p className="text-base md:text-lg text-gray-400 leading-relaxed">
                    {description}
                </p>
            </div>
            <div className="lg:col-span-1">
                {children}
            </div>
        </div>
    );
    
    const styles = [
      { name: "Socratic Tutor", color: "bg-purple-500", prompt: "Question my assumptions and lead me to the answer." },
      { name: "Concise Professional", color: "bg-blue-500", prompt: "Provide clear, bulleted takeaways for business use." },
      { name: "Creative Muse", color: "bg-pink-500", prompt: "Brainstorm wild ideas and use inspiring analogies." }
    ];

    return (
        <section id="learning-supercharged" className="py-24 sm:py-32 bg-[#0C0E1A]">
            <div className="container mx-auto px-5 sm:px-6">
                <div className="text-center mb-24">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5">
                        Learning, <span className="bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">Supercharged.</span>
                    </h2>
                    <p className="text-base sm:text-lg text-gray-400 max-w-4xl mx-auto">
                        Go beyond simple tools. Experience an AI that truly partners in your growth, adapting to you.
                    </p>
                </div>
                
                <div className="space-y-24 lg:space-y-32">
                    <FeatureShowcase
                        icon={<BrainCircuit className="w-7 h-7 text-teal-400" />}
                        title="Universal Context"
                        description="Provide TaskMaster with your core documents, goals, and role. It will maintain this context throughout the entire app, ensuring every response is perfectly aligned with your world, without you ever having to repeat yourself."
                    >
                        <div className="p-6 bg-[#12141D] rounded-2xl border border-gray-700/60 shadow-2xl backdrop-blur-md relative overflow-hidden">
                            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-teal-500/20 via-transparent to-transparent opacity-50 blur-xl -z-10"></div>
                            <h4 className="text-lg font-semibold text-white mb-5">Universal Context</h4>
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-black/40 border border-gray-800/80">
                                    <label className="text-xs font-semibold text-teal-400/80 tracking-wider uppercase">Your Role / Primary Area of Study</label>
                                    <p className="text-gray-300 mt-1">College student majoring in CS & Business.</p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/40 border border-gray-800/80">
                                    <label className="text-xs font-semibold text-teal-400/80 tracking-wider uppercase">Current Short-Term Focus</label>
                                    <p className="text-gray-300 mt-1">Preparing for upcoming SATs and final exams.</p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/40 border border-gray-800/80">
                                    <label className="text-xs font-semibold text-teal-400/80 tracking-wider uppercase">Main Long-Term Ambitions or Goals</label>
                                    <p className="text-gray-300 mt-1">Get a job at a top tech company.</p>
                                </div>
                                <div className="p-4 rounded-xl bg-black/40 border border-gray-800/80">
                                    <label className="text-xs font-semibold text-teal-400/80 tracking-wider uppercase">Other</label>
                                    <p className="text-gray-300 mt-1">I learn best with real-world examples and analogies.</p>
                                </div>
                            </div>
                        </div>
                    </FeatureShowcase>

                    <FeatureShowcase
                        icon={<DatabaseBackup className="w-7 h-7 text-pink-400" />}
                        title="Personal Memories"
                        description="TaskMaster dynamically learns and remembers key facts about your preferences, learning style, and important details. You remain in complete control and can view, edit, or delete these memories at any time to fine-tune your learning."
                        reverse={true}
                    >
                        <div className="p-6 bg-[#12141D] rounded-2xl border border-gray-700/60 shadow-2xl backdrop-blur-md relative overflow-hidden">
                            <div className="absolute -inset-px rounded-2xl bg-gradient-to-l from-pink-500/20 via-transparent to-transparent opacity-50 blur-xl -z-10"></div>
                            <h4 className="text-lg font-semibold text-white mb-5">Memories</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-gray-800/80 transition-all hover:border-pink-500/50">
                                    <p className="text-sm text-gray-300">Prefers visual explanations for complex topics.</p>
                                    <div className="flex gap-3 text-gray-600"><Edit className="w-4 h-4" /> <Trash2 className="w-4 h-4" /></div>
                                </div>
                                 <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-gray-800/80 transition-all hover:border-pink-500/50">
                                    <p className="text-sm text-gray-300">Loves analogies related to video games.</p>
                                    <div className="flex gap-3 text-gray-600"><Edit className="w-4 h-4" /> <Trash2 className="w-4 h-4" /></div>
                                </div>
                                 <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-gray-800/80 transition-all hover:border-pink-500/50">
                                    <p className="text-sm text-gray-300">Has an important meeting every Friday at 10 AM.</p>
                                    <div className="flex gap-3 text-gray-600"><Edit className="w-4 h-4" /> <Trash2 className="w-4 h-4" /></div>
                                </div>
                                 <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border-2 border-pink-500/60 shadow-lg shadow-pink-500/10">
                                    <p className="text-sm text-white">Wants a weekly project recap on Mondays.</p>
                                    <div className="flex gap-3 text-gray-400"><Edit className="w-4 h-4" /> <Trash2 className="w-4 h-4" /></div>
                                </div>
                            </div>
                        </div>
                    </FeatureShowcase>
                    
                    <FeatureShowcase
                        icon={<Palette className="w-7 h-7 text-indigo-400" />}
                        title="Custom Styles"
                        description="Why settle for a generic chatbot? Sculpt TaskMaster's personality, tone, and response format to create your ideal tutor. Choose from pre-made styles or build your own from scratch for a truly unique and effective experience."
                    >
                         <div className="p-6 bg-[#12141D] rounded-2xl border border-gray-700/60 shadow-2xl backdrop-blur-md relative overflow-hidden">
                             <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-indigo-500/20 via-transparent to-transparent opacity-50 blur-xl -z-10"></div>
                            <h4 className="text-lg font-semibold text-white mb-5">Style Selector</h4>
                            <div className="space-y-3">
                                {styles.map((style, i) => (
                                    <div key={i} className={`p-4 rounded-xl border transition-all duration-300 ${i === 0 ? 'border-indigo-500/80 bg-black/50' : 'border-gray-800/80 bg-black/30 hover:bg-black/40'}`}>
                                        <div className="flex items-center">
                                            <span className={`w-3 h-3 rounded-full mr-3 ${style.color}`}></span>
                                            <h5 className={`font-semibold ${i === 0 ? 'text-white' : 'text-gray-300'}`}>{style.name}</h5>
                                        </div>
                                        <p className="text-sm text-gray-500 pl-6 mt-1">{style.prompt}</p>
                                    </div>
                                ))}
                            </div>
                            <button className="w-full mt-5 py-3 text-sm font-semibold text-indigo-300 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-800/80 rounded-lg transition-colors">
                                + Create New Style
                            </button>
                        </div>
                    </FeatureShowcase>
                </div>
            </div>
        </section>
    );
}

const DesmosIcon = ({ className }) => (
    <svg id="Desmos_Logo" data-name="Desmos Logo" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="-10 0 276 276" className={className} preserveAspectRatio="xMidYMid meet">
        <defs>
            <linearGradient id="desmos-linear-gradient" y1="1080" x2="1" y2="1080" gradientTransform="matrix(0, 202, 202, 0, -217488, 439)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#158f48"/><stop offset="1" stopColor="#0f6733"/></linearGradient>
            <linearGradient id="desmos-linear-gradient-2" y1="1079.68536" x2="1" y2="1079.68536" gradientTransform="matrix(0, 202, 202, 0, -217488, 439)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#fff"/></linearGradient>
            <linearGradient id="desmos-linear-gradient-3" y1="1080" y2="1080" xlinkHref="#desmos-linear-gradient-2"/>
            <linearGradient id="desmos-linear-gradient-4" y1="1079.95843" y2="1079.95843" xlinkHref="#desmos-linear-gradient-2"/>
            <linearGradient id="desmos-linear-gradient-5" y1="1080.26677" y2="1080.26677" xlinkHref="#desmos-linear-gradient-2"/>
        </defs>
        <g id="Icon" transform="scale(1.3) translate(-570 -430)">
            <path d="M669.84393,599.54407c-18.24481,0-29.71307-15.70441-35.97625-24.00019l10.12359-10.2138c2.7218,3.40646,12.90729,19.14911,25.95465,19.14911a18.68036,18.68036,0,0,0,11.56879-4.34638s7.72064,6.75678,11.82373,8.84479c0,0-7.67688,10.51166-23.38239,10.56628l-.11212.00019m90.53681-45.07331h-.02765c-13.67682.02918-30.17676,34.23536-52.47077,34.23536-23.32373,0-38.05859-34.08106-52.58831-34.08106-15.82325,0-30.00006,34.08106-52.58789,34.08106-12.10267,0-21.63141-8.95026-31.70606-18.60822v26.84341A44.05844,44.05844,0,0,0,615.05859,641H728.94147a44.05842,44.05842,0,0,0,44.05847-44.05872V560.35889c-2.07135-2.00617-6.82825-5.8877-12.6192-5.88813M728.94147,438.99994H615.05859a43.913,43.913,0,0,0-17.77771,3.73382c6.87159,24.95673,22.83289,80.10926,35.39307,101.9997-3.78967,3.73041-7.14954,6.80072-11.027,10.61914-10.74994-16.31024-29.82165-78.20837-37.43439-103.75323a43.9257,43.9257,0,0,0-13.21246,31.45928v66.38514c11.61658,9.44256,21.08045,24.02719,31.6203,24.02719l.08576-.00031C617.49951,573.35931,631.35309,540,655.294,540c24.412,0,35.17663,33.294,52.353,33.294C724.17627,573.294,736.61774,540,760,540a27.799,27.799,0,0,1,12.99994,3.21344V483.05865a43.99331,43.99331,0,0,0-17.49066-35.1502c-7.37067,30.04168-24.31458,87.99005-46.39167,121.9002a24.95592,24.95592,0,0,1-12.853-7.48547c22.79944-34.376,43.62091-110.397,46.48785-121.11517a44.02056,44.02056,0,0,0-13.811-2.20807" fill="url(#desmos-linear-gradient)" transform="translate(0, 0)"/><path d="M597.28088,442.73376a44.12808,44.12808,0,0,0-13.06836,8.86561c7.61274,25.54486,26.68445,87.443,37.43439,103.75323,3.8775-3.81842,7.23737-6.88873,11.027-10.61914-12.56018-21.89044-28.52148-77.043-35.39307-101.9997" fill="url(#desmos-linear-gradient-2)" transform="translate(0, 0)"/><path d="M760,540c-23.38226,0-35.82373,33.294-52.353,33.294-17.17639,0-27.941-33.294-52.353-33.294-23.94092,0-37.7945,33.35931-52.58789,33.47067l-.08576.00031c-10.53985,0-20.00372-14.58463-31.6203-24.02719V570.0979c10.07465,9.658,19.60339,18.60822,31.70606,18.60822,22.58783,0,36.76464-34.08106,52.58789-34.08106,14.52972,0,29.26458,34.08106,52.58831,34.08106,22.294,0,38.79395-34.20618,52.47077-34.23536h.02765c5.791.00043,10.54785,3.882,12.6192,5.88813V543.21344A27.799,27.799,0,0,0,760,540" fill="url(#desmos-linear-gradient-3)" transform="translate(0, 0)"/><path d="M643.99127,565.33008l-10.12359,10.2138c6.26318,8.29578,17.73144,24.00019,35.97625,24.00019l.11212-.00019c15.70551-.05462,23.38239-10.56628,23.38239-10.56628-4.10309-2.088-11.82373-8.84479-11.82373-8.84479a18.68036,18.68036,0,0,1-11.56879,4.34638c-13.04736,0-23.23285-15.74265-25.95465-19.14911" fill="url(#desmos-linear-gradient-4)" transform="translate(0, 0)"/><path d="M742.75244,441.208c-2.86694,10.7182-23.68841,86.73919-46.48785,121.11517a24.95592,24.95592,0,0,0,12.853,7.48547c22.07709-33.91015,39.021-91.85852,46.39167-121.9002a43.92448,43.92448,0,0,0-12.75684-6.70044" fill="url(#desmos-linear-gradient-5)" transform="translate(0, 0)"/></g>
    </svg>
);

const KhanAcademyIcon = ({ className }) => (
    <svg viewBox="-10 0 276 276" version="1.1" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" className={className}>
        <g> <path d="M16.2524996,57.1547059 C6.70984964,63.1945026 0.660185591,73.4605992 0,84.7347053 L0,191.114703 C0.660185591,202.388809 6.70984964,212.654905 16.2524996,218.694702 L111.698997,272.081701 C121.951702,277.105311 133.951292,277.105311 144.203997,272.081701 L239.748994,218.694702 C249.291644,212.654905 255.341308,202.388809 256.001494,191.114703 L256.001494,84.7347053 C255.341308,73.4605992 249.291644,63.1945026 239.748994,57.1547059 L144.302497,3.76770718 C134.049792,-1.25590239 122.050202,-1.25590239 111.797497,3.76770718 L16.2524996,57.1547059 Z" fill="#14BF96"> </path> <path d="M226.057495,111.526705 C173.064496,111.526705 133.467497,155.457704 133.467497,209.337202 L133.467497,211.602702 L122.829497,211.602702 L122.829497,209.337202 C122.829497,155.457704 83.4294981,111.723705 30.0411256,111.526705 C30.0411256,114.875705 30.0411256,118.323205 30.0411256,121.376704 C29.8270913,162.138126 54.9627136,198.741876 93.0824978,213.178702 C104.410162,217.33234 116.378824,219.466029 128.443997,219.482702 C140.605396,219.466096 152.67111,217.332931 164.100996,213.178702 C202.16354,198.686189 227.244797,162.10445 227.04371,121.376704 C226.549995,118.224705 226.352995,114.875705 226.057495,111.526705 Z" fill="#FFFFFF"> </path> <circle fill="#FFFFFF" cx="128.049997" cy="86.1137053" r="29.5499993"> </circle> </g>
    </svg>
);

const CanvasIcon = ({ className }) => (
    <svg fill="#E72429" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M958.568 277.97C1100.42 277.97 1216.48 171.94 1233.67 34.3881 1146.27 12.8955 1054.57 0 958.568 0 864.001 0 770.867 12.8955 683.464 34.3881 700.658 171.94 816.718 277.97 958.568 277.97ZM35.8207 682.031C173.373 699.225 279.403 815.285 279.403 957.136 279.403 1098.99 173.373 1215.05 35.8207 1232.24 12.8953 1144.84 1.43262 1051.7 1.43262 957.136 1.43262 862.569 12.8953 769.434 35.8207 682.031ZM528.713 957.142C528.713 1005.41 489.581 1044.55 441.31 1044.55 393.038 1044.55 353.907 1005.41 353.907 957.142 353.907 908.871 393.038 869.74 441.31 869.74 489.581 869.74 528.713 908.871 528.713 957.142ZM1642.03 957.136C1642.03 1098.99 1748.06 1215.05 1885.61 1232.24 1908.54 1144.84 1920 1051.7 1920 957.136 1920 862.569 1908.54 769.434 1885.61 682.031 1748.06 699.225 1642.03 815.285 1642.03 957.136ZM1567.51 957.142C1567.51 1005.41 1528.38 1044.55 1480.11 1044.55 1431.84 1044.55 1392.71 1005.41 1392.71 957.142 1392.71 908.871 1431.84 869.74 1480.11 869.74 1528.38 869.74 1567.51 908.871 1567.51 957.142ZM958.568 1640.6C816.718 1640.6 700.658 1746.63 683.464 1884.18 770.867 1907.11 864.001 1918.57 958.568 1918.57 1053.14 1918.57 1146.27 1907.11 1233.67 1884.18 1216.48 1746.63 1100.42 1640.6 958.568 1640.6ZM1045.98 1480.11C1045.98 1528.38 1006.85 1567.51 958.575 1567.51 910.304 1567.51 871.172 1528.38 871.172 1480.11 871.172 1431.84 910.304 1392.71 958.575 1392.71 1006.85 1392.71 1045.98 1431.84 1045.98 1480.11ZM1045.98 439.877C1045.98 488.148 1006.85 527.28 958.575 527.28 910.304 527.28 871.172 488.148 871.172 439.877 871.172 391.606 910.304 352.474 958.575 352.474 1006.85 352.474 1045.98 391.606 1045.98 439.877ZM1441.44 1439.99C1341.15 1540.29 1333.98 1697.91 1418.52 1806.8 1579 1712.23 1713.68 1577.55 1806.82 1418.5 1699.35 1332.53 1541.74 1339.7 1441.44 1439.99ZM1414.21 1325.37C1414.21 1373.64 1375.08 1412.77 1326.8 1412.77 1278.53 1412.77 1239.4 1373.64 1239.4 1325.37 1239.4 1277.1 1278.53 1237.97 1326.8 1237.97 1375.08 1237.97 1414.21 1277.1 1414.21 1325.37ZM478.577 477.145C578.875 376.846 586.039 219.234 501.502 110.339 341.024 204.906 206.338 339.592 113.203 498.637 220.666 584.607 378.278 576.01 478.577 477.145ZM679.155 590.32C679.155 638.591 640.024 677.723 591.752 677.723 543.481 677.723 504.349 638.591 504.349 590.32 504.349 542.048 543.481 502.917 591.752 502.917 640.024 502.917 679.155 542.048 679.155 590.32ZM1440 475.712C1540.3 576.01 1697.91 583.174 1806.8 498.637 1712.24 338.159 1577.55 203.473 1418.51 110.339 1332.54 217.801 1341.13 375.413 1440 475.712ZM1414.21 590.32C1414.21 638.591 1375.08 677.723 1326.8 677.723 1278.53 677.723 1239.4 638.591 1239.4 590.32 1239.4 542.048 1278.53 502.917 1326.8 502.917 1375.08 502.917 1414.21 542.048 1414.21 590.32ZM477.145 1438.58C376.846 1338.28 219.234 1331.12 110.339 1415.65 204.906 1576.13 339.593 1710.82 498.637 1805.39 584.607 1696.49 577.443 1538.88 477.145 1438.58ZM679.155 1325.37C679.155 1373.64 640.024 1412.77 591.752 1412.77 543.481 1412.77 504.349 1373.64 504.349 1325.37 504.349 1277.1 543.481 1237.97 591.752 1237.97 640.024 1237.97 679.155 1277.1 679.155 1325.37Z"></path>
    </svg>
);

const GoogleClassroomIcon = ({ className }) => (
    <svg version="1.1" id="Livello_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 578.9 500" enableBackground="new 0 0 578.9 500" xmlSpace="preserve" className={className}>
        <g> <path fill="#0F9D58" d="M52.6,52.6h473.7v394.7H52.6V52.6z"/> <path fill="#57BB8A" d="M394.7,263.2c16.4,0,29.6-13.3,29.6-29.6s-13.3-29.6-29.6-29.6s-29.6,13.3-29.6,29.6 S378.4,263.2,394.7,263.2L394.7,263.2z M394.7,282.9c-31.7,0-65.8,16.8-65.8,37.6v21.6h131.6v-21.6 C460.5,299.7,426.4,282.9,394.7,282.9z M184.2,263.2c16.4,0,29.6-13.3,29.6-29.6s-13.3-29.6-29.6-29.6s-29.6,13.3-29.6,29.6 S167.9,263.2,184.2,263.2L184.2,263.2z M184.2,282.9c-31.7,0-65.8,16.8-65.8,37.6v21.6H250v-21.6 C250,299.7,215.9,282.9,184.2,282.9z"/> <path fill="#F7F7F7" d="M289.5,236.8c21.8,0,39.5-17.7,39.4-39.5c0-21.8-17.7-39.5-39.5-39.4c-21.8,0-39.4,17.7-39.4,39.5 C250,219.2,267.7,236.8,289.5,236.8z M289.5,263.2c-44.4,0-92.1,23.6-92.1,52.6v26.3h184.2v-26.3 C381.6,286.7,333.9,263.2,289.5,263.2z"/> <path fill="#F1F1F1" d="M342.1,421.1h118.4v26.3H342.1V421.1z"/> <path fill="#F4B400" d="M539.5,0h-500C17.7,0,0,17.7,0,39.5v421.1C0,482.3,17.7,500,39.5,500h500c21.8,0,39.5-17.7,39.5-39.5V39.5 C578.9,17.7,561.3,0,539.5,0z M526.3,447.4H52.6V52.6h473.7V447.4z"/> <path opacity="0.2" fill="#FFFFFF" enableBackground="new    " d="M539.5,0h-500C17.7,0,0,17.7,0,39.5v3.3C0,21,17.7,3.3,39.5,3.3 h500c21.8,0,39.5,17.7,39.5,39.5v-3.3C578.9,17.7,561.3,0,539.5,0z"/> <path opacity="0.2" fill="#BF360C" enableBackground="new    " d="M539.5,496.7h-500C17.7,496.7,0,479,0,457.2v3.3 C0,482.3,17.7,500,39.5,500h500c21.8,0,39.5-17.7,39.5-39.5v-3.3C578.9,479,561.3,496.7,539.5,496.7z"/> <linearGradient id="gc-grad-1" gradientUnits="userSpaceOnUse" x1="154.8649" y1="295.747" x2="154.8649" y2="282.6343" gradientTransform="matrix(12.992 0 0 -4 -1584.6235 1631.0867)"> <stop offset="0" style={{stopColor:'#BF360C',stopOpacity:'0.2'}}/> <stop offset="1" style={{stopColor:'#BF360C',stopOpacity:'2.000000e-02'}}/> </linearGradient> <path fill="url(#gc-grad-1)" d="M460.3,447.4H341.9l52.6,52.6h118.3L460.3,447.4z"/> <path opacity="0.2" fill="#263238" enableBackground="new    " d="M52.6,49.3h473.7v3.3H52.6V49.3z"/> <path opacity="0.2" fill="#FFFFFF" enableBackground="new    " d="M52.6,447.4h473.7v3.3H52.6V447.4z"/> <radialGradient id="gc-grad-2" cx="131.4012" cy="367.2001" r="18.1966" gradientTransform="matrix(38.0002 0 0 -38 -4973.3276 13965.3232)" gradientUnits="userSpaceOnUse"> <stop offset="0" style={{stopColor:'#FFFFFF',stopOpacity:'0.1'}}/> <stop offset="1" style={{stopColor:'#FFFFFF',stopOpacity:'0'}}/> </radialGradient> <path fill="url(#gc-grad-2)" d="M539.5,0h-500C17.7,0,0,17.7,0,39.5v421.1C0,482.3,17.7,500,39.5,500h500 c21.8,0,39.5-17.7,39.5-39.5V39.5C578.9,17.7,561.3,0,539.5,0z"/> </g>
    </svg>
);

const LogoIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#635BFF' }} />
        <stop offset="100%" style={{ stopColor: '#8A85FF' }} />
      </linearGradient>
    </defs>
    <path d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.19C2 19.83 4.17 22 7.81 22H16.19C19.83 22 22 19.83 22 16.19V7.81C22 4.17 19.83 2 16.19 2ZM9.97 14.9L7.72 17.15C7.57 17.3 7.38 17.37 7.19 17.37C7 17.37 6.8 17.3 6.66 17.15L5.91 16.4C5.61 16.11 5.61 15.63 5.91 15.34C6.2 15.05 6.67 15.05 6.97 15.34L7.19 15.56L8.91 13.84C9.2 13.55 9.67 13.55 9.97 13.84C10.26 14.13 10.26 14.61 9.97 14.9ZM9.97 7.9L7.72 10.15C7.57 10.3 7.38 10.37 7.19 10.37C7 10.37 6.8 10.3 6.66 10.15L5.91 9.4C5.61 9.11 5.61 8.63 5.91 8.34C6.2 8.05 6.67 8.05 6.97 8.34L7.19 8.56L8.91 6.84C9.2 6.55 9.67 6.55 9.97 6.84C10.26 7.13 10.26 7.61 9.97 7.9ZM17.56 16.62H12.31C11.9 16.62 11.56 16.28 11.56 15.87C11.56 15.46 11.9 15.12 12.31 15.12H17.56C17.98 15.12 18.31 15.46 18.31 15.87C18.31 16.28 17.98 16.62 17.56 16.62ZM17.56 9.62H12.31C11.9 9.62 11.56 9.28 11.56 8.87C11.56 8.46 11.9 8.12 12.31 8.12H17.56C17.98 8.12 18.31 8.46 18.31 8.87C18.31 9.28 17.98 9.62 17.56 9.62Z" fill="url(#logo-gradient)"/>
  </svg>
);

const integrations = [
    { name: 'Notion', Icon: NotionIcon, positionClass: 'top-[5%] left-[40%] -translate-x-1/2', lineEnd: { x: '50%', y: '16%' }, isComingSoon: false },
    { name: 'Khan Academy', Icon: KhanAcademyIcon, positionClass: 'top-[20%] left-[8%]', lineEnd: { x: '19%', y: '32%' }, isComingSoon: true },
    { name: 'Desmos', Icon: DesmosIcon, positionClass: 'top-[20%] right-[8%]', lineEnd: { x: '81%', y: '32%' }, isComingSoon: true },
    { name: 'Google Classroom', Icon: GoogleClassroomIcon, positionClass: 'top-[45%] left-[2%] -translate-y-1/2', lineEnd: { x: '12%', y: '55%' }, isComingSoon: true },
    { name: 'Canvas', Icon: CanvasIcon, positionClass: 'top-[45%] right-[2%] -translate-y-1/2', lineEnd: { x: '88%', y: '55%' }, isComingSoon: true },
    { name: 'Google Drive', Icon: GoogleDriveIcon, positionClass: 'bottom-[10%] left-[20%]', lineEnd: { x: '30%', y: '80%' }, isComingSoon: false },
    { name: 'Google Calendar', Icon: GoogleCalendarIcon, positionClass: 'bottom-[10%] right-[20%]', lineEnd: { x: '70%', y: '80%' }, isComingSoon: false },
];

export function IntegrationsSection() {
    const cardVariants = {
        offscreen: { y: 50, opacity: 0 },
        onscreen: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                bounce: 0.4,
                duration: 0.8
            }
        }
    };
    
    const nodeBaseClass = "absolute flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-[#12141D]/80 backdrop-blur-lg border border-gray-700/80 rounded-full";
    const iconBaseClass = "w-8 h-8 lg:w-10 lg:h-10";

    return (
        <section className="py-24 sm:py-32 bg-[#0C0E1A] overflow-hidden">
            <div className="container mx-auto px-5 sm:px-6">
                <div className="text-center mb-16 lg:mb-24">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-5">
                        Your Entire Knowledge Base, <span className="bg-gradient-to-r from-teal-400 via-sky-500 to-blue-500 bg-clip-text text-transparent">Unified.</span>
                    </h2>
                    <p className="text-base sm:text-lg text-gray-400 max-w-3xl mx-auto">
                        Connect your favorite apps and grant TaskMaster an unparalleled understanding of your world, supercharging its context and memory.
                    </p>
                </div>

                <div className="relative h-[350px] lg:h-[400px] w-full flex items-center justify-center mb-24">
                    <div className="absolute w-[350px] h-[350px] lg:w-[400px] lg:h-[400px] bg-indigo-900/40 rounded-full blur-3xl"></div>
                    <motion.div
                        className="relative w-[320px] h-[320px] lg:w-[380px] lg:h-[380px] bg-[#12141D]/50 backdrop-blur-xl border border-white/10 rounded-full"
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        viewport={{ once: true, amount: 0.5 }}
                    >
                        <motion.svg
                            className="absolute top-0 left-0 w-full h-full"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                            viewport={{ once: true, amount: 0.8 }}
                        >
                            {integrations.map(({ name, lineEnd }) => (
                                <motion.line
                                    key={`line-${name}`}
                                    x1="50%"
                                    y1="50%"
                                    x2={lineEnd.x}
                                    y2={lineEnd.y}
                                    stroke="rgba(100, 116, 139, 0.3)"
                                    strokeWidth="1.5"
                                    initial={{ pathLength: 0 }}
                                    whileInView={{ pathLength: 1 }}
                                    transition={{ duration: 0.5, delay: 0.7, ease: "easeInOut" }}
                                    viewport={{ once: true }}
                                />
                            ))}
                        </motion.svg>
                        
{/* Central Logo - The centering classes are correct. The surrounding context was the issue. */}
    <motion.div
        className="absolute top-[35%] left-[37%] -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
        viewport={{ once: true, amount: 0.8 }}
    >
        <div className="flex items-center justify-center w-20 h-20 lg:w-24 lg:h-24 bg-[#0C0E1A] border-2 border-indigo-500/50 rounded-full shadow-lg">
            <LogoIcon className="w-10 h-10 lg:w-12 lg:h-12" />
        </div>
    </motion.div>

                        {integrations.map(({ name, Icon, positionClass, isComingSoon }, index) => (
                            <motion.div
                                key={`node-${name}`}
                                className={`absolute group ${positionClass}`}
                                initial={{ scale: 0, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.4, delay: 0.6 + index * 0.1, ease: "easeOut" }}
                                viewport={{ once: true, amount: 0.8 }}
                            >
                                <div className={`flex items-center justify-center w-16 h-16 lg:w-20 lg:h-20 bg-[#12141D]/80 backdrop-blur-lg border border-gray-700/80 rounded-full transition-all duration-300 ${isComingSoon ? 'grayscale hover:grayscale-0' : ''}`}>
                                    <Icon className="w-8 h-8 lg:w-10 lg:h-10" />
                                </div>
                                {isComingSoon && (
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-md shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 ease-in-out pointer-events-none">
                                        Coming Soon
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8">
                    <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                        <div className="h-full bg-[#12141D] p-8 rounded-2xl border border-gray-700/60 shadow-xl hover:border-blue-500/60 transition-colors duration-300 transform hover:-translate-y-1">
                            <div className="flex items-center gap-4 mb-5">
                                <GoogleDriveIcon className="w-10 h-10" />
                                <h3 className="text-2xl font-bold text-white">Google Drive</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                                Grant TaskMaster secure, read-only access to your entire digital library. It can reference your documents, spreadsheets, and presentations to provide hyper-relevant answers.
                            </p>
                        </div>
                    </motion.div>
                    <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                       <div className="h-full bg-[#12141D] p-8 rounded-2xl border border-gray-700/60 shadow-xl hover:border-gray-400/60 transition-colors duration-300 transform hover:-translate-y-1">
                            <div className="flex items-center gap-4 mb-5">
                                <NotionIcon className="w-10 h-10" />
                                <h3 className="text-2xl font-bold text-white">Notion</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                                Connect your second brain. TaskMaster can pull context from your structured notes, project plans, and knowledge bases in Notion, seamlessly integrating with your most organized thoughts.
                            </p>
                        </div>
                    </motion.div>
                    <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                       <div className="h-full bg-[#12141D] p-8 rounded-2xl border border-gray-700/60 shadow-xl hover:border-green-500/60 transition-colors duration-300 transform hover:-translate-y-1">
                            <div className="flex items-center gap-4 mb-5">
                                <GoogleCalendarIcon className="w-10 h-10" />
                                <h3 className="text-2xl font-bold text-white">Google Calendar</h3>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                                Unlock your schedule's context. TaskMaster understands your availability and important deadlines, helping you prepare, schedule tasks, and manage your time more effectively.
                            </p>
                        </div>
                    </motion.div>
                    <motion.div variants={cardVariants} initial="offscreen" whileInView="onscreen" viewport={{ once: true, amount: 0.5 }}>
                       <div className="h-full bg-[#12141D] p-8 rounded-2xl border-2 border-dashed border-gray-700/80 flex flex-col justify-center items-center text-center shadow-xl transform hover:-translate-y-1 transition-transform duration-300">
                            <h3 className="text-2xl font-bold text-white mb-4">And Many More...</h3>
                            <p className="text-gray-400 leading-relaxed mb-6">
                                We're constantly expanding our ecosystem. Integrations for leading educational and creative platforms are coming soon.
                            </p>
                            <div className="flex items-center justify-center gap-4">
                                <CanvasIcon className="w-8 h-8 text-gray-500" />
                                <DesmosIcon className="w-8 h-8 text-gray-500" />
                                <KhanAcademyIcon className="w-8 h-8 text-gray-500" />
                                <GoogleClassroomIcon className="w-8 h-8 text-gray-500" />
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

function App() {
  const { user } = useAuth();
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollIndicator(window.scrollY < 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerVariants = {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  const heroContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.18,
        delayChildren: 0.25,
      },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
  };

  return (
    <div className="min-h-screen bg-[#0C0E1A] text-gray-200 font-poppins selection:bg-purple-600 selection:text-white">
      <Analytics />
      <SpeedInsights />
        <motion.header
          className="w-full py-5 sm:py-6 absolute top-0 left-0 z-50"
          variants={headerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="container mx-auto px-5 sm:px-6">
            <nav className="flex items-center justify-between">
              <a href="/" aria-label="TaskMaster AI Home">
                <Logo />
              </a>
              <div className="flex items-center space-x-6">
                <a
                  href={user ? "/dashboard" : "/signup"}
                  className="px-5 sm:px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md hover:shadow-indigo-500/50 whitespace-nowrap"
                >
                  {user ? "Dashboard" : <><span className="sm:hidden">Start today</span><span className="hidden sm:inline">Start today - It's Free</span></>}
                </a>
              </div>
            </nav>
          </div>
        </motion.header>

        <main className="overflow-x-hidden">
            <section className="relative min-h-screen flex items-center justify-center pt-40 sm:pt-52 pb-24 sm:pb-32 bg-[#0C0E1A] overflow-hidden">
                <div className="container mx-auto px-5 sm:px-6 relative z-10">
                    <div className="grid lg:grid-cols-5 gap-x-16 gap-y-16 items-center">
                    <motion.div 
                        className="text-center lg:text-left lg:col-span-2"
                        variants={heroContainerVariants}
                        initial="hidden"
                        animate="visible"
                    >
<motion.h1 
    className="text-5xl md:text-1xl lg:text-[3.8rem]  font-extrabold mb-9 leading-snug tracking-tight"
    variants={heroItemVariants}
>
    <span className="block bg-gradient-to-r from-[#635BFF] to-[#8A85FF] bg-clip-text text-transparent">Not just a tool,</span>
    <span className="block bg-gradient-to-r from-[#635BFF] to-[#8A85FF] bg-clip-text text-transparent whitespace-nowrap ">
        but a partner.
    </span>
</motion.h1>



                        <motion.div variants={heroItemVariants} className="flex justify-center lg:justify-start mb-10">
                            <a 
                                href={user ? "/dashboard" : "/signup"}
                                className="inline-block px-8 sm:px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-lg sm:text-xl font-semibold shadow-xl hover:shadow-indigo-500/60 transition-all duration-300 transform hover:-translate-y-1 whitespace-nowrap"
                            >
                               {user ? "Go to Dashboard" : <><span className="sm:hidden">Get Started - It's Free</span><span className="hidden sm:inline">Get Started - It's Free</span></>}
                            </a>
                        </motion.div>
                        
                        <motion.p 
                        className="text-base sm:text-lg md:text-xl text-gray-400 max-w-xl mx-auto lg:mx-0"
                        variants={heroItemVariants}
                        >
                          Any audio, video, or PDF → Instant notes, flashcards, quizzes, and chatbot.
                        </motion.p>
                        
                    </motion.div>

                    <motion.div 
                        className="relative lg:col-span-3 mt-12 lg:mt-0"
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
                    >
                        <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-indigo-600/80 via-purple-600/80 to-pink-600/80 opacity-20 blur-2xl"></div>
                        <img
                            src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/Screenshot%202025-06-23%20at%201.28.08%E2%80%AFPM.png?alt=media&token=64186bbb-662d-41d4-88ef-ec1debf7739a"
                            alt="TaskMaster AI Product Screenshot" 
                            className="relative rounded-2xl shadow-2xl border-2 border-gray-700/70 w-full"
                        />
                    </motion.div>
                    </div>
                </div>
            </section>
            <TrustedBySection />
            <TestimonialsSection />
            <FeaturesGridSection />
            <LearningSuperchargedSection />
            <IntegrationsSection/>
        </main>

        <footer className="bg-[#0C0E1A]  mt-16">
          <div className="container mx-auto px-5 sm:px-6 py-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="flex items-center space-x-4">
                <a href="/privacy-policy" className="text-sm text-gray-500 hover:text-indigo-400 transition-colors">Privacy Policy</a>
                <span className="text-gray-700 hidden sm:inline">|</span>
                <a href="/terms" className="text-sm text-gray-500 hover:text-indigo-400 transition-colors">Terms & Conditions</a>
              </div>
              <p className="text-sm text-gray-500 text-center md:text-right">
                © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
    </div>
  );
}

export default App;
