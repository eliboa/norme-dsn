export default async function handler(req, res) {
  // 1. Configurer les headers CORS pour que votre site (index.html) puisse appeler cette API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Gérer la requête de pré-vérification CORS (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Récupérer le paramètre "norme" depuis la query string (ex: ?norme=2026)
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: 'Le paramètre "name" est obligatoire (ex: ?filename=dsn-datatypes-CT2027.xlsx)' });
  }

  // 3. Construire l'URL cible de net-entreprises
  const targetUrl = `https://www.net-entreprises.fr/media/documentation/${filename}`;

  try {
    // 4. Effectuer le fetch serveur
    const response = await fetch(targetUrl);

    // Si net-entreprises renvoie une erreur (404 par exemple)
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Impossible de récupérer le fichier pour la norme ${norme} sur net-entreprises.` 
      });
    }

    // 5. Récupérer le contenu du fichier sous forme de buffer binaire
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    response.headers.forEach((value, name) => {
        res.setHeader(name, value);
    })

    // 7. Envoyer le fichier Excel en réponse
    return res.status(200).send(buffer);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erreur interne lors du fetch' });
  }
}