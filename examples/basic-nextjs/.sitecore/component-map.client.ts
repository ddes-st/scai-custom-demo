// Client-safe component map for App Router
import { NextjsContentSdkComponent } from '@sitecore-content-sdk/nextjs';


import { BYOCClientWrapper, FEaaSClientWrapper } from '@sitecore-content-sdk/nextjs';
import { Form } from '@sitecore-content-sdk/nextjs';

// end of built-in import section
import * as Image from 'src/components/registry/primitives/editables/image';
import * as Tooltip from 'src/components/registry/primitives/core/tooltip';
import * as Toggle from 'src/components/registry/primitives/core/toggle';
import * as ToggleGroup from 'src/components/registry/primitives/core/toggle-group';
import * as Tabs from 'src/components/registry/primitives/core/tabs';
import * as Table from 'src/components/registry/primitives/core/table';
import * as Switch from 'src/components/registry/primitives/core/switch';
import * as Sonner from 'src/components/registry/primitives/core/sonner';
import * as Sheet from 'src/components/registry/primitives/core/sheet';
import * as Separator from 'src/components/registry/primitives/core/separator';
import * as Select from 'src/components/registry/primitives/core/select';
import * as ScrollArea from 'src/components/registry/primitives/core/scroll-area';
import * as Resizable from 'src/components/registry/primitives/core/resizable';
import * as RadioGroup from 'src/components/registry/primitives/core/radio-group';
import * as Progress from 'src/components/registry/primitives/core/progress';
import * as Popover from 'src/components/registry/primitives/core/popover';
import * as NavigationMenu from 'src/components/registry/primitives/core/navigation-menu';
import * as LibraryIcon from 'src/components/registry/primitives/core/library-icon';
import * as Label from 'src/components/registry/primitives/core/label';
import * as InputOtp from 'src/components/registry/primitives/core/input-otp';
import * as Editable from 'src/components/registry/primitives/core/editable';
import * as DropdownMenu from 'src/components/registry/primitives/core/dropdown-menu';
import * as Dialog from 'src/components/registry/primitives/core/dialog';
import * as DatePicker from 'src/components/registry/primitives/core/date-picker';
import * as DataTable from 'src/components/registry/primitives/core/data-table';
import * as ContextMenu from 'src/components/registry/primitives/core/context-menu';
import * as Command from 'src/components/registry/primitives/core/command';
import * as Combobox from 'src/components/registry/primitives/core/combobox';
import * as Collapsible from 'src/components/registry/primitives/core/collapsible';
import * as Checkbox from 'src/components/registry/primitives/core/checkbox';
import * as Chart from 'src/components/registry/primitives/core/chart';
import * as Carousel from 'src/components/registry/primitives/core/carousel';
import * as Calendar from 'src/components/registry/primitives/core/calendar';
import * as Avatar from 'src/components/registry/primitives/core/avatar';
import * as AspectRatio from 'src/components/registry/primitives/core/aspect-ratio';
import * as AlertDialog from 'src/components/registry/primitives/core/alert-dialog';
import * as Accordion from 'src/components/registry/primitives/core/accordion';

export const componentMap = new Map<string, NextjsContentSdkComponent>([
  ['BYOCWrapper', BYOCClientWrapper],
  ['FEaaSWrapper', FEaaSClientWrapper],
  ['Form', Form],
  ['Image', { ...Image }],
  ['Tooltip', { ...Tooltip }],
  ['Toggle', { ...Toggle }],
  ['ToggleGroup', { ...ToggleGroup }],
  ['Tabs', { ...Tabs }],
  ['Table', { ...Table }],
  ['Switch', { ...Switch }],
  ['Sonner', { ...Sonner }],
  ['Sheet', { ...Sheet }],
  ['Separator', { ...Separator }],
  ['Select', { ...Select }],
  ['ScrollArea', { ...ScrollArea }],
  ['Resizable', { ...Resizable }],
  ['RadioGroup', { ...RadioGroup }],
  ['Progress', { ...Progress }],
  ['Popover', { ...Popover }],
  ['NavigationMenu', { ...NavigationMenu }],
  ['LibraryIcon', { ...LibraryIcon }],
  ['Label', { ...Label }],
  ['InputOtp', { ...InputOtp }],
  ['Editable', { ...Editable }],
  ['DropdownMenu', { ...DropdownMenu }],
  ['Dialog', { ...Dialog }],
  ['DatePicker', { ...DatePicker }],
  ['DataTable', { ...DataTable }],
  ['ContextMenu', { ...ContextMenu }],
  ['Command', { ...Command }],
  ['Combobox', { ...Combobox }],
  ['Collapsible', { ...Collapsible }],
  ['Checkbox', { ...Checkbox }],
  ['Chart', { ...Chart }],
  ['Carousel', { ...Carousel }],
  ['Calendar', { ...Calendar }],
  ['Avatar', { ...Avatar }],
  ['AspectRatio', { ...AspectRatio }],
  ['AlertDialog', { ...AlertDialog }],
  ['Accordion', { ...Accordion }],
]);

export default componentMap;
