/**
 * Copy for the three menu pages.
 *
 * The e-mail addresses are placeholders until the domain is decided.
 * Everything about hosting, data and third parties is rewritten, because the
 * original text described a newsletter, a database and AWS hosting that no
 * longer exist.
 */

const HELLO = 'hello@sefkhet-abwy.quest';
const PRIVACY = 'privacy@sefkhet-abwy.quest';

function About() {
  return (
    <>
      <p className="lede">A map that opens where you are, and shows the national monuments around you.</p>
      <p>
        When you open the app, it asks your device for its position and centres the map
        there. A solid dot marks a position your device measured, with a circle showing
        how precise it is. A hollow ring marks an estimate based on your internet
        connection, used while the device is still working it out, or when location
        access is switched off.
      </p>
      <p>
        Zoom in to street level and a black square marks each rijksmonument, a building or
        site on the Dutch national register of monuments. Tap a square for its name or type,
        its address and a link to its entry in the official register.
      </p>
      <p>
        The app has no account and no tracking. To find the monuments on screen, it sends
        the centre of the map to its own server; see Legal for what that involves.
      </p>

      <h2>Sefkhet-Abwy</h2>
      <p>
        In Egyptian mythology, Sefkhet-Abwy is the goddess of writing, record-keeping and
        measurement. Her name means “she of the seven horns”. She is shown as a woman in a
        leopard-skin robe, wearing a seven-pointed star on her head beneath a pair of
        downturned horns.
      </p>
      <p>
        She kept the records of the world: the years of each king’s reign, the counts of
        people and goods, the books of the temple libraries. With the king she performed
        the rite of “stretching the cord”, sighting the stars to lay out the foundations of
        a new temple on the ground. She was the first surveyor, and the goddess of every
        map.
      </p>

      {/* "The quest" section removed pending review:
      <h2>The quest</h2>
      <p>
        A quest is a journey toward a specific goal. The hero faces obstacles, gains
        wisdom and returns changed. Every quest starts by knowing where you stand.
      </p>
      */}

      <h2>Built with</h2>
      <ul>
        <li>ArcGIS Maps SDK for JavaScript by Esri</li>
        <li>Map data from OpenStreetMap contributors</li>
        <li>Monument data from the Rijksdienst voor het Cultureel Erfgoed</li>
        <li>React and Vite, hosted on Vercel</li>
        <li>IBM Plex Mono, by IBM, under the SIL Open Font License</li>
      </ul>
    </>
  );
}

function Legal() {
  return (
    <>
      <p className="lede">Privacy, map data and terms of use.</p>

      <h2>Your location</h2>
      <p>
        The app asks your browser for your device’s position so it can centre the map. You
        can refuse, and you can withdraw permission at any time in your browser’s site
        settings. The position itself is used only on your device to draw the map.
      </p>
      <p>
        To show monuments, the app sends the coordinates of the centre of the map to our
        server each time the map stops moving, at street level and closer. When the map is
        centred on you, those coordinates are close to your position. The server uses them
        only to look up nearby monuments in our database and does not store them, apart
        from the standard request logs our host keeps.
      </p>
      <p>
        To open the map quickly, the app also requests an approximate, city-level position
        from our host, Vercel, which derives it from your IP address. That answer is
        returned to your browser and not stored.
      </p>

      <h2>Services the app uses</h2>
      <p>
        Loading the app and the map means your browser connects to these providers, which
        receive your IP address and the requests your browser makes, as with any website:
      </p>
      <ul>
        <li>Vercel Inc., which hosts the app and may keep standard request logs.</li>
        <li>
          Supabase Inc., which hosts the monument database in the EU. Only our server
          connects to it, not your browser.
        </li>
        <li>Esri, which serves parts of the ArcGIS Maps SDK from js.arcgis.com.</li>
        <li>
          The OpenStreetMap Foundation, which serves map tiles from tile.openstreetmap.org.
          The tiles requested reveal the area you are viewing.
        </li>
      </ul>

      <h2>Cookies and storage</h2>
      <p>
        The app sets no cookies and uses no analytics. When installed or visited, it stores
        its own files and recently viewed map tiles on your device so it opens faster and
        partly works offline. Clearing site data in your browser removes them.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you may ask what personal data we hold about you and ask us to correct
        or delete it. We hold none beyond hosting logs kept by Vercel. For requests or
        questions, e-mail <a href={`mailto:${PRIVACY}`}>{PRIVACY}</a>.
      </p>

      <h2>Map data and attribution</h2>
      <p>
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>,
        available under the Open Database License. Mapping software: ArcGIS Maps SDK for
        JavaScript, © Esri.
      </p>
      <p>
        Monument data © <a href="https://www.cultureelerfgoed.nl" target="_blank" rel="noreferrer">Rijksdienst
        voor het Cultureel Erfgoed</a> (RCE), available under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY
        4.0</a>, from the Rijksmonumentenregister via PDOK and RCE Linked Data. The app’s
        copy can lag behind; the official register is authoritative.
      </p>

      <h2>No warranty</h2>
      <p>
        Positions shown can be wrong by metres or, for network estimates, by kilometres. Do
        not rely on this app for navigation, safety or emergencies. The app is provided as
        is, without warranty of any kind.
      </p>
    </>
  );
}

function Contact() {
  return (
    <>
      <p className="lede">Questions, collaborations or submissions.</p>

      <dl className="contact-list">
        <div>
          <dt>General</dt>
          <dd><a href={`mailto:${HELLO}`}>{HELLO}</a></dd>
        </div>
        <div>
          <dt>Privacy</dt>
          <dd><a href={`mailto:${PRIVACY}`}>{PRIVACY}</a></dd>
        </div>
      </dl>

      <p>
        If the map opens in the wrong place, tell us which browser and device you use and
        whether location access is allowed. That usually explains it.
      </p>
    </>
  );
}

export const PAGES = {
  about: { title: 'About', Body: About },
  legal: { title: 'Legal', Body: Legal },
  contact: { title: 'Contact', Body: Contact },
};

export const PAGE_ORDER = ['about', 'legal', 'contact'];

/** "/legal" → "legal"; anything unknown → null (the plain map). */
export function pageFromPath(pathname) {
  const id = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  return Object.hasOwn(PAGES, id) ? id : null;
}
