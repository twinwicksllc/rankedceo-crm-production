import { NextRequest, NextResponse } from 'next/server';
import { recaptchaService } from '@/lib/services/recaptcha-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, action } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'reCAPTCHA token is required' },
        { status: 400 }
      );
    }

    // Verify the token with reCAPTCHA Enterprise
    const score = await recaptchaService.createAssessment({
      token,
      recaptchaAction: action || 'submit',
    });

    // Check if the score meets the minimum threshold (0.5)
    if (score === null || score < 0.5) {
      return NextResponse.json(
        { 
          error: 'reCAPTCHA verification failed',
          score,
          valid: false
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      score,
    });
  } catch (error: any) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error during reCAPTCHA verification' },
      { status: 500 }
    );
  }
}