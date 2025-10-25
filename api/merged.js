
import ical from 'node-ical';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const which = (req.query.which || '').toString();
  const map = {
    tiny: [process.env.TINY_AIRBNB_ICAL, process.env.TINY_BOOKING_ICAL],
    studio: [process.env.STUDIO_AIRBNB_ICAL, process.env.STUDIO_BOOKING_ICAL],
  };

  if (!map[which]) {
    return res.status(400).json({ error: "Missing or invalid 'which' param. Use 'tiny' or 'studio'." });
  }

  const urls = map[which].filter(Boolean);
  if (!urls.length) return res.status(400).json({ error: 'No ICS urls configured for this calendar.' });

  try {
    const allEvents = [];
    for (const url of urls) {
      const data = await ical.async.fromURL(url);
      for (const k of Object.keys(data)) {
        const ev = data[k];
        if (ev.type === 'VEVENT') {
          allEvents.push({
            summary: ev.summary || 'Réservé',
            start: ev.start,
            end: ev.end
          });
        }
      }
    }

    const bookings = allEvents.map(ev => ({
      start: ev.start ? new Date(ev.start) : null,
      end: ev.end ? new Date(ev.end) : null,
      summary: ev.summary || 'Réservé'
    })).filter(b => b.start and b.end)

    bookings.sort((a,b) => a.start - b.start);
    const merged = [];
    for (const b of bookings) {
      if (!merged.length) { merged.push({...b}); continue; }
      const last = merged[merged.length-1];
      if (b.start <= last.end) {
        if (b.end > last.end) last.end = b.end;
      } else {
        merged.push({...b});
      }
    }

    res.status(200).json({ which, bookings: merged });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load ICS', details: String(e) });
  }
}
