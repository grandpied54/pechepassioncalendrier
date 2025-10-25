// pages/api/merged.js
import ical from 'node-ical';

// 🔧 variables d’env. à définir sur Vercel
// TINY_AIRBNB_ICAL_URL, TINY_BOOKING_ICAL_URL, STUDIO_AIRBNB_ICAL_URL, STUDIO_BOOKING_ICAL_URL

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

// ➕ ajoute 1 jour à la fin (FullCalendar traite `end` comme exclusif)
function addOneDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

// date -> "YYYY-MM-DD" en **heure locale** (pour allDay)
function toLocalDateOnlyString(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickColorFromURL(url = '') {
  const u = url.toLowerCase();
  if (u.includes('airbnb')) return '#ff5a5f';
  if (u.includes('booking')) return '#0071c2';
  return '#888';
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

        const adjustedEnd = addOneDay(ev.end);

        // on renvoie des **dates au format YYYY-MM-DD** + allDay=true
        events.push({
          title: ev.summary || 'Réservé',
          start: toLocalDateOnlyString(ev.start),
          end: toLocalDateOnlyString(adjustedEnd),
          allDay: true,
          color: pickColorFromURL(url),
          source: url
        });
      }
    } catch (err) {
      console.error(`❌ ical load error ${url}:`, err.message);
    }
  }

  // tri
  events.sort((a, b) => new Date(a.start) - new Date(b.start));
  return events;
}

export default async function handler(req, res) {
  try {
    let { which } = req.query;
    if (!which || !['tiny', 'studio'].includes(which)) which = 'tiny';

    const urls = calendarURLs[which] || [];
    if (urls.length === 0 || urls.every(u => !u)) {
      return res.status(400).json({
        error: `Aucune URL iCal configurée pour "${which}".`,
        hint: 'Définis les variables d’environnement sur Vercel.'
      });
    }

    const events = await fetchAndMergeCalendars(urls);

    // entêtes sobres (pas de cache agressif pendant tes tests)
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ logement: which, count: events.length, events });
  } catch (e) {
    console.error('❌ API error:', e);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
