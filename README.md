# Lao Slip OCR API

Express TypeScript API with Bun for OCR processing of Lao payment slips to extract amount, date, and bank type.

## Features

- OCR processing with Tesseract.js
- Support for Lao and English text recognition
- Multi-bank support (BCEL, LDB)
- Image preprocessing for better accuracy
- Extract amount, date, and bank type from payment slips
- Built with Express, TypeScript, and Bun

## Supported Banks

- **BCEL** - Including BCEL One mobile payments and TMN Online
- **LDB** - Lao Development Bank with Lao-specific text patterns
- **MONEYGRAM** - MoneyGram money transfer services

## Installation

```bash
bun install
```

## Usage

### Development

```bash
bun run dev
```

### Production

```bash
bun start
```

## API Endpoints

### Health Check

```
GET /health
```

### OCR Processing

```
POST /ocr/slip
Content-Type: multipart/form-data
Body: image file (field name: "image")
```

**Response:**

```json
{
  "success": true,
  "data": {
    "amount": "35000",
    "date": "08/01/2026",
    "bankType": "LDB",
    "rawText": "full OCR text..."
  }
}
```

## Testing

### Postman

Import the `postman-collection.json` file into Postman for easy testing.

### cURL

```bash
curl -X POST http://localhost:3000/ocr/slip -F "image=@slip/ldb.jpeg"
```

## Supported Image Formats

- JPEG
- PNG
- WebP
- TIFF
- BMP

Maximum file size: 10MB
# ocr_slip
