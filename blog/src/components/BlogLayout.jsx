import { Button } from '@/components/ui/button'

const BlogLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#0C0E1A] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0C0E1A]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-[#635BFF] to-[#8A85FF] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-[#635BFF] to-[#8A85FF] bg-clip-text text-transparent">
                TaskMaster AI
              </h1>
            </div>
            <Button 
              className="bg-[#4E46DC] hover:bg-[#4E46DC]/90 text-white px-6 py-2 rounded-lg font-medium"
              onClick={() => window.open('https://www.taskmaster.one', '_blank')}
            >
              Start Today - It's Free
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <article className="prose prose-invert prose-lg max-w-none">
          {children}
        </article>
      </main>

      {/* Footer CTA */}
      <footer className="bg-gradient-to-r from-[#635BFF] to-[#8A85FF] py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Study Experience?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of students who've revolutionized their learning with TaskMaster AI.
          </p>
          <Button 
            className="bg-white text-[#4E46DC] hover:bg-gray-100 px-8 py-3 text-lg font-semibold rounded-lg"
            onClick={() => window.open('https://www.taskmaster.one', '_blank')}
          >
            Start Your Free Trial Today
          </Button>
        </div>
      </footer>
    </div>
  )
}

export default BlogLayout

