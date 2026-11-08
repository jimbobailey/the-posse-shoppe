MORSE ELECTRIC WEBSITE
======================

To view it: double-click index.html. It opens in your web browser.

WHAT'S IN THE FOLDER
  index.html          The whole homepage
  assets/css/         styles.css  - colors, fonts, layout
  assets/js/          main.js     - mobile menu, photo viewer, scroll effects
  assets/img/         logo, photos, icons

SWAP IN REAL PHOTOS (easy way)
  Put Ben's photo in assets/img and give it the SAME NAME as the one you're replacing.
  Example: name a real job photo "gallery-01.jpg" and drop it in. Done.
    hero-electrical-panel.jpg   big photo at the top
    about-tools.jpg             About section photo
    gallery-01.jpg ... gallery-06.jpg   Project Gallery
    why-wiring.jpg              faint background behind "Why Choose"
    contact-power-lines.jpg     faint background behind Contact
  Photos from a phone work fine. Landscape (sideways) photos look best.
  Then open index.html in Notepad and change each photo's caption (the words
  between <figcaption> and </figcaption>).

REMOVE A SERVICE BEN DOESN'T OFFER
  Open index.html in Notepad. Find the service title (example: Troubleshooting).
  Delete from the <article class="service-card reveal"> line above it down to
  the </article> line below it.

ADD REAL REVIEWS
  In index.html, find "REAL REVIEWS". Instructions are right there.

CHANGE THE GOLD COLOR
  Open assets/css/styles.css. Near the top, change  --gold: #d9a520;

PHOTO CREDITS
  Placeholder photos are from Unsplash (free to use under the Unsplash License,
  https://unsplash.com/license). Replace them with real Morse Electric photos
  before going live. See assets/img/PHOTO-CREDITS.txt.
