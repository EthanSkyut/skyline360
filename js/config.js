// ============================================================
//  SKYLINE 360 — SITE SETTINGS
//  Edit this file to swap media, prices, and contact info.
//  File paths are relative to the website folder.
// ============================================================
window.SKYLINE_CONFIG = {
  business: {
    name: "Skyline 360",
    legalName: "Skyline 360 LLC",           // registered entity, shown in the footer
    owner: "Ethan Daugherty",
    tagline: "Aerial cinema for places worth showing off",
    email: "ethandaugherty03@gmail.com",
    phone: "",                              // TODO: blank hides it everywhere, so no fake number ships
    instagram: "skyline360utah",
    serviceArea: "Utah County · Salt Lake County · Park City",
    baseCity: "Provo, Utah",
    part107: false,                         // UNCONFIRMED at launch (2026-09-20). Set true once your FAA Part 107 certificate is issued
    insured: false,                         // UNCONFIRMED at launch (2026-09-20). Set true once your drone liability policy is active
  },

  // Booking: paste a Calendly / Cal.com link to show a "Pick a time" button.
  bookingUrl: "",
  // Form delivery: create a free Formspree form and paste its endpoint (https://formspree.io/f/xxxx).
  // Left blank, the form opens the visitor's email app instead.
  formEndpoint: "",

  // Honest scarcity: only show this while it is actually true.
  launchOffer: {
    enabled: true,
    text: "Founding Client Offer — the first 10 Utah agents get a Signature Listing at Essentials pricing.",
  },

  // HERO REEL — short clips (6–12 s each), landscape, muted. They crossfade in order, forever.
  heroReel: {
    poster: "assets/video/reel/poster.jpg",
    clips: [
      { src: "assets/video/reel/reel-01.mp4", label: "Twilight estate — Alpine" },
      { src: "assets/video/reel/reel-02.mp4", label: "FPV fly-through — Lehi" },
      { src: "assets/video/reel/reel-03.mp4", label: "New community — Saratoga Springs" },
      { src: "assets/video/reel/reel-04.mp4", label: "Mountain property — Park City" },
      { src: "assets/video/reel/reel-05.mp4", label: "Commercial build — Provo" },
    ],
  },

  // 3D MODEL — export your Polycam scan as .glb and drop it here.
  model3d: {
    src: "assets/models/house.glb",
    // Optional alternative: a Polycam embed link. Leave blank to use the spinning .glb viewer.
    polycamEmbedUrl: "",
    rotationSpeed: 0.6,
  },

  // 360° VIDEOS — equirectangular MP4 exports from your Avata 360.
  pano360: [
    { src: "assets/video/360/flight-01.mp4", title: "Lakefront sunrise", location: "Utah Lake" },
    { src: "assets/video/360/flight-02.mp4", title: "Canyon estate", location: "Provo Canyon" },
    { src: "assets/video/360/flight-03.mp4", title: "Neighborhood overview", location: "Lehi" },
  ],

  // BEFORE / AFTER — same property, ground level vs. aerial.
  compare: {
    before: "assets/photos/compare-ground.jpg",
    after: "assets/photos/compare-aerial.jpg",
    beforeLabel: "Phone photo from the curb",
    afterLabel: "Skyline 360 aerial",
  },

  // PORTFOLIO PHOTOS — category must be one of: realestate, construction, business, land
  photos: [
    { src: "assets/photos/photo-01.jpg", category: "realestate", alt: "Twilight aerial of a modern home", tall: true },
    { src: "assets/photos/photo-02.jpg", category: "realestate", alt: "Backyard pool from above" },
    { src: "assets/photos/photo-03.jpg", category: "construction", alt: "Commercial build progress aerial" },
    { src: "assets/photos/photo-04.jpg", category: "land", alt: "Mountain acreage at golden hour", tall: true },
    { src: "assets/photos/photo-05.jpg", category: "business", alt: "Storefront and parking lot aerial" },
    { src: "assets/photos/photo-06.jpg", category: "realestate", alt: "Neighborhood context shot" },
    { src: "assets/photos/photo-07.jpg", category: "construction", alt: "New subdivision roads and lots" },
    { src: "assets/photos/photo-08.jpg", category: "land", alt: "Canyon road top-down" },
    { src: "assets/photos/photo-09.jpg", category: "business", alt: "Event venue from above", tall: true },
  ],

  about: {
    photo: "assets/about/ethan.jpg",
    name: "Ethan Daugherty",
    role: "Founder · FAA Part 107 Pilot",
    // TODO: rewrite in your own voice. Keep it short, specific, and local.
    bio: [
      "I started Skyline 360 because I kept seeing incredible Utah properties marketed with phone photos taken from the curb. The view from above tells the story a listing can't: the mountains behind it, the lot, the neighborhood, the light at golden hour.",
      "Today I fly cinematic aerial, FPV, and immersive 360° footage for agents, builders, and businesses across the Wasatch Front. Every shoot is planned, legally cleared for airspace, and delivered fast so you can post while the listing is still fresh.",
    ],
    credentials: ["FAA Part 107 Certified", "Fully Insured", "Airspace (LAANC) Authorized", "Utah Local"],
  },

  // Keep these honest: only real quotes from real clients.
  // TESTIMONIALS — real clients only, quoted with their permission. The whole section stays
  // hidden while this list is empty, so the site never shows made-up reviews.
  // What converts: first + last name, their role, and one specific result
  // (showings, days on market, inquiries). Example shape:
  //   { quote: "…", name: "Jane Smith", role: "REALTOR®, Brokerage" },
  testimonials: [],

  packages: [
    {
      name: "Cinematic Estate",
      price: "$799",
      blurb: "For luxury listings that deserve a premiere.",
      features: [
        "40 aerial + ground-level hero photos",
        "2–3 min cinematic film with FPV fly-through",
        "Twilight / golden-hour session",
        "Interactive 360° aerial tour",
        "2 vertical cuts for Reels & TikTok",
        "Delivered in 72 hours",
      ],
      featured: false,
    },
    {
      name: "Signature Listing",
      price: "$399",
      blurb: "The package most agents choose.",
      features: [
        "25 edited aerial photos",
        "60–90 sec cinematic aerial film",
        "30-sec vertical social cut",
        "Branded + MLS-compliant versions",
        "Licensed music",
        "Delivered in 48 hours",
      ],
      featured: true,
    },
    {
      name: "Essentials",
      price: "$199",
      blurb: "Clean aerials for every listing.",
      features: [
        "15 edited aerial photos",
        "MLS-ready + full resolution",
        "Up to 1 acre",
        "Delivered in 24 hours",
      ],
      featured: false,
    },
  ],

  faqs: [
    {
      q: "Are you licensed and insured to fly commercially?",
      requires: ["part107", "insured"],   // hidden unless both toggles above are true
      a: "Yes. Every flight is flown by an FAA Part 107 certified remote pilot with active drone liability insurance. Certificates of insurance are available for your brokerage, HOA, or job site on request.",
    },
    {
      q: "Can you fly near Provo or Salt Lake City airports?",
      a: "Often, yes. Much of the Wasatch Front sits inside controlled airspace, so we request FAA authorization (LAANC) before each flight near an airport. If a location needs extra approval, we tell you up front and plan around it.",
    },
    {
      q: "How fast will I get my photos and video?",
      a: "Photos in 24 hours, Signature films in 48 hours, and Cinematic Estate films in 72 hours. Rush delivery is available.",
    },
    {
      q: "What happens if the weather is bad?",
      a: "Wind, rain, and snow reschedules are always free. We watch the forecast and reach out the day before if conditions look unsafe or unflattering.",
    },
    {
      q: "What is the 360° experience?",
      a: "We capture the entire sphere around the drone, so buyers can drag, swipe, or turn their phone to look in any direction. It keeps people on your listing longer and lets out-of-state buyers feel the location.",
    },
    {
      q: "Can I use the footage on the MLS, Zillow, and social media?",
      a: "Yes. You receive a marketing license to use the media for that property on the MLS, listing sites, social media, and print. MLS versions are delivered unbranded to meet MLS rules.",
    },
    {
      q: "How should the property be prepared?",
      a: "Cars out of the driveway, garage doors closed, trash bins hidden, sprinklers off, and lights on for twilight shoots. We send a one-page prep checklist after booking.",
    },
    {
      q: "Do you work with builders and construction companies?",
      a: "Yes. Monthly progress plans capture the same angles each visit, so your team, investors, and lenders can see the project move. Completion films and time-lapse compilations are available.",
    },
    {
      q: "What areas do you serve?",
      a: "Utah County, Salt Lake County, and Park City are included. Farther locations are welcome with a small travel fee.",
    },
  ],
};
