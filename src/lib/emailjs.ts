import emailjs from '@emailjs/browser'

/**
 * EmailJS Configuration
 * 
 * To get these values:
 * 1. Go to https://www.emailjs.com/
 * 2. Service ID: Found in Email Services section
 * 3. Template ID: Found in Email Templates section  
 * 4. Public Key: Found in Account > API Keys section
 * 
 * Template Variables (configure in EmailJS template):
 * - {{name}} - Sender's name
 * - {{email}} - Sender's email (use in Reply To field)
 * - {{title}} - Subject/title of the message
 * - {{message}} - The message content
 * - {{time}} - Timestamp when the message was sent
 * 
 * Recommended Template Settings:
 * - Subject: Contact Us: {{title}}
 * - To Email: taskmasteroneai@gmail.com
 * - From Name: {{name}}
 * - Reply To: {{email}}
 */

const EMAILJS_SERVICE_ID = 'service_92n9n5w'
const EMAILJS_TEMPLATE_ID = 'contact-taskmaster'
const EMAILJS_PUBLIC_KEY = 'aRQy8p6n59lq-Ro0BOcWX'

export interface ContactFormData {
  name: string
  email: string
  title: string
  message: string
}

export async function sendContactEmail(data: ContactFormData): Promise<void> {
  const templateParams = {
    name: data.name,
    email: data.email,
    title: data.title,
    message: data.message,
    time: new Date().toLocaleString(),
  }

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    )
  } catch (error) {
    console.error('EmailJS error:', error)
    throw new Error('Failed to send email. Please try again.')
  }
}

export { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY }
