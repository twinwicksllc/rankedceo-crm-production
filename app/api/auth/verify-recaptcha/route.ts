import { NextRequest, NextResponse } from 'next/server';
import { recaptchaService } from '@/lib/services/recaptcha-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, action } = body;

    console.log('[reCAPTCHA] Verification request received:', {
      hasToken: !!token,
      action: action || 'submit',
      tokenLength: token?.length || 0,
      timestamp: new Date().toISOString()
    });

    if (!token) {
      console.error('[reCAPTCHA] Error: No token provided');
      return NextResponse.json(
        { error: 'reCAPTCHA token is required' },
        { status: 400 }
      );
    }

    // Verify the token with reCAPTCHA
    console.log('[reCAPTCHA] Calling verification service...');
    const score = await recaptchaService.createAssessment({
      token,
      recaptchaAction: action || 'submit',
    });

    console.log('[reCAPTCHA] Verification result:', {
      score,
      isValid: score !== null && score >= 0.5,
      timestamp: new Date().toISOString()
    });

    // Check if the score meets the minimum threshold (0.5)
    if (score === null) {
      console.error('[reCAPTCHA] Error: Verification returned null score');
      return NextResponse.json(
        { 
          error: 'reCAPTCHA verification failed - could not verify token',
          score: null,
          valid: false,
          reason: 'Verification service returned null score'
        },
        { status: 400 }
      );
    }

    if (score < 0.5) {
      console.warn('[reCAPTCHA] Warning: Score below threshold:', {
        score,
        threshold: 0.5,
        action
      });
      return NextResponse.json(
        { 
          error: 'reCAPTCHA verification failed - score too low',
          score,
          valid: false,
          reason: `Score ${score.toFixed(2)} is below threshold 0.5`
        },
        { status: 400 }
      );
    }

    console.log('[reCAPTCHA] Verification successful');
    return NextResponse.json({
      valid: true,
      score,
    });
  } catch (error: any) {
    console.error('[reCAPTCHA] Verification error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error during reCAPTCHA verification',
        details: error.message
      },
      { status: 500 }
    );
  }
}