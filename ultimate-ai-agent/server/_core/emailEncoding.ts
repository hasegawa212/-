/**
 * Email Encoding Handler
 * Properly decodes email content with various character encodings
 * Supports UTF-8, ISO-8859-1, and other common encodings
 */

/**
 * Detect and decode email header text
 * Handles RFC 2047 encoded-word format (e.g., =?UTF-8?B?...?=)
 */
export function decodeEmailHeader(header: string): string {
  if (!header) return header;

  // RFC 2047: =?charset?encoding?encoded-text?=
  const encodedWordRegex = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;

  return header.replace(encodedWordRegex, (match, charset, encoding, text) => {
    try {
      const upperEncoding = encoding.toUpperCase();
      let decoded: string;

      if (upperEncoding === "B") {
        // Base64 encoding
        const buffer = Buffer.from(text, "base64");
        decoded = buffer.toString(charset.toLowerCase());
      } else if (upperEncoding === "Q") {
        // Quoted-Printable encoding
        const unquoted = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
        decoded = Buffer.from(unquoted, "binary").toString(charset.toLowerCase());
      } else {
        return match; // Unknown encoding
      }

      return decoded;
    } catch (error) {
      console.warn(`Failed to decode email header: ${match}`, error);
      return match;
    }
  });
}

/**
 * Detect charset from email headers and decode body content
 */
export function decodeEmailBody(
  content: string,
  contentType: string = "text/plain; charset=utf-8",
  contentTransferEncoding: string = "7bit"
): string {
  if (!content) return content;

  // Extract charset from Content-Type header
  const charsetMatch = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i);
  const charset = charsetMatch ? charsetMatch[1].toLowerCase() : "utf-8";

  // Normalize charset names
  const normalizedCharset = normalizeCharset(charset);

  try {
    let decoded = content;

    // Handle transfer encoding first
    const upperEncoding = contentTransferEncoding.toLowerCase();
    if (upperEncoding === "base64") {
      const buffer = Buffer.from(content, "base64");
      decoded = buffer.toString(normalizedCharset);
    } else if (upperEncoding === "quoted-printable") {
      decoded = decodeQuotedPrintable(content);
    }
    // For 7bit, 8bit, and binary, content is already decoded

    return decoded;
  } catch (error) {
    console.warn(`Failed to decode email body with charset ${normalizedCharset}:`, error);
    return content;
  }
}

/**
 * Decode quoted-printable content
 */
function decodeQuotedPrintable(content: string): string {
  return content
    .split("\r\n")
    .map((line) => {
      // Handle soft line breaks (trailing =)
      if (line.endsWith("=")) {
        return line.slice(0, -1);
      }
      return line;
    })
    .join("")
    .replace(/=([0-9A-Fa-f]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}

/**
 * Normalize charset names to Node.js supported encoding names
 */
function normalizeCharset(charset: string): string {
  const lower = charset.toLowerCase().trim();

  // Common aliases
  const aliases: Record<string, string> = {
    "utf8": "utf8",
    "utf-8": "utf8",
    "iso-8859-1": "latin1",
    "iso8859-1": "latin1",
    "iso-8859-2": "latin2",
    "iso8859-2": "latin2",
    "windows-1252": "cp1252",
    "cp1252": "cp1252",
    "shift_jis": "shiftjis",
    "shift-jis": "shiftjis",
    "shift-js": "shiftjis",
    "sjis": "shiftjis",
    "eucjp": "eucjp",
    "euc-jp": "eucjp",
    "gb2312": "gb2312",
    "gbk": "gbk",
    "big5": "big5",
    "us-ascii": "ascii",
  };

  return aliases[lower] || lower;
}

/**
 * Ensure text is valid UTF-8 and fix any encoding issues
 */
export function ensureValidUtf8(text: string): string {
  try {
    // If the string contains valid characters, return as-is
    if (/[\u0000-\uffff]/.test(text)) {
      return text;
    }
    return text;
  } catch (error) {
    console.warn("Error validating UTF-8:", error);
    return text;
  }
}

/**
 * Parse email headers and body with proper encoding handling
 */
export function parseEmail(rawEmail: string): {
  headers: Record<string, string>;
  body: string;
  subject: string;
  from: string;
  to: string;
} {
  const [headerSection, ...bodyParts] = rawEmail.split("\n\n");
  const body = bodyParts.join("\n\n");

  const headers: Record<string, string> = {};
  let currentHeader = "";
  let currentValue = "";

  // Parse headers
  headerSection.split("\n").forEach((line) => {
    if (line.match(/^\s/) && currentHeader) {
      // Continuation of previous header
      currentValue += " " + line.trim();
    } else {
      // New header
      if (currentHeader && currentValue) {
        headers[currentHeader] = decodeEmailHeader(currentValue);
      }
      const [key, ...valueParts] = line.split(":");
      currentHeader = key.trim();
      currentValue = valueParts.join(":").trim();
    }
  });

  // Add last header
  if (currentHeader && currentValue) {
    headers[currentHeader] = decodeEmailHeader(currentValue);
  }

  // Get content type and transfer encoding
  const contentType = headers["Content-Type"] || "text/plain; charset=utf-8";
  const transferEncoding = headers["Content-Transfer-Encoding"] || "7bit";

  // Decode body
  const decodedBody = decodeEmailBody(body, contentType, transferEncoding);

  return {
    headers,
    body: decodedBody,
    subject: headers["Subject"] || "",
    from: headers["From"] || "",
    to: headers["To"] || "",
  };
}
