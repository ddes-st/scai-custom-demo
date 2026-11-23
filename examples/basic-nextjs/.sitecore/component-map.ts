// Below are built-in components that are available in the app, it's recommended to keep them as is
import { NextjsContentSdkComponent } from '@sitecore-content-sdk/nextjs';


import { BYOCServerWrapper, FEaaSServerWrapper } from '@sitecore-content-sdk/nextjs';
import { Form } from '@sitecore-content-sdk/nextjs';

// end of built-in import section
import * as Text from 'src/components/registry/primitives/editables/text';
import * as SourceNormalizers from 'src/components/registry/primitives/editables/source-normalizers';
import * as Richtext from 'src/components/registry/primitives/editables/richtext';
import * as Link from 'src/components/registry/primitives/editables/link';
import * as Image from 'src/components/registry/primitives/editables/image';
import * as FieldMetadata from 'src/components/registry/primitives/editables/field-metadata';
import * as Typography from 'src/components/registry/primitives/core/typography';
import * as Tooltip from 'src/components/registry/primitives/core/tooltip';
import * as Toggle from 'src/components/registry/primitives/core/toggle';
import * as ToggleGroup from 'src/components/registry/primitives/core/toggle-group';
import * as Timeline from 'src/components/registry/primitives/core/timeline';
import * as ThemeIcon from 'src/components/registry/primitives/core/theme-icon';
import * as Textarea from 'src/components/registry/primitives/core/textarea';
import * as Tabs from 'src/components/registry/primitives/core/tabs';
import * as Table from 'src/components/registry/primitives/core/table';
import * as Switch from 'src/components/registry/primitives/core/switch';
import * as Sonner from 'src/components/registry/primitives/core/sonner';
import * as Skeleton from 'src/components/registry/primitives/core/skeleton';
import * as Sheet from 'src/components/registry/primitives/core/sheet';
import * as Separator from 'src/components/registry/primitives/core/separator';
import * as Select from 'src/components/registry/primitives/core/select';
import * as ScrollArea from 'src/components/registry/primitives/core/scroll-area';
import * as Resizable from 'src/components/registry/primitives/core/resizable';
import * as RadioGroup from 'src/components/registry/primitives/core/radio-group';
import * as Prose from 'src/components/registry/primitives/core/prose';
import * as Progress from 'src/components/registry/primitives/core/progress';
import * as Popover from 'src/components/registry/primitives/core/popover';
import * as Pagination from 'src/components/registry/primitives/core/pagination';
import * as NavigationMenu from 'src/components/registry/primitives/core/navigation-menu';
import * as LibraryIcon from 'src/components/registry/primitives/core/library-icon';
import * as Label from 'src/components/registry/primitives/core/label';
import * as Kbd from 'src/components/registry/primitives/core/kbd';
import * as Item from 'src/components/registry/primitives/core/item';
import * as Input from 'src/components/registry/primitives/core/input';
import * as InputOtp from 'src/components/registry/primitives/core/input-otp';
import * as Icon from 'src/components/registry/primitives/core/icon';
import * as Field from 'src/components/registry/primitives/core/field';
import * as ErrorStates from 'src/components/registry/primitives/core/error-states';
import * as EmptyStates from 'src/components/registry/primitives/core/empty-states';
import * as Editable from 'src/components/registry/primitives/core/editable';
import * as EditPlaceholder from 'src/components/registry/primitives/core/edit-placeholder';
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
import * as Card from 'src/components/registry/primitives/core/card';
import * as Calendar from 'src/components/registry/primitives/core/calendar';
import * as Button from 'src/components/registry/primitives/core/button';
import * as ButtonGroup from 'src/components/registry/primitives/core/button-group';
import * as Breadcrumb from 'src/components/registry/primitives/core/breadcrumb';
import * as Badge from 'src/components/registry/primitives/core/badge';
import * as Avatar from 'src/components/registry/primitives/core/avatar';
import * as AspectRatio from 'src/components/registry/primitives/core/aspect-ratio';
import * as Alert from 'src/components/registry/primitives/core/alert';
import * as AlertDialog from 'src/components/registry/primitives/core/alert-dialog';
import * as Accordion from 'src/components/registry/primitives/core/accordion';
import * as PartialDesignDynamicPlaceholder from 'src/components/partial-design-dynamic-placeholder/PartialDesignDynamicPlaceholder';

export const componentMap = new Map<string, NextjsContentSdkComponent>([
  ['BYOCWrapper', BYOCServerWrapper],
  ['FEaaSWrapper', FEaaSServerWrapper],
  ['Form', { ...Form, componentType: 'client' }],
  ['Text', { ...Text }],
  ['SourceNormalizers', { ...SourceNormalizers }],
  ['Richtext', { ...Richtext }],
  ['Link', { ...Link }],
  ['Image', { ...Image, componentType: 'client' }],
  ['FieldMetadata', { ...FieldMetadata }],
  ['Typography', { ...Typography }],
  ['Tooltip', { ...Tooltip, componentType: 'client' }],
  ['Toggle', { ...Toggle, componentType: 'client' }],
  ['ToggleGroup', { ...ToggleGroup, componentType: 'client' }],
  ['Timeline', { ...Timeline }],
  ['ThemeIcon', { ...ThemeIcon }],
  ['Textarea', { ...Textarea }],
  ['Tabs', { ...Tabs, componentType: 'client' }],
  ['Table', { ...Table, componentType: 'client' }],
  ['Switch', { ...Switch, componentType: 'client' }],
  ['Sonner', { ...Sonner, componentType: 'client' }],
  ['Skeleton', { ...Skeleton }],
  ['Sheet', { ...Sheet, componentType: 'client' }],
  ['Separator', { ...Separator, componentType: 'client' }],
  ['Select', { ...Select, componentType: 'client' }],
  ['ScrollArea', { ...ScrollArea, componentType: 'client' }],
  ['Resizable', { ...Resizable, componentType: 'client' }],
  ['RadioGroup', { ...RadioGroup, componentType: 'client' }],
  ['Prose', { ...Prose }],
  ['Progress', { ...Progress, componentType: 'client' }],
  ['Popover', { ...Popover, componentType: 'client' }],
  ['Pagination', { ...Pagination }],
  ['NavigationMenu', { ...NavigationMenu, componentType: 'client' }],
  ['LibraryIcon', { ...LibraryIcon, componentType: 'client' }],
  ['Label', { ...Label, componentType: 'client' }],
  ['Kbd', { ...Kbd }],
  ['Item', { ...Item }],
  ['Input', { ...Input }],
  ['InputOtp', { ...InputOtp, componentType: 'client' }],
  ['Icon', { ...Icon }],
  ['Field', { ...Field }],
  ['ErrorStates', { ...ErrorStates }],
  ['EmptyStates', { ...EmptyStates }],
  ['Editable', { ...Editable, componentType: 'client' }],
  ['EditPlaceholder', { ...EditPlaceholder }],
  ['DropdownMenu', { ...DropdownMenu, componentType: 'client' }],
  ['Dialog', { ...Dialog, componentType: 'client' }],
  ['DatePicker', { ...DatePicker, componentType: 'client' }],
  ['DataTable', { ...DataTable, componentType: 'client' }],
  ['ContextMenu', { ...ContextMenu, componentType: 'client' }],
  ['Command', { ...Command, componentType: 'client' }],
  ['Combobox', { ...Combobox, componentType: 'client' }],
  ['Collapsible', { ...Collapsible, componentType: 'client' }],
  ['Checkbox', { ...Checkbox, componentType: 'client' }],
  ['Chart', { ...Chart, componentType: 'client' }],
  ['Carousel', { ...Carousel, componentType: 'client' }],
  ['Card', { ...Card }],
  ['Calendar', { ...Calendar, componentType: 'client' }],
  ['Button', { ...Button }],
  ['ButtonGroup', { ...ButtonGroup }],
  ['Breadcrumb', { ...Breadcrumb }],
  ['Badge', { ...Badge }],
  ['Avatar', { ...Avatar, componentType: 'client' }],
  ['AspectRatio', { ...AspectRatio, componentType: 'client' }],
  ['Alert', { ...Alert }],
  ['AlertDialog', { ...AlertDialog, componentType: 'client' }],
  ['Accordion', { ...Accordion, componentType: 'client' }],
  ['PartialDesignDynamicPlaceholder', { ...PartialDesignDynamicPlaceholder }],
]);

export default componentMap;
