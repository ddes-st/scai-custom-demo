import type { ComponentTemplateDefinition } from '../../../../tools/definitions/types';
import { DEFAULT_SERVICE_REQUEST_POST_ENDPOINT } from './service-request-endpoint';

export const serviceRequestFormDefinition = {
  kind: 'component',
  definitionKey: 'dom-security-service-request-form',
  name: 'dom-security-service-request-form',
  displayName: 'Service Request Form',
  componentName: 'DomSecurityServiceRequestForm',
  icon: 'Applications/32x32/form_blue.png',
  collectionSystem: 'domsecurity',
  siteSystem: 'domsecurity-com',
  datasourceLocation: {
    scope: 'site',
    root: 'data',
    folder: ['Service Request Forms'],
  },
  model: {
    folderTemplate: { name: 'Service Request Form Folder' },
    itemTemplate: { name: 'Service Request Form' },
  },
  variants: [{ name: 'Default' }],
  parameters: {
    sections: [
      {
        name: 'Settings',
        sortOrder: 100,
        fields: [
          {
            name: 'Post Endpoint',
            type: 'Single-Line Text',
            shared: true,
            default: DEFAULT_SERVICE_REQUEST_POST_ENDPOINT,
          },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
