const QRCode = require('qrcode');

/**
 * QR Code Generation Service
 * Generates QR codes for VPN configuration URLs
 */

/**
 * Generate QR code as Data URL
 * @param {string} text - Text/URL to encode
 * @returns {Promise<string>} Data URL of QR code image
 */
async function generateQRCode(text) {
  try {
    const qrDataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
    return qrDataUrl;
  } catch (error) {
    console.error('QR code generation error:', error.message);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as SVG
 * @param {string} text - Text/URL to encode
 * @returns {Promise<string>} SVG string
 */
async function generateQRCodeSVG(text) {
  try {
    const qrSvg = await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'M',
    });
    return qrSvg;
  } catch (error) {
    console.error('QR code generation error:', error.message);
    throw new Error('Failed to generate QR code');
  }
}

module.exports = {
  generateQRCode,
  generateQRCodeSVG,
};
