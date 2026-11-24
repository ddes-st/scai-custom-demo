import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const landingCardDefinition = {
  kind: "component",
  definitionKey: "dom-security-landing-card",
  name: "dom-security-landing-card",
  displayName: "Landing Card",
  componentName: "DomSecurityLandingCard",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Landing Cards"],
  },
  model: {
    folderTemplate: { name: "Landing Card Folder" },
    itemTemplate: {
      name: "Landing Card",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Text", type: "Rich Text" },
            { name: "Image", type: "Image" },
            { name: "Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Landing Cards"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Access History",
        displayName: "Suivez l'historique des accès",
        fields: {
          Title: "Suivez l'historique des accès",
          Text: "<p>Voyez facilement qui entre et sort, et à quel moment. Surveillez l'activité, obtenez des informations en temps réel et exercez un meilleur contrôle sur votre système de sécurité.</p>",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM/DOM-Global/dom-eniq/access-control-grid-scroll-1.jpg?extension=webp",
            alt: "Suivi de l'historique des accès",
          },
        },
      },
      {
        name: "Flexible Permissions",
        displayName: "Autorisations flexibles",
        fields: {
          Title: "Accordez des autorisations flexibles en temps réel",
          Text: "<p>Un choix d'options de contrôle permet d'organiser facilement la sécurité de chaque utilisateur et du système dans son ensemble. Créez plusieurs clés numériques à la demande et installez du matériel d'accès en toute simplicité.</p>",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM/DOM-Global/dom-eniq/access-control-grid-scroll-2.jpg?extension=webp",
            alt: "Autorisations d'accès en temps réel",
          },
        },
      },
      {
        name: "High Security Encryption",
        displayName: "Chiffrement de haute sécurité",
        fields: {
          Title: "Chiffrement de haute sécurité",
          Text: "<p>Grâce à notre technologie de chiffrement, il est pratiquement impossible pour des personnes non autorisées de compromettre votre sécurité d'accès.</p>",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM/DOM-Global/dom-eniq/access-control-grid-scroll-3.jpg?extension=webp",
            alt: "Chiffrement de haute sécurité",
          },
        },
      },
      {
        name: "Minimal Risk",
        displayName: "Risque minimal",
        fields: {
          Title: "Risque minimal",
          Text: "<p>Lorsqu'un utilisateur perd ses clés, le système peut les désactiver immédiatement. Plus besoin de changer les serrures — la sécurité est accessible en un clic.</p>",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM/DOM-Global/dom-eniq/access-control-grid-scroll-4.jpg?extension=webp",
            alt: "Contrôle d'accès DOM",
          },
        },
      },
      {
        name: "Icon Performance",
        displayName: "Performance",
        fields: { Title: "Performance" },
      },
      {
        name: "Icon Cyber",
        displayName: "Cybersécurité embarquée",
        fields: { Title: "Cybersécurité embarquée" },
      },
      {
        name: "Icon Hardware",
        displayName: "Matériel ENiQ et Tapkey",
        fields: { Title: "Matériel ENiQ et Tapkey" },
      },
      {
        name: "Icon Design",
        displayName: "Design",
        fields: { Title: "Design" },
      },
      {
        name: "Logo France Tv",
        displayName: "France TV",
        fields: { Title: "France TV" },
      },
      {
        name: "Logo Chu",
        displayName: "CHU",
        fields: { Title: "CHU" },
      },
      {
        name: "Logo Framatome",
        displayName: "Framatome",
        fields: { Title: "Framatome" },
      },
      {
        name: "Logo Port Rochelle",
        displayName: "Port de La Rochelle",
        fields: { Title: "Port de La Rochelle" },
      },
      {
        name: "Logo Ratp",
        displayName: "RATP",
        fields: { Title: "RATP" },
      },
      {
        name: "Logo Total",
        displayName: "Total",
        fields: { Title: "Total" },
      },
      {
        name: "Product Guard",
        displayName: "DOM Guard",
        fields: {
          Title: "DOM Guard",
          Text: "<p>Béquille électronique</p>",
          Link: { text: "DOM Guard", url: "https://www.dom-security.com/fr/fr/produits-1/access-control/guard" },
        },
      },
      {
        name: "Product Pro",
        displayName: "DOM Pro",
        fields: {
          Title: "DOM Pro",
          Text: "<p>Cylindre électronique</p>",
          Link: { text: "DOM Pro", url: "https://www.dom-security.com/fr/fr/produits-1/access-control/pro" },
        },
      },
      {
        name: "Product Loq",
        displayName: "DOM Loq",
        fields: {
          Title: "DOM Loq",
          Text: "<p>Serrure électronique pour meuble</p>",
          Link: { text: "DOM Loq", url: "https://www.dom-security.com/fr/fr/produits-1/access-control/loq" },
        },
      },
      {
        name: "Product Wallreader",
        displayName: "DOM Wallreader",
        fields: {
          Title: "DOM Wallreader",
          Text: "<p>Lecteur mural</p>",
          Link: { text: "DOM Wallreader", url: "https://www.dom-security.com/fr/fr/produits-1/access-control/wall-reader" },
        },
      },
      {
        name: "Eniq Software Option",
        displayName: "Logiciel ENiQ",
        fields: {
          Title: "Logiciel ENiQ",
          Text: "<p>Avec cette connexion en temps réel, vous pouvez intégrer des systèmes d'alarme avancés et des protocoles de sécurité complexes.</p>",
          Link: { text: "Découvrir", url: "https://www.dom-security.com/fr/fr/produits-1/access-control" },
        },
      },
      {
        name: "Eniq App Option",
        displayName: "ENiQ App",
        fields: {
          Title: "ENiQ App",
          Text: "<p>Cette application intuitive permet de programmer et de gérer votre système de contrôle d'accès électronique depuis votre smartphone.</p>",
          Link: { text: "Découvrir", url: "https://www.dom-security.com/fr/fr/produits-1/access-control" },
        },
      },
      {
        name: "Dom Tapkey Option",
        displayName: "DOM Tapkey",
        fields: {
          Title: "DOM Tapkey",
          Text: "<p>Une application flexible basée sur le cloud, offrant une gestion des accès à distance et une intégration ouverte avec d'autres systèmes.</p>",
          Link: {
            text: "Découvrir",
            url: "https://www.dom-security.com/fr/fr/produits-1/dom-tapkey-family/dom-tapkey-for-coworking",
          },
        },
      },
      {
        name: "Smooth Mobile Access",
        displayName: "Accès mobile fluide",
        fields: {
          Title: "Accès mobile fluide",
          Text: "<p>L'application mobile DOM Tapkey transforme les smartphones en clés digitales sécurisées, offrant une solution d'accès pratique et sans contact.</p>",
        },
      },
      {
        name: "Realtime Access Control",
        displayName: "Contrôle d'accès en temps réel",
        fields: {
          Title: "Contrôle d'accès en temps réel",
          Text: "<p>Suivez qui entre et sort de votre espace de coworking : avec DOM Tapkey, vous êtes toujours au courant.</p>",
        },
      },
      {
        name: "Automated Access",
        displayName: "Gestion automatisée des accès",
        fields: {
          Title: "Gestion automatisée des accès",
          Text: "<p>DOM Tapkey automatise le contrôle d'accès pour les membres, les employés et les invités à partir de votre plateforme de réservation.</p>",
        },
      },
      {
        name: "Step Connect",
        displayName: "Connectez l'extension",
        fields: {
          Title: "1. Connectez l'extension",
          Text: "<p>Dans le logiciel de bureau Tapkey, sélectionnez la fonction Extension depuis le menu principal. Connectez-vous à votre logiciel de réservation en quelques clics.</p>",
        },
      },
      {
        name: "Step Reserve",
        displayName: "Réservez un espace",
        fields: {
          Title: "2. Réservez un espace",
          Text: "<p>Une fois la connexion établie, réservez une salle de réunion ou un bureau. La clé virtuelle est envoyée automatiquement.</p>",
        },
      },
      {
        name: "Step Unlock",
        displayName: "Ouvrez avec l'application",
        fields: {
          Title: "3. Ouvrez avec l'application",
          Text: "<p>Installez l'application Tapkey sur votre téléphone et accédez au bureau ou à l'espace réservé à l'heure choisie.</p>",
        },
      },
      {
        name: "Google Calendar",
        displayName: "Google Calendar",
        fields: {
          Title: "Google Calendar",
          Text: "<p>Votre agenda intelligent et centralisé pour planifier et gérer toutes vos tâches et événements.</p>",
        },
      },
      {
        name: "Nexudus",
        displayName: "Nexudus",
        fields: {
          Title: "Nexudus",
          Text: "<p>Une gestion efficace et axée sur les équipes pour renforcer les espaces de coworking.</p>",
        },
      },
      {
        name: "Cobot",
        displayName: "Cobot",
        fields: {
          Title: "Cobot",
          Text: "<p>Un logiciel de gestion de coworking intuitif pour organiser votre espace et l'aider à se développer.</p>",
        },
      },
      {
        name: "Clock PMS",
        displayName: "Clock PMS",
        fields: {
          Title: "Clock PMS",
          Text: "<p>Une solution Cloud intuitive pour l'hôtellerie, qui renforce les capacités du personnel et ravit les clients.</p>",
        },
      },
      {
        name: "RoomRaccoon",
        displayName: "RoomRaccoon",
        fields: {
          Title: "RoomRaccoon",
          Text: "<p>Un logiciel de gestion hôtelière tout-en-un pour les hôteliers indépendants.</p>",
        },
      },
      {
        name: "Archie",
        displayName: "Archie",
        fields: {
          Title: "Archie",
          Text: "<p>Une plateforme globale conçue pour simplifier la gestion des espaces de travail hybrides et flexibles.</p>",
        },
      },
      {
        name: "Spacebring",
        displayName: "Spacebring",
        fields: {
          Title: "Spacebring",
          Text: "<p>Une plateforme de gestion de coworking qui automatise les opérations, favorise la croissance et la fidélisation de la communauté.</p>",
        },
      },
      {
        name: "Mews",
        displayName: "Mews",
        fields: {
          Title: "Mews",
          Text: "<p>Une solution hôtelière Cloud pour optimiser les opérations, accroître les bénéfices et offrir des expériences clients uniques.</p>",
        },
      },
      {
        name: "More Integrations",
        displayName: "Et d'autres à venir",
        fields: {
          Title: "Et d'autres à venir",
          Text: "<p>D'autres intégrations sont prévues prochainement. Contactez-nous pour connaître les possibilités d'intégration à votre plateforme.</p>",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
