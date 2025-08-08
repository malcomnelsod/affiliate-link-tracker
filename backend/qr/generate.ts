import { api, APIError } from "encore.dev/api";

export interface GenerateQRRequest {
  url: string;
  size?: number;
  format?: 'png' | 'svg';
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  darkColor?: string;
  lightColor?: string;
}

export interface GenerateQRResponse {
  qrCodeUrl: string;
  format: string;
  size: number;
}

// Generates QR codes for affiliate links to enable mobile sharing.
export const generate = api<GenerateQRRequest, GenerateQRResponse>(
  { expose: true, method: "POST", path: "/qr/generate" },
  async (req) => {
    const { 
      url, 
      size = 200, 
      format = 'png', 
      errorCorrection = 'M',
      margin = 4,
      darkColor = '000000',
      lightColor = 'ffffff'
    } = req;

    if (!url) {
      throw APIError.invalidArgument("URL is required");
    }

    try {
      // Validate URL
      new URL(url);

      // Use QR Server API for QR code generation
      const qrParams = new URLSearchParams({
        data: url,
        size: `${size}x${size}`,
        format: format,
        ecc: errorCorrection,
        margin: margin.toString(),
        color: darkColor,
        bgcolor: lightColor
      });

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?${qrParams.toString()}`;

      return {
        qrCodeUrl,
        format,
        size
      };
    } catch (error) {
      console.error("QR code generation error:", error);
      throw APIError.invalidArgument("Invalid URL provided");
    }
  }
);
