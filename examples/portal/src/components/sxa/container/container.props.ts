// Adapted from Sitecore's xmcloud-starter-js (examples/kit-nextjs-skate-park/src/components/container/container.props.ts),
// Apache License 2.0 — see ../LICENSE-xmcloud-starter-js.md.
import { ComponentProps } from 'lib/component-props';

export interface ContainerProps extends ComponentProps {
  params: ComponentProps['params'] & {
    BackgroundImage?: string;
    DynamicPlaceholderId: string;
  };
}
