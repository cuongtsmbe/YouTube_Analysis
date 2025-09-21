export interface TwoCaptchaSolver {
  recaptcha(options: {
    pageurl: string;
    googlekey: string;
  }): Promise<{ data: string }>;
}
