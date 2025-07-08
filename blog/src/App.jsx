import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'

// Import blog post components
import AIStudyTool from './components/blog/AIStudyTool'
import AINotesTaking from './components/blog/AINotesTaking'
import StudentProductivityApp from './components/blog/StudentProductivityApp'
import AlternativesToNotion from './components/blog/AlternativesToNotion'
import BlogLayout from './components/BlogLayout'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/blog/ai-study-tool" element={
            <BlogLayout>
              <AIStudyTool />
            </BlogLayout>
          } />
          <Route path="/blog/ai-note-taking" element={
            <BlogLayout>
              <AINotesTaking />
            </BlogLayout>
          } />
          <Route path="/blog/student-productivity-app" element={
            <BlogLayout>
              <StudentProductivityApp />
            </BlogLayout>
          } />
          <Route path="/blog/alternatives-to-notion-for-students" element={
            <BlogLayout>
              <AlternativesToNotion />
            </BlogLayout>
          } />
          {/* Default route redirects to first blog post */}
          <Route path="/" element={
            <BlogLayout>
              <AIStudyTool />
            </BlogLayout>
          } />
        </Routes>
      </div>
    </Router>
  )
}

export default App

