import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { doc, collection, setDoc, deleteDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faKey, 
  faEye, 
  faEyeSlash, 
  faCheck, 
  faXmark, 
  faPlus, 
  faTrash, 
  faCircleExclamation,
  faShield,
  faArrowUpRightFromSquare,
  faServer,
  faCrown,
  faChartLine,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons'

interface ApiKey {
  id: string
  provider: string
  maskedKey: string
  createdAt: Date
  isValid?: boolean
}

interface LicenseData {
  plan?: string
  status?: string
  hostedKeyStats?: {
    totalOperations?: number
    lastUsed?: { toDate: () => Date }
  }
}

interface HostedKeyStats {
  available: boolean
  stats?: {
    totalOperations?: number
    totalTokens?: number
    lastUsed?: { toDate: () => Date }
  }
  rateLimits?: {
    hourly?: { limit: number; remaining: number; resetAt: string }
    daily?: { limit: number; remaining: number; resetAt: string }
  }
  providers?: string[]
}

// Hosted providers available for PRO users
const HOSTED_PROVIDERS = ['anthropic', 'openai', 'google', 'perplexity', 'deepseek', 'xai', 'openrouter', 'mistral', 'moonshot', 'zhipu']

// Provider logos as inline SVG components
const ProviderLogos: { [key: string]: React.ReactNode } = {
  anthropic: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918Zm-10.608 0L0 20.459h3.744l1.37-3.553h6.478l1.37 3.553h3.744L10.008 3.541H6.696Zm.422 10.592 2.247-5.822 2.247 5.822h-4.494Z"/>
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  perplexity: (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path d="M19.785 0v7.272H22.5V17.62h-2.935V24l-7.037-6.194v6.145h-1.091v-6.152L4.392 24v-6.465H1.5V7.188h2.884V0l7.053 6.494V.19h1.09v6.49L19.786 0zm-7.257 9.044v7.319l5.946 5.234V14.44l-5.946-5.397zm-1.099-.08l-5.946 5.398v7.235l5.946-5.234V8.965zm8.136 7.58h1.844V8.349H13.46l6.105 5.54v2.655zm-8.982-8.28H2.59v8.195h1.8v-2.576l6.192-5.62zM5.475 2.476v4.71h5.115l-5.115-4.71zm13.219 0l-5.115 4.71h5.115v-4.71z" fill="#22B8CD" fillRule="nonzero"/>
    </svg>
  ),
  xai: (
    <svg viewBox="0 0 841.89 595.28" className="w-6 h-6" fill="currentColor">
      <polygon points="557.09,211.99 565.4,538.36 631.96,538.36 640.28,93.18"/>
      <polygon points="640.28,56.91 538.72,56.91 379.35,284.53 430.13,357.05"/>
      <polygon points="201.61,538.36 303.17,538.36 353.96,465.84 303.17,393.31"/>
      <polygon points="201.61,211.99 430.13,538.36 531.69,538.36 303.17,211.99"/>
    </svg>
  ),
  openrouter: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" fillRule="evenodd">
      <path d="M16.804 1.957l7.22 4.105v.087L16.73 10.21l.017-2.117-.821-.03c-1.059-.028-1.611.002-2.268.11-1.064.175-2.038.577-3.147 1.352L8.345 11.03c-.284.195-.495.336-.68.455l-.515.322-.397.234.385.23.53.338c.476.314 1.17.796 2.701 1.866 1.11.775 2.083 1.177 3.147 1.352l.3.045c.694.091 1.375.094 2.825.033l.022-2.159 7.22 4.105v.087L16.589 22l.014-1.862-.635.022c-1.386.042-2.137.002-3.138-.162-1.694-.28-3.26-.926-4.881-2.059l-2.158-1.5a21.997 21.997 0 00-.755-.498l-.467-.28a55.927 55.927 0 00-.76-.43C2.908 14.73.563 14.116 0 14.116V9.888l.14.004c.564-.007 2.91-.622 3.809-1.124l1.016-.58.438-.274c.428-.28 1.072-.726 2.686-1.853 1.621-1.133 3.186-1.78 4.881-2.059 1.152-.19 1.974-.213 3.814-.138l.02-1.907z"/>
    </svg>
  ),
  mistral: (
    <svg viewBox="0 0 129 91" className="w-5 h-5" style={{ fillRule: 'evenodd', clipRule: 'evenodd' }}>
      <rect x="18.292" y="0" width="18.293" height="18.123" fill="#ffd800"/>
      <rect x="91.473" y="0" width="18.293" height="18.123" fill="#ffd800"/>
      <rect x="18.292" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
      <rect x="73.181" y="18.121" width="36.586" height="18.123" fill="#ffaf00"/>
      <rect x="18.292" y="36.243" width="91.476" height="18.122" fill="#ff8205"/>
      <rect x="18.292" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
      <rect x="54.883" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
      <rect x="91.473" y="54.37" width="18.293" height="18.123" fill="#fa500f"/>
      <rect x="0" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
      <rect x="73.181" y="72.504" width="54.89" height="18.123" fill="#e10500"/>
    </svg>
  ),
  moonshot: (
    <img 
      src="https://firebasestorage.googleapis.com/v0/b/taskmaster-ai-e2302.firebasestorage.app/o/moonshot.png?alt=media&token=dfeba882-dc0f-4a8e-bf6d-415cdd91d378" 
      alt="Moonshot" 
      className="w-5 h-5 object-contain dark:invert-0 invert"
    />
  ),
  deepseek: (
    <svg viewBox="0 0 57.86 43.38" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4d6bfe" d="M57.26,3.65c-.61-.31-.88.27-1.24.57-.12.09-.22.22-.33.33-.89.98-1.94,1.62-3.31,1.54-1.99-.11-3.7.53-5.21,2.08-.32-1.92-1.39-3.06-3.01-3.8-.85-.38-1.7-.76-2.3-1.59-.41-.6-.53-1.26-.73-1.91-.14-.39-.27-.79-.71-.86-.48-.07-.67.34-.86.68-.75,1.41-1.05,2.96-1.02,4.52.07,3.53,1.53,6.34,4.43,8.34.33.22.42.45.31.79-.19.69-.43,1.35-.64,2.04-.13.44-.33.54-.79.35-1.59-.68-2.97-1.68-4.19-2.9-2.06-2.03-3.93-4.28-6.26-6.04-.54-.41-1.09-.79-1.66-1.15-2.37-2.35.32-4.28.94-4.51.65-.24.22-1.06-1.88-1.06-2.1.01-4.02.73-6.48,1.69-.35.14-.73.25-1.12.33-2.22-.43-4.53-.52-6.95-.25-4.54.52-8.17,2.71-10.84,6.44C.2,13.77-.55,18.88.37,24.2c.97,5.61,3.78,10.25,8.1,13.88,4.48,3.77,9.64,5.61,15.52,5.26,3.58-.21,7.56-.7,12.04-4.57,1.14.57,2.32.8,4.29.98,1.52.14,2.98-.08,4.12-.32,1.77-.38,1.65-2.05,1-2.36-5.19-2.46-4.05-1.46-5.09-2.27,2.64-3.19,6.62-6.49,8.18-17.2.12-.85.02-1.39,0-2.08-.01-.42.08-.58.55-.63,1.31-.15,2.57-.51,3.73-1.16,3.36-1.88,4.72-4.95,5.04-8.64.05-.57,0-1.15-.59-1.44ZM27.92,36.84c-5.03-4.03-7.47-5.36-8.48-5.3-.94.06-.78,1.15-.57,1.87.22.71.5,1.2.9,1.82.27.41.46,1.02-.28,1.48-1.62,1.02-4.44-.35-4.57-.41-3.28-1.97-6.02-4.57-7.96-8.13-1.86-3.42-2.95-7.09-3.13-11-.04-.95.23-1.28,1.15-1.46,1.22-.22,2.47-.27,3.69-.09,5.14.76,9.51,3.1,13.18,6.81,2.1,2.11,3.68,4.64,5.31,7.1,1.74,2.62,3.6,5.11,5.98,7.16.84.72,1.51,1.26,2.15,1.66-1.93.22-5.16.27-7.37-1.51ZM30.34,21.03c0-.42.33-.76.74-.76.1,0,.18.02.26.05.1.04.2.1.27.18.13.14.21.33.21.53,0,.42-.33.75-.75.75s-.73-.33-.73-.75ZM37.83,24.94c-.48.21-.96.38-1.42.4-.72.03-1.5-.26-1.92-.62-.66-.57-1.13-.88-1.33-1.87-.09-.42-.04-1.07.04-1.44.17-.8-.02-1.32-.58-1.79-.45-.38-1.03-.49-1.66-.49-.23,0-.45-.1-.61-.19-.27-.13-.48-.46-.28-.88.07-.13.39-.45.47-.51.85-.5,1.84-.34,2.76.04.85.35,1.49,1,2.41,1.92.95,1.11,1.12,1.41,1.65,2.24.43.65.81,1.32,1.08,2.09.16.47-.05.87-.61,1.1Z"/>
    </svg>
  ),
  azure: (
    <svg className="w-5 h-5" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="azure-grad-1" x1="-1032.172" x2="-1059.213" y1="145.312" y2="65.426" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#114a8b"/>
          <stop offset="1" stopColor="#0669bc"/>
        </linearGradient>
        <linearGradient id="azure-grad-2" x1="-1023.725" x2="-1029.98" y1="108.083" y2="105.968" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopOpacity=".3"/>
          <stop offset=".071" stopOpacity=".2"/>
          <stop offset=".321" stopOpacity=".1"/>
          <stop offset=".623" stopOpacity=".05"/>
          <stop offset="1" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="azure-grad-3" x1="-1027.165" x2="-997.482" y1="147.642" y2="68.561" gradientTransform="matrix(1 0 0 -1 1075 158)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3ccbf4"/>
          <stop offset="1" stopColor="#2892df"/>
        </linearGradient>
      </defs>
      <path fill="url(#azure-grad-1)" d="M33.338 6.544h26.038l-27.03 80.087a4.152 4.152 0 0 1-3.933 2.824H8.149a4.145 4.145 0 0 1-3.928-5.47L29.404 9.368a4.152 4.152 0 0 1 3.934-2.825z"/>
      <path fill="#0078d4" d="M71.175 60.261h-41.29a1.911 1.911 0 0 0-1.305 3.309l26.532 24.764a4.171 4.171 0 0 0 2.846 1.121h23.38z"/>
      <path fill="url(#azure-grad-2)" d="M33.338 6.544a4.118 4.118 0 0 0-3.943 2.879L4.252 83.917a4.14 4.14 0 0 0 3.908 5.538h20.787a4.443 4.443 0 0 0 3.41-2.9l5.014-14.777 17.91 16.705a4.237 4.237 0 0 0 2.666.972H81.24L71.024 60.261l-29.781.007L59.47 6.544z"/>
      <path fill="url(#azure-grad-3)" d="M66.595 9.364a4.145 4.145 0 0 0-3.928-2.82H33.648a4.146 4.146 0 0 1 3.928 2.82l25.184 74.62a4.146 4.146 0 0 1-3.928 5.472h29.02a4.146 4.146 0 0 0 3.927-5.472z"/>
    </svg>
  ),
  ollama: (
    <svg className="w-5 h-5" fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.375-1.451.557-2.403.557-1.009 0-1.871-.259-2.493-.734-.617-.47-.963-1.13-.963-1.845 0-.707.398-1.417 1.056-1.946.668-.537 1.55-.849 2.485-.849zm0 .896a3.07 3.07 0 00-1.916.65c-.461.37-.722.835-.722 1.25 0 .428.21.829.61 1.134.455.347 1.124.548 1.943.548.799 0 1.473-.147 1.932-.426.463-.28.7-.686.7-1.257 0-.423-.246-.89-.683-1.256-.484-.405-1.14-.643-1.864-.643zm.662 1.21l.004.004c.12.151.095.37-.056.49l-.292.23v.446a.375.375 0 01-.376.373.375.375 0 01-.376-.373v-.46l-.271-.218a.347.347 0 01-.052-.49.353.353 0 01.494-.051l.215.172.22-.174a.353.353 0 01.49.051zm-5.04-1.919c.478 0 .867.39.867.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zm8.706 0c.48 0 .868.39.868.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zM7.44 2.3l-.003.002a.659.659 0 00-.285.238l-.005.006c-.138.189-.258.467-.348.832-.17.692-.216 1.631-.124 2.782.43-.128.899-.208 1.404-.237l.01-.001.019-.034c.046-.082.095-.161.148-.239.123-.771.022-1.692-.253-2.444-.134-.364-.297-.65-.453-.813a.628.628 0 00-.107-.09L7.44 2.3zm9.174.04l-.002.001a.628.628 0 00-.107.09c-.156.163-.32.45-.453.814-.29.794-.387 1.776-.23 2.572l.058.097.008.014h.03a5.184 5.184 0 011.466.212c.086-1.124.038-2.043-.128-2.722-.09-.365-.21-.643-.349-.832l-.004-.006a.659.659 0 00-.285-.239h-.004z"/>
    </svg>
  ),
  zhipu: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.991 23.503a.24.24 0 00-.244.248.24.24 0 00.244.249.24.24 0 00.245-.249.24.24 0 00-.22-.247l-.025-.001zM9.671 5.365a1.697 1.697 0 011.099 2.132l-.071.172-.016.04-.018.054c-.07.16-.104.32-.104.498-.035.71.47 1.279 1.186 1.314h.366c1.309.053 2.338 1.173 2.286 2.523-.052 1.332-1.152 2.38-2.478 2.327h-.174c-.715.018-1.274.64-1.239 1.368 0 .124.018.23.053.337.209.373.54.658.96.8.75.23 1.517-.125 1.9-.782l.018-.035c.402-.64 1.17-.96 1.92-.711.854.284 1.378 1.226 1.099 2.167a1.661 1.661 0 01-2.077 1.102 1.711 1.711 0 01-.907-.711l-.017-.035c-.2-.323-.463-.58-.851-.711l-.056-.018a1.646 1.646 0 00-1.954.746 1.66 1.66 0 01-1.065.764 1.677 1.677 0 01-1.989-1.279c-.209-.906.332-1.83 1.257-2.043a1.51 1.51 0 01.296-.035h.018c.68-.071 1.151-.622 1.116-1.333a1.307 1.307 0 00-.227-.693 2.515 2.515 0 01-.366-1.403 2.39 2.39 0 01.366-1.208c.14-.195.21-.444.227-.693.018-.71-.506-1.261-1.186-1.332l-.07-.018a1.43 1.43 0 01-.299-.07l-.05-.019a1.7 1.7 0 01-1.047-2.114 1.68 1.68 0 012.094-1.101zm-5.575 10.11c.26-.264.639-.367.994-.27.355.096.633.379.728.74.095.362-.007.748-.267 1.013-.402.41-1.053.41-1.455 0a1.062 1.062 0 010-1.482zm14.845-.294c.359-.09.738.024.992.297.254.274.344.665.237 1.025-.107.36-.396.634-.756.718-.551.128-1.1-.22-1.23-.781a1.05 1.05 0 01.757-1.26zm-.064-4.39c.314.32.49.753.49 1.206 0 .452-.176.886-.49 1.206-.315.32-.74.5-1.185.5-.444 0-.87-.18-1.184-.5a1.727 1.727 0 010-2.412 1.654 1.654 0 012.369 0zm-11.243.163c.364.484.447 1.128.218 1.691a1.665 1.665 0 01-2.188.923c-.855-.36-1.26-1.358-.907-2.228a1.68 1.68 0 011.33-1.038c.593-.08 1.183.169 1.547.652zm11.545-4.221c.368 0 .708.2.892.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.892.524c-.568 0-1.03-.47-1.03-1.048 0-.579.462-1.048 1.03-1.048zm-14.358 0c.368 0 .707.2.891.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.891.524c-.569 0-1.03-.47-1.03-1.048 0-.579.461-1.048 1.03-1.048zm10.031-1.475c.925 0 1.675.764 1.675 1.706s-.75 1.705-1.675 1.705-1.674-.763-1.674-1.705c0-.942.75-1.706 1.674-1.706zm-2.626-.684c.362-.082.653-.356.761-.718a1.062 1.062 0 00-.238-1.028 1.017 1.017 0 00-.996-.294c-.547.14-.881.7-.752 1.257.13.558.675.907 1.225.783zm0 16.876c.359-.087.644-.36.75-.72a1.062 1.062 0 00-.237-1.019 1.018 1.018 0 00-.985-.301 1.037 1.037 0 00-.762.717c-.108.361-.017.754.239 1.028.245.263.606.377.953.305l.043-.01zM17.19 3.5a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64a.631.631 0 00-.628.64c0 .355.28.64.628.64zm-10.38 0a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64a.631.631 0 00-.628.64c0 .355.279.64.628.64zm-5.182 7.852a.631.631 0 00-.628.64c0 .354.28.639.628.639a.63.63 0 00.627-.606l.001-.034a.62.62 0 00-.628-.64zm5.182 9.13a.631.631 0 00-.628.64c0 .355.279.64.628.64a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm10.38.018a.631.631 0 00-.628.64c0 .355.28.64.628.64a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64zm5.182-9.148a.631.631 0 00-.628.64c0 .354.279.639.628.639a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm-.384-4.992a.24.24 0 00.244-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249c0 .142.122.249.244.249zM11.991.497a.24.24 0 00.245-.248A.24.24 0 0011.99 0a.24.24 0 00-.244.249c0 .133.108.236.223.247l.021.001zM2.011 6.36a.24.24 0 00.245-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249.24.24 0 00.244.249zm0 11.263a.24.24 0 00-.243.248.24.24 0 00.244.249.24.24 0 00.244-.249.252.252 0 00-.244-.248zm19.995-.018a.24.24 0 00-.245.248.24.24 0 00.245.25.24.24 0 00.244-.25.252.252 0 00-.244-.248z" fill="#3859FF" fillRule="nonzero"/>
    </svg>
  ),
  meta: (
    <svg className="w-5 h-5" viewBox="0 0 287.56 191" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="meta-grad-1" x1="61" y1="117" x2="259" y2="127" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0064e1" offset="0"/>
          <stop stopColor="#0064e1" offset="0.4"/>
          <stop stopColor="#0073ee" offset="0.83"/>
          <stop stopColor="#0082fb" offset="1"/>
        </linearGradient>
        <linearGradient id="meta-grad-2" x1="45" y1="139" x2="45" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0082fb" offset="0"/>
          <stop stopColor="#0064e0" offset="1"/>
        </linearGradient>
      </defs>
      <path fill="#0081fb" d="m31.06,125.96c0,10.98 2.41,19.41 5.56,24.51 4.13,6.68 10.29,9.51 16.57,9.51 8.1,0 15.51-2.01 29.79-21.76 11.44-15.83 24.92-38.05 33.99-51.98l15.36-23.6c10.67-16.39 23.02-34.61 37.18-46.96 11.56-10.08 24.03-15.68 36.58-15.68 21.07,0 41.14,12.21 56.5,35.11 16.81,25.08 24.97,56.67 24.97,89.27 0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75l0-31.02c17.63,0 22.03-16.2 22.03-34.74 0-26.42-6.16-55.74-19.73-76.69-9.63-14.86-22.11-23.94-35.84-23.94-14.85,0-26.8,11.2-40.23,31.17-7.14,10.61-14.47,23.54-22.7,38.13l-9.06,16.05c-18.2,32.27-22.81,39.62-31.91,51.75-15.95,21.24-29.57,29.29-47.5,29.29-21.27,0-34.72-9.21-43.05-23.09-6.8-11.31-10.14-26.15-10.14-43.06z"/>
      <path fill="url(#meta-grad-1)" d="m24.49,37.3c14.24-21.95 34.79-37.3 58.36-37.3 13.65,0 27.22,4.04 41.39,15.61 15.5,12.65 32.02,33.48 52.63,67.81l7.39,12.32c17.84,29.72 27.99,45.01 33.93,52.22 7.64,9.26 12.99,12.02 19.94,12.02 17.63,0 22.03-16.2 22.03-34.74l27.4-.86c0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75-12.8,0-24.14-2.78-36.68-14.61-9.64-9.08-20.91-25.21-29.58-39.71l-25.79-43.08c-12.94-21.62-24.81-37.74-31.68-45.04-7.39-7.85-16.89-17.33-32.05-17.33-12.27,0-22.69,8.61-31.41,21.78z"/>
      <path fill="url(#meta-grad-2)" d="m82.35,31.23c-12.27,0-22.69,8.61-31.41,21.78-12.33,18.61-19.88,46.33-19.88,72.95 0,10.98 2.41,19.41 5.56,24.51l-26.48,17.44c-6.8-11.31-10.14-26.15-10.14-43.06 0-30.75 8.44-62.8 24.49-87.55 14.24-21.95 34.79-37.3 58.36-37.3z"/>
    </svg>
  ),
}

const providers = [
  { id: 'anthropic', name: 'Anthropic (Claude)', description: 'Opus 4.5, Sonnet 4.5, Haiku 4.5', docsUrl: 'https://console.anthropic.com/' },
  { id: 'openai', name: 'OpenAI (GPT)', description: 'GPT 5.2, GPT 5.1, GPT 5, o3', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'google', name: 'Google (Gemini)', description: 'Gemini 3 Pro, 2.5 Pro/Flash', docsUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'perplexity', name: 'Perplexity', description: 'Research and web search', docsUrl: 'https://www.perplexity.ai/settings/api' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek V3, V3.1, R1', docsUrl: 'https://platform.deepseek.com/' },
  { id: 'xai', name: 'xAI (Grok)', description: 'Grok 4, Grok 3', docsUrl: 'https://console.x.ai/' },
  { id: 'openrouter', name: 'OpenRouter', description: 'Multiple models', docsUrl: 'https://openrouter.ai/keys' },
  { id: 'mistral', name: 'Mistral', description: 'Mistral AI models', docsUrl: 'https://console.mistral.ai/api-keys/' },
  { id: 'moonshot', name: 'Moonshot', description: 'Kimi K2', docsUrl: 'https://platform.moonshot.cn/' },
  { id: 'zhipu', name: 'Zhipu AI', description: 'GLM 4.6, GLM 4.5', docsUrl: 'https://open.bigmodel.cn/' },
  { id: 'meta', name: 'Meta (Llama)', description: 'Llama 4, Llama 3.3 70B', docsUrl: 'https://ai.meta.com/' },
  { id: 'azure', name: 'Azure OpenAI', description: 'Azure-hosted OpenAI', docsUrl: 'https://portal.azure.com/' },
  { id: 'ollama', name: 'Ollama', description: 'Local models', docsUrl: 'https://ollama.com/' },
]

export default function ApiKeys() {
  const { user } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [, setLoading] = useState(true)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [newKeyValue, setNewKeyValue] = useState('')
  const [showKey, setShowKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [licenseData, setLicenseData] = useState<LicenseData | null>(null)
  const [hostedStats, setHostedStats] = useState<HostedKeyStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const isPro = licenseData?.plan === 'pro' && licenseData?.status === 'active'

  // Real-time listener for API keys
  useEffect(() => {
    if (!user) {
      setKeys([])
      setLoading(false)
      return
    }

    const keysRef = collection(db, 'users', user.uid, 'apiKeys')
    const unsubscribe = onSnapshot(keysRef, (snapshot) => {
      const loadedKeys: ApiKey[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        loadedKeys.push({
          id: doc.id,
          provider: data.provider,
          maskedKey: data.maskedKey,
          createdAt: data.createdAt?.toDate() || new Date(),
          isValid: data.isValid,
        })
      })
      setKeys(loadedKeys)
      setLoading(false)
    }, (err) => {
      console.error('Error loading keys:', err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  // Listen to license data for PRO status
  useEffect(() => {
    if (!user) {
      setLicenseData(null)
      return
    }

    const licenseRef = doc(db, 'users', user.uid, 'license', 'current')
    const unsubscribe = onSnapshot(licenseRef, (snapshot) => {
      if (snapshot.exists()) {
        setLicenseData(snapshot.data() as LicenseData)
      } else {
        setLicenseData(null)
      }
    }, (err) => {
      console.error('Error loading license:', err)
    })

    return () => unsubscribe()
  }, [user])

  // Fetch hosted key stats for PRO users
  useEffect(() => {
    if (!user || !isPro) {
      setHostedStats(null)
      return
    }

    const fetchStats = async () => {
      setLoadingStats(true)
      try {
        const response = await fetch('https://us-central1-taskmaster-ai-e2302.cloudfunctions.net/getHostedKeyStats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid })
        })
        const data = await response.json()
        if (data.success) {
          setHostedStats(data)
        }
      } catch (err) {
        console.error('Error fetching hosted stats:', err)
      } finally {
        setLoadingStats(false)
      }
    }

    fetchStats()
  }, [user, isPro])

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••'
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4)
  }

  const handleAddKey = async (providerId: string) => {
    if (!user || !newKeyValue.trim()) return
    setError('')
    setSuccess('')

    try {
      const keyRef = doc(db, 'users', user.uid, 'apiKeys', providerId)
      await setDoc(keyRef, {
        provider: providerId,
        maskedKey: maskKey(newKeyValue),
        fullKey: newKeyValue.trim(), // Store full key for CLI sync
        createdAt: serverTimestamp(),
        isValid: true,
      })

      setKeys((prev) => [
        ...prev.filter((k) => k.provider !== providerId),
        { id: providerId, provider: providerId, maskedKey: maskKey(newKeyValue), createdAt: new Date(), isValid: true },
      ])

      setSuccess(`${providers.find((p) => p.id === providerId)?.name} key added`)
      setAddingKey(null)
      setNewKeyValue('')
    } catch (err) {
      setError('Failed to save API key')
    }
  }

  const handleDeleteKey = async (providerId: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'apiKeys', providerId))
      setKeys((prev) => prev.filter((k) => k.provider !== providerId))
      setSuccess('API key removed')
    } catch (err) {
      setError('Failed to remove API key')
    }
  }

  const getKeyForProvider = (providerId: string) => keys.find((k) => k.provider === providerId)

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <h1 className="text-2xl font-bold mb-1">API Keys</h1>
        <p className="text-sm text-text-muted">Securely store your AI provider API keys</p>
      </motion.div>

      {/* Security notice */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }} className="mb-8">
        <div className="card flex items-start gap-4 p-5">
          <FontAwesomeIcon icon={faShield} className="w-5 h-5 text-text-muted flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-medium">Your keys are secure</p>
            <p className="text-sm text-text-muted">API keys are encrypted and never exposed in the browser</p>
          </div>
        </div>
      </motion.div>

      {/* Hosted API Keys Section (PRO Only) */}
      {isPro && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="mb-8">
          <div className="card p-5 border-2 border-brand-primary/30 bg-gradient-to-br from-brand-primary/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={faServer} className="w-6 h-6 text-brand-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold">Hosted API Keys</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary text-xs font-medium">
                    <FontAwesomeIcon icon={faCrown} className="w-3 h-3" />
                    PRO
                  </span>
                </div>
                <p className="text-sm text-text-muted mb-4">
                  You have access to hosted API keys — no need to configure your own! The CLI will automatically use our hosted keys if you haven't set your own.
                </p>

                {/* Available Providers */}
                <div className="mb-4 overflow-x-auto">
                  <p className="text-xs font-medium text-text-subtle uppercase tracking-wide mb-2">Available Providers</p>
                  <div className="flex flex-wrap gap-2 min-w-0">
                    {HOSTED_PROVIDERS.map((provider) => (
                      <span key={provider} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface text-sm">
                        <span className="w-4 h-4 flex items-center justify-center">
                          {ProviderLogos[provider]}
                        </span>
                        <span className="capitalize">{provider}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Usage Stats */}
                {loadingStats ? (
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <div className="w-4 h-4 border-2 border-text-muted/30 border-t-brand-primary rounded-full animate-spin" />
                    Loading usage stats...
                  </div>
                ) : hostedStats?.stats ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-surface">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                        <FontAwesomeIcon icon={faChartLine} className="w-3 h-3" />
                        Total Operations
                      </div>
                      <div className="text-lg font-semibold">{hostedStats.stats.totalOperations?.toLocaleString() || 0}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-surface">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                        <FontAwesomeIcon icon={faKey} className="w-3 h-3" />
                        Total Tokens
                      </div>
                      <div className="text-lg font-semibold">{hostedStats.stats.totalTokens?.toLocaleString() || 0}</div>
                    </div>
                    {hostedStats.rateLimits?.hourly && (
                      <div className="p-3 rounded-lg bg-surface">
                        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                          Hourly Limit
                        </div>
                        <div className="text-lg font-semibold">
                          {hostedStats.rateLimits.hourly.remaining}/{hostedStats.rateLimits.hourly.limit}
                        </div>
                      </div>
                    )}
                    {hostedStats.rateLimits?.daily && (
                      <div className="p-3 rounded-lg bg-surface">
                        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-1">
                          Daily Limit
                        </div>
                        <div className="text-lg font-semibold">
                          {hostedStats.rateLimits.daily.remaining}/{hostedStats.rateLimits.daily.limit}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Info Note */}
                <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-surface-elevated text-sm">
                  <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                  <p className="text-text-muted">
                    Your own API keys take priority. Hosted keys are used as a fallback when you haven't configured your own.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Upgrade prompt for non-PRO users */}
      {licenseData && !isPro && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="mb-8">
          <div className="card p-5 border border-border-default/50 bg-surface-elevated/50">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={faServer} className="w-5 h-5 text-text-muted" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium">Hosted API Keys</h3>
                  <span className="px-2 py-0.5 rounded-full bg-surface text-text-muted text-xs font-medium">
                    PRO Only
                  </span>
                </div>
                <p className="text-sm text-text-muted mb-3">
                  Upgrade to Pro to use our hosted API keys — no need to manage your own keys!
                </p>
                <a href="/pricing" className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2">
                  <FontAwesomeIcon icon={faCrown} className="w-3.5 h-3.5" />
                  Upgrade to Pro
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Status messages */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated border border-status-error text-status-error text-sm mb-5">
          <FontAwesomeIcon icon={faCircleExclamation} className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated border border-status-success text-status-success text-sm mb-5">
          <FontAwesomeIcon icon={faCheck} className="w-4 h-4 flex-shrink-0" />
          {success}
        </motion.div>
      )}

      {/* Providers list */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }} className="space-y-4">
        {providers.map((provider) => {
          const existingKey = getKeyForProvider(provider.id)
          const isAdding = addingKey === provider.id

          return (
            <div key={provider.id} className="card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  {/* Provider Logo */}
                  <div className="w-10 h-10 rounded-lg bg-surface-highlight flex items-center justify-center flex-shrink-0 text-text-secondary">
                    {ProviderLogos[provider.id]}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <h3 className="text-base font-medium">{provider.name}</h3>
                      {existingKey && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-status-success/10 text-status-success text-xs font-medium">
                          <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                          Added
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-muted">{provider.description}</p>

                  {existingKey && !isAdding && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface font-mono text-sm overflow-hidden">
                        <FontAwesomeIcon icon={faKey} className="w-3.5 h-3.5 text-text-subtle flex-shrink-0" />
                        <span className="truncate">{showKey === provider.id ? existingKey.maskedKey : '••••••••••••'}</span>
                      </div>
                      <button onClick={() => setShowKey(showKey === provider.id ? null : provider.id)} className="p-1.5 text-text-subtle hover:text-text">
                        <FontAwesomeIcon icon={showKey === provider.id ? faEyeSlash : faEye} className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {isAdding && (
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleAddKey(provider.id) }}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3"
                    >
                      <input
                        type="password"
                        value={newKeyValue}
                        onChange={(e) => setNewKeyValue(e.target.value)}
                        placeholder={`Enter ${provider.name} API key`}
                        className="input flex-1"
                        autoComplete="off"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={!newKeyValue.trim()} className="btn-primary py-2 px-3 flex-1 sm:flex-none">
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                      </button>
                        <button type="button" onClick={() => { setAddingKey(null); setNewKeyValue('') }} className="btn-ghost py-2 px-3 flex-1 sm:flex-none">
                        <FontAwesomeIcon icon={faXmark} className="w-4 h-4" />
                      </button>
                      </div>
                    </form>
                  )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-start">
                  <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-text-subtle hover:text-text" title="Get API key">
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-4 h-4" />
                  </a>
                  
                  {existingKey ? (
                    <>
                      <button onClick={() => { setAddingKey(provider.id); setNewKeyValue('') }} className="btn-secondary text-sm py-2 px-3">
                        Update
                      </button>
                      <button onClick={() => handleDeleteKey(provider.id)} className="p-2 text-status-error hover:bg-status-error/10 rounded-lg">
                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    !isAdding && (
                      <button onClick={() => setAddingKey(provider.id)} className="btn-primary text-sm py-2 px-3">
                        <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-1.5" />
                        Add
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}
