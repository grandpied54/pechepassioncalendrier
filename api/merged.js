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

// ✅ Détermine s’il s’agit d’un jour d’arrivée, de départ ou d’un séjour complet
function getTypeFromDate(date, isStart, startDate, endDate) {
  if (!date || isNaN(date.getTime())) return 'full';

  const diff = (endDate - startDate) / (1000 * 60 * 60 * 24);
  if (diff <= 1) return 'full';

  return isStart ? 'arrival' : 'departure';
}

// ✅ Fonction utilitaire pour corriger la date de fin (ajouter 1 jour)
function addOneDay(date) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + 1);
  return newDate;
}

async function fetchAndMergeCalendars(urls) {
  const events = [];

  for (const url of urls) {
    if (!url) continue;

    try {
      const data = await ical.async.fromURL(url);

      for (const key in data) {
        const ev = data[key];
        if (!ev || ev.type !== 'VEVENT') continue;

        let color = '#888';
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('airbnb')) color = '#ff5a5f';
        if (lowerUrl.includes('booking')) color = '#0071c2';

        // 🕒 Correction : ajouter un jour à la fin
        const adjustedEnd = addOneDay(ev.end);

        const startType = getTypeFromDate(ev.start, true, ev.start, adjustedEnd);
        const endType = getTypeFromDate(adjustedEnd, false, ev.start, adjustedEnd);

        events.push({
          start: ev.start,
          end: adjustedEnd, // 👈 ici la fin corrigée
          summary: ev.summary || 'Réservé',
          location: ev.location || '',
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

  // Tri des événements par date
  events.sort((a, b) => a.start - b.start);
  return events;
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
