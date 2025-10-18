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
        if (ev.type !== 'VEVENT') continue;

        // 🎨 Couleur selon la source
        let color = '#888'; // par défaut
        if (url.includes('airbnb')) color = '#ff5a5f'; // rouge
        else if (url.includes('booking')) color = '#0071c2'; // bleu

        // 📝 Texte affiché dans le calendrier
        let summaryText = 'Fermé';
        if (url.includes('airbnb')) summaryText = 'Airbnb - Réservé';
        else if (url.includes('booking')) summaryText = 'Booking - Réservé';

        // 📅 Correction de la date de fin pour libérer le jour de départ
        const correctedEnd = new Date(ev.end);
        correctedEnd.setDate(correctedEnd.getDate() - 1);
        correctedEnd.setHours(23, 59, 59, 999);

        allEvents.push({
          start: ev.start,
          end: correctedEnd,
          summary: summaryText,
          location: ev.location || '',
          source: url,
          color: color,
          departureDay: ev.end // 👈 utilisé pour afficher la petite barre sur le jour de départ
        });
      }
    } catch (err) {
      console.error(`❌ Erreur lors du chargement de ${url}:`, err.message);
    }
  }

  // Tri des événements par date
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

