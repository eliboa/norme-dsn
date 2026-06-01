
import * as XLSX from './lib/xlsx.js';

// Le cache peut être désactivé pour forcer le rechargement des données (pratique en developpement)
const CACHE_ACTIVATED = true;
// Config des sources de données des CT DSN
const sources = [
    {
        norme: 'P27V01',
        ctFile: 'dsn-datatypes-CT2027.xlsx',
        usagesFile: 'dsn-tableau-des-usages-CT2027.1.xlsx',
        distantUrl: 'https://www.net-entreprises.fr/media/documentation/',
        selected: true
    },
    {
        norme: 'P26V01',
        ctFile: 'dsn-datatypes-CT2026.xlsx',
        distantUrl: 'https://www.net-entreprises.fr/media/documentation/'
    },
    {
        norme: 'P25V01',
        ctFile: 'dsn-datatypes-CT2025.xlsx',
        usagesFile: 'dsn-tableau-des-usages-CT2025.1.xlsx',
        distantUrl: 'https://www.net-entreprises.fr/media/documentation/'
    }
]

export default class DataSource extends Array {
    constructor(options) {
        super();
        this._cacheEnabled = options?.hasOwnProperty('cache') ? options.cache : CACHE_ACTIVATED;        
        this._clientSide = typeof window !== 'undefined';
        sources.forEach(source => this.push({...source}));
        this.forEach(source => {
            source.fetch = async () => { return await this.fetchData(source) };
        });
    } 

    get(norme) {
        return this.find(source => source.norme === norme);
    }

    set selected(norme) {
        this.forEach(source => source.selected = (source.norme === norme));
    }

    get selected() {
        return this.find(source => source.selected);
    }

    enableCache() { this._cacheEnabled = this._clientSide }
    disableCache() { this._cacheEnabled = false }


    async fetchData(source) {
        // 1. TENTATIVE DE LECTURE DU CACHE INDEXEDDB
        if (this._cacheEnabled) {
            const cached = await dbStorage.get(source.norme);
            if (cached?.timestamp && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
                // Avec IndexedDB, les objets JS complexes restent des objets, 
                // pas besoin de faire de JSON.parse() !
                source.data = cached.data; 
                return source.data;
            }
        }

        if (source.data) 
            return source.data;

        let data = {};

        if (!source.distantUrl || !source.ctFile) 
            return data;

        // Récupérer le fichier Excel du Cahier technique distant
        const url = (this._clientSide ? '/api/doc-gip?filename=' : source.distantUrl)  + source.ctFile;
        const response = await fetch(url);
        if (!response.ok)
            return data;

        // Convertir en ArrayBuffer
        let _data = await response.arrayBuffer();

        // Lire le classeur
        const workbook = XLSX.read(_data, { type: "array" });

        // Lire les feuilles d'intérêt et les convertir en JSON
        const sheets = ['Blocks', 'Fields', 'Messages', 'Data Types'];
        sheets.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new Error("Feuille introuvable : " + sheetName);
            }

            // Conversion en JSON (première ligne = headers)
            data[sheetName] = XLSX.utils.sheet_to_json(worksheet, {
                defval: null,   // remplace cellules vides par null
                raw: false      // interprétation des valeurs (dates, etc.)
            });
        });
        
        // Indexer les DataTypes par leur Id
        const dataTypeMap = new Map(data['Data Types'].map(t => [t.Id, t])); 

        // Indexer les Messages par leur racine de clé (BlockId.FieldId)
        const messagesMap = new Map();
        data.Messages.forEach(m => {
            if (m.Name) {
                // Extraire la partie 'SXX.GXX.XX.XXX' avant le '/'
                const cleanKey = m.Name.split('/')[0]; 
                if (!messagesMap.has(cleanKey)) messagesMap.set(cleanKey, []);
                messagesMap.get(cleanKey).push(m);
            }
        });

        // Pour chaque field...
        const existingBlocks = new Set(data.Blocks.map(b => b.Id));
        data.Fields.forEach(f => {
            // Ramener le DataType et les contrôles le field 
            const key = f['Block Id'] + '.' + f.Id;    
            f._sortKey = key;

            f.DataType = dataTypeMap.get(f['DataType Id']) || null;
            const rawControls = messagesMap.get(key) || [];
            f.Controls = rawControls.map(m => ({
                Name: m.Name?.split('/')?.[1],
                Description: m.Description,
                Message: m.Message,
            }));

            // Si le field est orphelin de block, on ajoute le block manuellement
            if (!existingBlocks.has(f['Block Id']) && f['Block Id'] !== 'S10.G00.00') {
                data.Blocks.push({
                    Id: f['Block Id'],
                    Name: f.Comment?.split('.')?.[0],
                    Description: '',
                    ParentId: 'S10.G00.00',
                    lowerBound: '1',
                    upperBound: '1'
                });
                existingBlocks.add(f['Block Id']);
            }
        });

        // Trier les blocks et fields
        data.Blocks.sort((a, b) => a.Id > b.Id ? 1 : -1);
        data.Fields.sort((a, b) => a._sortKey > b._sortKey ? 1 : -1);

        source.data = data;

        // Récupérer le fichier Excel des usages (s'il existe)
        if (source.usagesFile) {
            const url = (this._clientSide ? '/api/doc-gip?filename=' : source.distantUrl) + source.usagesFile;
            const usagesResponse = await fetch(url);
            let _data = await usagesResponse.arrayBuffer();
            const usagesWorkbook = XLSX.read(_data, { type: "array" });
            const usagesSheet = usagesWorkbook.Sheets['1 - Tableau des usages'];
            if (usagesSheet) {
                const sheetData = XLSX.utils.sheet_to_json(usagesSheet, {
                    defval: null,   // remplace cellules vides par null
                    raw: false,      // interprétation des valeurs (dates, etc.)
                    range: 1        // <--- Commence à la 2ème ligne (index 1) pour les entêtes
                });

                // Extraire les usages
                const usages = {}, usagesTypes = [], usagesMap = new Map();
                const regex = /^\d{2} -/;
                // Filtre les lignes de rubriques
                sheetData.filter(row => { 
                    const dsnPattern = /(S\d{2}\.G\d{2}\.\d{2}(?:\.\d{3})?)/g;
                    return dsnPattern.test(row.Rubrique);
                })
                // Extraire les usages en récupérant type, description, valeur et blockId
                .forEach(row => {
                    usages[row.Rubrique.trim()] = Object.keys(row).filter(prop => regex.test(prop)).map(prop => {
                        const type = prop.split(' - ')[0].trim();
                        const usageObj = {
                            type: type,
                            description: prop.split(' - ')[1].trim(),
                            value: row[prop],
                            blockId: row.Rubrique.trim().split('.').slice(0, 3).join('.')
                        };
                        if (!usagesMap.has(type)) usagesMap.set(type, {type, description: usageObj.description });

                        if (!usagesTypes.includes(type))
                            usagesTypes.push(type);
                        return usageObj;
                    });
                });
                // Lier les usage au data source
                source.data.Usages = usages;

                // Déterminer les usages des blocks en fonction des usages de leurs rubriques
                data.Blocks.forEach(block => {      
                    const bUsages = [];
                    Object.keys(usages).filter(u => {
                        const blockId = u.split('.').slice(0, 3).join('.');
                        return blockId === block.Id;
                    }).forEach(u => bUsages.push(...usages[u]));
                    if (bUsages.length) {
                        block.Usages = [];
                        usagesTypes.forEach(type => {
                            let usage = 'N', usages = bUsages.filter(u => u.type === type);
                            if (usages.some(u => u.value === 'O'))
                                usage = block.lowerBound === '0' ? 'R' : 'O';
                            else if (usages.some(u => u.value === 'C'))
                                usage = 'C';  
                            else if (usages.some(u => u.value === 'F'))
                                usage = 'F';                                        
                            
                            block.Usages.push({
                                type: type,
                                description: usagesMap.get(type).description,
                                value: usage
                            });
                        });
                    }
                });
            }
        }

        // 2. MISE EN CACHE DE L'OBJET RECONSTRUIT DANS INDEXEDDB
        if (this._cacheEnabled) {
            await dbStorage.set(source.norme, {
                timestamp: Date.now(),
                data: source.data // Stockage direct de l'objet, pas de stringify requis
            });
        }

        return source.data;
    }
}

// --- CONFIGURATION INDEXEDDB (Wrapper Natif) ---
const DB_NAME = "DSN_Cache_DB";
const STORE_NAME = "cached_norms";

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

const dbStorage = {
    async get(key) {
        try {
            const db = await initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, "readonly");
                const request = transaction.objectStore(STORE_NAME).get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error("IndexedDB non disponible ou en erreur", e);
            return null;
        }
    },
    async set(key, value) {
        try {
            const db = await initDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, "readwrite");
                const request = transaction.objectStore(STORE_NAME).put(value, key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error("Impossible d'écrire dans IndexedDB", e);
        }
    }
};
// ------------------------------------------------
function DataToTree(data) {
    const queue = [...data.Blocks];
    
    // Initialisation de la racine avec des tableaux pour fields et children
    const tree = [{
        id: 'S10.G00.00',
        name: 'Envoi',
        fields: [],
        children: []
    }];

    // Fonction de recherche adaptée pour parcourir les tableaux de "children"
    const findInTree = (id, nodes = tree) => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children && node.children.length > 0) {
                const result = findInTree(id, node.children);
                if (result) return result;
            }
        }
        return null;
    };

    // Remplissage du tableau "fields" avec des objets { key: ..., value: ... }
    const setFields = (blockNode) => {
        blockNode.fields = data.Fields
            .filter(f => f['Block Id'] === blockNode.id)
            .map(f => ({
                id: `${f['Block Id']}.${f.Id}`,
                name: f.Name
            }));
    };
    
    // On initialise les champs de la racine
    setFields(tree[0]);

    // Sécurité pour éviter une boucle infinie sur le "while"
    let maxAttempts = queue.length * 2; 

    while (queue.length > 0 && maxAttempts > 0) {
        const block = queue.shift();

        if (!block.ParentId?.length) {
            maxAttempts--;
            continue;
        }

        // Détermination du parent cible
        const parentId = data.Blocks.some(b => b.Id === block.ParentId) ? block.ParentId : 'S10.G00.00';
        const parent = findInTree(parentId);

        if (parent) {
            // Création du nouveau nœud enfant
            const blockNode = {       
                id: block.Id,
                name: block.Name,
                fields: [],
                children: []
            };
            
            // Injection de ses champs (sous forme de tableau)
            setFields(blockNode);
            
            // Ajout dans le tableau des enfants du parent
            parent.children.push(blockNode);
        } else {
            // Si le parent n'est pas encore créé, on remet le bloc à la fin
            queue.push(block);
            maxAttempts--;
        }
    }

    return tree;
}
