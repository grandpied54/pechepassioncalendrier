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

function getTypeFromDate(date, isStart) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
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

        // couleur selon la source
        let color = '#888';
        if (url.includes('airbnb')) color = '#ff5a5f';
        else if (url.includes('booking')) color = '#0071c2';

        // type arrivée / départ
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
      console.error(`Erreur chargement ${url}:`, err.message);
    }
  }

  return allEvents.sort((a, b) => a.start - b.start);
}

export default async function handler(req, res) {
  try {
    let { which } = req.query;
    if (!which) which = 'tiny';
    const urls = calendarURLs[which];

    if (!urls || urls.every(u => !u)) {
      return res.status(400).json({
        error: `Aucune URL iCal pour "${which}"`,
      });
    }

    const events = await fetchAndMergeCalendars(urls);
    res.status(200).json({ logement: which, count: events.length, events });
  } catch (error) {
    console.error('Erreur serveur:', error);
    res.status(500).json({ error: 'Erreur interne serveur' });
  }
}
