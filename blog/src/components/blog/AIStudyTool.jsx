import { Button } from '@/components/ui/button'

const AIStudyTool = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#635BFF] to-[#8A85FF] bg-clip-text text-transparent leading-tight">
          Transform Your Study Sessions with AI-Powered Learning
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          TaskMaster AI is the intelligent study companion that converts any content into personalized learning materials, helping students achieve better grades with less effort.
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-12">
        <section>
          <h2 className="text-3xl font-bold text-white mb-6">What Makes TaskMaster AI the Ultimate Study Tool?</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Instant Content Transformation</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">PDF to Notes:</strong> Upload textbooks, research papers, or lecture slides and get structured, digestible notes instantly</li>
                  <li><strong className="text-white">YouTube to Notes:</strong> Convert educational videos into comprehensive study guides with key concepts and summaries</li>
                  <li><strong className="text-white">Text to Notes:</strong> Paste any content and watch our AI organize it into clear, actionable study material</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">AI-Generated Study Aids</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Smart Flashcards:</strong> Automatically create flashcards from your notes and folders</li>
                  <li><strong className="text-white">Custom Quiz Questions:</strong> Generate practice questions tailored to your study materials</li>
                  <li><strong className="text-white">Key Concept Extraction:</strong> Identify and explain the most important topics from any content</li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Personalized Learning Experience</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Universal Context:</strong> Tell TaskMaster AI about your major, goals, and learning style for perfectly tailored assistance</li>
                  <li><strong className="text-white">Custom AI Styles:</strong> Choose from tutoring personalities like "Socratic Tutor" or "Concise Professional"</li>
                  <li><strong className="text-white">Memory System:</strong> The AI remembers your preferences and adapts to your learning patterns</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Focus & Productivity Features</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Smart Focus Sessions:</strong> Timed study blocks with goal-setting and progress tracking</li>
                  <li><strong className="text-white">Task Management:</strong> Organize assignments, deadlines, and study priorities</li>
                  <li><strong className="text-white">Progress Gamification:</strong> Earn points, levels, and badges to stay motivated</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#635BFF]/10 to-[#8A85FF]/10 p-8 rounded-lg border border-[#635BFF]/20">
          <h2 className="text-3xl font-bold text-white mb-6">Perfect for Every Student</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-[#8A85FF] mb-2">High School Students</h3>
              <p className="text-gray-300">Master complex subjects, prepare for exams, and stay organized with assignments</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#8A85FF] mb-2">College Students</h3>
              <p className="text-gray-300">Handle heavy course loads, research projects, and comprehensive exam preparation</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#8A85FF] mb-2">Graduate Students</h3>
              <p className="text-gray-300">Manage thesis research, literature reviews, and academic writing</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#8A85FF] mb-2">Lifelong Learners</h3>
              <p className="text-gray-300">Organize professional development materials and skill-building content</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Get Started in Minutes</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">1</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Upload Your Content</h3>
              <p className="text-gray-300 text-sm">PDFs, YouTube links, or paste text directly</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">2</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Let AI Work</h3>
              <p className="text-gray-300 text-sm">Watch as complex materials become organized notes</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">3</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Study Smarter</h3>
              <p className="text-gray-300 text-sm">Use generated flashcards, quizzes, and summaries</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">4</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Track Progress</h3>
              <p className="text-gray-300 text-sm">Monitor your learning with built-in analytics</p>
            </div>
          </div>
        </section>

        <div className="text-center py-8">
          <Button 
            className="bg-[#4E46DC] hover:bg-[#4E46DC]/90 text-white px-8 py-3 text-lg font-semibold rounded-lg"
            onClick={() => window.open('https://www.taskmaster.one', '_blank')}
          >
            Start your free trial today and experience the future of studying
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AIStudyTool

