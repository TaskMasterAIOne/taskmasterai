# TaskMaster AI Blog

A React-based blog application featuring SEO-optimized content for TaskMaster AI, designed to enhance AI SEO performance and showcase the platform's capabilities for students.

## Features

- **4 SEO-Optimized Blog Posts**:
  - AI Study Tool (`/blog/ai-study-tool`)
  - AI Note-Taking (`/blog/ai-note-taking`)
  - Student Productivity App (`/blog/student-productivity-app`)
  - Alternatives to Notion for Students (`/blog/alternatives-to-notion-for-students`)

- **TaskMaster AI Branding**:
  - Primary Button Color: `#4E46DC`
  - Gradient (logo & accent): From `#635BFF` to `#8A85FF`
  - Dark Mode Background: `#0C0E1A`

- **Modern Design Features**:
  - Responsive design for desktop and mobile
  - Smooth animations and hover effects
  - Professional typography and spacing
  - SEO-optimized meta tags and structure

## Technology Stack

- **React 18** with Vite
- **Tailwind CSS** for styling
- **React Router** for navigation
- **shadcn/ui** components
- **Lucide React** icons

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd taskmaster-blog
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Available Scripts

- `pnpm run dev` - Start development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build
- `pnpm run lint` - Run ESLint

## Project Structure

```
src/
├── components/
│   ├── blog/
│   │   ├── AIStudyTool.jsx
│   │   ├── AINotesTaking.jsx
│   │   ├── StudentProductivityApp.jsx
│   │   └── AlternativesToNotion.jsx
│   ├── ui/
│   └── BlogLayout.jsx
├── App.jsx
├── App.css
└── main.jsx
```

## Blog Post URLs

The application supports the following routes:

- `/` - Redirects to AI Study Tool blog post
- `/blog/ai-study-tool` - AI Study Tool content
- `/blog/ai-note-taking` - AI Note-Taking content  
- `/blog/student-productivity-app` - Student Productivity App content
- `/blog/alternatives-to-notion-for-students` - Alternatives to Notion content

## SEO Optimization

Each blog post is optimized for search engines with:

- Semantic HTML structure
- Proper heading hierarchy (H1, H2, H3)
- Meta descriptions and keywords
- Open Graph tags for social sharing
- Structured content for better readability
- Internal linking and call-to-action buttons

## Deployment

To deploy this application:

1. Build the project:
```bash
pnpm run build
```

2. Deploy the `dist` folder to your hosting provider

The application is designed to work with static hosting providers like Vercel, Netlify, or GitHub Pages.

## Customization

### Colors
The TaskMaster AI color scheme is defined in `src/App.css`:
- Primary: `#4E46DC`
- Gradient: `#635BFF` to `#8A85FF`
- Background: `#0C0E1A`

### Content
Blog post content can be modified in the respective component files under `src/components/blog/`.

### Styling
Additional styles can be added to `src/App.css` or using Tailwind CSS classes directly in components.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary to TaskMaster AI.

