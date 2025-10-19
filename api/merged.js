// api/merged.js
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

// Détermine le "type" pour l'affichage (arrivée / départ / plein)
function getTypeFromDate(date, isStart) {
  // Sécurisation
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.error('⚠️ Date invalide détectée dans un événement iCal');
    return 'full';
  }
  const hour = date.getHours();
  if (isStart) {
    // Arrivée en journée ⇒ "arrival"
    return hour > 8 ? 'arrival' : 'full';
  } else {
    // Départ en journée ⇒ "departure"
    return hour < 23 ? 'departure' : 'full';
  }
}

async function fetchAndMergeCalendars(urls) {
  const events = [];
  const errors = [];

  for (const url of urls) {
    if (!url) continue;
    try {
      const data = await ical.async.fromURL(url);
      for (const key in data) {
        const ev = data[key];
        if (!ev || ev.type !== 'VEVENT') continue;

        // Couleur selon la source
        let color = '#888';
        const u = url.toLowerCase();
        if (u.includes('airbnb')) color = '#ff5a5f';     // rouge Airbnb
        else if (u.includes('booking')) color = '#0071c2'; // bleu Booking

        const startType = getTypeFromDate(ev.start, true);
        const endType   = getTypeFromDate(ev.end,   false);

        events.push({
          start: ev.start,
          end: ev.end,
          summary: ev.summary || 'Réservé',
          location: ev.location || '',
          source: url,
          color,
          startType,
          endType
        });
      }
    } catch (err) {
      console.error(`❌ Erreur lors du chargement de ${url}:`, err?.message || err);
      errors.push({ url, error: String(err?.message || err) });
    }
  }

  events.sort((a, b) => a.start - b.start);
  return { events, errors };
}

export default async function handler(req, res) {
  try {
    let { which } = req.query;
    if (!which) which = 'tiny';

    const urls = calendarURLs[which];
    if (!urls || urls.length === 0 || urls.every(u => !u)) {
      return res.status(400).json({
        error: `Aucune URL iCal n'est configurée pour "${which}".`,
        hint: 'Vérifie tes variables d’environnement sur Vercel : STUDIO_*/TINY_*.'
      });
    }

    const { events, errors } = await fetchAndMergeCalendars(urls);

    // On renvoie 200 même s'il y a des erreurs partielles, avec un "errors" pour debug
    return res.status(200).json({
      logement: which,
      count: events.length,
      errors,          // utile pour voir côté front si une URL plante
      events
    });

  } catch (error) {
    console.error('❌ Erreur interne du serveur:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
