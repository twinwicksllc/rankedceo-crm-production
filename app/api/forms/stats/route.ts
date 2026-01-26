import { NextRequest, NextResponse } from 'next/server'
import { FormService } from '@/lib/services/form-service'

/**
 * Forms Statistics API Endpoint
 * GET /api/forms/stats - Get form statistics
 */

export async function GET(request: NextRequest) {
  try {
    const formService = new FormService()
    const stats = await formService.getFormStats()

    return NextResponse.json(stats)
  } catch (error) {
    console.error('[Forms Stats API] Error fetching statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
