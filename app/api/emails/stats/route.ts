import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/services/email-service'

/**
 * Email Statistics API Endpoint
 * Returns email statistics for the current user's account
 */

export async function GET(request: NextRequest) {
  try {
    const emailService = new EmailService()
    const stats = await emailService.getEmailStats()

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[Email Stats] Error fetching statistics:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch email statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}