import express from 'express';
import multer from 'multer';
import { processSlipOCR } from './ocr-service';

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    },
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Lao Slip OCR API is running' });
});

// OCR endpoint for processing payment slips
app.post('/ocr/slip', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided',
                message: 'Please upload an image file'
            });
        }

        const result = await processSlipOCR(req.file.buffer);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('OCR processing error:', error);
        res.status(500).json({
            error: 'OCR processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'Image file must be less than 10MB'
            });
        }
    }

    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

app.listen(port, () => {
    console.log(`🚀 Lao Slip OCR API running on port ${port}`);
    console.log(`📋 Health check: http://localhost:${port}/health`);
    console.log(`🔍 OCR endpoint: POST http://localhost:${port}/ocr/slip`);
});