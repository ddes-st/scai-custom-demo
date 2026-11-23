import { ComponentParams, ComponentRendering } from '@sitecore-content-sdk/nextjs';
import { ComponentWithContextProps } from 'lib/component-props';

export interface ContainerProps extends ComponentWithContextProps {
  rendering: ComponentRendering & { params: ComponentParams };
  params: ComponentParams;
}
