// Serverless fonction pour télécharger la documentation du GIP Net-Entreprises depuis le front end (et eviter les pb de CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: 'Le paramètre "name" est obligatoire (ex: ?filename=dsn-datatypes-CT2027.xlsx)' });
  }

  const targetUrl = `https://www.net-entreprises.fr/media/documentation/${filename}`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Impossible de récupérer le fichier pour la norme ${norme} sur net-entreprises.` 
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    response.headers.forEach((value, name) => {
        res.setHeader(name, value);
    })

    return res.status(200).send(buffer);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erreur interne lors du fetch' });
  }
}