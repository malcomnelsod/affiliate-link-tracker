import { api } from "encore.dev/api";

export interface GenerateTemplateRequest {
  links: Array<{
    url: string;
    text: string;
  }>;
  subject?: string;
  customStyles?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
  spamBypass?: {
    useUnicodeChars?: boolean;
    randomizeAttributes?: boolean;
  };
}

export interface EmailTemplate {
  html: string;
  subject: string;
}

// Generates an email template with embedded affiliate links and spam bypass features.
export const generate = api<GenerateTemplateRequest, EmailTemplate>(
  { expose: true, method: "POST", path: "/templates/generate" },
  async (req) => {
    const {
      links,
      subject = "Special Offers Just for You",
      customStyles = {},
      spamBypass = { useUnicodeChars: true, randomizeAttributes: true }
    } = req;

    const {
      primaryColor = "#007bff",
      backgroundColor = "#ffffff",
      fontFamily = "Arial, sans-serif"
    } = customStyles;

    // Generate random attributes for spam bypass
    const getRandomAttribute = () => {
      if (!spamBypass.randomizeAttributes) return "";
      const randomId = Math.random().toString(36).substring(7);
      return `data-${randomId}="${Math.random().toString(36).substring(7)}"`;
    };

    // Insert invisible Unicode characters
    const addUnicodeChars = (text: string) => {
      if (!spamBypass.useUnicodeChars) return text;
      const unicodeChars = ['\u200B', '\u200C', '\u200D']; // Zero-width characters
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += text[i];
        if (i > 0 && i % 3 === 0) {
          result += unicodeChars[Math.floor(Math.random() * unicodeChars.length)];
        }
      }
      return result;
    };

    // Generate randomized subject
    const subjectVariations = [
      subject,
      `🎯 ${subject}`,
      `${subject} - Limited Time`,
      `Exclusive: ${subject}`,
    ];
    const finalSubject = subjectVariations[Math.floor(Math.random() * subjectVariations.length)];

    // Build HTML template using table-based layout
    const linkRows = links.map((link, index) => `
      <tr ${getRandomAttribute()}>
        <td style="padding: 15px; text-align: center;">
          <a href="${link.url}" 
             style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;"
             ${getRandomAttribute()}>
            ${addUnicodeChars(link.text)}
          </a>
        </td>
      </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${finalSubject}</title>
    <style>
        body { margin: 0; padding: 0; font-family: ${fontFamily}; }
        table { border-collapse: collapse; width: 100%; }
        .container { max-width: 600px; margin: 0 auto; }
    </style>
</head>
<body style="background-color: ${backgroundColor};">
    <table class="container" ${getRandomAttribute()}>
        <tr>
            <td style="padding: 20px;">
                <table style="width: 100%; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <tr ${getRandomAttribute()}>
                        <td style="padding: 30px; text-align: center;">
                            <h1 style="color: #333; margin-bottom: 20px; font-size: 24px;">
                                ${addUnicodeChars(finalSubject)}
                            </h1>
                            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
                                ${addUnicodeChars("Don't miss out on these exclusive offers!")}
                            </p>
                        </td>
                    </tr>
                    ${linkRows}
                    <tr ${getRandomAttribute()}>
                        <td style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
                            <p>${addUnicodeChars("This email was sent because you subscribed to our newsletter.")}</p>
                            <p>
                                <a href="#" style="color: #999; text-decoration: underline;" ${getRandomAttribute()}>
                                    ${addUnicodeChars("Unsubscribe")}
                                </a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

    return {
      html: html.trim(),
      subject: finalSubject,
    };
  }
);
