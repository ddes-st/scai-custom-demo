import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

const COMPARE_TABLE = `
<table>
  <thead>
    <tr>
      <th></th>
      <th>Logiciel ENiQ</th>
      <th>ENiQ App</th>
      <th>DOM Tapkey</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>Nombre de portes</th>
      <td>100+ portes</td>
      <td>&lt;100 portes</td>
      <td>&lt;100 portes</td>
    </tr>
    <tr>
      <th>Nombre d'utilisateurs</th>
      <td>Jusqu'à 100&nbsp;000 utilisateurs</td>
      <td>&lt;500 utilisateurs</td>
      <td>N/A, basé sur le Cloud</td>
    </tr>
    <tr>
      <th>Plusieurs administrateurs</th>
      <td>Oui</td>
      <td>—</td>
      <td>Oui</td>
    </tr>
    <tr>
      <th>Clés mobiles et badges</th>
      <td>Oui</td>
      <td>Oui</td>
      <td>Oui</td>
    </tr>
  </tbody>
</table>
`.trim();

export const landingBandDefinition = {
  kind: "component",
  definitionKey: "dom-security-landing-band",
  name: "dom-security-landing-band",
  displayName: "Landing Band",
  componentName: "DomSecurityLandingBand",
  icon: "Office/32x32/layout.png",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  datasourceLocation: {
    scope: "site",
    root: "data",
    folder: ["Landing Bands"],
  },
  model: {
    folderTemplate: { name: "Landing Band Folder" },
    itemTemplate: {
      name: "Landing Band",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "Subtitle", type: "Single-Line Text" },
            { name: "Body", type: "Rich Text" },
            { name: "Image", type: "Image" },
            { name: "Link", type: "General Link" },
          ],
        },
      ],
    },
  },
  variants: [
    { name: "Default" },
    { name: "Hero" },
    { name: "CardGrid" },
    { name: "Steps" },
    { name: "Cta" },
  ],
  placeholders: [
    {
      key: "landing-cards",
      allowedControls: ["dom-security-landing-card"],
    },
  ],
  content: {
    location: { root: "data", folder: ["Landing Bands"] },
    culture: "en",
    cultures: ["nl-BE", "fr-BE"],
    items: [
      {
        name: "Access Control Hero",
        displayName: "Contrôle d'accès",
        fields: {
          Title: "Contrôle d'accès : Un verrouillage connecté qui s'adapte à vous",
          Subtitle: "Gestion du contrôle d'accès du système DOM",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM/DOM-Global/dom-eniq/access-control-grid-scroll-1.jpg?extension=webp",
            alt: "Cylindre et badge de contrôle d'accès DOM",
          },
        },
      },
      {
        name: "Access Control Intro",
        displayName: "Qu'est-ce qu'un système de contrôle d'accès",
        fields: {
          Title: "Qu'est-ce qu'un système de contrôle d'accès ?",
          Body: "<p>Les systèmes de contrôle d'accès sont des systèmes électroniques utilisés pour gérer l'entrée dans des bâtiments ou des zones sécurisées. Ils diffèrent des systèmes de contrôle d'accès virtuels, qui sécurisent les espaces en ligne.</p><p>Gérés depuis un centre de contrôle central, généralement via un logiciel ou une application, ces systèmes permettent aux propriétaires ou aux gestionnaires de contrôler l'accès. Les utilisateurs accèdent aux zones sécurisées grâce à des identifiants tels que des cartes, des badges ou des applications mobiles. Ces systèmes offrent des avantages par rapport aux systèmes mécaniques, en particulier pour les organisations plus grandes et complexes.</p>",
        },
      },
      {
        name: "Access Control Benefits",
        displayName: "Efficacité numérique",
        fields: {
          Title: "Découvrez l'efficacité numérique avec le contrôle d'accès DOM",
        },
      },
      {
        name: "Access Control Manage",
        displayName: "Gérer l'accès",
        fields: {
          Title: "Définissez comment vous souhaitez gérer l'accès dans votre système de sécurité",
        },
      },
      {
        name: "Access Control Compare",
        displayName: "Comparez les systèmes",
        fields: {
          Title: "Comparez les systèmes de contrôle d'accès électroniques pour votre entreprise",
          Body: COMPARE_TABLE,
        },
      },
      {
        name: "Access Control Chooser",
        displayName: "Quelle solution",
        fields: {
          Title: "Vous ne savez pas quelle solution convient à votre organisation ?",
          Body: "<p>Utilisez notre configurateur pour le découvrir. Ou contactez nos commerciaux, nous sommes prêts à vous aider.</p>",
          Link: {
            text: "Utiliser le configurateur",
            url: "https://www.dom-security.com/fr/fr/produits-1/access-control",
          },
        },
      },
      {
        name: "Access Control Brochure",
        displayName: "Brochure",
        fields: {
          Title: "Demandez votre brochure de contrôle d'accès",
          Body: "<p>Vous souhaitez en savoir plus sur la manière dont ENiQ ou Tapkey peut vous aider ? Téléchargez la brochure en remplissant le formulaire. Nous vous enverrons le lien de téléchargement par e-mail.</p>",
          Link: {
            text: "Demander la brochure",
            url: "https://www.dom-security.com/fr/fr/produits-1/access-control",
          },
        },
      },
      {
        name: "Coworking Hero",
        displayName: "Coworking avec DOM Tapkey",
        fields: {
          Title: "Coworking avec DOM Tapkey",
          Subtitle: "Des clés intelligentes pour des espaces intelligents",
          Image: {
            url: "https://p-cdn-sfpi.azureedge.net/fr/fr/-/media/DOM/DOM-Global/Image/Tapkey-Add-Ons/Final/DOM-Tapkey-connectivity-centre-hero-1920x800_draft1.jpg?extension=webp",
            alt: "Espace de coworking ouvert avec DOM Tapkey",
          },
        },
      },
      {
        name: "Coworking Intro",
        displayName: "Contrôle d'accès simplifié",
        fields: {
          Title: "Le contrôle d'accès simplifié pour les espaces hybrides",
          Body: "<p>La solution DOM Tapkey s'intègre parfaitement à votre logiciel de coworking, fournissant un accès à la demande aux salles de réunion et aux bureaux flexibles, créant un environnement harmonieux et sécurisé pour les membres et les administrateurs.</p><p>En faisant le lien entre le contrôle d'accès et la gestion des espaces de travail, notre intégration optimise l'expérience utilisateur, en permettant aux membres d'accéder sans effort aux espaces partagés à l'aide de leurs smartphones.</p><p>Le résultat : un espace de travail connecté et efficace où les membres et les équipes peuvent s'épanouir, en stimulant l'efficacité et la collaboration.</p>",
        },
      },
      {
        name: "Coworking Benefits",
        displayName: "Vos avantages",
        fields: {
          Title: "Vos avantages",
          Body: "<p>Accès mobile fluide. Contrôle d'accès en temps réel. Gestion automatisée des accès.</p>",
        },
      },
      {
        name: "Coworking Steps",
        displayName: "Intégration en 3 étapes",
        fields: {
          Title: "L'intégration à votre logiciel de réservation en 3 étapes",
          Body: "<p>L'intégration à votre logiciel de réservation est un processus simple, grâce à nos extensions intuitives. En quelques étapes, vous pouvez connecter votre logiciel à la plateforme DOM Tapkey.</p>",
        },
      },
      {
        name: "Coworking Demo",
        displayName: "Demandez une démo",
        fields: {
          Title: "Demandez une démo",
          Body: "<p>Vous êtes intéressé par la serrure connectée DOM Tapkey ? Découvrez par vous-même les avantages de la gestion d'accès via smartphone : remplissez ce bref formulaire pour bénéficier d'une démo.</p>",
          Link: {
            text: "Demander une démo",
            url: "https://www.dom-security.com/fr/fr/produits-1/dom-tapkey-family/dom-tapkey-for-coworking",
          },
        },
      },
      {
        name: "Coworking Platforms",
        displayName: "Plateformes intégrées",
        fields: {
          Title: "Les plateformes que nous intégrons aujourd'hui",
          Body: "<p>Si votre logiciel de gestion des réservations ne figure pas dans la liste, contactez-nous pour envisager les possibilités.</p>",
        },
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
