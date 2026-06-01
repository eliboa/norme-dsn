const http = require('http');
const fs = require('fs');
const path = require('path');

// Augmenter le nombre de sockets simultanés
http.globalAgent.maxSockets = 100;

// Créer un serveur HTTP
const server = http.createServer((req, res) => {
    // Gérer les requêtes OPTIONS pour CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    const start = process.hrtime();

    // Obtenir le chemin du fichier demandé
    var filePath = path.join(__dirname + '/public', req.url === '/' ? 'index.html' : req.url);
    if (filePath.includes('?')) filePath = filePath.split('?')[0];
    const extname = path.extname(filePath);

    // Définir les types MIME pour les extensions de fichiers courantes
    const contentType = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif'
    };

    // Lire le fichier
    fs.readFile(filePath, (err, content) => {
        const diff = process.hrtime(start);
        const duration = diff[0] * 1000 + diff[1] / 1e6;

        if (err) {
            if (err.code === 'ENOENT') {
                // Fichier non trouvé
                res.writeHead(404, {
                    'Content-Type': 'text/plain',
                    'Server-Timing': `total;dur=${duration}`
                });
                res.end('404 Not Found');
            } else {
                // Erreur serveur
                res.writeHead(500, {
                    'Content-Type': 'text/plain',
                    'Server-Timing': `total;dur=${duration}`
                });
                res.end('500 Internal Server Error');
            }
        } else {
            // Fichier trouvé, envoyer le contenu
            res.writeHead(200, {
                'Content-Type': contentType[extname] || 'text/plain',
                'Access-Control-Allow-Origin': '*',
                'Server-Timing': `total;dur=${duration}`
            });
            res.end(content);
        }
    });
});

// Augmenter le délai d'attente à 5 minutes (300000 millisecondes)
server.timeout = 300000;

// Démarrer le serveur sur le port 3000
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
