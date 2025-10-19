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

// ✅ Fonction sécurisée pour déterminer le type selon l'heure
function getTypeFromDate(date, isStart) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.error('⚠️ Date invalide détectée dans un événement iCal');
    return 'full';
  }

  const hour = date.getHours();

  if (isStart) {
    return hour > 8 ? 'arrival' : 'full';
  } else {
    return hour < 23 ? 'departure' : 'full';
  }
}

async function fetchAndMergeCalendars(urls) {
  const allEvents = [];

  for (const url of urls) {
    if (!url) continue;

    try {
      const data = await ical.async.fromURL(url);
      for (const key in data) {
        const ev = data[key];
        if (ev.type !== 'VEVENT') continue;

        let color = '#888';
        if (url.includes('airbnb')) color = '#ff5a5f';
        else if (url.includes('booking')) color = '#0071c2';

        const startType = getTypeFromDate(ev.start, true);
        const endType = getTypeFromDate(ev.end, false);

        allEvents.push({
          start: ev.start,
          end: ev.end,
          summary: ev.summary || 'Réservé',
          source: url,
          color,
          startType,
          endType
        });
      }
    } catch (err) {
      console.error(`❌ Erreur lors du chargement de ${url}:`, err.message);
    }
  }

  allEvents.sort((a, b) => a.start - b.start);
  return allEvents;
}

export default async function handler(req, res) {
  try {
    let { which } = req.query;
    if (!which) which = 'tiny';

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
