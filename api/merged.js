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

async function fetchAndMergeCalendars(urls) {
  const allEvents = [];

  for (const url of urls) {
    if (!url) continue; // ignore les URLs vides
    try {
      const data = await ical.async.fromURL(url);
      for (const key in data) {
        const ev = data[key];
        if (ev.type === 'VEVENT') {
          let color = '#888'; // couleur par défaut (gris)
          if (url.includes('airbnb')) {
            color = '#ff5a5f'; // rouge Airbnb
          } else if (url.includes('booking')) {
            color = '#0071c2'; // bleu Booking
          }

          allEvents.push({
            start: ev.start,
            end: ev.end,
            summary: ev.summary || 'Réservé',
            location: ev.location || '',
            source: url,
            color: color
          });
        }
      }
    } catch (err) {
      console.error(`❌ Erreur lors du chargement de ${url}:`, err.message);
    }
  }

  // Tri par date
  allEvents.sort((a, b) => a.start - b.start);
  return allEvents;
}

export default async function handler(req, res) {
  try {
    let { which } = req.query;

    // ✅ Défaut : Tiny si aucun paramètre n’est fourni
    if (!which) {
      which = 'tiny';
      console.log('⚠️ Aucun paramètre "which" fourni — utilisation de "tiny" par défaut');
    }

    const urls = calendarURLs[which];

    if (!urls || urls.length === 0 || urls.every(u => !u)) {
      return res.status(400).json({
        error: `Aucune URL iCal n'est configurée pour "${which}".`,
        hint: 'Vérifie tes variables d’environnement sur Vercel.'
      });
    }

    const events = await fetchAndMergeCalendars(urls);
    return res.status(200).json({ logement: which, count: events.length, events });

  } catch (error) {
    console.error('❌ Erreur interne du serveur:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
