"use client";
import {
  Activity as LucideActivity,
  AlertCircle as LucideAlert,
  Archive as LucideArchive,
  ArrowDown as LucideArrowDown,
  ArrowLeft as LucideArrowLeft,
  ArrowRight as LucideArrowRight,
  ArrowUp as LucideArrowUp,
  Bed as LucideBed,
  Bell as LucideBell,
  Bookmark as LucideBookmark,
  Calendar as LucideCalendar,
  CalendarDays as LucideCalendarDays,
  Camera as LucideCamera,
  BarChart3 as LucideChartBar,
  PieChart as LucideChartPie,
  Check as LucideCheck,
  ChevronDown as LucideChevronDown,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  ChevronsUpDown as LucideChevronsUpDown,
  ChevronUp as LucideChevronUp,
  Circle as LucideCircle,
  Clipboard as LucideClipboard,
  Clock as LucideClock,
  Cloud as LucideCloud,
  CreditCard as LucideCreditCard,
  Download as LucideDownload,
  Edit as LucideEdit,
  Ellipsis as LucideEllipsis,
  Eye as LucideEye,
  EyeOff as LucideEyeOff,
  File as LucideFile,
  Filter as LucideFilter,
  Flag as LucideFlag,
  Folder as LucideFolder,
  Gift as LucideGift,
  Globe as LucideGithub,
  Globe as LucideGlobe,
  Grid2X2 as LucideGrid,
  Heart as LucideHeart,
  HelpCircle as LucideHelp,
  Home as LucideHome,
  Image as LucideImage,
  Info as LucideInfo,
  Key as LucideKey,
  Laptop as LucideLaptop,
  Zap as LucideLightning,
  Link as LucideLink,
  List as LucideList,
  Loader2 as LucideLoader,
  Lock as LucideLock,
  Mail as LucideMail,
  Map as LucideMap,
  MapPin as LucideMapPin,
  Menu as LucideMenu,
  Minus as LucideMinus,
  Monitor as LucideMonitor,
  Moon as LucideMoon,
  Navigation as LucideNavigation,
  Package as LucidePackage,
  PanelLeft as LucidePanelLeft,
  PanelRight as LucidePanelRight,
  Pause as LucidePause,
  Phone as LucidePhone,
  Plane as LucidePlane,
  Play as LucidePlay,
  Plus as LucidePlus,
  RefreshCw as LucideRefresh,
  Rocket as LucideRocket,
  Save as LucideSave,
  Search as LucideSearch,
  Settings as LucideSettings,
  Share2 as LucideShare,
  ShieldCheck as LucideShield,
  ShoppingBag as LucideShoppingBag,
  ShoppingCart as LucideShoppingCart,
  Smartphone as LucideSmartphone,
  Star as LucideStar,
  StopCircle as LucideStop,
  Sun as LucideSun,
  Tablet as LucideTablet,
  Tag as LucideTag,
  Thermometer as LucideThermometer,
  ThumbsDown as LucideThumbsDown,
  ThumbsUp as LucideThumbsUp,
  Trash as LucideTrash,
  Unlock as LucideUnlock,
  Upload as LucideUpload,
  User as LucideUser,
  UserMinus as LucideUserMinus,
  UserPlus as LucideUserPlus,
  Users as LucideUsers,
  Video as LucideVideo,
  AlertTriangle as LucideWarning,
  X as LucideX,
} from "lucide-react";
import * as React from "react";

type IconSetId =
  | "lucide"
  | "heroicons"
  | "tabler"
  | "phosphor"
  | "mui"
  | "fontawesome";
type IconStyle = "outline" | "solid";
type LibraryIconComponent = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  "aria-label"?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  "aria-busy"?: boolean;
}>;
// Constant the slicer rewrites per variant. Determines which set the
// component falls back to when the active set has no entry for an icon.
const FALLBACK_SET: IconSetId = "lucide";
const iconSets: Partial<
  Record<IconSetId, Record<string, LibraryIconComponent>>
> = {
  lucide: {
    activity: LucideActivity,
    x: LucideX,
    alert: LucideAlert,
    "arrow-left": LucideArrowLeft,
    "arrow-right": LucideArrowRight,
    "arrow-up": LucideArrowUp,
    "arrow-down": LucideArrowDown,
    bookmark: LucideBookmark,
    "calendar-days": LucideCalendarDays,
    camera: LucideCamera,
    "chart-bar": LucideChartBar,
    "chart-pie": LucideChartPie,
    "chevron-left": LucideChevronLeft,
    "chevron-right": LucideChevronRight,
    "chevron-up": LucideChevronUp,
    "chevron-down": LucideChevronDown,
    "chevrons-up-down": LucideChevronsUpDown,
    clipboard: LucideClipboard,
    cloud: LucideCloud,
    home: LucideHome,
    "credit-card": LucideCreditCard,
    search: LucideSearch,
    user: LucideUser,
    users: LucideUsers,
    "user-plus": LucideUserPlus,
    "user-minus": LucideUserMinus,
    settings: LucideSettings,
    bell: LucideBell,
    mail: LucideMail,
    calendar: LucideCalendar,
    clock: LucideClock,
    check: LucideCheck,
    plus: LucidePlus,
    minus: LucideMinus,
    menu: LucideMenu,
    map: LucideMap,
    "panel-left": LucidePanelLeft,
    "panel-right": LucidePanelRight,
    info: LucideInfo,
    help: LucideHelp,
    warning: LucideWarning,
    star: LucideStar,
    heart: LucideHeart,
    lock: LucideLock,
    unlock: LucideUnlock,
    eye: LucideEye,
    "eye-off": LucideEyeOff,
    trash: LucideTrash,
    edit: LucideEdit,
    ellipsis: LucideEllipsis,
    download: LucideDownload,
    upload: LucideUpload,
    share: LucideShare,
    link: LucideLink,
    filter: LucideFilter,
    folder: LucideFolder,
    file: LucideFile,
    image: LucideImage,
    archive: LucideArchive,
    circle: LucideCircle,
    loader: LucideLoader,
    globe: LucideGlobe,
    github: LucideGithub,
    bed: LucideBed,
    flag: LucideFlag,
    gift: LucideGift,
    grid: LucideGrid,
    key: LucideKey,
    laptop: LucideLaptop,
    lightning: LucideLightning,
    list: LucideList,
    monitor: LucideMonitor,
    moon: LucideMoon,
    navigation: LucideNavigation,
    "map-pin": LucideMapPin,
    package: LucidePackage,
    pause: LucidePause,
    play: LucidePlay,
    refresh: LucideRefresh,
    rocket: LucideRocket,
    save: LucideSave,
    shield: LucideShield,
    "shopping-bag": LucideShoppingBag,
    smartphone: LucideSmartphone,
    thermometer: LucideThermometer,
    "shopping-cart": LucideShoppingCart,
    phone: LucidePhone,
    plane: LucidePlane,
    stop: LucideStop,
    sun: LucideSun,
    tablet: LucideTablet,
    tag: LucideTag,
    "thumbs-down": LucideThumbsDown,
    "thumbs-up": LucideThumbsUp,
    video: LucideVideo,
  },
};
const iconSetsSolid: Partial<
  Record<IconSetId, Record<string, LibraryIconComponent>>
> = {};
const IconSetContext = React.createContext<IconSetId>(FALLBACK_SET);
const IconStyleContext = React.createContext<IconStyle>("outline");
type IconSetProviderProps = {
  value: IconSetId;
  children: React.ReactNode;
};
type IconStyleProviderProps = {
  value: IconStyle;
  children: React.ReactNode;
};
type LibraryIconProps = {
  name: string;
  set?: IconSetId;
  variant?: IconStyle;
  size?: number;
  className?: string;
  title?: string;
  "aria-label"?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  "aria-busy"?: boolean;
};
function IconSetProvider({ value, children }: IconSetProviderProps) {
  return (
    <IconSetContext.Provider value={value}>{children}</IconSetContext.Provider>
  );
}
function IconStyleProvider({ value, children }: IconStyleProviderProps) {
  return (
    <IconStyleContext.Provider value={value}>
      {children}
    </IconStyleContext.Provider>
  );
}
function LibraryIcon({
  name,
  set,
  variant,
  size,
  className,
  title,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  "aria-busy": ariaBusy,
}: LibraryIconProps) {
  const contextSet = React.useContext(IconSetContext);
  const contextVariant = React.useContext(IconStyleContext);
  const fallbackSet = iconSets[FALLBACK_SET];
  const activeSet = set ?? contextSet;
  const activeVariant = variant ?? contextVariant;
  const baseIcons = iconSets[activeSet] ?? fallbackSet;
  const solidIcons = iconSetsSolid[activeSet];
  const activeIcons =
    activeVariant === "solid" ? (solidIcons ?? baseIcons) : baseIcons;
  const IconComponent =
    activeIcons?.[name] ?? baseIcons?.[name] ?? fallbackSet?.[name];
  if (!IconComponent) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `LibraryIcon: missing icon "${name}" in set "${activeSet}".`,
      );
    }
    return null;
  }
  const label = ariaLabel ?? title;
  const style = size ? { width: size, height: size } : undefined;
  const resolvedAriaHidden = ariaHidden ?? (label ? undefined : true);
  return (
    <IconComponent
      className={className}
      style={style}
      title={title}
      aria-label={label}
      aria-hidden={resolvedAriaHidden}
      aria-busy={ariaBusy}
    />
  );
}

export { IconSetProvider, IconStyleProvider, LibraryIcon };
