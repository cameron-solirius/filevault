const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const uploadsCounter = new promClient.Counter({
    name: 'filevault_uploads_total',
    help: 'Total number of files uploaded to FileVault',
    registers: [register],
});

const azureStorageDuration = new promClient.Histogram({
    name: 'filevault_azure_storage_duration_seconds',
    help: 'Duration of Azure Blob Storage operations in seconds',
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register],
});

const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

const sharedKeyCredential = new StorageSharedKeyCredential(
    process.env.AZURE_STORAGE_ACCOUNT_NAME,
    process.env.AZURE_STORAGE_ACCOUNT_KEY
);

const blobServiceClient = new BlobServiceClient(
    `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    sharedKeyCredential
);

const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);

const filesDataPath = './filesData.json';

const loadFilesData = () => {
    if (fs.existsSync(filesDataPath)) {
        const data = fs.readFileSync(filesDataPath);
        return JSON.parse(data);
    }
    return [];
};

const saveFilesData = (files) => {
    fs.writeFileSync(filesDataPath, JSON.stringify(files, null, 2));
};

let files = loadFilesData();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/upload', upload.single('file'), async (req, res) => {
    const fileName = req.body.note;
    if (!fileName) {
        return res.status(400).send('File name is required.');
    }

    if (req.file) {
        const endTimer = azureStorageDuration.startTimer();
        try {
            const blobName = req.file.filename;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            await blockBlobClient.uploadFile(req.file.path);

            endTimer();
            uploadsCounter.inc();

            fs.unlinkSync(req.file.path); // remove the file locally after upload

            files.push({ name: fileName, key: blobName });
            saveFilesData(files);

            res.status(200).send('File uploaded successfully.');
        } catch (err) {
            endTimer();
            console.error('Error uploading file:', err);
            res.status(500).send('Failed to upload file.');
        }
    } else {
        res.status(400).send('No file uploaded.');
    }
});

app.get('/files', (req, res) => {
    res.json(files);
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

app.delete('/files/:key', async (req, res) => {
    const fileKey = req.params.key;

    try {
        const blockBlobClient = containerClient.getBlockBlobClient(fileKey);
        await blockBlobClient.delete();

        files = files.filter(file => file.key !== fileKey);
        saveFilesData(files);

        res.status(200).send('File deleted successfully.');
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).send('Failed to delete file.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
