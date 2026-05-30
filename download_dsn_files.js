const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Configuration des sources et de la destination
const sources = [
    {
        norme: 'P27V01',
        url: 'https://www.net-entreprises.fr/media/documentation/dsn-datatypes-CT2027.xlsx'
    },
    {
        norme: 'P26V01',
        url: 'https://www.net-entreprises.fr/media/documentation/dsn-datatypes-CT2026.xlsx'
    },
    {
        norme: 'P25V01',
        url: 'https://www.net-entreprises.fr/media/documentation/dsn-datatypes-CT2025.xlsx'
    },
    {
        norme: 'P27V01-usages',
        url: 'https://www.net-entreprises.fr/media/documentation/dsn-tableau-des-usages-CT2027.1.xlsx'
    },
    {
        norme: 'P25V01-usages',
        url: 'https://www.net-entreprises.fr/media/documentation/dsn-tableau-des-usages-CT2025.1.xlsx'
    }
];

// Dossier cible : ./public/assets (relatif à l'emplacement de ce script)
const targetDir = path.join(__dirname, 'public', 'assets');

/**
 * Fonction utilitaire pour télécharger un fichier via HTTPS
 * @param {string} url - L'URL du fichier distant
 * @param {string} dest - Le chemin local de destination
 */
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        
        https.get(url, (response) => {
            // Vérification du statut HTTP
            if (response.statusCode !== 200) {
                reject(new Error(`Échec du téléchargement (${response.statusCode}) pour l'URL : ${url}`));
                return;
            }

            // Écriture du flux dans le fichier
            response.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            // Nettoyage du fichier local en cas d'erreur de réseau
            fs.unlink(dest, () => reject(err)); 
        });
    });
}

/**
 * Fonction principale asynchrone
 */
async function main() {
    try {
        console.log(`=== Début du téléchargement des référentiels DSN ===`);
        
        // 2. Création récursive des dossiers s'ils n'existent pas
        // { recursive: true } s'assure de créer ./public ET ./public/assets d'un coup sans planter s'ils existent déjà
        if (!fs.existsSync(targetDir)) {
            console.log(`Création du répertoire de destination : ${targetDir}`);
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 3. Boucle sur les sources pour télécharger les fichiers
        for (const source of sources) {
            // Extraction du nom du fichier depuis l'URL (ex: dsn-datatypes-CT2027.xlsx)
            const fileName = path.basename(source.url);
            const destinationPath = path.join(targetDir, fileName);

            console.log(`\n[${source.norme}] Téléchargement en cours...`);
            console.log(` -> Depuis : ${source.url}`);
            console.log(` -> Vers   : ${destinationPath}`);

            // Téléchargement (écrase automatiquement le fichier existant s'il y en a un)
            await downloadFile(source.url, destinationPath);
            
            console.log(`[${source.norme}] ✅ Téléchargé avec succès !`);
        }

        console.log(`\n=== Tous les fichiers sont à jour dans ./public/assets/ ===`);

    } catch (error) {
        console.error(`\n❌ Une erreur est survenue lors du processus :`, error.message);
        process.exit(1);
    }
}

// Lancement du script
main();