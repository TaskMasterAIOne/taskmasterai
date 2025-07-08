import { Button } from '@/components/ui/button'

const AINotesTaking = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#635BFF] to-[#8A85FF] bg-clip-text text-transparent leading-tight">
          Revolutionary AI Note-Taking That Actually Understands Your Content
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          Stop spending hours creating notes manually. TaskMaster AI transforms any source into structured, intelligent notes that enhance your learning.
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-12">
        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Beyond Traditional Note-Taking</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Multi-Source Note Creation</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Personal Notes:</strong> Create rich, formatted notes with tables, diagrams, and equations</li>
                  <li><strong className="text-white">PDF Intelligence:</strong> Upload academic papers, textbooks, or reports for instant summarization</li>
                  <li><strong className="text-white">Video to Notes:</strong> Convert YouTube lectures and tutorials into comprehensive study guides</li>
                  <li><strong className="text-white">Audio Processing:</strong> Transform recorded lectures into organized, searchable notes</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Smart Organization & Retrieval</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Hierarchical Folders:</strong> Organize notes by subject, project, or topic with nested folder structures</li>
                  <li><strong className="text-white">Intelligent Search:</strong> Find specific information across all your notes instantly</li>
                  <li><strong className="text-white">Content Filtering:</strong> Sort by source type (Personal, PDF, YouTube, Audio) for quick access</li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">AI-Enhanced Features</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Automatic Summarization:</strong> Get concise overviews of lengthy materials</li>
                  <li><strong className="text-white">Key Concept Highlighting:</strong> AI identifies and emphasizes the most important information</li>
                  <li><strong className="text-white">Cross-Reference Linking:</strong> Connect related concepts across different notes automatically</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Rich Formatting Support</h3>
                <p className="text-gray-300 mb-3">Create notes that are visually clear and easy to study:</p>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• Mathematical equations and formulas</li>
                  <li>• Tables and charts</li>
                  <li>• Diagrams and flowcharts</li>
                  <li>• Markdown formatting</li>
                  <li>• Emoji and visual elements</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#635BFF]/10 to-[#8A85FF]/10 p-8 rounded-lg border border-[#635BFF]/20">
          <h2 className="text-3xl font-bold text-white mb-6">Why Students Choose TaskMaster AI for Note-Taking</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Save Hours of Manual Work</h3>
              <p className="text-gray-300 mb-4">
                Transform a 2-hour lecture video into organized notes in minutes, not hours. Our AI processes content faster than humanly possible while maintaining accuracy and context.
              </p>
              
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Never Miss Important Details</h3>
              <p className="text-gray-300">
                AI extraction ensures that crucial information isn't overlooked. Whether it's a subtle concept in a textbook or a key point mentioned briefly in a video, TaskMaster AI captures it all.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Universal Compatibility</h3>
              <p className="text-gray-300 mb-3">Works with any content source:</p>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li>• Academic PDFs and research papers</li>
                <li>• Educational YouTube videos</li>
                <li>• Recorded lectures and seminars</li>
                <li>• Typed or handwritten text</li>
                <li>• Online articles and blogs</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Real Student Success Stories</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-800/30 p-6 rounded-lg border border-gray-700">
              <p className="text-gray-300 italic mb-4">
                "TaskMaster AI cut my study prep time in half. I can now process entire textbook chapters in minutes instead of hours."
              </p>
              <p className="text-[#8A85FF] font-semibold">- Sarah, Pre-Med Student</p>
            </div>
            <div className="bg-gray-800/30 p-6 rounded-lg border border-gray-700">
              <p className="text-gray-300 italic mb-4">
                "The YouTube to notes feature is game-changing. I learn so much from video tutorials, and now I can actually study from them effectively."
              </p>
              <p className="text-[#8A85FF] font-semibold">- Marcus, Computer Science Major</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Advanced Features for Power Users</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Custom AI Personalities</h3>
              <p className="text-gray-300 mb-3">Choose how your AI assistant communicates:</p>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><strong className="text-white">Academic Researcher:</strong> Formal, detailed explanations</li>
                <li><strong className="text-white">Study Buddy:</strong> Casual, encouraging tone</li>
                <li><strong className="text-white">Socratic Tutor:</strong> Question-based learning approach</li>
              </ul>
            </div>
            
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Integration Ready</h3>
              <p className="text-gray-300 mb-3">Connect with your existing workflow:</p>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li>• Export to popular formats</li>
                <li>• Sync across devices</li>
                <li>• Share with study groups</li>
                <li>• Backup to cloud storage</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="text-center py-8">
          <Button 
            className="bg-[#4E46DC] hover:bg-[#4E46DC]/90 text-white px-8 py-3 text-lg font-semibold rounded-lg"
            onClick={() => window.open('https://www.taskmaster.one', '_blank')}
          >
            Experience the future of note-taking. Start your free trial today.
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AINotesTaking

