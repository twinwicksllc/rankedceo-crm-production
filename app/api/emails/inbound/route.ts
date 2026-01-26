import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/services/email-service'
import { EmailParser } from '@/lib/services/email-parser'
import { createClient } from '@/lib/supabase/server'
import { ParsedEmail } from '@/lib/types/email'

/**
 * Inbound Email Webhook Endpoint
 * Receives emails from SendGrid Inbound Parse or other email services
 * and stores them in the CRM database.
 */

export async function POST(request: NextRequest) {
  try {
    // Get account ID from BCC address or email headers
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's account ID
    const { data: userData } = await supabase
      .from('users')
      .select('account_id')
      .eq('id', user.id)
      .single()

    if (!userData?.account_id) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    const accountId = userData.account_id

    // Parse incoming email data
    // SendGrid sends multipart/form-data with email content
    const contentType = request.headers.get('content-type') || ''
    
    let emailData: any = {}

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      emailData = Object.fromEntries(formData.entries())
      
      // Convert to regular object
      const parsedEmail: any = {}
      formData.forEach((value, key) => {
        parsedEmail[key] = value
      })
      emailData = parsedEmail
    } else {
      emailData = await request.json()
    }

    // Parse email using EmailParser
    const parsedEmail: ParsedEmail = EmailParser.parseFromSendGrid(emailData)

    // Validate email data
    if (!parsedEmail.from_address || !parsedEmail.to_addresses || parsedEmail.to_addresses.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email data: missing required fields' },
        { status: 400 }
      )
    }

    // Create email in database
    const emailService = new EmailService()
    const createdEmail = await emailService.createEmailFromParsed(parsedEmail, accountId)

    // Log success
    console.log(`[Email Inbound] Email received from ${parsedEmail.from_address}`, {
      subject: parsedEmail.subject,
      email_id: createdEmail.id,
      thread_id: createdEmail.thread_id,
    })

    return NextResponse.json({
      success: true,
      email_id: createdEmail.id,
      thread_id: createdEmail.thread_id,
      message: 'Email processed successfully',
    })

  } catch (error) {
    console.error('[Email Inbound] Error processing email:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint - for testing webhook connectivity
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'online',
    message: 'Email inbound webhook is active',
    timestamp: new Date().toISOString(),
  })
}