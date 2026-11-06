/**
 * Portal setup — creates (idempotently) every SitecoreAI item the portal head needs through the
 * Authoring GraphQL API: templates, rendering parameters and lookups, renderings, datasources,
 * available renderings, standard-values layouts, Portal Settings, the page tree, partners,
 * dictionary and language versions; then publishes. Re-running updates fields in place.
 *
 * Shared by the CLI (tools/sitecoreai-setup.mjs, the Sitecore CLI's token) and the Portal setup
 * wizard (/portal-setup, a Marketplace app using the author's own rights). Plain JavaScript
 * without Node or browser-only APIs: the caller passes `gql` (Authoring API) and `log`.
 */
import { md5Hex } from "./md5.mjs";
import { moreTranslationsFor } from "./translations.mjs";

/** The head's UI strings: key → [English, German]; the English phrase is the dictionary default (see examples/portal/src/lib/portal/ui-keys.ts). */
export const UI_STRINGS = {
  download: ["Download", "Herunterladen"], downloadOriginal: ["Download original", "Original herunterladen"], open: ["Open →", "Öffnen →"],
  readRelease: ["Read the release →", "Mitteilung lesen →"], comingSoon: ["Coming soon", "Demnächst"],
  comingSoonLead: ["This brand's guidelines are being prepared and are not published yet. Check back soon.", "Die Richtlinien dieser Marke werden gerade vorbereitet und sind noch nicht veröffentlicht. Schauen Sie bald wieder vorbei."],
  brandGuidelines: ["Brand guidelines →", "Markenrichtlinien →"], allBrands: ["All brands", "Alle Marken"], allBrandsBack: ["← All brands", "← Alle Marken"],
  allProductsBack: ["← All products", "← Alle Produkte"], all: ["All", "Alle"], allCollections: ["All collections", "Alle Sammlungen"], allTypes: ["All types", "Alle Typen"],
  brands: ["Brands", "Marken"], collections: ["Collections", "Sammlungen"], images: ["Images", "Bilder"], videos: ["Videos", "Videos"], video: ["Video", "Video"],
  documents: ["Documents", "Dokumente"], audio: ["Audio", "Audio"], files: ["Files", "Dateien"], description: ["Description", "Beschreibung"], details: ["Details", "Details"],
  dataSheet: ["Data sheet", "Datenblatt"], productData: ["Product data", "Produktdaten"], productNumber: ["Product number", "Produktnummer"], product: ["Product", "Produkt"],
  brand: ["Brand", "Marke"], variants: ["Variants", "Varianten"], related: ["Related content", "Verwandte Inhalte"], pressContact: ["Press contact", "Pressekontakt"],
  mediaKit: ["Media kit", "Media Kit"], searchPlaceholder: ["Search titles, files, brands…", "Titel, Dateien, Marken suchen…"], search: ["Search", "Suche"], type: ["Type", "Typ"],
  countOf: ["{shown} of {total}", "{shown} von {total}"], noPublicLink: ["no public link", "kein Public Link"], previous: ["Previous", "Zurück"], next: ["Next", "Weiter"],
  close: ["Close", "Schließen"], preview: ["Preview", "Vorschau"], poweredBy: ["Sitecore Content Hub", "Sitecore Content Hub"], language: ["Language", "Sprache"],
  signIn: ["Sign in", "Anmelden"], signOut: ["Sign out", "Abmelden"], staff: ["Staff", "Mitarbeiter"], welcome: ["Welcome, {name}", "Willkommen, {name}"],
  partnerKit: ["Your partner kit", "Ihr Partner-Kit"], partnerKitOf: ["Partner kit", "Partner-Kit"], campaignKits: ["Campaign kits", "Kampagnen-Kits"], partners: ["Partners", "Partner"],
  kitEmpty: ["No approved files in this kit yet.", "Noch keine freigegebenen Dateien in diesem Kit."], kitCount: ["{count} files", "{count} Dateien"], tier: ["Tier", "Stufe"], region: ["Region", "Region"],
  focusBrand: ["Focus brand", "Fokusmarke"], partnerLogin: ["Partner login", "Partner-Login"], allPartnersBack: ["← All partners", "← Alle Partner"],
  partnerManager: ["Your partner manager: {name}", "Ihr Partner Manager: {name}"],
  partnerManagerOf: ["Partner manager: {name}", "Partner Manager: {name}"],
  partnerType: ["Partner type", "Partnertyp"],
  sharedWithYou: ["Shared with you", "Für Sie freigegeben"],
  partnerFilesLead: ["Approved material for your channels: documents shared with you and your collections.", "Freigegebenes Material für Ihre Kanäle: für Sie freigegebene Dokumente und Ihre Sammlungen."],
  filesBeingPrepared: ["Your files are being put together. Check back soon.", "Ihre Dateien werden zusammengestellt. Schauen Sie bald wieder vorbei."],
  productsLabel: ["Products", "Produkte"],
  partnerProductsLead: ["The products you sell and support for us.", "Die Produkte, die Sie für uns verkaufen und betreuen."],
  contentLabel: ["Content", "Inhalte"],
  partnerContentLead: ["Approved copy to use and localize for your market.", "Freigegebene Texte für Ihren Markt, zum Verwenden und Lokalisieren."],
  collectionsLead: ["Pick one in the file list above to see only its files.", "Wählen Sie oben in der Dateiliste eine Sammlung, um nur deren Dateien zu sehen."],
  myUploads: ["My uploads", "Meine Uploads"],
  uploads: ["Uploads", "Uploads"],
  uploadsLead: ["Files you upload go to our team for review (up to {mb} MB each). Once your partner manager approves them, they appear in your files.", "Hochgeladene Dateien prüft unser Team (bis {mb} MB je Datei). Sobald Ihr Partner Manager sie freigibt, erscheinen sie in Ihren Dateien."],
  uploadsStaffLead: ["Files this partner uploaded, with their review status.", "Von diesem Partner hochgeladene Dateien mit ihrem Prüfstatus."],
  dropFiles: ["Drag files here", "Dateien hierher ziehen"],
  dropHint: ["or click to choose: co-branded material, local adaptations, event photos …", "oder klicken und auswählen: Co-Branding-Material, lokale Anpassungen, Eventfotos …"],
  statusReview: ["In review", "In Prüfung"],
  statusChanges: ["Changes requested", "Änderungen angefordert"],
  statusApproved: ["Approved, in your files", "Freigegeben, in Ihren Dateien"],
  uploadFailed: ["Failed: {reason}", "Fehlgeschlagen: {reason}"],
  dismiss: ["Dismiss", "Ausblenden"],
  nothingUploaded: ["Nothing uploaded yet.", "Noch nichts hochgeladen."],
  partnerNothingUploaded: ["This partner hasn’t uploaded anything yet.", "Dieser Partner hat noch nichts hochgeladen."],
  signedInAs: ["Signed in as", "Angemeldet als"],
  contact: ["Contact", "Ansprechpartner"],
  loginName: ["Login", "Login"],
  loadFailed: ["This section couldn’t be loaded right now. Please try again in a moment.", "Dieser Bereich kann gerade nicht geladen werden. Bitte versuchen Sie es gleich noch einmal."],
  notAvailable: ["This item isn’t available.", "Dieser Eintrag ist nicht verfügbar."],
  portalSections: ["Portal sections", "Portalbereiche"],
  brandPortal: ["Brand portal", "Markenportal"],
  footerLeft: ["Brand system portal", "Markensystem-Portal"],
  footerRight: ["Content via Experience Edge · files via public links", "Inhalte über Experience Edge · Dateien über Public Links"],
  noPreview: ["No preview for this file — download it to open it.", "Keine Vorschau für diese Datei — laden Sie sie herunter, um sie zu öffnen."],
  showMore: ["Show {count} more", "{count} weitere anzeigen"],
  nothingMatches: ["Nothing matches — clear a filter or the search.", "Keine Treffer — entfernen Sie einen Filter oder leeren Sie die Suche."],
  noProducts: ["No products are published yet — products appear here once their status is Approved in Content Hub.", "Noch keine Produkte veröffentlicht — Produkte erscheinen hier, sobald ihr Status in Content Hub „Approved“ ist."],
  moreProducts: ["More products", "Weitere Produkte"],
  allProducts: ["All products", "Alle Produkte"],
  allReleasesBack: ["← All releases", "← Alle Mitteilungen"],
  pressRelease: ["Press release", "Pressemitteilung"],
  aboutBrand: ["About {name}", "Über {name}"],
  aboutUs: ["About us", "Über uns"],
  nothingPublished: ["Nothing is published here yet.", "Hier ist noch nichts veröffentlicht."],
  noBrands: ["No brands are published yet.", "Noch keine Marken veröffentlicht."],
  noMedia: ["No approved media is published yet.", "Noch keine freigegebenen Medien veröffentlicht."],
  mediaCapped: ["Showing the first {count} assets.", "Die ersten {count} Assets werden angezeigt."],
  noPress: ["No press releases are published yet — they appear here once they reach Final in Content Hub.", "Noch keine Pressemitteilungen veröffentlicht — sie erscheinen hier, sobald sie in Content Hub den Status „Final“ erreichen."],
  bbTabbed: ["Tabbed", "Registerkarten"],
  bbEditorial: ["Editorial", "Editorial"],
  bbLayoutToggle: ["Brand book layout", "Layout der Markenrichtlinien"],
  bbGuidelines: ["Brand guidelines", "Markenrichtlinien"],
  bbMasterBrand: ["{brand} · Master brand", "{brand} · Dachmarke"],
  bbHeroTitleTop: ["Brand", "Marken-"],
  bbHeroTitleBottom: ["Guidelines", "richtlinien"],
  bbHeroLead: ["Everything needed to put {brand} in the world correctly — colour, logo, type and the rules that hold them together. Assets here are the only approved versions; anything older should be replaced.", "Alles, was Sie brauchen, um {brand} richtig in die Welt zu bringen — Farbe, Logo, Schrift und die Regeln, die alles zusammenhalten. Die Assets hier sind die einzigen freigegebenen Versionen; ältere sollten ersetzt werden."],
  bbSectionsNav: ["Brand guideline sections", "Bereiche der Markenrichtlinien"],
  bbSections: ["Sections", "Bereiche"],
  bbFooterSystem: ["{brand} brand system", "Markensystem von {brand}"],
  bbFooterManaged: ["Managed in Sitecore Content Hub", "Verwaltet in Sitecore Content Hub"],
  bbLogoAlt: ["{brand} logo", "Logo von {brand}"],
  bbSecColour: ["Colour", "Farbe"],
  bbSecLogo: ["Logo", "Logo"],
  bbSecTypography: ["Typography", "Typografie"],
  bbSecDocuments: ["Documents", "Dokumente"],
  bbSecTemplates: ["Templates", "Vorlagen"],
  bbSecDodont: ["Do & don’t", "Do & Don’t"],
  bbSecPersonas: ["Target personas", "Zielgruppen-Personas"],
  bbSecCharacteristics: ["Brand characteristics", "Markeneigenschaften"],
  bbCountColourOne: ["1 colour", "1 Farbe"],
  bbCountColour: ["{count} colours", "{count} Farben"],
  bbCountColourNone: ["no colours", "keine Farben"],
  bbCountLogoOne: ["1 logo", "1 Logo"],
  bbCountLogo: ["{count} logos", "{count} Logos"],
  bbCountLogoNone: ["no logos", "keine Logos"],
  bbCountFontOne: ["1 font", "1 Schrift"],
  bbCountFont: ["{count} fonts", "{count} Schriften"],
  bbCountFontNone: ["no fonts", "keine Schriften"],
  bbCountDocumentOne: ["1 document", "1 Dokument"],
  bbCountDocument: ["{count} documents", "{count} Dokumente"],
  bbCountDocumentNone: ["no documents", "keine Dokumente"],
  bbCountTemplateOne: ["1 template", "1 Vorlage"],
  bbCountTemplate: ["{count} templates", "{count} Vorlagen"],
  bbCountTemplateNone: ["no templates", "keine Vorlagen"],
  bbCountDodontOne: ["1 do & don’t", "1 Do & Don’t"],
  bbCountDodont: ["{count} do & don’ts", "{count} Dos & Don’ts"],
  bbCountDodontNone: ["no do & don’ts", "keine Dos & Don’ts"],
  bbCountPersonaOne: ["1 persona", "1 Persona"],
  bbCountPersona: ["{count} personas", "{count} Personas"],
  bbCountPersonaNone: ["no personas", "keine Personas"],
  bbCountCharacteristicOne: ["1 characteristic", "1 Eigenschaft"],
  bbCountCharacteristic: ["{count} characteristics", "{count} Eigenschaften"],
  bbCountCharacteristicNone: ["no characteristics", "keine Eigenschaften"],
  bbDescColour: ["Click any swatch to copy its hex. Values live as .cihubcolor assets on this brand.", "Klicken Sie auf ein Farbfeld, um den Hex-Wert zu kopieren. Die Werte liegen als .cihubcolor-Assets an dieser Marke."],
  bbDescLogo: ["Every approved mark for this brand. Toggle the preview to check light and dark variants.", "Alle freigegebenen Logos dieser Marke. Wechseln Sie die Vorschau, um helle und dunkle Varianten zu prüfen."],
  bbDescTypography: ["The brand’s licensed families, previewed live from the font files on this brand.", "Die lizenzierten Schriftfamilien der Marke, live aus den Schriftdateien dieser Marke dargestellt."],
  bbDescDocuments: ["The written rules. Open a document to read it in presentation mode.", "Die schriftlichen Regeln. Öffnen Sie ein Dokument, um es im Präsentationsmodus zu lesen."],
  bbDescDocumentsDownload: ["The written rules. Open a document to read it in presentation mode, or download the file.", "Die schriftlichen Regeln. Öffnen Sie ein Dokument, um es im Präsentationsmodus zu lesen, oder laden Sie die Datei herunter."],
  bbDescTemplates: ["Pre-built and on-brand. Start here rather than rebuilding — templates already carry the correct type, spacing and logo placement.", "Vorgefertigt und markenkonform. Beginnen Sie hier, statt neu zu bauen — Vorlagen bringen bereits die richtige Schrift, Abstände und Logoplatzierung mit."],
  bbDescDodont: ["The mistakes we see most often — and what right looks like. Select a rule to see the example and the full explanation.", "Die häufigsten Fehler — und wie es richtig aussieht. Wählen Sie eine Regel, um das Beispiel und die vollständige Erklärung zu sehen."],
  bbDescPersonas: ["Who this brand speaks to. Select a persona to read the full profile.", "Die Menschen, die diese Marke anspricht. Wählen Sie eine Persona, um das vollständige Profil zu lesen."],
  bbDescCharacteristics: ["The traits every expression of this brand should carry. Use them as a checklist before anything ships.", "Die Eigenschaften, die jeder Auftritt dieser Marke tragen sollte. Nutzen Sie sie als Checkliste, bevor etwas veröffentlicht wird."],
  bbEmptyColour: ["No brand colours yet", "Noch keine Markenfarben"],
  bbEmptyColourHint: ["Colours are stored as .cihubcolor assets linked to this brand.", "Farben werden als .cihubcolor-Assets gespeichert, die mit dieser Marke verknüpft sind."],
  bbEmptyLogo: ["No brand logos yet", "Noch keine Markenlogos"],
  bbEmptyLogoHint: ["Logos are assets on this brand with the type “Brand logo”.", "Logos sind Assets dieser Marke mit dem Typ „Brand logo“."],
  bbEmptyTypography: ["No brand fonts yet", "Noch keine Markenschriften"],
  bbEmptyTypographyHint: ["Fonts are assets on this brand with the type “Brand font”.", "Schriften sind Assets dieser Marke mit dem Typ „Brand font“."],
  bbEmptyDocuments: ["No guideline documents yet", "Noch keine Richtliniendokumente"],
  bbEmptyDocumentsHint: ["Guideline PDFs are assets on this brand with the type “Brand guideline”.", "Richtlinien-PDFs sind Assets dieser Marke mit dem Typ „Brand guideline“."],
  bbEmptyTemplates: ["No templates yet", "Noch keine Vorlagen"],
  bbEmptyTemplatesHint: ["Templates are assets on this brand with the type “Brand template” (PPTX, DOCX, PDF, HTML).", "Vorlagen sind Assets dieser Marke mit dem Typ „Brand template“ (PPTX, DOCX, PDF, HTML)."],
  bbEmptyDodont: ["No examples yet", "Noch keine Beispiele"],
  bbEmptyDodontHint: ["Rules appear here once “Brand do & don’t” content items are published to Experience Edge.", "Regeln erscheinen hier, sobald Content Items vom Typ „Brand do & don’t“ in Experience Edge veröffentlicht sind."],
  bbEmptyPersonas: ["No personas yet", "Noch keine Personas"],
  bbEmptyPersonasHint: ["Personas appear here once “Brand target persona” content items are published to Experience Edge.", "Personas erscheinen hier, sobald Content Items vom Typ „Brand target persona“ in Experience Edge veröffentlicht sind."],
  bbEmptyCharacteristics: ["No characteristics yet", "Noch keine Eigenschaften"],
  bbEmptyCharacteristicsHint: ["Traits appear here once “Brand characteristics” content items are published to Experience Edge.", "Eigenschaften erscheinen hier, sobald Content Items vom Typ „Brand characteristics“ in Experience Edge veröffentlicht sind."],
  bbPreviewLight: ["Preview on light", "Vorschau auf hellem Grund"],
  bbPreviewDark: ["Preview on dark", "Vorschau auf dunklem Grund"],
  bbNoPublicLinkYet: ["No public link yet", "Noch kein Public Link"],
  bbNoLink: ["No link", "Kein Link"],
  bbDownloadsOff: ["Downloads off", "Downloads deaktiviert"],
  bbOpenDoc: ["Open", "Öffnen"],
  bbDownloadFamily: ["Download family", "Schriftfamilie herunterladen"],
  bbDownloadFile: ["Download {name}", "{name} herunterladen"],
  bbCopyColour: ["Copy {name} {hex}", "{name} {hex} kopieren"],
  bbCopied: ["Copied {value}", "{value} kopiert"],
  bbSampleText: ["The quick brown fox jumps over the lazy dog — 0123456789", "Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich — 0123456789"],
  bbSamplePlaceholder: ["Type to preview the fonts…", "Tippen Sie, um die Schriften in der Vorschau zu sehen…"],
  bbSampleLabel: ["Preview text", "Vorschautext"],
  bbBold: ["Bold 700", "Fett 700"],
  bbRegular: ["Regular 400", "Normal 400"],
  bbLicensed: ["Licensed brand family — served from Content Hub.", "Lizenzierte Markenschriftfamilie — bereitgestellt aus Content Hub."],
  bbFormat: ["Format", "Format"],
  bbWeight: ["Weight", "Schriftstärke"],
  bbFontFailed: ["The font couldn’t be loaded.", "Die Schrift konnte nicht geladen werden."],
  bbDo: ["Do", "Do"],
  bbDont: ["Don’t", "Don’t"],
  bbNoImageYet: ["No image yet", "Noch kein Bild"],
  bbPersonaDetails: ["{name} details", "Details zu {name}"],
  bbPdfLoading: ["Loading brand book…", "Markenrichtlinien werden geladen…"],
  bbPdfDownload: ["Download PDF", "PDF herunterladen"],
  bbPdfClose: ["Close (Esc)", "Schließen (Esc)"],
  bbPdfPage: ["Page {page}", "Seite {page}"],
  bbPdfPrev: ["Previous page", "Vorherige Seite"],
  bbPdfNext: ["Next page", "Nächste Seite"],
  spNextGame: ["Next game", "Nächstes Spiel"],
  spLastResult: ["Last result", "Letztes Ergebnis"],
  spVs: ["vs. {team}", "vs. {team}"],
  spAt: ["at {team}", "bei {team}"],
  spHome: ["Home", "Heim"],
  spAway: ["Away", "Auswärts"],
  spBuyTickets: ["Buy tickets", "Tickets kaufen"],
  spSoldOut: ["Sold out", "Ausverkauft"],
  spSoldPct: ["{pct}% sold", "{pct} % verkauft"],
  spStartsIn: ["Starts in", "Beginnt in"],
  spDays: ["d", "T"],
  spHours: ["h", "Std."],
  spMinutes: ["min", "Min."],
  spUnderway: ["Under way", "Läuft"],
  spFinal: ["Final", "Endstand"],
  spThreeStars: ["Three stars", "Drei Stars"],
  spGoalie: ["Goaltending", "Torhüter"],
  spGameDetails: ["Game details →", "Spieldetails →"],
  spSchedule: ["Schedule & results", "Spielplan & Ergebnisse"],
  spUpcoming: ["Upcoming", "Kommende Spiele"],
  spResults: ["Results", "Ergebnisse"],
  spThemeNights: ["Theme nights", "Mottospiele"],
  spAllGames: ["All games", "Alle Spiele"],
  spThemeNight: ["Theme night", "Mottospiel"],
  spNoGames: ["No games are published yet.", "Es sind noch keine Spiele veröffentlicht."],
  spNoMatches: ["No games match this filter.", "Keine Spiele entsprechen diesem Filter."],
  spOnSale: ["On sale {date}", "Vorverkauf ab {date}"],
  spTickets: ["Tickets", "Tickets"],
  spScoringSummary: ["Scoring summary", "Torfolge"],
  spShots: ["Shots", "Schüsse"],
  spPowerPlay: ["Power play", "Überzahl"],
  spPhotos: ["Photos", "Fotos"],
  spRecap: ["Game recap", "Spielbericht"],
  spBoxScore: ["Box score", "Spielstatistik"],
  spAllGamesBack: ["← All games", "← Alle Spiele"],
  spAttendance: ["Attendance", "Zuschauer"],
  spNotPlayed: ["This game hasn’t been played yet.", "Dieses Spiel wurde noch nicht gespielt."],
  spGoalFor: ["Goal", "Tor"],
  spGoalAgainst: ["Goal against", "Gegentor"],
  spAssists: ["Assists: {names}", "Vorlagen: {names}"],
  spRoster: ["Roster", "Kader"],
  spForwards: ["Forwards", "Stürmer"],
  spDefence: ["Defence", "Verteidigung"],
  spGoalies: ["Goalies", "Torhüter"],
  spActive: ["Active", "Aktiv"],
  spAllPlayers: ["All players", "Alle Spieler"],
  spFarm: ["Farm team", "Farmteam"],
  spGP: ["GP", "Sp"],
  spG: ["G", "T"],
  spA: ["A", "A"],
  spP: ["P", "P"],
  spW: ["W", "S"],
  spL: ["L", "N"],
  spSvPct: ["SV%", "Fang%"],
  spGAA: ["GAA", "GT-Schnitt"],
  spPlusMinus: ["+/-", "+/-"],
  spPIM: ["PIM", "SM"],
  spNoPlayers: ["No players are published yet.", "Es sind noch keine Spieler veröffentlicht."],
  spPosition: ["Position", "Position"],
  spShoots: ["Shoots", "Schusshand"],
  spCatches: ["Catches", "Fanghand"],
  spNationality: ["Nationality", "Nationalität"],
  spStatus: ["Status", "Status"],
  spNumber: ["Number", "Nummer"],
  spSeasonStats: ["Season stats", "Saisonstatistik"],
  spLastGame: ["Last game", "Letztes Spiel"],
  spGallery: ["Gallery", "Galerie"],
  spJerseys: ["Jerseys", "Trikots"],
  spRosterBack: ["← Roster", "← Kader"],
  spPosC: ["Centre", "Center"],
  spPosLW: ["Left wing", "Linker Flügel"],
  spPosRW: ["Right wing", "Rechter Flügel"],
  spPosD: ["Defence", "Verteidiger"],
  spPosG: ["Goalie", "Torhüter"],
  spCampaign: ["Campaign", "Kampagne"],
  spNoThemeNights: ["No theme nights are scheduled.", "Es sind keine Mottospiele geplant."],
  spPartners: ["Partners", "Partner"],
  spRights: ["Rights {start} – {end}", "Rechte {start} – {end}"],
  spExclusive: ["Category exclusivity", "Branchenexklusivität"],
  spActivation: ["Activation", "Aktivierung"],
  spNoSponsors: ["No partnerships are published yet.", "Es sind noch keine Partnerschaften veröffentlicht."],
  spPartnerProfile: ["Partner profile →", "Partnerprofil →"],
  spMediaHub: ["Media hub", "Media Hub"],
  spLatestRecaps: ["Latest recaps", "Neueste Spielberichte"],
  spLatestPhotos: ["Latest game photos", "Neueste Spielfotos"],
  spReadRecap: ["Read the recap →", "Spielbericht lesen →"],
  spNoRecaps: ["No recaps are published yet.", "Es sind noch keine Spielberichte veröffentlicht."],
  spMediaLibraryLink: ["Media library →", "Mediathek →"],
  spResWin: ["Win", "Sieg"],
  spResLoss: ["Loss", "Niederlage"],
  spResWinOT: ["Win (OT)", "Sieg (n. V.)"],
  spResOTL: ["OT loss", "Niederlage (n. V.)"],
  spResWinSO: ["Win (SO)", "Sieg (n. P.)"],
  spResSOL: ["SO loss", "Niederlage (n. P.)"],
  unAllLevels: ["All levels", "Alle Abschlussarten"],
  unAllColleges: ["All colleges", "Alle Fakultäten"],
  unAllDelivery: ["All formats", "Alle Studienformen"],
  unSearchInterests: ["Search by interest…", "Nach Interesse suchen…"],
  unNoPrograms: ["No programs match.", "Keine passenden Studiengänge."],
  unProgramsCount: ["{shown} of {total} programs", "{shown} von {total} Studiengängen"],
  unAppsUp: ["Applications up {pct}%", "{pct} % mehr Bewerbungen"],
  unDeadline: ["Apply by {date}", "Bewerbung bis {date}"],
  unDeadlineLabel: ["Application deadline", "Bewerbungsfrist"],
  unLevel: ["Level", "Abschluss"],
  unCollege: ["College", "Fakultät"],
  unDelivery: ["Format", "Studienform"],
  unCredits: ["Credit hours", "Credit Hours"],
  unCip: ["CIP code", "CIP-Code"],
  unEntryTerm: ["Entry term", "Studienbeginn"],
  unProgramCode: ["Program code", "Studiengangscode"],
  unTuitionEstimator: ["Tuition estimator", "Studiengebührenrechner"],
  unResidency: ["Residency", "Wohnsitzstatus"],
  unInState: ["In-state", "Im Bundesstaat ansässig"],
  unOutOfState: ["Out-of-state", "Nicht im Bundesstaat ansässig"],
  unYears: ["Years", "Jahre"],
  unPerYear: ["Per year", "Pro Jahr"],
  unTotal: ["Total for {years} years", "Gesamt für {years} Jahre"],
  unEstimateNote: ["An estimate from published tuition — fees, housing and financial aid are not included.", "Eine Schätzung auf Basis der veröffentlichten Studiengebühren — Gebühren, Unterkunft und finanzielle Förderung sind nicht enthalten."],
  unOutcomes: ["Outcomes", "Absolventenerfolg"],
  unEmploymentRate: ["Employment rate", "Beschäftigungsquote"],
  unEmployed: ["{pct}% employed", "{pct} % beschäftigt"],
  unVerified: ["Verified · {source} {year}", "Geprüft · {source} {year}"],
  unFaculty: ["Faculty experts", "Experten aus der Fakultät"],
  unRequestInfo: ["Request info", "Informationen anfordern"],
  unAllProgramsBack: ["← All programs", "← Alle Studiengänge"],
  unMoreFromCollege: ["More from {college} →", "Mehr von {college} →"],
  unAdmitRate: ["Admit rate", "Zulassungsquote"],
  unYield: ["Yield", "Einschreibungsquote"],
  unUpcomingEvents: ["Upcoming events", "Kommende Veranstaltungen"],
  unPastEvents: ["Past events", "Vergangene Veranstaltungen"],
  unRegister: ["Register", "Anmelden"],
  unSeatsLeft: ["{n} seats left", "Noch {n} Plätze frei"],
  unWaitlist: ["Waitlist", "Warteliste"],
  unFull: ["Full", "Ausgebucht"],
  unAttended: ["{n} attended", "{n} Teilnehmende"],
  unSpanish: ["Spanish", "Spanisch"],
  unBilingual: ["Bilingual", "Zweisprachig"],
  unNoEvents: ["No events are scheduled.", "Es sind keine Veranstaltungen geplant."],
  auRevealIn: ["Revealed in", "Enthüllung in"],
  auDays: ["days", "Tage"],
  auHours: ["hours", "Stunden"],
  auMinutes: ["minutes", "Minuten"],
  auSeconds: ["seconds", "Sekunden"],
  auRevealedOn: ["Revealed on {date}", "Enthüllt am {date}"],
  auComingSoon: ["Coming soon", "Demnächst"],
  auGallery: ["Gallery", "Galerie"],
  auRange: ["Range ({cycle})", "Reichweite ({cycle})"],
  auFrom: ["From {price}", "Ab {price}"],
  auPower: ["Power", "Leistung"],
  auCo2: ["CO₂ emissions", "CO₂-Emissionen"],
  auModelYear: ["Model year", "Modelljahr"],
  auBookTestDrive: ["Book a test drive", "Probefahrt buchen"],
  auFindDealer: ["Find a dealer", "Händler finden"],
  auAllMarques: ["All marques", "Alle Marken"],
  auAllRegions: ["All regions", "Alle Regionen"],
  auDealerCount: ["{n} dealers · {m} showrooms", "{n} Händler · {m} Showrooms"],
  auNoDealers: ["No dealer matches these filters.", "Kein Händler passt zu diesen Filtern."],
  auDirections: ["Directions", "Route"],
  auMapLabel: ["Map of the dealers' showrooms", "Karte der Händler-Showrooms"],
  auTakenDown: ["This campaign site has ended.", "Diese Kampagnenseite ist beendet."],
  unSearchTopics: ["Search by topic…", "Nach Thema suchen…"],
  unAllLanguages: ["All languages", "Alle Sprachen"],
  unMediaTrained: ["Media trained", "Medientrainiert"],
  unLanguages: ["Languages: {list}", "Sprachen: {list}"],
  unNoExperts: ["No experts match.", "Keine passenden Experten."],
  unVerifiedBy: ["Verified by {name}", "Geprüft von {name}"],
  unNoClaims: ["No verified figures are published.", "Es sind keine geprüften Kennzahlen veröffentlicht."],
  unSource: ["Source: {source}", "Quelle: {source}"],
  unDataYear: ["Data year {year}", "Datenjahr {year}"],
  unTeachesIn: ["Teaches in", "Lehrt in"],
  hubAnything: ["Everything", "Alles"],
  hubTeam: ["Our team", "Unser Team"],
  hubPartner: ["Partner", "Partner"],
  hubSearchPlaceholder: ["Describe it, or ask a question", "Beschreiben Sie es, oder stellen Sie eine Frage"],
  hubOurBrands: ["Our brands", "Unsere Marken"],
  hubTeamsSearching: ["Your teams are searching for", "Ihre Teams suchen nach"],
  hubSeeEverything: ["See everything", "Alles ansehen"],
  hubAssetCount: ["{count} assets", "{count} Assets"],
  hubNarrow: ["That's a lot. Narrow it down:", "Das ist viel. Grenzen Sie es ein:"],
  hubMostRelevant: ["Most relevant", "Am relevantesten"],
  hubNewest: ["Newest", "Neueste"],
  hubMostUsed: ["Most used", "Am häufigsten genutzt"],
  hubApproved: ["Approved", "Freigegeben"],
  hubInReview: ["In review", "In Prüfung"],
  hubExpires: ["Expires soon", "Läuft bald ab"],
  hubDraft: ["Draft", "Entwurf"],
  hubStatus: ["Status", "Status"],
  hubWhoCanUse: ["Who can use it", "Wer darf es nutzen"],
  hubMarket: ["Market", "Markt"],
  hubShowing: ["Showing the first {shown} of {total}", "Die ersten {shown} von {total}"],
  hubNotOnFeed: ["Not published in Content Hub yet.", "In Content Hub noch nicht veröffentlicht."],
  hubImageNeeded: ["Image needed", "Bild fehlt"],
  hubCards: ["Cards", "Karten"],
  hubTable: ["Table", "Tabelle"],
  hubProductsCount: ["{count} products", "{count} Produkte"],
  hubGuideCurrent: ["Guide current", "Guide aktuell"],
  hubAssetsToConnect: ["Brand assets to connect", "Marken-Assets verbinden"],
  hubAskGuide: ["Ask the guide", "Den Guide fragen"],
  hubAskPlaceholder: ["Can partners use our logo?", "Dürfen Partner unser Logo nutzen?"],
  hubDraftTitle: ["Is my draft on brand?", "Ist mein Entwurf markenkonform?"],
  hubDraftLead: ["Drop in a slide, flyer or post. You get specific fixes in seconds, before it goes to the brand team.", "Legen Sie eine Folie, ein Flugblatt oder einen Beitrag ab. Sie erhalten konkrete Korrekturen, bevor es ans Markenteam geht."],
  hubTryDraft: ["Try the sample draft", "Musterentwurf prüfen"],
  hubUploadFile: ["Upload a file", "Datei hochladen"],
  hubOfficial: ["Official", "Offiziell"],
  hubShared: ["Shared with me", "Mit mir geteilt"],
  hubMine: ["Mine", "Meine"],
  hubCreate: ["Create", "Erstellen"],
  hubDownloadAll: ["Download all", "Alle herunterladen"],
  hubLive: ["Live", "Live"],
  hubUpcoming: ["Upcoming", "Bevorstehend"],
  hubPlanning: ["In planning", "In Planung"],
  hubEnded: ["Ended", "Beendet"],
  hubSeasonal: ["Seasonal", "Saisonal"],
  hubInDevelopment: ["In development", "In Entwicklung"],
  hubRetiring: ["Retiring", "Auslaufend"],
  hubDiet: ["Diet", "Ernährung"],
  hubDietPlant: ["Plant based", "Pflanzlich"],
  hubDietGluten: ["Gluten free", "Glutenfrei"],
  hubDietNut: ["Nut free", "Nussfrei"],
  hubLibrary: ["Library", "Bibliothek"],
  hubFindFilter: ["Find a filter, like “Germany”", "Filter suchen, etwa „Deutschland“"],
  hubSize: ["Size", "Größe"],
  hubJumpTo: ["Jump to", "Springen zu"],
  hubEarlier: ["Earlier", "Früher"],
  hubNameCollection: ["Name a new collection", "Neue Sammlung benennen"],
  hubWhoCanSee: ["Who can see it", "Wer darf es sehen"],
  hubLogo: ["Logo", "Logo"],
  hubColour: ["Colour", "Farbe"],
  hubPhotography: ["Photography", "Fotografie"],
  hubSampleDraft: ["Sample draft", "Musterentwurf"],
  hubAssetSearch: ["Describe what you need, like “chef plating food, bright kitchen, landscape”", "Beschreiben Sie, was Sie brauchen, etwa „Koch richtet Essen an, helle Küche, Landschaft“"],
  hubFindSimilar: ["Find similar", "Ähnliche finden"],
  hubProductSearch: ["Name, product number, GTIN, or “school lunch without nuts”", "Name, Produktnummer, GTIN oder „Schulessen ohne Nüsse“"],
  hubYesThis: ["Yes.", "Ja."],
  hubNotThis: ["Not this.", "Nicht so."],
};

/** Translated page and datasource texts per language, keyed by the item path relative to the site. */
export const TRANSLATIONS = {
  "de-DE": { pages: {
    "Home": { Eyebrow: "Markenportal", Title: "Jede Marke, eine Quelle der Wahrheit.", Lead: "Markenrichtlinien, Produkte, News und freigegebene Medien — direkt aus Content Hub, immer aktuell." },
    "Home/brands": { NavLabel: "Markenrichtlinien", Eyebrow: "Markenrichtlinien", Title: "Jede Marke, eine Quelle der Wahrheit.", Lead: "Farben, Logos, Typografie, Dokumente, Vorlagen und die Regeln, die alles zusammenhalten — direkt aus Content Hub.", Blurb: "Die Brand Books: Farben, Logos, Schriften und die Regeln dahinter." },
    "Home/products": { NavLabel: "Produkte", Eyebrow: "Produktinformationen", Title: "Produkte", Lead: "Jedes freigegebene Produkt mit Daten, Bildern und Dokumenten — derselbe Datensatz, den das Produktteam in Content Hub pflegt.", Blurb: "Jedes freigegebene Produkt mit Daten, Bildern und Dokumenten." },
    "Home/press": { NavLabel: "Presse", Eyebrow: "Presse", Title: "News & Pressemitteilungen", Lead: "Die neuesten Mitteilungen mit Bildern und Media Kits, bereit zur Veröffentlichung.", Blurb: "Die neuesten Pressemitteilungen mit Bildern und Media Kits." },
    "Home/campaigns": { NavLabel: "Kampagnen", Eyebrow: "Kampagnen", Title: "Kampagnen", Lead: "Jede Kampagne, die Content Hub veröffentlicht — eine generische Liste einer Definition mit generischer Detailseite.", Blurb: "Kampagnen aus Content Hub — die generischen Entitätsseiten." },
    "Home/partners": { NavLabel: "Partnerportal", Eyebrow: "Partnerportal", Title: "Ihr Partner-Kit", Lead: "Freigegebene Assets Ihrer Fokusmarke und die Kampagnen-Kits zum Lokalisieren — für angemeldete Vertriebspartner.", Blurb: "Partner-Kits und Co-Marketing-Kampagnen für unsere Vertriebspartner." },
    "Home/sales": { NavLabel: "Sales Kit", Eyebrow: "Sales Kit", Title: "Alles für das nächste Gespräch", Lead: "Wettbewerbs-Battlecards und Kundenreferenzen — aktuell, freigegeben und an einem Ort. Nur für Mitarbeiter.", Blurb: "Battlecards, Case Studies und das Material, das der Vertrieb braucht." },
    "Home/sales/battlecards": { NavLabel: "Battlecards", Eyebrow: "Sales Kit", Title: "Battlecards", Lead: "Wie wir gegen jeden Wettbewerber gewinnen: Stärken, Einwände und Belege.", Blurb: "Wettbewerbs-Battlecards." },
    "Home/sales/case-studies": { NavLabel: "Case Studies", Eyebrow: "Sales Kit", Title: "Case Studies", Lead: "Kundenreferenzen mit Herausforderung, Lösung und Ergebnissen.", Blurb: "Kundenreferenzen." },
    "Home/media": { NavLabel: "Mediathek", Eyebrow: "Mediathek", Title: "Freigegebene Medien", Lead: "Bilder, Videos und Dokumente zur Verwendung freigegeben — nach Sammlung, Marke oder Typ finden und das Original herunterladen.", Blurb: "Freigegebene Bilder, Videos und Dokumente zum Finden und Herunterladen." },
    "Home/games": { NavLabel: "Spiele", Eyebrow: "Spielplan & Ergebnisse", Title: "Jedes Spiel, jedes Ergebnis", Lead: "Die ganze Saison — Termine, Ergebnisse, Mottospiele und Tickets, direkt aus den Statistik- und Ticketing-Feeds.", Blurb: "Der Saisonspielplan, Live-Ergebnisse und Tickets." },
    "Home/theme-nights": { NavLabel: "Mottospiele", Eyebrow: "Mottospiele", Title: "Abende, die bleiben", Lead: "Tradition, Gemeinschaft und Feiern — mit Tickets und der Kampagne hinter jedem Spiel.", Blurb: "Besondere Spielabende mit ihren Kampagnen und Tickets." },
    "Home/team": { NavLabel: "Team", Eyebrow: "Kader", Title: "Das Team", Lead: "Jeder Spieler mit Nummer, Position und Saisonstatistik.", Blurb: "Der Kader mit Saisonstatistik für jeden Spieler." },
    "Home/sponsors": { NavLabel: "Partner", Eyebrow: "Partner", Title: "Unsere Partner", Lead: "Die Partner, die die Saison möglich machen — Platzierungen, Rechte und Aktivierungen.", Blurb: "Unsere Partner und wie sie in der Saison präsent sind." },
    "Home/programs": { NavLabel: "Studiengänge", Eyebrow: "Studienangebot", Title: "Finden Sie Ihren Studiengang", Lead: "Jeder Abschluss und jedes Zertifikat — nach Fakultät, Abschlussart und Studienform, mit Studiengebühren, Fristen und Absolventenerfolg.", Blurb: "Abschlüsse und Zertifikate mit Studiengebühren, Fristen und Absolventenerfolg." },
    "Home/events": { NavLabel: "Veranstaltungen", Eyebrow: "Besuchen und vernetzen", Title: "Veranstaltungen auf dem Campus", Lead: "Tage der offenen Tür, Infoveranstaltungen und Vorträge — auf Englisch und Spanisch, mit Anmeldung per Klick.", Blurb: "Tage der offenen Tür, Infoveranstaltungen und Vorträge mit Anmeldung." },
    "Home/experts": { NavLabel: "Experten", Eyebrow: "Für die Medien", Title: "Finden Sie einen Experten", Lead: "Lehrende, die mit den Medien sprechen — nach Thema und Sprache, medientrainiert, wo angegeben.", Blurb: "Experten aus der Fakultät für Interviews, nach Thema und Sprache." },
    "Home/by-the-numbers": { NavLabel: "In Zahlen", Eyebrow: "In Zahlen", Title: "Zahlen, für die wir einstehen", Lead: "Rankings, Absolventenerfolg und Kennzahlen — jede geprüft, belegt und aktuell.", Blurb: "Geprüfte Rankings, Ergebnisse und Kennzahlen." },
    "Data/Portal Footer/Footer": { LeftText: "Markenportal", RightText: "Inhalte über Experience Edge · Dateien über Public Links" },
    "Data/Portal Banners/Home banner": { Eyebrow: "Aus der Bibliothek", Title: "Ein Bild, direkt aus Content Hub.", Text: "Das Bild dieses Banners ist ein Content-Hub-Asset, im Mediendialog des Page builders gewählt — ausgeliefert über seinen Public Link, nie kopiert." },
    "Data/Portal Picks/Featured products": { Heading: "Ausgewählte Produkte", Intro: "Eine handverlesene Auswahl — im Page builder gewählt, aus Content Hub geliefert." },
    "Microsite/Home": { Eyebrow: "Demnächst", Title: "Etwas Neues ist unterwegs.", Lead: "Seien Sie die Ersten: Der Countdown läuft bis zur Enthüllung — danach buchen Sie Ihre Probefahrt." },
    "Data/Portal Picks/Featured models": { Heading: "Die Modelle", Intro: "Reichweite, Leistung und Preis auf einen Blick — im Page builder gewählt, aus Content Hub geliefert." },
    "Home/dealers": { NavLabel: "Händler", Eyebrow: "Händlersuche", Title: "Finden Sie Ihren Händler", Lead: "Jeder Händler und jeder Showroom nach Marke und Region — buchen Sie eine Probefahrt in Ihrer Nähe.", Blurb: "Händler und Showrooms nach Marke und Region." },
    "Data/Portal Picks/Featured programs": { Heading: "Ausgewählte Studiengänge", Intro: "Eine handverlesene Auswahl an Studiengängen — im Page builder gewählt, aus Content Hub geliefert." },
    "Data/Portal Picks/Image carousel": { Heading: "In Bildern", Intro: "Bilder aus der Content-Hub-Bibliothek — derselbe Picker, Karussell-Variante." },
  } },
};


/** An internal link field value without an item id (Sitecore can't resolve it). */
export const isBrokenInternalLink = (v) => /\blinktype="internal"/i.test(v) && !/\bid="\{?[0-9a-f-]{32,36}\}?"/i.test(v);

/**
 * The banner's call-to-action Link field: an internal link to the site page with that path when
 * it exists (`pageId`), else the URL as an external link (new tab for other sites, same tab for a
 * site path).
 */
export function ctaLinkXml(label, href, pageId = "") {
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const text = esc(String(label).slice(0, 80));
  if (pageId && href.startsWith("/")) {
    const id = (pageId.startsWith("{") ? pageId : `{${pageId}}`).toUpperCase();
    const rest = /[?#]/.test(href) ? href.slice(href.search(/[?#]/)) : "";
    const qs = rest.startsWith("?") ? ` querystring="${esc(rest.slice(1).replace(/#.*$/, ""))}"` : "";
    const anchor = rest.includes("#") ? ` anchor="${esc(rest.slice(rest.indexOf("#") + 1))}"` : "";
    return `<link text="${text}" linktype="internal" id="${id}"${qs}${anchor} />`;
  }
  return `<link text="${text}" linktype="external" url="${esc(href)}" ${/^https?:/i.test(href) ? 'target="_blank" ' : ""}/>`;
}

/** The Content Hub fields' titles (short: the Page builder's field header cuts long ones), the old defaults they replace, and their help text. */
const FIELD_TITLES = {
  picks: { now: "Content Hub items", old: "Content Hub picks (Open app)", help: "Open app to choose Content Hub items for this component." },
  image: { now: "Content Hub image", old: "Image from Content Hub (Open app; wins over Image)", help: "Open app to choose one Content Hub image; it wins over Image." },
  hero: { now: "Hero image (Content Hub)", old: "Hero image from Content Hub (Open app; wins over HeroImage)", help: "Open app to choose one Content Hub image; it wins over HeroImage." },
  logo: { now: "Logo (Content Hub)", old: "Logo from Content Hub (Open app; wins over Logo)", help: "Open app to choose the logo from Content Hub; it wins over Logo." },
};

/** A campaign microsite's default texts: its home, the model highlights and the dealer locator page (also on a portal with dealers). */
const MICROSITE_HOME_TEXT = { Eyebrow: "Coming soon", Title: "Something new is on its way.", Lead: "Be the first to see it: the countdown runs to the reveal — then book your test drive." };
const MODELS_TEXT = { Heading: "Meet the models", Intro: "Range, power and price at a glance — picked in the Page builder, served from Content Hub." };
const DEALERS_TEXT = { NavLabel: "Dealers", Eyebrow: "Find a dealer", Title: "Find your dealer", Lead: "Every dealer and showroom by marque and region — book a test drive near you.", Blurb: "Dealers and showrooms by marque and region." };

/** The home picks' default texts: products, or programs on a university site. */
const PICKS_TEXT = {
  products: { Heading: "Featured products", Intro: "A hand-picked selection — chosen in the Page builder, served from Content Hub." },
  programs: { Heading: "Featured programs", Intro: "A hand-picked selection of programs — chosen in the Page builder, served from Content Hub." },
};

/**
 * The built-in texts for a site language: German from the tables above (any de-*), the others
 * from translations.mjs by base language; null when there are none (the version stays English).
 * @param {string} lang
 * @returns {{ ui: Record<string, string>, pages: Record<string, Record<string, string>> } | null}
 */
export function translationFor(lang) {
  if (String(lang).toLowerCase().split("-")[0] === "de") {
    return { ui: Object.fromEntries(Object.entries(UI_STRINGS).map(([k, v]) => [k, v[1]]).filter(([, v]) => v)), pages: TRANSLATIONS["de-DE"].pages };
  }
  return moreTranslationsFor(lang);
}

/** Demo profiles for the Demo Builder's partner kits (tier, region, focus brand, about); unknown partners get the collection description. */
const DEMO_PARTNERS = {
  kansai: { tier: "Gold", region: "APAC", brand: "db.hls.brand.veltrexa", about: "Specialty distributor for respiratory care across Japan and Korea." },
  meridian: { tier: "Platinum", region: "EMEA", brand: "db.hls.brand.cardelio", about: "Pan-European wholesaler with a focus on cardiometabolic therapies." },
  alpenmed: { tier: "Silver", region: "DACH", brand: "db.hls.brand.solvanta-therapeutics", about: "Alpine specialty distribution for hospital pharmacies." },
};

const locText = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? String(Object.values(v).find((x) => typeof x === "string" && x) ?? "") : "");

/**
 * A Sitecore item name from any label: ASCII letters, digits, _, spaces, - and $ only — SitecoreAI's
 * ItemNameValidation (^[\w*$][\w\s\-$]*(\(\d+\))?$) treats \w as ASCII, so accents are
 * transliterated ("Jardins Lumière" → "Jardins Lumiere", "Müller & Söhne" → "Muller Sohne", ß → ss,
 * ø → o) and anything else becomes a space. The label itself goes into the display name.
 * @param {unknown} label
 * @param {string} [fallback]
 */
export function itemName(label, fallback = "item") {
  const SPECIAL = { "ß": "ss", "æ": "ae", "Æ": "AE", "ø": "o", "Ø": "O", "œ": "oe", "Œ": "OE", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "þ": "th", "Þ": "Th" };
  const s = String(label ?? "").replace(/[ßæÆøØœŒłŁđĐþÞ]/g, (c) => SPECIAL[c]).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_\s$-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^[-\s]+/, "").slice(0, 100).trim();
  return s || fallback;
}

/**
 * What the setup reads from Experience Edge for Content Hub: the crop names of the image public
 * links (ImageCrop lookup) and the partner kit collections (one partner item each).
 * `edge(query)` runs a delivery query and returns its `data`; failures yield empty lists.
 *
 * A partner's login user must equal the head's PORTAL_PARTNERS entry, so `partners` (that list,
 * passwords not needed: [{u, k?, n?, t?, r?, a?, b?}]) wins: matched by kit collection id, then
 * by the user the Demo Builder puts into the kit identifier (`…partner-kit-<user>`), then by the
 * first word of the partner's name. Tier, region and focus brand come from that entry, else
 * from the kit description the Demo Builder writes ("Partner kit for X (Gold, APAC) — approved
 * <Brand> material."), else from the built-in demo table.
 */
/**
 * @param {(query: string) => Promise<any>} edge
 * @param {{ partners?: Array<Record<string, string>> }} [opts]
 */
export async function discoverFromEdge(edge, { partners = [] } = {}) {
  const out = { cropNames: [], partnerKits: [] };
  try {
    const d = await edge(`{ allM_Asset(first: 50) { results { urls } } }`);
    const names = new Set();
    for (const a of d?.allM_Asset?.results ?? []) for (const [key, v] of Object.entries(a.urls ?? {})) {
      if (v?.metadata?.cropping_configuration) names.add(key.replace(/^\d+-/, "").replace(/-\d+x\d+$/, ""));
    }
    out.cropNames = [...names].filter((n) => /^[\w-]{1,60}$/.test(n)).sort();
  } catch { /* no assets type or Edge unreachable */ }
  let brandByName = new Map();
  try {
    const d = await edge(`{ allM_Brand(first: 100) { results { id brandName } } }`);
    brandByName = new Map((d?.allM_Brand?.results ?? []).map((b) => [locText(b.brandName).trim().toLowerCase(), String(b.id)]));
  } catch { /* no brands on Edge */ }
  const brandId = (name) => (name ? brandByName.get(String(name).trim().toLowerCase()) ?? "" : "");
  const known = (Array.isArray(partners) ? partners : []).filter((p) => p && typeof p.u === "string");
  try {
    // only the collection fields Edge publishes: a query naming another fails as a whole (no partner kits)
    const t = await edge(`{ __type(name: "M_Collection") { fields { name } } }`);
    const names = new Set((t?.__type?.fields ?? []).map((f) => String(f?.name)));
    if (!names.size) throw new Error("no M_Collection on Edge");
    const d = await edge(`{ allM_Collection(first: 100) { results { ${["id", ...["collectionName", "description"].filter((n) => names.has(n))].join(" ")} } } }`);
    out.partnerKits = (d?.allM_Collection?.results ?? [])
      .filter((c) => /partner-kit/i.test(String(c.id)) || /partner kit$/i.test(locText(c.collectionName)))
      .map((c) => {
        const id = String(c.id);
        const name = locText(c.collectionName).replace(/\s+partner kit$/i, "").trim() || id;
        const fromId = (/partner-kit-([a-z0-9-]{1,40})$/i.exec(id)?.[1] ?? "").toLowerCase();
        const firstWord = name.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9-]/g, "").slice(0, 40);
        const env = known.find((p) => p.k && p.k === id) ?? known.find((p) => fromId && p.u === fromId) ?? known.find((p) => p.u === firstWord);
        const user = env?.u ?? (fromId || firstWord);
        const desc = locText(c.description);
        const m = /\(([^,()]+),\s*([^()]+)\)\s*[—-]+\s*approved\s+(.+?)\s+material/i.exec(desc);
        const demo = DEMO_PARTNERS[firstWord] ?? {};
        return {
          id, name: env?.n || name, user,
          tier: env?.t || m?.[1]?.trim() || demo.tier || "",
          region: env?.r || m?.[2]?.trim() || demo.region || "",
          brand: brandId(env?.b) || brandId(m?.[3]) || demo.brand || "",
          about: env?.a || demo.about || desc,
        };
      });
  } catch { /* no collections type */ }
  return out;
}

/**
 * Runs the whole setup.
 * @param {object} ctx
 * @param {(query: string, variables?: object) => Promise<any>} ctx.gql  Authoring API call returning `data` (throws on errors)
 * @param {(line: string) => void} [ctx.log]
 * @param {object} [ctx.options]  collection, site, languages (string|string[], default "de-DE"), publish (default true),
 *                                marketplaceAppId, publicHost, trackUsage (bool), brandScope (string|string[])
 * @param {{cropNames?: string[], partnerKits?: any[]}} [ctx.discovery]  from discoverFromEdge
 */
/** Bumped when a run's results change shape; SetupState records the version of the last finished run. */
export const SETUP_VERSION = 2;

/**
 * The demo's vertical from its industry model (PORTAL_MODEL JSON, set by the Demo Builder):
 * "sports" when it has games and players, "higher-ed" when it has campus events and faculty
 * experts (the program, event, expert and claims components and pages), else "".
 * @param {unknown} modelJson
 */
export function verticalOf(modelJson) {
  let model = [];
  try { model = typeof modelJson === "string" ? JSON.parse(modelJson || "[]") : (modelJson ?? []); } catch { model = []; }
  if (!Array.isArray(model)) return "";
  const has = (re) => model.some((d) => d && re.test(`${d.definition ?? ""} ${d.label ?? ""}`));
  if (has(/game|match|fixture/i) && has(/player|athlete/i)) return "sports";
  if (has(/\bevents?\b|campusevent/i) && has(/expert|faculty/i)) return "higher-ed";
  return "";
}

/** Codes SitecoreAI accepts as languages ("de-DE", "fr", "zh-Hant-TW"). */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * The version of what the setup puts into a site collection (templates, rendering parameters,
 * renderings, the templates' standard values — the parts between the "collection phase" markers).
 * A microsite run in a collection marked with this version (and app) skips those parts. Bump it
 * whenever they change; tests/setup-core.test.ts fails until the version and the recorded hash
 * of those parts are updated together.
 */
export const COLLECTION_VERSION = "2";

/** A slow answer, not a refusal: the app's client gave up waiting ("Request timed out"). */
const isTimeout = (e) => /timed out/i.test(String(e?.message ?? e ?? ""));

/**
 * SitecoreAI answers slowly now and then — making a template field shared converts the field's values on
 * every item, inside the request — and the app's client gives up after its timeout while the CM usually
 * finishes the work anyway. Every call the setup makes can be repeated (the setup is idempotent), so a call
 * that timed out is tried once more; a second timeout, or any other error, still fails the run.
 */
export function retryOnTimeout(gql, log = (line) => { void line; }) {
  return async (query, variables) => {
    try {
      return await gql(query, variables);
    } catch (e) {
      if (!isTimeout(e)) throw e;
      log("  ! slow answer — trying again");
      return gql(query, variables);
    }
  };
}

export async function runPortalSetup(args) {
  // the run's lock (SetupState.runningSince) is released however the run ends
  const ctl = { release: null };
  try {
    return await runPortalSetupInner({ ...args, gql: retryOnTimeout(args.gql, args.log), ctl });
  } finally {
    if (ctl.release) await ctl.release().catch(() => undefined);
  }
}

async function runPortalSetupInner({ gql, log = (line) => { void line; }, options: opt = {}, discovery = {}, ctl = { release: null } }) {
const COLLECTION = opt.collection || "marketing";
const SITE = opt.site || "brand-hub";
const LANG = "en";
const PUBLISH = opt.publish !== false;
// a campaign microsite (PORTAL_SITE_KIND=microsite, or a joint microsite of the portal's deployment):
// its own pages, no portal sections or partners; a joint one shares the portal's dictionary
const MICROSITE = discovery.siteKind === "microsite";
// The marketing brand hub (the default vertical): search home, bar chrome. Sports and higher-ed keep their own home.
const BRAND_HUB = !MICROSITE && discovery.vertical !== "sports" && discovery.vertical !== "higher-ed";
const JOINT = MICROSITE && !!discovery.joint;
// a quick microsite run (see [0]): the collection's templates and renderings by path, else null
let FAST = null;
// ---- well-known ids (verified on this environment) ----
const T = {
  standard: "{1930BBEB-7805-471A-A3BE-4858AC7CF696}",
  templateFolder: "{0437FEE2-44C9-46A6-ABE9-28858D9FEE8C}",
  renderingFolder: "{840D4A46-5503-49EC-BF9D-BD090946C63D}",
  jsonRendering: "{04646A89-996F-4EE7-878A-FFDBF1F0EF0D}",
  availableRenderings: "{76DA0A8D-FC7E-42B2-AF1E-205B49E43F98}",
  partialDesign: "{BF680756-B2FA-4CAE-8B69-EE361080616F}",
  pageDesign: "{EBCFFAE1-B6B4-4B50-B722-155E869FC430}",
  commonFolder: "{A87A00B1-E6DB-45AB-8B54-636FEC3B5523}",
  language: "{F68F13A6-3395-426A-B9A1-FA2DC60D94EB}", // /sitecore/templates/System/Language
  projectPage: "", // resolved at runtime: /sitecore/templates/Project/<collection>/Page (its id differs per environment)
  templateField: "{455A3E98-A627-4B40-8035-E683A0331AC7}",
  templateSection: "{E269FBB5-3750-427A-9149-7AA950B49301}",
  // base templates of the OOTB rendering parameter templates (Page Content / Promo)
  paramBases: ["{4247AAD4-EBDE-4994-998F-E067A51B1FE4}", "{5C74E985-E055-43FF-B28C-DB6C6A6450A2}", "{44A022DB-56D3-419A-B43B-E27E4D8E9C41}", "{3DB3EB10-F8D0-4CC9-BE26-18CE7B139EC8}"],
};
const DEVICE = "{FE5D7FDF-89C0-4D99-9AA3-B5FBD009C9F3}";
const P = {
  templates: `/sitecore/templates/Project/${COLLECTION}`,
  renderings: `/sitecore/layout/Renderings/Project/${COLLECTION}`,
  site: `/sitecore/content/${COLLECTION}/${SITE}`,
};

const braces = (id) => (id.startsWith("{") ? id : `{${id}}`).toUpperCase();
const guid = (id) => braces(id.replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, "$1-$2-$3-$4-$5"));

async function getByPath(path) {
  const d = await gql(`query($p:String!){ item(where:{path:$p, language:"${LANG}"}){ itemId name path fields(ownFields:false, excludeStandardFields:false, first:500){ nodes { name value } } } }`, { p: path });
  // an item without a version in the language answers fields: null — treat it as no fields
  return d.item ? { ...d.item, fields: d.item.fields ?? { nodes: [] }, itemId: guid(d.item.itemId) } : null;
}

/**
 * Create-or-update an item under a parent path. Returns its id. `fields` are kept up to date on
 * every run (structure: layouts, templates, settings passed as options); `initial` fields are
 * only written when the item is created — authored content (texts, order, audiences) is the
 * authors' after that, so a re-run never resets it.
 */
async function ensureItem(parentPath, name, templateId, fields = {}, initial = {}) {
  const path = `${parentPath}/${name}`;
  // a quick microsite run: the collection's templates and renderings are up to date — no reads
  if (FAST && (parentPath.startsWith(P.templates) || parentPath.startsWith(P.renderings))) return FAST.get(path) ?? "";
  let item = await getByPath(path);
  const fieldInput = Object.entries(fields).map(([n, v]) => ({ name: n, value: String(v) }));
  if (!item) {
    fieldInput.unshift(...Object.entries(initial).filter(([n]) => !(n in fields)).map(([n, v]) => ({ name: n, value: String(v) })));
    const parent = await getByPath(parentPath);
    if (!parent) throw new Error(`Parent missing: ${parentPath}`);
    const d = await gql(`mutation($i:CreateItemInput!){ createItem(input:$i){ item { itemId } } }`, { i: { name, parent: parent.itemId, templateId: braces(templateId), language: LANG, fields: fieldInput } });
    log(`  + created ${path}`);
    return guid(d.createItem.item.itemId);
  }
  const current = new Map(item.fields.nodes.map((f) => [f.name, f.value]));
  const changed = fieldInput.filter((f) => current.get(f.name) !== f.value);
  if (changed.length) {
    await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: item.itemId, language: LANG, fields: changed } });
    log(`  ~ updated ${path} (${changed.map((f) => f.name).join(", ")})`);
  } else log(`  = ${path}`);
  return item.itemId;
}

/** Create a template if missing (and keep its base templates right). Returns its id. */
async function ensureTemplate(parentPath, name, baseTemplates, sections = [], createStandardValues = false) {
  const path = `${parentPath}/${name}`;
  if (FAST && path.startsWith(P.templates)) return FAST.get(path) ?? "";
  const existing = await getByPath(path);
  if (existing) {
    const want = baseTemplates.map(braces).join("|");
    const have = (existing.fields.nodes.find((f) => f.name === "__Base template")?.value ?? "").split("|").map((v) => v.trim()).filter(Boolean).map(braces).join("|");
    if (want && have !== want) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: existing.itemId, language: LANG, fields: [{ name: "__Base template", value: want }] } });
      log(`  ~ template ${path} (base templates)`);
    } else log(`  = template ${path}`);
    return existing.itemId;
  }
  const parent = await getByPath(parentPath);
  const d = await gql(`mutation($i:CreateItemTemplateInput!){ createItemTemplate(input:$i){ itemTemplate { templateId } } }`, {
    i: { name, parent: parent.itemId, baseTemplates: baseTemplates.map(braces), createStandardValuesItem: createStandardValues, sections },
  });
  log(`  + created template ${path}`);
  return guid(d.createItemTemplate.itemTemplate.templateId);
}
const f = (name, type, extra = {}) => ({ name, type, ...extra });

/** A FULL layout (for template standard values): the device with its layout id plus the
 *  renderings. Pages then apply their deltas on top. (A delta on standard values would hide
 *  the base template's layout id → "The layout for the requested document was not found".) */
const svUid = (e) => guid(md5Hex(`${e.id}|${e.ph ?? "headless-main"}|${e.ds ?? ""}|${JSON.stringify(e.params ?? {})}|sv`));
function layoutXmlFull(entries, layoutId) {
  const rs = entries.map((e) => {
    const uid = svUid(e);
    const par = e.params ? ` par="${new URLSearchParams(e.params).toString().replace(/&/g, "&amp;")}"` : "";
    const ds = e.ds ? ` ds="${e.ds}"` : "";
    return `<r uid="${uid}" id="${braces(e.id)}" ph="${e.ph ?? "headless-main"}"${par}${ds} />`;
  });
  return `<r xmlns:xsd="http://www.w3.org/2001/XMLSchema"><d id="${DEVICE}" l="${braces(layoutId)}">${rs.join("")}</d></r>`;
}

/** SXA layout delta for a list of renderings in one placeholder. */
function layoutXml(entries, afterUid = null) {
  let prev = afterUid;
  const rs = [];
  for (const e of entries) {
    const h = md5Hex(`portal|${e.ph ?? "headless-main"}|${e.id}|${rs.length}`);
    const uid = guid(h);
    const pos = prev ? `p:after="r[@uid='${prev}']"` : `p:before="*"`;
    prev = uid;
    const par = e.params ? ` s:par="${new URLSearchParams(e.params).toString().replace(/&/g, "&amp;")}"` : "";
    const ds = e.ds ? ` s:ds="${e.ds}"` : "";
    rs.push(`<r uid="${uid}" ${pos} s:id="${braces(e.id)}" s:ph="${e.ph ?? "headless-main"}"${par}${ds} />`);
  }
  return `<r xmlns:p="p" xmlns:s="s" p:p="1"><d id="${DEVICE}">${rs.join("")}</d></r>`;
}



  log(`Collection: ${COLLECTION}, site: ${SITE}`);
  if (!(await getByPath(P.site))) throw new Error(`Site ${P.site} does not exist — create it in Channels first.`);

  const projectPage = await getByPath(`${P.templates}/Page`);
  if (!projectPage) throw new Error(`Project page template not found: ${P.templates}/Page — create the site collection ${COLLECTION} (Channels → Create site) first.`);
  T.projectPage = projectPage.itemId;
  log(`  project Page template ${T.projectPage}`);
  // Languages are checked before anything is written: "german" or "de_DE" would otherwise become a
  // language item plus a version of every content item.
  const badLangs = [].concat(opt.languages ?? []).join(",").split(",").map((l) => l.trim()).filter((l) => l && !LANGUAGE_CODE.test(l));
  if (badLangs.length) throw new Error(`Not a language code: ${badLangs.join(", ")} — use codes like de-DE, fr-FR or ar-SA.`);

  // SetupState (a shared field on Portal Settings, written by the setup only): when the last run
  // finished and with which version, a lock against two runs at once, and a hash of each page
  // layout the setup wrote — a layout changed in SitecoreAI since is the authors' and is kept.
  const SETTINGS_PATH = `${P.site}/Settings/Portal Settings`;
  const stateOf = (item) => { try { const v = JSON.parse(item?.fields.nodes.find((f) => f.name === "SetupState")?.value || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
  let state = stateOf(await getByPath(SETTINGS_PATH));
  const LOCK_MS = 20 * 60 * 1000;
  if (state.runningSince && Date.now() - Date.parse(state.runningSince) < LOCK_MS && !opt.force) {
    throw new Error(`Another setup run on this site started at ${state.runningSince} and hasn't finished (the lock lasts 20 minutes). Wait for it, or run the CLI with PORTAL_SETUP_FORCE=1 if that run is gone.`);
  }
  const writeState = async (patch) => {
    state = { ...state, ...patch };
    const item = await getByPath(SETTINGS_PATH);
    if (!item?.fields.nodes.some((f) => f.name === "SetupState")) return; // before the field exists (first run)
    await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: item.itemId, language: LANG, fields: [{ name: "SetupState", value: JSON.stringify(state) }] } });
  };
  await writeState({ runningSince: new Date().toISOString() });
  ctl.release = () => writeState({ runningSince: "" });
  const layouts = { ...(state.layouts && typeof state.layouts === "object" ? state.layouts : {}) };

  // [0] a microsite in a collection the setup already brought up to date (COLLECTION_VERSION, this
  // app) reuses its templates and components: no field-by-field check, no republish of them
  if (MICROSITE) {
    const folder = await getByPath(`${P.templates}/Portal`);
    let mark = null;
    try { mark = JSON.parse(folder?.fields.nodes.find((f) => f.name === "__Long description")?.value || "null"); } catch { mark = null; }
    if (folder && mark?.collectionVersion === COLLECTION_VERSION && (mark?.appId ?? "") === String(opt.marketplaceAppId ?? "")) {
      const kids = async (path) => ((await gql(`query($p:String!){ item(where:{path:$p, language:"${LANG}"}){ children(first:500){ nodes { name itemId } } } }`, { p: path })).item?.children?.nodes ?? []).map((n) => [`${path}/${n.name}`, guid(n.itemId)]);
      FAST = new Map([[`${P.templates}/Portal`, folder.itemId], ...(await kids(`${P.templates}/Portal`)), ...(await kids(`${P.templates}/Portal/Rendering Parameters`)), ...(await kids(P.renderings)), ...(await kids(`${P.renderings}/Portal`))]);
      log(`  collection ${COLLECTION} is up to date (setup ${COLLECTION_VERSION}): its templates and components are reused — a quick microsite run`);
    }
  }

log("\n[1] folders");
  const tplFolder = await ensureItem(P.templates, "Portal", T.templateFolder);
  await ensureItem(`${P.templates}/Portal`, "Rendering Parameters", T.templateFolder);
  await ensureItem(P.renderings, "Portal", T.renderingFolder);
  const TPL = `${P.templates}/Portal`, PRM = `${TPL}/Rendering Parameters`, REN = `${P.renderings}/Portal`;

  log("\n[2] templates");
  const texts = await ensureTemplate(TPL, "_Portal Texts", [T.standard], [{ name: "Portal", fields: [
    f("NavLabel", "Single-Line Text", { title: "Navigation label", sortOrder: 10 }),
    f("Eyebrow", "Single-Line Text", { sortOrder: 20 }),
    f("Lead", "Multi-Line Text", { sortOrder: 30 }),
    f("Blurb", "Single-Line Text", { title: "Blurb (home card)", sortOrder: 40 }),
    f("ShowOnHome", "Checkbox", { title: "Show on home", sortOrder: 50 }),
    f("HideFromNav", "Checkbox", { title: "Hide from navigation", sortOrder: 60 }),
  ] }]);
  const homeTpl = await ensureTemplate(TPL, "Portal Home Page", [T.projectPage, texts], [], true);
  const sectionTpl = await ensureTemplate(TPL, "Portal Section Page", [T.projectPage, texts], [], true);
  const detailTpl = await ensureTemplate(TPL, "Portal Detail Page", [T.projectPage, texts], [{ name: "Portal detail", fields: [f("DetailKind", "Single-Line Text", { title: "Detail kind (brand | product | press)" })] }], true);
  await ensureItem(`${TPL}/Portal Detail Page/Portal detail`, "Definition", T.templateField, { Type: "Single-Line Text", Title: "Content Hub definition (Edge type, e.g. M_CMP_Campaign — generic detail page)" });
  const settingsTpl = await ensureTemplate(TPL, "Portal Settings", [T.standard], [{ name: "Portal", fields: [
    f("BrandScope", "Multi-Line Text", { title: "Brand scope (Content Hub M.Brand identifiers, one per line; empty = all)" }),
    f("TrackUsage", "Checkbox", { title: "Track usage (writes BrandSite.PortalEvent)" }),
    f("UsageSiteLabel", "Single-Line Text", { title: "Usage site label" }),
    f("SiteMode", "Single-Line Text", { title: "Site mode (informational — the head's SITE_MODE variable decides: public | hybrid | gated)" }),
  ] }]);
  await ensureItem(`${TPL}/Portal Settings/Portal`, "SetupState", T.templateField, { Type: "Multi-Line Text", Shared: "1" }, { Title: "Setup state (written by the portal setup — don't edit)" });
  await ensureItem(`${TPL}/Portal Settings/Portal`, "PortalHead", T.templateField, { Type: "Single-Line Text", Shared: "1" }, { Title: "Portal deployment (head) — written by the setup; the hub app finds this site's portal here" });
  await ensureItem(`${TPL}/_Portal Texts/Portal`, "HeroImage", T.templateField, { Type: "Image", Title: "Hero image (Content Hub asset via the DAM connector)" });
  // Phase 2: a channel partner's profile (the login lives in the head's PORTAL_PARTNERS variable, matched by User).
  const partnerTpl = await ensureTemplate(TPL, "Portal Partner", [T.standard], [{ name: "Partner", fields: [
    f("User", "Single-Line Text", { title: "User (login name, a-z 0-9 -; same as in PORTAL_PARTNERS)", sortOrder: 10 }),
    f("Tier", "Single-Line Text", { sortOrder: 20 }), f("Region", "Single-Line Text", { sortOrder: 30 }),
    f("FocusBrand", "Single-Line Text", { title: "Focus brand (Content Hub M.Brand identifier)", sortOrder: 40 }),
    f("KitCollection", "Single-Line Text", { title: "Partner kit (Content Hub collection identifier)", sortOrder: 50 }),
    f("About", "Multi-Line Text", { sortOrder: 60 }),
  ] }]);
  // Portal Settings → Theme section: the site's look and feel (empty = Content Hub BrandSite.Config, else defaults).
  await ensureItem(`${TPL}/Portal Settings`, "Theme", T.templateSection, {});
  await ensureItem(`${TPL}/Portal Settings/Theme`, "Accent", T.templateField, { Type: "Single-Line Text", Title: "Accent colour (#rrggbb; empty = Content Hub BrandSite.Config, else FALLBACK_ACCENT)" });
  await ensureItem(`${TPL}/Portal Settings/Theme`, "FontSerif", T.templateField, { Type: "Single-Line Text", Title: "Serif font (Google Fonts family, e.g. Instrument Serif)" });
  await ensureItem(`${TPL}/Portal Settings/Theme`, "FontSans", T.templateField, { Type: "Single-Line Text", Title: "Sans-serif font (Google Fonts family, e.g. Instrument Sans)" });
  await ensureItem(`${TPL}/Portal Settings/Theme`, "FontMono", T.templateField, { Type: "Single-Line Text", Title: "Monospace font (Google Fonts family, e.g. JetBrains Mono)" });
  await ensureItem(`${TPL}/Portal Settings/Theme`, "BrandBookLayout", T.templateField, { Type: "Single-Line Text", Title: "Brand book layout (tabbed | editorial; empty = Content Hub setting)" });
  await ensureItem(`${TPL}/Portal Settings/Theme`, "ThemeVars", T.templateField, { Type: "Multi-Line Text", Title: "Theme tokens (JSON of CSS variable → value, written by the Portal theme app /theme-editor; empty = defaults)" });
  const headerTpl = await ensureTemplate(TPL, "Portal Header", [T.standard], [{ name: "Header", fields: [f("Wordmark", "Single-Line Text"), f("Logo", "Image"), f("ShowNav", "Single-Line Text", { title: "Show navigation (auto | always | never)" }), f("Chrome", "Single-Line Text", { title: "Chrome (plain | bar)" })] }], true);
  // "Portal Banner": an authored image (Content Hub asset through the DAM connector) with texts and a link.
  const bannerTpl = await ensureTemplate(TPL, "Portal Banner", [T.standard], [{ name: "Banner", fields: [
    f("Image", "Image", { title: "Image (Content hub tab of the media dialog)" }), f("Eyebrow", "Single-Line Text"), f("Title", "Single-Line Text"), f("Text", "Multi-Line Text"), f("Link", "General Link"),
  ] }], true);
  const footerTpl = await ensureTemplate(TPL, "Portal Footer", [T.standard], [{ name: "Footer", fields: [f("LeftText", "Single-Line Text"), f("RightText", "Single-Line Text")] }], true);
  // "Portal Picks": hand-picked Content Hub products/press releases. Picks is a Marketplace
  // custom field (core: /sitecore/system/Field types/Marketplace Types/Plugin, a memo without the
  // app); its Source is the "Content Hub picks" Marketplace app id (MARKETPLACE_APP_ID).
  const picksTpl = await ensureTemplate(TPL, "Portal Picks", [T.standard], [{ name: "Picks", fields: [
    f("Heading", "Single-Line Text"), f("Intro", "Multi-Line Text"),
    f("Picks", "Plugin", { title: FIELD_TITLES.picks.now, ...(opt.marketplaceAppId ? { source: opt.marketplaceAppId } : {}) }),
  ] }], true);
  if (opt.marketplaceAppId) await ensureItem(`${TPL}/Portal Picks/Picks`, "Picks", null, { Source: opt.marketplaceAppId });
  // "Content Hub image" fields (banner, page hero): one asset picked in the same app, single-image
  // mode. The DAM connector of the media dialog serves one tenant per environment; this picker is
  // the portal's own app, so each portal picks from its own tenant. The value is a Picks JSON
  // (definition M_Asset, max 1); the standard values carry the empty one that starts the mode.
  const appSource = opt.marketplaceAppId ? { Source: opt.marketplaceAppId } : {};
  await ensureItem(`${TPL}/Portal Banner/Banner`, "ImagePick", T.templateField, { Type: "Plugin", ...appSource }, { Title: FIELD_TITLES.image.now });
  await ensureItem(`${TPL}/_Portal Texts/Portal`, "HeroImagePick", T.templateField, { Type: "Plugin", ...appSource }, { Title: FIELD_TITLES.hero.now });
  await ensureItem(`${TPL}/Portal Header/Header`, "LogoPick", T.templateField, { Type: "Plugin", ...appSource }, { Title: FIELD_TITLES.logo.now });
  await ensureItem(`${TPL}/Portal Header/Header`, "Chrome", T.templateField, { Type: "Single-Line Text", Title: "Chrome (plain | bar)" });
  // the Content Hub fields' titles fit the Page builder's field header (its copy / paste icons cut
  // long ones); a site set up before gets them while its titles are still the old defaults, and
  // the hint moves to the field's help text
  if (!FAST) for (const [path, t] of [[`${TPL}/Portal Picks/Picks/Picks`, FIELD_TITLES.picks], [`${TPL}/Portal Banner/Banner/ImagePick`, FIELD_TITLES.image], [`${TPL}/_Portal Texts/Portal/HeroImagePick`, FIELD_TITLES.hero], [`${TPL}/Portal Header/Header/LogoPick`, FIELD_TITLES.logo]]) {
    const it = await getByPath(path);
    if (!it) continue;
    const cur = new Map(it.fields.nodes.map((x) => [x.name, String(x.value ?? "")]));
    const fix = [];
    if (!cur.get("Title")?.trim() || cur.get("Title") === t.old) fix.push({ name: "Title", value: t.now });
    if (cur.has("__Short description") && !cur.get("__Short description")?.trim()) fix.push({ name: "__Short description", value: t.help });
    if (fix.length) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields: fix } });
      log(`  ~ ${path.split("/").slice(-1)[0]}: field title`);
    }
  }
  // "Portal CH Profile": how a Content Hub definition renders (overrides the head's built-in /
  // schema-derived profiles). Items live under <site>/Data/Content Hub Profiles.
  const profileTpl = await ensureTemplate(TPL, "Portal CH Profile", [T.standard], [{ name: "Profile", fields: [
    f("Definition", "Single-Line Text", { title: "Definition (Edge type, e.g. M_PCM_Product or M.PCM.Product)" }),
    f("Label", "Single-Line Text"), f("LabelPlural", "Single-Line Text", { title: "Label (plural)" }),
    f("TitleFields", "Single-Line Text", { title: "Title fields (comma-separated, in order)" }),
    f("SubtitleFields", "Single-Line Text", { title: "Subtitle fields" }),
    f("SummaryFields", "Single-Line Text", { title: "Summary fields" }),
    f("ImageRelations", "Single-Line Text", { title: "Image relations (asset relations, in order; self = the entity is an asset)" }),
    f("HiddenFields", "Single-Line Text", { title: "Hidden detail fields (regex)" }),
    f("DetailPath", "Single-Line Text", { title: "Detail page section (e.g. /products; empty = no detail page)" }),
    f("Pickable", "Checkbox", { title: "Offer in the picker" }),
    f("Order", "Single-Line Text", { title: "Order in the picker (number)" }),
    f("ExpandRelation", "Single-Line Text", { title: "Expand relation (list its entities under each pick, e.g. pCMProductFamilyToProduct)" }),
    f("DetailRelations", "Single-Line Text", { title: "Detail page relations (comma-separated; empty = automatic)" }),
  ] }], true);
  await ensureItem(`${TPL}/Portal CH Profile/Profile`, "ExpandRelation", T.templateField, { Type: "Single-Line Text", Title: "Expand relation (list its entities under each pick, e.g. pCMProductFamilyToProduct)" });
  await ensureItem(`${TPL}/Portal CH Profile/Profile`, "DetailRelations", T.templateField, { Type: "Single-Line Text", Title: "Detail page relations (comma-separated; empty = automatic)" });
  const prmDefault = await ensureTemplate(PRM, "Portal Component", T.paramBases, [], false);
  const prmHero = await ensureTemplate(PRM, "PortalHero", T.paramBases, [{ name: "Portal", fields: [f("Variant", "Single-Line Text", { title: "Variant (home | compact)" })] }], false);
  const prmCards = await ensureTemplate(PRM, "SectionCards", T.paramBases, [{ name: "Portal", fields: [f("ExcludeCurrent", "Single-Line Text", { title: "Exclude current page (1 | 0)" })] }], false);
  const prmBook = await ensureTemplate(PRM, "BrandBook", T.paramBases, [{ name: "Portal", fields: [f("LayoutOverride", "Single-Line Text", { title: "Layout override (auto | tabbed | editorial)" })] }], false);
  const prmBanner = await ensureTemplate(PRM, "PortalBanner", T.paramBases, [{ name: "Portal", fields: [f("Variant", "Single-Line Text", { title: "Variant (full | split)" })] }], false);
  const prmBrandGrid = await ensureTemplate(PRM, "BrandGrid", T.paramBases, [{ name: "Portal", fields: [f("Variant", "Single-Line Text", { title: "Variant (default | logo | name)" })] }], false);
  const prmItems = await ensureTemplate(PRM, "ContentHubItems", T.paramBases, [{ name: "Portal", fields: [f("Variant", "Single-Line Text", { title: "Variant (cards | list | tiles | carousel | hero)" })] }], false);
  const prmList = await ensureTemplate(PRM, "ContentHubList", T.paramBases, [{ name: "Portal", fields: [
    f("Definition", "Single-Line Text", { title: "Content Hub definition (Edge type, e.g. M_CMP_Campaign)" }),
    f("Variant", "Single-Line Text", { title: "Variant (cards | list | tiles | carousel | hero)" }),
    f("Limit", "Single-Line Text", { title: "Maximum items (default 60)" }),
  ] }], false);
  const prmSchedule = await ensureTemplate(PRM, "GameSchedule", T.paramBases, [{ name: "Portal", fields: [f("Filter", "Single-Line Text", { title: "Opens on (all | upcoming | results | theme)" })] }], false);
  const prmRoster = await ensureTemplate(PRM, "Roster", T.paramBases, [{ name: "Portal", fields: [f("Filter", "Single-Line Text", { title: "Opens on (active | all | farm)" })] }], false);
  const prmEvents = await ensureTemplate(PRM, "EventsCalendar", T.paramBases, [{ name: "Portal", fields: [f("Limit", "Single-Line Text", { title: "Upcoming events shown (empty = all, with past events; e.g. 3 for a teaser)" })] }], false);
  const prmMedia = await ensureTemplate(PRM, "MediaLibrary", T.paramBases, [{ name: "Portal", fields: [f("Variant", "Single-Line Text", { title: "Variant (full | chips)" })] }], false);

  // Rendering-parameter dropdowns: lookup items under <site>/Data/Lookups/<list>/<value>; a Droplist
  // parameter stores the selected item's NAME, which is what the head reads (param()).
  if (!FAST) {
  log("\n[2b] parameter lookups");
  await ensureItem(`${P.site}/Data`, "Lookups", T.commonFolder);
  const lookup = async (name, values) => {
    await ensureItem(`${P.site}/Data/Lookups`, name, T.commonFolder);
    for (const v of values) await ensureItem(`${P.site}/Data/Lookups/${name}`, v, T.standard);
    return `${P.site}/Data/Lookups/${name}`;
  };
  const dropField = async (tplPath, field, source, title) => ensureItem(`${tplPath}/Portal`, field, T.templateField, { Type: "Droplist", Source: source, Title: title });
  const variantsSrc = await lookup("Variants", ["cards", "list", "tiles", "carousel", "hero", "overlay", "masonry"]);
  const bannerSrc = await lookup("Banner variants", ["full", "split", "guide"]);
  const brandGridSrc = await lookup("Brand grid variants", ["default", "logo", "name", "swatch"]);
  const heroSrc = await lookup("Hero variants", ["home", "compact", "search"]);
  const mediaSrc = await lookup("Media library variants", ["full", "chips"]);
  const chromeSrc = await lookup("Header chrome", ["plain", "bar"]);
  await ensureItem(`${TPL}/Portal Header/Header`, "Chrome", null, { Type: "Droplist", Source: chromeSrc, Title: "Chrome (plain | bar)" });
  const bookSrc = await lookup("Brand book layouts", ["auto", "tabbed", "editorial"]);
  await dropField(`${PRM}/ContentHubItems`, "Variant", variantsSrc, "Variant");
  await dropField(`${PRM}/ContentHubList`, "Variant", variantsSrc, "Variant");
  // Which public link the images use: "auto" = the best fit per box (ratio, then size); or a
  // named one — preview, original, or a crop the tenant defines (read from Experience Edge).
  const cropSrc = await lookup("Image crops", ["auto", "preview", "original", ...(discovery.cropNames ?? [])]);
  await dropField(`${PRM}/ContentHubItems`, "ImageCrop", cropSrc, "Image (auto = best-fitting public link, or a named crop)");
  await dropField(`${PRM}/ContentHubList`, "ImageCrop", cropSrc, "Image (auto = best-fitting public link, or a named crop)");
  // Items per row (cards, tiles) or slides visible at once (carousel); auto = the layout's default.
  const columnsSrc = await lookup("Columns", ["auto", "1", "2", "3", "4", "5"]);
  await dropField(`${PRM}/GameSchedule`, "Filter", await lookup("Schedule filters", ["all", "upcoming", "results", "theme"]), "Opens on");
  await dropField(`${PRM}/Roster`, "Filter", await lookup("Roster filters", ["active", "all", "farm"]), "Opens on");
  await dropField(`${PRM}/ContentHubItems`, "Columns", columnsSrc, "Columns (items per row; slides visible in the carousel)");
  await dropField(`${PRM}/ContentHubList`, "Columns", columnsSrc, "Columns (items per row; slides visible in the carousel)");
  await dropField(`${PRM}/PortalBanner`, "Variant", bannerSrc, "Variant");
  await dropField(`${PRM}/BrandGrid`, "Variant", brandGridSrc, "Variant (logo and name | master asset only | name only)");
  await dropField(`${PRM}/PortalHero`, "Variant", heroSrc, "Variant");
  await dropField(`${PRM}/MediaLibrary`, "Variant", mediaSrc, "Variant");
  await dropField(`${PRM}/BrandBook`, "LayoutOverride", bookSrc, "Layout override");
  // Who may see a page (phase 2): everyone | partners (and staff) | staff.
  const audienceSrc = await lookup("Audiences", ["everyone", "partners", "staff"]);
  await dropField(`${TPL}/_Portal Texts`, "VisibleTo", audienceSrc, "Visible to (everyone | partners | staff)");
  await ensureItem(`${PRM}/SectionCards/Portal`, "ExcludeCurrent", T.templateField, { Type: "Checkbox", Title: "Exclude the current page" });
  }

  // [2c] Settings are the same in every language: a page's audience, its place on Home and in the
  // navigation, its detail kind, the picks, the hero image and the Portal Settings. Versioned, a
  // language version copied before a value was set silently differs (German staff pages open,
  // German nav without sections). Texts stay versioned. Switching a field to shared keeps only one
  // value, so the default-language values are collected first, written back and checked.
  if (!FAST) {
  log("\n[2c] shared fields (settings, not texts)");
  const SHARED = [
    [`${TPL}/_Portal Texts/Portal`, ["ShowOnHome", "HideFromNav", "VisibleTo", "HeroImage", "HeroImagePick"]],
    [`${TPL}/Portal Banner/Banner`, ["ImagePick"]],
    [`${TPL}/Portal Header/Header`, ["LogoPick", "Chrome"]],
    [`${TPL}/Portal Detail Page/Portal detail`, ["DetailKind", "Definition"]],
    [`${TPL}/Portal Picks/Picks`, ["Picks"]],
    [`${TPL}/Portal Settings/Portal`, ["BrandScope", "TrackUsage", "UsageSiteLabel", "SiteMode"]],
    [`${TPL}/Portal Settings/Theme`, ["Accent", "FontSerif", "FontSans", "FontMono", "BrandBookLayout", "ThemeVars"]],
  ];
  const toShare = [];
  for (const [section, names] of SHARED) for (const name of names) {
    const field = await getByPath(`${section}/${name}`);
    if (!field) { log(`  ! ${section}/${name} missing`); continue; }
    if (field.fields.nodes.find((n) => n.name === "Shared")?.value === "1") log(`  = ${name} shared`);
    else toShare.push({ name, itemId: field.itemId });
  }
  if (toShare.length) {
    const names = new Set(toShare.map((t) => t.name));
    // the default-language values of these fields on every item of the site
    const values = [];
    const walk = async (path) => {
      const d = await gql(`query($p:String!){ item(where:{path:$p, language:"${LANG}"}){ itemId fields(ownFields:false, excludeStandardFields:true, first:500){ nodes { name value } } children(first:1000){ nodes { path } } } }`, { p: path });
      if (!d.item) return;
      const own = (d.item.fields?.nodes ?? []).filter((n) => names.has(n.name) && n.value);
      if (own.length) values.push({ itemId: guid(d.item.itemId), fields: own.map((n) => ({ name: n.name, value: n.value })) });
      for (const c of d.item.children.nodes) await walk(c.path);
    };
    for (const root of ["Home", "Data", "Settings"]) await walk(`${P.site}/${root}`);
    for (const t of toShare) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: t.itemId, language: LANG, fields: [{ name: "Shared", value: "1" }] } });
      log(`  ~ ${t.name} now shared`);
    }
    for (const v of values) await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: v.itemId, language: LANG, fields: v.fields } });
    log(`  ${values.length} items keep their ${LANG} values`);
    // the platform moves field data when sharing changes — make sure the default-language values won
    for (let attempt = 0; attempt < 3; attempt++) {
      let off = 0;
      for (const v of values) {
        const d = await gql(`query($id:ID!){ item(where:{itemId:$id, language:"${LANG}"}){ fields(ownFields:false, excludeStandardFields:true, first:500){ nodes { name value } } } }`, { id: v.itemId });
        const now = new Map((d.item?.fields?.nodes ?? []).map((n) => [n.name, n.value]));
        const wrong = v.fields.filter((f) => now.get(f.name) !== f.value);
        if (wrong.length) { off++; await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: v.itemId, language: LANG, fields: wrong } }); }
      }
      if (!off) break;
      log(`  ~ ${off} items rewritten (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  }

  log("\n[3] renderings");
  // Display names are what the Page builder shows on hover and in the component list.
  const DISPLAY = { PortalHeader: "Portal header", PortalFooter: "Portal footer", PortalHero: "Hero", PortalBanner: "Banner", SectionCards: "Section cards", BrandGrid: "Brand grid", BrandBook: "Brand book", ProductCatalog: "Product catalog", ProductDetail: "Product detail", PressList: "Press list", PressRelease: "Press release", MediaLibrary: "Media library", ContentHubItems: "Content Hub items", ContentHubList: "Content Hub list", ContentHubDetail: "Content Hub detail" };
  const rendering = (name, params, extra = {}) => ensureItem(REN, name, T.jsonRendering, {
    componentName: name, "Parameters Template": params, Editable: "1", "Enable Datasource Query": "1", "Open Properties after Add": "0", "__Display name": DISPLAY[name] ?? name, ...extra,
  });
  const R = {};
  R.PortalHeader = await rendering("PortalHeader", prmDefault, { "Datasource Template": `${TPL}/Portal Header`, "Datasource Location": `query:$site/*[@@name='Data']/*[@@name='Portal Header']|query:$sharedSites/*[@@name='Data']/*[@@name='Portal Header']` });
  R.PortalFooter = await rendering("PortalFooter", prmDefault, { "Datasource Template": `${TPL}/Portal Footer`, "Datasource Location": `query:$site/*[@@name='Data']/*[@@name='Portal Footer']|query:$sharedSites/*[@@name='Data']/*[@@name='Portal Footer']` });
  R.PortalHero = await rendering("PortalHero", prmHero, { "Can select Page as a data source": "1" });
  R.PortalBanner = await rendering("PortalBanner", prmBanner, { "Datasource Template": `${TPL}/Portal Banner`, "Datasource Location": `query:$site/*[@@name='Data']/*[@@name='Portal Banners']|query:$sharedSites/*[@@name='Data']/*[@@name='Portal Banners']` });
  R.SectionCards = await rendering("SectionCards", prmCards);
  R.BrandGrid = await rendering("BrandGrid", prmBrandGrid);
  R.BrandBook = await rendering("BrandBook", prmBook);
  R.ProductCatalog = await rendering("ProductCatalog", prmDefault);
  R.ProductDetail = await rendering("ProductDetail", prmDefault);
  R.PressList = await rendering("PressList", prmDefault);
  R.PressRelease = await rendering("PressRelease", prmDefault);
  R.MediaLibrary = await rendering("MediaLibrary", prmMedia);
  R.ContentHubItems = await rendering("ContentHubItems", prmItems, { "Datasource Template": `${TPL}/Portal Picks`, "Datasource Location": `query:$site/*[@@name='Data']/*[@@name='Portal Picks']|query:$sharedSites/*[@@name='Data']/*[@@name='Portal Picks']` });
  R.ContentHubList = await rendering("ContentHubList", prmList);
  R.ContentHubDetail = await rendering("ContentHubDetail", prmDefault, { "Can select Page as a data source": "1" });
  R.PartnerHub = await rendering("PartnerHub", prmDefault);
  R.PartnerDetail = await rendering("PartnerDetail", prmDefault);
  // sports (the demo's industry model on Edge — PORTAL_MODEL); on other sites they render nothing
  R.GameCenter = await rendering("GameCenter", prmDefault);
  R.GameSchedule = await rendering("GameSchedule", prmSchedule);
  R.ThemeNights = await rendering("ThemeNights", prmDefault);
  R.GameDetail = await rendering("GameDetail", prmDefault);
  R.Roster = await rendering("Roster", prmRoster);
  R.PlayerDetail = await rendering("PlayerDetail", prmDefault);
  R.PartnerWall = await rendering("PartnerWall", prmDefault);
  R.MediaHubTile = await rendering("MediaHubTile", prmDefault);
  // higher education (programs = products with admissions codes; events, experts, claims from PORTAL_MODEL)
  R.ProgramFinder = await rendering("ProgramFinder", prmDefault);
  R.ProgramDetail = await rendering("ProgramDetail", prmDefault);
  R.EventsCalendar = await rendering("EventsCalendar", prmEvents);
  R.ExpertFinder = await rendering("ExpertFinder", prmDefault);
  R.ByTheNumbers = await rendering("ByTheNumbers", prmDefault);
  // automotive: the campaign microsite (its own site and deployment, PORTAL_SITE_KIND=microsite) and the dealer locator
  R.MicrositeCountdown = await rendering("MicrositeCountdown", prmDefault);
  R.MicrositeHero = await rendering("MicrositeHero", prmDefault);
  R.MicrositeGallery = await rendering("MicrositeGallery", prmDefault);
  R.ModelHighlights = await rendering("ModelHighlights", prmDefault, { "Datasource Template": `${TPL}/Portal Picks`, "Datasource Location": `query:$site/*[@@name='Data']/*[@@name='Portal Picks']|query:$sharedSites/*[@@name='Data']/*[@@name='Portal Picks']` });
  R.TestDriveCta = await rendering("TestDriveCta", prmDefault);
  R.DealerLocator = await rendering("DealerLocator", prmDefault);
  for (const old of [`${REN}/FeaturedPicks`]) { // superseded by ContentHubItems
    const it = await getByPath(old);
    if (it) { await gql(`mutation($i:DeleteItemInput!){ deleteItem(input:$i){ successful } }`, { i: { itemId: it.itemId, permanently: true } }); log(`  - deleted ${old}`); }
  }

  log("\n[4] datasources, available renderings, designs, settings");
  // Data folders with insert options (__Masters) so the Page builder's "Create new" offers the datasource template.
  await ensureItem(`${P.site}/Data`, "Portal Header", T.commonFolder, { __Masters: headerTpl });
  await ensureItem(`${P.site}/Data`, "Portal Footer", T.commonFolder, { __Masters: footerTpl });
  // branding from the deployment (PORTAL_WORDMARK, PORTAL_HERO_ASSET — set by the Demo Builder):
  // written on create, and over the untouched defaults of an existing site; author edits stay
  const branding = discovery.branding ?? {};
  if (MICROSITE) log("  site kind: campaign microsite (countdown, reveal hero, model highlights, gallery, test drive, dealers)");
  // a microsite's header: its marque (name and logo), not the deployment's group name
  const marque = MICROSITE ? discovery.microsite?.brand ?? null : null;
  const wordmark = String(marque?.name || branding.wordmark || "").trim().slice(0, 80);
  const marqueLogo = MICROSITE && /^[\w.~-]{3,200}$/.test(String(discovery.microsite?.logo ?? "")) ? String(discovery.microsite.logo) : "";
  const heroAsset = /^[\w.~-]{3,200}$/.test(String(branding.heroAsset ?? "").trim()) ? String(branding.heroAsset).trim() : "";
  const heroPick = heroAsset ? JSON.stringify({ definition: "M_Asset", max: 1, items: [{ id: heroAsset, name: "" }] }) : "";
  const headerDs = await ensureItem(`${P.site}/Data/Portal Header`, "Header", headerTpl, {}, { Wordmark: wordmark || "Brand Portal", ShowNav: "auto", ...(BRAND_HUB ? { Chrome: "bar" } : {}) });
  if (wordmark) {
    const h = await getByPath(`${P.site}/Data/Portal Header/Header`);
    const cur = h?.fields.nodes.find((f) => f.name === "Wordmark")?.value ?? "";
    // still a default (empty, the generic one, or — on a microsite — the deployment's group name)
    const isDefault = !cur.trim() || cur === "Brand Portal" || (!!marque && cur === String(branding.wordmark ?? "").trim());
    if (h && isDefault && cur !== wordmark) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: h.itemId, language: LANG, fields: [{ name: "Wordmark", value: wordmark }] } });
      log(`  ~ header wordmark: ${wordmark}`);
    }
  }
  if (marqueLogo) {
    const h = await getByPath(`${P.site}/Data/Portal Header/Header`);
    const cur = h?.fields.nodes.find((f) => f.name === "LogoPick")?.value ?? "";
    // empty, or the setup's own earlier pick (the picker adds the item's name and "src"): the brand's
    // master asset now — a logo the author picked stays
    let ours = !cur.trim();
    try {
      const v = JSON.parse(cur) ?? {};
      const items = v.items ?? [];
      ours = ours || !items.length || (items.length === 1 && items[0]?.name === "" && !("src" in v) && items[0]?.id !== marqueLogo);
    } catch { /* keep */ }
    if (h && ours) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: h.itemId, language: LANG, fields: [{ name: "LogoPick", value: JSON.stringify({ definition: "M_Asset", max: 1, items: [{ id: marqueLogo, name: "" }] }) }] } });
      log(`  ~ header logo: ${marque?.name ?? "the marque"}'s`);
    }
  }
  if (BRAND_HUB) {
    const h = await getByPath(`${P.site}/Data/Portal Header/Header`);
    const cur = h?.fields.nodes.find((f) => f.name === "Chrome")?.value ?? "";
    if (h && !String(cur).trim()) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: h.itemId, language: LANG, fields: [{ name: "Chrome", value: "bar" }] } });
      log("  ~ header chrome: bar");
    }
  }
  const footerDs = await ensureItem(`${P.site}/Data/Portal Footer`, "Footer", footerTpl, {}, BRAND_HUB
    ? { LeftText: "Usage terms  ·  Contact the brand team", RightText: "Can't find it? Request an asset" }
    : { LeftText: "Brand system portal", RightText: "Content via Experience Edge · files via public links" });
  if (BRAND_HUB) {
    const foot = await getByPath(`${P.site}/Data/Portal Footer/Footer`);
    const left = foot?.fields.nodes.find((f) => f.name === "LeftText")?.value ?? "";
    if (foot && left === "Brand system portal") {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: foot.itemId, language: LANG, fields: [{ name: "LeftText", value: "Usage terms  ·  Contact the brand team" }, { name: "RightText", value: "Can't find it? Request an asset" }] } });
      log("  ~ footer: brand hub");
    }
  }
  // the portal's own datasources (a microsite has none of these: lean)
  let bannerDs = "";
  if (!MICROSITE) {
  await ensureItem(`${P.site}/Data`, "Portal Banners", T.commonFolder, { __Masters: bannerTpl });
  bannerDs = await ensureItem(`${P.site}/Data/Portal Banners`, "Home banner", bannerTpl, {}, BRAND_HUB
    ? { Eyebrow: "", Title: "This is what good looks like", Text: "Guidelines you can see, not a PDF to dig through. Every rule comes with a real example, and you can check your own draft against them.", ...(heroPick ? { ImagePick: heroPick } : {}) }
    : { Eyebrow: "From the library", Title: "One picture, straight from Content Hub.", Text: "This banner's image is a Content Hub asset chosen in the Page builder's media dialog — served from its public link, never copied.", ...(heroPick ? { ImagePick: heroPick } : {}) });
  if (heroPick) {
    const b = await getByPath(`${P.site}/Data/Portal Banners/Home banner`);
    const cur = b?.fields.nodes.find((f) => f.name === "ImagePick")?.value ?? "";
    let empty = !cur.trim();
    try { empty = empty || !(JSON.parse(cur)?.items ?? []).length; } catch { /* keep */ }
    if (b && empty) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: b.itemId, language: LANG, fields: [{ name: "ImagePick", value: heroPick }] } });
      log(`  ~ home banner image: ${heroAsset}`);
    }
  }
  }
  await ensureItem(`${P.site}/Data`, "Portal Picks", T.commonFolder, { __Masters: picksTpl });
  if (!MICROSITE) {
  await ensureItem(`${P.site}/Data`, "Content Hub Profiles", T.commonFolder, { __Masters: profileTpl });
  // Sales kit profiles: battlecards and case studies get their detail pages under /sales.
  await ensureItem(`${P.site}/Data/Content Hub Profiles`, "Battlecard", profileTpl, {}, { Definition: "M_Content_Battlecard", Label: "Battlecard", LabelPlural: "Battlecards", TitleFields: "battlecard_Title, content_Name", SubtitleFields: "battlecard_Competitor", SummaryFields: "battlecard_Summary", DetailPath: "/sales/battlecards" });
  await ensureItem(`${P.site}/Data/Content Hub Profiles`, "Case study", profileTpl, {}, { Definition: "M_Content_CaseStudy", Label: "Case study", LabelPlural: "Case studies", TitleFields: "caseStudy_Title, content_Name", SubtitleFields: "caseStudy_Customer, caseStudy_Industry", SummaryFields: "caseStudy_Summary", DetailPath: "/sales/case-studies" });
  // Partners: one item per partner kit collection Experience Edge publishes (name "<Partner> partner kit"),
  // when the head's Edge credentials are at hand; otherwise authors add items under Data/Partners.
  await ensureItem(`${P.site}/Data`, "Partners", T.commonFolder, { __Masters: partnerTpl });
  // An existing partner item is found by its kit collection (an author may have renamed it); only
  // the login and the kit are kept in sync — tier, region, focus brand, about and the display
  // name are written once and are the authors' after that.
  const partnerItems = (await gql(`query($p:String!){ item(where:{path:$p, language:"${LANG}"}){ children(first:1000){ nodes { name fields(ownFields:true, excludeStandardFields:true, first:50){ nodes { name value } } } } } }`, { p: `${P.site}/Data/Partners` })).item?.children?.nodes ?? [];
  const kitOf = (it) => (it.fields?.nodes ?? []).find((f) => f.name === "KitCollection")?.value?.trim() ?? "";
  for (const kit of discovery.partnerKits ?? []) {
    const profile = { Tier: kit.tier, Region: kit.region, FocusBrand: kit.brand, About: kit.about, "__Display name": kit.name };
    const mine = partnerItems.find((it) => kitOf(it) === kit.id);
    // the item name is the partner name cleaned for SitecoreAI ("&", ".", "," are not allowed); the
    // real name is its display name (the head shows the display name). Two partners whose names
    // clean to the same item name get the login appended.
    let name = mine?.name ?? itemName(kit.name, kit.user);
    if (!mine && partnerItems.some((it) => it.name.toLowerCase() === name.toLowerCase())) name = itemName(`${kit.name} ${kit.user}`, kit.user);
    await ensureItem(`${P.site}/Data/Partners`, name, partnerTpl, { User: kit.user, KitCollection: kit.id }, profile);
    if (!mine) partnerItems.push({ name, fields: { nodes: [{ name: "KitCollection", value: kit.id }] } });
  }
  }
  // university demos sell programs (their Content Hub products): the home picks say so, also on a
  // site set up before, while the texts are still the products defaults
  const picksText = discovery.vertical === "higher-ed" ? PICKS_TEXT.programs : PICKS_TEXT.products;
  const picksDs = MICROSITE ? "" : await ensureItem(`${P.site}/Data/Portal Picks`, "Featured products", picksTpl, {}, picksText);
  if (!MICROSITE && picksText !== PICKS_TEXT.products) {
    const it = await getByPath(`${P.site}/Data/Portal Picks/Featured products`);
    const have = new Map((it?.fields.nodes ?? []).map((f) => [f.name, String(f.value ?? "").trim()]));
    const fix = Object.entries(picksText).filter(([name]) => !have.get(name) || have.get(name) === PICKS_TEXT.products[name]).map(([name, value]) => ({ name, value }));
    if (it && fix.length) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields: fix } });
      log("  ~ Featured products: program texts");
    }
  }
  const carouselDs = MICROSITE ? "" : await ensureItem(`${P.site}/Data/Portal Picks`, "Image carousel", picksTpl, {}, { Heading: "In pictures", Intro: "Images picked from the Content Hub library — same picker, carousel variant." });
  const jobsDs = BRAND_HUB ? await ensureItem(`${P.site}/Data/Portal Picks`, "Start from the job", picksTpl, {}, { Heading: "Start from the job", Intro: "" }) : "";
  if (BRAND_HUB) {
    const fillIf = async (path, name, from, to) => {
      const it = await getByPath(path);
      const cur = it?.fields.nodes.find((f) => f.name === name)?.value ?? "";
      if (it && String(cur) === from) {
        await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields: [{ name, value: to }] } });
        log(`  ~ ${path.split("/").slice(-1)[0]}: ${name}`);
      }
    };
    await fillIf(`${P.site}/Data/Portal Picks/Featured products`, "Heading", PICKS_TEXT.products.Heading, "");
    await fillIf(`${P.site}/Data/Portal Picks/Featured products`, "Intro", PICKS_TEXT.products.Intro, "");
    await fillIf(`${P.site}/Data/Portal Picks/Image carousel`, "Heading", "In pictures", "New and approved");
    await fillIf(`${P.site}/Data/Portal Picks/Image carousel`, "Intro", "Images picked from the Content Hub library — same picker, carousel variant.", "");
    await fillIf(`${P.site}/Data/Portal Banners/Home banner`, "Title", "One picture, straight from Content Hub.", "This is what good looks like");
    await fillIf(`${P.site}/Data/Portal Banners/Home banner`, "Text", "This banner's image is a Content Hub asset chosen in the Page builder's media dialog — served from its public link, never copied.", "Guidelines you can see, not a PDF to dig through. Every rule comes with a real example, and you can check your own draft against them.");
    await fillIf(`${P.site}/Data/Portal Banners/Home banner`, "Eyebrow", "From the library", "");
  }
  const modelsDs = MICROSITE ? await ensureItem(`${P.site}/Data/Portal Picks`, "Featured models", picksTpl, {}, MODELS_TEXT) : "";
  // the model highlights start with the marque's cars while nothing is picked (the author changes them freely)
  const cars = MICROSITE && Array.isArray(discovery.microsite?.models) ? discovery.microsite.models.filter((c) => c && typeof c.id === "string" && c.id).slice(0, 3) : [];
  if (cars.length) {
    const it = await getByPath(`${P.site}/Data/Portal Picks/Featured models`);
    let picked = 0;
    try { picked = (JSON.parse(it?.fields.nodes.find((f) => f.name === "Picks")?.value || "{}")?.items ?? []).length; } catch { picked = 0; }
    if (it && !picked) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields: [{ name: "Picks", value: JSON.stringify({ definition: "M_PCM_Product", items: cars.map((c) => ({ id: c.id, name: String(c.name ?? "") })) }) }] } });
      log(`  ~ model highlights: ${cars.map((c) => c.name || c.id).join(", ")}`);
    }
  }
  // the picker opens on the type the field already names: the demo datasources name theirs (also
  // on existing sites, when nothing was picked yet), so the carousel opens on images
  for (const [ds, definition] of [[`${P.site}/Data/Portal Picks/Featured products`, "M_PCM_Product"], [`${P.site}/Data/Portal Picks/Image carousel`, "M_Asset"], ...(MICROSITE ? [[`${P.site}/Data/Portal Picks/Featured models`, "M_PCM_Product"]] : [])]) {
    const it = await getByPath(ds);
    const cur = (it?.fields.nodes.find((f) => f.name === "Picks")?.value ?? "").trim();
    if (it && !cur) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields: [{ name: "Picks", value: JSON.stringify({ definition, items: [] }) }] } });
      log(`  ~ ${ds.split("/").pop()}: picker opens on ${definition}`);
    }
  }
  // the portal's renderings are added to the list; renderings authors added stay
  const availPath = `${P.site}/Presentation/Available Renderings/Portal`;
  const availHave = ((await getByPath(availPath))?.fields.nodes.find((f) => f.name === "Renderings")?.value ?? "").split("|").map((v) => v.trim()).filter(Boolean);
  const availIds = [...availHave, ...Object.values(R).filter((id) => !availHave.some((h) => braces(h) === braces(id)))];
  await ensureItem(`${P.site}/Presentation/Available Renderings`, "Portal", T.availableRenderings, { Renderings: availIds.join("|") });
  // Partial/page designs created through the Authoring API publish with empty layouts on this
  // environment (verified: Edge renders {} for them while pages render fine), so the header and
  // footer renderings are placed on every page instead. Designs authors make are left alone.
  const pageDesign = "";
  const chromeOf = () => [{ id: R.PortalHeader, ph: "headless-header", ds: headerDs }, { id: R.PortalFooter, ph: "headless-footer", ds: footerDs }];
  await ensureItem(`${P.site}/Settings`, "Portal Settings", settingsTpl, {
    ...(opt.trackUsage != null ? { TrackUsage: opt.trackUsage ? "1" : "" } : {}),
    ...(opt.brandScope != null ? { BrandScope: [].concat(opt.brandScope).flatMap((s) => String(s).split(/[\s,]+/)).filter(Boolean).join("\n") } : {}),
  }, { SiteMode: "public", UsageSiteLabel: "sitecoreai-portal" });
  // the site's portal deployment (its live head): the hub app reads it to reach this site's Content Hub
  const headUrl = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(String(opt.headUrl ?? "").trim().replace(/\/$/, "")) ? String(opt.headUrl).trim().replace(/\/$/, "") : "";
  if (headUrl) {
    const st = await getByPath(`${P.site}/Settings/Portal Settings`);
    const cur = st?.fields.nodes.find((x) => x.name === "PortalHead");
    if (st && cur && cur.value !== headUrl) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: st.itemId, language: LANG, fields: [{ name: "PortalHead", value: headUrl }] } });
      log(`  ~ portal deployment: ${headUrl}`);
    }
  }
  // the deployment's theme (PORTAL_THEME, from the Demo Builder; resolved by the discovery route):
  // written into Portal Settings → Theme only where a field is still empty — the theme editor's
  // and authors' choices stay
  const theme = discovery.theme ?? null;
  if (theme && typeof theme === "object") {
    const st = await getByPath(`${P.site}/Settings/Portal Settings`);
    const cur = new Map((st?.fields.nodes ?? []).map((x) => [x.name, String(x.value ?? "")]));
    const fontOk = (v) => /^[A-Za-z0-9][A-Za-z0-9 .+-]{0,60}$/.test(String(v ?? ""));
    const want = {
      ...(/^#[0-9a-f]{6}$/i.test(String(theme.accent ?? "")) ? { Accent: String(theme.accent) } : {}),
      ...(fontOk(theme.fontSerif) ? { FontSerif: String(theme.fontSerif) } : {}),
      ...(fontOk(theme.fontSans) ? { FontSans: String(theme.fontSans) } : {}),
      ...(theme.vars && typeof theme.vars === "object" && Object.keys(theme.vars).length ? { ThemeVars: JSON.stringify(theme.vars) } : {}),
    };
    const fill = Object.entries(want).filter(([name]) => cur.has(name) && !cur.get(name).trim() && !(name === "ThemeVars" && cur.get(name).trim() === "{}"));
    if (st && fill.length) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: st.itemId, language: LANG, fields: fill.map(([name, value]) => ({ name, value })) } });
      log(`  ~ theme from the deployment${theme.brand ? ` (${theme.brand})` : ""}: ${fill.map(([n]) => n).join(", ")}`);
    }
  }

  log("\n[5] template standard values (page design, insert options)");
  const sv = async (tplPath, fields) => ensureItem(tplPath, "__Standard Values", null, fields).catch(async () => {
    const item = await getByPath(`${tplPath}/__Standard Values`);
    await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: item.itemId, language: LANG, fields: Object.entries(fields).map(([n, v]) => ({ name: n, value: v })) } });
    log(`  ~ updated ${tplPath}/__Standard Values`);
  });
  // Default layout on the standard values: a page created in the Page builder starts with the
  // header, the hero (reading its own texts) and the footer; the script's pages carry their own.
  const baseSv = await getByPath(`${P.templates}/Page/__Standard Values`);
  const layoutId = /\bl="(\{[0-9A-F-]+\})"/i.exec(baseSv?.fields?.nodes?.find((f) => f.name === "__Renderings")?.value ?? "")?.[1];
  if (!layoutId) throw new Error("Could not read the layout id from the project Page template's standard values.");
  // the page templates' default layout carries this site's header and footer, and the templates are
  // the collection's: a microsite writes it only where none exists yet (the portal's stays)
  const svPage = async (tplPath, fields) => {
    if (MICROSITE && !FAST) {
      const cur = await getByPath(`${tplPath}/__Standard Values`);
      if ((cur?.fields.nodes.find((f) => f.name === "__Renderings")?.value ?? "").trim()) {
        const rest = { ...fields }; delete rest.__Renderings;
        return sv(tplPath, rest);
      }
    }
    return sv(tplPath, fields);
  };
  const IMAGE_PICK_DEFAULT = JSON.stringify({ definition: "M_Asset", max: 1, items: [] });
  await sv(`${TPL}/Portal Banner`, { ImagePick: IMAGE_PICK_DEFAULT });
  await sv(`${TPL}/Portal Header`, { LogoPick: IMAGE_PICK_DEFAULT });
  // Home has no hero: header with the menu, then the wide banner (its own image and texts), then the
  // sections — the page delta below. Section and detail pages keep their compact hero.
  await svPage(`${TPL}/Portal Home Page`, { HeroImagePick: IMAGE_PICK_DEFAULT, __Masters: sectionTpl, __Renderings: layoutXmlFull([...chromeOf()], layoutId) });
  await svPage(`${TPL}/Portal Section Page`, { HeroImagePick: IMAGE_PICK_DEFAULT, __Masters: detailTpl, __Renderings: layoutXmlFull([...chromeOf(), { id: R.PortalHero, params: { Variant: "compact" } }], layoutId) });
  await svPage(`${TPL}/Portal Detail Page`, { HeroImagePick: IMAGE_PICK_DEFAULT, __Renderings: layoutXmlFull([...chromeOf()], layoutId) });
  // page deltas position their components after the hero the standard values provide
  const heroCompact = { id: R.PortalHero, params: { Variant: "compact" } };
  const afterCompact = svUid(heroCompact);
  // the collection is up to date for this setup version and app: a microsite run after this one is quick
  if (!FAST && tplFolder) {
    await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: tplFolder, language: LANG, fields: [{ name: "__Long description", value: JSON.stringify({ collectionVersion: COLLECTION_VERSION, appId: String(opt.marketplaceAppId ?? ""), at: new Date().toISOString(), by: SITE }) }] } }).catch((e) => log(`  ! collection marker not written: ${e.message}`));
  }

  log("\n[6] page tree");
  // The site wizard made Home from the plain Page template; the portal fields live on Portal Home Page,
  // so a Home of the wrong template is recreated (it is empty right after site creation).
  let home = await getByPath(`${P.site}/Home`);
  const homeTemplate = (await gql(`query($p:String!){ item(where:{path:$p, language:"${LANG}"}){ template { templateId } } }`, { p: `${P.site}/Home` })).item?.template?.templateId;
  if (home && guid(homeTemplate) !== homeTpl) {
    // only the empty Home a new site comes with: a Home with pages under it is someone's site
    const kids = (await gql(`query($p:String!){ item(where:{path:$p, language:"${LANG}"}){ children(first:1){ nodes { path } } } }`, { p: `${P.site}/Home` })).item?.children?.nodes ?? [];
    if (kids.length) throw new Error(`${P.site}/Home uses template ${homeTemplate} (not Portal Home Page) and has pages under it — the setup won't replace it. Choose the portal's own site, or a new empty site.`);
    await gql(`mutation($i:DeleteItemInput!){ deleteItem(input:$i){ successful } }`, { i: { itemId: home.itemId, permanently: false } });
    log(`  - moved the empty ${P.site}/Home (template ${homeTemplate}) to the recycle bin to recreate it as Portal Home Page`);
    home = null;
  }
  const CLASSIC_HOME = {
    Title: "Every brand, one source of truth.",
    Eyebrow: "Brand portal",
    Lead: "Brand guidelines, products, news and approved media — served straight from Content Hub, always current.",
  };
  const homeTexts = MICROSITE ? MICROSITE_HOME_TEXT : BRAND_HUB ? {
    Title: "What are you making today?",
    Eyebrow: "",
    Lead: "Hero image for a corporate services pitch\nCan partners use our logo?\nOne-pager I can personalise",
  } : CLASSIC_HOME;
  if (!home) {
    await ensureItem(P.site, "Home", homeTpl, {}, homeTexts);
    home = await getByPath(`${P.site}/Home`);
  }
  // The site definition (Settings/Site Grouping/<site>) must point at the current Home item:
  // a stale StartItem makes Experience Edge drop the whole site from its site registry.
  // PORTAL_PUBLIC_HOST sets the target hostname SitecoreAI uses in its sitemap and Page builder links.
  await ensureItem(`${P.site}/Settings/Site Grouping`, SITE, null, { StartItem: home.itemId, ...(opt.publicHost ? { TargetHostName: String(opt.publicHost).replace(/^https?:\/\//, "").replace(/\/$/, ""), Scheme: "https" } : {}) }).catch((e) => {
    log(`  ! could not update Site Grouping StartItem: ${e.message}`);
  });
  // A page's shared layout (__Renderings) is the setup's while nobody changed it: written when the
  // page is new, still holds what the last run wrote (SetupState hash) or — before hashes were
  // kept — only renderings the setup places. A layout changed in SitecoreAI is kept (logged).
  const SETUP_UIDS = new Set();
  for (const id of Object.values(R)) for (const ph of ["headless-main", "headless-header", "headless-footer"]) for (let i = 0; i < 20; i++) SETUP_UIDS.add(guid(md5Hex(`portal|${ph}|${id}|${i}`)));
  const layoutHash = (xml) => md5Hex(String(xml ?? "").replace(/\s+/g, " ").trim());
  const keptLayouts = [], wroteLayouts = [];
  // A microsite's pages show its own header (the marque's wordmark and logo): the page templates' default
  // layout is the portal's (its header item), so each microsite page points that header at the microsite's
  // own header item — one entry on the default header's uid, read from the template's standard values.
  const svHeaderUid = {};
  if (MICROSITE) {
    for (const [kind, t] of [["home", "Portal Home Page"], ["section", "Portal Section Page"], ["detail", "Portal Detail Page"]]) {
      const v = (await getByPath(`${TPL}/${t}/__Standard Values`))?.fields.nodes.find((f) => f.name === "__Renderings")?.value ?? "";
      const r = [...v.matchAll(/<r\b[^>]*>/gi)].map((m) => m[0]).find((x) => /\bph="headless-header"/i.test(x));
      const uid = r && /\buid="(\{[^"]+\})"/i.exec(r)?.[1];
      if (uid) svHeaderUid[kind] = uid;
    }
  }
  // the entry is the setup's (a later run still recognises the layout as its own)
  for (const u of Object.values(svHeaderUid)) SETUP_UIDS.add(String(u).toUpperCase());
  const withOwnHeader = (path, xml) => {
    const rel = path.slice(P.site.length + 1);
    const uid = svHeaderUid[rel === "Home" ? "home" : rel.endsWith("/*") ? "detail" : "section"];
    return MICROSITE && uid && headerDs ? xml.replace(/<\/d><\/r>$/, `<r uid="${uid}" s:ds="${headerDs}" /></d></r>`) : xml;
  };
  const pageLayout = async (path, xmlIn) => {
    const xml = withOwnHeader(path, xmlIn);
    const rel = path.slice(P.site.length + 1);
    const it = await getByPath(path);
    const cur = it?.fields.nodes.find((f) => f.name === "__Renderings")?.value ?? "";
    const uids = [...cur.matchAll(/<r\b[^>]*\buid="(\{[^"]+\})"/gi)].map((m) => m[1].toUpperCase());
    const untouched = layouts[rel] ? layoutHash(cur) === layouts[rel] : uids.every((u) => SETUP_UIDS.has(u));
    // a value without p:p="1" is the template's standard layout showing through (not the page's own)
    if (!it || !/\bp:p="1"/.test(cur) || cur === xml || untouched) { wroteLayouts.push(rel); return { __Renderings: xml }; }
    keptLayouts.push(rel);
    log(`  ! ${rel}: its shared layout was changed in SitecoreAI — kept (the setup's layout isn't applied)`);
    return {};
  };

  const SPORTS = discovery.vertical === "sports";
  const HIGHER_ED = discovery.vertical === "higher-ed";
  if (SPORTS) log("  vertical: sports (games, theme nights, team and partner pages)");
  if (HIGHER_ED) log("  vertical: higher-ed (programs, events, experts and by-the-numbers pages)");
  const homeLayout = MICROSITE
    ? layoutXml([{ id: R.MicrositeCountdown }, { id: R.MicrositeHero }, { id: R.ModelHighlights, ds: modelsDs }, { id: R.MicrositeGallery }, { id: R.TestDriveCta }])
    : null;
  if (homeLayout) await ensureItem(P.site, "Home", homeTpl, await pageLayout(`${P.site}/Home`, homeLayout), { ...homeTexts, "Page Design": pageDesign });
  else if (BRAND_HUB) await ensureItem(P.site, "Home", homeTpl, await pageLayout(`${P.site}/Home`, layoutXml([
    { id: R.PortalHero, params: { Variant: "search" } },
    { id: R.ContentHubItems, ds: picksDs, params: { Variant: "overlay", Columns: "2" } },
    { id: R.ContentHubItems, ds: jobsDs, params: { Variant: "cards", Columns: "5" } },
    { id: R.MediaLibrary, params: { Variant: "chips" } },
    { id: R.BrandGrid, params: { Variant: "swatch" } },
    { id: R.ContentHubItems, ds: carouselDs, params: { Variant: "masonry" } },
    { id: R.PortalBanner, ds: bannerDs, params: { Variant: "guide" } },
  ])), { ...homeTexts, "Page Design": pageDesign });
  else await ensureItem(P.site, "Home", homeTpl, await pageLayout(`${P.site}/Home`, layoutXml([...(SPORTS ? [{ id: R.GameCenter }] : []), { id: R.PortalBanner, ds: bannerDs, params: { Variant: "full" } }, ...(HIGHER_ED ? [{ id: R.ByTheNumbers }, { id: R.EventsCalendar, params: { Limit: "3" } }] : []), { id: R.SectionCards, params: { ExcludeCurrent: "1" } }, { id: R.BrandGrid }, { id: R.ContentHubItems, ds: picksDs, params: { Variant: "cards" } }, { id: R.ContentHubItems, ds: carouselDs, params: { Variant: "carousel" } }])), { ...homeTexts, "Page Design": pageDesign });
  if (BRAND_HUB) {
    const homeNow = await getByPath(`${P.site}/Home`);
    const titleNow = homeNow?.fields.nodes.find((f) => f.name === "Title")?.value ?? "";
    if (homeNow && titleNow === CLASSIC_HOME.Title) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: homeNow.itemId, language: LANG, fields: Object.entries(homeTexts).map(([name, value]) => ({ name, value })) } });
      log("  ~ home: brand hub headline");
    }
  }
  let order = 0;
  const section = async (name, fields, components) => ensureItem(`${P.site}/Home`, name, sectionTpl, await pageLayout(`${P.site}/Home/${name}`, layoutXml(components, afterCompact)), { ShowOnHome: "1", ...fields, __Sortorder: String((order += 100)), "Page Design": pageDesign });
  const detail = async (parent, kind, display, component) => ensureItem(`${P.site}/Home/${parent}`, "*", detailTpl, { DetailKind: kind, ...(await pageLayout(`${P.site}/Home/${parent}/*`, layoutXml([{ id: component }]))) }, { "__Display name": display, "Page Design": pageDesign });
  if (MICROSITE) {
    await section("dealers", DEALERS_TEXT, [{ id: R.DealerLocator }]);
  } else {
  if (HIGHER_ED) {
    await section("programs", { NavLabel: "Programs", Eyebrow: "Academic programs", Title: "Find your program", Lead: "Every degree and certificate — by college, level and format, with tuition, deadlines and outcomes.", Blurb: "Degrees and certificates with tuition, deadlines and outcomes." }, [{ id: R.ProgramFinder }]);
    await detail("programs", "program", "Program (*)", R.ProgramDetail);
    await section("events", { NavLabel: "Events", Eyebrow: "Visit and connect", Title: "Campus events", Lead: "Open houses, info sessions and lectures — in English and Spanish, with registration in one click.", Blurb: "Open houses, info sessions and lectures with registration." }, [{ id: R.EventsCalendar }]);
    await section("experts", { NavLabel: "Experts", Eyebrow: "Media room", Title: "Find an expert", Lead: "Faculty who speak to the media — by topic and language, media-trained where noted.", Blurb: "Faculty experts for interviews, by topic and language." }, [{ id: R.ExpertFinder }]);
    await section("by-the-numbers", { NavLabel: "By the numbers", Eyebrow: "By the numbers", Title: "Facts we stand behind", Lead: "Rankings, outcomes and figures — each one verified, sourced and current.", Blurb: "Verified rankings, outcomes and figures." }, [{ id: R.ByTheNumbers }]);
  }
  if (SPORTS) {
    await section("games", { NavLabel: "Games", Eyebrow: "Schedule & results", Title: "Every game, every result", Lead: "The full season — dates, results, theme nights and tickets, straight from the stats and ticketing feeds.", Blurb: "The season schedule, live results and tickets." }, [{ id: R.GameSchedule }]);
    await detail("games", "game", "Game (*)", R.GameDetail);
    await section("theme-nights", { NavLabel: "Theme nights", Eyebrow: "Theme nights", Title: "Nights to remember", Lead: "Heritage, community and celebration games — with tickets and the campaign behind each one.", Blurb: "Special game nights with their campaigns and tickets." }, [{ id: R.ThemeNights }]);
    await section("team", { NavLabel: "Team", Eyebrow: "Roster", Title: "Meet the team", Lead: "Every player with their number, position and season stats.", Blurb: "The roster with season stats for every player." }, [{ id: R.Roster }]);
    await detail("team", "player", "Player (*)", R.PlayerDetail);
    await section("sponsors", { NavLabel: "Partners", Eyebrow: "Partners", Title: "Our partners", Lead: "The partners who make the season possible — placements, rights and activations.", Blurb: "Our partners and how they show up across the season." }, [{ id: R.PartnerWall }]);
  }
  await section("brands", { NavLabel: "Brand guidelines", Eyebrow: "Brand guidelines", Title: "Every brand, one source of truth.", Lead: "Colours, logos, typography, documents, templates and the rules that hold them together — served straight from Content Hub.", Blurb: "The brand books: colours, logos, fonts and the rules behind them." }, [{ id: R.BrandGrid, ...(BRAND_HUB ? { params: { Variant: "family" } } : {}) }]);
  await detail("brands", "brand", "Brand book (*)", R.BrandBook);
  if (BRAND_HUB) {
    const brandsPage = await getByPath(`${P.site}/Home/brands`);
    const banner = await getByPath(`${P.site}/Data/Portal Banners/Home banner`);
    const link = banner?.fields.nodes.find((f) => f.name === "Link")?.value ?? "";
    if (banner && brandsPage && !String(link).trim()) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: banner.itemId, language: LANG, fields: [{ name: "Link", value: ctaLinkXml("Open the brand guide", "/brands", brandsPage.itemId) }] } });
      log("  ~ home banner: brand guide link");
    }
  }
  await section("products", { ...(HIGHER_ED ? { HideFromNav: "1", ShowOnHome: "" } : {}), NavLabel: "Products", Eyebrow: "Product information", Title: "Products", Lead: "Every approved product with its data, images and documents — the same record the product team maintains in Content Hub.", Blurb: "Every approved product with its data, images and documents." }, [{ id: R.ProductCatalog, ...(BRAND_HUB ? { params: { Variant: "serve" } } : {}) }]);
  await detail("products", "product", "Product detail (*)", R.ProductDetail);
  await section("press", { NavLabel: BRAND_HUB ? "News" : "Press room", Eyebrow: "Press room", Title: "News & press releases", Lead: "The latest announcements with their images and media kits, ready to publish.", Blurb: "The latest press releases with their images and media kits." }, [{ id: R.PressList }]);
  await detail("press", "press", "Press release (*)", R.PressRelease);
  await section("campaigns", { NavLabel: "Campaigns", Eyebrow: "Campaigns", Title: "Campaigns", Lead: "Every campaign Content Hub publishes — a generic listing of one definition, with a generic detail page.", Blurb: "Campaigns from Content Hub — the generic entity pages." }, [{ id: R.ContentHubList, params: { Definition: "M_CMP_Campaign", Variant: BRAND_HUB ? "board" : "cards" } }]);
  await ensureItem(`${P.site}/Home/campaigns`, "*", detailTpl, { Definition: "M_CMP_Campaign", ...(await pageLayout(`${P.site}/Home/campaigns/*`, layoutXml([{ id: R.ContentHubDetail }]))) }, { "__Display name": "Campaign (*)", "Page Design": pageDesign });
  await section("media", { NavLabel: BRAND_HUB ? "Assets" : "Media library", Eyebrow: BRAND_HUB ? "" : "Media library", Title: BRAND_HUB ? "Assets" : "Approved media", Lead: BRAND_HUB ? "" : "Images, videos and documents cleared for use — find them by collection, brand or type and download the original.", Blurb: BRAND_HUB ? "" : "Approved images, videos and documents to find and download." }, [...(SPORTS ? [{ id: R.MediaHubTile }] : []), { id: R.MediaLibrary, ...(BRAND_HUB ? { params: { Variant: "assets" } } : {}) }]);
  // Phase 2: the partner hub (partners and staff) and the sales kit (staff only) — hidden from
  // everyone else by VisibleTo (the head redirects to /login or 404s).
  await section("partners", { NavLabel: "Partner hub", Eyebrow: "Partner hub", Title: "Your partner kit", Lead: "Approved assets of your focus brand and the campaign kits you can localize — for signed-in channel partners.", Blurb: "Partner kits and co-marketing campaign kits for our channel partners.", VisibleTo: "partners" }, [{ id: R.PartnerHub }]);
  await ensureItem(`${P.site}/Home/partners`, "*", detailTpl, { DetailKind: "partner", ...(await pageLayout(`${P.site}/Home/partners/*`, layoutXml([{ id: R.PartnerDetail }]))) }, { VisibleTo: "partners", "__Display name": "Partner (*)", "Page Design": pageDesign });
  await section("sales", { NavLabel: "Sales kit", Eyebrow: "Sales kit", Title: "Everything for the next conversation", Lead: "Competitive battlecards and customer stories — current, approved and in one place. Staff only.", Blurb: "Battlecards, case studies and the material sales needs.", VisibleTo: "staff" },
    [{ id: R.ContentHubList, params: { Definition: "M_Content_Battlecard", Variant: "cards", Limit: "6" } }, { id: R.ContentHubList, params: { Definition: "M_Content_CaseStudy", Variant: "list", Limit: "6" } }]);
  const salesSub = async (name, fields, definition, variant) => {
    await ensureItem(`${P.site}/Home/sales`, name, sectionTpl, await pageLayout(`${P.site}/Home/sales/${name}`, layoutXml([{ id: R.ContentHubList, params: { Definition: definition, Variant: variant } }], afterCompact)), { ...fields, VisibleTo: "staff", "Page Design": pageDesign });
    await ensureItem(`${P.site}/Home/sales/${name}`, "*", detailTpl, { Definition: definition, ...(await pageLayout(`${P.site}/Home/sales/${name}/*`, layoutXml([{ id: R.ContentHubDetail }]))) }, { VisibleTo: "staff", "__Display name": `${fields.NavLabel} (*)`, "Page Design": pageDesign });
  };
  await salesSub("battlecards", { NavLabel: "Battlecards", Eyebrow: "Sales kit", Title: "Battlecards", Lead: "How we win against each competitor: strengths, objections and proof.", Blurb: "Competitive battlecards." }, "M_Content_Battlecard", "cards");
  await salesSub("case-studies", { NavLabel: "Case studies", Eyebrow: "Sales kit", Title: "Case studies", Lead: "Customer stories with challenge, solution and results.", Blurb: "Customer case studies." }, "M_Content_CaseStudy", "list");
  // the dealer locator, public, when the deployment has dealers with showrooms (PORTAL_DEALERS / PORTAL_PARTNERS)
  if (discovery.dealers > 0) await section("dealers", DEALERS_TEXT, [{ id: R.DealerLocator }]);
  if (BRAND_HUB) {
    await section("collections", { NavLabel: "Collections", Eyebrow: "", Title: "Collections", Lead: "", Blurb: "Published collections from Content Hub.", ShowOnHome: "" }, [{ id: R.MediaLibrary, params: { Variant: "collections" } }]);
    await section("guidelines", { NavLabel: "Guidelines", Eyebrow: "", Title: "What good looks like", Lead: "", Blurb: "The master brand: logo, colour and photography.", ShowOnHome: "" }, [{ id: R.BrandBook, params: { LayoutOverride: "guide" } }]);
    const retitle = async (rel, from, to) => {
      const it = await getByPath(`${P.site}/${rel}`);
      const cur = it?.fields.nodes.find((f) => f.name === "NavLabel")?.value ?? "";
      if (it && from.includes(cur) && cur !== to) {
        await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields: [{ name: "NavLabel", value: to }] } });
        log(`  ~ ${rel}: ${to}`);
      }
    };
    await retitle("Home/media", ["Media library", "Library"], "Assets");
    await retitle("Home/brands", ["Brand guidelines"], "Brands");
    await retitle("Home/press", ["Press room"], "News");
    const PRODUCT_LEAD = "Every approved product with its data, images and documents — the same record the product team maintains in Content Hub.";
    const BRAND_LEAD = "Colours, logos, typography, documents, templates and the rules that hold them together — served straight from Content Hub.";
    const CAMPAIGN_LEAD = "Every campaign Content Hub publishes — a generic listing of one definition, with a generic detail page.";
    const MEDIA_LEAD = "Images, videos and documents cleared for use — find them by collection, brand or type and download the original.";
    const rewrite = async (rel, pairs) => {
      const it = await getByPath(`${P.site}/${rel}`);
      if (!it) return;
      const cur = new Map(it.fields.nodes.map((f) => [f.name, f.value ?? ""]));
      const fields = pairs.filter(([name, from, to]) => (cur.get(name) ?? "") === from && from !== to).map(([name, , to]) => ({ name, value: to }));
      if (!fields.length) return;
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields } });
      log(`  ~ ${rel}: ${fields.map((f) => f.name).join(", ")}`);
    };
    await rewrite("Home/products", [["Title", "Products", "What we serve"], ["Eyebrow", "Product information", ""], ["Lead", PRODUCT_LEAD, ""]]);
    await rewrite("Home/brands", [["Title", "Every brand, one source of truth.", "One family of brands"], ["Eyebrow", "Brand guidelines", ""], ["Lead", BRAND_LEAD, ""]]);
    await rewrite("Home/campaigns", [["Title", "Campaigns", "What's on, and what's next"], ["Eyebrow", "Campaigns", ""], ["Lead", CAMPAIGN_LEAD, ""]]);
    await rewrite("Home/media", [["Title", "Approved media", "Assets"], ["Eyebrow", "Media library", ""], ["Lead", MEDIA_LEAD, ""]]);
    for (const [name, n] of [["media", 100], ["products", 200], ["brands", 300], ["campaigns", 400], ["collections", 500], ["press", 600], ["guidelines", 700], ["partners", 800], ["sales", 900]]) {
      const it = await getByPath(`${P.site}/Home/${name}`);
      const cur = it?.fields.nodes.find((f) => f.name === "__Sortorder")?.value ?? "";
      if (it && cur !== String(n)) {
        await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: it.itemId, language: LANG, fields: [{ name: "__Sortorder", value: String(n) }] } });
        log(`  ~ Home/${name}: sort ${n}`);
      }
    }
  }
  }

  // [8] languages — the head's UI strings as dictionary entries (every language), and for each
  // extra language: the environment language item plus a version of every site content item
  // (pages, datasources, dictionary), with the built-in translations where available and the
  // English text otherwise. An existing version keeps every value it has; only its empty fields are
  // filled (authors translate in the Page builder). Supported languages of the site (Channels → Localization) are a Sites-app setting
  // without an item behind it; with none set the Page builder offers every environment language.
  const LANGS = [].concat(opt.languages ?? "de-DE").join(",").split(",").map((l) => l.trim()).filter((l) => l && l !== LANG);
  log(`\n[8] languages: ${LANGS.join(", ") || "(none)"} + dictionary`);
  const dictFolderTpl = (await getByPath("/sitecore/templates/System/Dictionary/Dictionary folder"))?.itemId;
  const dictEntryTpl = (await getByPath("/sitecore/templates/System/Dictionary/Dictionary entry"))?.itemId;
  if (!dictFolderTpl || !dictEntryTpl) throw new Error("Dictionary templates not found under /sitecore/templates/System/Dictionary.");
  // a joint microsite reads the portal's dictionary (the head maps it): no copy of its own
  if (JOINT) log("  dictionary: the portal's (joint microsite)");
  else {
    await ensureItem(`${P.site}/Dictionary`, "Portal", dictFolderTpl, {});
    for (const [key, [en]] of Object.entries(UI_STRINGS)) await ensureItem(`${P.site}/Dictionary/Portal`, `portal-${key}`, dictEntryTpl, { Key: `portal-${key}` }, { Phrase: en });
  }
  for (const lang of LANGS) {
    await ensureItem("/sitecore/system/Languages", lang, T.language, { Iso: lang.split("-")[0], "Regional Iso Code": lang, Dictionary: `${lang}.tdf` });
    const tr = translationFor(lang) ?? { ui: {}, pages: {} };
    let created = 0, kept = 0, filled = 0;
    // Both languages in one query: the default language's values (all template fields — the page
    // texts are inherited from _Portal Texts, so ownFields would miss them) and the version here.
    const FIELDS = "fields(ownFields:false, excludeStandardFields:true, first:500){ nodes { name value } }";
    const visit = async (path) => {
      const d = await gql(`query($p:String!,$l:String!){ t: item(where:{path:$p, language:$l}) { itemId version ${FIELDS} children(first:1000){ nodes { path } } } e: item(where:{path:$p, language:"${LANG}"}) { ${FIELDS} } }`, { p: path, l: lang });
      const it = d.t; if (!it) return;
      const rel = path.slice(P.site.length + 1);
      const english = Object.fromEntries((d.e?.fields?.nodes ?? []).filter((f) => f.value).map((f) => [f.name, f.value]));
      const programPicks = HIGHER_ED && rel === "Data/Portal Picks/Featured products";
      const key = programPicks ? "Data/Portal Picks/Featured programs" : MICROSITE && rel === "Home" ? "Microsite/Home" : rel;
      const translated = { ...(tr.pages[key] ?? {}) };
      const m = /^Dictionary\/Portal\/portal-(.+)$/.exec(rel);
      if (m && tr.ui[m[1]]) translated.Phrase = tr.ui[m[1]];
      const want = { ...english, ...translated };
      if (it.version > 0) {
        // an existing version keeps what authors wrote: only EMPTY fields are filled (versions made
        // before inherited fields were copied had empty page texts), and a field still holding the
        // untouched English copy gets the built-in translation (languages added before it existed)
        kept++;
        const have = new Map((it.fields?.nodes ?? []).map((f) => [f.name, String(f.value ?? "")]));
        // (a university site's picks still holding the products translation count as untouched too)
        const stale = (name) => name in translated && (have.get(name) === english[name] || (programPicks && have.get(name) === tr.pages[rel]?.[name])) && translated[name] !== have.get(name);
        const fill = Object.entries(want).filter(([name]) => have.has(name) && (!have.get(name).trim() || stale(name))).map(([name, value]) => ({ name, value: String(value) }));
        if (fill.length) {
          await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: guid(it.itemId), language: lang, fields: fill } });
          filled += fill.length;
        }
      } else {
        await gql(`mutation($i:AddItemVersionInput!){ addItemVersion(input:$i){ item { version } } }`, { i: { itemId: guid(it.itemId), language: lang } });
        const list = Object.entries(want).map(([name, value]) => ({ name, value: String(value) }));
        if (list.length) await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: guid(it.itemId), language: lang, fields: list } });
        created++;
      }
      for (const c of it.children.nodes) await visit(c.path);
    };
    for (const root of ["Home", "Data", ...(JOINT ? [] : ["Dictionary"])]) await visit(`${P.site}/${root}`);
    log(`  ${lang}: ${created} versions created, ${kept} existing kept${filled ? `, ${filled} fields filled (empty or still the ${LANG} copy)` : ""}${translationFor(lang) ? "" : ` — no built-in texts for ${lang}, the version starts as the ${LANG} copy`}`);
  }

  // The deployment's Home banner texts (PORTAL_HERO, per language: eyebrow, title, text and an
  // optional call to action): written into each language version over the setup's own default
  // texts (English or the built-in translation) and empty fields — never over an author's text.
  const hero = branding.hero && typeof branding.hero === "object" ? branding.hero : null;
  if (hero && !MICROSITE) {
    const bannerPath = `${P.site}/Data/Portal Banners/Home banner`;
    const EN_DEFAULT = { Eyebrow: "From the library", Title: "One picture, straight from Content Hub.", Text: "This banner's image is a Content Hub asset chosen in the Page builder's media dialog — served from its public link, never copied." };
    const heroFor = (lang) => hero[lang] ?? hero[lang.split("-")[0]] ?? (lang === LANG ? hero.en ?? hero["en-US"] : null) ?? null;
    for (const lang of [LANG, ...LANGS]) {
      const h = heroFor(lang);
      if (!h || typeof h !== "object") continue;
      const d = await gql(`query($p:String!,$l:String!){ item(where:{path:$p, language:$l}){ itemId version fields(ownFields:false, excludeStandardFields:true, first:100){ nodes { name value } } } }`, { p: bannerPath, l: lang });
      const it = d.item;
      if (!it || !(it.version > 0)) continue;
      const cur = new Map((it.fields?.nodes ?? []).map((x) => [x.name, String(x.value ?? "")]));
      const builtIn = translationFor(lang)?.pages?.["Data/Portal Banners/Home banner"] ?? {};
      const isDefault = (name) => { const v = (cur.get(name) ?? "").trim(); return !v || v === EN_DEFAULT[name] || v === builtIn[name]; };
      const fill = [];
      for (const [name, key] of [["Eyebrow", "eyebrow"], ["Title", "title"], ["Text", "text"]]) {
        const v = typeof h[key] === "string" ? h[key].trim().slice(0, name === "Text" ? 600 : 160) : "";
        if (v && cur.has(name) && isDefault(name) && cur.get(name) !== v) fill.push({ name, value: v });
      }
      const cta = h.cta && typeof h.cta === "object" ? h.cta : null;
      const href = cta && /^(https?:\/\/|\/)[^\s"<>]+$/i.test(String(cta.href ?? "")) ? String(cta.href) : "";
      // empty, or an internal link without an item id (written by earlier setups — Sitecore can't
      // resolve it, and the whole banner item then fails to load: no fields in the layout)
      const link = (cur.get("Link") ?? "").trim();
      if (href && cur.has("Link") && (!link || isBrokenInternalLink(link))) {
        const page = href.startsWith("/") ? await getByPath(`${P.site}/Home${href.replace(/[?#].*$/, "").replace(/\/+$/, "")}`) : null;
        fill.push({ name: "Link", value: ctaLinkXml(String(cta.label ?? ""), href, page?.itemId ?? "") });
      }
      if (fill.length) {
        await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: guid(it.itemId), language: lang, fields: fill } });
        log(`  ~ home banner (${lang}): ${fill.map((x) => x.name).join(", ")}`);
      }
    }
  }

  // the layouts as SitecoreAI stores them, so the next run can tell whether anyone changed them
  for (const rel of wroteLayouts) {
    const v = (await getByPath(`${P.site}/${rel}`))?.fields.nodes.find((f) => f.name === "__Renderings")?.value ?? "";
    if (v.trim()) layouts[rel] = layoutHash(v);
  }
  await writeState({ version: SETUP_VERSION, completedAt: new Date().toISOString(), layouts });
  if (keptLayouts.length) log(`\n  kept ${keptLayouts.length} page layout(s) changed in SitecoreAI: ${keptLayouts.join(", ")}`);

  if (PUBLISH) {
    log("\n[7] publish");
    // a quick run changed nothing in the collection's templates and renderings: only the site
    for (const root of FAST ? [P.site] : [TPL, REN, P.site]) {
      const d = await gql(`mutation($i:PublishItemInput!){ publishItem(input:$i){ operationId } }`, { i: { rootItemPath: root, languages: [LANG, ...LANGS], publishSubItems: true, publishRelatedItems: true, publishItemMode: "SMART", targetDatabases: ["experienceedge"] } });
      log(`  publish ${root} → operation ${d.publishItem.operationId}`);
    }
  }
  log("\nDone.");

  return { collection: COLLECTION, site: SITE, sitePath: P.site, languages: [LANG, ...LANGS] };
}

/**
 * Points a rendering-host item (/sitecore/system/Settings/Services/Rendering Hosts/<name>) at a
 * head URL and, with `useForSite`, makes it the site's rendering host (Site Grouping).
 */
export async function registerRenderingHost({ gql: rawGql, log = (line) => { void line; } }, { name: typedName, url, collection, site, useForSite = false }) {
  const gql = retryOnTimeout(rawGql, log);
  const name = itemName(typedName, `${site || "portal"}-editing`);
  // the Deploy app's own host: repointing it would move every site that uses it
  if (name.toLowerCase() === "default") throw new Error('"Default" is the Deploy app\'s rendering host — choose a name of your own (e.g. <site>-editing).');
  if (!/^https:\/\/[^\s/]+/i.test(String(url ?? "")) && !/^http:\/\/localhost(:\d+)?/i.test(String(url ?? ""))) throw new Error(`The editing host URL must be the deployment's https address (got "${url ?? ""}").`);
  const base = String(url).replace(/\/$/, "");
  const ROOT = "/sitecore/system/Settings/Services/Rendering Hosts";
  const fields = [
    { name: "ServerSideRenderingEngineEndpointUrl", value: `${base}/api/editing/render` },
    { name: "ServerSideRenderingEngineConfigUrl", value: `${base}/api/editing/config` },
    { name: "ServerSideRenderingEngineApplicationUrl", value: base },
    { name: "AppName", value: name },
  ];
  const g = (id) => `{${String(id).replace(/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i, "$1-$2-$3-$4-$5").toUpperCase()}}`;
  const existing = (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ itemId } }`, { p: `${ROOT}/${name}` })).item;
  if (existing) {
    await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: existing.itemId, language: "en", fields } });
    log(`  ~ rendering host ${name} → ${base}`);
  } else {
    const def = (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ template { templateId } parent { itemId } } }`, { p: `${ROOT}/Default` })).item;
    if (!def) throw new Error(`${ROOT}/Default not found — cannot derive the rendering host template.`);
    await gql(`mutation($i:CreateItemInput!){ createItem(input:$i){ item { itemId } } }`, { i: { name, parent: def.parent.itemId, templateId: g(def.template.templateId), language: "en", fields } });
    log(`  + rendering host ${name} → ${base}`);
  }
  if (useForSite && collection && site) {
    const sg = (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ itemId } }`, { p: `/sitecore/content/${collection}/${site}/Settings/Site Grouping/${site}` })).item;
    if (sg) {
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: sg.itemId, language: "en", fields: [{ name: "RenderingHost", value: name }] } });
      log(`  ~ site ${site} now renders with ${name}`);
    }
  }
}

// The header and footer come from the page templates' standard values. The Page builder can save a page's
// final (per-version) layout with those renderings replaced by "nothing" (s:id = the empty id): the page
// then shows an empty header or footer slot. These are the pages (and languages) where that happened.
const NO_RENDERING = "{00000000-0000-0000-0000-000000000000}";
async function blankedChrome(gql, sitePath, tplPath, languages) {
  const read = async (path, language = "en") => {
    const d = await gql(`query($p:String!,$l:String!){ item(where:{path:$p, language:$l}){ itemId version path fields(ownFields:false, excludeStandardFields:false, first:500){ nodes { name value } } children { nodes { name path } } } }`, { p: path, l: language });
    return d?.item ?? null;
  };
  const fieldOf = (it, name) => it?.fields?.nodes?.find((n) => n.name === name)?.value ?? "";
  // the standard values' header and footer renderings (their uids), across the three page templates
  const chrome = new Set();
  for (const t of ["Portal Home Page", "Portal Section Page", "Portal Detail Page"]) {
    const sv = await read(`${tplPath}/${t}/__Standard Values`);
    for (const m of fieldOf(sv, "__Renderings").matchAll(/<r\b[^>]*>/gi)) {
      const uid = /\buid="(\{[^"]+\})"/i.exec(m[0])?.[1], ph = /\bph="([^"]+)"/i.exec(m[0])?.[1] ?? "";
      if (uid && /^headless-(header|footer)$/i.test(ph)) chrome.add(uid.toUpperCase());
    }
  }
  if (!chrome.size) return [];
  const found = [];
  const inspect = (it, language) => {
    const final = fieldOf(it, "__Final Renderings");
    const uids = [...final.matchAll(/<r\b[^>]*>/gi)].map((m) => m[0]).filter((r) => r.toUpperCase().includes(`S:ID="${NO_RENDERING}"`)).map((r) => (/\buid="(\{[^"]+\})"/i.exec(r)?.[1] ?? "").toUpperCase()).filter((u) => chrome.has(u));
    if (uids.length) found.push({ path: it.path, itemId: it.itemId, version: it.version, language, uids });
  };
  const home = await read(`${sitePath}/Home`);
  if (!home) return [];
  inspect(home, "en");
  for (const l of languages.filter((x) => x && x !== "en")) { const h = await read(`${sitePath}/Home`, l); if (h?.version) inspect(h, l); }
  // the section pages and the ones under them (detail pages)
  for (const c of home.children?.nodes ?? []) {
    const it = await read(c.path);
    if (!it) continue;
    inspect(it, "en");
    for (const g of it.children?.nodes ?? []) { const gi = await read(g.path); if (gi) inspect(gi, "en"); }
  }
  return found;
}

/**
 * The site check of the Portal setup wizard: what an existing site is missing or has drifted
 * from, each failing item with the fix the wizard can apply (`fixSite`) — or `run` for "run the
 * setup". Reads only; every check is the author's own Authoring API access.
 * @param {{ gql: (query: string, variables?: object) => Promise<any> }} ctx
 * @param {{ collection: string, site: string, appId?: string, publicHost?: string, languages?: string[], partnerKits?: any[], editingUrl?: string }} opts
 */
export async function checkSite({ gql: rawGql }, { collection, site, appId = "", publicHost = "", languages = [], partnerKits = [], editingUrl = "" }) {
  const gql = retryOnTimeout(rawGql);
  const SITE_PATH = `/sitecore/content/${collection}/${site}`, TPL = `/sitecore/templates/Project/${collection}/Portal`;
  const read = async (path, language = "en") => {
    const d = await gql(`query($p:String!,$l:String!){ item(where:{path:$p, language:$l}){ itemId version fields(ownFields:false, excludeStandardFields:false, first:500){ nodes { name value } } } }`, { p: path, l: language });
    return d?.item ? { id: d.item.itemId, version: d.item.version, f: new Map((d.item.fields?.nodes ?? []).map((n) => [n.name, n.value ?? ""])) } : null;
  };
  const checks = [];
  const settings = await read(`${SITE_PATH}/Settings/Portal Settings`);
  if (!settings) {
    checks.push({ id: "setup", label: "Portal set up", status: "fail", detail: "no Portal Settings item — the setup hasn't run on this site", fix: { id: "run", label: "Run the setup" } });
    return checks;
  }
  // a run records when it finished (SetupState); a site whose last run stopped halfway — or that
  // predates the record — gets "Run the setup" rather than a green tick
  let setupState = {};
  try { setupState = JSON.parse(settings.f.get("SetupState") || "{}") || {}; } catch { setupState = {}; }
  const finished = !!setupState.completedAt && !(setupState.runningSince && Date.now() - Date.parse(setupState.runningSince) < 20 * 60 * 1000);
  checks.push(finished
    ? { id: "setup", label: "Portal set up", status: "ok", detail: `last run finished ${String(setupState.completedAt).slice(0, 16).replace("T", " ")} (setup v${setupState.version ?? "?"})` }
    : setupState.runningSince && Date.now() - Date.parse(setupState.runningSince) < 20 * 60 * 1000
      ? { id: "setup", label: "Portal set up", status: "warn", detail: `a setup run started ${String(setupState.runningSince).slice(0, 16).replace("T", " ")} and is still running (or stopped within the last 20 minutes)` }
      : { id: "setup", label: "Portal set up", status: "warn", detail: "Portal Settings present, but no finished run is recorded — the last run stopped halfway, or ran before runs were recorded", fix: { id: "run", label: "Run the setup" } });

  const blanked = await blankedChrome(gql, SITE_PATH, TPL, languages);
  const pageName = (b) => `${b.path.slice(SITE_PATH.length + 1) || "Home"}${b.language !== "en" ? ` (${b.language})` : ""}`;
  checks.push(blanked.length
    ? { id: "chrome", label: "Header and footer", status: "warn", detail: `removed on ${blanked.map(pageName).join(", ")} — the page's own layout (saved in the Page builder) replaces them with nothing`, fix: { id: "chrome", label: "Bring them back" } }
    : { id: "chrome", label: "Header and footer", status: "ok", detail: "on every page" });

  if (appId) {
    // every field that opens the portal's app: the picks and the two Content Hub image fields
    const appFields = [`${TPL}/Portal Picks/Picks/Picks`, `${TPL}/Portal Banner/Banner/ImagePick`, `${TPL}/_Portal Texts/Portal/HeroImagePick`, `${TPL}/Portal Header/Header/LogoPick`];
    const sources = await Promise.all(appFields.map(async (path) => { const f = await read(path); return f ? (f.f.get("Source") ?? "").trim() : null; }));
    const present = sources.filter((x) => x !== null);
    const wrong = present.filter((x) => x.toLowerCase() !== appId.toLowerCase());
    const other = wrong.find(Boolean) ?? "";
    const ok = present.length > 0 && !wrong.length;
    checks.push({ id: "picks-source", label: "Content Hub picker", status: ok ? "ok" : "warn", detail: ok ? `the picker fields use this app (${present.length})` : other ? `${wrong.length} of ${present.length} picker fields use another app (${other})` : `${wrong.length} picker field${wrong.length === 1 ? " has" : "s have"} no app`, fix: ok ? undefined : { id: "picks-source", label: "Use this app" } });
  }

  if (partnerKits.length) {
    const d = await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ children(first:1000){ nodes { fields(ownFields:true, excludeStandardFields:true, first:50){ nodes { name value } } } } } }`, { p: `${SITE_PATH}/Data/Partners` });
    const have = new Set((d?.item?.children?.nodes ?? []).map((c) => (c.fields?.nodes?.find((n) => n.name === "KitCollection")?.value ?? "").trim()).filter(Boolean));
    const missing = partnerKits.filter((k) => !have.has(k.id));
    checks.push({ id: "partners", label: "Partner profiles", status: missing.length ? "warn" : "ok", detail: missing.length ? `${missing.length} of ${partnerKits.length} partner kits have no partner item: ${missing.map((k) => k.name).join(", ")}` : `${partnerKits.length} partner kits, each with a partner item`, fix: missing.length ? { id: "partners", label: `Create ${missing.length} partner item${missing.length === 1 ? "" : "s"}` } : undefined });
  }

  const grouping = await read(`${SITE_PATH}/Settings/Site Grouping/${site}`);
  const host = String(publicHost || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (host) {
    const current = (grouping?.f.get("TargetHostName") ?? "").trim();
    checks.push({ id: "host", label: "Target host", status: current === host ? "ok" : "warn", detail: current === host ? host : `${current || "empty"} — the public site is ${host}`, fix: current === host ? undefined : { id: "host", label: `Set ${host}` } });
  }

  const missingLangs = [];
  for (const lang of languages.filter((l) => l && l !== "en")) {
    const langItem = await read(`/sitecore/system/Languages/${lang}`);
    const home = langItem ? await read(`${SITE_PATH}/Home`, lang) : null;
    if (!langItem || !home || !home.version) missingLangs.push(lang);
  }
  if (languages.some((l) => l && l !== "en")) {
    checks.push({ id: "languages", label: "Languages", status: missingLangs.length ? "warn" : "ok", detail: missingLangs.length ? `no versions in ${missingLangs.join(", ")} — the portal serves these languages` : `en, ${languages.filter((l) => l !== "en").join(", ")}`, fix: missingLangs.length ? { id: "run", label: `Run the setup with ${missingLangs.join(", ")}` } : undefined, languages: missingLangs });
  }

  const hostName = (grouping?.f.get("RenderingHost") ?? "").trim() || "Default";
  const hostItem = await read(`/sitecore/system/Settings/Services/Rendering Hosts/${hostName}`);
  const appUrl = (hostItem?.f.get("ServerSideRenderingEngineApplicationUrl") ?? "").trim().replace(/\/$/, "");
  const wantUrl = String(editingUrl || "").trim().replace(/\/$/, "");
  if (wantUrl) {
    const ok = appUrl === wantUrl;
    checks.push({ id: "rendering-host", label: "Editing host", host: hostName, status: ok ? "ok" : "warn", detail: ok ? `${hostName} → ${appUrl}` : `${hostName} → ${appUrl || "the Deploy app's editing host"}; PORTAL_EDITING_URL is ${wantUrl}`, fix: ok ? undefined : { id: "rendering-host", label: "Use the editing deployment" } });
  } else {
    checks.push({ id: "rendering-host", label: "Editing host", host: hostName, status: "ok", detail: `${hostName}${appUrl ? ` → ${appUrl}` : " (the Deploy app's editing host)"}` });
  }
  return checks;
}

/**
 * Applies one fix from `checkSite`. Idempotent, like the setup.
 * @param {{ gql: (query: string, variables?: object) => Promise<any>, log?: (line: string) => void }} ctx
 * @param {string} fixId  picks-source | partners | host | rendering-host | chrome | publish
 * @param {{ collection: string, site: string, appId?: string, publicHost?: string, partnerKits?: any[], editingUrl?: string, languages?: string[] }} opts
 */
export async function fixSite({ gql: rawGql, log = (line) => { void line; } }, fixId, { collection, site, appId = "", publicHost = "", partnerKits = [], editingUrl = "", languages = [] }) {
  const gql = retryOnTimeout(rawGql, log);
  const SITE_PATH = `/sitecore/content/${collection}/${site}`, TPL = `/sitecore/templates/Project/${collection}/Portal`;
  const idOf = async (path) => (await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ itemId } }`, { p: path }))?.item?.itemId ?? null;
  const update = (itemId, fields) => gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId, language: "en", fields: Object.entries(fields).map(([name, value]) => ({ name, value: String(value) })) } });
  const publish = async (root, subItems = true) => {
    const d = await gql(`mutation($i:PublishItemInput!){ publishItem(input:$i){ operationId } }`, { i: { rootItemPath: root, languages: ["en", ...languages.filter((l) => l && l !== "en")], publishSubItems: subItems, publishRelatedItems: subItems, publishItemMode: "SMART", targetDatabases: ["experienceedge"] } });
    log(`  publish ${root} → operation ${d.publishItem.operationId}`);
  };
  if (fixId === "picks-source") {
    const id = await idOf(`${TPL}/Portal Picks/Picks/Picks`);
    if (!id) throw new Error("The Picks field is missing — run the setup.");
    for (const path of [`${TPL}/Portal Picks/Picks/Picks`, `${TPL}/Portal Banner/Banner/ImagePick`, `${TPL}/_Portal Texts/Portal/HeroImagePick`, `${TPL}/Portal Header/Header/LogoPick`]) {
      const fid = await idOf(path);
      if (!fid) continue;
      await update(fid, { Source: appId });
      log(`  ~ ${path.split("/").pop()} → app ${appId}`);
    }
    await publish(TPL);
  } else if (fixId === "partners") {
    const tpl = await idOf(`${TPL}/Portal Partner`);
    const folder = await idOf(`${SITE_PATH}/Data/Partners`);
    if (!tpl || !folder) throw new Error("The partner template or the Data/Partners folder is missing — run the setup.");
    const d = await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ children(first:1000){ nodes { name fields(ownFields:true, excludeStandardFields:true, first:50){ nodes { name value } } } } } }`, { p: `${SITE_PATH}/Data/Partners` });
    const children = d?.item?.children?.nodes ?? [];
    const have = new Set(children.map((c) => (c.fields?.nodes?.find((n) => n.name === "KitCollection")?.value ?? "").trim()));
    const names = new Set(children.map((c) => c.name.toLowerCase()));
    for (const kit of partnerKits.filter((k) => !have.has(k.id))) {
      const name = itemName(kit.name, kit.user);
      if (names.has(name.toLowerCase())) { log(`  = ${name} exists (kit field differs — left alone)`); continue; }
      await gql(`mutation($i:CreateItemInput!){ createItem(input:$i){ item { itemId } } }`, { i: { name, parent: folder, templateId: tpl, language: "en", fields: Object.entries({ User: kit.user, KitCollection: kit.id, Tier: kit.tier, Region: kit.region, FocusBrand: kit.brand, About: kit.about, "__Display name": kit.name }).map(([n, v]) => ({ name: n, value: String(v ?? "") })) } });
      log(`  + partner ${name} (user ${kit.user})`);
    }
    await publish(`${SITE_PATH}/Data/Partners`);
  } else if (fixId === "host") {
    const id = await idOf(`${SITE_PATH}/Settings/Site Grouping/${site}`);
    if (!id) throw new Error("The site definition (Settings/Site Grouping) is missing.");
    const host = String(publicHost).replace(/^https?:\/\//, "").replace(/\/$/, "");
    await update(id, { TargetHostName: host, Scheme: "https" });
    log(`  ~ target host → ${host}`);
    await publish(`${SITE_PATH}/Settings`);
  } else if (fixId === "rendering-host") {
    const grouping = await gql(`query($p:String!){ item(where:{path:$p, language:"en"}){ fields(ownFields:false, excludeStandardFields:true, first:500){ nodes { name value } } } }`, { p: `${SITE_PATH}/Settings/Site Grouping/${site}` }).catch(() => null);
    const current = String((grouping?.item?.fields?.nodes ?? []).find((n) => n.name === "RenderingHost")?.value ?? "").trim();
    // never repoint the Deploy app's own host ("Default"); use a host of the site's own instead
    const name = current && current !== "Default" ? current : `${site}-editing`;
    await registerRenderingHost({ gql, log }, { name, url: editingUrl, collection, site, useForSite: true });
    await publish(`${SITE_PATH}/Settings`);
  } else if (fixId === "chrome") {
    // only the entries that blank the header or footer; everything else in the page's layout stays
    for (const b of await blankedChrome(gql, SITE_PATH, TPL, languages)) {
      const d = await gql(`query($p:String!,$l:String!){ item(where:{path:$p, language:$l}){ itemId version fields(ownFields:false, excludeStandardFields:false, first:500){ nodes { name value } } } }`, { p: b.path, l: b.language });
      const final = d?.item?.fields?.nodes?.find((n) => n.name === "__Final Renderings")?.value ?? "";
      const next = final.replace(/<r\b[^>]*\/>/gi, (r) => (r.toUpperCase().includes(`S:ID="${NO_RENDERING}"`) && b.uids.includes((/\buid="(\{[^"]+\})"/i.exec(r)?.[1] ?? "").toUpperCase()) ? "" : r));
      if (next === final) continue;
      await gql(`mutation($i:UpdateItemInput!){ updateItem(input:$i){ item { itemId } } }`, { i: { itemId: b.itemId, language: b.language, version: b.version, fields: [{ name: "__Final Renderings", value: next }] } });
      log(`  ~ ${b.path.slice(SITE_PATH.length + 1) || "Home"}${b.language !== "en" ? ` (${b.language})` : ""}: header and footer back`);
      await publish(b.path, false);
    }
  } else if (fixId === "publish") {
    for (const root of [TPL, `/sitecore/layout/Renderings/Project/${collection}/Portal`, SITE_PATH]) await publish(root);
  } else throw new Error(`Unknown fix: ${fixId}`);
}
