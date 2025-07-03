import React, { useState, FormEvent, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, DollarSign, Briefcase, Award, Rocket, 
  ArrowRight, BrainCircuit, X, Loader2,
  Send, CheckCircle, AlertTriangle, AtSign, Tv2, User, Mail, Link2, MessageSquare, Tag, Instagram
} from 'lucide-react';
import { savePartnerApplication, saveReferral } from '../lib/partner-firebase';

const jobDetails = [
  {
    icon: <Tv2 className="w-8 h-8 text-white" />,
    description: "Create and post engaging content about TaskMaster AI. Our marketing team will provide you with viral ideas and content inspiration.",
  },
  {
    icon: <Users className="w-8 h-8 text-white" />,
    description: "Work closely with our founders and marketing team to learn about startup growth, marketing strategies, and how to improve as a creator.",
  },
  {
    icon: <DollarSign className="w-8 h-8 text-white" />,
    description: <>Earn a base of <strong className="text-white font-semibold">$5-$10</strong> per video, plus performance bonuses up to <strong className="text-white font-semibold">$25</strong> per video for signups using your unique creator code on our yearly plans.</>,
  },
];

const perks = [
  { icon: <Briefcase className="w-8 h-8 text-white" />, title: "Professional Experience", description: "A marketing internship at a high-growth, venture-backed AI company to add to your resume." },
  { icon: <DollarSign className="w-8 h-8 text-white" />, title: "Competitive Pay", description: "Earn significant performance bonuses based on the customers you bring in. Top creators earn thousands." },
  { icon: <Award className="w-8 h-8 text-white" />, title: "Content Coaching", description: "Receive free, personalized content coaching from experienced influencers with millions of followers." },
  { icon: <Rocket className="w-8 h-8 text-white" />, title: "Proven Viral Formats", description: "We've driven over 500 million views across creator accounts and will teach you how to go viral." },
  { icon: <Users className="w-8 h-8 text-white" />, title: "Creator Community", description: "Attend virtual and in-person events, and meet hundreds of talented creators from around the world." },
  { icon: <BrainCircuit className="w-8 h-8 text-white" />, title: "Startup Insider", description: "Work directly with the founders and get a front-row seat to see how a modern tech startup is built." },
];

const VideoPlayer = ({ src }) => (
    <div className="aspect-[9/16] w-full max-w-xs mx-auto bg-[#635bff] rounded-3xl p-2 border-2 border-[#635bff]/50 shadow-xl shadow-[#8a85ff]">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full rounded-2xl object-cover"
      ></video>
    </div>
);

const FormInput = ({ icon, ...props }) => (
    <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {icon}
        </div>
        <input 
            {...props} 
            className="w-full bg-[#4E46DC] text-white placeholder:text-gray-300 pl-12 pr-4 py-3 rounded-xl focus:outline-none transition" 
        />
    </div>
);

const FormTextarea = ({ icon, ...props }) => (
    <div className="relative">
        <div className="absolute top-4 left-0 pl-4 flex items-center pointer-events-none">
            {icon}
        </div>
        <textarea 
            {...props} 
            className="w-full bg-[#4E46DC] text-white placeholder:text-gray-300 pl-12 pr-4 py-3 rounded-xl focus:outline-none transition" 
        />
    </div>
);


export default function Partner() {
  const [formStep, setFormStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({ name: '', email: '', tiktokHandle: '', instagramHandle: '', creatorCode: '', whyPartner: '', referral: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralFormData, setReferralFormData] = useState({ referrerEmail: '', friendName: '', friendEmail: '', friendTiktok: '' });
  const [isSubmittingReferral, setIsSubmittingReferral] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [referralSuccess, setReferralSuccess] = useState(false);

  const totalSteps = 3;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyClick = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
    if(formStep === 0) {
        setFormStep(1);
    }
  };
  
  const resetForm = () => {
    setFormData({ name: '', email: '', tiktokHandle: '', instagramHandle: '', creatorCode: '', whyPartner: '', referral: '' });
    setFormError('');
    setIsSubmitting(false);
    setDirection(1);
    setFormStep(0);
  }

  const nextStep = () => {
    setDirection(1);
    setFormStep(prev => prev + 1);
  };

  const prevStep = () => {
    setDirection(-1);
    setFormStep(prev => prev - 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await savePartnerApplication(formData);
      setDirection(1);
      setFormStep(totalSteps + 1);
    } catch (error) {
      setFormError('An unexpected error occurred. Please try again.');
      setDirection(1);
      setFormStep(totalSteps + 2);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReferralInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setReferralFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleReferralSubmit = async (e: FormEvent) => {
      e.preventDefault();
      if (isSubmittingReferral) return;
      setIsSubmittingReferral(true);
      setReferralError('');
      setReferralSuccess(false);
      try {
          const newApplicant = {
              name: referralFormData.friendName,
              email: referralFormData.friendEmail,
              tiktokHandle: referralFormData.friendTiktok,
          };
          await saveReferral(referralFormData.referrerEmail, newApplicant);
          setReferralSuccess(true);
          setTimeout(() => {
              setShowReferralModal(false);
              setReferralFormData({ referrerEmail: '', friendName: '', friendEmail: '', friendTiktok: ''});
              setReferralSuccess(false);
          }, 4000);
      } catch (error: any) {
          setReferralError(error.message || 'An unexpected error occurred.');
      } finally {
          setIsSubmittingReferral(false);
      }
  };

  const handleReferralClick = () => {
    setShowReferralModal(true);
    setReferralError('');
    setReferralSuccess(false);
    setIsSubmittingReferral(false);
  }

  const carouselVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0, scale: 0.98 }),
    center: { x: 0, opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
    exit: (direction: number) => ({ x: direction < 0 ? '100%' : '-100%', opacity: 0, scale: 0.98, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } })
  };

  return (
    <div className="bg-[#4E46DC] text-gray-200 font-poppins">
      <main className="overflow-x-hidden">
        <section className="relative text-center pt-28 pb-20 md:pt-40 md:pb-28">
          <div className="absolute inset-0 bg-grid-indigo z-0"></div>
           <div className="absolute inset-0 bg-gradient-to-b from-[#4E46DC] via-[#4E46DC] to-transparent z-10"></div>
          <div className="container mx-auto px-6 relative z-20">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-block bg-[#635bff] text-white rounded-full px-5 py-2.5 text-base font-medium mb-8">
                Hiring Marketing Interns
              </span>
            </motion.div>
            <motion.h1 className="text-5xl md:text-7xl text-white mb-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <span className="font-bold">Task</span>
              <span className="font-thin italic">Partner</span>
            </motion.h1>
            <motion.p className="text-lg md:text-xl text-gray-300 mb-7 max-w-3xl mx-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
              <span className="underline underline-offset-4">TaskMaster AI</span> Creator Program
            </motion.p>
            <motion.button onClick={handleApplyClick} className="inline-block bg-[#635bff] hover:bg-indigo-500 text-white rounded-full px-10 py-4 text-lg font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-300 transform hover:-translate-y-1" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}>
              Apply Today
            </motion.button>
          </div>
        </section>

        <section className="py-5 lg:py-5">
            <div className="container mx-auto px-6">
                <div className="bg-[#635bff] rounded-3xl p-8 md:p-12 shadow-2xl max-w-5xl mx-auto ">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="flex flex-col space-y-8">
                            <h2 className="text-3xl md:text-4xl font-bold text-white">The Job</h2>
                            {jobDetails.map((item, index) => (
                                <motion.div key={index} className="flex items-start space-x-5" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: index * 0.15 }} viewport={{ once: true, amount: 0.5 }}>
                                    <div className="flex-shrink-0 bg-[#4E46DC] rounded-xl p-3 ">{item.icon}</div>
                                    <p className="text-gray-300 text-base pt-1 leading-relaxed">{item.description}</p>
                                </motion.div>
                            ))}
                        </div>
                        <motion.div 
                            className="bg-[#4E46DC] rounded-2xl aspect-video relative flex items-center justify-center overflow-hidden" 
                            initial={{ opacity: 0, scale: 0.9 }} 
                            whileInView={{ opacity: 1, scale: 1 }} 
                            transition={{ duration: 0.6, ease: "easeOut" }} 
                            viewport={{ once: true, amount: 0.5 }}>
                            <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/instagram-logo.png?alt=media&token=1620382b-3e8f-46ed-901e-e9ec6356ceb7" alt="Instagram Logo" className="w-12 h-12 object-contain absolute top-[15%] left-[10%] -rotate-12 opacity-90" />
                            <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/tiktok-logo.png?alt=media&token=de834810-541b-4761-a6b5-113bc57d40a8" alt="TikTok Logo" className="w-16 h-16 object-contain absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 rotate-6 opacity-100" />
                            <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/x-icon%20(1).png?alt=media&token=7f5754ce-4bb6-4d75-8092-c10cac451c30" alt="X Logo" className="w-10 h-10 object-contain absolute bottom-[20%] left-[25%] rotate-45 opacity-80" />
                            <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/youtubeshorts-logo.webp?alt=media&token=03bb8338-9e78-42c3-a033-d470179ff384" alt="YouTube Shorts Logo" className="w-20 h-20 object-contain absolute bottom-[10%] right-[5%] -rotate-6 opacity-70" />
                            <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/snapchat-logo.png?alt=media&token=e8fbe5cb-25fc-41de-9d20-80e1ab5ae78d" alt="Snapchat Logo" className="w-14 h-14 object-contain absolute top-[20%] right-[15%] rotate-12 opacity-90" />
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>

        <section className="py-20 lg:py-28">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-20">Why Become a TaskPartner?</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {perks.map((perk, i) => (
                <motion.div key={perk.title} className="bg-[#635bff] p-8 rounded-2xl text-left hover:bg-indigo-500/80 hover:-translate-y-1 transition-all duration-300" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.05 }} viewport={{ once: true, amount: 0.3 }}>
                  <div className="bg-[#4E46DC] inline-block p-3 rounded-xl mb-5">{perk.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{perk.title}</h3>
                  <p className="text-gray-300 text-base leading-relaxed">{perk.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
        
        <section className="py-20 lg:py-28">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Example Videos</h2>
            <p className="text-lg text-gray-300 mb-16">Viral videos made by our partners.</p>
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 max-w-3xl mx-auto">
                <VideoPlayer src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/gpavideo.mp4?alt=media&token=77ed2591-7dcc-47ca-bb84-5e270030d0ef" />
                <VideoPlayer src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/dictatorvideo.mp4?alt=media&token=79c554f8-431f-426b-a3b2-c3b0023d2237" />
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-28">
          <div className="container mx-auto px-6 text-center max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Referrals</h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">
              Are you an existing creator in our program? Earn a <strong className="text-white font-semibold">$50</strong> bonus for every friend you refer who gets accepted as a TaskPartner.
            </p>
            <button onClick={handleReferralClick} className="inline-block bg-[#635bff] hover:bg-indigo-500 text-white rounded-full px-8 py-4 text-lg font-semibold shadow-md transition-all duration-300 transform hover:-translate-y-1">
              Refer a Friend
            </button>
          </div>
        </section>

        <section id="application-form-section" ref={formRef} className="py-20 lg:py-28 scroll-mt-20">
            <div className="container mx-auto px-6 max-w-3xl">
                <div className="bg-[#635bff] rounded-3xl p-6 sm:p-8 md:p-12 shadow-2xl min-h-[550px] flex flex-col justify-center">
                    <AnimatePresence mode="wait">
                        {formStep === 0 && (
                            <motion.div key="start" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center">
                                <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Ready to Apply?</h2>
                                <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-8">Join our creator program and start earning today.</p>
                                <button onClick={() => setFormStep(1)} className="inline-block bg-white text-[#635bff] rounded-full px-10 py-4 text-lg font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none">
                                    Start Application
                                </button>
                            </motion.div>
                        )}

                        {formStep > 0 && (
                            <motion.div key="form-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="w-12">
                                        {formStep > 1 && formStep <= totalSteps && (
                                            <button onClick={prevStep} className="text-gray-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 focus:outline-none">
                                                <ArrowRight className="w-6 h-6 transform rotate-180" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="w-full h-2 bg-[#4E46DC] rounded-full overflow-hidden">
                                        <motion.div className="h-full bg-white" animate={{ width: `${(formStep - 1) / totalSteps * 100}%` }} transition={{ ease: "easeInOut", duration: 0.5 }}/>
                                    </div>
                                    <div className="w-12 text-right">
                                      <button onClick={resetForm} className="text-gray-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 focus:outline-none">
                                          <X className="w-6 h-6"/>
                                      </button>
                                    </div>
                                </div>
                                <div className="relative h-auto overflow-hidden">
                                    <AnimatePresence custom={direction} mode="wait">
                                        <form onSubmit={handleSubmit} className="w-full">
                                            {formStep === 1 && (
                                                <motion.div key={1} custom={direction} variants={carouselVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                                                    <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">Let's start with the basics</h2>
                                                    <p className="text-gray-300 text-center mb-8">Tell us a little about yourself.</p>
                                                    <FormInput icon={<User className="w-5 h-5 text-gray-300"/>} type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleInputChange} required />
                                                    <FormInput icon={<Mail className="w-5 h-5 text-gray-300"/>} type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} required />
                                                    <button type="button" onClick={nextStep} className="w-full bg-white text-[#635bff] font-semibold py-3 px-8 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none">Next</button>
                                                </motion.div>
                                            )}
                                            {formStep === 2 && (
                                                <motion.div key={2} custom={direction} variants={carouselVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                                                    <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">Your Social Presence</h2>
                                                    <p className="text-gray-300 text-center mb-8">Where do you create content?</p>
                                                    <FormInput icon={<AtSign className="w-5 h-5 text-gray-300"/>} type="text" name="tiktokHandle" placeholder="TikTok Handle (e.g., @yourhandle)" value={formData.tiktokHandle} onChange={handleInputChange} required />
                                                    <FormInput icon={<Instagram className="w-5 h-5 text-gray-300"/>} type="text" name="instagramHandle" placeholder="Instagram Handle (Optional)" value={formData.instagramHandle} onChange={handleInputChange} />
                                                    <button type="button" onClick={nextStep} className="w-full bg-white text-[#635bff] font-semibold py-3 px-8 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none">Next</button>
                                                </motion.div>
                                            )}
                                            {formStep === 3 && (
                                                <motion.div key={3} custom={direction} variants={carouselVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                                                    <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2">Partnership Details</h2>
                                                    <p className="text-gray-300 text-center mb-8">Just a few more questions.</p>
                                                    <FormInput icon={<Tag className="w-5 h-5 text-gray-300"/>} type="text" name="creatorCode" placeholder="Desired Creator Code" value={formData.creatorCode} onChange={handleInputChange} required />
                                                    <FormTextarea icon={<MessageSquare className="w-5 h-5 text-gray-300"/>} name="whyPartner" placeholder="Why do you want to be a TaskPartner?" value={formData.whyPartner} onChange={handleInputChange} rows={4} required></FormTextarea>
                                                    <FormInput icon={<Link2 className="w-5 h-5 text-gray-300"/>} type="text" name="referral" placeholder="Referred by (Optional)" value={formData.referral} onChange={handleInputChange} />
                                                    <button type="submit" disabled={isSubmitting} className="w-full inline-flex items-center justify-center bg-white text-[#635bff] font-semibold py-3 px-8 rounded-xl hover:bg-gray-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none">
                                                        {isSubmitting ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Submitting...</>) : (<>Submit Application <Send className="w-4 h-4 ml-2" /></>)}
                                                    </button>
                                                </motion.div>
                                            )}
                                            {formStep === 4 && (
                                                <motion.div key={4} custom={direction} variants={carouselVariants} initial="enter" animate="center" exit="exit" className="text-center py-12 flex flex-col items-center justify-center">
                                                    <CheckCircle className="w-20 h-20 text-white mx-auto mb-6"/>
                                                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">Application Received!</h3>
                                                    <p className="text-gray-300 max-w-sm mx-auto">We'll get back to you within 3–5 business days.</p>
                                                    <button type="button" onClick={resetForm} className="mt-8 bg-white text-[#635bff] font-semibold py-3 px-8 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none">Done</button>
                                                </motion.div>
                                            )}
                                            {formStep === 5 && (
                                                <motion.div key={5} custom={direction} variants={carouselVariants} initial="enter" animate="center" exit="exit" className="text-center py-12 flex flex-col items-center justify-center">
                                                    <AlertTriangle className="w-20 h-20 text-red-400 mx-auto mb-6"/>
                                                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">Submission Failed</h3>
                                                    <p className="text-gray-300 max-w-sm mx-auto">{formError || "Something went wrong."}</p>
                                                    <button type="button" onClick={() => { setDirection(-1); setFormStep(3); }} className="mt-8 bg-white text-[#635bff] font-semibold py-3 px-8 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none">Try Again</button>
                                                </motion.div>
                                            )}
                                        </form>
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>

        <footer className="py-24">
          <div className="container mx-auto px-6 text-center">
            <h3 className="font-bold text-white mb-4">Follow Our Socials</h3>
            <div className="flex flex-col space-y-4 max-w-md mx-auto">
              <a href="https://www.instagram.com/taskmasteroneai/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-[#635bff] text-white p-4 rounded-xl hover:bg-indigo-500 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/instagram-logo.png?alt=media&token=1620382b-3e8f-46ed-901e-e9ec6356ceb7" alt="Instagram Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <span className="font-semibold">Instagram</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400"/>
              </a>
              <a href="https://www.tiktok.com/@taskmasterai" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-[#635bff] text-white p-4 rounded-xl hover:bg-indigo-500 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/tiktok-logo.png?alt=media&token=de834810-541b-4761-a6b5-113bc57d40a8" alt="TikTok Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <span className="font-semibold">TikTok</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400"/>
              </a>
            </div>
          </div>
        </footer>

<AnimatePresence>
  {showReferralModal && (
    <motion.div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 [will-change:opacity]"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
        exit: { opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
      }}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={() => !isSubmittingReferral && setShowReferralModal(false)}
    >
      <motion.div
        className="bg-[#635bff] rounded-3xl p-8 shadow-2xl w-full max-w-lg relative [will-change:transform,opacity]"
        variants={{
          hidden: { opacity: 0, scale: 0.95, y: 20 },
          visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
          exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2, ease: 'easeIn' } },
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => setShowReferralModal(false)} 
          className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 disabled:opacity-50"
          disabled={isSubmittingReferral}
        >
          <X className="w-6 h-6"/>
        </button>

        {referralSuccess ? (
          <div className="text-center py-12 flex flex-col items-center justify-center min-h-[400px]">
            <CheckCircle className="w-20 h-20 text-white mx-auto mb-6"/>
            <h3 className="text-2xl font-bold text-white mb-3">Referral Sent!</h3>
            <p className="text-gray-300 max-w-sm mx-auto">Thank you! If your friend is accepted, you'll receive your bonus.</p>
          </div>
        ) : (
          <form onSubmit={handleReferralSubmit} className="space-y-6">
            <h2 className="text-3xl font-bold text-white text-center mb-2">Refer a Friend</h2>
            <p className="text-gray-300 text-center mb-6 whitespace-nowrap">Enter your creator email and your friend's info.</p>
            
            <FormInput icon={<Mail className="w-5 h-5 text-gray-300"/>} type="email" name="referrerEmail" placeholder="Your Creator Email Address" value={referralFormData.referrerEmail} onChange={handleReferralInputChange} required />
            <FormInput icon={<User className="w-5 h-5 text-gray-300"/>} type="text" name="friendName" placeholder="Friend's Full Name" value={referralFormData.friendName} onChange={handleReferralInputChange} required />
            <FormInput icon={<Mail className="w-5 h-5 text-gray-300"/>} type="email" name="friendEmail" placeholder="Friend's Email Address" value={referralFormData.friendEmail} onChange={handleReferralInputChange} required />
            <FormInput icon={<AtSign className="w-5 h-5 text-gray-300"/>} type="text" name="friendTiktok" placeholder="Friend's TikTok Handle" value={referralFormData.friendTiktok} onChange={handleReferralInputChange} required />
            
            {referralError && (
              <div className="text-red-300 bg-red-500/20 p-3 rounded-lg flex items-start text-sm">
                <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <span className="whitespace-normal sm:whitespace-nowrap">{referralError}</span>
              </div>
            )}

            <button type="submit" disabled={isSubmittingReferral} className="w-full inline-flex items-center justify-center bg-white text-[#635bff] font-semibold py-3 px-8 rounded-xl hover:bg-gray-200 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed focus:outline-none">
              {isSubmittingReferral ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Submitting...</>) : (<>Submit Referral <Send className="w-4 h-4 ml-2" /></>)}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
      </main>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
        .font-poppins {
          font-family: 'Poppins', sans-serif;
        }
        .bg-grid-indigo {
          background-image: linear-gradient(#635bff 1px, transparent 1px), linear-gradient(to right, #635bff 1px, transparent 1px);
          background-size: 30px 30px;
          opacity: 0.1;
        }
      `}</style>
    </div>
  );
}
