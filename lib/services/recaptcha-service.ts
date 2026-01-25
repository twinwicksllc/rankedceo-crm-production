import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

interface CreateAssessmentParams {
  projectID?: string;
  recaptchaKey?: string;
  token: string;
  recaptchaAction?: string;
}

export class RecaptchaService {
  private client: RecaptchaEnterpriseServiceClient;
  private projectID: string;
  private recaptchaKey: string;

  constructor() {
    this.client = new RecaptchaEnterpriseServiceClient();
    this.projectID = process.env.RECAPTCHA_PROJECT_ID || '';
    this.recaptchaKey = process.env.RECAPTCHA_SITE_KEY || '';
  }

  /**
   * Create an assessment to analyze the risk of a UI action.
   * 
   * @param token - The generated token obtained from the client
   * @param recaptchaAction - Action name corresponding to the token
   * @returns The risk score (0.0 - 1.0) or null if validation fails
   */
  async createAssessment({
    token,
    recaptchaAction = 'submit',
  }: Pick<CreateAssessmentParams, 'token' | 'recaptchaAction'>): Promise<number | null> {
    try {
      const projectPath = this.client.projectPath(this.projectID);

      // Build the assessment request
      const request = {
        assessment: {
          event: {
            token: token,
            siteKey: this.recaptchaKey,
          },
        },
        parent: projectPath,
      };

      const [response] = await this.client.createAssessment(request);

      // Check if the token is valid
      if (!response.tokenProperties?.valid) {
        console.log(
          `The CreateAssessment call failed because the token was: ${response.tokenProperties?.invalidReason}`
        );
        return null;
      }

      // Check if the expected action was executed
      if (response.tokenProperties?.action === recaptchaAction) {
        // Get the risk score
        const score = response.riskAnalysis?.score || 0;
        console.log(`The reCAPTCHA score is: ${score}`);
        
        return score;
      } else {
        console.log(
          'The action attribute in your reCAPTCHA tag does not match the action you are expecting to score'
        );
        return null;
      }
    } catch (error) {
      console.error('Error creating reCAPTCHA assessment:', error);
      return null;
    }
  }

  /**
   * Verify reCAPTCHA token with a minimum score threshold
   * 
   * @param token - The reCAPTCHA token
   * @param recaptchaAction - The expected action
   * @param minScore - Minimum acceptable score (default: 0.5)
   * @returns true if valid, false otherwise
   */
  async verifyToken(
    token: string,
    recaptchaAction: string = 'submit',
    minScore: number = 0.5
  ): Promise<boolean> {
    const score = await this.createAssessment({ token, recaptchaAction });
    
    if (score === null) {
      return false;
    }

    return score >= minScore;
  }
}

// Singleton instance
export const recaptchaService = new RecaptchaService();