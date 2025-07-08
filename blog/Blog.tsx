export default function Blog() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0C0E1A',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid #2a2d3a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #635BFF, #8A85FF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          TaskMaster AI
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <a href="https://www.taskmaster.one" style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#4E46DC',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.9rem'
          }}>
            Get Started
          </a>
          <a href="https://www.taskmaster.one" style={{
            padding: '0.5rem 1rem',
            border: '1px solid #4E46DC',
            color: '#4E46DC',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.9rem'
          }}>
            Learn More
          </a>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #635BFF, #8A85FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            TaskMaster AI Blog
          </h1>
          <p style={{
            fontSize: '1.2rem',
            color: '#9ca3af',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Discover insights, tips, and strategies to enhance your academic journey with AI-powered productivity tools.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          <article style={{
            backgroundColor: '#1a1d2e',
            borderRadius: '0.75rem',
            border: '1px solid #2a2d3a',
            padding: '2rem',
            transition: 'transform 0.2s ease, border-color 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = '#4E46DC';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = '#2a2d3a';
          }}
          onClick={() => window.location.href = '/blog/ai-study-tool'}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#4E46DC'
              }}></div>
              <span style={{
                fontSize: '0.9rem',
                color: '#9ca3af'
              }}>
                December 15, 2024 • 5 min read
              </span>
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: '#8A85FF'
            }}>
              AI Study Tool: Revolutionizing How Students Learn
            </h2>
            <p style={{
              color: '#d1d5db',
              lineHeight: '1.6',
              marginBottom: '1.5rem'
            }}>
              Discover how AI study tools are transforming the learning experience with personalized approaches, intelligent content generation, and adaptive learning paths that evolve with your progress.
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                AI Learning
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Study Tools
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Education
              </span>
            </div>
          </article>

          <article style={{
            backgroundColor: '#1a1d2e',
            borderRadius: '0.75rem',
            border: '1px solid #2a2d3a',
            padding: '2rem',
            transition: 'transform 0.2s ease, border-color 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = '#4E46DC';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = '#2a2d3a';
          }}
          onClick={() => window.location.href = '/blog/ai-note-taking'}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#4E46DC'
              }}></div>
              <span style={{
                fontSize: '0.9rem',
                color: '#9ca3af'
              }}>
                December 12, 2024 • 6 min read
              </span>
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: '#8A85FF'
            }}>
              AI Note-Taking: The Smart Way to Capture and Organize Knowledge
            </h2>
            <p style={{
              color: '#d1d5db',
              lineHeight: '1.6',
              marginBottom: '1.5rem'
            }}>
              Learn how AI-powered note-taking transforms passive recording into active learning assistance with intelligent transcription, contextual understanding, and smart organization features.
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Note-Taking
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                AI Technology
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Organization
              </span>
            </div>
          </article>

          <article style={{
            backgroundColor: '#1a1d2e',
            borderRadius: '0.75rem',
            border: '1px solid #2a2d3a',
            padding: '2rem',
            transition: 'transform 0.2s ease, border-color 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = '#4E46DC';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = '#2a2d3a';
          }}
          onClick={() => window.location.href = '/blog/student-productivity-app'}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#4E46DC'
              }}></div>
              <span style={{
                fontSize: '0.9rem',
                color: '#9ca3af'
              }}>
                December 10, 2024 • 7 min read
              </span>
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: '#8A85FF'
            }}>
              Student Productivity Apps: Your Digital Academic Assistant
            </h2>
            <p style={{
              color: '#d1d5db',
              lineHeight: '1.6',
              marginBottom: '1.5rem'
            }}>
              Explore how modern productivity apps help students manage time, track progress, and achieve academic goals with intelligent scheduling, task management, and progress analytics.
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Productivity
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Time Management
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Student Apps
              </span>
            </div>
          </article>

          <article style={{
            backgroundColor: '#1a1d2e',
            borderRadius: '0.75rem',
            border: '1px solid #2a2d3a',
            padding: '2rem',
            transition: 'transform 0.2s ease, border-color 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = '#4E46DC';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = '#2a2d3a';
          }}
          onClick={() => window.location.href = '/blog/alternatives-to-notion-for-students'}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#4E46DC'
              }}></div>
              <span style={{
                fontSize: '0.9rem',
                color: '#9ca3af'
              }}>
                December 8, 2024 • 8 min read
              </span>
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: '#8A85FF'
            }}>
              Best Alternatives to Notion for Students: Finding Your Perfect Study Companion
            </h2>
            <p style={{
              color: '#d1d5db',
              lineHeight: '1.6',
              marginBottom: '1.5rem'
            }}>
              Discover the best Notion alternatives for students, from simple note-taking apps to specialized research tools, and find the perfect study companion for your academic needs.
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Notion Alternatives
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Study Tools
              </span>
              <span style={{
                backgroundColor: '#4E46DC20',
                color: '#8A85FF',
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                fontSize: '0.8rem'
              }}>
                Comparison
              </span>
            </div>
          </article>
        </div>

        <div style={{
          backgroundColor: '#1a1d2e',
          padding: '3rem 2rem',
          borderRadius: '1rem',
          border: '1px solid #2a2d3a',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #635BFF, #8A85FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Ready to Transform Your Academic Journey?
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: '#d1d5db',
            marginBottom: '2rem',
            maxWidth: '600px',
            margin: '0 auto 2rem auto'
          }}>
            Join thousands of students who are already using TaskMaster AI to boost their productivity, improve their grades, and achieve their academic goals.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="https://www.taskmaster.one" style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              backgroundColor: '#4E46DC',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d37b8'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4E46DC'}>
              Get Started Free
            </a>
            <a href="https://www.taskmaster.one" style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              border: '2px solid #4E46DC',
              color: '#4E46DC',
              textDecoration: 'none',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4E46DC';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#4E46DC';
            }}>
              Learn More
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
