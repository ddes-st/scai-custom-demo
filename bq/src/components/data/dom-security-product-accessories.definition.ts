import type { DataDefinition } from "../../../tools/definitions/types";

const cdn = (path: string) =>
  `https://p-cdn-sfpi.azureedge.net/be/en/-/media/DOM/PimDam/jpg/dom/${path}`;

export const domSecurityProductAccessories = {
  kind: "data",
  definitionKey: "dom-security-product-accessory-items",
  name: "DomSecurityProductAccessoryItems",
  collectionSystem: "domsecurity",
  siteSystem: "domsecurity-com",
  culture: "en",
  cultures: ["nl-BE", "fr-BE"],
  location: {
    root: "data",
    folder: ["Product Accessories"],
  },
  model: {
    folderTemplate: {
      name: "Product Accessory Folder",
      displayName: "Product Accessories",
    },
    itemTemplate: {
      name: "Product Accessory",
      sections: [
        {
          name: "Data",
          sortOrder: 100,
          fields: [
            { name: "Title", type: "Single-Line Text" },
            { name: "SKU", type: "Single-Line Text", shared: true },
            { name: "Description", type: "Single-Line Text" },
            { name: "Image", type: "Image" },
          ],
        },
      ],
    },
  },
  items: [
    {
      name: "fixing-bracket",
      displayName: "Fixing bracket",
      fields: {
        Title: "Fixing bracket",
        SKU: "517707",
        Description: "Required for mounting and dismounting the knob electronics on the cylinder body.",
        Image: {
          url: cdn("f/fixingbracket/domfixingbracket-main-pro-fixing-bracket.jpg?modified=20210327025528&extension=webp"),
          alt: "Fixing bracket",
        },
      },
    },
    {
      name: "els-design-tag",
      displayName: "ELS Design Tag",
      fields: {
        Title: "ELS Design Tag",
        SKU: "DESTAC504599",
        Description: "Design RFID tag for ELS Pro systems.",
        Image: {
          url: cdn("e/elsdt/domelsdt-main.jpg?modified=20210327033547&extension=webp"),
          alt: "ELS Design Tag",
        },
      },
    },
    {
      name: "torx-screwdriver-tx-6",
      displayName: "Torx Screwdriver TX 6",
      fields: {
        Title: "Torx Screwdriver TX 6",
        SKU: "513828",
        Description: "Required for mounting the mechanical inner knob.",
        Image: {
          url: cdn("t/torxtx6/domtorxtx6-main-pro-torx-screwdriver-tx-6.jpg?modified=20210327142656&extension=webp"),
          alt: "Torx Screwdriver TX 6",
        },
      },
    },
    {
      name: "els-combined-transponder-standard-tag",
      displayName: "ELS Combined Transponder Standard Tag",
      fields: {
        Title: "ELS Combined Transponder Standard Tag",
        SKU: "STANTAC504599K",
        Description: "Combined transponder keyring tag for ELS credentials.",
        Image: {
          url: cdn("e/elsct/domelsct-main-anthracite.jpg?modified=20210327124217&extension=webp"),
          alt: "ELS Combined Transponder Standard Tag",
        },
      },
    },
    {
      name: "special-key-ee-im",
      displayName: "Special key for mechanical inner locking of EE IM",
      fields: {
        Title: "Special key for mechanical inner locking of EE IM",
        SKU: "254491",
        Description: "Key for locking function of Pro EE with inner lock.",
        Image: {
          url: cdn("s/specialkeyeeim/domspecialkeyeeim-main-pro-special-key-for-mechanical-inner-locking-of-ee-im.jpg?modified=20210327121057&extension=webp"),
          alt: "Special key EE IM",
        },
      },
    },
    {
      name: "els-clip-tag-with-magnet",
      displayName: "ELS Clip Tag with Magnet",
      fields: {
        Title: "ELS Clip Tag with Magnet",
        SKU: "CLIPTAC503513",
        Description: "Clip tag with magnet for ELS media.",
        Image: {
          url: cdn("e/elsct/domelsct-main-anthracite.jpg?modified=20210327124217&extension=webp"),
          alt: "ELS Clip Tag with Magnet",
        },
      },
    },
    {
      name: "els-usb-radio-stick",
      displayName: "ELS USB Radio Stick with RF Wake Up Card",
      fields: {
        Title: "ELS USB Radio Stick with RF Wake Up Card",
        SKU: "352158",
        Description: "USB radio stick for programming and RF wake-up workflows.",
        Image: {
          url: cdn("e/elsusbradiostickwithwakeupcard/domelsusbradiostickwithwakeupcard-main.jpg?modified=20211117172335&extension=webp"),
          alt: "ELS USB Radio Stick",
        },
      },
    },
    {
      name: "els-clip-tag-without-magnet",
      displayName: "ELS Clip Tag without Magnet",
      fields: {
        Title: "ELS Clip Tag without Magnet",
        SKU: "CLIPTAC503513",
        Description: "Clip tag without magnet for ELS media.",
        Image: {
          url: cdn("e/elsct/domelsct-main-anthracite.jpg?modified=20210327124217&extension=webp"),
          alt: "ELS Clip Tag without Magnet",
        },
      },
    },
    {
      name: "els-rf-netmanager-v8",
      displayName: "ELS RF NetManager V8",
      fields: {
        Title: "ELS RF NetManager V8",
        SKU: "RFNET-V8",
        Description: "Communication module permanently connected to ELS software.",
        Image: {
          url: cdn("e/elsrfnetv8/domelsrfnetv8-main-white-greenled.jpg?modified=20210327130511&extension=webp"),
          alt: "ELS RF NetManager V8",
        },
      },
    },
    {
      name: "torx-screwdriver-tx-10",
      displayName: "Torx Screwdriver TX 10",
      fields: {
        Title: "Torx Screwdriver TX 10",
        SKU: "290493",
        Description: "Required for the installation of the Pro padlock cover.",
        Image: {
          url: cdn("t/torxtx10/domtorxtx10-main.jpg?modified=20220224133402&extension=webp"),
          alt: "Torx Screwdriver TX 10",
        },
      },
    },
    {
      name: "battery-pack",
      displayName: "Battery Pack",
      fields: {
        Title: "Battery Pack",
        SKU: "352153",
        Description: "2-CR2 pack for Protector and Guardian / ELS Pro batteries.",
        Image: {
          url: cdn("b/batterypack/dombatterypack-main-pro-battery-pack.jpg?modified=20210327090851&extension=webp"),
          alt: "Battery Pack",
        },
      },
    },
    {
      name: "installation-tool-set",
      displayName: "Installation tool set",
      fields: {
        Title: "Installation tool set",
        SKU: "516574",
        Description: "Torx screwdriver TX6, knob tool and fixing bracket.",
        Image: {
          url: cdn("i/installationtoolset/dominstallationtoolset-main.jpg?modified=20210327152941&extension=webp"),
          alt: "Installation tool set",
        },
      },
    },
    {
      name: "knob-tool",
      displayName: "Knob tool",
      fields: {
        Title: "Knob tool",
        SKU: "515820",
        Description: "Required for mounting and dismounting the external knob sleeve.",
        Image: {
          url: cdn("k/knobtool/domknobtool-main-pro-knob-tool.jpg?modified=20210327120720&extension=webp"),
          alt: "Knob tool",
        },
      },
    },
    {
      name: "eniq-transponder",
      displayName: "ENiQ Transponder",
      fields: {
        Title: "ENiQ Transponder",
        SKU: "ENIQ-TR-01",
        Description: "RFID transponder compatible with ENiQ readers.",
        Image: {
          url: cdn("e/elsct/domelsct-main-anthracite.jpg?modified=20210327124217&extension=webp"),
          alt: "ENiQ Transponder",
        },
      },
    },
    {
      name: "tapkey-fob",
      displayName: "Tapkey Fob",
      fields: {
        Title: "Tapkey Fob",
        SKU: "TAP-FOB-01",
        Description: "Key fob for Tapkey digital locking.",
        Image: {
          url: cdn("e/elsdt/domelsdt-main.jpg?modified=20210327033547&extension=webp"),
          alt: "Tapkey Fob",
        },
      },
    },
  ],
} satisfies DataDefinition;
