/**
 * Centralized icon registry — semantic re-exports from lucide-react.
 *
 * All new code should import icons from `@/lib/icons` instead of
 * directly from `lucide-react`. This creates a single source of truth
 * for icon choices and makes bulk swaps trivial.
 *
 * Existing feature files can be migrated gradually.
 */
export {
  // ── Navigation ──────────────────────────────────────────────────────────────
  FolderOpen as ProjectsIcon,
  MessageSquare as ChatIcon,
  Users as PeopleIcon,
  Building2 as OrgIcon,
  Zap as ToolsIcon,
  Workflow as AgentDesignerIcon,
  FlaskConical as PipelineIcon,
  GitBranch as FlowsIcon,
  BarChart3 as ExperimentsIcon,
  Database as DatabaseIcon,
  Activity as HealthIcon,
  Settings as SettingsIcon,
  FlaskRound as LabIcon,

  // ── Actions ─────────────────────────────────────────────────────────────────
  Plus as AddIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Search as SearchIcon,
  Copy as CopyIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  ExternalLink as ExternalLinkIcon,
  MoreVertical as MoreIcon,
  ArrowUpDown as SortIcon,
  Filter as FilterIcon,
  RefreshCw as RefreshIcon,

  // ── Status / feedback ───────────────────────────────────────────────────────
  Check as CheckIcon,
  X as CloseIcon,
  Loader2 as SpinnerIcon,
  AlertCircle as AlertIcon,
  Info as InfoIcon,
  AlertTriangle as WarningIcon,
  CheckCircle2 as SuccessIcon,

  // ── Entity ──────────────────────────────────────────────────────────────────
  UsersRound as TeamsIcon,
  UserRound as MemberIcon,
  MailPlus as InviteIcon,
  Crown as OwnerIcon,
  ShieldCheck as AdminIcon,
  LogIn as JoinIcon,

  // ── UI chrome ───────────────────────────────────────────────────────────────
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronsUpDown as ExpandIcon,
  PanelLeftClose as CollapseIcon,
  PanelLeftOpen as ExpandSidebarIcon,
  Moon as MoonIcon,
  Sun as SunIcon,
  Bell as NotificationIcon,
  LogOut as LogOutIcon,
  Palette as PaletteIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Sparkles as SparklesIcon,
} from 'lucide-react'
