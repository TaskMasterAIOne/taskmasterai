import { Button } from '@/components/ui/button'

const StudentProductivityApp = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#635BFF] to-[#8A85FF] bg-clip-text text-transparent leading-tight">
          The Complete Student Productivity Solution
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          TaskMaster AI combines intelligent task management, AI-powered study tools, and personalized learning assistance in one comprehensive platform designed specifically for student success.
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-12">
        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Everything You Need to Excel as a Student</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Intelligent Task & Goal Management</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Smart Scheduling:</strong> Prioritize assignments and deadlines with AI-suggested time blocks</li>
                  <li><strong className="text-white">Recurring Tasks:</strong> Set up habits and regular study sessions for consistent progress</li>
                  <li><strong className="text-white">Goal Tracking:</strong> Define academic objectives and track progress with detailed analytics</li>
                  <li><strong className="text-white">Priority Matrix:</strong> Organize tasks by importance and urgency for maximum efficiency</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">AI-Powered Study Ecosystem</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Unified Dashboard:</strong> Central command center for all your academic activities</li>
                  <li><strong className="text-white">Focus Sessions:</strong> Pomodoro-style study blocks with session notes and goal setting</li>
                  <li><strong className="text-white">Progress Gamification:</strong> Earn points, maintain streaks, and unlock achievements</li>
                  <li><strong className="text-white">Performance Analytics:</strong> Understand your productivity patterns and optimize your schedule</li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Seamless Content Integration</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Multi-Format Support:</strong> Work with PDFs, videos, audio, and text seamlessly</li>
                  <li><strong className="text-white">Cross-Platform Sync:</strong> Access your materials on any device, anywhere</li>
                  <li><strong className="text-white">Collaborative Features:</strong> Share notes and folders with study groups</li>
                  <li><strong className="text-white">Version Control:</strong> Track changes and revisions in your study materials</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Key Features That Set Us Apart</h3>
                <ul className="space-y-2 text-gray-300">
                  <li><strong className="text-white">Contextual AI Understanding:</strong> Learns about your major, learning style, and goals</li>
                  <li><strong className="text-white">Proactive Suggestions:</strong> Intelligent recommendations for study schedules and priorities</li>
                  <li><strong className="text-white">Comprehensive Analytics:</strong> Track productivity metrics and progress toward goals</li>
                  <li><strong className="text-white">Future-Ready Integrations:</strong> Upcoming connections with Google Calendar, Drive, and Notion</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-[#635BFF]/10 to-[#8A85FF]/10 p-8 rounded-lg border border-[#635BFF]/20">
          <h2 className="text-3xl font-bold text-white mb-6">Designed for Modern Student Life</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Handle Heavy Course Loads</h3>
              <p className="text-gray-300 mb-4">
                Manage multiple classes, projects, and extracurriculars without falling behind. TaskMaster AI helps you stay organized and focused on what matters most.
              </p>
              
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Prepare for High-Stakes Exams</h3>
              <p className="text-gray-300">
                Create comprehensive study plans, generate practice materials, and track your preparation progress. Turn exam anxiety into confident preparation.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Balance Academic and Personal Life</h3>
              <p className="text-gray-300 mb-4">
                Integrate personal tasks, social commitments, and self-care into your academic schedule. Maintain balance while achieving your goals.
              </p>
              
              <h3 className="text-xl font-semibold text-[#8A85FF] mb-3">Develop Professional Skills</h3>
              <p className="text-gray-300">
                Build time management, organization, and analytical skills that will serve you throughout your career. TaskMaster AI is training for professional success.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Success Metrics Our Users Report</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center bg-gray-800/30 p-6 rounded-lg border border-gray-700">
              <div className="text-3xl font-bold text-[#8A85FF] mb-2">67%</div>
              <p className="text-gray-300 text-sm">reduction in time spent organizing study materials</p>
            </div>
            <div className="text-center bg-gray-800/30 p-6 rounded-lg border border-gray-700">
              <div className="text-3xl font-bold text-[#8A85FF] mb-2">45%</div>
              <p className="text-gray-300 text-sm">improvement in assignment completion rates</p>
            </div>
            <div className="text-center bg-gray-800/30 p-6 rounded-lg border border-gray-700">
              <div className="text-3xl font-bold text-[#8A85FF] mb-2">78%</div>
              <p className="text-gray-300 text-sm">of users report better work-life balance</p>
            </div>
            <div className="text-center bg-gray-800/30 p-6 rounded-lg border border-gray-700">
              <div className="text-3xl font-bold text-[#8A85FF] mb-2">89%</div>
              <p className="text-gray-300 text-sm">satisfaction rate among daily active users</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-white mb-6">Getting Started is Simple</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">1</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Set Up Your Profile</h3>
              <p className="text-gray-300 text-sm">Tell us about your major, goals, and learning preferences</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">2</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Import Your Content</h3>
              <p className="text-gray-300 text-sm">Upload syllabi, readings, and existing notes</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">3</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Create Your Schedule</h3>
              <p className="text-gray-300 text-sm">Set up tasks, goals, and study sessions</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#4E46DC] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold">4</span>
              </div>
              <h3 className="font-semibold text-white mb-2">Let AI Optimize</h3>
              <p className="text-gray-300 text-sm">Receive personalized suggestions and automated assistance</p>
            </div>
          </div>
        </section>

        <div className="text-center py-8">
          <Button 
            className="bg-[#4E46DC] hover:bg-[#4E46DC]/90 text-white px-8 py-3 text-lg font-semibold rounded-lg"
            onClick={() => window.open('https://www.taskmaster.one', '_blank')}
          >
            Join thousands of students who've transformed their academic performance
          </Button>
        </div>
      </div>
    </div>
  )
}

export default StudentProductivityApp

