import { Button } from '@/components/ui/button'

const AlternativesToNotion = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#635BFF] to-[#8A85FF] bg-clip-text text-transparent leading-tight">
          Why Students Are Switching from Notion to TaskMaster AI
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          While Notion is powerful, it wasn't built specifically for students. TaskMaster AI offers everything you love about Notion, plus intelligent features designed specifically for academic success.
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-12">
        <section className="bg-red-900/20 p-8 rounded-lg border border-red-700/30">
          <h2 className="text-3xl font-bold text-white mb-6">The Notion Challenge for Students</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-xl font-semibold text-red-400 mb-3">Complexity Overwhelm</h3>
              <p className="text-gray-300">
                Notion's flexibility can be overwhelming for students who just want to focus on learning. Setting up templates, databases, and workflows takes time away from actual studying.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-red-400 mb-3">Lack of AI-Powered Learning Features</h3>
              <p className="text-gray-300">
                Notion stores information but doesn't help you learn from it. You can't automatically generate flashcards, create quiz questions, or transform video content into study materials.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-red-400 mb-3">Generic Productivity Focus</h3>
              <p className="text-gray-300">
                Notion serves everyone from business teams to personal users, but students have unique needs that require specialized tools and workflows.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">How TaskMaster AI Solves Student-Specific Problems</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Purpose-Built for Academic Success</h3>
                <p className="text-gray-300 mb-3">Every feature is designed with student workflows in mind:</p>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• <strong className="text-white">Semester Planning:</strong> Organize by courses, not just projects</li>
                  <li>• <strong className="text-white">Assignment Tracking:</strong> Built-in deadline management and priority systems</li>
                  <li>• <strong className="text-white">Study Session Integration:</strong> Connect notes directly to focused study time</li>
                  <li>• <strong className="text-white">Grade and Progress Tracking:</strong> Monitor academic performance over time</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Intelligent Content Processing</h3>
                <p className="text-gray-300 mb-3">Unlike Notion's static pages, TaskMaster AI actively helps you learn:</p>
                <ul className="space-y-1 text-gray-300 text-sm">
                  <li>• <strong className="text-white">Auto-Generated Study Aids:</strong> Turn any content into flashcards and quizzes</li>
                  <li>• <strong className="text-white">Smart Summarization:</strong> Get key points from lengthy materials instantly</li>
                  <li>• <strong className="text-white">Cross-Content Connections:</strong> AI identifies relationships between different topics</li>
                  <li>• <strong className="text-white">Personalized Learning Paths:</strong> Adapt to your unique learning style and pace</li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Effortless Setup and Organization</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Quick Start Templates:</strong> Pre-built structures for common student needs</li>
                  <li><strong className="text-white">Automatic Organization:</strong> AI suggests folder structures and tagging systems</li>
                  <li><strong className="text-white">Minimal Configuration:</strong> Start being productive immediately, not after hours of setup</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">When to Choose TaskMaster AI Over Notion</h3>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• You're overwhelmed by Notion's complexity</li>
                  <li>• You want AI to enhance your learning</li>
                  <li>• You're focused on academic success</li>
                  <li>• You value quick implementation</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Feature Comparison: TaskMaster AI vs. Notion</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-700">
              <thead>
                <tr className="bg-gray-800">
                  <th className="border border-gray-700 p-4 text-left text-white">Feature Category</th>
                  <th className="border border-gray-700 p-4 text-left text-[#8A85FF]">TaskMaster AI</th>
                  <th className="border border-gray-700 p-4 text-left text-gray-400">Notion</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-700 p-4 text-white font-semibold">Content Creation & Management</td>
                  <td className="border border-gray-700 p-4 text-gray-300">PDF-to-notes, YouTube-to-notes, AI-generated summaries, smart flashcards</td>
                  <td className="border border-gray-700 p-4 text-gray-400">Manual page creation, basic templates, static content organization</td>
                </tr>
                <tr className="bg-gray-800/30">
                  <td className="border border-gray-700 p-4 text-white font-semibold">Study & Learning Tools</td>
                  <td className="border border-gray-700 p-4 text-gray-300">Built-in focus sessions, quiz generation, personalized AI tutoring, progress tracking</td>
                  <td className="border border-gray-700 p-4 text-gray-400">Basic to-do lists, manual progress tracking, no learning-specific features</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 p-4 text-white font-semibold">AI Integration</td>
                  <td className="border border-gray-700 p-4 text-gray-300">Contextual understanding, personalized assistance, proactive suggestions</td>
                  <td className="border border-gray-700 p-4 text-gray-400">Limited AI features, generic responses, no learning optimization</td>
                </tr>
                <tr className="bg-gray-800/30">
                  <td className="border border-gray-700 p-4 text-white font-semibold">Student-Specific Features</td>
                  <td className="border border-gray-700 p-4 text-gray-300">Academic calendars, assignment tracking, study session notes, grade analytics</td>
                  <td className="border border-gray-700 p-4 text-gray-400">Generic project management, requires manual setup for student workflows</td>
                </tr>
                <tr>
                  <td className="border border-gray-700 p-4 text-white font-semibold">Customization & Flexibility</td>
                  <td className="border border-gray-700 p-4 text-gray-300">Streamlined experience with intelligent automation</td>
                  <td className="border border-gray-700 p-4 text-green-400">Unlimited customization with databases, templates, and complex workflows</td>
                </tr>
                <tr className="bg-gray-800/30">
                  <td className="border border-gray-700 p-4 text-white font-semibold">Collaboration Features</td>
                  <td className="border border-gray-700 p-4 text-gray-300">Basic sharing features focused on study groups and peer learning</td>
                  <td className="border border-gray-700 p-4 text-green-400">Robust team collaboration with advanced sharing and permission controls</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#635BFF]/10 to-[#8A85FF]/10 p-8 rounded-lg border border-[#635BFF]/20">
          <h2 className="text-3xl font-bold text-white mb-6">Other Notion Alternatives Worth Considering</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-4">For Simple Note-Taking</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-white">Obsidian</h4>
                  <p className="text-gray-300 text-sm">Great for students who prefer markdown and linking concepts</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Logseq</h4>
                  <p className="text-gray-300 text-sm">Privacy-focused with good backlinking features</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white">RemNote</h4>
                  <p className="text-gray-300 text-sm">Combines note-taking with spaced repetition</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-4">For Project Management</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-white">ClickUp</h4>
                  <p className="text-gray-300 text-sm">Comprehensive project management with academic templates</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Todoist</h4>
                  <p className="text-gray-300 text-sm">Simple task management with educational discounts</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Trello</h4>
                  <p className="text-gray-300 text-sm">Visual project organization with student-friendly pricing</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-[#4E46DC]/20 rounded-lg border border-[#4E46DC]/30">
            <h4 className="font-semibold text-white mb-2">Why TaskMaster AI Still Wins for Students</h4>
            <p className="text-gray-300 text-sm">
              While these alternatives excel in specific areas, TaskMaster AI uniquely combines AI-powered content transformation, 
              student-specific workflow optimization, integrated learning and productivity tools, and personalized academic assistance.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Making the Switch: Migration Made Easy</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-4">From Notion to TaskMaster AI</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#4E46DC] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Export Your Content</h4>
                    <p className="text-gray-300 text-sm">Download your Notion pages as markdown or PDF</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#4E46DC] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Import to TaskMaster AI</h4>
                    <p className="text-gray-300 text-sm">Use our PDF-to-notes feature to process your content</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#4E46DC] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Enhance with AI</h4>
                    <p className="text-gray-300 text-sm">Let TaskMaster AI generate study aids from your existing materials</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#4E46DC] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Optimize Your Workflow</h4>
                    <p className="text-gray-300 text-sm">Set up personalized contexts and learning preferences</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-4">What You'll Gain</h3>
              <ul className="space-y-3 text-gray-300">
                <li><strong className="text-white">Time Savings:</strong> Automated content processing and organization</li>
                <li><strong className="text-white">Better Learning:</strong> AI-generated study materials and personalized assistance</li>
                <li><strong className="text-white">Improved Focus:</strong> Purpose-built tools for academic success</li>
                <li><strong className="text-white">Measurable Progress:</strong> Analytics and tracking specific to student needs</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="text-center bg-gradient-to-r from-[#635BFF]/20 to-[#8A85FF]/20 p-8 rounded-lg border border-[#635BFF]/30">
          <h2 className="text-2xl font-bold text-white mb-4">The Bottom Line</h2>
          <p className="text-gray-300 mb-6 max-w-3xl mx-auto">
            TaskMaster AI and Notion serve different needs in the student productivity space. TaskMaster AI excels as a learning-focused platform with AI-powered features that actively help you study better. Notion excels as a flexible workspace for complex organizational needs.
          </p>
          <p className="text-lg font-semibold text-[#8A85FF] mb-6">
            For most students, TaskMaster AI provides better value because it's specifically designed for academic workflows and requires minimal setup to achieve maximum productivity.
          </p>
        </section>

        <div className="text-center py-8">
          <Button 
            className="bg-[#4E46DC] hover:bg-[#4E46DC]/90 text-white px-8 py-3 text-lg font-semibold rounded-lg"
            onClick={() => window.open('https://www.taskmaster.one', '_blank')}
          >
            Ready to experience productivity tools designed specifically for students?
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AlternativesToNotion

