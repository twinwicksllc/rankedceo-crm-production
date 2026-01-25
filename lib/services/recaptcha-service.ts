interface VerifyRecaptchaParams {
  token: string;
  remoteIp?: string;
}

interface RecaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

export class RecaptchaService {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY || '';
  }

  /**
   * Verify reCAPTCHA v2/v3 token using Google's verification API
   * 
   * @param token - The reCAPTCHA token from the client
   * @param remoteIp - Optional remote IP address
   * @returns The verification response with success status and score
   */
  async verifyToken({
    token,
    remoteIp,
  }: VerifyRecaptchaParams): Promise<RecaptchaVerifyResponse> {
    try {
      // Build the verification URL
      const verificationUrl = new URL('https://www.google.com/recaptcha/api/siteverify');
      verificationUrl.searchParams.append('secret', this.secretKey);
      verificationUrl.searchParams.append('response', token);
      
      if (remoteIp) {
        verificationUrl.searchParams.append('remoteip', remoteIp);
      }

      // Make the verification request
      const response = await fetch(verificationUrl.toString(), {
        method: 'POST',
      });

      const data: RecaptchaVerifyResponse = await response.json();

      if (!data.success) {
        console.error('reCAPTCHA verification failed:', data['error-codes']);
      } else {
        console.log('reCAPTCHA verification successful. Score:', data.score, 'Action:', data.action);
      }

      return data;
    } catch (error) {
      console.error('Error verifying reCAPTCHA token:', error);
      return {
        success: false,
        'error-codes': ['network-error'],
      };
    }
  }

  /**
   * Create an assessment to analyze the risk of a UI action.
   * This method maintains compatibility with the Enterprise API interface.
   * 
   * @param token - The generated token obtained from the client
   * @param recaptchaAction - Action name corresponding to the token
   * @returns The risk score (0.0 - 1.0) or null if validation fails
   */
  async createAssessment({
    token,
    recaptchaAction = 'submit',
  }: { token: string; recaptchaAction?: string }): Promise<number | null> {
    try {
      const result = await this.verifyToken({ token });

      if (!result.success) {
        console.log('reCAPTCHA verification failed:', result['error-codes']);
        return null;
      }

      // For reCAPTCHA v3, return the score; for v2, return a high score if successful
      const score = result.score !== undefined ? result.score : 0.9;
      console.log(`The reCAPTCHA score is: ${score}, Action: ${result.action || recaptchaAction}`);
      
      // Verify the action matches (for v3)
      if (result.action && recaptchaAction && result.action !== recaptchaAction) {
        console.log(
          `Action mismatch: expected ${recaptchaAction}, got ${result.action}`
        );
        return null;
      }

      return score;
    } catch (error) {
      console.error('Error creating reCAPTCHA assessment:', error);
      return null;
    }
  }
}

// Singleton instance
export const recaptchaService = new RecaptchaService();