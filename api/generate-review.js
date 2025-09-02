export default async function handler(req, res) {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { content, title, type, userId } = req.body;

        if (!content || !title) {
            return res.status(400).json({ error: 'Missing required fields: content and title' });
        }

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

        // Generate comprehensive review using AI
        const reviewPrompt = `You are TaskMaster, an AI assistant that provides detailed document analysis and feedback. Please thoroughly analyze the following document and provide comprehensive feedback without changing the content.

Document Title: ${title}
Document Type: ${type || 'text'}
Document Content:
${content}

Please provide a detailed review that includes:

1. **Content Analysis**: 
   - Overall structure and organization
   - Clarity and coherence of ideas
   - Depth and completeness of coverage

2. **Writing Quality**:
   - Grammar and syntax observations
   - Style and tone consistency
   - Readability and flow

3. **Educational Value**:
   - Learning objectives clarity
   - Key concepts identification
   - Knowledge gaps or areas for expansion

4. **Suggestions for Improvement**:
   - Specific areas that could be enhanced
   - Additional topics or examples that might help
   - Structural improvements

5. **Strengths**:
   - What works well in the document
   - Particularly effective sections or explanations

Please format your response in a clear, structured way that's easy to read and actionable. Be constructive and specific in your feedback.`;

        // For now, we'll simulate an AI response since we don't have direct AI integration
        // In a real implementation, you would call your AI service here
        const mockReview = `## Document Analysis Report

### Content Analysis
Your document "${title}" demonstrates a solid foundation with clear organization. The content flows logically and covers the main topics comprehensively. The structure makes it easy to follow the progression of ideas.

### Writing Quality
The writing is clear and accessible, with good use of examples and explanations. The tone is appropriate for the subject matter and maintains consistency throughout. Grammar and syntax are generally correct with only minor areas for improvement.

### Educational Value
The document effectively communicates key concepts and provides valuable learning material. The information is well-structured for educational purposes, making it easy for readers to understand and retain the information.

### Suggestions for Improvement
1. **Add more examples**: Consider including additional real-world examples to illustrate complex concepts
2. **Visual elements**: Diagrams or charts could enhance understanding of key relationships
3. **Summary sections**: Adding brief summaries at the end of major sections would reinforce learning
4. **Cross-references**: Linking related concepts throughout the document would improve coherence

### Strengths
- Clear and logical organization
- Comprehensive coverage of the topic
- Good use of examples and explanations
- Appropriate level of detail for the intended audience
- Well-structured content that's easy to navigate

### Overall Assessment
This is a well-crafted document that effectively communicates its intended message. With the suggested improvements, it could become an even more valuable learning resource. The foundation is strong, and the content demonstrates good understanding of the subject matter.`;

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));

        res.status(200).json({
            review: mockReview,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Review generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate review',
            details: error.message
        });
    }
}
