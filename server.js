// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const textract = require('textract');
const diff = require('diff');

const app = express();
const PORT = process.env.PORT || 3000;

// Usa memoryStorage invece di diskStorage
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 2
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Servizio di estrazione testo modificato per lavorare con buffer
class TextExtractionService {
    async extractText(fileBuffer, fileName) {
        return new Promise((resolve, reject) => {
            try {
                // Per i tipi di file di testo semplice, possiamo convertire direttamente il buffer
                const extension = path.extname(fileName).toLowerCase();
                if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.js', '.css'].includes(extension)) {
                    resolve(fileBuffer.toString('utf8'));
                } else {
                    // Per altri tipi di file, utilizziamo textract con un file temporaneo
                    const tempFilePath = path.join(process.cwd(), `temp_${Date.now()}${extension}`);
                    fs.writeFileSync(tempFilePath, fileBuffer);

                    const options = {preserveLineBreaks: true};
                    textract.fromFileWithPath(tempFilePath, options, (error, text) => {
                        // Elimina immediatamente il file temporaneo
                        try {
                            fs.unlinkSync(tempFilePath);
                        } catch (e) {
                            console.error(`Impossibile eliminare il file temporaneo: ${e.message}`);
                        }

                        if (error) {
                            console.error(`Errore nell'estrazione: ${error.message}`);
                            reject(error);
                        } else {
                            resolve(text || '');
                        }
                    });
                }
            } catch (error) {
                reject(new Error(`Errore di elaborazione: ${error.message}`));
            }
        });
    }
}

// Servizio di normalizzazione del testo
class TextNormalizerService {
    normalize(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\n+/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .trim();
    }
}

// Servizio per trovare le differenze
class DiffService {
    findDifferences(text1, text2) {
        const differences = diff.diffChars(text1, text2);

        const results = [];
        let position = 0;

        differences.forEach(part => {
            if (part.added || part.removed) {
                const beforeContext = this._getContext(differences,
                    differences.indexOf(part),
                    -1, 30);
                const afterContext = this._getContext(differences,
                    differences.indexOf(part),
                    1, 30);

                results.push({
                    type: part.added ? 'aggiunta' : 'rimozione',
                    value: part.value,
                    position,
                    context: {before: beforeContext, after: afterContext}
                });
            }
            position += part.value.length;
        });

        return results;
    }

    _getContext(differences, currentIndex, direction, length) {
        let context = '';
        let index = currentIndex + direction;

        while ((direction > 0 ? index < differences.length : index >= 0) &&
        context.length < length) {
            if (!differences[index].added && !differences[index].removed) {
                const text = differences[index].value;
                if (direction > 0) {
                    context += text.slice(0, length - context.length);
                } else {
                    context = text.slice(-(length - context.length)) + context;
                }
            }
            index += direction;
        }

        return context;
    }
}

// Controller modificato per lavorare con buffer
class FileComparisonController {
    constructor() {
        this.extractionService = new TextExtractionService();
        this.normalizerService = new TextNormalizerService();
        this.diffService = new DiffService();
    }

    async compareFiles(file1Buffer, file1Name, file2Buffer, file2Name) {
        try {
            const text1 = await this.extractionService.extractText(file1Buffer, file1Name);
            const text2 = await this.extractionService.extractText(file2Buffer, file2Name);

            const normalizedText1 = this.normalizerService.normalize(text1);
            const normalizedText2 = this.normalizerService.normalize(text2);

            return this.diffService.findDifferences(normalizedText1, normalizedText2);
        } catch (error) {
            throw new Error(`Errore durante il confronto: ${error.message}`);
        }
    }
}

const fileComparisonController = new FileComparisonController();

// Gestore errori per multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: 'Il file è troppo grande (limite: 10MB)'
            });
        }
        return res.status(400).json({
            error: `Errore nel caricamento dei file: ${err.message}`
        });
    }
    next(err);
};

// Endpoint per il confronto dei file modificato
app.post('/api/compare', (req, res, next) => {
    upload.array('files', 2)(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }

        if (!req.files || req.files.length !== 2) {
            return res.status(400).json({
                error: 'È necessario caricare esattamente due file'
            });
        }

        const file1Buffer = req.files[0].buffer;
        const file1Name = req.files[0].originalname;
        const file2Buffer = req.files[1].buffer;
        const file2Name = req.files[1].originalname;

        fileComparisonController.compareFiles(file1Buffer, file1Name, file2Buffer, file2Name)
            .then(differences => {
                res.json({differences});
            })
            .catch(error => {
                console.error(error);
                res.status(500).json({error: error.message});
            });
    });
});

// Gestore errori generico
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({error: 'Errore interno del server'});
});

app.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});