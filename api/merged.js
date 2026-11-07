// ✅ pages/api/merged.js
import ical from 'node-ical';

const calendarURLs = {
  tiny: [
    process.env.TINY_AIRBNB_ICAL_URL,
    process.env.TINY_BOOKING_ICAL_URL
  ],
  studio: [
    process.env.STUDIO_AIRBNB_ICAL_URL,
    process.env.STUDIO_BOOKING_ICAL_URL
  ]
};

// 👉 Petite fonction utilitaire pour formater la date au format YYYY-MM-DD
function toLocalDateOnlyString(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 👉 Couleur selon la source
function pickColorFromURL(url = '') {
  const u = url.toLowerCase();
  if (u.includes('airbnb')) return '#ff5a5f';
  if (u.includes('booking')) return '#0071c2';
  return '#888';
}

// 👉 Plateforme d'origine, sans le jeton de l'URL
function sourceLabel(url = '') {
  const u = url.toLowerCase();
  if (u.includes('airbnb')) return 'airbnb';
  if (u.includes('booking')) return 'booking';
  return 'autre';
}

// 👉 Récupération et fusion des calendriers
async function fetchAndMergeCalendars(urls) {
  const events = [];
  for (const url of urls) {
    if (!url) continue;
    try {
      const data = await ical.async.fromURL(url);
      for (const key in data) {
        const ev = data[key];
        if (!ev || ev.type !== 'VEVENT') continue;
        events.push({
          title: ev.summary || 'Réservé',
          start: toLocalDateOnlyString(ev.start),
          end: toLocalDateOnlyString(ev.end), // end exclusif → le jour de départ reste libre
          allDay: true,
          color: pickColorFromURL(url),
          // Étiquette seulement : l'URL iCal contient un jeton privé, elle ne doit jamais être renvoyée
          source: sourceLabel(url)
        });
      }
    } catch (err) {
      console.error(`❌ Erreur iCal pour ${sourceLabel(url)}:`, err.message);
    }
  }
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

export default async function handler(req, res) {
  // ✅ CORS — permet les appels depuis n'importe quelle origine (y compris file:///)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Réponse aux préflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let { which } = req.query;
    if (!which || !['tiny', 'studio'].includes(which)) which = 'tiny';

    const urls = calendarURLs[which] || [];
    if (urls.length === 0 || urls.every(u => !u)) {
      return res.status(400).json({
        error: `Aucune URL iCal configurée pour "${which}".`
      });
    }

    const events = await fetchAndMergeCalendars(urls);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ logement: which, count: events.length, events });
  } catch (e) {
    console.error('❌ Erreur API:', e);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
